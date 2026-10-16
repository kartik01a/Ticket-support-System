import 'dotenv/config';
import { createApp, type AppLogger } from './app';
import { loadEnv } from './config/env';
import { openDatabase } from './db/connection';
import { createTicketRepository } from './repositories/ticket.repository';
import { createOpenAiClassifier } from './services/ai/openai.classifier';
import type { TicketClassifier } from './services/ai/types';
import { createUnavailableClassifier } from './services/ai/unavailable.classifier';
import { createTicketService } from './services/ticket.service';

const logger: AppLogger = {
  warn: (message, meta) => console.warn(`[warn] ${message}`, meta ?? ''),
  error: (message, meta) => console.error(`[error] ${message}`, meta ?? ''),
};

const env = loadEnv();
const db = openDatabase(env.DATABASE_PATH);

let classifier: TicketClassifier;
if (env.OPENAI_API_KEY) {
  classifier = createOpenAiClassifier({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, timeoutMs: env.AI_TIMEOUT_MS });
} else {
  logger.warn('OPENAI_API_KEY is not set: tickets will use the fallback classification (General / Medium).');
  classifier = createUnavailableClassifier();
}

const ticketService = createTicketService({
  repository: createTicketRepository(db),
  classifier,
  aiTimeoutMs: env.AI_TIMEOUT_MS,
  logger,
});

const app = createApp({
  ticketService,
  corsOrigins: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  rateLimitPerMinute: 30,
  logger,
});

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (model: ${env.OPENAI_API_KEY ? env.OPENAI_MODEL : 'none'})`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
