// Run with: npm run test:trashtime   (needs no server and no database)
import { timeLeftLabel } from './trashTime.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

const now = new Date('2026-10-03T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
const deletedAgo = (ms) => new Date(now - ms).toISOString();

check('1-day setting, just deleted', timeLeftLabel(deletedAgo(0), 1, now), '1 day left');
check('1-day setting, 10 hours later', timeLeftLabel(deletedAgo(10 * HOUR), 1, now), '14 hours left');
check('1-day setting, 23 hours later', timeLeftLabel(deletedAgo(23 * HOUR), 1, now), '1 hour left');
check('1-day setting, 30 minutes before the end', timeLeftLabel(deletedAgo(23.5 * HOUR), 1, now), '1 hour left');
check('1-day setting, time is up', timeLeftLabel(deletedAgo(25 * HOUR), 1, now), 'Being removed');
check('7-day setting, just deleted', timeLeftLabel(deletedAgo(0), 7, now), '7 days left');
check('7-day setting, after 2 days', timeLeftLabel(deletedAgo(2 * DAY), 7, now), '5 days left');
check('7-day setting, after 6.5 days', timeLeftLabel(deletedAgo(6.5 * DAY), 7, now), '12 hours left');
check('30-day setting', timeLeftLabel(deletedAgo(1 * DAY), 30, now), '29 days left');
check('missing retention falls back to 7 days', timeLeftLabel(deletedAgo(0), undefined, now), '7 days left');
check('broken date gives empty text', timeLeftLabel('nope', 7, now), '');

console.log(failed === 0 ? '\n✅ ALL TRASH-TIME CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);