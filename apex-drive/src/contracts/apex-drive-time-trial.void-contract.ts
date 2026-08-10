/*
 * Generated from APEX Void APEX TIME TRIAL Definition v4.
 * Download a new export only when this public interface is intentionally
 * released again. Drive rejects a remote Instance with a different digest.
 */

export const voidInterfaceContract = {
  protocol: 'void.interface@1',
  integration: {
    id: 'apex-drive.time-trial',
    version: '1',
    configuration: {
      circuits: [{
        id: 'circuito-vector',
        version: '1.0.0',
        name: 'Circuito Vector',
        startGate: 'first-track-point',
        checkpoints: 'ordered',
      }],
      timing: {
        start: 'stationary-gate-enter',
        requiresOrderedCheckpoints: true,
        validator: 'advisory',
      },
    },
  },
  identity: {
    schemes: [{
      id: 'firebase-google',
      kind: 'firebase',
      projectId: 'apex-void-auth-2026',
      appId: '1:451633501288:web:a9ea7ff6b4e0d71b5817dd',
      apiKey: 'AIzaSyC2bcJB7F-BxVDORu_lexmbTlbjpP1ojvY',
      authDomain: 'apex-void-auth-2026.firebaseapp.com',
      messagingSenderId: '451633501288',
    }],
  },
  exports: [
    { operation: 'apex-drive.time-trial.summary@1', method: 'GET', path: '/me/timing', actor: 'required', target: 'data' },
    { operation: 'apex-drive.time-trial.open-run@1', method: 'POST', path: '/timing/runs', actor: 'required', target: 'data' },
    { operation: 'apex-drive.time-trial.record-lap@1', method: 'POST', path: '/timing/runs/:runId/laps', actor: 'required', target: 'data' },
  ],
  definitionRevision: 4,
  digest: 'sha256:e23ba908739e3a920dd34066ecb924ea2d1a48a6dfab926e38a667c1a271db9e',
} as const;

export const voidInterfaceRequirement = {
  protocol: voidInterfaceContract.protocol,
  integration: voidInterfaceContract.integration,
  digest: voidInterfaceContract.digest,
  operations: voidInterfaceContract.exports.map(entry => entry.operation),
} as const;

export type VoidInterfaceContract = typeof voidInterfaceContract;
export type VoidOperation = typeof voidInterfaceContract.exports[number]['operation'];
