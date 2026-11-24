# Costeo y cotización

Cómo calcula Modully lo que nos cuesta cada pieza, módulo y mueble, y cómo arma la cotización para el cliente.

> Última actualización: 2026-11-18. Código: [costos.ts](costos.ts) (cálculo), [Precios.tsx](Precios.tsx) (pestaña Precios), [cotizacion.ts](cotizacion.ts) (documento).

## De dónde viene

El modelo es el del Excel con el que el carpintero cotizaba (`formato despiece cotizacion.xlsx`, hojas COCINA y CLOSET). En ese Excel cada pieza costaba:

- su área ÷ el área de la lámina × el precio de la lámina;
- más el canto por metro;
- más los herrajes por unidad;
- más una instalación fija por módulo;
- y encima un recargo puesto a mano en cada módulo, entre 32 % y 50 %.

Lo que se corrigió al pasarlo a la app:

| En el Excel | En Modully |
|---|---|
| La lámina se cobraba por área, sin desperdicio, y al final se multiplicaban las láminas ×2 para comprar | Se usan las láminas reales del optimizador y su costo se reparte entre las piezas: el desperdicio ya va en cada pieza |
| Recargo sobre el costo (+40 % = ganar 28,6 % de lo que se cobra) | **Ganancia sobre el precio de venta** (la real) |
| Valores escritos a mano que no seguían la tabla de precios | Todo sale de la tabla "Mis costos" |
| Errores sueltos: módulo sin correderas, fondo de 4 mm calculado con la lámina de otro tamaño, instalación del closet sin los miles, alto y ancho de puertas cruzados | Las medidas salen del despiece real y los precios de una sola tabla |

## Mis costos (la tabla de cada usuario)

Se guarda en la cuenta, en la tabla `perfil_costos` de Supabase (una fila por usuario, junto con los datos de la empresa). Sin sesión se guarda en el equipo. Todo es editable; nada está fijo en el código.

- **Láminas**: color, calibre, tamaño y precio por lámina completa.
  - "Blanco" vale para cualquier color blanco de ese calibre y "Otros colores" para el resto.
  - Un renglón con el nombre exacto (Humo, Ámbar…) le da a ese color su propio precio.
  - Para el fondo cuenta el calibre real: "Blanco 5,5" es de 5,5 aunque en el listado diga 6.
- **Canto** por metro: blanco o de color, flexible o rígido.
- **Herrajes**:

  | Herraje | Unidad |
  |---|---|
  | Bisagra | unidad |
  | Corredera full extensión | par |
  | Manija | unidad |
  | Pistón de puerta abatible | unidad |
  | Soporte de entrepaño | unidad |
  | Tubo de closet | metro |
  | Perfil gola de aluminio | metro |
  | Corredera oculta (riel bajo el cajón) | par |
  | Perfil de zócalo en aluminio | metro |
  | Pata plástica de mueble base | unidad |
  | Platillero, condimentero, basurera, esquina mágica | unidad |

- **Mesón** por metro lineal, con su salpicadero incluido.
- **Corte por lámina**, si el proveedor lo cobra aparte.
- **Mano de obra por módulo**, fabricación e instalación, para aéreo, bajo, alto y otro.
- **Ganancia** sobre el precio de venta y **redondeo** del precio (por defecto a 1.000).
- **Datos de la empresa** para la cotización: nombre, NIT, teléfono, correo, ciudad, % de anticipo, días de vigencia y condiciones (entrega, no incluye, garantía, notas; un renglón por punto).

**Valores iniciales** (los del Excel):

| Concepto | Valor |
|---|---|
| Lámina blanco 15 (2440×1830) | 180.000 |
| Lámina de color 18 | 200.000 |
| Fondo de 4 mm (2440×1530) | 80.000 |
| Canto blanco flexible / de color flexible | 500 / 700 el metro |
| Bisagra / corredera / manija / pistón / soporte | 3.500 / 30.000 / 2.500 / 4.000 / 100 |
| Mesón | 370.000 el metro lineal |
| Instalación aéreo / bajo | 40.000 / 20.000 |
| Ganancia | 28,6 % (equivale al +40 % del Excel) |

Lo que el Excel no traía queda en 0 y resaltado en amarillo: lámina de color 15, blanco 18, fondo 5,5 y canto rígido. Si el diseño usa un precio en 0, la pestaña lo avisa ("Faltan precios…").

## Cómo se calcula el costo

1. **Lámina.** El optimizador acomoda las piezas en láminas por material, con el tamaño de lámina de la tabla. Costo del material = láminas usadas × precio; lo que no cabe en una lámina cuenta como otra. Ese costo se reparte entre las piezas según su área (costo por mm² × área de la pieza), así el desperdicio queda dentro de cada pieza.
2. **Canto.** Metros reales de cada borde según el canto de la pieza (L = largo, A = ancho, R = rígido; el color va en el texto del canto si es distinto al de la pieza) × el precio de ese tipo.
3. **Herrajes.** Se cuentan sobre las piezas reales de cada módulo:
   - **Puerta:**
     - hasta 900 mm de alto lleva 2 bisagras, hasta 1600 lleva 3 y más alta lleva 4;
     - abatible del aéreo (puerta superior o inferior): 2 bisagras y 1 pistón;
     - "Puerta falsa": nada.
   - **Frente de cajón:** 1 par de correderas, full extensión u oculta según lo elegido en Configuración de módulos.
   - **Manija:** solo donde no hay gola ni pestaña. Los bajos abren con la gola y los aéreos con la pestaña de la puerta. Con aéreos "al ras" (sin pestaña) cada puerta del aéreo lleva una manija.
   - **Zócalo en aluminio:** perfil por metro y 4 patas plásticas por cada mueble base (la tira de melamina del zócalo deja de salir en el listado).
   - **Platillero, condimentero, basurera y esquina mágica:** 1 de cada uno si la casilla está marcada; van una vez, en el grupo "Zócalo, rellenos y mesón".
   - **Entrepaño:** 4 soportes.
   - **Tubo de closet y perfil gola de aluminio:** por metro.
