/**
 * Custom application error class with HTTP status codes.
 * Used by the centralized error handler middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Common error factories
export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(message, 400, details),

  unauthorized: (message: string = 'Authentication required') =>
    new AppError(message, 401),

  forbidden: (message: string = 'Insufficient permissions') =>
    new AppError(message, 403),

  notFound: (resource: string, id: string) =>
    new AppError(`${resource} '${id}' not found`, 404),

  conflict: (message: string) =>
    new AppError(message, 409),

  validation: (message: string, details?: unknown) =>
    new AppError(message, 422, details),

  internal: (message: string = 'Internal server error') =>
    new AppError(message, 500, undefined, false),
};
