// Run with: npm run test:timeago   (needs no server and no database)
import { timeAgo } from './timeAgo.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

const now = new Date('2026-10-03T12:00:00Z').getTime();
const ago = (ms) => new Date(now - ms).toISOString();
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

check('a few seconds ago', timeAgo(ago(10 * SEC), now), 'just now');
check('right now', timeAgo(ago(0), now), 'just now');
check('a date in the future does not break', timeAgo(ago(-5 * MIN), now), 'just now');
check('one minute', timeAgo(ago(70 * SEC), now), '1 min ago');
check('five minutes', timeAgo(ago(5 * MIN), now), '5 min ago');
check('59 minutes', timeAgo(ago(59 * MIN), now), '59 min ago');
check('one hour', timeAgo(ago(60 * MIN), now), '1 h ago');
check('three hours', timeAgo(ago(3 * HOUR), now), '3 h ago');
check('one day', timeAgo(ago(24 * HOUR), now), '1 d ago');
check('six days', timeAgo(ago(6 * DAY), now), '6 d ago');
check('old dates show a real date', /2026|2025/.test(timeAgo(ago(30 * DAY), now)), true);
check('broken date gives empty text', timeAgo('not a date', now), '');
check('missing date gives empty text', timeAgo(undefined, now), '');

console.log(failed === 0 ? '\n✅ ALL TIME-AGO CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);