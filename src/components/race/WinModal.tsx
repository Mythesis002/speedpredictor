import { useEffect } from "react";
import { X } from "lucide-react";
import { RollingNumber } from "./RollingNumber";

interface Props {
  amount: number | null;
  colorName?: string;
  color?: string;
  onClose: () => void;
}

/** Celebration popup shown the moment a prediction pays out. */
export function WinModal({ amount, colorName, color = "#26ff9a", onClose }: Props) {
  useEffect(() => {
    if (amount === null) return;
    const id = setTimeout(onClose, 4200);
    return () => clearTimeout(id);
  }, [amount, onClose]);

  if (amount === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute block rounded-[1px]"
            style={{
              left: `${(i * 3.9 + 2) % 100}%`,
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

      <div className="relative w-full max-w-[320px] glass rounded-3xl p-6 text-center animate-scale-in">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-white/45 hover:text-white"
        >
          <X size={16} />
        </button>

        <div
          className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center text-3xl"
          style={{
            background: `radial-gradient(circle, ${color}44, transparent 70%)`,
            boxShadow: `0 0 34px ${color}66`,
          }}
        >
          🏆
        </div>

        <p className="font-display text-[13px] tracking-[0.3em] text-white/70">
          CONGRATULATIONS
        </p>
        <p className="mt-3 font-display text-3xl tracking-wide" style={{ color }}>
          You Won ₹<RollingNumber value={amount} duration={900} />
        </p>
        {colorName && (
          <p className="mt-2 text-[11px] tracking-[0.2em] text-white/50 font-display">
            {colorName} TOOK THE CHEQUERED FLAG
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl py-3 font-display text-[12px] tracking-[0.25em] text-black"
          style={{ background: `linear-gradient(90deg, ${color}, #ffd66b)` }}
        >
          COLLECT
        </button>
      </div>
    </div>
  );
}
