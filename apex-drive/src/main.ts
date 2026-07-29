import * as THREE from 'three/webgpu';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EngineSynth } from '@jvsysarch/apex-audio';
import {
  ApexPhysicsWorld,
  DEFAULT_TIRE_CONTACT_COUNT,
  type ApexCarPhysicsDefinition,
  type ApexHandlingStage,
  type ApexMotorcyclePhysicsDefinition,
  type ApexVehicleTrainingSnapshot,
  type DriverInput,
  PHYSICS_HZ,
  type ApexVehicleKind,
} from '@jvsysarch/apex-physics';
import { SurfaceRegistry } from '@jvsysarch/apex-physics';
import {
  APEX_MOTORCYCLE_CATALOG,
  APEX_VEHICLE_DEFINITIONS,
  DEFAULT_APEX_MOTORCYCLE,
  findApexMotorcycle,
  parseApexDriveCarSpecification,
  type ApexDriveCarSpecification,
} from '@jvsysarch/apex-car';
import {
  loadApexPhysicsBrowserRuntime,
} from './runtime/loadApexPhysicsBrowserRuntime';
import {
  APEX_DRIVE_PUBLIC_DEMO,
  APEX_DRIVE_RUNTIME_PROFILE,
} from './runtime/ApexDriveRuntimeProfile';
import { apexDrivePublicUrl } from './runtime/ApexDrivePublicUrl';
import {
  loadApexVoidAsset,
  loadApexVoidAssetCatalog,
  type ApexVoidAssetRecord,
} from './runtime/ApexVoidAssetLibrary';
import { DeterministicDriveAudit } from './diagnostics/DeterministicDriveAudit';
import { RaceCircuitAudit } from './diagnostics/RaceCircuitAudit';
import {
  ApexDrivePerformanceMonitor,
} from './diagnostics/ApexDrivePerformanceMonitor';
import {
  TireManeuverAudit,
  type TireManeuverId,
} from './diagnostics/TireManeuverAudit';
import { ApexLapTimer, type LapTimerPhase } from './race/ApexLapTimer';
import { ApexLapGhost } from './race/ApexLapGhost';
import { createApexRaceGrid } from './race/ApexRaceGrid';
import { ApexRacingLineLearner } from './race/ApexRacingLineLearner';
import {
  createApexRacingLinePlan,
  createApexRacingLinePlanPayload,
} from './race/ApexRacingLinePlanner';
import { ApexSegmentTimer } from './race/ApexSegmentTimer';
import {
  APEX_ENVIRONMENT_ASSETS,
  ApexEnvironmentProfilePanel,
  DEFAULT_ENVIRONMENT_PROFILES,
  type ApexEnvironmentSettings,
} from './rendering/ApexEnvironmentProfiles';
import { createApexParkingLotVisual } from './rendering/ApexParkingLotRenderer';
import {
  createApexDirtRoadForestVisual,
  type ApexDirtRoadForestVisual,
} from './rendering/ApexDirtRoadForestVisual';
import {
  createApexTrackCollisionDebugVisual,
  type ApexTrackCollisionDebugVisual,
} from './rendering/ApexTrackCollisionDebugVisual';
import {
  adaptApexVehiclePose,
  type VehiclePose,
} from './rendering/ApexVehiclePoseAdapter';
import {
  createApexTrackEditDerivedVisual,
  type ApexTrackEditDerivedVisual,
} from './rendering/ApexTrackEditDerivedVisual';
import {
  createApexCorrugatedGuardrailGeometry,
  createApexGalvanizedGuardrailMaterial,
  createApexGuardrailPostMaterial,
  selectApexGuardrailPostSegments,
} from './rendering/ApexTrackGuardrailVisual';
import { ApexTireDeformationVisual } from './rendering/ApexTireDeformationVisual';
import {
  createTrackGuidanceChevronSystem,
} from './rendering/TrackGuidanceChevronSystem';
import { createTrackTunnelSystem } from './rendering/TrackTunnelSystem';
import { createTrackVisualLodSystem } from './rendering/TrackVisualLodSystem';
import {
  ACTIVE_TRACK,
  ACTIVE_TRACK_OPTIONS,
  ACTIVE_TRACK_PRIMARY_SEGMENT,
  ACTIVE_TRACK_SOURCE,
} from './track/ActiveTrack';
import {
  APEX_TRACK_AUTHORING_SERVER_ORIGIN,
} from './track/formats/ApexTrackSource';
import { formatApexDriveTrackNumber } from './track/catalog/ApexDriveTrackCatalog';
import {
  CIRCUITO_CHALLHUACO_CONTROL_POINTS,
  CIRCUITO_CHALLHUACO_ID,
} from './track/ChallhuacoTrack';
import {
  APEX_TRACK_EDITOR_COLLISION_SPACING_M,
  APEX_TRACK_EDITOR_CONTROL_SPACING_M,
  createApexTrackEditor,
  type ApexTrackEditorCameraState,
} from './track/editor/ApexTrackEditor';
import {
  createApexTrackSegmentOutliner,
  type ApexTrackSegmentOutliner,
} from './track/editor/ApexTrackSegmentOutliner';
import {
  createApexTrackSegmentDrawTool,
  type ApexTrackSegmentDrawTool,
} from './track/editor/ApexTrackSegmentDrawTool';
import {
  createApexTrackDerivedState,
  type ApexTrackDerivedState,
} from './track/editor/ApexTrackDerivedState';
import {
  createApexTrackRuntimeCoordinator,
} from './track/runtime/ApexTrackRuntimeCoordinator';
import {
  APEX_TRACK_DRAFT_FORMAT,
  APEX_TRACK_DRAFT_FORMAT_VERSION,
  loadApexTrackDraft,
  saveApexTrackDraft,
} from './track/editor/ApexTrackDraftStorage';
import {
  TEST_TRACK_ACTUAL_MAX_BANK_DEGREES,
  TEST_TRACK_CURVE,
  TEST_TRACK_GROUND_HEIGHT_M,
  TEST_TRACK_LANE_COUNT,
  TEST_TRACK_MAX_ELEVATION_M,
  TEST_TRACK_POINTS,
  TEST_TRACK_SAFETY,
  TEST_TRACK_SPLINE_POINTS,
  TEST_TRACK_SPLINE_SAMPLE_COUNT,
  TEST_TRACK_SHOULDER_WIDTH_M,
  TEST_TRACK_THICKNESS_M,
  TEST_TRACK_WIDTH_M,
  TEST_TRACK_IS_CLOSED,
  TEST_TRACK_WORLD_SIZE_M as FLOOR_SIZE_M,
  type TrackPoint,
  trackBankRadiansAt,
} from './track/ApexTestTrack';
import {
  ApexTrackSegmentCollisionRegistry,
} from './track/physics/ApexTrackSegmentCollisionRegistry';
import {
  TRACK_GUARDRAIL_POST_HEIGHT_M,
  TRACK_GUARDRAIL_POST_WIDTH_M,
  TRACK_GUARDRAIL_VISUAL_HEIGHT_M,
} from './track/TrackSafetySystem';
import { resolveTrackRoadsideWidthM } from './track/TrackRoadsideWidth';
import {
  createTrackShoulderProfile,
  solveTrackShoulderConfluences,
  type TrackShoulderProfile,
} from './track/TrackShoulderSystem';
import type { ApexUiRuntime } from './ui/ApexUiRuntime';
import { ApexAboutPanel } from './ui/ApexAboutPanel';
import { LapTimingHud } from './ui/LapTimingHud';
import { ApexAutonomousPanel } from './ui/ApexAutonomousPanel';
import { RacingHudSvg } from './ui/RacingHudSvg';
import {
  ApexTechnicalTelemetryHud,
} from './ui/ApexTechnicalTelemetryHud';
import {
  APEX_CAR_CATALOG,
  carFromVehicleSpecification,
  findApexCar,
  replaceApexCarCatalog,
  type ApexCarDefinition,
} from './vehicle/ApexCarCatalog';
import { configureApexCarMaterial } from './vehicle/ApexCarMaterials';
import {
  ApexAutonomousDriver,
  type ApexAutonomousObstacle,
} from './vehicle/ApexAutonomousDriver';
import { ApexParkingCoverLoader } from './vehicle/ApexParkingCoverLoader';
import {
  APEX_PARKING_PREVIEW,
  createApexParkingSpawn,
  resolveApexParkingBayPosition,
} from './world/ApexParkingLot';
import {
  createApexWorldStaticCollisionGroups,
} from './world/physics/ApexWorldStaticCollisionBuilder';
import './style.css';

type UiMode = 'off' | 'read' | 'tuning';

document.documentElement.dataset.apexDriveProfile = APEX_DRIVE_RUNTIME_PROFILE;
if (APEX_DRIVE_PUBLIC_DEMO) {
  document.title = 'APEX Drive · Ignition';
}

const searchParams = new URLSearchParams(window.location.search);
const trackEditorMode = searchParams.get('edit') === 'track';
const requestedTrackEditorSegmentId = (
  searchParams.get('editSegment')?.trim() || undefined
);
const canvas = document.querySelector<HTMLCanvasElement>('#render-canvas')!;
const startupPreloader = document.querySelector<HTMLElement>(
  '#apex-drive-preloader',
);
let startupPresentationComplete = false;
const revealApexDrive = () => {
  if (startupPresentationComplete) return;
  startupPresentationComplete = true;
  document.documentElement.classList.remove('apex-drive-loading');
  document.documentElement.classList.add('apex-drive-loaded');
  window.setTimeout(() => startupPreloader?.remove(), 520);
};
canvas.dataset.trackNumber = formatApexDriveTrackNumber(
  ACTIVE_TRACK.track.number,
);
canvas.dataset.trackId = ACTIVE_TRACK.track.id;
canvas.dataset.trackName = ACTIVE_TRACK.track.name;
canvas.dataset.trackVersion = ACTIVE_TRACK.track.version;
canvas.dataset.trackSource = ACTIVE_TRACK_SOURCE
  ? `generated-apex-track-source-v${ACTIVE_TRACK_SOURCE.serializedFormatVersion}`
  : 'typescript-fallback';
canvas.dataset.trackNetworkSegmentCount = String(
  ACTIVE_TRACK_SOURCE?.segments.length ?? 1,
);
canvas.dataset.trackNetworkPrimarySegment = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.id ?? 'main'
);
canvas.dataset.trackFormat = [
  ACTIVE_TRACK.format,
  ACTIVE_TRACK.formatVersion,
].join('@');
const importedTrackCollisionOnly = (
  ACTIVE_TRACK.track.id === CIRCUITO_CHALLHUACO_ID
);
canvas.dataset.trackVisualAuthority = importedTrackCollisionOnly
  ? 'imported-gltf'
  : 'procedural';
canvas.dataset.trackCollisionAuthority = importedTrackCollisionOnly
  ? 'procedural-hidden-ribbon'
  : 'procedural';
const telemetryContainer = document.querySelector<HTMLDivElement>('#telemetry-root')!;
const visualControlsRoot = document.querySelector<HTMLElement>('#visual-controls')!;
const trackSelect = document.querySelector<HTMLSelectElement>('#track-select')!;
const trackEditorToggle = document.querySelector<HTMLButtonElement>(
  '#track-editor-toggle',
)!;
const assetLibrarySelect = document.querySelector<HTMLSelectElement>(
  '#asset-library-select',
)!;
const assetLibraryLoad = document.querySelector<HTMLButtonElement>(
  '#asset-library-load',
)!;
const assetLibraryRefresh = document.querySelector<HTMLButtonElement>(
  '#asset-library-refresh',
)!;
const assetLibraryStatus = document.querySelector<HTMLElement>(
  '#asset-library-status',
)!;
const trackEditorVehicleEntryStorageKey = [
  'apex-run.v3.track-editor-vehicle-entry.v1',
  ACTIVE_TRACK.track.id,
  ACTIVE_TRACK.track.version,
].join('.');
const vehicleKindSelect = document.querySelector<HTMLSelectElement>('#vehicle-kind')!;
const vehicleColorInput = document.querySelector<HTMLInputElement>('#vehicle-color')!;
const vehicleColorLabel = vehicleColorInput.closest<HTMLLabelElement>('label')!;
const vehicleWorkshopRoot = document.querySelector<HTMLElement>(
  '#vehicle-workshop',
)!;
const vehicleWorkshopToggle = document.querySelector<HTMLButtonElement>(
  '#vehicle-workshop-toggle',
)!;
const vehicleWorkshopPanel = document.querySelector<HTMLElement>(
  '#vehicle-workshop-panel',
)!;
const vehicleWorkshopColorSlot = document.querySelector<HTMLElement>(
  '#vehicle-workshop-color-slot',
)!;
const vehicleWorkshopCarSelect = document.querySelector<HTMLSelectElement>(
  '#vehicle-workshop-car',
)!;
const environmentQuickMenu = document.querySelector<HTMLElement>(
  '#environment-quick-menu',
)!;
const environmentQuickButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(
    '[data-environment-profile]',
  ),
);
if (APEX_DRIVE_PUBLIC_DEMO) {
  new ApexAboutPanel(document.body, {
    version: '0.0',
    repositoryUrl: 'https://github.com/jvsysarch/apex/tree/main/packages/apex-physics',
    linkedinUrl: 'https://ar.linkedin.com/in/jonathanvillaverde',
  });
}
const technicalTelemetryHud = APEX_DRIVE_PUBLIC_DEMO
  ? new ApexTechnicalTelemetryHud(document.body)
  : undefined;
const vehiclePhysicsDebugInput = document.querySelector<HTMLInputElement>(
  '#vehicle-physics-debug',
)!;
const vehiclePhysicsDebugInfo = document.querySelector<HTMLElement>(
  '#vehicle-physics-debug-info',
)!;
const chassisBoxCenterYInput = document.querySelector<HTMLInputElement>(
  '#chassis-box-center-y',
)!;
const chassisBoxCenterYOutput = document.querySelector<HTMLOutputElement>(
  '#chassis-box-center-y-value',
)!;
const chassisBoxCenterYApply = document.querySelector<HTMLButtonElement>(
  '#chassis-box-center-y-apply',
)!;
const chassisBoxCenterYInfo = document.querySelector<HTMLElement>(
  '#chassis-box-center-y-info',
)!;
const renderProfileSelect = document.querySelector<HTMLSelectElement>(
  '#render-profile',
)!;
const renderProfileInfo = document.querySelector<HTMLElement>(
  '#render-profile-info',
)!;
const tireDeformationModeSelect = document.querySelector<HTMLSelectElement>(
  '#tire-deformation-mode',
)!;
const tireDeformationInfo = document.querySelector<HTMLElement>(
  '#tire-deformation-info',
)!;
const renderPerformanceFps = document.querySelector<HTMLOutputElement>(
  '#render-performance-fps',
)!;
const renderPerformanceFrame = document.querySelector<HTMLOutputElement>(
  '#render-performance-frame',
)!;
const renderPerformancePhysics = document.querySelector<HTMLMeterElement>(
  '#render-performance-physics',
)!;
const renderPerformancePhysicsValue = document.querySelector<HTMLOutputElement>(
  '#render-performance-physics-value',
)!;
const renderPerformanceTire = document.querySelector<HTMLMeterElement>(
  '#render-performance-tire',
)!;
const renderPerformanceTireValue = document.querySelector<HTMLOutputElement>(
  '#render-performance-tire-value',
)!;
const renderPerformanceRender = document.querySelector<HTMLMeterElement>(
  '#render-performance-render',
)!;
const renderPerformanceRenderValue = document.querySelector<HTMLOutputElement>(
  '#render-performance-render-value',
)!;
const renderPerformanceOther = document.querySelector<HTMLMeterElement>(
  '#render-performance-other',
)!;
const renderPerformanceOtherValue = document.querySelector<HTMLOutputElement>(
  '#render-performance-other-value',
)!;
const controlledBenchmarkStart = document.querySelector<HTMLButtonElement>(
  '#controlled-benchmark-start',
)!;
const controlledBenchmarkCopy = document.querySelector<HTMLButtonElement>(
  '#controlled-benchmark-copy',
)!;
const controlledBenchmarkStatus = document.querySelector<HTMLElement>(
  '#controlled-benchmark-status',
)!;
const parkingCarSelector = document.querySelector<HTMLElement>('#parking-car-selector')!;
const parkingCarPrevious = document.querySelector<HTMLButtonElement>('#parking-car-previous')!;
const parkingCarNext = document.querySelector<HTMLButtonElement>('#parking-car-next')!;
const parkingCarUp = document.querySelector<HTMLButtonElement>('#parking-car-up')!;
const parkingCarDown = document.querySelector<HTMLButtonElement>('#parking-car-down')!;
const parkingCarConfirm = document.querySelector<HTMLButtonElement>('#parking-car-confirm')!;
const parkingCarName = document.querySelector<HTMLOutputElement>('#parking-car-name')!;
const parkingCarColorInput = document.querySelector<HTMLInputElement>('#parking-car-color')!;
const parkingNavigationIndicator = document.querySelector<HTMLElement>(
  '#parking-navigation-indicator',
)!;
const parkingIndicatorIndex = document.querySelector<HTMLOutputElement>(
  '#parking-indicator-index',
)!;
const parkingIndicatorTotal = document.querySelector<HTMLOutputElement>(
  '#parking-indicator-total',
)!;
const parkingIndicatorName = document.querySelector<HTMLOutputElement>(
  '#parking-indicator-name',
)!;
const parkingIndicatorPrevious = document.querySelector<HTMLButtonElement>(
  '#parking-indicator-previous',
)!;
const parkingIndicatorNext = document.querySelector<HTMLButtonElement>(
  '#parking-indicator-next',
)!;
const parkingIndicatorConfirm = document.querySelector<HTMLButtonElement>(
  '#parking-indicator-confirm',
)!;
const cameraModeSelect = document.querySelector<HTMLSelectElement>('#camera-mode-select')!;
const cameraModeOutput = document.querySelector<HTMLOutputElement>('#camera-mode')!;
const cameraHelp = document.querySelector<HTMLElement>('#camera-help')!;
const autonomousDriveButton = document.querySelector<HTMLButtonElement>('#autonomous-drive')!;
const autonomousDriveStatus = document.querySelector<HTMLElement>('#autonomous-drive-status')!;
const controllerStatus = document.querySelector<HTMLElement>('#controller-status')!;
const engineVolumeInput = document.querySelector<HTMLInputElement>('#engine-volume')!;
const engineVolumeOutput = document.querySelector<HTMLOutputElement>('#engine-volume-value')!;
const soundStatus = document.querySelector<HTMLElement>('#sound-status')!;
const copyRacingLineButton = document.querySelector<HTMLButtonElement>(
  '#copy-racing-line',
)!;
const racingLineStatus = document.querySelector<HTMLElement>('#racing-line-status')!;
const sportHudContainer = document.querySelector<HTMLElement>('#sport-hud')!;
const sportHudRoot = document.querySelector<HTMLElement>('#sport-hud-svg')!;
const sportHud = new RacingHudSvg(sportHudRoot);
const lapTimerRoot = document.querySelector<HTMLElement>('#lap-timer')!;
const lapTimingHudVisible = true;
const autonomousPanelRoot = document.querySelector<HTMLElement>(
  '#autonomous-panel',
)!;
const autonomousPanelVisible = false;
const autonomousSimulationSpeedSelect = (
  document.querySelector<HTMLSelectElement>('#ai-simulation-speed')!
);
const autonomousSimulationSpeedStorageKey = (
  'apex-run.v3.autonomous-simulation-speed'
);
const autonomousSimulationSpeeds = Object.freeze([1, 2, 4, 8]);
const storedAutonomousSimulationSpeed = Number(
  localStorage.getItem(autonomousSimulationSpeedStorageKey),
);
let autonomousSimulationSpeed = autonomousSimulationSpeeds.includes(
  storedAutonomousSimulationSpeed,
)
  ? storedAutonomousSimulationSpeed
  : 1;
autonomousSimulationSpeedSelect.value = String(autonomousSimulationSpeed);
autonomousSimulationSpeedSelect.addEventListener('change', () => {
  const requestedSpeed = Number(autonomousSimulationSpeedSelect.value);
  autonomousSimulationSpeed = autonomousSimulationSpeeds.includes(
    requestedSpeed,
  )
    ? requestedSpeed
    : 1;
  autonomousSimulationSpeedSelect.value = String(autonomousSimulationSpeed);
  localStorage.setItem(
    autonomousSimulationSpeedStorageKey,
    String(autonomousSimulationSpeed),
  );
  canvas.dataset.autonomousSimulationSpeed = (
    `${autonomousSimulationSpeed}x`
  );
});
canvas.dataset.autonomousSimulationSpeed = `${autonomousSimulationSpeed}x`;
const lapTimingHud = new LapTimingHud(lapTimerRoot);
lapTimerRoot.hidden = !lapTimingHudVisible;
const trackTiming = ACTIVE_TRACK.configuration.timing;
const timingTrackPoints = TEST_TRACK_IS_CLOSED
  ? TEST_TRACK_POINTS.slice(0, -1)
  : TEST_TRACK_POINTS;
const lapTimingCheckpoints = timingTrackPoints
  .map((point, index) => ({ point, index }))
  .filter(({ index }) => (
    index > 0
    && index < timingTrackPoints.length - trackTiming.ignoredTailPoints
    && index % trackTiming.checkpointIntervalPoints === 0
  ))
  .map(({ point }, index) => Object.freeze({
    x: point.x,
    z: point.z,
    radiusM: trackTiming.checkpointRadiusM,
    label: `Control ${index + 1}`,
  }));
const lapTimer = new ApexLapTimer(
  Object.freeze({
    x: TEST_TRACK_POINTS[0].x,
    z: TEST_TRACK_POINTS[0].z,
    radiusM: trackTiming.startRadiusM,
    label: 'Salida / meta',
  }),
  Object.freeze(lapTimingCheckpoints),
  trackTiming.sectorCount,
  trackTiming.storageKey,
);
if (!TEST_TRACK_IS_CLOSED) {
  const finishPoint = TEST_TRACK_POINTS[TEST_TRACK_POINTS.length - 1];
  lapTimer.configureTrack(
    Object.freeze({
      x: TEST_TRACK_POINTS[0].x,
      z: TEST_TRACK_POINTS[0].z,
      radiusM: trackTiming.startRadiusM,
      label: 'Salida',
    }),
    Object.freeze(lapTimingCheckpoints),
    trackTiming.sectorCount,
    false,
    Object.freeze({
      x: finishPoint.x,
      z: finishPoint.z,
      radiusM: trackTiming.startRadiusM,
      label: 'Llegada',
    }),
  );
}
const auditKind = APEX_DRIVE_PUBLIC_DEMO
  ? null
  : searchParams.get('audit');
const isAuditRuntime = auditKind !== null;
const guardrailAuditEnabled = auditKind === 'guardrail';
const vehicleKindStorageKey = 'apex-v3-vehicle-kind';
const selectedCarStorageKey = 'apex-v3-selected-car.v2';
const requestedVehicleKind = APEX_DRIVE_PUBLIC_DEMO
  ? 'car'
  : searchParams.get('vehicle');
const configuredVehicleManifest = (
  import.meta.env.VITE_APEX_DRIVE_VEHICLE_MANIFEST
)?.trim();
const configuredVehicleManifests = (() => {
  const encodedManifests = (
    import.meta.env.VITE_APEX_DRIVE_VEHICLE_MANIFESTS
  )?.trim();
  if (!encodedManifests) {
    return configuredVehicleManifest ? [configuredVehicleManifest] : [];
  }
  const manifests = JSON.parse(encodedManifests) as unknown;
  if (
    !Array.isArray(manifests)
    || manifests.some(manifest => typeof manifest !== 'string')
  ) {
    throw new Error(
      'VITE_APEX_DRIVE_VEHICLE_MANIFESTS debe ser una lista de URLs.',
    );
  }
  return manifests.map(manifest => manifest.trim()).filter(Boolean);
})();
const requestedVehicleManifest = APEX_DRIVE_PUBLIC_DEMO
  ? undefined
  : searchParams.get('vehicleManifest')?.trim();
const studioVehicleId = APEX_DRIVE_PUBLIC_DEMO
  ? undefined
  : searchParams.get('studioVehicleId')?.trim();
const studioVehicleRevision = APEX_DRIVE_PUBLIC_DEMO
  ? undefined
  : searchParams.get('studioVehicleRevision')?.trim();
const loadStudioVehicle = async (): Promise<
  ApexDriveCarSpecification | undefined
> => {
  if (!studioVehicleId || !studioVehicleRevision) return undefined;
  const encodedId = encodeURIComponent(studioVehicleId);
  const encodedRevision = encodeURIComponent(studioVehicleRevision);
  const response = await fetch(
    `http://127.0.0.1:5180/api/void/drive-cars/${encodedId}`
    + `/revisions/${encodedRevision}/files/vehicle.json`,
  );
  if (!response.ok) {
    throw new Error(
      `APEX Void no pudo cargar ${studioVehicleId} (${response.status})`,
    );
  }
  return parseApexDriveCarSpecification(await response.json());
};
const loadVehicleManifest = async (
  configuredManifest: string,
): Promise<ApexDriveCarSpecification> => {
  const manifestUrl = (() => {
    try {
      return new URL(configuredManifest).toString();
    } catch {
      return new URL(
        apexDrivePublicUrl(configuredManifest),
        window.location.href,
      ).toString();
    }
  })();
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el manifiesto del vehículo (${response.status})`,
    );
  }
  const document = await response.json() as {
    asset?: { modelUrl?: string; revision?: string };
  };
  if (document.asset?.modelUrl) {
    const configuredModelUrl = document.asset.modelUrl;
    const modelUrl = (() => {
      try {
        return new URL(configuredModelUrl);
      } catch {
        const assetUrl = /^\/?assets\//.test(configuredModelUrl)
          ? apexDrivePublicUrl(configuredModelUrl)
          : configuredModelUrl;
        return new URL(assetUrl, manifestUrl);
      }
    })();
    if (document.asset.revision) {
      modelUrl.searchParams.set('revision', document.asset.revision);
    }
    document.asset.modelUrl = modelUrl.toString();
  }
  return parseApexDriveCarSpecification(document);
};
const loadedVehicleSpecifications = await (async () => {
  const studioVehicle = await loadStudioVehicle();
  if (studioVehicle) return [studioVehicle];
  const manifests = configuredVehicleManifests.length > 0
    ? configuredVehicleManifests
    : requestedVehicleManifest
      ? [requestedVehicleManifest]
      : [];
  return Promise.all(manifests.map(loadVehicleManifest));
})().catch(error => {
  if (APEX_DRIVE_PUBLIC_DEMO) throw error;
  console.error(error);
  return [] as ApexDriveCarSpecification[];
});
const configuredCars = loadedVehicleSpecifications.map(
  carFromVehicleSpecification,
);
replaceApexCarCatalog(configuredCars);
const canonicalFallbackCar = (
  findApexCar('apex-demo-car-001')
  ?? APEX_CAR_CATALOG[0]
);
if (!canonicalFallbackCar) {
  throw new Error(
    'APEX Drive requiere un manifiesto de vehículo provisto por la aplicación.',
  );
}
const publicGarageCarIds = Object.freeze([
  'ford-mustang-shelby-gt500',
  'rambo',
  '130',
]);
const parkingCarCatalog: readonly ApexCarDefinition[] = APEX_DRIVE_PUBLIC_DEMO
  ? publicGarageCarIds.map(findApexCar).filter(
    (definition): definition is ApexCarDefinition => definition !== undefined,
  )
  : APEX_CAR_CATALOG;
const defaultCar = (
  APEX_DRIVE_PUBLIC_DEMO
    ? findApexCar('ford-mustang-shelby-gt500')
    : canonicalFallbackCar
) ?? canonicalFallbackCar;
const requestedCarCandidate = findApexCar(searchParams.get('car'));
const requestedCar = (
  !APEX_DRIVE_PUBLIC_DEMO
  || (
    requestedCarCandidate !== undefined
    && parkingCarCatalog.includes(requestedCarCandidate)
  )
) ? requestedCarCandidate : undefined;
const requestedMotorcycle = APEX_DRIVE_PUBLIC_DEMO
  ? undefined
  : findApexMotorcycle(searchParams.get('motorcycle'));
const savedCarCandidate = findApexCar(
  localStorage.getItem(selectedCarStorageKey),
);
const savedCar = (
  !APEX_DRIVE_PUBLIC_DEMO
  || (
    savedCarCandidate !== undefined
    && parkingCarCatalog.includes(savedCarCandidate)
  )
) ? savedCarCandidate : undefined;
const activeVehicleKind: ApexVehicleKind = isAuditRuntime
  ? 'car'
  : requestedVehicleKind === 'motorcycle' || requestedMotorcycle
    ? 'motorcycle'
    : requestedVehicleKind === 'car' || requestedCar || configuredCars.length > 0
      ? 'car'
      : 'car';
const activeCar = requestedCar ?? savedCar ?? defaultCar;
const activeVehicleSpecification = activeCar.vehicleSpecification;
const activeMotorcycle = requestedMotorcycle ?? DEFAULT_APEX_MOTORCYCLE;
const carPhysicsDefinitionFor = (
  definition: ApexCarDefinition,
): ApexCarPhysicsDefinition => {
  const physicsDefinition = APEX_VEHICLE_DEFINITIONS.get(
    definition.physicsDefinitionId,
  );
  if (!physicsDefinition || physicsDefinition.kind !== 'car') {
    throw new Error(
      `No existe la definición física de automóvil ${definition.physicsDefinitionId}`,
    );
  }
  const specification = definition.vehicleSpecification;
  if (!specification) return physicsDefinition;
  const frontLeft = specification.wheels['front-left'];
  const frontRight = specification.wheels['front-right'];
  const rearLeft = specification.wheels['rear-left'];
  const rearRight = specification.wheels['rear-right'];
  const frontAxleZ = (frontLeft.positionM[2] + frontRight.positionM[2]) * 0.5;
  const rearAxleZ = (rearLeft.positionM[2] + rearRight.positionM[2]) * 0.5;
  const physicalWheels = [frontLeft, frontRight, rearLeft, rearRight];
  const collision = specification.collision.chassisBox;
  return Object.freeze({
    ...physicsDefinition,
    id: `${physicsDefinition.id}:${specification.id}@${specification.version}`,
    dimensions: Object.freeze({
      ...physicsDefinition.dimensions,
      lengthM: specification.dimensions.lengthM,
      widthM: specification.dimensions.widthM,
      chassisHeightM: collision.heightM,
      wheelbaseM: frontAxleZ - rearAxleZ,
      frontTrackM: Math.abs(
        frontRight.positionM[0] - frontLeft.positionM[0],
      ),
      rearTrackM: Math.abs(
        rearRight.positionM[0] - rearLeft.positionM[0],
      ),
      axleCenterOffsetM: (frontAxleZ + rearAxleZ) * 0.5,
      wheelRadiusM: physicalWheels.reduce(
        (total, wheel) => total + wheel.radiusM,
        0,
      ) / physicalWheels.length,
      wheelWidthM: physicalWheels.reduce(
        (total, wheel) => total + wheel.widthM,
        0,
      ) / physicalWheels.length,
      centerOfMassOffsetM: specification.dynamics.centerOfMassM[1],
    }),
    chassisBox: Object.freeze({
      lengthM: collision.lengthM,
      widthM: collision.widthM,
      frontWidthM: collision.frontWidthM,
      rearWidthM: collision.rearWidthM,
      heightM: collision.heightM,
      centerOffsetYM:
        collision.centerM[1] - specification.dynamics.centerOfMassM[1],
    }),
    massKg: specification.dynamics.massKg,
  });
};
const baseActiveCarPhysicsDefinition = carPhysicsDefinitionFor(activeCar);
const chassisBoxCenterYStorageKey = 'apex-drive.car-chassis-box-center-y.v2';
const minimumChassisBoxCenterYM = -0.2;
const maximumChassisBoxCenterYM = 0.45;
const storedChassisBoxCenterYValue = localStorage.getItem(
  chassisBoxCenterYStorageKey,
);
const storedChassisBoxCenterYM = storedChassisBoxCenterYValue === null
  ? Number.NaN
  : Number(storedChassisBoxCenterYValue);
const configuredChassisBoxCenterYM = (
  !isAuditRuntime
  && !activeVehicleSpecification
  && Number.isFinite(storedChassisBoxCenterYM)
)
  ? Math.min(
    maximumChassisBoxCenterYM,
    Math.max(minimumChassisBoxCenterYM, storedChassisBoxCenterYM),
  )
  : baseActiveCarPhysicsDefinition.chassisBox.centerOffsetYM;
const activeCarPhysicsDefinition: ApexCarPhysicsDefinition = Object.freeze({
  ...baseActiveCarPhysicsDefinition,
  chassisBox: Object.freeze({
    ...baseActiveCarPhysicsDefinition.chassisBox,
    centerOffsetYM: configuredChassisBoxCenterYM,
  }),
});
const activeMotorcyclePhysicsDefinition: ApexMotorcyclePhysicsDefinition = (
  activeMotorcycle.definition
);
const activeVehiclePhysicsDefinition = activeVehicleKind === 'motorcycle'
  ? activeMotorcyclePhysicsDefinition
  : activeCarPhysicsDefinition;
const activeCarDimensions = activeCarPhysicsDefinition.dimensions;
chassisBoxCenterYInput.value = configuredChassisBoxCenterYM.toFixed(2);
chassisBoxCenterYOutput.value = `${configuredChassisBoxCenterYM.toFixed(2)} m`;
chassisBoxCenterYInput.disabled = (
  activeVehicleKind !== 'car'
  || isAuditRuntime
  || Boolean(activeVehicleSpecification)
);
chassisBoxCenterYApply.disabled = chassisBoxCenterYInput.disabled;
chassisBoxCenterYInfo.textContent = isAuditRuntime
  ? 'Auditoría · usa la geometría oficial'
  : activeVehicleSpecification
    ? 'Definido por Vehicle Studio · editar y publicar una revisión'
    : activeVehicleKind === 'car'
    ? 'Centro vertical respecto de la masa · vista previa'
    : 'Disponible para automóviles';
canvas.dataset.chassisBoxCenterYM = configuredChassisBoxCenterYM.toFixed(3);
canvas.dataset.chassisBoxCenterYSource = (
  !isAuditRuntime
  && !activeVehicleSpecification
  && Number.isFinite(storedChassisBoxCenterYM)
)
  ? 'local-experiment'
  : 'vehicle-definition';
vehiclePhysicsDebugInfo.textContent = activeVehicleKind === 'car'
  ? [
    `${activeCarPhysicsDefinition.massKg} kg`,
    `caja ${activeCarPhysicsDefinition.chassisBox.widthM.toFixed(2)} × ${activeCarPhysicsDefinition.chassisBox.heightM.toFixed(2)} × ${activeCarPhysicsDefinition.chassisBox.lengthM.toFixed(2)} m`,
    `anchos F/R ${(activeCarPhysicsDefinition.chassisBox.frontWidthM ?? activeCarPhysicsDefinition.chassisBox.widthM).toFixed(2)} / ${(activeCarPhysicsDefinition.chassisBox.rearWidthM ?? activeCarPhysicsDefinition.chassisBox.widthM).toFixed(2)} m`,
    `centro Y ${activeCarPhysicsDefinition.chassisBox.centerOffsetYM.toFixed(2)} m`,
    `rueda R${activeCarDimensions.wheelRadiusM.toFixed(3)} / A${activeCarDimensions.wheelWidthM.toFixed(3)} m`,
    `batalla ${activeCarDimensions.wheelbaseM.toFixed(3)} m`,
    `trochas ${activeCarDimensions.frontTrackM.toFixed(3)} / ${activeCarDimensions.rearTrackM.toFixed(3)} m`,
  ].join(' · ')
  : [
    `${activeMotorcyclePhysicsDefinition.massKg} kg`,
    `caja ${activeMotorcyclePhysicsDefinition.chassisBox.widthM.toFixed(2)} × ${activeMotorcyclePhysicsDefinition.chassisBox.heightM.toFixed(2)} × ${activeMotorcyclePhysicsDefinition.chassisBox.lengthM.toFixed(2)} m`,
    `rueda R${activeMotorcyclePhysicsDefinition.dimensions.wheelRadiusM.toFixed(3)} / A${activeMotorcyclePhysicsDefinition.dimensions.wheelWidthM.toFixed(3)} m`,
  ].join(' · ');
trackSelect.replaceChildren(...ACTIVE_TRACK_OPTIONS.map(track => {
  const option = document.createElement('option');
  option.value = track.track.id;
  option.textContent = [
    formatApexDriveTrackNumber(track.track.number),
    track.track.name,
  ].join(' · ');
  return option;
}));
trackSelect.value = ACTIVE_TRACK.track.id;
trackSelect.disabled = isAuditRuntime || APEX_DRIVE_PUBLIC_DEMO;
trackSelect.addEventListener('change', () => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('track', trackSelect.value);
  nextUrl.searchParams.set('vehicle', activeVehicleKind);
  if (activeVehicleKind === 'car') {
    nextUrl.searchParams.set('car', activeCar.id);
    nextUrl.searchParams.delete('motorcycle');
  } else {
    nextUrl.searchParams.delete('car');
    nextUrl.searchParams.set('motorcycle', activeMotorcycle.id);
  }
  nextUrl.searchParams.delete('drive');
  window.location.href = nextUrl.toString();
});
trackEditorToggle.textContent = trackEditorMode
  ? 'Salir del editor'
  : 'Editar pista';
trackEditorToggle.dataset.active = String(trackEditorMode);
trackEditorToggle.disabled = isAuditRuntime || APEX_DRIVE_PUBLIC_DEMO;
trackEditorToggle.addEventListener('click', () => {
  const nextUrl = new URL(window.location.href);
  if (trackEditorMode) {
    nextUrl.searchParams.delete('edit');
  } else {
    const vehiclePosition = canvas.dataset.vehiclePosition
      ?.split(',')
      .map(Number);
    const vehicleHeadingRadians = Number(canvas.dataset.vehicleHeading);
    if (
      vehiclePosition?.length === 3
      && vehiclePosition.every(Number.isFinite)
    ) {
      try {
        window.sessionStorage.setItem(
          trackEditorVehicleEntryStorageKey,
          JSON.stringify({
            format: 'apex-track-editor-vehicle-entry@1',
            position: vehiclePosition,
            headingRadians: Number.isFinite(vehicleHeadingRadians)
              ? vehicleHeadingRadians
              : 0,
          }),
        );
      } catch {
        // El editor conserva su cámara persistida si sessionStorage no está disponible.
      }
    }
    nextUrl.searchParams.set('edit', 'track');
  }
  nextUrl.searchParams.set('vehicle', activeVehicleKind);
  if (activeVehicleKind === 'car') {
    nextUrl.searchParams.set('car', activeCar.id);
    nextUrl.searchParams.delete('motorcycle');
  } else {
    nextUrl.searchParams.delete('car');
    nextUrl.searchParams.set('motorcycle', activeMotorcycle.id);
  }
  nextUrl.searchParams.delete('drive');
  window.location.href = nextUrl.toString();
});
let runtimeCar = activeCar;
const carColorStorageKey = (definition: ApexCarDefinition): string => (
  `apex-v3-car-paint.${definition.id}`
);
const storedCarColor = (definition: ApexCarDefinition): string => (
  localStorage.getItem(carColorStorageKey(definition))
    ?? definition.visual.defaultPaintColor
);
const experienceMode = searchParams.get('drive');
const isParkingSelection = (
  !isAuditRuntime
  && activeVehicleKind === 'car'
  && (requestedVehicleKind === null || APEX_DRIVE_PUBLIC_DEMO)
  && (experienceMode === null || experienceMode === 'parking')
  && !trackEditorMode
);
const isParkingDrive = (
  !isAuditRuntime
  && activeVehicleKind === 'car'
  && experienceMode === 'parking-drive'
  && ACTIVE_TRACK.track.id !== CIRCUITO_CHALLHUACO_ID
);
const runtimeCarCatalog = parkingCarCatalog;
const carOptions = runtimeCarCatalog.map(definition => {
  const option = document.createElement('option');
  option.value = `car:${definition.id}`;
  option.textContent = definition.name;
  return option;
});
const motorcycleOptions = APEX_MOTORCYCLE_CATALOG.map(entry => {
  const option = document.createElement('option');
  option.value = `motorcycle:${entry.id}`;
  option.textContent = entry.name;
  return option;
});
vehicleKindSelect.replaceChildren(...carOptions, ...motorcycleOptions);
vehicleKindSelect.value = activeVehicleKind === 'car'
  ? `car:${activeCar.id}`
  : `motorcycle:${activeMotorcycle.id}`;
vehicleKindSelect.disabled = isAuditRuntime || APEX_DRIVE_PUBLIC_DEMO;
let pendingParkingCarId: string | null = null;
let selectCarInParkingHook = (carId: string): boolean => {
  pendingParkingCarId = carId;
  return true;
};
vehicleKindSelect.addEventListener('change', () => {
  const selectedValue = vehicleKindSelect.value;
  const nextKind: ApexVehicleKind = selectedValue.startsWith('motorcycle:')
    ? 'motorcycle'
    : 'car';
  localStorage.setItem(vehicleKindStorageKey, nextKind);
  if (nextKind === 'car') {
    const selectedCarId = selectedValue.replace(/^car:/, '');
    const selectedCar = findApexCar(selectedCarId) ?? defaultCar;
    selectCarInParkingHook(selectedCar.id);
    return;
  }
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('vehicle', nextKind);
  const selectedMotorcycleId = selectedValue.replace(/^motorcycle:/, '');
  const selectedMotorcycle = (
    findApexMotorcycle(selectedMotorcycleId) ?? DEFAULT_APEX_MOTORCYCLE
  );
  nextUrl.searchParams.set('motorcycle', selectedMotorcycle.id);
  nextUrl.searchParams.delete('car');
  window.location.href = nextUrl.toString();
});
vehicleColorLabel.hidden = activeVehicleKind === 'motorcycle';
if (APEX_DRIVE_PUBLIC_DEMO && activeVehicleKind === 'car') {
  vehicleWorkshopCarSelect.replaceChildren(
    ...runtimeCarCatalog.map(definition => {
      const option = document.createElement('option');
      option.value = definition.id;
      option.textContent = definition.name;
      return option;
    }),
  );
  vehicleWorkshopCarSelect.value = activeCar.id;
  vehicleWorkshopCarSelect.addEventListener('change', () => {
    const selectedCar = findApexCar(vehicleWorkshopCarSelect.value);
    if (!selectedCar) return;
    selectCarInParkingHook(selectedCar.id);
  });
  vehicleWorkshopColorSlot.append(vehicleColorInput);
  vehicleWorkshopRoot.hidden = isParkingSelection;
  vehicleWorkshopPanel.hidden = true;
  vehicleWorkshopToggle.setAttribute('aria-expanded', 'false');
  vehicleWorkshopToggle.setAttribute('aria-label', 'Ir al parking');
  vehicleWorkshopToggle.title = 'Parking';
  vehicleWorkshopToggle.addEventListener('click', () => {
    vehicleWorkshopPanel.hidden = true;
    selectCarInParkingHook(runtimeCar.id);
  });
}
canvas.dataset.vehicleKind = activeVehicleKind;
canvas.dataset.carId = activeVehicleKind === 'car' ? activeCar.id : '';
canvas.dataset.motorcycleId = activeVehicleKind === 'motorcycle'
  ? activeMotorcycle.id
  : '';
canvas.dataset.motorcycleExperimental = activeVehicleKind === 'motorcycle'
  ? String(activeMotorcycle.experimental)
  : 'false';
canvas.dataset.motorcycleTireModel = activeVehicleKind === 'motorcycle'
  ? activeMotorcyclePhysicsDefinition.defaultTireModel
  : '';
canvas.dataset.experienceMode = isParkingSelection
  ? 'parking-selection'
  : trackEditorMode
    ? 'track-editor'
    : isParkingDrive ? 'parking-drive' : 'circuit-drive';
const engineSynth = isAuditRuntime
  ? undefined
  : new EngineSynth(message => {
    soundStatus.textContent = message;
    canvas.dataset.audioStatus = message.includes('muestras')
      ? 'samples-ready'
      : message.includes('activo') ? 'synth-active' : 'locked';
  }, {
    sampleBaseUrl: (
      import.meta.env.VITE_APEX_DRIVE_ENGINE_SAMPLES_BASE_URL
    )?.trim() || undefined,
  });
engineVolumeInput.hidden = isAuditRuntime;
engineVolumeOutput.parentElement!.hidden = isAuditRuntime;
soundStatus.hidden = isAuditRuntime;
const engineVolumeStorageKey = 'apex-v3-engine-volume';
const storedEngineVolume = Number(localStorage.getItem(engineVolumeStorageKey));
if (Number.isFinite(storedEngineVolume)) {
  engineVolumeInput.value = String(
    THREE.MathUtils.clamp(storedEngineVolume, 0, 1),
  );
}
const applyEngineVolume = (persist = false) => {
  const volume = Number(engineVolumeInput.value);
  engineSynth?.setVolume(volume);
  engineVolumeOutput.value = `${Math.round(volume * 100)}%`;
  if (persist) localStorage.setItem(engineVolumeStorageKey, String(volume));
};
engineVolumeInput.addEventListener('input', () => applyEngineVolume(true));
applyEngineVolume();
window.addEventListener('pointerdown', () => engineSynth?.start(), {
  capture: true,
  passive: true,
});
window.addEventListener('keydown', () => engineSynth?.start());
const requestedUiMode = APEX_DRIVE_PUBLIC_DEMO
  ? 'off'
  : searchParams.get('ui');
const uiMode: UiMode = requestedUiMode === 'off' || requestedUiMode === 'tuning'
  ? requestedUiMode
  : searchParams.get('telemetry') === 'off' ? 'off' : 'read';
const driveAudit = auditKind === 'drive'
  ? new DeterministicDriveAudit()
  : undefined;
const raceAudit = auditKind === 'race'
  ? new RaceCircuitAudit()
  : undefined;
const requestedManeuver = searchParams.get('maneuver');
const tireManeuverId: TireManeuverId = requestedManeuver === 'straight-acceleration'
  || requestedManeuver === 'steering-tap'
  || requestedManeuver === 'countersteer'
  ? requestedManeuver
  : 'constant-radius';
const requestedPhysicsHz = Number(searchParams.get('physicsHz'));
const runtimePhysicsHz = requestedPhysicsHz === 60 || requestedPhysicsHz === 360
  ? requestedPhysicsHz
  : isAuditRuntime ? 60 : PHYSICS_HZ;
const requestedContactCount = Number(searchParams.get('contactCount'));
const runtimeContactCount = requestedContactCount === 2
  || requestedContactCount === 4
  || requestedContactCount === 8
  ? requestedContactCount
  : isAuditRuntime
    ? 4
    : activeVehicleKind === 'motorcycle' ? 4 : DEFAULT_TIRE_CONTACT_COUNT;
const tireExecutionPreference = searchParams.get('tireBackend') === 'typescript'
  ? 'typescript'
  : 'auto';
const tireManeuverAudit = auditKind === 'tire-maneuver'
  ? new TireManeuverAudit(tireManeuverId, runtimePhysicsHz)
  : undefined;
const requestedAuditModel = searchParams.get('auditModel');
const auditTireModel = requestedAuditModel === 'apex-v1'
  || requestedAuditModel === 'apex-v1.1'
  || requestedAuditModel === 'apex-v1.2'
  || requestedAuditModel === 'apex-brush-v1'
  || requestedAuditModel === 'apex-tmeasy-v1'
  || requestedAuditModel === 'apex-tmeasy-9p-v2'
  || requestedAuditModel === 'apex-multicontact-v1'
  ? requestedAuditModel
  : 'jolt-default';
const requestedAuditStage = searchParams.get('auditStage');
const auditHandlingStage: ApexHandlingStage = requestedAuditStage === 'mechanical-tc'
  || requestedAuditStage === 'tire-only'
  || requestedAuditStage === 'tire-benchmark'
  || requestedAuditStage === 'differentials'
  || requestedAuditStage === 'tire-v1.2'
  || requestedAuditStage === 'steering'
  || requestedAuditStage === 'suspension'
  || requestedAuditStage === 'aero'
  ? requestedAuditStage
  : 'legacy';
const requestedSwitchStep = Number(searchParams.get('auditSwitchStep'));
const auditSwitchStep = Number.isInteger(requestedSwitchStep) && requestedSwitchStep > 0
  ? requestedSwitchStep
  : undefined;
let uiRuntime: ApexUiRuntime | undefined;
let runtimeStatus = 'Cargando apex-physics.js…';

if (uiMode === 'off') {
  telemetryContainer.hidden = true;
  telemetryContainer.replaceChildren();
} else {
  const uiModule = await import('./ui/ApexUiRuntime');
  uiRuntime = uiMode === 'tuning'
    ? uiModule.createTuningUi(telemetryContainer)
    : uiModule.createReadOnlyUi(telemetryContainer);
}
if (isParkingSelection) {
  telemetryContainer.hidden = true;
  visualControlsRoot.hidden = true;
  sportHudContainer.hidden = true;
  lapTimerRoot.hidden = true;
}
if (APEX_DRIVE_PUBLIC_DEMO) {
  visualControlsRoot.hidden = true;
  trackEditorToggle.hidden = true;
}
canvas.dataset.uiMode = uiMode;
canvas.dataset.uiRuntimeLoaded = String(uiRuntime !== undefined);
canvas.dataset.sportHud = 'optimized-static-svg';

type ApexRenderProfileId = 'high' | 'balanced' | 'debug';
type ApexTireDeformationMode = 'gpu' | 'cpu' | 'off';
type ApexControlledBenchmarkPhase = 'high' | 'debug';

interface ApexControlledBenchmarkState {
  readonly format: 'apex-drive-controlled-benchmark@2';
  readonly status: 'running' | 'complete';
  readonly phase: ApexControlledBenchmarkPhase;
  readonly startedAt: string;
  readonly reports: Partial<Record<ApexControlledBenchmarkPhase, string>>;
  readonly restoreRenderProfile: ApexRenderProfileId;
  readonly restoreTireDeformationMode: ApexTireDeformationMode;
}

interface ApexRenderProfile {
  readonly id: ApexRenderProfileId;
  readonly label: string;
  readonly description: string;
  readonly antialias: boolean;
  readonly pixelRatioCap: number;
  readonly shadowMapSize: number;
  readonly shadows: boolean;
  readonly environment: boolean;
}

const renderProfiles: Readonly<Record<ApexRenderProfileId, ApexRenderProfile>> = {
  high: {
    id: 'high',
    label: 'Alta',
    description: 'Resolución alta, suavizado, HDRI y sombras completas.',
    antialias: true,
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    shadows: true,
    environment: true,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanceada',
    description: 'Menor resolución interna y sombras de 1024 px.',
    antialias: true,
    pixelRatioCap: 1.25,
    shadowMapSize: 1024,
    shadows: true,
    environment: true,
  },
  debug: {
    id: 'debug',
    label: 'Debug',
    description: 'Resolución mínima, sin suavizado, HDRI ni sombras.',
    antialias: false,
    pixelRatioCap: 0.75,
    shadowMapSize: 512,
    shadows: false,
    environment: false,
  },
};
const renderProfileStorageKey = 'apex-drive.render-profile.v1';
const storedRenderProfileId = localStorage.getItem(renderProfileStorageKey);
const activeRenderProfileId: ApexRenderProfileId = (
  storedRenderProfileId === 'high'
  || storedRenderProfileId === 'balanced'
  || storedRenderProfileId === 'debug'
)
  ? storedRenderProfileId
  : 'high';
const activeRenderProfile = renderProfiles[activeRenderProfileId];
const tireDeformationStorageKey = 'apex-drive.tire-deformation-mode.v1';
const controlledBenchmarkStorageKey = 'apex-drive.controlled-benchmark.v2';
const readControlledBenchmarkState = (
): ApexControlledBenchmarkState | undefined => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(controlledBenchmarkStorageKey) ?? 'null',
    ) as Partial<ApexControlledBenchmarkState> | null;
    if (
      parsed?.format !== 'apex-drive-controlled-benchmark@2'
      || (parsed.status !== 'running' && parsed.status !== 'complete')
      || (parsed.phase !== 'high' && parsed.phase !== 'debug')
      || typeof parsed.startedAt !== 'string'
      || !parsed.reports
      || (
        parsed.restoreRenderProfile !== 'high'
        && parsed.restoreRenderProfile !== 'balanced'
        && parsed.restoreRenderProfile !== 'debug'
      )
      || (
        parsed.restoreTireDeformationMode !== 'gpu'
        && parsed.restoreTireDeformationMode !== 'cpu'
        && parsed.restoreTireDeformationMode !== 'off'
      )
    ) return undefined;
    return parsed as ApexControlledBenchmarkState;
  } catch {
    return undefined;
  }
};
let controlledBenchmarkState = readControlledBenchmarkState();
const controlledBenchmarkIsRunning = (): boolean => (
  controlledBenchmarkState?.status === 'running'
);
const storedTireDeformationMode = localStorage.getItem(
  tireDeformationStorageKey,
);
const activeTireDeformationMode: ApexTireDeformationMode = (
  storedTireDeformationMode === 'off'
    ? 'off'
    : storedTireDeformationMode === 'cpu' ? 'cpu' : 'gpu'
);
const tireVisualDeformationEnabled = activeTireDeformationMode !== 'off';
renderProfileSelect.value = activeRenderProfile.id;
renderProfileInfo.textContent = activeRenderProfile.description;
canvas.dataset.renderProfile = activeRenderProfile.id;
tireDeformationModeSelect.value = activeTireDeformationMode;
tireDeformationInfo.textContent = activeTireDeformationMode === 'gpu'
  ? 'Deformación WebGPU activa · la física Apex no cambia.'
  : activeTireDeformationMode === 'cpu'
    ? 'Referencia CPU activa · misma ecuación visual.'
    : 'Prueba A/B · malla rígida; la física Apex continúa activa.';
canvas.dataset.tireVisualDeformationMode = activeTireDeformationMode;
tireDeformationModeSelect.addEventListener('change', () => {
  const nextMode: ApexTireDeformationMode = (
    tireDeformationModeSelect.value === 'off'
      ? 'off'
      : tireDeformationModeSelect.value === 'cpu' ? 'cpu' : 'gpu'
  );
  localStorage.setItem(tireDeformationStorageKey, nextMode);
  tireDeformationInfo.textContent = 'Aplicando…';
  window.location.reload();
});
renderProfileSelect.addEventListener('change', () => {
  const nextProfileId = renderProfileSelect.value as ApexRenderProfileId;
  if (!(nextProfileId in renderProfiles)) return;
  localStorage.setItem(renderProfileStorageKey, nextProfileId);
  renderProfileInfo.textContent = (
    `${renderProfiles[nextProfileId].description} Aplicando…`
  );
  window.location.reload();
});

interface ApexFramePerformanceSample {
  readonly intervalMs: number;
  readonly frameMs: number;
  readonly physicsMs: number;
  readonly tireMs: number;
  readonly renderMs: number;
}

const framePerformanceAverage = {
  intervalMs: 0,
  frameMs: 0,
  physicsMs: 0,
  tireMs: 0,
  renderMs: 0,
  initialized: false,
  lastUiUpdateMs: 0,
};
const updateFramePerformanceMeter = (
  now: number,
  sample: ApexFramePerformanceSample,
) => {
  const smoothing = framePerformanceAverage.initialized ? 0.12 : 1;
  framePerformanceAverage.intervalMs += (
    sample.intervalMs - framePerformanceAverage.intervalMs
  ) * smoothing;
  framePerformanceAverage.frameMs += (
    sample.frameMs - framePerformanceAverage.frameMs
  ) * smoothing;
  framePerformanceAverage.physicsMs += (
    sample.physicsMs - framePerformanceAverage.physicsMs
  ) * smoothing;
  framePerformanceAverage.tireMs += (
    sample.tireMs - framePerformanceAverage.tireMs
  ) * smoothing;
  framePerformanceAverage.renderMs += (
    sample.renderMs - framePerformanceAverage.renderMs
  ) * smoothing;
  framePerformanceAverage.initialized = true;
  if (now - framePerformanceAverage.lastUiUpdateMs < 250) return;
  framePerformanceAverage.lastUiUpdateMs = now;

  const intervalMs = Math.max(0.01, framePerformanceAverage.intervalMs);
  const frameWorkMs = Math.max(0.01, framePerformanceAverage.frameMs);
  const otherMs = Math.max(
    0,
    frameWorkMs
      - framePerformanceAverage.physicsMs
      - framePerformanceAverage.tireMs
      - framePerformanceAverage.renderMs,
  );
  const meterMax = Math.max(16.67, intervalMs, frameWorkMs);
  const updateMeter = (
    meter: HTMLMeterElement,
    output: HTMLOutputElement,
    value: number,
  ) => {
    meter.max = meterMax;
    meter.value = Math.min(value, meterMax);
    output.value = `${value.toFixed(2)} ms`;
  };

  renderPerformanceFps.value = String(Math.round(1000 / intervalMs));
  renderPerformanceFrame.value = intervalMs.toFixed(2);
  updateMeter(
    renderPerformancePhysics,
    renderPerformancePhysicsValue,
    framePerformanceAverage.physicsMs,
  );
  updateMeter(
    renderPerformanceTire,
    renderPerformanceTireValue,
    framePerformanceAverage.tireMs,
  );
  updateMeter(
    renderPerformanceRender,
    renderPerformanceRenderValue,
    framePerformanceAverage.renderMs,
  );
  updateMeter(renderPerformanceOther, renderPerformanceOtherValue, otherMs);
};

const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: activeRenderProfile.antialias,
});
await renderer.init();
const drivePerformanceMonitor = new ApexDrivePerformanceMonitor(
  activeRenderProfile.id,
  canvas,
  activeTireDeformationMode,
);
const controlledBenchmarkWarmupMs = 4_000;
const controlledBenchmarkCaptureMs = 20_000;
let controlledBenchmarkWarmupStartedAtMs: number | undefined;
let controlledBenchmarkCaptureStartedAtMs: number | undefined;
let controlledBenchmarkStatusSecond = -1;
let controlledBenchmarkDrivingStarted = false;
let controlledBenchmarkPreviousPosition:
  | readonly [number, number, number]
  | undefined;
let controlledBenchmarkDistanceM = 0;
let controlledBenchmarkMinimumSpeedKmh = Number.POSITIVE_INFINITY;
let controlledBenchmarkMaximumSpeedKmh = 0;
let controlledBenchmarkSpeedTotalKmh = 0;
let controlledBenchmarkSpeedSamples = 0;
const writeControlledBenchmarkState = (
  state: ApexControlledBenchmarkState,
) => {
  controlledBenchmarkState = state;
  localStorage.setItem(controlledBenchmarkStorageKey, JSON.stringify(state));
};
const controlledBenchmarkComparison = (
  state: ApexControlledBenchmarkState,
): string => [
  'APEX DRIVE · BENCHMARK CONTROLADO HIGH VS DEBUG',
  `Iniciado: ${state.startedAt}`,
  'Condición: conducción autónoma 1× · cámara close · deformación visual desactivada',
  '',
  '================ HIGH ================',
  state.reports.high ?? 'Sin captura High.',
  '',
  '================ DEBUG ================',
  state.reports.debug ?? 'Sin captura Debug.',
].join('\n');
const refreshControlledBenchmarkUi = () => {
  if (controlledBenchmarkState?.status === 'running') {
    controlledBenchmarkStart.textContent = 'Cancelar benchmark';
    controlledBenchmarkCopy.disabled = true;
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${controlledBenchmarkState.phase.toUpperCase()} · preparando…`
    );
    return;
  }
  controlledBenchmarkStart.textContent = controlledBenchmarkState
    ? 'Repetir benchmark controlado'
    : 'Grabar benchmark controlado';
  controlledBenchmarkCopy.disabled = (
    controlledBenchmarkState?.status !== 'complete'
  );
  controlledBenchmarkStatus.textContent = controlledBenchmarkState
    ? 'Benchmark completo · High y Debug listos para copiar.'
    : 'Compara High y Debug con la misma conducción automática.';
};
controlledBenchmarkStart.addEventListener('click', () => {
  if (controlledBenchmarkIsRunning()) {
    const state = controlledBenchmarkState!;
    localStorage.setItem(
      renderProfileStorageKey,
      state.restoreRenderProfile,
    );
    localStorage.setItem(
      tireDeformationStorageKey,
      state.restoreTireDeformationMode,
    );
    localStorage.removeItem(controlledBenchmarkStorageKey);
    controlledBenchmarkState = undefined;
    window.location.reload();
    return;
  }
  const state: ApexControlledBenchmarkState = {
    format: 'apex-drive-controlled-benchmark@2',
    status: 'running',
    phase: 'high',
    startedAt: new Date().toISOString(),
    reports: {},
    restoreRenderProfile: activeRenderProfile.id,
    restoreTireDeformationMode: activeTireDeformationMode,
  };
  writeControlledBenchmarkState(state);
  localStorage.setItem(renderProfileStorageKey, 'high');
  localStorage.setItem(tireDeformationStorageKey, 'off');
  window.location.reload();
});
controlledBenchmarkCopy.addEventListener('click', () => {
  if (controlledBenchmarkState?.status !== 'complete') return;
  if (!navigator.clipboard?.writeText) {
    controlledBenchmarkStatus.textContent = (
      'El navegador no habilitó el portapapeles.'
    );
    return;
  }
  void navigator.clipboard.writeText(
    controlledBenchmarkComparison(controlledBenchmarkState),
  ).then(() => {
    controlledBenchmarkStatus.textContent = 'Comparación completa copiada.';
  }).catch(error => {
    controlledBenchmarkStatus.textContent = (
      `No se pudo copiar: ${error instanceof Error ? error.message : String(error)}`
    );
  });
});
refreshControlledBenchmarkUi();

const updateControlledBenchmark = (now: number) => {
  const state = controlledBenchmarkState;
  if (state?.status !== 'running') return;
  const vehicleReady = canvas.dataset.vehicleModel !== 'loading';
  const environmentStatus = canvas.dataset.environmentStatus ?? 'loading';
  const environmentReady = (
    environmentStatus !== 'loading'
    && !environmentStatus.endsWith('-loading')
  );
  if (!vehicleReady || !environmentReady) {
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${state.phase.toUpperCase()} · esperando assets…`
    );
    return;
  }
  if (activeVehicleKind !== 'car') {
    controlledBenchmarkStatus.textContent = (
      'El benchmark controlado requiere un auto.'
    );
    return;
  }
  if (!controlledBenchmarkDrivingStarted) {
    controlledBenchmarkDrivingStarted = true;
    autonomousSimulationSpeed = 1;
    autonomousSimulationSpeedSelect.value = '1';
    canvas.dataset.autonomousSimulationSpeed = '1x';
    canvas.dataset.controlledBenchmarkMode = 'autonomous-drive-1x';
    setAutonomousDriveEnabled(true);
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${state.phase.toUpperCase()} · preparando conducción…`
    );
    return;
  }
  if (autonomousRaceStartPending) {
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${state.phase.toUpperCase()} · esperando largada…`
    );
    return;
  }
  if (controlledBenchmarkWarmupStartedAtMs === undefined) {
    controlledBenchmarkWarmupStartedAtMs = now;
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${state.phase.toUpperCase()} · calentando escena…`
    );
    return;
  }
  if (controlledBenchmarkCaptureStartedAtMs === undefined) {
    const warmupElapsedMs = now - controlledBenchmarkWarmupStartedAtMs;
    if (warmupElapsedMs < controlledBenchmarkWarmupMs) {
      const remaining = Math.ceil(
        (controlledBenchmarkWarmupMs - warmupElapsedMs) / 1000,
      );
      if (remaining !== controlledBenchmarkStatusSecond) {
        controlledBenchmarkStatusSecond = remaining;
        controlledBenchmarkStatus.textContent = (
          `Benchmark ${state.phase.toUpperCase()} · calentando ${remaining}s`
        );
      }
      return;
    }
    drivePerformanceMonitor.resetCapture();
    controlledBenchmarkPreviousPosition = undefined;
    controlledBenchmarkDistanceM = 0;
    controlledBenchmarkMinimumSpeedKmh = Number.POSITIVE_INFINITY;
    controlledBenchmarkMaximumSpeedKmh = 0;
    controlledBenchmarkSpeedTotalKmh = 0;
    controlledBenchmarkSpeedSamples = 0;
    canvas.dataset.controlledBenchmarkDistanceM = '0.0';
    canvas.dataset.controlledBenchmarkSpeedAverageKmh = '0.0';
    canvas.dataset.controlledBenchmarkSpeedMinimumKmh = '0.0';
    canvas.dataset.controlledBenchmarkSpeedMaximumKmh = '0.0';
    controlledBenchmarkCaptureStartedAtMs = now;
    controlledBenchmarkStatusSecond = -1;
    controlledBenchmarkStatus.textContent = (
      `Benchmark ${state.phase.toUpperCase()} · grabando…`
    );
    return;
  }
  const captureElapsedMs = now - controlledBenchmarkCaptureStartedAtMs;
  if (captureElapsedMs < controlledBenchmarkCaptureMs) {
    const position = (canvas.dataset.vehiclePosition ?? '')
      .split(',')
      .map(Number);
    if (
      position.length === 3
      && position.every(Number.isFinite)
    ) {
      const currentPosition = position as [number, number, number];
      if (controlledBenchmarkPreviousPosition) {
        const distanceM = Math.hypot(
          currentPosition[0] - controlledBenchmarkPreviousPosition[0],
          currentPosition[1] - controlledBenchmarkPreviousPosition[1],
          currentPosition[2] - controlledBenchmarkPreviousPosition[2],
        );
        if (distanceM < 20) controlledBenchmarkDistanceM += distanceM;
      }
      controlledBenchmarkPreviousPosition = currentPosition;
    }
    const speedKmh = Number(canvas.dataset.vehicleSpeedKmh);
    if (Number.isFinite(speedKmh)) {
      controlledBenchmarkMinimumSpeedKmh = Math.min(
        controlledBenchmarkMinimumSpeedKmh,
        speedKmh,
      );
      controlledBenchmarkMaximumSpeedKmh = Math.max(
        controlledBenchmarkMaximumSpeedKmh,
        speedKmh,
      );
      controlledBenchmarkSpeedTotalKmh += speedKmh;
      controlledBenchmarkSpeedSamples += 1;
    }
    canvas.dataset.controlledBenchmarkDistanceM = (
      controlledBenchmarkDistanceM.toFixed(1)
    );
    canvas.dataset.controlledBenchmarkSpeedAverageKmh = (
      controlledBenchmarkSpeedSamples > 0
        ? controlledBenchmarkSpeedTotalKmh / controlledBenchmarkSpeedSamples
        : 0
    ).toFixed(1);
    canvas.dataset.controlledBenchmarkSpeedMinimumKmh = (
      Number.isFinite(controlledBenchmarkMinimumSpeedKmh)
        ? controlledBenchmarkMinimumSpeedKmh
        : 0
    ).toFixed(1);
    canvas.dataset.controlledBenchmarkSpeedMaximumKmh = (
      controlledBenchmarkMaximumSpeedKmh.toFixed(1)
    );
    const remaining = Math.ceil(
      (controlledBenchmarkCaptureMs - captureElapsedMs) / 1000,
    );
    if (remaining !== controlledBenchmarkStatusSecond) {
      controlledBenchmarkStatusSecond = remaining;
      controlledBenchmarkStatus.textContent = (
        `Benchmark ${state.phase.toUpperCase()} · grabando ${remaining}s`
      );
    }
    return;
  }

  const reports = {
    ...state.reports,
    [state.phase]: drivePerformanceMonitor.createReport(),
  };
  if (state.phase === 'high') {
    writeControlledBenchmarkState({
      ...state,
      phase: 'debug',
      reports,
    });
    localStorage.setItem(renderProfileStorageKey, 'debug');
    localStorage.setItem(tireDeformationStorageKey, 'off');
    controlledBenchmarkStatus.textContent = (
      'High grabado · reiniciando para medir Debug…'
    );
    window.location.reload();
    return;
  }
  writeControlledBenchmarkState({
    ...state,
    status: 'complete',
    reports,
  });
  localStorage.setItem(renderProfileStorageKey, state.restoreRenderProfile);
  localStorage.setItem(
    tireDeformationStorageKey,
    state.restoreTireDeformationMode,
  );
  controlledBenchmarkStatus.textContent = (
    'Benchmark completo · restaurando tu configuración…'
  );
  window.location.reload();
};
renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, activeRenderProfile.pixelRatioCap),
);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = activeRenderProfile.shadows;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
const lapGhost = new ApexLapGhost(scene);
scene.background = new THREE.Color(0x05080c);
scene.backgroundIntensity = 1;
scene.environmentIntensity = 1;
scene.fog = null;
canvas.dataset.trackFog = 'disabled';
canvas.dataset.environmentStatus = 'loading';

let apexVoidAssets: readonly ApexVoidAssetRecord[] = [];
let loadedApexVoidAsset: THREE.Object3D | undefined;
const apexVoidLocalAccessEnabled = (
  !APEX_DRIVE_PUBLIC_DEMO
  && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)
);

const disposeLoadedApexVoidAsset = () => {
  if (!loadedApexVoidAsset) return;
  loadedApexVoidAsset.removeFromParent();
  loadedApexVoidAsset.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach(material => {
      Object.values(material).forEach(value => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
  loadedApexVoidAsset = undefined;
};

const refreshApexVoidAssetCatalog = async () => {
  if (!apexVoidLocalAccessEnabled) {
    assetLibraryRefresh.disabled = true;
    assetLibraryLoad.disabled = true;
    assetLibraryStatus.textContent = 'APEX Void · disponible sólo en local';
    return;
  }
  assetLibraryRefresh.disabled = true;
  assetLibraryLoad.disabled = true;
  assetLibraryStatus.textContent = 'APEX Void · consultando biblioteca…';
  try {
    const previousSelection = assetLibrarySelect.value;
    apexVoidAssets = await loadApexVoidAssetCatalog();
    assetLibrarySelect.replaceChildren(...(
      apexVoidAssets.length > 0
        ? apexVoidAssets.map(asset => {
          const option = document.createElement('option');
          option.value = asset.assetId;
          option.textContent = asset.name;
          return option;
        })
        : [Object.assign(document.createElement('option'), {
          value: '',
          textContent: 'No hay assets guardados',
        })]
    ));
    if (apexVoidAssets.some(asset => asset.assetId === previousSelection)) {
      assetLibrarySelect.value = previousSelection;
    }
    assetLibraryLoad.disabled = apexVoidAssets.length === 0;
    assetLibraryStatus.textContent = apexVoidAssets.length > 0
      ? `APEX Void · ${apexVoidAssets.length} assets disponibles`
      : 'APEX Void · biblioteca vacía';
  } catch (error) {
    apexVoidAssets = [];
    assetLibrarySelect.replaceChildren(
      Object.assign(document.createElement('option'), {
        value: '',
        textContent: 'APEX Void no disponible',
      }),
    );
    assetLibraryStatus.textContent = error instanceof TypeError
      ? 'APEX Void · servidor local desconectado'
      : error instanceof Error ? error.message : String(error);
  } finally {
    assetLibraryRefresh.disabled = false;
  }
};

const placeApexVoidAssetNearVehicle = (object: THREE.Object3D) => {
  const coordinates = canvas.dataset.vehiclePosition
    ?.split(',')
    .map(Number);
  const vehiclePosition = coordinates?.length === 3
    && coordinates.every(Number.isFinite)
    ? coordinates
    : [0, 0.5, 0];
  const heading = Number(canvas.dataset.vehicleHeading);
  const vehicleHeading = Number.isFinite(heading) ? heading : 0;
  const targetX = vehiclePosition[0] + Math.cos(vehicleHeading) * 5;
  const targetZ = vehiclePosition[2] - Math.sin(vehicleHeading) * 5;
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error('El asset no contiene geometría visible');
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.x += targetX - center.x;
  object.position.y += vehiclePosition[1] - 0.5 - bounds.min.y;
  object.position.z += targetZ - center.z;
  object.updateMatrixWorld(true);
  return bounds.getSize(new THREE.Vector3());
};

assetLibraryRefresh.addEventListener('click', () => {
  void refreshApexVoidAssetCatalog();
});
assetLibraryLoad.addEventListener('click', () => {
  const definition = apexVoidAssets.find(
    asset => asset.assetId === assetLibrarySelect.value,
  );
  if (!definition) return;
  assetLibraryLoad.disabled = true;
  assetLibraryStatus.textContent = `Cargando ${definition.name}…`;
  void loadApexVoidAsset(definition)
    .then(object => {
      const size = placeApexVoidAssetNearVehicle(object);
      disposeLoadedApexVoidAsset();
      loadedApexVoidAsset = object;
      scene.add(object);
      assetLibraryStatus.textContent =
        `${definition.name} · ${size.x.toFixed(2)} × `
        + `${size.y.toFixed(2)} × ${size.z.toFixed(2)} m · visual`;
    })
    .catch(error => {
      assetLibraryStatus.textContent =
        error instanceof Error ? error.message : String(error);
    })
    .finally(() => {
      assetLibraryLoad.disabled = apexVoidAssets.length === 0;
    });
});
if (apexVoidLocalAccessEnabled) {
  void refreshApexVoidAssetCatalog();
}

const environmentPmrem = new THREE.PMREMGenerator(renderer);
const hdrEnvironmentLoader = new HDRLoader();
const exrEnvironmentLoader = new EXRLoader();
const environmentCache = new Map<string, THREE.Texture>();
const environmentsLoading = new Set<string>();
let requestedEnvironmentId = '';
let environmentProfilePanel: ApexEnvironmentProfilePanel | undefined;
const useEnvironmentAsset = (environmentId: string) => {
  const asset = APEX_ENVIRONMENT_ASSETS.find(
    candidate => candidate.id === environmentId,
  ) ?? APEX_ENVIRONMENT_ASSETS[0];
  requestedEnvironmentId = asset.id;
  if (!activeRenderProfile.environment) {
    scene.environment = null;
    scene.background = new THREE.Color(0x05080c);
    canvas.dataset.environmentStatus = `${asset.id}-disabled-by-render-profile`;
    environmentProfilePanel?.reportEnvironmentStatus(
      `HDRI desactivado · perfil ${activeRenderProfile.label}`,
    );
    return;
  }
  canvas.dataset.environmentStatus = `${asset.id}-loading`;
  environmentProfilePanel?.reportEnvironmentStatus(`Cargando · ${asset.name}`);
  const cached = environmentCache.get(asset.id);
  if (cached) {
    scene.environment = cached;
    scene.background = cached;
    canvas.dataset.environmentStatus = `${asset.id}-ready`;
    environmentProfilePanel?.reportEnvironmentStatus(`HDRI listo · ${asset.name}`);
    return;
  }
  if (environmentsLoading.has(asset.id)) return;
  environmentsLoading.add(asset.id);
  const environmentLoader = asset.uri.toLowerCase().endsWith('.exr')
    ? exrEnvironmentLoader
    : hdrEnvironmentLoader;
  environmentLoader.load(
    asset.uri,
    texture => {
      const environment = environmentPmrem.fromEquirectangular(texture).texture;
      environment.name = `apex-environment-${asset.id}`;
      environmentCache.set(asset.id, environment);
      environmentsLoading.delete(asset.id);
      texture.dispose();
      if (requestedEnvironmentId !== asset.id) return;
      scene.environment = environment;
      scene.background = environment;
      canvas.dataset.environmentStatus = `${asset.id}-ready`;
      environmentProfilePanel?.reportEnvironmentStatus(`HDRI listo · ${asset.name}`);
    },
    undefined,
    error => {
      environmentsLoading.delete(asset.id);
      console.warn(`No se pudo cargar el HDRI ${asset.name}`, error);
      if (requestedEnvironmentId !== asset.id) return;
      canvas.dataset.environmentStatus = `${asset.id}-error`;
      environmentProfilePanel?.reportEnvironmentStatus(
        `Error cargando · ${asset.name}`,
      );
    },
  );
};
useEnvironmentAsset(APEX_ENVIRONMENT_ASSETS[0].id);

// Preset close de seguimiento de v2.
const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.1,
  Math.max(1000, FLOOR_SIZE_M * 1.2),
);
camera.position.set(0, 1.5, -4.65);

type CameraMode = 'close' | 'wheel' | 'pan' | 'chase' | 'interior' | 'rally' | 'free' | 'fps';
const cameraModes: readonly CameraMode[] = [
  'close',
  'wheel',
  'pan',
  'chase',
  'interior',
  'rally',
  'free',
  'fps',
];
const cameraModeLabels: Readonly<Record<CameraMode, string>> = {
  close: 'XSpeed Close Cam',
  wheel: 'rueda delantera',
  pan: 'paneo fijo',
  chase: 'persecución',
  interior: 'interior',
  rally: 'rally clásica',
  free: 'libre / noclip',
  fps: 'FPS caminando',
};
const trackEditorCameraStorageKey = [
  'apex-run.v3.track-editor-camera.v1',
  ACTIVE_TRACK.track.id,
  ACTIVE_TRACK.track.version,
].join('.');
const trackEditorVehicleEntryCamera = (():
  ApexTrackEditorCameraState | undefined => {
  if (!trackEditorMode) return undefined;
  try {
    const serialized = window.sessionStorage.getItem(
      trackEditorVehicleEntryStorageKey,
    );
    window.sessionStorage.removeItem(trackEditorVehicleEntryStorageKey);
    if (!serialized) return undefined;
    const value = JSON.parse(serialized) as {
      readonly format?: unknown;
      readonly position?: unknown;
      readonly headingRadians?: unknown;
    };
    if (
      value.format !== 'apex-track-editor-vehicle-entry@1'
      || !Array.isArray(value.position)
      || value.position.length !== 3
      || !value.position.every(entry => (
        typeof entry === 'number' && Number.isFinite(entry)
      ))
      || typeof value.headingRadians !== 'number'
      || !Number.isFinite(value.headingRadians)
    ) {
      return undefined;
    }
    const target = new THREE.Vector3(
      value.position[0],
      value.position[1],
      value.position[2],
    );
    const forward = new THREE.Vector3(
      Math.sin(value.headingRadians),
      0,
      Math.cos(value.headingRadians),
    );
    const position = target.clone()
      .addScaledVector(forward, -12)
      .add(new THREE.Vector3(0, 8, 0));
    const entryCamera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      camera.near,
      camera.far,
    );
    entryCamera.position.copy(position);
    entryCamera.lookAt(target);
    entryCamera.updateMatrixWorld(true);
    return Object.freeze({
      position: Object.freeze([
        position.x,
        position.y,
        position.z,
      ] as const),
      quaternion: Object.freeze([
        entryCamera.quaternion.x,
        entryCamera.quaternion.y,
        entryCamera.quaternion.z,
        entryCamera.quaternion.w,
      ] as const),
      target: Object.freeze([
        target.x,
        target.y,
        target.z,
      ] as const),
      fov: entryCamera.fov,
      near: entryCamera.near,
      far: entryCamera.far,
    });
  } catch {
    return undefined;
  }
})();
const restoredTrackEditorView = (() => {
  if (!trackEditorMode) return undefined;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(trackEditorCameraStorageKey) ?? 'null',
    ) as {
      readonly format?: unknown;
      readonly cameraMode?: unknown;
      readonly camera?: {
        readonly position?: unknown;
        readonly quaternion?: unknown;
        readonly target?: unknown;
        readonly fov?: unknown;
        readonly near?: unknown;
        readonly far?: unknown;
      };
    } | null;
    const cameraState = value?.camera;
    const finiteTuple = (
      tuple: unknown,
      length: number,
    ): tuple is number[] => (
      Array.isArray(tuple)
      && tuple.length === length
      && tuple.every(entry => (
        typeof entry === 'number' && Number.isFinite(entry)
      ))
    );
    if (
      value?.format !== 'apex-track-editor-camera@1'
      || !cameraModes.includes(value.cameraMode as CameraMode)
      || !cameraState
      || !finiteTuple(cameraState.position, 3)
      || !finiteTuple(cameraState.quaternion, 4)
      || !finiteTuple(cameraState.target, 3)
      || typeof cameraState.fov !== 'number'
      || !Number.isFinite(cameraState.fov)
      || typeof cameraState.near !== 'number'
      || !Number.isFinite(cameraState.near)
      || typeof cameraState.far !== 'number'
      || !Number.isFinite(cameraState.far)
    ) return undefined;
    return Object.freeze({
      cameraMode: value.cameraMode as CameraMode,
      camera: Object.freeze({
        position: Object.freeze([
          cameraState.position[0],
          cameraState.position[1],
          cameraState.position[2],
        ] as const),
        quaternion: Object.freeze([
          cameraState.quaternion[0],
          cameraState.quaternion[1],
          cameraState.quaternion[2],
          cameraState.quaternion[3],
        ] as const),
        target: Object.freeze([
          cameraState.target[0],
          cameraState.target[1],
          cameraState.target[2],
        ] as const),
        fov: cameraState.fov,
        near: cameraState.near,
        far: cameraState.far,
      }) satisfies ApexTrackEditorCameraState,
    });
  } catch {
    return undefined;
  }
})();
let cameraModeIndex = restoredTrackEditorView
  ? cameraModes.indexOf(restoredTrackEditorView.cameraMode)
  : 0;
let cameraMode: CameraMode = cameraModes[cameraModeIndex];
const isExplorationCameraMode = (mode: CameraMode = cameraMode): boolean => (
  mode === 'free' || mode === 'fps'
);
const explorationViewDirection = new THREE.Vector3();
let explorationYawRadians = 0;
let explorationPitchRadians = 0;
let explorationCameraReady = false;
let cameraChangeSerial = 0;
let cameraModeChangeHook = () => {};
const prepareExplorationCamera = () => {
  camera.getWorldDirection(explorationViewDirection);
  explorationYawRadians = Math.atan2(
    explorationViewDirection.x,
    explorationViewDirection.z,
  );
  explorationPitchRadians = Math.asin(
    THREE.MathUtils.clamp(explorationViewDirection.y, -1, 1),
  );
  explorationCameraReady = true;
};
const applyCameraModeLabel = () => {
  camera.fov = cameraMode === 'wheel'
    ? 52
    : cameraMode === 'close' ? 68 : cameraMode === 'fps' ? 72 : 75;
  camera.updateProjectionMatrix();
  cameraModeOutput.value = `Cámara · ${cameraModeLabels[cameraMode]}`;
  cameraModeSelect.value = cameraMode;
  cameraHelp.textContent = cameraMode === 'free'
    ? 'Click para mirar · WASD mover · Q/E bajar/subir · Shift rápido'
    : cameraMode === 'fps'
      ? 'Click para mirar · WASD caminar · Shift correr · Esc libera mouse'
      : cameraMode === 'wheel'
        ? 'Rueda delantera derecha · contacto, giro y deformación'
      : 'C / botón Y · cambiar vista';
  canvas.dataset.cameraPreset = isExplorationCameraMode()
    ? `apex-${cameraMode}`
    : `v2-${cameraMode}`;
};
const setCameraMode = (mode: CameraMode) => {
  cameraMode = mode;
  cameraModeIndex = cameraModes.indexOf(mode);
  cameraChangeSerial += 1;
  if (isExplorationCameraMode()) {
    prepareExplorationCamera();
  } else {
    explorationCameraReady = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  applyCameraModeLabel();
  cameraModeChangeHook();
};
const cycleCameraMode = () => {
  setCameraMode(cameraModes[(cameraModeIndex + 1) % cameraModes.length]);
};
applyCameraModeLabel();

const grassTextureSizeM = 14;
const grassTextureLoader = new THREE.TextureLoader();
const loadGrassTexture = (name: string, colorTexture = false) => {
  const texture = grassTextureLoader.load(
    apexDrivePublicUrl(
      `assets/ground/grass001/Grass001_1K-JPG_${name}.jpg`,
    ),
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
};
const grassColorMap = loadGrassTexture('Color', true);
const grassNormalMap = loadGrassTexture('NormalDX');
const grassMaterial = new THREE.MeshStandardMaterial({
  map: grassColorMap,
  normalMap: grassNormalMap,
  normalScale: new THREE.Vector2(0.62, -0.62),
  roughness: 1,
  metalness: 0,
  side: THREE.DoubleSide,
});

// El mesh coincide con la cara superior (Y=0) del BoxShape estático. Sobre él
// se conservan líneas muy tenues para supervisar escala, contacto y deriva.
const groundGeometry = new THREE.PlaneGeometry(FLOOR_SIZE_M, FLOOR_SIZE_M);
const groundPositions = groundGeometry.getAttribute('position');
const groundUvs = groundGeometry.getAttribute('uv');
for (let index = 0; index < groundPositions.count; index += 1) {
  groundUvs.setXY(
    index,
    groundPositions.getX(index) / grassTextureSizeM,
    groundPositions.getY(index) / grassTextureSizeM,
  );
}
groundGeometry.setAttribute('uv1', groundUvs.clone());
const groundMesh = new THREE.Mesh(
  groundGeometry,
  grassMaterial,
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.position.y = TEST_TRACK_GROUND_HEIGHT_M;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const floorOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(FLOOR_SIZE_M, 0.2, FLOOR_SIZE_M)),
  new THREE.LineBasicMaterial({ color: 0x245869, transparent: true, opacity: 0.35 }),
);
floorOutline.position.y = -0.1;
scene.add(floorOutline);

// Circuito Bravo se dibuja como una cinta continua. La física conserva los
// puntos grabados y replica la elevación y el peralte en sus cuerpos de asfalto.
const trackCurve = TEST_TRACK_CURVE;
const trackLengthM = trackCurve.getLength();
const trackSampleCount = TEST_TRACK_SPLINE_SAMPLE_COUNT;
const sampledTrackPoints = TEST_TRACK_SPLINE_POINTS.map(
  point => new THREE.Vector3(point.x, point.y, point.z),
);
canvas.dataset.trackLengthM = trackLengthM.toFixed(1);
canvas.dataset.trackSampleCount = String(sampledTrackPoints.length);
const trackVertices: number[] = [];
const trackNormals: number[] = [];
const trackUvs: number[] = [];
const shoulderVertices: number[] = [];
const shoulderUvs: number[] = [];
const shoulderGroundFeatherFadeUvs: number[] = [];
const sampledShoulderProfiles: TrackShoulderProfile[] = [];
const trackGrassTransitionVertices: number[] = [];
const trackGrassTransitionUvs: number[] = [];
const trackGrassTransitionFadeUvs: number[] = [];
const sampledTrackTangents: THREE.Vector3[] = [];
const sampledTrackHorizontalLaterals: THREE.Vector3[] = [];
const sampledTrackLaterals: THREE.Vector3[] = [];
const sampledTrackSurfaceUps: THREE.Vector3[] = [];
const sampledTrackDistancesM: number[] = [];
const roadTextureSizeM = 40;
const asphaltGrassBlendWidthM = 0.75;
let trackDistanceM = 0;
for (let index = 0; index < sampledTrackPoints.length; index += 1) {
  const point = sampledTrackPoints[index];
  const previous = sampledTrackPoints[
    (index - 1 + sampledTrackPoints.length) % sampledTrackPoints.length
  ];
  const following = sampledTrackPoints[(index + 1) % sampledTrackPoints.length];
  if (index > 0) trackDistanceM += point.distanceTo(previous);
  const tangent = following.clone().sub(previous).normalize();
  const bankRadians = trackBankRadiansAt(index / sampledTrackPoints.length);
  const horizontalLateral = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const lateral = horizontalLateral.clone()
    .applyAxisAngle(tangent, bankRadians);
  const surfaceUp = lateral.clone().cross(tangent).normalize();
  sampledTrackTangents.push(tangent.clone());
  sampledTrackHorizontalLaterals.push(horizontalLateral.clone());
  sampledTrackLaterals.push(lateral.clone());
  sampledTrackSurfaceUps.push(surfaceUp.clone());
  sampledTrackDistancesM.push(trackDistanceM);
  const edgeOffset = lateral.clone().multiplyScalar(TEST_TRACK_WIDTH_M / 2);
  const leftEdge = point.clone().add(edgeOffset);
  const rightEdge = point.clone().sub(edgeOffset);
  trackVertices.push(
    leftEdge.x,
    leftEdge.y,
    leftEdge.z,
    rightEdge.x,
    rightEdge.y,
    rightEdge.z,
  );
  trackNormals.push(
    surfaceUp.x,
    surfaceUp.y,
    surfaceUp.z,
    surfaceUp.x,
    surfaceUp.y,
    surfaceUp.z,
  );
  // Una repetición cubre los 16 m de ancho y 16 m de recorrido. Antes el mapa
  // medía 16 × 8 m y el asfalto quedaba comprimido en sentido longitudinal.
  trackUvs.push(
    0,
    trackDistanceM / roadTextureSizeM,
    1,
    trackDistanceM / roadTextureSizeM,
  );
  const shoulderProfile = createTrackShoulderProfile({
    center: point,
    innerLeft: leftEdge,
    innerRight: rightEdge,
    horizontalLeftX: horizontalLateral.x,
    horizontalLeftZ: horizontalLateral.z,
    roadWidthM: TEST_TRACK_WIDTH_M,
    shoulderWidthM: TEST_TRACK_SHOULDER_WIDTH_M,
    groundHeightM: TEST_TRACK_GROUND_HEIGHT_M,
    progress: index / sampledTrackPoints.length,
  });
  sampledShoulderProfiles.push(shoulderProfile);
  const [
    shoulderInnerLeft,
    shoulderCrestLeft,
    shoulderUpperLeft,
    shoulderMiddleLeft,
    shoulderSoftLeft,
    shoulderToeLeft,
  ] = shoulderProfile.left;
  const [
    shoulderInnerRight,
    shoulderCrestRight,
    shoulderUpperRight,
    shoulderMiddleRight,
    shoulderSoftRight,
    shoulderToeRight,
  ] = shoulderProfile.right;
  const shoulderRing = [
    shoulderToeLeft,
    shoulderSoftLeft,
    shoulderMiddleLeft,
    shoulderUpperLeft,
    shoulderCrestLeft,
    shoulderInnerLeft,
    shoulderInnerRight,
    shoulderCrestRight,
    shoulderUpperRight,
    shoulderMiddleRight,
    shoulderSoftRight,
    shoulderToeRight,
  ];
  shoulderVertices.push(
    ...shoulderRing.flatMap(vertex => [vertex.x, vertex.y, vertex.z]),
  );
  shoulderUvs.push(...shoulderRing.flatMap(vertex => [
    vertex.x / grassTextureSizeM,
    -vertex.z / grassTextureSizeM,
  ]));
  shoulderGroundFeatherFadeUvs.push(...shoulderRing.flatMap((_, ringIndex) => [
    ringIndex === 0 || ringIndex === shoulderRing.length - 1 ? 1 : 0,
    0,
  ]));
  const shoulderBlend = ACTIVE_TRACK.configuration.geometry.roadsideMode === 'none'
    ? 0
    : asphaltGrassBlendWidthM / Math.max(0.001, TEST_TRACK_SHOULDER_WIDTH_M);
  const leftBlendOuter = leftEdge.clone().lerp(
    new THREE.Vector3(
      shoulderCrestLeft.x,
      shoulderCrestLeft.y,
      shoulderCrestLeft.z,
    ),
    shoulderBlend,
  );
  const rightBlendOuter = rightEdge.clone().lerp(
    new THREE.Vector3(
      shoulderCrestRight.x,
      shoulderCrestRight.y,
      shoulderCrestRight.z,
    ),
    shoulderBlend,
  );
  trackGrassTransitionVertices.push(
    leftEdge.x, leftEdge.y + 0.002, leftEdge.z,
    leftBlendOuter.x, leftBlendOuter.y + 0.002, leftBlendOuter.z,
    rightEdge.x, rightEdge.y + 0.002, rightEdge.z,
    rightBlendOuter.x, rightBlendOuter.y + 0.002, rightBlendOuter.z,
  );
  const roadV = trackDistanceM / roadTextureSizeM;
  trackGrassTransitionUvs.push(
    0, roadV,
    -asphaltGrassBlendWidthM / TEST_TRACK_WIDTH_M, roadV,
    1, roadV,
    1 + asphaltGrassBlendWidthM / TEST_TRACK_WIDTH_M, roadV,
  );
  trackGrassTransitionFadeUvs.push(
    0, 0,
    1, 0,
    0, 0,
    1, 0,
  );
}
const shoulderConfluenceFrames = sampledTrackPoints.map((point, index) => ({
    center: point,
    innerLeft: sampledShoulderProfiles[index].left[0],
    innerRight: sampledShoulderProfiles[index].right[0],
    profile: sampledShoulderProfiles[index],
    distanceM: sampledTrackDistancesM[index],
  }));
const shoulderConfluence = (
  ACTIVE_TRACK.configuration.geometry.roadsideMode === 'adaptive-terrain'
    ? solveTrackShoulderConfluences(
      shoulderConfluenceFrames,
      TEST_TRACK_WIDTH_M,
      { closed: TEST_TRACK_IS_CLOSED },
    )
    : {
      profiles: sampledShoulderProfiles,
      masks: sampledShoulderProfiles.map(() => ({
        left: [true, true, true, true, true],
        right: [true, true, true, true, true],
      })),
      tunnels: [],
      conflictCount: 0,
      compatibleHeightCount: 0,
    }
);
shoulderConfluence.profiles.forEach((profile, index) => {
  sampledShoulderProfiles[index] = profile;
  const shoulderRing = [
    profile.left[5],
    profile.left[4],
    profile.left[3],
    profile.left[2],
    profile.left[1],
    profile.left[0],
    profile.right[0],
    profile.right[1],
    profile.right[2],
    profile.right[3],
    profile.right[4],
    profile.right[5],
  ];
  shoulderRing.forEach((vertex, ringIndex) => {
    const vertexOffset = (index * 12 + ringIndex) * 3;
    shoulderVertices[vertexOffset] = vertex.x;
    shoulderVertices[vertexOffset + 1] = vertex.y;
    shoulderVertices[vertexOffset + 2] = vertex.z;
    const uvOffset = (index * 12 + ringIndex) * 2;
    shoulderUvs[uvOffset] = vertex.x / grassTextureSizeM;
    shoulderUvs[uvOffset + 1] = -vertex.z / grassTextureSizeM;
  });

  const shoulderBlend = ACTIVE_TRACK.configuration.geometry.roadsideMode === 'none'
    ? 0
    : asphaltGrassBlendWidthM / Math.max(0.001, TEST_TRACK_SHOULDER_WIDTH_M);
  const leftBlendOuter = new THREE.Vector3(
    profile.left[0].x,
    profile.left[0].y,
    profile.left[0].z,
  ).lerp(
    new THREE.Vector3(
      profile.left[1].x,
      profile.left[1].y,
      profile.left[1].z,
    ),
    shoulderBlend,
  );
  const rightBlendOuter = new THREE.Vector3(
    profile.right[0].x,
    profile.right[0].y,
    profile.right[0].z,
  ).lerp(
    new THREE.Vector3(
      profile.right[1].x,
      profile.right[1].y,
      profile.right[1].z,
    ),
    shoulderBlend,
  );
  const transitionOffset = index * 12;
  trackGrassTransitionVertices[transitionOffset + 3] = leftBlendOuter.x;
  trackGrassTransitionVertices[transitionOffset + 4] = leftBlendOuter.y + 0.002;
  trackGrassTransitionVertices[transitionOffset + 5] = leftBlendOuter.z;
  trackGrassTransitionVertices[transitionOffset + 9] = rightBlendOuter.x;
  trackGrassTransitionVertices[transitionOffset + 10] = rightBlendOuter.y + 0.002;
  trackGrassTransitionVertices[transitionOffset + 11] = rightBlendOuter.z;
});
canvas.dataset.trackRoadsideMode = (
  ACTIVE_TRACK.configuration.geometry.roadsideMode
);
canvas.dataset.trackShoulderSolver = (
  ACTIVE_TRACK.configuration.geometry.roadsideMode === 'adaptive-terrain'
    ? 'progressive-under-road-clearance-v3'
    : ACTIVE_TRACK.configuration.geometry.roadsideMode === 'shoulder'
      ? 'profile-only-no-confluence-solver'
      : 'disabled-by-track'
);
canvas.dataset.trackShoulderConflictCount = String(
  shoulderConfluence.conflictCount,
);
canvas.dataset.trackShoulderCompatibleHeightCount = String(
  shoulderConfluence.compatibleHeightCount,
);

// El orden de la spline define el sentido correcto de la vuelta: desde la
// grilla en (0, 0) hacia -Z. La curvatura firmada permite distinguir interior
// y exterior sin codificar manualmente cada curva.
const signedTrackTurns = sampledTrackPoints.map((point, index) => {
  const previous = sampledTrackPoints[
    (index - 1 + sampledTrackPoints.length) % sampledTrackPoints.length
  ];
  const following = sampledTrackPoints[(index + 1) % sampledTrackPoints.length];
  const incomingX = point.x - previous.x;
  const incomingZ = point.z - previous.z;
  const outgoingX = following.x - point.x;
  const outgoingZ = following.z - point.z;
  const incomingLength = Math.hypot(incomingX, incomingZ);
  const outgoingLength = Math.hypot(outgoingX, outgoingZ);
  if (incomingLength < 0.01 || outgoingLength < 0.01) return 0;
  const cross = (
    incomingX * outgoingZ - incomingZ * outgoingX
  ) / (incomingLength * outgoingLength);
  const dot = (
    incomingX * outgoingX + incomingZ * outgoingZ
  ) / (incomingLength * outgoingLength);
  return Math.atan2(cross, dot);
});
const curveCurvatureThreshold = 0.006;
const rawCurveMask = signedTrackTurns.map((turn, index) => {
  const previous = sampledTrackPoints[
    (index - 1 + sampledTrackPoints.length) % sampledTrackPoints.length
  ];
  const following = sampledTrackPoints[(index + 1) % sampledTrackPoints.length];
  const spanM = Math.max(0.01, previous.distanceTo(following) * 0.5);
  return Math.abs(turn) / spanM >= curveCurvatureThreshold;
});
const curveLeadSamples = Math.max(3, Math.round(10 / Math.max(1, trackCurve.getLength() / trackSampleCount)));
const curveMask = rawCurveMask.map((_, index) => {
  for (let offset = -curveLeadSamples; offset <= curveLeadSamples; offset += 1) {
    const wrapped = (index + offset + rawCurveMask.length) % rawCurveMask.length;
    if (rawCurveMask[wrapped]) return true;
  }
  return false;
});
const yellowMarkingVertices: number[] = [];
const yellowMarkingIndices: number[] = [];
const whiteMarkingVertices: number[] = [];
const whiteMarkingIndices: number[] = [];
const appendTrackMarking = (
  vertices: number[],
  indices: number[],
  index: number,
  widthM: number,
  lateralOffsetM = 0,
) => {
  const next = (index + 1) % sampledTrackPoints.length;
  const start = sampledTrackPoints[index].clone()
    .addScaledVector(sampledTrackLaterals[index], lateralOffsetM)
    .addScaledVector(sampledTrackSurfaceUps[index], 0.018);
  const end = sampledTrackPoints[next].clone()
    .addScaledVector(sampledTrackLaterals[next], lateralOffsetM)
    .addScaledVector(sampledTrackSurfaceUps[next], 0.018);
  const halfWidth = widthM * 0.5;
  const startLeft = start.clone().addScaledVector(sampledTrackLaterals[index], halfWidth);
  const startRight = start.clone().addScaledVector(sampledTrackLaterals[index], -halfWidth);
  const endLeft = end.clone().addScaledVector(sampledTrackLaterals[next], halfWidth);
  const endRight = end.clone().addScaledVector(sampledTrackLaterals[next], -halfWidth);
  const base = vertices.length / 3;
  vertices.push(
    startLeft.x, startLeft.y, startLeft.z,
    startRight.x, startRight.y, startRight.z,
    endLeft.x, endLeft.y, endLeft.z,
    endRight.x, endRight.y, endRight.z,
  );
  indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
};
for (let index = 0; index < sampledTrackPoints.length; index += 1) {
  if (TEST_TRACK_LANE_COUNT === 3) {
    const laneBoundaryOffsetM = TEST_TRACK_WIDTH_M / 6;
    if (sampledTrackDistancesM[index] % 12 < 7) {
      appendTrackMarking(
        whiteMarkingVertices,
        whiteMarkingIndices,
        index,
        0.15,
        laneBoundaryOffsetM,
      );
      appendTrackMarking(
        whiteMarkingVertices,
        whiteMarkingIndices,
        index,
        0.15,
        -laneBoundaryOffsetM,
      );
    }
    const edgeOffsetM = TEST_TRACK_WIDTH_M * 0.5 - 0.38;
    appendTrackMarking(
      whiteMarkingVertices,
      whiteMarkingIndices,
      index,
      0.18,
      edgeOffsetM,
    );
    appendTrackMarking(
      whiteMarkingVertices,
      whiteMarkingIndices,
      index,
      0.18,
      -edgeOffsetM,
    );
    continue;
  }
  const next = (index + 1) % sampledTrackPoints.length;
  const isCurve = curveMask[index] || curveMask[next];
  if (isCurve) {
    appendTrackMarking(yellowMarkingVertices, yellowMarkingIndices, index, 0.2);
  } else if (sampledTrackDistancesM[index] % 9 < 5) {
    appendTrackMarking(whiteMarkingVertices, whiteMarkingIndices, index, 0.16);
  }
}
const createTrackMarking = (
  vertices: number[],
  indices: number[],
  color: number,
) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const marking = new THREE.Mesh(geometry, material);
  marking.renderOrder = 4;
  marking.visible = !importedTrackCollisionOnly && !trackEditorMode;
  scene.add(marking);
  return marking;
};
createTrackMarking(yellowMarkingVertices, yellowMarkingIndices, 0xffca28);
createTrackMarking(whiteMarkingVertices, whiteMarkingIndices, 0xf3f3ec);

// Render y Jolt consumen exactamente las mismas secciones densas de spline.
// Una sección es una sola cinta: no hay cajas visuales ni decisiones de lado
// independientes entre muestras.
const renderTrackSafety = TEST_TRACK_SAFETY;
const guardrailGroup = new THREE.Group();
guardrailGroup.name = 'track-safety-guardrails';
guardrailGroup.visible = (
  ACTIVE_TRACK.configuration.geometry.boundaryMode === 'guardrails'
  && !importedTrackCollisionOnly
  && !trackEditorMode
);
const guardrailMaterial = createApexGalvanizedGuardrailMaterial();
const guardrailPostMaterial = createApexGuardrailPostMaterial();
const unitGuardrailBox = new THREE.BoxGeometry(1, 1, 1);
const guardrailRibbon = new THREE.Mesh(
  createApexCorrugatedGuardrailGeometry(renderTrackSafety),
  guardrailMaterial,
);
guardrailRibbon.name = 'guardrail-continuous-corrugated-ribbon';
guardrailRibbon.castShadow = true;
guardrailRibbon.receiveShadow = true;
guardrailGroup.add(guardrailRibbon);
const transformHelper = new THREE.Object3D();

const postSegments = selectApexGuardrailPostSegments(renderTrackSafety);
if (postSegments.length > 0) {
  const posts = new THREE.InstancedMesh(
    unitGuardrailBox,
    guardrailPostMaterial,
    postSegments.length,
  );
  posts.name = 'guardrail-posts';
  posts.castShadow = true;
  posts.receiveShadow = true;
  postSegments.forEach((segment, index) => {
    transformHelper.position.set(
      segment.start.x,
      segment.start.y + TRACK_GUARDRAIL_POST_HEIGHT_M * 0.5 - 0.18,
      segment.start.z,
    );
    transformHelper.quaternion.identity();
    transformHelper.scale.set(
      TRACK_GUARDRAIL_POST_WIDTH_M,
      TRACK_GUARDRAIL_POST_HEIGHT_M,
      TRACK_GUARDRAIL_POST_WIDTH_M,
    );
    transformHelper.updateMatrix();
    posts.setMatrixAt(index, transformHelper.matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  guardrailGroup.add(posts);
}

scene.add(guardrailGroup);
canvas.dataset.trackDirection = 'forward-from-grid-toward-negative-z';
canvas.dataset.trackSafetySystem = 'curvature-elevation-v1';
canvas.dataset.trackGuardrailGeometry = 'shared-corrugated-w-spline-ribbon';
canvas.dataset.trackGuardrailSectionCount = String(renderTrackSafety.sections.length);
canvas.dataset.trackGuardrailSegmentCount = String(renderTrackSafety.segments.length);
canvas.dataset.trackGuardrailProtectedLengthM = (
  renderTrackSafety.protectedLengthM.toFixed(1)
);
canvas.dataset.trackGuardrailVisualHeightM = (
  TRACK_GUARDRAIL_VISUAL_HEIGHT_M.toFixed(2)
);
canvas.dataset.trackGuardrailArrowCount = '0';
canvas.dataset.trackGuardrailArrowStatus = 'deferred-visual-redesign';
canvas.dataset.trackPhysicsGuardrailSegmentCount = String(
  TEST_TRACK_SAFETY.segments.length,
);
canvas.dataset.trackGuardrailOrientationErrors = String(
  renderTrackSafety.orientationErrorCount,
);
canvas.dataset.trackGuardrailMaximumJoinGapM = (
  renderTrackSafety.maximumJoinGapM.toFixed(6)
);
canvas.dataset.trackCurveRibbonCount = '0';
canvas.dataset.trackLaneCount = String(TEST_TRACK_LANE_COUNT);
canvas.dataset.trackCenterMarkings = importedTrackCollisionOnly
  ? 'none-imported-visual'
  : TEST_TRACK_LANE_COUNT === 3
    ? 'three-lane-dashed-white,solid-white-edges'
    : 'yellow-solid-curves,white-dashed-straights';

const trackIndices: number[] = [];
const shoulderIndices: number[] = [];
const shoulderGroundFeatherIndices: number[] = [];
const trackGrassTransitionIndices: number[] = [];
for (let index = 0; index < sampledTrackPoints.length; index += 1) {
  const next = (index + 1) % sampledTrackPoints.length;
  const left = index * 2;
  const right = left + 1;
  const nextLeft = next * 2;
  const nextRight = nextLeft + 1;
  trackIndices.push(left, nextLeft, right, right, nextLeft, nextRight);
  const shoulderRingStart = index * 12;
  const nextShoulderRingStart = next * 12;
  for (let strip = 1; strip <= 4; strip += 1) {
    const stage = 4 - strip;
    if (
      ACTIVE_TRACK.configuration.geometry.roadsideMode === 'shoulder'
      && stage !== 0
    ) continue;
    if (
      !shoulderConfluence.masks[index].left[stage]
      || !shoulderConfluence.masks[next].left[stage]
    ) continue;
    const outer = shoulderRingStart + strip;
    const inner = outer + 1;
    const nextOuter = nextShoulderRingStart + strip;
    const nextInner = nextOuter + 1;
    shoulderIndices.push(
      outer, nextOuter, inner,
      inner, nextOuter, nextInner,
    );
  }
  for (let strip = 6; strip <= 9; strip += 1) {
    const stage = strip - 6;
    if (
      ACTIVE_TRACK.configuration.geometry.roadsideMode === 'shoulder'
      && stage !== 0
    ) continue;
    if (
      !shoulderConfluence.masks[index].right[stage]
      || !shoulderConfluence.masks[next].right[stage]
    ) continue;
    const inner = shoulderRingStart + strip;
    const outer = inner + 1;
    const nextInner = nextShoulderRingStart + strip;
    const nextOuter = nextInner + 1;
    shoulderIndices.push(
      inner, nextInner, outer,
      outer, nextInner, nextOuter,
    );
  }
  const toeLeft = shoulderRingStart;
  const lowerLeft = toeLeft + 1;
  const nextToeLeft = nextShoulderRingStart;
  const nextLowerLeft = nextToeLeft + 1;
  const lowerRight = shoulderRingStart + 10;
  const toeRight = lowerRight + 1;
  const nextLowerRight = nextShoulderRingStart + 10;
  const nextToeRight = nextLowerRight + 1;
  if (
    ACTIVE_TRACK.configuration.geometry.roadsideMode === 'adaptive-terrain'
    && shoulderConfluence.masks[index].left[4]
    && shoulderConfluence.masks[next].left[4]
  ) {
    shoulderGroundFeatherIndices.push(
      toeLeft, nextToeLeft, lowerLeft,
      lowerLeft, nextToeLeft, nextLowerLeft,
    );
  }
  if (
    ACTIVE_TRACK.configuration.geometry.roadsideMode === 'adaptive-terrain'
    && shoulderConfluence.masks[index].right[4]
    && shoulderConfluence.masks[next].right[4]
  ) {
    shoulderGroundFeatherIndices.push(
      lowerRight, nextLowerRight, toeRight,
      toeRight, nextLowerRight, nextToeRight,
    );
  }
  const transitionLeftInner = index * 4;
  const transitionLeftOuter = transitionLeftInner + 1;
  const transitionRightInner = transitionLeftInner + 2;
  const transitionRightOuter = transitionLeftInner + 3;
  const nextTransitionLeftInner = next * 4;
  const nextTransitionLeftOuter = nextTransitionLeftInner + 1;
  const nextTransitionRightInner = nextTransitionLeftInner + 2;
  const nextTransitionRightOuter = nextTransitionLeftInner + 3;
  if (
    shoulderConfluence.masks[index].left[0]
    && shoulderConfluence.masks[next].left[0]
  ) {
    trackGrassTransitionIndices.push(
      transitionLeftOuter, nextTransitionLeftOuter, transitionLeftInner,
      transitionLeftInner, nextTransitionLeftOuter, nextTransitionLeftInner,
    );
  }
  if (
    shoulderConfluence.masks[index].right[0]
    && shoulderConfluence.masks[next].right[0]
  ) {
    trackGrassTransitionIndices.push(
      transitionRightInner, nextTransitionRightInner, transitionRightOuter,
      transitionRightOuter, nextTransitionRightInner, nextTransitionRightOuter,
    );
  }
}
if (ACTIVE_TRACK.configuration.geometry.roadsideMode === 'none') {
  shoulderIndices.length = 0;
  shoulderGroundFeatherIndices.length = 0;
  trackGrassTransitionIndices.length = 0;
}
const trackGeometry = new THREE.BufferGeometry();
trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trackVertices, 3));
trackGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(trackNormals, 3));
trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(trackUvs, 2));
trackGeometry.setIndex(trackIndices);
const trackMinEdgeClearanceM = Math.min(
  ...trackVertices.filter((_, componentIndex) => componentIndex % 3 === 1),
) - TEST_TRACK_GROUND_HEIGHT_M;
const shoulderGeometry = new THREE.BufferGeometry();
shoulderGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(shoulderVertices, 3),
);
shoulderGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUvs, 2));
shoulderGeometry.setAttribute('uv1', new THREE.Float32BufferAttribute(shoulderUvs, 2));
shoulderGeometry.setIndex(shoulderIndices);
shoulderGeometry.computeVertexNormals();
const shoulderGroundFeatherGeometry = new THREE.BufferGeometry();
shoulderGroundFeatherGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(shoulderVertices, 3),
);
shoulderGroundFeatherGeometry.setAttribute(
  'uv',
  new THREE.Float32BufferAttribute(shoulderUvs, 2),
);
shoulderGroundFeatherGeometry.setAttribute(
  'uv1',
  new THREE.Float32BufferAttribute(shoulderGroundFeatherFadeUvs, 2),
);
shoulderGroundFeatherGeometry.setIndex(shoulderGroundFeatherIndices);
shoulderGroundFeatherGeometry.computeVertexNormals();
const shoulderNormals = shoulderGeometry.getAttribute('normal');
const shoulderFeatherNormals = shoulderGroundFeatherGeometry.getAttribute('normal');
for (let sample = 0; sample < sampledTrackPoints.length; sample += 1) {
  for (const ringOffset of [0, 1, 10, 11]) {
    const vertexIndex = sample * 12 + ringOffset;
    shoulderNormals.setXYZ(
      vertexIndex,
      shoulderFeatherNormals.getX(vertexIndex),
      shoulderFeatherNormals.getY(vertexIndex),
      shoulderFeatherNormals.getZ(vertexIndex),
    );
  }
}
shoulderNormals.needsUpdate = true;
const trackGrassTransitionGeometry = new THREE.BufferGeometry();
trackGrassTransitionGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(trackGrassTransitionVertices, 3),
);
trackGrassTransitionGeometry.setAttribute(
  'uv',
  new THREE.Float32BufferAttribute(trackGrassTransitionUvs, 2),
);
trackGrassTransitionGeometry.setAttribute(
  'uv1',
  new THREE.Float32BufferAttribute(trackGrassTransitionFadeUvs, 2),
);
trackGrassTransitionGeometry.setIndex(trackGrassTransitionIndices);
trackGrassTransitionGeometry.computeVertexNormals();

const roadTextureLoader = new THREE.TextureLoader();
const roadTextureProfiles = Object.freeze({
  road015a: Object.freeze({
    Color: 'assets/road/Road015A_1K-JPG_Color.jpg',
    NormalDX: 'assets/road/Road015A_1K-JPG_NormalDX.jpg',
    Roughness: 'assets/road/Road015A_1K-JPG_Roughness.jpg',
  }),
  'aerial-asphalt-01': Object.freeze({
    Color: 'assets/road/aerial-asphalt-01/aerial_asphalt_01_diff_1k.jpg',
    NormalDX: 'assets/road/aerial-asphalt-01/aerial_asphalt_01_nor_dx_1k.jpg',
    Roughness: 'assets/road/aerial-asphalt-01/aerial_asphalt_01_rough_1k.jpg',
  }),
  'clean-asphalt': Object.freeze({
    Color: 'assets/road/clean-asphalt/clean_asphalt_diff_1k.jpg',
    NormalDX: 'assets/road/clean-asphalt/clean_asphalt_nor_dx_1k.jpg',
    Roughness: 'assets/road/clean-asphalt/clean_asphalt_rough_1k.jpg',
  }),
  'asphalt-track': Object.freeze({
    Color: 'assets/road/asphalt-track/asphalt_track_diff_1k.jpg',
    NormalDX: 'assets/road/asphalt-track/asphalt_track_nor_dx_1k.jpg',
    Roughness: 'assets/road/asphalt-track/asphalt_track_rough_1k.jpg',
  }),
});
type RoadTextureProfileId = keyof typeof roadTextureProfiles;
const requestedRoadTexture = searchParams.get('road');
const activeRoadTextureId: RoadTextureProfileId = (
  requestedRoadTexture === 'clean-asphalt'
    ? 'clean-asphalt'
    : requestedRoadTexture === 'asphalt-track'
      ? 'asphalt-track'
      : requestedRoadTexture === 'road015a'
        ? 'road015a'
        : 'aerial-asphalt-01'
);
const roadTextureFiles = roadTextureProfiles[activeRoadTextureId];
canvas.dataset.roadTexture = activeRoadTextureId;
const loadRoadTexture = (
  name: keyof typeof roadTextureFiles,
  colorTexture = false,
) => {
  const texture = roadTextureLoader.load(
    apexDrivePublicUrl(roadTextureFiles[name]),
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = colorTexture ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
};
const roadColorMap = loadRoadTexture('Color', true);
const roadNormalMap = loadRoadTexture('NormalDX');
const roadRoughnessMap = loadRoadTexture('Roughness');
const roadMaterial = new THREE.MeshPhysicalMaterial({
  map: roadColorMap,
  normalMap: roadNormalMap,
  normalScale: new THREE.Vector2(1, -1),
  roughnessMap: roadRoughnessMap,
  roughness: 1,
  metalness: 0,
  // El collider de pista es plano. El relieve queda en la normal para que el
  // material conserve detalle sin levantar geometría visual sobre la rueda.
  envMapIntensity: 1,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
const parkingLotVisual = createApexParkingLotVisual({
  bayCount: parkingCarCatalog.length,
  bayLabels: parkingCarCatalog.map(definition => definition.name),
});
scene.add(parkingLotVisual.group);
canvas.dataset.parkingLayout = parkingLotVisual.group.userData.layoutVersion;
canvas.dataset.parkingBayCount = String(parkingLotVisual.bayCount);
const editableTrackPoints = TEST_TRACK_IS_CLOSED
  ? TEST_TRACK_POINTS.slice(0, -1)
  : TEST_TRACK_POINTS;
const trackEditorControlSpacingM = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.editor.controlSpacingM
  ?? APEX_TRACK_EDITOR_CONTROL_SPACING_M
);
const trackEditorCollisionSpacingM = (
  ACTIVE_TRACK_PRIMARY_SEGMENT?.editor.collisionSpacingM
  ?? APEX_TRACK_EDITOR_COLLISION_SPACING_M
);
const authoredTrackControlPoints = (
  ACTIVE_TRACK_PRIMARY_SEGMENT
    ? ACTIVE_TRACK_PRIMARY_SEGMENT.controlPoints.map(point => Object.freeze({
      x: point.x,
      y: point.y,
      z: point.z,
      bankRadians: point.bankRadians,
      surface: point.surface as TrackPoint['surface'],
    }))
    : ACTIVE_TRACK.track.id === CIRCUITO_CHALLHUACO_ID
    ? CIRCUITO_CHALLHUACO_CONTROL_POINTS.map(point => Object.freeze({
      ...point,
      bankRadians: 0,
      surface: 'gravel' as const,
    }))
    : undefined
);
const createEditedTrackDerivedState = (
  points: readonly TrackPoint[],
  roadWidthM: number,
  boundaryMode = ACTIVE_TRACK.configuration.geometry.boundaryMode,
  roadsideMode = ACTIVE_TRACK.configuration.geometry.roadsideMode,
  closed = TEST_TRACK_IS_CLOSED,
  laneCount = TEST_TRACK_LANE_COUNT,
  collisionSpacingM = trackEditorCollisionSpacingM,
): ApexTrackDerivedState => createApexTrackDerivedState({
  points,
  roadWidthM,
  boundaryMode,
  roadsideMode,
  closed,
  groundHeightM: TEST_TRACK_GROUND_HEIGHT_M,
  shoulderWidthM: resolveTrackRoadsideWidthM(
    roadsideMode,
    TEST_TRACK_SHOULDER_WIDTH_M,
    roadWidthM,
  ),
  laneCount,
  timing: {
    startRadiusM: trackTiming.startRadiusM,
    checkpointRadiusM: trackTiming.checkpointRadiusM,
    checkpointSpacingM: (
      trackTiming.checkpointIntervalPoints
      * collisionSpacingM
    ),
    ignoredTailDistanceM: (
      trackTiming.ignoredTailPoints
      * collisionSpacingM
    ),
  },
});
let editedTrackDerivedState = createEditedTrackDerivedState(
  editableTrackPoints,
  TEST_TRACK_WIDTH_M,
);
let trackCollisionDebugVisual: ApexTrackCollisionDebugVisual | undefined;
let trackEditDerivedVisual: ApexTrackEditDerivedVisual | undefined;
let trackEditorSnapToRoad:
  | ApexDirtRoadForestVisual['snapToRoad']
  | undefined;
if (ACTIVE_TRACK.track.id === CIRCUITO_CHALLHUACO_ID) {
  const dirtRoadForestVisual = createApexDirtRoadForestVisual();
  trackEditorSnapToRoad = dirtRoadForestVisual.snapToRoad;
  dirtRoadForestVisual.group.visible = !isParkingSelection;
  scene.add(dirtRoadForestVisual.group);
  canvas.dataset.dirtRoadForest = 'loading-visual-with-procedural-collision';
  void dirtRoadForestVisual.ready.then(summary => {
    canvas.dataset.dirtRoadForest = 'ready-visual-with-procedural-collision';
    canvas.dataset.dirtRoadForestMeshes = String(summary.meshCount);
    canvas.dataset.dirtRoadForestMaterials = String(summary.materialCount);
    canvas.dataset.dirtRoadForestTriangles = String(summary.triangleCount);
    canvas.dataset.dirtRoadForestSizeM = summary.sizeM
      .map(value => value.toFixed(2))
      .join(',');
  }).catch(error => {
    canvas.dataset.dirtRoadForest = 'error';
    console.warn('No se pudo cargar Dirt Road Through Forest', error);
  });
  canvas.dataset.challhuacoParkingSelection = isParkingSelection
    ? 'isolated-then-spawn-on-track'
    : 'disabled-circuit-drive';
} else {
  canvas.dataset.dirtRoadForest = 'disabled-for-this-track';
}
if (trackEditorMode) {
  trackCollisionDebugVisual = createApexTrackCollisionDebugVisual({
    points: editableTrackPoints,
    roadWidthM: TEST_TRACK_WIDTH_M,
    roadThicknessM: TEST_TRACK_THICKNESS_M,
    closed: TEST_TRACK_IS_CLOSED,
    boundaryMode: editedTrackDerivedState.boundaryMode,
    safety: editedTrackDerivedState.safety,
  });
  trackCollisionDebugVisual.group.visible = !isParkingSelection;
  scene.add(trackCollisionDebugVisual.group);
  trackEditDerivedVisual = createApexTrackEditDerivedVisual({
    roadMaterial,
    roadsideMaterial: grassMaterial,
    showProceduralSurface: (
      !importedTrackCollisionOnly
      || (
        requestedTrackEditorSegmentId !== undefined
        && requestedTrackEditorSegmentId
          !== (ACTIVE_TRACK_PRIMARY_SEGMENT?.id ?? 'main')
      )
    ),
  });
  trackEditDerivedVisual.update(editedTrackDerivedState);
  scene.add(trackEditDerivedVisual.group);
  canvas.dataset.trackCollisionDebug = isParkingSelection
    ? 'hidden-during-parking-selection'
    : 'visible-only-in-track-editor';
  canvas.dataset.trackCollisionDebugSegments = String(
    trackCollisionDebugVisual.group.userData.segmentCount,
  );
} else {
  canvas.dataset.trackCollisionDebug = 'disabled-for-this-track';
}
const transitionAlphaCanvas = document.createElement('canvas');
transitionAlphaCanvas.width = 128;
transitionAlphaCanvas.height = 4;
const transitionAlphaContext = transitionAlphaCanvas.getContext('2d')!;
const transitionAlphaGradient = transitionAlphaContext.createLinearGradient(0, 0, 128, 0);
transitionAlphaGradient.addColorStop(0, '#ffffff');
transitionAlphaGradient.addColorStop(0.45, '#ffffff');
transitionAlphaGradient.addColorStop(0.78, '#8c8c8c');
transitionAlphaGradient.addColorStop(1, '#000000');
transitionAlphaContext.fillStyle = transitionAlphaGradient;
transitionAlphaContext.fillRect(0, 0, 128, 4);
const transitionAlphaMap = new THREE.CanvasTexture(transitionAlphaCanvas);
transitionAlphaMap.wrapS = THREE.ClampToEdgeWrapping;
transitionAlphaMap.wrapT = THREE.ClampToEdgeWrapping;
transitionAlphaMap.channel = 1;
const trackGrassTransitionMaterial = roadMaterial.clone();
trackGrassTransitionMaterial.alphaMap = transitionAlphaMap;
trackGrassTransitionMaterial.transparent = true;
trackGrassTransitionMaterial.depthWrite = false;
trackGrassTransitionMaterial.polygonOffset = true;
trackGrassTransitionMaterial.polygonOffsetFactor = -2;
trackGrassTransitionMaterial.polygonOffsetUnits = -2;
const shoulderGroundFeatherMaterial = grassMaterial.clone();
shoulderGroundFeatherMaterial.alphaMap = transitionAlphaMap;
shoulderGroundFeatherMaterial.transparent = true;
shoulderGroundFeatherMaterial.depthWrite = false;
const trackVisualLodEnabled = (
  !importedTrackCollisionOnly
  && !trackEditorMode
  && ACTIVE_TRACK.assets.visual.format === 'procedural'
  && (trackLengthM >= 1_400 || sampledTrackPoints.length >= 700)
);
let trackLodRuntime: ReturnType<typeof createTrackVisualLodSystem> | undefined;
let lastTrackLodMetricsUpdateMs = 0;
if (trackVisualLodEnabled) {
  const roadMediumMaterial = new THREE.MeshStandardMaterial({
    map: roadColorMap,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const averageSampleSpacingM = (
    trackCurve.getLength() / sampledTrackPoints.length
  );
  const shoulderLodStripVisible = (
    currentSample: number,
    nextSample: number,
    firstOffset: number,
    secondOffset: number,
  ): boolean => {
    const left = firstOffset <= 5 && secondOffset <= 5;
    const right = firstOffset >= 6 && secondOffset >= 6;
    if (!left && !right) return false;
    const firstProfileIndex = left ? 5 - firstOffset : firstOffset - 6;
    const secondProfileIndex = left ? 5 - secondOffset : secondOffset - 6;
    const firstStage = Math.min(firstProfileIndex, secondProfileIndex);
    const finalStage = Math.max(firstProfileIndex, secondProfileIndex);
    for (let stage = firstStage; stage < finalStage; stage += 1) {
      if (
        !shoulderConfluence.masks[currentSample][left ? 'left' : 'right'][stage]
        || !shoulderConfluence.masks[nextSample][left ? 'left' : 'right'][stage]
      ) return false;
    }
    return true;
  };
  const trackLod = createTrackVisualLodSystem({
    samplePoints: sampledTrackPoints,
    chunkSampleSpan: Math.max(
      32,
      Math.round(320 / averageSampleSpacingM),
    ),
    boundsPaddingM: Math.max(
      18,
      TEST_TRACK_WIDTH_M * 0.75 + TEST_TRACK_SHOULDER_WIDTH_M,
    ),
    maximumVisibleDistanceM: 1_600,
    levels: [
      { distanceM: 0, sampleStep: 1 },
      { distanceM: 240, sampleStep: 4 },
      { distanceM: 700, sampleStep: 12 },
    ],
    layers: [
      {
        name: 'road',
        geometry: trackGeometry,
        materials: [roadMaterial, roadMediumMaterial, roadMediumMaterial],
        ringVertexCount: 2,
        strips: [[0, 1]],
      },
      {
        name: 'road-grass-transition',
        geometry: trackGrassTransitionGeometry,
        materials: [trackGrassTransitionMaterial],
        ringVertexCount: 4,
        strips: [[1, 0], [2, 3]],
        maximumLevel: 0,
        renderOrder: 1,
        stripVisible: (
          currentSample,
          nextSample,
          firstOffset,
        ) => {
          const side = firstOffset < 2 ? 'left' : 'right';
          return (
            shoulderConfluence.masks[currentSample][side][0]
            && shoulderConfluence.masks[nextSample][side][0]
          );
        },
      },
      {
        name: 'shoulder',
        geometry: shoulderGeometry,
        materials: [
          grassMaterial,
          grassMaterial,
          grassMaterial,
        ],
        ringVertexCount: 12,
        strips: [
          [1, 2], [2, 3], [3, 4], [4, 5],
          [6, 7], [7, 8], [8, 9], [9, 10],
        ],
        stripsByLevel: [
          [
            [1, 2], [2, 3], [3, 4], [4, 5],
            [6, 7], [7, 8], [8, 9], [9, 10],
          ],
          [
            [0, 1],
            [1, 2], [2, 3], [3, 4], [4, 5],
            [6, 7], [7, 8], [8, 9], [9, 10],
            [10, 11],
          ],
          [
            [0, 1],
            [1, 2], [2, 3], [3, 4], [4, 5],
            [6, 7], [7, 8], [8, 9], [9, 10],
            [10, 11],
          ],
        ],
        surface: 'grass',
        stripVisible: shoulderLodStripVisible,
        stripVisibleByLevel: [
          shoulderLodStripVisible,
          null,
          null,
        ],
      },
      {
        name: 'shoulder-ground-feather',
        geometry: shoulderGroundFeatherGeometry,
        materials: [
          shoulderGroundFeatherMaterial,
          grassMaterial,
          grassMaterial,
        ],
        ringVertexCount: 12,
        strips: [[0, 1], [10, 11]],
        renderOrder: 1,
        maximumLevel: 0,
        stripVisible: shoulderLodStripVisible,
      },
    ],
  });
  trackLodRuntime = trackLod;
  scene.add(trackLod.root);
  canvas.dataset.trackLod = 'adaptive-large-track-v4';
  canvas.dataset.trackLodChunks = String(trackLod.chunkCount);
  canvas.dataset.trackLodLevels = String(trackLod.levelCount);
  canvas.dataset.trackLodMeshes = String(trackLod.meshCount);
  canvas.dataset.trackLodDistancesM = '240,700';
  canvas.dataset.trackLodMaximumVisibleDistanceM = '1600';
  canvas.dataset.trackLodFullResolutionTriangles = String(
    Math.round(trackLod.fullResolutionTriangleCount),
  );
} else {
  const trackRoad = new THREE.Mesh(trackGeometry, roadMaterial);
  trackRoad.receiveShadow = true;
  trackRoad.visible = !importedTrackCollisionOnly && !trackEditorMode;
  scene.add(trackRoad);

  const trackGrassTransition = new THREE.Mesh(
    trackGrassTransitionGeometry,
    trackGrassTransitionMaterial,
  );
  trackGrassTransition.receiveShadow = true;
  trackGrassTransition.renderOrder = 1;
  trackGrassTransition.visible = !importedTrackCollisionOnly && !trackEditorMode;
  scene.add(trackGrassTransition);

  const trackShoulders = new THREE.Mesh(shoulderGeometry, grassMaterial);
  trackShoulders.receiveShadow = true;
  trackShoulders.userData.surface = 'grass';
  trackShoulders.visible = !importedTrackCollisionOnly && !trackEditorMode;
  scene.add(trackShoulders);

  const shoulderGroundFeather = new THREE.Mesh(
    shoulderGroundFeatherGeometry,
    shoulderGroundFeatherMaterial,
  );
  shoulderGroundFeather.receiveShadow = true;
  shoulderGroundFeather.renderOrder = 1;
  shoulderGroundFeather.visible = !importedTrackCollisionOnly && !trackEditorMode;
  scene.add(shoulderGroundFeather);
  canvas.dataset.trackLod = 'disabled-baseline-track';
  const triangleCount = (geometry: THREE.BufferGeometry): number => (
    (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
  );
  canvas.dataset.trackLodFullResolutionTriangles = String(Math.round(
    triangleCount(trackGeometry)
    + triangleCount(trackGrassTransitionGeometry)
    + triangleCount(shoulderGeometry)
    + triangleCount(shoulderGroundFeatherGeometry),
  ));
}

canvas.dataset.trackHorizonMounds = '0';
canvas.dataset.trackHorizonOcclusion = 'removed';
const trackTunnels = createTrackTunnelSystem(shoulderConfluence.tunnels);
trackTunnels.group.visible = !importedTrackCollisionOnly && !trackEditorMode;
scene.add(trackTunnels.group);
canvas.dataset.trackTunnelCount = String(
  importedTrackCollisionOnly ? 0 : trackTunnels.count,
);
canvas.dataset.trackTunnelGeometry = !importedTrackCollisionOnly && trackTunnels.count > 0
  ? 'semi-elliptic-open-shell-v1'
  : 'none-detected';

const racingLineStorageKey = [
  'apex-drive',
  'track',
  formatApexDriveTrackNumber(ACTIVE_TRACK.track.number),
  ACTIVE_TRACK.track.id,
  ACTIVE_TRACK.track.version,
  'racing-line-points.v2-clean-incidents',
].join('.');
const racingLineFrames = Object.freeze(
  sampledTrackPoints.map((point, index) => Object.freeze({
    center: Object.freeze({ x: point.x, y: point.y, z: point.z }),
    horizontalLateral: Object.freeze({
      x: sampledTrackHorizontalLaterals[index].x,
      y: sampledTrackHorizontalLaterals[index].y,
      z: sampledTrackHorizontalLaterals[index].z,
    }),
    surfaceLateral: Object.freeze({
      x: sampledTrackLaterals[index].x,
      y: sampledTrackLaterals[index].y,
      z: sampledTrackLaterals[index].z,
    }),
    surfaceUp: Object.freeze({
      x: sampledTrackSurfaceUps[index].x,
      y: sampledTrackSurfaceUps[index].y,
      z: sampledTrackSurfaceUps[index].z,
    }),
  })),
);
const generatedRacingLinePlan = createApexRacingLinePlan({
  frames: racingLineFrames,
  distancesM: sampledTrackDistancesM,
  trackHalfWidthM: TEST_TRACK_WIDTH_M * 0.5,
  closed: TEST_TRACK_IS_CLOSED,
  safetyMarginM: TEST_TRACK_LANE_COUNT === 3 ? 1.35 : 1.05,
  maximumSpeedKmh: TEST_TRACK_LANE_COUNT === 3 ? 310 : 245,
  maximumLateralAccelerationMps2: 11.95,
  maximumAccelerationMps2: 5.8,
  maximumBrakingMps2: 10.2,
  guidanceCurveRadiusM: TEST_TRACK_LANE_COUNT === 3 ? 620 : 420,
});
const racingLineLearner = new ApexRacingLineLearner(
  racingLineFrames,
  sampledTrackDistancesM,
  TEST_TRACK_WIDTH_M * 0.5 - 0.8,
  racingLineStorageKey,
  generatedRacingLinePlan.offsetsM,
);
const createGuidanceChevrons = (
  plan: typeof generatedRacingLinePlan,
) => createTrackGuidanceChevronSystem({
  plan,
  spacingM: TEST_TRACK_LANE_COUNT === 3 ? 14 : 11,
  lengthM: TEST_TRACK_LANE_COUNT === 3 ? 3.72 : 3.08,
  widthM: TEST_TRACK_LANE_COUNT === 3 ? 3.08 : 2.58,
  strokeWidthM: TEST_TRACK_LANE_COUNT === 3 ? 0.42 : 0.36,
});
let trackGuidanceChevrons = createGuidanceChevrons(
  generatedRacingLinePlan,
);
trackGuidanceChevrons.group.visible = (
  !trackEditorMode
);
scene.add(trackGuidanceChevrons.group);
canvas.dataset.racingPlanAlgorithm = generatedRacingLinePlan.algorithm;
canvas.dataset.racingPlanMinimumSpeedKmh = (
  generatedRacingLinePlan.minimumTargetSpeedKmh.toFixed(1)
);
canvas.dataset.racingPlanMaximumSpeedKmh = (
  generatedRacingLinePlan.maximumTargetSpeedKmh.toFixed(1)
);
canvas.dataset.racingPlanMaximumOffsetM = (
  generatedRacingLinePlan.maximumAbsoluteOffsetM.toFixed(2)
);
canvas.dataset.trackGuidanceAccelerateCount = String(
  trackGuidanceChevrons.counts.accelerate,
);
canvas.dataset.trackGuidanceLiftCount = String(
  trackGuidanceChevrons.counts.lift,
);
canvas.dataset.trackGuidanceBrakeCount = String(
  trackGuidanceChevrons.counts.brake,
);
const autonomousCenterLine = Object.freeze(sampledTrackPoints.map(
  (point, index) => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    distanceM: sampledTrackDistancesM[index],
  }),
));
const autonomousMemoryStorageKey = (definition: ApexCarDefinition) => [
  'apex-drive',
  'autonomous-memory',
  formatApexDriveTrackNumber(ACTIVE_TRACK.track.number),
  ACTIVE_TRACK.track.id,
  ACTIVE_TRACK.track.version,
  definition.id,
  'v8-driver-baseline-local-retry-10m',
].join('.');
const segmentTimingStorageKey = (definition: ApexCarDefinition) => [
  'apex-drive',
  'rally-segments',
  formatApexDriveTrackNumber(ACTIVE_TRACK.track.number),
  ACTIVE_TRACK.track.id,
  ACTIVE_TRACK.track.version,
  definition.id,
  'v1-10-segments',
].join('.');
const autonomousDriver = new ApexAutonomousDriver(
  autonomousCenterLine,
  TEST_TRACK_WIDTH_M,
);
const autonomousPanel = new ApexAutonomousPanel();
autonomousPanelRoot.hidden = !autonomousPanelVisible || isAuditRuntime;
let activeRacingLinePoints = racingLineLearner.points();
autonomousDriver.setLine(activeRacingLinePoints);
autonomousDriver.configureMemory(autonomousMemoryStorageKey(activeCar));
const segmentTimer = new ApexSegmentTimer(segmentTimingStorageKey(activeCar));
const autonomousObstacles: ApexAutonomousObstacle[] = [];
const autonomousHoldInput: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  throttle: 0,
  brake: 1,
  steering: 0,
});
const manualSteeringValue = (manual: DriverInput): number => (
  Number.isFinite(manual.steering)
    ? THREE.MathUtils.clamp(manual.steering!, -1, 1)
    : manual.right && !manual.left
      ? 1
      : manual.left && !manual.right ? -1 : 0
);
const manualPedalValue = (manual: DriverInput): number => (
  Number.isFinite(manual.throttle)
    ? THREE.MathUtils.clamp(manual.throttle!, 0, 1)
    : manual.forward !== manual.backward ? 1 : 0
);
const manualOverrideChannels = (manual: DriverInput): readonly string[] => {
  const channels: string[] = [];
  if (
    manual.left !== manual.right
    || Math.abs(manualSteeringValue(manual)) > 0.04
  ) channels.push('STR');
  if (
    manual.forward
    || manual.backward
    || manualPedalValue(manual) > 0.03
  ) channels.push(manual.backward ? 'REV' : 'THR');
  if ((manual.brake ?? 0) > 0.03) channels.push('BRK');
  if (manual.handbrake) channels.push('HBR');
  return channels;
};
const blendAutonomousAssistance = (
  autonomous: DriverInput,
  manual: DriverInput,
): DriverInput => {
  const manualSteering = manualSteeringValue(manual);
  const steeringOverride = (
    manual.left !== manual.right
    || Math.abs(manualSteering) > 0.04
  );
  const steering = steeringOverride
    ? manualSteering
    : autonomous.steering ?? 0;
  const manualPedal = manualPedalValue(manual);
  const manualBrake = THREE.MathUtils.clamp(manual.brake ?? 0, 0, 1);
  const throttleOverride = (
    manual.forward
    || manual.backward
    || manualPedal > 0.03
  );
  const brakeOverride = manualBrake > 0.03;
  let throttle = throttleOverride
    ? manualPedal
    : autonomous.throttle ?? 0;
  let brake = brakeOverride
    ? manualBrake
    : throttleOverride ? 0 : autonomous.brake ?? 0;
  let forward = throttleOverride
    ? !manual.backward
    : autonomous.forward;
  let backward = throttleOverride
    ? manual.backward
    : autonomous.backward;
  let handbrake = manual.handbrake
    || (!throttleOverride && !brakeOverride && autonomous.handbrake);
  if (brakeOverride) {
    throttle = 0;
    forward = false;
    backward = false;
  }
  if (manual.handbrake) {
    throttle = 0;
    brake = manualBrake;
    forward = false;
    backward = false;
    handbrake = true;
  }
  return {
    forward: forward && throttle > 0.01,
    backward: backward && throttle > 0.01,
    left: false,
    right: false,
    handbrake,
    throttle,
    brake,
    steering,
  };
};
let autonomousDriveEnabled = false;
let autonomousLapActive = false;
let autonomousTimingPhase: LapTimerPhase = 'arming';
let autonomousFreeLapPreviousProgress: number | undefined;
let autonomousFreeLapTravel = 0;
let simulationNow = performance.now();
let autonomousFreeLapStartedAt = simulationNow;
let autonomousLearningLapElapsedMs = 0;
let autonomousLearningLapSource: 'race' | 'free' = 'free';
let autonomousRaceStartPending = false;
let autonomousRaceStartHook = (): boolean => false;
const resetAutonomousFreeLap = (now = simulationNow) => {
  autonomousFreeLapPreviousProgress = undefined;
  autonomousFreeLapTravel = 0;
  autonomousFreeLapStartedAt = now;
  autonomousLearningLapElapsedMs = 0;
};
const setAutonomousDriveEnabled = (enabled: boolean) => {
  autonomousDriveEnabled = (
    enabled
    && activeVehicleKind === 'car'
    && !isAuditRuntime
  );
  if (!autonomousDriveEnabled) {
    autonomousRaceStartPending = false;
    autonomousDriver.cancelLap();
    autonomousDriver.reset();
    autonomousLapActive = false;
    resetAutonomousFreeLap();
  } else {
    autonomousLapActive = false;
    resetAutonomousFreeLap();
    lapGhost.beginLap();
    autonomousRaceStartPending = autonomousRaceStartHook();
    if (autonomousRaceStartPending) autonomousTimingPhase = 'arming';
  }
  autonomousDriveButton.setAttribute(
    'aria-pressed',
    String(autonomousDriveEnabled),
  );
  autonomousDriveButton.textContent = autonomousDriveEnabled
    ? 'Asistencia IA · encendida'
    : 'Asistencia IA · apagada';
  autonomousDriveStatus.textContent = autonomousDriveEnabled
    ? autonomousRaceStartPending
      ? 'IA · preparando grilla y largada'
      : 'IA · buscando trazada'
    : 'IA · esperando activación';
  canvas.dataset.autonomousDrive = autonomousDriveEnabled ? 'on' : 'off';
};
autonomousDriveButton.disabled = activeVehicleKind !== 'car' || isAuditRuntime;
autonomousDriveButton.addEventListener('click', () => {
  setAutonomousDriveEnabled(!autonomousDriveEnabled);
});
setAutonomousDriveEnabled(false);
// La trazada aprendida continúa alimentando a la IA y a las herramientas de
// diagnóstico, pero nunca se dibuja como una cinta continua sobre el asfalto.
// Los chevrons son una capa independiente derivada del plan estable de pista.
const refreshRacingLineStatus = () => {
  const guidePoints = activeRacingLinePoints;
  canvas.dataset.racingLineSource = racingLineLearner.isApproximation
    ? 'approximation'
    : 'learned-lap';
  canvas.dataset.racingLineLearnedLaps = String(racingLineLearner.lapCount);
  canvas.dataset.racingLinePointCount = String(guidePoints.length);
  racingLineStatus.textContent = racingLineLearner.isApproximation
    ? 'Trazada · aproximación inicial'
    : `Trazada · ${racingLineLearner.lapCount} vuelta${
      racingLineLearner.lapCount === 1 ? '' : 's'
    } aprendida${racingLineLearner.lapCount === 1 ? '' : 's'}`;
};
refreshRacingLineStatus();

const writeClipboardText = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('El navegador rechazó el portapapeles');
};
copyRacingLineButton.hidden = isAuditRuntime;
copyRacingLineButton.addEventListener('click', async () => {
  const payload = createApexRacingLinePlanPayload(
    generatedRacingLinePlan,
    {
      number: ACTIVE_TRACK.track.number,
      id: ACTIVE_TRACK.track.id,
      version: ACTIVE_TRACK.track.version,
    },
  );
  try {
    await writeClipboardText(JSON.stringify(payload, null, 2));
    racingLineStatus.textContent = `${payload.points instanceof Array
      ? payload.points.length
      : sampledTrackPoints.length} puntos copiados`;
    window.setTimeout(refreshRacingLineStatus, 1800);
  } catch {
    racingLineStatus.textContent = 'No se pudo copiar la trazada';
  }
});

const startLineCanvas = document.createElement('canvas');
startLineCanvas.width = 512;
startLineCanvas.height = 64;
const startLineContext = startLineCanvas.getContext('2d')!;
const startLineColumns = 16;
const startLineRows = 2;
for (let row = 0; row < startLineRows; row += 1) {
  for (let column = 0; column < startLineColumns; column += 1) {
    startLineContext.fillStyle = (row + column) % 2 === 0 ? '#f5f4e9' : '#111416';
    startLineContext.fillRect(
      column * startLineCanvas.width / startLineColumns,
      row * startLineCanvas.height / startLineRows,
      startLineCanvas.width / startLineColumns,
      startLineCanvas.height / startLineRows,
    );
  }
}
const startLineTexture = new THREE.CanvasTexture(startLineCanvas);
startLineTexture.colorSpace = THREE.SRGBColorSpace;
const startFinishPoint = TEST_TRACK_POINTS[0];
const startFinishNextPoint = TEST_TRACK_POINTS[1];
const startFinishYawRadians = Math.atan2(
  startFinishNextPoint.x - startFinishPoint.x,
  startFinishNextPoint.z - startFinishPoint.z,
) - Math.PI;
const startFinishAnchor = new THREE.Group();
startFinishAnchor.name = 'start-finish-anchor';
startFinishAnchor.position.set(
  startFinishPoint.x,
  startFinishPoint.y,
  startFinishPoint.z,
);
startFinishAnchor.rotation.y = startFinishYawRadians;
const startFinishLine = new THREE.Mesh(
  new THREE.PlaneGeometry(TEST_TRACK_WIDTH_M, 1.3),
  new THREE.MeshBasicMaterial({
    map: startLineTexture,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  }),
);
startFinishLine.rotation.x = -Math.PI / 2;
startFinishLine.position.set(0, 0.003, 0);
startFinishAnchor.add(startFinishLine);

const timingGantry = new THREE.Group();
timingGantry.position.set(0, 0, -2.4);
const gantryMetalMaterial = new THREE.MeshStandardMaterial({
  color: 0x172128,
  roughness: 0.4,
  metalness: 0.82,
});
const gantryPanelMaterial = new THREE.MeshStandardMaterial({
  color: 0x081116,
  roughness: 0.5,
  metalness: 0.54,
});
const gantryPostOffsetM = TEST_TRACK_WIDTH_M * 0.5 + 0.85;
for (const x of [-gantryPostOffsetM, gantryPostOffsetM]) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 4.15, 0.34),
    gantryMetalMaterial,
  );
  post.position.set(x, 2.075, 0);
  post.castShadow = true;
  timingGantry.add(post);
}
const gantryCrossbar = new THREE.Mesh(
  new THREE.BoxGeometry(gantryPostOffsetM * 2 + 0.3, 0.3, 0.4),
  gantryMetalMaterial,
);
gantryCrossbar.position.y = 4.05;
gantryCrossbar.castShadow = true;
const timingPanel = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 0.72, 0.24),
  gantryPanelMaterial,
);
timingPanel.position.set(0, 3.82, 0.08);
timingPanel.castShadow = true;
timingGantry.add(gantryCrossbar, timingPanel);
const physicalStartLightMaterials = Array.from({ length: 5 }, () => (
  new THREE.MeshStandardMaterial({
    color: 0x151b1d,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.3,
  })
));
physicalStartLightMaterials.forEach((material, index) => {
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12),
    material,
  );
  lamp.position.set((index - 2) * 0.58, 3.82, 0.23);
  timingGantry.add(lamp);
});
startFinishAnchor.add(timingGantry);
scene.add(startFinishAnchor);
canvas.dataset.lapTimingCheckpointCount = String(lapTimingCheckpoints.length);
canvas.dataset.lapTimingStart = [
  startFinishPoint.x.toFixed(3),
  startFinishPoint.z.toFixed(3),
  startFinishYawRadians.toFixed(4),
].join(',');

const trackSunLight = new THREE.DirectionalLight(0xfff1d8, 2.35);
trackSunLight.position.set(0, 50, 50);
trackSunLight.castShadow = activeRenderProfile.shadows;
trackSunLight.shadow.mapSize.set(
  activeRenderProfile.shadowMapSize,
  activeRenderProfile.shadowMapSize,
);
trackSunLight.shadow.camera.near = 0.5;
trackSunLight.shadow.camera.far = 130;
trackSunLight.shadow.camera.left = -55;
trackSunLight.shadow.camera.right = 55;
trackSunLight.shadow.camera.top = 55;
trackSunLight.shadow.camera.bottom = -55;
trackSunLight.shadow.radius = 3.5;
trackSunLight.shadow.bias = -0.00015;
trackSunLight.shadow.normalBias = 0.025;
scene.add(trackSunLight, trackSunLight.target);
const trackSunOffset = new THREE.Vector3(0, 50, 50);
const renderingPanelRoot = document.querySelector<HTMLDetailsElement>(
  '#rendering-panel',
)!;
renderingPanelRoot.hidden = isAuditRuntime || APEX_DRIVE_PUBLIC_DEMO;
renderingPanelRoot.open = false;
if (!isAuditRuntime) {
  const publicDemoEnvironmentStorageKey = 'apex-demo.environment-profile.v1';
  const isPublicDemoEnvironmentProfile = (
    profileId: string | null,
  ): profileId is string => DEFAULT_ENVIRONMENT_PROFILES.some(
    profile => profile.id === profileId,
  );
  const publicDemoEnvironmentProfile = (() => {
    if (!APEX_DRIVE_PUBLIC_DEMO) return undefined;
    const requested = searchParams.get('environment');
    if (isPublicDemoEnvironmentProfile(requested)) {
      return requested;
    }
    const stored = localStorage.getItem(publicDemoEnvironmentStorageKey);
    if (isPublicDemoEnvironmentProfile(stored)) {
      return stored;
    }
    const alternationStorageKey = 'apex-demo.environment-alternation.v1';
    const previous = localStorage.getItem(alternationStorageKey);
    const next = previous === 'apex-golf-club'
      ? 'apex-hit-the-road'
      : 'apex-golf-club';
    localStorage.setItem(alternationStorageKey, next);
    return next;
  })();
  const applyEnvironmentSettings = (settings: ApexEnvironmentSettings) => {
    renderer.toneMappingExposure = settings.exposure;
    scene.environmentIntensity = settings.hdriIntensity;
    scene.backgroundIntensity = settings.skyIntensity;
    scene.backgroundBlurriness = settings.skyBlur;
    const rotationRadians = THREE.MathUtils.degToRad(settings.rotationDegrees);
    // WebGPU invierte internamente la rotación del fondo, pero no la del PMREM.
    // Usar el signo opuesto mantiene la luz alineada con el sol visible del HDRI.
    scene.environmentRotation.set(0, -rotationRadians, 0);
    scene.backgroundRotation.set(0, rotationRadians, 0);
    trackSunLight.intensity = settings.sunIntensity;
    trackSunLight.color.set(settings.sunColor);
    const altitude = THREE.MathUtils.degToRad(settings.sunAltitudeDegrees);
    const azimuth = THREE.MathUtils.degToRad(settings.sunAzimuthDegrees);
    trackSunOffset.set(
      Math.sin(azimuth) * Math.cos(altitude) * 70,
      Math.sin(altitude) * 70,
      Math.cos(azimuth) * Math.cos(altitude) * 70,
    );
    const shadowsEnabled = (
      settings.softShadows && activeRenderProfile.shadows
    );
    renderer.shadowMap.enabled = shadowsEnabled;
    trackSunLight.castShadow = shadowsEnabled;
    useEnvironmentAsset(settings.environmentId);
    canvas.dataset.environmentProfile = settings.environmentId;
    canvas.dataset.environmentExposure = settings.exposure.toFixed(2);
    canvas.dataset.environmentHdriIntensity = settings.hdriIntensity.toFixed(2);
    canvas.dataset.environmentSkyIntensity = settings.skyIntensity.toFixed(2);
    canvas.dataset.environmentRotationDeg = settings.rotationDegrees.toFixed(0);
    canvas.dataset.environmentSunIntensity = settings.sunIntensity.toFixed(2);
    canvas.dataset.environmentShadows = String(settings.softShadows);
  };
  environmentProfilePanel = new ApexEnvironmentProfilePanel(
    renderingPanelRoot,
    applyEnvironmentSettings,
    publicDemoEnvironmentProfile,
  );
  if (APEX_DRIVE_PUBLIC_DEMO) {
    const activeEnvironmentId = (
      publicDemoEnvironmentProfile ?? DEFAULT_ENVIRONMENT_PROFILES[0].id
    );
    environmentQuickMenu.hidden = false;
    const setActiveEnvironmentButton = (profileId: string) => {
      environmentQuickButtons.forEach(button => {
        const active = button.dataset.environmentProfile === profileId;
        button.setAttribute('aria-pressed', String(active));
      });
    };
    setActiveEnvironmentButton(activeEnvironmentId);
    environmentQuickButtons.forEach(button => {
      button.addEventListener('click', () => {
        const profile = DEFAULT_ENVIRONMENT_PROFILES.find(
          candidate => candidate.id === button.dataset.environmentProfile,
        );
        if (!profile) return;
        applyEnvironmentSettings(profile.settings);
        localStorage.setItem(publicDemoEnvironmentStorageKey, profile.id);
        setActiveEnvironmentButton(profile.id);
        const url = new URL(window.location.href);
        url.searchParams.set('environment', profile.id);
        window.history.replaceState(null, '', url);
      });
    });
  }
}
canvas.dataset.trackRendering = 'catmull-rom-centripetal';
canvas.dataset.trackRenderSamples = String(sampledTrackPoints.length);
canvas.dataset.trackMaxElevationM = TEST_TRACK_MAX_ELEVATION_M.toFixed(3);
canvas.dataset.trackMaxBankDeg = TEST_TRACK_ACTUAL_MAX_BANK_DEGREES.toFixed(3);
canvas.dataset.trackPhysicsProfile = 'elevation-and-bank';
canvas.dataset.trackMinEdgeClearanceM = trackMinEdgeClearanceM.toFixed(3);
canvas.dataset.trackShoulderWidthM = TEST_TRACK_SHOULDER_WIDTH_M.toFixed(3);

const vehicleRoot = new THREE.Group();
scene.add(vehicleRoot);
canvas.dataset.vehicleVisualRig = 'manifest';
const parkingPreviewRoot = new THREE.Group();
scene.add(parkingPreviewRoot);
parkingCarSelector.hidden = true;
parkingNavigationIndicator.hidden = !isParkingSelection;
vehicleRoot.visible = !isParkingSelection;

let parkingSelectionActive = isParkingSelection;
const activeParkingCarIndex = Math.max(
  0,
  parkingCarCatalog.findIndex(definition => definition.id === activeCar.id),
);
let parkingSelectedIndex = (
  APEX_DRIVE_PUBLIC_DEMO
  && activeParkingCarIndex === 0
  && parkingCarCatalog.length > 1
) ? 0 : activeParkingCarIndex;
let parkingSelectedCar = parkingCarCatalog[parkingSelectedIndex];
const parkingPresentationYawRadians = THREE.MathUtils.degToRad(135);
const parkingOrbitKeys = new Set<'KeyA' | 'KeyD'>();
const parkingDistanceKeys = new Set<'KeyW' | 'KeyS'>();
const parkingDefaultOrbitRadians = THREE.MathUtils.degToRad(45);
let parkingOrbitTargetRadians = parkingDefaultOrbitRadians;
let parkingOrbitRadians = parkingDefaultOrbitRadians;
const parkingDefaultDistanceM = 6.25;
const parkingMinimumDistanceM = 3.35;
const parkingMaximumDistanceM = 10;
let parkingDistanceTargetM = parkingDefaultDistanceM;
let parkingDistanceM = parkingDefaultDistanceM;
let parkingGamepadOrbit = 0;
let parkingMousePreviousX: number | undefined;
const parkingDriveTransitionDurationS = 1.55;
let parkingDriveTransitionActive = false;
let parkingDriveTransitionElapsedS = 0;
const parkingDriveTransitionCameraStart = new THREE.Vector3();
const parkingDriveTransitionFocusStart = new THREE.Vector3();
const parkingPreviewLoader = new GLTFLoader();
const parkingPreviewModels = new Map<string, THREE.Group | 'loading'>();
const parkingPreviewErrors = new Set<string>();
const parkingCoverLoader = new ApexParkingCoverLoader();
const parkingCoverModels = new Map<string, THREE.Group | 'loading'>();
const parkingCoverErrors = new Set<string>();
const parkingCoverTasks = new Map<string, Promise<void>>();
let parkingConfirmationPending = false;
let parkingActivationHook = (
  _definition: ApexCarDefinition,
  _presentation: THREE.Group,
): boolean => false;
let synchronizeParkingPhysicsHook = (_index: number): void => {};

const tryActivateParkingSelection = () => {
  if (!parkingConfirmationPending) return;
  const presentation = parkingPreviewModels.get(parkingSelectedCar.id);
  if (!(presentation instanceof THREE.Group)) return;
  if (parkingActivationHook(parkingSelectedCar, presentation)) {
    parkingConfirmationPending = false;
  }
};

const updateParkingCoverStatus = () => {
  canvas.dataset.parkingCoverLoaded = String(
    [...parkingCoverModels.values()].filter(
      cover => cover instanceof THREE.Group,
    ).length,
  );
  canvas.dataset.parkingCoverErrors = String(parkingCoverErrors.size);
};

const removeParkingCover = (carId: string) => {
  const cover = parkingCoverModels.get(carId);
  if (cover instanceof THREE.Group) cover.removeFromParent();
  parkingCoverModels.delete(carId);
  updateParkingCoverStatus();
};

const ensureParkingCover = (
  definition: ApexCarDefinition,
  index: number,
): Promise<void> => {
  const pending = parkingCoverTasks.get(definition.id);
  if (pending) return pending;
  if (
    parkingCoverModels.get(definition.id) instanceof THREE.Group
    || parkingCoverErrors.has(definition.id)
    || parkingPreviewModels.get(definition.id) instanceof THREE.Group
  ) {
    return Promise.resolve();
  }
  parkingCoverModels.set(definition.id, 'loading');
  const bay = resolveApexParkingBayPosition(index);
  const task = parkingCoverLoader.create(
    index,
    definition.id,
    bay.x,
    APEX_PARKING_PREVIEW.groundY,
    bay.z,
  ).then(cover => {
    if (
      parkingPreviewModels.get(definition.id) instanceof THREE.Group
    ) {
      parkingCoverModels.delete(definition.id);
      updateParkingCoverStatus();
      return;
    }
    cover.rotation.y = parkingPresentationYawRadians;
    parkingPreviewRoot.add(cover);
    parkingCoverModels.set(definition.id, cover);
    updateParkingCoverStatus();
  }).catch(error => {
    parkingCoverModels.delete(definition.id);
    parkingCoverErrors.add(definition.id);
    updateParkingCoverStatus();
    console.warn(
      `No se pudo preparar la cubierta de ${definition.name}`,
      error,
    );
  }).finally(() => {
    parkingCoverTasks.delete(definition.id);
  });
  parkingCoverTasks.set(definition.id, task);
  return task;
};

const ensureParkingCovers = (): Promise<void> => (
  Promise.all(
    parkingCarCatalog.map(ensureParkingCover),
  ).then(() => undefined)
);

const matchesMaterialRole = (
  pattern: RegExp,
  materialName: string,
  objectName: string,
): boolean => (
  pattern.test(materialName)
  || pattern.test(objectName)
  || pattern.test(`${materialName} ${objectName}`)
);

const bakedVehicleShadowPattern = /(^|[^a-z])shadow([^a-z]|$)/i;
const vehicleVisualBoundsFor = (root: THREE.Object3D): THREE.Box3 => {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const role = [
      object.name,
      ...materials.map(material => material.name),
    ].join(' ');
    if (bakedVehicleShadowPattern.test(role)) {
      object.visible = false;
      return;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.union(
      object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld),
    );
  });
  return bounds;
};

const applyParkingPreviewColor = (
  definition: ApexCarDefinition,
  color: string,
) => {
  const presentation = parkingPreviewModels.get(definition.id);
  if (!(presentation instanceof THREE.Group)) return;
  const paintPattern = new RegExp(definition.materials.paintPattern, 'i');
  presentation.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach(material => {
      if (
        !(
          material instanceof THREE.MeshStandardMaterial
          || material instanceof THREE.MeshPhysicalMaterial
        )
        || !matchesMaterialRole(paintPattern, material.name, object.name)
      ) return;
      material.color.set(color);
      if (material.userData.apexPaintEmissiveSync === true) {
        material.emissive.set(color);
      }
      material.needsUpdate = true;
    });
  });
};

const loadParkingPreview = (definition: ApexCarDefinition, index: number) => {
  if (
    parkingPreviewModels.has(definition.id)
    || parkingPreviewErrors.has(definition.id)
  ) {
    return;
  }
  parkingPreviewModels.set(definition.id, 'loading');
  if (definition.id === parkingSelectedCar.id) {
    canvas.dataset.parkingLazyState = 'loading';
  }
  parkingPreviewLoader.load(
    definition.assetUri,
    gltf => {
      const previewPhysicsDefinition = carPhysicsDefinitionFor(definition);
      const previewDimensions = previewPhysicsDefinition.dimensions;
      const model = gltf.scene;
      model.rotation.y = THREE.MathUtils.degToRad(definition.visual.yawDegrees);
      model.updateMatrixWorld(true);
      let bounds = vehicleVisualBoundsFor(model);
      let size = bounds.getSize(new THREE.Vector3());
      if (size.x > size.z * 1.1) {
        model.rotation.y += Math.PI * 0.5;
        model.updateMatrixWorld(true);
        bounds = vehicleVisualBoundsFor(model);
        size = bounds.getSize(new THREE.Vector3());
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const bay = resolveApexParkingBayPosition(index);
      const lateralScale = definition.visual.targetWidthM / size.x;
      const verticalScale = definition.visual.targetHeightM / size.y;
      const longitudinalScale = previewDimensions.lengthM / size.z;
      const presentation = new THREE.Group();
      presentation.scale.set(lateralScale, verticalScale, longitudinalScale);
      presentation.rotation.y = parkingPresentationYawRadians;
      const driveLocalPosition = new THREE.Vector3(
        -center.x * lateralScale,
        (
          previewPhysicsDefinition.suspension.wheelMountHeightM
          - previewDimensions.centerOfMassOffsetM
          - previewDimensions.wheelRadiusM
        ) - bounds.min.y * verticalScale + definition.visual.bodyLiftM,
        -center.z * longitudinalScale,
      );
      const parkingPosition = new THREE.Vector3(
        bay.x - center.x * lateralScale,
        APEX_PARKING_PREVIEW.groundY - bounds.min.y * verticalScale,
        bay.z - center.z * longitudinalScale,
      );
      presentation.position.copy(parkingPosition);
      presentation.userData.apexCarId = definition.id;
      presentation.userData.apexDriveLocalPosition = driveLocalPosition.toArray();
      presentation.userData.apexParkingPosition = parkingPosition.toArray();
      const paintPattern = new RegExp(definition.materials.paintPattern, 'i');
      const paintColor = storedCarColor(definition);
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach(material => {
          if (
            (
              material instanceof THREE.MeshStandardMaterial
              || material instanceof THREE.MeshPhysicalMaterial
            )
          ) {
            configureApexCarMaterial(material, definition.id, paintColor);
            if (matchesMaterialRole(
              paintPattern,
              material.name,
              object.name,
            )) {
              material.color.set(paintColor);
            }
          }
        });
      });
      presentation.add(model);
      presentation.updateMatrixWorld(true);
      const parkedBounds = new THREE.Box3().setFromObject(presentation);
      const parkedCenter = parkedBounds.getCenter(new THREE.Vector3());
      presentation.position.x += bay.x - parkedCenter.x;
      presentation.position.y += (
        APEX_PARKING_PREVIEW.groundY - parkedBounds.min.y
      );
      presentation.position.z += bay.z - parkedCenter.z;
      presentation.userData.apexParkingPosition = presentation.position.toArray();
      removeParkingCover(definition.id);
      parkingPreviewRoot.add(presentation);
      parkingPreviewModels.set(definition.id, presentation);
      canvas.dataset.parkingPreviewLoaded = String(
        [...parkingPreviewModels.values()].filter(value => value !== 'loading').length,
      );
      if (definition.id === parkingSelectedCar.id) {
        canvas.dataset.parkingLazyState = 'ready';
        tryActivateParkingSelection();
      }
    },
    undefined,
    error => {
      parkingPreviewModels.delete(definition.id);
      parkingPreviewErrors.add(definition.id);
      if (definition.id === parkingSelectedCar.id) {
        const canonicalIndex = parkingCarCatalog.indexOf(defaultCar);
        if (definition.id !== defaultCar.id && canonicalIndex >= 0) {
          parkingSelectedIndex = canonicalIndex;
          parkingConfirmationPending = false;
          refreshParkingSelection();
          parkingCarName.value = `${defaultCar.name} · respaldo`;
          canvas.dataset.parkingLazyState = 'canonical-fallback';
        } else {
          canvas.dataset.parkingLazyState = 'covered-error';
        }
      }
      console.warn(`No se pudo preparar la vista de ${definition.name}`, error);
    },
  );
};

type ParkingSelectionDirection = 'left' | 'right' | 'up' | 'down';

const parkingVisualOrder = (): readonly number[] => {
  camera.updateMatrixWorld();
  return parkingCarCatalog.map((_definition, index) => {
    const bay = resolveApexParkingBayPosition(index);
    const screen = new THREE.Vector3(
      bay.x,
      0.72,
      bay.z,
    ).project(camera);
    return { index, x: screen.x, y: screen.y };
  }).sort((left, right) => (
    Math.abs(left.x - right.x) > 0.05
      ? left.x - right.x
      : right.y - left.y
  )).map(entry => entry.index);
};

const findParkingSelectionIndex = (
  direction: ParkingSelectionDirection,
): number | undefined => {
  if (parkingCarCatalog.length < 2) return undefined;
  const visualOrder = parkingVisualOrder();
  const currentPosition = visualOrder.indexOf(parkingSelectedIndex);
  if (currentPosition < 0) return visualOrder[0];
  const step = direction === 'left' || direction === 'up' ? -1 : 1;
  return visualOrder[
    (currentPosition + step + visualOrder.length) % visualOrder.length
  ];
};

const updateParkingSelectionAvailability = () => {
  const enabled = parkingCarCatalog.length > 1;
  parkingCarPrevious.disabled = !enabled;
  parkingCarNext.disabled = !enabled;
  parkingCarUp.disabled = !enabled;
  parkingCarDown.disabled = !enabled;
  parkingIndicatorPrevious.disabled = !enabled;
  parkingIndicatorNext.disabled = !enabled;
  canvas.dataset.parkingDirectionalNavigation = 'screen-ordered-circular-list';
};

const refreshParkingSelection = () => {
  parkingSelectedCar = parkingCarCatalog[parkingSelectedIndex];
  parkingLotVisual.setSelectedIndex(parkingSelectedIndex);
  synchronizeParkingPhysicsHook(parkingSelectedIndex);
  parkingCarName.value = parkingSelectedCar.name;
  parkingIndicatorIndex.value = String(parkingSelectedIndex + 1).padStart(2, '0');
  parkingIndicatorTotal.value = String(parkingCarCatalog.length).padStart(2, '0');
  parkingIndicatorName.value = parkingSelectedCar.name;
  vehicleKindSelect.value = `car:${parkingSelectedCar.id}`;
  vehicleColorInput.value = storedCarColor(parkingSelectedCar);
  parkingCarColorInput.value = vehicleColorInput.value;
  applyParkingPreviewColor(parkingSelectedCar, vehicleColorInput.value);
  const selectedPreview = parkingPreviewModels.get(parkingSelectedCar.id);
  if (selectedPreview instanceof THREE.Group) {
    canvas.dataset.parkingLazyState = 'ready';
  } else if (parkingPreviewErrors.has(parkingSelectedCar.id)) {
    canvas.dataset.parkingLazyState = 'covered-error';
  } else {
    canvas.dataset.parkingLazyState = 'covered-loading';
    const selectedCar = parkingSelectedCar;
    const selectedIndex = parkingSelectedIndex;
    void ensureParkingCovers().then(() => {
      loadParkingPreview(selectedCar, selectedIndex);
      parkingCarCatalog.forEach((definition, index) => {
        if (definition.id !== selectedCar.id) {
          loadParkingPreview(definition, index);
        }
      });
    });
  }
  updateParkingSelectionAvailability();
  canvas.dataset.parkingSelectedCar = parkingSelectedCar.id;
  canvas.dataset.parkingSelectedIndex = String(parkingSelectedIndex);
};

const moveParkingSelection = (direction: ParkingSelectionDirection) => {
  if (!parkingSelectionActive) return;
  const nextIndex = findParkingSelectionIndex(direction);
  if (nextIndex === undefined || nextIndex === parkingSelectedIndex) return;
  parkingConfirmationPending = false;
  parkingSelectedIndex = nextIndex;
  refreshParkingSelection();
};

const confirmParkingSelection = () => {
  if (!parkingSelectionActive) return;
  void engineSynth?.start();
  parkingConfirmationPending = true;
  parkingCarName.value = `${parkingSelectedCar.name} · preparando`;
  tryActivateParkingSelection();
};

parkingCarPrevious.addEventListener('click', () => moveParkingSelection('left'));
parkingCarNext.addEventListener('click', () => moveParkingSelection('right'));
parkingCarUp.addEventListener('click', () => moveParkingSelection('up'));
parkingCarDown.addEventListener('click', () => moveParkingSelection('down'));
parkingCarConfirm.addEventListener('click', confirmParkingSelection);
parkingIndicatorPrevious.addEventListener(
  'click',
  () => moveParkingSelection('left'),
);
parkingIndicatorNext.addEventListener(
  'click',
  () => moveParkingSelection('right'),
);
parkingIndicatorConfirm.addEventListener('click', confirmParkingSelection);
parkingCarColorInput.addEventListener('input', () => {
  const color = parkingCarColorInput.value;
  vehicleColorInput.value = color;
  localStorage.setItem(carColorStorageKey(parkingSelectedCar), color);
  applyParkingPreviewColor(parkingSelectedCar, color);
  canvas.dataset.vehiclePaintColor = color;
});
if (parkingSelectionActive) refreshParkingSelection();
selectCarInParkingHook = carId => {
  const nextIndex = parkingCarCatalog.findIndex(
    definition => definition.id === carId,
  );
  if (nextIndex < 0) return false;

  const activePresentation = vehicleRoot.children.find(
    child => child.userData.apexDriveCarPresentation === true,
  );
  const parkingPosition = activePresentation?.userData.apexParkingPosition;
  if (
    activePresentation instanceof THREE.Group
    && Array.isArray(parkingPosition)
    && parkingPosition.length === 3
    && parkingPosition.every(Number.isFinite)
  ) {
    vehicleRoot.remove(activePresentation);
    setPrototypeWheelPresentation(activePresentation, false);
    activePresentation.position.fromArray(parkingPosition);
    activePresentation.rotation.y = parkingPresentationYawRadians;
    activePresentation.userData.apexDriveCarPresentation = false;
    parkingPreviewRoot.add(activePresentation);
  }

  parkingConfirmationPending = false;
  parkingDriveTransitionActive = false;
  parkingSelectedIndex = nextIndex;
  parkingSelectionActive = true;
  parkingPreviewRoot.visible = true;
  vehicleRoot.visible = false;
  parkingCarSelector.hidden = true;
  parkingNavigationIndicator.hidden = false;
  visualControlsRoot.hidden = true;
  sportHudContainer.hidden = true;
  lapTimerRoot.hidden = true;
  telemetryContainer.hidden = true;
  if (importedTrackCollisionOnly) {
    const forest = scene.getObjectByName('apex-dirt-road-through-forest');
    const collisionDebug = scene.getObjectByName(
      'track-collision-debug-visual',
    );
    if (forest) forest.visible = false;
    if (collisionDebug) collisionDebug.visible = false;
    canvas.dataset.challhuacoParkingSelection = 'isolated-then-spawn-on-track';
    canvas.dataset.trackCollisionDebug = 'hidden-during-parking-selection';
  }
  canvas.dataset.experienceMode = 'parking-selection';
  refreshParkingSelection();
  return true;
};
if (pendingParkingCarId !== null) {
  const pendingCarId = pendingParkingCarId;
  pendingParkingCarId = null;
  selectCarInParkingHook(pendingCarId);
}

const MAX_TIRE_MARK_SEGMENTS = 4096;
const tireMarkGeometry = new THREE.PlaneGeometry(1, 1);
tireMarkGeometry.rotateX(-Math.PI / 2);
const tireMarkMaterial = new THREE.MeshStandardMaterial({
  color: 0x101113,
  roughness: 0.98,
  metalness: 0,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const tireMarks = new THREE.InstancedMesh(
  tireMarkGeometry,
  tireMarkMaterial,
  MAX_TIRE_MARK_SEGMENTS,
);
tireMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
tireMarks.frustumCulled = false;
tireMarks.renderOrder = 2;
const hiddenTireMarkMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
for (let index = 0; index < MAX_TIRE_MARK_SEGMENTS; index += 1) {
  tireMarks.setMatrixAt(index, hiddenTireMarkMatrix);
}
tireMarks.instanceMatrix.needsUpdate = true;
scene.add(tireMarks);

let tireMarkCursor = 0;
const previousTireMarkContacts = Array.from(
  { length: 4 },
  () => new THREE.Vector3(),
);
const tireMarkActive = [false, false, false, false];
const tireMarkDelta = new THREE.Vector3();
const tireMarkDirection = new THREE.Vector3();
const tireMarkLateral = new THREE.Vector3();
const tireMarkCenter = new THREE.Vector3();
const tireMarkScale = new THREE.Vector3();
const tireMarkQuaternion = new THREE.Quaternion();
const tireMarkBasis = new THREE.Matrix4();
const tireMarkMatrix = new THREE.Matrix4();
const updateTireMarks = (pose: VehiclePose) => {
  for (let index = 0; index < pose.wheelGrounded.length; index += 1) {
    const surface = pose.wheelSurfaces[index];
    const asphalt = surface === 'asphalt'
      || surface === 'asphalt-low-grip'
      || surface === 'asphalt-high-grip'
      || surface === 'wet-asphalt';
    const lateralSlip = Math.abs(pose.wheelLateralSlipRadians[index]);
    const longitudinalSlip = Math.abs(pose.wheelLongitudinalSlips[index]);
    const skidding = pose.wheelGrounded[index]
      && asphalt
      && pose.speedKmh > 10
      && (
        lateralSlip > THREE.MathUtils.degToRad(7.5)
        || longitudinalSlip > 0.16
      );
    const contact = pose.wheelContactPositions[index];

    if (!skidding || !Number.isFinite(contact.x)) {
      tireMarkActive[index] = false;
      continue;
    }
    if (!tireMarkActive[index]) {
      previousTireMarkContacts[index].copy(contact);
      tireMarkActive[index] = true;
      continue;
    }

    const normal = pose.wheelContactNormals[index];
    tireMarkDelta.subVectors(contact, previousTireMarkContacts[index]);
    tireMarkDirection.copy(tireMarkDelta)
      .addScaledVector(normal, -tireMarkDelta.dot(normal));
    const segmentLength = tireMarkDirection.length();
    if (segmentLength < 0.08) continue;
    if (segmentLength > 1.6) {
      previousTireMarkContacts[index].copy(contact);
      continue;
    }

    tireMarkDirection.multiplyScalar(1 / segmentLength);
    tireMarkLateral.crossVectors(normal, tireMarkDirection).normalize();
    tireMarkCenter.addVectors(previousTireMarkContacts[index], contact)
      .multiplyScalar(0.5)
      .addScaledVector(normal, 0.012);
    tireMarkBasis.makeBasis(tireMarkLateral, normal, tireMarkDirection);
    tireMarkQuaternion.setFromRotationMatrix(tireMarkBasis);
    const slipIntensity = THREE.MathUtils.clamp(
      Math.max(
        lateralSlip / THREE.MathUtils.degToRad(18),
        longitudinalSlip / 0.45,
      ),
      0,
      1,
    );
    tireMarkScale.set(
      THREE.MathUtils.lerp(0.13, 0.18, slipIntensity),
      1,
      segmentLength + 0.035,
    );
    tireMarkMatrix.compose(
      tireMarkCenter,
      tireMarkQuaternion,
      tireMarkScale,
    );
    tireMarks.setMatrixAt(tireMarkCursor, tireMarkMatrix);
    tireMarkCursor = (tireMarkCursor + 1) % MAX_TIRE_MARK_SEGMENTS;
    tireMarks.instanceMatrix.needsUpdate = true;
    previousTireMarkContacts[index].copy(contact);
  }
};
canvas.dataset.tireMarks = 'jolt-contact-instanced';

let vehicleColorStorageKey = carColorStorageKey(activeCar);
const savedVehicleColor = storedCarColor(activeCar);
vehicleColorInput.value = savedVehicleColor;
const vehiclePaintMaterials = new Set<
  THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
>();
const brakeLightMaterials = new Set<
  THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
>();
const brakePointLights = new Set<THREE.PointLight>();
let brakeLightLevel = 0;
const BRAKE_EMISSIVE_IDLE = 0.18;
const BRAKE_EMISSIVE_GAIN = 0.82;
const BRAKE_PROJECTION_BASE = 0.75;
const BRAKE_PROJECTION_GAIN = 5.25;
canvas.dataset.brakeLightProjection = 'original-mesh-plus-invisible-point-lights';
canvas.dataset.brakeInputSource = 'driver-brake-trigger';
const chassisMaterial = new THREE.LineBasicMaterial({
  color: activeVehicleKind === 'motorcycle' ? 0x4de7ff : savedVehicleColor,
});
const applyVehicleColor = (color: string, persist = false) => {
  chassisMaterial.color.set(color);
  vehiclePaintMaterials.forEach(material => {
    material.color.set(color);
    if (material.userData.apexPaintEmissiveSync === true) {
      material.emissive.set(color);
    }
    material.needsUpdate = true;
  });
  if (persist) localStorage.setItem(vehicleColorStorageKey, color);
  canvas.dataset.vehiclePaintColor = color;
};
vehicleColorInput.addEventListener('input', () => {
  if (parkingSelectionActive) {
    const color = vehicleColorInput.value;
    parkingCarColorInput.value = color;
    localStorage.setItem(carColorStorageKey(parkingSelectedCar), color);
    applyParkingPreviewColor(parkingSelectedCar, color);
    canvas.dataset.vehiclePaintColor = color;
    return;
  }
  applyVehicleColor(vehicleColorInput.value, true);
});

const createChassisDebugGeometry = (definition: {
  readonly widthM: number;
  readonly frontWidthM?: number;
  readonly rearWidthM?: number;
  readonly heightM: number;
  readonly lengthM: number;
}): THREE.BufferGeometry => {
  const frontHalfWidth = (definition.frontWidthM ?? definition.widthM) / 2;
  const rearHalfWidth = (definition.rearWidthM ?? definition.widthM) / 2;
  const halfHeight = definition.heightM / 2;
  const halfLength = definition.lengthM / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -frontHalfWidth, -halfHeight, halfLength,
    frontHalfWidth, -halfHeight, halfLength,
    -frontHalfWidth, halfHeight, halfLength,
    frontHalfWidth, halfHeight, halfLength,
    -rearHalfWidth, -halfHeight, -halfLength,
    rearHalfWidth, -halfHeight, -halfLength,
    -rearHalfWidth, halfHeight, -halfLength,
    rearHalfWidth, halfHeight, -halfLength,
  ], 3));
  geometry.setIndex([
    0, 1, 3, 0, 3, 2,
    4, 6, 7, 4, 7, 5,
    4, 5, 1, 4, 1, 0,
    2, 3, 7, 2, 7, 6,
    4, 0, 2, 4, 2, 6,
    1, 5, 7, 1, 7, 3,
  ]);
  geometry.computeVertexNormals();
  return geometry;
};
const chassisEdgesGeometry = new THREE.EdgesGeometry(
  createChassisDebugGeometry(activeVehiclePhysicsDefinition.chassisBox),
);
const chassis = new THREE.LineSegments(
  chassisEdgesGeometry,
  chassisMaterial,
);
chassis.position.y = activeVehicleKind === 'motorcycle'
  ? activeMotorcyclePhysicsDefinition.chassisBox.centerOffsetYM
  : activeCarPhysicsDefinition.chassisBox.centerOffsetYM;
vehicleRoot.add(chassis);

const vehiclePhysicsDebugRoot = new THREE.Group();
vehiclePhysicsDebugRoot.name = 'vehicle-physics-debug';
vehiclePhysicsDebugRoot.visible = false;
vehicleRoot.add(vehiclePhysicsDebugRoot);
const vehiclePhysicsDebugMaterial = new THREE.LineBasicMaterial({
  color: 0xffd33d,
  depthTest: false,
  transparent: true,
  opacity: 0.95,
});
const vehiclePhysicsDebugChassis = new THREE.LineSegments(
  chassisEdgesGeometry,
  vehiclePhysicsDebugMaterial,
);
vehiclePhysicsDebugChassis.position.copy(chassis.position);
vehiclePhysicsDebugChassis.renderOrder = 1000;
vehiclePhysicsDebugRoot.add(vehiclePhysicsDebugChassis);
const vehicleCenterOfMassMarker = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.09),
  new THREE.MeshBasicMaterial({
    color: 0xff3d65,
    depthTest: false,
    wireframe: true,
  }),
);
vehicleCenterOfMassMarker.name = 'vehicle-center-of-mass';
vehicleCenterOfMassMarker.renderOrder = 1001;
vehiclePhysicsDebugRoot.add(vehicleCenterOfMassMarker);
canvas.dataset.vehicleCenterOfMassVisual = 'physics-debug-marker';

const activeWheelDimensions = activeVehicleKind === 'motorcycle'
  ? activeMotorcyclePhysicsDefinition.dimensions
  : activeCarDimensions;
// La cubierta procedural ya no es un objeto sobredimensionado de inspección:
// copia el radio y ancho del perfil físico activo. Su Group continúa siguiendo
// la pose individual que Jolt entrega para cada rueda, por lo que tamaño,
// trocha, batalla, suspensión y dirección permanecen en el mismo sistema.
const tireInspectionRadiusScale = 1;
const tireInspectionWidthScale = 1;
const tireVisualOuterRadiusM = activeWheelDimensions.wheelRadiusM;
const tireVisualWidthM = activeWheelDimensions.wheelWidthM;
const tireVisualProfileDeformationScale = (
  activeVehicleKind === 'car'
    ? activeCar.visual.tireDeformationScale
    : 1
);
const tireVisualGlobalDeformationScale = 0.5;
const tireVisualDeformationScale = (
  tireVisualProfileDeformationScale * tireVisualGlobalDeformationScale
);
const tireInnerRadiusM = tireVisualOuterRadiusM * 0.55;
const tireTubeRadiusM = (
  tireVisualOuterRadiusM - tireInnerRadiusM
) * 0.5;
const tireMajorRadiusM = tireInnerRadiusM + tireTubeRadiusM;
const wheelGeometry: THREE.BufferGeometry = activeVehicleKind === 'motorcycle'
  ? new THREE.CylinderGeometry(
    tireVisualOuterRadiusM,
    tireVisualOuterRadiusM,
    tireVisualWidthM,
    36,
    2,
  )
  : new THREE.TorusGeometry(
    tireMajorRadiusM,
    tireTubeRadiusM,
    18,
    64,
  );
if (activeVehicleKind === 'car') {
  // TorusGeometry nace con eje Z. Jolt entrega esta rueda con eje Y local,
  // radial X/Z: el mismo frame que usaba el cilindro de diagnóstico anterior.
  wheelGeometry.rotateX(Math.PI * 0.5);
  wheelGeometry.scale(
    1,
    tireVisualWidthM / (tireTubeRadiusM * 2),
    1,
  );
  // Convierte la sección circular de "donut" en una superelipse suave:
  // banda más plana, flancos con volumen y hombros redondeados. Conservamos
  // la topología del toro para que el deformador pueda mover sus vértices.
  const tirePositions = wheelGeometry.getAttribute('position');
  const halfTireWidthM = tireVisualWidthM * 0.5;
  const roundedSectionExponent = 2 / 2.8;
  if (tirePositions instanceof THREE.BufferAttribute) {
    for (let vertex = 0; vertex < tirePositions.count; vertex += 1) {
      const x = tirePositions.getX(vertex);
      const y = tirePositions.getY(vertex);
      const z = tirePositions.getZ(vertex);
      const radialM = Math.hypot(x, z);
      if (radialM < 1e-6) continue;
      const radialOffsetNormalized = THREE.MathUtils.clamp(
        (radialM - tireMajorRadiusM) / tireTubeRadiusM,
        -1,
        1,
      );
      const axialNormalized = THREE.MathUtils.clamp(
        y / halfTireWidthM,
        -1,
        1,
      );
      const shapedRadialOffsetM = (
        Math.sign(radialOffsetNormalized)
        * Math.pow(
          Math.abs(radialOffsetNormalized),
          roundedSectionExponent,
        )
        * tireTubeRadiusM
      );
      const shapedAxialM = (
        Math.sign(axialNormalized)
        * Math.pow(Math.abs(axialNormalized), roundedSectionExponent)
        * halfTireWidthM
      );
      const shapedRadialM = tireMajorRadiusM + shapedRadialOffsetM;
      tirePositions.setXYZ(
        vertex,
        x / radialM * shapedRadialM,
        shapedAxialM,
        z / radialM * shapedRadialM,
      );
    }
    tirePositions.needsUpdate = true;
    wheelGeometry.computeVertexNormals();
  }
}
const createTireTreadCanvas = () => {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 256;
  const context = textureCanvas.getContext('2d');
  if (!context) return textureCanvas;

  context.fillStyle = '#171a1d';
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.fillStyle = '#252a2e';
  for (let x = -56; x < textureCanvas.width + 56; x += 48) {
    const offset = (Math.floor((x + 56) / 48) % 2) * 9;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 26, 0);
    context.lineTo(x + 40, 54 + offset);
    context.lineTo(x + 14, 54 + offset);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(x + 14, 202 - offset);
    context.lineTo(x + 40, 202 - offset);
    context.lineTo(x + 26, 256);
    context.lineTo(x, 256);
    context.closePath();
    context.fill();
  }
  context.fillStyle = '#202529';
  for (let x = -32; x < textureCanvas.width + 32; x += 38) {
    context.save();
    context.translate(x, 128);
    context.rotate((x / 38) % 2 === 0 ? 0.42 : -0.42);
    context.fillRect(-11, -43, 22, 86);
    context.restore();
  }
  context.fillStyle = '#080a0b';
  [58, 112, 144, 198].forEach(y => {
    context.fillRect(0, y, textureCanvas.width, 5);
  });
  context.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let x = 4; x < textureCanvas.width; x += 17) {
    const y = (x * 37) % textureCanvas.height;
    context.fillRect(x, y, 2, 2);
  }
  return textureCanvas;
};
const tireTreadTexture = new THREE.CanvasTexture(createTireTreadCanvas());
tireTreadTexture.name = 'apex-procedural-monster-tire-tread';
tireTreadTexture.colorSpace = THREE.SRGBColorSpace;
tireTreadTexture.wrapS = THREE.RepeatWrapping;
tireTreadTexture.wrapT = THREE.RepeatWrapping;
const tireTreadBumpTexture = tireTreadTexture.clone();
tireTreadBumpTexture.name = 'apex-procedural-monster-tire-bump';
tireTreadBumpTexture.colorSpace = THREE.NoColorSpace;
const wheelMaterial = activeVehicleKind === 'motorcycle'
  ? new THREE.MeshBasicMaterial({ color: 0x4de7ff, wireframe: true })
  : new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tireTreadTexture,
    bumpMap: tireTreadBumpTexture,
    bumpScale: 0.024,
    roughness: 0.84,
    metalness: 0,
  });
const simpleTireMeshes: THREE.Mesh<THREE.BufferGeometry>[] = [];
const wheels = Array.from({ length: activeVehicleKind === 'motorcycle' ? 2 : 4 }, () => {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeometry.clone(), wheelMaterial);
  simpleTireMeshes.push(tire);
  tire.name = 'apex-hollow-deformable-tire';
  tire.frustumCulled = false;
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);
  vehicleRoot.add(wheel);
  return wheel;
});
const vehiclePhysicsDebugWheelMaterial = new THREE.MeshBasicMaterial({
  color: 0x35efff,
  depthTest: false,
  transparent: true,
  opacity: 0.82,
  wireframe: true,
});
const vehiclePhysicsDebugWheelGeometry = new THREE.CylinderGeometry(
  activeWheelDimensions.wheelRadiusM,
  activeWheelDimensions.wheelRadiusM,
  activeWheelDimensions.wheelWidthM,
  32,
  1,
  true,
);
const vehiclePhysicsDebugWheels = Array.from(
  { length: activeVehicleKind === 'motorcycle' ? 2 : 4 },
  (_, index) => {
    const wheel = new THREE.Mesh(
      vehiclePhysicsDebugWheelGeometry.clone(),
      vehiclePhysicsDebugWheelMaterial,
    );
    wheel.name = `vehicle-physics-wheel-${index}`;
    wheel.frustumCulled = false;
    wheel.renderOrder = 1000;
    vehiclePhysicsDebugRoot.add(wheel);
    return wheel;
  },
);
const setVehiclePhysicsDebugVisible = (visible: boolean) => {
  vehiclePhysicsDebugRoot.visible = visible;
  vehiclePhysicsDebugInfo.hidden = !visible;
  vehiclePhysicsDebugInput.checked = visible;
  canvas.dataset.vehiclePhysicsDebug = visible ? 'visible' : 'hidden';
};
vehiclePhysicsDebugInput.addEventListener('change', () => {
  setVehiclePhysicsDebugVisible(vehiclePhysicsDebugInput.checked);
});
setVehiclePhysicsDebugVisible(false);
chassisBoxCenterYInput.addEventListener('input', () => {
  const previewCenterYM = Number(chassisBoxCenterYInput.value);
  if (!Number.isFinite(previewCenterYM)) return;
  chassisBoxCenterYOutput.value = `${previewCenterYM.toFixed(2)} m`;
  chassis.position.y = previewCenterYM;
  vehiclePhysicsDebugChassis.position.y = previewCenterYM;
  vehiclePhysicsDebugInput.checked = true;
  setVehiclePhysicsDebugVisible(true);
  chassisBoxCenterYInfo.textContent = (
    `Vista previa ${previewCenterYM.toFixed(2)} m · aplicar para reiniciar física`
  );
  canvas.dataset.chassisBoxCenterYPreviewM = previewCenterYM.toFixed(3);
});
chassisBoxCenterYApply.addEventListener('click', () => {
  if (chassisBoxCenterYApply.disabled) return;
  const requestedCenterYM = Number(chassisBoxCenterYInput.value);
  if (!Number.isFinite(requestedCenterYM)) return;
  const nextCenterYM = Math.min(
    maximumChassisBoxCenterYM,
    Math.max(minimumChassisBoxCenterYM, requestedCenterYM),
  );
  localStorage.setItem(chassisBoxCenterYStorageKey, String(nextCenterYM));
  chassisBoxCenterYInfo.textContent = (
    `Aplicando ${nextCenterYM.toFixed(2)} m…`
  );
  window.location.reload();
});
const tireDeformationVisual = new ApexTireDeformationVisual(
  simpleTireMeshes,
  activeWheelDimensions.wheelRadiusM,
  tireVisualOuterRadiusM,
  tireVisualWidthM,
  activeVehicleKind === 'car'
    ? activeCarPhysicsDefinition.massKg * 9.80665 / 4
    : 3_900,
  tireVisualProfileDeformationScale,
  tireVisualGlobalDeformationScale,
  activeTireDeformationMode === 'gpu' ? 'gpu' : 'cpu',
);
const tireContactWorldQuaternion = new THREE.Quaternion();
const tireContactInverseQuaternion = new THREE.Quaternion();
const tireContactNormalsLocal = simpleTireMeshes.map(
  () => new THREE.Vector3(1, 0, 0),
);
const tireLongitudinalForcesLocal = simpleTireMeshes.map(
  () => new THREE.Vector3(),
);
const tireLateralForcesLocal = simpleTireMeshes.map(
  () => new THREE.Vector3(),
);
const tireLocalUp = new THREE.Vector3(0, 1, 0);
function setPrototypeWheelPresentation(
  presentation: THREE.Object3D,
  prototypeActive: boolean,
  bodyOpacity = 1,
  detectEmbeddedWheelGeometry = false,
) {
  const clampedBodyOpacity = THREE.MathUtils.clamp(bodyOpacity, 0, 1);
  const previousInspectionState = presentation.userData
    .apexPrototypeInspectionState as {
      readonly active: boolean;
      readonly bodyOpacity: number;
      readonly detectEmbeddedWheelGeometry: boolean;
    } | undefined;
  if (
    previousInspectionState?.active === prototypeActive
    && (
      !prototypeActive
      || (
        previousInspectionState.bodyOpacity === clampedBodyOpacity
        && previousInspectionState.detectEmbeddedWheelGeometry
          === detectEmbeddedWheelGeometry
      )
    )
  ) return;
  presentation.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const previousVisibility = object.userData
      .apexPrototypePreviousVisibility;
    if (
      !prototypeActive
      && typeof previousVisibility === 'boolean'
    ) {
      object.visible = previousVisibility;
      delete object.userData.apexPrototypePreviousVisibility;
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const materialNames = materials.map(material => material.name).join(' ');
    const namedWheelMesh = /(?:wheel|tire|tyre|rim|pneu)/i.test(
      `${object.name} ${materialNames}`,
    );
    let embeddedWheelMesh = false;
    if (prototypeActive && detectEmbeddedWheelGeometry) {
      object.geometry.computeBoundingBox();
      const geometryBounds = object.geometry.boundingBox;
      if (geometryBounds) {
        const geometrySize = geometryBounds.getSize(new THREE.Vector3());
        const radialSize = Math.max(geometrySize.x, geometrySize.z);
        embeddedWheelMesh = (
          radialSize >= 0.6
          && radialSize <= 1.15
          && Math.abs(geometrySize.x - geometrySize.z) <= radialSize * 0.16
          && geometrySize.y <= 0.48
        );
      }
    }
    const wheelMesh = namedWheelMesh || embeddedWheelMesh;
    if (wheelMesh) {
      if (prototypeActive) {
        if (typeof previousVisibility !== 'boolean') {
          object.userData.apexPrototypePreviousVisibility = object.visible;
        }
        object.visible = false;
      }
      return;
    }
    materials.forEach(material => {
      const previous = material.userData.apexTireInspectionMaterial as {
        readonly transparent: boolean;
        readonly opacity: number;
        readonly depthWrite: boolean;
        readonly depthTest: boolean;
      } | undefined;
      if (!prototypeActive && previous) {
        material.transparent = previous.transparent;
        material.opacity = previous.opacity;
        material.depthWrite = previous.depthWrite;
        material.depthTest = previous.depthTest;
        delete material.userData.apexTireInspectionMaterial;
      }
      material.needsUpdate = true;
    });
  });
  presentation.userData.apexPrototypeInspectionState = {
    active: prototypeActive,
    bodyOpacity: clampedBodyOpacity,
    detectEmbeddedWheelGeometry,
  };
}
canvas.dataset.tireVisualModel = activeVehicleKind === 'car'
  ? `rounded-superellipse-tread-contact-patch-v4-${activeTireDeformationMode}`
  : 'rigid-motorcycle-wheel';
canvas.dataset.tireVisualSurface = activeVehicleKind === 'car'
  ? 'procedural-rubber-tread-color-bump'
  : 'wireframe';
canvas.dataset.tireVisualAnchor = 'jolt-wheel-local-transform-per-active-profile';
canvas.dataset.tireVisualOuterRadiusM = (
  tireVisualOuterRadiusM.toFixed(3)
);
canvas.dataset.tireVisualInnerRadiusM = tireInnerRadiusM.toFixed(3);
canvas.dataset.tireVisualWidthM = tireVisualWidthM.toFixed(3);
canvas.dataset.tirePhysicalRadiusM = (
  activeWheelDimensions.wheelRadiusM.toFixed(3)
);
canvas.dataset.tirePhysicalWidthM = (
  activeWheelDimensions.wheelWidthM.toFixed(3)
);
canvas.dataset.tirePhysicalWireframe = 'removed';
canvas.dataset.tirePhysicalVisualMatch = String(
  Math.abs(activeWheelDimensions.wheelRadiusM - tireVisualOuterRadiusM) < 1e-6
  && Math.abs(activeWheelDimensions.wheelWidthM - tireVisualWidthM) < 1e-6
);
canvas.dataset.tireWheelInertiaKgM2 = activeVehicleKind === 'car'
  ? activeCarPhysicsDefinition.wheels.inertiaKgM2.toFixed(2)
  : 'jolt-default';
canvas.dataset.tireVisualDeformationScale = (
  tireVisualDeformationScale.toFixed(2)
);
canvas.dataset.tireVisualDeformationBaseScale = (
  tireVisualProfileDeformationScale.toFixed(2)
);
canvas.dataset.tireVisualDeformationGlobalScale = (
  tireVisualGlobalDeformationScale.toFixed(2)
);
canvas.dataset.tireVisualShearScale = (
  tireVisualProfileDeformationScale
  * tireVisualProfileDeformationScale
  * tireVisualGlobalDeformationScale
).toFixed(3);
canvas.dataset.tireInspectionRadiusScale = tireInspectionRadiusScale.toFixed(2);
canvas.dataset.tireInspectionWidthScale = tireInspectionWidthScale.toFixed(2);
canvas.dataset.tireInspectionBodyOpacity = activeVehicleKind === 'car'
  ? activeCar.visual.inspectionBodyOpacity.toFixed(2)
  : '1';
canvas.dataset.vehicleBodyLiftM = activeVehicleKind === 'car'
  ? activeCar.visual.bodyLiftM.toFixed(2)
  : '0.00';

// El asset agrupa el interior en mallas grandes y no expone un nodo de
// volante animable. Se añade un volante visual en el puesto real del conductor
// (lado +X mirando hacia +Z) para que la vista interior y el giro coincidan.
const steeringWheelMaterial = new THREE.MeshStandardMaterial({
  color: 0x151617,
  roughness: 0.46,
  metalness: 0.22,
});
const steeringWheelMount = new THREE.Group();
steeringWheelMount.position.set(
  0.36,
  0.12 + (activeVehicleKind === 'car' ? activeCar.visual.bodyLiftM : 0),
  0.57,
);
steeringWheelMount.rotation.x = -0.18;
const steeringWheelSpin = new THREE.Group();
const steeringWheelRim = new THREE.Mesh(
  new THREE.TorusGeometry(0.17, 0.018, 10, 32),
  steeringWheelMaterial,
);
steeringWheelSpin.add(steeringWheelRim);
for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.14, 0.014),
    steeringWheelMaterial,
  );
  spoke.position.y = 0.07;
  spoke.rotation.z = angle;
  steeringWheelSpin.add(spoke);
}
const steeringWheelHub = new THREE.Mesh(
  new THREE.CylinderGeometry(0.048, 0.048, 0.026, 20),
  steeringWheelMaterial,
);
steeringWheelHub.rotation.x = Math.PI / 2;
steeringWheelSpin.add(steeringWheelHub);
steeringWheelMount.add(steeringWheelSpin);
vehicleRoot.add(steeringWheelMount);
steeringWheelMount.visible = activeVehicleKind === 'car';

canvas.dataset.vehicleModel = activeVehicleKind === 'car'
  ? 'loading'
  : 'jolt-motorcycle-wireframe';
canvas.dataset.vehiclePhysicsProfile = activeVehicleKind === 'car'
  ? activeCarPhysicsDefinition.id
  : 'jolt-motorcycle';
const mountActiveVehicleModel = (
  gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>,
  visualDefinition: ApexCarDefinition,
  canonicalFallback: boolean,
): void => {
    const currentPresentation = vehicleRoot.children.find(
      child => child.userData.apexDriveCarPresentation === true,
    );
    if (currentPresentation) {
      if (
        canonicalFallback
        || currentPresentation.userData.apexDriveVisualFallback !== true
      ) {
        return;
      }
      currentPresentation.removeFromParent();
      vehiclePaintMaterials.clear();
      brakeLightMaterials.clear();
      brakePointLights.forEach(light => light.removeFromParent());
      brakePointLights.clear();
    }
    const presentationPhysicsDefinition = carPhysicsDefinitionFor(
      visualDefinition,
    );
    const presentationDimensions = presentationPhysicsDefinition.dimensions;
    const model = gltf.scene;
    const paintPattern = new RegExp(
      visualDefinition.materials.paintPattern,
      'i',
    );
    const brakeLightPattern = new RegExp(
      visualDefinition.materials.brakeLightPattern,
      'i',
    );
    const hiddenWheelPattern = visualDefinition.materials.hiddenWheelPattern
      ? new RegExp(visualDefinition.materials.hiddenWheelPattern, 'i')
      : undefined;
    const brakeLightAnchors: Array<{
      parent: THREE.Object3D;
      position: THREE.Vector3;
    }> = [];
    let pbrMaterialCount = 0;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      let containsBrakeMesh = false;
      for (const material of materials) {
        if (
          material instanceof THREE.MeshStandardMaterial
          || material instanceof THREE.MeshPhysicalMaterial
        ) {
          pbrMaterialCount += 1;
          configureApexCarMaterial(
            material,
            visualDefinition.id,
            vehicleColorInput.value,
          );
          const materialRole = `${material.name} ${object.name}`;
          if (matchesMaterialRole(
            paintPattern,
            material.name,
            object.name,
          )) {
            vehiclePaintMaterials.add(material);
          }
          if (brakeLightPattern.test(materialRole)) {
            material.color.set(0x050000);
            material.emissive.set(0x610000);
            material.emissiveMap = null;
            material.emissiveIntensity = BRAKE_EMISSIVE_IDLE;
            material.toneMapped = true;
            material.needsUpdate = true;
            brakeLightMaterials.add(material);
            containsBrakeMesh = true;
          }
        }
      }
      if (containsBrakeMesh) {
        const positions = object.geometry.getAttribute('position');
        const bounds = new THREE.Box3().setFromBufferAttribute(positions);
        const size = bounds.getSize(new THREE.Vector3());
        if (size.x > 1) {
          const splitX = (bounds.min.x + bounds.max.x) * 0.5;
          const left = new THREE.Box3();
          const right = new THREE.Box3();
          const point = new THREE.Vector3();
          for (let index = 0; index < positions.count; index += 1) {
            point.fromBufferAttribute(positions, index);
            (point.x < splitX ? left : right).expandByPoint(point);
          }
          for (const cluster of [left, right]) {
            if (!cluster.isEmpty()) {
              brakeLightAnchors.push({
                parent: object,
                position: cluster.getCenter(new THREE.Vector3()),
              });
            }
          }
        } else if (!bounds.isEmpty()) {
          brakeLightAnchors.push({
            parent: object,
            position: bounds.getCenter(new THREE.Vector3()),
          });
        }
      }
    });
    brakeLightAnchors.forEach(anchor => {
      const light = new THREE.PointLight(0xff1708, 0, 4.2, 2);
      light.position.copy(anchor.position);
      light.castShadow = false;
      anchor.parent.add(light);
      brakePointLights.add(light);
    });
    applyVehicleColor(vehicleColorInput.value);
    canvas.dataset.vehiclePaintMaterialCount = String(vehiclePaintMaterials.size);
    canvas.dataset.brakeLightMaterialCount = String(brakeLightMaterials.size);
    canvas.dataset.brakeLightAnchorCount = String(brakePointLights.size);
    model.rotation.y = THREE.MathUtils.degToRad(
      visualDefinition.visual.yawDegrees,
    );
    model.updateMatrixWorld(true);
    let bounds = vehicleVisualBoundsFor(model);
    let size = bounds.getSize(new THREE.Vector3());
    if (size.x > size.z * 1.1) {
      model.rotation.y += Math.PI * 0.5;
      model.updateMatrixWorld(true);
      bounds = vehicleVisualBoundsFor(model);
      size = bounds.getSize(new THREE.Vector3());
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const lateralScale = visualDefinition.visual.targetWidthM / size.x;
    const verticalScale = visualDefinition.visual.targetHeightM / size.y;
    const longitudinalScale = presentationDimensions.lengthM / size.z;
    const sourceCenterScaled = new THREE.Vector3(
      center.x * lateralScale,
      center.y * verticalScale,
      center.z * longitudinalScale,
    );
    const nominalWheelBottomY = (
      presentationPhysicsDefinition.suspension.wheelMountHeightM
    )
      - presentationDimensions.centerOfMassOffsetM
      - presentationDimensions.wheelRadiusM;
    const modelPresentation = new THREE.Group();
    modelPresentation.userData.apexDriveCarPresentation = true;
    modelPresentation.userData.apexDriveVisualFallback = canonicalFallback;
    modelPresentation.userData.apexCarId = visualDefinition.id;
    modelPresentation.scale.set(lateralScale, verticalScale, longitudinalScale);
    modelPresentation.position.set(
      -sourceCenterScaled.x,
      nominalWheelBottomY
        - bounds.min.y * verticalScale
        + visualDefinition.visual.bodyLiftM,
      -sourceCenterScaled.z,
    );
    modelPresentation.add(model);
    setPrototypeWheelPresentation(
      modelPresentation,
      true,
      visualDefinition.visual.inspectionBodyOpacity,
      visualDefinition.visual.detectEmbeddedWheelGeometry,
    );
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const wheelRole = [
        object.name,
        ...materials.map(material => material.name),
      ].join(' ');
      if (hiddenWheelPattern?.test(wheelRole)) {
        object.visible = false;
      }
    });
    vehicleRoot.add(modelPresentation);
    lapGhost.setVehicleVisual(modelPresentation);
    chassis.visible = false;
    wheels.forEach(wheel => {
      wheel.visible = true;
    });
    canvas.dataset.vehicleModel = canonicalFallback
      ? `${visualDefinition.id}-canonical-fallback`
      : `${visualDefinition.id}-ready`;
    canvas.dataset.vehicleModelName = visualDefinition.name;
    canvas.dataset.vehicleVisualSource = canonicalFallback
      ? 'canonical-fallback'
      : 'requested';
    canvas.dataset.vehiclePbrMaterialCount = String(pbrMaterialCount);
    canvas.dataset.vehicleEnvironmentLighting = pbrMaterialCount > 0
      ? 'scene-environment-pmrem'
      : 'unsupported-materials';
    canvas.dataset.vehicleModelSize = [
      size.x * lateralScale,
      size.y * verticalScale,
      size.z * longitudinalScale,
    ].map(value => value.toFixed(3)).join(',');
};

if (activeVehicleKind === 'car' && !isParkingSelection) {
  const activeVehicleLoader = new GLTFLoader();
  const loadRequestedVehicle = () => {
    activeVehicleLoader.load(
      activeCar.assetUri,
      gltf => mountActiveVehicleModel(gltf, activeCar, false),
      undefined,
      error => {
        console.warn(`No se pudo cargar ${activeCar.name}`, error);
        const hasCanonicalFallback = vehicleRoot.children.some(
          child => child.userData.apexDriveVisualFallback === true,
        );
        canvas.dataset.vehicleModel = hasCanonicalFallback
          ? `${canonicalFallbackCar.id}-canonical-fallback`
          : 'wireframe-fallback';
      },
    );
  };
  if (activeCar.id === canonicalFallbackCar.id) {
    loadRequestedVehicle();
  } else {
    activeVehicleLoader.load(
      canonicalFallbackCar.assetUri,
      gltf => {
        mountActiveVehicleModel(gltf, canonicalFallbackCar, true);
        loadRequestedVehicle();
      },
      undefined,
      error => {
        console.warn(`No se pudo cargar el auto canónico`, error);
        loadRequestedVehicle();
      },
    );
  }
}

const input: {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
} = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
};
const neutralDriverInput: DriverInput = Object.freeze({
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
});
const explorationKeys = new Set<string>();
const explorationControlCodes = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);
const isEditableKeyboardTarget = (target: EventTarget | null): boolean => (
  target instanceof HTMLInputElement
  || target instanceof HTMLSelectElement
  || target instanceof HTMLTextAreaElement
);

type DigitalDriverInputKey = 'forward' | 'backward' | 'left' | 'right' | 'handbrake';
const keyMap: Record<string, DigitalDriverInputKey> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'handbrake',
};
const digitalDriverInputKeys: readonly DigitalDriverInputKey[] = [
  'forward',
  'backward',
  'left',
  'right',
  'handbrake',
];

window.addEventListener('keydown', event => {
  if (!parkingSelectionActive || isEditableKeyboardTarget(event.target)) return;
  if (
    event.code === 'ArrowLeft'
    || event.code === 'ArrowRight'
    || event.code === 'ArrowUp'
    || event.code === 'ArrowDown'
    || event.code === 'KeyA'
    || event.code === 'KeyD'
    || event.code === 'KeyW'
    || event.code === 'KeyS'
    || event.code === 'Enter'
    || event.code === 'Space'
  ) {
    event.preventDefault();
  }
  if (event.code === 'KeyA' || event.code === 'KeyD') {
    parkingOrbitKeys.add(event.code);
    return;
  }
  if (event.code === 'KeyW' || event.code === 'KeyS') {
    parkingDistanceKeys.add(event.code);
    return;
  }
  if (event.repeat) return;
  if (event.code === 'ArrowLeft') {
    moveParkingSelection('left');
  } else if (event.code === 'ArrowRight') {
    moveParkingSelection('right');
  } else if (event.code === 'ArrowUp') {
    moveParkingSelection('up');
  } else if (event.code === 'ArrowDown') {
    moveParkingSelection('down');
  } else if (event.code === 'Enter' || event.code === 'Space') {
    confirmParkingSelection();
  }
});
window.addEventListener('keyup', event => {
  if (event.code === 'KeyA' || event.code === 'KeyD') {
    parkingOrbitKeys.delete(event.code);
  }
  if (event.code === 'KeyW' || event.code === 'KeyS') {
    parkingDistanceKeys.delete(event.code);
  }
});

for (const eventName of ['keydown', 'keyup'] as const) {
  window.addEventListener(eventName, event => {
    if (isEditableKeyboardTarget(event.target)) return;
    if (parkingSelectionActive) {
      if (eventName === 'keyup') explorationKeys.delete(event.code);
      return;
    }
    const action = keyMap[event.code];
    if (isExplorationCameraMode() && explorationControlCodes.has(event.code)) {
      event.preventDefault();
      if (eventName === 'keydown') explorationKeys.add(event.code);
      else explorationKeys.delete(event.code);
    } else if (eventName === 'keyup') {
      explorationKeys.delete(event.code);
    }
    if (!action) return;
    event.preventDefault();
    input[action] = isExplorationCameraMode() ? false : eventName === 'keydown';
  });
}
window.addEventListener('keydown', event => {
  if (isEditableKeyboardTarget(event.target)) return;
  if (event.code === 'KeyI' && !event.repeat && !parkingSelectionActive) {
    event.preventDefault();
    setAutonomousDriveEnabled(!autonomousDriveEnabled);
    return;
  }
  if (event.code !== 'KeyC' || event.repeat) return;
  event.preventDefault();
  cycleCameraMode();
});
cameraModeSelect.addEventListener('change', () => {
  const mode = cameraModeSelect.value as CameraMode;
  if (cameraModes.includes(mode)) setCameraMode(mode);
});
cameraModeChangeHook = () => {
  digitalDriverInputKeys.forEach(key => {
    input[key] = false;
  });
  explorationKeys.clear();
};
canvas.addEventListener('click', () => {
  if (
    parkingSelectionActive
    || !isExplorationCameraMode()
    || document.pointerLockElement === canvas
  ) return;
  void canvas.requestPointerLock();
});
canvas.addEventListener('pointermove', event => {
  if (!parkingSelectionActive) {
    parkingMousePreviousX = undefined;
    return;
  }
  if (parkingMousePreviousX !== undefined) {
    parkingOrbitTargetRadians -= (event.clientX - parkingMousePreviousX) * 0.008;
  }
  parkingMousePreviousX = event.clientX;
});
canvas.addEventListener('pointerleave', () => {
  parkingMousePreviousX = undefined;
});
document.addEventListener('mousemove', event => {
  if (
    document.pointerLockElement !== canvas
    || !isExplorationCameraMode()
  ) {
    return;
  }
  const mouseSensitivity = 0.0022;
  explorationYawRadians -= event.movementX * mouseSensitivity;
  explorationPitchRadians = THREE.MathUtils.clamp(
    explorationPitchRadians - event.movementY * mouseSensitivity,
    -Math.PI * 0.495,
    Math.PI * 0.495,
  );
});
window.addEventListener('blur', () => {
  digitalDriverInputKeys.forEach(key => {
    input[key] = false;
  });
  parkingOrbitKeys.clear();
  parkingDistanceKeys.clear();
  explorationKeys.clear();
});

let previousGamepadCameraButton = false;
let previousParkingGamepadDirection: ParkingSelectionDirection | undefined;
let previousParkingGamepadConfirm = false;
let reportedControllerId = '';
let driverBrakeDemand = 0;
const readRuntimeDriverInput = (): DriverInput => {
  const gamepad = Array.from(navigator.getGamepads()).find(
    (candidate): candidate is Gamepad => candidate !== null && candidate.connected,
  );
  if (!gamepad) {
    previousGamepadCameraButton = false;
    previousParkingGamepadDirection = undefined;
    previousParkingGamepadConfirm = false;
    parkingGamepadOrbit = 0;
    driverBrakeDemand = isExplorationCameraMode() ? 0 : input.backward ? 1 : 0;
    if (reportedControllerId !== 'none') {
      controllerStatus.textContent = 'Joystick · no conectado';
      reportedControllerId = 'none';
    }
    return (
      parkingSelectionActive
      || parkingDriveTransitionActive
      || isExplorationCameraMode()
    )
      ? neutralDriverInput
      : input;
  }
  if (reportedControllerId !== gamepad.id) {
    controllerStatus.textContent = `Joystick · ${gamepad.id}`;
    reportedControllerId = gamepad.id;
  }
  if (parkingSelectionActive) {
    const horizontalAxis = gamepad.axes[0] ?? 0;
    const verticalAxis = gamepad.axes[1] ?? 0;
    const direction: ParkingSelectionDirection | undefined = (
      gamepad.buttons[12]?.pressed
    ) ? 'up' : (
      gamepad.buttons[13]?.pressed
    ) ? 'down' : (
      gamepad.buttons[14]?.pressed
    ) ? 'left' : (
      gamepad.buttons[15]?.pressed
    ) ? 'right' : (
      Math.abs(horizontalAxis) >= Math.abs(verticalAxis)
      && horizontalAxis < -0.55
    ) ? 'left' : (
      Math.abs(horizontalAxis) >= Math.abs(verticalAxis)
      && horizontalAxis > 0.55
    ) ? 'right' : (
      verticalAxis < -0.55
    ) ? 'up' : (
      verticalAxis > 0.55
    ) ? 'down' : undefined;
    if (direction && direction !== previousParkingGamepadDirection) {
      moveParkingSelection(direction);
    }
    previousParkingGamepadDirection = direction;
    const orbitAxis = gamepad.axes[2] ?? 0;
    parkingGamepadOrbit = Math.abs(orbitAxis) > 0.12 ? orbitAxis : 0;
    const confirm = Boolean(gamepad.buttons[0]?.pressed);
    if (confirm && !previousParkingGamepadConfirm) confirmParkingSelection();
    previousParkingGamepadConfirm = confirm;
    driverBrakeDemand = 0;
    return neutralDriverInput;
  }
  if (parkingDriveTransitionActive) {
    previousGamepadCameraButton = false;
    driverBrakeDemand = 0;
    return neutralDriverInput;
  }
  const cameraButton = Boolean(gamepad.buttons[3]?.pressed);
  if (cameraButton && !previousGamepadCameraButton) cycleCameraMode();
  previousGamepadCameraButton = cameraButton;
  if (isExplorationCameraMode()) {
    driverBrakeDemand = 0;
    return neutralDriverInput;
  }
  const analogButton = (index: number) => {
    const value = gamepad.buttons[index]?.value ?? 0;
    return value <= 0.05 ? 0 : THREE.MathUtils.clamp((value - 0.05) / 0.95, 0, 1);
  };
  const accelerator = analogButton(7);
  const brakeOrReverse = analogButton(6);
  driverBrakeDemand = brakeOrReverse;
  const hasDigitalDirection = input.forward || input.backward;
  const gamepadDirection = accelerator > brakeOrReverse + 0.02
    ? 1
    : brakeOrReverse > accelerator + 0.02 ? -1 : 0;
  const rawSteering = gamepad.axes[0] ?? 0;
  const steering = Math.abs(rawSteering) <= 0.08
    ? 0
    : Math.sign(rawSteering) * (
      (Math.abs(rawSteering) - 0.08) / 0.92
    );
  const hasKeyboardSteering = input.left || input.right;
  return {
    ...input,
    forward: input.forward || (!hasDigitalDirection && gamepadDirection > 0),
    backward: input.backward || (!hasDigitalDirection && gamepadDirection < 0),
    throttle: hasDigitalDirection || gamepadDirection === 0
      ? undefined
      : Math.max(accelerator, brakeOrReverse),
    steering: hasKeyboardSteering ? undefined : steering,
    handbrake: input.handbrake || Boolean(gamepad.buttons[4]?.pressed),
  };
};
window.addEventListener('gamepadconnected', event => {
  engineSynth?.start();
  controllerStatus.textContent = `Joystick · ${event.gamepad.id}`;
  reportedControllerId = event.gamepad.id;
});
window.addEventListener('gamepaddisconnected', () => {
  controllerStatus.textContent = 'Joystick · no conectado';
  reportedControllerId = 'none';
});

const reportStatus = (message: string) => {
  runtimeStatus = message;
  canvas.dataset.runtimeStatus = message;
  uiRuntime?.setStatus(message);
};
reportStatus(runtimeStatus);

try {
  let autonomousGridSpawn = createApexRaceGrid([
    {
      id: 'player',
      carId: runtimeCar.id,
      player: true,
    },
  ], () => 0)[0].spawn;
  const J = await loadApexPhysicsBrowserRuntime(reportStatus);
  const physicsWorld = ApexPhysicsWorld.create(J);
  const physics = physicsWorld.addVehicle(
    activeVehiclePhysicsDefinition,
    isParkingDrive || isParkingSelection
      ? createApexParkingSpawn(parkingSelectedIndex)
      : importedTrackCollisionOnly ? autonomousGridSpawn : undefined,
  );
  const physicsSurfaces = new SurfaceRegistry();
  const grassSurface = physicsSurfaces.get('grass');
  const asphaltSurface = physicsSurfaces.get('asphalt');
  const asphaltFriction = (
    asphaltSurface.longitudinalMu + asphaltSurface.lateralMu
  ) * 0.5;
  createApexWorldStaticCollisionGroups({
    floorSizeM: FLOOR_SIZE_M,
    grassFriction: grassSurface.lateralMu,
  }).forEach(group => physicsWorld.replaceStaticColliderGroup(group));
  const trackCollisionRegistry = new ApexTrackSegmentCollisionRegistry({
    staticWorld: physicsWorld,
    roadThicknessM: TEST_TRACK_THICKNESS_M,
    materials: {
      wallFriction: asphaltFriction * 0.045,
      roadsideFriction: (
        grassSurface.longitudinalMu + grassSurface.lateralMu
      ) * 0.5,
      guardrailFriction: asphaltFriction * 0.045,
    },
  });
  synchronizeParkingPhysicsHook = index => {
    physics.placeAtSpawn(createApexParkingSpawn(index));
  };
  if (parkingSelectionActive) {
    synchronizeParkingPhysicsHook(parkingSelectedIndex);
  }
  if (activeVehicleKind === 'car') {
    physics.configureDynamicsProfile(activeCar.dynamics);
  }
  physics.setTireExecutionPreference(tireExecutionPreference);
  physics.configureTireContactEvaluation(runtimeContactCount, runtimePhysicsHz);
  canvas.dataset.tireExecutionPreference = tireExecutionPreference;
  canvas.dataset.tireExecutionBackend = physics.getState().tireExecutionBackend;
  let trackEditorRevision = 0;
  const trackDraftIdentity = Object.freeze({
    trackId: ACTIVE_TRACK.track.id,
    trackVersion: ACTIVE_TRACK.track.version,
    defaultBoundaryMode: ACTIVE_TRACK.configuration.geometry.boundaryMode,
    defaultRoadsideMode: ACTIVE_TRACK.configuration.geometry.roadsideMode,
    defaultRoadWidthM: ACTIVE_TRACK.configuration.geometry.roadWidthM,
    defaultLaneCount: TEST_TRACK_LANE_COUNT,
    defaultSurface: ACTIVE_TRACK.configuration.surfaces.road,
    defaultVisualMode: (
      ACTIVE_TRACK_PRIMARY_SEGMENT?.geometry.visualMode
      ?? (ACTIVE_TRACK.assets.visual.format === 'glb'
        ? 'collision-only' as const
        : 'inherit' as const)
    ),
  });
  // El draft también es una fuente de presentación fuera del editor: de otro
  // modo los tramos nuevos desaparecen al cerrar el modo de edición.
  const loadedTrackDraft = loadApexTrackDraft(trackDraftIdentity);
  const availableTrackSegments = (
    loadedTrackDraft?.segments
    ?? ACTIVE_TRACK_SOURCE?.segments
    ?? Object.freeze([])
  );
  let workingTrackSegments = [...availableTrackSegments];
  const preferredTrackSegmentId = (
    requestedTrackEditorSegmentId
    ?? loadedTrackDraft?.activeSegmentId
    ?? ACTIVE_TRACK_PRIMARY_SEGMENT?.id
    ?? 'main'
  );
  const draftEditableTrackSegment = loadedTrackDraft?.segments.find(
    segment => segment.id === preferredTrackSegmentId,
  );
  const sourceEditableTrackSegment = ACTIVE_TRACK_SOURCE?.segments.find(
    segment => segment.id === preferredTrackSegmentId,
  );
  let editableTrackSegment = (
    draftEditableTrackSegment
    ?? sourceEditableTrackSegment
    ?? availableTrackSegments.find(segment => segment.id === preferredTrackSegmentId)
    ?? availableTrackSegments.find(segment => (
      segment.id === (ACTIVE_TRACK_PRIMARY_SEGMENT?.id ?? 'main')
    ))
  );
  let editableTrackSegmentId = editableTrackSegment?.id ?? 'main';
  let activeDraftTrackSegment = loadedTrackDraft?.segments.find(
    segment => segment.id === editableTrackSegmentId,
  );
  let baseEditorTrackSegment = (
    ACTIVE_TRACK_SOURCE?.segments.find(
      segment => segment.id === editableTrackSegmentId,
    )
    ?? editableTrackSegment
  );
  let activeEditorClosed = (
    editableTrackSegment?.editor.closed ?? TEST_TRACK_IS_CLOSED
  );
  let activeEditorControlSpacingM = (
    editableTrackSegment?.editor.controlSpacingM
    ?? trackEditorControlSpacingM
  );
  let activeEditorCollisionSpacingM = (
    editableTrackSegment?.editor.collisionSpacingM
    ?? trackEditorCollisionSpacingM
  );
  let activeEditorLaneCount = (
    editableTrackSegment?.geometry.laneCount ?? TEST_TRACK_LANE_COUNT
  );
  const primaryTrackSegmentId = ACTIVE_TRACK_PRIMARY_SEGMENT?.id ?? 'main';
  const networkVisualExcludedSegmentIds = new Set<string>();
  if (!trackEditorMode || importedTrackCollisionOnly) {
    // Fuera del editor lo presenta el runtime legado. En una pista importada,
    // el asset también permanece como autoridad visual durante la edición.
    networkVisualExcludedSegmentIds.add(primaryTrackSegmentId);
  }
  if (trackEditorMode) {
    // El editor existente mantiene ownership visual del tramo activo.
    networkVisualExcludedSegmentIds.add(editableTrackSegmentId);
  }
  if (availableTrackSegments.length === 0) {
    const fallbackPoints = TEST_TRACK_IS_CLOSED
      ? TEST_TRACK_POINTS.slice(0, -1)
      : TEST_TRACK_POINTS;
    trackCollisionRegistry.replaceTrackSegmentCollision(
      primaryTrackSegmentId,
      fallbackPoints,
      TEST_TRACK_WIDTH_M,
      ACTIVE_TRACK.configuration.geometry.boundaryMode,
      TEST_TRACK_SAFETY,
      ACTIVE_TRACK.configuration.geometry.roadsideMode,
      TEST_TRACK_IS_CLOSED,
      TEST_TRACK_SHOULDER_WIDTH_M,
      TEST_TRACK_GROUND_HEIGHT_M,
    );
  }
  const trackRuntimeCoordinator = createApexTrackRuntimeCoordinator({
    segments: availableTrackSegments,
    visualExcludedSegmentIds: networkVisualExcludedSegmentIds,
    groundHeightM: TEST_TRACK_GROUND_HEIGHT_M,
    shoulderWidthM: TEST_TRACK_SHOULDER_WIDTH_M,
    timing: {
      startRadiusM: trackTiming.startRadiusM,
      checkpointRadiusM: trackTiming.checkpointRadiusM,
      checkpointSpacingM: (
        trackTiming.checkpointIntervalPoints
        * activeEditorCollisionSpacingM
      ),
      ignoredTailDistanceM: (
        trackTiming.ignoredTailPoints
        * activeEditorCollisionSpacingM
      ),
    },
    roadMaterial,
    roadsideMaterial: grassMaterial,
    collisionRegistry: trackCollisionRegistry,
  });
  trackRuntimeCoordinator.group.visible = !isParkingSelection;
  scene.add(trackRuntimeCoordinator.group);
  canvas.dataset.trackNetworkVisualSegments = String(
    trackRuntimeCoordinator.segmentCount,
  );
  canvas.dataset.trackNetworkCollisionSegments = String(
    trackRuntimeCoordinator.collisionSegmentCount,
  );
  canvas.dataset.trackNetworkVisualAuthority =
    'full-derived-per-segment';
  canvas.dataset.trackNetworkCollisionAuthority =
    'independent-collider-per-segment';
  const updateTrackCollisionMetrics = () => {
    const summary = trackCollisionRegistry.getSummary();
    canvas.dataset.trackCollisionOwnerSegments = String(summary.segmentCount);
    canvas.dataset.trackCollisionSurfaceColliders = String(
      summary.surfaceColliderCount,
    );
    canvas.dataset.trackCollisionRoadsideColliders = String(
      summary.roadsideColliderCount,
    );
    canvas.dataset.trackCollisionGuardrailColliders = String(
      summary.guardrailColliderCount,
    );
    canvas.dataset.trackCollisionTotalColliders = String(
      summary.totalColliderCount,
    );
    canvas.dataset.trackCollisionBoxColliders = String(
      summary.boxColliderCount,
    );
    canvas.dataset.trackCollisionConvexHullColliders = String(
      summary.convexHullColliderCount,
    );
    canvas.dataset.trackCollisionTriangleMeshColliders = String(
      summary.triangleMeshColliderCount,
    );
    canvas.dataset.trackCollisionInputVertices = String(
      summary.collisionInputVertexCount,
    );
    canvas.dataset.trackCollisionTriangleMeshTriangles = String(
      Math.round(summary.triangleMeshTriangleCount),
    );
  };
  updateTrackCollisionMetrics();
  const asEditorTrackPoints = (
    points: readonly {
      readonly x: number;
      readonly y: number;
      readonly z: number;
      readonly bankRadians: number;
      readonly surface?: string;
    }[],
  ): readonly TrackPoint[] => Object.freeze(points.map(point => Object.freeze({
    x: point.x,
    y: point.y,
    z: point.z,
    bankRadians: point.bankRadians,
    surface: point.surface as TrackPoint['surface'],
  })));
  const activeEditorEvaluatedPoints = editableTrackSegment
    ? asEditorTrackPoints(editableTrackSegment.evaluatedPoints)
    : editableTrackPoints;
  const compatibleTrackDraft = (
    loadedTrackDraft
    && editableTrackSegment
    && loadedTrackDraft.segments.some(segment => (
      segment.id === editableTrackSegmentId
    ))
  ) ? loadedTrackDraft : undefined;
  const createPersistedTrackSegment = (
    controlPoints: readonly TrackPoint[],
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: typeof ACTIVE_TRACK.configuration.geometry.boundaryMode,
    roadsideMode: typeof ACTIVE_TRACK.configuration.geometry.roadsideMode,
    simplificationToleranceM: number,
  ) => Object.freeze({
    id: editableTrackSegmentId,
    name: editableTrackSegment?.name ?? 'Trazado principal',
    kind: editableTrackSegment?.kind ?? 'road' as const,
    enabled: editableTrackSegment?.enabled !== false,
    editor: Object.freeze({
      closed: activeEditorClosed,
      controlSpacingM: activeEditorControlSpacingM,
      collisionSpacingM: activeEditorCollisionSpacingM,
      simplificationToleranceM,
    }),
    geometry: Object.freeze({
      roadWidthM,
      laneCount: (
        editableTrackSegment?.geometry.laneCount
        ?? activeEditorLaneCount
      ),
      surface: (
        editableTrackSegment?.geometry.surface
        ?? evaluatedPoints[0]?.surface
        ?? ACTIVE_TRACK.configuration.surfaces.road
      ),
      boundaryMode,
      roadsideMode,
      visualMode: (
        editableTrackSegment?.geometry.visualMode
        ?? (ACTIVE_TRACK.assets.visual.format === 'glb'
          ? 'collision-only' as const
          : 'inherit' as const)
      ),
    }),
    controlPoints,
    evaluatedPoints,
  });
  const replacePersistedTrackSegment = (
    segment: ReturnType<typeof createPersistedTrackSegment>,
  ) => {
    const replaced = workingTrackSegments.map(existing => (
      existing.id === segment.id ? segment : existing
    ));
    const nextSegments = Object.freeze(
      replaced.some(existing => existing.id === segment.id)
        ? replaced
        : [...replaced, segment],
    );
    workingTrackSegments = [...nextSegments];
    return nextSegments;
  };
  const persistedPrimaryRouteId = (
    loadedTrackDraft?.primaryRouteId
    ?? ACTIVE_TRACK_SOURCE?.primaryRouteId
    ?? 'main-route'
  );
  const persistedRoutes = (
    loadedTrackDraft?.routes
    ?? ACTIVE_TRACK_SOURCE?.routes
    ?? Object.freeze([
      Object.freeze({
        id: persistedPrimaryRouteId,
        name: 'Recorrido principal',
        closed: TEST_TRACK_IS_CLOSED,
        segments: Object.freeze([
          Object.freeze({
            segmentId: editableTrackSegmentId,
            direction: 'forward' as const,
          }),
        ]),
      }),
    ])
  );
  const persistedJunctions = (
    loadedTrackDraft?.junctions
    ?? ACTIVE_TRACK_SOURCE?.junctions
    ?? Object.freeze([])
  );
  const saveActiveTrackDraft = (
    controlPoints: readonly TrackPoint[],
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: typeof ACTIVE_TRACK.configuration.geometry.boundaryMode,
    roadsideMode: typeof ACTIVE_TRACK.configuration.geometry.roadsideMode,
    simplificationToleranceM: number,
  ): boolean => {
    const savedAtIso = new Date().toISOString();
    const persistedSegment = createPersistedTrackSegment(
      controlPoints,
      evaluatedPoints,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
    );
    const saved = saveApexTrackDraft(Object.freeze({
      format: APEX_TRACK_DRAFT_FORMAT,
      formatVersion: APEX_TRACK_DRAFT_FORMAT_VERSION,
      trackId: trackDraftIdentity.trackId,
      trackVersion: trackDraftIdentity.trackVersion,
      savedAtIso,
      activeSegmentId: editableTrackSegmentId,
      primaryRouteId: persistedPrimaryRouteId,
      segments: replacePersistedTrackSegment(persistedSegment),
      junctions: persistedJunctions,
      routes: persistedRoutes,
      closed: activeEditorClosed,
      controlSpacingM: activeEditorControlSpacingM,
      collisionSpacingM: activeEditorCollisionSpacingM,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      simplificationToleranceM,
      controlPoints,
      evaluatedPoints,
    }));
    canvas.dataset.trackEditorDraft = saved ? 'saved' : 'save-error';
    canvas.dataset.trackEditorDraftSavedAt = saved ? savedAtIso : 'none';
    return saved;
  };
  const applyEditedTrackDerivedRuntime = (
    evaluatedPoints: readonly TrackPoint[],
    roadWidthM: number,
    boundaryMode: typeof ACTIVE_TRACK.configuration.geometry.boundaryMode,
    roadsideMode: typeof ACTIVE_TRACK.configuration.geometry.roadsideMode,
  ): void => {
    editedTrackDerivedState = createEditedTrackDerivedState(
      evaluatedPoints,
      roadWidthM,
      boundaryMode,
      roadsideMode,
      activeEditorClosed,
      activeEditorLaneCount,
      activeEditorCollisionSpacingM,
    );
    trackEditDerivedVisual?.update(editedTrackDerivedState);
    trackCollisionDebugVisual?.update(
      evaluatedPoints,
      roadWidthM,
      boundaryMode,
      editedTrackDerivedState.safety,
      activeEditorClosed,
    );
    trackRuntimeCoordinator.replaceSegmentDerivedState(
      editableTrackSegmentId,
      editedTrackDerivedState,
    );
    lapTimer.configureTrack(
      editedTrackDerivedState.startGate,
      editedTrackDerivedState.checkpoints,
      trackTiming.sectorCount,
      editedTrackDerivedState.closed,
      editedTrackDerivedState.finishGate,
    );
    autonomousGridSpawn = editedTrackDerivedState.spawn;
    autonomousDriver.configureTrack(
      editedTrackDerivedState.centerLine,
      roadWidthM,
    );
    activeRacingLinePoints = (
      editedTrackDerivedState.racingPlan?.points
      ?? editedTrackDerivedState.centerLine
    );
    autonomousDriver.setLine(activeRacingLinePoints);
    autonomousDriver.configureMemory(autonomousMemoryStorageKey(runtimeCar));

    if (editedTrackDerivedState.racingPlan) {
      scene.remove(trackGuidanceChevrons.group);
      trackGuidanceChevrons.dispose();
      trackGuidanceChevrons = createGuidanceChevrons(
        editedTrackDerivedState.racingPlan,
      );
      trackGuidanceChevrons.group.visible = !trackEditorMode;
      scene.add(trackGuidanceChevrons.group);
    }
    canvas.dataset.trackLengthM = editedTrackDerivedState.lengthM.toFixed(1);
    canvas.dataset.trackBoundaryMode = boundaryMode;
    canvas.dataset.trackRoadsideMode = roadsideMode;
    canvas.dataset.trackDerivedGuardrailSections = String(
      editedTrackDerivedState.safety.sections.length,
    );
    canvas.dataset.trackDerivedGuardrailSegments = String(
      editedTrackDerivedState.safety.segments.length,
    );
    canvas.dataset.trackDerivedCheckpointCount = String(
      editedTrackDerivedState.checkpoints.length,
    );
    canvas.dataset.trackDerivedRacingPlanPoints = String(
      editedTrackDerivedState.racingPlan?.points.length ?? 0,
    );
    canvas.dataset.trackDerivedRegeneration = (
      'surface,roadside,boundary,safety,guidance,spawn,timing,autonomous'
    );
  };
  const trackEditor = trackEditorMode && !isAuditRuntime
    ? createApexTrackEditor({
      scene,
      camera,
      domElement: canvas,
      points: activeEditorEvaluatedPoints,
      closed: activeEditorClosed,
      controlSpacingM: activeEditorControlSpacingM,
      collisionSpacingM: activeEditorCollisionSpacingM,
      roadWidthM: (
        baseEditorTrackSegment?.geometry.roadWidthM ?? TEST_TRACK_WIDTH_M
      ),
      boundaryMode: (
        baseEditorTrackSegment?.geometry.boundaryMode
        ?? ACTIVE_TRACK.configuration.geometry.boundaryMode
      ),
      roadsideMode: (
        baseEditorTrackSegment?.geometry.roadsideMode
        ?? ACTIVE_TRACK.configuration.geometry.roadsideMode
      ),
      initialRoadWidthM: editableTrackSegment?.geometry.roadWidthM,
      initialBoundaryMode: editableTrackSegment?.geometry.boundaryMode,
      initialRoadsideMode: editableTrackSegment?.geometry.roadsideMode,
      initialSimplificationToleranceM: (
        editableTrackSegment?.editor.simplificationToleranceM
      ),
      baseControlPoints: baseEditorTrackSegment
        ? asEditorTrackPoints(baseEditorTrackSegment.controlPoints)
        : authoredTrackControlPoints,
      initialControlPoints: activeDraftTrackSegment
        ? asEditorTrackPoints(activeDraftTrackSegment.controlPoints)
        : undefined,
      initialEvaluatedPoints: activeDraftTrackSegment
        ? asEditorTrackPoints(activeDraftTrackSegment.evaluatedPoints)
        : undefined,
      initialCameraState: (
        trackEditorVehicleEntryCamera ?? restoredTrackEditorView?.camera
      ),
      onCameraStateChange: cameraState => {
        try {
          window.localStorage.setItem(
            trackEditorCameraStorageKey,
            JSON.stringify({
              format: 'apex-track-editor-camera@1',
              cameraMode,
              camera: cameraState,
            }),
          );
          canvas.dataset.trackEditorCameraPersistence = 'saved';
        } catch {
          canvas.dataset.trackEditorCameraPersistence = 'save-error';
        }
      },
      snapToRoad: trackEditorSnapToRoad,
      onCommit: (
        evaluatedPoints,
        controlPoints,
        roadWidthM,
        boundaryMode,
        roadsideMode,
        simplificationToleranceM,
      ) => {
        applyEditedTrackDerivedRuntime(
          evaluatedPoints,
          roadWidthM,
          boundaryMode,
          roadsideMode,
        );
        trackEditorRevision += 1;
        canvas.dataset.trackEditorRevision = String(trackEditorRevision);
        canvas.dataset.trackEditorEvaluation = 'committed-on-release';
        canvas.dataset.trackEditorEvaluatedPointCount = String(
          evaluatedPoints.length,
        );
        canvas.dataset.trackEditorNodeCount = String(controlPoints.length);
        canvas.dataset.trackEditorRoadWidthM = roadWidthM.toFixed(2);
        canvas.dataset.trackEditorBoundaryMode = boundaryMode;
        canvas.dataset.trackEditorRoadsideMode = roadsideMode;
        canvas.dataset.trackEditorSimplificationToleranceM = (
          simplificationToleranceM.toFixed(3)
        );
      },
      onDraftSave: (
        controlPoints,
        evaluatedPoints,
        roadWidthM,
        boundaryMode,
        roadsideMode,
        simplificationToleranceM,
      ) => (
        saveActiveTrackDraft(
          controlPoints,
          evaluatedPoints,
          roadWidthM,
          boundaryMode,
          roadsideMode,
          simplificationToleranceM,
        )
      ),
      onSaveFile: async (
        controlPoints,
        evaluatedPoints,
        roadWidthM,
        boundaryMode,
        roadsideMode,
        simplificationToleranceM,
      ) => {
        const persistedSegment = createPersistedTrackSegment(
          controlPoints,
          evaluatedPoints,
          roadWidthM,
          boundaryMode,
          roadsideMode,
          simplificationToleranceM,
        );
        const persistedSegments = replacePersistedTrackSegment(
          persistedSegment,
        );
        const response = await fetch(
          `${APEX_TRACK_AUTHORING_SERVER_ORIGIN}/api/tracks/save`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              format: 'apex-track-save-request',
              formatVersion: 2,
              trackId: ACTIVE_TRACK.track.id,
              trackVersion: ACTIVE_TRACK.track.version,
              primaryRouteId: persistedPrimaryRouteId,
              segments: persistedSegments,
              junctions: persistedJunctions,
              routes: persistedRoutes,
            }),
          },
        );
        const payload = await response.json().catch(() => undefined) as
          | {
            readonly ok?: boolean;
            readonly relativePath?: string;
            readonly error?: string;
          }
          | undefined;
        if (
          !response.ok
          || payload?.ok !== true
          || typeof payload.relativePath !== 'string'
        ) {
          throw new Error(
            payload?.error
            ?? `servidor local no disponible (${response.status})`,
          );
        }
        canvas.dataset.trackEditorFileSave = 'saved';
        canvas.dataset.trackEditorFilePath = payload.relativePath;
        return { relativePath: payload.relativePath };
      },
    })
    : undefined;
  let trackSegmentDrawTool: ApexTrackSegmentDrawTool | undefined;
  if (trackEditor) {
    const editingNonPrimarySegment = (
      editableTrackSegmentId
      !== (ACTIVE_TRACK_PRIMARY_SEGMENT?.id ?? 'main')
    );
    if (compatibleTrackDraft || editingNonPrimarySegment) {
      applyEditedTrackDerivedRuntime(
        trackEditor.evaluatedPoints,
        trackEditor.roadWidthM,
        trackEditor.boundaryMode,
        trackEditor.roadsideMode,
      );
      canvas.dataset.trackEditorDraft = compatibleTrackDraft
        ? 'loaded'
        : 'source-segment';
      canvas.dataset.trackEditorDraftSavedAt = (
        compatibleTrackDraft?.savedAtIso ?? 'none'
      );
    } else {
      canvas.dataset.trackEditorDraft = loadedTrackDraft
        ? 'ignored-incompatible'
        : 'empty';
      canvas.dataset.trackEditorDraftSavedAt = 'none';
    }
    sportHudContainer.hidden = true;
    lapTimerRoot.hidden = true;
    autonomousPanelRoot.hidden = true;
    canvas.dataset.trackEditor = 'active-free-draw-phase-3';
    canvas.dataset.trackEditorSegmentId = editableTrackSegmentId;
    canvas.dataset.trackEditorSegmentEnabled = String(
      editableTrackSegment?.enabled !== false,
    );
    canvas.dataset.trackEditorNodeCount = String(trackEditor.nodeCount);
    canvas.dataset.trackEditorEvaluatedPointCount = String(
      trackEditor.evaluatedPointCount,
    );
    canvas.dataset.trackEditorControlSpacingM = (
      activeEditorControlSpacingM.toFixed(2)
    );
    canvas.dataset.trackEditorSnapToRoad = trackEditorSnapToRoad
      ? 'asset-road-height-and-bank'
      : 'unavailable-no-imported-road-surface';
    canvas.dataset.trackEditorCollisionSpacingM = (
      activeEditorCollisionSpacingM.toFixed(2)
    );
    canvas.dataset.trackEditorRoadWidthM = trackEditor.roadWidthM.toFixed(2);
    canvas.dataset.trackEditorBoundaryMode = trackEditor.boundaryMode;
    canvas.dataset.trackEditorRoadsideMode = trackEditor.roadsideMode;
    canvas.dataset.trackEditorSimplificationToleranceM = (
      trackEditor.simplificationToleranceM.toFixed(3)
    );
    canvas.dataset.trackEditorEvaluation = 'waiting-for-control-release';
    canvas.dataset.trackEditorCamera = 'orbit-mmb-rmb-hold-noclip';
    canvas.dataset.trackEditorCameraPersistence = trackEditorVehicleEntryCamera
      ? 'vehicle-position-entry'
      : restoredTrackEditorView
        ? 'restored-position-target-mode'
        : 'new-session-framed-once';
    const currentPersistedSegment = createPersistedTrackSegment(
      trackEditor.controlPoints,
      trackEditor.evaluatedPoints,
      trackEditor.roadWidthM,
      trackEditor.boundaryMode,
      trackEditor.roadsideMode,
      trackEditor.simplificationToleranceM,
    );
    replacePersistedTrackSegment(
      currentPersistedSegment,
    );
    const outlinerEntries = () => workingTrackSegments.map(segment => ({
      id: segment.id,
      name: segment.name,
      pointCount: segment.controlPoints.length,
      enabled: segment.enabled !== false,
      primary: segment.id === primaryTrackSegmentId,
    }));
    const updateEditorSegmentDataset = (): void => {
      canvas.dataset.trackEditorSegmentId = editableTrackSegmentId;
      canvas.dataset.trackEditorSegmentEnabled = String(
        editableTrackSegment?.enabled !== false,
      );
      canvas.dataset.trackEditorNodeCount = String(trackEditor.nodeCount);
      canvas.dataset.trackEditorEvaluatedPointCount = String(
        trackEditor.evaluatedPointCount,
      );
      canvas.dataset.trackEditorControlSpacingM = (
        activeEditorControlSpacingM.toFixed(2)
      );
      canvas.dataset.trackEditorCollisionSpacingM = (
        activeEditorCollisionSpacingM.toFixed(2)
      );
      canvas.dataset.trackEditorRoadWidthM = (
        trackEditor.roadWidthM.toFixed(2)
      );
      canvas.dataset.trackEditorBoundaryMode = trackEditor.boundaryMode;
      canvas.dataset.trackEditorRoadsideMode = trackEditor.roadsideMode;
      canvas.dataset.trackEditorSimplificationToleranceM = (
        trackEditor.simplificationToleranceM.toFixed(3)
      );
    };
    let segmentOutliner: ApexTrackSegmentOutliner | undefined;
    const selectTrackSegment = (segmentId: string): void => {
      if (
        segmentId === editableTrackSegmentId
        || trackSegmentDrawTool?.active
      ) return;
      const targetSegment = workingTrackSegments.find(
        segment => segment.id === segmentId,
      );
      if (!targetSegment) return;

      saveActiveTrackDraft(
        trackEditor.controlPoints,
        trackEditor.evaluatedPoints,
        trackEditor.roadWidthM,
        trackEditor.boundaryMode,
        trackEditor.roadsideMode,
        trackEditor.simplificationToleranceM,
      );

      editableTrackSegment = targetSegment;
      editableTrackSegmentId = targetSegment.id;
      activeDraftTrackSegment = targetSegment;
      const targetBaseSegment = (
        ACTIVE_TRACK_SOURCE?.segments.find(
          segment => segment.id === targetSegment.id,
        )
        ?? targetSegment
      );
      baseEditorTrackSegment = targetBaseSegment;
      activeEditorClosed = targetSegment.editor.closed;
      activeEditorControlSpacingM = targetSegment.editor.controlSpacingM;
      activeEditorCollisionSpacingM = targetSegment.editor.collisionSpacingM;
      activeEditorLaneCount = targetSegment.geometry.laneCount;

      trackEditor.loadSession({
        points: asEditorTrackPoints(
          targetBaseSegment.evaluatedPoints,
        ),
        closed: activeEditorClosed,
        controlSpacingM: activeEditorControlSpacingM,
        collisionSpacingM: activeEditorCollisionSpacingM,
        roadWidthM: targetSegment.geometry.roadWidthM,
        boundaryMode: targetSegment.geometry.boundaryMode,
        roadsideMode: targetSegment.geometry.roadsideMode,
        simplificationToleranceM: (
          targetSegment.editor.simplificationToleranceM
        ),
        baseControlPoints: asEditorTrackPoints(
          targetBaseSegment.controlPoints,
        ),
        controlPoints: asEditorTrackPoints(targetSegment.controlPoints),
        evaluatedPoints: asEditorTrackPoints(targetSegment.evaluatedPoints),
      });
      trackEditDerivedVisual?.setProceduralSurfaceVisible(
        !importedTrackCollisionOnly
        || editableTrackSegmentId !== primaryTrackSegmentId,
      );
      const excludedVisualSegments = new Set([
        editableTrackSegmentId,
      ]);
      if (importedTrackCollisionOnly) {
        excludedVisualSegments.add(primaryTrackSegmentId);
      }
      trackRuntimeCoordinator.setVisualExcludedSegmentIds(
        excludedVisualSegments,
      );
      applyEditedTrackDerivedRuntime(
        trackEditor.evaluatedPoints,
        trackEditor.roadWidthM,
        trackEditor.boundaryMode,
        trackEditor.roadsideMode,
      );
      saveActiveTrackDraft(
        trackEditor.controlPoints,
        trackEditor.evaluatedPoints,
        trackEditor.roadWidthM,
        trackEditor.boundaryMode,
        trackEditor.roadsideMode,
        trackEditor.simplificationToleranceM,
      );
      segmentOutliner?.setActiveSegment(editableTrackSegmentId);
      segmentOutliner?.setSegments(outlinerEntries());
      updateEditorSegmentDataset();
      const url = new URL(window.location.href);
      url.searchParams.set('edit', 'track');
      url.searchParams.set('editSegment', editableTrackSegmentId);
      window.history.replaceState({}, '', url);
      canvas.dataset.trackEditorSegmentSwitch = 'hot-camera-preserved';
    };
    segmentOutliner = createApexTrackSegmentOutliner({
      activeSegmentId: editableTrackSegmentId,
      segments: outlinerEntries(),
      onSelect: selectTrackSegment,
      onEnabledChange: (segmentId, enabled) => {
        if (segmentId === primaryTrackSegmentId) return;
        const existingSegment = workingTrackSegments.find(
          segment => segment.id === segmentId,
        );
        if (!existingSegment || (existingSegment.enabled !== false) === enabled) {
          return;
        }
        const updatedSegment = Object.freeze({
          ...existingSegment,
          enabled,
        });
        workingTrackSegments = workingTrackSegments.map(segment => (
          segment.id === segmentId ? updatedSegment : segment
        ));
        if (editableTrackSegmentId === segmentId) {
          editableTrackSegment = updatedSegment;
          activeDraftTrackSegment = updatedSegment;
        }
        trackRuntimeCoordinator.setSegmentEnabled(segmentId, enabled);
        saveActiveTrackDraft(
          trackEditor.controlPoints,
          trackEditor.evaluatedPoints,
          trackEditor.roadWidthM,
          trackEditor.boundaryMode,
          trackEditor.roadsideMode,
          trackEditor.simplificationToleranceM,
        );
        segmentOutliner?.setSegments(outlinerEntries());
        canvas.dataset.trackEditorSegmentEnabled = String(enabled);
        canvas.dataset.trackEditorSegmentToggle = segmentId;
        canvas.dataset.trackNetworkCollisionSegments = String(
          trackRuntimeCoordinator.collisionSegmentCount,
        );
        canvas.dataset.trackNetworkVisualSegments = String(
          trackRuntimeCoordinator.segmentCount,
        );
      },
      onCreate: () => {
        if (trackSegmentDrawTool?.active) return;
        segmentOutliner?.setDrawing(true);
        trackEditor.root.visible = false;
        canvas.dataset.trackSegmentDraw = 'active';
        const surface = (
          editableTrackSegment?.geometry.surface
          ?? ACTIVE_TRACK.configuration.surfaces.road
        ) as TrackPoint['surface'];
        trackSegmentDrawTool = createApexTrackSegmentDrawTool({
          scene,
          camera,
          roadWidthM: trackEditor.roadWidthM,
          collisionSpacingM: activeEditorCollisionSpacingM,
          surface,
          onCancel: () => {
            trackSegmentDrawTool = undefined;
            segmentOutliner?.setDrawing(false);
            trackEditor.root.visible = true;
            canvas.dataset.trackSegmentDraw = 'cancelled';
          },
          onCommit: (controlPoints, evaluatedPoints) => {
            const existingIds = new Set(
              workingTrackSegments.map(segment => segment.id),
            );
            const idBase = `segment-${Date.now().toString(36)}`;
            let segmentId = idBase;
            let suffix = 2;
            while (existingIds.has(segmentId)) {
              segmentId = `${idBase}-${suffix}`;
              suffix += 1;
            }
            const newSegment = Object.freeze({
              id: segmentId,
              name: `Tramo ${workingTrackSegments.length + 1}`,
              kind: 'road' as const,
              enabled: true,
              editor: Object.freeze({
                closed: false,
                controlSpacingM: activeEditorControlSpacingM,
                collisionSpacingM: activeEditorCollisionSpacingM,
                simplificationToleranceM: 0,
              }),
              geometry: Object.freeze({
                roadWidthM: trackEditor.roadWidthM,
                laneCount: activeEditorLaneCount,
                surface: surface ?? 'asphalt',
                boundaryMode: trackEditor.boundaryMode,
                roadsideMode: trackEditor.roadsideMode,
                // Un tramo dibujado por el editor tiene presentación propia.
                // No debe heredar `collision-only` de un asset importado.
                visualMode: 'procedural' as const,
              }),
              controlPoints,
              evaluatedPoints,
            });
            const refreshedCurrentSegment = createPersistedTrackSegment(
              trackEditor.controlPoints,
              trackEditor.evaluatedPoints,
              trackEditor.roadWidthM,
              trackEditor.boundaryMode,
              trackEditor.roadsideMode,
              trackEditor.simplificationToleranceM,
            );
            const segmentsWithCurrent = replacePersistedTrackSegment(
              refreshedCurrentSegment,
            );
            const segments = Object.freeze([
              ...segmentsWithCurrent,
              newSegment,
            ]);
            workingTrackSegments = [...segments];
            const savedAtIso = new Date().toISOString();
            const saved = saveApexTrackDraft(Object.freeze({
              format: APEX_TRACK_DRAFT_FORMAT,
              formatVersion: APEX_TRACK_DRAFT_FORMAT_VERSION,
              trackId: trackDraftIdentity.trackId,
              trackVersion: trackDraftIdentity.trackVersion,
              savedAtIso,
              activeSegmentId: segmentId,
              primaryRouteId: persistedPrimaryRouteId,
              segments,
              junctions: persistedJunctions,
              routes: persistedRoutes,
              closed: newSegment.editor.closed,
              controlSpacingM: newSegment.editor.controlSpacingM,
              collisionSpacingM: newSegment.editor.collisionSpacingM,
              roadWidthM: newSegment.geometry.roadWidthM,
              boundaryMode: newSegment.geometry.boundaryMode,
              roadsideMode: newSegment.geometry.roadsideMode,
              simplificationToleranceM: (
                newSegment.editor.simplificationToleranceM
              ),
              controlPoints: newSegment.controlPoints,
              evaluatedPoints: newSegment.evaluatedPoints,
            }));
            if (!saved) {
              canvas.dataset.trackEditorDraft = 'save-error';
              segmentOutliner?.setDrawing(false);
              trackEditor.root.visible = true;
              trackSegmentDrawTool = undefined;
              return;
            }
            canvas.dataset.trackSegmentDraw = 'committed';
            trackRuntimeCoordinator.upsertSegment(newSegment);
            segmentOutliner?.setDrawing(false);
            segmentOutliner?.setSegments(outlinerEntries());
            trackEditor.root.visible = true;
            trackSegmentDrawTool = undefined;
            selectTrackSegment(segmentId);
          },
        });
      },
    });
    canvas.dataset.trackSegmentDraw = 'idle';
    canvas.dataset.trackEditorSegmentCount = String(
      workingTrackSegments.length,
    );
  } else {
    canvas.dataset.trackEditor = 'disabled';
  }
  autonomousRaceStartHook = () => {
    physics.placeAtSpawn(autonomousGridSpawn);
    lapTimer.resetForStart();
    autonomousDriver.cancelLap();
    autonomousDriver.reset();
    autonomousLapActive = false;
    segmentTimer.update(0, simulationNow, false);
    lapGhost.clear();
    lapGhost.beginLap();
    setCameraMode('close');
    canvas.dataset.autonomousRaceStart = 'grid-countdown';
    return true;
  };
  parkingActivationHook = (definition, presentation) => {
    const localPosition = presentation.userData.apexDriveLocalPosition;
    if (
      !Array.isArray(localPosition)
      || localPosition.length !== 3
      || !localPosition.every(Number.isFinite)
    ) {
      return false;
    }

    runtimeCar = definition;
    physics.configureDynamicsProfile(definition.dynamics);
    lapGhost.clear();
    autonomousDriver.configureMemory(
      autonomousMemoryStorageKey(runtimeCar),
    );
    segmentTimer.configure(segmentTimingStorageKey(runtimeCar));
    autonomousLapActive = false;
    localStorage.setItem(selectedCarStorageKey, definition.id);
    localStorage.setItem(vehicleKindStorageKey, 'car');
    const runtimeUrl = new URL(window.location.href);
    runtimeUrl.searchParams.set('vehicle', 'car');
    runtimeUrl.searchParams.set('car', definition.id);
    runtimeUrl.searchParams.delete('motorcycle');
    runtimeUrl.searchParams.set('drive', 'parking-drive');
    window.history.replaceState(window.history.state, '', runtimeUrl);
    vehicleColorStorageKey = carColorStorageKey(definition);
    vehicleColorInput.value = storedCarColor(definition);

    vehiclePaintMaterials.clear();
    brakeLightMaterials.clear();
    brakePointLights.forEach(light => light.removeFromParent());
    brakePointLights.clear();
    const paintPattern = new RegExp(definition.materials.paintPattern, 'i');
    const brakePattern = new RegExp(definition.materials.brakeLightPattern, 'i');
    const wheelPattern = definition.materials.hiddenWheelPattern
      ? new RegExp(definition.materials.hiddenWheelPattern, 'i')
      : undefined;
    let pbrMaterialCount = 0;
    presentation.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const materialNames = materials.map(material => material.name);
      materials.forEach(material => {
        if (
          !(
            material instanceof THREE.MeshStandardMaterial
            || material instanceof THREE.MeshPhysicalMaterial
          )
        ) return;
        pbrMaterialCount += 1;
        configureApexCarMaterial(material, definition.id, vehicleColorInput.value);
        const role = `${material.name} ${object.name}`;
        if (matchesMaterialRole(
          paintPattern,
          material.name,
          object.name,
        )) {
          vehiclePaintMaterials.add(material);
        }
        if (brakePattern.test(role)) {
          material.color.set(0x050000);
          material.emissive.set(0x610000);
          material.emissiveMap = null;
          material.emissiveIntensity = BRAKE_EMISSIVE_IDLE;
          material.toneMapped = true;
          material.needsUpdate = true;
          brakeLightMaterials.add(material);
        }
      });
      if (wheelPattern?.test(`${object.name} ${materialNames.join(' ')}`)) {
        object.visible = false;
      }
    });

    vehicleRoot.children
      .filter(child => (
        child.userData.apexDriveCarPresentation === true
        && child !== presentation
      ))
      .forEach(child => vehicleRoot.remove(child));
    parkingPreviewRoot.remove(presentation);
    setPrototypeWheelPresentation(
      presentation,
      true,
      definition.visual.inspectionBodyOpacity,
      definition.visual.detectEmbeddedWheelGeometry,
    );
    presentation.position.fromArray(localPosition);
    presentation.rotation.y = 0;
    presentation.userData.apexDriveCarPresentation = true;
    vehicleRoot.add(presentation);
    lapGhost.setVehicleVisual(presentation);
    parkingPreviewRoot.visible = false;
    vehicleRoot.visible = true;
    chassis.visible = false;
    wheels.forEach(wheel => {
      wheel.visible = true;
    });
    steeringWheelMount.position.y = 0.12 + definition.visual.bodyLiftM;
    steeringWheelMount.visible = true;
    applyVehicleColor(vehicleColorInput.value);

    parkingDriveTransitionCameraStart.copy(camera.position);
    const selectedParkingBay = resolveApexParkingBayPosition(
      parkingSelectedIndex,
    );
    parkingDriveTransitionFocusStart.set(
      selectedParkingBay.x,
      0.72,
      selectedParkingBay.z,
    );
    parkingDriveTransitionElapsedS = 0;
    parkingDriveTransitionActive = true;
    parkingSelectionActive = false;
    parkingCarSelector.hidden = true;
    parkingNavigationIndicator.hidden = true;
    vehicleWorkshopRoot.hidden = !APEX_DRIVE_PUBLIC_DEMO;
    visualControlsRoot.hidden = true;
    sportHudContainer.hidden = true;
    lapTimerRoot.hidden = true;
    telemetryContainer.hidden = true;
    vehicleKindSelect.value = `car:${definition.id}`;
    vehicleWorkshopCarSelect.value = definition.id;
    canvas.dataset.carId = definition.id;
    canvas.dataset.vehicleModel = `${definition.id}-ready`;
    canvas.dataset.vehicleModelName = definition.name;
    canvas.dataset.vehiclePbrMaterialCount = String(pbrMaterialCount);
    canvas.dataset.vehiclePaintMaterialCount = String(vehiclePaintMaterials.size);
    canvas.dataset.brakeLightMaterialCount = String(brakeLightMaterials.size);
    canvas.dataset.experienceMode = 'parking-transition';
    canvas.dataset.parkingTransition = 'camera';
    setCameraMode('close');
    return true;
  };
  tryActivateParkingSelection();
  if (uiMode === 'tuning') uiRuntime?.connectTuning?.(physics);
  if (raceAudit) {
    physics.setTireModel(auditTireModel);
    physics.setHandlingStage(auditHandlingStage);
    let raceState = physics.getState();
    while (!raceAudit.complete) {
      physics.applyInput(raceAudit.inputForState(raceState));
      physicsWorld.step();
      raceState = physics.getState();
      raceAudit.record(raceState);
    }
    const raceResult = raceAudit.result();
    (window as typeof window & { __apexRaceAuditResult?: typeof raceResult }).__apexRaceAuditResult = raceResult;
    canvas.dataset.raceAuditComplete = 'true';
    canvas.dataset.raceAuditCompletedLap = String(raceResult.completedLap);
  }
  if (tireManeuverAudit) {
    physics.setTireModel(auditTireModel);
    physics.setHandlingStage(auditHandlingStage);
    physics.setActiveSurface(
      tireManeuverAudit.maneuver === 'steering-tap' ? 'track' : 'asphalt',
    );
    while (!tireManeuverAudit.complete) {
      physics.applyInput(tireManeuverAudit.input());
      physicsWorld.step();
      tireManeuverAudit.record(physics.getState());
    }
    const maneuverResult = tireManeuverAudit.result();
    (window as typeof window & {
      __apexTireManeuverResult?: typeof maneuverResult;
    }).__apexTireManeuverResult = maneuverResult;
    canvas.dataset.tireManeuverComplete = 'true';
  }
  if (guardrailAuditEnabled) {
    const eligibleSections = TEST_TRACK_SAFETY.sections
      .filter(section => section.arrows && section.lengthM >= 45)
      .sort((left, right) => right.risk - left.risk);
    const selectedSections: typeof eligibleSections = [];
    for (const side of [-1, 1] as const) {
      const candidate = eligibleSections.find(section => section.side === side);
      if (candidate) selectedSections.push(candidate);
    }
    const longestRemaining = [...eligibleSections]
      .filter(section => !selectedSections.includes(section))
      .sort((left, right) => right.lengthM - left.lengthM)[0];
    if (longestRemaining) selectedSections.push(longestRemaining);

    const distanceToSection = (
      x: number,
      z: number,
      section: (typeof TEST_TRACK_SAFETY.sections)[number],
    ): { signedDistanceM: number; alongM: number } => {
      let bestDistanceSquared = Number.POSITIVE_INFINITY;
      let bestSignedDistanceM = -Number.POSITIVE_INFINITY;
      let bestAlongM = 0;
      let accumulatedM = 0;
      for (let index = 0; index < section.points.length - 1; index += 1) {
        const start = section.points[index];
        const end = section.points[index + 1];
        const centerStart = section.centerPoints[index];
        const centerEnd = section.centerPoints[index + 1];
        const deltaX = end.x - start.x;
        const deltaZ = end.z - start.z;
        const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
        const mix = THREE.MathUtils.clamp(
          (
            (x - start.x) * deltaX
            + (z - start.z) * deltaZ
          ) / Math.max(0.0001, lengthSquared),
          0,
          1,
        );
        const closestX = start.x + deltaX * mix;
        const closestZ = start.z + deltaZ * mix;
        const relativeX = x - closestX;
        const relativeZ = z - closestZ;
        const distanceSquared = (
          relativeX * relativeX + relativeZ * relativeZ
        );
        if (distanceSquared < bestDistanceSquared) {
          const centerX = (
            centerStart.x + (centerEnd.x - centerStart.x) * mix
          );
          const centerZ = (
            centerStart.z + (centerEnd.z - centerStart.z) * mix
          );
          const outwardX = closestX - centerX;
          const outwardZ = closestZ - centerZ;
          const outwardLength = Math.hypot(outwardX, outwardZ) || 1;
          bestDistanceSquared = distanceSquared;
          bestSignedDistanceM = (
            relativeX * outwardX + relativeZ * outwardZ
          ) / outwardLength;
          bestAlongM = accumulatedM + Math.sqrt(lengthSquared) * mix;
        }
        accumulatedM += Math.sqrt(lengthSquared);
      }
      return {
        signedDistanceM: bestSignedDistanceM,
        alongM: bestAlongM,
      };
    };

    const cases = [];
    for (const section of selectedSections) {
      const arrowCore = section.segments.filter(segment => segment.arrows);
      const guardrailSegment = (
        arrowCore[Math.floor(arrowCore.length * 0.5)]
        ?? section.segments[Math.floor(section.segments.length * 0.5)]
      );
      const midpointX = (guardrailSegment.start.x + guardrailSegment.end.x) * 0.5;
      const midpointY = (guardrailSegment.start.y + guardrailSegment.end.y) * 0.5;
      const midpointZ = (guardrailSegment.start.z + guardrailSegment.end.z) * 0.5;
      const tangentX = guardrailSegment.end.x - guardrailSegment.start.x;
      const tangentZ = guardrailSegment.end.z - guardrailSegment.start.z;
      const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
      const unitTangentX = tangentX / tangentLength;
      const unitTangentZ = tangentZ / tangentLength;
      const centerMidpointX = (
        guardrailSegment.centerStart.x + guardrailSegment.centerEnd.x
      ) * 0.5;
      const centerMidpointZ = (
        guardrailSegment.centerStart.z + guardrailSegment.centerEnd.z
      ) * 0.5;
      const outwardRawX = midpointX - centerMidpointX;
      const outwardRawZ = midpointZ - centerMidpointZ;
      const outwardLength = Math.hypot(outwardRawX, outwardRawZ) || 1;
      const outwardX = outwardRawX / outwardLength;
      const outwardZ = outwardRawZ / outwardLength;
      const approachDistanceM = 4.8;
      const impactAngleRadians = THREE.MathUtils.degToRad(20);
      const headingX = (
        unitTangentX * Math.cos(impactAngleRadians)
        + outwardX * Math.sin(impactAngleRadians)
      );
      const headingZ = (
        unitTangentZ * Math.cos(impactAngleRadians)
        + outwardZ * Math.sin(impactAngleRadians)
      );
      physics.placeAtSpawn({
        x: midpointX - outwardX * approachDistanceM,
        y: midpointY + 0.92,
        z: midpointZ - outwardZ * approachDistanceM,
        yawDegrees: THREE.MathUtils.radToDeg(Math.atan2(headingX, headingZ)),
      });
      physics.setActiveSurface('track');
      const collisionInput: DriverInput = {
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        throttle: 1,
        brake: 0,
        steering: 0,
      };
      const auditSteps = runtimePhysicsHz * 7;
      let maximumOutwardCenterM = -Number.POSITIVE_INFINITY;
      let maximumOutwardAlongM = 0;
      let maximumOutwardStep = 0;
      let maximumSpeedKmh = 0;
      let maximumGroundedWheels = 0;
      let groundedSamples = 0;
      let firstContactStep: number | undefined;
      let minimumContactAlongM = Number.POSITIVE_INFINITY;
      let maximumContactAlongM = -Number.POSITIVE_INFINITY;
      for (let step = 0; step < auditSteps; step += 1) {
        physics.applyInput(collisionInput);
        physicsWorld.step();
        const state = physics.getState();
        const sectionDistance = distanceToSection(
          state.position[0],
          state.position[2],
          section,
        );
        if (sectionDistance.signedDistanceM > maximumOutwardCenterM) {
          maximumOutwardCenterM = sectionDistance.signedDistanceM;
          maximumOutwardAlongM = sectionDistance.alongM;
          maximumOutwardStep = step;
        }
        maximumSpeedKmh = Math.max(maximumSpeedKmh, state.speedKmh);
        const groundedWheels = state.wheels.filter(wheel => wheel.grounded).length;
        maximumGroundedWheels = Math.max(maximumGroundedWheels, groundedWheels);
        if (groundedWheels > 0) groundedSamples += 1;
        if (sectionDistance.signedDistanceM > -2.8) {
          firstContactStep ??= step;
          minimumContactAlongM = Math.min(
            minimumContactAlongM,
            sectionDistance.alongM,
          );
          maximumContactAlongM = Math.max(
            maximumContactAlongM,
            sectionDistance.alongM,
          );
        }
      }
      const tangentialSlideM = firstContactStep === undefined
        ? 0
        : maximumContactAlongM - minimumContactAlongM;
      cases.push(Object.freeze({
        contained: maximumOutwardCenterM < 0.65,
        reachedBarrier: firstContactStep !== undefined,
        slidAlongBarrier: tangentialSlideM >= 4,
        sectionId: section.id,
        side: section.side,
        segmentSourceIndex: guardrailSegment.sourceIndex,
        segmentRisk: guardrailSegment.risk,
        curveRadiusM: guardrailSegment.curveRadiusM,
        approachDistanceM,
        impactAngleDegrees: 20,
        maximumOutwardCenterM,
        maximumOutwardAlongM,
        maximumOutwardSeconds: maximumOutwardStep / runtimePhysicsHz,
        tangentialSlideM,
        contactAlongRangeM: firstContactStep === undefined
          ? null
          : Object.freeze([minimumContactAlongM, maximumContactAlongM]),
        sectionLengthM: section.lengthM,
        maximumSpeedKmh,
        maximumGroundedWheels,
        groundedSampleRatio: groundedSamples / auditSteps,
        durationSeconds: auditSteps / runtimePhysicsHz,
      }));
    }
    let airborneCase: Readonly<{
      contained: boolean;
      sectionId: number;
      launchHeightAboveRailM: number;
      launchSpeedKmh: number;
      maximumOutwardCenterM: number;
      maximumHeightAboveRailM: number;
      durationSeconds: number;
    }> | undefined;
    const airborneSection = selectedSections[0];
    if (airborneSection) {
      const segment = airborneSection.segments[
        Math.floor(airborneSection.segments.length * 0.5)
      ];
      const midpointX = (segment.start.x + segment.end.x) * 0.5;
      const midpointY = (segment.start.y + segment.end.y) * 0.5;
      const midpointZ = (segment.start.z + segment.end.z) * 0.5;
      const centerX = (
        segment.centerStart.x + segment.centerEnd.x
      ) * 0.5;
      const centerZ = (
        segment.centerStart.z + segment.centerEnd.z
      ) * 0.5;
      const outwardRawX = midpointX - centerX;
      const outwardRawZ = midpointZ - centerZ;
      const outwardLength = Math.hypot(outwardRawX, outwardRawZ) || 1;
      const outwardX = outwardRawX / outwardLength;
      const outwardZ = outwardRawZ / outwardLength;
      const launchHeightAboveRailM = 2.2;
      const launchSpeedMps = 42;
      physics.placeAtSpawn({
        x: midpointX - outwardX * 5,
        y: midpointY + launchHeightAboveRailM,
        z: midpointZ - outwardZ * 5,
        yawDegrees: THREE.MathUtils.radToDeg(Math.atan2(outwardX, outwardZ)),
      });
      const launchSnapshot = physics.captureTrainingSnapshot();
      physics.restoreTrainingSnapshot({
        ...launchSnapshot,
        linearVelocity: Object.freeze([
          outwardX * launchSpeedMps,
          0,
          outwardZ * launchSpeedMps,
        ]),
      });
      const airborneSteps = Math.round(runtimePhysicsHz * 1.5);
      let maximumOutwardCenterM = -Number.POSITIVE_INFINITY;
      let maximumHeightAboveRailM = -Number.POSITIVE_INFINITY;
      for (let step = 0; step < airborneSteps; step += 1) {
        physics.applyInput(neutralDriverInput);
        physicsWorld.step();
        const state = physics.getState();
        maximumOutwardCenterM = Math.max(
          maximumOutwardCenterM,
          distanceToSection(
            state.position[0],
            state.position[2],
            airborneSection,
          ).signedDistanceM,
        );
        maximumHeightAboveRailM = Math.max(
          maximumHeightAboveRailM,
          state.position[1] - midpointY,
        );
      }
      airborneCase = Object.freeze({
        contained: maximumOutwardCenterM < 0.65,
        sectionId: airborneSection.id,
        launchHeightAboveRailM,
        launchSpeedKmh: launchSpeedMps * 3.6,
        maximumOutwardCenterM,
        maximumHeightAboveRailM,
        durationSeconds: airborneSteps / runtimePhysicsHz,
      });
    }
    if (cases.length > 0) {
      const guardrailResult = Object.freeze({
        contained: (
          cases.every(testCase => testCase.contained)
          && (airborneCase?.contained ?? false)
        ),
        allCasesReachedBarrier: cases.every(testCase => testCase.reachedBarrier),
        allCasesSlidAlongBarrier: cases.every(
          testCase => testCase.slidAlongBarrier,
        ),
        testedSides: Object.freeze([...new Set(cases.map(testCase => testCase.side))]),
        orientationErrorCount: TEST_TRACK_SAFETY.orientationErrorCount,
        maximumJoinGapM: TEST_TRACK_SAFETY.maximumJoinGapM,
        physicalBodyCount: 1,
        physicsHz: runtimePhysicsHz,
        cases: Object.freeze(cases),
        airborneCase,
      });
      (window as typeof window & {
        __apexGuardrailAuditResult?: typeof guardrailResult;
      }).__apexGuardrailAuditResult = guardrailResult;
      canvas.dataset.guardrailAuditComplete = 'true';
      canvas.dataset.guardrailAuditContained = String(guardrailResult.contained);
    }
  }
  const runtimeConfiguration = physics.getState();
  canvas.dataset.physicsHz = String(runtimeConfiguration.physicsHz);
  canvas.dataset.tireContactCount = String(
    runtimeConfiguration.configuredTireContactCount,
  );
  canvas.dataset.tireModel = runtimeConfiguration.tireModel;
  if (uiRuntime) uiRuntime.publish(performance.now(), runtimeConfiguration);
  const configurationStatus = `${runtimeConfiguration.vehicleKind} · `
    + `${runtimeConfiguration.tireModel} · `
    + `${runtimeConfiguration.physicsHz} Hz · `
    + `${runtimeConfiguration.configuredTireContactCount} contactos`;
  runtimeStatus = uiMode === 'off'
    ? `ApexPhysics activo · ${configurationStatus} · UI desconectada`
    : uiMode === 'read'
      ? `ApexPhysics activo · ${configurationStatus} · UI sólo lectura`
      : `ApexPhysics activo · ${configurationStatus} · UI tuning explícito`;
  reportStatus(runtimeStatus);

  const fixedStep = 1 / runtimePhysicsHz;
  const telemetryStep = 1 / 20;
  let physicsStep = 0;
  let accumulator = 0;
  let telemetryAccumulator = 0;
  let previousTime = performance.now();
  const autonomousSegmentSnapshots = new Map<
    number,
    ApexVehicleTrainingSnapshot
  >();
  let autonomousSnapshotBinIndex: number | undefined;
  const resetAutonomousSegmentSnapshots = () => {
    autonomousSegmentSnapshots.clear();
    autonomousSnapshotBinIndex = undefined;
    canvas.dataset.autonomousSegmentRetry = 'none';
  };
  const updateAutonomousControl = (
    deltaS: number,
    manualCorrectionActive: boolean,
  ): DriverInput => {
    let control = autonomousDriver.update(
      physics.getState(),
      deltaS,
      autonomousObstacles,
      manualCorrectionActive,
    );
    const telemetry = autonomousDriver.lastTelemetry;
    const binIndex = Math.max(0, Math.floor(telemetry.trackDistanceM / 10));
    if (autonomousSnapshotBinIndex !== binIndex) {
      autonomousSegmentSnapshots.set(
        binIndex,
        physics.captureTrainingSnapshot(),
      );
      autonomousSnapshotBinIndex = binIndex;
    }
    const retry = autonomousDriver.consumeSegmentRetry();
    const snapshot = retry
      ? autonomousSegmentSnapshots.get(retry.binIndex)
      : undefined;
    if (!retry || !snapshot) return control;
    physics.restoreTrainingSnapshot(snapshot);
    autonomousDriver.acknowledgeSegmentRetry(retry.binIndex);
    autonomousSnapshotBinIndex = retry.binIndex;
    canvas.dataset.autonomousSegmentRetry = [
      retry.binIndex,
      retry.attempt,
      retry.actualTimeMs.toFixed(1),
      retry.targetTimeMs.toFixed(1),
    ].join(':');
    control = autonomousDriver.update(
      physics.getState(),
      0,
      autonomousObstacles,
      manualCorrectionActive,
    );
    return control;
  };
  const forward = new THREE.Vector3();
  const vehicleAnchor = new THREE.Vector3();
  const chaseHeading = new THREE.Vector3(0, 0, 1);
  const desiredCamera = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const cameraVelocity = new THREE.Vector3();
  const cameraDelta = new THREE.Vector3();
  const closeCamera = new THREE.Vector3();
  const closeTarget = new THREE.Vector3();
  const closeDelta = new THREE.Vector3();
  const panCamera = new THREE.Vector3();
  const panTarget = new THREE.Vector3();
  const panVelocity = new THREE.Vector3();
  const panDelta = new THREE.Vector3();
  const rallyCamera = new THREE.Vector3();
  const rallyTarget = new THREE.Vector3();
  const rallyVelocity = new THREE.Vector3();
  const rallyDelta = new THREE.Vector3();
  const rallySide = new THREE.Vector3();
  const interiorCamera = new THREE.Vector3();
  const interiorTarget = new THREE.Vector3();
  const wheelCameraLocal = new THREE.Vector3();
  const wheelCameraTargetLocal = new THREE.Vector3();
  const wheelCameraWorld = new THREE.Vector3();
  const wheelCameraTargetWorld = new THREE.Vector3();
  const wheelCameraOffset = new THREE.Vector3();
  const wheelCameraTargetOffset = new THREE.Vector3();
  const parkingCamera = new THREE.Vector3();
  const parkingTarget = new THREE.Vector3();
  const parkingFocus = new THREE.Vector3();
  const explorationForward = new THREE.Vector3();
  const explorationRight = new THREE.Vector3();
  const explorationMovement = new THREE.Vector3();
  const explorationTarget = new THREE.Vector3();
  const worldUp = THREE.Object3D.DEFAULT_UP;
  let closeCameraReady = false;
  let panCameraReady = false;
  let chaseCameraReady = false;
  let rallyCameraReady = false;
  let parkingCameraReady = false;
  let observedCameraChangeSerial = cameraChangeSerial;
  let previousAudioGear: number | undefined;
  let audioShiftRemainingS = 0;
  let racingLineLapActive = false;
  let observedCompletedLapCount = 0;
  let manualGhostLapActive = false;
  let manualGhostPreviousProgress: number | undefined;
  let manualGhostTravel = 0;
  let manualGhostLapStartedAt = simulationNow;
  let manualGhostLastProgressSampleAt = Number.NEGATIVE_INFINITY;
  const manualGhostProgressSampleIntervalMs = 70;

  const resetManualGhostLap = (now: number) => {
    manualGhostPreviousProgress = undefined;
    manualGhostTravel = 0;
    manualGhostLapStartedAt = now;
    manualGhostLastProgressSampleAt = Number.NEGATIVE_INFINITY;
  };
  const nearestTrackProgressAt = (position: THREE.Vector3): number => {
    let nearestIndex = 0;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sampledTrackPoints.length; index += 1) {
      const point = sampledTrackPoints[index];
      const deltaX = position.x - point.x;
      const deltaZ = position.z - point.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= nearestDistanceSquared) continue;
      nearestDistanceSquared = distanceSquared;
      nearestIndex = index;
    }
    return nearestIndex / Math.max(1, sampledTrackPoints.length);
  };

  const walkingSurfaceHeightAt = (x: number, z: number): number => {
    let nearestIndex = 0;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sampledTrackPoints.length; index += 1) {
      const point = sampledTrackPoints[index];
      const deltaX = x - point.x;
      const deltaZ = z - point.z;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearestIndex = index;
      }
    }
    const center = sampledTrackPoints[nearestIndex];
    const horizontalLateral = sampledTrackHorizontalLaterals[nearestIndex];
    const surfaceLateral = sampledTrackLaterals[nearestIndex];
    const offsetM = (
      (x - center.x) * horizontalLateral.x
      + (z - center.z) * horizontalLateral.z
    );
    const absoluteOffsetM = Math.abs(offsetM);
    const halfRoadWidthM = TEST_TRACK_WIDTH_M * 0.5;
    if (absoluteOffsetM <= halfRoadWidthM) {
      return center.y + surfaceLateral.y * offsetM;
    }
    if (absoluteOffsetM <= halfRoadWidthM + TEST_TRACK_SHOULDER_WIDTH_M) {
      const edgeY = center.y + surfaceLateral.y
        * Math.sign(offsetM)
        * halfRoadWidthM;
      const shoulderMix = (
        (absoluteOffsetM - halfRoadWidthM) / TEST_TRACK_SHOULDER_WIDTH_M
      );
      return THREE.MathUtils.lerp(
        edgeY,
        TEST_TRACK_GROUND_HEIGHT_M,
        shoulderMix,
      );
    }
    return TEST_TRACK_GROUND_HEIGHT_M;
  };

  const updateExplorationCamera = (delta: number, walking: boolean) => {
    if (!explorationCameraReady) prepareExplorationCamera();
    const cosPitch = Math.cos(explorationPitchRadians);
    explorationForward.set(
      Math.sin(explorationYawRadians) * cosPitch,
      Math.sin(explorationPitchRadians),
      Math.cos(explorationYawRadians) * cosPitch,
    ).normalize();
    explorationRight.set(
      -Math.cos(explorationYawRadians),
      0,
      Math.sin(explorationYawRadians),
    );
    explorationMovement.set(0, 0, 0);
    const forwardAmount = (
      (explorationKeys.has('KeyW') ? 1 : 0)
      - (explorationKeys.has('KeyS') ? 1 : 0)
    );
    const rightAmount = (
      (explorationKeys.has('KeyD') ? 1 : 0)
      - (explorationKeys.has('KeyA') ? 1 : 0)
    );
    if (walking) {
      explorationMovement.addScaledVector(
        explorationRight,
        rightAmount,
      );
      explorationMovement.addScaledVector(
        explorationTarget.set(
          Math.sin(explorationYawRadians),
          0,
          Math.cos(explorationYawRadians),
        ),
        forwardAmount,
      );
      if (explorationMovement.lengthSq() > 1) explorationMovement.normalize();
      const running = explorationKeys.has('ShiftLeft')
        || explorationKeys.has('ShiftRight');
      camera.position.addScaledVector(
        explorationMovement,
        delta * (running ? 9 : 5.2),
      );
      const eyeHeightM = 1.72;
      const targetEyeY = walkingSurfaceHeightAt(
        camera.position.x,
        camera.position.z,
      ) + eyeHeightM;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        targetEyeY,
        1 - Math.exp(-delta * 18),
      );
      canvas.dataset.cameraDistanceM = 'fps-walking';
    } else {
      explorationMovement
        .addScaledVector(explorationForward, forwardAmount)
        .addScaledVector(explorationRight, rightAmount)
        .addScaledVector(
          worldUp,
          (explorationKeys.has('KeyE') ? 1 : 0)
            - (explorationKeys.has('KeyQ') ? 1 : 0),
        );
      if (explorationMovement.lengthSq() > 1) explorationMovement.normalize();
      const boosted = explorationKeys.has('ShiftLeft')
        || explorationKeys.has('ShiftRight');
      camera.position.addScaledVector(
        explorationMovement,
        delta * (boosted ? 48 : 16),
      );
      canvas.dataset.cameraDistanceM = 'free-flight';
    }
    explorationTarget.copy(camera.position).add(explorationForward);
    camera.lookAt(explorationTarget);
  };

  const frame = async (now: number) => {
    const framePerformanceStartedAt = performance.now();
    if (APEX_DRIVE_PUBLIC_DEMO) {
      sportHudContainer.hidden = (
        parkingSelectionActive || parkingDriveTransitionActive
      );
    }
    let physicsPerformanceMs = 0;
    let tirePerformanceMs = 0;
    let physicsStepsThisFrame = 0;
    const frameIntervalMs = Math.max(0.01, now - previousTime);
    const delta = Math.min(frameIntervalMs / 1000, 0.1);
    previousTime = now;
    const effectiveSimulationSpeed = (
      autonomousDriveEnabled
      && !parkingSelectionActive
      && activeVehicleKind === 'car'
    )
      ? autonomousSimulationSpeed
      : 1;
    const simulationDelta = delta * effectiveSimulationSpeed;
    simulationNow += simulationDelta * 1000;
    canvas.dataset.effectiveSimulationSpeed = `${effectiveSimulationSpeed}x`;
    const autonomousControllerActive = (
      autonomousDriveEnabled
      && !parkingSelectionActive
      && activeVehicleKind === 'car'
      && !autonomousRaceStartPending
    );
    const initialAutonomousControlDelta = autonomousControllerActive
      ? Math.min(simulationDelta, 1 / 60)
      : 0;
    const manualInput = trackEditor || controlledBenchmarkIsRunning()
      ? neutralDriverInput
      : readRuntimeDriverInput();
    const overrideChannels = manualOverrideChannels(manualInput);
    const manualCorrectionActive = overrideChannels.length > 0;
    let runtimeInput = (
      autonomousDriveEnabled
      && !parkingSelectionActive
      && activeVehicleKind === 'car'
    ) ? blendAutonomousAssistance(
        (
          autonomousRaceStartPending
          && autonomousTimingPhase !== 'running'
        )
          ? autonomousHoldInput
          : updateAutonomousControl(
              initialAutonomousControlDelta,
              manualCorrectionActive,
            ),
        manualInput,
      )
      : manualInput;
    if (autonomousDriveEnabled && !parkingSelectionActive) {
      const ai = autonomousDriver.lastTelemetry;
      driverBrakeDemand = runtimeInput.brake ?? 0;
      autonomousDriveStatus.textContent = manualCorrectionActive
        ? `IA · override manual ${overrideChannels.join('+')}`
        : autonomousRaceStartPending
          ? autonomousTimingPhase === 'countdown'
            ? 'IA · salida automática · secuencia de luces'
            : 'IA · auto en grilla · armando salida'
          : [
            ai.baselineCaptureActive
              ? 'IA · grabando vuelta base Ferrari'
              : ai.recognitionLap
                ? 'IA · esperando tu vuelta base'
              : `IA · aprendizaje V${ai.completedLearningLaps + 1}`,
            `${effectiveSimulationSpeed}× simulación`,
            `${ai.targetSpeedKmh.toFixed(0)} km/h`,
            `${Math.round(ai.powerLimit * 100)}% potencia`,
            ...(Math.abs(ai.desiredLineOffsetM) > 0.08
              ? [
                  `corrige ${
                    ai.desiredLineOffsetM < 0 ? 'a la izquierda' : 'a la derecha'
                  }`,
                ]
              : []),
          ].join(' · ');
      canvas.dataset.autonomousMode = ai.mode;
      canvas.dataset.autonomousManualCorrection = String(
        manualCorrectionActive,
      );
      canvas.dataset.autonomousOverrideChannels = (
        overrideChannels.join(',') || 'none'
      );
      canvas.dataset.autonomousTargetSpeedKmh = ai.targetSpeedKmh.toFixed(2);
      canvas.dataset.autonomousCornerPhase = ai.cornerPhase;
      canvas.dataset.autonomousBrakePreviewM = (
        ai.previewBrakeDistanceM?.toFixed(2) ?? 'none'
      );
      canvas.dataset.autonomousAttackLineOffsetM = (
        ai.attackLineOffsetM.toFixed(3)
      );
      canvas.dataset.autonomousDriverLearning = String(
        ai.driverLearningActive,
      );
      canvas.dataset.autonomousDriverValidatedSpeedKmh = (
        ai.driverValidatedSpeedKmh.toFixed(2)
      );
      canvas.dataset.autonomousDriverValidationCount = String(
        ai.driverValidationCount,
      );
      canvas.dataset.autonomousBaselineReady = String(ai.baselineReady);
      canvas.dataset.autonomousBaselineCapture = String(
        ai.baselineCaptureActive,
      );
      canvas.dataset.autonomousBaselineLapMs = (
        ai.baselineLapMs?.toFixed(1) ?? 'none'
      );
      canvas.dataset.autonomousSegmentBestMs = (
        ai.segmentBestTimeMs?.toFixed(1) ?? 'none'
      );
      canvas.dataset.autonomousSegmentBaselineMs = (
        ai.segmentBaselineTimeMs?.toFixed(1) ?? 'none'
      );
      canvas.dataset.autonomousSegmentRetryAttempt = String(
        ai.segmentRetryAttempt,
      );
      canvas.dataset.autonomousCrossTrackErrorM = ai.crossTrackErrorM.toFixed(3);
      canvas.dataset.autonomousRecognitionLap = String(ai.recognitionLap);
      canvas.dataset.autonomousLearningLaps = String(ai.completedLearningLaps);
      canvas.dataset.autonomousPowerLimit = ai.powerLimit.toFixed(3);
      canvas.dataset.autonomousIncident = ai.incident ?? 'none';
      canvas.dataset.autonomousLineOffsetM = ai.desiredLineOffsetM.toFixed(3);
      canvas.dataset.autonomousObstacleCount = String(
        autonomousObstacles.length,
      );
    }
    if (
      !trackEditor
      && !driveAudit?.complete
      && !raceAudit?.complete
    ) {
      accumulator += simulationDelta;
    }
    let autonomousControlRemainingS = Math.max(
      0,
      simulationDelta - initialAutonomousControlDelta,
    );
    let autonomousControlStepsUntilUpdate = 6;
    const physicsPerformanceStartedAt = performance.now();
    while (accumulator >= fixedStep) {
      if (auditSwitchStep === physicsStep && uiMode === 'tuning') {
        uiRuntime?.sendCommand?.({ type: 'SET_TIRE_MODEL', model: 'apex-v1' });
      }
      if (
        !driveAudit
        && autonomousDriveEnabled
        && !parkingSelectionActive
        && activeVehicleKind === 'car'
        && !autonomousRaceStartPending
        && autonomousControlRemainingS > 0.000001
      ) {
        autonomousControlStepsUntilUpdate -= 1;
        if (autonomousControlStepsUntilUpdate <= 0) {
          const autonomousControlDelta = Math.min(
            1 / 60,
            autonomousControlRemainingS,
          );
          runtimeInput = blendAutonomousAssistance(
            updateAutonomousControl(
              autonomousControlDelta,
              manualCorrectionActive,
            ),
            manualInput,
          );
          autonomousControlRemainingS -= autonomousControlDelta;
          autonomousControlStepsUntilUpdate = 6;
        }
      }
      const currentInput = driveAudit ? driveAudit.inputForStep(physicsStep) : runtimeInput;
      physics.applyInput(currentInput);
      physicsWorld.step();
      physicsStep += 1;
      physicsStepsThisFrame += 1;
      accumulator -= fixedStep;
      telemetryAccumulator += fixedStep;
      let physicsSnapshot = driveAudit ? physics.getState() : undefined;
      if (driveAudit) {
        driveAudit.record(physicsStep, physicsSnapshot!);
      }
      if (uiRuntime && telemetryAccumulator >= telemetryStep) {
        physicsSnapshot ??= physics.getState();
        uiRuntime.publish(performance.now(), physicsSnapshot);
        telemetryAccumulator -= telemetryStep;
      }
      if (driveAudit?.complete) {
        const auditResult = Object.freeze({
          ...driveAudit.result(),
          uiMode,
          uiRuntimeLoaded: uiRuntime !== undefined,
          tuningCapability: typeof uiRuntime?.sendCommand === 'function',
          requestedSwitchStep: auditSwitchStep ?? null,
        });
        (window as typeof window & { __apexAuditResult?: typeof auditResult }).__apexAuditResult = auditResult;
        canvas.dataset.auditComplete = 'true';
        canvas.dataset.auditTraceHash = auditResult.traceHash;
        accumulator = 0;
        break;
      }
    }
    physicsPerformanceMs = performance.now() - physicsPerformanceStartedAt;
    if (autonomousDriveEnabled && !parkingSelectionActive) {
      driverBrakeDemand = runtimeInput.brake ?? 0;
    }

    const pose = adaptApexVehiclePose(physics.getPose());
    const technicalTelemetryVisible = (
      activeVehicleKind === 'car'
      && !parkingSelectionActive
      && !trackEditorMode
    );
    technicalTelemetryHud?.setVisible(technicalTelemetryVisible);
    if (technicalTelemetryVisible) {
      technicalTelemetryHud?.update(
        pose,
        delta,
        runtimePhysicsHz,
        canvas.dataset.tireExecutionBackend ?? 'webgpu',
      );
    }
    vehicleRoot.position.copy(pose.position);
    vehicleRoot.quaternion.copy(pose.rotation);
    wheels.forEach((wheel, index) => {
      wheel.position.copy(pose.wheelPositions[index]);
      wheel.quaternion.copy(pose.wheelRotations[index]);
      wheel.visible = true;
      wheel.children.forEach(child => {
        child.visible = true;
      });
    });
    vehiclePhysicsDebugWheels.forEach((wheel, index) => {
      wheel.position.copy(pose.wheelPositions[index]);
      wheel.quaternion.copy(pose.wheelRotations[index]);
    });
    trackGuidanceChevrons.update(
      pose.position,
      pose.speedKmh,
      delta,
      !parkingSelectionActive && !parkingDriveTransitionActive,
    );
    if (activeVehicleKind === 'car' && tireVisualDeformationEnabled) {
      tireContactNormalsLocal.forEach((normalLocal, index) => {
        tireContactWorldQuaternion.copy(pose.rotation).multiply(
          pose.wheelRotations[index],
        );
        tireContactInverseQuaternion.copy(tireContactWorldQuaternion).invert();
        normalLocal.copy(
          pose.wheelGrounded[index]
            ? pose.wheelContactNormals[index]
            : tireLocalUp,
        ).applyQuaternion(tireContactInverseQuaternion).normalize();
        if (pose.wheelGrounded[index]) {
          tireLongitudinalForcesLocal[index]
            .copy(pose.wheelContactLongitudinals[index])
            .multiplyScalar(pose.wheelLongitudinalForcesN[index] ?? 0)
            .applyQuaternion(tireContactInverseQuaternion);
          tireLateralForcesLocal[index]
            .copy(pose.wheelContactLaterals[index])
            .multiplyScalar(pose.wheelLateralForcesN[index] ?? 0)
            .applyQuaternion(tireContactInverseQuaternion);
        } else {
          tireLongitudinalForcesLocal[index].set(0, 0, 0);
          tireLateralForcesLocal[index].set(0, 0, 0);
        }
      });
      const tirePerformanceStartedAt = performance.now();
      const tireDeformation = tireDeformationVisual.update(
        pose.wheelGrounded.map((grounded, index) => ({
          grounded,
          verticalLoadN: pose.wheelVerticalLoadsN[index] ?? 0,
          longitudinalSlip: pose.wheelLongitudinalSlips[index] ?? 0,
          lateralSlipRadians: pose.wheelLateralSlipRadians[index] ?? 0,
          contactNormalLocal: tireContactNormalsLocal[index],
          longitudinalForceLocal: tireLongitudinalForcesLocal[index],
          lateralForceLocal: tireLateralForcesLocal[index],
          pressurePsi: pose.tirePressurePsi,
          angularSpeedRadiansPerSecond: (
            pose.wheelAngularVelocitiesRadiansPerSecond[index] ?? 0
          ),
          vehicleSpeedMps: Math.abs(pose.speedKmh) / 3.6,
        })),
        delta,
      );
      tirePerformanceMs = performance.now() - tirePerformanceStartedAt;
      canvas.dataset.tireVisualMaximumCompression = (
        tireDeformation.maximumCompression.toFixed(4)
      );
      canvas.dataset.tireVisualMaximumWidthExpansion = (
        tireDeformation.maximumWidthExpansion.toFixed(4)
      );
      canvas.dataset.tireVisualMaximumCompressionM = (
        tireDeformation.maximumCompressionM.toFixed(4)
      );
      canvas.dataset.tireVisualMaximumLongitudinalShearM = (
        tireDeformation.maximumLongitudinalShearM.toFixed(4)
      );
      canvas.dataset.tireVisualMaximumLateralShearM = (
        tireDeformation.maximumLateralShearM.toFixed(4)
      );
      canvas.dataset.tireVisualMaximumContactPatchLengthM = (
        tireDeformation.maximumContactPatchLengthM.toFixed(4)
      );
      canvas.dataset.tireVisualLongitudinalShearByWheelM = (
        tireDeformation.longitudinalShearMByWheel
          .map(value => value.toFixed(4))
          .join(',')
      );
      canvas.dataset.tireVisualLateralShearByWheelM = (
        tireDeformation.lateralShearMByWheel
          .map(value => value.toFixed(4))
          .join(',')
      );
      canvas.dataset.wheelVerticalLoadsN = pose.wheelVerticalLoadsN
        .map(loadN => loadN.toFixed(1))
        .join(',');
    }
    if (!isAuditRuntime) updateTireMarks(pose);
    const brakeLightTarget = THREE.MathUtils.clamp(driverBrakeDemand, 0, 1);
    brakeLightLevel += (brakeLightTarget - brakeLightLevel)
      * (1 - Math.exp(-delta * (brakeLightTarget > brakeLightLevel ? 34 : 20)));
    brakeLightMaterials.forEach(material => {
      material.emissive.set(brakeLightLevel > 0.02 ? 0xff0903 : 0x610000);
      material.emissiveIntensity = (
        BRAKE_EMISSIVE_IDLE + brakeLightLevel * BRAKE_EMISSIVE_GAIN
      );
    });
    brakePointLights.forEach(light => {
      light.intensity = brakeLightLevel > 0.02
        ? BRAKE_PROJECTION_BASE + brakeLightLevel * BRAKE_PROJECTION_GAIN
        : 0;
    });
    canvas.dataset.brakeLights = brakeLightLevel > 0.02 ? 'on' : 'off';
    canvas.dataset.brakeTrigger = driverBrakeDemand.toFixed(3);
    canvas.dataset.brakeEmissiveIntensity = (
      BRAKE_EMISSIVE_IDLE + brakeLightLevel * BRAKE_EMISSIVE_GAIN
    ).toFixed(2);
    canvas.dataset.brakeProjectionIntensity = (
      brakeLightLevel > 0.02
        ? BRAKE_PROJECTION_BASE + brakeLightLevel * BRAKE_PROJECTION_GAIN
        : 0
    ).toFixed(2);

    if (previousAudioGear !== undefined && pose.gear !== previousAudioGear) {
      audioShiftRemainingS = 0.22;
    }
    previousAudioGear = pose.gear;
    audioShiftRemainingS = Math.max(0, audioShiftRemainingS - delta);
    const audioShifting = audioShiftRemainingS > 0;
    engineSynth?.update(
      pose.rpm,
      pose.throttle,
      audioShifting,
      activeVehicleKind === 'motorcycle' ? 10000 : 8500,
    );
    const drivenWheelIndices = activeVehicleKind === 'motorcycle' ? [1] : [2, 3];
    const rearSlip = Math.max(...drivenWheelIndices.map(index => (
      pose.wheelGrounded[index]
        ? Math.max(
          Math.abs(pose.wheelLateralSlipRadians[index]),
          Math.abs(pose.wheelLongitudinalSlips[index]),
        )
        : 0
    )));
    engineSynth?.updateTireSkid(
      rearSlip,
      pose.speedKmh / 3.6,
      !audioShifting,
    );

    forward.set(0, 0, 1).applyQuaternion(pose.rotation).setY(0).normalize();
    const selectedParkingBay = resolveApexParkingBayPosition(
      parkingSelectedIndex,
    );
    const trackSunFocus = parkingSelectionActive
      ? parkingTarget.set(
        selectedParkingBay.x,
        0,
        selectedParkingBay.z,
      )
      : isExplorationCameraMode() ? camera.position : pose.position;
    trackSunLight.position.copy(trackSunFocus).add(trackSunOffset);
    trackSunLight.target.position.copy(trackSunFocus);
    trackSunLight.target.updateMatrixWorld();
    canvas.dataset.vehiclePosition = `${pose.position.x.toFixed(3)},${pose.position.y.toFixed(3)},${pose.position.z.toFixed(3)}`;
    canvas.dataset.vehicleHeading = Math.atan2(forward.x, forward.z).toFixed(4);
    canvas.dataset.vehicleSpeedKmh = pose.speedKmh.toFixed(3);
    sportHud.update(
      pose.rpm,
      pose.speedKmh,
      pose.gear < 0 ? 'R' : pose.gear === 0 ? 'N' : String(pose.gear),
      pose.throttle,
      pose.brake,
    );
    const lapTimingState = lapTimer.update(
      { x: pose.position.x, z: pose.position.z },
      pose.speedKmh,
      simulationNow,
    );
    const previousAutonomousTimingPhase = autonomousTimingPhase;
    autonomousTimingPhase = lapTimingState.phase;
    if (
      autonomousRaceStartPending
      && autonomousTimingPhase === 'running'
    ) {
      autonomousRaceStartPending = false;
      canvas.dataset.autonomousRaceStart = 'running';
    }
    const enteredOfficialLap = (
      previousAutonomousTimingPhase !== 'running'
      && lapTimingState.phase === 'running'
    );
    const officialLapAbandoned = (
      previousAutonomousTimingPhase === 'running'
      && lapTimingState.phase === 'abandoned'
    );
    const officialLapCompleted = (
      lapTimingState.completedLapCount > observedCompletedLapCount
    );
    let freeLapCompleted = false;
    if (officialLapAbandoned && autonomousLapActive) {
      autonomousDriver.cancelLap();
      autonomousLapActive = false;
    }
    if (enteredOfficialLap) {
      resetAutonomousFreeLap(simulationNow);
      lapGhost.beginLap();
      if (autonomousDriveEnabled) {
        autonomousDriver.cancelLap();
        autonomousDriver.beginLap();
        resetAutonomousSegmentSnapshots();
        autonomousLapActive = true;
      }
    }
    if (
      autonomousDriveEnabled
      && lapTimingState.phase === 'running'
      && !autonomousLapActive
    ) {
      autonomousDriver.beginLap();
      resetAutonomousSegmentSnapshots();
      autonomousLapActive = true;
    }
    if (
      autonomousDriveEnabled
      && autonomousLapActive
      && officialLapCompleted
    ) {
      autonomousDriver.completeLap(lapTimingState.lastLapMs);
      autonomousDriver.beginLap();
      resetAutonomousSegmentSnapshots();
      autonomousLapActive = true;
    }
    if (lapTimingState.phase === 'running') {
      manualGhostLapActive = false;
      autonomousLearningLapSource = 'race';
      autonomousLearningLapElapsedMs = lapTimingState.elapsedMs;
      if (officialLapCompleted) {
        lapGhost.record(
          pose,
          lapTimingState.lastLapMs ?? lapTimingState.elapsedMs,
        );
        lapGhost.completeLap();
      } else {
        lapGhost.record(pose, lapTimingState.elapsedMs);
      }
      lapGhost.update(lapTimingState.elapsedMs);
    } else if (
      autonomousDriveEnabled
      && lapTimingState.phase === 'arming'
      && !parkingSelectionActive
    ) {
      autonomousLearningLapSource = 'free';
      if (!autonomousLapActive) {
        autonomousDriver.beginLap();
        resetAutonomousSegmentSnapshots();
        autonomousLapActive = true;
        resetAutonomousFreeLap(simulationNow);
        lapGhost.beginLap();
      }
      const aiProgress = autonomousDriver.lastTelemetry.trackProgress;
      const previousProgress = autonomousFreeLapPreviousProgress;
      autonomousLearningLapElapsedMs = (
        simulationNow - autonomousFreeLapStartedAt
      );
      lapGhost.record(pose, autonomousLearningLapElapsedMs);
      if (previousProgress !== undefined) {
        let progressDelta = aiProgress - previousProgress;
        if (progressDelta < -0.5) progressDelta += 1;
        else if (progressDelta > 0.5) progressDelta -= 1;
        if (progressDelta > 0 && progressDelta < 0.12) {
          autonomousFreeLapTravel += progressDelta;
        }
        const crossedStartForward = (
          previousProgress > 0.78
          && aiProgress < 0.22
          && progressDelta > 0
        );
        if (
          crossedStartForward
          && autonomousFreeLapTravel >= 0.72
          && autonomousDriver.lastTelemetry.lapCoverage >= 0.62
          && autonomousLearningLapElapsedMs >= 15_000
        ) {
          autonomousDriver.completeLap(autonomousLearningLapElapsedMs);
          autonomousDriver.beginLap();
          resetAutonomousSegmentSnapshots();
          lapGhost.completeLap();
          resetAutonomousFreeLap(simulationNow);
          autonomousLapActive = true;
          freeLapCompleted = true;
        }
      }
      autonomousFreeLapPreviousProgress = aiProgress;
      lapGhost.update(autonomousLearningLapElapsedMs);
    } else if (
      lapTimingState.phase === 'arming'
      && !parkingSelectionActive
    ) {
      if (!manualGhostLapActive) {
        manualGhostLapActive = true;
        resetManualGhostLap(simulationNow);
        lapGhost.beginLap();
      }
      const elapsedMs = simulationNow - manualGhostLapStartedAt;
      lapGhost.record(pose, elapsedMs);
      if (
        simulationNow - manualGhostLastProgressSampleAt
        >= manualGhostProgressSampleIntervalMs
      ) {
        manualGhostLastProgressSampleAt = simulationNow;
        const progress = nearestTrackProgressAt(pose.position);
        const previousProgress = manualGhostPreviousProgress;
        if (previousProgress !== undefined) {
          let progressDelta = progress - previousProgress;
          if (progressDelta < -0.5) progressDelta += 1;
          else if (progressDelta > 0.5) progressDelta -= 1;
          if (progressDelta > 0 && progressDelta < 0.12) {
            manualGhostTravel += progressDelta;
          }
          const crossedStartForward = (
            previousProgress > 0.78
            && progress < 0.22
            && progressDelta > 0
          );
          if (
            crossedStartForward
            && manualGhostTravel >= 0.72
            && elapsedMs >= 10_000
          ) {
            lapGhost.completeLap();
            resetManualGhostLap(simulationNow);
          }
        }
        manualGhostPreviousProgress = progress;
      }
      lapGhost.update(simulationNow - manualGhostLapStartedAt);
    } else {
      manualGhostLapActive = false;
      lapGhost.object.visible = false;
    }
    if (
      !isAuditRuntime
      && officialLapCompleted
    ) {
      observedCompletedLapCount = lapTimingState.completedLapCount;
      if (racingLineLapActive) {
        const learned = racingLineLearner.completeLap();
        racingLineLapActive = false;
        if (learned) {
          activeRacingLinePoints = racingLineLearner.points();
          refreshRacingLineStatus();
          autonomousDriver.setLine(activeRacingLinePoints);
        } else {
          racingLineStatus.textContent = 'Trazada no actualizada · vuelta incompleta';
        }
      }
    }
    if (!isAuditRuntime && freeLapCompleted && racingLineLapActive) {
      const learned = racingLineLearner.completeLap();
      racingLineLapActive = false;
      if (learned) {
        activeRacingLinePoints = racingLineLearner.points();
        refreshRacingLineStatus();
        autonomousDriver.setLine(activeRacingLinePoints);
      }
    }
    const shouldRecordRacingLine = (
      !isAuditRuntime
      && (
        lapTimingState.phase === 'running'
        || (
          autonomousDriveEnabled
          && lapTimingState.phase === 'arming'
          && !parkingSelectionActive
        )
      )
    );
    const maximumPoseLateralSlip = Math.max(
      0,
      ...pose.wheelLateralSlipRadians.map(value => Math.abs(value)),
    );
    const maximumPoseLongitudinalSlip = Math.max(
      0,
      ...pose.wheelLongitudinalSlips.map(value => Math.abs(value)),
    );
    const cleanRacingLineSample = (
      pose.wheelSurfaces.every(
        surface => surface !== 'grass' && surface !== 'gravel',
      )
      && pose.wheelGrounded.filter(Boolean).length >= 3
      && maximumPoseLateralSlip < THREE.MathUtils.degToRad(11)
      && maximumPoseLongitudinalSlip < 0.34
      && (
        !autonomousDriveEnabled
        || (
          autonomousDriver.lastTelemetry.incident === undefined
          && Math.abs(autonomousDriver.lastTelemetry.crossTrackErrorM)
            < TEST_TRACK_WIDTH_M * 0.5 - 0.85
        )
      )
    );
    const shouldLearnDriverRacingLine = (
      !autonomousDriveEnabled
      || manualCorrectionActive
    );
    if (
      shouldRecordRacingLine
      && cleanRacingLineSample
      && shouldLearnDriverRacingLine
    ) {
      if (!racingLineLapActive) racingLineLearner.beginLap();
      racingLineLearner.record(pose.position);
      racingLineLapActive = true;
    } else if (!shouldRecordRacingLine) {
      racingLineLapActive = false;
    }
    const segmentTiming = segmentTimer.update(
      autonomousDriver.lastTelemetry.trackProgress,
      simulationNow,
      autonomousDriveEnabled && !parkingSelectionActive,
    );
    canvas.dataset.rallySegment = String(
      segmentTiming.activeSegmentIndex + 1,
    );
    canvas.dataset.rallySegmentElapsedMs = (
      segmentTiming.activeElapsedMs.toFixed(1)
    );
    canvas.dataset.rallyLastSegmentDeltaMs = (
      segmentTiming.lastDeltaToBestMs?.toFixed(1) ?? 'none'
    );
    autonomousPanelRoot.hidden = (
      !autonomousPanelVisible
      || isAuditRuntime
      || parkingSelectionActive
      || Boolean(trackEditor)
    );
    if (!autonomousPanelRoot.hidden) {
      autonomousPanel.update({
        enabled: autonomousDriveEnabled,
        manualCorrection: manualCorrectionActive,
        manualOverrideChannels: overrideChannels,
        telemetry: autonomousDriver.lastTelemetry,
        segmentTiming,
        pose,
        trackCenterLine: autonomousCenterLine,
        line: activeRacingLinePoints,
        trackWidthM: TEST_TRACK_WIDTH_M,
        learningLapNumber:
          autonomousDriver.lastTelemetry.completedLearningLaps + 1,
        lapElapsedMs: autonomousLearningLapElapsedMs,
        lapSource: autonomousLearningLapSource,
        ghostReady: lapGhost.hasPreviousLap,
      });
    }
    lapTimingHud.update(lapTimingState);
    physicalStartLightMaterials.forEach((material, index) => {
      const red = lapTimingState.startLights === 'red'
        && index < lapTimingState.countdownLights;
      const green = lapTimingState.startLights === 'green';
      material.color.set(red ? 0xff263f : green ? 0x2cf16b : 0x151b1d);
      material.emissive.set(red ? 0xff1028 : green ? 0x0bd94e : 0x000000);
      material.emissiveIntensity = red || green ? 3.2 : 0;
    });
    canvas.dataset.lapTimingPhase = lapTimingState.phase;
    canvas.dataset.lapTimingElapsedMs = lapTimingState.elapsedMs.toFixed(0);
    canvas.dataset.lapTimingLap = String(lapTimingState.lapNumber);
    canvas.dataset.lapTimingCheckpoint = `${lapTimingState.checkpointIndex}/${lapTimingState.checkpointCount}`;
    canvas.dataset.liftOffFrontAeroBlend = pose.liftOffFrontAeroBlend.toFixed(4);
    canvas.dataset.liftOffFrontDownforceN = pose.liftOffFrontDownforceN.toFixed(2);
    canvas.dataset.wheelContactErrorsMm = pose.wheelContactErrorsM
      .map(errorM => Number.isFinite(errorM) ? (errorM * 1000).toFixed(2) : 'air')
      .join(',');
    canvas.dataset.wheelSurfaces = pose.wheelSurfaces.join(',');
    vehicleAnchor.copy(pose.position).addScaledVector(worldUp, 0.46);
    if (observedCameraChangeSerial !== cameraChangeSerial) {
      closeCameraReady = false;
      panCameraReady = false;
      chaseCameraReady = false;
      rallyCameraReady = false;
      observedCameraChangeSerial = cameraChangeSerial;
    }
    if (trackEditor) {
      trackEditor.update(delta);
      trackSegmentDrawTool?.update();
      canvas.dataset.cameraDistanceM = 'track-editor-orbit';
    } else if (parkingSelectionActive) {
      const keyboardOrbit = (
        (parkingOrbitKeys.has('KeyD') ? 1 : 0)
        - (parkingOrbitKeys.has('KeyA') ? 1 : 0)
      );
      parkingOrbitTargetRadians += (
        keyboardOrbit + parkingGamepadOrbit
      ) * delta * THREE.MathUtils.degToRad(34);
      parkingOrbitRadians = THREE.MathUtils.lerp(
        parkingOrbitRadians,
        parkingOrbitTargetRadians,
        1 - Math.exp(-delta * 5.2),
      );
      const keyboardDistance = (
        (parkingDistanceKeys.has('KeyS') ? 1 : 0)
        - (parkingDistanceKeys.has('KeyW') ? 1 : 0)
      );
      parkingDistanceTargetM = THREE.MathUtils.clamp(
        parkingDistanceTargetM + keyboardDistance * delta * 3.8,
        parkingMinimumDistanceM,
        parkingMaximumDistanceM,
      );
      parkingDistanceM = THREE.MathUtils.lerp(
        parkingDistanceM,
        parkingDistanceTargetM,
        1 - Math.exp(-delta * 5.2),
      );
      const selectedBay = resolveApexParkingBayPosition(parkingSelectedIndex);
      parkingCamera.set(
        selectedBay.x + Math.sin(parkingOrbitRadians) * parkingDistanceM,
        2.3,
        selectedBay.z
          + Math.cos(parkingOrbitRadians) * parkingDistanceM,
      );
      parkingTarget.set(
        selectedBay.x,
        0.72,
        selectedBay.z,
      );
      if (!parkingCameraReady) {
        camera.position.copy(parkingCamera);
        parkingFocus.copy(parkingTarget);
        parkingCameraReady = true;
      } else {
        camera.position.lerp(
          parkingCamera,
          1 - Math.exp(-delta * 4.6),
        );
        parkingFocus.lerp(
          parkingTarget,
          1 - Math.exp(-delta * 6.4),
        );
      }
      camera.lookAt(parkingFocus);
      updateParkingSelectionAvailability();
      canvas.dataset.cameraDistanceM = parkingDistanceM.toFixed(3);
    } else if (parkingDriveTransitionActive) {
      parkingDriveTransitionElapsedS += delta;
      const transitionProgress = THREE.MathUtils.clamp(
        parkingDriveTransitionElapsedS / parkingDriveTransitionDurationS,
        0,
        1,
      );
      const easedProgress = (
        transitionProgress ** 3
        * (
          transitionProgress
          * (transitionProgress * 6 - 15)
          + 10
        )
      );
      chaseHeading.copy(forward);
      closeCamera.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, -4.25)
        .addScaledVector(worldUp, 0.32);
      closeTarget.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, 8)
        .addScaledVector(worldUp, 0.05);
      camera.position.lerpVectors(
        parkingDriveTransitionCameraStart,
        closeCamera,
        easedProgress,
      );
      parkingFocus.lerpVectors(
        parkingDriveTransitionFocusStart,
        closeTarget,
        easedProgress,
      );
      camera.lookAt(parkingFocus);
      canvas.dataset.cameraDistanceM = `transition-${transitionProgress.toFixed(3)}`;
      if (transitionProgress >= 1) {
        parkingDriveTransitionActive = false;
        closeCameraReady = true;
        visualControlsRoot.hidden = false;
        sportHudContainer.hidden = false;
        lapTimerRoot.hidden = !lapTimingHudVisible;
        telemetryContainer.hidden = uiMode === 'off';
        canvas.dataset.experienceMode = 'parking-drive';
        canvas.dataset.parkingTransition = 'complete';
      }
    } else if (cameraMode === 'free') {
      updateExplorationCamera(delta, false);
    } else if (cameraMode === 'fps') {
      updateExplorationCamera(delta, true);
    } else if (cameraMode === 'wheel') {
      const frontWheelPosition = pose.wheelPositions[0];
      const outsideDirection = Math.sign(frontWheelPosition?.x ?? 1) || 1;
      vehicleRoot.updateMatrixWorld(true);
      wheelCameraLocal.copy(frontWheelPosition)
        .add(wheelCameraOffset.set(
          outsideDirection * 0.92,
          activeWheelDimensions.wheelRadiusM * 0.28,
          -0.18,
        ));
      wheelCameraTargetLocal.copy(frontWheelPosition)
        .add(wheelCameraTargetOffset.set(
          0,
          -activeWheelDimensions.wheelRadiusM * 0.24,
          0,
        ));
      wheelCameraWorld.copy(wheelCameraLocal).applyMatrix4(vehicleRoot.matrixWorld);
      wheelCameraTargetWorld.copy(wheelCameraTargetLocal).applyMatrix4(
        vehicleRoot.matrixWorld,
      );
      camera.position.lerp(
        wheelCameraWorld,
        1 - Math.exp(-delta * 24),
      );
      camera.lookAt(wheelCameraTargetWorld);
      canvas.dataset.cameraDistanceM = 'front-wheel-0.92';
    } else if (cameraMode === 'interior') {
      vehicleRoot.updateMatrixWorld(true);
      interiorCamera.set(0.36, 0.42, 0.12).applyMatrix4(vehicleRoot.matrixWorld);
      interiorTarget.set(0.36, 0.28, 12).applyMatrix4(vehicleRoot.matrixWorld);
      camera.position.copy(interiorCamera);
      camera.lookAt(interiorTarget);
      canvas.dataset.cameraDistanceM = 'cockpit';
    } else if (cameraMode === 'close') {
      if (!closeCameraReady) chaseHeading.copy(forward);
      else chaseHeading.lerp(forward, 1 - Math.exp(-delta * 12)).normalize();
      closeCamera.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, -4.25)
        .addScaledVector(worldUp, 0.32);
      closeTarget.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, 8)
        .addScaledVector(worldUp, 0.05);
      if (!closeCameraReady) {
        camera.position.copy(closeCamera);
        closeCameraReady = true;
      }
      closeDelta.subVectors(closeCamera, camera.position);
      camera.position.addScaledVector(closeDelta, 1 - Math.exp(-delta * 28));
      camera.lookAt(closeTarget);
      canvas.dataset.cameraDistanceM = '4.25';
    } else if (cameraMode === 'pan') {
      panCamera.copy(vehicleAnchor).add(new THREE.Vector3(9.5, 7.2, -11.5));
      panTarget.copy(vehicleAnchor);
      if (!panCameraReady) {
        camera.position.copy(panCamera);
        panVelocity.set(0, 0, 0);
        panCameraReady = true;
      }
      panDelta.subVectors(panCamera, camera.position);
      panVelocity.addScaledVector(panDelta, 16 * delta).multiplyScalar(Math.exp(-8 * delta));
      camera.position.addScaledVector(panVelocity, delta);
      camera.lookAt(panTarget);
      canvas.dataset.cameraDistanceM = '16.6';
    } else if (cameraMode === 'rally') {
      if (!rallyCameraReady) chaseHeading.copy(forward);
      else chaseHeading.lerp(forward, 1 - Math.exp(-delta * 5.5)).normalize();
      rallySide.set(-chaseHeading.z, 0, chaseHeading.x);
      rallyCamera.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, -7.8)
        .addScaledVector(worldUp, 5.8);
      rallyTarget.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, 5.8)
        .addScaledVector(worldUp, 0.15);
      if (!rallyCameraReady) {
        camera.position.copy(rallyCamera);
        rallyVelocity.set(0, 0, 0);
        rallyCameraReady = true;
      }
      rallyDelta.subVectors(rallyCamera, camera.position);
      rallyVelocity.addScaledVector(rallyDelta, 18 * delta)
        .multiplyScalar(Math.exp(-8.5 * delta));
      camera.position.addScaledVector(rallyVelocity, delta);
      camera.lookAt(rallyTarget);
      canvas.dataset.cameraDistanceM = '9.7';
    } else {
      if (!chaseCameraReady) chaseHeading.copy(forward);
      else chaseHeading.lerp(forward, 1 - Math.exp(-delta * 7)).normalize();
      desiredCamera.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, -4.6)
        .addScaledVector(worldUp, 1.3);
      desiredTarget.copy(vehicleAnchor)
        .addScaledVector(chaseHeading, 1.8)
        .addScaledVector(worldUp, 0.18);
      if (!chaseCameraReady) {
        camera.position.copy(desiredCamera);
        cameraVelocity.set(0, 0, 0);
        chaseCameraReady = true;
      }
      cameraDelta.subVectors(desiredCamera, camera.position);
      cameraVelocity.addScaledVector(cameraDelta, 28 * delta)
        .multiplyScalar(Math.exp(-10.6 * delta));
      camera.position.addScaledVector(cameraVelocity, delta);
      cameraDelta.subVectors(camera.position, desiredCamera);
      if (cameraDelta.length() > 2) {
        camera.position.copy(desiredCamera)
          .addScaledVector(cameraDelta.normalize(), 2);
      }
      camera.lookAt(desiredTarget);
      canvas.dataset.cameraDistanceM = '4.8';
    }
    steeringWheelSpin.rotation.z = -pose.steering * THREE.MathUtils.degToRad(155);
    canvas.dataset.cameraPreset = trackEditor
      ? 'apex-track-editor-maya'
      : isExplorationCameraMode()
        ? `apex-${cameraMode}`
        : `v2-${cameraMode}`;
    canvas.dataset.cameraFovDeg = camera.fov.toFixed(0);
    canvas.dataset.centerOfMassPosition = [
      pose.position.x,
      pose.position.y,
      pose.position.z,
    ].map(value => value.toFixed(3)).join(',');
    const trackLodSnapshot = trackLodRuntime?.update(camera);
    if (now - lastTrackLodMetricsUpdateMs >= 500) {
      lastTrackLodMetricsUpdateMs = now;
      if (trackLodSnapshot) {
        canvas.dataset.trackLodVisibleChunks = String(
          trackLodSnapshot.visibleChunkCount,
        );
        canvas.dataset.trackLodActiveMeshes = String(
          trackLodSnapshot.activeMeshCount,
        );
        canvas.dataset.trackLodActiveTriangles = String(
          Math.round(trackLodSnapshot.activeTriangleCount),
        );
        canvas.dataset.trackLodChunksByLevel = (
          trackLodSnapshot.chunksByLevel.join(',')
        );
        const fullResolutionTriangles = Number(
          canvas.dataset.trackLodFullResolutionTriangles ?? 0,
        );
        canvas.dataset.trackLodTriangleReductionPercent = (
          fullResolutionTriangles > 0
            ? 100 * (
              1 - trackLodSnapshot.activeTriangleCount
              / fullResolutionTriangles
            )
            : 0
        ).toFixed(1);
      } else {
        canvas.dataset.trackLodVisibleChunks = 'all';
        canvas.dataset.trackLodActiveMeshes = importedTrackCollisionOnly
          ? '0'
          : '4';
        canvas.dataset.trackLodActiveTriangles = importedTrackCollisionOnly
          ? '0'
          : canvas.dataset.trackLodFullResolutionTriangles ?? '0';
        canvas.dataset.trackLodChunksByLevel = 'baseline';
        canvas.dataset.trackLodTriangleReductionPercent = '0.0';
      }
      updateTrackCollisionMetrics();
    }
    const renderPerformanceStartedAt = performance.now();
    await renderer.renderAsync(scene, camera);
    const startupEnvironmentStatus = (
      canvas.dataset.environmentStatus ?? 'loading'
    );
    const startupEnvironmentReady = (
      startupEnvironmentStatus !== 'loading'
      && !startupEnvironmentStatus.endsWith('-loading')
    );
    const startupVehicleReady = parkingSelectionActive
      ? ['ready', 'canonical-fallback', 'covered-error'].includes(
        canvas.dataset.parkingLazyState ?? '',
      )
      : canvas.dataset.vehicleModel !== 'loading';
    if (startupEnvironmentReady && startupVehicleReady) {
      revealApexDrive();
    }
    const frameCompletedAt = performance.now();
    const renderPerformanceMs = frameCompletedAt - renderPerformanceStartedAt;
    const frameWorkMs = frameCompletedAt - framePerformanceStartedAt;
    updateFramePerformanceMeter(frameCompletedAt, {
      intervalMs: frameIntervalMs,
      frameMs: frameWorkMs,
      physicsMs: physicsPerformanceMs,
      tireMs: tirePerformanceMs,
      renderMs: renderPerformanceMs,
    });
    const rendererInfo = (renderer as unknown as {
      info?: {
        render?: {
          drawCalls?: number;
          triangles?: number;
        };
      };
    }).info;
    drivePerformanceMonitor.sample({
      timestampMs: frameCompletedAt,
      intervalMs: frameIntervalMs,
      frameWorkMs,
      physicsMs: physicsPerformanceMs,
      tireMs: tirePerformanceMs,
      renderMs: renderPerformanceMs,
      physicsSteps: physicsStepsThisFrame,
      accumulatorMs: accumulator * 1000,
      renderCalls: rendererInfo?.render?.drawCalls,
      triangles: rendererInfo?.render?.triangles,
    });
    updateControlledBenchmark(frameCompletedAt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  revealApexDrive();
  runtimeStatus = `No se pudo iniciar ApexPhysics: ${error instanceof Error ? error.message : String(error)}`;
  reportStatus(runtimeStatus);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
