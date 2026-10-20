export const DASHES = 12;
export const DASH_PERIOD = 1.15;
export const DASH_LEN = 0.42;
export const DASH_SPAN = DASHES * DASH_PERIOD;
export const KERB_COUNT = 10;
export const KERB_SPAN = DASH_SPAN;
export const KERB_SEG_LEN = DASH_SPAN / KERB_COUNT;
export const SEAM_COUNT = 6;
export const SEAM_PERIOD = DASH_SPAN / SEAM_COUNT;

export const Z_CAR_NEAR = 1.46; // trailing car, closest to the lens
export const CAR_SPREAD = 2.05; // how much depth the leader gains
export const BASE_CAR = 150; // px width the <Car/> svg is authored at
