"""
EXTRACTOR DE LISTADO DE PARTES (BOM) - FUSION 360
Version validada 2026-08-10

Este script NO necesita edicion nunca. Simplemente:
1. Abre el documento 3D de tu cocina (generado con generador_cocina_fusion_FINAL.py)
2. Ejecuta este script (Play)
3. Se genera un CSV en tu Escritorio con el listado agrupado, listo para Excel

Funciona con CUALQUIER cocina que uses, siempre que las piezas tengan los
atributos BOM (PartNumber, Largo, Ancho, Calibre, Color, Canto) que el
generador ya les asigna automaticamente.
"""

import adsk.core
import adsk.fusion
import traceback
import os
import unicodedata
from datetime import datetime

GRUPO_BOM = 'BOM'


def limpiar_texto(texto):
    if texto is None:
        return ''
    texto = texto.replace('—', '-').replace('–', '-')
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    return texto


def buscar_bodies_con_bom(component, encontrados):
    for body in component.bRepBodies:
        attr = body.attributes.itemByName(GRUPO_BOM, 'PartNumber')
        if attr is not None:
            encontrados.append(body)
    for occ in component.occurrences:
        buscar_bodies_con_bom(occ.component, encontrados)


def valor_o_defecto(attrs, nombre, defecto=''):
    attr = attrs.itemByName(GRUPO_BOM, nombre)
    return attr.value if attr is not None else defecto


def extraer_bom(design):
    root = design.rootComponent
    bodies_bom = []
    buscar_bodies_con_bom(root, bodies_bom)

    piezas_raw = []
    for body in bodies_bom:
        attrs = body.attributes
        piezas_raw.append({
            'part_number': limpiar_texto(valor_o_defecto(attrs, 'PartNumber')),
            'largo': valor_o_defecto(attrs, 'Largo'),
            'ancho': valor_o_defecto(attrs, 'Ancho'),
            'espesor': valor_o_defecto(attrs, 'Calibre'),
            'color': limpiar_texto(valor_o_defecto(attrs, 'Color')),
            'canto': limpiar_texto(valor_o_defecto(attrs, 'Canto')),
            'veta': limpiar_texto(valor_o_defecto(attrs, 'Veta', '')),
        })
    return piezas_raw


def agrupar_piezas(piezas_raw):
    grupos = {}
    for p in piezas_raw:
        key = (p['largo'], p['ancho'], p['espesor'], p['color'], p['canto'], p['veta'])
        if key not in grupos:
            grupos[key] = {'nombre': p['part_number'], 'cantidad': 0, **p}
        grupos[key]['cantidad'] += 1
    return list(grupos.values())


def exportar_csv(piezas_agrupadas, ruta):
    with open(ruta, 'w', newline='', encoding='utf-8') as f:
        f.write('ITEM;PARTE;C/D;LARGO;ANCHO;ESPESOR;COLOR;CANTO;VETA\n')
        for i, p in enumerate(piezas_agrupadas, start=1):
            f.write(f"{i};{p['nombre']};{p['cantidad']};{p['largo']};{p['ancho']};{p['espesor']};{p['color']};{p['canto']};{p['veta']}\n")


def obtener_carpeta_destino():
    home = os.path.expanduser('~')
    candidatos = [
        os.path.join(home, 'Desktop'),
        os.path.join(home, 'OneDrive', 'Desktop'),
        os.path.join(home, 'OneDrive', 'Escritorio'),
        os.path.join(home, 'Escritorio'),
        home,
    ]
    for c in candidatos:
        if os.path.isdir(c):
            return c
    return home


def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface

        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox("ERROR: No se pudo obtener el diseno activo.")
            return

        piezas_raw = extraer_bom(design)

        if not piezas_raw:
            ui.messageBox("No se encontraron piezas con propiedades BOM en este modelo.")
            return

        piezas_agrupadas = agrupar_piezas(piezas_raw)

        carpeta_destino = obtener_carpeta_destino()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        ruta_csv = os.path.join(carpeta_destino, f'Listado_Partes_Cocina_{timestamp}.csv')
        exportar_csv(piezas_agrupadas, ruta_csv)

        reporte = f"Piezas individuales encontradas: {len(piezas_raw)}\n"
        reporte += f"Piezas agrupadas (tipos unicos): {len(piezas_agrupadas)}\n\n"
        for i, p in enumerate(piezas_agrupadas, start=1):
            reporte += f"{i}. {p['nombre']}  x{p['cantidad']}\n"
            reporte += f"   {p['largo']}x{p['ancho']}mm  ESPESOR:{p['espesor']}mm  {p['color']}  {p['canto']}  VETA:{p['veta'] or '(sin definir)'}\n\n"

        ui.messageBox(f"CSV guardado en:\n{ruta_csv}\n\n{reporte}")

    except Exception as e:
        if ui:
            ui.messageBox(f"ERROR CAPTURADO:\n{str(e)}\n\n{traceback.format_exc()}")


if __name__ == '__main__':
    run(None)
