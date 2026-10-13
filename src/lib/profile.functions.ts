import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MyProfile {
  phone: string;
  displayName: string | null;
  createdAt: string;
  balancePaise: number;
  heldPaise: number;
  availablePaise: number;
  selfExcludedUntil: string | null;
  dailyLossLimitPaise: number | null;
  isBanned: boolean;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data, error }, { data: pendingWithdrawals }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "phone, display_name, created_at, balance_paise, self_excluded_until, daily_loss_limit_paise, is_banned",
        )
        .eq("id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("withdrawals")
        .select("amount_paise")
        .eq("user_id", context.userId)
        .eq("status", "pending"),
    ]);
    if (error || !data) throw new Error("Profile not found");
    const balancePaise = Math.max(0, Number(data.balance_paise ?? 0));
    const heldPaise = (pendingWithdrawals ?? []).reduce(
      (sum, w) => sum + Math.max(0, Number(w.amount_paise ?? 0)),
      0,
    );
    const availablePaise = Math.max(0, balancePaise - heldPaise);
    return {
      phone: data.phone,
      displayName: data.display_name,
      createdAt: data.created_at,
      balancePaise,
      heldPaise,
      availablePaise,
      selfExcludedUntil: data.self_excluded_until,
      dailyLossLimitPaise:
        data.daily_loss_limit_paise === null ? null : Number(data.daily_loss_limit_paise),
      isBanned: Boolean(data.is_banned),
    };
  });

const BLOCKED = ["fuck", "shit", "bitch", "chutiya", "madarchod", "bhenchod", "admin", "owner"];

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      phone?: string;
      displayName?: string;
      dailyLossLimitPaise?: number | null;
      selfExcludeDays?: 1 | 7 | 30;
      ageConfirmed?: boolean;
    }) => {
      const out: {
        phone?: string;
        displayName?: string;
        dailyLossLimitPaise?: number | null;
        selfExcludeDays?: number;
        ageConfirmed?: boolean;
      } = {};
      if (d?.phone !== undefined) {
        const digits = String(d.phone).replace(/\D/g, "");
        if (digits.length !== 10 || !/^[6-9]\d{9}$/.test(digits)) {
          throw new Error(
            "Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).",
          );
        }
        out.phone = digits;
      }
      if (d?.displayName !== undefined) {
        const n = String(d.displayName).trim();
        if (!/^[A-Za-z0-9 _.-]{3,20}$/.test(n))
          throw new Error(
            "Display name must be 3–20 characters (letters, numbers, spaces, _ . -).",
          );
        if (BLOCKED.some((w) => n.toLowerCase().includes(w)))
          throw new Error("Please choose a different display name.");
        out.displayName = n;
      }
      if (d?.dailyLossLimitPaise !== undefined) {
        const v = d.dailyLossLimitPaise;
        if (v !== null && (!Number.isInteger(v) || v < 1000 || v > 10_000_000))
          throw new Error("Daily loss limit must be between ₹10 and ₹1,00,000.");
        out.dailyLossLimitPaise = v;
      }
      if (d?.selfExcludeDays !== undefined) {
        if (![1, 7, 30].includes(d.selfExcludeDays))
          throw new Error("Select a valid pause duration (24 hours, 7 days, or 30 days).");
        out.selfExcludeDays = d.selfExcludeDays;
      }
      if (d?.ageConfirmed === true) out.ageConfirmed = true;
      return out;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: import("@/integrations/supabase/types").TablesUpdate<"profiles"> = {
      updated_at: new Date().toISOString(),
    };
    if (data.phone !== undefined) {
      // Check if this mobile number is already registered to a different account
      const { data: existingRows } = await supabaseAdmin
        .from("profiles")
        .select("id, phone")
        .eq("phone", data.phone)
        .neq("id", context.userId);

      const isTaken = Array.isArray(existingRows) ? existingRows.length > 0 : Boolean(existingRows);

      if (isTaken) {
        throw new Error(
          "Already registered: This mobile number is already linked to another user account.",
        );
      }
      patch.phone = data.phone;
    }
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.dailyLossLimitPaise !== undefined)
      patch.daily_loss_limit_paise = data.dailyLossLimitPaise;
    if (data.ageConfirmed) patch.age_confirmed_at = new Date().toISOString();
    if (data.selfExcludeDays) {
      patch.self_excluded_until = new Date(
        Date.now() + data.selfExcludeDays * 86_400_000,
      ).toISOString();
      await supabaseAdmin.from("audit_log").insert({
        actor_id: context.userId,
        action: "self_exclude",
        entity: "profile",
        entity_id: context.userId,
        metadata: { days: data.selfExcludeDays },
      });
    }
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw new Error("Could not save your profile changes. Please try again.");
    return { ok: true as const };
  });
