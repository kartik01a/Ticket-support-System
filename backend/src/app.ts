import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createErrorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { createTicketRouter } from './routes/ticket.routes';
import type { TicketService } from './services/ticket.service';

export interface AppLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface AppOptions {
  ticketService: TicketService;
  corsOrigins?: string[];
  /** Rate limit POST /api/tickets. Disabled by default so tests are not throttled. */
  rateLimitPerMinute?: number;
  logger?: AppLogger;
}

const silentLogger: AppLogger = { warn: () => undefined, error: () => undefined };

/** Builds the Express app without listening, so Supertest can drive it directly. */
export function createApp(options: AppOptions): Express {
  const logger = options.logger ?? silentLogger;
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.corsOrigins ?? ['http://localhost:3000'], methods: ['GET', 'POST', 'DELETE'] }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const limiter = options.rateLimitPerMinute
    ? rateLimit({
        windowMs: 60_000,
        limit: options.rateLimitPerMinute,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) =>
          res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later' } }),
      })
    : undefined;

  app.use('/api/tickets', createTicketRouter(options.ticketService, limiter));

  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
}
