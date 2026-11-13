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
- **Regla de la nevera (confirmada):** (1) la sobrenevera mide el ancho de la nevera + 10 cm (5 cm por lado), va centrada sobre ella y **nunca se sale del muro** (si la nevera está en un extremo, se corre hacia adentro); (2) tiene **siempre 50 cm de fondo** (`OVER_FRIDGE_DEPTH`), más que los demás aéreos (33 cm). La nevera nunca se ubica en una esquina con módulos de frente (si se hace, la app avisa del choque); (3) los módulos **base y aéreos** quedan a **mínimo 5 cm de la nevera** a cada lado (`FRIDGE_CLEARANCE`). Las constantes están en `boxes.ts`.
- **Medidas por módulo:** en el panel Elementos → "Plan de diseño" cada módulo tiene sus campos Ancho, Alto y Fondo (mm). Se aplican con Enter o al salir del campo; Escape cancela. El ancho se limita al largo del muro; el alto, al techo menos 20 mm y sobre el zócalo; el fondo, entre 100 y 1200 mm. Un alto editado a mano queda fijado (`heightLocked`) y no se recalcula al cambiar el muro o el zócalo. "Optimizar modulación" vuelve a los valores estándar.
- **Zócalo y nevera (confirmado):** el zócalo va solo bajo los módulos y se abre un hueco donde está la nevera (su ancho + 5 cm por lado, igual que la separación de los módulos base), porque la nevera se apoya directo en el piso. Se aplica en los muros A, B y C.
- **Dilatación (confirmado en lo esencial):** los módulos pegados a un muro dejan una holgura de **15 mm** (por los muros descuadrados) y se tapa con una **pieza de dilatación**: 15 mm de espesor × alto del módulo × **70 mm de fondo medido desde el frente**. **Solo se genera en los extremos que tocan un muro:** el inicio de A cuando toca el muro B (L y U) o el muro auxiliar izquierdo (recta); el final de A cuando toca el muro C (U) o el muro auxiliar derecho; y el final de cada brazo, donde está su muro auxiliar. Sin muros laterales en la recta no hay holgura. Aplica a módulos base y aéreos.
- **Ocultar en la escena:** botones MA, MB, Mesón y Electro junto a las vistas. Ocultar algo oculta también sus herramientas (etiquetas de medida, X y +, flechas dobles, cotas). Es solo visual: no cambia el diseño, el despiece ni la exportación.
- **Flechas dobles:** giran para apuntar a lo largo del muro en pantalla (verticales en los brazos B y C en planta).
- **Esquinas unidas (confirmado):** la profundidad de los módulos NO cambia. En los brazos B y C el despiece de los aéreos es el mismo que el de los bajos (mismos cortes), y **el primer aéreo del brazo, el perpendicular al mueble de A, se alarga hacia la esquina** hasta tocar el aéreo de A (siempre a 33 cm, porque todos los aéreos de la esquina miden 33 cm de fondo, incluida la sobrenevera si está ahí). Ese módulo queda con `positionX` negativo y más ancho (ej. 600 + 240 = 840). La sobrenevera y la campana no se alargan. Función `armUpperOrigin` en `boxes.ts`; el alargue se aplica al optimizar la modulación. Los valores 15 y 70 son editables en Espacio → Dilatación, y se aplican al "Optimizar modulación". La pieza va en la lista de cajas (`kind: 'filler'`), en la escena y en el despiece como "Pieza de dilatación". Solo se genera si el módulo dejó la holgura (si toca el muro, no hay pieza). Pendiente de confirmar: si debe aplicar también a la nevera/electrodomésticos y si el fondo de 70 mm es desde el frente.
- **Regla de colisiones (confirmada):** los módulos y los electrodomésticos no pueden ocupar el mismo espacio (ni los módulos entre sí). `findCollisions` en `boxes.ts` revisa cada par de cajas macizas (bajos, aéreos, torres, nevera y alacena) y tocarse por una cara no cuenta. La app muestra un aviso rojo "N choques" (con el detalle al pasar el ratón) y marca en rojo lo que choca en la escena. Solo avisa: no impide mover ni optimizar.
- **Editar el ancho desde el número del módulo (confirmado):** el número bajo cada módulo en la escena se edita con un clic (Enter aplica, Escape cancela). El módulo se amplía o se reduce **simétricamente** (la mitad a cada lado) y **solo cambian sus dos vecinos de los lados**, igual que al mover las flechas dobles: al ampliar, cada vecino cede ancho en el borde que se acerca (mínimo 100 mm); al reducir, los vecinos que lo tocan crecen para seguir pegados. Ningún otro módulo se mueve, así la hilera llena sigue ocupando lo mismo. Si un lado no tiene vecino que ceda (extremo de la hilera, o un módulo de ancho fijo: sobrenevera, campana, mueble de estufa o de poceta), el resto de la ampliación pasa al otro lado, y si no cabe de ningún modo el ancho se limita al máximo posible. Vecinos = mismo muro y mismo nivel. Lógica en `moduleResize.ts` (`resizeSymmetric`).
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

