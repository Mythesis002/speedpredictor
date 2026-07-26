import { memo } from "react";

export type CarKind = "normal" | "small" | "hyper";

export interface CarSpec {
  id: string;
  color: string; // hex-ish for reflections
  colorName: string;
  kind: CarKind;
  multiplier: number;
}

interface Props {
  spec: CarSpec;
  size?: number; // width in px
  idle?: boolean;
  racing?: boolean;
  glow?: boolean;
}

/**
 * Top-down / near-front-3q stylised car rendered in pure SVG.
 * Scales with `size`. Uses `spec.color` for body.
 */
export const Car = memo(function Car({
  spec,
  size = 60,
  idle = true,
  racing = false,
  glow = false,
}: Props) {
  const w = size;
  const h = size * 1.7;
  const c = spec.color;

  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const bodyW = isSmall ? w * 0.78 : isHyper ? w * 1.02 : w;
  const bodyH = isSmall ? h * 0.72 : isHyper ? h * 1.05 : h;

  return (
    <div
      className={idle ? "animate-idle" : ""}
      style={{
        width: bodyW,
        height: bodyH,
        filter: glow
          ? `drop-shadow(0 0 14px ${c}) drop-shadow(0 0 28px ${c}88)`
          : `drop-shadow(0 6px 10px rgba(0,0,0,0.6))`,
        position: "relative",
      }}
    >
      {/* Exhaust particles */}
      {racing && (
        <>
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              bottom: -4,
              width: 8,
              height: 8,
              background: isHyper
                ? "radial-gradient(circle, #ffd66b, #ff5b1f 60%, transparent 70%)"
                : "radial-gradient(circle, #fff, #7fdbff 60%, transparent 70%)",
              animation: "exhaust 0.6s ease-out infinite",
            }}
          />
          <span
            className="absolute left-1/3 rounded-full"
            style={{
              bottom: -2,
              width: 5,
              height: 5,
              background: "radial-gradient(circle,#fff,transparent 70%)",
              animation: "exhaust 0.5s ease-out infinite 0.2s",
              opacity: 0.5,
            }}
          />
        </>
      )}

      <svg viewBox="0 0 100 170" width={bodyW} height={bodyH} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`body-${spec.id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="1" />
            <stop offset="0.5" stopColor={c} stopOpacity="0.85" />
            <stop offset="1" stopColor="#000" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`glass-${spec.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8be9ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0a0f1c" stopOpacity="1" />
          </linearGradient>
          <radialGradient id={`head-${spec.id}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={isHyper ? "#ff2b3b" : "#ffffff"} />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* shadow */}
        <ellipse cx="50" cy="163" rx="34" ry="4" fill="#000" opacity="0.45" />

        {/* body */}
        {isHyper ? (
          <path
            d="M15 30 Q50 6 85 30 L92 130 Q88 150 78 156 L22 156 Q12 150 8 130 Z"
            fill={`url(#body-${spec.id})`}
            stroke="#000"
            strokeOpacity="0.5"
          />
        ) : isSmall ? (
          <path
            d="M22 40 Q50 22 78 40 L82 130 Q78 148 68 152 L32 152 Q22 148 18 130 Z"
            fill={`url(#body-${spec.id})`}
            stroke="#000"
            strokeOpacity="0.4"
          />
        ) : (
          <path
            d="M18 34 Q50 14 82 34 L88 130 Q84 150 74 154 L26 154 Q16 150 12 130 Z"
            fill={`url(#body-${spec.id})`}
            stroke="#000"
            strokeOpacity="0.45"
          />
        )}

        {/* windshield */}
        <path
          d="M27 55 Q50 44 73 55 L70 92 Q50 86 30 92 Z"
          fill={`url(#glass-${spec.id})`}
          opacity="0.9"
        />
        {/* rear window */}
        <path
          d="M30 108 Q50 104 70 108 L68 138 Q50 134 32 138 Z"
          fill={`url(#glass-${spec.id})`}
          opacity="0.7"
        />

        {/* hood highlight */}
        <path
          d="M28 30 Q50 22 72 30 L70 44 Q50 38 30 44 Z"
          fill="#fff"
          opacity="0.12"
        />

        {/* headlights */}
        <circle cx="26" cy="34" r="6" fill={`url(#head-${spec.id})`} />
        <circle cx="74" cy="34" r="6" fill={`url(#head-${spec.id})`} />

        {/* wheels */}
        <rect x="4" y="60" width="10" height="24" rx="3" fill="#0a0a0a" />
        <rect x="86" y="60" width="10" height="24" rx="3" fill="#0a0a0a" />
        <rect x="4" y="120" width="10" height="26" rx="3" fill="#0a0a0a" />
        <rect x="86" y="120" width="10" height="26" rx="3" fill="#0a0a0a" />

        {/* rear brake glow */}
        <rect
          x="22"
          y="150"
          width="56"
          height="3"
          rx="1.5"
          fill={racing ? "#ff2b3b" : "#7a1220"}
          opacity={racing ? 1 : 0.6}
        />

        {/* hyper wing */}
        {isHyper && (
          <>
            <rect x="10" y="145" width="80" height="4" rx="2" fill="#0a0a0a" />
            <rect x="18" y="149" width="64" height="2" fill="#ffd66b" opacity="0.9" />
          </>
        )}

        {/* underglow */}
        {isHyper && (
          <ellipse cx="50" cy="160" rx="38" ry="3" fill="#ffd66b" opacity="0.55" />
        )}
      </svg>
    </div>
  );
});
