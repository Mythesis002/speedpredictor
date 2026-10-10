import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Volume2, VolumeX, Wallet } from "lucide-react";
import { RollingNumber } from "./RollingNumber";
import { isSoundMuted, subscribeSoundMuted, toggleSoundMuted } from "@/lib/sound";

interface Props {
  balance: number;
  roundId: number;
  onTopUp?: () => void;
  isGuest?: boolean;
  onSignIn?: () => void;
}

export function Header({ balance, roundId, onTopUp, isGuest = false, onSignIn }: Props) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
    return subscribeSoundMuted(setMuted);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2">
      {/* Official Golden SVG Logo */}
      <Link to="/" className="shrink-0 flex items-center" aria-label="Apex Home">
        <img
          src="/apex-logo.svg"
          alt="Apex"
          referrerPolicy="no-referrer"
          className="h-7 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,195,43,0.45)]"
        />
      </Link>

      {/* Round ID */}
      <div className="flex-1 min-w-0 mx-0.5">
        <div className="glass rounded-xl px-2 py-1 text-center">
          <div className="text-[7.5px] tracking-[0.2em] text-white/45 font-display">
            ROUND ID
          </div>
          <div className="font-display text-[11px] tabular text-white truncate">
            #{roundId}
          </div>
        </div>
      </div>

      {/* Master Audio Mute Toggle */}
      <button
        type="button"
        onClick={() => setMuted(toggleSoundMuted())}
        aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
        title={muted ? "Unmute sound" : "Mute sound"}
        className="glass w-8 h-8 rounded-xl grid place-items-center text-white/75 hover:text-white active:scale-95 shrink-0"
      >
        {muted ? <VolumeX size={14} className="text-white/40" /> : <Volume2 size={14} className="text-[#ffc32b]" />}
      </button>

      {/* Wallet or Spectator Sign-In CTA */}
      {isGuest ? (
        <button
          type="button"
          onClick={onSignIn}
          className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shrink-0 active:scale-95 border border-[#ffc32b]/40"
          style={{
            background: "linear-gradient(180deg, rgba(255,216,58,0.18), rgba(240,164,21,0.08))",
          }}
        >
          <span className="font-display text-[10px] tracking-[0.12em] text-[#ffd83a] whitespace-nowrap">
            CLAIM ₹28
          </span>
          <span className="w-5 h-5 rounded-md grid place-items-center bg-[#ffc32b] text-black font-display text-[10px]">
            +
          </span>
        </button>
      ) : (
        <div className="glass rounded-xl pl-2 pr-1 py-1 flex items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 rounded-lg grid place-items-center bg-gradient-to-br from-[#a24bff] to-[#5b2bff] text-white">
            <Wallet size={13} />
          </div>
          <span className="font-display text-[12px] tabular text-white">
            ₹<RollingNumber value={balance} />
          </span>
          <button
            type="button"
            onClick={onTopUp}
            aria-label="Add funds"
            className="w-6 h-6 rounded-lg grid place-items-center bg-[#1db954] text-black active:scale-95"
          >
            <Plus size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
