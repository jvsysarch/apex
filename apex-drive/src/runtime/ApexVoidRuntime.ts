import { createApexVoidClient } from '@jvsysarch/apex-void/client';

const configuredBaseUrl = import.meta.env.VITE_APEX_VOID_URL?.trim();

export const APEX_VOID_BASE_URL = (
  configuredBaseUrl || 'http://127.0.0.1:5180'
);

export const APEX_VOID_ENABLED = (
  Boolean(configuredBaseUrl)
  || (
    import.meta.env.DEV
    && import.meta.env.VITE_APEX_TRACK_AUTHORING_ENABLED !== 'false'
  )
);

export const apexVoidClient = createApexVoidClient({
  baseUrl: APEX_VOID_BASE_URL,
});
