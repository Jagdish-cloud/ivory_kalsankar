/** Initials of the store name, 3–4 letters (padded from leftover letters if needed). */
export function initialsFromName(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  let letters = words.map((w) => w[0]).join("");
  if (letters.length < 3) {
    const rest = name.toUpperCase().replace(/[^A-Z]/g, "");
    letters = (letters + rest + "XXX").slice(0, 3);
  }
  return letters.slice(0, 4);
}

/**
 * Unique 2–6 character store code: initials + 01, 02, … (e.g. "Ivory Lace - Bangalore" → ILB01).
 */
export function suggestStoreCode(name: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (c) => c.toUpperCase()));
  const base = initialsFromName(name);
  for (let n = 1; n <= 99; n++) {
    const code = `${base}${String(n).padStart(2, "0")}`.slice(0, 6);
    if (!used.has(code)) return code;
  }
  throw new Error("Could not generate a unique store code");
}
