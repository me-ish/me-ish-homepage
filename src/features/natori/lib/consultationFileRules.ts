export const CONSULTATION_AUDIO_MAX_BYTES = 50 * 1024 * 1024;
export const CONSULTATION_OTHER_MAX_BYTES = 10 * 1024 * 1024;

const TYPES: Record<string, { mime: readonly string[]; max: number }> = {
  jpg: { mime: ["image/jpeg"], max: CONSULTATION_OTHER_MAX_BYTES },
  jpeg: { mime: ["image/jpeg"], max: CONSULTATION_OTHER_MAX_BYTES },
  png: { mime: ["image/png"], max: CONSULTATION_OTHER_MAX_BYTES },
  webp: { mime: ["image/webp"], max: CONSULTATION_OTHER_MAX_BYTES },
  pdf: { mime: ["application/pdf"], max: CONSULTATION_OTHER_MAX_BYTES },
  mp3: { mime: ["audio/mpeg"], max: CONSULTATION_AUDIO_MAX_BYTES },
  m4a: { mime: ["audio/mp4", "audio/x-m4a"], max: CONSULTATION_AUDIO_MAX_BYTES },
  wav: { mime: ["audio/wav", "audio/x-wav"], max: CONSULTATION_AUDIO_MAX_BYTES },
};

export function consultationFileExtension(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function validConsultationFile(fileName: string, mimeType: string, sizeBytes: number): boolean {
  const rule = TYPES[consultationFileExtension(fileName)];
  return Boolean(rule && fileName.length <= 200 && fileName.length > 0 &&
    rule.mime.includes(mimeType) && Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= rule.max);
}
