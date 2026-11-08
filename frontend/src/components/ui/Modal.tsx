import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Prevent closing via backdrop click / Escape (e.g. while saving). */
  locked?: boolean;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({ open, title, description, onClose, children, footer, size = "md", locked }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, locked, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:block print:p-0">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[1px] print:hidden"
        onClick={() => !locked && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "relative flex max-h-[92vh] w-full flex-col rounded-2xl bg-white shadow-xl print:max-h-none print:shadow-none",
          sizeClasses[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-6 py-4 print:hidden">
          <div>
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={locked}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 print:overflow-visible print:p-0">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-brand-100 px-6 py-4 print:hidden">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
