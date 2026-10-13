import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

export const ADMIN_NOTIFICATION_EMAIL = "ashishsinghbag02@gmail.com";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://mail.google.com/",
];

// Initialize Firebase App safely (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GMAIL_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: "select_account" });

// In-memory cache for access token and Google user profile (DO NOT persist in localStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: FirebaseUser | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      cachedGoogleUser = user;
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // In-memory token cleared or fresh session without interactive sign-in
        onAuthFailure?.();
      }
    } else {
      cachedGoogleUser = null;
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get Google access token from OAuth consent.");
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCachedGoogleUser = (): FirebaseUser | null => {
  return cachedGoogleUser;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedGoogleUser = null;
};

/**
 * Creates a base64url-encoded RFC 2822 MIME message for the Gmail REST API.
 */
function makeRawEmail({
  to,
  subject,
  bodyHtml,
  bodyText,
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const boundary = `apex_boundary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const plain = bodyText || bodyHtml.replace(/<[^>]+>/g, " ");

  const messageParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(plain))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(bodyHtml))),
    "",
    `--${boundary}--`,
  ];

  const fullMessage = messageParts.join("\r\n");
  return btoa(unescape(encodeURIComponent(fullMessage)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an email via the Gmail REST API using the in-memory OAuth token.
 */
export async function sendGmailMessage({
  to,
  subject,
  html,
  text,
  token,
}: {
  to?: string;
  subject: string;
  html: string;
  text?: string;
  token?: string;
}): Promise<SendEmailResult> {
  const effectiveToken = token || (await getAccessToken());
  if (!effectiveToken) {
    throw new Error(
      "No Google Workspace authorization token. Please authenticate with Google first.",
    );
  }

  const recipient = to || ADMIN_NOTIFICATION_EMAIL;
  const raw = makeRawEmail({
    to: recipient,
    subject,
    bodyHtml: html,
    bodyText: text,
  });

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json?.error?.message || errorBody;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Gmail API error (${response.status}): ${parsedMessage}`);
  }

  const data = (await response.json()) as { id?: string; threadId?: string };
  recordDispatchedNotification({
    id: data.id || `msg-${Date.now()}`,
    to: recipient,
    subject,
    sentAt: new Date().toISOString(),
  });

  return { success: true, messageId: data.id };
}

export interface DispatchedLogItem {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
}

export interface QueuedNotificationItem {
  id: string;
  type: "new_user" | "add_funds";
  subject: string;
  html: string;
  recipient: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

const DISPATCHED_STORAGE_KEY = "apex_dispatched_gmail_logs";
const QUEUED_STORAGE_KEY = "apex_queued_gmail_notifications";

export function getDispatchedLogs(): DispatchedLogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISPATCHED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DispatchedLogItem[]) : [];
  } catch {
    return [];
  }
}

export function recordDispatchedNotification(item: DispatchedLogItem) {
  if (typeof window === "undefined") return;
  try {
    const existing = getDispatchedLogs();
    const updated = [item, ...existing].slice(0, 50);
    window.localStorage.setItem(DISPATCHED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getQueuedNotifications(): QueuedNotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedNotificationItem[]) : [];
  } catch {
    return [];
  }
}

