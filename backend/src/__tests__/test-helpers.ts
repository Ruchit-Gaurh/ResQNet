import jwt from 'jsonwebtoken';
import { config } from '../config';

export function generateTestToken(role: string = 'PUBLIC', userId: string = 'test-user-123'): string {
  return jwt.sign(
    {
      userId,
      role,
      pseudonym: `PSEUDO-${userId}`,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}
