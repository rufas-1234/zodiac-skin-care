const LEGACY_UPLOAD_PATH = /^\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|gif))$/i;

export function normalizeProductImageUrl(image: string) {
  const legacyUpload = LEGACY_UPLOAD_PATH.exec(image);
  return legacyUpload ? `/api/uploads/${legacyUpload[1]}` : image;
}
