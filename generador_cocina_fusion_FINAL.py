"""
GENERADOR DE COCINAS MODULARES - FUSION 360
Version validada 2026-08-10; alineada con la app y el documento de Fusion 2026-11-04 (ver cambios abajo)

COMO REUTILIZAR ESTE SCRIPT SIN IA (para una cocina nueva):

1. Ve al final del archivo, a la funcion run()
2. Ahi encontraras la seccion "===== CONFIGURA TU COCINA AQUI ====="
3. Cambia SOLO esos valores:
   - COLOR_BASE, COLOR_AEREO_ESTRUCTURA, COLOR_AEREO_FACHADA (colores)
   - Los anchos (en mm) y posiciones (pos_x) de cada modulo
   - El tipo de funcion segun el modulo (crear_modulo_puertas, crear_modulo_cajonero,
     crear_modulo_campana, crear_modulo_aereo_puertas)
4. Antes de ejecutar: borra todos los componentes existentes en el navegador de Fusion
5. Ejecuta (Play). Luego corre extractor_bom_fusion_FINAL.py para el listado.

Alineacion 2026-11-04 (con bomService.ts de la app y el documento de Fusion):
 - Luz de las puertas de la campana: 4 mm (antes 3).
 - Los amarres (MB y MA) van SIN canto: quedan ocultos.
 - Base del MB y piso/techo del MA llevan el mismo canto que los laterales (canto de su propio color).
 - "Test Frontal/Trasero" pasan a llamarse "Testero Frontal/Trasero".

NO necesitas tocar nada de las funciones crear_panel, crear_estructura_mb, etc.
Esas ya estan validadas y no deben modificarse salvo que encuentres un error real.
"""

import adsk.core
import adsk.fusion
import traceback

def mm_to_cm(mm):
    return mm / 10.0

GRUPO_BOM = 'BOM'

# ============================================================
# PARAMETROS FIJOS DE CONSTRUCCION (no tocar salvo cambio de linea de producto)
# ============================================================
ESP = 15
ESP_FRENTE = 18
ESP_FONDO = 6
GOLA_L = 65
LUZ_CAJON = 13
PROF_CAJON = 500

MB_ALTO = 800
MB_FONDO = 570
AMARRE_MB_ALTO = 80
PUERTA_ALTURA_MB = 750

# --- Espacio: lo mide el usuario. Se pregunta al ejecutar (ver run) ---
# El zocalo es generalmente de 100 mm, pero SIEMPRE se pregunta.
# El meson se apoya sobre los modulos base (zocalo + modulo base); el aereo arranca 600 mm sobre la
# CARA SUPERIOR del meson; su alto se calcula a partir del muro.
MESON_ESPESOR_DEFECTO = 20  # mm. Valor sugerido al preguntar
ZOCALO_DEFECTO = 100      # mm. Valor sugerido al preguntar
ALTO_MURO_DEFECTO = 2600  # mm. Valor sugerido al preguntar. 2600 reproduce el aereo validado de 1080
HUECO_MESON_AEREO = 600   # mm entre la cara superior del meson y la base del aereo
CIERRE_TECHO = 20         # mm libres bajo el techo

MA_FONDO = 330
Y_DESFASE_MA = MB_FONDO - MA_FONDO                         # 240
AMARRE_MA_ALTO = 60

CAMPANA_RECORTE = 85      # mm: el modulo campana es 85 mm mas corto que los aereos vecinos
CAMPANA_Z_OFFSET = CAMPANA_RECORTE   # y se eleva lo mismo para mantener el techo alineado
CAMPANA_LUZ_PUERTA = 4    # mm: las puertas de la campana quedan 4 mm por encima de la base del modulo (luz de seguridad)

# Se recalculan en configurar_espacio()
ZOCALO = ZOCALO_DEFECTO
ALTO_MURO = ALTO_MURO_DEFECTO
MESON_ESPESOR = MESON_ESPESOR_DEFECTO
Z_MESON = Z_MA_BASE = MA_ALTO = CAMPANA_ALTO = 0