4. **Mesón.** Metros lineales de la losa más las cascadas (su alto) × precio por metro.
5. **Corte.** Láminas usadas × precio de corte, repartido entre los módulos según su material.
6. **Mano de obra.** Fabricación + instalación según el tipo de módulo.

Costo del módulo = lámina + canto + herrajes + mesón + corte + fabricación + instalación. Lo que no es un módulo (zócalo, rellenos, mesón, o el cuerpo de un closet) va en un grupo aparte: "Zócalo, rellenos y mesón" en cocinas, o el nombre del producto.

## Ganancia y precio

**La ganancia es un porcentaje del precio de venta**, no un recargo sobre el costo:

```
precio = costo ÷ (1 − ganancia)
```

| Costo | Ganancia | Precio | Se gana |
|---|---|---|---|
| 100 | 20 % | 125 | 25 (el 20 % de 125) |
| 100 | +20 % sobre el costo (forma vieja) | 120 | 20 (solo el 16,7 % de 120) |

La pantalla muestra las dos cosas, por ejemplo: "Ganas el 20 % de lo que cobras (equivale a +25 % sobre el costo)". Una tabla guardada con el recargo viejo (`margen`) se pasa sola a la ganancia equivalente (`ganancia = margen ÷ (1 + margen)`), así los precios no cambian. La ganancia se limita a 0 – 95 %.

El precio total se redondea hacia arriba al múltiplo de la tabla (1.000 por defecto).

## Pestaña Costeo

- *Nos cuesta*, *Precio de venta* y *Ganancia*, con la ganancia editable ahí mismo.
- Barra con el reparto del costo: lámina, canto, herrajes, mesón, corte, fabricación, instalación.
- Láminas reales por material: precio usado, láminas, aprovechamiento y costo.
- **Costo por metro lineal y m²:**
  - bajos (MB) y aéreos (MA) por metro lineal; a los bajos se les suman el zócalo y los rellenos;
  - mesón por metro lineal;
  - muebles altos por unidad;
  - en productos sin módulos de cocina (closets…), el m² de frente: ancho × alto de todo el mueble.

  Sirve para dar un precio rápido de un mueble parecido antes de diseñarlo.
- Por módulo: costo y precio. Al tocar uno se ven sus piezas, con su costo de lámina y de canto, y sus herrajes.

Para costear, el diseño tiene que estar convertido a módulos: el costo sale de sus piezas reales.

## Cotización

- Cliente y proyecto salen del producto abierto (Proyectos) y se pueden cambiar, igual que el producto, la descripción y la cantidad.
- Detalle para el cliente:
  - **Mueble completo**: un renglón;
  - **Por módulo**: un renglón por módulo. El precio redondeado se reparte entre los módulos según su precio, de a 100, y el último absorbe la diferencia, así los renglones suman exactamente el total.
- Lleva:
  - número (fecha y hora), fecha y vigencia;
  - total;
  - forma de pago con el % de anticipo y el saldo calculado por resta;
  - condiciones de la empresa;
  - firmas.
- **Nunca muestra costos.**
- HTML maquetado para pantalla e impresión A4 (`@page`, colores exactos, filas y totales sin partirse entre hojas).
- Botones:
  - *Descargar*;
  - *Imprimir o PDF*;
  - *Guardar en el proyecto*: aparece si el diseño es un producto de un proyecto, y queda en sus documentos como "Cotización".
- La idea viene de Worky: el cliente ve el mismo documento que se imprime, las condiciones viven en el perfil y la forma de pago se escribe en porcentaje.

## Pendiente

- **Fase 1, falta:**
  - imagen del diseño (render) en la cotización;
  - ganancia distinta por módulo o por producto;
  - opciones de acabado con su precio en la misma cotización (por ejemplo "Duragloss +25 %");
  - costear varios productos de un proyecto juntos;
  - retazos que se descuenten del costo.
- **Fase 2, proveedores:**
  - catálogo maestro de insumos con códigos (lámina por marca, color, calibre, RH y tamaño; canto; herrajes; servicios);
  - cuentas de proveedor que publican su lista de precios;
  - el carpintero pide costear con un proveedor y este lo aprueba, con su lista general o un precio especial;
  - la tabla del carpintero puede enlazar cada renglón a un proveedor (se actualiza solo y avisa cuánto cambian las cotizaciones abiertas) o dejarlo propio;
  - una cotización enviada congela sus precios.
- **Fase 3:**
  - el cliente acepta la cotización en línea y eso aprueba el diseño;
  - el pedido de corte va directo al proveedor;
  - comparar proveedores e historial de precios.
