# Guía de Contribución

## Aviso Legal

**Este es un repositorio privado de Firma VB SpA.**

Contribuciones son permitidas ÚNICAMENTE bajo los siguientes términos:

### Antes de Contribuir

1. **Firma NDA (Acuerdo de Confidencialidad)**
   - Debes firmar NDA de Firma VB
   - Aplica a todo trabajo realizado
   - Válido indefinidamente después de terminar

2. **Asignación de Derechos**
   - Todo código contribuido se asigna a Firma VB SpA
   - No retienes derechos de autor
   - Consentimiento por email: legal@firmavb.cl

3. **Aceptación de Términos**
   - Aceptas TERMS_OF_SERVICE.md
   - Aceptas INTELLECTUAL_PROPERTY.md
   - Aceptas PRIVACY_POLICY.md

## Proceso de Contribución

### 1. Setup Inicial
```bash
git clone [PRIVATE_REPO]
npm install
npm run dev
```

### 2. Rama de Trabajo
```bash
git checkout -b feature/descripcion-clara
```

### 3. Código y Commits
- Commits atómicos y descriptivos
- Mensaje: "tipo: descripción clara"
- Incluir copyright: `© Firma VB SpA`
- Agregar LICENSE header a archivos nuevos

### 4. Testing
```bash
npm run lint
npm run typecheck
npm run test
```

### 5. Pull Request
- Descripción clara del cambio
- Referencia a issues si aplica
- Confirmación de que cumple estándares

## Estándares de Código

### Headers Obligatorios en Archivos Nuevos

**JavaScript/TypeScript:**
```typescript
/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
```

**Otros tipos:**
```javascript
// © 2024-2026 Firma VB SpA. Todos los derechos reservados.
// Software propietario - Prohibida reproducción o modificación.
```

### Buenas Prácticas
- ✓ TypeScript obligatorio (strict mode)
- ✓ ESLint + Prettier configurados
- ✓ Tests para funcionalidad nueva
- ✓ Documentación de cambios
- ✓ Sin dependencias no aprobadas

### Lo que NO hacer
- ✗ Código malicioso o intentos de backdoor
- ✗ Logging de datos sensibles
- ✗ Dependencias no auditadas
- ✗ Comentarios ofensivos o privados
- ✗ Cambios de infraestructura sin aprobación

## Revisión de Código

Cada PR requiere:
- ✓ Revisión de 2+ desarrolladores
- ✓ Tests pasando (100% coverage new code)
- ✓ Linting limpio
- ✓ Aprobación de legal@firmavb.cl si toca privacidad/IP

## Confidencialidad Absoluta

- No discutas detalles públicamente
- No menciones a clientes o licitaciones
- No compartas código con terceros
- No subas a GitHub/Gist públicos

**Violaciones resultan en acción legal inmediata.**

## Seguridad

### Reportar Vulnerabilidades
Sigue proceso en `.github/SECURITY.md`
Nunca reportes públicamente.

### Protección de Secretos
- .env.local en .gitignore
- Usar GitHub Secrets para CI/CD
- Auditar commits antes de push

## Licencia y Propiedad

Al contribuir aceptas:
- Todo código es propiedad de Firma VB SpA
- Sera licenciado bajo LICENSE propietario
- Podrá ser vendido, usado comercialmente, etc.
- No tendrás derecho a regalías o crédito público

---

**Gracias por contribuir responsablemente a Agile Bidder.**
