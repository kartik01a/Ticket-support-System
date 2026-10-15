import type { Classification, ClassifierInput, TicketClassifier } from '../../src/services/ai/types';

type Behaviour = (input: ClassifierInput, signal?: AbortSignal) => Promise<unknown>;

/** Test double for the AI. `calls` records what it was asked to classify. */
export class FakeClassifier implements TicketClassifier {
  public readonly calls: ClassifierInput[] = [];

  constructor(private behaviour: Behaviour) {}

  static returning(value: unknown): FakeClassifier {
    return new FakeClassifier(async () => value);
  }

  static failing(error: Error): FakeClassifier {
    return new FakeClassifier(async () => {
      throw error;
    });
  }

  /** Never settles and ignores the abort signal, like a hung network call. */
  static hanging(): FakeClassifier {
    return new FakeClassifier(() => new Promise(() => undefined));
  }

  async classify(input: ClassifierInput, signal?: AbortSignal): Promise<Classification> {
    this.calls.push(input);
    return (await this.behaviour(input, signal)) as Classification;
  }
}
