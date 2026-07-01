import type { FormEvent } from 'react';
import type { RouteSheet } from '../../types';
import { formatDate } from '../../utils/format';
import { DetailItem, StoredPhoto } from './AdminDetail';
import { routeSheetStatusLabels } from './adminLabels';

export type ReviewAction = 'verify' | 'comment' | 'needs_review';

interface RouteSheetDetailsModalProps {
  selected: RouteSheet;
  reviewAction: ReviewAction | null;
  reviewComment: string;
  reviewSubmitting: boolean;
  reviewError: string | null;
  reviewSuccess: string;
  displayVehicle: (vehicleNumber: string) => string;
  onClose: () => void;
  onOpenReviewAction: (action: ReviewAction) => void;
  onSubmitReviewAction: (event: FormEvent) => void | Promise<void>;
  onReviewCommentChange: (value: string) => void;
  onCancelReviewAction: () => void;
}

export function RouteSheetDetailsModal({
  selected,
  reviewAction,
  reviewComment,
  reviewSubmitting,
  reviewError,
  reviewSuccess,
  displayVehicle,
  onClose,
  onOpenReviewAction,
  onSubmitReviewAction,
  onReviewCommentChange,
  onCancelReviewAction,
}: RouteSheetDetailsModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal detail-modal" role="dialog" aria-modal="true" aria-label="Деталі маршрутного листа" onMouseDown={(event) => event.stopPropagation()}>
        <div className="section-heading"><div><span className="eyebrow">Маршрутний лист</span><h2>Деталі запису</h2></div><button type="button" className="text-button" onClick={onClose}>Закрити</button></div>
        <dl className="detail-grid">
          <DetailItem label="ID запису" value={selected.id} /><DetailItem label="ПІБ" value={selected.fullName} />
          <DetailItem label="Номер жетона" value={selected.badgeNumber} /><DetailItem label="УПП" value={selected.department} />
          <DetailItem label="Підрозділ" value={selected.unit || '—'} />
          <DetailItem label="Екіпаж / підрозділ" value={selected.crewNumber || '—'} />
          <DetailItem label="Автомобіль" value={displayVehicle(selected.vehicleNumber)} /><DetailItem label="Початок зміни" value={formatDate(selected.startedAt)} />
          <DetailItem label="Завершення зміни" value={formatDate(selected.endedAt)} /><DetailItem label="Початковий кілометраж" value={`${selected.startOdometer} км`} />
          <DetailItem label="Кінцевий кілометраж" value={selected.endOdometer === undefined ? '—' : `${selected.endOdometer} км`} />
          <DetailItem label="Пробіг" value={selected.distanceKm === undefined ? '—' : `${selected.distanceKm} км`} />
          <DetailItem label="Заправка" value={selected.refueled ? 'Так' : 'Ні'} />
          <DetailItem label="Кількість літрів" value={selected.refueled ? `${selected.fuelLiters ?? '—'} л` : '—'} />
          <DetailItem label="Спосіб внесення на початку" value={selected.startManualEntry ? 'Внесено вручну' : '—'} />
          <DetailItem label="Спосіб внесення в кінці" value={selected.endManualEntry === undefined ? '—' : selected.endManualEntry ? 'Внесено вручну' : '—'} />
          <DetailItem label="Статус" value={<span className={`status ${selected.status}`}>{routeSheetStatusLabels[selected.status]}</span>} />
        </dl>
        <section className="admin-review-box">
          <div className="section-heading inline-heading"><div><span className="eyebrow">Адміністративна перевірка</span><h3>Стан перевірки</h3></div></div>
          <dl className="detail-grid">
            <DetailItem label="Поточний статус" value={<span className={`status ${selected.status}`}>{routeSheetStatusLabels[selected.status]}</span>} />
            <DetailItem label="Дата перевірки" value={formatDate(selected.adminVerifiedAt)} />
            <DetailItem label="Ким перевірено" value={selected.adminVerifiedBy || '—'} />
            <DetailItem label="Коментар адміністратора" value={selected.adminReviewComment || '—'} />
          </dl>
          <div className="button-row compact-row">
            {(selected.status === 'completed' || selected.status === 'needs_review') && (
              <button type="button" className="small-button" onClick={() => onOpenReviewAction('verify')}>Позначити як перевірено</button>
            )}
            {selected.status === 'needs_review' && (
              <button type="button" className="small-button secondary" onClick={() => onOpenReviewAction('comment')}>Залишити коментар</button>
            )}
            {selected.status === 'verified' && (
              <>
                <span className="message success compact-message">Перевірено адміністратором</span>
                <button type="button" className="small-button danger-mini" onClick={() => onOpenReviewAction('needs_review')}>Повернути на перевірку</button>
              </>
            )}
            {selected.status === 'active' && <span className="field-hint">Активну незавершену зміну не можна перевірити.</span>}
          </div>
          {reviewSuccess && <p className="message success compact-review-message" role="status">{reviewSuccess}</p>}
          {reviewError && <p className="message error compact-review-message" role="alert">{reviewError}</p>}
          {reviewAction && (
            <form className="admin-review-form" onSubmit={(event) => void onSubmitReviewAction(event)}>
              <label>
                Коментар адміністратора
                <textarea
                  value={reviewComment}
                  disabled={reviewSubmitting}
                  onChange={(event) => onReviewCommentChange(event.target.value)}
                  placeholder={reviewAction === 'verify'
                    ? 'Наприклад: Кілометраж звірено з фото одометра. Порушень не виявлено.'
                    : reviewAction === 'comment'
                      ? 'Наприклад: Потрібно додатково звірити фото кінцевого одометра.'
                      : 'Наприклад: Потрібно додатково перевірити показник кінцевого одометра.'}
                />
              </label>
              <div className="modal-actions">
                <button type="submit" disabled={reviewSubmitting}>
                  {reviewSubmitting
                    ? (reviewAction === 'verify' ? 'Підтверджуємо...' : 'Зберігаємо...')
                    : reviewAction === 'verify'
                      ? 'Підтвердити перевірку'
                      : reviewAction === 'comment'
                        ? 'Зберегти коментар'
                        : 'Залишити на перевірці'}
                </button>
                <button type="button" className="secondary" disabled={reviewSubmitting} onClick={onCancelReviewAction}>Скасувати</button>
              </div>
            </form>
          )}
        </section>
        <div className="photo-grid detail-photos">
          <figure><figcaption>Фото на початку зміни</figcaption><StoredPhoto photoId={selected.startPhotoId} alt="Одометр на початку зміни" /></figure>
          <figure><figcaption>Фото наприкінці зміни</figcaption><StoredPhoto photoId={selected.endPhotoId} alt="Одометр наприкінці зміни" /></figure>
        </div>
      </section>
    </div>
  );
}
