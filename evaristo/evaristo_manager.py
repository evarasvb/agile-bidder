#!/usr/bin/env python3
"""
EVARISTO - Programador Autónomo de FirmaVB
==========================================
Evaristo es un bot autónomo que mantiene, mejora y programa el sistema FirmaVB
sin necesidad de supervisión constante.

Autor: Sistema Autónomo FirmaVB
Versión: 1.0.0
"""

import os
import sys
import json
import subprocess
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import re

# Configuración - Usamos requests para HTTP directo
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️  requests no instalado. Ejecuta: pip install requests")

HAS_GEMINI = True  # Siempre disponible si hay API key

# --- CONFIGURACIÓN DE EVARISTO - MULTI-PROVEEDOR ---
# Orden de fallback: Gemini → DeepSeek → Ollama
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# API Key principal (usa la primera disponible)
API_KEY = GEMINI_API_KEY or DEEPSEEK_API_KEY or ""
NOMBRE_AGENTE = "Evaristo 🤖"

# Configuración de rutas - Evaristo trabaja sobre CompraAgil_VB
# Estructura: CompraAgil_VB/mercadopublico-scraper/agile-bidder/evaristo/
PROYECTO_ROOT = Path(__file__).parent.parent  # agile-bidder/
REPOSITORIO_ROOT = PROYECTO_ROOT.parent.parent  # CompraAgil_VB/ (repositorio principal)
FRONTEND_ROOT = PROYECTO_ROOT  # agile-bidder/ (frontend www.firmavb.cl)

REPORTES_DIR = PROYECTO_ROOT / "evaristo" / "reportes"
MISIONES_DIR = PROYECTO_ROOT / "evaristo" / "misiones"
LOG_FILE = PROYECTO_ROOT / "evaristo" / "evaristo.log"

# Crear directorios necesarios
REPORTES_DIR.mkdir(parents=True, exist_ok=True)
MISIONES_DIR.mkdir(parents=True, exist_ok=True)

# --- PERSONALIDAD DEL AGENTE ---
SYSTEM_PROMPT = """
Eres Evaristo, un Ingeniero de Software Senior experto en:
- TypeScript/React
- Supabase (PostgreSQL, Edge Functions)
- Node.js y ecosistema moderno
- Arquitectura de software y mejores prácticas

Tu misión es mantener y mejorar el sistema FirmaVB que gestiona www.firmavb.cl:

REPOSITORIO: CompraAgil_VB (evarasvb/CompraAgil_VB)
FRONTEND: mercadopublico-scraper/agile-bidder/ (www.firmavb.cl)

Sistema que gestiona:
- Compras Ágiles de MercadoPúblico
- Matching de inventario con licitaciones
- Generación automática de ofertas
- Integración con Odoo
- Extensiones de Chrome para scraping
- Bot autónomo (Evaristo) para mantenimiento continuo

REGLA DE NEGOCIO CRÍTICA - CLASIFICACIÓN DE PROCESOS:
⚠️ IMPORTANTE: Distinción entre LICITACIONES y COMPRAS ÁGILES basada en monto:

- LICITACIONES: Monto > 100 UTM (aproximadamente > $6.700.000 CLP en 2026)
- COMPRAS ÁGILES: Monto <= 100 UTM (aproximadamente <= $6.700.000 CLP en 2026)

Esta distinción debe aplicarse en TODO el sistema:
- Clasificación de procesos al guardar
- Filtros y queries
- Interfaces de usuario
- Documentación
- Lógica de negocio

UTM 2026: ~$67.000 CLP (verificar en SII y actualizar anualmente)
Umbral: 100 UTM = ~$6.700.000 CLP

REGLAS DE ORO:
1. SIEMPRE hacer backup antes de modificar código
2. Mantener compatibilidad con el código existente
3. Seguir las convenciones del proyecto
4. Probar cambios antes de aplicarlos
5. Reportar claramente qué se hizo y por qué
6. SIEMPRE respetar la regla de clasificación: >100 UTM = Licitación, <=100 UTM = Compra Ágil

Cuando te pidan código, devuelve SOLO el código corregido/mejorado, sin explicaciones largas.
Si hay errores, corrígelos. Si hay mejoras posibles, aplícalas.
"""

