import { forwardRef, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeCanvasProps {
  value: string;
  className?: string;
  height?: number;
  barWidth?: number;
  displayValue?: boolean;
}

export const BarcodeCanvas = forwardRef<HTMLCanvasElement, BarcodeCanvasProps>(function BarcodeCanvas(
  { value, className, height = 60, barWidth = 2, displayValue = true },
  forwardedRef
) {
  const innerRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = innerRef.current;
    if (!canvas || !value) return;
    try {
      JsBarcode(canvas, value, {
        format: "CODE128",
        height,
        width: barWidth,
        displayValue,
        fontSize: 13,
        margin: 8,
      });
    } catch {
      // Invalid characters for CODE128 - leave canvas blank rather than crash the page.
    }
  }, [value, height, barWidth, displayValue]);

  return (
    <canvas
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={className}
    />
  );
});

export function downloadCanvasPng(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

interface BarcodeTileProps {
  value: string;
  title: string;
  subtitle?: string;
  filename?: string;
}

export function BarcodeTile({ value, title, subtitle, filename }: BarcodeTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-brand-100 bg-white p-3 text-center">
      <div className="w-full">
        <div className="truncate text-sm font-semibold text-ink-900">{title}</div>
        {subtitle && <div className="truncate text-xs text-ink-500">{subtitle}</div>}
      </div>
      <BarcodeCanvas ref={canvasRef} value={value} className="max-w-full" />
      <button
        type="button"
        onClick={() => downloadCanvasPng(canvasRef.current, sanitizeFilename(filename ?? value))}
        className="mt-1 w-full rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
      >
        Download PNG
      </button>
    </div>
  );
}
