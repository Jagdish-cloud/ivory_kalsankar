import { ReactNode } from "react";
import clsx from "clsx";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "brand";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-600",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  if (status === "Out of Stock") return "danger";
  if (status === "Low Stock") return "warning";
  return "success";
}