class Evaristo:
    def __init__(self):
        self.gemini_key = GEMINI_API_KEY
        self.deepseek_key = DEEPSEEK_API_KEY
        self.ollama_url = OLLAMA_BASE_URL
        self.provider = None
        self.has_ai = bool(self.gemini_key or self.deepseek_key)
        
        # Determinar proveedor disponible
        if self.gemini_key:
            self.provider = "gemini"
            self.log("✅ Evaristo inicializado con Google Gemini")
        elif self.deepseek_key:
            self.provider = "deepseek"
            self.log("✅ Evaristo inicializado con DeepSeek")
        else:
            self.log("⚠️  Evaristo funcionando en modo local (sin IA)")
            self.log("   Configura GEMINI_API_KEY o DEEPSEEK_API_KEY para activar IA")
    
    def log(self, mensaje: str):
        """Registra mensajes en el log"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_msg = f"[{timestamp}] {mensaje}\n"
        print(log_msg, end="")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_msg)
    
    def hacer_backup(self, ruta_archivo: Path):
        """Regla de Oro: Siempre hacer copia de seguridad"""
        if not ruta_archivo.exists():
            return None
        
        backup_dir = PROYECTO_ROOT / "evaristo" / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = backup_dir / f"{ruta_archivo.name}.{timestamp}.backup"
        
        shutil.copy(ruta_archivo, backup)
        self.log(f"🛡️  Backup creado: {backup.name}")
        return backup
    
    def leer_archivo(self, ruta: Path) -> str:
        """Lee un archivo y retorna su contenido"""
        try:
            with open(ruta, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            self.log(f"❌ Error leyendo {ruta}: {e}")
            return ""
    
    def guardar_archivo(self, ruta: Path, contenido: str):
        """Guarda contenido en un archivo"""
        try:
            with open(ruta, 'w', encoding='utf-8') as f:
                f.write(contenido)
            self.log(f"💾 Archivo guardado: {ruta.relative_to(PROYECTO_ROOT)}")
            return True
        except Exception as e:
            self.log(f"❌ Error guardando {ruta}: {e}")
            return False
    
    def cerebro_pensante(self, codigo_actual: str, instruccion: str, archivo_nombre: str, contexto: str = "") -> Optional[str]:
        """Envía el código a la IA para que lo trabaje usando múltiples proveedores"""
        if not self.has_ai:
            self.log("⚠️  No hay API key configurada (Gemini o DeepSeek)")
            return None
        
        # Intentar con cada proveedor en orden de fallback
        proveedores = []
        if self.gemini_key:
            proveedores.append(("gemini", self.gemini_key))
        if self.deepseek_key:
            proveedores.append(("deepseek", self.deepseek_key))
        
        for provider_name, api_key in proveedores:
            self.log(f"🧠 Analizando {archivo_nombre} con {provider_name.upper()}...")
            resultado = self._llamar_ia(provider_name, api_key, codigo_actual, instruccion, archivo_nombre, contexto)
            if resultado:
                return resultado
        
        self.log("❌ No se pudo obtener respuesta de ningún proveedor de IA")
        return None
    
    def _llamar_ia(self, provider: str, api_key: str, codigo_actual: str, instruccion: str, archivo_nombre: str, contexto: str) -> Optional[str]:
        """Llama a un proveedor específico de IA"""
        prompt_completo = f"""{SYSTEM_PROMPT}

ARCHIVO: {archivo_nombre}
CONTEXTO DEL PROYECTO: {contexto}

MISIÓN: {instruccion}

CÓDIGO ACTUAL:
```typescript
{codigo_actual}
```

