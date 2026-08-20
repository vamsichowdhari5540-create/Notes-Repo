// .doc (legacy binary Word format) is intentionally excluded — there's no
// reliable way to extract its text for moderation, so allowing it would be
// an easy way to bypass the content check entirely.
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];
export const ACCEPTED_FILE_EXT = ".pdf,.docx,.png,.jpg,.jpeg";
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
