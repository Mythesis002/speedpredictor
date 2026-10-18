import { createServerFn } from "@tanstack/react-start";

export interface NetworkHealthResult {
  ok: boolean;
  serverTime: number;
}

/**
 * Lightweight, high-speed heartbeat ping endpoint to measure actual round-trip latency
 * between client and server, detecting slow networks or lost internet connections.
 */
export const checkNetworkHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<NetworkHealthResult> => {
    return {
      ok: true,
      serverTime: Date.now(),
    };
  },
);
