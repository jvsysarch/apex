import { apexDrivePublicUrl } from '../runtime/ApexDrivePublicUrl';

export interface ApexEnvironmentAsset {
  readonly id: string;
  readonly name: string;
  readonly uri: string;
  readonly attribution: string;
}

export interface ApexEnvironmentSettings {
  readonly environmentId: string;
  readonly exposure: number;
  readonly hdriIntensity: number;
  readonly skyIntensity: number;
  readonly skyBlur: number;
  readonly rotationDegrees: number;
  readonly sunIntensity: number;
  readonly sunColor: string;
  readonly sunAltitudeDegrees: number;
  readonly sunAzimuthDegrees: number;
  readonly softShadows: boolean;
  readonly fogEnabled: boolean;
  readonly fogColor: string;
  readonly fogNearM: number;
  readonly fogFarM: number;
}

export interface ApexEnvironmentProfile {
  readonly id: string;
  readonly name: string;
  readonly builtIn: boolean;
  readonly settings: ApexEnvironmentSettings;
}

interface StoredEnvironmentProfiles {
  readonly format: 'apex-drive-environment-profiles';
  readonly formatVersion: 1;
  readonly selectedProfileId?: string;
  readonly profiles: readonly {
    readonly id: string;
    readonly name: string;
    readonly settings: ApexEnvironmentSettings;
  }[];
}

const STORAGE_KEY = 'apex-run.v3.environment-rendering-profiles.v1';
const STORAGE_FORMAT = 'apex-drive-environment-profiles';
const STORAGE_FORMAT_VERSION = 1;

export const APEX_ENVIRONMENT_ASSETS: readonly ApexEnvironmentAsset[] = Object.freeze([
  Object.freeze({
    id: 'day-environment-108',
    name: 'APEX Golf Club',
    uri: apexDrivePublicUrl(
      'assets/environments/ambientcg/DayEnvironmentHDRI108_1K_HDR.exr',
    ),
    attribution: 'ambientCG · CC0',
  }),
  Object.freeze({
    id: 'day-sky-065a',
    name: 'MS Win95',
    uri: apexDrivePublicUrl(
      'assets/environments/ambientcg/DaySkyHDRI065A_1K_HDR.exr',
    ),
    attribution: 'ambientCG · CC0',
  }),
  Object.freeze({
    id: 'day-environment-040',
    name: 'Bosque húmedo',
    uri: apexDrivePublicUrl(
      'assets/environments/ambientcg/DayEnvironmentHDRI040_1K_HDR.exr',
    ),
    attribution: 'ambientCG · CC0',
  }),
  Object.freeze({
    id: 'day-environment-077',
    name: 'Ruta de montaña',
    uri: apexDrivePublicUrl(
      'assets/environments/ambientcg/DayEnvironmentHDRI077_1K_HDR.exr',
    ),
    attribution: 'ambientCG · CC0',
  }),
  Object.freeze({
    id: 'polyhaven-quarry-02',
    name: 'Quebrada Andina',
    uri: apexDrivePublicUrl(
      'assets/environments/polyhaven/quarry_02_1k.hdr',
    ),
    attribution: 'Poly Haven · CC0',
  }),
  Object.freeze({
    id: 'polyhaven-versveldpas',
    name: 'Sierras de Altura',
    uri: apexDrivePublicUrl(
      'assets/environments/polyhaven/versveldpas_1k.hdr',
    ),
    attribution: 'Poly Haven · CC0',
  }),
  Object.freeze({
    id: 'polyhaven-ostrich-road',
    name: 'Estepa Cordillerana',
    uri: apexDrivePublicUrl(
      'assets/environments/polyhaven/ostrich_road_1k.hdr',
    ),
    attribution: 'Poly Haven · CC0',
  }),
]);

const createBuiltInProfile = (
  id: string,
  name: string,
  settings: ApexEnvironmentSettings,
): ApexEnvironmentProfile => Object.freeze({
  id,
  name,
  builtIn: true,
  settings: Object.freeze(settings),
});

