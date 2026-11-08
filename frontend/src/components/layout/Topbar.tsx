import { useState } from "react";
import { Calendar, ChevronDown, LogOut, Store } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useStoreOptions } from "@/features/stores/api";
import { CHAIN_LABELS } from "@/lib/branding";
import { roleLabels } from "@/types/auth";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { user, logout, isSuperAdmin, switchStore } = useAuth();
  const { data: stores = [] } = useStoreOptions();
  const [menuOpen, setMenuOpen] = useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  });

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <header className="flex items-center justify-between border-b border-brand-100 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-ink-700 md:flex">
          <Calendar className="h-4 w-4 text-brand-500" />
          {today}
        </div>

        {isSuperAdmin && stores.length > 0 ? (
          <label className="hidden items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-1.5 text-sm font-medium text-ink-700 md:flex">
            <Store className="h-4 w-4 text-brand-500" />
            <span className="text-xs text-ink-500">Working in</span>
            <select
              value={user?.store.id}
              onChange={(e) => switchStore(e.target.value)}
              className="bg-transparent text-sm font-semibold text-ink-900 focus:outline-none"
              aria-label="Active store"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {CHAIN_LABELS[s.chain]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="hidden items-center gap-2 rounded-lg border border-brand-100 px-3 py-2 text-sm font-medium text-ink-700 md:flex">
            <Store className="h-4 w-4 text-brand-500" />
            {user?.store.name ?? "Store"}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
              {initials}
            </span>
            <span className="hidden text-left text-sm leading-tight md:block">
              <span className="block font-semibold text-ink-900">{user?.name}</span>
              <span className="block text-xs text-ink-500">{user ? roleLabels[user.role] : ""}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-ink-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-brand-100 bg-white p-1.5 shadow-lg">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-brand-50"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
