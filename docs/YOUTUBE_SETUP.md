# Integración de YouTube para Marketing

Guía para conectar tu canal de YouTube a Firma VB y sincronizar suscriptores con tu base de datos de contactos.

## ¿Por qué conectar YouTube?

- **Sincronizar suscriptores**: Importa automáticamente tus suscriptores como contactos de marketing
- **Segmentación**: Campañas dirigidas a tu audiencia de YouTube
- **Unificación**: Todos tus contactos en una sola base de datos

## Pasos para Conectar

### 1. Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuevo proyecto (o selecciona uno existente)
   - Nombre sugerido: "Firma VB Marketing"
3. Espera a que se cree el proyecto

### 2. Habilitar YouTube Data API v3

1. En Google Cloud Console, busca "YouTube Data API v3"
2. Haz clic en el resultado
3. Presiona el botón **HABILITAR**
4. Espera a que se habilite (2-3 minutos)

### 3. Crear Credenciales OAuth 2.0

1. En Google Cloud Console, ve a **Credenciales** (en el menú izquierdo)
2. Haz clic en **+ CREAR CREDENCIALES** → **OAuth 2.0**
3. Tipo de aplicación: **Aplicación Web**
4. Rellena:
   - **Nombre**: "Firma VB Marketing"
   - **Orígenes autorizados de JavaScript**: Déjalo vacío
   - **URIs de redirección autorizados**: Agrega esta URL exactamente como se muestra:
     ```
     https://app.firmavb.cl/auth/youtube/callback
     ```
     (O la URL de tu entorno si estás en desarrollo)

5. Presiona **CREAR**

### 4. Descargar las Credenciales

1. Se abrirá un modal con `client_id` y `client_secret`
2. Haz clic en el botón **DESCARGAR JSON**
3. Se descargará un archivo llamado `client_secret_*.json`
4. Abre el archivo en un editor de texto
5. Copia y guarda en lugar seguro:
   - `client_id`
   - `client_secret`

### 5. Configurar en Firma VB

1. Ve a [Marketing → Gestión de Contactos → YouTube](https://app.firmavb.cl/marketing/contactos?tab=youtube)
2. En la sección "Conectar Canal de YouTube"
3. Espera a que estén disponibles los campos de entrada (próximamente)
4. Pega tu `client_id` y `client_secret`
5. Presiona "Conectar canal"
6. Se te redirigirá a Google para autenticar
7. Autoriza a Firma VB acceso a tu canal de YouTube
8. Listo! Tus suscriptores se sincronizarán automáticamente

## ¿Qué Sucede Después?

Después de conectar:

- ✅ Tus suscriptores se importan a la base de datos de contactos
- ✅ Se actualizan automáticamente cada día
- ✅ Puedes crear campañas dirigidas a "youtube_subscriber"
- ✅ Los emails van automáticamente a tu lista de suscriptores

## Seguridad

- Las credenciales se almacenan **encriptadas** en Supabase
- Solo Evaristo (admin) puede ver y gestionar las credenciales
- Google OAuth requiere consentimiento explícito cada vez
- Puedes revocar acceso en cualquier momento desde tu cuenta Google

## Límites de API

- YouTube permite 10,000 cuotas diarias por aplicación
- Sincronizar hasta 50 suscriptores cuesta 1 cuota
- Esto significa: **500,000+ suscriptores por día** sin problemas

## Solución de Problemas

### "No se conecta"
- Verifica que copiaste exactamente la URL de redirect
- Asegúrate de que habilitaste YouTube Data API v3
- Intenta en modo incógnito (elimina cookies de Google)

### "Los suscriptores no importan"
- Verifica que tu canal tiene al menos 1 suscriptor
- Espera 1 hora después de conectar (sincronización automática)
- Presiona "Sincronizar ahora" en la UI

### "Error de permisos"
- Desconecta y reconecta
- Asegúrate de estar conectado a la cuenta correcta de Google
- Verifica en [Google Permissions](https://myaccount.google.com/permissions) que Firma VB tenga acceso

## Variables de Entorno (Dev)

Si estás en desarrollo local, agrega a `.env`:

```
VITE_YOUTUBE_CLIENT_ID=tu_client_id_aqui
VITE_YOUTUBE_REDIRECT_URI=http://localhost:5173/auth/youtube/callback
```

## Arquitectura

```
Google YouTube API
        ↓
youtube-sync Edge Function
        ↓
youtube_subscribers (tabla)
        ↓
marketing_contactos (tabla unificada)
        ↓
Campañas de Marketing
```

## Referencias

- [YouTube API Documentation](https://developers.google.com/youtube/v3)
- [OAuth 2.0 for Web Apps](https://developers.google.com/identity/protocols/oauth2/web-server-flow)
- [Google Cloud Console](https://console.cloud.google.com)
