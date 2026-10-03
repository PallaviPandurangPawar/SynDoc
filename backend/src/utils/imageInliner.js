// Makes exports self-contained: every picture that is linked from the web is
// downloaded by the SERVER and placed inside the document as embedded data.
//
// Why: the PDF is printed by a headless Chrome on the server. Many image sites
// refuse requests from such a browser (no referrer, "HeadlessChrome" in its name)
// or they are slow, so the picture came out as a broken-image icon. Downloading
// the picture ourselves, with normal request headers, fixes that and also makes
// the exported HTML work offline.
//
// Safety: the server is fetching addresses typed by users, so it must never be
// tricked into reaching private or internal addresses (SSRF). Every connection
// is checked (including redirects), only real pictures (PNG, JPEG, GIF, WebP)
// are accepted, and size, time and count are limited.
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per picture
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_IMAGES = 20;

// ───────── Blocking private and internal addresses ─────────

function isPrivateIPv4(ip) {
  const [a, b, c] = ip.split('.').map(Number);
  return (
    a === 0 ||                                  // "this" network
    a === 10 ||                                 // private
    a === 127 ||                                // loopback (this computer)
    (a === 100 && b >= 64 && b <= 127) ||       // shared address space
    (a === 169 && b === 254) ||                 // link-local (cloud metadata lives here)
    (a === 172 && b >= 16 && b <= 31) ||        // private
    (a === 192 && b === 0 && c === 0) ||        // reserved
    (a === 192 && b === 168) ||                 // private
    (a === 198 && (b === 18 || b === 19)) ||    // benchmarking
    a >= 224                                    // multicast, reserved, broadcast
  );
}

function isPrivateAddress(address) {
  const ip = String(address || '').replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();

  if (net.isIPv4(ip)) return isPrivateIPv4(ip);

  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    // IPv4 hidden inside IPv6, for example ::ffff:127.0.0.1 or ::ffff:7f00:1
    const mapped = ip.match(/^(?:0:0:0:0:0:ffff:|::ffff:)(.+)$/);
    if (mapped) {
      const rest = mapped[1];
      if (net.isIPv4(rest)) return isPrivateIPv4(rest);
      const hex = rest.split(':');
      if (hex.length === 2) {
        const hi = parseInt(hex[0], 16);
        const lo = parseInt(hex[1], 16);
        return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
      }
      return true;
    }
    return (
      /^f[cd]/.test(ip) ||        // unique local fc00::/7
      /^fe[89ab]/.test(ip) ||     // link-local fe80::/10
      /^ff/.test(ip) ||           // multicast
      ip.startsWith('2001:db8')   // documentation
    );
  }
  return true; // anything we cannot understand is refused
}

// Used for every connection: looks the name up and refuses private results.
// Checking here (at connection time) also defeats "DNS rebinding" tricks.
function makeSafeLookup(allowPrivateHosts) {
  return function safeLookup(hostname, options, callback) {
    dns.lookup(hostname, options, (err, address, family) => {
      if (err) return callback(err);
      if (!allowPrivateHosts) {
        const list = Array.isArray(address) ? address.map((entry) => entry.address) : [address];
        if (list.some(isPrivateAddress)) {
          return callback(new Error('Blocked: address is private or internal'));
        }
      }
      return callback(null, address, family);
    });
  };
}

// ───────── Recognising real pictures ─────────

