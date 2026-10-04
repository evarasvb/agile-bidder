import DOMPurify from 'dompurify';

export interface FuenteLegal { n?: unknown; fuente?: unknown; url?: unknown }

export function urlCitaLegal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** HTML del experto: formato limitado, sin atributos del modelo ni enlaces
 * libres. Las citas se crean como nodos DOM a partir de fuentes recibidas. */
export function sanitizarHtmlLegal(html: string, fuentes: FuenteLegal[] = []): string {
  if (typeof document === 'undefined' || !DOMPurify.isSupported) return escapeHtml(html);
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const text = node.textContent ?? '';
    const matches = [...text.matchAll(/\[(\d{1,2})\]/g)];
    if (!matches.length) continue;
    const replacement = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      replacement.append(document.createTextNode(text.slice(offset, match.index)));
      const n = Number(match[1]);
      const candidates = (Array.isArray(fuentes) ? fuentes : []).filter((f) => f && n > 0
        && (typeof f.n === 'number' || (typeof f.n === 'string' && /^\d{1,2}$/.test(f.n)))
        && Number(f.n) === n);
      const fuente = candidates.length === 1 ? candidates[0] : null;
      const titulo = typeof fuente?.fuente === 'string' ? fuente.fuente.trim() : '';
      const url = titulo ? urlCitaLegal(fuente?.url) : null;
      const sup = document.createElement('sup');
      if (url) {
        const link = document.createElement('a');
        link.textContent = match[0];
        link.href = url;
        link.title = titulo;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'cita text-primary font-semibold no-underline hover:underline';
        sup.append(link);
      } else {
        sup.textContent = `${match[0]} (fuente no verificable)`;
      }
      replacement.append(sup);
      offset = match.index + match[0].length;
    }
    replacement.append(document.createTextNode(text.slice(offset)));
    node.replaceWith(replacement);
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}
