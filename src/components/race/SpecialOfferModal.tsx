import { useEffect, useState } from "react";
import { Sparkles, Timer, X, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onClaim: (amount: number) => void;
}

const STORAGE_KEY = "apex_special_offer_expiry_v1";
const DURATION_MS = 34 * 60 * 60 * 1000; // 34 hours

function getExpiryTime(): number {
  if (typeof window === "undefined") return Date.now() + DURATION_MS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const val = parseInt(stored, 10);
    if (!isNaN(val) && val > Date.now()) {
      return val;
    }
  }
  const fresh = Date.now() + DURATION_MS;
  try {
    localStorage.setItem(STORAGE_KEY, String(fresh));
  } catch {
    /* storage unavailable */
  }
  return fresh;
}

export function SpecialOfferModal({ open, onClose, onClaim }: Props) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 34,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!open) return;
    const expiry = getExpiryTime();

    const update = () => {
      const diff = Math.max(0, expiry - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/85 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-[320px] rounded-3xl p-5 relative overflow-hidden border border-[#ffd83a]/40 bg-[#0c0e17] shadow-[0_12px_45px_rgba(0,0,0,0.8),0_0_40px_rgba(255,216,58,0.2)] animate-scale-in">
        {/* Subtle top glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#ffd83a]/15 rounded-full blur-2xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close offer modal"
          className="absolute right-3.5 top-3.5 w-7 h-7 rounded-full grid place-items-center bg-white/10 text-white/60 hover:text-white transition cursor-pointer"
        >
          <X size={15} />
        </button>

        {/* Urgency countdown */}
        <div className="flex justify-center mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-display text-white/70 tracking-wider">
            <Timer size={11} className="text-[#ffd83a]" />
            <span>
              ENDS IN {String(timeLeft.hours).padStart(2, "0")}H :{" "}
              {String(timeLeft.minutes).padStart(2, "0")}M :{" "}
              {String(timeLeft.seconds).padStart(2, "0")}S
            </span>
          </span>
        </div>

        {/* Clear, focused message: Add ₹50 → Get ₹70 */}
        <div className="text-center space-y-1 mb-4">
          <div className="text-[11px] font-display uppercase tracking-widest text-[#ffd83a] font-bold flex items-center justify-center gap-1">
            <Sparkles size={12} /> SPECIAL OFFER
          </div>
          <h2 className="text-2xl font-display font-black text-white leading-tight">
            Add <span className="text-[#ffd83a]">₹50</span> → Get{" "}
            <span className="text-[#26ff9a]">₹70</span>
          </h2>
        </div>

        {/* Visual calculation card */}
        <div className="rounded-2xl bg-black/40 border border-white/10 p-3 mb-4 flex items-center justify-between text-center">
          <div className="flex-1">
            <div className="text-[10px] text-white/50 uppercase font-display">Add</div>
            <div className="text-lg font-display font-extrabold text-white">₹50</div>
          </div>
          <div className="text-white/40 text-sm font-bold">+</div>
          <div className="flex-1">
            <div className="text-[10px] text-[#26ff9a] uppercase font-display font-bold">Bonus</div>
            <div className="text-lg font-display font-extrabold text-[#26ff9a]">₹20</div>
          </div>
          <div className="text-white/40 text-sm font-bold">=</div>
          <div className="flex-1 bg-[#26ff9a]/10 border border-[#26ff9a]/30 rounded-xl py-1">
            <div className="text-[9px] text-[#26ff9a] uppercase font-display font-bold">Total</div>
            <div className="text-xl font-display font-black text-[#26ff9a]">₹70</div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={() => onClaim(50)}
          className="w-full h-12 rounded-xl font-display text-[13px] tracking-wider text-black font-black flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition shadow-[0_0_24px_rgba(255,216,58,0.4)] relative overflow-hidden bg-gradient-to-r from-[#ffd83a] to-[#26ff9a]"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            GET ₹70 NOW <ArrowRight size={15} />
          </span>
          <span className="absolute inset-0 animate-shimmer" />
        </button>

        {/* Secondary Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-1 text-center text-[11px] font-display tracking-wider text-white/40 hover:text-white/70 transition cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
