// Match a continuous source span, never a paraphrase or a different source.
// PDF extraction can split a Chinese word across physical lines. Only remove
// a single line ending (and indentation) between Han characters; keep spaces,
// punctuation, paragraph breaks, numbers and Latin token boundaries unchanged.
export function sourceQuote(source, quote) {
  if (typeof source !== 'string' || typeof quote !== 'string' || !quote.trim()) return null;
  if (source.includes(quote)) return quote;
  let projected = '', cursor = 0;
  const offsets = [];
  const appendUntil = end => {
    for (; cursor < end; cursor++) {
      projected += source[cursor];
      offsets.push(cursor);
    }
  };
  for (const match of source.matchAll(/(?<=\p{Script=Han})\r?\n[ \t]*(?=\p{Script=Han})/gu)) {
    appendUntil(match.index);
    cursor = match.index + match[0].length;
  }
  appendUntil(source.length);
  const start = projected.indexOf(quote);
  if (start < 0) return null;
  // Return the exact original span, including its physical line endings.
  return source.slice(offsets[start], offsets[start + quote.length - 1] + 1);
}
