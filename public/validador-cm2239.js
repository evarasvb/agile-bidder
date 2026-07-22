const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aXNrZWV1dGJhaXB3YmVlZXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTg2ODQsImV4cCI6MjA4MzQ3NDY4NH0.RLiTsgTl5Xbh1NetQIOB3tBH1EQa9ehcHfWIa4MJWf4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let resultado = null;

function validarEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function validarRUT(r) { return /^[0-9]{7,8}-[0-9kK]$/.test(r); }

    function mostrarError(msg) {
      const c = document.getElementById('errorContainer');
      c.innerHTML = '<div class="error-box">' + msg + '</div>';
        setTimeout(function() { c.innerHTML = ''; }, 5000);
          }

          function mostrarExito(msg) {
            const c = document.getElementById('errorContainer');
            c.innerHTML = '<div class="success-box">' + msg + '</div>';
              setTimeout(function() { c.innerHTML = ''; }, 5000);
                }

                async function validar() {
                  const nombre = document.getElementById('nombre').value.trim();
                  const email = document.getElementById('email').value.trim();
                  const empresa = document.getElementById('empresa').value.trim();
                  const rut = document.getElementById('rut').value.trim();
                  const telefono = document.getElementById('telefono').value.trim();
                  const sector = document.getElementById('sector').value;

                  if (!nombre || nombre.length < 3) { mostrarError('Nombre invalido'); return; }
                    if (!validarEmail(email)) { mostrarError('Email invalido'); return; }
                      if (!validarRUT(rut)) { mostrarError('RUT invalido, formato 12345678-9'); return; }
                        if (!empresa || empresa.length < 3) { mostrarError('Empresa invalida'); return; }
                          if (!sector) { mostrarError('Selecciona sector'); return; }

                            document.getElementById('loader').style.display = 'block';
                  document.getElementById('btnValidar').disabled = true;

                  try {
                    let pts = 0;
                    const gaps = [];

                    if (document.getElementById('habil').checked) { pts += 25; } else { gaps.push('Registrarse en ChileCompra'); }
                      if (document.getElementById('deudas').checked) { pts += 25; } else { gaps.push('Regularizar deudas previsionales'); }

                        const desc = parseFloat(document.getElementById('descuento').value) || 0;
                    if (desc >= 2 && desc <= 10) { pts += 25; } else { gaps.push('Ajustar descuento entre 2% y 10%'); }

                      const garen = parseInt(document.getElementById('garantia').value) || 0;
                    if (garen >= 6) { pts += 25; } else { gaps.push('Aumentar garantia a 6 meses o mas'); }

                      resultado = { nombre: nombre, email: email, empresa: empresa, rut: rut, telefono: telefono, sector: sector, score: pts, gaps: gaps };

                    const insertResp = await supabase.from('prospectos_cm2239').insert([{
                      nombre: nombre,
                      email: email,
                      empresa: empresa,
                      rut: rut,
                      telefono: telefono,
                      sector: sector,
                      score: pts,
                      gaps: gaps,
                      estado: 'nuevo'
                    }]);

                    if (insertResp.error) {
                      if (insertResp.error.code === '23505') { mostrarError('Este email ya fue registrado anteriormente'); }
                        else { console.log('Error Supabase:', insertResp.error); }
                        } else {
                          mostrarExito('Datos guardados correctamente');
                        }

                          mostrarResultados(pts, gaps);
                    } catch (e) {
                      mostrarError('Error: ' + e.message);
                    } finally {
                      document.getElementById('loader').style.display = 'none';
                      document.getElementById('btnValidar').disabled = false;
                    }
                  }

                      function mostrarResultados(s, g) {
                        document.getElementById('score').textContent = s;
                        let est = s >= 80 ? 'CUMPLE' : (s >= 60 ? 'PARCIAL' : 'MEJORA');
                        document.getElementById('estado').textContent = est;

                        let h = '';
                        const reqs = [
                          { t: 'Habil en ChileCompra', c: document.getElementById('habil').checked },
                          { t: 'Sin Deudas Previsionales', c: document.getElementById('deudas').checked },
                          { t: 'Descuento 2-10%', c: parseFloat(document.getElementById('descuento').value) >= 2 && parseFloat(document.getElementById('descuento').value) <= 10 },
                          { t: 'Garantia 6+ meses', c: parseInt(document.getElementById('garantia').value) >= 6 }
                        ];

                        reqs.forEach(function(r) {
                          h += '<div class="requisito-item ' + (r.c ? 'cumple' : 'no-cumple') + '"><span>' + r.t + '</span><span class="estado ' + (r.c ? 'cumple' : 'no-cumple') + '">' + (r.c ? 'OK' : 'NO') + '</span></div>';
                            });
                            document.getElementById('requisitos').innerHTML = h;

                            if (g.length > 0) {
                              document.getElementById('gaps').innerHTML = g.map(function(x) { return '<div class="gap-item">' + x + '</div>'; }).join('');
                                document.getElementById('gapsContainer').style.display = 'block';
                                } else {
                                  document.getElementById('gapsContainer').style.display = 'none';
                                }

                                  document.getElementById('resultados').classList.add('activo');
                                }

                                function agendar() {
                                  if (!resultado) { return; }
                                    document.getElementById('meetNombre').value = resultado.nombre;
                                  document.getElementById('meetEmail').value = resultado.email;
                                  document.getElementById('modalMeet').classList.add('activo');
                                }

                                  function cerrarModal() {
                                    document.getElementById('modalMeet').classList.remove('activo');
                                  }

                                    async function guardarAgenda(e) {
                                      e.preventDefault();
                                      const fecha = document.getElementById('fecha').value;
                                      if (!fecha) { mostrarError('Selecciona una fecha'); return; }

                                        const agResp = await supabase.from('agendamientos_meet').insert([{
                                          nombre: resultado.nombre,
                                          email: resultado.email,
                                          empresa: resultado.empresa,
                                          telefono: resultado.telefono,
                                          fecha_meet: fecha,
                                          preferencia_comunicacion: document.getElementById('pref').value,
                                          temas: resultado.gaps,
                                          estado: 'pendiente'
                                        }]);

                                      if (agResp.error) {
                                        if (agResp.error.code === '23505') { mostrarError('Esa fecha ya fue agendada para este email'); }
                                          else { mostrarError('Error: ' + agResp.error.message); }
                                          } else {
                                            mostrarExito('Reunion agendada con exito');
                                            setTimeout(function() { cerrarModal(); limpiar(); }, 1500);
                                              }
                                              }

                                              function limpiar() {
                                                document.getElementById('validadorForm').reset();
                                                document.getElementById('resultados').classList.remove('activo');
                                                document.getElementById('errorContainer').innerHTML = '';
                                                resultado = null;
                                              }

                                                window.onclick = function(e) {
                                                  if (e.target.id === 'modalMeet') { cerrarModal(); }
                                                };
                                                  
