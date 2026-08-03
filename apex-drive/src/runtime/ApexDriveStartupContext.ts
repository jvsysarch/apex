export interface ApexDriveStartupContext {
  readonly searchParams: URLSearchParams;
  readonly bareRuntime: boolean;
  readonly trackStudioApplication: boolean;
  readonly trackEditorMode: boolean;
  readonly driveApplicationUrl: string;
  readonly trackStudioApplicationUrl: string;
  readonly requestedEtherHud: string | null;
  readonly requestedTrackEditorSegmentId: string | undefined;
}

/**
 * Reads only application-level inputs. Domain state such as the active track
 * and vehicle selection deliberately stays outside this boundary.
 */
export const readApexDriveStartupContext = (): ApexDriveStartupContext => {
  const searchParams = new URLSearchParams(window.location.search);
  const trackStudioApplication = (
    import.meta.env.VITE_APEX_TRACK_STUDIO_APP === 'true'
  );

  return Object.freeze({
    searchParams,
    bareRuntime: import.meta.env.VITE_APEX_DRIVE_BARE_RUNTIME === 'true',
    trackStudioApplication,
    trackEditorMode: trackStudioApplication,
    driveApplicationUrl: (
      import.meta.env.VITE_APEX_DRIVE_APP_URL?.trim()
      || 'http://127.0.0.1:5175/'
    ),
    trackStudioApplicationUrl: (
      import.meta.env.VITE_APEX_TRACK_STUDIO_APP_URL?.trim()
      || 'http://127.0.0.1:5176/'
    ),
    requestedEtherHud: searchParams.get('ether'),
    requestedTrackEditorSegmentId: (
      searchParams.get('editSegment')?.trim() || undefined
    ),
  });
};
