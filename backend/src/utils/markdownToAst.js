const crypto = require('crypto');

/**
 * Generates a unique node ID (UUID v4)
 */
function generateNodeId() {
  return crypto.randomUUID();
}

/**
 * Parses inline formatting within text (bold, italic, inline code, links, strikethrough)
 * and returns an array of inline text ASTNode objects.
 *
 * @param {string} text
 * @returns {Array<Object>}
 */
function parseInlineContent(text) {
  if (!text || typeof text !== 'string') return [];

  const nodes = [];
  // Tokenize regex for inline elements:
  // 1: Link [text](url)
  // 2: Bold **text** or __text__
  // 3: Strikethrough ~~text~~
  // 4: Inline code `text`
  // 5: Italic *text* or _text_
  const inlineRegex =
    /(\[(.+?)\]\((https?:\/\/[^\s)]+|[^\s)]+)\))|(\*\*(.+?)\*\*|__(.+?)__)|(~~(.+?)~~)|(`([^`]+)`)|(\*([^*]+)\*|_([^_]+)_)/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Append any preceding plain text
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) {
        nodes.push({
          nodeId: generateNodeId(),
          type: 'text',
          content: plain,
          text: plain,
          attributes: {},
          children: []
        });
      }
    }

    if (match[1]) {
      // Link: [text](url)
      const linkText = match[2];
      const linkUrl = match[3];
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: linkText,
        text: linkText,
        attributes: { link: linkUrl },
        children: []
      });
    } else if (match[4]) {
      // Bold: **text** or __text__
      const boldText = match[5] || match[6];
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: boldText,
        text: boldText,
        attributes: { bold: true },
        children: []
      });
    } else if (match[7]) {
      // Strikethrough: ~~text~~
      const strikeText = match[8];
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: strikeText,
        text: strikeText,
        attributes: { strikethrough: true },
        children: []
      });
    } else if (match[9]) {
      // Inline code: `text`
      const codeText = match[10];
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: codeText,
        text: codeText,
        attributes: { code: true },
        children: []
      });
    } else if (match[11]) {
      // Italic: *text* or _text_
      const italicText = match[12] || match[13];
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: italicText,
        text: italicText,
        attributes: { italic: true },
        children: []
      });
    }

    lastIndex = inlineRegex.lastIndex;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      nodes.push({
        nodeId: generateNodeId(),
        type: 'text',
        content: remaining,
        text: remaining,
        attributes: {},
        children: []
      });
    }
  }

  return nodes.length > 0
    ? nodes
    : [
        {
          nodeId: generateNodeId(),
          type: 'text',
          content: text,
          text,
          attributes: {},
          children: []
        }
      ];
}

/**
 * Converts a raw Markdown string into SynDoc's recursive AST Node tree.
 *
 * @param {string} markdown - Raw markdown string
 * @returns {Object} Root ASTNode conforming to ASTNodeSchema
 */
function markdownToAst(markdown = '') {
  const rootNode = {
    nodeId: generateNodeId(),
    type: 'root',
    content: '',
    text: '',
    attributes: {},
    metadata: {},
    children: []
  };

  if (!markdown || typeof markdown !== 'string') {
    return rootNode;
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed.length === 0) {
      i++;
      continue;
    }

    // 1. Fenced Code Block: ```lang
    if (trimmed.startsWith('```')) {
      const langMatch = trimmed.match(/^```(\w+)?/);
      const language = langMatch && langMatch[1] ? langMatch[1].toLowerCase() : 'plaintext';
      const codeLines = [];
      i++;

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }

      const codeContent = codeLines.join('\n');
      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'code',
        content: codeContent,
        text: codeContent,
        attrs: { language },
        attributes: { language },
        children: []
      });
      continue;
    }

    // 2. Heading: # to ######
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      const inlines = parseInlineContent(headingText);

      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'heading',
        content: headingText,
        text: headingText,
        attrs: { level },
        attributes: { level },
        children: inlines
      });
      i++;
      continue;
    }

    // 3. Horizontal Rule / Divider: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'divider',
        content: '',
        text: '',
        attributes: {},
        children: []
      });
      i++;
      continue;
    }

    // 4. Blockquote: > text
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteContent = quoteLines.join(' ');
      const inlines = parseInlineContent(quoteContent);

      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'blockquote',
        content: quoteContent,
        text: quoteContent,
        attributes: {},
        children: [
          {
            nodeId: generateNodeId(),
            type: 'paragraph',
            content: quoteContent,
            text: quoteContent,
            attributes: {},
            children: inlines
          }
        ]
      });
      continue;
    }

    // 5. Image: ![alt](url)
    const imageMatch = trimmed.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1];
      const src = imageMatch[2];
      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'image',
        content: alt,
        text: alt,
        attributes: { src, alt, caption: alt },
        children: []
      });
      i++;
      continue;
    }

    // 6. Lists (Unordered, Ordered, Checklist)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (bulletMatch || orderedMatch) {
      const isOrdered = Boolean(orderedMatch);
      const firstItemText = bulletMatch ? bulletMatch[1] : orderedMatch[2];
      const firstItemIsChecklist = /^\[([ xX])\]\s+/.test(firstItemText);
      const listType = isOrdered ? 'ordered' : firstItemIsChecklist ? 'check' : 'bullet';
      const listNode = {
        nodeId: generateNodeId(),
        type: 'list',
        content: '',
        text: '',
        attributes: { listType },
        children: []
      };

      while (i < lines.length) {
        const curLine = lines[i].trim();
        const curBullet = curLine.match(/^[-*+]\s+(.*)$/);
        const curOrdered = curLine.match(/^(\d+)\.\s+(.*)$/);

        if (!curBullet && !curOrdered) break;

        let rawItemText = curBullet ? curBullet[1] : curOrdered[2];
        const checkMatch = rawItemText.match(/^\[([ xX])\]\s+(.*)$/);
        const currentListType = curOrdered ? 'ordered' : checkMatch ? 'check' : 'bullet';
        if (currentListType !== listType) break;

        let isChecked = undefined;
        let itemType = 'listItem';

        // Check for task checklist: [ ] or [x]
        if (checkMatch) {
          isChecked = checkMatch[1].toLowerCase() === 'x';
          rawItemText = checkMatch[2];
        }

        const itemInlines = parseInlineContent(rawItemText);
        const itemNode = {
          nodeId: generateNodeId(),
          type: itemType,
          content: rawItemText,
          text: rawItemText,
          attributes: isChecked !== undefined ? { checked: isChecked } : {},
          children: itemInlines
        };

        listNode.children.push(itemNode);
        i++;
      }

      rootNode.children.push(listNode);
      continue;
    }

    // 7. Regular Paragraph (can span consecutive non-empty lines)
    const paraLines = [];
    while (i < lines.length) {
      const current = lines[i];
      const curTrimmed = current.trim();
      if (
        curTrimmed.length === 0 ||
        curTrimmed.startsWith('```') ||
        curTrimmed.match(/^#{1,6}\s+/) ||
        /^(\-{3,}|\*{3,}|_{3,})$/.test(curTrimmed) ||
        curTrimmed.startsWith('>') ||
        curTrimmed.match(/^[-*+]\s+/) ||
        curTrimmed.match(/^\d+\.\s+/)
      ) {
        break;
      }
      paraLines.push(curTrimmed);
      i++;
    }

    if (paraLines.length > 0) {
      const paraText = paraLines.join(' ');
      const inlines = parseInlineContent(paraText);
      rootNode.children.push({
        nodeId: generateNodeId(),
        type: 'paragraph',
        content: paraText,
        text: paraText,
        attributes: {},
        children: inlines
      });
    }
  }

  return rootNode;
}

