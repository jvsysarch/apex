export type VoidIdentityScheme = Readonly<{
  id: string;
  kind: string;
  clientId?: string;
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  messagingSenderId?: string;
}>;
export type VoidInstanceContract = Readonly<{
  world?: Readonly<{
    id: string;
    liveGeneration: number;
    activeInstanceId: string;
  }>;
  manifest?: Readonly<{
    protocol?: string;
    integration?: Readonly<{ id?: string; version?: string }>;
    digest?: string;
    identity?: Readonly<{ schemes?: readonly VoidIdentityScheme[] }>;
  }>;
  routes?: readonly Readonly<{
    operation: string;
    method: string;
    href: string;
    actor?: string;
    target?: string;
  }>[];
}>;

export type VoidConnection = Readonly<{
  contract: VoidInstanceContract;
  operations: Readonly<Record<string, unknown>>;
  invoke<T>(operation: string, options?: Readonly<{
    params?: Record<string, string>;
    query?: Record<string, string | number | boolean | undefined | null>;
    body?: unknown;
  }>): Promise<T>;
}>;

export class ApexVoidClientError extends Error {
  readonly status: number;
  readonly payload: unknown;
}

export function createApexVoidInstanceClient(options: Readonly<{
  baseUrl: string;
  instanceId?: string;
  worldId?: string;
  fetch?: typeof globalThis.fetch;
  getBearerToken?: () => string | undefined | Promise<string | undefined>;
  getIdentityProviderId?: () => string | undefined | Promise<string | undefined>;
  getDevelopmentPrincipal?: () => Readonly<{ subject: string; label?: string }> | undefined | Promise<Readonly<{ subject: string; label?: string }> | undefined>;
}>): Readonly<{
  readonly baseUrl: string;
  readonly instanceId?: string;
  readonly worldId?: string;
  discover(): Promise<VoidInstanceContract>;
  connect(options?: Readonly<{
    operations?: readonly string[];
    accepts?: Readonly<{
      protocol?: string;
      integration?: Readonly<{ id?: string; version?: string }>;
      digest?: string;
      operations?: readonly string[];
    }>;
  }>): Promise<VoidConnection>;
}>;
