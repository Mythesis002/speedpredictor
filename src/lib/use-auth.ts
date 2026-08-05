import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Minimal session hook — the source of truth for "is a real player signed in". */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading, userId: session?.user.id ?? null };
}

/** Phone numbers are the identity; the auth email is derived, never shown. */
export function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, "").slice(-10)}@speedpredict.app`;
}