def configurar_espacio(zocalo_mm, alto_muro_mm, meson_espesor_mm=MESON_ESPESOR_DEFECTO):
    """Calcula las alturas que dependen del zocalo, el meson y el muro medido por el usuario."""
    global ZOCALO, ALTO_MURO, MESON_ESPESOR, Z_MESON, Z_MA_BASE, MA_ALTO, CAMPANA_ALTO
    ZOCALO = zocalo_mm
    ALTO_MURO = alto_muro_mm
    MESON_ESPESOR = meson_espesor_mm
    Z_MESON = ZOCALO + MB_ALTO + MESON_ESPESOR              # cara superior del meson
    Z_MA_BASE = Z_MESON + HUECO_MESON_AEREO                 # aereo = cara superior del meson + 600
    MA_ALTO = ALTO_MURO - Z_MA_BASE - CIERRE_TECHO          # aereo calculado desde el muro
    CAMPANA_ALTO = MA_ALTO - CAMPANA_RECORTE


configurar_espacio(ZOCALO_DEFECTO, ALTO_MURO_DEFECTO, MESON_ESPESOR_DEFECTO)  # 1520 y 1060 con los valores por defecto


def pedir_medida(ui, titulo, mensaje, defecto, permitir_cero=False):
    """Pregunta una medida en mm. Devuelve None si el usuario cancela o escribe algo invalido."""
    valor, cancelado = ui.inputBox(mensaje, titulo, str(int(defecto)))
    if cancelado:
        return None
    try:
        medida = float(valor.replace(',', '.'))
    except ValueError:
        ui.messageBox(f"Valor invalido: '{valor}'. Escribe un numero en mm.")
        return None
    if medida < 0 or (medida == 0 and not permitir_cero):
        ui.messageBox("La medida debe ser mayor que cero.")
        return None
    return medida


def crear_panel(parent_comp, part_number, dim_x_mm, dim_y_mm, dim_z_mm,
                 offset_x_mm, offset_y_mm, offset_z_mm,
                 largo_mm, ancho_mm, calibre_mm, color, canto):
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(
        mm_to_cm(offset_x_mm), mm_to_cm(offset_y_mm), mm_to_cm(offset_z_mm)
    )
    occ = parent_comp.occurrences.addNewComponent(transform)
    comp = occ.component
    comp.name = part_number

    sketch = comp.sketches.add(comp.xYConstructionPlane)
    lines = sketch.sketchCurves.sketchLines
    p0 = adsk.core.Point3D.create(0, 0, 0)
    p1 = adsk.core.Point3D.create(mm_to_cm(dim_x_mm), mm_to_cm(dim_y_mm), 0)
    lines.addTwoPointRectangle(p0, p1)

    prof = sketch.profiles.item(0)
    extrudes = comp.features.extrudeFeatures
    ext_input = extrudes.createInput(prof, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
    ext_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm_to_cm(dim_z_mm)))
    ext = extrudes.add(ext_input)

    body = ext.bodies.item(0)
    body.name = part_number

    attrs = body.attributes
    attrs.add(GRUPO_BOM, 'PartNumber', part_number)
    attrs.add(GRUPO_BOM, 'Largo', str(largo_mm))
    attrs.add(GRUPO_BOM, 'Ancho', str(ancho_mm))
    attrs.add(GRUPO_BOM, 'Calibre', str(calibre_mm))
    attrs.add(GRUPO_BOM, 'Color', color)
    attrs.add(GRUPO_BOM, 'Canto', canto)

    return body


# ============================================================
# MB - MODULO BASE (sin techo ni espaldar, con amarres)
# ============================================================

