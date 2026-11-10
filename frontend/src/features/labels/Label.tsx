import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { formatMoney } from "@/lib/format";
import type { LabelFields, LabelPreset, QueueItem } from "@/features/labels/presets";

/** Crisp, resolution-independent CODE128 (SVG scales to any sticker size without blurring when printed). */
export function BarcodeSvg({ value, showText, textMm }: { value: string; showText: boolean; textMm: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, { format: "CODE128", displayValue: showText, margin: 0, height: 60, width: 2, fontSize: 14, textMargin: 2 });
      const w = parseFloat(svg.getAttribute("width") ?? "0");
      const h = parseFloat(svg.getAttribute("height") ?? "0");
      if (w && h) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    } catch {
      svg.innerHTML = "";
    }
  }, [value, showText, textMm]);

  return <svg ref={ref} className="h-full w-full" />;
}

interface LabelProps {
  item: QueueItem;
  barcode: string;
  preset: LabelPreset;
  fields: LabelFields;
  /** 0.6 - 1.6 multiplier on the automatic text size. */
  textScale: number;
  firm: string;
  /** When true, print selling price instead of MRP (Kalsankar OS). */
  sellingPrice?: boolean;
}

export function Label({ item, barcode, preset, fields, textScale, firm, sellingPrice }: LabelProps) {
  const baseMm = Math.min(preset.labelH * 0.14, 3.4) * textScale;
  const variant = [item.size, item.cup, item.colour].filter(Boolean).join(" / ");
  const small = { fontSize: `${baseMm * 0.85}mm`, lineHeight: 1.15 } as const;
  const priceMm = baseMm * 1.5;
  const isSaree = Boolean(sellingPrice || item.sareeCategory || item.supplierCode);
  const useSellingPrice = Boolean(sellingPrice || isSaree);
  const priceLabel = useSellingPrice
    ? formatMoney(item.finalPrice).replace(".00", "")
    : `MRP ${formatMoney(item.mrp).replace(".00", "")}`;

  return (
    <div
      className="flex flex-col overflow-hidden bg-white text-black"
      style={{
        width: `${preset.labelW}mm`,
        height: `${preset.labelH}mm`,
        padding: `${Math.max(0.8, preset.labelH * 0.04)}mm ${Math.max(1, preset.labelW * 0.03)}mm`,
        boxSizing: "border-box",
        border: fields.border ? "0.2mm dashed #999" : "none",
      }}
    >
      {fields.brand && (
        <div className="truncate text-center font-bold uppercase tracking-wide" style={{ fontSize: `${baseMm * 0.8}mm`, lineHeight: 1.1 }}>
          {firm}
        </div>
      )}

      {/* Ivory Lace keeps style/variant above the rate; Kalsankar moves style below the bars. */}
      {!isSaree && fields.style && (
        <div className="truncate text-center font-semibold" style={{ fontSize: `${baseMm}mm`, lineHeight: 1.15 }}>
          {item.styleName}
        </div>
      )}
      {!isSaree && fields.variant && variant && (
        <div className="truncate text-center" style={small}>
          {variant}
        </div>
      )}

      {fields.mrp && (
        <div className="truncate text-center font-bold" style={{ fontSize: `${priceMm}mm`, lineHeight: 1.1 }}>
          {priceLabel}
        </div>
      )}

      <div className="min-h-0 flex-1 py-[0.4mm]">
        <BarcodeSvg value={barcode} showText={fields.barcodeText} textMm={baseMm} />
      </div>

      {isSaree && fields.category && item.sareeCategory && (
        <div className="truncate text-center font-semibold" style={{ fontSize: `${baseMm}mm`, lineHeight: 1.15 }}>
          {item.sareeCategory}
        </div>
      )}
      {isSaree && fields.style && (
        <div className="truncate text-center" style={small}>
          {item.styleName}
        </div>
      )}

      {(fields.sku || (isSaree && fields.supplierCode && item.supplierCode)) && (
        <div className="flex items-end justify-between gap-1" style={small}>
          {fields.sku ? <span className="truncate">{item.skuCode}</span> : <span />}
          {isSaree && fields.supplierCode && item.supplierCode ? (
            <span className="shrink-0 font-semibold">{item.supplierCode}</span>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
