import { createClassifierError, type TicketClassifier } from './types';

/** Used when no OPENAI_API_KEY is configured, so the app still runs and every ticket gets the fallback. */
export function createUnavailableClassifier(): TicketClassifier {
  return {
    async classify() {
      throw createClassifierError('ai_unavailable', 'OPENAI_API_KEY is not configured');
    },
  };
}