def crear_estructura_mb(comp_modulo, letra, ancho_mm, color_estructura, lleva_entrepano=False):
    piezas = []
    ancho_int = ancho_mm - 2 * ESP
    canto_lateral = f'1L {color_estructura} 2A {color_estructura}'

    piezas.append(crear_panel(comp_modulo, f"Lateral Izq {letra}",
        ESP, MB_FONDO, MB_ALTO, 0, 0, 0,
        largo_mm=MB_ALTO, ancho_mm=MB_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Lateral Der {letra}",
        ESP, MB_FONDO, MB_ALTO, ancho_mm - ESP, 0, 0,
        largo_mm=MB_ALTO, ancho_mm=MB_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Base {letra}",
        ancho_int, MB_FONDO, ESP, ESP, 0, 0,
        largo_mm=ancho_int, ancho_mm=MB_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Amarre Sup Tras {letra}",
        ancho_int, ESP, AMARRE_MB_ALTO, ESP, MB_FONDO - ESP, MB_ALTO - AMARRE_MB_ALTO,
        largo_mm=ancho_int, ancho_mm=AMARRE_MB_ALTO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='-'))

    piezas.append(crear_panel(comp_modulo, f"Amarre Inf Tras {letra}",
        ancho_int, ESP, AMARRE_MB_ALTO, ESP, MB_FONDO - ESP, ESP,
        largo_mm=ancho_int, ancho_mm=AMARRE_MB_ALTO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='-'))

    if lleva_entrepano:
        piezas.append(crear_panel(comp_modulo, f"Entrepano {letra}",
            ancho_int, MB_FONDO - 20, ESP, ESP, 0, 400,
            largo_mm=ancho_int, ancho_mm=MB_FONDO - 20, calibre_mm=ESP,
            color='Blanco RH', canto='1L Blanco 2A Blanco'))

    return piezas


def crear_golas_mb(comp_modulo, letra, ancho_mm, color_estructura, es_cajonero=False):
    piezas = []
    ancho_int = ancho_mm - 2 * ESP
    z_gola_sup = MB_ALTO - GOLA_L - ESP

    piezas.append(crear_panel(comp_modulo, f"Gola Sup Horiz {letra}",
        ancho_int, GOLA_L, ESP, ESP, 0, z_gola_sup,
        largo_mm=ancho_int, ancho_mm=GOLA_L, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=f'1L {color_estructura}'))

    piezas.append(crear_panel(comp_modulo, f"Gola Sup Vert {letra}",
        ancho_int, ESP, GOLA_L, ESP, 15, z_gola_sup + ESP,
        largo_mm=ancho_int, ancho_mm=GOLA_L, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=f'1L {color_estructura}'))

    if es_cajonero:
        z_gola_med = 330
        piezas.append(crear_panel(comp_modulo, f"Gola Med Horiz {letra}",
            ancho_int, GOLA_L, ESP, ESP, 0, z_gola_med,
            largo_mm=ancho_int, ancho_mm=GOLA_L, calibre_mm=ESP,
            color=f'{color_estructura} RH', canto=f'1L {color_estructura}'))

        piezas.append(crear_panel(comp_modulo, f"Gola Med Vert {letra}",
            ancho_int, ESP, GOLA_L, ESP, 15, z_gola_med + ESP,
            largo_mm=ancho_int, ancho_mm=GOLA_L, calibre_mm=ESP,
            color=f'{color_estructura} RH', canto=f'1L {color_estructura}'))

    return piezas


