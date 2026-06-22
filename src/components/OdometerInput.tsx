import { useState } from 'react';
import type { OdometerResult } from '../types';
import { recognizeOdometer } from '../services/ocrService';
import { deleteOdometerPhoto, getOdometerPhoto, saveOdometerPhoto } from '../services/photoService';

interface Props {
  onSubmit: (result: OdometerResult) => Promise<string | undefined>;
  submitLabel: string;
  type: 'start' | 'end';
}

export function OdometerInput({ onSubmit, submitLabel, type }: Props) {
  const [photo, setPhoto] = useState<string>();
  const [photoId, setPhotoId] = useState<string>();
  const [ocrValue, setOcrValue] = useState<number>();
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState('');
  const [photoStage, setPhotoStage] = useState<'idle' | 'uploading' | 'recognizing'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function handlePhoto(file?: File) {
    if (!file) return;
    try {
      setError('');
      setOcrValue(undefined);
      setPhotoStage('uploading');
      const savedPhotoId = await saveOdometerPhoto(file, type);
      const preview = await getOdometerPhoto(savedPhotoId);
      if (!preview) throw new Error('Фото недоступне.');
      if (photoId) void deleteOdometerPhoto(photoId).catch(() => undefined);
      setPhoto(preview);
      setPhotoId(savedPhotoId);
      setManualMode(false);
      setPhotoStage('recognizing');
      try {
        setOcrValue(await recognizeOdometer(savedPhotoId, type));
      } catch (error) {
        setManualMode(true);
        setError(error instanceof Error ? error.message : 'Не вдалося розпізнати показник одометра. Внесіть кілометраж вручну.');
      }
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
    const value = Number(manualValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Кілометраж має бути числом більше 0.');
      return;
    }
    if (!photoId) {
      setError('Додайте фото одометра.');
      return;
    }
    void submitResult({ value, ocrValue, manualEntry: true, photoId });
  }

  return (
    <div className="odometer-block">
      <label className="file-button">
        {photoStage === 'uploading'
          ? 'Завантажуємо фото...'
          : photoStage === 'recognizing'
            ? 'Розпізнаємо одометр...'
            : 'Зробити або завантажити фото одометра'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={photoStage !== 'idle'}
          onChange={(event) => void handlePhoto(event.target.files?.[0])}
        />
      </label>

      {photo && <div className="attachment-preview"><img className="photo-preview" src={photo} alt="Фото одометра" /><span>Фото завантажено</span></div>}

      {ocrValue !== undefined && (
        <div className="ocr-result">
          <span>Результат розпізнавання</span>
          <strong>{ocrValue.toLocaleString('uk-UA')} <small>км</small></strong>
        </div>
      )}

      {ocrValue !== undefined && !manualMode && (
        <div className="button-row">
          <button type="button" disabled={submitting} onClick={() => void submitResult({ value: ocrValue, ocrValue, manualEntry: false, photoId })}>
            {submitting ? (type === 'start' ? 'Зберігаємо початок зміни...' : 'Завершуємо зміну...') : submitLabel}
          </button>
          <button type="button" className="secondary" onClick={() => setManualMode(true)}>
            Внести вручну
          </button>
        </div>
      )}

      {manualMode && (
        <form className="manual-entry" onSubmit={submitManual}>
          <label>
            Кілометраж вручну
            <input
              type="number"
              min="1"
              step="any"
              inputMode="numeric"
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="Наприклад, 198250"
              autoFocus
            />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? (type === 'start' ? 'Зберігаємо початок зміни...' : 'Завершуємо зміну...') : 'Зберегти кілометраж'}</button>
        </form>
      )}

      {error && <p className="message error" role="alert">{error}</p>}
    </div>
  );
}
