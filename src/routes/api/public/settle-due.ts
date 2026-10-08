import { createFileRoute } from "@tanstack/react-router";
import { safeEqual, settleFinishedBets } from "@/lib/wallet.server";

/**
 * Scheduled settlement sweep. Call it every minute from a cron job (for
 * example Supabase pg_cron + pg_net, or any external scheduler):
 *
 *   POST /api/public/settle-due
 *   Authorization: Bearer <CRON_SECRET>
 *
 * It settles pending bets on rounds that have already finished, so a player who
 * closed the app mid-race is still paid. Safe to call repeatedly.
 */
export const Route = createFileRoute("/api/public/settle-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret || secret.length < 32) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }

        const header = request.headers.get("authorization") ?? "";
        const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!presented || !safeEqual(presented, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const settled = await settleFinishedBets({ limit: 500 });
          return Response.json({ settled });
        } catch {
          return Response.json({ error: "Settlement failed" }, { status: 500 });
        }
      },
    },
  },
});
