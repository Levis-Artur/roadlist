import { useState } from 'react';
import type { OdometerResult } from '../types';
import { deleteOdometerPhoto, getOdometerPhoto, saveOdometerPhoto } from '../services/photoService';

interface Props {
  onSubmit: (result: OdometerResult) => Promise<string | undefined>;
  submitLabel: string;
  type: 'start' | 'end';
}

export function OdometerInput({ onSubmit, submitLabel, type }: Props) {
  const [photo, setPhoto] = useState<string>();
  const [photoId, setPhotoId] = useState<string>();
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');
  const [photoStage, setPhotoStage] = useState<'idle' | 'uploading'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function handlePhoto(file?: File) {
    if (!file) return;
    try {
      setError('');
      setPhotoStage('uploading');
      const savedPhotoId = await saveOdometerPhoto(file, type);
      const preview = await getOdometerPhoto(savedPhotoId);
      if (!preview) throw new Error('Фото недоступне.');
      if (photoId) void deleteOdometerPhoto(photoId).catch(() => undefined);
      setPhoto(preview);
      setPhotoId(savedPhotoId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не вдалося завантажити фото.');
    } finally {
      setPhotoStage('idle');
    }
  }

  async function submitResult(result: OdometerResult) {
    setError('');
    setSubmitting(true);
    try {
      const submitError = await onSubmit(result);
      if (submitError) setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (import.meta.env.DEV) {
      console.log('[OdometerInput] Зберегти кілометраж', { manualValue });
    }
    const normalizedValue = manualValue.trim().replace(',', '.');
    if (!normalizedValue) {
      setError(type === 'start' ? 'Введіть початковий кілометраж.' : 'Введіть кінцевий кілометраж.');
      return;
    }
    const value = Number(normalizedValue);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      setError('Кілометраж має бути невід’ємним числом.');
      return;
    }
    if (!photoId) {
      setError('Додайте фото одометра.');
      return;
    }
    void submitResult({ value, manualEntry: true, photoId });
  }

  return (
    <div className="odometer-block">
      <p className="field-hint service-note">
        Фото одометра зберігається для подальшої перевірки. Кілометраж внесіть вручну відповідно до показника на фото.
      </p>
      <label className="file-button">
        {photoStage === 'uploading'
          ? 'Завантажуємо фото...'
          : 'Зробити або завантажити фото одометра'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={photoStage !== 'idle'}
          onChange={(event) => void handlePhoto(event.target.files?.[0])}
        />
      </label>

      {photo && <div className="attachment-preview"><img className="photo-preview" src={photo} alt="Фото одометра" /><span>Фото одометра завантажено.</span></div>}

      <form className="manual-entry" onSubmit={submitManual}>
        <label>
          {type === 'start' ? 'Початковий кілометраж' : 'Кінцевий кілометраж'}
          <input
            type="text"
            inputMode="numeric"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Наприклад, 198250"
          />
        </label>
        <button type="submit" disabled={submitting}>{submitting ? (type === 'start' ? 'Зберігаємо початок зміни...' : 'Завершуємо зміну...') : submitLabel}</button>
      </form>

      {error && <p className="message error" role="alert">{error}</p>}
    </div>
  );
}
