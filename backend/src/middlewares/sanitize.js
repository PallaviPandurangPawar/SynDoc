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

module.exports = { sanitizeHtml, sanitizeMiddleware, DOMPurify };
