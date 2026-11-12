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
  2. **Puertas**: 1 o más; horizontal o vertical. Con más de 3 (por confirmar si 3 entra) → preguntar si la pieza vertical que sostiene las puertas de parche es **puente vertical** o **costado completo**. Va entre la base y la tapa; normalmente van dos pegadas (dos puentes verticales) o un puente vertical + un costado vertical.
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

## Preguntas abiertas
- Con 3 puertas, ¿se pregunta por la pieza vertical o solo con 4 o más?
- Medida de cada puerta con 2 o más hojas (reparto del ancho y luces entre hojas).
- Cantidad y posición de los puentes en el surrón de cajones (la lista del plano trae 1 puente de 698 × 80).
