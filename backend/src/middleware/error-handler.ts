import type { ErrorRequestHandler } from 'express';
import { isAppError } from '../errors/app-error';
import type { Logger } from '../services/ticket.service';

interface ErrorLogger extends Logger {
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Single place where errors become HTTP responses: `{ error: { code, message, details? } }`. */
export const createErrorHandler =
  (logger: ErrorLogger): ErrorRequestHandler =>
  (err, _req, res, next) => {
    if (res.headersSent) return next(err);

    if (isAppError(err)) {
      return res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) } });
    }

    // body-parser errors carry a `type`
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    }
    if (type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    }

    // Unexpected: log details server-side, return nothing internal to the client.
    logger.error('Unhandled error', { message: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  };
