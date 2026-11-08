import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@/prismaClient";
import { ApiError } from "@/middleware/errorHandler";
import { isMailConfigured, sendMail } from "@/services/mailer.service";

const emailField = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);

const recipientSchema = z.object({
  email: emailField,
  name: z.string().trim().max(80).optional().nullable(),
  receiveBills: z.boolean().default(true),
  receiveLowStock: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function list(_req: Request, res: Response) {
  const rows = await prisma.emailRecipient.findMany({ orderBy: { createdAt: "asc" } });
  res.json({ items: rows, mailConfigured: isMailConfigured() });
}

export async function create(req: Request, res: Response) {
  const input = recipientSchema.parse(req.body);
  const exists = await prisma.emailRecipient.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "This email address is already in the list");
  const row = await prisma.emailRecipient.create({ data: { ...input, name: input.name || null } });
  res.status(201).json(row);
}

export async function update(req: Request, res: Response) {
  const id = req.params.id as string;
  const input = recipientSchema.partial().parse(req.body);
  if (input.email) {
    const clash = await prisma.emailRecipient.findFirst({ where: { email: input.email, NOT: { id } } });
    if (clash) throw new ApiError(409, "This email address is already in the list");
  }
  const existing = await prisma.emailRecipient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Recipient not found");
  const row = await prisma.emailRecipient.update({ where: { id }, data: { ...input, ...(input.name !== undefined ? { name: input.name || null } : {}) } });
  res.json(row);
}

export async function remove(req: Request, res: Response) {
  const id = req.params.id as string;
  const existing = await prisma.emailRecipient.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Recipient not found");
  await prisma.emailRecipient.delete({ where: { id } });
  res.status(204).end();
}

/** Sends a short test message so the owner can confirm SMTP works before relying on it. */
export async function sendTest(req: Request, res: Response) {
  const { email } = z.object({ email: emailField }).parse(req.body);
  const result = await sendMail({
    to: [email],
    subject: "Ivory Lace - test email",
    html: "<p>This is a test email from Ivory Lace. Bills and low-stock reports will arrive at this address.</p>",
    text: "This is a test email from Ivory Lace.",
  });
  res.status(result.sent ? 200 : 502).json(result);
}
