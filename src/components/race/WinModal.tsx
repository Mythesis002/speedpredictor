import { useEffect } from "react";
import { X, ArrowRight, Zap } from "lucide-react";
import { RollingNumber } from "./RollingNumber";

interface Props {
  amount: number | null;
  colorName?: string;
  color?: string;
  onClose: () => void;
  onBetNextRound?: () => void;
}

/** Celebration popup shown the moment a prediction pays out. */
export function WinModal({ amount, colorName, color = "#26ff9a", onClose, onBetNextRound }: Props) {
  useEffect(() => {
    if (amount === null) return;
    // Auto-dismiss in 2.2s so player never misses the 6s betting window of next round
    const id = setTimeout(onClose, 2200);
    return () => clearTimeout(id);
  }, [amount, onClose]);

  if (amount === null) return null;

  const handleBetNextRound = () => {
    if (onBetNextRound) {
      onBetNextRound();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in cursor-pointer"
        onClick={handleBetNextRound}
      />

      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-[1px]"
            style={{
              left: `${(i * 3.7 + 2) % 100}%`,
              top: "-6%",
              width: 5 + (i % 3) * 2,
              height: 9 + (i % 4) * 3,
              background: [color, "#ffd66b", "#35e6ff", "#ff4d6d"][i % 4],
              opacity: 0.9,
              animation: `confetti-fall ${1.8 + (i % 5) * 0.35}s linear ${(i % 7) * 0.16}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-[320px] glass rounded-3xl p-5 text-center animate-scale-in border border-white/20 shadow-[0_0_50px_rgba(38,255,154,0.35)]">
        <button
          onClick={onClose}
          aria-label="Close win notification"
          className="absolute right-3 top-3 text-white/45 hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div
          className="mx-auto mb-3 h-14 w-14 rounded-full flex items-center justify-center text-3xl animate-bounce"
          style={{
            background: `radial-gradient(circle, ${color}55, transparent 70%)`,
            boxShadow: `0 0 34px ${color}88`,
          }}
        >
          🏆
        </div>

        <p className="font-display text-[13px] tracking-[0.25em] text-[#ffd83a] uppercase font-bold">
          YOU WON!
        </p>
        <p className="mt-1 font-display text-4xl font-extrabold tracking-tight" style={{ color }}>
          +₹
          <RollingNumber value={amount} duration={700} />
        </p>
        {colorName && (
          <p className="mt-1 text-[10px] tracking-[0.16em] text-white/70 font-display uppercase">
            {colorName} CAR WON
          </p>
        )}

        {/* Adrenaline CTA: Bet on Next Round */}
        <button
          onClick={handleBetNextRound}
          className="mt-4 w-full h-11 rounded-xl font-display text-[12px] tracking-[0.15em] text-black font-extrabold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all animate-pulse shadow-lg"
          style={{
            background: `linear-gradient(90deg, #ffd83a, ${color}, #ffd83a)`,
            boxShadow: `0 0 24px ${color}88`,
          }}
        >
          <Zap size={14} className="fill-black" />
          <span>BET ON NEXT ROUND</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
