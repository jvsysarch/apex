import {
  createApexVoidInstanceClient,
  type VoidConnection,
} from './void-control/void-client.mjs';
import {
  createApexVoidBrowserIdentity,
  type VoidBrowserIdentityState,
} from './void-control/browser-identity.mjs';
import { voidInterfaceRequirement } from '../contracts/apex-drive-time-trial.void-contract';

export interface ApexDriveCircuitIdentity {
  readonly id: string;
  readonly version: string;
  readonly name: string;
}

export interface ApexVoidTimeTrialLap {
  readonly id: string;
  readonly runId: string;
  readonly durationMs: number;
  readonly checkpointCount: number;
  readonly completedAt: string;
}

export interface ApexVoidTimeTrialStats {
  readonly circuit: ApexDriveCircuitIdentity;
  readonly attempts: number;
  readonly best?: ApexVoidTimeTrialLap;
  readonly last?: ApexVoidTimeTrialLap;
  readonly history: readonly ApexVoidTimeTrialLap[];
}

export class ApexVoidIdentityRequiredError extends Error {
  constructor() {
    super('Sign in is required by this Void Instance');
    this.name = 'ApexVoidIdentityRequiredError';
  }
}

export interface ApexVoidTimeTrialClient {
  readonly worldId?: string;
  /** @deprecated A direct Instance target cannot follow a Live promotion. */
  readonly instanceId?: string;
  mountIdentity(container: HTMLElement, onState: (state: VoidBrowserIdentityState) => void): Promise<void>;
  signOut(): Promise<void>;
  isIdentityRequired(error: unknown): error is ApexVoidIdentityRequiredError;
  me(circuit: ApexDriveCircuitIdentity): Promise<ApexVoidTimeTrialStats>;
  beginRun(circuit: ApexDriveCircuitIdentity): Promise<{ readonly id: string }>;
  recordLap(input: {
    readonly runId: string;
    readonly durationMs: number;
    readonly checkpointCount: number;
  }): Promise<{ readonly lap: ApexVoidTimeTrialLap; readonly stats: ApexVoidTimeTrialStats }>;
}

type VoidRecord = {
  readonly id: string;
  readonly runId: string;
  readonly circuitId: string;
  readonly circuitVersion: string;
  readonly durationMs: number;
  readonly checkpointCount: number;
  readonly createdAt: string;
};

type VoidActionResponse = {
  readonly records: readonly VoidRecord[];
  readonly aggregates: {
    readonly attempts?: number;
    readonly best?: VoidRecord | null;
    readonly last?: VoidRecord | null;
  };
};

const configuredBaseUrl = import.meta.env.VITE_APEX_VOID_PUBLIC_URL?.trim();
const configuredWorldId = import.meta.env.VITE_APEX_VOID_WORLD_ID?.trim();
const configuredInstanceId = import.meta.env.VITE_APEX_VOID_INSTANCE_ID?.trim();
const requiredOperations = voidInterfaceRequirement.operations;

const toLap = (record: VoidRecord): ApexVoidTimeTrialLap => ({
  id: record.id,
  runId: record.runId,
  durationMs: record.durationMs,
  checkpointCount: record.checkpointCount,
  completedAt: record.createdAt,
});

/**
 * Drive's World adapter. It has no provider configuration and never builds a
 * Void URL or endpoint beyond the generic client. Its only domain knowledge
 * is the released Time Trial operation contract.
 */
const createClient = (): ApexVoidTimeTrialClient | undefined => {
  if (!configuredBaseUrl || (!configuredWorldId && !configuredInstanceId)) return undefined;
  const identity = createApexVoidBrowserIdentity();
  const transport = createApexVoidInstanceClient({
    baseUrl: configuredBaseUrl,
    ...(configuredWorldId ? { worldId: configuredWorldId } : { instanceId: configuredInstanceId }),
    getBearerToken: identity.getBearerToken,
    getIdentityProviderId: identity.getIdentityProviderId,
  });
  let connection: Promise<VoidConnection> | undefined;
  const runCircuits = new Map<string, ApexDriveCircuitIdentity>();

  const connect = () => {
    if (!connection) {
      connection = transport.connect({
        operations: requiredOperations,
        accepts: voidInterfaceRequirement,
      });
    }
    return connection;
  };

  const authenticatedConnection = async () => {
    const active = await connect();
    if (identity.requiresInteractiveIdentity(active.contract) && !identity.getBearerToken()) {
      throw new ApexVoidIdentityRequiredError();
    }
    return active;
  };

  const invoke = async <T>(operation: string, options: {
    readonly params?: Record<string, string>;
    readonly query?: Record<string, string>;
    readonly body?: unknown;
  } = {}) => (await authenticatedConnection()).invoke<T>(operation, options);

  const me = async (circuit: ApexDriveCircuitIdentity): Promise<ApexVoidTimeTrialStats> => {
    const response = await invoke<VoidActionResponse>('apex-drive.time-trial.summary@1', {
      query: { circuitId: circuit.id, circuitVersion: circuit.version },
    });
    return {
      circuit,
      attempts: response.aggregates.attempts ?? 0,
      ...(response.aggregates.best ? { best: toLap(response.aggregates.best) } : {}),
      ...(response.aggregates.last ? { last: toLap(response.aggregates.last) } : {}),
      history: response.records.map(toLap),
    };
  };

  return Object.freeze({
    ...(configuredWorldId ? { worldId: configuredWorldId } : { instanceId: configuredInstanceId }),
    async mountIdentity(container: HTMLElement, onState: (state: VoidBrowserIdentityState) => void) {
      const active = await connect();
      await identity.mount({ contract: active.contract, container, onState });
    },
    async signOut() {
      await identity.signOut();
    },
    isIdentityRequired(error: unknown): error is ApexVoidIdentityRequiredError {
      return error instanceof ApexVoidIdentityRequiredError;
    },
    me,
    async beginRun(circuit: ApexDriveCircuitIdentity) {
      const response = await invoke<{ readonly records: readonly { readonly id: string }[] }>('apex-drive.time-trial.open-run@1', {
        body: { circuitId: circuit.id, circuitVersion: circuit.version },
      });
      const run = response.records[0];
      if (!run) throw new Error('Void did not create a timing run');
      runCircuits.set(run.id, circuit);
      return run;
    },
    async recordLap(input: {
      readonly runId: string;
      readonly durationMs: number;
      readonly checkpointCount: number;
    }) {
      const response = await invoke<{ readonly records: readonly VoidRecord[] }>('apex-drive.time-trial.record-lap@1', {
        params: { runId: input.runId },
        body: { durationMs: input.durationMs, checkpointCount: input.checkpointCount },
      });
      const lap = response.records[0];
      if (!lap) throw new Error('Void did not record a timing lap');
      const circuit = runCircuits.get(input.runId) ?? {
        id: lap.circuitId,
        version: lap.circuitVersion,
        name: lap.circuitId,
      };
      runCircuits.delete(input.runId);
      return { lap: toLap(lap), stats: await me(circuit) };
    },
  });
};

export const apexVoidTimeTrialClient = createClient();
