import type { Classification, ClassifierInput, TicketClassifier } from '../../src/services/ai/types';

type Behaviour = (input: ClassifierInput, signal?: AbortSignal) => Promise<unknown>;

/** Test double for the AI. `calls` records what it was asked to classify. */
export interface FakeClassifier extends TicketClassifier {
  readonly calls: ClassifierInput[];
}

export function createFakeClassifier(behaviour: Behaviour): FakeClassifier {
  const calls: ClassifierInput[] = [];
  return {
    calls,
    async classify(input: ClassifierInput, signal?: AbortSignal): Promise<Classification> {
      calls.push(input);
      return (await behaviour(input, signal)) as Classification;
    },
  };
}

export const fakeReturning = (value: unknown) => createFakeClassifier(async () => value);

export const fakeFailing = (error: Error) =>
  createFakeClassifier(async () => {
    throw error;
  });

/** Never settles and ignores the abort signal, like a hung network call. */
export const fakeHanging = () => createFakeClassifier(() => new Promise(() => undefined));
