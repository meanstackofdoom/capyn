import type { z } from "zod";
import { InvalidRequestError } from "./errors";

export function parseInput<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data as z.output<TSchema>;
  throw new InvalidRequestError(
    "VALIDATION_ERROR",
    "Request validation failed",
    parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "$",
      message: issue.message
    }))
  );
}
