// Simple markdown-to-HTML converter for static chat messages.
// Supports: **bold**, _italic_, # headings, ---, - bullet lists, 1. numbered lists, line breaks.
// Output is sanitised (no user input ever passes through here — only config data).

const EMOJI_PREFIX = /^[✅⏳❌🏥💰📚🏠🎯🔔📋]/u;

const parseBold = (text) =>
  text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

const parseItalic = (text) =>
  text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

const parseLinks = (text) =>
  text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) =>
      /^https?:\/\//.test(href)
        ? `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`
        : `<a href="${href}" class="esc-inline-link">${label}</a>`,
  );

export const parseMarkdown = (raw) => {
  const lines = raw.split('\n');
  const output = [];
  let listBuffer = [];
  let listType = null; // 'ul' | 'ol'

  const flushList = () => {
    if (listBuffer.length) {
      output.push(`<${listType}>${listBuffer.join('')}</${listType}>`);
      listBuffer = [];
      listType = null;
    }
  };

  for (const line of lines) {
    if (line === '') {
      flushList();
      output.push('<br/>');
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList();
      output.push('<hr class="md-hr"/>');
      continue;
    }

    // ATX headings  # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text  = parseLinks(parseBold(headingMatch[2]));
      output.push(`<h${level} class="md-h${level}">${text}</h${level}>`);
      continue;
    }

    const renderInline = (t) => parseLinks(parseItalic(parseBold(t)));

    // Unordered list item
    if (line.startsWith('- ')) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\d+)\.\s(.+)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(`<li>${renderInline(olMatch[2])}</li>`);
      continue;
    }

    // Emoji-prefixed status lines — keep as block items outside a list
    if (EMOJI_PREFIX.test(line)) {
      flushList();
      output.push(`<p class="emoji-line">${renderInline(line)}</p>`);
      continue;
    }

    flushList();
    output.push(`<p>${renderInline(line)}</p>`);
  }

  flushList();
  return output.join('');
};
