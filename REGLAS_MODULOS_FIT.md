# Módulos del Closet fit (cubo → módulo con partes)

Estado: **primera versión programada** (2026-11-08): `FitBodyCfg` en `types.ts` (`fit.bodies`, `fit.converted`), `fitBodyParts` en `boxes.ts` y `FitBodyForm` en `KitchenViewer3D.tsx` (doble clic en un cuerpo; "Convertir a módulos" activa `fit.converted`). Supuestos a corregir: puertas con luz de 2 mm y 1 mm al borde (ancho − 2, alto − 3), puentes superiores/inferiores de 80 al frente y atrás, zócalo de 80 retranqueado 65, cajón con correderas de 13; la configuración se guarda por id del cuerpo (si cambia la estructura de cuerpos puede correrse). Las medidas salen de los planos del carpintero; espesor 15, color Madera.

## Cómo se abre
Doble clic en un cuerpo (cubo) del Closet fit abre el formulario: **¿Es marco puerta o surrón?**

## Dos etapas (2026-11-08)
1. **En "Optimizar modulación"** (antes de convertir): el doble clic en un cubo abre el formulario y lo que se elige se ve **representado**: solo los frentes de cajón y las puertas (placas representativas sobre el cubo, con sus luces: 2 mm con manija, 30 mm con puente en L).
2. **En "Convertir a módulos"**: esas representaciones se convierten en las **piezas reales** del módulo (laterales, base o puentes, tapa, entrepaños, puertas, frentes, cajones con sus laterales, testeros y fondo), con las fórmulas de abajo. La configuración del formulario se guarda en el cuerpo y se usa en las dos etapas.

## Marco puerta
- Plano de ejemplo: marco de 2 puertas con zócalo, 728 × 1810, fondo del marco 80, zócalo de 80 abajo.
- Preguntas: **zócalo** (sí/no) → **puertas** (1 o 2) → **horizontal o vertical**.
- Sin cuerpo de laterales de 532: es solo el marco (reutiliza lo de los marcos de puertas abatibles de parche del Closet constructor).

## Surrón (módulo de laterales con puentes)
- Preguntas, en orden:
  1. **Base completa o puente inferior.** Regla: con puertas → base completa; con cajones → solo puentes inferiores (uno al frente y uno atrás). Si el módulo va al piso → preguntar si lleva zócalo.
  2. **Puertas**: 1 o más; horizontal o vertical. Con puertas lado a lado: pieza vertical (dos pegadas: dos puentes verticales, o puente + costado) en las uniones donde empieza una puerta (su bisagra); el cierre del medio (donde se juntan las puertas de la izquierda con las de la derecha) NO lleva pieza salvo que se pida con el botón "¿Pieza vertical en medio de las puertas?" (por defecto no). Con 2 puertas la única unión es el cierre: sin pieza por defecto.
  3. **Entrepaños**: cantidad; van a 70 mm del lateral (retranqueo por confirmar, ver preguntas).
  4. **Cajones**: cantidad y tipo de frente:
     - **Con manija**: espacio entre frentes de **2 mm**.
     - **Con puente en L**: espacio entre frentes de **30 mm**.
     Con cajones el surrón lleva solo puentes (sin base completa).

## Piezas y fórmulas observadas en los planos
Módulo de puertas Ms Cl-01 (728 × 400 × 532):
- Base 698 × 532 (ancho − 2 laterales), 1 pieza, canto 1L.
- Lateral 400 × 532, 2 piezas, canto 1L.
- Puente 698 × 70, 1 pieza, canto 1L.
- Puerta 397 × 726 (alto − 3, ancho − 2), canto 4LR.

Surrón cajonero MB-01 (728 × 905 × 532, 4 cajones; con tapa llega a 920):
- Lateral 905 × 532 (2), canto 1L 2A; puente 698 × 80 (1); tapa 730 × 532 (1 mm de vuelo por lado).
- Frente 208 × 726 (ancho − 2; alto = paso − 2 mm); con paso de 210 quedan a 145, 355, 565 y 775 desde el piso.
- Por cajón: 2 laterales 500 × 120 (fondo − 32), 2 testeros 642 × 120 (interior 698 − 56 de correderas y laterales), 1 fondo 652 × 480.

Surrón de puertas 728 × 905 × 532: 2 puertas de parche, entrepaños a 298 y 603 desde el piso, base abajo y tapa arriba.

