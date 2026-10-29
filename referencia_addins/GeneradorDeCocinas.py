# -*- coding: utf-8 -*-
import adsk.core, adsk.fusion, traceback, os
app = None
ui  = None
handlers = []
CMD_ID   = 'generadorCocinaAddIn2'
CMD_NAME = 'Generador de Cocina'
CMD_DESC = 'Genera cocina 3D en cubos'
PANEL_ID = 'SolidScriptsAddinsPanel'
MURO_ESP = 150.0
NEV_TOL  = 100.0
FONDO_MN = 500.0

def c(mm): return mm / 10.0

def crear_cubo(root, nombre, px, py, pz, dx, dy, dz):
    t = adsk.core.Matrix3D.create()
    t.translation = adsk.core.Vector3D.create(c(px), c(py), c(pz))
    occ = root.occurrences.addNewComponent(t)
    comp = occ.component
    comp.name = nombre
    sk = comp.sketches.add(comp.xYConstructionPlane)
    sk.sketchCurves.sketchLines.addTwoPointRectangle(
        adsk.core.Point3D.create(0,0,0),
        adsk.core.Point3D.create(c(dx),c(dy),0))
    prof = sk.profiles.item(0)
    ei = comp.features.extrudeFeatures.createInput(
        prof, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
    ei.setDistanceExtent(False, adsk.core.ValueInput.createByReal(c(dz)))
    comp.features.extrudeFeatures.add(ei)
    return comp

def guardar_parametros(design, alto_mb, fondo_mb, alto_ma, fondo_ma, fondo_mn, nevera_ancho, nevera_alto, nevera_pos):
    params = design.userParameters
    def sp(nombre, valor):
        p = params.itemByName(nombre)
        if p:
            p.expression = str(int(valor))
        else:
            params.add(nombre, adsk.core.ValueInput.createByString(str(int(valor))+' mm'), 'mm', '')
    sp('coc_alto_mb',   alto_mb)
    sp('coc_fondo_mb',  fondo_mb)
    sp('coc_alto_ma',   alto_ma)
    sp('coc_fondo_ma',  fondo_ma)
    sp('coc_fondo_mn',  fondo_mn)
    sp('coc_nev_ancho', nevera_ancho)
    sp('coc_nev_alto',  nevera_alto)
    sp('coc_nev_pos',   nevera_pos)

def generar_cocina(root, muros, alto_mb, fondo_mb, alto_ma, fondo_ma, nevera_activa, nevera_ancho, nevera_alto, nevera_pos, fondo_mn):
    design = adsk.fusion.Design.cast(adsk.core.Application.get().activeProduct)
    guardar_parametros(design, alto_mb, fondo_mb, alto_ma, fondo_ma, fondo_mn, nevera_ancho, nevera_alto, nevera_pos)
    nev_total = (nevera_ancho + NEV_TOL) if nevera_activa else 0
    Y_MURO = fondo_mb
    Y_MA   = fondo_mb - fondo_ma
    Y_MN   = fondo_mb - fondo_mn if fondo_mb > fondo_mn else 0
    Z_MA   = alto_mb + 650.0
    for idx, m in enumerate(muros):
        L      = chr(65+idx)
        ancho  = m["ancho"]
        n_mb   = m["n_mb"]
        n_ma   = m["n_ma"]
        ox     = m["ox"]
        oy     = m["oy"]
        alto_m = m["alto_muro"]
        # Calcular inicio y espacio disponible para modulos
        if idx == 0 and nevera_activa:
            nev_reserva = nevera_pos + nevera_ancho + NEV_TOL
            mod_inicio  = nev_reserva
            espacio     = ancho - nev_reserva
        else:
            mod_inicio = 0.0
            espacio    = ancho

        crear_cubo(root, f"Muro {L}", ox, oy+Y_MURO, 0, ancho, MURO_ESP, alto_m)

        if idx == 0 and nevera_activa:
            crear_cubo(root, "Nevera", ox+nevera_pos, oy, 0, nevera_ancho, fondo_mb, nevera_alto)

        if n_mb > 0:
            aw = espacio / n_mb
            for i in range(n_mb):
                crear_cubo(root, f"MB-{L}{chr(65+i)}-{int(aw)}mm",
                           ox+mod_inicio+i*aw, oy, 0, aw, fondo_mb, alto_mb)

        if n_ma > 0:
            aw = espacio / n_ma
            for i in range(n_ma):
                crear_cubo(root, f"MA-{L}{chr(65+i)}-{int(aw)}mm",
                           ox+mod_inicio+i*aw, oy+Y_MA, Z_MA, aw, fondo_ma, alto_ma)
        if idx == 0 and nevera_activa:
            z_mn  = nevera_alto - 30.0
            dz_mn = (Z_MA + alto_ma) - z_mn
            crear_cubo(root, "MN-Sobrenevera", ox+nevera_pos, oy+Y_MN, z_mn, nev_total, fondo_mn, dz_mn)
    adsk.core.Application.get().activeViewport.fit()

class ExecHandler(adsk.core.CommandEventHandler):
    def notify(self, args):
        try:
            inp = args.command.commandInputs
            def gf(id_, d=0.0):
                v = inp.itemById(id_)
                return float(v.value) if v and v.value.strip() else d
            def gi(id_, d=1):
                v = inp.itemById(id_)
                return max(1, int(float(v.value))) if v and v.value.strip() else d
            def gb(id_):
                v = inp.itemById(id_)
                return v.value if v else False
            tipo     = inp.itemById("tipo_cocina").selectedItem.name
            ancho_a  = gf("ancho_a", 3000)
            alto_m   = gf("alto_muro", 2500)
            alto_mb  = gf("alto_mb", 800)
            fondo_mb = gf("fondo_mb", 570)
            alto_ma_inp = inp.itemById("alto_ma")
            alto_ma = float(alto_ma_inp.value) if alto_ma_inp and alto_ma_inp.value.strip() else (alto_m - alto_mb - 650 - 20)
            fondo_ma = gf("fondo_ma", 330)
            fondo_mn = gf("fondo_mn", 500)
            n_mb_a   = gi("n_mb_a", 5)
            n_ma_a   = gi("n_ma_a", 4)
            nev_act  = gb("nevera_activa")
            nev_ancho = gf("nevera_ancho", 600)
            nev_alto  = gf("nevera_alto", 1800)
            nev_pos   = gf("nevera_pos", 0)
            muros = [{"ancho":ancho_a,"n_mb":n_mb_a,"n_ma":n_ma_a,"ox":0,"oy":0,"alto_muro":alto_m}]
            if tipo in ("L","U"):
                ancho_b = gf("ancho_b", 2400)
                muros.append({"ancho":ancho_b,"n_mb":gi("n_mb_b",3),"n_ma":gi("n_ma_b",2),"ox":ancho_a,"oy":-ancho_b,"alto_muro":alto_m})
            if tipo == "U":
                ancho_c = gf("ancho_c", 2400)
                muros.append({"ancho":ancho_c,"n_mb":gi("n_mb_c",3),"n_ma":gi("n_ma_c",2),"ox":0,"oy":-ancho_c,"alto_muro":alto_m})
            design = adsk.fusion.Design.cast(app.activeProduct)
            root   = design.rootComponent
            generar_cocina(root, muros, alto_mb, fondo_mb, alto_ma, fondo_ma, nev_act, nev_ancho, nev_alto, nev_pos, fondo_mn)
            ui.messageBox("Cocina generada!")
        except:
            ui.messageBox(traceback.format_exc())

class InputChangedHandler(adsk.core.InputChangedEventHandler):
    def notify(self, args):
        try:
            full = args.input.parentCommand.commandInputs
            changed = args.input.id
            tipo = full.itemById("tipo_cocina").selectedItem.name
            for fid in ["ancho_b","n_mb_b","n_ma_b"]:
                it = full.itemById(fid)
                if it: it.isVisible = tipo in ("L","U")
            for fid in ["ancho_c","n_mb_c","n_ma_c"]:
                it = full.itemById(fid)
                if it: it.isVisible = (tipo == "U")
            act = full.itemById("nevera_activa").value
            for fid in ["nevera_ancho","nevera_alto","nevera_pos"]:
                it = full.itemById(fid)
                if it: it.isVisible = act
            # Calcular espacio disponible
            lbl_esp = full.itemById("lbl_espacio")
            if lbl_esp:
                ancho_a = 0.0
                nev_ancho = 0.0
                try: ancho_a = float(full.itemById("ancho_a").value or 3000)
                except: pass
                try: nev_ancho = float(full.itemById("nevera_ancho").value or 600)
                except: pass
                if act:
                    nev_total = nev_ancho + 100.0
                    espacio = ancho_a - nev_total
                    n_mb = 1
                    n_ma = 1
                    try: n_mb = max(1, int(float(full.itemById("n_mb_a").value or 1)))
                    except: pass
                    try: n_ma = max(1, int(float(full.itemById("n_ma_a").value or 1)))
                    except: pass
                    aw_mb = espacio / n_mb
                    aw_ma = espacio / n_ma
                    MIN_MOD = 200.0
                    color_mb = "#ff4444" if aw_mb < MIN_MOD else "#81C784"
                    color_ma = "#ff4444" if aw_ma < MIN_MOD else "#81C784"
                    aviso = ""
                    if aw_mb < MIN_MOD or aw_ma < MIN_MOD:
                        aviso = "<br><b style='color:#ff4444;'>AVISO: modulos demasiado pequenos! Reduce la cantidad.</b>"
                    lbl_esp.formattedText = (
                        f"<b>Nevera reserva: {int(nev_total)}mm</b><br>"
                        f"<b>Espacio disponible: <span style='color:#4FC3F7;'>{int(espacio)}mm</span></b><br>"
                        f"<b>Ancho MB: <span style='color:{color_mb};'>{aw_mb:.0f}mm</span> ({n_mb} modulos)</b><br>"
                        f"<b>Ancho MA: <span style='color:{color_ma};'>{aw_ma:.0f}mm</span> ({n_ma} modulos)</b>"
                        f"{aviso}"
                    )
                else:
                    lbl_esp.formattedText = "<b>Nevera desactivada - espacio completo disponible</b>"
            if changed in ["alto_muro","alto_mb"]:
                alto_m  = float(full.itemById("alto_muro").value or 2500)
                alto_mb = float(full.itemById("alto_mb").value or 800)
                alto_ma = alto_m - alto_mb - 650 - 20
                lbl = full.itemById("lbl_alto_ma")
                if lbl: lbl.formattedText = f"<b>Alto MA sugerido: {alto_ma:.0f} mm</b>"
                inp_ma = full.itemById("alto_ma")
                if inp_ma: inp_ma.value = str(int(alto_ma))
        except:
            pass

class CreatedHandler(adsk.core.CommandCreatedEventHandler):
    def notify(self, args):
        try:
            cmd = args.command
            inp = cmd.commandInputs
            dd  = adsk.core.DropDownStyles.LabeledIconDropDownStyle
            li = inp.addDropDownCommandInput("tipo_cocina","Tipo de cocina",dd)
            li.listItems.add("Recta",True)
            li.listItems.add("L",False)
            li.listItems.add("U",False)
            inp.addStringValueInput("ancho_a","Ancho muro A (mm)","3000")
            inp.addStringValueInput("n_mb_a","Cantidad modulos MB","5")
            inp.addStringValueInput("n_ma_a","Cantidad modulos MA","4")
            for fid,lbl,val in [("ancho_b","Ancho muro B (mm)","2400"),("n_mb_b","Cantidad MB muro B","3"),("n_ma_b","Cantidad MA muro B","2")]:
                v = inp.addStringValueInput(fid,lbl,val)
                v.isVisible = False
            for fid,lbl,val in [("ancho_c","Ancho muro C (mm)","2400"),("n_mb_c","Cantidad MB muro C","3"),("n_ma_c","Cantidad MA muro C","2")]:
                v = inp.addStringValueInput(fid,lbl,val)
                v.isVisible = False
            sep1 = "<b style='color:#4FC3F7;font-size:13px;'>--- DIMENSIONES ----------------------------</b>"
            inp.addTextBoxCommandInput("sep1","",sep1,1,True)
            inp.addStringValueInput("alto_mb","Alto MB  (sugerido 800mm)","800")
            inp.addStringValueInput("fondo_mb","Fondo MB (sugerido 570mm)","570")
            inp.addStringValueInput("alto_muro","Alto muro (mm)","2500")
            inp.addTextBoxCommandInput("lbl_alto_ma","","<b>Alto MA sugerido: 1030 mm</b>",1,True)
            inp.addStringValueInput("alto_ma","Alto MA (editable)","1030")
            inp.addStringValueInput("fondo_ma","Fondo MA (sugerido 330mm)","330")
            inp.addStringValueInput("fondo_mn","Fondo MN sobrenevera (sugerido 500mm)","500")
            sep2 = "<b style='color:#81C784;font-size:13px;'>--- SERVICIOS -------------------------------</b>"
            inp.addTextBoxCommandInput("sep2","",sep2,1,True)
            inp.addStringValueInput("gas_centro","Centro gas desde X=0 (mm)","0")
            inp.addStringValueInput("desague_centro","Centro desague desde X=0 (mm)","0")
            sep3 = "<b style='color:#CE93D8;font-size:13px;'>--- NEVERA ----------------------------------</b>"
            inp.addTextBoxCommandInput("sep3","",sep3,1,True)
            inp.addBoolValueInput("nevera_activa","Lleva nevera",True,"",False)
            for fid,lbl,val in [("nevera_ancho","Ancho nevera (mm)","600"),("nevera_alto","Alto nevera (mm)","1800"),("nevera_pos","Posicion nevera desde X=0 (mm)","0")]:
                v = inp.addStringValueInput(fid,lbl,val)
                v.isVisible = False
            inp.addTextBoxCommandInput("lbl_espacio","","<b>Activa la nevera para ver el espacio disponible</b>",2,True)
            on_exec = ExecHandler()
            cmd.execute.add(on_exec)
            handlers.append(on_exec)
            on_chg = InputChangedHandler()
            cmd.inputChanged.add(on_chg)
            handlers.append(on_chg)
        except:
            if ui: ui.messageBox(traceback.format_exc())

def run(context):
    global app, ui
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        addin_path     = os.path.dirname(os.path.realpath(__file__))
        resources_path = os.path.join(addin_path, "resources")
        ex = ui.commandDefinitions.itemById(CMD_ID)
        if ex: ex.deleteMe()
        cmdDef = ui.commandDefinitions.addButtonDefinition(CMD_ID, CMD_NAME, CMD_DESC, resources_path)
        h = CreatedHandler()
        cmdDef.commandCreated.add(h)
        handlers.append(h)
        panel = ui.allToolbarPanels.itemById(PANEL_ID)
        ctrl  = panel.controls.addCommand(cmdDef)
        ctrl.isPromoted          = True
        ctrl.isPromotedByDefault = True
    except:
        if ui: ui.messageBox(traceback.format_exc())

def stop(context):
    try:
        panel = ui.allToolbarPanels.itemById(PANEL_ID)
        ct = panel.controls.itemById(CMD_ID)
        if ct: ct.deleteMe()
        d = ui.commandDefinitions.itemById(CMD_ID)
        if d: d.deleteMe()
    except:
        pass
