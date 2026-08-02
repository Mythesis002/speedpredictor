import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRoundClock, revealRound } from "./rounds.functions";
import {
  isLocked,
  lineupForRound,
  localReveal,
  outcomeFromReveal,
  timelineAt,
  type Outcome,
  type RacePhase,
} from "./round-engine";
import type { CarSpec } from "@/components/race/Car";

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface Fairness {
  commit: string | null;
  reveal: string | null;
  verified: boolean | null;
  online: boolean;
}

export interface RaceRound {
  roundId: number;
  phase: RacePhase;
  countdown: number;
  locked: boolean;
  cars: [CarSpec, CarSpec, CarSpec];
  /** live 0..1 progress per lane, mutated every frame outside React */
  progressRef: { current: [number, number, number] };
  /** finishing order once the round is resolved, else null */
  order: [number, number, number] | null;
  winner: number | null;
  fairness: Fairness;
}

/**
 * Drives the whole race from a server-synced clock.
 *
 * - one `requestAnimationFrame` loop writes lane progress into a ref (no re-render)
 * - React state updates only when the phase changes or the countdown ticks
 * - the outcome is fetched from the server the moment betting locks and is
 *   cryptographically verified against the pre-published commitment
 */
export function useRaceRound(onSettle?: (roundId: number, order: [number, number, number]) => void) {
  const fetchClock = useServerFn(getRoundClock);
  const fetchReveal = useServerFn(revealRound);

  const offsetRef = useRef(0); // serverNow - clientNow
  const [phase, setPhase] = useState<RacePhase>("waiting");
  const [roundId, setRoundId] = useState(() => timelineAt(Date.now()).roundId);
  const [countdownTick, setCountdownTick] = useState(0);
  const countdownRef = useRef(0);
  const progressRef = useRef<[number, number, number]>([0, 0, 0]);

  const [commits, setCommits] = useState<Record<number, string>>({});
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [reveals, setReveals] = useState<Record<number, string>>({});
  const [verifiedMap, setVerifiedMap] = useState<Record<number, boolean | null>>({});
  const [online, setOnline] = useState(false);
  const requested = useRef<Set<number>>(new Set());
  const settled = useRef<Set<number>>(new Set());

  // refs mirror state so the render loop never has to restart
  const outcomesRef = useRef(outcomes);
  outcomesRef.current = outcomes;
  const commitsRef = useRef(commits);
  commitsRef.current = commits;
  const settleRef = useRef(onSettle);
  settleRef.current = onSettle;

  /* ---- clock sync (mount + on refocus, with drift correction) ---- */
  const sync = useCallback(async () => {
    try {
      const t0 = Date.now();
      const clock = await fetchClock({});
      const rtt = Date.now() - t0;
      offsetRef.current = clock.serverNow + rtt / 2 - Date.now();
      setOnline(true);
      setCommits((c) => ({
        ...c,
        [clock.roundId]: clock.commit,
        [clock.roundId + 1]: clock.nextCommit,
      }));
    } catch {
      setOnline(false);
    }
  }, [fetchClock]);

  useEffect(() => {
    void sync();
    const id = setInterval(() => void sync(), 60_000);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sync]);

  /* ---- outcome fetch + commitment verification ---- */
  const resolve = useCallback(
    async (id: number) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      let reveal: string;
      let ok: boolean | null = null;
      try {
        const res = await fetchReveal({ data: { roundId: id } });
        reveal = res.reveal;
        const known = commitsRef.current[id];
        // sha256(reveal) must equal the commitment, and that commitment must
        // match the one published before betting opened (when we have it).
        ok = (await sha256Hex(reveal)) === res.commit && (!known || known === res.commit);
        setOnline(true);
      } catch {
        reveal = localReveal(id); // offline fallback keeps the race running
        ok = null;
        setOnline(false);
      }
      setReveals((r) => ({ ...r, [id]: reveal }));
      setOutcomes((o) => ({ ...o, [id]: outcomeFromReveal(reveal) }));
      console.log("[fair] resolve", id, ok);
      setVerifiedMap((v) => ({ ...v, [id]: ok }));
    },
    [fetchReveal],
  );
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  /* ---- single animation loop (never restarts) ---- */
  useEffect(() => {
    let raf = 0;
    let lastPhase: RacePhase | null = null;
    let lastRound = -1;
    let lastTick = -1;

    const loop = () => {
      const now = Date.now() + offsetRef.current;
      const tl = timelineAt(now);

      if (tl.roundId !== lastRound) {
        lastRound = tl.roundId;
        setRoundId(tl.roundId);
      }
      if (tl.phase !== lastPhase) {
        lastPhase = tl.phase;
        setPhase(tl.phase);
      }
      if (isLocked(tl.phase)) void resolveRef.current(tl.roundId);

      const outcome = outcomesRef.current[tl.roundId];
      if (outcome && tl.raceT > 0) {
        progressRef.current = [
          outcome.curves[0](tl.raceT),
          outcome.curves[1](tl.raceT),
          outcome.curves[2](tl.raceT),
        ];
        if (tl.raceT >= 1 && !settled.current.has(tl.roundId)) {
          settled.current.add(tl.roundId);
          settleRef.current?.(tl.roundId, outcome.order);
        }
      } else if (tl.raceT === 0) {
        progressRef.current = [0, 0, 0];
      }

      countdownRef.current = tl.countdown;
      const tick = Math.ceil(tl.countdown * 10);
      if (tick !== lastTick) {
        lastTick = tick;
        setCountdownTick(tick);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cars = useMemo(() => lineupForRound(roundId), [roundId]);
  const outcome = outcomes[roundId] ?? null;
  const locked = isLocked(phase);

  return {
    roundId,
    phase,
    countdown: countdownTick / 10,
    locked,
    cars,
    progressRef,
    order: outcome?.order ?? null,
    winner: phase === "finish" && outcome ? outcome.order[0] : null,
    fairness: {
      commit: commits[roundId] ?? null,
      reveal: reveals[roundId] ?? null,
      verified: verifiedMap[roundId] ?? null,
      online,
    },
  } satisfies RaceRound;
}
