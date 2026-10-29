#!usr/bin/env python
# -*- coding: utf-8 -*-

"""
GENERADOR AUTOMÁTICO DE COCINAS MODULARES - FASE 1
Fusion 360 - Python Script
Autor: Sistema Modully
Fecha: 2026-08-08

DESCRIPCIÓN:
Script que genera módulos base (MB) y aéreos (MA) de cocinas
con propiedades automáticas según línea de producto.

CÓMO USAR:
1. En Fusion 360: Tools → Scripts and Add-ons → Create Script
2. Nombre: "generador_modulos_fusion_fase1"
3. Copiar este código completo
4. Ejecutar (Play button)
5. Seguir los prompts
"""

import adsk.core
import adsk.fusion
import traceback
from typing import List, Dict, Tuple

# ============================================================================
# CONSTANTES - PARÁMETROS FIJOS DE CONSTRUCCIÓN
# ============================================================================

PARAMETROS_CONSTRUCCION = {
    'MB': {
        'altura': 800,      # mm - Alto de módulos base
        'profundo': 570,    # mm - Profundidad módulos base
        'espesor_estructura': 15,  # mm
    },
    'MA': {
        'altura': 1080,     # mm - Alto de módulos aéreos
        'profundo': 330,    # mm - Profundidad módulos aéreos
        'espesor_estructura': 15,  # mm
    },
    'espesor_espaldar': 6,  # mm
    'espesor_frentes_basica': 15,  # mm
    'espesor_frentes_media': 18,   # mm
    'espesor_frentes_alta': 18,    # mm
}

# ============================================================================
# SISTEMA DE PROPIEDADES POR LÍNEA
# ============================================================================

PROPIEDADES_LINEA = {
    'Baja': {
        'laterales_aéreos_material': 'Blanco RH',
        'laterales_aéreos_cantos': '1L [COLOR] 2A [Blanco]',
        'laterales_base_material': 'Blanco RH',
        'laterales_base_cantos': '1L [COLOR]',
        'entrepaños_material': 'Blanco RH',
        'entrepaños_cantos': '1L [Blanco]',
        'fachada_cantos': '4LR/4LF',
        'fachada_espesor': 15,
        'testeros_material': 'Blanco RH',
        'testeros_cantos': '1L',
    },
    'Media': {
        'laterales_aéreos_material': '[COLOR] RH',
        'laterales_aéreos_cantos': '1L [COLOR] 2A [COLOR]',
        'laterales_base_material': '[COLOR] RH',
        'laterales_base_cantos': '1L [COLOR] 2A [COLOR]',
        'entrepaños_material': 'Blanco RH',
        'entrepaños_cantos': '1L [Blanco] 2A [COLOR]',
        'fachada_cantos': '4LR/4LF',
        'fachada_espesor': '15/18',
        'testeros_material': '[COLOR] RH',
        'testeros_cantos': '1L',
    },
    'Alta': {
        'laterales_aéreos_material': '[COLOR] RH',
        'laterales_aéreos_cantos': '4LF [COLOR]',
        'laterales_base_material': '[COLOR] RH',
        'laterales_base_cantos': '4LF [COLOR]',
        'entrepaños_material': 'Blanco RH',
        'entrepaños_cantos': '4LF [COLOR]',
        'fachada_cantos': '4LR/4LF',
        'fachada_espesor': 18,
        'testeros_material': '[COLOR] RH',
        'testeros_cantos': '4LF',
    }
}

# ============================================================================
# CLASE: Generador de Módulos
# ============================================================================

