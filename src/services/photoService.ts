import { clearPhotos, deleteExpiredPhotos, deletePhoto, getPhoto, savePhoto } from '../storage/photoDb';
import { compressImage } from '../utils/imageCompression';
import { apiUpload, getApiUrl, isApiUnavailableError } from './apiClient';
import { addAuditLog } from './auditService';

const LOCAL_PHOTO_PREFIX = 'local:';

interface UploadPhotoResponse {
  success: boolean;
  photoId: string;
}

function isLocalPhotoId(photoId: string): boolean {
  return photoId.startsWith(LOCAL_PHOTO_PREFIX);
}

function rawLocalPhotoId(photoId: string): string {
  return photoId.slice(LOCAL_PHOTO_PREFIX.length);
}

export async function saveOdometerPhoto(file: File, type: 'start' | 'end'): Promise<string> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('type', type);
  try {
    const response = await apiUpload<UploadPhotoResponse>('/api/photos/upload', formData);
    return response.photoId;
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const compressedPhoto = await compressImage(file);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const localId = await savePhoto(compressedPhoto, expiresAt.toISOString());
    await addAuditLog({ action: 'Фото збережено локально', entityType: 'photo', entityId: localId }).catch(() => undefined);
    return `${LOCAL_PHOTO_PREFIX}${localId}`;
  }
}

export function getOdometerPhotoUrl(photoId: string): string {
  return isLocalPhotoId(photoId) ? '' : getApiUrl(`/api/photos/${encodeURIComponent(photoId)}`);
}

export async function getOdometerPhoto(photoId: string): Promise<string | null> {
  if (isLocalPhotoId(photoId)) return getPhoto(rawLocalPhotoId(photoId));
  return getOdometerPhotoUrl(photoId);
}

export async function deleteOdometerPhoto(photoId: string): Promise<void> {
  if (isLocalPhotoId(photoId)) await deletePhoto(rawLocalPhotoId(photoId));
}

export async function clearOdometerPhotos(): Promise<void> {
  await clearPhotos();
}

export async function cleanupExpiredPhotos(): Promise<void> {
  await deleteExpiredPhotos();
}
