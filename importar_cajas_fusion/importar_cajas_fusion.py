# -*- coding: utf-8 -*-
"""Importa en Fusion la lista de cajas exportada desde la app Modully ("Cajas para Fusion").

Crea un componente-cubo por cada caja (muros, zocalo, modulos bajos, aereos, torres, nevera...).
La app y Fusion usan la misma geometria: la lista de cajas es la fuente de verdad.

Sistema de coordenadas del JSON (mm):
  X a lo largo del muro A (izquierda a derecha), Y profundidad desde el muro A, Z altura desde el piso.
Mapeo a Fusion: el muro A queda en Y = 0 y la cocina se extiende hacia -Y (el frente mira a -Y),
igual que los scripts generadores de modulos.
"""

import json
import re
import traceback

import adsk.core
import adsk.fusion

app = adsk.core.Application.get()
ui = app.userInterface


def mm_to_cm(mm):
    """La API de Fusion siempre trabaja en centimetros."""
    return mm / 10.0


def nombre_valido(texto):
    return re.sub(r'[^0-9A-Za-z_ \-\.]', '', texto).strip() or 'Caja'


def crear_cubo(root, nombre, x, y, z, sx, sy, sz, aberturas=None):
    """Crea un cubo como componente propio: boceto rectangular en XY y extrusion en Z.

    aberturas: lista de rectangulos (x_local, y_local, ancho, fondo en mm, relativos a la esquina
    del cubo) que se cortan de lado a lado, por ejemplo la poceta y la estufa en un meson."""
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(mm_to_cm(x), mm_to_cm(y), mm_to_cm(z))
    occ = root.occurrences.addNewComponent(transform)
    comp = occ.component
    comp.name = nombre

    sketch = comp.sketches.add(comp.xYConstructionPlane)
    sketch.sketchCurves.sketchLines.addTwoPointRectangle(
        adsk.core.Point3D.create(0, 0, 0),
        adsk.core.Point3D.create(mm_to_cm(sx), mm_to_cm(sy), 0))
    profile = sketch.profiles.item(0)

    extrudes = comp.features.extrudeFeatures
    ext_input = extrudes.createInput(profile, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
    ext_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm_to_cm(sz)))
    extrudes.add(ext_input)

    for ab in (aberturas or []):
        sk = comp.sketches.add(comp.xYConstructionPlane)
        sk.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(mm_to_cm(ab['x']), mm_to_cm(ab['y']), 0),
            adsk.core.Point3D.create(mm_to_cm(ab['x'] + ab['sx']), mm_to_cm(ab['y'] + ab['sy']), 0))
        corte = extrudes.createInput(sk.profiles.item(0), adsk.fusion.FeatureOperations.CutFeatureOperation)
        corte.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm_to_cm(sz)))
        extrudes.add(corte)
    return comp


def run(_context):
    try:
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('ERROR: no hay un diseno activo. Abre o crea un documento de Fusion primero.')
            return

        dialogo = ui.createFileDialog()
        dialogo.title = 'Elige el archivo de cajas exportado desde Modully'
        dialogo.filter = 'Cajas Modully (*.json)'
        if dialogo.showOpen() != adsk.core.DialogResults.DialogOK:
            return

        with open(dialogo.filename, encoding='utf-8') as archivo:
            datos = json.load(archivo)

        if datos.get('units') != 'mm':
            ui.messageBox('El archivo no esta en milimetros; no se puede importar.')
            return

        cajas = datos.get('boxes', [])
        if not cajas:
            ui.messageBox('El archivo no tiene cajas.')
            return

        root = design.rootComponent
        usados = {}
        for caja in cajas:
            base = nombre_valido(f"{caja['kind']}-{caja['name']}")
            usados[base] = usados.get(base, 0) + 1
            nombre = base if usados[base] == 1 else f"{base}-{usados[base]}"

            # Y de Fusion = -(Y + sy): el muro A queda en Y = 0 y la cocina se extiende hacia -Y
            y_fusion = -(caja['y'] + caja['sy'])

            # Aberturas del meson (poceta, estufa): del sistema de la app (Y desde el muro) al local del cubo (Y hacia -Y)
            aberturas = []
            for c in caja.get('cutouts', []):
                aberturas.append({
                    'x': c['x'] - caja['x'],
                    'y': (caja['y'] + caja['sy']) - (c['y'] + c['sy']),
                    'sx': c['sx'],
                    'sy': c['sy'],
                })
            crear_cubo(root, nombre, caja['x'], y_fusion, caja['z'], caja['sx'], caja['sy'], caja['sz'], aberturas)

        app.activeViewport.fit()
        ui.messageBox(f"Se crearon {len(cajas)} cajas ({datos.get('layout', '')}).")

    except Exception:
        if ui:
            ui.messageBox(f'ERROR:\n{traceback.format_exc()}')
