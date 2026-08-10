import { getApp, getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut as signOutFromFirebase } from 'firebase/auth';

export class ApexVoidBrowserIdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApexVoidBrowserIdentityError';
  }
}

const googleIdentityScript = 'https://accounts.google.com/gsi/client';
const interactiveKinds = new Set(['google', 'firebase']);
const identityLog = (event, attributes = {}) => {
  console.info('[APEX Void identity]', event, attributes);
};
const errorCode = error => typeof error?.code === 'string' ? error.code : undefined;
const firebaseFailureMessage = error => {
  switch (errorCode(error)) {
    case 'auth/unauthorized-domain':
      return 'Firebase rechazÃ³ este dominio (auth/unauthorized-domain).';
    case 'auth/operation-not-allowed':
      return 'Google no estÃ¡ habilitado en Firebase Authentication (auth/operation-not-allowed).';
    case 'auth/popup-blocked':
      return 'El navegador bloqueÃ³ la ventana de Google (auth/popup-blocked).';
    case 'auth/popup-closed-by-user':
      return 'El inicio de sesiÃ³n se cerrÃ³ antes de completarse.';
    default:
      return errorCode(error)
        ? `Firebase no pudo iniciar sesiÃ³n (${errorCode(error)}).`
        : 'Firebase no pudo preparar el inicio de sesiÃ³n.';
  }
};
const readInteractiveScheme = contract => {
  const schemes = contract?.manifest?.identity?.schemes ?? [];
  const interactiveSchemes = schemes.filter(scheme => interactiveKinds.has(scheme?.kind));
  if (!interactiveSchemes.length) return undefined;
  if (interactiveSchemes.length > 1) {
    throw new ApexVoidBrowserIdentityError('This Void Instance exposes more than one interactive identity scheme');
  }
  const scheme = interactiveSchemes[0];
  if (!scheme.id) throw new ApexVoidBrowserIdentityError('The identity scheme is incomplete');
  if (scheme.kind === 'google' && !scheme.clientId) {
    throw new ApexVoidBrowserIdentityError('The Google identity scheme is incomplete');
  }
  if (scheme.kind === 'firebase' && (!scheme.projectId || !scheme.appId || !scheme.apiKey || !scheme.authDomain)) {
    throw new ApexVoidBrowserIdentityError('The Firebase identity scheme is incomplete');
  }
  return scheme;
};

const loadGoogleIdentity = ({ document, window }) => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${googleIdentityScript}"]`);
    const script = existing ?? document.createElement('script');
    const complete = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new ApexVoidBrowserIdentityError('Google Identity Services did not load'));
    };
    script.addEventListener('load', complete, { once: true });
    script.addEventListener('error', () => reject(new ApexVoidBrowserIdentityError('Google Identity Services could not load')), { once: true });
    if (!existing) {
      script.src = googleIdentityScript;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });
};

const firebaseConfiguration = scheme => Object.freeze({
  projectId: scheme.projectId,
  appId: scheme.appId,
  apiKey: scheme.apiKey,
  authDomain: scheme.authDomain,
  ...(scheme.messagingSenderId ? { messagingSenderId: scheme.messagingSenderId } : {}),
});

