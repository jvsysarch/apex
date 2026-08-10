import type { VoidInstanceContract } from './void-client.mjs';

export type VoidBrowserIdentityState = Readonly<{
  status: 'not-required' | 'required' | 'authenticated' | 'error';
  message?: string;
  identity?: Readonly<{
    displayName: string;
  }>;
}>;
export class ApexVoidBrowserIdentityError extends Error {}

export function createApexVoidBrowserIdentity(options?: Readonly<{
  document?: Document;
  window?: Window;
}>): Readonly<{
  getBearerToken(): string | undefined;
  getIdentityProviderId(): string | undefined;
  clear(): void;
  signOut(): Promise<void>;
  requiresInteractiveIdentity(contract: VoidInstanceContract): boolean;
  mount(options: Readonly<{
    contract: VoidInstanceContract;
    container: HTMLElement;
    onState?(state: VoidBrowserIdentityState): void;
  }>): Promise<VoidBrowserIdentityState>;
}>;
