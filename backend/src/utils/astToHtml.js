const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

// Initialize DOMPurify with jsdom window for backend sanitization
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Escapes raw text for safe inclusion inside HTML attributes or code blocks.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates an anchor slug from a heading text.
 *
 * @param {string} text
 * @returns {string}
 */
function slugify(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Renders inline child nodes (bold, italic, code, strikethrough, link).
 *
 * @param {Array<Object>} children
 * @returns {string}
 */
function renderInlines(children = []) {
  if (!Array.isArray(children) || children.length === 0) return '';

  return children
    .map((child) => {
      if (!child) return '';
      const text = escapeHtml(child.content || child.text || '');
      const attrs = child.attributes || child.attrs || {};

      let result = text;

      if (attrs.bold) {
        result = `<strong>${result}</strong>`;
      }
      if (attrs.italic) {
        result = `<em>${result}</em>`;
      }
      if (attrs.strikethrough) {
        result = `<del>${result}</del>`;
      }
      if (attrs.code) {
        result = `<code class="inline-code">${result}</code>`;
      }
      if (attrs.link) {
        const safeHref = escapeHtml(attrs.link);
        result = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${result}</a>`;
      }

      return result;
    })
    .join('');
}

/**
 * Renders a single AST node into semantic HTML.
 *
 * @param {Object} node
 * @returns {string}
 */
/**
 * Returns the items of a list node. Uses nested children when present
 * (Markdown import); otherwise builds items from the block text, one per line
 * (lists typed in the editor).
 */
function getListItems(node, listType) {
  if (Array.isArray(node.children) && node.children.length > 0) return node.children;
  return String(node.content || node.text || '')
    .split('\n')
    .map((line) => line.trim().replace(/^([-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean)
    .map((line) => {
      const m = listType === 'check' ? line.match(/^\[([ xX])\]\s*(.*)$/) : null;
      return m
        ? { content: m[2], attributes: { checked: m[1].toLowerCase() === 'x' } }
        : { content: line, attributes: {} };
    });
}

function renderNode(node) {
  if (!node) return '';

  switch (node.type) {
    case 'root': {
      const children = Array.isArray(node.children) ? node.children : [];
      return children.map(renderNode).join('\n');
    }

    case 'heading': {
      const level = Math.min(
        Math.max(
          (node.attributes && node.attributes.level) ||
            (node.attrs && node.attrs.level) ||
            1,
          1
        ),
        6
      );
      const tag = `h${level}`;
      const innerContent =
        Array.isArray(node.children) && node.children.length > 0
          ? renderInlines(node.children)
          : escapeHtml(node.content || node.text || '');
      const slug = slugify(node.content || node.text || '');
      return `<${tag} id="${slug}" class="heading heading-${level}">${innerContent}</${tag}>`;
    }

    case 'paragraph': {
      const innerContent =
        Array.isArray(node.children) && node.children.length > 0
          ? renderInlines(node.children)
          : escapeHtml(node.content || node.text || '');
      return `<p class="paragraph">${innerContent}</p>`;
    }

    case 'code': {
      const lang = escapeHtml(
        (node.attributes && node.attributes.language) ||
          (node.attrs && node.attrs.language) ||
          'plaintext'
      );
      const rawCode = escapeHtml(node.content || node.text || '');
      return `<pre class="code-block language-${lang}"><div class="code-header"><span class="code-lang">${lang}</span></div><code>${rawCode}</code></pre>`;
    }

    case 'list': {
      const listType =
        (node.attributes && node.attributes.listType) ||
        (node.attrs && node.attrs.listType) ||
        'bullet';
      const items = getListItems(node, listType);

      if (listType === 'ordered') {
        const itemHtml = items
          .map((item) => {
            const content =
              Array.isArray(item.children) && item.children.length > 0
                ? renderInlines(item.children)
                : escapeHtml(item.content || item.text || '');
            return `<li class="ordered-item">${content}</li>`;
          })
          .join('\n');
        return `<ol class="ordered-list">\n${itemHtml}\n</ol>`;
      }

      if (listType === 'check') {
        const itemHtml = items
          .map((item) => {
            const isChecked = Boolean(
              (item.attributes && item.attributes.checked) ||
                (item.attrs && item.attrs.checked)
            );
            const content =
              Array.isArray(item.children) && item.children.length > 0
                ? renderInlines(item.children)
                : escapeHtml(item.content || item.text || '');
            return `<li class="task-item"><label class="task-label"><input type="checkbox" disabled ${
              isChecked ? 'checked' : ''
            } class="task-checkbox" /> <span class="task-text ${
              isChecked ? 'task-completed' : ''
            }">${content}</span></label></li>`;
          })
          .join('\n');
        return `<ul class="task-list">\n${itemHtml}\n</ul>`;
      }

      // Default: Bullet List
      const itemHtml = items
        .map((item) => {
          const content =
            Array.isArray(item.children) && item.children.length > 0
              ? renderInlines(item.children)
              : escapeHtml(item.content || item.text || '');
          return `<li class="bullet-item">${content}</li>`;
        })
        .join('\n');
      return `<ul class="bullet-list">\n${itemHtml}\n</ul>`;
    }

    case 'blockquote': {
      const innerContent =
        Array.isArray(node.children) && node.children.length > 0
          ? node.children.map(renderNode).join('\n')
          : `<p>${escapeHtml(node.content || node.text || '')}</p>`;
      return `<blockquote class="blockquote">${innerContent}</blockquote>`;
    }

    case 'divider': {
      return `<hr class="divider" />`;
    }

    case 'image': {
      const src = escapeHtml(
        (node.attributes && node.attributes.src) ||
          (node.attrs && node.attrs.src) ||
          ''
      );
      const alt = escapeHtml(
        (node.attributes && node.attributes.alt) ||
          (node.attrs && node.attrs.alt) ||
          node.content ||
          ''
      );
      const caption = escapeHtml(
        (node.attributes && node.attributes.caption) || alt
      );
      return `<figure class="image-wrapper"><img src="${src}" alt="${alt}" class="doc-image" />${
        caption ? `<figcaption class="image-caption">${caption}</figcaption>` : ''
      }</figure>`;
    }

    case 'text': {
      return escapeHtml(node.content || node.text || '');
    }

    case 'callout': {
      const calloutType = escapeHtml(
        (node.attributes && node.attributes.calloutType) || 'info'
      );
      // Map callout type to a semantic icon and label
      const iconMap = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };
      const icon = iconMap[calloutType] || 'ℹ️';
      const innerContent =
        Array.isArray(node.children) && node.children.length > 0
          ? node.children.map(renderNode).join('\n')
          : `<p>${escapeHtml(node.content || node.text || '')}</p>`;
      return `<div class="callout callout-${calloutType}" role="note">
  <span class="callout-icon" aria-hidden="true">${icon}</span>
  <div class="callout-body">${innerContent}</div>
</div>`;
    }

    default: {

      if (node.content || node.text) {
        return `<div class="custom-node">${escapeHtml(node.content || node.text)}</div>`;
      }
      return '';
    }
  }
}

