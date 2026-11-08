import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CheckCircle2, Layers, Minus, Plus, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { fetchProductVariants, useLabelVariantSearch, useLabelVariantsByIds } from "@/features/labels/api";
import { Label } from "@/features/labels/Label";
import {
  defaultFields,
  labelPresets,
  type LabelFields,
  type LabelPreset,
  type LabelVariant,
  type QueueItem,
} from "@/features/labels/presets";
import { useStoreOptions } from "@/features/stores/api";
import { THEME_META } from "@/lib/branding";
import { storeBarcode } from "@/lib/barcode";
import { useDebounced } from "@/lib/useDebounced";

const SETTINGS_KEY = "ivory-lace-label-settings";

interface Saved {
  presetId: string;
  fields: LabelFields;
  textScale: number;
  custom: Pick<LabelPreset, "labelW" | "labelH" | "cols" | "gapX" | "gapY">;
}

function loadSaved(): Saved {
  const fallback: Saved = { presetId: "roll-50x25", fields: defaultFields, textScale: 1, custom: { labelW: 50, labelH: 30, cols: 1, gapX: 0, gapY: 0 } };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Saved>), fields: { ...defaultFields, ...(JSON.parse(raw) as Saved).fields } } : fallback;
  } catch {
    return fallback;
  }
}

function fieldLabelsFor(isSaree: boolean): { key: keyof LabelFields; label: string }[] {
  return [
    { key: "brand", label: "Store name" },
    { key: "style", label: "Style name" },
    { key: "variant", label: "Size / cup / colour" },
    { key: "sku", label: "SKU code" },
    { key: "mrp", label: isSaree ? "Selling Price" : "MRP" },
    { key: "barcodeText", label: "Number under bars" },
    { key: "border", label: "Cut guide border" },
  ];
}

