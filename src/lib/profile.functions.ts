import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MyProfile {
  phone: string;
  displayName: string | null;
  createdAt: string;
  balancePaise: number;
  selfExcludedUntil: string | null;
  dailyLossLimitPaise: number | null;
  isBanned: boolean;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "phone, display_name, created_at, balance_paise, self_excluded_until, daily_loss_limit_paise, is_banned",
      )
      .eq("id", context.userId)
      .maybeSingle();
    if (error || !data) throw new Error("Profile not found");
    return {
      phone: data.phone,
      displayName: data.display_name,
      createdAt: data.created_at,
      balancePaise: Number(data.balance_paise),
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
      displayName?: string;
      dailyLossLimitPaise?: number | null;
      selfExcludeDays?: 1 | 7 | 30;
      ageConfirmed?: boolean;
    }) => {
      const out: {
        displayName?: string;
        dailyLossLimitPaise?: number | null;
        selfExcludeDays?: number;
        ageConfirmed?: boolean;
      } = {};
      if (d?.displayName !== undefined) {
        const n = String(d.displayName).trim();
        if (!/^[A-Za-z0-9 _.-]{3,20}$/.test(n))
          throw new Error("Name must be 3–20 letters, numbers, spaces, _ . -");
        if (BLOCKED.some((w) => n.toLowerCase().includes(w)))
          throw new Error("Please choose a different name");
        out.displayName = n;
      }
      if (d?.dailyLossLimitPaise !== undefined) {
        const v = d.dailyLossLimitPaise;
        if (v !== null && (!Number.isInteger(v) || v < 1000 || v > 10_000_000))
          throw new Error("Limit must be at least ₹10");
        out.dailyLossLimitPaise = v;
      }
      if (d?.selfExcludeDays !== undefined) {
        if (![1, 7, 30].includes(d.selfExcludeDays)) throw new Error("Invalid pause length");
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
    if (error) throw new Error("Could not save changes");
    return { ok: true as const };
  });