INSTRUCCIONES:
- Devuelve SOLO el código corregido/mejorado
- Mantén la estructura y convenciones del proyecto
- Si hay errores, corrígelos
- Si hay mejoras posibles, aplícalas
- No agregues comentarios innecesarios
- Asegúrate de que el código compile sin errores
- Responde ÚNICAMENTE con el código, sin explicaciones adicionales
"""
        
        if provider == "gemini":
            return self._llamar_gemini(api_key, prompt_completo)
        elif provider == "deepseek":
            return self._llamar_deepseek(api_key, prompt_completo)
        else:
            return None
    
    def _llamar_gemini(self, api_key: str, prompt: str) -> Optional[str]:
        """Llama a la API de Gemini"""
        if not HAS_REQUESTS:
            return None
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 8192
            }
        }
        
        modelos = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]
        max_retries = 2
        retry_delay = 15
        
        for modelo in modelos:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
            
            for intento in range(max_retries):
                try:
                    response = requests.post(
                        url,
                        json=payload,
                        headers={'Content-Type': 'application/json', 'X-goog-api-key': api_key},
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if "candidates" in data and len(data["candidates"]) > 0:
                            texto = data["candidates"][0]["content"]["parts"][0].get("text", "")
                            if texto:
                                texto = re.sub(r'```typescript\n?', '', texto)
                                texto = re.sub(r'```tsx\n?', '', texto)
                                texto = re.sub(r'```ts\n?', '', texto)
                                texto = re.sub(r'```\n?', '', texto)
                                self.log(f"✅ Respuesta recibida de Gemini ({modelo})")
                                return texto.strip()
                    
                    # Si hay error de cuota, probar siguiente modelo
                    if response.status_code == 429:
                        self.log(f"⚠️  Cuota agotada en {modelo}, probando siguiente...")
                        break
                        
                except Exception as e:
                    if "429" in str(e) or "quota" in str(e).lower():
                        if intento < max_retries - 1:
                            time.sleep(retry_delay)
                            continue
                        break
                    self.log(f"⚠️  Error con Gemini {modelo}: {e}")
        
        return None
    
    def _llamar_deepseek(self, api_key: str, prompt: str) -> Optional[str]:
        """Llama a la API de DeepSeek"""
        if not HAS_REQUESTS:
            return None
        
        url = "https://api.deepseek.com/v1/chat/completions"
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 8192
        }
        
        try:
            response = requests.post(
                url,
                json=payload,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}'
                },
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                if "choices" in data and len(data["choices"]) > 0:
                    texto = data["choices"][0]["message"]["content"]
                    if texto:
                        texto = re.sub(r'```typescript\n?', '', texto)
                        texto = re.sub(r'```tsx\n?', '', texto)
                        texto = re.sub(r'```ts\n?', '', texto)
                        texto = re.sub(r'```\n?', '', texto)
                        self.log("✅ Respuesta recibida de DeepSeek")
                        return texto.strip()
            else:
                self.log(f"⚠️  Error HTTP {response.status_code} con DeepSeek: {response.text}")
                
        except Exception as e:
            self.log(f"⚠️  Error con DeepSeek: {e}")
        
        return None
        
        prompt_completo = f"""{SYSTEM_PROMPT}

ARCHIVO: {archivo_nombre}
CONTEXTO DEL PROYECTO: {contexto}

MISIÓN: {instruccion}

CÓDIGO ACTUAL:
```typescript
{codigo_actual}
```

