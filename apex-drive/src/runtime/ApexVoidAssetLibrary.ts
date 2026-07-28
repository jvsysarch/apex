import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const APEX_VOID_LOCAL_ORIGIN = 'http://127.0.0.1:5180';

export interface ApexVoidAssetRecord {
  readonly assetId: string;
  readonly name: string;
  readonly slug: string;
  readonly revision: string;
  readonly modelUrl: string;
  readonly manifestUrl: string;
  readonly savedAt: string;
  readonly rightsStatus: string;
}

interface ApexVoidAssetCatalogResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly assets?: readonly ApexVoidAssetRecord[];
}

export async function loadApexVoidAssetCatalog(): Promise<
  readonly ApexVoidAssetRecord[]
> {
  const response = await fetch(`${APEX_VOID_LOCAL_ORIGIN}/api/assets`, {
    cache: 'no-store',
  });
  const payload = await response.json() as ApexVoidAssetCatalogResponse;
  if (!response.ok || !payload.ok || !payload.assets) {
    throw new Error(payload.error ?? `APEX Void respondió ${response.status}`);
  }
  return Object.freeze([...payload.assets]);
}

export async function loadApexVoidAsset(
  definition: ApexVoidAssetRecord,
): Promise<THREE.Object3D> {
  const gltf = await new GLTFLoader().loadAsync(definition.modelUrl);
  const object = gltf.scene;
  object.name = `APEX library · ${definition.name}`;
  object.animations = gltf.animations;
  object.userData.apexAssetId = definition.assetId;
  object.userData.apexAssetRevision = definition.revision;
  object.userData.apexAssetSource = 'apex-void';
  return object;
}
