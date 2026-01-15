#!/usr/bin/env python3
"""
EVARISTO AUTÓNOMO - Mantenimiento Continuo
==========================================
Evaristo ejecuta misiones automáticamente para mantener el proyecto
100% operativo, funcional y óptimo.
"""

import os
import sys
import json
import time
import schedule
from datetime import datetime
from pathlib import Path
from evaristo_manager import Evaristo, PROYECTO_ROOT, MISIONES_DIR, REPORTES_DIR

# Configuración
INTERVALO_HORAS = 24  # Ejecutar cada 24 horas
MISION_AUTOMATICA = "mantenimiento_automatico.json"

def ejecutar_mantenimiento_automatico():
    """Ejecuta el mantenimiento automático"""
    evaristo = Evaristo()
    
    evaristo.log("\n" + "="*60)
    evaristo.log("🤖 EVARISTO AUTÓNOMO - MANTENIMIENTO AUTOMÁTICO")
    evaristo.log("="*60)
    evaristo.log(f"⏰ Iniciado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Cargar misión automática
    mision_file = MISIONES_DIR / MISION_AUTOMATICA
    if not mision_file.exists():
        evaristo.log(f"❌ No se encontró la misión automática: {mision_file}")
        return
    
    with open(mision_file, 'r', encoding='utf-8') as f:
        mision_data = json.load(f)
    
    evaristo.log(f"📋 Misión: {mision_data.get('nombre', 'Sin nombre')}")
    evaristo.log(f"📊 Total de tareas: {len(mision_data.get('misiones', []))}")
    
    resultados = []
    for i, mision in enumerate(mision_data.get('misiones', []), 1):
        evaristo.log(f"\n{'='*60}")
        evaristo.log(f"Tarea {i}/{len(mision_data['misiones'])}: {mision.get('nombre', 'Sin nombre')}")
        evaristo.log(f"{'='*60}")
        
        try:
            resultado = evaristo.ejecutar_mision(mision)
            resultados.append({
                "mision": mision.get("nombre", "Sin nombre"),
                "exito": resultado,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            evaristo.log(f"❌ Error en misión {mision.get('nombre', 'Sin nombre')}: {e}")
            resultados.append({
                "mision": mision.get("nombre", "Sin nombre"),
                "exito": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
    
    # Generar reporte
    evaristo.generar_reporte_final(resultados)
    
    # Guardar reporte de mantenimiento automático
    reporte_auto = {
        "tipo": "mantenimiento_automatico",
        "fecha": datetime.now().isoformat(),
        "resultados": resultados,
        "total_misiones": len(resultados),
        "exitosas": sum(1 for r in resultados if r.get("exito")),
        "fallidas": sum(1 for r in resultados if not r.get("exito"))
    }
    
    reporte_file = REPORTES_DIR / f"mantenimiento_auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(reporte_file, 'w', encoding='utf-8') as f:
        json.dump(reporte_auto, f, indent=2, ensure_ascii=False)
    
    evaristo.log(f"\n💾 Reporte de mantenimiento guardado: {reporte_file.name}")
    evaristo.log(f"✅ Mantenimiento automático completado")
    evaristo.log("="*60)

def main():
    """Función principal - Ejecuta mantenimiento automático"""
    print("\n" + "="*60)
    print("🤖 EVARISTO AUTÓNOMO - Iniciando...")
    print("="*60)
    print(f"⏰ Ejecutando mantenimiento automático cada {INTERVALO_HORAS} horas")
    print(f"📋 Misión: {MISION_AUTOMATICA}")
    print("")
    
    # Ejecutar inmediatamente
    ejecutar_mantenimiento_automatico()
    
    # Programar ejecución periódica
    schedule.every(INTERVALO_HORAS).hours.do(ejecutar_mantenimiento_automatico)
    
    print(f"\n🔄 Evaristo ejecutará mantenimiento automático cada {INTERVALO_HORAS} horas")
    print("💡 Presiona Ctrl+C para detener")
    print("")
    
    # Mantener el script corriendo
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Revisar cada minuto
    except KeyboardInterrupt:
        print("\n\n🛑 Evaristo Autónomo detenido por el usuario")
        sys.exit(0)

if __name__ == "__main__":
    main()