export function queueNotification(item: Omit<QueuedNotificationItem, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getQueuedNotifications();
    const newItem: QueuedNotificationItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newItem, ...existing].slice(0, 30);
    window.localStorage.setItem(QUEUED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function removeQueuedNotification(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getQueuedNotifications();
    const updated = existing.filter((item) => item.id !== id);
    window.localStorage.setItem(QUEUED_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearQueuedNotifications() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUEUED_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Creates email payload for new user registrations:
 * Subject must strictly be: "New User {name}"
 */
export function createNewUserEmailContent(user: {
  name?: string;
  phone?: string;
  email?: string;
  id?: string;
}) {
  const name = user.name || (user.phone ? `+91 ${user.phone}` : "Racer");
  const subject = `New User ${name}`;
  const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New User Registration</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #05070e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <div style="max-width: 540px; margin: 0 auto; background: #0c101d; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
    <div style="background: linear-gradient(135deg, #ffd83a, #f59e0b); padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: #0a0a0c; font-size: 22px; font-weight: 900; letter-spacing: 2px;">⚡ APEX RACING PREDICTIONS</h1>
      <p style="margin: 6px 0 0; color: #3b2800; font-size: 12px; font-weight: 700; letter-spacing: 1px;">NEW RACER REGISTRATION ALERT</p>
    </div>
    
    <div style="padding: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="font-size: 24px; margin-right: 8px;">🏎️</span>
        <h2 style="margin: 0; font-size: 18px; color: #ffd83a;">Welcome to the Grid: ${name}</h2>
      </div>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-top: 0;">
        A new account has just been created on Apex. The racer received their starter package and is ready to enter upcoming rounds.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #131929; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Racer Name</td>
          <td style="padding: 12px 16px; color: #ffffff; font-size: 14px; font-weight: 700;">${name}</td>
        </tr>
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Mobile Number</td>
          <td style="padding: 12px 16px; color: #ffffff; font-size: 14px; font-family: monospace;">${
            user.phone
              ? `+91 ${user.phone}`
              : `<span style="color: #ffc32b; font-family: sans-serif; font-size: 12px;">Not yet linked (Google Sign-In)</span>`
          }</td>
        </tr>
        ${
          user.email
            ? `
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Google Account</td>
          <td style="padding: 12px 16px; color: #38bdf8; font-size: 14px;">${user.email}</td>
        </tr>`
            : ""
        }
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Starter Bonus</td>
          <td style="padding: 12px 16px; color: #26ff9a; font-size: 14px; font-weight: 800;">₹28 Credited (Welcome Gift)</td>
        </tr>
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Timestamp</td>
          <td style="padding: 12px 16px; color: #cbd5e1; font-size: 13px;">${nowStr} IST</td>
        </tr>
        ${
          user.id
            ? `
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Account ID</td>
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; font-family: monospace;">${user.id}</td>
        </tr>`
            : ""
        }
      </table>

      <div style="background: rgba(255, 216, 58, 0.08); border-left: 3px solid #ffd83a; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #cbd5e1;">
        Dispatched automatically to <strong>${ADMIN_NOTIFICATION_EMAIL}</strong> via Google Workspace Gmail API integration.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}

/**
 * Creates email payload for Add Funds (deposit confirmed).
 */
export function createAddFundsEmailContent(deposit: {
  amountPaise: number;
  name?: string;
  phone?: string;
  depositId?: string;
  paymentId?: string;
  balancePaise?: number;
}) {
  const amountRupees = (deposit.amountPaise / 100).toFixed(0);
  const racerLabel = deposit.name || (deposit.phone ? `+91 ${deposit.phone}` : "Racer");
  const subject = `Funds Added · ₹${amountRupees} · ${racerLabel}`;
  const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Funds Added Notification</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #05070e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9;">
  <div style="max-width: 540px; margin: 0 auto; background: #0c101d; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
    <div style="background: linear-gradient(135deg, #26ff9a, #059669); padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: #022614; font-size: 22px; font-weight: 900; letter-spacing: 2px;">⚡ APEX RACING PREDICTIONS</h1>
      <p style="margin: 6px 0 0; color: #02381e; font-size: 12px; font-weight: 800; letter-spacing: 1px;">REAL-TIME DEPOSIT CREDITED</p>
    </div>
    
    <div style="padding: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <span style="font-size: 24px; margin-right: 8px;">💰</span>
        <h2 style="margin: 0; font-size: 18px; color: #26ff9a;">Deposit of ₹${amountRupees} Confirmed</h2>
      </div>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-top: 0;">
        Real money has been successfully received and credited to the player's gaming wallet.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #131929; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Credited Amount</td>
          <td style="padding: 12px 16px; color: #26ff9a; font-size: 22px; font-weight: 900;">₹${amountRupees}</td>
        </tr>
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Racer</td>
          <td style="padding: 12px 16px; color: #ffffff; font-size: 14px; font-weight: 700;">${racerLabel}</td>
        </tr>
        ${
          deposit.balancePaise !== undefined
            ? `
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">New Wallet Balance</td>
          <td style="padding: 12px 16px; color: #ffffff; font-size: 15px; font-weight: 800;">₹${(deposit.balancePaise / 100).toFixed(2)}</td>
        </tr>`
            : ""
        }
        ${
          deposit.depositId
            ? `
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Deposit ID</td>
          <td style="padding: 12px 16px; color: #94a3b8; font-size: 11px; font-family: monospace;">${deposit.depositId}</td>
        </tr>`
            : ""
        }
        ${
          deposit.paymentId
            ? `
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">UPI / Gateway Ref</td>
          <td style="padding: 12px 16px; color: #94a3b8; font-size: 11px; font-family: monospace;">${deposit.paymentId}</td>
        </tr>`
            : ""
        }
        <tr style="border-top: 1px solid #1e2638;">
          <td style="padding: 12px 16px; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Settled At</td>
          <td style="padding: 12px 16px; color: #cbd5e1; font-size: 13px;">${nowStr} IST</td>
        </tr>
      </table>

      <div style="background: rgba(38, 255, 154, 0.08); border-left: 3px solid #26ff9a; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #cbd5e1;">
        Dispatched automatically to <strong>${ADMIN_NOTIFICATION_EMAIL}</strong> via Google Workspace Gmail API integration.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return { subject, html };
}
