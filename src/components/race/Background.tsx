import { useMemo } from "react";
import { useHydrated } from "@/lib/use-hydrated";

export function Background({ intense = false }: { intense?: boolean }) {
  const hydrated = useHydrated();

  const stars = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 40 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 55,
            size: Math.random() * 1.6 + 0.4,
            delay: Math.random() * 6,
          }))
        : [],
    [hydrated],
  );

  const buildings = useMemo(
    () =>
      hydrated
        ? Array.from({ length: 22 }, (_, i) => ({
            id: i,
            left: (i / 22) * 100 + (Math.random() - 0.5) * 3,
            w: Math.random() * 5 + 3,
            h: Math.random() * 22 + 12,
            hue: 195 + Math.random() * 140,
          }))
        : [],
    [hydrated],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 60% at 50% 65%, oklch(0.22 0.14 285 / 0.9), transparent 70%), linear-gradient(180deg, oklch(0.06 0.03 265) 0%, oklch(0.09 0.05 275) 45%, oklch(0.05 0.02 265) 100%)",
        }}
      />

      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white animate-flicker"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            opacity: 0.7,
          }}
        />
      ))}

      {/* Searchlights */}
      <div
        className="absolute left-1/4 top-0 h-[60vh] w-1"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.85 0.19 195 / 0.35), transparent)",
          transformOrigin: "top center",
          animation: "searchlight 7s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-1/4 top-0 h-[60vh] w-1"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.68 0.28 330 / 0.35), transparent)",
          transformOrigin: "top center",
          animation: "searchlight 9s ease-in-out infinite 1.5s",
        }}
      />

      {/* City silhouette */}
      <div className="absolute bottom-[38%] left-0 right-0 h-[26%]">
        {buildings.map((b) => (
          <div
            key={b.id}
            className="absolute bottom-0"
            style={{
              left: `${b.left}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              background:
                "linear-gradient(180deg, oklch(0.14 0.04 275) 0%, oklch(0.06 0.02 265) 100%)",
              borderTop: `1px solid oklch(0.7 0.2 ${b.hue} / 0.5)`,
              boxShadow: `0 0 20px oklch(0.7 0.2 ${b.hue} / 0.25)`,
            }}
          >
            {/* windows */}
            <div
              className="absolute inset-1 opacity-70 animate-flicker"
              style={{
                backgroundImage: `radial-gradient(circle at 30% 30%, oklch(0.8 0.15 ${b.hue}) 0.5px, transparent 1.2px), radial-gradient(circle at 70% 60%, oklch(0.8 0.15 ${b.hue}) 0.5px, transparent 1.2px)`,
                backgroundSize: "8px 8px, 10px 12px",
              }}
            />
          </div>
        ))}
      </div>

      {/* Distant billboard */}
      <div
        className="absolute left-1/2 top-[28%] -translate-x-1/2 rounded-sm animate-flicker"
        style={{
          width: 90,
          height: 22,
          background:
            "linear-gradient(90deg, oklch(0.68 0.28 330), oklch(0.85 0.19 195))",
          filter: "blur(0.3px)",
          boxShadow: "0 0 24px oklch(0.68 0.28 330 / 0.6)",
        }}
      />

      {/* Drone */}
      <div
        className="absolute"
        style={{
          top: "18%",
          animation: "drone 14s linear infinite",
        }}
      >
        <div className="relative">
          <div className="h-1 w-1 rounded-full bg-[oklch(0.85_0.17_90)] shadow-[0_0_10px_oklch(0.85_0.17_90)]" />
        </div>
      </div>
      <div
        className="absolute"
        style={{
          top: "24%",
          animation: "drone 22s linear infinite 6s",
        }}
      >
        <div className="h-[3px] w-[3px] rounded-full bg-[oklch(0.85_0.19_195)] shadow-[0_0_10px_oklch(0.85_0.19_195)]" />
      </div>

      {/* Fog */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[55%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, oklch(0.1 0.03 275 / 0.4) 60%, oklch(0.05 0.02 265 / 0.9) 100%)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, oklch(0 0 0 / 0.6) 100%)",
        }}
      />

      {intense && (
        <div
          className="absolute inset-0 animate-pulse-glow"
          style={{
            background:
              "radial-gradient(ellipse at 50% 70%, oklch(0.85 0.17 90 / 0.15), transparent 60%)",
          }}
        />
      )}
    </div>
  );
}
