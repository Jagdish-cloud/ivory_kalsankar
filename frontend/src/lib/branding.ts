export type StoreChain = "IVORY_LACE" | "KALSANKAR_OS";
export type AppTheme = "ivory" | "kalsankar" | "admin";

export const CHAIN_LABELS: Record<StoreChain, string> = {
  IVORY_LACE: "Ivory-Lace",
  KALSANKAR_OS: "Kalsankar OS",
};

export const THEME_META: Record<AppTheme, { wordmark: string; documentTitle: string; receiptTagline: string }> = {
  ivory: {
    wordmark: "Ivory Lace",
    documentTitle: "Ivory Lace - Store Management",
    receiptTagline: "Thank you for shopping with Ivory Lace. Comfort. Confidence. You.",
  },
  kalsankar: {
    wordmark: "Kalsankar OS",
    documentTitle: "Kalsankar OS - Store Management",
    receiptTagline: "Thank you for shopping with Kalsankar OS.",
  },
  admin: {
    wordmark: "Admin Portal",
    documentTitle: "Admin Portal",
    receiptTagline: "",
  },
};

export function resolveTheme(args: { role?: string; chain?: StoreChain; pathname: string }): AppTheme {
  if (args.role === "SUPER_ADMIN") return "admin";
  if (args.chain === "KALSANKAR_OS") return "kalsankar";
  return "ivory";
}

export function storesInChain<T extends { chain?: StoreChain }>(stores: T[], chain?: StoreChain) {
  if (!chain) return stores;
  return stores.filter((s) => s.chain === chain);
}