## Vista de planta: selección y edición de módulos (2026-10-29)
- En planta cada módulo muestra su nombre sobre la cara superior y su medida va separada del frente (no tapa la X ni el +).
- Un clic en un módulo lo selecciona: contorno rojo, flechas rojas ◀ ▶ en los extremos (alargan/contraen solo ese módulo) y cota roja editable.
- Doble clic abre el editor de Largo (ancho en el muro, con vecinos laterales), Ancho (fondo) y Alto. Clic en vacío deselecciona.
- Regla de choques en ediciones manuales: arrastrar un módulo, alargarlo con las flechas, cambiar fondo/alto o escribir el largo NO se aplica si crea un choque nuevo con otro módulo o electrodoméstico (`setModulesNoCollision` en App.tsx). Los choques que ya existían no bloquean.
- La selección (clic) con cota roja y flechas ◀ ▶ vale en todas las vistas; la flecha ▼ del fondo en todas menos frontal. En isométrica/3D las herramientas HTML se apoyan en la cara del módulo (`transform`).
- Flechas rojas del módulo seleccionado: planta ▼ frente = fondo; frontal ▲/▼ = alto; isométrica/3D ▲/▼ = alto y ↘ en el costado = fondo. Bajos crecen hacia arriba desde el zócalo; aéreos cuelgan del techo (crecen hacia abajo).
- La flecha ▲ mueve el borde superior: en bajos cambia el alto hacia arriba; en aéreos baja o sube el borde superior (sin mover el inferior) y deja `topGap` (mm) entre el módulo y el techo. La ▼ cambia el alto sin mover el techo en aéreos.
- Cinta métrica 3D (botón "Medir" del lateral): `MeasureTool` en KitchenViewer3D.tsx. Clic en dos puntos (se pegan a las esquinas de las cajas, o a lo que haya bajo el cursor); muestra la distancia en mm con largo/alto/fondo. Esc cancela el punto A, Supr borra la última, × en la etiqueta borra esa medición. Mientras se mide no hay selección, arrastre ni X/+. Al salir se borran las mediciones.
- Vistos (2026-10-29): pieza lateral de 15 o 19 mm que cierra el costado de un módulo sin muro. Se activan con doble clic en el módulo (Izquierda/Derecha vistas desde el frente, espesor 15/19). Aplica a bajos, aéreos y torres. La pieza queda DENTRO de la medida del módulo: el cuerpo se acorta el espesor (`boxes.ts`, caja `filler` con id `visto-<tier>-<módulo>-<start|end>`; datos en `vistoLeft/vistoRight/vistoThickness`). El BOM la lista como "Visto" (alto × fondo × espesor) y reduce el ancho del cuerpo. Falta: cantos del visto en el BOM y alacenas/torres de hornos como módulo propio (hoy no son módulos de la lista).
- Corrección vistos: el visto SE RESTA del módulo (módulo de 900 con visto de 15 = módulo de 885 + visto de 15). Al activarlo o quitarlo desde el doble clic cambia `module.width`; la medida total del conjunto no cambia. El BOM lee el ancho ya restado.
- Imán entre módulos: al arrastrar un módulo o estirar un borde con las flechas, una separación de hasta 15 mm con el vecino (mismo muro y nivel) se cierra sola (`snapToNeighbors` en moduleResize.ts). No corrige separaciones que ya existían hasta que se vuelva a mover ese módulo.
- "+" azul arriba de un módulo bajo (vistas frontal/isométrica/3D): crea encima un módulo (tipo aéreo) del mismo ancho y posición, desde la cara superior del de abajo hasta el techo (deja TOP_MARGIN). Copia la profundidad del de abajo (se edita con doble clic). Si no hay espacio (<100 mm) o choca con un módulo que ya está arriba, avisa y no lo crea. Al dividir un módulo (+ verde) el vecino copia la profundidad; los vistos quedan solo en el costado exterior de cada mitad.
- Corrección del "+" azul de arriba: aparece en TODOS los módulos que tengan al menos 100 mm libres hasta el techo (los aéreos pegados al techo no lo muestran) y DUPLICA el módulo en la parte superior (mismo ancho, posición, profundidad, alto y vistos; si el alto no cabe se acorta al espacio libre). Un bajo se duplica como aéreo.
- El "+" azul de duplicar arriba va en el centro de la cara superior y solo aparece con el módulo seleccionado (un clic); la flecha ▲ del alto se corrió a la derecha para dejarle el centro.
- CAMBIO: el "+" azul arriba-centro (módulo seleccionado) ya NO duplica: DIVIDE el módulo en dos a lo alto (mitad de abajo y mitad de arriba, mismo ancho/posición/profundidad/vistos). Vale para bajos y aéreos (alto >= 200 mm). En un bajo, la mitad de arriba queda como aéreo apoyado sobre la de abajo; en un aéreo ambas mitades cuelgan del techo (`splitModuleHorizontal` en App.tsx).

## Mesón y salpicadero (2026-10-30)
- El mesón es un elemento con 3 medidas: largo (lo definen los módulos del tramo), ancho/fondo (módulos + voladizo) y espesor. Clic lo selecciona (contorno rojo); doble clic abre el editor (fondo, espesor, salpicadero). Los cambios son globales (espesor, voladizo, salpicadero), no por tramo.
- Salpicadero: parte del mesón, mismo material y espesor del mesón, altura que se pregunta en Espacio (por defecto 70 mm, `SPLASH_HEIGHT_DEFAULT`). Va atrás (contra el muro) y en los extremos del tramo que tocan un muro o un módulo más alto que el mesón (torre, nevera, alacena). Cajas `kind: 'counter'` con id `salpicadero-<muro>-<tramo>-<atrás|inicio|final>` (`boxes.ts`).
- El listado de corte incluye Mesón (largo x fondo x espesor) y Salpicaderos (largo x alto x espesor) con color "Material del mesón". Pendiente: restar las aberturas de poceta y estufa, y definir cantos.
- Editor del mesón (doble clic): además hay "Lados" del salpicadero (Izq./Der., vistos desde el frente) y "Cascada" (Izquierda/Derecha = el mesón baja del tope al piso por ese costado). Se guardan por tramo en `counterExtras` (clave = id de la losa, p. ej. `counter-A-0`); solo se guarda lo que el usuario cambia, el resto sigue automático. La cascada es una caja `cascada-<muro>-<tramo>-<inicio|final>` de espesor = espesor del mesón, que queda FUERA del tramo (junto al extremo); no resta ancho a los módulos como el visto. En el listado de corte sale como "Cascada ..." con color "Material del mesón".
- CORRECCIÓN cascada: va dentro de la medida general y con inglete a 45° contra el mesón. Al activarla, el módulo del extremo se acorta el espesor del mesón (900 -> 880 con mesón de 20; si va al inicio del muro, el módulo también se corre) y al quitarla se lo devuelve (`applyCounterEdit` en App.tsx). La losa llega hasta el borde exterior de la cascada y su canto de abajo se recorta un espesor; la cascada baja del piso a la cara superior con el canto de arriba cortado a 45° (`mitreBottom`/`mitreTop` en las cajas, solo visual: la exportación a Fusion sigue creando prismas). "Optimizar modulación" reinicia los ajustes manuales del mesón (`counterExtras`).
- El botón morado de doble flecha (unión entre módulos) escala con el zoom en las vistas ortogonales (planta y frontal): `HtmlScaled zoomScale`, relativo al zoom del encuadre inicial (`camera.userData.fitZoom`), limitado entre 0,4x y 3x. En isométrica/3D ya escalaba con la distancia.