/**
 * Returns default CSS styles optimized for both screen viewing and PDF print rendering.
 *
 * @returns {string} CSS styles
 */
function getDocumentStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', Consolas, Monaco, "Courier New", monospace;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --bg-color: #ffffff;
      --border-color: #e2e8f0;
      --accent-color: #2563eb;
      --code-bg: #0f172a;
      --code-text: #f8fafc;
      --quote-bg: #f8fafc;
      --quote-border: #3b82f6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-color);
      background-color: var(--bg-color);
      padding: 40px;
      max-width: 860px;
      margin: 0 auto;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    /* Document Header Banner */
    .document-banner {
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--border-color);
    }
    .document-title {
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 8px;
    }
    .document-meta {
      font-size: 13px;
      color: var(--text-muted);
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    /* Headings */
    .heading {
      color: #0f172a;
      font-weight: 600;
      margin-top: 28px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    .heading-1 {
      font-size: 26px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
      margin-top: 36px;
    }
    .heading-2 {
      font-size: 20px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 6px;
    }
    .heading-3 { font-size: 17px; }
    .heading-4 { font-size: 15px; }
    .heading-5 { font-size: 14px; }
    .heading-6 { font-size: 13px; color: var(--text-muted); }

    /* Paragraphs */
    .paragraph {
      margin-bottom: 14px;
      color: #334155;
    }

    /* Inlines */
    strong { font-weight: 600; color: #0f172a; }
    em { font-style: italic; }
    del { text-decoration: line-through; color: #94a3b8; }
    a {
      color: var(--accent-color);
      text-decoration: none;
      border-bottom: 1px dotted var(--accent-color);
    }
    a:hover {
      text-decoration: underline;
    }

    .inline-code {
      font-family: var(--font-mono);
      font-size: 0.88em;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    /* Code Blocks */
    .code-block {
      background-color: var(--code-bg);
      color: var(--code-text);
      border-radius: 8px;
      overflow: hidden;
      margin: 18px 0;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.6;
      page-break-inside: avoid;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .code-header {
      background-color: #1e293b;
      padding: 6px 14px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      border-bottom: 1px solid #334155;
    }
    .code-block code {
      display: block;
      padding: 14px 16px;
      overflow-x: auto;
      white-space: pre;
    }

    /* Lists */
    .bullet-list, .ordered-list {
      margin: 12px 0 16px 24px;
      color: #334155;
    }
    .bullet-item, .ordered-item {
      margin-bottom: 6px;
    }

    /* Task / Checklists */
    .task-list {
      list-style: none;
      padding-left: 4px;
      margin: 12px 0 16px 0;
    }
    .task-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .task-label {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: default;
    }
    .task-checkbox {
      width: 16px;
      height: 16px;
      accent-color: var(--accent-color);
    }
    .task-completed {
      text-decoration: line-through;
      color: #94a3b8;
    }

    /* Blockquotes */
    .blockquote {
      background-color: var(--quote-bg);
      border-left: 4px solid var(--quote-border);
      padding: 12px 18px;
      margin: 16px 0;
      border-radius: 0 6px 6px 0;
      color: #475569;
      font-style: italic;
      page-break-inside: avoid;
    }

    /* Dividers */
    .divider {
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 28px 0;
    }

    /* Images */
    .image-wrapper {
      margin: 20px 0;
      text-align: center;
      page-break-inside: avoid;
    }
    .doc-image {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
    }
    .image-caption {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
      font-style: italic;
    }

    /* Callouts */
    .callout {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 8px;
      margin: 18px 0;
      page-break-inside: avoid;
      border-left: 4px solid transparent;
    }
    .callout-icon { font-size: 18px; flex-shrink: 0; line-height: 1.6; }
    .callout-body { flex: 1; }
    .callout-body p { margin: 0; }
    .callout-info    { background: #eff6ff; border-color: #3b82f6; color: #1e40af; }
    .callout-warning { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
    .callout-success { background: #f0fdf4; border-color: #22c55e; color: #15803d; }
    .callout-error   { background: #fef2f2; border-color: #ef4444; color: #991b1b; }

    /* Print / PDF Page Formatting */

    @media print {
      body {
        padding: 0;
        max-width: 100%;
        color: #000;
        background: #fff;
      }
      .code-block {
        box-shadow: none;
        border: 1px solid #cbd5e1;
      }
      .heading {
        page-break-after: avoid;
      }
      .code-block, .blockquote, .image-wrapper {
        page-break-inside: avoid;
      }
      a {
        text-decoration: none;
        color: inherit;
        border-bottom: none;
      }
    }
  `;
}

/**
 * Transforms a SynDoc AST into a full, sanitized HTML document ready for PDF generation or web viewing.
 *
 * @param {Object} ast - Root ASTNode or array of children
 * @param {Object} [options={}]
 * @param {string} [options.title='SynDoc Document'] - Document title for the header
 * @param {string} [options.author=''] - Author metadata
 * @param {Date|string} [options.lastModified] - Last modified date
 * @param {boolean} [options.includeHeader=true] - Whether to render the header banner
 * @returns {string} Sanitized, complete HTML document
 */
function astToHtml(ast, options = {}) {
  const title = options.title || 'SynDoc Document';
  const author = options.author || options.lastModifiedBy || '';
  const lastModified = options.lastModified
    ? new Date(options.lastModified).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';
  const includeHeader = options.includeHeader !== false;

  const rawBodyHtml = renderNode(ast);

  // Sanitize the rendered HTML with DOMPurify to strip any malicious scripts or attributes
  const cleanBodyHtml = DOMPurify.sanitize(rawBodyHtml, {
    ADD_ATTR: ['target', 'disabled', 'checked', 'class', 'id', 'type'],
    ADD_TAGS: ['figure', 'figcaption', 'input']
  });

  const headerHtml = includeHeader
    ? `
    <header class="document-banner">
      <h1 class="document-title">${escapeHtml(title)}</h1>
      <div class="document-meta">
        ${author ? `<span><strong>Author:</strong> ${escapeHtml(author)}</span>` : ''}
        ${lastModified ? `<span><strong>Updated:</strong> ${escapeHtml(lastModified)}</span>` : ''}
      </div>
    </header>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${getDocumentStyles()}
  </style>
</head>
<body>
  ${headerHtml}
  <main class="document-content">
    ${cleanBodyHtml}
  </main>
</body>
</html>`;
}

module.exports = {
  astToHtml,
  renderNode,
  renderInlines,
  getDocumentStyles,
  escapeHtml
};
