const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aXNrZWV1dGJhaXB3YmVlZXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTg2ODQsImV4cCI6MjA4MzQ3NDY4NH0.RLiTsgTl5Xbh1NetQIOB3tBH1EQa9ehcHfWIa4MJWf4';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let resultadoActual = null;

function mostrarError(msg) {
const c = document.getElementById('errorContainer');
c.innerHTML = '<div class="error-box">' + msg + '</div>';
window.scrollTo({top:0, behavior:'smooth'});
setTimeout(function(){ c.innerHTML=''; }, 6000);
}

function mostrarExito(msg) {
const c = document.getElementById('errorContainer');
c.innerHTML = '<div class="success-box">' + msg + '</div>';
setTimeout(function(){ c.innerHTML=''; }, 6000);
}

function validarEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validarRUT(r) { return /^[0-9]{7,8}-[0-9kK]$/.test(r); }

function radioVal(name) {
const el = document.querySelector('input[name="' + name + '"]:checked');
return el ? el.value : null;
}

function toggleErr(id, show) {
const el = document.getElementById(id);
if (!el) return;
if (show) { el.classList.add('activo'); } else { el.classList.remove('activo'); }
}

function setupCondicionales() {
document.querySelectorAll('input[name="es_utp"]').forEach(function(r) {
r.addEventListener('change', function() {
document.getElementById('box_utp').classList.toggle('activo', radioVal('es_utp') === 'si');
});
});
['cat1','cat2','cat3','cat4'].forEach(function(id) {
document.getElementById(id).addEventListener('change', function() {
document.getElementById('box_cloud').classList.toggle('activo', document.getElementById('cat4').checked);
});
});
}
setupCondicionales();

async function validar() {
const rut_empresa = document.getElementById('rut_empresa').value.trim();
const razon_social = document.getElementById('razon_social').value.trim();
const rep_legal_nombre = document.getElementById('rep_legal_nombre').value.trim();
const rep_legal_email = document.getElementById('rep_legal_email').value.trim();
const rep_legal_telefono = document.getElementById('rep_legal_telefono').value.trim();
const coord_nombre = document.getElementById('coord_nombre').value.trim();
const coord_email = document.getElementById('coord_email').value.trim();
const coord_telefono = document.getElementById('coord_telefono').value.trim();

if (!validarRUT(rut_empresa)) { mostrarError('RUT de empresa invalido, formato 12345678-9'); return; }
if (razon_social.length < 3) { mostrarError('Razon Social invalida'); return; }
if (rep_legal_nombre.length < 3) { mostrarError('Nombre del Representante Legal invalido'); return; }
if (!validarEmail(rep_legal_email)) { mostrarError('Email del Representante Legal invalido'); return; }
if (rep_legal_telefono.length < 6) { mostrarError('Telefono del Representante Legal invalido'); return; }

const descuento = parseInt(document.getElementById('descuento').value, 10);
const garantia = parseInt(document.getElementById('garantia').value, 10);
const sla_respuesta = parseInt(document.getElementById('sla_respuesta').value, 10);
const sla_onsite = parseInt(document.getElementById('sla_onsite').value, 10);

if (isNaN(descuento) || isNaN(garantia) || isNaN(sla_respuesta) || isNaN(sla_onsite)) {
mostrarError('Debes completar todos los campos de Condiciones Comerciales'); return;
}

const ciberseguridad = radioVal('ciberseguridad');
const deudas_laborales = radioVal('deudas_laborales');
const es_utp = radioVal('es_utp');

if (!ciberseguridad || !deudas_laborales || !es_utp) {
mostrarError('Debes responder todas las Declaraciones Juradas'); return;
}

const categorias = [];
if (document.getElementById('cat1').checked) categorias.push(document.getElementById('cat1').value);
if (document.getElementById('cat2').checked) categorias.push(document.getElementById('cat2').value);
if (document.getElementById('cat3').checked) categorias.push(document.getElementById('cat3').value);
const cloudChecked = document.getElementById('cat4').checked;
if (cloudChecked) categorias.push(document.getElementById('cat4').value);

toggleErr('err_categorias', categorias.length === 0);
if (categorias.length === 0) { mostrarError('Debes marcar al menos un servicio'); return; }

let cloud_anexo3 = null;
if (cloudChecked) {
cloud_anexo3 = radioVal('cloud_anexo3');
if (!cloud_anexo3) { mostrarError('Debes responder sobre el Anexo N3 de Cloud'); return; }
}

const programa_integridad = radioVal('programa_integridad');
const verificacion_integridad = radioVal('verificacion_integridad');
const anexo4 = document.getElementById('anexo4').checked;
const contrato_acreditacion = document.getElementById('contrato_acreditacion').checked;
const factura_acreditacion = document.getElementById('factura_acreditacion').checked;

const gaps = [];
toggleErr('err_descuento', false);
toggleErr('err_garantia', false);
toggleErr('err_sla_respuesta', false);
toggleErr('err_sla_onsite', false);
toggleErr('err_ciberseguridad', false);
toggleErr('err_deudas_laborales', false);
toggleErr('err_cloud', false);

if (descuento < 2 || descuento > 10) { gaps.push('Descuento fuera de rango (debe ser entre 2% y 10%)'); toggleErr('err_descuento', true); }
if (garantia < 6) { gaps.push('Garantia insuficiente (minimo 6 meses)'); toggleErr('err_garantia', true); }
if (sla_respuesta > 4) { gaps.push('SLA de Primera Respuesta excede el maximo de 4 horas habiles'); toggleErr('err_sla_respuesta', true); }
if (sla_onsite > 2) { gaps.push('SLA de Soporte On Site excede el maximo de 2 dias habiles'); toggleErr('err_sla_onsite', true); }
if (ciberseguridad === 'no') { gaps.push('No cumple con la normativa de Ciberseguridad del Estado'); toggleErr('err_ciberseguridad', true); }
if (deudas_laborales === 'si') { gaps.push('Registra deudas laborales o previsionales'); toggleErr('err_deudas_laborales', true); }
if (cloudChecked && cloud_anexo3 === 'no') { gaps.push('Falta Anexo N3 para servicios Cloud'); toggleErr('err_cloud', true); }

const admisible = gaps.length === 0;

let puntaje_acreditacion = 0;
if (anexo4 && contrato_acreditacion && factura_acreditacion) puntaje_acreditacion = 100;
else if (anexo4 && contrato_acreditacion) puntaje_acreditacion = 80;
else if (anexo4 && factura_acreditacion) puntaje_acreditacion = 50;
else puntaje_acreditacion = 0;

resultadoActual = {
rep_legal_nombre: rep_legal_nombre,
rep_legal_email: rep_legal_email,
razon_social: razon_social,
rep_legal_telefono: rep_legal_telefono,
gaps: gaps,
admisible: admisible
};

document.getElementById('btnValidar').disabled = true;
document.getElementById('loader').style.display = 'block';

try {
const insertResp = await supabaseClient.from('prospectos_cm2239').insert([{
rut_empresa: rut_empresa,
razon_social: razon_social,
rep_legal_nombre: rep_legal_nombre,
rep_legal_email: rep_legal_email,
rep_legal_telefono: rep_legal_telefono,
coord_nombre: coord_nombre || null,
coord_email: coord_email || null,
coord_telefono: coord_telefono || null,
descuento: descuento,
garantia_meses: garantia,
sla_respuesta_horas: sla_respuesta,
sla_onsite_dias: sla_onsite,
ciberseguridad: ciberseguridad === 'si',
deudas_laborales: deudas_laborales === 'si',
es_utp: es_utp === 'si',
categorias: categorias,
cloud_anexo3: cloudChecked ? (cloud_anexo3 === 'si') : null,
programa_integridad: programa_integridad === 'si',
verificacion_integridad: verificacion_integridad === 'si',
anexo4: anexo4,
contrato_acreditacion: contrato_acreditacion,
factura_acreditacion: factura_acreditacion,
puntaje_acreditacion: puntaje_acreditacion,
admisible: admisible,
gaps: gaps,
estado: 'nuevo'
}]);

if (insertResp.error) {
if (insertResp.error.code === '23505') { mostrarError('Este email ya fue registrado anteriormente'); }
else { console.log('Error Supabase:', insertResp.error); mostrarError('Ocurrio un error al guardar tus datos, pero puedes ver tu resultado abajo'); }
} else {
mostrarExito('Datos guardados correctamente');
}
} catch (e) {
console.log('Error:', e);
} finally {
document.getElementById('loader').style.display = 'none';
document.getElementById('btnValidar').disabled = false;
}

mostrarResultado(admisible, gaps);
}

