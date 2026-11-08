function slug(value: string, length = 3): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, length).toUpperCase();
}

export function buildSkuCode(
  internalStyleCode: string,
  size: { label: string } | null,
  cup: { label: string } | null,
  colour: { name: string } | null
): string {
  const sizePart = `${size?.label ?? "NA"}${cup ? cup.label : ""}`;
  return `${internalStyleCode}-${sizePart}-${colour ? slug(colour.name) : "NA"}`;
}

export function generateSystemBarcode(index: number): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);
  return `IL${timestamp}${random}${index}`;
}
