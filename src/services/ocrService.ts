import { apiPost } from './apiClient';

interface OcrResponse {
  success: boolean;
  value: number;
}

export async function recognizeOdometer(photoId: string, type: 'start' | 'end'): Promise<number> {
  try {
    const response = await apiPost<OcrResponse>(`/api/photos/${encodeURIComponent(photoId)}/ocr`, { type });
    return response.value;
  } catch (error) {
    throw new Error('Не вдалося розпізнати показник одометра. Внесіть кілометраж вручну.');
  }
}
