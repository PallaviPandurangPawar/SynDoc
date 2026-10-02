// Run with: npm run test:cursor   (needs no server and no database)
import { splitAtCursor, cursorsInBlock } from './cursorMath.js';

let failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

check('caret in the middle', splitAtCursor('Hello world', { start: 5, end: 5 }), { before: 'Hello', selected: '', after: ' world' });
check('selection', splitAtCursor('Hello world', { start: 6, end: 11 }), { before: 'Hello ', selected: 'world', after: '' });
check('backwards selection', splitAtCursor('Hello world', { start: 11, end: 6 }), { before: 'Hello ', selected: 'world', after: '' });
check('end missing means caret', splitAtCursor('Hello', { start: 2 }), { before: 'He', selected: '', after: 'llo' });
check('position past the end is limited', splitAtCursor('Hi', { start: 50, end: 80 }), { before: 'Hi', selected: '', after: '' });
check('negative or broken position is limited', splitAtCursor('Hi', { start: -4, end: 'x' }), { before: '', selected: '', after: 'Hi' });
check('empty text', splitAtCursor('', { start: 3, end: 3 }), { before: '', selected: '', after: '' });
check('missing cursor', splitAtCursor('abc', null), { before: '', selected: '', after: 'abc' });
check('emoji is not cut in half', splitAtCursor('a😀b', { start: 2, end: 2 }), { before: 'a', selected: '', after: '😀b' });

const users = [
  { socketId: 'me', name: 'Me', cursor: { nodeId: 'n1', start: 1, end: 1 } },
  { socketId: 'a', name: 'Alice', cursor: { nodeId: 'n1', start: 2, end: 4 } },
  { socketId: 'b', name: 'Bob', cursor: { nodeId: 'n2', start: 0, end: 0 } },
  { socketId: 'c', name: 'Carol', cursor: null }
];
check('only other people in this block', cursorsInBlock(users, 'n1', 'me').map((u) => u.name), ['Alice']);
check('nobody in an empty block', cursorsInBlock(users, 'n9', 'me'), []);
check('no user list', cursorsInBlock(undefined, 'n1', 'me'), []);

console.log(failed === 0 ? '\n✅ ALL CURSOR CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);