## Dilatada por módulo (2026-10-30) — reemplaza la dilatación automática
- La dilatación ya no se pide en Espacio ni se crea sola contra los muros laterales (`hasDilatation` queda en `false` por defecto; el código automático sigue ahí, apagado). Ahora se pide por módulo: doble clic -> sección "Dilatada": Izquierda/Derecha (vistas desde el frente), espesor (15), profundidad (70, medida desde el frente del módulo) y altura (sugerida: la del módulo; si no se cambia sigue la altura del módulo).
- Igual que el visto, la pieza queda DENTRO de la medida: el módulo se acorta el espesor (900 -> 885) y, si va al inicio del muro, se corre. Si un lado lleva dilatada y visto, de adentro hacia afuera: dilatada y luego visto. Campos del módulo: `dilatLeft/dilatRight/dilatThickness/dilatDepth/dilatHeight`; caja `dilatacion-<tier>-<módulo>-<start|end>` (`filler`); en el listado sale como "Pieza de dilatación".
- El mesón cubre también las piezas laterales de los módulos bajos (dilatadas y vistos): su losa llega hasta el borde exterior de esas piezas (la losa mantiene su fondo; la dilatada es más corta). La cascada, si la hay, va después de esas piezas.

## Isla y península (2026-10-31)
- En Módulos especiales hay una tarjeta "Isla / Península": se elige el tipo y se piden Largo y Ancho (medida general). Al aceptar se crea a 1 m del punto 0 en ambas cotas (X a lo largo del muro A, Y hacia el frente); las dos cotas se editan en planta (clic en el número) o en la tarjeta. Datos: `IslandItem` (types.ts), estado `islands` en App.tsx.
- Se crea un zócalo (`zocalo-isla-<id>`, kind `zocalo`) de la misma altura que el de la cocina y con el perímetro 5 cm más pequeño que la medida general (`ISLAND_PLINTH_INSET` = 50 mm por lado). Solo si la cocina tiene zócalo. En la escena se dibuja además el contorno de la medida general con su etiqueta.
- Por ahora la isla/península es solo huella + zócalo (sin módulos encima, sin mesón, sin choques ni listado de corte). La península es igual que la isla; falta definir a qué muro se pega.
- La isla/península se arrastra con el ratón sobre su huella (en planta y en perspectiva; pasos de 5 mm, mínimo 0 desde el punto 0) y las cotas se actualizan. Lleva un botón × rojo en su esquina superior derecha que abre "¿Eliminar isla?" (Eliminar / Cancelar); en la tarjeta del panel también pide confirmación (`window.confirm`). `Island3D` en KitchenViewer3D.tsx.
- La nota de la isla ("Isla 1800 × 900") es editable: clic -> Largo y Ancho (mínimo 300 mm), Enter aplica, Esc cierra.
- Península: solo se crea en cocinas en L (el botón queda desactivado en otras formas; si la forma cambia, la península queda guardada pero inactiva y no se dibuja). Sale del frente de los módulos del muro perpendicular B: cota X fija = fondo de esos módulos (`CORNER_BLIND_OFFSET`, 570) y solo se desliza hacia el frente (cota Y editable, arrastre solo en Y). Su zócalo no se retrae en el costado pegado a los módulos (sí 5 cm en los otros tres). Supuesto: "muro perpendicular" = el brazo B; si va pegada a otro sitio (p. ej. al extremo del brazo), cambiar `dx` fijo en `updateIsland`/`addIsland`.
- CORRECCIÓN península: va pegada a la cara interior del muro perpendicular B (cota X = 0), no al frente de los módulos del brazo; queda sobre la zona del brazo y solo se desliza en Y. Sustituye la nota anterior (cota X = 570).

## Cocina en L: brazo a la izquierda o a la derecha (2026-10-31)
- Al elegir "En L" en Espacio se pregunta de qué lado va el brazo (`lArm`: izquierda = muro B, derecha = muro C). La L con brazo a la derecha usa el muro C (ya soportado por la U): `hasB`/`hasC` en `boxes.ts` y `armB`/`armC` en App.tsx. El largo del brazo se pide como "Largo del brazo (muro B/C)". Los electrodomésticos que estaban en un muro que ya no existe pasan al muro A; la modulación procesa solo los muros presentes.
- Muro auxiliar izquierdo/derecho: con brazo a la izquierda el izquierdo cierra el extremo del brazo y el derecho el extremo de A; con brazo a la derecha es al revés.
- Península: va pegada a la cara interior del muro del brazo (X = 0 a la izquierda; X = largo de A - largo de la península a la derecha).

## Módulos en islas y penínsulas (2026-10-31)
- "Optimizar modulación" también llena cada isla o península activa: una hilera de módulos bajos a lo largo de su largo (con los anchos de la estrategia elegida; si sobra menos de 120 mm se suma al último), de fondo igual al ancho de la isla, apoyados sobre el zócalo de la isla. Son módulos con `wall: 'Island'` e `islandId` (types.ts); sus cajas llevan `islandId` y no cuentan como parte de los muros A/B/C (mesón, dilatación). Se mueven con la isla (positionX es relativo a ella).
- La península ocupa su espacio en el brazo: en esa franja de Y el brazo no lleva módulos propios (los pone la península).
- Quitar una isla quita sus módulos; los módulos de una península inactiva (fuera de una L) se guardan pero no cuentan ni salen en el listado.
- Sin mesón sobre las islas todavía; si cambias el largo o el ancho de la isla hay que volver a optimizar para que los módulos la cubran.
- "Optimizar modulación" NO se ejecuta si las islas o penínsulas chocan: entre sí, con los módulos de los muros A/B/C (huella de 570 mm de fondo) o se salen del largo del muro A. Muestra un aviso con los choques y deja el diseño como estaba (`islandConflicts` en App.tsx). La península no choca con el muro al que va pegada (ocupa su espacio).

## Herramientas por cara del módulo (2026-10-31)
- Con el módulo seleccionado (clic), en isométrica y 3D cada cara trae una X roja con borde blanco (eliminar) y un + verde (dividir): cara frontal (siempre visible) = dividir a lo ancho (izq./der.); cara de arriba = dividir en uno superior y uno inferior (`splitModuleHorizontal`); cara del costado derecho = dividir en uno frontal y uno posterior (`splitModuleDepthwise`). El + azul anterior se quitó.
- Un módulo partido en frente y fondo usa `depthOffset` (mm desde el muro hasta su cara trasera). El mesón llega hasta el frente del módulo más profundo del tramo.
- La X y el + de la cara frontal ya no se ven siempre: salen solo con el módulo seleccionado (un clic), igual que los de arriba y del costado.

