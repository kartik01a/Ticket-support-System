import { z } from 'zod';
import { CATEGORIES, PRIORITIES } from '../../types/ticket';
import { ClassifierError, type Classification } from './types';

/** AI output is untrusted: only exact, allowlisted values are accepted (no coercion, no case folding). */
export const classificationSchema = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
  })
  .strict();

/** Validates an already-parsed value (e.g. from a classifier). Throws ClassifierError('invalid_response'). */
export function validateClassification(value: unknown): Classification {
  const result = classificationSchema.safeParse(value);
  if (!result.success) {
    throw new ClassifierError('invalid_response', 'AI returned a classification outside the allowed values');
  }
  return result.data;
}

/** Parses raw model text as JSON, then validates it. Throws ClassifierError('invalid_response'). */
export function parseClassification(raw: string | null | undefined): Classification {
  if (!raw) throw new ClassifierError('invalid_response', 'AI returned an empty response');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ClassifierError('invalid_response', 'AI returned non-JSON output');
  }
  return validateClassification(json);
}

/** JSON schema sent to OpenAI Structured Outputs (mirrors classificationSchema). */
export const classificationJsonSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    priority: { type: 'string', enum: [...PRIORITIES] },
  },
  required: ['category', 'priority'],
  additionalProperties: false,
} as const;
