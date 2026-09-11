import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { config } from '../config';

/**
 * Centralized error handling middleware.
 * Catches all errors thrown in route handlers and middleware.
 * Returns appropriate HTTP status codes without exposing internals in production.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Default to 500
  let statusCode = 500;
  let message = 'Internal server error';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }

  // Log error (but not stack traces for operational errors in production)
  if (statusCode >= 500 || !config.isDev) {
    console.error(`[ERROR] ${statusCode} - ${message}`, config.isDev ? err.stack : '');
  }

  const response: Record<string, unknown> = {
    success: false,
    error: message,
  };

  if (details) {
    response.details = details;
  }

  // Never expose stack traces in production
  if (config.isDev && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
