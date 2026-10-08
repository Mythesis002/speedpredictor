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
  /** 0 = idle, 1 = flat out. Drives exhaust haze and light intensity. */
  throttle?: number;
  /** brake lights burn bright on launch prep + finish */
  braking?: boolean;
  glow?: boolean;
  reflection?: boolean;
}

/** Photoreal rear-view renders, one per team colour (black studio background). */
const SPRITES: Record<string, string> = {
  Red: "/cars/red.png",
  Purple: "/cars/purple.png",
  Blue: "/cars/blue.png",
};

/** Source render aspect ratio (1408 x 768). */
const ASPECT = 1408 / 768;

/**
 * Photoreal rear-view GT. The sprites are transparent cutouts (green-screen
 * render, keyed out), so the car sits on the stage with its own lighting.
 * Class scaling (small / hyper) is kept from the original design.
 */
export function Car({
  spec,
  size = 150,
  throttle = 0,
  braking = false,
  glow = false,
  reflection: _reflection = true,
}: Props) {
  const isHyper = spec.kind === "hyper";
  const isSmall = spec.kind === "small";
  const w = size * (isSmall ? 0.82 : isHyper ? 1.08 : 1);
  const h = w / ASPECT;
  const t = Math.max(0, Math.min(1, throttle));
  const src = SPRITES[spec.colorName] ?? SPRITES.Red;
  const accent = isHyper ? "#ffd66b" : "#7fd8ff";

  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h,
        filter: glow
          ? `drop-shadow(0 0 18px ${spec.color}) drop-shadow(0 0 46px ${spec.color}55)`
          : "drop-shadow(0 14px 20px rgba(0,0,0,0.72))",
      }}
    >
      <img
        src={src}
        alt={`${spec.colorName} race car`}
        width={w}
        height={h}
        draggable={false}
        style={{
          display: "block",
          width: w,
          height: h,
          objectFit: "contain",
          filter: `brightness(${braking ? 1.18 : 1 + t * 0.08})`,
          userSelect: "none",
        }}
      />

      {/* hypercar underglow */}
      {isHyper && (
        <span
          className="pointer-events-none absolute left-[8%] right-[8%] rounded-full"
          style={{
            bottom: "2%",
            height: 8,
            background: accent,
            opacity: 0.26 + t * 0.26,
            filter: "blur(6px)",
          }}
        />
      )}

      {/* tail-light bloom, brighter under braking and throttle */}
      <span
        className="pointer-events-none absolute left-[18%] right-[18%] rounded-full"
        style={{
          top: "46%",
          height: 6,
          background: "#ff2233",
          opacity: braking ? 0.9 : 0.35 + t * 0.4,
          filter: "blur(6px)",
        }}
      />

      {/* exhaust heat haze */}
      {t > 0.15 && (
        <>
          <span
            className="absolute rounded-full"
            style={{
              left: "30%",
              bottom: "6%",
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
              right: "30%",
              bottom: "6%",
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
}