## Respuestas del carpintero (2026-11-08)
- Entrepaños: fondo del entrepaño = fondo del módulo − 70.
- Puertas **verticales** = una a la izquierda y una a la derecha (lado a lado). Puertas **horizontales** = una sobre la otra.
- También se pregunta **tapa o puente** arriba; se sugiere **puente**.

- Con una sola puerta vertical se pregunta la **bisagra: izquierda o derecha** (`hinge`, por defecto izquierda). Las líneas de abertura (segmentadas, suaves) tienen el vértice en el borde libre y abren hacia el lado de la bisagra.

## Más reglas (2026-11-08, tarde)
- Marco puerta: cápsulas de Entrepaños, Maletero (medida desde la parte superior hacia abajo) y Tubos (camisero a 40 mm bajo el maletero, pantalonero a 900 mm del piso; se pueden elegir los dos). Entrepaños, maletero y tubos van de muro a módulo, de módulo a muro o de muro a muro. Puertas de parche o corredizas (traslape 25).
- Surrón: puente en L = vertical de 65 de canto + horizontal de 65 debajo (al ras del frente del lateral, la vertical a 15 mm del borde); arriba puente en L, puente o tapa; con puente en L arriba el frente del cajón y la puerta pierden 30 mm; atrás, de canto y de cara al muro, abajo (puentes o base) y arriba (más un puente acostado). Cajones: mismo alto en todo el surrón, hasta 240, con 1 cm libre arriba y abajo.
- Zócalo del cubo (escalera): altura, profundidad (menor que el fondo, 30 mm como mínimo) y travesaños; va pegado al muro; los cuerpos de abajo arrancan sobre él.
- Walking closet: arranca como el Closet fit en U con cubos en A, B y C (cápsula por muro). Zócalos unibles: los de B y C se alargan hasta tocar el transversal de A. Chips A, B y C para ocultar o mostrar cada muro con sus cubos.

## Baño y lados (2026-11-12)
- Cada módulo puede llevar dilatada (15 x 70) o visto (15 o 19) a cada lado; restan ancho al módulo.
- El sanitario y el espejo del baño son ambientación: no son piezas del mueble ni van al listado de corte.

## Puertas: simetría y abertura (2026-11-12)
- Por defecto las puertas se arman en parejas, puerta izquierda (bisagra a la izquierda) y puerta derecha (bisagra a la derecha); con cantidad impar, la que sobra queda del lado izquierdo. Nunca se sugiere la abertura horizontal: la elige el usuario.
- Con más de 2 puertas, "Horizontal" es abertura horizontal (las puertas siguen lado a lado, bisagra arriba).
- Un clic en una puerta (con el módulo seleccionado) cambia su abertura: izquierda, derecha o arriba.
- Cada cubo es independiente: al dividirlo solo se divide él; al eliminar una parte queda un espacio libre.

## Preguntas abiertas
- Medida de cada puerta con 2 o más hojas (reparto del ancho y luces entre hojas).
- Cantidad y posición de los puentes en el surrón de cajones (la lista del plano trae 1 puente de 698 × 80).

## Flechas, cotas y movimiento (2026-11-12, tarde)
- Flechas 3D de estirar en el cubo seleccionado (arriba, lado y frente): se ocultan si la cara toca otro cubo o no hay espacio/está bloqueada; el cubo crece desde su borde de inicio (flecha del lado contrario); topan con la cara del cubo que toque el mouse o se pegan a menos de 40 mm; una casilla muestra la medida y queda 3 s. Mínimo de cualquier cubo o módulo: 15 mm (también en cocinas).
- Cruz verde para mover un cubo (horizontal y vertical): se desune de sus vecinos (`fit.cellX`, y el vertical reparte espacio libre entre arriba y abajo).
- En el módulo aislado (3 clics), un clic en una pieza muestra sus flechas: solo cambia esa pieza (`fit.pieceAdj`).
- Cotas: generales (ancho y alto totales), de espacios libres y de lados, todas movibles y con línea segmentada a su referencia. Negras con referencia; verdes si se arrastra un extremo y pierde la referencia (doble clic la restaura). Mismo tamaño en todos los productos.
- Controles Html de las caras en perspectiva miran siempre a la cámara (sin `transform`).
