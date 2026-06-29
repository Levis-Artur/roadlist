import { apiUpload, getApiUrl } from './apiClient';

interface UploadPhotoResponse {
  success: boolean;
  photoId: string;
}

export async function saveOdometerPhoto(file: File, type: 'start' | 'end'): Promise<string> {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('type', type);
  const response = await apiUpload<UploadPhotoResponse>('/api/photos/upload', formData);
  return response.photoId;
}

function authToken(): string {
  return sessionStorage.getItem('admin_token') || sessionStorage.getItem('officer_token') || '';
}

export async function getOdometerPhoto(photoId: string): Promise<string | null> {
  const token = authToken();
  const response = await fetch(getApiUrl(`/api/photos/${encodeURIComponent(photoId)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export async function deleteOdometerPhoto(photoId: string): Promise<void> {
  if (import.meta.env.DEV) {
    console.info('[photoService] Видалення фото виконується на backend.', photoId);
  }
}
