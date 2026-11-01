export const SHARE_TITLE_MAX: number;
export const SHARE_DESCRIPTION_MAX: number;
export function knownTemplates(): string[];
export function shareText(
  templateId: string,
  data: unknown,
): { title: string; description: string; names: string; date: string };
export function sharePhotos(templateId: string, data: unknown): string[];
export function customShareImage(data: unknown): string;
export function posterPath(templateId: string): string;