INSTRUCCIONES:
- Devuelve SOLO el código corregido/mejorado
- Mantén la estructura y convenciones del proyecto
- Si hay errores, corrígelos
- Si hay mejoras posibles, aplícalas
- No agregues comentarios innecesarios
- Asegúrate de que el código compile sin errores
- Responde ÚNICAMENTE con el código, sin explicaciones adicionales
"""
        
        # Preparar payload para la API
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt_completo
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 8192
            }
        }
        
        # Intentar con diferentes modelos si uno falla
        modelos_a_probar = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"]
        max_retries = 3
        retry_delay = 15
        
        for modelo in modelos_a_probar:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
            
            for intento in range(max_retries):
                try:
                    if not HAS_REQUESTS:
                        raise Exception("La librería 'requests' no está instalada. Ejecuta: pip install requests")
                    
                    # Hacer la llamada HTTP con requests
                    response = requests.post(
                        url,
                        json=payload,
                        headers={
                            'Content-Type': 'application/json',
                            'X-goog-api-key': self.api_key
                        },
                        timeout=60
                    )
                    
                    respuesta_json = response.json()
                    
                    # Verificar si hay error
                    if "error" in respuesta_json:
                        error_info = respuesta_json["error"]
                        error_code = error_info.get("code", 0)
                        error_msg = error_info.get("message", "")
                        
                        # Si es rate limit, esperar y reintentar
                        if error_code == 429 or "quota" in error_msg.lower() or "rate" in error_msg.lower():
                            if intento < max_retries - 1:
                                # Extraer tiempo de espera
                                retry_delay = 15
                                if "retry in" in error_msg.lower():
                                    match = re.search(r'retry in (\d+\.?\d*)s', error_msg)
                                    if match:
                                        retry_delay = int(float(match.group(1))) + 2
                                
                                self.log(f"⏳ Rate limit alcanzado con {modelo}. Esperando {retry_delay}s... (intento {intento + 1}/{max_retries})")
                                time.sleep(retry_delay)
                                continue
                            else:
                                # Si este modelo falló, probar el siguiente
                                self.log(f"⚠️  {modelo} no disponible (cuota agotada). Probando siguiente modelo...")
                                break
                        else:
                            raise Exception(f"Error de API: {error_msg}")
                    
                    # Verificar código HTTP
                    if response.status_code != 200:
                        raise Exception(f"Error HTTP {response.status_code}: {response.text}")
                    
                    # Extraer el texto de la respuesta
                    if "candidates" in respuesta_json and len(respuesta_json["candidates"]) > 0:
                        candidate = respuesta_json["candidates"][0]
                        if "content" in candidate and "parts" in candidate["content"]:
                            codigo_nuevo = candidate["content"]["parts"][0].get("text", "")
                            
                            if codigo_nuevo:
                                # Limpiar el código (remover markdown si existe)
                                codigo_nuevo = re.sub(r'```typescript\n?', '', codigo_nuevo)
                                codigo_nuevo = re.sub(r'```tsx\n?', '', codigo_nuevo)
                                codigo_nuevo = re.sub(r'```ts\n?', '', codigo_nuevo)
                                codigo_nuevo = re.sub(r'```\n?', '', codigo_nuevo)
                                codigo_nuevo = codigo_nuevo.strip()
                                
                                self.log(f"✅ Respuesta recibida de {modelo}")
                                return codigo_nuevo
                    
                    raise Exception("Respuesta de API sin contenido válido")
                        
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429:
                        if intento < max_retries - 1:
                            self.log(f"⏳ HTTP 429 con {modelo}. Esperando {retry_delay}s...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            break  # Probar siguiente modelo
                    else:
                        raise Exception(f"Error HTTP {e.response.status_code}: {e.response.text}")
                        
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str or "quota" in error_str.lower():
                        if intento < max_retries - 1:
                            self.log(f"⏳ Error de cuota. Esperando {retry_delay}s...")
                            time.sleep(retry_delay)
                            continue
                        else:
                            break  # Probar siguiente modelo
                    else:
                        raise
        
        # Si llegamos aquí, todos los modelos fallaron
        self.log(f"❌ Error en cerebro_pensante: No se pudo obtener respuesta de ningún modelo. La API key puede tener límites de cuota.")
        return None
    
    def ejecutar_mision(self, mision: Dict):
        """Ejecuta una misión específica"""
        nombre = mision.get("nombre", "Sin nombre")
        tipo = mision.get("tipo", "revisar")
        archivo = mision.get("archivo")
        instruccion = mision.get("instruccion", "")
        
        self.log(f"\n🎯 INICIANDO MISIÓN: {nombre}")
        
        if tipo == "revisar" and archivo:
            ruta_archivo = PROYECTO_ROOT / archivo
            if ruta_archivo.exists():
                codigo_viejo = self.leer_archivo(ruta_archivo)
                if codigo_viejo:
                    # Primero hacer verificación básica
                    verificacion = self.verificar_archivo_basico(ruta_archivo)
                    
                    if verificacion.get("problemas"):
                        self.log(f"⚠️  Problemas encontrados en {archivo}:")
                        for problema in verificacion["problemas"]:
                            self.log(f"   - {problema}")
                    
                    if verificacion.get("mejoras"):
                        self.log(f"💡 Mejoras sugeridas para {archivo}:")
                        for mejora in verificacion["mejoras"]:
                            self.log(f"   - {mejora}")
                    
                    # Si hay API key, usar IA para mejoras
                    if self.has_ai:
                        self.hacer_backup(ruta_archivo)
                        contexto = self.obtener_contexto_proyecto()
                        codigo_nuevo = self.cerebro_pensante(codigo_viejo, instruccion, archivo, contexto)
                        
                        if codigo_nuevo and codigo_nuevo != codigo_viejo:
                            if self.guardar_archivo(ruta_archivo, codigo_nuevo):
                                self.generar_reporte(nombre, archivo, "✅ Completada", f"Código mejorado en {archivo}")
                                return True
                        else:
                            self.log(f"ℹ️  No se requirieron cambios en {archivo}")
                            self.generar_reporte(nombre, archivo, "ℹ️ Sin cambios", "El código ya está optimizado")
                            return True
                    else:
                        # Modo sin IA - solo reportar
                        estado = "✅ Verificado" if not verificacion.get("problemas") else "⚠️ Problemas encontrados"
                        detalles = f"Verificación básica completada. {len(verificacion.get('problemas', []))} problemas, {len(verificacion.get('mejoras', []))} mejoras sugeridas"
                        self.generar_reporte(nombre, archivo, estado, detalles)
                        return True
            else:
                self.log(f"❌ Archivo no encontrado: {archivo}")
                return False
        
        elif tipo == "modificar" and archivo:
            # Modificar un archivo existente usando IA
            ruta_archivo = PROYECTO_ROOT / archivo
            if ruta_archivo.exists():
                codigo_viejo = self.leer_archivo(ruta_archivo)
                if codigo_viejo:
                    if self.has_ai:
                        self.hacer_backup(ruta_archivo)
                        contexto = self.obtener_contexto_proyecto()
                        codigo_nuevo = self.cerebro_pensante(codigo_viejo, instruccion, archivo, contexto)
                        
                        if codigo_nuevo and codigo_nuevo != codigo_viejo:
                            if self.guardar_archivo(ruta_archivo, codigo_nuevo):
                                self.generar_reporte(nombre, archivo, "✅ Completada", f"Archivo modificado: {archivo}")
                                return True
                        else:
                            self.log(f"ℹ️  No se requirieron cambios en {archivo}")
                            self.generar_reporte(nombre, archivo, "ℹ️ Sin cambios", "El código ya cumple con los requisitos")
                            return True
                    else:
                        self.log("⚠️  Se requiere IA para modificar archivos")
                        self.generar_reporte(nombre, archivo, "❌ Requiere IA", "Configura DEEPSEEK_API_KEY o GEMINI_API_KEY")
                        return False
            else:
                self.log(f"❌ Archivo no encontrado: {archivo}")
                return False
        
        elif tipo == "crear" and archivo:
            # Crear un nuevo archivo usando IA
            ruta_archivo = PROYECTO_ROOT / archivo
            if ruta_archivo.exists():
                self.log(f"ℹ️  Archivo ya existe: {archivo}")
                self.generar_reporte(nombre, archivo, "ℹ️ Ya existe", "El archivo ya existe, no se creó")
                return True
            
            if self.has_ai:
                # Crear el archivo desde cero usando IA
                contexto = self.obtener_contexto_proyecto()
                codigo_nuevo = self.cerebro_pensante("", instruccion, archivo, contexto)
                
                if codigo_nuevo:
                    # Asegurar que el directorio existe
                    ruta_archivo.parent.mkdir(parents=True, exist_ok=True)
                    if self.guardar_archivo(ruta_archivo, codigo_nuevo):
                        self.generar_reporte(nombre, archivo, "✅ Creado", f"Nuevo archivo creado: {archivo}")
                        return True
                else:
                    self.log(f"❌ No se pudo generar código para {archivo}")
                    self.generar_reporte(nombre, archivo, "❌ Error", "No se pudo generar el código")
                    return False
            else:
                self.log("⚠️  Se requiere IA para crear archivos")
                self.generar_reporte(nombre, archivo, "❌ Requiere IA", "Configura DEEPSEEK_API_KEY o GEMINI_API_KEY")
                return False
        
        elif tipo == "verificar":
            # Verificar que el proyecto compile
            resultado = self.verificar_proyecto()
            self.generar_reporte(nombre, "proyecto", "✅ Verificado" if resultado else "❌ Errores", "")
            return resultado
        
        elif tipo == "instalar":
            # Instalar dependencias
            resultado = self.instalar_dependencias()
            self.generar_reporte(nombre, "dependencias", "✅ Instaladas" if resultado else "❌ Error", "")
            return resultado
        
        return False
    
    def obtener_contexto_proyecto(self) -> str:
        """Obtiene contexto del proyecto para ayudar a la IA"""
        contexto = """