def crear_puerta_unica_mb(comp_modulo, letra, ancho_mm, color_fachada):
    w = ancho_mm - 4
    return [crear_panel(comp_modulo, f"Puerta {letra}",
        w, ESP_FRENTE, PUERTA_ALTURA_MB, 2, -ESP_FRENTE, 0,
        largo_mm=PUERTA_ALTURA_MB, ancho_mm=w, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR')]


def crear_puertas_dobles_mb(comp_modulo, letra, ancho_mm, color_fachada):
    piezas = []
    w = (ancho_mm - 6) / 2
    piezas.append(crear_panel(comp_modulo, f"Puerta Izq {letra}",
        w, ESP_FRENTE, PUERTA_ALTURA_MB, 2, -ESP_FRENTE, 0,
        largo_mm=PUERTA_ALTURA_MB, ancho_mm=w, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))
    piezas.append(crear_panel(comp_modulo, f"Puerta Der {letra}",
        w, ESP_FRENTE, PUERTA_ALTURA_MB, 2 + w + 2, -ESP_FRENTE, 0,
        largo_mm=PUERTA_ALTURA_MB, ancho_mm=w, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))
    return piezas


def crear_caja_cajon(comp_modulo, nombre_base, letra, ancho_mm, z_base, alto_caj, offset_y, color_estructura):
    piezas = []
    ancho_ext = (ancho_mm - 2 * ESP) - (2 * LUZ_CAJON)
    x_lat_izq = ESP + LUZ_CAJON

    piezas.append(crear_panel(comp_modulo, f"Lat Izq {nombre_base} {letra}",
        ESP, PROF_CAJON, alto_caj, x_lat_izq, offset_y, z_base,
        largo_mm=alto_caj, ancho_mm=PROF_CAJON, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='1L {}'.format(color_estructura)))

    piezas.append(crear_panel(comp_modulo, f"Lat Der {nombre_base} {letra}",
        ESP, PROF_CAJON, alto_caj, x_lat_izq + ancho_ext - ESP, offset_y, z_base,
        largo_mm=alto_caj, ancho_mm=PROF_CAJON, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='1L {}'.format(color_estructura)))

    piezas.append(crear_panel(comp_modulo, f"Testero Frontal {nombre_base} {letra}",
        ancho_ext - 2 * ESP, ESP, alto_caj, x_lat_izq + ESP, offset_y, z_base,
        largo_mm=ancho_ext - 2 * ESP, ancho_mm=alto_caj, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='1L {}'.format(color_estructura)))

    piezas.append(crear_panel(comp_modulo, f"Testero Trasero {nombre_base} {letra}",
        ancho_ext - 2 * ESP, ESP, alto_caj, x_lat_izq + ESP, offset_y + PROF_CAJON - ESP, z_base,
        largo_mm=ancho_ext - 2 * ESP, ancho_mm=alto_caj, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='1L {}'.format(color_estructura)))

    piezas.append(crear_panel(comp_modulo, f"Fondo {nombre_base} {letra}",
        ancho_ext - 20, PROF_CAJON - 20, ESP_FONDO, x_lat_izq + ESP - 5, offset_y + 10, z_base + 15,
        largo_mm=ancho_ext - 20, ancho_mm=PROF_CAJON - 20, calibre_mm=ESP_FONDO,
        color='Blanco', canto='-'))

    return piezas


def crear_modulo_puertas(root_comp, letra, ancho_mm, pos_x_mm, color_estructura, color_fachada, num_puertas=2):
    """MODULOS SIMPLES CON PUERTAS: usa esta funcion para Condimentero (num_puertas=1)
    o cualquier modulo de 2 puertas tipo Lavaplatos/Estufa/Cierre (num_puertas=2)."""
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(mm_to_cm(pos_x_mm), 0, mm_to_cm(ZOCALO))
    occ_modulo = root_comp.occurrences.addNewComponent(transform)
    comp_modulo = occ_modulo.component
    comp_modulo.name = f"MB-{letra}-{int(ancho_mm)}mm"

    lleva_entrepano = ancho_mm >= 450
    piezas = crear_estructura_mb(comp_modulo, letra, ancho_mm, color_estructura, lleva_entrepano)
    piezas.extend(crear_golas_mb(comp_modulo, letra, ancho_mm, color_estructura, es_cajonero=False))

    if num_puertas == 1:
        piezas.extend(crear_puerta_unica_mb(comp_modulo, letra, ancho_mm, color_fachada))
    else:
        piezas.extend(crear_puertas_dobles_mb(comp_modulo, letra, ancho_mm, color_fachada))

    return comp_modulo, piezas


def crear_modulo_cajonero(root_comp, letra, ancho_mm, pos_x_mm, color_estructura, color_fachada):
    """MODULO CAJONERO: 3 cajones reales + cubiertero oculto + gola media."""
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(mm_to_cm(pos_x_mm), 0, mm_to_cm(ZOCALO))
    occ_modulo = root_comp.occurrences.addNewComponent(transform)
    comp_modulo = occ_modulo.component
    comp_modulo.name = f"MB-{letra}-{int(ancho_mm)}mm-Cajonero"

    piezas = crear_estructura_mb(comp_modulo, letra, ancho_mm, color_estructura, lleva_entrepano=False)
    piezas.extend(crear_golas_mb(comp_modulo, letra, ancho_mm, color_estructura, es_cajonero=True))

    w_frente = ancho_mm - 4

    piezas.append(crear_panel(comp_modulo, f"Frente Inf {letra}",
        w_frente, ESP_FRENTE, 360, 2, -ESP_FRENTE, 0,
        largo_mm=360, ancho_mm=w_frente, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))

    piezas.append(crear_panel(comp_modulo, f"Frente Sup {letra}",
        w_frente, ESP_FRENTE, 360, 2, -ESP_FRENTE, 390,
        largo_mm=360, ancho_mm=w_frente, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))

    piezas.extend(crear_caja_cajon(comp_modulo, "Cajon Inf", letra, ancho_mm, 35, 180, 0, color_estructura))
    piezas.extend(crear_caja_cajon(comp_modulo, "Cajon Med", letra, ancho_mm, 445, 100, 0, color_estructura))
    piezas.extend(crear_caja_cajon(comp_modulo, "Cajon Cubiertero", letra, ancho_mm, 605, 80, 18, color_estructura))

    piezas.append(crear_panel(comp_modulo, f"Frente Cubiertero {letra}",
        ancho_mm - 30, ESP_FRENTE, 110, 15, 0, 605,
        largo_mm=110, ancho_mm=ancho_mm - 30, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))

    return comp_modulo, piezas


# ============================================================
# MA - MODULO AEREO (con espaldar retranqueado, amarres y desfase Y)
# ============================================================

def crear_estructura_ma(comp_modulo, letra, ancho_mm, color_estructura, alto=None):
    if alto is None:
        alto = MA_ALTO
    piezas = []
    ancho_int = ancho_mm - 2 * ESP
    canto_lateral = f'1L {color_estructura} 2A {color_estructura}'

    piezas.append(crear_panel(comp_modulo, f"Lateral Izq {letra}",
        ESP, MA_FONDO, alto, 0, 0, 0,
        largo_mm=alto, ancho_mm=MA_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Lateral Der {letra}",
        ESP, MA_FONDO, alto, ancho_mm - ESP, 0, 0,
        largo_mm=alto, ancho_mm=MA_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Piso {letra}",
        ancho_int, MA_FONDO, ESP, ESP, 0, 0,
        largo_mm=ancho_int, ancho_mm=MA_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    piezas.append(crear_panel(comp_modulo, f"Techo {letra}",
        ancho_int, MA_FONDO, ESP, ESP, 0, alto - ESP,
        largo_mm=ancho_int, ancho_mm=MA_FONDO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto=canto_lateral))

    alto_fondo = alto - 2 * ESP + 5
    piezas.append(crear_panel(comp_modulo, f"Espaldar {letra}",
        ancho_int, ESP_FONDO, alto_fondo, ESP, MA_FONDO - ESP - ESP_FONDO, ESP,
        largo_mm=ancho_int, ancho_mm=alto_fondo, calibre_mm=ESP_FONDO,
        color='Blanco', canto='-'))

    piezas.append(crear_panel(comp_modulo, f"Amarre Sup 1 {letra}",
        ancho_int, ESP, AMARRE_MA_ALTO, ESP, MA_FONDO - ESP, alto - ESP - AMARRE_MA_ALTO,
        largo_mm=ancho_int, ancho_mm=AMARRE_MA_ALTO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='-'))

    piezas.append(crear_panel(comp_modulo, f"Amarre Sup 2 {letra}",
        ancho_int, ESP, AMARRE_MA_ALTO, ESP, MA_FONDO - ESP, alto - ESP - 2 * AMARRE_MA_ALTO,
        largo_mm=ancho_int, ancho_mm=AMARRE_MA_ALTO, calibre_mm=ESP,
        color=f'{color_estructura} RH', canto='-'))

    return piezas


def crear_entrepano_ma(comp_modulo, letra, ancho_mm, alto_z=400):
    ancho_int = ancho_mm - 2 * ESP
    return crear_panel(comp_modulo, f"Entrepano {letra}",
        ancho_int, MA_FONDO - 20, ESP, ESP, 0, alto_z,
        largo_mm=ancho_int, ancho_mm=MA_FONDO - 20, calibre_mm=ESP,
        color='Blanco RH', canto='1L Blanco 2A Blanco')


def crear_modulo_aereo_puertas(root_comp, letra, ancho_mm, pos_x_mm, z_start, color_estructura, color_fachada, num_puertas=2):
    """MODULOS AEREOS SIMPLES: num_puertas=1 (abatible angosto) o 2 (estandar horizontal dividido)."""
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(mm_to_cm(pos_x_mm), mm_to_cm(Y_DESFASE_MA), mm_to_cm(z_start))
    occ_modulo = root_comp.occurrences.addNewComponent(transform)
    comp_modulo = occ_modulo.component
    comp_modulo.name = f"MA-{letra}-{int(ancho_mm)}mm"

    piezas = crear_estructura_ma(comp_modulo, letra, ancho_mm, color_estructura)

    if ancho_mm >= 450:
        piezas.append(crear_entrepano_ma(comp_modulo, letra, ancho_mm))

    w = ancho_mm - 4

    if num_puertas == 1:
        alto_puerta = MA_ALTO + 10
        piezas.append(crear_panel(comp_modulo, f"Puerta {letra}",
            w, ESP_FRENTE, alto_puerta, 2, -ESP_FRENTE, -10,
            largo_mm=alto_puerta, ancho_mm=w, calibre_mm=ESP_FRENTE,
            color=color_fachada, canto='4LR'))
    else:
        h_total = MA_ALTO + 10
        h_puerta = (h_total - 2) / 2
        piezas.append(crear_panel(comp_modulo, f"Puerta Horiz Inf {letra}",
            w, ESP_FRENTE, h_puerta, 2, -ESP_FRENTE, -10,
            largo_mm=h_puerta, ancho_mm=w, calibre_mm=ESP_FRENTE,
            color=color_fachada, canto='4LR'))
        piezas.append(crear_panel(comp_modulo, f"Puerta Horiz Sup {letra}",
            w, ESP_FRENTE, h_puerta, 2, -ESP_FRENTE, -10 + h_puerta + 2,
            largo_mm=h_puerta, ancho_mm=w, calibre_mm=ESP_FRENTE,
            color=color_fachada, canto='4LR'))

    return comp_modulo, piezas


def crear_modulo_campana(root_comp, letra, ancho_mm, pos_x_mm, z_start, color_estructura, color_fachada):
    """MODULO CAMPANA: siempre va sobre la estufa. Ancho reducido, elevado, puertas con luz de 3mm."""
    alto = CAMPANA_ALTO
    z_real = z_start + CAMPANA_Z_OFFSET

    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(mm_to_cm(pos_x_mm), mm_to_cm(Y_DESFASE_MA), mm_to_cm(z_real))
    occ_modulo = root_comp.occurrences.addNewComponent(transform)
    comp_modulo = occ_modulo.component
    comp_modulo.name = f"MA-{letra}-{int(ancho_mm)}mm-Campana"

    piezas = crear_estructura_ma(comp_modulo, letra, ancho_mm, color_estructura, alto=alto)

    w = ancho_mm - 4
    h_sup = (MA_ALTO + 10 - 2) / 2
    h_inf = (alto - CAMPANA_LUZ_PUERTA) - h_sup - 2

    piezas.append(crear_panel(comp_modulo, f"Puerta Campana Inf {letra}",
        w, ESP_FRENTE, h_inf, 2, -ESP_FRENTE, CAMPANA_LUZ_PUERTA,
        largo_mm=h_inf, ancho_mm=w, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))

    piezas.append(crear_panel(comp_modulo, f"Puerta Campana Sup {letra}",
        w, ESP_FRENTE, h_sup, 2, -ESP_FRENTE, CAMPANA_LUZ_PUERTA + h_inf + 2,
        largo_mm=h_sup, ancho_mm=w, calibre_mm=ESP_FRENTE,
        color=color_fachada, canto='4LR'))

    return comp_modulo, piezas


def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox("ERROR: No se pudo obtener el diseno activo.")
            return

        root = design.rootComponent

        # --- Medidas que se preguntan siempre: zocalo (generalmente 100 mm) y alto del muro ---
        zocalo = pedir_medida(ui, "Zocalo", "Altura del zocalo en mm (generalmente 100):", ZOCALO_DEFECTO)
        if zocalo is None:
            return
        alto_muro = pedir_medida(ui, "Alto del muro", "Alto del muro en mm (medido en obra):", ALTO_MURO_DEFECTO)
        if alto_muro is None:
            return
        meson_espesor = pedir_medida(ui, "Meson", "Espesor del meson en mm (generalmente 20; 0 si no lleva):", MESON_ESPESOR_DEFECTO, permitir_cero=True)
        if meson_espesor is None:
            return
        configurar_espacio(zocalo, alto_muro, meson_espesor)

        # =====================================================================
        # ===== CONFIGURA TU COCINA AQUI (esto es lo unico que cambias) ======
        # =====================================================================

        COLOR_BASE = 'Vienes'
        COLOR_AEREO_ESTRUCTURA = 'Blanco'
        COLOR_AEREO_FACHADA = 'Blanco High Gloss'

        todas_piezas = []

        # --- MODULOS BASE (de izquierda a derecha, pos_x en mm acumulado) ---
        _, piezas = crear_modulo_cajonero(root, 'A', 600, 0, COLOR_BASE, COLOR_BASE)
        todas_piezas.extend(piezas)

        _, piezas = crear_modulo_puertas(root, 'B', 200, 600, COLOR_BASE, COLOR_BASE, num_puertas=1)
        todas_piezas.extend(piezas)

        _, piezas = crear_modulo_puertas(root, 'C', 680, 800, COLOR_BASE, COLOR_BASE, num_puertas=2)
        todas_piezas.extend(piezas)

        # --- MODULOS AEREOS (mismo orden, pos_x propio) ---
        _, piezas = crear_modulo_campana(root, 'D', 600, 0, Z_MA_BASE, COLOR_AEREO_ESTRUCTURA, COLOR_AEREO_FACHADA)
        todas_piezas.extend(piezas)

        _, piezas = crear_modulo_aereo_puertas(root, 'E', 300, 600, Z_MA_BASE, COLOR_AEREO_ESTRUCTURA, COLOR_AEREO_FACHADA, num_puertas=1)
        todas_piezas.extend(piezas)

        _, piezas = crear_modulo_aereo_puertas(root, 'F', 580, 900, Z_MA_BASE, COLOR_AEREO_ESTRUCTURA, COLOR_AEREO_FACHADA, num_puertas=2)
        todas_piezas.extend(piezas)

        # =====================================================================
        # ===== FIN DE LA CONFIGURACION =====
        # =====================================================================

        ui.messageBox(f"Cocina completa creada.\nTotal piezas: {len(todas_piezas)}\n\nAhora corre extractor_bom_fusion_FINAL.py para generar el CSV.")

    except Exception as e:
        if ui:
            ui.messageBox(f"ERROR:\n{str(e)}\n\n{traceback.format_exc()}")


if __name__ == '__main__':
    run(None)
