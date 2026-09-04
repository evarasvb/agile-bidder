// Markdown mínimo (títulos, listas, negrita, links, separadores) a HTML seguro. Mismo criterio que experto.html.
// Fórmulas LaTeX que a veces escribe el modelo ($$...$$ o $...$) a texto plano legible.
export function sinLatex(t: string): string {
  const plano = (f: string) => {
    let x = f;
    for (let i = 0; i < 3; i++) x = x.replace(/\\(?:text|mathrm|textbf|mathbf|operatorname)\{([^{}]*)\}/g, '$1');
    for (let i = 0; i < 3; i++) x = x.replace(/_\{([^{}]*)\}/g, '_$1').replace(/\^\{([^{}]*)\}/g, '^$1');
    for (let i = 0; i < 3; i++) x = x.replace(/\\(?:d?frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1) / ($2)');
    return x.replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\(?:le|leq)\b/g, '≤').replace(/\\(?:ge|geq)\b/g, '≥').replace(/\\(?:sum|Sigma)\b/g, 'Σ').replace(/\\%/g, '%')
      .replace(/\\(?:left|right)\b/g, '').replace(/[{}]/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/\s+/g, ' ').trim();
  };
  return t.replace(/\$\$([\s\S]+?)\$\$/g, (_m, f) => ' ' + plano(f) + ' ').replace(/(^|[^\d$])\$(?![\d.])([^$\n]{2,120}?)\$(?!\d)/g, (_m, pre, f) => pre + plano(f));
}

export function expertoMd(t: string): string {
  t = sinLatex(t);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-primary">$2</a>');
  let out = ''; let lista: string | null = null;
  const cierra = () => { if (lista) { out += `</${lista}>`; lista = null; } };
  const lineas = t.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const ln = lineas[i];
    let m: RegExpMatchArray | null;
    // Tabla Markdown: fila de encabezado, separador y filas
    if (/^\s*\|.*\|\s*$/.test(ln) && /^\s*\|?\s*:?-{2,}/.test(lineas[i + 1] ?? '')) {
      cierra();
      const celdas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      out += '<div class="overflow-x-auto my-2"><table class="w-full text-xs border-collapse"><thead><tr>' + celdas(ln).map((c) => `<th class="text-left px-2 py-1 bg-muted/60 border-b font-semibold">${c}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while (i < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[i])) { out += '<tr class="border-b last:border-0">' + celdas(lineas[i]).map((c) => `<td class="px-2 py-1 align-top">${c}</td>`).join('') + '</tr>'; i++; }
      i--; out += '</tbody></table></div>'; continue;
    }
    if (/^\s*---+\s*$/.test(ln)) { cierra(); out += '<hr class="my-3"/>'; continue; }
    if ((m = ln.match(/^\s*(#{1,3})\s+(.*)/))) { cierra(); const h = m[1].length + 2; out += `<h${h} class="font-semibold mt-4 mb-1 ${h === 3 ? 'text-base text-firmavb-blue border-b pb-1' : ''}">${inline(m[2])}</h${h}>`; continue; }
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { if (lista !== 'ul') { cierra(); out += '<ul class="list-disc pl-5 space-y-1">'; lista = 'ul'; } out += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { cierra(); out += '<ol class="list-decimal pl-5 space-y-1">'; lista = 'ol'; } out += `<li>${inline(m[1])}</li>`; continue; }
    if (ln.trim() === '') { cierra(); continue; }
    cierra(); out += `<p class="mb-2">${inline(ln)}</p>`;
  }
  cierra(); return out;
}
