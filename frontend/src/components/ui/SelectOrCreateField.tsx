import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { FieldWrapper } from "@/components/ui/Field";
import { extractErrorMessage } from "@/lib/apiClient";

const baseFieldClasses =
  "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-100/40";

export interface SelectOrCreateOption {
  id: string;
  label: string;
}

interface SelectOrCreateFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  addLabel?: string;
  options: SelectOrCreateOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<SelectOrCreateOption | void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function SelectOrCreateField({
  label,
  hint,
  required,
  placeholder = "Select",
  disabled,
  addLabel = "Add new",
  options,
  value,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: SelectOrCreateFieldProps) {
  const [mode, setMode] = useState<"idle" | "adding" | "renaming" | "deleting">("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((o) => o.id === value);

  function startAdd() {
    setMode("adding");
    setText("");
    setError(null);
  }

  function startRename() {
    if (!selected) return;
    setMode("renaming");
    setText(selected.label);
    setError(null);
  }

  function cancel() {
    setMode("idle");
    setText("");
    setError(null);
  }

  async function submitCreate() {
    const trimmed = text.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      if (created) onChange(created.id);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to add this value"));
    } finally {
      setBusy(false);
    }
  }

  async function submitRename() {
    const trimmed = text.trim();
    if (!trimmed || !selected || !onRename) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(selected.id, trimmed);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to rename this value"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!selected || !onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(selected.id);
      onChange("");
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to delete this value - it may still be in use"));
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldWrapper label={label} hint={hint} required={required}>
      {mode === "adding" ? (
        <InlineTextRow
          value={text}
          onChange={setText}
          onSubmit={submitCreate}
          onCancel={cancel}
          busy={busy}
          placeholder={`New ${label.toLowerCase()}`}
        />
      ) : mode === "renaming" ? (
        <InlineTextRow value={text} onChange={setText} onSubmit={submitRename} onCancel={cancel} busy={busy} />
      ) : mode === "deleting" ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex-1">Delete "{selected?.label}"?</span>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="rounded-md bg-red-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? "..." : "Delete"}
          </button>
          <button type="button" onClick={cancel} className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-white">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            className={clsx(baseFieldClasses, "appearance-none bg-no-repeat")}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {selected && onRename && (
            <button
              type="button"
              title={`Rename ${selected.label}`}
              onClick={startRename}
              className="shrink-0 rounded-lg border border-brand-100 p-2 text-ink-500 hover:border-brand-300 hover:text-brand-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {selected && onDelete && (
            <button
              type="button"
              title={`Delete ${selected.label}`}
              onClick={() => setMode("deleting")}
              className="shrink-0 rounded-lg border border-brand-100 p-2 text-ink-500 hover:border-red-300 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            title={addLabel}
            onClick={startAdd}
            className="shrink-0 rounded-lg border border-dashed border-brand-300 p-2 text-brand-600 hover:bg-brand-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span>}
    </FieldWrapper>
  );
}

function InlineTextRow({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className={clsx(baseFieldClasses)}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="shrink-0 rounded-lg bg-brand-500 p-2 text-white disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-lg border border-brand-100 p-2 text-ink-500 hover:bg-brand-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