## Manijas azules de extrusión por cara (2026-11-01) — reemplazan las flechas rojas
- Con el módulo seleccionado, cada cara libre (sin otro módulo o electrodoméstico pegado) muestra una manija azul que flota frente al centro de la cara con una flecha hacia donde se extruye (la dirección se calcula con la cara en pantalla): izquierda, derecha, frente, arriba y, en aéreos, abajo. Sin módulo al lado, arriba o abajo se activan todas. El fondo (muro) no tiene manija; los bajos tampoco tienen la de abajo; un aéreo ya pegado al techo no tiene la de arriba.
- Clic sostenido + arrastre: la cara se mueve y se muestra la cota (azul) mientras se sostiene. Clic simple: el módulo se estira por esa cara hasta la siguiente cara de referencia (otro módulo, electrodoméstico, límite del muro, techo o 1200 mm de fondo): `extendModuleFace` en App.tsx (búsqueda binaria de 5 en 5 mm sin crear choques). `FaceHandle` en KitchenViewer3D.tsx.
- Las flechas rojas ◀ ▶ ▲ ▼ ↘ y la ▼ del fondo en planta ya no existen.
- Referencia al arrastrar una manija: si con el clic sostenido el cursor toca otro módulo (se pinta de amarillo), la cara de ese módulo manda: la cara que se jala se alinea con la cara del módulo tocado más cercana al punto tocado (costados: largo; frente: fondo; arriba y abajo: altura, y en aéreos también la separación con el techo). `resolveReference` + `hoverRef` en KitchenViewer3D.tsx. Sin módulo bajo el cursor, el arrastre es libre (de 5 en 5 mm).
- El botón morado de unión es más pequeño (64 px en vez de 96) y, en isométrica y 3D, ya no se gira en pantalla: queda apoyado en la cara del módulo y su línea central es paralela a la línea de unión entre módulos. En planta y frontal sigue girando para seguir el eje del muro.
- Un clic fuera cierra los paneles laterales (Elementos, Accesorios, Módulos especiales; atributo `data-side-panel`) y también las ventanas modales (Espacio, Asistente) al hacer clic en el fondo oscuro. La barra lateral y el propio panel no cuentan como "fuera".
- Módulos especiales múltiples: en el panel de Módulos especiales los botones "+ Otra alacena alta" y "+ Otra torre de hornos" crean tarjetas adicionales numeradas ("Alacena Alta 2", ...), desactivadas y colocadas a continuación de las demás; cada una activa su propio módulo TALL (el módulo se reconoce por su id `special-<id>-...`, no por el nombre). Las adicionales se quitan con la × (con confirmación). La "Posición" de la tarjeta ahora mueve el módulo (antes no hacía nada sobre el módulo ya creado).
- CORRECCIÓN módulos especiales múltiples: no hay botones aparte; cada tarjeta de alacena alta o torre de hornos trae un "+" verde (crea otra del mismo tipo) y una "×" roja (la borra, con confirmación; no sale si es la única de su tipo). Los nombres se numeran con el mayor número existente + 1.
- CORRECCIÓN módulos especiales múltiples (versión final): una sola tarjeta por tipo (Alacena Alta, Torre de Hornos), sin repetir la tarjeta. El "+" verde del encabezado crea otra unidad del mismo tipo (la tarjeta pasa a "Alacena Alta × 2"); el interruptor activa o desactiva todas las unidades; con el tipo activo cada unidad muestra su fila con Ancho y Posición, y con más de una unidad cada fila trae su "×" roja para borrarla (con confirmación). Si el tipo ya está activo, la unidad nueva se coloca de una vez. `toggleSpecialGroup`, `addSpecialModule`, `placeSpecialModule` en App.tsx.
- La letra de cada módulo se ve igual en planta y en frontal (blanca, en negrita, con sombra, centrada: en planta sobre la cara superior, en frontal en el centro de la cara frontal). En isométrica y 3D sigue pintada sobre la cara frontal.
- CORRECCIÓN: la letra de los módulos se ve igual en TODAS las vistas (blanca, negrita, con sombra, tamaño fijo): en planta sobre la cara superior y en frontal, isométrica y 3D en el centro de la cara frontal (ya no se pinta con `Text` sobre la cara).
- Letras de los módulos solo si se ven: en planta, un módulo bajo cuyo centro queda bajo el mesón o bajo un aéreo (con esas capas visibles) no muestra su letra; si ocultas MA o Mesón con los botones, las letras de los bajos vuelven a aparecer. Aéreos y torres siempre la muestran. En las demás vistas siempre se muestran.
- Mesón de islas y penínsulas: si la cocina tiene mesón activo, cada isla o península con módulos bajos lleva su propia losa con el mismo espesor y voladizo de la cocina (`counter-isla-<id>-<n>`, `boxes.ts`). El voladizo va en todos los lados libres (la península no lo lleva del lado pegado al muro), así que la losa sobresale de la medida general de la isla por ese voladizo. Cubre también dilatadas y vistos. Sin salpicadero, cascada ni aberturas (poceta, estufa). Se edita con doble clic (fondo y espesor); el espesor y el voladizo son los mismos de toda la cocina.
- Separación de herramientas por cara: las manijas azules flotan al centro de cada cara; la X y el + de la cara de arriba van hacia el fondo de la cara y los de la cara del costado en su parte alta, así ya no se encimaban con la manija azul. La X y el + del frente se separaron un poco más (±70 px en perspectiva).

