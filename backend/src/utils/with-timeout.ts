const TIMEOUT_ERROR = Symbol('TimeoutError');

export interface TimeoutError extends Error {
  readonly name: 'TimeoutError';
}

export function createTimeoutError(ms: number): TimeoutError {
  const error = new Error(`Operation timed out after ${ms}ms`);
  error.name = 'TimeoutError';
  return Object.assign(error, { [TIMEOUT_ERROR]: true }) as TimeoutError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof Error && TIMEOUT_ERROR in error;
}

/**
 * Runs `task` with an AbortSignal that fires when `ms` elapses, and rejects with
 * a TimeoutError at that moment even if the task ignores the signal.
 */
export async function withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(createTimeoutError(ms));
    }, ms);
  });

  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
