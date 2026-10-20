import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkNetworkHealth } from "./network.functions";

export type NetworkStatus = "online" | "slow" | "offline";

export interface NetworkState {
  status: NetworkStatus;
  isOnline: boolean;
  isSlow: boolean;
  isOffline: boolean;
  isPaused: boolean;
  latencyMs: number | null;
  effectiveType: string | null;
  consecutiveFails: number;
  retrying: boolean;
  justRestored: boolean;
  checkNow: () => Promise<boolean>;
}

// Only trigger slow status if latency is extreme (> 7.5s) or downlink drops to ~10-20 kb/s (0.03 Mbps)
const SLOW_LATENCY_THRESHOLD_MS = 7500;
const PING_TIMEOUT_MS = 7000;
const PING_INTERVAL_ONLINE_MS = 12000;
const PING_INTERVAL_RETRY_MS = 3000;

interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  rtt?: number;
  downlink?: number; // Mb/s
  saveData?: boolean;
}

export function useNetworkMonitor(onRecovered?: () => void): NetworkState {
  const pingServer = useServerFn(checkNetworkHealth);

  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return "offline";
    }
    return "online";
  });

  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [effectiveType, setEffectiveType] = useState<string | null>(null);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [justRestored, setJustRestored] = useState(false);

  const failsRef = useRef(0);
  const consecutiveSlowRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;

  // Single ping execution with generous 7s timeout to prevent false timeouts on mobile
  const runPing = useCallback(async (): Promise<{ ok: boolean; latency: number | null }> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { ok: false, latency: null };
    }

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      const res = await pingServer({ signal: controller.signal });
      clearTimeout(timeoutId);

      const rtt = Math.round(performance.now() - t0);
      if (res?.ok) {
        return { ok: true, latency: rtt };
      }
      return { ok: false, latency: rtt };
    } catch {
      return { ok: false, latency: null };
    }
  }, [pingServer]);

  // Main evaluation logic
  const evaluateConnection = useCallback(
    async (isManualRetry = false): Promise<boolean> => {
      if (isManualRetry) setRetrying(true);

      // Check browser Network Information API
      let netInfoType: string | null = null;
      let downlinkMbps: number | null = null;
      if (typeof navigator !== "undefined" && "connection" in navigator) {
        const netInfo = (navigator as unknown as { connection?: NetworkInformation }).connection;
        if (netInfo?.effectiveType) {
          netInfoType = netInfo.effectiveType;
          setEffectiveType(netInfo.effectiveType);
        }
        if (typeof netInfo?.downlink === "number") {
          downlinkMbps = netInfo.downlink;
        }
      }

      // Hard offline: navigator is explicitly offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        failsRef.current = 3;
        setConsecutiveFails(3);
        setLatencyMs(null);
        setStatus("offline");
        if (isManualRetry) setRetrying(false);
        return false;
      }

      const { ok, latency } = await runPing();

      if (isManualRetry) setRetrying(false);

      if (!ok) {
        failsRef.current += 1;
        setConsecutiveFails(failsRef.current);

        // Require 3 consecutive failed pings before declaring offline (no false alarms on single packet loss)
        if (failsRef.current >= 3 || isManualRetry) {
          setLatencyMs(null);
          setStatus("offline");
          return false;
        }

        // On transient 1st or 2nd fail, maintain current status and check again shortly
        return statusRef.current === "online";
      }

      // Ping succeeded!
      failsRef.current = 0;
      setConsecutiveFails(0);
      setLatencyMs(latency);

      const wasOfflineOrSlow = statusRef.current === "offline" || statusRef.current === "slow";

      // Detect genuinely critical slow network (~10kb/s or severe latency > 7500ms):
      // Downlink <= 0.03 Mbps is ~24-30 kb/s or slower (matching user specification of ~10kb/s)
      const isExtremeLatency = latency !== null && latency >= SLOW_LATENCY_THRESHOLD_MS;
      const isExtremeBandwidth =
        (downlinkMbps !== null && downlinkMbps <= 0.03) ||
        (netInfoType === "slow-2g" && latency !== null && latency > 4000);

      if (isExtremeLatency || isExtremeBandwidth) {
        consecutiveSlowRef.current += 1;
        // Require 2 consecutive extremely slow checks before interrupting the user
        if (consecutiveSlowRef.current >= 2 || isManualRetry) {
          setStatus("slow");
          return false;
        }
      } else {
        consecutiveSlowRef.current = 0;
      }

      // Connection is healthy and usable
      setStatus("online");

      if (wasOfflineOrSlow) {
        setJustRestored(true);
        setTimeout(() => setJustRestored(false), 2600);
        onRecoveredRef.current?.();
      }

      return true;
    },
    [runPing],
  );

  // Periodic heartbeat & browser event listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timerId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay =
        statusRef.current === "online" && failsRef.current === 0
          ? PING_INTERVAL_ONLINE_MS
          : PING_INTERVAL_RETRY_MS;
      timerId = setTimeout(async () => {
        await evaluateConnection();
        scheduleNext();
      }, delay);
    };

    const handleOffline = () => {
      failsRef.current = 3;
      setConsecutiveFails(3);
      setStatus("offline");
      setLatencyMs(null);
    };

    const handleOnline = () => {
      void evaluateConnection(true);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    const conn = (navigator as unknown as { connection?: NetworkInformation })?.connection;
    const handleConnChange = () => {
      void evaluateConnection();
    };
    conn?.addEventListener?.("change", handleConnChange);

    // Initial check on mount
    void evaluateConnection();
    scheduleNext();

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      conn?.removeEventListener?.("change", handleConnChange);
      clearTimeout(timerId);
    };
  }, [evaluateConnection]);

  const checkNow = useCallback(async () => {
    return await evaluateConnection(true);
  }, [evaluateConnection]);

  const isSlow = status === "slow";
  const isOffline = status === "offline";
  const isPaused = isSlow || isOffline;

  return {
    status,
    isOnline: status === "online",
    isSlow,
    isOffline,
    isPaused,
    latencyMs,
    effectiveType,
    consecutiveFails,
    retrying,
    justRestored,
    checkNow,
  };
}
