interface DeviceTokenResponse {
  success: boolean;
  token?: string;
  expiresInSeconds?: number;
}

interface CachedToken {
  value: string;
  refreshAt: number;
}

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_EARLY_MS = 60 * 1000;

export class DeviceBackendAuth {
  private cachedToken?: CachedToken;
  private tokenPromise?: Promise<string>;

  constructor(
    private readonly baseUrl: string,
    private readonly deviceId: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.refreshAt > this.now()) {
      return Promise.resolve(this.cachedToken.value);
    }
    if (!this.tokenPromise) {
      this.tokenPromise = this.requestToken().finally(() => {
        this.tokenPromise = undefined;
      });
    }
    return this.tokenPromise;
  }

  private async requestToken(): Promise<string> {
    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/auth/device`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId }),
      },
    );
    if (!response.ok) {
      throw new Error(`Device authentication failed with HTTP ${response.status}.`);
    }
    const result = await response.json() as DeviceTokenResponse;
    if (!result.success || !result.token) {
      throw new Error('Backend did not return a device access token.');
    }

    const ttlMs = typeof result.expiresInSeconds === 'number' && result.expiresInSeconds > 0
      ? result.expiresInSeconds * 1000
      : DEFAULT_TOKEN_TTL_MS;
    this.cachedToken = {
      value: result.token,
      refreshAt: this.now() + Math.max(0, ttlMs - REFRESH_EARLY_MS),
    };
    return result.token;
  }
}
