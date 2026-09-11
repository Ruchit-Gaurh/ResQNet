import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'http';
import jwt from 'jsonwebtoken';

import app from '../server';
import { config } from '../config';

describe('Mobile device authentication', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 3003;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('issues a PUBLIC token bound to a valid ResQNet node ID', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'NODE-A1B2C3D4' }),
    });
    const body = await response.json() as {
      success: boolean;
      token: string;
      role: string;
      userId: string;
      expiresInSeconds: number;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.role).toBe('PUBLIC');
    expect(body.userId).toBe('mobile-NODE-A1B2C3D4');
    expect(body.expiresInSeconds).toBe(86_400);

    const claims = jwt.verify(body.token, config.jwt.secret) as jwt.JwtPayload;
    expect(claims.userId).toBe('mobile-NODE-A1B2C3D4');
    expect(claims.role).toBe('PUBLIC');
    expect(claims.pseudonym).toBe('PSEUDO-NODE-A1B2C3D4');
  });

  it('rejects malformed node IDs', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'phone-a' }),
    });

    expect(response.status).toBe(400);
  });

  it('does not accept caller-controlled roles', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'NODE-A1B2C3D4', role: 'RESPONDER_ADMIN' }),
    });

    expect(response.status).toBe(400);
  });

  it('exchanges the configured responder access key for an admin token', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: `  ${config.admin.accessKey}  ` }),
    });
    const body = await response.json() as { token: string; role: string; userId: string };

    expect(response.status).toBe(200);
    expect(body.role).toBe('RESPONDER_ADMIN');
    expect(body.userId).toBe('admin-dashboard');
    const claims = jwt.verify(body.token, config.jwt.secret) as jwt.JwtPayload;
    expect(claims.role).toBe('RESPONDER_ADMIN');
  });

  it('rejects an incorrect responder access key', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: 'incorrect-admin-key-value' }),
    });

    expect(response.status).toBe(401);
  });
});
