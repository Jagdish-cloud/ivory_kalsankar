import { useState } from "react";
import clsx from "clsx";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { extractErrorMessage } from "@/lib/apiClient";

export interface ColourOption {
  id: string;
  name: string;
  hex?: string | null;
}

interface ColourPickerProps {
  label: string;
  hint?: string;
  required?: boolean;
  /** Only one colour can be selected at a time. */
  single?: boolean;
  options: ColourOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (payload: { name: string; hex: string }) => Promise<ColourOption | void>;
  onRename?: (id: string, payload: { name: string; hex: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const DEFAULT_HEX = "#ee3f81";

export function ColourPicker({
  label,
  hint,
  required,
  single,
  options,
  selectedIds,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: ColourPickerProps) {
  const [mode, setMode] = useState<"idle" | "adding" | "editing" | "deleting">("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [hex, setHex] = useState(DEFAULT_HEX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange(single ? [id] : [...selectedIds, id]);
    }
  }

  function startAdd() {
    setMode("adding");
    setActiveId(null);
    setName("");
    setHex(DEFAULT_HEX);
    setError(null);
  }

  function startEdit(option: ColourOption) {
    setMode("editing");
    setActiveId(option.id);
    setName(option.name);
    setHex(option.hex || DEFAULT_HEX);
    setError(null);
  }

  function cancel() {
    setMode("idle");
    setActiveId(null);
    setError(null);
  }

  async function submitAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate({ name: trimmed, hex });
      if (created) onChange(single ? [created.id] : [...selectedIds, created.id]);
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to add this colour"));
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    const trimmed = name.trim();
    if (!trimmed || !activeId || !onRename) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onRename(activeId, { name: trimmed, hex });
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to update this colour"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!activeId || !onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(activeId);
      onChange(selectedIds.filter((id) => id !== activeId));
      cancel();
    } catch (err) {
      setError(extractErrorMessage(err, "Unable to delete this colour - it may still be in use"));
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink-700">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {hint && <p className="mb-2 text-[11px] text-ink-500">{hint}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const active = selectedIds.includes(option.id);
          const isEditingThis = mode === "editing" && activeId === option.id;
          const isDeletingThis = mode === "deleting" && activeId === option.id;

          if (isEditingThis) {
            return (
              <SwatchEditForm
                key={option.id}
                name={name}
                hex={hex}
                onNameChange={setName}
                onHexChange={setHex}
                onSubmit={submitEdit}
                onCancel={cancel}
                busy={busy}
              />
            );
          }

          if (isDeletingThis) {
            return (
              <div
                key={option.id}
                className="flex flex-col gap-1.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
              >
                <span>Delete "{option.name}"?</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={busy}
                    className="flex-1 rounded-md bg-red-500 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "..." : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="flex-1 rounded-md border border-red-200 py-1 text-[11px] font-medium text-red-700 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={option.id}
              className={clsx(
                "group relative flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-medium transition-colors",
                active ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-ink-700 hover:border-brand-300"
              )}
            >
              <button type="button" onClick={() => toggle(option.id)} className="flex flex-1 items-center gap-2 text-left">
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: option.hex || "#e5e7eb" }}
                />
                <span className="truncate">{option.name}</span>
                {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
              </button>
              {(onRename || onDelete) && (
                <span
                  className={clsx(
                    "absolute right-1.5 top-1.5 hidden gap-1 rounded-md bg-white/90 p-0.5 group-hover:flex",
                    active && "flex"
                  )}
                >
                  {onRename && (
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => startEdit(option)}
                      className="rounded p-1 text-ink-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => {
                        setMode("deleting");
                        setActiveId(option.id);
                      }}
                      className="rounded p-1 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}

        {mode === "adding" ? (
          <SwatchEditForm
            name={name}
            hex={hex}
            onNameChange={setName}
            onHexChange={setHex}
            onSubmit={submitAdd}
            onCancel={cancel}
            busy={busy}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-200 px-2.5 py-2 text-sm font-medium text-brand-500 hover:border-brand-400 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" /> Add Colour
          </button>
        )}
      </div>
      {error && <span className="mt-1.5 block text-[11px] font-medium text-red-600">{error}</span>}
    </div>
  );
}

function SwatchEditForm({
  name,
  hex,
  onNameChange,
  onHexChange,
  onSubmit,
  onCancel,
  busy,
  autoFocus,
}: {
  name: string;
  hex: string;
  onNameChange: (v: string) => void;
  onHexChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-brand-300 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={hex}
          onChange={(e) => onHexChange(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-brand-100"
        />
        <input
          autoFocus={autoFocus}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Colour name"
          className="w-full min-w-0 flex-1 rounded-md border border-brand-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <input
        value={hex}
        onChange={(e) => onHexChange(e.target.value)}
        placeholder="#RRGGBB"
        className="w-full rounded-md border border-brand-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-brand-500 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Check className="h-3 w-3" /> {busy ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-brand-200 py-1 text-xs font-medium text-ink-500 hover:bg-brand-50"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>
    </div>
  );
}
