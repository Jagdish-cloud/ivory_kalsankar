import { Prisma } from "@prisma/client";
import { round2 } from "@/utils/gst";

export { round2 };

/** Convert a Prisma Decimal / string / number / null into a plain JS number. */
export function num(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