const firebaseAppName = scheme => `apex-void-${scheme.appId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
const firebaseIdentity = user => {
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  return displayName ? Object.freeze({ displayName }) : undefined;
};
const resolveInitialFirebaseUser = auth => new Promise((resolve, reject) => {
  let unsubscribe;
  let settled = false;
  const finish = (callback, value) => {
    if (settled) return;
    settled = true;
    unsubscribe?.();
    callback(value);
  };
  unsubscribe = onAuthStateChanged(auth, user => finish(resolve, user), error => finish(reject, error));
  if (settled) unsubscribe();
});

/**
 * Browser-only identity adapter. It reads a public identity scheme from a
 * Void contract and owns that provider's SDK interaction. It never verifies
 * a token, persists domain data, or knows a World integration.
 */
export const createApexVoidBrowserIdentity = ({
  document = globalThis.document,
  window = globalThis.window,
} = {}) => {
  if (!document || !window) throw new ApexVoidBrowserIdentityError('A browser document and window are required');
  let bearerToken;
  let providerId;
  let endProviderSession = async () => {};

  const clear = () => { bearerToken = undefined; providerId = undefined; };

  const mountGoogle = async ({ scheme, container, onState }) => {
    const google = await loadGoogleIdentity({ document, window });
    google.accounts.id.initialize({
      client_id: scheme.clientId,
      auto_select: false,
      callback: response => {
        if (!response?.credential) {
          onState?.({ status: 'error', message: 'Google did not return an identity token' });
          return;
        }
        bearerToken = response.credential;
        providerId = scheme.id;
        onState?.({ status: 'authenticated' });
      },
    });
    container.replaceChildren();
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
    });
    onState?.({ status: bearerToken ? 'authenticated' : 'required' });
    return { status: bearerToken ? 'authenticated' : 'required' };
  };

  const mountFirebase = async ({ scheme, container, onState }) => {
    try {
      identityLog('firebase-mount', { providerId: scheme.id, projectId: scheme.projectId });
      const name = firebaseAppName(scheme);
      const app = getApps().some(entry => entry.name === name)
        ? getApp(name)
        : initializeApp(firebaseConfiguration(scheme), name);
      const auth = getAuth(app);
      endProviderSession = () => signOutFromFirebase(auth);
      const existing = auth.currentUser ?? await resolveInitialFirebaseUser(auth);
      if (existing) {
        bearerToken = await existing.getIdToken();
        providerId = scheme.id;
        const identity = firebaseIdentity(existing);
        container.replaceChildren();
        identityLog('firebase-session-restored', { providerId: scheme.id });
        onState?.({ status: 'authenticated', ...(identity ? { identity } : {}) });
        return { status: 'authenticated', ...(identity ? { identity } : {}) };
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'apex-void-browser-identity__button';
      button.textContent = 'Continuar con Google';
      button.addEventListener('click', async () => {
        button.disabled = true;
        identityLog('firebase-popup-requested', { providerId: scheme.id });
        onState?.({ status: 'required', message: 'Abriendo Googleâ€¦' });
        try {
          const result = await signInWithPopup(auth, new GoogleAuthProvider());
          bearerToken = await result.user.getIdToken();
          providerId = scheme.id;
          const identity = firebaseIdentity(result.user);
          container.replaceChildren();
          identityLog('firebase-authenticated', { providerId: scheme.id });
          onState?.({ status: 'authenticated', ...(identity ? { identity } : {}) });
        } catch (error) {
          button.disabled = false;
          const message = firebaseFailureMessage(error);
          console.error('[APEX Void identity] firebase-popup-failed', { code: errorCode(error), error });
          onState?.({ status: 'error', message });
        }
      });
      container.replaceChildren(button);
      identityLog('firebase-ready-for-interaction', { providerId: scheme.id });
      onState?.({ status: 'required' });
      return { status: 'required' };
    } catch (error) {
      const message = firebaseFailureMessage(error);
      console.error('[APEX Void identity] firebase-mount-failed', { code: errorCode(error), error });
      onState?.({ status: 'error', message });
      return { status: 'error', message };
    }
  };

  return Object.freeze({
    getBearerToken: () => bearerToken,
    getIdentityProviderId: () => providerId,
    clear,
    async signOut() {
      const closeSession = endProviderSession;
      clear();
      await closeSession();
      endProviderSession = async () => {};
    },
    requiresInteractiveIdentity(contract) {
      return Boolean(readInteractiveScheme(contract));
    },
    async mount({ contract, container, onState } = {}) {
      const scheme = readInteractiveScheme(contract);
      if (!scheme) {
        container?.replaceChildren();
        onState?.({ status: 'not-required' });
        return { status: 'not-required' };
      }
      if (!container) throw new ApexVoidBrowserIdentityError('An identity container is required');
      if (scheme.kind === 'firebase') return mountFirebase({ scheme, container, onState });
      return mountGoogle({ scheme, container, onState });
    },
  });
};
