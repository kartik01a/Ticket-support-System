export interface ErrorDetail {
  field: string;
  message: string;
}

const APP_ERROR = Symbol('AppError');

/** An error that is safe to show to API clients. */
export interface AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
}

export function createAppError(status: number, code: string, message: string, details?: ErrorDetail[]): AppError {
  const error = new Error(message);
  error.name = 'AppError';
  return Object.assign(error, { status, code, details, [APP_ERROR]: true }) as AppError;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && APP_ERROR in error;
}
