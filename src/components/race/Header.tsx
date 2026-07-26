import { Bell, Settings, Wallet } from "lucide-react";
import { RollingNumber } from "./RollingNumber";

interface Props {
  balance: number;
  roundId: number;
  countdown: number;
  online: number;
}

export function Header({ balance, roundId, countdown, online }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3">
      <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
        {/* Wallet */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <div className="w-8 h-8 rounded-xl grid place-items-center bg-gradient-to-br from-[oklch(0.85_0.19_195)] to-[oklch(0.68_0.28_330)] text-[#0a0a15]">
            <Wallet size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-[9px] tracking-[0.2em] text-white/40 font-display">
              WALLET
            </div>
            <div className="font-display text-sm tabular text-white">
              ₹<RollingNumber value={balance} />
            </div>
          </div>
        </div>

        {/* Round */}
        <div className="flex-1 min-w-0 px-1">
          <div className="text-[9px] tracking-[0.2em] text-white/40 font-display flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.72_0.22_145)] animate-pulse-glow" />
            RACE #{roundId.toString().padStart(4, "0")}
          </div>
          <div className="font-display text-lg tabular text-[oklch(0.85_0.19_195)] text-neon">
            {countdown.toFixed(1)}s
          </div>
        </div>

        {/* Online */}
        <div className="text-right leading-tight pr-1">
          <div className="text-[9px] tracking-[0.2em] text-white/40 font-display">
            ONLINE
          </div>
          <div className="font-display text-sm tabular text-white">
            <RollingNumber value={online} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button className="h-8 w-8 rounded-xl glass grid place-items-center relative">
            <Bell size={14} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[oklch(0.7_0.24_25)]" />
          </button>
          <button className="h-8 w-8 rounded-xl glass grid place-items-center">
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
