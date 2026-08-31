export const UTC_TIME_ZONE = 'UTC';

export function formatOperationalTime(
  value: string | null,
  timeZone?: string | null,
  locale: 'en' | 'ar-SA' = 'en',
) {
  if (!value) return locale === 'ar-SA' ? 'غير مسجل' : 'Not recorded';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone ?? UTC_TIME_ZONE,
    timeZoneName: 'short',
  }).format(new Date(value));
}
