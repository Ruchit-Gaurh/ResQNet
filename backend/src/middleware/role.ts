import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Role-based access control middleware factory.
 * Returns 403 if the authenticated user's role is not in the allowed list.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
          403
        )
      );
    }

    next();
  };
}