export const DEFAULT_ENVIRONMENT_PROFILES: readonly ApexEnvironmentProfile[] = (
  Object.freeze([
    createBuiltInProfile('apex-golf-club', 'APEX Golf Club', {
      environmentId: 'day-environment-108',
      exposure: 0.9,
      hdriIntensity: 1.1,
      skyIntensity: 0.9,
      skyBlur: 0,
      rotationDegrees: 89,
      sunIntensity: 5,
      sunColor: '#ffc561',
      sunAltitudeDegrees: 55,
      sunAzimuthDegrees: 180,
      softShadows: true,
      fogEnabled: false,
      fogColor: '#c8d2d0',
      fogNearM: 700,
      fogFarM: 2200,
    }),
    createBuiltInProfile('apex-hit-the-road', 'MS Win95', {
      environmentId: 'day-sky-065a',
      exposure: 0.71,
      hdriIntensity: 0.95,
      skyIntensity: 0.95,
      skyBlur: 0,
      rotationDegrees: 37,
      sunIntensity: 5,
      sunColor: '#ebedc4',
      sunAltitudeDegrees: 43,
      sunAzimuthDegrees: 150,
      softShadows: true,
      fogEnabled: false,
      fogColor: '#c9d1d0',
      fogNearM: 700,
      fogFarM: 2200,
    }),
    createBuiltInProfile('apex-bosque-humedo', 'Bosque húmedo', {
      environmentId: 'day-environment-040',
      exposure: 0.82,
      hdriIntensity: 1.15,
      skyIntensity: 0.86,
      skyBlur: 0.08,
      rotationDegrees: 18,
      sunIntensity: 1.8,
      sunColor: '#d9e5df',
      sunAltitudeDegrees: 32,
      sunAzimuthDegrees: 132,
      softShadows: true,
      fogEnabled: true,
      fogColor: '#aebcb7',
      fogNearM: 420,
      fogFarM: 1450,
    }),
    createBuiltInProfile('apex-ruta-montana', 'Ruta de montaña', {
      environmentId: 'day-environment-077',
      exposure: 0.92,
      hdriIntensity: 1.12,
      skyIntensity: 0.98,
      skyBlur: 0.01,
      rotationDegrees: -48,
      sunIntensity: 4.6,
      sunColor: '#fff0cb',
      sunAltitudeDegrees: 49,
      sunAzimuthDegrees: 158,
      softShadows: true,
      fogEnabled: true,
      fogColor: '#bdcbd1',
      fogNearM: 900,
      fogFarM: 3100,
    }),
    createBuiltInProfile('apex-quebrada-andina', 'Quebrada Andina', {
      environmentId: 'polyhaven-quarry-02',
      exposure: 0.93,
      hdriIntensity: 1.08,
      skyIntensity: 0.98,
      skyBlur: 0.04,
      rotationDegrees: 26,
      sunIntensity: 4.6,
      sunColor: '#ffe0b3',
      sunAltitudeDegrees: 42,
      sunAzimuthDegrees: 138,
      softShadows: true,
      fogEnabled: true,
      fogColor: '#cbbda7',
      fogNearM: 650,
      fogFarM: 2000,
    }),
    createBuiltInProfile('apex-sierras-de-altura', 'Sierras de Altura', {
      environmentId: 'polyhaven-versveldpas',
      exposure: 0.86,
      hdriIntensity: 1.02,
      skyIntensity: 0.94,
      skyBlur: 0.02,
      rotationDegrees: -22,
      sunIntensity: 4.2,
      sunColor: '#fff1ce',
      sunAltitudeDegrees: 51,
      sunAzimuthDegrees: 164,
      softShadows: true,
      fogEnabled: true,
      fogColor: '#b8c6c8',
      fogNearM: 520,
      fogFarM: 1800,
    }),
    createBuiltInProfile('apex-estepa-cordillerana', 'Estepa Cordillerana', {
      environmentId: 'polyhaven-ostrich-road',
      exposure: 0.88,
      hdriIntensity: 1.04,
      skyIntensity: 0.96,
      skyBlur: 0.03,
      rotationDegrees: 64,
      sunIntensity: 4.4,
      sunColor: '#ffe7c1',
      sunAltitudeDegrees: 38,
      sunAzimuthDegrees: 205,
      softShadows: true,
      fogEnabled: true,
      fogColor: '#c4c8c2',
      fogNearM: 760,
      fogFarM: 2300,
    }),
  ])
);

