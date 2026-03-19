import type {
  NoonHubBotRegistration,
  NoonHubClientOptions,
  NoonHubEventPayload,
  NoonHubHeartbeatPayload,
  NoonHubMetricsPayload,
  NoonHubPositionsPayload,
} from '../types/index.js';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export class NoonHubClient {
  private readonly baseUrl: string;
  private readonly ingestKey?: string;
  private readonly defaultBot?: Omit<NoonHubBotRegistration, 'lastHeartbeatAt'>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NoonHubClientOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.ingestKey = options.ingestKey;
    this.defaultBot = options.defaultBot;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async registerBot(payload?: Partial<NoonHubBotRegistration>) {
    const body = this.mergeBotDefaults(payload);
    return this.post('/hub/bots/register', body);
  }

  async sendHeartbeat(
    payload: Omit<NoonHubHeartbeatPayload, 'name' | 'botSlug'> &
      Partial<Pick<NoonHubHeartbeatPayload, 'name' | 'botSlug'>>
  ) {
    return this.post('/hub/heartbeat', this.mergePayload(payload));
  }

  async sendMetrics(
    payload: Omit<NoonHubMetricsPayload, 'name' | 'botSlug'> &
      Partial<Pick<NoonHubMetricsPayload, 'name' | 'botSlug'>>
  ) {
    return this.post('/hub/metrics', this.mergePayload(payload));
  }

  async sendPositions(
    payload: Omit<NoonHubPositionsPayload, 'name' | 'botSlug'> &
      Partial<Pick<NoonHubPositionsPayload, 'name' | 'botSlug'>>
  ) {
    return this.post('/hub/positions', this.mergePayload(payload));
  }

  async sendEvent(
    payload: Omit<NoonHubEventPayload, 'name' | 'botSlug'> &
      Partial<Pick<NoonHubEventPayload, 'name' | 'botSlug'>>
  ) {
    return this.post('/hub/events', this.mergePayload(payload));
  }

  private mergeBotDefaults(payload?: Partial<NoonHubBotRegistration>): NoonHubBotRegistration {
    const merged = {
      ...this.defaultBot,
      ...payload,
    };

    if (!merged.slug || !merged.name) {
      throw new Error('NoonHubClient requires bot slug and name');
    }

    return merged as NoonHubBotRegistration;
  }

  private mergePayload<T extends { botSlug?: string; name?: string }>(
    payload: T
  ): T & { botSlug: string; name: string } {
    const botSlug = payload.botSlug ?? this.defaultBot?.slug;
    const name = payload.name ?? this.defaultBot?.name;

    if (!botSlug || !name) {
      throw new Error('NoonHubClient requires botSlug and name, either per call or in defaultBot');
    }

    return {
      ...this.defaultBot,
      ...payload,
      botSlug,
      name,
    } as T & { botSlug: string; name: string };
  }

  private async post(path: string, body: unknown) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.ingestKey ? { 'x-noon-hub-key': this.ingestKey } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Noon Hub request failed: ${response.status} ${response.statusText} ${text}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }
}

export function createNoonHubClient(options: NoonHubClientOptions) {
  return new NoonHubClient(options);
}