## Esquinero en L (2026-11-01)
- Se eligen dos módulos con clic + Shift + clic (el primero del muro A y el primero del brazo B o C, los dos bajos y de la esquina): sale un aviso abajo ("Unir A e I en un solo módulo esquinero en L") con Unir y Cancelar; si la pareja no es válida el aviso explica por qué. Al unir, el módulo del muro A pasa a ser un solo módulo con `cornerArm` ({ wall, width, depth }): conserva su tramo en A y un brazo que sigue por B o C tras la esquina ciega (570 mm). Con el esquinero elegido el aviso muestra "Esquinero en L ancho × ancho del brazo" y el botón Separar (vuelve a dos módulos).
- Geometría: dos cajas con el mismo `moduleId` (la del tramo A y `<id>-arm`); el brazo se dibuja como otra caja que se elige junto con el módulo. El listado de corte despieza el brazo como otro módulo bajo (ancho y fondo de su brazo). Por ahora solo bajos; el largo del brazo no se edita aún con manijas (solo separando y volviendo a unir).
- Ancho máximo de módulo: 900 mm (`MAX_MODULE_WIDTH`). La optimización parte en partes iguales cualquier módulo que lo pase (un resto sumado al último, el aéreo alargado hacia la esquina) y los arrastres, la etiqueta de largo, las uniones y el clic simple de las manijas no lo dejan superar. Los módulos altos especiales quedan fuera de esta regla.
- El esquinero en L se dibuja como un solo cuerpo en forma de L (un prisma con el contorno de los dos tramos, sin costura) y se elige completo con un clic; ahora también se pueden unir aéreos con aéreos (el brazo guarda su posición, que en aéreos puede empezar antes de la esquina ciega).
- El aviso de unión de esquinero (abajo de la escena) va por encima de todas las etiquetas, letras y botones de la escena (`z-[500]`): lo que queda detrás del aviso se oculta.
- Medidas del esquinero en L: lleva cuatro medidas en lugar de la etiqueta de largo: arriba (atrás, junto a cada muro) el largo contra el muro A y el largo contra el muro del brazo (570 + brazo), y abajo (al frente, junto al piso) el frente del tramo del muro A (largo - fondo del brazo) y el frente del brazo. Se editan con clic las tres que son datos: atrás del muro A (largo del tramo), frente del muro A (largo del tramo menos el fondo del brazo) y frente del brazo (largo del brazo); la del brazo contra el muro es solo informativa.
- Esquinero en L: entre su brazo y el siguiente módulo del brazo hay una flecha doble de unión (el brazo cuenta como módulo `<id>:arm` en el cálculo de uniones); al arrastrarla cambia el largo del brazo y el vecino cede o gana lo mismo. Escribir el frente del brazo hace lo mismo (el siguiente módulo del brazo se mueve y cambia de ancho, entre 100 y 900 mm). El costado de la esquina queda fijo al cambiar el largo del tramo del muro A (el cambio va solo por el otro lado) y un vecino que crece al encogerse un módulo no pasa de 900 mm (si no cabe, el módulo no se encoge).
- CORRECCIÓN: un módulo se puede encoger aunque su vecino ya esté en 900 mm: el vecino gana lo que le cabe hasta 900 y el resto queda como hueco entre los dos (que se cierra con el imán al acercarlos). Esto vale para la medida del frente del muro A del esquinero en L (330 = su máximo; solo se puede bajar, no subir).
- CORRECCIÓN: en un esquinero en L el máximo de 900 mm se aplica al frente de cada tramo, no al largo atrás. El largo del tramo del muro A puede llegar a 900 + fondo del brazo (1470); por eso el frente del muro A (la medida de abajo, p. ej. 330) se puede subir hasta 900 y el vecino cede lo mismo (`resizeSymmetric` suma el fondo del brazo al máximo si el módulo tiene `cornerArm`; igual en arrastre de bordes, manijas y flecha doble).
- REGLA FINAL del ancho máximo (reemplaza las notas anteriores sobre el tope de 900 mm): los módulos no pasan de 900 mm SOLO en la optimización (`MAX_MODULE_WIDTH` se usa al modular y al llenar islas). Al editar a mano (etiqueta de largo, bordes, manijas, flechas dobles, medidas del esquinero en L) NO hay tope de ancho, y los módulos no se separan: al encoger uno, su vecino que lo toca crece lo necesario (aunque pase de 900) para seguir pegado, y al crecer cede lo mismo. `resizeSymmetric` tiene `maxWidth = Infinity` por defecto.
- La tarjeta "Isla / Península" ya no está en Módulos especiales: está en la ventana Espacio (después de la dilatación y antes de los muros auxiliares). Funciona igual (tipo, largo y ancho, "Aceptar y crear", lista con cotas editables y × para quitar).
- Con una península, el zócalo del brazo de la cocina llega hasta ella: va desde la esquina hasta donde empieza el zócalo de la península (dy + 5 cm) y ahí lo toma el de la península; el tramo del brazo que queda más allá de la península no lleva zócalo (`armEnd` en `boxes.ts`).
- La huella de la isla o península (relleno, borde punteado, nota con la medida, × para eliminar y cotas desde el punto 0) solo se ve en planta; en isométrica, 3D y frontal se ocultan y quedan sus módulos y su zócalo.
- Los campos numéricos con mínimo y máximo de la ventana Espacio (largo del muro A, altura del techo, largo del brazo, zócalo, mesón, voladizo, salpicadero) usan `DeferredNumber`: se escribe con libertad y el valor se aplica (con sus límites) al salir del campo o con Enter. Antes el mínimo (p. ej. 500) se aplicaba en cada tecla y no dejaba escribir.
- En la ventana Espacio, la tarjeta "Isla / Península" va justo encima de la sección del mesón (orden: zócalo, isla/península, mesón, dilatación, muros auxiliares).
- Isla/península en Espacio: la × de cada una pide confirmación dentro de la app ("¿Eliminar? Sí / No"; los diálogos del navegador no se usan para borrar) y cada tarjeta trae los botones Isla | Península para cambiarla de tipo (la península solo en cocina en L; si no lo es, el botón sale desactivado y un aviso lo explica). Las tarjetas de alacena alta y torre de hornos borran igual, con "¿Borrar? Sí / No".
- La tarjeta "Isla / Península" de Espacio usa su propio icono (`IslandIcon`): una cocina en L vista desde arriba, con una península pegada al brazo y una isla suelta.

## Barra de la isla y península (2026-11-02)
- La tarjeta de isla/península pide también la "Barra" (mm): el voladizo del mesón por el frente (0 = sin barra), también editable en cada isla creada. El mesón de la isla o península es EXACTAMENTE la medida general (largo x ancho, p. ej. 1800 x 900); los módulos miden ancho - barra de fondo (900 - 300 = 600) y empiezan atrás; el zócalo retrocede la barra por el frente (queda a ras de los módulos; sin barra retrocede 5 cm) y 5 cm atrás y a los lados. El cambio de barra o de medida se refleja al volver a optimizar (los módulos se recalculan). En el editor del mesón de una isla el ancho es de solo lectura (se cambia en su tarjeta).
- Esto reemplaza lo anterior del mesón de las islas con voladizo en todos los lados.

## Alineación del generador de Fusion (2026-11-04)
Se revisó el documento "cocina prueba 2" de Fusion contra `generador_cocina_fusion_FINAL.py` y `bomService.ts`. Se alineó el generador:
- Luz de las puertas de la campana: 4 mm (regla validada; el script tenía 3).
- Amarres (MB y MA) sin canto (quedan ocultos), igual que la app.
- Base del MB y piso/techo del MA con el canto de sus laterales (canto de su propio color), como `structureEdge` en la app. El documento de Fusion tenía esas piezas sin canto: se siguió la regla de la app.
- "Test Frontal/Trasero" → "Testero Frontal/Trasero".
Pendiente: las posiciones del cajonero (35, 445, 605), la gola media (330) y el entrepaño (400) están fijas para un bajo de 800; no se adaptan si cambia el alto.

