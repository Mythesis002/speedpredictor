import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Banknote, Home, Settings } from "lucide-react";

interface Props {
  active: "home" | "history" | "profile";
  onCashOut: () => void;
}

export function BottomNav({ active, onCashOut }: Props) {
  const nav = useNavigate();

  const items: {
    id: "home" | "history" | "cashout" | "profile";
    icon: typeof Home;
    label: string;
    href?: "/" | "/history" | "/profile";
    action?: () => void;
  }[] = [
    { id: "home", icon: Home, label: "Home", href: "/" },
    { id: "history", icon: BarChart3, label: "History", href: "/history" },
    { id: "cashout", icon: Banknote, label: "Cash out", action: onCashOut },
    { id: "profile", icon: Settings, label: "Profile", href: "/profile" },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="sticky bottom-0 mt-auto z-40 bg-gradient-to-t from-[#04060c] via-[#04060c] to-transparent pt-3 px-2 w-full"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="glass rounded-2xl grid grid-cols-4 py-1.5">
        {items.map(({ id, icon: Icon, label, href, action }) => {
          const isActive = id === active;
          return (
            <button
              key={label}
              type="button"
              onClick={href ? () => void nav({ to: href }) : action}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl min-h-[44px] transition-colors ${
                isActive ? "text-[#a24bff]" : "text-white/45 hover:text-white/75"
              }`}
              style={isActive ? { background: "rgba(162,75,255,0.12)" } : undefined}
            >
              <Icon size={16} />
              <span className="text-[9px] font-display tracking-wide whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
