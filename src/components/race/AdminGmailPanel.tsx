import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_NOTIFICATION_EMAIL,
  GMAIL_SCOPES,
  clearQueuedNotifications,
  createAddFundsEmailContent,
  createNewUserEmailContent,
  getAccessToken,
  getCachedGoogleUser,
  getDispatchedLogs,
  getQueuedNotifications,
  logoutGoogle,
  removeQueuedNotification,
  sendGmailMessage,
  type DispatchedLogItem,
  type QueuedNotificationItem,
} from "@/lib/gmail";
import { GmailConfirmDialog } from "./GmailConfirmDialog";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function AdminGmailPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedNotificationItem[]>([]);
  const [logs, setLogs] = useState<DispatchedLogItem[]>([]);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    subject: string;
    recipient: string;
    description: string;
    details: { label: string; value: string }[];
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: "",
    subject: "",
    recipient: ADMIN_NOTIFICATION_EMAIL,
    description: "",
    details: [],
    onConfirm: async () => {},
  });

  const refreshState = async () => {
    const t = await getAccessToken();
    setToken(t);
    const u = getCachedGoogleUser();
    setGoogleEmail(u?.email ?? null);
    setQueue(getQueuedNotifications());
    setLogs(getDispatchedLogs());
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const handleDisconnect = async () => {
    await logoutGoogle();
    await refreshState();
    toast.success("Disconnected Google account");
  };

  const handleTestNewUser = () => {
    if (!token) {
      toast.error("Connect Google first", {
        description: "An active Google Workspace token is required to dispatch emails.",
      });
      return;
    }

    const testPayload = createNewUserEmailContent({
      name: "Kabir Sharma",
      phone: "9876543210",
      email: "kabir.test@speedpredict.app",
      id: "usr-test-8891",
    });

    setConfirmDialog({
      open: true,
      title: "Confirm Test Registration Alert",
      subject: testPayload.subject,
      recipient: ADMIN_NOTIFICATION_EMAIL,
      description: `This will dispatch a sample 'New User Kabir Sharma' registration email to ${ADMIN_NOTIFICATION_EMAIL} via the Gmail API.`,
      details: [
        { label: "Sample Racer", value: "Kabir Sharma" },
        { label: "Subject", value: testPayload.subject },
        { label: "Starter Bonus", value: "₹28 Credited" },
      ],
      onConfirm: async () => {
        await sendGmailMessage({
          to: ADMIN_NOTIFICATION_EMAIL,
          subject: testPayload.subject,
          html: testPayload.html,
          token,
        });
        toast.success(`Sent test email to ${ADMIN_NOTIFICATION_EMAIL}`);
        await refreshState();
      },
    });
  };

  const handleTestAddFunds = () => {
    if (!token) {
      toast.error("Connect Google first", {
        description: "An active Google Workspace token is required to dispatch emails.",
      });
      return;
    }

    const testPayload = createAddFundsEmailContent({
      amountPaise: 50000,
      name: "Rohan Patel",
      phone: "9123456789",
      depositId: `dep-live-${Date.now().toString().slice(-6)}`,
      paymentId: `pay_${Math.random().toString(36).slice(2, 10)}`,
      balancePaise: 78000,
    });

    setConfirmDialog({
      open: true,
      title: "Confirm Test Add Funds Alert",
      subject: testPayload.subject,
      recipient: ADMIN_NOTIFICATION_EMAIL,
      description: `This will dispatch a test deposit notification (₹500) to ${ADMIN_NOTIFICATION_EMAIL} via the Gmail API.`,
      details: [
        { label: "Player", value: "Rohan Patel" },
        { label: "Amount", value: "₹500.00" },
        { label: "Subject", value: testPayload.subject },
      ],
      onConfirm: async () => {
        await sendGmailMessage({
          to: ADMIN_NOTIFICATION_EMAIL,
          subject: testPayload.subject,
          html: testPayload.html,
          token,
        });
        toast.success(`Sent deposit alert to ${ADMIN_NOTIFICATION_EMAIL}`);
        await refreshState();
      },
    });
  };

  const handleDispatchQueuedItem = (item: QueuedNotificationItem) => {
    if (!token) {
      toast.error("Connect Google first to send queued notifications.");
      return;
    }

    setConfirmDialog({
      open: true,
      title: "Dispatch Queued Email",
      subject: item.subject,
      recipient: item.recipient || ADMIN_NOTIFICATION_EMAIL,
      description: `Dispatch this queued ${item.type === "new_user" ? "registration" : "deposit"} notification to ${item.recipient}.`,
      details: [
        { label: "Type", value: item.type === "new_user" ? "New User" : "Funds Added" },
        { label: "Subject", value: item.subject },
        { label: "Queued At", value: new Date(item.createdAt).toLocaleTimeString() },
      ],
      onConfirm: async () => {
        await sendGmailMessage({
          to: item.recipient,
          subject: item.subject,
          html: item.html,
          token,
        });
        removeQueuedNotification(item.id);
        toast.success(`Dispatched: ${item.subject}`);
        await refreshState();
      },
    });
  };

  const handleDispatchAll = async () => {
    if (!token) {
      toast.error("Connect Google first to send queued notifications.");
      return;
    }
    if (queue.length === 0) return;

    let sent = 0;
    for (const item of queue) {
      try {
        await sendGmailMessage({
          to: item.recipient,
          subject: item.subject,
          html: item.html,
          token,
        });
        removeQueuedNotification(item.id);
        sent++;
      } catch (e) {
        console.warn("Failed to dispatch queued email:", e);
      }
    }
    toast.success(`Dispatched ${sent} notification(s) to ${ADMIN_NOTIFICATION_EMAIL}`);
    await refreshState();
  };

  const handleClearAllQueue = () => {
    clearQueuedNotifications();
    toast.success("Notification queue cleared");
    void refreshState();
  };

  return (
    <div className="space-y-3">
      {/* Google Account Connection Status Card */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#ea4335]/20 text-[#ea4335] grid place-items-center">
              <Mail size={16} />
            </div>
            <div>
              <div className="font-display text-[12px] text-white font-bold tracking-wide">
                GMAIL DISPATCH ENGINE
              </div>
              <div className="text-[10px] text-white/50">
                Google Workspace OAuth & REST API Integration
              </div>
            </div>
          </div>
          <span
            className={`text-[9.5px] font-display px-2.5 py-1 rounded-full border ${
              token
                ? "bg-[#26ff9a]/10 border-[#26ff9a]/30 text-[#26ff9a]"
                : "bg-[#ffc32b]/10 border-[#ffc32b]/30 text-[#ffc32b]"
            }`}
          >
            {token ? "CONNECTED & AUTHORIZED" : "AUTH REQUIRED"}
          </span>
        </div>

        {token ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-black/40 border border-white/10 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/45">Authorized Account:</span>
                <span className="text-[#38bdf8] font-mono font-medium">
                  {googleEmail || "Google Workspace Session"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                <span className="text-white/45">Target Alert Recipient:</span>
                <span className="text-[#ffd83a] font-mono font-semibold">
                  {ADMIN_NOTIFICATION_EMAIL}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                <span className="text-white/45">Granted Scope:</span>
                <span className="text-white/70 text-[11px]">https://mail.google.com/</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleDisconnect}
                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-display flex items-center gap-1.5 transition"
              >
                <LogOut size={12} />
                <span>Disconnect</span>
              </button>
              <button
                type="button"
                onClick={() => void refreshState()}
                className="h-8 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-display flex items-center gap-1.5 transition"
              >
                <RefreshCw size={12} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-white/70 leading-relaxed">
              Connect your Google Workspace or Gmail account to enable real-time delivery of{" "}
              <strong>“New User”</strong> registration alerts and <strong>“Add Funds”</strong>{" "}
              deposit notifications to{" "}
              <code className="text-[#ffd83a] bg-black/50 px-1 py-0.5 rounded">
                {ADMIN_NOTIFICATION_EMAIL}
              </code>
              .
            </p>
            <GoogleSignInButton
              text="Connect Google Workspace Account"
              onSuccess={() => {
                void refreshState();
              }}
            />
          </div>
        )}
      </div>

      {/* Trigger & Test Buttons */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="text-[10px] font-display tracking-[0.16em] text-white/40 mb-3">
          INSTANT TEST DISPATCH (GMAIL API)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleTestNewUser}
            className="p-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-left transition flex flex-col justify-between min-h-[90px]"
          >
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-lg bg-[#ffd83a]/15 text-[#ffd83a] grid place-items-center">
                <UserPlus size={14} />
              </span>
              <span className="text-[9px] font-display text-white/40">TEST</span>
            </div>
            <div>
              <div className="font-display text-[11px] text-white font-semibold">
                New User Alert
              </div>
              <div className="text-[10px] text-white/40 truncate">
                Subject: &quot;New User {`{name}`}&quot;
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={handleTestAddFunds}
            className="p-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-left transition flex flex-col justify-between min-h-[90px]"
          >
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-lg bg-[#26ff9a]/15 text-[#26ff9a] grid place-items-center">
                <Wallet size={14} />
              </span>
              <span className="text-[9px] font-display text-white/40">TEST</span>
            </div>
            <div>
              <div className="font-display text-[11px] text-white font-semibold">
                Add Funds Alert
              </div>
              <div className="text-[10px] text-white/40 truncate">
                Subject: &quot;Funds Added · ₹500&quot;
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Pending Dispatch Queue */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Inbox size={14} className="text-[#ffd83a]" />
            <span className="text-[10px] font-display tracking-[0.16em] text-white/50">
              PENDING NOTIFICATION QUEUE ({queue.length})
            </span>
          </div>
          {queue.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDispatchAll()}
                className="h-6 px-2.5 rounded-lg font-display text-[9.5px] bg-[#26ff9a] text-black font-bold tracking-wide hover:brightness-110 active:scale-95 transition"
              >
                DISPATCH ALL ({queue.length})
              </button>
              <button
                type="button"
                onClick={handleClearAllQueue}
                className="text-[10px] text-white/40 hover:text-white underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-4 text-xs text-white/40 flex flex-col items-center gap-1.5">
            <CheckCircle2 size={20} className="text-[#26ff9a]/60" />
            <span>No pending notifications. All events dispatched.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-black/40 border border-white/10 p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-display text-xs text-white truncate font-medium">
                    {item.subject}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">
                    To: {item.recipient} · {new Date(item.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDispatchQueuedItem(item)}
                  className="h-7 px-2.5 rounded-lg font-display text-[10px] bg-[#ffd83a] text-black font-semibold shrink-0 hover:brightness-110 active:scale-95 transition"
                >
                  DISPATCH
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Dispatched History Log */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#26ff9a]" />
            <span className="text-[10px] font-display tracking-[0.16em] text-white/50">
              DISPATCHED EMAIL LOG ({logs.length})
            </span>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-4 text-xs text-white/40">
            No emails dispatched in this browser session yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="rounded-xl bg-black/30 border border-white/5 p-2 flex items-center justify-between text-xs"
              >
                <div className="min-w-0">
                  <div className="font-display text-[11px] text-white/90 truncate font-medium">
                    {log.subject}
                  </div>
                  <div className="text-[10px] text-white/40 truncate">
                    To: {log.to} · {new Date(log.sentAt).toLocaleTimeString()}
                  </div>
                </div>
                <span className="text-[9.5px] font-mono text-[#26ff9a] shrink-0 bg-[#26ff9a]/10 px-1.5 py-0.5 rounded">
                  SENT
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <GmailConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        subject={confirmDialog.subject}
        recipient={confirmDialog.recipient}
        description={confirmDialog.description}
        previewDetails={confirmDialog.details}
      />
    </div>
  );
}
