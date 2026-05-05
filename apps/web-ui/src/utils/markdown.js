// Simple markdown-to-HTML converter for static chat messages.
// Supports: **bold**, - bullet lists, 1. numbered lists, line breaks.
// Output is sanitised (no user input ever passes through here — only config data).

const EMOJI_PREFIX = /^[✅⏳❌🏥💰📚🏠🎯🔔📋]/u;

const parseBold = (text) =>
  text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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

    // Unordered list item
    if (line.startsWith('- ')) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(`<li>${parseBold(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\d+)\.\s(.+)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(`<li>${parseBold(olMatch[2])}</li>`);
      continue;
    }

    // Emoji-prefixed status lines — keep as block items outside a list
    if (EMOJI_PREFIX.test(line)) {
      flushList();
      output.push(`<p class="emoji-line">${parseBold(line)}</p>`);
      continue;
    }

    flushList();
    output.push(`<p>${parseBold(line)}</p>`);
  }

  flushList();
  return output.join('');
};
