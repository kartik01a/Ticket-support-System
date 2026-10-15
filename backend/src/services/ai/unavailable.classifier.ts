import { ClassifierError, type Classification, type TicketClassifier } from './types';

/** Used when no OPENAI_API_KEY is configured, so the app still runs and every ticket gets the fallback. */
export class UnavailableClassifier implements TicketClassifier {
  async classify(): Promise<Classification> {
    throw new ClassifierError('ai_unavailable', 'OPENAI_API_KEY is not configured');
  }
}
