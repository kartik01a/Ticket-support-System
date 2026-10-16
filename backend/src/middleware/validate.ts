import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { createAppError, type ErrorDetail } from '../errors/app-error';

function toDetails(issues: { path: PropertyKey[]; message: string }[]): ErrorDetail[] {
  return issues.map((i) => ({ field: i.path.map(String).join('.') || 'body', message: i.message }));
}

/** Validates req.body and replaces it with the parsed (trimmed, stripped) value. */
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(createAppError(400, 'VALIDATION_ERROR', 'Request validation failed', toDetails(result.error.issues)));
    }
    req.body = result.data;
    next();
  };

/** Validates req.params; the parsed value goes on res.locals.params. */
export const validateParams =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(createAppError(400, 'VALIDATION_ERROR', 'Invalid path parameters', toDetails(result.error.issues)));
    }
    res.locals.params = result.data;
    next();
  };

/** Validates req.query. Express 5 makes req.query read-only, so the parsed value goes on res.locals.query. */
export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(createAppError(400, 'VALIDATION_ERROR', 'Invalid query parameters', toDetails(result.error.issues)));
    }
    res.locals.query = result.data;
    next();
  };
