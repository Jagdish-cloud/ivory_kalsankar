import { useState } from "react";
import clsx from "clsx";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { extractErrorMessage } from "@/lib/apiClient";

export interface ChipOption {
  id: string;
  label: string;
  swatch?: string;
}

interface ChipMultiSelectProps {
  label: string;
  hint?: string;
  options: ChipOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (label: string) => Promise<ChipOption | void>;
  onRename?: (id: string, label: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  addLabel?: string;
  required?: boolean;
  /** Only one option can be selected at a time (clicking the selected chip clears it). */
  single?: boolean;
}

export function ChipMultiSelect({
  label,
  hint,
  options,
  selectedIds,
  onChange,
  onCreate,
  onRename,
  onDelete,
  addLabel = "Add",
  required,
  single,
}: ChipMultiSelectProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange(single ? [id] : [...selectedIds, id]);
    }
  }

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setDeletingId(null);
    setNewValue("");
    setError(null);
  }

  function startEdit(option: ChipOption) {
    setEditingId(option.id);
    setIsAdding(false);
    setDeletingId(null);
    setNewValue(option.label);
    setError(null);
  }

  function cancel() {
    setIsAdding(false);
    setEditingId(null);
    setDeletingId(null);
    setNewValue("");
    setError(null);
  }

  async function handleCreate() {
    const trimmed = newValue.trim();
    if (!trimmed || !onCreate) {
      cancel();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await onCreate(trimmed);
      if (created) {
        onChange(single ? [created.id] : [...selectedIds, created.id]);
      }
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to add this value"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRename() {
    const trimmed = newValue.trim();
    if (!trimmed || !editingId || !onRename) {
      cancel();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onRename(editingId, trimmed);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to rename this value"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    setIsSaving(true);
    setError(null);
    try {
      await onDelete(id);
      onChange(selectedIds.filter((existing) => existing !== id));
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to delete this value - it may still be in use"));
      setDeletingId(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink-700">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {hint && <p className="mb-2 text-[11px] text-ink-500">{hint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const active = selectedIds.includes(option.id);

          if (editingId === option.id) {
            return (
              <InlineChipForm
                key={option.id}
                value={newValue}
                onChange={setNewValue}
                onSubmit={handleRename}
                onCancel={cancel}
                busy={isSaving}
              />
            );
          }

          if (deletingId === option.id) {
            return (
              <div key={option.id} className="flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                Delete "{option.label}"?
                <button
                  type="button"
                  onClick={() => handleDelete(option.id)}
                  disabled={isSaving}
                  className="rounded-full bg-red-500 px-2 py-0.5 font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? "..." : "Yes"}
                </button>
                <button type="button" onClick={cancel} className="rounded-full px-2 py-0.5 font-medium text-red-700 hover:bg-white">
                  No
                </button>
              </div>
            );
          }

          return (
            <span
              key={option.id}
              className={clsx(
                "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-brand-200 bg-white text-ink-700 hover:border-brand-300"
              )}
            >
              <button type="button" onClick={() => toggle(option.id)} className="flex items-center gap-1.5">
                {option.swatch && (
                  <span
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ backgroundColor: option.swatch }}
                  />
                )}
                {option.label}
                {active && <X className="h-3 w-3" />}
              </button>
              {onRename && (
                <button type="button" title="Rename" onClick={() => startEdit(option)} className="opacity-0 group-hover:opacity-100">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {onDelete && (
                <button type="button" title="Delete" onClick={() => setDeletingId(option.id)} className="opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {isAdding ? (
          <InlineChipForm value={newValue} onChange={setNewValue} onSubmit={handleCreate} onCancel={cancel} busy={isSaving} placeholder="New value" />
        ) : (
          onCreate && (
            <button
              type="button"
              onClick={startAdd}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
          )
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

function InlineChipForm({
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
    <div className="flex items-center gap-1">
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
        className="w-28 rounded-full border border-brand-300 px-3 py-1.5 text-sm focus:outline-none"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="rounded-full bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? "..." : <Check className="h-3 w-3" />}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full border border-brand-200 px-2 py-1.5 text-ink-500 hover:bg-brand-50">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
