import { Menu, Plus, Wallet } from "lucide-react";
import { RollingNumber } from "./RollingNumber";

interface Props {
  balance: number;
  roundId: number;
  onTopUp?: () => void;
}

export function Header({ balance, roundId, onTopUp }: Props) {

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {/* Logo */}
      <div className="leading-none shrink-0">
        <div className="font-display text-[15px] tracking-tight text-white italic">
          SPEED
        </div>
        <div
          className="font-display text-[15px] tracking-tight italic"
          style={{ color: "#ffc32b", textShadow: "0 0 14px #ffc32b66" }}
        >
          PREDICT
        </div>
      </div>

      {/* Round */}
      <div className="flex-1 min-w-0 mx-1">
        <div className="glass rounded-xl px-2 py-1 text-center">
          <div className="text-[8px] tracking-[0.2em] text-white/45 font-display">
            ROUND ID
          </div>
          <div className="font-display text-[12px] tabular text-white truncate">
            #{roundId}
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="glass rounded-xl pl-2 pr-1 py-1 flex items-center gap-1.5 shrink-0">
        <div className="w-6 h-6 rounded-lg grid place-items-center bg-gradient-to-br from-[#a24bff] to-[#5b2bff] text-white">
          <Wallet size={13} />
        </div>
        <span className="font-display text-[12px] tabular text-white">
          ₹<RollingNumber value={balance} />
        </span>
        <button
          onClick={onTopUp}
          aria-label="Add funds"
          className="w-6 h-6 rounded-lg grid place-items-center bg-[#1db954] text-black active:scale-95"
        >
          <Plus size={13} />
        </button>

      </div>

      <button className="h-8 w-8 rounded-xl glass grid place-items-center shrink-0">
        <Menu size={15} />
      </button>
    </div>
  );
}
