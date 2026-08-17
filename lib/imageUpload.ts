import { ImageUploadRequest } from "@/types/models";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
/** Bucket folder the challan photos land in server-side. */
export const UPLOAD_FOLDER = "QRChallan";
/** Extension the bucket names every challan image with. */
export const UPLOAD_EXT = "png";
/** "QRChallan/<label><yyyymmdd><mm><ss>.png" - the folderName shape the bucket accepts. */
const FOLDER_NAME_PATTERN = new RegExp(`^${UPLOAD_FOLDER}/[A-Za-z0-9]+\\d{12}\\.${UPLOAD_EXT}$`);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Builds the bucket path: the field label (stripped to alphanumerics so spaces/slashes can't break
 * the path) followed by a yyyymmdd date and the minute+second of the upload, e.g.
 * "QRChallan/transitPass202608141453.png".
 */
export function buildFolderName(label: string, now: Date): string {
  const stem = label.replace(/[^A-Za-z0-9]/g, "");
  const stamp =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `${UPLOAD_FOLDER}/${stem}${stamp}.${UPLOAD_EXT}`;
}

/** Guards the generated name against the pattern before anything is sent to the bucket. */
export function validateFolderName(folderName: string): string | null {
  if (!FOLDER_NAME_PATTERN.test(folderName)) {
    return `Invalid file name "${folderName}" - expected ${UPLOAD_FOLDER}/<label><yyyymmdd><mm><ss>.${UPLOAD_EXT}`;
  }
  return null;
}

/**
 * ImageUploadField hands back a "data:image/jpeg;base64,..." URI, but ImageUploadRequest wants the
 * raw base64 in "bytes" and the extension in "fileType" - so the prefix is split off here.
 */
export function toUploadRequest(dataUri: string, folderName: string): ImageUploadRequest {
  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUri);
  const bytes = match?.[2] ?? dataUri;
  return { folderName, bytes, fileType: UPLOAD_EXT };
}

/** ShortenUrl can answer with a full URL or a bucket-relative path; the payload needs an absolute one. */
export function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}