const finiteInRange = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => (
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback
);

const sanitizeSettings = (value: unknown): ApexEnvironmentSettings | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const settings = value as Partial<ApexEnvironmentSettings>;
  const environmentId = APEX_ENVIRONMENT_ASSETS.some(
    environment => environment.id === settings.environmentId,
  ) ? settings.environmentId! : undefined;
  if (!environmentId) return undefined;
  const color = typeof settings.sunColor === 'string'
    && /^#[0-9a-f]{6}$/i.test(settings.sunColor)
    ? settings.sunColor
    : '#ffffff';
  const fogColor = typeof settings.fogColor === 'string'
    && /^#[0-9a-f]{6}$/i.test(settings.fogColor)
    ? settings.fogColor
    : '#c8d2d0';
  const fogNearM = finiteInRange(settings.fogNearM, 700, 0, 10_000);
  const fogFarM = Math.max(
    fogNearM + 1,
    finiteInRange(settings.fogFarM, 2200, 1, 20_000),
  );
  return Object.freeze({
    environmentId,
    exposure: finiteInRange(settings.exposure, 1, 0.2, 2.5),
    hdriIntensity: finiteInRange(settings.hdriIntensity, 1, 0, 3),
    skyIntensity: finiteInRange(settings.skyIntensity, 1, 0, 2),
    skyBlur: finiteInRange(settings.skyBlur, 0, 0, 1),
    rotationDegrees: finiteInRange(settings.rotationDegrees, 0, -180, 180),
    sunIntensity: finiteInRange(settings.sunIntensity, 1, 0, 5),
    sunColor: color,
    sunAltitudeDegrees: finiteInRange(settings.sunAltitudeDegrees, 45, 0, 90),
    sunAzimuthDegrees: finiteInRange(settings.sunAzimuthDegrees, 0, -180, 180),
    softShadows: settings.softShadows !== false,
    fogEnabled: settings.fogEnabled === true,
    fogColor,
    fogNearM,
    fogFarM,
  });
};

export const readApexEnvironmentSettings = (
  storageKey: string,
): ApexEnvironmentSettings | undefined => {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(storageKey) ?? 'null'));
  } catch {
    return undefined;
  }
};

export const writeApexEnvironmentSettings = (
  storageKey: string,
  settings: ApexEnvironmentSettings,
): void => {
  const sanitized = sanitizeSettings(settings);
  if (!sanitized) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitized));
  } catch {
    // Rendering remains usable when storage is unavailable.
  }
};

const readStoredProfiles = (): {
  selectedProfileId?: string;
  profiles: ApexEnvironmentProfile[];
} => {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<StoredEnvironmentProfiles> | null;
    if (
      stored?.format !== STORAGE_FORMAT
      || stored.formatVersion !== STORAGE_FORMAT_VERSION
      || !Array.isArray(stored.profiles)
    ) {
      return { profiles: [] };
    }
    const profiles = stored.profiles.flatMap((profile, index) => {
      const settings = sanitizeSettings(profile.settings);
      const name = typeof profile.name === 'string' ? profile.name.trim() : '';
      if (!settings || name.length === 0) return [];
      return [Object.freeze({
        id: typeof profile.id === 'string' && profile.id.length > 0
          ? profile.id
          : `custom-${index + 1}`,
        name,
        builtIn: false,
        settings,
      })];
    });
    return {
      selectedProfileId: typeof stored.selectedProfileId === 'string'
        ? stored.selectedProfileId
        : undefined,
      profiles,
    };
  } catch {
    return { profiles: [] };
  }
};

const copySettings = (
  settings: ApexEnvironmentSettings,
): ApexEnvironmentSettings => Object.freeze({ ...settings });

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

