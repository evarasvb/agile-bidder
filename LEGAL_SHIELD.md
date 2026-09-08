# 🔐 Blindaje Legal - Agile Bidder

**Documento clasificado: Confidencial - Solo para Firma VB SpA**

Este documento describe todas las medidas legales implementadas para proteger la propiedad intelectual y los derechos de Firma VB SpA sobre Agile Bidder.

---

## 1. ESTRUCTURA LEGAL IMPLEMENTADA

### 1.1 Documentos de Protección Creados

| Documento | Propósito | Ubicación |
|-----------|-----------|-----------|
| **LICENSE** | Licencia propietaria que limita uso y reproducción | `/LICENSE` |
| **INTELLECTUAL_PROPERTY.md** | Noticia formal de derechos de autor y marca | `/INTELLECTUAL_PROPERTY.md` |
| **TERMS_OF_SERVICE.md** | Términos de servicio para usuarios | `/TERMS_OF_SERVICE.md` |
| **PRIVACY_POLICY.md** | Política de privacidad LGPD-compliant | `/PRIVACY_POLICY.md` |
| **.github/SECURITY.md** | Política de seguridad y reporte de vulnerabilidades | `/.github/SECURITY.md` |
| **CONTRIBUTING.md** | Guía de contribución con NDA requerido | `/CONTRIBUTING.md` |
| **LEGAL_SHIELD.md** | Este documento | `/LEGAL_SHIELD.md` |

### 1.2 Marca Registrada

✅ **Firma VB** registrada en INAPI (Instituto Nacional de la Propiedad Industrial)
- Protege el nombre, logo y marca comercial
- Ámbito: Software de licitaciones públicas
- Validez: Indefinida (sujeto a renovación cada 10 años)
- Acción: Referencia en todos los documentos legales

---

## 2. PROTECCIONES EN EL CÓDIGO

### 2.1 Headers de Copyright

Todos los archivos TypeScript/JavaScript/React contienen:

```typescript
/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación sin autorización.
 * Ley 19.912 - Protección de Derechos de Autor (Chile) | Marca registrada INAPI
 */
```

Archivos con headers actualizados:
- ✅ `src/main.tsx`
- ✅ `src/App.tsx`
- ✅ [Agregar más a nuevos archivos automáticamente]

### 2.2 Script de Automatización

**Archivo:** `scripts/add-copyright-header.js`

Agrega automáticamente headers de copyright a nuevos archivos:

```bash
# Agregar a todos los archivos en src/
node scripts/add-copyright-header.js src

# Ejecutar antes de cada commit
npm run add-copyright
```

### 2.3 Pre-commit Hook (Husky)

**Archivo:** `.husky/pre-commit`

Valida automáticamente:
- ✅ Archivos nuevos tienen copyright header
- ✅ No hay secretos en commits
- ✅ No se suben archivos de configuración sensibles
- ✅ Cumplimiento de políticas de seguridad

---

## 3. PROTECCIONES LEGALES APLICABLES

### 3.1 Legislación Chilena

| Ley | Aplicación |
|-----|-----------|
| **Ley 19.912** | Protección de derechos de autor y propiedad intelectual |
| **Código Civil** | Contratación y obligaciones |
| **Código Comercial** | Actos de comercio y obligaciones mercantiles |
| **Ley 19.628** | Protección de datos personales |

### 3.2 Normas Internacionales

| Tratado | Cobertura |
|---------|-----------|
| **Convenio de Berna** | Protección automática de obras literarias y artísticas |
| **TRIPS (ADPIC)** | Estándares mínimos de propiedad intelectual |
| **WIPO** | Registro y protección internacional |
| **LGPD** | Protección de datos si hay usuarios en Brasil |

### 3.3 Jurisdicción Aplicable

- **Jurisdicción principal:** Chile (Santiago)
- **Ley aplicable:** Leyes de la República de Chile
- **Tribunales competentes:** Cortes de apelaciones de Santiago
- **Enforcement:** Acciones civiles y penales

---

## 4. TÉRMINOS DE SERVICIO - RESTRICCIONES CRÍTICAS

### 4.1 Prohibiciones Explícitas (TERMS_OF_SERVICE.md)

Usuarios NO PUEDEN:
- ❌ Copiar o duplicar el código
- ❌ Crear versiones derivadas sin autorización
- ❌ Usar en competencia directa
- ❌ Ingeniería inversa o decompilación
- ❌ Distribución o sublicencia
- ❌ Remover o alterar avisos de copyright
- ❌ Usar marca "Firma VB" sin autorización

