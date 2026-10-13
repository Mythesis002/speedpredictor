import { createFileRoute } from "@tanstack/react-router";
import { verifyRazorpaySignature } from "@/lib/wallet.server";

/**
 * Razorpay webhook — the authoritative "money arrived" signal.
 * The signature is verified over the raw body before anything is credited.
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!(await verifyRazorpaySignature(raw, signature))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          event?: string;
          payload?: {
            payment?: {
              entity?: {
                id?: string;
                amount?: number;
                status?: string;
                notes?: Record<string, string>;
              };
            };
            qr_code?: { entity?: { id?: string; notes?: Record<string, string> } };
          };
        };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.event !== "qr_code.credited") {
          return new Response("ignored");
        }

        const payment = event.payload?.payment?.entity;
        const qrId = event.payload?.qr_code?.entity?.id;
        const noteDepositId =
          event.payload?.qr_code?.entity?.notes?.deposit_id || payment?.notes?.deposit_id;

        if (!payment?.id || (!qrId && !noteDepositId)) {
          return new Response("ignored");
        }
        // Only credit captured payments
        if (payment.status && payment.status !== "captured") {
          return new Response("not captured");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const depQuery = supabaseAdmin.from("deposits").select("id, amount_paise, qr_id, status");

        const { data: dep } = qrId
          ? await depQuery.eq("qr_id", qrId).maybeSingle()
          : await depQuery.eq("id", noteDepositId!).maybeSingle();

        if (!dep) return new Response("unknown deposit");
        if (dep.status === "paid") return new Response("already credited");

        const expectedPaise = Number(dep.amount_paise);
        const arrivedPaise = Number(payment.amount ?? 0);
        if (!Number.isFinite(arrivedPaise) || arrivedPaise < expectedPaise) {
          return new Response("underpaid");
        }

        const { error } = await supabaseAdmin.rpc("credit_deposit", {
          p_deposit_id: dep.id,
          p_payment_id: payment.id,
          p_amount_paise: expectedPaise,
        });
        if (error) return new Response("credit failed", { status: 500 });

        if (dep.qr_id || qrId) {
          const { closeRazorpayQr } = await import("@/lib/wallet.server");
          await closeRazorpayQr((dep.qr_id || qrId)!);
        }

        return new Response("ok");
      },
    },
  },
});
