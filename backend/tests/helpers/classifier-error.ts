import { isClassifierError, type ClassifierError } from '../../src/services/ai/types';

/** Asserts that `fn` throws a ClassifierError with the given reason. */
export function expectClassifierError(fn: () => unknown, reason: ClassifierError['reason'] = 'invalid_response'): void {
  let thrown: unknown;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  expect(isClassifierError(thrown)).toBe(true);
  expect((thrown as ClassifierError).reason).toBe(reason);
}
