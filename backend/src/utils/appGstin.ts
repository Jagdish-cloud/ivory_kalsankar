import { prisma } from "@/prismaClient";

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SETTING_KEY = "APP_GSTIN";

export function isValidGstin(value: string): boolean {
  return GSTIN_RE.test(value);
}

/** Company GSTIN stored in AppSetting. Falls back to APP_GSTIN env once if the row is missing. */
export async function getAppGstin(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (row) {
    return row.value.trim().toUpperCase() || null;
  }
  return (process.env.APP_GSTIN ?? "").trim().toUpperCase() || null;
}

export async function setAppGstin(value: string | null) {
  const next = value ? value.trim().toUpperCase() : "";
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: next },
    update: { value: next },
  });
  process.env.APP_GSTIN = next;
}
