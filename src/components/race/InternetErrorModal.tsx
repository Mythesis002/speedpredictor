import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  SignalLow,
  WifiOff,
  Zap,
} from "lucide-react";
import type { NetworkStatus } from "@/lib/use-network-monitor";

interface Props {
  status: NetworkStatus;
  latencyMs: number | null;
  effectiveType: string | null;
  retrying: boolean;
  onRetry: () => Promise<boolean>;
}

export function InternetErrorModal({ status, latencyMs, effectiveType, retrying, onRetry }: Props) {
  const [retryFailed, setRetryFailed] = useState(false);

  if (status === "online") return null;

  const isOffline = status === "offline";

  const handleManualRetry = async () => {
    setRetryFailed(false);
    const success = await onRetry();
    if (!success) {
      setRetryFailed(true);
      setTimeout(() => setRetryFailed(false), 3000);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Internet Connection Error"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-[350px] rounded-2xl bg-[#080d1a] border border-[#ff3b5c]/40 shadow-[0_0_40px_rgba(255,59,92,0.25)] p-5 text-center relative overflow-hidden">
        {/* Subtle top neon ambient glow line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff3b5c] to-transparent animate-pulse" />

        {/* Status Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#ff3b5c]/10 border border-[#ff3b5c]/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(255,59,92,0.2)]">
          {isOffline ? (
            <WifiOff className="w-7 h-7 text-[#ff4d6d] animate-pulse" />
          ) : (
            <SignalLow className="w-7 h-7 text-[#ffb830] animate-pulse" />
          )}
        </div>

        {/* Small Eyebrow Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[9px] font-display tracking-[0.2em] uppercase mb-2 bg-[#ff3b5c]/15 border-[#ff3b5c]/40 text-[#ff6b84]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d6d] animate-ping" />
          {isOffline ? "CONNECTION PAUSED" : "SLOW NETWORK DETECTED"}
        </div>

        {/* Primary Headline */}
        <h2 className="text-base font-display font-bold tracking-[0.08em] text-white uppercase mb-2">
          Internet Error — Reconnect to Win More
        </h2>

        {/* Explanatory Body */}
        <p className="text-[11.5px] leading-relaxed text-white/70 mb-4 font-sans">
          {isOffline
            ? "Your internet connection is disconnected. Live race progress and bets have been safely paused to protect your wallet and ensure provably fair results."
            : `Your network is experiencing severe latency (${latencyMs ? `${latencyMs}ms` : "high delay"}). The race has been paused to prevent lag-induced losses.`}
        </p>

        {/* Live Diagnostics Card */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 mb-4 text-left space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-display">
            <span className="text-white/40 tracking-[0.14em]">NETWORK STATE</span>
            <span
              className={`font-semibold tracking-[0.12em] uppercase ${
                isOffline ? "text-[#ff4d6d]" : "text-[#ffb830]"
              }`}
            >
              {isOffline ? "Disconnected" : "High Latency"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-display">
            <span className="text-white/40 tracking-[0.14em]">SERVER PING</span>
            <span className="text-white/80 tabular tracking-[0.08em]">
              {latencyMs !== null ? `${latencyMs} ms` : "No Response"}
            </span>
          </div>

          {effectiveType && (
            <div className="flex items-center justify-between text-[10px] font-display">
              <span className="text-white/40 tracking-[0.14em]">CELLULAR / TYPE</span>
              <span className="text-white/60 tracking-[0.08em] uppercase">{effectiveType}</span>
            </div>
          )}

          <div className="pt-1 border-t border-white/5 flex items-center gap-1.5 text-[9.5px] text-white/45 font-display tracking-[0.06em]">
            <Loader2 className="w-3 h-3 animate-spin text-[#35e6ff] shrink-0" />
            <span>Auto-testing connection every 4 seconds...</span>
          </div>
        </div>

        {retryFailed && (
          <div className="mb-3 text-[10.5px] text-[#ff8a9c] font-display tracking-[0.08em] animate-fade-in flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Still offline. Please check your data or Wi-Fi.
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleManualRetry}
          disabled={retrying}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff3b5c] to-[#ff6b3b] hover:from-[#ff4d6d] hover:to-[#ff7b4b] active:scale-[0.98] transition-all font-display font-bold text-xs tracking-[0.18em] uppercase text-white shadow-[0_0_24px_rgba(255,59,92,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>TESTING CONNECTION...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>RECONNECT NOW</span>
            </>
          )}
        </button>

        {/* Bottom Helpful Note */}
        <p className="mt-3 text-[10px] text-white/35 font-display tracking-[0.08em]">
          Apex will auto-resume the live race immediately once reconnected.
        </p>
      </div>
    </div>
  );
}

/**
 * Non-blocking toast shown when connection is successfully restored.
 */
export function InternetRestoredToast({ latencyMs }: { latencyMs: number | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[360px] animate-fade-in pointer-events-none"
    >
      <div className="rounded-xl px-3.5 py-2.5 bg-[#061e14] border border-[#26ff9a]/50 shadow-[0_0_25px_rgba(38,255,154,0.3)] flex items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#26ff9a]/20 border border-[#26ff9a]/40 grid place-items-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#26ff9a]" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[10px] tracking-[0.14em] text-[#26ff9a] uppercase truncate">
              Internet Restored
            </div>
            <div className="text-[9.5px] text-white/70 font-sans truncate">
              Live race synchronized and resumed
            </div>
          </div>
        </div>

        {latencyMs !== null && (
          <span className="px-2 py-0.5 rounded-md bg-[#26ff9a]/15 border border-[#26ff9a]/30 text-[9px] font-display tabular tracking-[0.1em] text-[#26ff9a] shrink-0">
            {latencyMs}ms
          </span>
        )}
      </div>
    </div>
  );
}
