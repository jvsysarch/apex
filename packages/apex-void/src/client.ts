export interface ApexVoidMapIdentity {
  readonly trackId: string;
  readonly trackVersion: string;
}

export interface ApexVoidRevisionReceipt {
  readonly objectId: string;
  readonly revision: string;
  readonly savedAtIso: string;
}

export interface ApexVoidStoredDraft<TDraft> extends ApexVoidRevisionReceipt {
  readonly draft: TDraft;
  readonly revisions: readonly {
    readonly id: string;
    readonly storedAt: string;
    readonly document: string;
  }[];
}

export interface ApexVoidMapCatalogEntry {
  readonly trackId: string;
  readonly trackVersion: string;
  readonly name: string;
  readonly number: number | null;
  readonly published: unknown | null;
  readonly draft: unknown | null;
}

export interface ApexVoidHealth {
  readonly ok: true;
  readonly service: string;
  readonly persistence: string;
  readonly persistenceDomains: readonly string[];
}

export interface ApexVoidClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly getIdToken?: () => Promise<string | undefined>;
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | undefined => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
);

const normalizedBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('APEX Void requiere una URL base');
  return trimmed;
};

export class ApexVoidRequestError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApexVoidRequestError';
    this.status = status;
    this.payload = payload;
  }
}

export interface ApexVoidClient {
  readonly baseUrl: string;
  health(): Promise<ApexVoidHealth>;
  listMaps(): Promise<readonly ApexVoidMapCatalogEntry[]>;
  loadMapDraft<TDraft>(
    identity: ApexVoidMapIdentity,
  ): Promise<ApexVoidStoredDraft<TDraft> | undefined>;
  saveMapDraft<TDraft>(draft: TDraft): Promise<ApexVoidRevisionReceipt>;
  loadMapSource<TSource>(
    identity: ApexVoidMapIdentity,
  ): Promise<TSource | undefined>;
  publishMap<TRequest, TResult = JsonRecord>(request: TRequest): Promise<TResult>;
}

export const createApexVoidClient = (
  options: ApexVoidClientOptions,
): ApexVoidClient => {
  const baseUrl = normalizedBaseUrl(options.baseUrl);
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (!fetchImplementation) {
    throw new Error('APEX Void requiere una implementación de fetch');
  }

  const request = async <T>(
    path: string,
    init?: RequestInit,
    allowEmpty = false,
  ): Promise<T | undefined> => {
    const token = await options.getIdToken?.();
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (allowEmpty && response.status === 204) return undefined;
    const payload = await response.json().catch(() => undefined) as unknown;
    if (!response.ok) {
      const message = asRecord(payload)?.error;
      throw new ApexVoidRequestError(
        typeof message === 'string'
          ? message
          : `APEX Void respondió ${response.status}`,
        response.status,
        payload,
      );
    }
    return payload as T;
  };

  return Object.freeze({
    baseUrl,
    async health() {
      const payload = await request<ApexVoidHealth>('/health');
      if (!payload?.ok) throw new Error('APEX Void no respondió correctamente');
      return payload;
    },
    async listMaps() {
      const payload = await request<{
        readonly tracks?: readonly ApexVoidMapCatalogEntry[];
      }>('/api/maps');
      return payload?.tracks ?? Object.freeze([]);
    },
    async loadMapDraft<TDraft>(identity: ApexVoidMapIdentity) {
      const query = new URLSearchParams({
        trackId: identity.trackId,
        trackVersion: identity.trackVersion,
      });
      const payload = await request<ApexVoidStoredDraft<TDraft>>(
        `/api/maps/drafts?${query}`,
        undefined,
        true,
      );
      return payload;
    },
    async saveMapDraft<TDraft>(draft: TDraft) {
      const payload = await request<ApexVoidRevisionReceipt>(
        '/api/maps/drafts/save',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      );
      if (
        !payload
        || typeof payload.objectId !== 'string'
        || typeof payload.revision !== 'string'
        || typeof payload.savedAtIso !== 'string'
      ) {
        throw new Error('APEX Void devolvió un recibo de revisión inválido');
      }
      return payload;
    },
    async loadMapSource<TSource>(identity: ApexVoidMapIdentity) {
      const query = new URLSearchParams({
        trackId: identity.trackId,
        trackVersion: identity.trackVersion,
      });
      const payload = await request<{ readonly source: TSource }>(
        `/api/maps/source?${query}`,
        undefined,
        true,
      );
      return payload?.source;
    },
    async publishMap<TRequest, TResult = JsonRecord>(publication: TRequest) {
      const payload = await request<TResult>('/api/maps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publication),
      });
      if (!payload) throw new Error('APEX Void no confirmó la publicación');
      return payload;
    },
  });
};
