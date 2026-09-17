/** Identificador persistente del navegador para que el unico uso gratis no se
 * reinicie al pasar desde la portada anonima a una cuenta autenticada. */
export function expertoHuella(): string {
  try {
    let huella = localStorage.getItem('fvb_huella');
    if (!huella) {
      huella = `h_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('fvb_huella', huella);
    }
    return huella;
  } catch {
    return 'anon';
  }
}