export class ApexEnvironmentProfilePanel {
  private customProfiles: ApexEnvironmentProfile[];
  private selectedProfileId: string;
  private readonly profileSelect: HTMLSelectElement;
  private readonly profileNameInput: HTMLInputElement;
  private readonly environmentSelect: HTMLSelectElement;
  private readonly status: HTMLOutputElement;
  private readonly deleteButton: HTMLButtonElement;
  private readonly outputs: Record<string, HTMLOutputElement>;
  private readonly inputs: {
    readonly exposure: HTMLInputElement;
    readonly hdriIntensity: HTMLInputElement;
    readonly skyIntensity: HTMLInputElement;
    readonly skyBlur: HTMLInputElement;
    readonly rotationDegrees: HTMLInputElement;
    readonly sunIntensity: HTMLInputElement;
    readonly sunColor: HTMLInputElement;
    readonly sunAltitudeDegrees: HTMLInputElement;
    readonly sunAzimuthDegrees: HTMLInputElement;
    readonly softShadows: HTMLInputElement;
    readonly fogEnabled: HTMLInputElement;
    readonly fogColor: HTMLInputElement;
    readonly fogNearM: HTMLInputElement;
    readonly fogFarM: HTMLInputElement;
  };

  constructor(
    root: HTMLElement,
    private readonly apply: (settings: ApexEnvironmentSettings) => void,
    initialProfileId?: string,
    initialSettings?: ApexEnvironmentSettings,
  ) {
    const stored = readStoredProfiles();
    this.customProfiles = stored.profiles;
    this.selectedProfileId = (
      initialProfileId
      ?? stored.selectedProfileId
      ?? DEFAULT_ENVIRONMENT_PROFILES[0].id
    );
    this.profileSelect = root.querySelector('#environment-profile')!;
    this.profileNameInput = root.querySelector('#environment-profile-name')!;
    this.environmentSelect = root.querySelector('#environment-asset')!;
    this.status = root.querySelector('#environment-profile-status')!;
    this.deleteButton = root.querySelector('#environment-delete')!;
    this.inputs = {
      exposure: root.querySelector('#environment-exposure')!,
      hdriIntensity: root.querySelector('#environment-hdri-intensity')!,
      skyIntensity: root.querySelector('#environment-sky-intensity')!,
      skyBlur: root.querySelector('#environment-sky-blur')!,
      rotationDegrees: root.querySelector('#environment-rotation')!,
      sunIntensity: root.querySelector('#environment-sun-intensity')!,
      sunColor: root.querySelector('#environment-sun-color')!,
      sunAltitudeDegrees: root.querySelector('#environment-sun-altitude')!,
      sunAzimuthDegrees: root.querySelector('#environment-sun-azimuth')!,
      softShadows: root.querySelector('#environment-shadows')!,
      fogEnabled: root.querySelector('#environment-fog-enabled')!,
      fogColor: root.querySelector('#environment-fog-color')!,
      fogNearM: root.querySelector('#environment-fog-near')!,
      fogFarM: root.querySelector('#environment-fog-far')!,
    };
    this.outputs = Object.fromEntries([
      'exposure',
      'hdri-intensity',
      'sky-intensity',
      'sky-blur',
      'rotation',
      'sun-intensity',
      'sun-altitude',
      'sun-azimuth',
      'fog-near',
      'fog-far',
    ].map(key => [
      key,
      root.querySelector<HTMLOutputElement>(`#environment-${key}-value`)!,
    ]));

    APEX_ENVIRONMENT_ASSETS.forEach(environment => {
      this.environmentSelect.add(new Option(environment.name, environment.id));
    });
    this.renderProfileOptions();
    const initial = this.findProfile(this.selectedProfileId)
      ?? DEFAULT_ENVIRONMENT_PROFILES[0];
    this.selectProfile(initial, initialSettings);

    this.profileSelect.addEventListener('change', () => {
      const profile = this.findProfile(this.profileSelect.value);
      if (profile) this.selectProfile(profile);
    });
    this.environmentSelect.addEventListener('change', () => this.applyInputs());
    Object.values(this.inputs).forEach(input => {
      input.addEventListener('input', () => this.applyInputs());
      input.addEventListener('change', () => this.applyInputs());
    });
    root.querySelector('#environment-save')!.addEventListener(
      'click',
      () => this.saveProfile(),
    );
    this.deleteButton.addEventListener('click', () => this.deleteProfile());
    root.querySelector('#environment-reset')!.addEventListener(
      'click',
      () => this.resetProfile(),
    );
    root.querySelector('#environment-copy-default')!.addEventListener(
      'click',
      () => void this.copyAsDefault(),
    );
  }

