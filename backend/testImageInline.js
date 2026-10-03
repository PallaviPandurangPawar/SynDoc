// Checks that pictures linked from the web end up inside exported documents,
// including sites that block "hotlinking", and that the server cannot be tricked
// into reaching private addresses. Needs no database and no internet.
const http = require('http');
const { inlineImages, fetchImage, isPrivateAddress } = require('./src/utils/imageInliner');
const { astToHtml } = require('./src/utils/astToHtml');

let failed = 0;
function check(name, ok, extra = '') {
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ` ${extra}`}`);
}

// A real 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  const hits = {}; // how many times each path was requested

  // A small web server that behaves like different kinds of picture sites
  const server = http.createServer((req, res) => {
    hits[req.url] = (hits[req.url] || 0) + 1;
    const origin = `http://${req.headers.host}/`;

    if (req.url === '/ok.png') return res.writeHead(200, { 'Content-Type': 'image/png' }).end(PNG);
    if (req.url === '/hotlink.png') {
      // Refuses requests that do not come from its own pages (like many wallpaper sites)
      if (req.headers.referer !== origin) return res.writeHead(403).end('hotlinking not allowed');
      return res.writeHead(200, { 'Content-Type': 'image/png' }).end(PNG);
    }
    if (req.url === '/redirect.png') return res.writeHead(302, { Location: '/ok.png' }).end();
    if (req.url === '/loop.png') return res.writeHead(302, { Location: '/loop.png' }).end();
    if (req.url === '/page.png') return res.writeHead(200, { 'Content-Type': 'image/png' }).end('<html><script>alert(1)</script></html>');
    if (req.url === '/vector.svg') return res.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    if (req.url === '/big.png') return res.writeHead(200, { 'Content-Type': 'image/png' }).end(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]));
    if (req.url === '/slow.png') return; // never answers
    return res.writeHead(404).end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const local = { allowPrivateHosts: true }; // only this test server is on a private address

  // ── Address safety ──
  const blocked = ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.16.5.5', '172.31.255.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1'];
  const allowed = ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'];
  check('private and internal addresses are recognised', blocked.every(isPrivateAddress), blocked.filter((a) => !isPrivateAddress(a)).join(', '));
  check('normal public addresses are allowed', allowed.every((a) => !isPrivateAddress(a)), allowed.filter(isPrivateAddress).join(', '));

  let message = '';
  await fetchImage(`${base}/ok.png`).catch((e) => { message = e.message; });
  check('the server refuses to fetch from its own computer (127.0.0.1)', /Blocked/.test(message), message);
  message = '';
  await fetchImage('http://localhost:1/x.png').catch((e) => { message = e.message; });
  check('"localhost" is refused too', /Blocked/.test(message), message);
  message = '';
  await fetchImage('http://169.254.169.254/latest/meta-data/').catch((e) => { message = e.message; });
  check('the cloud metadata address is refused', /Blocked/.test(message), message);
  message = '';
  await fetchImage('file:///etc/passwd').catch((e) => { message = e.message; });
  check('file:// addresses are refused', /http and https/.test(message), message);

  // ── Downloading ──
  const ok = await fetchImage(`${base}/ok.png`, local);
  check('a normal picture is downloaded', ok.type === 'image/png' && ok.buffer.length === PNG.length);

  const hot = await fetchImage(`${base}/hotlink.png`, local).catch((e) => e);
  check('a site that blocks hotlinking still works (correct referrer sent)', hot && hot.type === 'image/png', hot && hot.message);

  const redirected = await fetchImage(`${base}/redirect.png`, local).catch((e) => e);
  check('a redirect is followed', redirected && redirected.type === 'image/png', redirected && redirected.message);

  message = '';
  await fetchImage(`${base}/loop.png`, local).catch((e) => { message = e.message; });
  check('an endless redirect loop is stopped', /redirect/i.test(message), message);

  message = '';
  await fetchImage(`${base}/page.png`, local).catch((e) => { message = e.message; });
  check('a web page pretending to be a picture is refused', /not a PNG/.test(message), message);

  message = '';
  await fetchImage(`${base}/vector.svg`, local).catch((e) => { message = e.message; });
  check('SVG (can contain scripts) is refused', /not a PNG/.test(message), message);

  message = '';
  await fetchImage(`${base}/big.png`, { ...local, maxBytes: 1024 * 1024 }).catch((e) => { message = e.message; });
  check('a picture over the size limit is refused', /too large/.test(message), message);

  message = '';
  await fetchImage(`${base}/slow.png`, { ...local, timeoutMs: 300 }).catch((e) => { message = e.message; });
  check('a site that never answers times out', /too long/.test(message), message);

  message = '';
  await fetchImage(`${base}/missing.png`, local).catch((e) => { message = e.message; });
  check('a missing picture gives a clear error', /404/.test(message), message);

  // ── On a whole document ──
  const imageNode = (url, extra = {}) => ({ nodeId: url, type: 'image', content: 'caption', attributes: { src: url, caption: 'My picture', ...extra }, children: [] });
  const ast = {
    type: 'root',
    children: [
      { type: 'heading', content: 'Title', attributes: { level: 1 }, children: [] },
      imageNode(`${base}/hotlink.png`),
      imageNode(`${base}/hotlink.png`),              // same picture twice
      imageNode(`${base}/page.png`),                 // fails
      imageNode('data:image/png;base64,AAAA'),       // already embedded
      { type: 'paragraph', content: 'text', attributes: {}, children: [] }
    ]
  };
  const before = JSON.stringify(ast);
  hits['/hotlink.png'] = 0;
  const result = await inlineImages(ast, local);

  check('the original document is not changed', JSON.stringify(ast) === before);
  check('a web picture is replaced by embedded data', result.children[1].attributes.src.startsWith('data:image/png;base64,'));
  check('the same picture is downloaded only once', hits['/hotlink.png'] === 1, `(downloaded ${hits['/hotlink.png']} times)`);
  check('a picture that fails becomes a readable note', result.children[3].type === 'paragraph' && /could not be loaded: My picture/.test(result.children[3].content));
  check('a picture that is already embedded is left alone', result.children[4].attributes.src === 'data:image/png;base64,AAAA');
  check('other blocks are unchanged', result.children[0].content === 'Title' && result.children[5].content === 'text');

  const html = astToHtml(result, { title: 'T' });
  check('the exported HTML contains the embedded picture', html.includes('<img src="data:image/png;base64,'));
  check('the exported HTML no longer depends on the website', !html.includes(`${base}/hotlink.png`));
  check('the failed picture shows a note in the HTML', html.includes('Image could not be loaded'));

  server.close();
  console.log(failed === 0 ? '\n✅ ALL IMAGE EXPORT CHECKS PASSED' : `\n❌ ${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ Test crashed:', err); process.exit(1); });