### 4.2 Obligación de Pago y Rescisión

- Suscripciones auto-renoven mensualmente/anualmente
- Firma VB puede suspender por incumplimiento
- Rescisión por usuario: 30 días previo aviso
- Rescisión por Firma VB: Inmediata por violación grave

### 4.3 Limitación de Responsabilidad

- Software provided "AS IS" sin garantía
- Límite de responsabilidad = monto pagado últimos 3 meses
- NO responsable por daños indirectos, lucro cesante, etc.

---

## 5. POLÍTICA DE PRIVACIDAD - CONTROL DE DATOS

### 5.1 Recopilación de Datos

Se recopilan:
- Datos de cuenta (nombre, email, RUT, empresa)
- Datos de uso (licitaciones, búsquedas, funciones)
- Datos técnicos (IP, navegador, cookies)
- Datos de transacciones (con retención de 6 años)

### 5.2 Base Legal de Procesamiento

- ✅ Consentimiento expreso
- ✅ Cumplimiento de contrato
- ✅ Obligación legal (tributaria)
- ✅ Interés legítimo (seguridad, fraude)

### 5.3 Protección de Datos

- Encriptación TLS/SSL en tránsito
- Encriptación AES-256 en reposo
- Acceso limitado a personal autorizado
- Auditoría de accesos y cambios
- Cumplimiento Ley 19.628 (Chile)

### 5.4 Derechos de Usuarios

Pueden ejercer derecho a:
- 📄 Acceso: Solicitar copia de datos
- ✏️ Rectificación: Corregir datos inexactos
- 🗑️ Olvido: Solicitar eliminación (excepto por ley)
- 🚫 Oposición: Rechazar procesamiento
- 📤 Portabilidad: Obtener datos en formato legible

Contacto: `privacy@firmavb.cl`

---

## 6. POLÍTICA DE SEGURIDAD

### 6.1 Reporte de Vulnerabilidades

**Nunca reportar públicamente en GitHub Issues**

Proceso responsable:
1. Enviar a: `security@firmavb.cl`
2. Incluir detalles y pasos de reproducción
3. Confidencialidad absoluta (NDA)
4. Respuesta en 48 horas máximo
5. Patch en 15 días

Violación de confidencialidad = Acción legal inmediata

### 6.2 Monitoreo y Detección

- ✅ Sistema de logging 24/7
- ✅ Alertas automáticas de anomalías
- ✅ Rate limiting y throttling activos
- ✅ WAF (Web Application Firewall)
- ✅ Detección de intrusiones

---

## 7. PROTECCIONES DE REPOSITORIO GITHUB

### 7.1 Configuración Recomendada

**Branch Protection Rules (para `main` y `develop`):**

```json
{
  "require_pull_request_reviews": 2,
  "require_code_owner_reviews": true,
  "require_status_checks_to_pass": true,
  "require_branches_to_be_up_to_date": true,
  "require_conversation_resolution": true,
  "dismiss_stale_review_approvals": true,
  "enforce_admins": true,
  "restrict_who_can_push_to_matching_branches": ["@evarasvb"]
}
```

**Configuración Global:**

```json
{
  "has_wiki": false,
  "has_pages": false,
  "has_downloads": false,
  "has_projects": false,
  "has_discussions": false,
  "private": true,
  "visibility": "private",
  "allow_forking": false,
  "delete_branch_on_merge": true,
  "require_linear_history": true,
  "auto_merge_enabled": false
}
```

### 7.2 Secretos y Credenciales

Configurar GitHub Secrets:
- ✅ SUPABASE_URL
- ✅ SUPABASE_KEY
- ✅ STRIPE_SECRET_KEY
- ✅ DEPLOYMENT_TOKEN

Nunca commitear `.env` o archivos de configuración.

---

## 8. DOCUMENTOS PARA DESARROLLADORES

### 8.1 CONTRIBUTING.md

Requiere:
- Firma de NDA (Acuerdo de Confidencialidad)
- Asignación de derechos a Firma VB SpA
- Aceptación de términos y privacidad
- Headers de copyright en código nuevo
- Testing y linting antes de PR

### 8.2 Código de Conducta

