const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'u', 's', 'code', 'pre',
  'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'div',
  'span', 'input', 'br'
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'class', 'type', 'checked', 'disabled'];

/**
 * Sanitizes raw HTML, stripping any script tags, event handlers, or
 * other XSS-capable fragments before it's ever persisted or rendered.
 */
function sanitizeHtml(rawHtml) {
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/**
 * Express middleware version: sanitizes req.body.html in place, if present.
 */
function sanitizeMiddleware(req, res, next) {
  if (req.body && typeof req.body.html === 'string') {
    req.body.html = sanitizeHtml(req.body.html);
  }
  next();
}

// ─── Saved-block sanitizing (Week 4: security hardening) ─────────────────────

// Only these kinds of web addresses may be saved in a block
const SAFE_LINK = /^(https?:|mailto:|tel:|#|\/(?!\/))/i;
const SAFE_IMAGE = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);base64,)/i;
const SAFE_LANGUAGE = /^[a-z0-9+#._-]{1,30}$/i;

/**
 * Turns user text into safe plain text: every HTML tag is removed (scripts and
 * their contents are dropped completely), then the leftover text is decoded
 * back so characters like "<" and "&" are not saved as "&lt;" / "&amp;".
 */
function toPlainText(raw) {
  if (typeof raw !== 'string' || !raw.includes('<')) return raw;

  const cleaned = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  const decoder = window.document.createElement('textarea');
  decoder.innerHTML = cleaned;
  return decoder.value;
}

function sanitizeAttributes(attrs) {
  if (!attrs || typeof attrs !== 'object') return;

  if (typeof attrs.src === 'string' && attrs.src && !SAFE_IMAGE.test(attrs.src.trim())) {
    attrs.src = '';
  }
  if (typeof attrs.link === 'string' && attrs.link && !SAFE_LINK.test(attrs.link.trim())) {
    attrs.link = null;
  }
  for (const key of ['alt', 'caption']) {
    if (typeof attrs[key] === 'string') {
      const clean = toPlainText(attrs[key]);
      if (clean !== attrs[key]) attrs[key] = clean;
    }
  }
  if (typeof attrs.language === 'string' && !SAFE_LANGUAGE.test(attrs.language)) {
    attrs.language = 'plaintext';
  }
}

/**
 * Cleans one AST node (and all its children) IN PLACE. Works on plain objects
 * and on Mongoose subdocuments. Code blocks keep their text exactly as typed,
 * because it is always escaped when displayed or exported.
 */
function sanitizeNode(node) {
  if (!node || typeof node !== 'object') return node;

  if (node.type !== 'code') {
    for (const field of ['content', 'text']) {
      if (typeof node[field] === 'string') {
        const clean = toPlainText(node[field]);
        if (clean !== node[field]) node[field] = clean;
      }
    }
  }

  sanitizeAttributes(node.attributes);
  sanitizeAttributes(node.attrs);

  if (node.children && typeof node.children.forEach === 'function') {
    node.children.forEach(sanitizeNode);
  }
  return node;
}

/**
 * Returns a sanitized COPY of a content array (the original is left untouched,
 * which matters for the live Yjs data).
 */
function sanitizeDocumentContent(content) {
  if (!Array.isArray(content)) return content;
  const copy = JSON.parse(JSON.stringify(content));
  copy.forEach(sanitizeNode);
  return copy;
}

module.exports = {
  sanitizeHtml,
  sanitizeMiddleware,
  DOMPurify,
  toPlainText,
  sanitizeNode,
  sanitizeDocumentContent,
};