export function BarcodeLabelsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromNewSku = params.get("from") === "new-sku";
  const fromPriceChange = params.get("from") === "price-change";
  const [autoPrinted, setAutoPrinted] = useState(false);
  const { user } = useAuth();
  const { data: stores } = useStoreOptions();
  const saved = useMemo(loadSaved, []);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [storeId, setStoreId] = useState(user?.store.id ?? "");
  const [presetId, setPresetId] = useState(saved.presetId);
  const [fields, setFields] = useState<LabelFields>(saved.fields);
  const [textScale, setTextScale] = useState(saved.textScale);
  const [custom, setCustom] = useState(saved.custom);
  const [search, setSearch] = useState("");
  const [skipBlank, setSkipBlank] = useState(0);
  const [confirmPrint, setConfirmPrint] = useState(false);

  const debounced = useDebounced(search, 250);
  const { data: results, isFetching } = useLabelVariantSearch(debounced);

  // Variants handed over from the "Print barcode stickers" button (?ids=a,b,c).
  const initialIds = useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean), [params]);
  const { data: initial } = useLabelVariantsByIds(initialIds);
  useEffect(() => {
    if (!initial) return;
    setQueue((q) => {
      const have = new Set(q.map((i) => i.variantId));
      return [...q, ...initial.filter((v) => !have.has(v.variantId)).map((v) => ({ ...v, copies: 1 }))];
    });
  }, [initial]);

  useEffect(() => {
    if (!storeId && user?.store.id) setStoreId(user.store.id);
  }, [storeId, user?.store.id]);

  useEffect(() => {
    if (!fromNewSku && !fromPriceChange) return;
    const onAfter = () => setConfirmPrint(true);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, [fromNewSku, fromPriceChange]);

  useEffect(() => {
    if (!fromPriceChange || autoPrinted || queue.length === 0) return;
    const timer = window.setTimeout(() => {
      setAutoPrinted(true);
      window.print();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [fromPriceChange, autoPrinted, queue.length]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ presetId, fields, textScale, custom } satisfies Saved));
    } catch {
      /* ignore */
    }
  }, [presetId, fields, textScale, custom]);

  const base = labelPresets.find((p) => p.id === presetId) ?? labelPresets[0];
  const preset: LabelPreset = presetId === "custom" ? { ...base, ...custom, rows: 0 } : base;
  const store = stores?.find((s) => s.id === storeId);

  // The barcode prefix must name the store that actually holds the stock: the chosen store when it has
  // stock of the SKU, otherwise the store with the most stock. Otherwise billing at another branch would
  // look for stock in a store that has none.
  function ownerIdFor(item: LabelVariant): string {
    if ((item.stockByStore[storeId] ?? 0) > 0) return storeId;
    const best = Object.entries(item.stockByStore).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : storeId;
  }
  const ownerOf = (item: LabelVariant) => {
    const id = ownerIdFor(item);
    return stores?.find((s) => s.id === id) ?? store;
  };

  function addVariants(items: LabelVariant[]) {
    setQueue((q) => {
      const have = new Set(q.map((i) => i.variantId));
      return [...q, ...items.filter((v) => !have.has(v.variantId)).map((v) => ({ ...v, copies: 1 }))];
    });
  }

  async function addWholeProduct(productId: string) {
    addVariants(await fetchProductVariants(productId));
  }

  function setCopies(variantId: string, copies: number) {
    setQueue((q) => q.map((i) => (i.variantId === variantId ? { ...i, copies: Math.max(1, Math.min(500, Math.floor(copies) || 1)) } : i)));
  }

  // ---- Expand the queue into individual stickers, then into printable pages ----
  const stickers = useMemo(
    () => queue.flatMap((item) => Array.from({ length: item.copies }, () => item)),
    [queue]
  );
  const slots = useMemo(() => [...Array.from({ length: skipBlank }, () => null as QueueItem | null), ...stickers], [stickers, skipBlank]);

  const perSheet = preset.sheet ? preset.cols * preset.rows : preset.cols;
  const pages = useMemo(() => {
    const out: (QueueItem | null)[][] = [];
    for (let i = 0; i < slots.length; i += perSheet) out.push(slots.slice(i, i + perSheet));
    return out;
  }, [slots, perSheet]);

  const pageW = preset.sheet ? preset.sheet.w : preset.cols * preset.labelW + (preset.cols - 1) * preset.gapX;
  const pageH = preset.sheet ? preset.sheet.h : preset.labelH;
  const PREVIEW_PAGES = preset.sheet ? 2 : 6;

  const customInput = (key: keyof Saved["custom"], label: string, step = 1) => (
    <label className="text-[11px] text-ink-500">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        value={custom[key]}
        onChange={(e) => setCustom((c) => ({ ...c, [key]: Math.max(0, Number(e.target.value) || 0) }))}
        className="mt-0.5 w-full rounded-md border border-brand-200 px-2 py-1 text-sm text-ink-900"
      />
    </label>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* Dynamic page size for the printer driver */}
      <style>{`@media print { @page { size: ${pageW}mm ${pageH}mm; margin: 0; } }`}</style>

      <div className="space-y-4 print:hidden">
        {fromNewSku && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">SKU saved — print the stickers</p>
                <p className="text-xs text-emerald-700">The new SKU is already in the queue. Print, then confirm the labels came out correctly.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/inventory/stock-overview")}
              className="shrink-0 text-xs font-semibold text-ink-500 hover:text-ink-900"
            >
              Skip for now
            </button>
          </div>
        )}
        {fromPriceChange && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Selling price updated — print new stickers</p>
                <p className="text-xs text-amber-800">The Unique Saree ID is unchanged. Print labels with the new selling price.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/inventory/stock-overview")}
              className="shrink-0 text-xs font-semibold text-ink-500 hover:text-ink-900"
            >
              Skip for now
            </button>
          </div>
        )}
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold text-ink-900">1. Choose SKUs</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search style / SKU / barcode"
              className="w-full rounded-lg border border-brand-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {debounced.trim().length >= 2 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-brand-100">
              {isFetching && !results && <div className="px-3 py-2 text-xs text-ink-500">Searching...</div>}
              {results?.length === 0 && <div className="px-3 py-2 text-xs text-ink-500">No SKUs found</div>}
              {results?.map((v) => (
                <div key={v.variantId} className="flex items-center justify-between gap-2 border-b border-brand-50 px-3 py-1.5 last:border-0">
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-semibold text-ink-900">{v.styleName}</div>
                    <div className="truncate text-ink-500">
                      {v.skuCode} {[v.size, v.cup, v.colour].filter(Boolean).length > 0 && `• ${[v.size, v.cup, v.colour].filter(Boolean).join(" / ")}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => addWholeProduct(v.productId)}
                      title="Add every size/colour of this style"
                      className="rounded-md border border-brand-200 p-1 text-ink-500 hover:text-brand-600"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => addVariants([v])}
                      title="Add this SKU"
                      className="rounded-md bg-brand-500 p-1 text-white hover:bg-brand-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
            <span>
              {queue.length} SKU(s) · {stickers.length} sticker(s)
            </span>
            {queue.length > 0 && (
              <button onClick={() => setQueue([])} className="font-semibold text-ink-500 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
            {queue.map((item) => (
              <li key={item.variantId} className="flex items-center gap-2 rounded-lg bg-brand-50/50 px-2.5 py-1.5">
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate font-semibold text-ink-900">{item.styleName}</div>
                  <div className="truncate text-ink-500">
                    {item.skuCode} · {ownerOf(item)?.code ?? ""} stock {item.stockByStore[ownerIdFor(item)] ?? 0}
                  </div>
                </div>
                <div className="flex items-center rounded-md border border-brand-200 bg-white">
                  <button onClick={() => setCopies(item.variantId, item.copies - 1)} className="px-1.5 py-1 text-ink-500 hover:text-brand-600" aria-label="Fewer copies">
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    value={item.copies}
                    onChange={(e) => setCopies(item.variantId, Number(e.target.value))}
                    inputMode="numeric"
                    aria-label="Copies"
                    className="w-9 border-x border-brand-100 py-0.5 text-center text-xs font-semibold focus:outline-none"
                  />
                  <button onClick={() => setCopies(item.variantId, item.copies + 1)} className="px-1.5 py-1 text-ink-500 hover:text-brand-600" aria-label="More copies">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => setQueue((q) => q.filter((i) => i.variantId !== item.variantId))} aria-label="Remove" className="text-ink-300 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {queue.length > 0 && (
            <button
              onClick={() => setQueue((q) => q.map((i) => ({ ...i, copies: Math.max(1, Math.min(500, i.stockByStore[ownerIdFor(i)] ?? 1)) })))}
              className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
            >
              Set every copy count to the stock held
            </button>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-bold text-ink-900">2. Sticker layout</h3>
          <label className="block text-xs font-semibold text-ink-700">
            Barcode belongs to store
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-normal focus:border-brand-400 focus:outline-none"
            >
              {stores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-[11px] text-ink-500">
            Printed as <code>{store?.code ?? ""}-…</code> for SKUs this store holds. Scanning another store&apos;s sticker at this counter transfers one piece here, then sells it on this store&apos;s bill.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {labelPresets.map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={clsx(
                  "rounded-lg border px-2.5 py-2 text-left text-xs",
                  presetId === p.id ? "border-brand-500 bg-brand-50" : "border-brand-100 hover:border-brand-300"
                )}
              >
                <div className="font-semibold text-ink-900">{p.name}</div>
                <div className="text-[11px] text-ink-500">{p.hint}</div>
              </button>
            ))}
          </div>

          {presetId === "custom" && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {customInput("labelW", "Width mm", 0.5)}
              {customInput("labelH", "Height mm", 0.5)}
              {customInput("cols", "Across")}
              {customInput("gapX", "Gap mm", 0.5)}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {fieldLabelsFor(user?.store.chain === "KALSANKAR_OS").map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs text-ink-700">
                <input type="checkbox" checked={fields[f.key]} onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.checked }))} />
                {f.label}
              </label>
            ))}
          </div>

          <label className="mt-3 block text-xs font-semibold text-ink-700">
            Text size ({Math.round(textScale * 100)}%)
            <input type="range" min={0.6} max={1.6} step={0.05} value={textScale} onChange={(e) => setTextScale(Number(e.target.value))} className="mt-1 w-full" />
          </label>

          {preset.sheet && (
            <label className="mt-3 block text-xs font-semibold text-ink-700">
              Skip used labels on the first sheet
              <input
                type="number"
                min={0}
                max={perSheet - 1}
                value={skipBlank}
                onChange={(e) => setSkipBlank(Math.max(0, Math.min(perSheet - 1, Number(e.target.value) || 0)))}
                className="mt-1 w-24 rounded-lg border border-brand-200 px-2 py-1 text-sm font-normal"
              />
            </label>
          )}
        </Card>

        <Button className="w-full py-3" disabled={stickers.length === 0} onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print {stickers.length} sticker{stickers.length === 1 ? "" : "s"}
        </Button>
        <p className="text-[11px] text-ink-500">
          In the print dialog choose your sticker printer, set margins to <b>None</b> and scale to <b>100%</b>.
        </p>
      </div>

      {/* ------------------------------ Live preview / print area ------------------------------ */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-ink-500 print:hidden">
          <span>
            Live preview · {preset.labelW} × {preset.labelH} mm · {pages.length} {preset.sheet ? "sheet" : "row"}(s)
          </span>
          {pages.length > PREVIEW_PAGES && <span>showing the first {PREVIEW_PAGES}, all {pages.length} will print</span>}
        </div>

        {pages.length === 0 ? (
          <Card className="flex flex-col items-center py-20 text-center print:hidden">
            <Printer className="h-10 w-10 text-brand-300" />
            <p className="mt-3 text-sm font-medium text-ink-700">Add SKUs to design your stickers</p>
            <p className="text-xs text-ink-500">Each SKU can be printed any number of times.</p>
          </Card>
        ) : (
          <div className="print-area">
            <div className="flex flex-wrap gap-4 print:block">
              {pages.map((page, pi) => (
                <div
                  key={pi}
                  className={clsx("label-sheet bg-white shadow-sm ring-1 ring-brand-100 print:shadow-none print:ring-0", pi >= PREVIEW_PAGES && "hidden print:block")}
                  style={{
                    width: `${pageW}mm`,
                    height: `${pageH}mm`,
                    padding: preset.sheet ? `${preset.marginY}mm ${preset.marginX}mm` : 0,
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${preset.cols}, ${preset.labelW}mm)`,
                      gridAutoRows: `${preset.labelH}mm`,
                      columnGap: `${preset.gapX}mm`,
                      rowGap: `${preset.gapY}mm`,
                    }}
                  >
                    {page.map((item, i) =>
                      item ? (
                        <Label
                          key={i}
                          item={item}
                          barcode={storeBarcode(ownerOf(item)?.code ?? user?.store.code ?? "", item.barcodeValue)}
                          preset={preset}
                          fields={fields}
                          textScale={textScale}
                          sellingPrice={user?.store.chain === "KALSANKAR_OS"}
                          firm={
                            ownerOf(item)?.firmName ??
                            ownerOf(item)?.name ??
                            (user?.store.chain === "KALSANKAR_OS" ? THEME_META.kalsankar.wordmark : THEME_META.ivory.wordmark)
                          }
                        />
                      ) : (
                        <div key={i} style={{ width: `${preset.labelW}mm`, height: `${preset.labelH}mm` }} />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmPrint}
        onClose={() => setConfirmPrint(false)}
        size="sm"
        title="Did the labels print correctly?"
        description="If they did not, stay here and print again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPrint(false)}>
              No — print again
            </Button>
            <Button onClick={() => navigate("/inventory/stock-overview")}>Yes — go to Stock Overview</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">Check the sticker printer before you leave this page.</p>
      </Modal>
    </div>
  );
}
