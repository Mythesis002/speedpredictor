/**
 * One single source of truth for the racing-scene perspective.
 *
 * Everything on screen — road edges, lane dividers, dashes and the three cars —
 * is projected through this pinhole camera so nothing can drift out of
 * alignment on any viewport size.
 *
 *   z      world depth, Z_NEAR (at the camera) .. Z_FAR (vanishing point)
 *   s      projected scale  = Z_NEAR / z        (1 near, ~0 at horizon)
 *   u      lateral position in half-road units  (-1 left edge .. +1 right edge)
 */

export const Z_NEAR = 1;
export const Z_FAR = 15;

/** half the road width at the camera plane, as a fraction of stage width */
export const HALF_ROAD = 0.6;

/** horizon line, as a fraction of stage height */
export const HORIZON = 0.4;
/** where the road meets the bottom of the frame */
export const GROUND = 1;

/** lane centres: three equal lanes across the road */
export const LANE_U = [-2 / 3, 0, 2 / 3] as const;
/** the two painted dividers between the lanes */
export const DIVIDER_U = [-1 / 3, 1 / 3] as const;

export const S_FAR = Z_NEAR / Z_FAR;

export function scaleAt(z: number) {
  return Z_NEAR / Math.max(z, Z_NEAR * 0.001);
}

/** screen y (px) of a point at depth z */
export function yAt(z: number, h: number) {
  const s = scaleAt(z);
  const horizonY = HORIZON * h;
  return horizonY + s * (GROUND * h - horizonY);
}

/** screen x (px) of lateral position u at depth z */
export function xAt(u: number, z: number, w: number) {
  return w / 2 + u * HALF_ROAD * w * scaleAt(z);
}

/** width of a single lane (px) at depth z */
export function laneWidthAt(z: number, w: number) {
  return ((2 * HALF_ROAD * w) / 3) * scaleAt(z);
}

/** percentage coordinates for the static road polygon / neon rails */
export const EDGE_PCT = {
  bottomLeft: 50 - HALF_ROAD * 100,
  bottomRight: 50 + HALF_ROAD * 100,
  topLeft: 50 - HALF_ROAD * 100 * S_FAR,
  topRight: 50 + HALF_ROAD * 100 * S_FAR,
  horizonPct: HORIZON * 100,
};
