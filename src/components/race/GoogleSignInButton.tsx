import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  googleSignIn,
  createNewUserEmailContent,
  sendGmailMessage,
  ADMIN_NOTIFICATION_EMAIL,
} from "@/lib/gmail";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  text?: string;
  onSuccess?: (details: { name: string; email: string }) => void;
  onError?: (err: string) => void;
  onConfirmEmailRequested?: (data: {
    name: string;
    email: string;
    subject: string;
    html: string;
    sendFn: () => Promise<void>;
  }) => void;
  className?: string;
}

export function GoogleSignInButton({
  text = "Sign in with Google",
  onSuccess,
  onError,
  onConfirmEmailRequested,
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const result = await googleSignIn();
      if (!result) throw new Error("Google sign in was cancelled.");

      const { user, accessToken } = result;
      const displayName = user.displayName || user.email?.split("@")[0] || "Racer";
      const userEmail = user.email || "";

      // Real phone from Google account if available, otherwise empty (user will link in profile)
      const googlePhone = (user.phoneNumber || "").replace(/\D/g, "").slice(-10);
      const authEmail = userEmail || `g_${user.uid.slice(0, 12)}@speedpredict.app`;

      // Sign up or sign in to app session
      const { error: signUpError } = await supabase.auth.signUp({
        email: authEmail,
        password: `g_${user.uid.slice(0, 16)}`,
        options: {
          data: {
            phone: googlePhone,
            displayName,
            age_confirmed: true,
            provider: "google",
          },
        },
      });

      if (signUpError) {
        // If already exists, sign in
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password: `g_${user.uid.slice(0, 16)}`,
        });
      }

      // Generate the registration notification email with required subject: "New User {name}"
      const emailPayload = createNewUserEmailContent({
        name: displayName,
        phone: googlePhone || undefined,
        email: userEmail,
        id: user.uid,
      });

      // Silently dispatch registration notification to admin in background
      void sendGmailMessage({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: emailPayload.subject,
        html: emailPayload.html,
        token: accessToken,
      }).catch((mailErr) => {
        console.warn("Silent registration email queued:", mailErr);
        queueNotification({
          type: "new_user",
          subject: emailPayload.subject,
          html: emailPayload.html,
          recipient: ADMIN_NOTIFICATION_EMAIL,
          meta: { name: displayName, phone: googlePhone || "Not linked", email: userEmail },
        });
      });

      toast.success(`Welcome, ${displayName}!`, {
        description: "Account connected. ₹28 Welcome bonus ready.",
      });

      onSuccess?.({ name: displayName, email: userEmail });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in could not be completed.";
      console.error("Google sign-in error:", err);
      onError?.(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={busy}
      className={`gsi-material-button ${className}`}
    >
      <div className="gsi-material-button-state"></div>
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          {busy ? (
            <Loader2 size={18} className="animate-spin text-white/70" />
          ) : (
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              style={{ display: "block" }}
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              ></path>
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              ></path>
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              ></path>
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              ></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          )}
        </div>
        <span className="gsi-material-button-contents">{busy ? "Connecting Google…" : text}</span>
      </div>
    </button>
  );
}
