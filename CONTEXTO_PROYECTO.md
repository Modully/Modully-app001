# Modully-02 — Contexto del proyecto

Automatización parametrizada de diseño de cocinas modulares en **Autodesk Fusion** (Python), para carpintería. Objetivo: acelerar fabricación y mantener consistencia entre cocinas.

> Última actualización: 2026-10-28. Si algo de aquí contradice una versión anterior, **este documento y las reglas validadas prevalecen**.

## 1. Visión del sistema

```
Plano/boceto → Modulación (reglas) → Modelo 3D en Fusion → Extracción de piezas → BOM Excel (formato CNC)
```

- El **modelo 3D es la fuente única de verdad**: planos 2D y listado de corte salen de él.
- Cada pieza es un componente/body con atributos `BOM` (PartNumber, Largo, Ancho, Calibre, Color, Canto).
- Salida del listado: `ITEM | PARTE | C/D | LAR | AN | CAL | COLOR | CANTO`.

### Decisión de arquitectura de la app (2026-10-28)
- **Primero la lógica de modulación con cajas/cubos; después los módulos con sus piezas.**
- **Todas las vistas son cámaras de una sola escena 3D** (`KitchenViewer3D.tsx`): Planta y Frontal son cámaras ortogonales; Isométrica y 3D son cámaras en perspectiva. Ya no hay dibujos 2D aparte, así que no pueden diferir.
- Planta y Frontal se desplazan con clic izquierdo y hacen zoom con la rueda. El arrastre de módulos y las cotas editables del antiguo 2D están pendientes de rehacer sobre la escena.
- Código del 2D antiguo (`renderPlanView` y `renderFrontalView` en `App.tsx`) sigue en el archivo pero ya no se usa; se puede borrar.
- **Lista única de cajas** (`boxes.ts`, función `buildBoxes`): fuente de verdad de la geometría. Cada caja es `x, y, z` (esquina mínima) + `sx, sy, sz` (tamaño), en mm: X a lo largo del muro A, Y profundidad desde el muro A, Z altura. Incluye muros, zócalo, módulos y nevera/alacena. La escena 3D la dibuja y la pestaña Listado la exporta con **"Cajas para Fusion"** (JSON).
- **Fusion:** `importar_cajas_fusion/importar_cajas_fusion.py` lee ese JSON y crea un cubo por caja (el muro A queda en Y = 0 y la cocina se extiende hacia −Y). Se agrega en Fusion desde *Scripts and Add-Ins → + → Script or add-in from device*. Sin probar todavía en Fusion.
- **Herramienta de mesón** (Configuración avanzada → Mesón): una losa por tramo continuo de módulos bajos de cada muro, con espesor (20 mm por defecto) y voladizo frontal (20 mm). Genera cajas `kind: 'counter'` con aberturas (`cutouts`) para poceta y estufa; el script de Fusion las corta. La cara superior de los módulos bajos queda en zócalo + 800 mm y el mesón se apoya encima; **los 600 mm hasta el aéreo se miden desde la cara superior del mesón** (confirmado): el aéreo arranca en zócalo + 800 + espesor del mesón + 600, y su alto es muro − esa base − 20. Con muro de 2400, zócalo de 100 y mesón de 20: base del aéreo a 1520 mm y alto de 860 mm.
- **Electrodomésticos:** cada uno tiene un selector de muro (A, B o C según la forma) en el panel Elementos, y se arrastra en la escena (planta, isométrica y 3D; en Frontal solo a lo largo del muro A). Al arrastrar cambia de muro según la zona donde lo sueltes. Mover un electrodoméstico no reubica los módulos: hay que volver a pulsar "Optimizar modulación". Si la forma de la cocina pierde el muro B o C, sus electrodomésticos pasan al muro A.
- **Cotas de planta (confirmado):** el punto 0 es siempre la esquina interior de arriba a la izquierda (donde el muro A se une con el B), en horizontal y en vertical. Hay una sola cota por electrodoméstico: al **centro** de estufa, campana y poceta, y al **lado más cercano al 0** de nevera y alacena. Las cotas se editan con un clic; el valor escrito mueve el electrodoméstico (se limita al largo del muro). En los muros B y C el campo "Posición" del panel sigue contando desde la esquina ciega (570 mm), así que la cota = Posición + 570 (+ mitad del ancho si es al centro).
- **Regla de la nevera (confirmada):** (1) la sobrenevera mide el ancho de la nevera + 10 cm (5 cm por lado), va centrada sobre ella y **nunca se sale del muro** (si la nevera está en un extremo, se corre hacia adentro); (2) tiene **50 cm de fondo** (`OVER_FRIDGE_DEPTH`), más que los demás aéreos (33 cm); (3) los módulos **base y aéreos** quedan a **mínimo 5 cm de la nevera** a cada lado (`FRIDGE_CLEARANCE`). Las constantes están en `boxes.ts`.
- **Medidas por módulo:** en el panel Elementos → "Plan de diseño" cada módulo tiene sus campos Ancho, Alto y Fondo (mm). Se aplican con Enter o al salir del campo; Escape cancela. El ancho se limita al largo del muro; el alto, al techo menos 20 mm y sobre el zócalo; el fondo, entre 100 y 1200 mm. Un alto editado a mano queda fijado (`heightLocked`) y no se recalcula al cambiar el muro o el zócalo. "Optimizar modulación" vuelve a los valores estándar.
- Constantes de geometría compartidas (`LOWER_DEPTH` 570, `UPPER_DEPTH` 330, `CORNER_BLIND_OFFSET`, `TOP_MARGIN`) viven en `boxes.ts`.
- Pendiente: que el BOM lea las medidas de las cajas, y que la estufa, la poceta y la campana extractora (hoy se dibujan aparte) pasen a la lista.

