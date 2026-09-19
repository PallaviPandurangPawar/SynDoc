/**
 * Converts a SyncDoc AST (array of nodes, or a single root node) into an HTML string.
 * Pure, synchronous, no DB or network access — sanitization happens separately.
 */

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nodeText(node) {
  return node.content || node.text || '';
}

function applyInlineFormatting(text, attrs = {}) {
  let html = escapeHtml(text);
  if (attrs.code) html = `<code>${html}</code>`;
  if (attrs.bold) html = `<strong>${html}</strong>`;
  if (attrs.italic) html = `<em>${html}</em>`;
  if (attrs.underline) html = `<u>${html}</u>`;
  if (attrs.strikethrough) html = `<s>${html}</s>`;
  if (attrs.link) html = `<a href="${escapeHtml(attrs.link)}">${html}</a>`;
  return html;
}

function renderNode(node) {
  if (!node || typeof node !== 'object') return '';

  const attrs = node.attributes || node.attrs || {};
  const text = nodeText(node);
  const childrenHtml = Array.isArray(node.children)
    ? node.children.map(renderNode).join('')
    : '';

  switch (node.type) {
    case 'root':
      return childrenHtml;

    case 'heading': {
      const level = attrs.level && attrs.level >= 1 && attrs.level <= 6 ? attrs.level : 1;
      return `<h${level}>${applyInlineFormatting(text, attrs)}${childrenHtml}</h${level}>`;
    }

    case 'paragraph':
      return `<p>${applyInlineFormatting(text, attrs)}${childrenHtml}</p>`;

    case 'code':
      return `<pre><code${attrs.language ? ` class="language-${escapeHtml(attrs.language)}"` : ''}>${escapeHtml(text)}</code></pre>`;

    case 'blockquote':
      return `<blockquote>${applyInlineFormatting(text, attrs)}${childrenHtml}</blockquote>`;

    case 'list': {
      const tag = attrs.listType === 'ordered' ? 'ol' : 'ul';
      return `<${tag}>${childrenHtml}</${tag}>`;
    }

    case 'listItem':
    case 'list-item': {
      const checkbox =
        attrs.listType === 'check'
          ? `<input type="checkbox" disabled ${attrs.checked ? 'checked' : ''} /> `
          : '';
      return `<li>${checkbox}${applyInlineFormatting(text, attrs)}${childrenHtml}</li>`;
    }

    case 'image':
      return `<figure><img src="${escapeHtml(attrs.src || '')}" alt="${escapeHtml(attrs.alt || '')}" />${
        attrs.caption ? `<figcaption>${escapeHtml(attrs.caption)}</figcaption>` : ''
      }</figure>`;

    case 'divider':
      return '<hr />';

    case 'callout': {
      const calloutType = attrs.calloutType || 'info';
      return `<div class="callout callout-${escapeHtml(calloutType)}">${applyInlineFormatting(text, attrs)}${childrenHtml}</div>`;
    }

    case 'text':
      return applyInlineFormatting(text, attrs);

    default:
      return childrenHtml;
  }
}

/**
 * Converts a document's AST into a full HTML fragment.
 * @param {Array|Object} ast - either document.content (array of nodes) or document.ast (root node)
 * @returns {string} raw (unsanitized) HTML
 */
function astToHtml(ast) {
  if (Array.isArray(ast)) {
    return ast.map(renderNode).join('\n');
  }
  return renderNode(ast);
}

module.exports = { astToHtml, renderNode, escapeHtml };