// Looks at the first bytes of the file, not at what the server claims it is.
// (SVG is deliberately not accepted, because it can contain scripts.)
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.slice(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

// ───────── Downloading ─────────

function fetchImage(urlString, options = {}, redirectsLeft = MAX_REDIRECTS) {
  const maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
  const timeoutMs = options.timeoutMs || TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      return reject(new Error('Not a valid address'));
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return reject(new Error('Only http and https addresses are allowed'));
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!options.allowPrivateHosts && net.isIP(host) && isPrivateAddress(host)) {
      return reject(new Error('Blocked: address is private or internal'));
    }

    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(
      url,
      {
        method: 'GET',
        lookup: makeSafeLookup(options.allowPrivateHosts),
        timeout: timeoutMs,
        headers: {
          // Looks like a normal browser request, so picture sites do not refuse it
          'User-Agent': 'Mozilla/5.0 (compatible; SyncDocExport/1.0)',
          Accept: 'image/png,image/jpeg,image/gif,image/webp,*/*;q=0.5',
          Referer: `${url.origin}/`
        }
      },
      (response) => {
        const status = response.statusCode;

        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          response.resume();
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          let next;
          try {
            next = new URL(response.headers.location, url).toString();
          } catch (e) {
            return reject(new Error('Bad redirect'));
          }
          return resolve(fetchImage(next, options, redirectsLeft - 1)); // checked again on the new address
        }

        if (status !== 200) {
          response.resume();
          return reject(new Error(`The image site answered with status ${status}`));
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          response.resume();
          return reject(new Error('Image is too large'));
        }

        const chunks = [];
        let total = 0;
        response.on('data', (chunk) => {
          total += chunk.length;
          if (total > maxBytes) {
            request.destroy(new Error('Image is too large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const type = detectImageType(buffer);
          if (!type) return reject(new Error('The address is not a PNG, JPEG, GIF or WebP picture'));
          return resolve({ buffer, type });
        });
        response.on('error', reject);
      }
    );

    request.on('timeout', () => request.destroy(new Error('The image site took too long to answer')));
    request.on('error', reject);
    request.end();
  });
}

// ───────── Using it on a document ─────────

function srcOf(node) {
  const attrs = node.attributes || node.attrs || {};
  return typeof attrs.src === 'string' ? attrs.src.trim() : '';
}

function collectWebImages(node, found) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child) => collectWebImages(child, found));
    return;
  }
  if (node.type === 'image' && /^https?:\/\//i.test(srcOf(node))) found.push(node);
  if (Array.isArray(node.children)) node.children.forEach((child) => collectWebImages(child, found));
}

/**
 * Returns a COPY of the document where every web picture is embedded.
 * A picture that cannot be loaded becomes a short readable note instead of a
 * broken-image icon. The original document is never changed.
 */
async function inlineImages(ast, options = {}) {
  if (!ast) return ast;
  const copy = JSON.parse(JSON.stringify(ast));

  const nodes = [];
  collectWebImages(copy, nodes);
  if (nodes.length === 0) return copy;

  const urls = [...new Set(nodes.map(srcOf))].slice(0, options.maxImages || MAX_IMAGES);
  const loaded = new Map(); // url -> data address, or null when it failed

  await Promise.all(
    urls.map(async (url) => {
      try {
        const { buffer, type } = await fetchImage(url, options);
        loaded.set(url, `data:${type};base64,${buffer.toString('base64')}`);
      } catch (error) {
        loaded.set(url, null);
        let host = url;
        try { host = new URL(url).host; } catch (e) { /* keep the raw text */ }
        console.warn(`⚠️ [Export] Could not load an image from ${host}: ${error.message}`);
      }
    })
  );

  nodes.forEach((node) => {
    const url = srcOf(node);
    const dataAddress = loaded.get(url);
    if (dataAddress) {
      if (node.attributes) node.attributes.src = dataAddress;
      if (node.attrs) node.attrs.src = dataAddress;
      return;
    }

    const attrs = node.attributes || node.attrs || {};
    const caption = attrs.caption || attrs.alt || node.content || '';
    const note = `[Image could not be loaded${caption ? `: ${caption}` : ''}] ${url}`;
    node.type = 'paragraph';
    node.content = note;
    node.text = note;
    node.attributes = {};
    node.attrs = undefined;
    node.children = [];
  });

  return copy;
}

module.exports = { inlineImages, fetchImage, isPrivateAddress, detectImageType };