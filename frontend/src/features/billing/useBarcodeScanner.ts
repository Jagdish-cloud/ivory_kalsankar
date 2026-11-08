import { useEffect, useRef } from "react";

/** A USB/Bluetooth "keyboard wedge" scanner types the whole code in a few ms, then presses Enter. */
const MAX_KEY_GAP_MS = 80;
const MIN_CODE_LENGTH = 3;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "reset"].includes(target.type);
  }
  return false;
}

/**
 * Global barcode-scanner listener.
 *
 * Scanners emulate a keyboard, so a scan is detected as a burst of printable keystrokes (each
 * within `MAX_KEY_GAP_MS` of the previous one) terminated by Enter. This makes scanning work
 * even when focus has drifted away from the scan box (e.g. after clicking a button or the table).
 *
 * Keystrokes made while focus is inside any text field are ignored here - the scan input handles
 * its own Enter key, and we must never hijack what the cashier types in other fields.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const handlerRef = useRef(onScan);
  useEffect(() => {
    handlerRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastKeyTime = 0;
    let maxGap = 0;

    const reset = () => {
      buffer = "";
      maxGap = 0;
    };

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) {
        reset();
        return;
      }

      const now = performance.now();

      if (event.key === "Enter") {
        const gapToEnter = buffer ? now - lastKeyTime : Infinity;
        const looksLikeScan =
          buffer.length >= MIN_CODE_LENGTH && maxGap <= MAX_KEY_GAP_MS && gapToEnter <= MAX_KEY_GAP_MS * 2;
        if (looksLikeScan) {
          // Stop the focused button/link from also being "clicked" by the scanner's Enter.
          event.preventDefault();
          event.stopPropagation();
          const code = buffer;
          reset();
          handlerRef.current(code);
        } else {
          reset();
        }
        return;
      }

      if (event.key.length !== 1) return; // Shift, Tab, arrows, ...

      if (buffer && now - lastKeyTime > MAX_KEY_GAP_MS) reset();
      if (buffer) maxGap = Math.max(maxGap, now - lastKeyTime);
      buffer += event.key;
      lastKeyTime = now;
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