class GeneradorModulos:
    def __init__(self, design):
        self.design = design
        self.raiz = design.rootComponent
        self.contador_componentes = 0
        self.piezas_generadas = []

    def crear_modulo_base(self, ancho_mm: float, posicion_x: float,
                         indice: int, linea: str, color_fachada: str) -> Dict:
        """
        Crea un módulo base (MB) con todas sus piezas y propiedades

        Args:
            ancho_mm: Ancho del módulo en mm
            posicion_x: Posición X en el modelo
            indice: Número de módulo (A, B, C...)
            linea: Tipo de línea (Baja/Media/Alta)
            color_fachada: Color de la fachada
        """

        letra = chr(65 + indice)  # A, B, C, ...
        modulo_data = {
            'tipo': 'MB',
            'letra': letra,
            'ancho': ancho_mm,
            'posicion_x': posicion_x,
            'piezas': []
        }

        # Crear componente contenedor
        componente = self.raiz.occurrences.addNewComponent(
            adsk.core.Matrix3D.create()
        )
        componente.component.name = f"MB-{letra}"

        # CREAR PIEZAS
        # 1. Laterales (2x)
        for lado in ['Izq', 'Der']:
            pieza = self._crear_pieza(
                nombre=f"Lateral MB-{letra}",
                ancho=PARAMETROS_CONSTRUCCION['MB']['profundo'],
                alto=PARAMETROS_CONSTRUCCION['MB']['altura'],
                espesor=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
                cantidad=2,
                material=self._get_material_laterales_base(linea, color_fachada),
                cantos=self._get_cantos_laterales_base(linea, color_fachada),
                color=self._get_color_laterales_base(linea, color_fachada),
                calibre=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
            )
            modulo_data['piezas'].append(pieza)

        # 2. Base (1x)
        pieza = self._crear_pieza(
            nombre=f"Base MB-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MB']['profundo'],
            espesor=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
            cantidad=1,
            material=self._get_material_laterales_base(linea, color_fachada),
            cantos=self._get_cantos_laterales_base(linea, color_fachada),
            color=self._get_color_laterales_base(linea, color_fachada),
            calibre=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 3. Techo (1x)
        pieza = self._crear_pieza(
            nombre=f"Techo MB-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MB']['profundo'],
            espesor=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
            cantidad=1,
            material=self._get_material_laterales_base(linea, color_fachada),
            cantos=self._get_cantos_laterales_base(linea, color_fachada),
            color=self._get_color_laterales_base(linea, color_fachada),
            calibre=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 4. Espaldar (1x)
        pieza = self._crear_pieza(
            nombre=f"Espaldar MB-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MB']['altura'],
            espesor=PARAMETROS_CONSTRUCCION['espesor_espaldar'],
            cantidad=1,
            material='Blanco RH',
            cantos='—',
            color='Blanco',
            calibre=PARAMETROS_CONSTRUCCION['espesor_espaldar'],
        )
        modulo_data['piezas'].append(pieza)

        # 5. Entrepaño (1x)
        pieza = self._crear_pieza(
            nombre=f"Entrepaño MB-{letra}",
            ancho=ancho_mm - 4,  # Con holgura
            alto=PARAMETROS_CONSTRUCCION['MB']['profundo'] - 4,
            espesor=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
            cantidad=1,
            material='Blanco RH',
            cantos='1L [Blanco]',
            color='Blanco',
            calibre=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 6. Fachada (puertas)
        ancho_puerta = (ancho_mm - 4) / 2 - 2
        pieza = self._crear_pieza(
            nombre=f"Fachada puerta izq MB-{letra}",
            ancho=ancho_puerta,
            alto=750,  # Alto estándar de puertas MB
            espesor=self._get_espesor_fachada(linea),
            cantidad=2,
            material=color_fachada,
            cantos='4LR',
            color=color_fachada,
            calibre=self._get_espesor_fachada(linea),
        )
        modulo_data['piezas'].append(pieza)

        # 7. Gola superior (1x)
        pieza = self._crear_pieza(
            nombre=f"Gola superior MB-{letra}",
            ancho=ancho_mm,
            alto=65,  # Ancho de la gola
            espesor=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
            cantidad=1,
            material=self._get_material_laterales_base(linea, color_fachada),
            cantos='1L',
            color=self._get_color_laterales_base(linea, color_fachada),
            calibre=PARAMETROS_CONSTRUCCION['MB']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        self.piezas_generadas.extend(modulo_data['piezas'])
        return modulo_data

    def crear_modulo_aereo(self, ancho_mm: float, posicion_x: float,
                          indice: int, linea: str, color_fachada: str) -> Dict:
        """
        Crea un módulo aéreo (MA) con todas sus piezas y propiedades
        """

        letra = chr(65 + indice)
        modulo_data = {
            'tipo': 'MA',
            'letra': letra,
            'ancho': ancho_mm,
            'posicion_x': posicion_x,
            'piezas': []
        }

        # Crear componente contenedor
        componente = self.raiz.occurrences.addNewComponent(
            adsk.core.Matrix3D.create()
        )
        componente.component.name = f"MA-{letra}"

        # CREAR PIEZAS AÉREAS
        # Similar a MB pero con dimensiones aéreas

        # 1. Laterales (2x)
        pieza = self._crear_pieza(
            nombre=f"Lateral aéreo MA-{letra}",
            ancho=PARAMETROS_CONSTRUCCION['MA']['profundo'],
            alto=PARAMETROS_CONSTRUCCION['MA']['altura'],
            espesor=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
            cantidad=2,
            material=color_fachada,
            cantos=self._get_cantos_laterales_aereo(linea, color_fachada),
            color=color_fachada,
            calibre=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 2. Base (1x)
        pieza = self._crear_pieza(
            nombre=f"Base aéreo MA-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MA']['profundo'],
            espesor=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
            cantidad=1,
            material=color_fachada,
            cantos='2L',
            color=color_fachada,
            calibre=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 3. Techo (1x)
        pieza = self._crear_pieza(
            nombre=f"Techo aéreo MA-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MA']['profundo'],
            espesor=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
            cantidad=1,
            material=color_fachada,
            cantos='2L',
            color=color_fachada,
            calibre=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 4. Espaldar (1x)
        pieza = self._crear_pieza(
            nombre=f"Espaldar aéreo MA-{letra}",
            ancho=ancho_mm,
            alto=PARAMETROS_CONSTRUCCION['MA']['altura'],
            espesor=PARAMETROS_CONSTRUCCION['espesor_espaldar'],
            cantidad=1,
            material='Blanco RH',
            cantos='—',
            color='Blanco',
            calibre=PARAMETROS_CONSTRUCCION['espesor_espaldar'],
        )
        modulo_data['piezas'].append(pieza)

        # 5. Entrepaño (1x)
        pieza = self._crear_pieza(
            nombre=f"Entrepaño aéreo MA-{letra}",
            ancho=ancho_mm - 4,
            alto=PARAMETROS_CONSTRUCCION['MA']['profundo'] - 4,
            espesor=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
            cantidad=1,
            material='Blanco RH',
            cantos='1L [Blanco] 2A',
            color='Blanco',
            calibre=PARAMETROS_CONSTRUCCION['MA']['espesor_estructura'],
        )
        modulo_data['piezas'].append(pieza)

        # 6. Fachada (puertas aéreas)
        ancho_puerta = (ancho_mm - 4) / 2 - 2
        pieza = self._crear_pieza(
            nombre=f"Fachada aéreo MA-{letra}",
            ancho=ancho_puerta,
            alto=PARAMETROS_CONSTRUCCION['MA']['altura'] - 10,  # Con pestaña
            espesor=self._get_espesor_fachada(linea),
            cantidad=2,
            material=color_fachada,
            cantos='4LR',
            color=color_fachada,
            calibre=self._get_espesor_fachada(linea),
        )
        modulo_data['piezas'].append(pieza)

        self.piezas_generadas.extend(modulo_data['piezas'])
        return modulo_data

    # ========================================================================
    # MÉTODOS AUXILIARES - PROPIEDADES SEGÚN LÍNEA
    # ========================================================================

    def _get_material_laterales_base(self, linea: str, color: str) -> str:
        if linea == 'Baja':
            return 'Blanco RH'
        else:
            return f'{color} RH'

    def _get_material_laterales_aereo(self, linea: str, color: str) -> str:
        if linea == 'Baja':
            return 'Blanco RH'
        else:
            return f'{color} RH'

    def _get_color_laterales_base(self, linea: str, color: str) -> str:
        if linea == 'Baja':
            return 'Blanco'
        else:
            return color

    def _get_cantos_laterales_base(self, linea: str, color: str) -> str:
        if linea == 'Baja':
            return f'1L {color}'
        elif linea == 'Media':
            return f'1L {color} 2A {color}'
        else:  # Alta
            return f'4LF {color}'

    def _get_cantos_laterales_aereo(self, linea: str, color: str) -> str:
        if linea == 'Baja':
            return f'1L {color} 2A Blanco'
        elif linea == 'Media':
            return f'1L {color} 2A {color}'
        else:  # Alta
            return f'4LF {color}'

    def _get_espesor_fachada(self, linea: str) -> int:
        if linea == 'Baja':
            return 15
        elif linea == 'Media':
            return 18  # Puede ser 15 o 18
        else:  # Alta
            return 18

    def _crear_pieza(self, nombre: str, ancho: float, alto: float,
                    espesor: float, cantidad: int, material: str,
                    cantos: str, color: str, calibre: int) -> Dict:
        """
        Crea un registro de pieza con todas sus propiedades
        """
        pieza = {
            'nombre': nombre,
            'ancho_mm': ancho,
            'alto_mm': alto,
            'espesor_mm': espesor,
            'cantidad': cantidad,
            'material': material,
            'cantos': cantos,
            'color': color,
            'calibre_mm': calibre,
        }
        return pieza

    def generar_reporte_bom(self) -> str:
        """Genera un reporte legible del BOM generado"""

        reporte = "\n" + "="*80 + "\n"
        reporte += "BILL OF MATERIALS (BOM) - COCINA MODULAR\n"
        reporte += "="*80 + "\n\n"

        reporte += f"{'ITEM':<6} {'PARTE':<30} {'C/D':<6} {'LARGO':<10} {'ANCHO':<10} {'CAL':<6} {'COLOR':<15} {'CANTO':<20}\n"
        reporte += "-"*80 + "\n"

        item = 1
        total_piezas = 0

        for pieza in self.piezas_generadas:
            reporte += f"{item:<6} {pieza['nombre']:<30} {pieza['cantidad']:<6} "
            reporte += f"{pieza['alto_mm']:<10} {pieza['ancho_mm']:<10} "
            reporte += f"{pieza['calibre_mm']:<6} {pieza['color']:<15} {pieza['cantos']:<20}\n"

            total_piezas += pieza['cantidad']
            item += 1

        reporte += "-"*80 + "\n"
        reporte += f"\nTOTAL DE PIEZAS: {total_piezas}\n"
        reporte += f"NÚMERO DE TIPOS DIFERENTES: {len(self.piezas_generadas)}\n"
        reporte += "\n" + "="*80 + "\n"

        return reporte


# ============================================================================
# FUNCIÓN PRINCIPAL - PUNTO DE ENTRADA
# ============================================================================

def run(context):
    """Función principal que ejecuta el generador"""

    try:
        app = adsk.core.Application.get()
        design = adsk.fusion.Design.cast(app.activeDocument.products.itemByProductType('Design'))

        # Crear instancia del generador
        generador = GeneradorModulos(design)

        # ====================================================================
        # INPUT DEL USUARIO
        # ====================================================================

        ui = app.userInterface

        # Crear paleta de entrada
        palette = ui.palettes.itemById('textPalette')
        if not palette:
            palette = ui.palettes.add('textPalette', 'Generador Cocinas', 'generador_input', False)

        # Para esta FASE 1, usamos valores de ejemplo
        # En futuras fases, tendremos un formulario interactivo completo

        ui.messageBox("""
GENERADOR DE COCINAS MODULARES - FASE 1

Este script creará una cocina de ejemplo con:
  • Módulo Base 1: 600mm (línea Media, color Ámbar)
  • Módulo Base 2: 900mm (línea Media, color Ámbar)
  • Módulo Aéreo: 600mm (línea Media, color Ámbar)

Todas las piezas incluirán propiedades automáticas.

¡Presiona OK para continuar!
        """, "Información")

        # ====================================================================
        # GENERAR MÓDULOS DE PRUEBA
        # ====================================================================

        linea = 'Media'
        color = 'Ámbar'

        # Crear módulos base
        modulo_b1 = generador.crear_modulo_base(
            ancho_mm=600,
            posicion_x=0,
            indice=0,  # A
            linea=linea,
            color_fachada=color
        )

        modulo_b2 = generador.crear_modulo_base(
            ancho_mm=900,
            posicion_x=600,
            indice=1,  # B
            linea=linea,
            color_fachada=color
        )

        # Crear módulo aéreo
        modulo_a1 = generador.crear_modulo_aereo(
            ancho_mm=600,
            posicion_x=0,
            indice=0,  # C
            linea=linea,
            color_fachada=color
        )

        # ====================================================================
        # GENERAR REPORTE
        # ====================================================================

        reporte = generador.generar_reporte_bom()
        print(reporte)

        # Mostrar reporte
        ui.messageBox(
            reporte + "\n\n✅ COCINA GENERADA EXITOSAMENTE\n\nAhora puedes ver el BOM en la consola.",
            "Generación Completada"
        )

    except Exception as e:
        if ui:
            ui.messageBox(f"Error: {str(e)}\n\n{traceback.format_exc()}")
        else:
            print(f"Error: {str(e)}\n\n{traceback.format_exc()}")


# ============================================================================
# EJECUTAR SCRIPT
# ============================================================================

if __name__ == '__main__':
    run(None)
