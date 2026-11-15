/** Strip tags we do not allow when saving/rendering note HTML. */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    return html
      .replace(/<(?!\/?(?:p|br|ul|ol|li|strong|b|em|i|mark|u)\b)[^>]*>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\sstyle="[^"]*"/gi, '');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'MARK', 'U']);
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!allowed.has(el.tagName)) {
          while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
          el.remove();
          continue;
        }
        for (const attr of Array.from(el.attributes)) {
          if (attr.name === 'class' && el.tagName === 'MARK') continue;
          el.removeAttribute(attr.name);
        }
        walk(el);
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export function noteHtmlIsEmpty(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text.length === 0;
}

export function plainTextToNoteHtml(text: string): string {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
