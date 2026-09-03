// Descargas en Word (.doc abre en Word, Google Docs y LibreOffice) a partir del HTML de un entregable.
export function descargarWord(titulo: string, html: string, archivo: string, pie = 'Generado con el Experto FirmaVB · firmavb.cl · no reemplaza la lectura de las bases.') {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const doc = `<html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:Arial,sans-serif;font-size:11pt}h1{color:#1b2540}h2,h3{color:#1b2540;margin-top:14pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px}</style></head><body><h1>${esc(titulo)}</h1>${html}<p style="color:#888;font-size:9pt">${esc(pie)}</p></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', doc], { type: 'application/msword' })); a.download = archivo.endsWith('.doc') ? archivo : archivo + '.doc'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