  reportEnvironmentStatus(message: string): void {
    this.status.value = message;
  }

  private allProfiles(): readonly ApexEnvironmentProfile[] {
    return [...DEFAULT_ENVIRONMENT_PROFILES, ...this.customProfiles];
  }

  private findProfile(id: string): ApexEnvironmentProfile | undefined {
    return this.allProfiles().find(profile => profile.id === id);
  }

  private renderProfileOptions(): void {
    this.profileSelect.replaceChildren();
    const defaults = document.createElement('optgroup');
    defaults.label = 'Defaults';
    DEFAULT_ENVIRONMENT_PROFILES.forEach(profile => {
      defaults.append(new Option(profile.name, profile.id));
    });
    this.profileSelect.append(defaults);
    if (this.customProfiles.length > 0) {
      const custom = document.createElement('optgroup');
      custom.label = 'Guardados';
      this.customProfiles.forEach(profile => {
        custom.append(new Option(profile.name, profile.id));
      });
      this.profileSelect.append(custom);
    }
    this.profileSelect.value = this.selectedProfileId;
  }

  private writeSettings(settings: ApexEnvironmentSettings): void {
    this.environmentSelect.value = settings.environmentId;
    this.inputs.exposure.value = String(settings.exposure);
    this.inputs.hdriIntensity.value = String(settings.hdriIntensity);
    this.inputs.skyIntensity.value = String(settings.skyIntensity);
    this.inputs.skyBlur.value = String(settings.skyBlur);
    this.inputs.rotationDegrees.value = String(settings.rotationDegrees);
    this.inputs.sunIntensity.value = String(settings.sunIntensity);
    this.inputs.sunColor.value = settings.sunColor;
    this.inputs.sunAltitudeDegrees.value = String(settings.sunAltitudeDegrees);
    this.inputs.sunAzimuthDegrees.value = String(settings.sunAzimuthDegrees);
    this.inputs.softShadows.checked = settings.softShadows;
    this.inputs.fogEnabled.checked = settings.fogEnabled;
    this.inputs.fogColor.value = settings.fogColor;
    this.inputs.fogNearM.value = String(settings.fogNearM);
    this.inputs.fogFarM.value = String(settings.fogFarM);
  }

  private selectProfile(
    profile: ApexEnvironmentProfile,
    settingsOverride?: ApexEnvironmentSettings,
  ): void {
    this.selectedProfileId = profile.id;
    this.profileSelect.value = profile.id;
    this.profileNameInput.value = profile.builtIn ? '' : profile.name;
    const settings = settingsOverride ?? profile.settings;
    this.writeSettings(settings);
    this.deleteButton.disabled = profile.builtIn;
    this.refreshOutputs();
    this.apply(settings);
    this.persist();
  }

  private currentSettings(): ApexEnvironmentSettings {
    return Object.freeze({
      environmentId: this.environmentSelect.value,
      exposure: Number(this.inputs.exposure.value),
      hdriIntensity: Number(this.inputs.hdriIntensity.value),
      skyIntensity: Number(this.inputs.skyIntensity.value),
      skyBlur: Number(this.inputs.skyBlur.value),
      rotationDegrees: Number(this.inputs.rotationDegrees.value),
      sunIntensity: Number(this.inputs.sunIntensity.value),
      sunColor: this.inputs.sunColor.value,
      sunAltitudeDegrees: Number(this.inputs.sunAltitudeDegrees.value),
      sunAzimuthDegrees: Number(this.inputs.sunAzimuthDegrees.value),
      softShadows: this.inputs.softShadows.checked,
      fogEnabled: this.inputs.fogEnabled.checked,
      fogColor: this.inputs.fogColor.value,
      fogNearM: Number(this.inputs.fogNearM.value),
      fogFarM: Number(this.inputs.fogFarM.value),
    });
  }

  private applyInputs(): void {
    this.refreshOutputs();
    this.apply(this.currentSettings());
    this.status.value = 'Cambios sin guardar';
  }

