import { useState } from 'react';
import { OfficerCard } from '../components/OfficerCard';
import { OdometerInput } from '../components/OdometerInput';
import { getAuthenticatedOfficer, loginOfficer, logoutOfficer } from '../services/officerService';
import { finishShift, getActiveRouteSheetByOfficer, reportDuplicateShiftAttempt, startShift } from '../services/routeSheetService';
import { getPilotStatus, getPilotVehicles } from '../services/pilotService';
import type { OdometerResult, Officer, PilotStatus, RouteSheet, Vehicle } from '../types';
import { BADGE_NUMBER_ERROR, isValidBadgeNumber, sanitizeBadgeNumber } from '../utils/badgeNumber';
import { findVehicleByNumber, formatVehicleLabel } from '../utils/vehicleDisplay';

type Flow = 'idle' | 'start' | 'end';

export function PatrolPage() {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [officer, setOfficer] = useState<Officer | undefined>(() => getAuthenticatedOfficer() ?? undefined);
  const [flow, setFlow] = useState<Flow>('idle');
  const [crewNumber, setCrewNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeSheet, setActiveSheet] = useState<RouteSheet>();
  const [checkingBadge, setCheckingBadge] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pilotStatus, setPilotStatus] = useState<PilotStatus>();
  const [pilotComment, setPilotComment] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  async function checkBadge(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidBadgeNumber(badgeNumber)) {
      setError(BADGE_NUMBER_ERROR);
      setOfficer(undefined);
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError('PIN має містити від 4 до 8 цифр.');
      setOfficer(undefined);
      return;
    }
    setCheckingBadge(true);
    try {
      const { officer: authenticatedOfficer } = await loginOfficer(badgeNumber, pin);
      setOfficer(authenticatedOfficer);
      setFlow('idle');
      setMessage('');
      setActiveSheet(undefined);
      setError('');
      setPin('');
    } catch (caught) {
      setOfficer(undefined);
      setError(caught instanceof Error ? caught.message : 'Не вдалося перевірити жетон. Спробуйте ще раз.');
    } finally {
      setCheckingBadge(false);
    }
  }

  async function beginFlow(nextFlow: Exclude<Flow, 'idle'>) {
    let automaticVehicleNumber = '';
    setLoadingVehicles(true);
    try {
      if (nextFlow === 'start' && officer) {
        const currentActiveSheet = await getActiveRouteSheetByOfficer(officer.badgeNumber);
        if (currentActiveSheet) {
          await reportDuplicateShiftAttempt(currentActiveSheet);
          setActiveSheet(currentActiveSheet);
          setError('У цього патрульного вже є активна зміна. Спочатку завершіть поточну зміну.');
          setMessage('');
          setFlow('idle');
          return;
        }
      }
      const [status, pilotVehicles] = await Promise.all([getPilotStatus(), getPilotVehicles()]);
      setPilotStatus(status);
      setVehicles(pilotVehicles);
      if (status.enabled && pilotVehicles.length === 1) automaticVehicleNumber = pilotVehicles[0].plateNumber;
      if (status.enabled && !pilotVehicles.length) {
        setError('Немає доступних автомобілів для пілотного тестування. Зверніться до адміністратора.');
        setFlow('idle');
        return;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Сервер недоступний. Спробуйте пізніше.');
      return;
    } finally {
      setLoadingVehicles(false);
    }
    setFlow(nextFlow);
    setCrewNumber('');
    setVehicleNumber(automaticVehicleNumber);
    setMessage('');
    setError('');
    setActiveSheet(undefined);
    setPilotComment('');
  }

  async function reset() {
    await logoutOfficer();
    setBadgeNumber('');
    setPin('');
    setOfficer(undefined);
    setFlow('idle');
    setCrewNumber('');
    setVehicleNumber('');
    setActiveSheet(undefined);
    setVehicles([]);
    setPilotStatus(undefined);
    setPilotComment('');
  }

  function displayVehicle(vehicleNumberValue: string): string {
    const vehicle = findVehicleByNumber(vehicles, vehicleNumberValue);
    return vehicle ? formatVehicleLabel(vehicle) : vehicleNumberValue;
  }

  async function saveOdometer(result: OdometerResult): Promise<string | undefined> {
    function fail(message: string) {
      setError(message);
      setMessage('');
      return message;
    }

    if (!officer) return fail('Спочатку перевірте номер жетона.');
    try {
      if (flow === 'start') {
        await startShift({
          officer,
          crewNumber,
          vehicleNumber,
          startOdometer: result.value,
          startPhotoId: result.photoId,
          startOcrValue: result.ocrValue,
          startManualEntry: result.manualEntry,
          pilotComment,
        });
        setMessage(result.manualEntry
          ? 'Зміну розпочато. Початковий кілометраж збережено.'
          : 'Зміну розпочато. Маршрутний лист має статус «Активна зміна».');
      } else if (flow === 'end') {
        const completed = await finishShift({
          badgeNumber: officer.badgeNumber,
          crewNumber,
          vehicleNumber,
          endOdometer: result.value,
          endPhotoId: result.photoId,
          endOcrValue: result.ocrValue,
          endManualEntry: result.manualEntry,
          pilotComment,
        });
        setMessage(`Зміну завершено. Пробіг за зміну: ${completed.distanceKm} км.${completed.status === 'needs_review' ? ' Запис потребує перевірки.' : ''}`);
      } else {
        return fail('Оберіть початок або завершення зміни.');
      }
      setError('');
      setFlow('idle');
      return undefined;
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Не вдалося зберегти дані.';
      if (errorMessage === 'Сесія завершилась. Увійдіть повторно.') {
        await logoutOfficer();
        setOfficer(undefined);
        setFlow('idle');
      }
      if (flow === 'start') {
        try {
          setActiveSheet(await getActiveRouteSheetByOfficer(officer.badgeNumber) ?? undefined);
        } catch {
          setActiveSheet(undefined);
        }
      }
      return fail(errorMessage);
    }
  }

  return (
    <main className="page patrol-page">
      <section className="hero">
        <span className="eyebrow">Модуль: маршрутні листи</span>
        <h1>Робоча форма патрульного</h1>
        <p>Внесення даних маршрутного листа</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Авторизація патрульного</h2><p>Введіть номер службового жетона та персональний PIN-код</p></div>
        </div>
        {!officer && <form onSubmit={checkBadge} className="patrol-login-form">
          <label>
            Номер жетона
            <input
              className="badge-input"
              value={badgeNumber}
              onChange={(event) => {
                const value = sanitizeBadgeNumber(event.target.value);
                setBadgeNumber(value);
                if (error === BADGE_NUMBER_ERROR && isValidBadgeNumber(value)) setError('');
              }}
              onPaste={(event) => {
                event.preventDefault();
                const value = sanitizeBadgeNumber(event.clipboardData.getData('text'));
                setBadgeNumber(value);
                if (error === BADGE_NUMBER_ERROR && isValidBadgeNumber(value)) setError('');
              }}
              inputMode="numeric"
              maxLength={7}
              placeholder="0000001"
              autoComplete="off"
            />
          </label>
          <label>
            PIN-код
            <input className="badge-input" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" minLength={4} maxLength={8} placeholder="4–8 цифр" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={!isValidBadgeNumber(badgeNumber) || !/^\d{4,8}$/.test(pin) || checkingBadge}>{checkingBadge ? 'Виконуємо вхід...' : 'Увійти'}</button>
        </form>}

        {error && flow === 'idle' && <p className="message error" role="alert">{error}</p>}
        {activeSheet && (
          <section className="active-shift-summary" aria-label="Інформація про активну зміну">
            <h3>Поточна активна зміна</h3>
            <dl>
              <div><dt>Екіпаж / підрозділ</dt><dd>{activeSheet.crewNumber || '—'}</dd></div>
              <div><dt>Автомобіль</dt><dd>{displayVehicle(activeSheet.vehicleNumber)}</dd></div>
              <div><dt>Початок</dt><dd>{new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(activeSheet.startedAt))}</dd></div>
              <div><dt>Початковий км</dt><dd>{activeSheet.startOdometer.toLocaleString('uk-UA')} км</dd></div>
            </dl>
          </section>
        )}
        {message && <p className="message success" role="status">{message}</p>}
        {pilotStatus?.ended && <p className="message warning" role="status">Пілотне тестування завершено. Дані можна внести для перевірки сценарію.</p>}

        {officer && <><p className="message success" role="status">Працівник авторизований</p><OfficerCard officer={officer} /></>}

        {officer && flow === 'idle' && (
          <div className="action-grid">
            <button type="button" disabled={loadingVehicles} onClick={() => void beginFlow('start')}>{loadingVehicles ? 'Завантажуємо автомобілі...' : 'Почати зміну'}</button>
            <button type="button" className="danger" disabled={loadingVehicles} onClick={() => void beginFlow('end')}>Закінчити зміну</button>
            <button type="button" className="secondary" disabled={loadingVehicles} onClick={() => void reset()}>Вийти</button>
          </div>
        )}

        {officer && flow !== 'idle' && (
          <section className="shift-form">
            <div className="section-heading">
              <div><h2>{flow === 'start' ? 'Початок зміни' : 'Завершення зміни'}</h2><p>Заповніть дані екіпажу та додайте фото одометра</p></div>
              <button type="button" className="text-button" onClick={() => setFlow('idle')}>Скасувати</button>
            </div>
            <label>
              Номер екіпажу / підрозділу <span className="optional-label">необов’язково</span>
              <input value={crewNumber} onChange={(event) => setCrewNumber(event.target.value)} placeholder="Наприклад, ОМЕГА-101" />
              <small className="field-hint">{flow === 'start'
                ? 'Необов’язково. Заповнюється, якщо використовується у вашому підрозділі.'
                : 'Якщо номер екіпажу не вносився на початку зміни, залиште поле порожнім.'}</small>
            </label>
            {pilotStatus?.enabled && vehicles.length === 1 ? (
              <div className="readonly-field">
                <span>Службовий автомобіль</span>
                <strong>{formatVehicleLabel(vehicles[0])}</strong>
              </div>
            ) : pilotStatus?.enabled ? (
              <label>
                Службовий автомобіль
                <select value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)}>
                  <option value="">Оберіть автомобіль</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.plateNumber}>{formatVehicleLabel(vehicle)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Номер автомобіля / номерний знак
                <input value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="Наприклад, АА 1234 АА" />
              </label>
            )}
            <label>
              Коментар / проблема під час внесення даних <span className="optional-label">необов’язково</span>
              <textarea value={pilotComment} onChange={(event) => setPilotComment(event.target.value)} rows={3} placeholder="Наприклад, OCR неправильно розпізнав цифру" />
            </label>
            <OdometerInput
              key={flow}
              onSubmit={saveOdometer}
              submitLabel="Підтвердити"
              type={flow}
            />
          </section>
        )}

      </section>
    </main>
  );
}
