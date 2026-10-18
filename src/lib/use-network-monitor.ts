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

const SLOW_LATENCY_THRESHOLD_MS = 2200;
const PING_INTERVAL_MS = 4000;
const PING_TIMEOUT_MS = 3000;

interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  rtt?: number;
  downlink?: number;
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
  const statusRef = useRef(status);
  statusRef.current = status;
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;

  // Single ping execution with timeout
  const runPing = useCallback(async (): Promise<{ ok: boolean; latency: number | null }> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { ok: false, latency: null };
    }

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

      // Call the server heartbeat
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

      // Check browser Network Information API if available
      let netInfoType: string | null = null;
      if (typeof navigator !== "undefined" && "connection" in navigator) {
        const netInfo = (navigator as unknown as { connection?: NetworkInformation }).connection;
        if (netInfo?.effectiveType) {
          netInfoType = netInfo.effectiveType;
          setEffectiveType(netInfo.effectiveType);
        }
      }

      const { ok, latency } = await runPing();

      if (isManualRetry) setRetrying(false);

      if (!ok) {
        failsRef.current += 1;
        setConsecutiveFails(failsRef.current);
        setLatencyMs(null);
        setStatus("offline");
        return false;
      }

      // Successful ping
      failsRef.current = 0;
      setConsecutiveFails(0);
      setLatencyMs(latency);

      const wasOfflineOrSlow = statusRef.current === "offline" || statusRef.current === "slow";

      // Detect slow network: very high latency or slow-2g cellular
      if ((latency !== null && latency > SLOW_LATENCY_THRESHOLD_MS) || netInfoType === "slow-2g") {
        setStatus("slow");
        return false;
      }

      // Connection is healthy
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

    const handleOffline = () => {
      failsRef.current = 3;
      setConsecutiveFails(3);
      setStatus("offline");
      setLatencyMs(null);
    };

    const handleOnline = () => {
      void evaluateConnection();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Watch for network type changes (e.g. WiFi -> slow 2G)
    const conn = (navigator as unknown as { connection?: NetworkInformation })?.connection;
    const handleConnChange = () => {
      void evaluateConnection();
    };
    conn?.addEventListener?.("change", handleConnChange);

    // Heartbeat interval
    const intervalId = setInterval(() => {
      void evaluateConnection();
    }, PING_INTERVAL_MS);

    // Initial check on mount
    void evaluateConnection();

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      conn?.removeEventListener?.("change", handleConnChange);
      clearInterval(intervalId);
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
