import { useState } from "react";
import { Mail, Send, X, ShieldCheck, Loader2 } from "lucide-react";
import { ADMIN_NOTIFICATION_EMAIL } from "@/lib/gmail";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  subject: string;
  recipient?: string;
  description: string;
  previewDetails?: { label: string; value: string }[];
}

export function GmailConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  subject,
  recipient = ADMIN_NOTIFICATION_EMAIL,
  description,
  previewDetails = [],
}: Props) {
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleProceed = async () => {
    try {
      setBusy(true);
      await onConfirm();
      onClose();
    } catch {
      // error handled in caller
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-sm glass rounded-3xl p-5 border border-white/15 relative text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cancel email dispatch"
          className="absolute right-4 top-4 w-8 h-8 rounded-full grid place-items-center bg-white/10 text-white/70 hover:text-white transition"
        >
          <X size={15} />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-[#ea4335]/15 border border-[#ea4335]/30 grid place-items-center text-[#ea4335]">
            <Mail size={19} />
          </div>
          <div>
            <div className="text-[10px] font-display tracking-[0.16em] text-[#ea4335]">
              GOOGLE WORKSPACE · GMAIL
            </div>
            <h3 className="font-display text-sm text-white font-bold tracking-wide">{title}</h3>
          </div>
        </div>

        <p className="text-xs text-white/70 leading-relaxed mb-3.5">{description}</p>

        <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 space-y-2 mb-4 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="text-white/45 text-[11px] font-medium">To:</span>
            <span className="text-white font-mono text-[11px] font-semibold truncate text-right">
              {recipient}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 border-t border-white/5 pt-2">
            <span className="text-white/45 text-[11px] font-medium">Subject:</span>
            <span className="text-[#ffd83a] font-semibold text-[11px] truncate text-right">
              {subject}
            </span>
          </div>
          {previewDetails.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 border-t border-white/5 pt-1.5"
            >
              <span className="text-white/45 text-[11px]">{item.label}:</span>
              <span className="text-white/80 font-medium text-[11px] text-right">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-white/50 mb-4 px-1">
          <ShieldCheck size={13} className="text-[#26ff9a] shrink-0" />
          <span>Requires your confirmation before sending through the Gmail API.</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-display tracking-wider transition"
          >
            DISCARD
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={busy}
            className="h-11 rounded-xl font-display text-xs tracking-wider font-bold transition flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(180deg, #ea4335, #c5221f)",
              color: "#ffffff",
              boxShadow: "0 8px 24px -6px rgba(234, 67, 53, 0.6)",
            }}
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <Send size={14} />
                <span>CONFIRM & SEND</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
