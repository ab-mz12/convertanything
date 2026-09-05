/**
 * Flattens the HTML produced by mammoth into a linear list of layout blocks that PdfWriter can
 * render. Inline formatting (bold, links) is intentionally dropped; structure is kept.
 */
export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'image'; src: string }
  | { kind: 'table'; rows: string[][] };

const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

export function htmlToBlocks(html: string): Block[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];

  const pushImages = (element: Element) => {
    element.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (src) blocks.push({ kind: 'image', src });
    });
  };

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = clean(node.textContent);
      if (text) blocks.push({ kind: 'paragraph', text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      pushImages(element);
      const text = clean(element.textContent);
      if (text) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
      return;
    }
    if (tag === 'p' || tag === 'blockquote' || tag === 'pre') {
      pushImages(element);
      const text = clean(element.textContent);
      if (text) blocks.push({ kind: 'paragraph', text });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .map((li) => {
          pushImages(li);
          return clean(li.textContent);
        });
      if (items.length) blocks.push({ kind: 'list', ordered: tag === 'ol', items });
      return;
    }
    if (tag === 'table') {
      const rows = Array.from(element.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.children).map((cell) => clean(cell.textContent)),
      );
      if (rows.length) blocks.push({ kind: 'table', rows });
      return;
    }
    if (tag === 'img') {
      const src = element.getAttribute('src');
      if (src) blocks.push({ kind: 'image', src });
      return;
    }
    if (tag === 'br' || tag === 'hr' || tag === 'script' || tag === 'style') return;

    // Generic container (div, section, a, span ...): recurse into children.
    element.childNodes.forEach(visit);
  };

  document.body.childNodes.forEach(visit);
  return blocks;
}
