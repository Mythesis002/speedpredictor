import { memo } from "react";

export type CarKind = "normal" | "small" | "hyper";

export interface CarSpec {
  id: string;
  color: string; // hex
  colorName: string;
  kind: CarKind;
  multiplier: number;
}

interface Props {
  spec: CarSpec;
  size?: number; // width in px
  /** 0 = idle, 1 = flat out. Drives wheel blur, exhaust and light intensity. */
  throttle?: number;
  /** brake lights burn bright on launch prep + finish */
  braking?: boolean;
  glow?: boolean;
  reflection?: boolean;
}

function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/**
 * Rear-view widebody GT race car matching the GT reference:
 * - High-mount swan-neck carbon wing with sculpted endplates
 * - Rear window showing internal structural roll cage cross-bracing
 * - Full-width glowing horizon LED taillight strip + twin C-blades
 * - Central honeycomb heat-extraction grille
 * - Illuminated license plate displaying RED, PURPLE, or BLUE
 * - Centered dual exhaust pods with active afterburner & heat distortion
 * - Deep metallic reflections across the flared widebody haunches
 */
export const Car = memo(function Car({
  spec,
  size = 150,
  throttle = 0,
  braking = false,
  glow = false,
  reflection = true,
}: Props) {
  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const w = size * (isSmall ? 0.84 : isHyper ? 1.08 : 1);
  const h = w * 0.82;
  const c = spec.color;
  const hi = shade(c, isHyper ? 80 : 102);
  const light = shade(c, isHyper ? 50 : 64);
  const mid = shade(c, isHyper ? 12 : 6);
  const dark = shade(c, -68);
  const deep = shade(c, -112);
  const uid = spec.id;

  const t = Math.max(0, Math.min(1, throttle));
  const lampOpacity = braking ? 1 : 0.72 + t * 0.28;
  const bloom = braking ? 0.65 : 0.22 + t * 0.36;
  const rolling = t > 0.12;
  const wheelDur = Math.max(0.07, 0.5 - t * 0.42);
  const plateLabel = (spec.colorName || "APEX").toUpperCase();

  // Widebody GT rear silhouette with aggressively flared haunches
  const body =
    "M18 102 q6-25 32-33 q18-26 80-26 t80 26 q26 8 32 33 l9 34 q4 22 -16 26 l-27 5 h-156 l-27-5 q-20-4 -16-26 z";

  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h,
        filter: glow
          ? `drop-shadow(0 0 22px ${c}) drop-shadow(0 0 54px ${c}55)`
          : `drop-shadow(0 14px 20px rgba(0,0,0,0.76))`,
      }}
    >
      <svg viewBox="0 0 260 210" width={w} height={h} style={{ display: "block" }}>
        <defs>
          {/* Deep metallic paint with specular crown, saturated haunch, dark sill */}
          <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.15" stopColor={light} />
            <stop offset="0.38" stopColor={mid} />
            <stop offset="0.68" stopColor={c} />
            <stop offset="0.88" stopColor={dark} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>

          {/* Wrap-around metallic haunch curvature */}
          <linearGradient id={`flank-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={deep} stopOpacity="0.96" />
            <stop offset="0.11" stopColor={dark} stopOpacity="0.52" />
            <stop offset="0.24" stopColor={hi} stopOpacity="0.42" />
            <stop offset="0.36" stopColor={light} stopOpacity="0.1" />
            <stop offset="0.5" stopColor={deep} stopOpacity="0.28" />
            <stop offset="0.64" stopColor={light} stopOpacity="0.1" />
            <stop offset="0.76" stopColor={hi} stopOpacity="0.42" />
            <stop offset="0.89" stopColor={dark} stopOpacity="0.52" />
            <stop offset="1" stopColor={deep} stopOpacity="0.96" />
          </linearGradient>

          {/* Specular haunch reflection lobe */}
          <radialGradient id={`haunchL-${uid}`} cx="0.24" cy="0.44" r="0.26">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
            <stop offset="0.45" stopColor={hi} stopOpacity="0.22" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`haunchR-${uid}`} cx="0.76" cy="0.44" r="0.26">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
            <stop offset="0.45" stopColor={hi} stopOpacity="0.22" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080c14" />
            <stop offset="0.45" stopColor="#141e2e" />
            <stop offset="1" stopColor="#04060b" />
          </linearGradient>

          <linearGradient id={`carbon-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a303c" />
            <stop offset="0.48" stopColor="#131720" />
            <stop offset="1" stopColor="#05070b" />
          </linearGradient>

          {/* Full-width horizon LED bar gradient */}
          <linearGradient id={`horizon-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff1e38" />
            <stop offset="0.18" stopColor="#ff6b7a" />
            <stop offset="0.5" stopColor="#ffffff" />
            <stop offset="0.82" stopColor="#ff6b7a" />
            <stop offset="1" stopColor="#ff1e38" />
          </linearGradient>

          {/* Honeycomb pattern for central heat-extraction grille */}
          <pattern id={`honeycomb-${uid}`} width="6" height="5.2" patternUnits="userSpaceOnUse">
            <polygon
              points="3,0.3 5.6,1.6 5.6,3.9 3,5.0 0.4,3.9 0.4,1.6"
              fill="#06080d"
              stroke="#2d3545"
              strokeWidth="0.55"
            />
          </pattern>

          <radialGradient id={`floor-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff2b3b" stopOpacity={0.25 + t * 0.4} />
            <stop offset="1" stopColor="#ff2b3b" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`refl-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.32" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>

          <linearGradient id={`tyre-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#030408" />
            <stop offset="0.42" stopColor="#1b202a" />
            <stop offset="1" stopColor="#030408" />
          </linearGradient>
        </defs>

        {/* Contact shadow + taillight bloom on tarmac */}
        <ellipse cx="130" cy="178" rx="106" ry="13" fill="#000" opacity="0.66" />
        <ellipse cx="130" cy="188" rx="114" ry="25" fill={`url(#floor-${uid})`} />

        {/* ---- Rear tyres, wide GT slicks ---- */}
        <g>
          <clipPath id={`tyreL-${uid}`}>
            <path d="M12 104 q-10 32 -1 63 h36 q-9-32 -3-65 z" />
          </clipPath>
          <clipPath id={`tyreR-${uid}`}>
            <path d="M248 104 q10 32 1 63 h-36 q9-32 3-65 z" />
          </clipPath>
          <path d="M12 104 q-10 32 -1 63 h36 q-9-32 -3-65 z" fill={`url(#tyre-${uid})`} />
          <path d="M248 104 q10 32 1 63 h-36 q9-32 3-65 z" fill={`url(#tyre-${uid})`} />

          {[`tyreL-${uid}`, `tyreR-${uid}`].map((clip, side) => (
            <g key={clip} clipPath={`url(#${clip})`}>
              <g
                style={{
                  animationName: "tread-roll",
                  animationDuration: `var(--wheel-dur, ${wheelDur}s)`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: `var(--wheel-play, ${rolling ? "running" : "paused"})`,
                }}
                opacity={0.78 - t * 0.26}
              >
                {[92, 104, 116, 128, 140, 152, 164].map((y) => (
                  <rect
                    key={y}
                    x={side === 0 ? 8 : 210}
                    y={y}
                    width="42"
                    height="3"
                    rx="1.5"
                    fill="#3b4354"
                  />
                ))}
              </g>
              <ellipse
                cx={side === 0 ? 30 : 230}
                cy="134"
                rx="9"
                ry="9"
                fill="#0a0d13"
                stroke="#5b6579"
                strokeWidth="1.2"
                opacity={0.92 - t * 0.22}
              />
              <g
                style={{
                  transformOrigin: `${side === 0 ? 30 : 230}px 134px`,
                  animationName: "spin",
                  animationDuration: `var(--hub-dur, ${Math.max(0.12, wheelDur * 1.6)}s)`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: `var(--wheel-play, ${rolling ? "running" : "paused"})`,
                }}
                opacity={0.9 - t * 0.25}
              >
                <rect
                  x={side === 0 ? 29 : 229}
                  y="126"
                  width="2"
                  height="16"
                  rx="1"
                  fill="#8f9ab0"
                />
                <rect
                  x={side === 0 ? 22 : 222}
                  y="133"
                  width="16"
                  height="2"
                  rx="1"
                  fill="#8f9ab0"
                  opacity="0.75"
                />
              </g>
            </g>
          ))}

          <g opacity={t * 0.55}>
            <rect x="14" y="112" width="32" height="52" rx="8" fill="#8b96ad" opacity="0.22" />
            <rect x="214" y="112" width="32" height="52" rx="8" fill="#8b96ad" opacity="0.22" />
          </g>
        </g>

        {/* ---- Main Widebody Shell & Metallic Reflections ---- */}
        <path d={body} fill={`url(#paint-${uid})`} />
        <path d={body} fill={`url(#flank-${uid})`} />
        <path d={body} fill={`url(#haunchL-${uid})`} />
        <path d={body} fill={`url(#haunchR-${uid})`} />

        {/* Deep metallic specular ribbons across the flared haunches */}
        <path
          d="M28 104 q24-18 52-14 q-22 14 -44 26 z"
          fill="#ffffff"
          opacity="0.24"
        />
        <path
          d="M232 104 q-24-18 -52-14 q22 14 44 26 z"
          fill="#ffffff"
          opacity="0.24"
        />
        <path
          d="M32 98 q98-30 196 0"
          fill="none"
          stroke={hi}
          strokeOpacity="0.65"
          strokeWidth="2.4"
        />
        <path
          d="M36 125 q34 11 94 11 t94-11"
          fill="none"
          stroke={deep}
          strokeOpacity="0.6"
          strokeWidth="2.8"
        />

        {/* Aero side mirrors on carbon stalks */}
        <path d="M64 81 q-22-8 -30 2 q11 8 28 4 z" fill="#0d1117" stroke={hi} strokeWidth="0.6" strokeOpacity="0.5" />
        <path d="M196 81 q22-8 30 2 q-11 8 -28 4 z" fill="#0d1117" stroke={hi} strokeWidth="0.6" strokeOpacity="0.5" />

        {/* ---- Rear Window with Internal Structural Roll Cage ---- */}
        <clipPath id={`rearGlass-${uid}`}>
          <path d="M72 102 q10-34 58-34 t58 34 q-58-13 -116 0 z" />
        </clipPath>
        <path d="M72 102 q10-34 58-34 t58 34 q-58-13 -116 0 z" fill={`url(#glass-${uid})`} />
        <g clipPath={`url(#rearGlass-${uid})`}>
          {/* Tubular FIA GT roll cage & X-brace visible inside cabin */}
          <path
            d="M84 100 L96 72 L164 72 L176 100"
            fill="none"
            stroke={c}
            strokeOpacity="0.45"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line
            x1="96"
            y1="73"
            x2="164"
            y2="98"
            stroke="#d8e2f2"
            strokeOpacity="0.42"
            strokeWidth="2.2"
          />
          <line
            x1="164"
            y1="73"
            x2="96"
            y2="98"
            stroke="#d8e2f2"
            strokeOpacity="0.42"
            strokeWidth="2.2"
          />
          {/* Strut tower bar */}
          <line
            x1="82"
            y1="91"
            x2="178"
            y2="91"
            stroke={hi}
            strokeOpacity="0.5"
            strokeWidth="2"
          />
          {/* Engine bay intake plenum hint */}
          <rect x="118" y="80" width="24" height="12" rx="3" fill="#0d131d" stroke="#49566e" strokeWidth="0.9" opacity="0.75" />
          {/* Rear glass specular reflection */}
          <path d="M84 82 q46-14 92 0 l4 8 q-50-14 -100 0 z" fill="#b8e7ff" opacity="0.14" />
        </g>
        {/* Rear window surround trim + roof scoop */}
        <path
          d="M72 102 q10-34 58-34 t58 34 q-58-13 -116 0 z"
          fill="none"
          stroke="#263042"
          strokeWidth="1.2"
        />
        <path d="M80 74 q50-14 100 0 l-5 -7 q-45-11 -90 0 z" fill={hi} opacity="0.92" />
        <path d="M121 63 h18 l-2 5 h-14 z" fill="#070a10" stroke={hi} strokeWidth="0.6" />

        {/* ---- High-Mount Swan-Neck Carbon GT Wing with Endplates ---- */}
        <g>
          {/* Twin top-mounted swan-neck pylons */}
          <path
            d="M95 102 C95 82, 97 56, 102 52 L108 52 C104 58, 103 82, 103 102 Z"
            fill="#0c1017"
            stroke="#454f63"
            strokeWidth="0.8"
          />
          <path
            d="M165 102 C165 82, 163 56, 158 52 L152 52 C156 58, 157 82, 157 102 Z"
            fill="#0c1017"
            stroke="#454f63"
            strokeWidth="0.8"
          />
          {/* Swan-neck gooseneck hooks curving over the top of the wing */}
          <path d="M98 50 q4-6 9 0 l-1 8 h-8 z" fill="#171d28" stroke="#68758e" strokeWidth="0.8" />
          <path d="M153 50 q4-6 9 0 l-1 8 h-8 z" fill="#171d28" stroke="#68758e" strokeWidth="0.8" />

          {/* Main dual-element carbon wing plane */}
          <path
            d={
              isHyper
                ? "M12 56 q118-8 236 0 l-3 10 q-115-6 -230 0 z"
                : "M20 57 q110-7 220 0 l-3 9.5 q-107-5 -214 0 z"
            }
            fill={`url(#carbon-${uid})`}
            stroke="#3d4659"
            strokeWidth="0.9"
          />
          {/* Gurney flap / accent strip on trailing edge */}
          <path
            d={
              isHyper
                ? "M16 58 q114-7 228 0"
                : "M24 59 q106-6 212 0"
            }
            fill="none"
            stroke={isHyper ? "#ffd66b" : c}
            strokeWidth="1.8"
            strokeOpacity="0.85"
          />

          {/* Sculpted carbon endplates with team color slash */}
          <path
            d={isHyper ? "M8 48 l8 -2 l3 26 l-9 2 z" : "M16 49 l8 -2 l3 25 l-9 2 z"}
            fill="#0b0f17"
            stroke={isHyper ? "#ffd66b" : c}
            strokeWidth="1"
          />
          <path
            d={isHyper ? "M252 48 l-8 -2 l-3 26 l9 2 z" : "M244 49 l-8 -2 l-3 25 l9 2 z"}
            fill="#0b0f17"
            stroke={isHyper ? "#ffd66b" : c}
            strokeWidth="1"
          />
        </g>

        {/* ---- Ducktail decklid lip ---- */}
        <path d="M42 104 q88-15 176 0 l2 7 q-90-14 -180 0 z" fill={dark} opacity="0.65" />

        {/* ---- Central Honeycomb Heat-Extraction Grille ---- */}
        <g>
          <rect
            x="42"
            y="109"
            width="176"
            height="19"
            rx="6"
            fill="#06080e"
            stroke="#1e2533"
            strokeWidth="1.1"
          />
          <rect
            x="45"
            y="111"
            width="170"
            height="15"
            rx="4"
            fill={`url(#honeycomb-${uid})`}
            opacity="0.95"
          />
        </g>

        {/* ---- Full-Width Glowing Horizon LED Taillight Strip ---- */}
        <g opacity={lampOpacity}>
          {/* Outer red LED glow halo */}
          <g style={{ filter: "blur(7px)" }} opacity={bloom}>
            <rect x="28" y="108" width="204" height="16" rx="8" fill="#ff1a30" />
          </g>

          {/* Left & Right C-blade outer signature housings */}
          <path d="M32 111 l42 -2 l5 7 l-5 7 l-42 -2 z" fill="#ff172e" />
          <path d="M228 111 l-42 -2 l-5 7 l5 7 l42 -2 z" fill="#ff172e" />

          {/* Continuous full-width horizon LED light bar */}
          <path
            d="M30 113.5 Q130 108.5 230 113.5 L230 118.5 Q130 113.5 30 118.5 Z"
            fill={`url(#horizon-${uid})`}
          />
          {/* Intense white-hot LED core */}
          <path
            d="M34 115.5 Q130 110.8 226 115.5"
            fill="none"
            stroke="#fff5f6"
            strokeWidth={braking ? "2.6" : "1.8"}
            strokeLinecap="round"
          />
        </g>

        {/* ---- Illuminated License Plate displaying RED / PURPLE / BLUE ---- */}
        <g>
          {/* Recessed license plate housing */}
          <rect
            x="95"
            y="122"
            width="70"
            height="16"
            rx="3.5"
            fill="#070a11"
            stroke={c}
            strokeOpacity="0.85"
            strokeWidth="1.2"
          />
          {/* LED plate backlight glow */}
          <rect
            x="97"
            y="124"
            width="66"
            height="12"
            rx="2.5"
            fill={c}
            fillOpacity="0.16"
          />
          {/* Top micro plate lamps */}
          <rect x="114" y="122.8" width="8" height="1.2" rx="0.6" fill="#ffffff" opacity="0.85" />
          <rect x="138" y="122.8" width="8" height="1.2" rx="0.6" fill="#ffffff" opacity="0.85" />
          <text
            x="130"
            y="133.2"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="8.5"
            fontWeight="900"
            fontFamily="Orbitron, sans-serif"
            letterSpacing="1.6"
            style={{ filter: `drop-shadow(0 0 4px ${c})` }}
          >
            {plateLabel}
          </text>
        </g>

        {/* ---- Lower Carbon Diffuser & Centered Dual Exhaust Pods ---- */}
        <path d="M32 138 h196 q10 13 4 28 h-204 q-6-15 4-28 z" fill={`url(#carbon-${uid})`} />

        {/* Body-colour aero spats */}
        <path d="M30 136 q20-6 44-4 l-4 12 q-22-2 -42 6 z" fill={mid} opacity="0.82" />
        <path d="M230 136 q-20-6 -44-4 l4 12 q22-2 42 6 z" fill={mid} opacity="0.82" />

        {/* Outer vertical diffuser strakes */}
        {[48, 62, 76, 184, 198, 212].map((x) => (
          <rect
            key={x}
            x={x}
            y="142"
            width="3.2"
            height="22"
            rx="1.2"
            fill="#080b11"
            stroke="#2f3747"
            strokeWidth="0.6"
          />
        ))}

        {/* Centered Dual Exhaust Pods in titanium/carbon housing */}
        <g>
          <rect
            x="92"
            y="141"
            width="76"
            height="22"
            rx="8"
            fill="#080b11"
            stroke="#525c70"
            strokeWidth="1.4"
          />
          {/* Inner heat shield mesh */}
          <rect
            x="96"
            y="144"
            width="68"
            height="16"
            rx="6"
            fill={`url(#honeycomb-${uid})`}
            opacity="0.7"
          />
          {/* Twin large-bore central Titanium exhaust tips */}
          {[114, 146].map((cx) => (
            <g key={cx}>
              <circle
                cx={cx}
                cy="152"
                r="8.5"
                fill="#1b212c"
                stroke={isHyper ? "#ffd66b" : "#78859e"}
                strokeWidth="1.8"
              />
              <circle cx={cx} cy="152" r="6" fill="#05070c" />
              {/* Internal afterburner glow */}
              <circle
                cx={cx}
                cy="152"
                r={3.5 + t * 2}
                fill={isHyper ? "#ffb03a" : "#45d8ff"}
                opacity={0.25 + t * 0.65}
              />
            </g>
          ))}
        </g>

        {/* Central FIA rain light below the dual exhaust pod */}
        <rect
          x="123"
          y="164"
          width="14"
          height="4.5"
          rx="1.5"
          fill="#ff2634"
          opacity={braking ? 1 : 0.55 + t * 0.4}
        />

        {/* Hypercar gold underglow */}
        {isHyper && (
          <ellipse cx="130" cy="175" rx="98" ry="9" fill="#ffd66b" opacity={0.28 + t * 0.28} />
        )}

        {/* Wet-road reflection */}
        {reflection && (
          <g transform="translate(0,356) scale(1,-1)" opacity="0.18">
            <path d={body} fill={`url(#refl-${uid})`} />
          </g>
        )}
      </svg>

      {/* Centered dual exhaust heat distortion & flame plumes */}
      {t > 0.12 && (
        <>
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              left: "41%",
              bottom: "9%",
              width: 10 + t * 6,
              height: 10 + t * 6,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 72%)"
                : "radial-gradient(circle,#ffffff,#5ce1ff 55%,transparent 72%)",
              filter: "blur(1px)",
              animation: `exhaust ${0.68 - t * 0.32}s ease-out infinite`,
            }}
          />
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              right: "41%",
              bottom: "9%",
              width: 10 + t * 6,
              height: 10 + t * 6,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 72%)"
                : "radial-gradient(circle,#ffffff,#5ce1ff 55%,transparent 72%)",
              filter: "blur(1px)",
              animation: `exhaust ${0.68 - t * 0.32}s ease-out infinite ${(0.68 - t * 0.32) / 2}s`,
            }}
          />
        </>
      )}
    </div>
  );
});