function mostrarResultado(admisible, gaps) {
const res = document.getElementById('resultado');
res.classList.remove('ok','warn');
res.classList.add('activo');
const titulo = document.getElementById('resTitulo');
const texto = document.getElementById('resTexto');
const gapsList = document.getElementById('resGaps');

if (admisible) {
res.classList.add('ok');
titulo.textContent = 'Felicidades!';
texto.textContent = 'Tienes un perfil altamente competitivo para ser Admisible en esta Licitacion de Convenio Marco. Estas a un paso de venderle al Estado. Agenda una reunion para revisar tu estrategia y asegurar los 65 puntos minimos.';
gapsList.style.display = 'none';
} else {
res.classList.add('warn');
titulo.textContent = 'Atencion: parametros fuera de rango';
texto.textContent = 'Actualmente tienes parametros que te dejarian Inadmisible segun las bases. Agenda una asesoria de emergencia para corregir tu estrategia antes de postular.';
gapsList.style.display = 'block';
gapsList.innerHTML = gaps.map(function(g){ return '<div>' + g + '</div>'; }).join('');
}

res.scrollIntoView({behavior:'smooth'});
}

function agendar() {
if (!resultadoActual) return;
window.open('https://calendar.app.google/DmznDfh3qPzkDtYE6', '_blank');
}

function cerrarModal() {
document.getElementById('modalMeet').classList.remove('activo');
}

async function guardarAgenda(e) {
e.preventDefault();
if (!resultadoActual) return;
const fecha = document.getElementById('fecha').value;
if (!fecha) { mostrarError('Selecciona una fecha'); return; }

const agResp = await supabaseClient.from('agendamientos_meet').insert([{
nombre: resultadoActual.rep_legal_nombre,
email: resultadoActual.rep_legal_email,
empresa: resultadoActual.razon_social,
telefono: resultadoActual.rep_legal_telefono,
fecha_meet: fecha,
preferencia_comunicacion: document.getElementById('pref').value,
temas: resultadoActual.gaps,
estado: 'pendiente'
}]);

if (agResp.error) {
if (agResp.error.code === '23505') { mostrarError('Esa fecha ya fue agendada para este email'); }
else { mostrarError('Error: ' + agResp.error.message); }
} else {
mostrarExito('Reunion agendada con exito');
setTimeout(function(){ cerrarModal(); }, 1500);
}
}

document.getElementById('btnValidar').addEventListener('click', validar);
document.getElementById('btnAgendar').addEventListener('click', agendar);
document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
document.getElementById('formMeet').addEventListener('submit', guardarAgenda);
window.onclick = function(e) {
if (e.target.id === 'modalMeet') { cerrarModal(); }
};
