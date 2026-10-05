// How much time a file in the Trash has left before it is removed.
// Shows hours when less than a day is left (important for the 1-day setting),
// otherwise days.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function timeLeftLabel(deletedAt, retentionDays = 7, now = Date.now()) {
  const deleted = new Date(deletedAt).getTime();
  if (!Number.isFinite(deleted)) return '';

  const msLeft = deleted + (retentionDays || 7) * DAY - now;
  if (msLeft <= 0) return 'Being removed';

  const hours = Math.ceil(msLeft / HOUR);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} left`;

  const days = Math.ceil(msLeft / DAY);
  return `${days} day${days === 1 ? '' : 's'} left`;
}