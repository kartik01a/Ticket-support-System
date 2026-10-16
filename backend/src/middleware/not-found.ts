import type { RequestHandler } from 'express';
import { createAppError } from '../errors/app-error';

export const notFound: RequestHandler = (req, _res, next) => {
  next(createAppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};
