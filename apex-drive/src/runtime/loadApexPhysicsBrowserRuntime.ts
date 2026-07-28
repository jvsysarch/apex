import { apexDrivePublicUrl } from './ApexDrivePublicUrl';

export type ApexRuntimeStatusReporter = (message: string) => void;

/**
 * Integración del host web con los artefactos compilados de APEX Physics.
 *
 * Las URLs pertenecen al runtime de APEX Drive; el núcleo físico recibe el
 * módulo Jolt ya instanciado.
 */
export const loadApexPhysicsBrowserRuntime = async (
  reportStatus: ApexRuntimeStatusReporter,
): Promise<any> => {
  reportStatus('Cargando apex-physics.js…');
  const runtimeUrl = apexDrivePublicUrl('apex-physics.js');
  const runtimeModule = await import(/* @vite-ignore */ runtimeUrl);
  reportStatus('Instanciando apex-physics.wasm…');
  return runtimeModule.default({
    locateFile: (file: string) => (
      file.endsWith('.wasm') ? apexDrivePublicUrl('apex-physics.wasm') : file
    ),
  });
};
