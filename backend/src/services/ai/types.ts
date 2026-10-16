import type { Category, FallbackReason, Priority } from '../../types/ticket';

export interface Classification {
  category: Category;
  priority: Priority;
}

export interface ClassifierInput {
  title: string;
  description: string;
}

/** Anything that can classify a ticket. The real one calls OpenAI; tests inject fakes. */
export interface TicketClassifier {
  classify(input: ClassifierInput, signal?: AbortSignal): Promise<Classification>;
}

const CLASSIFIER_ERROR = Symbol('ClassifierError');

/** Thrown by classifiers. `reason` is stored on the ticket and is safe to expose; `message` is for logs only. */
export interface ClassifierError extends Error {
  readonly reason: FallbackReason;
}

export function createClassifierError(reason: FallbackReason, message: string, options?: { cause?: unknown }): ClassifierError {
  const error = new Error(message, options);
  error.name = 'ClassifierError';
  return Object.assign(error, { reason, [CLASSIFIER_ERROR]: true }) as ClassifierError;
}

export function isClassifierError(error: unknown): error is ClassifierError {
  return error instanceof Error && CLASSIFIER_ERROR in error;
}
