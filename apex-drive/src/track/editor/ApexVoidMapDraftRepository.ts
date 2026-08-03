import {
  APEX_VOID_ENABLED,
  apexVoidClient,
} from '../../runtime/ApexVoidRuntime';
import {
  apexTrackDraftStorageKey,
  loadApexTrackDraft,
  parseApexTrackDraft,
  saveApexTrackDraft,
  type ApexTrackDraft,
  type ApexTrackDraftIdentity,
} from './ApexTrackDraftStorage';

export interface ApexVoidMapDraftRevision {
  readonly objectId: string;
  readonly revision: string;
  readonly savedAtIso: string;
}

export const loadApexMapDraftFromVoid = async (
  identity: ApexTrackDraftIdentity,
): Promise<ApexTrackDraft | undefined> => {
  const localDraft = loadApexTrackDraft(identity);
  if (!APEX_VOID_ENABLED) return localDraft;
  try {
    const stored = await apexVoidClient.loadMapDraft<unknown>(identity);
    const voidDraft = parseApexTrackDraft(identity, stored?.draft);
    if (!voidDraft) return localDraft;
    if (
      localDraft
      && Date.parse(localDraft.savedAtIso) > Date.parse(voidDraft.savedAtIso)
    ) return localDraft;
    saveApexTrackDraft(voidDraft);
    return voidDraft;
  } catch {
    return localDraft;
  }
};

export const saveApexMapDraftToVoid = async (
  draft: ApexTrackDraft,
): Promise<ApexVoidMapDraftRevision> => {
  if (!APEX_VOID_ENABLED) {
    throw new Error('APEX Void no está configurado para esta aplicación');
  }
  const payload = await apexVoidClient.saveMapDraft(draft);
  return {
    objectId: payload.objectId,
    revision: payload.revision,
    savedAtIso: payload.savedAtIso,
  };
};

const pendingSaves = new Map<string, {
  readonly timer: number;
  readonly draft: ApexTrackDraft;
}>();

export const scheduleApexMapDraftSave = (
  draft: ApexTrackDraft,
  delayMs = 750,
): void => {
  if (!APEX_VOID_ENABLED) return;
  const key = apexTrackDraftStorageKey(draft);
  const previous = pendingSaves.get(key);
  if (previous) window.clearTimeout(previous.timer);
  const timer = window.setTimeout(() => {
    const latest = pendingSaves.get(key);
    if (!latest) return;
    pendingSaves.delete(key);
    void saveApexMapDraftToVoid(latest.draft).catch(error => {
      console.warn('APEX Void no pudo sincronizar el borrador del mapa', error);
    });
  }, Math.max(0, delayMs));
  pendingSaves.set(key, { timer, draft });
};