## Isla y península con estufa y poceta, cascada, salpicadero (2026-11-03/04)
- Formulario de isla/península (en Espacio, con cápsula para activarla): tipo, largo, ancho, barra, cotas X e Y desde el punto 0, y si lleva estufa y/o poceta con su distancia desde el punto 0 de la isla. Se crea con "Aplicar cambios". Dibujitos de cada medida (`MeasureSketch`).
- Estufa/poceta de la isla: `buildIslandRow` pone Mueble Estufa y Mueble Poceta en esa distancia (los huecos menores de 120 mm se pegan al vecino); el mesón lleva las aberturas. La cubeta de la poceta mide 20 cm (el mueble lleva un hueco arriba); en la isla la grifería va al frente apuntando al muro A.
- Botón "Modular isla / península" dentro del optimizador: modula solo la isla sin tocar la cocina.
- Mesón de la isla: salpicadero con las reglas de la cocina; cascada izq/der con "medida inferior" = chaflán por el frente.
- Columnas o muros atravesados (Espacio): muro, distancia desde la esquina, ancho y profundidad, a la altura del techo; la modulación los respeta, se cubre el espacio de enfrente con un módulo "cubre-columna" (fondo del módulo − profundidad de la columna), el mesón lleva una muesca y el salpicadero rodea la columna a 45°.
- Canto del mesón: frentero (a 45° con el mesón; alto sugerido 30) o reengruese (pieza pegada por debajo, 2×2 cm o 2×espesor), por lados (frente, izq., der.; la isla también posterior). Frentero a izq./der. resta un espesor al módulo del extremo (salvo que ya haya visto/dilatada); el visto/dilatada de ese lado pierde (alto del frentero − espesor del mesón) o el alto del reengruese.
- Medidas de los muros editables en planta, cota completa de la isla y etiquetas que se ocultan cuando algo las tapa en isométrica/3D (las ventanas de edición no se ocultan).

## Secciones (2026-11-04)
- `sections.ts`: Cocinas integrales, Closets, Walking closets, Puertas, Muebles de baño y Centros de TV. Selector en la cabecera; cada sección guarda su propio diseño (snapshot). Cambian formas de espacio, alto del módulo de abajo, espacio entre niveles, nombres (Cuerpo/Maletero...) y qué se ofrece (mesón, isla, accesorios). Las reglas propias de cada sección están pendientes de definir (arrancan con las de la cocina adaptadas).

## Convertir a módulos (2026-11-04/05)
- Botón "Convertir a módulos" debajo de "Optimizar modulación" (vuelve a cubos con el mismo botón). Cada cubo se cambia por un módulo con sus piezas (reglas del generador de Fusion): bajo = laterales, base, 2 amarres traseros de 80, gola (puente en L) de 65, entrepaño si ≥450 y sin techo ni espaldar; aéreo = laterales, piso, techo, espaldar de 6 retranqueado, 2 amarres de 60, entrepaño si ≥450; más puertas (18 mm, luz de 2). Sugerencia inicial: puertas verticales en todos.
- Clic derecho en un módulo: bajo → ¿puertas o cajones? (cajonero con 2 frentes de 360, gola media y 3 cajones); aéreo → ¿verticales u horizontales? (campana con su regla de luz de 4 mm). El cubo de un módulo convertido no se dibuja.
- Pendiente: el listado de corte aún no usa estas piezas; el esquinero en L y el cubre-columna aéreo no se convierten.

## Closets: paso 1, estructura (2026-11-05)
- Reglas completas en `REGLAS_CLOSET.md`. Tarjeta "Estructura del closet" en Espacio (secciones Closets y Walking closets): los lados (con muro o con costado) se deducen de los muros auxiliares, L o U; con zócalo se elige tipo T o base completa con zócalo al frente; sin zócalo, marco inferior acostado o sin marco (`ClosetConfig`, `closetInput`).
- `boxes.ts` arma sobre el muro A: costado propio (lado sin muro) o dilatada 15×15 + marco lateral 80×15 (lado con muro), marco horizontal (ancho − 30 − 15), tapa de riel de 110, base (zócalo T / base + zócalo / marco acostado) y tablero del maletero de 455 de fondo a min(1900, techo − 350). Ids `closet-N` (kind `panel`).
- Pendiente: interior (cajonero, entrepaños, tubos), puertas corredizas, alarma de láminas de 2400, listado de corte y estructura en los brazos de L/U. "Optimizar modulación" en closets avisa que el interior viene después.

