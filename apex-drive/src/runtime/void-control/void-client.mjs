const cleanBaseUrl = value => {
  const normalized = String(value ?? '').trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('APEX Void base URL is required');
  return normalized;
};
const cleanInstanceId = value => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error('APEX Void Instance id is required');
  return normalized;
};

const cleanWorldId = value => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error('APEX Void World id is required');
  return normalized;
};

export class ApexVoidClientError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApexVoidClientError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Portable public client for one APEX Void target.
 *
 * It knows the generic Instance contract only. Consumers such as Drive pick
 * their own operation ids after discovery; this module never imports a World
 * template or speaks in domain nouns such as Player, Lap or Circuit.
 */
export const createApexVoidInstanceClient = ({
  baseUrl,
  instanceId,
  worldId,
  fetch: fetchImplementation = globalThis.fetch,
  getBearerToken,
  getIdentityProviderId,
  getDevelopmentPrincipal,
} = {}) => {
  const origin = cleanBaseUrl(baseUrl);
  if (instanceId && worldId) throw new Error('Configure either a World id or an Instance id, not both');
  const targetWorldId = worldId ? cleanWorldId(worldId) : undefined;
  const targetInstanceId = targetWorldId ? undefined : cleanInstanceId(instanceId);
  if (!fetchImplementation) throw new Error('A fetch implementation is required');
  const targetPath = targetWorldId
    ? `/api/public/worlds/${encodeURIComponent(targetWorldId)}`
    : `/api/public/instances/${encodeURIComponent(targetInstanceId)}`;

  const request = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body !== undefined) headers.set('content-type', 'application/json');
    const token = await getBearerToken?.();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
      const providerId = await getIdentityProviderId?.();
      if (providerId) headers.set('x-void-identity-provider', providerId);
    }
    const developmentPrincipal = await getDevelopmentPrincipal?.();
    if (developmentPrincipal?.subject) {
      headers.set('x-void-development-identity', developmentPrincipal.subject);
      if (developmentPrincipal.label) headers.set('x-void-identity-label', developmentPrincipal.label);
    }
    const response = await fetchImplementation(`${origin}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new ApexVoidClientError(
        typeof payload?.error === 'string' ? payload.error : `APEX Void responded ${response.status}`,
        response.status,
        payload,
      );
    }
    return payload;
  };

  const discover = () => request(`${targetPath}/contract`);
  const selectRoutes = contract => new Map((contract.routes ?? []).map(route => [route.operation, route]));
  const hrefFor = (route, params = {}) => {
    const missing = [];
    const href = String(route.href ?? '').replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name) => {
      const value = params[name];
      if (value === undefined || value === null || value === '') {
        missing.push(name);
        return '';
      }
      return encodeURIComponent(String(value));
    });
    if (missing.length) throw new Error(`Operation ${route.operation} requires path parameter ${missing.join(', ')}`);
    return href;
  };

  const validateManifest = ({ contract, accepts, operations }) => {
    if (!accepts) return;
    const manifest = contract.manifest;
    if (!manifest) throw new ApexVoidClientError('Instance did not provide an interface manifest', 409, contract);
    if (accepts.protocol && manifest.protocol !== accepts.protocol) {
      throw new ApexVoidClientError(`Void protocol ${manifest.protocol ?? 'unknown'} is not accepted by this client`, 409, contract);
    }
    if (accepts.integration && (
      manifest.integration?.id !== accepts.integration.id
      || manifest.integration?.version !== accepts.integration.version
    )) {
      throw new ApexVoidClientError('Void integration does not match the compiled contract', 409, contract);
    }
    if (accepts.digest && manifest.digest !== accepts.digest) {
      throw new ApexVoidClientError('Void interface digest differs from the compiled contract', 409, contract);
    }
    const exposed = new Set((manifest.exports ?? []).map(entry => entry.operation));
    const required = [...operations, ...(accepts.operations ?? [])];
    const missing = required.filter(operation => !exposed.has(operation));
    if (missing.length) throw new ApexVoidClientError(`Void manifest is missing required operation ${missing.join(', ')}`, 409, contract);
  };

  return Object.freeze({
    baseUrl: origin,
    ...(targetWorldId ? { worldId: targetWorldId } : { instanceId: targetInstanceId }),
    discover,
    async connect({ operations = [], accepts } = {}) {
      const contract = await discover();
      validateManifest({ contract, accepts, operations });
      const routes = selectRoutes(contract);
      const missing = operations.filter(operation => !routes.has(operation));
      if (missing.length) throw new ApexVoidClientError(`Instance does not expose required operation ${missing.join(', ')}`, 409, contract);
      return Object.freeze({
        contract,
        operations: Object.freeze(Object.fromEntries([...routes.entries()])),
        invoke(operation, { params, query, body } = {}) {
          const route = routes.get(operation);
          if (!route) throw new ApexVoidClientError(`Operation ${operation} is not exposed by this Instance`, 404, contract);
          const search = query ? new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)])).toString() : '';
          return request(`${hrefFor(route, params)}${search ? `?${search}` : ''}`, {
            method: route.method,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        },
      });
    },
  });
};
