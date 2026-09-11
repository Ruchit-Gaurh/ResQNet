interface DevelopmentTokenResponse {
  success: boolean;
  token?: string;
}

export class DevelopmentBackendAuth {
  private tokenPromise?: Promise<string | undefined>;

  constructor(
    private readonly baseUrl: string,
    private readonly userId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  getAccessToken(): Promise<string | undefined> {
    if (!this.tokenPromise) {
      this.tokenPromise = this.requestToken().catch((error: unknown) => {
        this.tokenPromise = undefined;
        throw error;
      });
    }
    return this.tokenPromise;
  }

  private async requestToken(): Promise<string | undefined> {
    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, '')}/api/v1/auth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'PUBLIC', userId: this.userId }),
      },
    );
    if (!response.ok) {
      throw new Error(`Development gateway authentication failed with HTTP ${response.status}.`);
    }
    const result = await response.json() as DevelopmentTokenResponse;
    if (!result.success || !result.token) {
      throw new Error('Development gateway did not return an access token.');
    }
    return result.token;
  }
}
