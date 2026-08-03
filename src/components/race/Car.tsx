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
 * Rear-view widebody GT. Modelled on the reference render: muscular haunches,
 * tall swan-neck GT wing, C-signature LED tail blades, quad exhausts in
 * carbon pods, full-width diffuser and a single central rain lamp.
 * Stage is 260x210 so the car reads wide-and-low.
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
  const w = size * (isSmall ? 0.82 : isHyper ? 1.08 : 1);
  const h = w * 0.82;
  const c = spec.color;
  const hi = shade(c, isHyper ? 70 : 92);
  const light = shade(c, isHyper ? 44 : 58);
  const mid = shade(c, isHyper ? 10 : 4);
  const dark = shade(c, -70);
  const deep = shade(c, -108);
  const uid = spec.id;

  const t = Math.max(0, Math.min(1, throttle));
  const lampOpacity = braking ? 1 : 0.6 + t * 0.4;
  const bloom = braking ? 0.55 : 0.12 + t * 0.32;

  // tread scroll: stopped when the car is stopped, faster as throttle rises
  const rolling = t > 0.06;
  const wheelAnim: React.CSSProperties = {
    animation: `wheel-roll ${Math.max(0.07, 0.62 - t * 0.56).toFixed(3)}s linear infinite`,
    animationPlayState: rolling ? "running" : "paused",
    willChange: "transform",
  };

  // widebody silhouette (shared shape, scaled by class via viewBox usage)
  const body =
    "M20 100 q6-24 30-32 q18-26 80-26 t80 26 q24 8 30 32 l8 34 q4 22 -16 26 l-26 5 h-152 l-26-5 q-20-4 -16-26 z";

  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h,
        filter: glow
          ? `drop-shadow(0 0 22px ${c}) drop-shadow(0 0 54px ${c}55)`
          : `drop-shadow(0 14px 20px rgba(0,0,0,0.72))`,
      }}
    >
      <svg viewBox="0 0 260 210" width={w} height={h} style={{ display: "block" }}>
        <defs>
          {/* metallic paint: bright crown, saturated flank, near-black sill */}
          <linearGradient id={`paint-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.16" stopColor={light} />
            <stop offset="0.42" stopColor={mid} />
            <stop offset="0.72" stopColor={c} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          {/* wrap-around body curvature */}
          <linearGradient id={`flank-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={deep} stopOpacity="0.98" />
            <stop offset="0.1" stopColor={dark} stopOpacity="0.5" />
            <stop offset="0.3" stopColor={hi} stopOpacity="0.2" />
            <stop offset="0.5" stopColor={light} stopOpacity="0.06" />
            <stop offset="0.7" stopColor={hi} stopOpacity="0.2" />
            <stop offset="0.9" stopColor={dark} stopOpacity="0.5" />
            <stop offset="1" stopColor={deep} stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1017" />
            <stop offset="0.4" stopColor="#141b26" />
            <stop offset="1" stopColor="#04060a" />
          </linearGradient>
          <linearGradient id={`carbon-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22262f" />
            <stop offset="0.5" stopColor="#12151b" />
            <stop offset="1" stopColor="#05070b" />
          </linearGradient>
          <linearGradient id={`tail-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff5a63" />
            <stop offset="0.45" stopColor="#ff1226" />
            <stop offset="1" stopColor="#8d0713" />
          </linearGradient>
          <radialGradient id={`floor-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff2b3b" stopOpacity={0.22 + t * 0.38} />
            <stop offset="1" stopColor="#ff2b3b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`refl-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.3" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`tyre-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#030408" />
            <stop offset="0.42" stopColor="#1b202a" />
            <stop offset="1" stopColor="#030408" />
          </linearGradient>
        </defs>

        {/* contact shadow + taillight bloom on tarmac */}
        <ellipse cx="130" cy="178" rx="104" ry="13" fill="#000" opacity="0.62" />
        <ellipse cx="130" cy="188" rx="112" ry="24" fill={`url(#floor-${uid})`} />

        {/* ---- rear tyres, wide and squat (tread rolls with speed) ---- */}
        <g>
          <clipPath id={`tyreL-${uid}`}>
            <path d="M14 104 q-10 32 -1 62 h34 q-9-32 -3-64 z" />
          </clipPath>
          <clipPath id={`tyreR-${uid}`}>
            <path d="M246 104 q10 32 1 62 h-34 q9-32 3-64 z" />
          </clipPath>
          <path d="M14 104 q-10 32 -1 62 h34 q-9-32 -3-64 z" fill={`url(#tyre-${uid})`} />
          <path d="M246 104 q10 32 1 62 h-34 q9-32 3-64 z" fill={`url(#tyre-${uid})`} />

          {[
            { clip: `tyreL-${uid}`, x: 6 },
            { clip: `tyreR-${uid}`, x: 208 },
          ].map(({ clip, x }) => (
            <g key={clip} clipPath={`url(#${clip})`}>
              <g style={wheelAnim} opacity={0.8 - t * 0.45}>
                {Array.from({ length: 14 }, (_, k) => 96 + k * 12).map((y) => (
                  <rect
                    key={y}
                    x={x}
                    y={y}
                    width="46"
                    height="3"
                    rx="1.5"
                    fill="#39414f"
                    opacity="0.8"
                  />
                ))}
              </g>
            </g>
          ))}

          <g opacity={t * 0.55}>
            <rect x="14" y="112" width="32" height="52" rx="8" fill="#8b96ad" opacity="0.22" />
            <rect x="214" y="112" width="32" height="52" rx="8" fill="#8b96ad" opacity="0.22" />
          </g>
        </g>

        {/* ---- main body ---- */}
        <path d={body} fill={`url(#paint-${uid})`} />
        <path d={body} fill={`url(#flank-${uid})`} />

        {/* shoulder highlight running across the haunches */}
        <path d="M34 100 q96-30 192 0" fill="none" stroke={hi} strokeOpacity="0.55" strokeWidth="2.2" />
        {/* haunch crease */}
        <path d="M40 126 q32 12 90 12 t90-12" fill="none" stroke={deep} strokeOpacity="0.5" strokeWidth="3" />

        {/* side mirrors on stalks */}
        <path d="M64 82 q-22-8 -30 2 q11 8 28 4 z" fill="#0d1117" />
        <path d="M196 82 q22-8 30 2 q-11 8 -28 4 z" fill="#0d1117" />

        {/* ---- greenhouse: low, wide, steeply raked rear screen ---- */}
        <path d="M72 102 q10-34 58-34 t58 34 q-58-13 -116 0 z" fill={`url(#glass-${uid})`} />
        <path d="M84 86 q46-15 92 0 l2 6 q-48-14 -96 0 z" fill="#9fdcff" opacity="0.1" />
        {/* body-colour roof rail above the glass */}
        <path d="M80 74 q50-14 100 0 l-5 -7 q-45-11 -90 0 z" fill={hi} opacity="0.9" />


        {/* ---- GT wing: posts, blade, endplates ---- */}
        {!isSmall && (
          <g>
            {/* swan-neck posts */}
            <path d="M96 104 l7 0 l1 -34 l-7 0 z" fill="#0c1016" />
            <path d="M157 104 l7 0 l-1 -34 l-7 0 z" fill="#0c1016" />
            {/* main blade */}
            <rect x={isHyper ? 14 : 22} y="64" width={isHyper ? 232 : 216} height="8" rx="4" fill={`url(#carbon-${uid})`} />
            <rect
              x={isHyper ? 18 : 26}
              y="65.2"
              width={isHyper ? 224 : 208}
              height="2"
              rx="1"
              fill={isHyper ? "#ffd66b" : "#7d8798"}
              opacity="0.6"
            />
            {/* endplates */}
            <rect x={isHyper ? 8 : 16} y="58" width="10" height="21" rx="4" fill="#0c1016" />
            <rect x={isHyper ? 242 : 234} y="58" width="10" height="21" rx="4" fill="#0c1016" />
          </g>
        )}


        {/* ---- deck / spoiler lip across the boot ---- */}
        <path d="M46 104 q84-16 168 0 l2 8 q-86-16 -172 0 z" fill={dark} opacity="0.55" />

        {/* ---- C-signature LED tail blades ---- */}
        <g opacity={lampOpacity}>
          {/* left */}
          <path
            d="M40 116 l64 -6 l10 10 l-10 10 l-64 -4 z"
            fill="#180205"
          />
          <path
            d="M45 118 l56 -5 l6 6 l-6 6 l-56 -3 z"
            fill={`url(#tail-${uid})`}
          />
          <path
            d="M47 118.5 l53 -4.5"
            stroke="#ffd3d6"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={braking ? 1 : 0.7}
          />
          {/* right (mirrored) */}
          <g transform="translate(260,0) scale(-1,1)">
            <path d="M40 116 l64 -6 l10 10 l-10 10 l-64 -4 z" fill="#180205" />
            <path d="M45 118 l56 -5 l6 6 l-6 6 l-56 -3 z" fill={`url(#tail-${uid})`} />
            <path
              d="M47 118.5 l53 -4.5"
              stroke="#ffd3d6"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={braking ? 1 : 0.7}
            />
          </g>
        </g>
        {/* tail bloom */}
        <g style={{ filter: "blur(8px)" }} opacity={bloom}>
          <rect x="36" y="108" width="82" height="20" rx="10" fill="#ff2233" />
          <rect x="142" y="108" width="82" height="20" rx="10" fill="#ff2233" />
        </g>

        {/* ---- centre black panel between the lights ---- */}
        <path d="M112 110 q18-4 36 0 l4 14 q-22 4 -44 0 z" fill="#0a0d12" />
        <rect x="118" y="114" width="24" height="6" rx="1.5" fill="#dfe5ef" opacity="0.55" />

        {/* ---- lower bumper: carbon pods, quad exhausts, diffuser ---- */}
        <path d="M34 132 h192 q10 14 4 30 h-200 q-6-16 4-30 z" fill={`url(#carbon-${uid})`} />
        {/* body-colour bumper shoulders */}
        <path d="M34 132 q26-8 56-6 l-4 12 q-30-2 -54 6 z" fill={mid} opacity="0.7" />
        <path d="M226 132 q-26-8 -56-6 l4 12 q30-2 54 6 z" fill={mid} opacity="0.7" />

        {/* exhaust pods */}
        <g>
          <rect x="46" y="140" width="52" height="22" rx="7" fill="#0a0d13" stroke="#4a5262" strokeWidth="1.2" />
          <rect x="162" y="140" width="52" height="22" rx="7" fill="#0a0d13" stroke="#4a5262" strokeWidth="1.2" />
          {[60, 82, 176, 198].map((x) => (
            <g key={x}>
              <circle cx={x} cy="151" r="7.5" fill="#171b23" stroke="#59616f" strokeWidth="1.4" />
              <circle cx={x} cy="151" r="4" fill="#05070b" />
              {t > 0.2 && (
                <circle cx={x} cy="151" r="3" fill={isHyper ? "#ffb03a" : "#7fd8ff"} opacity={t * 0.5} />
              )}
            </g>
          ))}
        </g>

        {/* diffuser fins */}
        <g>
          <rect x="104" y="140" width="52" height="22" rx="4" fill="#0b0e14" />
          {[110, 122, 134, 146].map((x) => (
            <rect key={x} x={x} y="158" width="3.4" height="12" rx="1.4" fill="#080b10" />
          ))}
        </g>
        {/* central rain lamp */}
        <path d="M122 156 h16 l-3 10 h-10 z" fill="#ff2634" opacity={braking ? 1 : 0.4 + t * 0.35} />

        {/* hypercar underglow */}
        {isHyper && <ellipse cx="130" cy="174" rx="98" ry="9" fill="#ffd66b" opacity={0.26 + t * 0.26} />}

        {/* wet-road reflection */}
        {reflection && (
          <g transform="translate(0,356) scale(1,-1)" opacity="0.18">
            <path d={body} fill={`url(#refl-${uid})`} />
          </g>
        )}
      </svg>

      {/* exhaust heat haze */}
      {t > 0.15 && (
        <>
          <span
            className="absolute rounded-full"
            style={{
              left: "22%",
              bottom: "10%",
              width: 9 + t * 5,
              height: 9 + t * 5,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: `exhaust ${0.75 - t * 0.35}s ease-out infinite`,
            }}
          />
          <span
            className="absolute rounded-full"
            style={{
              right: "22%",
              bottom: "10%",
              width: 9 + t * 5,
              height: 9 + t * 5,
              background: isHyper
                ? "radial-gradient(circle,#ffd66b,#ff5b1f 55%,transparent 70%)"
                : "radial-gradient(circle,#fff,#8ad9ff 55%,transparent 70%)",
              animation: `exhaust ${0.75 - t * 0.35}s ease-out infinite ${(0.75 - t * 0.35) / 2}s`,
            }}
          />
        </>
      )}
    </div>
  );
});
