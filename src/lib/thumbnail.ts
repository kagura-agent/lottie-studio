import path from "node:path";
import fs from "node:fs";

export const THUMBNAILS_DIR = path.join(process.cwd(), "data", "thumbnails");

fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

export function getThumbnailPath(id: string): string {
  return path.join(THUMBNAILS_DIR, `${id}.png`);
}

export function invalidateThumbnail(id: string): void {
  const thumbPath = getThumbnailPath(id);
  if (fs.existsSync(thumbPath)) {
    fs.unlinkSync(thumbPath);
  }
}
