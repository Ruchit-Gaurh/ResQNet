import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/errors';

export interface AuthUser {
  userId: string;
  role: string; // UserRole
  pseudonym: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Required authentication middleware.
 * Extracts JWT from Authorization: Bearer <token> header.
 * Rejects with 401 if token is missing or invalid.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Provide Authorization: Bearer <token>', 401);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;

    req.user = {
      userId: decoded.userId || decoded.sub || 'unknown',
      role: decoded.role || 'PUBLIC',
      pseudonym: decoded.pseudonym || `USER-${decoded.userId || 'anon'}`,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired authentication token', 401));
    }
  }
}

/**
 * Optional authentication middleware.
 * Extracts JWT if present but does not reject if missing.
 * Sets req.user to undefined if no valid token is found.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      req.user = {
        userId: decoded.userId || decoded.sub || 'unknown',
        role: decoded.role || 'PUBLIC',
        pseudonym: decoded.pseudonym || `USER-${decoded.userId || 'anon'}`,
      };
    }
  } catch {
    // Token is invalid — treat as unauthenticated
    req.user = undefined;
  }
  next();
}
