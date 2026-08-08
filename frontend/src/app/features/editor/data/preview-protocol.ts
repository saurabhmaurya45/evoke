/** Versioned contract shared by the editor and every embedded template. */
export const PREVIEW_PROTOCOL_VERSION = 1 as const;
export const PREVIEW_READY = 'evoke:preview-ready' as const;
export const PREVIEW_UPDATE = 'evoke:preview-update' as const;

export interface PreviewReadyMessage {
  readonly channel: typeof PREVIEW_READY;
  readonly version: typeof PREVIEW_PROTOCOL_VERSION;
}

export interface PreviewUpdateMessage {
  readonly channel: typeof PREVIEW_UPDATE;
  readonly version: typeof PREVIEW_PROTOCOL_VERSION;
  readonly data: unknown;
}