## Closets: pasos 2 y 3, interior, puertas y formularios (2026-11-05)
- Formulario del closet en Espacio: zócalo/marco inferior (si/no), tapa de riel (activar + altura), cajonero (posición, cajones, ancho, altura de la cara superior sugerida 800), entrepaños (cantidad, reparto igual), puertas corredizas (cantidad, traslape 25, alto = libre − 20) y chip "Puertas" para ocultarlas.
- Cajonero: tapa por encima, cajones pegados a la tapa con 30 mm entre frentes y frentes ≤ 200, puente amarre de 70, dilatación de 45 junto al muro, opción de quitar el costado junto al lado del closet.
- Doble clic en una pieza del closet abre el formulario de su sección (zócalo, base, cajonero, entrepaños, maletero) en `KitchenViewer3D.tsx` (`ClosetSectionForm`, `closetSectionOf` en `boxes.ts`). Probado: entrepaños y cajonero.
- Pendiente: alarma de láminas de 2400 con división editable, listado de corte de piezas del closet, estructura en brazos L/U, batientes, zapateros.
- Closets (después): costado de los entrepaños con interruptor solo del lado del cajonero que da a un muro; formulario de la base pregunta "Lleva zócalo"; costado piso a techo con doble clic edita su profundidad y la base/zócalo la siguen (`costadoDepth`); MA y MB ocultos en closets. Principio del cajonero (2 laterales + 5 puentes) anotado en `REGLAS_CLOSET.md`, aún sin construir.
- Closets (doble clic): tapa de riel (lleva/no y altura) y muros (Recto / En L con lado del brazo / En U; cambia el mismo estado del Espacio). `closetSectionOf` ahora devuelve también 'costado' y 'taparriel'; la sección 'muro' se abre desde las mallas de muro.
- Closets (tanda 5-nov): techo a 5 mm (`CLOSET_TOP_MARGIN`); 3 puertas = centro adelante y lados atrás; puente amarre de 70 solo si el hueco bajo el cajón de abajo ≤ 70; cajonero con 5 puentes internos (2 arriba, 2 atrás, 1 inferior frontal); zócalo T: cajonero baja al piso, cajón de abajo a zócalo + marco + 30, T corrida a 5 mm del frente y puente vertical hasta el puente acostado; formulario del zócalo con "Marco inferior / base". Pendiente: cajonero flotado (puente inferior pasa a base), listado de corte, láminas de 2400, brazos L/U.
- Closets (cajonero, 5-nov tarde): frentes de cajón de parche (por defecto) o embebidos (ancho interno − 6 mm, lateral +15 mm, canto al ras del frente); solo con embebido: "Sin lateral" (correderas al costado: 13 mm del cajón y 3 mm del frente) y "Laterales hasta el maletero" (tapa entre laterales, entrepaños dentro); costado de entrepaños quitable con el cajonero a un extremo (muro o costado) y entrepaños/tapa al ras; puentes frontales retrocedidos 15 mm; cápsula "Lleva entrepaños"; botones de vista Entrepaños/Cajonero/Costado.
- Closets (dos cajoneros y más): `twoCajoneros` + `twoPlacement` ('centro' con dilatada central de 60 mm hasta el maletero y 4 puertas sugeridas / 'extremos' con 3); el segundo cajonero tiene sus medidas en `cajonero2` y piezas con sufijo " · 2" (`closetCajoneroIndex`); cada cajonero con su formulario y su flecha de fondo (`cajoneroDepth`, entrepaños y laterales −20 mm, cota con el cambio). Laterales al maletero también en parche (entrepaños 2 cm atrás); costados de entrepaños a la profundidad del lateral. Doble clic en puertas: alto y translúcidas (solo vista). `buildBoxes` arma cada cajonero con `buildCajonero`.
- Closets (torre de entrepaños): `torreOn/torrePos/torreWidth/torreToCeiling/torreShelves/torreDivisions/torreDepth`; laterales (fondo−20), divisiones y entrepaños (laterales −20), hasta el maletero o el techo (corta el maletero); solo con un cajonero, que se acomoda en el espacio restante; cápsula en el Espacio y formulario por doble clic (`closetSectionOf` → 'torre'). Pendiente: ubicación centro/derecha sin probar en pantalla.
- Closets (6-nov): cinta métrica corregida (etiquetas visibles en 3D con `occlude={false}`, esquinas tapadas y piezas ocultas fuera, sin selección al medir); cajonero con posición libre (`cajoneroX`) y centro del muro; torre pegada al muro y con lateral quitable junto al costado (`torreSinLateral`); segunda torre (`torre2On`/`torre2`); torre con dos cajoneros. Reglas al día en `REGLAS_CLOSET.md`.
- Closets (entrada y formularios): al entrar a Closets/Walking arranca en vista frontal con puertas translúcidas (por defecto) y la tarjeta "Muros del closet" (Recto/L/U, muros A/B/C y altura, plegable); los formularios flotantes y esa tarjeta se arrastran por su título (`useDragOffset` en App y en KitchenViewer3D).
- Sección "Closet fit" (7-nov): el cubo del área se arma por cuerpos (`ClosetFit` en `types.ts`: fondo, cuerpos inferiores y superiores, `lowerW/upperW` anchos, `lowerCells/upperCells` alturas de celdas; un alto negativo = hueco). `fitRows` y `fitCells` en `boxes.ts`. En vista frontal: clic selecciona un cuerpo (X deja el hueco, + divide en dos lado a lado, + de abajo divide en horizontal), flechas dobles moradas en cada contacto (se igualan al tocar otra del mismo eje; las uniones alineadas de las dos filas se mueven juntas), botón de unión por pareja arriba/abajo de igual ancho, notas de medidas editables y desplazables, pestaña "Dimensiones" para ocultarlas, tarjeta "Closet fit · cuerpos" ocultable. Los de abajo llegan hasta el más bajo de los de arriba que les quedan encima (sin sobreponer). Al pedir L o U en closets el brazo se sugiere de 600. "Closets" ahora se llama "Closet constructor".
- Closet constructor (mismo día): puertas abatibles de parche (bisagra izq/der, costado o marco propio, marcos que suben al techo y marco superior/inferior divididos), narices en entrepaños y maletero, láminas de 2400, torre de entrepaños con segunda torre y lateral quitable, dos cajoneros, cinta métrica corregida.
- Closets/Closet fit (8-nov): dilatación de 15×15 de piso a techo junto a cada muro, activa por defecto y con interruptor en la tarjeta de muros (`closet.dilatacion`, `fit.dilatacion`, `fitInsets` descuenta 15 mm por lado con muro del cubo y de los cuerpos). Vista frontal sin aristas de muros, sin piso/techo dibujados, sin piezas internas de cajones ni puentes, y los cuerpos del Closet fit se dibujan con una sola línea (cara frontal). Formularios flotantes se arrastran desde cualquier punto (salvo campos y botones) y el tocado pasa al frente.
- Closet fit (flechas y medidas): flecha doble = contacto entre dos cuerpos reales; flecha sencilla azul = cara que da a espacio libre (hueco), independiente de las demás, llega hasta 1 mm del límite; la línea naranja marca el límite cuando faltan menos de 20 mm y flecha y línea desaparecen al agotarse el espacio (menos de 3 mm). `commit` funde un hueco al pie de un cuerpo de arriba con el hueco de abajo. Notas de medidas pequeñas con candado de ancho y de alto (`fitLocks`): una medida bloqueada no cambia al editar otras, las flechas que la tocan muestran un candado y no se arrastran. Shift + clic en 2 o 3 cuerpos (`fitMulti`, naranja) pregunta "¿Igualar ancho/alto?" (`fitEqualizeMany`, múltiplos de 5 mm, el sobrante lo absorbe otro cuerpo sin candado). Con "Dimensiones" apagada las notas de los cuerpos que cambian aparecen 2 s al arrastrar una flecha.
- Walking closets (8-nov): arranca como el Closet fit (`isFitSection` incluye 'walking') en U por defecto, con cubos por cuerpos en los tres muros. `fit.cubes` activa o desactiva los cubos de A, B y C; los muros B y C usan `fit.armB` / `fit.armC` (fondo, cuerpos, zócalo) y empiezan delante del cubo del muro A. `buildFitCube` en `boxes.ts` arma cada cubo en un marco local (x a lo largo del muro, y fondo) y los brazos se giran al muro (ids `fitB-…` y `fitC-…`). Primera tanda: en B y C hay cuerpos, formulario por doble clic (marco puerta/surrón), convertir y copiar con alt + clic; faltan flechas de arrastre, notas con candado, igualar y botones de dividir/eliminar en esos muros. El zócalo del cubo (escalera: largueros + travesaños) sube los cuerpos de abajo (`fitBase`).
- Walking closet / Closet fit (8-nov, noche): opción "Unir zócalos" (`fit.unirZocalos`, activa por defecto): el zócalo de los brazos B y C se alarga hacia el muro A hasta tocar el zócalo transversal (`zExt` en `buildFitCube`). El zócalo del cubo va pegado al muro y su profundidad es menor que el fondo (mínimo 30 mm de diferencia). Chips A, B y C en la barra de vistas (`visibility.wallA/B/C`) ocultan o muestran cada muro con sus cubos. Los tipos ya compilan sin errores (0 en `tsc`).
- Muebles de baño (11-nov): ahora arranca como el Closet fit (`isFitSection` incluye 'bano'; sin mesón ni gabinete de cocina): 2 cuerpos de abajo, fondo 480, alto del mueble 600 (`fit.altoMueble`; el cubo mide espacio al piso + alto, `fitTop`) y flotado por defecto con 250 mm al piso (`fit.flotado`, que reutiliza `fitBase`; con flotado no hay zócalo). Opcionales: sanitario al lado del mueble (`fit.sanitario`: lado y espacio que se reserva, `fitInsets` acorta el cubo; piezas 'Sanitario taza' y 'Sanitario tanque') y espejo sobre el mueble (`fit.espejo`: alto, ancho y altura desde el piso; pieza 'Espejo bano' translúcida). Los muros siguen igual que en el Closet fit.
- Baño (11-nov, 2): el mueble tiene su propio ancho y posición desde el punto 0 (esquina izquierda del muro), independientes de la medida del muro (`fit.mueble {x0, ancho}`, `fitInsets(fit, wallA)`); el sanitario se coloca por su eje desde el 0 y su ancho (`fit.sanitario {x0, ancho}`). El cubo del baño es largo, hasta el techo, como en el Closet fit: el cuerpo de abajo es el mueble (`fit.altoMueble`, flotado desde `fit.flotado`) y encima queda un hueco libre que se puede rellenar con el + y dividir en vertical u horizontal con las mismas flechas y botones del Closet fit (cuerpos inferiores/superiores y alto superior en la tarjeta). La dilatación solo se dibuja si el mueble llega hasta el muro.
- Dilatada o visto (11-nov): en el Closet fit, el walking closet y el baño ya no hay dilatación automática junto al muro (`fitInsets` sin dilatación; el interruptor de la tarjeta de muros solo sigue en el closet constructor). Como en la cocina, se pide por módulo en su formulario (doble clic): lado izquierdo y lado derecho con Nada, Dilatada (15 x 70 al frente), Visto 15 o Visto 19 (cubre todo el fondo); restan ancho al módulo (`FitBodyCfg.ladoIzq/ladoDer`, `fitBodyParts`).
- Baño (11 y 12-nov, resumen final): el cubo es largo hasta el techo y el mueble es el cuerpo de abajo (flotado, 250 mm al piso por defecto); encima "Cuerpos sobre el mueble" (3 por defecto: franja de 200, uno de 700 y el resto), cada cubo con ancho y fondo propios (`fit.cellW`, `fit.cellD`; el fondo se cambia en el formulario del cubo) y sin cubo contenedor dibujado. Clic derecho convierte un cubo en espacio libre y viceversa. Muros auxiliares izquierdo y derecho (en vez de Recto/L/U): al pedirlos el mueble se pega a ese muro y no se crean cubos en B y C (`cubes` en falso por defecto). Sanitario y espejo son solo ambientación translúcida: la distancia del sanitario se mide desde el muro auxiliar hasta su lado que lo mira (1000 por defecto, editable). Sin dilatación automática: dilatada o visto por módulo en el formulario.
- Cotas y calculadora (12-nov): en la vista frontal del Closet fit / baño hay dos cotas verticales a la izquierda (del piso al borde de abajo del mueble = flotado o zócalo, y del piso al borde de arriba = alto total); se editan y modifican el flotado/zócalo o el alto del cuerpo de abajo. Sus campos y las notas de ancho y alto de los cubos usan `CalcInput`/`calcSimple` (suma y resta, p. ej. `800-30`). Los campos numéricos de toda la app seleccionan su valor al entrar (el cero ya no queda pegado). En `fitCells`, si cambia el espacio de abajo (flotado, zócalo, cuerpos de arriba) los cuerpos de abajo conservan su alto y el de arriba absorbe la diferencia.
- Cubos independientes y puertas (12-nov): dividir un cubo con el + solo lo divide a él (`fit.subs`, partes `id-sN` con su nota, flecha y formulario); eliminar una parte deja un espacio libre sin alargar a la vecina (`fit.gaps`). Campos numéricos sin flechitas, sin rueda y sin negativos. Puertas del surrón: simétricas por defecto (par: espejo; impar: la del centro con bisagra arriba), "Horizontal" con más de 2 puertas = abertura horizontal (líneas en V), pieza vertical solo donde empieza una puerta con bisagra y en el cierre del medio solo si se pide (`vertMedio`), y un clic en una puerta (con el módulo seleccionado) rota su abertura izquierda/derecha/arriba (`aberturas`, `doorOpening`).

## Flechas, cotas y movimiento (2026-11-12, tarde)
- Flechas 3D de estirar en el cubo seleccionado (arriba, lado y frente): se ocultan si la cara toca otro cubo o no hay espacio/está bloqueada; el cubo crece desde su borde de inicio (flecha del lado contrario); topan con la cara del cubo que toque el mouse o se pegan a menos de 40 mm; una casilla muestra la medida y queda 3 s. Mínimo de cualquier cubo o módulo: 15 mm (también en cocinas).
- Cruz verde para mover un cubo (horizontal y vertical): se desune de sus vecinos (`fit.cellX`, y el vertical reparte espacio libre entre arriba y abajo).
- En el módulo aislado (3 clics), un clic en una pieza muestra sus flechas: solo cambia esa pieza (`fit.pieceAdj`).
- Cotas: generales (ancho y alto totales), de espacios libres y de lados, todas movibles y con línea segmentada a su referencia. Negras con referencia; verdes si se arrastra un extremo y pierde la referencia (doble clic la restaura). Mismo tamaño en todos los productos.
- Controles Html de las caras en perspectiva miran siempre a la cámara (sin `transform`).
