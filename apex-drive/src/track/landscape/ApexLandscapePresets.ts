import { apexDrivePublicUrl } from '../../runtime/ApexDrivePublicUrl';

export const PROCEDURAL_LANDSCAPE_TRACK_ID = 'laboratorio-paisaje';

export type ApexLandscapePresetId = (
  | 'quebrada-andina'
  | 'sierras-de-altura'
  | 'estepa-cordillerana'
);

export interface ApexLandscapeTopologyPreset {
  readonly seed: number;
  readonly elevationM: number;
  readonly macroScaleM: number;
  readonly detailScaleM: number;
  readonly ridgeStrength: number;
  readonly valleyStrength: number;
  readonly gridSegments: number;
  readonly corridorWidthM: number;
  readonly corridorBlendM: number;
}

export type ApexProceduralRouteAlgorithm = (
  | 'valley-pass'
  | 'mountain-switchbacks'
  | 'open-steppe'
);

export interface ApexProceduralRoutePreset {
  readonly algorithm: ApexProceduralRouteAlgorithm;
  readonly defaultSeed: number;
  readonly controlPointCount: number;
  readonly sampleSpacingM: number;
  readonly targetLengthM: number;
  readonly targetReliefM: number;
  readonly maximumGrade: number;
  readonly turnVariation: number;
  readonly reference: {
    readonly sourceName: string;
    readonly sourceUrl: string;
    readonly observedLengthKm: number;
    readonly elevationBandM?: readonly [number, number];
    readonly summary: string;
  };
}

export interface ApexLandscapeMaterialPreset {
  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly colorMapUri: string;
  readonly normalMapUri: string;
  readonly roughnessMapUri?: string;
  readonly textureSizeM: number;
  readonly tint: number;
}

export interface ApexLandscapePreset {
  readonly id: ApexLandscapePresetId;
  readonly name: string;
  readonly region: string;
  readonly description: string;
  readonly environmentProfileId: string;
  readonly topology: ApexLandscapeTopologyPreset;
  readonly route: ApexProceduralRoutePreset;
  readonly material: ApexLandscapeMaterialPreset;
}

const ambientCg = (
  assetId: 'Ground030' | 'Ground039',
  textureSizeM: number,
  tint: number,
): ApexLandscapeMaterialPreset => Object.freeze({
  sourceName: `ambientCG ${assetId}`,
  sourceUrl: `https://ambientcg.com/view?id=${assetId}`,
  colorMapUri: apexDrivePublicUrl(
    `assets/terrain/ambientcg/${assetId}/${assetId}_1K-JPG_Color.jpg`,
  ),
  normalMapUri: apexDrivePublicUrl(
    `assets/terrain/ambientcg/${assetId}/${assetId}_1K-JPG_NormalDX.jpg`,
  ),
  roughnessMapUri: apexDrivePublicUrl(
    `assets/terrain/ambientcg/${assetId}/${assetId}_1K-JPG_Roughness.jpg`,
  ),
  textureSizeM,
  tint,
});

const grass001: ApexLandscapeMaterialPreset = Object.freeze({
  sourceName: 'ambientCG Grass001',
  sourceUrl: 'https://ambientcg.com/view?id=Grass001',
  colorMapUri: apexDrivePublicUrl(
    'assets/ground/grass001/Grass001_1K-JPG_Color.jpg',
  ),
  normalMapUri: apexDrivePublicUrl(
    'assets/ground/grass001/Grass001_1K-JPG_NormalDX.jpg',
  ),
  textureSizeM: 18,
  tint: 0xa8a36d,
});