/**
 * Converts a SynDoc AST tree back into standard Markdown.
 *
 * @param {Object} ast - Root ASTNode or array of ASTNodes
 * @returns {string} Markdown text
 */
function astToMarkdown(ast) {
  if (!ast) return '';
  const children = Array.isArray(ast) ? ast : Array.isArray(ast.children) ? ast.children : [];

  const mdBlocks = [];

  for (const node of children) {
    if (!node) continue;

    switch (node.type) {
      case 'heading': {
        const level =
          (node.attributes && node.attributes.level) ||
          (node.attrs && node.attrs.level) ||
          1;
        const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6));
        mdBlocks.push(`${prefix} ${node.content || node.text || ''}`);
        break;
      }

      case 'code': {
        const lang =
          (node.attributes && node.attributes.language) ||
          (node.attrs && node.attrs.language) ||
          '';
        mdBlocks.push(`\`\`\`${lang}\n${node.content || node.text || ''}\n\`\`\``);
        break;
      }

      case 'paragraph': {
        // If it has children with formatting, serialize them; else use plain content
        if (Array.isArray(node.children) && node.children.length > 0) {
          const inlineParts = node.children.map((child) => {
            let t = child.content || child.text || '';
            const attrs = child.attributes || child.attrs || {};
            if (attrs.bold) t = `**${t}**`;
            if (attrs.italic) t = `*${t}*`;
            if (attrs.strikethrough) t = `~~${t}~~`;
            if (attrs.code) t = `\`${t}\``;
            if (attrs.link) t = `[${t}](${attrs.link})`;
            return t;
          });
          mdBlocks.push(inlineParts.join(''));
        } else {
          mdBlocks.push(node.content || node.text || '');
        }
        break;
      }

      case 'blockquote': {
        const text = node.content || node.text || '';
        mdBlocks.push(`> ${text}`);
        break;
      }

      case 'divider': {
        mdBlocks.push('---');
        break;
      }

      case 'image': {
        const attrs = node.attributes || {};
        mdBlocks.push(`![${attrs.alt || node.content || ''}](${attrs.src || ''})`);
        break;
      }

      case 'list': {
        const listType =
          (node.attributes && node.attributes.listType) || 'bullet';
        const items = Array.isArray(node.children) ? node.children : [];
        const listLines = items.map((item, idx) => {
          const text = item.content || item.text || '';
          if (listType === 'ordered') {
            return `${idx + 1}. ${text}`;
          } else if (listType === 'check') {
            const checked = item.attributes && item.attributes.checked ? 'x' : ' ';
            return `- [${checked}] ${text}`;
          }
          return `- ${text}`;
        });
        mdBlocks.push(listLines.join('\n'));
        break;
      }

      default: {
        if (node.content || node.text) {
          mdBlocks.push(node.content || node.text);
        }
        break;
      }
    }
  }

  return mdBlocks.join('\n\n');
}

module.exports = {
  markdownToAst,
  astToMarkdown,
  parseInlineContent,
  generateNodeId
};
