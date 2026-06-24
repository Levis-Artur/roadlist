import { useState } from 'react';

interface DeleteConfirmModalProps {
  title: string;
  description: string;
  submitLabel?: string;
  onCancel: () => void;
  onConfirm: (input: { reason: string; confirmText: string }) => Promise<void>;
}

export function DeleteConfirmModal({ title, description, submitLabel = 'Видалити', onCancel, onConfirm }: DeleteConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!reason.trim()) {
      setError('Вкажіть причину видалення.');
      return;
    }
    if (confirmText !== 'ВИДАЛИТИ') {
      setError('Підтвердіть дію текстом “ВИДАЛИТИ”.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ reason: reason.trim(), confirmText });
      onCancel();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не вдалося виконати видалення.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form className="modal directory-modal danger-modal" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div><span className="eyebrow">Небезпечна дія</span><h2>{title}</h2></div>
          <button type="button" className="text-button" onClick={onCancel}>Закрити</button>
        </div>
        <p>{description}</p>
        <label>Причина видалення
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required />
        </label>
        <label>Введіть ВИДАЛИТИ для підтвердження
          <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} required />
        </label>
        {error && <p className="message error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="submit" className="danger" disabled={submitting}>{submitting ? 'Видаляємо…' : submitLabel}</button>
          <button type="button" className="secondary" onClick={onCancel}>Скасувати</button>
        </div>
      </form>
    </div>
  );
}