Proyecto: FirmaVB - Agile Bidder
Stack: TypeScript, React, Vite, Supabase, TailwindCSS
Estructura:
- src/ : Código fuente principal
- supabase/ : Funciones Edge y migraciones
- chrome-extension/ : Extensión de Chrome para scraping
- Componentes principales: Compras Ágiles, Matching, Ofertas
- Hooks: useComprasAgiles, useMatchInventario, useLicitaciones
- Base de datos: compras_agiles, licitaciones, inventory
"""
        return contexto
    
    def verificar_proyecto(self) -> bool:
        """Verifica que el proyecto compile sin errores"""
        self.log("🔍 Verificando proyecto...")
        try:
            # Verificar TypeScript
            resultado = subprocess.run(
                ["npm", "run", "type-check"],
                cwd=PROYECTO_ROOT,
                capture_output=True,
                text=True,
                timeout=60
            )
            if resultado.returncode == 0:
                self.log("✅ Proyecto compila correctamente")
                return True
            else:
                self.log(f"❌ Errores de compilación:\n{resultado.stderr}")
                return False
        except Exception as e:
            self.log(f"⚠️  No se pudo verificar: {e}")
            return False
    
    def instalar_dependencias(self) -> bool:
        """Instala dependencias del proyecto"""
        self.log("📦 Instalando dependencias...")
        try:
            resultado = subprocess.run(
                ["npm", "install"],
                cwd=PROYECTO_ROOT,
                capture_output=True,
                text=True,
                timeout=300
            )
            if resultado.returncode == 0:
                self.log("✅ Dependencias instaladas")
                return True
            else:
                self.log(f"❌ Error instalando: {resultado.stderr}")
                return False
        except Exception as e:
            self.log(f"❌ Error: {e}")
            return False
    
    def generar_reporte(self, mision: str, archivo: str, estado: str, detalles: str):
        """Genera un reporte de la misión"""
        reporte = {
            "timestamp": datetime.now().isoformat(),
            "mision": mision,
            "archivo": archivo,
            "estado": estado,
            "detalles": detalles
        }
        
        reporte_file = REPORTES_DIR / f"reporte_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(reporte_file, 'w', encoding='utf-8') as f:
            json.dump(reporte, f, indent=2, ensure_ascii=False)
        
        self.log(f"📊 Reporte guardado: {reporte_file.name}")
    
    def verificar_archivo_basico(self, ruta_archivo: Path) -> Dict:
        """Verifica un archivo sin usar IA (verificaciones básicas)"""
        if not ruta_archivo.exists():
            return {"error": "Archivo no encontrado"}
        
        codigo = self.leer_archivo(ruta_archivo)
        problemas = []
        mejoras = []
        
        # Verificar imports faltantes comunes
        if "import" in codigo and "from" in codigo:
            # Verificar que los imports estén al inicio
            lineas = codigo.split('\n')
            imports_encontrados = False
            for i, linea in enumerate(lineas[:20]):  # Primeras 20 líneas
                if linea.strip().startswith(('import ', 'from ')):
                    imports_encontrados = True
                elif imports_encontrados and linea.strip() and not linea.strip().startswith('//') and not linea.strip().startswith('/*'):
                    if 'import' in linea or 'from' in linea:
                        problemas.append(f"Línea {i+1}: Import fuera de lugar")
        
        # Verificar errores comunes de TypeScript
        if ruta_archivo.suffix in ['.ts', '.tsx']:
            if 'any' in codigo and '// @ts-ignore' not in codigo:
                mejoras.append("Considera reemplazar 'any' con tipos específicos")
            
            if 'console.log' in codigo:
                mejoras.append("Considera remover console.log en producción")
            
            # Verificar manejo de errores
            if 'try' in codigo and 'catch' in codigo:
                if 'error' in codigo.lower() and 'Error' not in codigo:
                    mejoras.append("Asegúrate de manejar errores apropiadamente")
        
        return {
            "problemas": problemas,
            "mejoras": mejoras,
            "lineas": len(codigo.split('\n'))
        }
    
    def revisar_proyecto_completo(self):
        """Revisa el proyecto completo y ejecuta misiones de mantenimiento"""
        self.log("\n" + "="*60)
        self.log(f"🚀 {NOMBRE_AGENTE} - REVISIÓN COMPLETA DEL PROYECTO")
        self.log("="*60)
        
        # Misiones predefinidas
        misiones = [
            {
                "nombre": "Verificar compilación",
                "tipo": "verificar",
                "archivo": None,
                "instruccion": "Verificar que el proyecto compile sin errores"
            },
            {
                "nombre": "Revisar hooks de compras ágiles",
                "tipo": "revisar",
                "archivo": "src/hooks/useComprasAgiles.ts",
                "instruccion": "Revisa este hook. Asegúrate de que maneje errores correctamente, que las queries estén optimizadas y que los tipos TypeScript sean correctos."
            },
            {
                "nombre": "Revisar página de Compras Ágiles",
                "tipo": "revisar",
                "archivo": "src/pages/ComprasAgiles.tsx",
                "instruccion": "Revisa esta página. Verifica que todos los componentes estén correctamente importados, que los handlers funcionen y que no haya errores de TypeScript."
            },
            {
                "nombre": "Revisar función Edge sync-compras-agiles",
                "tipo": "revisar",
                "archivo": "supabase/functions/sync-compras-agiles/index.ts",
                "instruccion": "Revisa esta función Edge. Asegúrate de que valide correctamente los datos, maneje errores apropiadamente y que el mapeo de datos sea correcto."
            },
            {
                "nombre": "Revisar hooks de matching",
                "tipo": "revisar",
                "archivo": "src/hooks/useMatching.ts",
                "instruccion": "Revisa este hook de matching. Verifica que consulte correctamente compras_agiles, que actualice los datos correctamente y que invalide las queries apropiadas."
            },
        ]
        
        resultados = []
        for mision in misiones:
            try:
                resultado = self.ejecutar_mision(mision)
                resultados.append({
                    "mision": mision["nombre"],
                    "exito": resultado
                })
            except Exception as e:
                self.log(f"❌ Error en misión {mision['nombre']}: {e}")
                resultados.append({
                    "mision": mision["nombre"],
                    "exito": False,
                    "error": str(e)
                })
        
        # Generar reporte final
        self.generar_reporte_final(resultados)
    
    def generar_reporte_final(self, resultados: List[Dict]):
        """Genera un reporte final resumido"""
        self.log("\n" + "="*60)
        self.log("📊 REPORTE FINAL")
        self.log("="*60)
        
        exitosos = sum(1 for r in resultados if r.get("exito"))
        total = len(resultados)
        
        for resultado in resultados:
            estado = "✅" if resultado.get("exito") else "❌"
            self.log(f"{estado} {resultado['mision']}")
            if "error" in resultado:
                self.log(f"   Error: {resultado['error']}")
        
        self.log(f"\n📈 Resumen: {exitosos}/{total} misiones completadas")
        
        # Guardar reporte resumido
        reporte_resumen = {
            "fecha": datetime.now().isoformat(),
            "total_misiones": total,
            "exitosas": exitosos,
            "fallidas": total - exitosos,
            "resultados": resultados
        }
        
        reporte_file = REPORTES_DIR / "resumen_latest.json"
        with open(reporte_file, 'w', encoding='utf-8') as f:
            json.dump(reporte_resumen, f, indent=2, ensure_ascii=False)
        
        self.log(f"💾 Reporte guardado en: {reporte_file}")


def main():
    """Función principal"""
    print("\n" + "="*60)
    print(f"🤖 {NOMBRE_AGENTE} - Iniciando...")
    print("="*60 + "\n")
    
    if not API_KEY and HAS_GEMINI:
        print("⚠️  ADVERTENCIA: No hay API_KEY configurada")
        print("   Evaristo funcionará en modo verificación básica (sin IA)")
        print("   Para usar IA con Gemini, configura:")
        print("   export GEMINI_API_KEY='tu-api-key'")
        print("   O: export GOOGLE_API_KEY='tu-api-key'")
        print("")
        print("   Obtén tu API key gratis en: https://makersuite.google.com/app/apikey")
        print("")
    
    evaristo = Evaristo()
    
    # Verificar argumentos
    if len(sys.argv) > 1:
        if sys.argv[1] == "revisar":
            evaristo.revisar_proyecto_completo()
        elif sys.argv[1] == "mision":
            # Ejecutar misión específica desde archivo JSON
            if len(sys.argv) > 2:
                mision_file = MISIONES_DIR / sys.argv[2]
                if not mision_file.exists():
                    # Intentar con extensión .json si no se proporcionó
                    mision_file = MISIONES_DIR / f"{sys.argv[2]}.json"
                
                if mision_file.exists():
                    with open(mision_file, 'r', encoding='utf-8') as f:
                        mision_data = json.load(f)
                    
                    # Si el archivo tiene una lista de misiones, ejecutarlas todas
                    if "misiones" in mision_data:
                        evaristo.log(f"\n🎯 Ejecutando misión: {mision_data.get('nombre', 'Sin nombre')}")
                        evaristo.log(f"📝 Descripción: {mision_data.get('descripcion', 'Sin descripción')}")
                        evaristo.log(f"📊 Total de tareas: {len(mision_data['misiones'])}\n")
                        
                        resultados = []
                        for i, mision in enumerate(mision_data['misiones'], 1):
                            evaristo.log(f"\n{'='*60}")
                            evaristo.log(f"Tarea {i}/{len(mision_data['misiones'])}: {mision.get('nombre', 'Sin nombre')}")
                            evaristo.log(f"{'='*60}")
                            try:
                                resultado = evaristo.ejecutar_mision(mision)
                                resultados.append({
                                    "mision": mision.get("nombre", "Sin nombre"),
                                    "exito": resultado
                                })
                            except Exception as e:
                                evaristo.log(f"❌ Error en misión {mision.get('nombre', 'Sin nombre')}: {e}")
                                resultados.append({
                                    "mision": mision.get("nombre", "Sin nombre"),
                                    "exito": False,
                                    "error": str(e)
                                })
                        
                        evaristo.generar_reporte_final(resultados)
                    else:
                        # Es una misión individual
                        evaristo.ejecutar_mision(mision_data)
                else:
                    print(f"❌ Archivo de misión no encontrado: {mision_file}")
                    print(f"   Buscado en: {MISIONES_DIR}")
            else:
                print("Uso: python evaristo_manager.py mision <nombre_mision.json>")
                print(f"   Misiones disponibles en: {MISIONES_DIR}")
        else:
            print("Uso:")
            print("  python evaristo_manager.py revisar  - Revisa todo el proyecto")
            print("  python evaristo_manager.py mision <archivo.json>  - Ejecuta misión específica")
    else:
        # Por defecto, revisar proyecto completo
        evaristo.revisar_proyecto_completo()


if __name__ == "__main__":
    main()
