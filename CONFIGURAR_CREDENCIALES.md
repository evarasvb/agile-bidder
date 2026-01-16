# 🔐 Configurar Credenciales para Automatizar Migraciones

## 📋 **Paso 1: Obtener Service Role Key**

### **En Supabase Dashboard:**

1. **Abre Supabase Dashboard**
   - Ve a: https://app.supabase.com
   - Selecciona tu proyecto: **FirmaVB**

2. **Ve a Settings → API**
   - Click en **"Settings"** en el menú lateral
   - Click en **"API"** en el submenú

3. **Busca "service_role" key**
   - ⚠️ **IMPORTANTE**: Busca la key que dice **"service_role"** (NO la "anon" key)
   - Está en la sección **"Project API keys"**
   - La key es larga y empieza con `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

4. **Copia la key**
   - Click en el ícono de copiar al lado de la key
   - ⚠️ **NUNCA** compartas esta key públicamente

---

## 📋 **Paso 2: Configurar en .env**

### **Opción A: Agregar al .env existente**

1. **Abre el archivo `.env`**
   - Ubicación: `mercadopublico-scraper/agile-bidder/.env`

2. **Agrega estas líneas:**
   ```bash
   # Supabase (ya deberías tener estas)
   VITE_SUPABASE_URL=https://euzqadopjvdszcdjegmo.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key_aqui
   
   # Service Role Key (para ejecutar migraciones automáticamente)
   SUPABASE_URL=https://euzqadopjvdszcdjegmo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

3. **Reemplaza `tu_service_role_key_aqui`** con la key que copiaste

### **Opción B: Crear .env si no existe**

1. **Crea el archivo `.env`**
   ```bash
   cd mercadopublico-scraper/agile-bidder
   touch .env
   ```

2. **Agrega el contenido:**
   ```bash
   # Supabase
   VITE_SUPABASE_URL=https://euzqadopjvdszcdjegmo.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key_aqui
   
   # Service Role Key (para ejecutar migraciones automáticamente)
   SUPABASE_URL=https://euzqadopjvdszcdjegmo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

---

## 📋 **Paso 3: Verificar Configuración**

### **Verificar que las credenciales están configuradas:**

```bash
cd mercadopublico-scraper/agile-bidder

# Verificar que el archivo existe
cat .env | grep SUPABASE_SERVICE_ROLE_KEY

# Deberías ver algo como:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📋 **Paso 4: Ejecutar Migraciones Automáticamente**

### **Una vez configurado, ejecuta:**

```bash
cd mercadopublico-scraper/agile-bidder

# Ejecutar migraciones automáticamente
deno run --allow-net --allow-env --allow-read scripts/ejecutar-migraciones-auto.ts
```

### **Qué hace el script:**
1. ✅ Lee las credenciales del `.env`
2. ✅ Conecta a Supabase
3. ✅ Lee `APLICAR_MIGRACIONES.sql`
4. ✅ Ejecuta todas las migraciones
5. ✅ Muestra un resumen de resultados

---

## ⚠️ **Seguridad**

### **IMPORTANTE:**
- ⚠️ **NUNCA** subas el archivo `.env` a GitHub
- ⚠️ **NUNCA** compartas tu `SUPABASE_SERVICE_ROLE_KEY` públicamente
- ✅ El archivo `.env` ya está en `.gitignore` (no se subirá a GitHub)
- ✅ La service role key tiene permisos completos en tu base de datos

### **Verificar que .env está en .gitignore:**

```bash
cat .gitignore | grep .env
# Debería mostrar: .env
```

---

## 🔍 **Troubleshooting**

### **Error: "SUPABASE_SERVICE_ROLE_KEY no está configurada"**
- ✅ Verifica que agregaste la key al `.env`
- ✅ Verifica que el archivo `.env` está en `mercadopublico-scraper/agile-bidder/`
- ✅ Verifica que no hay espacios extra en la línea

### **Error: "Invalid API key"**
- ✅ Verifica que copiaste la key completa (es muy larga)
- ✅ Verifica que copiaste la key **"service_role"** (no la "anon")
- ✅ Verifica que no hay espacios o saltos de línea en la key

### **Error: "Permission denied"**
- ✅ Verifica que usaste la **service_role** key (no la anon key)
- ✅ La service_role key tiene permisos completos

---

## ✅ **Resumen**

1. ✅ Obtén la **service_role** key de Supabase Dashboard
2. ✅ Agrega `SUPABASE_SERVICE_ROLE_KEY=...` a tu `.env`
3. ✅ Ejecuta: `deno run --allow-net --allow-env --allow-read scripts/ejecutar-migraciones-auto.ts`
4. ✅ ¡Listo! Las migraciones se aplicarán automáticamente

---

**¿Necesitas ayuda?** Si tienes problemas, puedo ayudarte a verificar la configuración.