export const APEX_LANDSCAPE_PRESETS: readonly ApexLandscapePreset[] = (
  Object.freeze([
    Object.freeze({
      id: 'quebrada-andina',
      name: 'Quebrada Andina',
      region: 'Quebrada de Humahuaca · RN 9',
      description: 'Valle encajonado, laderas estratificadas y crestas secas.',
      environmentProfileId: 'apex-quebrada-andina',
      topology: Object.freeze({
        seed: 941,
        elevationM: 126,
        macroScaleM: 430,
        detailScaleM: 92,
        ridgeStrength: 0.78,
        valleyStrength: 0.72,
        gridSegments: 128,
        corridorWidthM: 18,
        corridorBlendM: 32,
      }),
      route: Object.freeze({
        algorithm: 'valley-pass',
        defaultSeed: 9_941,
        controlPointCount: 30,
        sampleSpacingM: 5.5,
        targetLengthM: 2_850,
        targetReliefM: 118,
        maximumGrade: 0.075,
        turnVariation: 0.52,
        reference: Object.freeze({
          sourceName: 'RN 9 · Quebrada de Humahuaca',
          sourceUrl: 'https://www.argentina.gob.ar/jefatura/turismo/viaja-por-argentina/conducir-por-la-quebrada-de-humahuaca',
          observedLengthKm: 150,
          elevationBandM: Object.freeze([1_622, 3_692] as const),
          summary: 'Valle N–S angosto, ascenso sostenido y quebradas laterales.',
        }),
      }),
      material: ambientCg('Ground039', 12, 0xc29266),
    }),
    Object.freeze({
      id: 'sierras-de-altura',
      name: 'Sierras de Altura',
      region: 'Camino de las Altas Cumbres',
      description: 'Cordones redondeados, quebradas y pastizal serrano.',
      environmentProfileId: 'apex-sierras-de-altura',
      topology: Object.freeze({
        seed: 34,
        elevationM: 82,
        macroScaleM: 520,
        detailScaleM: 135,
        ridgeStrength: 0.36,
        valleyStrength: 0.52,
        gridSegments: 128,
        corridorWidthM: 20,
        corridorBlendM: 30,
      }),
      route: Object.freeze({
        algorithm: 'mountain-switchbacks',
        defaultSeed: 34_220,
        controlPointCount: 34,
        sampleSpacingM: 5,
        targetLengthM: 3_250,
        targetReliefM: 146,
        maximumGrade: 0.09,
        turnVariation: 0.68,
        reference: Object.freeze({
          sourceName: 'Camino de las Altas Cumbres',
          sourceUrl: 'https://cordobaturismo.gov.ar/destinos/camino-de-las-altas-cumbres-3/',
          observedLengthKm: 100,
          elevationBandM: Object.freeze([1_000, 2_200] as const),
          summary: 'Sierras Grandes, pasos altos, quebradas y trazado sinuoso.',
        }),
      }),
      material: grass001,
    }),
    Object.freeze({
      id: 'estepa-cordillerana',
      name: 'Estepa Cordillerana',
      region: 'Ruta 40 · Patagonia austral',
      description: 'Valle amplio, lomadas bajas y macizos lejanos.',
      environmentProfileId: 'apex-estepa-cordillerana',
      topology: Object.freeze({
        seed: 40,
        elevationM: 54,
        macroScaleM: 690,
        detailScaleM: 180,
        ridgeStrength: 0.24,
        valleyStrength: 0.38,
        gridSegments: 112,
        corridorWidthM: 22,
        corridorBlendM: 38,
      }),
      route: Object.freeze({
        algorithm: 'open-steppe',
        defaultSeed: 40_041,
        controlPointCount: 24,
        sampleSpacingM: 6.5,
        targetLengthM: 3_050,
        targetReliefM: 54,
        maximumGrade: 0.05,
        turnVariation: 0.3,
        reference: Object.freeze({
          sourceName: 'Ruta 40 · El Calafate–El Chaltén',
          sourceUrl: 'https://www.argentina.gob.ar/parquesnacionales/patagonia-austral/parque-nacional-los-glaciares/actividades',
          observedLengthKm: 200,
          summary: 'Estepa abierta, radios amplios y transición hacia la cordillera.',
        }),
      }),
      material: ambientCg('Ground030', 16, 0x9d8e65),
    }),
  ] satisfies readonly ApexLandscapePreset[])
);

export const findApexLandscapePreset = (
  id: string | null | undefined,
): ApexLandscapePreset | undefined => (
  APEX_LANDSCAPE_PRESETS.find(preset => preset.id === id)
);

const landscapeStorageKey = (trackId: string): string => (
  `apex-drive.track.${trackId}.landscape.v1`
);

export const readActiveApexLandscapePreset = (
  trackId: string,
  supportsProceduralLandscape = trackId === PROCEDURAL_LANDSCAPE_TRACK_ID,
): ApexLandscapePreset | undefined => {
  if (!supportsProceduralLandscape) return undefined;
  const requested = typeof window === 'undefined'
    ? undefined
    : new URLSearchParams(window.location.search).get('landscape');
  const stored = typeof window === 'undefined'
    ? undefined
    : window.localStorage.getItem(landscapeStorageKey(trackId));
  return findApexLandscapePreset(requested)
    ?? findApexLandscapePreset(stored)
    ?? APEX_LANDSCAPE_PRESETS[0];
};

export const writeActiveApexLandscapePreset = (
  trackId: string,
  id: ApexLandscapePresetId,
): void => {
  window.localStorage.setItem(landscapeStorageKey(trackId), id);
};