  private refreshOutputs(): void {
    this.outputs.exposure.value = Number(this.inputs.exposure.value).toFixed(2);
    this.outputs['hdri-intensity'].value = Number(
      this.inputs.hdriIntensity.value,
    ).toFixed(2);
    this.outputs['sky-intensity'].value = Number(
      this.inputs.skyIntensity.value,
    ).toFixed(2);
    this.outputs['sky-blur'].value = Number(this.inputs.skyBlur.value).toFixed(2);
    this.outputs.rotation.value = `${this.inputs.rotationDegrees.value}°`;
    this.outputs['sun-intensity'].value = Number(
      this.inputs.sunIntensity.value,
    ).toFixed(2);
    this.outputs['sun-altitude'].value = `${this.inputs.sunAltitudeDegrees.value}°`;
    this.outputs['sun-azimuth'].value = `${this.inputs.sunAzimuthDegrees.value}°`;
    this.outputs['fog-near'].value = `${this.inputs.fogNearM.value} m`;
    this.outputs['fog-far'].value = `${this.inputs.fogFarM.value} m`;
  }

  private saveProfile(): void {
    const name = this.profileNameInput.value.trim();
    if (name.length === 0) {
      this.status.value = 'Escribí un nombre para guardar';
      this.profileNameInput.focus();
      return;
    }
    const selected = this.findProfile(this.selectedProfileId);
    const existing = !selected?.builtIn
      ? selected
      : this.customProfiles.find(
        profile => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
    const id = existing?.id ?? `custom-${Date.now().toString(36)}`;
    const profile: ApexEnvironmentProfile = Object.freeze({
      id,
      name,
      builtIn: false,
      settings: copySettings(this.currentSettings()),
    });
    this.customProfiles = existing
      ? this.customProfiles.map(candidate => candidate.id === id ? profile : candidate)
      : [...this.customProfiles, profile];
    this.selectedProfileId = id;
    this.renderProfileOptions();
    this.profileSelect.value = id;
    this.deleteButton.disabled = false;
    this.persist();
    this.status.value = `Guardado · ${name}`;
  }

  private deleteProfile(): void {
    const selected = this.findProfile(this.selectedProfileId);
    if (!selected || selected.builtIn) return;
    this.customProfiles = this.customProfiles.filter(
      profile => profile.id !== selected.id,
    );
    this.selectProfile(DEFAULT_ENVIRONMENT_PROFILES[0]);
    this.renderProfileOptions();
    this.status.value = `Eliminado · ${selected.name}`;
  }

  private resetProfile(): void {
    const profile = this.findProfile(this.selectedProfileId)
      ?? DEFAULT_ENVIRONMENT_PROFILES[0];
    this.selectProfile(profile);
    this.status.value = `Restablecido · ${profile.name}`;
  }

  private async copyAsDefault(): Promise<void> {
    const environment = APEX_ENVIRONMENT_ASSETS.find(
      asset => asset.id === this.environmentSelect.value,
    )!;
    const payload = Object.freeze({
      format: 'apex-drive-rendering-default',
      formatVersion: 1,
      name: this.profileNameInput.value.trim()
        || this.findProfile(this.selectedProfileId)?.name
        || 'Environment default',
      environment: Object.freeze({
        id: environment.id,
        name: environment.name,
        uri: environment.uri,
        attribution: environment.attribution,
      }),
      rendering: this.currentSettings(),
    });
    const text = `Apex Drive rendering default\n${JSON.stringify(payload, null, 2)}`;
    try {
      await writeClipboardText(text);
      this.status.value = 'Default copiado · pegalo en el chat';
    } catch {
      this.status.value = 'No se pudo copiar · revisá permisos';
    }
  }

  private persist(): void {
    const stored: StoredEnvironmentProfiles = Object.freeze({
      format: STORAGE_FORMAT,
      formatVersion: STORAGE_FORMAT_VERSION,
      selectedProfileId: this.selectedProfileId,
      profiles: Object.freeze(this.customProfiles.map(profile => Object.freeze({
        id: profile.id,
        name: profile.name,
        settings: copySettings(profile.settings),
      }))),
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      this.status.value = 'El navegador bloqueó localStorage';
    }
  }
}
