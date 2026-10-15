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

/** Thrown by classifiers. `reason` is stored on the ticket and is safe to expose; `message` is for logs only. */
export class ClassifierError extends Error {
  constructor(
    public readonly reason: FallbackReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ClassifierError';
  }
}
