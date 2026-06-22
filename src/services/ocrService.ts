import { apiPost, isApiUnavailableError } from './apiClient';

interface OcrResponse {
  success: boolean;
  value: number;
}

export async function recognizeOdometer(photoId: string, type: 'start' | 'end'): Promise<number> {
  if (photoId.startsWith('local:')) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return type === 'start' ? 198234 : 198376;
  }
  try {
    const response = await apiPost<OcrResponse>(`/api/photos/${encodeURIComponent(photoId)}/ocr`, { type });
    return response.value;
  } catch (error) {
    if (isApiUnavailableError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      return type === 'start' ? 198234 : 198376;
    }
    throw new Error('Не вдалося розпізнати показник одометра. Внесіть кілометраж вручну.');
  }
}