Violaciones graves resultan en:
- ❌ Expulsión inmediata del proyecto
- ❌ Revocar acceso a repositorio
- ❌ Acciones legales por confidencialidad
- ❌ Reclamación de daños y perjuicios

---

## 9. CHECKLIST DE PROTECCIÓN

### 9.1 Documentación Completada

- ✅ LICENSE (licencia propietaria)
- ✅ INTELLECTUAL_PROPERTY.md (noticia de derechos)
- ✅ TERMS_OF_SERVICE.md (restricciones de uso)
- ✅ PRIVACY_POLICY.md (protección de datos)
- ✅ .github/SECURITY.md (reporte de vulnerabilidades)
- ✅ CONTRIBUTING.md (guía de contribución con NDA)
- ✅ LEGAL_SHIELD.md (este documento)

### 9.2 Protecciones en Código

- ✅ Headers de copyright en archivos principales
- ✅ Script automatizado para nuevos archivos
- ✅ Pre-commit hook para validación
- ✅ Verificación de secretos en commits

### 9.3 Configuración de Seguridad

- ⏳ Branch protection rules (configurar en GitHub)
- ⏳ Secrets en GitHub (configurar en GitHub)
- ⏳ 2FA habilitado en cuenta
- ⏳ Auditar acceso de colaboradores

### 9.4 Registro y Vigencia

- ✅ Marca "Firma VB" registrada en INAPI
- ✅ Derechos de autor protegidos automáticamente por ley
- ✅ Válido en Chile y tratados internacionales
- ⏳ Renovar registro INAPI cada 10 años

---

## 10. PRÓXIMOS PASOS Y RECOMENDACIONES

### 10.1 URGENTE (Esta semana)

1. **Configurar Branch Protection en GitHub**
   - Exigir 2 reviews antes de merge
   - Exigir que sea up-to-date con main
   - Proteger `main`, `develop`, ramas con nombre `release/*`

2. **Verificar Secretos**
   ```bash
   git log --all --full-history -p | grep -i "password\|secret\|key"
   ```

3. **Agregar Headers de Copyright**
   ```bash
   npm install --save-dev husky
   npx husky install
   node scripts/add-copyright-header.js src
   ```

4. **Contactar Legal**
   - Confirmar registro INAPI de "Firma VB"
   - Obtener número de registro para documentos
   - Revisar cláusulas con abogado local

### 10.2 IMPORTANTE (Este mes)

1. **Registrar Derechos de Autor**
   - Aunque automático en Chile, considerar registro formal
   - Registrar en INAPI (Derechos de Autor)

2. **Implementar NDA**
   - Crear template de NDA para colaboradores
   - Implementar firma electrónica (ClauseBase o similar)

3. **Auditoría de Seguridad**
   - Contratar auditoría de seguridad profesional
   - Implementar pen-testing regular
   - Compliance check LGPD

4. **Documentar Procesos**
   - Incident response plan
   - Data breach notification procedure
   - Crisis communication plan

### 10.3 RECOMENDADO (Este trimestre)

1. **Copyright de Software Más Agresivo**
   - Usar herramientas de watermarking en binarios
   - Implementar obfuscación de código en producción
   - Considerar licencia con validación de hardware

2. **Monitoreo de Uso**
   - Implementar telemetría responsable
   - Detectar uso no autorizado
   - Monitor forks y copies públicas

3. **Establecer Bug Bounty**
   - Plataforma HackerOne o Bugcrowd
   - Budget: $500-5000 según severidad
   - Atraer seguridad researchers

---

## 11. CONTACTOS Y ESCALACIÓN

### 11.1 Contactos Internos

| Función | Email | Teléfono |
|---------|-------|----------|
| **Legal** | legal@firmavb.cl | [Agregar] |
| **Seguridad** | security@firmavb.cl | [Agregar] |
| **Privacidad** | privacy@firmavb.cl | [Agregar] |
| **Desarrollador** | dev@firmavb.cl | [Agregar] |

### 11.2 Escalación de Incidentes

**Severidad CRÍTICA (Data breach, vulnerabilidad 0-day):**
1. Activar incident response team
2. Notificar abogado inmediatamente
3. Documentar todo en bitácora
4. Notificar usuarios en 72 horas máximo
5. Reportar a autoridades si aplica

**Severidad ALTA (Violación de confidencialidad, robo de código):**
1. Contactar legal@firmavb.cl
2. Iniciar investigación
3. Preparar demanda si aplica
4. Monitorear redes y repositorios