## 2. Estado actual del código

Ubicación en Fusion: `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
Copias de referencia en este repo: [referencia_addins/](referencia_addins/)

| Add-in | Qué hace | Estado |
|---|---|---|
| `GeneradorDeCocinas` | Diálogo (Recta/L/U, anchos, cantidad MB/MA, nevera). Genera **cubos** por módulo y muros de 150 mm. Guarda parámetros `coc_*`. | Prototipo de volúmenes. No tiene paneles reales. |
| `generador_bom_excel` | Exporta el BOM a Excel. | Por revisar |

Scripts de prueba en `...\API\Scripts\` (varios `prueba`, `generador_modulos_fusion_fase1`, `.01`, etc.). Ojo: hay versiones duplicadas; verificar siempre que se edita el mismo archivo que se ejecuta.

### Brechas de `GeneradorDeCocinas` frente a las reglas
- Módulos como cubos: sin laterales, base, entrepaños, cajones ni puertas.
- Sin amarres, sin retranqueo del espaldar del MA.
- Gas y desagüe están en el diálogo pero el código no los usa.
- Sin BOM, sin atributos por pieza.
- Muros L y U con desplazamientos simples y sin giro; las esquinas probablemente no cierran.
- División pareja del espacio (ancho = espacio / cantidad), sin modulación en pasos de 5 cm ni reglas de condimentero/cajonero.

## 3. Conector de Fusion (entorno)

- Extensión de Claude Desktop **Autodesk Fusion** (`ant.dir.gh.autodesk.fusion-mcp`), puerto **27182**.
- Requisitos: Fusion abierto y **Preferences → General → API → Fusion MCP Server** activado.
- Si falla: confirmar que el puerto 27182 escucha, apagar/encender la extensión y abrir una **sesión nueva**.
- Herramientas: `fusion_mcp_read`, `fusion_mcp_update`, `fusion_mcp_execute`, `fusion_mcp_electronics_read`.
- Verificado el 2026-10-28: conecta; sin documentos abiertos en ese momento.

## 4. Gotchas de la API de Fusion

1. **Obtener el diseño:** `adsk.fusion.Design.cast(app.activeProduct)`. No usar `activeDocument.products.itemByProductType('Design')` (falla con "failed to find product").
2. **Unidades:** la API trabaja **siempre en cm**, aunque el documento muestre mm. Convertir con `mm / 10.0` antes de sketches, extrusiones y traslaciones.
3. **Patrón de pieza:** un componente por pieza (`occurrences.addNewComponent` con traslación pura), sketch rectangular en XY local y extrusión en Z. Elegir qué medida va en cada eje para evitar rotaciones.
4. `print()` no se ve; usar `ui.messageBox()` o abrir Text Commands.

## 5. Parámetros base (inamovibles)

| Parámetro | Valor |
|---|---|
| Espesor estructura | 1.5 cm (15 mm) |
| Espesor frentes/puertas | 1.8 cm (Línea Alta siempre 18 mm) |
| Espesor espaldar | 0.6 cm |
| Luz entre frentes | 0.2 cm perimetral |

## 6. Reglas estructurales validadas

### Módulo base (MB) — alto 80 cm, fondo 57 cm
- **Sin techo ni espaldar** (el mesón hace de tapa; el fondo queda abierto contra la pared).
- Lleva: 2 laterales, base, **amarre superior trasero y amarre inferior trasero** (8 cm de alto), entrepaño opcional a 40 cm (no en cajonero).
- **Gola superior** siempre (perfil en L, puente 6.5 cm). **Gola media** solo en cajonero, a 33 cm.
- Puertas batientes de 75 cm (5 cm de luz arriba).

### Altura del muro y del aéreo (confirmado por el usuario)
- El **zócalo** es generalmente de 100 mm, pero **siempre se pregunta**. El mesón queda a zócalo + módulo base (800 mm).
- El alto del muro **lo mide el usuario**, no es fijo. El alto del aéreo se calcula: `muro − 900 (zócalo + base) − 600 (hueco mesón–aéreo) − 20 (cierre)`.
- El hueco entre la **cara superior del mesón** y el aéreo es de **60 cm**. Con zócalo de 10 cm, base de 80 cm y mesón de 2 cm, el aéreo arranca en Z = 152 cm. `generador_cocina_fusion_FINAL.py` ya lo calcula así (`ALTO_MURO`, `ZOCALO`, `HUECO_MESON_AEREO`) y sube los MB sobre el zócalo.
- 108 cm es el alto de referencia del aéreo para un muro de 2600 mm; es el valor por defecto de `ALTO_MURO` en el script de Fusion.

### Módulo aéreo (MA) — fondo 33 cm
- Lleva techo **y** espaldar. Espaldar **retranqueado 15 mm**, entra 5 mm en ranura del techo.
- **2 amarres superiores** (cuchillas/French cleat, 6 cm de alto) al ras de laterales y techo. Sin amarre inferior.
- **Desfase Y = 24 cm** respecto a los MB (57 − 33) para que el espaldar quede a plomo en la pared.
- Puertas rasantes arriba, con pestaña de 10 mm abajo.

### Cajonero (ejemplo 90 cm)
- Frentes inferior y superior de 36 cm.
- **3 cajones reales:** inferior (z 3.5, alto 18), medio (z 44.5, alto 10), cubiertero oculto (z 60.5, alto 8) tras un frente de 11 cm.
- Cada cajón: 2 laterales, 2 testeros, fondo; holgura lateral de 1.3 cm por lado para corredera.

### Campana (MA sobre estufa)
- Alto 99.5 cm (−8.5), elevada +8.5 cm para alinear el techo con los demás aéreos.
- Puertas sin pestaña, luz de **3 mm** sobre la base (confirmado; antes 4 mm). Push-to-open.
- La puerta superior copia exactamente la altura de la puerta superior del aéreo vecino; la inferior absorbe el descuento.

### Modulación
- **Aéreos < 40 cm no son funcionales solos:** fusionar con el vecino (umbral actual: 40 cm; el de 20 cm quedó obsoleto).
- Un solo condimentero salvo pedido explícito. Mínimo 40 cm de zona de trabajo entre estufa y lavaplatos.
- Línea Media/Alta: sugerir 1 cajonero + 1 condimentero (mín. 18–20 cm) + 1 cubiertero.
- Gas en la **mitad del condimentero**; desagüe en la **mitad del lavaplatos**. La estufa mide 60 cm como mínimo, puede ser mayor.

## 7. Cantos y colores (BOM)

- Notación: `L` largo (sentido de la veta), `A` ancho, `R` rígido, `F` flexible. Ej.: `1L 2A`, `4LR`, `4LF`.
- **Regla que prevalece:** el canto de una pieza usa el **color de su propio material**, nunca el de otra pieza. Entrepaño blanco → `1L Blanco 2A Blanco`. En general: `1L {color_propio} 2A {color_propio}`.
- Fachadas: espesor y tipo de canto (`4LR`/`4LF`) **se preguntan** antes de ejecutar.

| Línea | Laterales | Entrepaños | Fachada | Testeros de cajón |
|---|---|---|---|---|
| Baja | Blanco RH, 1L | Blanco, 1L | 4LR/4LF, 15 mm | Blanco, 1L |
| Media | Color cliente RH, 1L 2A | Blanco, 1L 2A | 4LR/4LF, 15 o 18 mm | Color estructura, 1L |
| Alta | Color cliente RH, 4LF | Blanco, 4LF | 4LR/4LF, 18 mm | Color estructura, 4LF |

Part Number: `[TIPO] [MÓDULO] [POSICIÓN] - [VERSIÓN]`, ej. `Lateral MB-A-01`, `Fondo caj MB-A-01`, `Fachada puerta MA-A-01`.

## 8. Plan de trabajo

Fases validadas hasta ahora: 1a (componentes vacíos), 1b (MB con geometría real), 1c (atributos BOM por pieza).

Pendiente, en orden sugerido:
1. Módulo base con paneles reales en `GeneradorDeCocinas`, reemplazando los cubos.
2. MA con retranqueo, amarres y desfase Y.
3. Cajonero y campana.
4. Esquinas L y U con giro correcto.
5. Conectar atributos BOM con la exportación a Excel (`generador_bom_excel`).
6. Modulación automática (pasos de 5 cm, fusión anti-ratoneras, gas y desagüe).
7. Entrada desde plano (visión) con confirmación del usuario.

## 9. Preguntas abiertas

- ¿Qué línea (Baja/Media/Alta) es la predeterminada del diálogo?
- ¿Se mantiene la copia en `referencia_addins/` sincronizada, o el repo pasa a ser la fuente y se despliega a Fusion?
