# 🔧 Solución: Error de Permisos al Instalar Supabase CLI

## ❌ Error que estás viendo:

```
npm error code EACCES
npm error permission denied, mkdir '/usr/local/lib/node_modules/supabase'
```

Esto significa que npm no tiene permisos para instalar paquetes globales.

---

## ✅ SOLUCIONES (Elige una)

### Opción 1: Usar Homebrew (Recomendado para macOS) ⭐

**Ventajas:**
- ✅ No requiere permisos de administrador
- ✅ Más seguro
- ✅ Gestión mejor de dependencias

```bash
# 1. Instalar Homebrew (si no lo tienes)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Instalar Supabase CLI
brew install supabase/tap/supabase

# 3. Verificar
supabase --version
```

---

### Opción 2: Cambiar Directorio de npm (Sin sudo)

```bash
# 1. Crear directorio para paquetes globales
mkdir ~/.npm-global

# 2. Configurar npm para usar ese directorio
npm config set prefix '~/.npm-global'

# 3. Agregar al PATH (agrega esto a ~/.zshrc)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc

# 4. Recargar configuración
source ~/.zshrc

# 5. Ahora instalar Supabase CLI
npm install -g supabase

# 6. Verificar
supabase --version
```

---

### Opción 3: Usar sudo (No recomendado, pero funciona)

```bash
# ⚠️ ADVERTENCIA: Usar sudo con npm puede causar problemas de seguridad
sudo npm install -g supabase
```

**Por qué no es recomendado:**
- Puede causar problemas de permisos en el futuro
- Los paquetes se instalan como root
- Puede interferir con otros proyectos

---

### Opción 4: Usar nvm (Node Version Manager)

```bash
# 1. Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 2. Recargar shell
source ~/.zshrc

# 3. Instalar Node.js más reciente
nvm install 20
nvm use 20

# 4. Instalar Supabase CLI
npm install -g supabase

# 5. Verificar
supabase --version
```

---

## 🎯 RECOMENDACIÓN

**Para macOS, usa Homebrew (Opción 1):**

```bash
brew install supabase/tap/supabase
```

Es la forma más limpia y segura.

---

## ✅ DESPUÉS DE INSTALAR

Una vez instalado, continúa con:

```bash
# 1. Autenticarte
supabase login

# 2. Vincular proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder
supabase link --project-ref juiskeeutbaipwbeeezw

# 3. Aplicar migraciones
supabase db push
```

---

## 🐛 Si Homebrew no funciona

Si tienes problemas con Homebrew, usa la Opción 2 (cambiar directorio de npm). Es la más segura después de Homebrew.
