export function formatDate(value?: string | null, dateOnly = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uk-UA', dateOnly
    ? { dateStyle: 'short' }
    : { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatLiters(value?: number | null) {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} л`;
}

export function formatConsumption(value?: number | null) {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} л/100 км`;
}
