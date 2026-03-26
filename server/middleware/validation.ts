import { z } from "zod";

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { error: result.error.errors.map(e => e.message).join(", ") };
  }
  return { data: result.data };
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmailField(email: string | null | undefined): boolean {
  if (!email || email.trim() === "") return true;
  return emailRegex.test(email);
}