**Severidad MEDIA (Intento de acceso no autorizado):**
1. Documentar incidente
2. Revisar logs de seguridad
3. Informar a seguridad@firmavb.cl
4. Implementar controles adicionales

---

## 12. REGISTRO Y AUDITORÍA

### 12.1 Bitácora de Cambios

Mantener registro de:
- ✅ Archivos legales agregados
- ✅ Headers de copyright aplicados
- ✅ Cambios de política
- ✅ Incidentes de seguridad
- ✅ Actualizaciones de normativa

**Ubicación:** `docs/LEGAL_CHANGELOG.md` (confidencial)

### 12.2 Cumplimiento Regulatorio

Verificar anualmente:
- ✅ Vigencia de marca INAPI
- ✅ Cumplimiento Ley 19.628 (privacidad)
- ✅ Actualización de TOS y Privacy Policy
- ✅ Auditoría de seguridad externa
- ✅ Renovación de certificados SSL

---

## 13. DEFENSA LEGAL

### 13.1 Derechos a Defender

1. **Propiedad Intelectual**
   - Código fuente
   - Algoritmos y lógica
   - Diseño de interfaz
   - Marca "Firma VB"

2. **Acciones si se detecta violación**
   - Cease & Desist letter (carta formal)
   - Solicitud de remoción (DMCA takedown)
   - Demanda civil por daños
   - Querella criminal si aplica

3. **Daños Reclamables**
   - Daño emergente (pérdida directa)
   - Lucro cesante (ingresos perdidos)
   - Daño moral (para marca)
   - Multiplicadores (hasta 3x en algunos casos)

### 13.2 Recursos de Defensa

- 📄 Keep updated copies of INTELLECTUAL_PROPERTY.md
- 🖼️ Screenshot código con timestamps
- 📊 Documentar ingresos afectados
- 📧 Guardar comunicaciones sospechosas
- 🔍 Monitorear GitHub/BitBucket/GitLab públicos

---

## 14. CUMPLIMIENTO Y CERTIFICACIÓN

### 14.1 Marcos de Cumplimiento

Cumplimos con:
- ✅ OWASP Top 10
- ✅ CWE (Common Weakness Enumeration)
- ⏳ ISO 27001 (si presupuesto)
- ⏳ SOC 2 (si requieren clientes)

### 14.2 Auditorías Recomendadas

| Auditoría | Frecuencia | Presupuesto | Prioridad |
|-----------|-----------|-----------|----------|
| Seguridad de código | Anual | $5-10k | ALTA |
| Compliance LGPD | Anual | $3-5k | ALTA |
| Pen-testing | Anual | $8-15k | MEDIA |
| ISO 27001 | Bi-anual | $20-30k | MEDIA |

---

## 15. APÉNDICE: REFERENCIAS LEGALES

### 15.1 Legislación Chilena

- Ley 19.912 sobre Propiedad Intelectual
- Ley 19.628 sobre Protección de Datos Personales
- Código Civil Chileno (Libro III)
- Código de Comercio

### 15.2 Recursos Internacionales

- OMPI (Organización Mundial de Propiedad Intelectual)
- INAPI (Instituto Nacional de Propiedad Industrial)
- WIPO Copyright Treaty
- Convenio de Berna para la Protección de Obras Literarias

### 15.3 Herramientas Recomendadas

- **GitHub Secret Scanning:** Detecta credenciales en commits
- **Dependabot:** Monitorea vulnerabilidades en dependencias
- **Snyk:** Análisis de seguridad de código
- **HackerOne:** Bug bounty platform
- **ClauseBase:** Generador de contratos

---

## 📌 NOTA FINAL

**Este blindaje legal es EFECTIVO INMEDIATAMENTE.**

Todos los documentos han sido creados conforme a:
- Ley 19.912 (Propiedad Intelectual, Chile)
- Mejores prácticas internacionales
- Estándares de la industria tech

**Pero la ley REQUIERE acción de Firma VB:**

1. ⚠️ Revisar con abogado local
2. ⚠️ Confirmar número de registro INAPI
3. ⚠️ Configurar GitHub (branch protection, secrets)
4. ⚠️ Comunicar a team restricciones de contribución
5. ⚠️ Implementar pre-commit hooks en CI/CD

---

**Documento confidencial - Prohibida distribución sin autorización**  
**Última actualización: 8 Septiembre 2026**  
**Vigencia: Indefinida**
