
export type ModuleType = 'UPPER' | 'LOWER' | 'TALL' | 'APPLIANCE';
export type LayoutType = 'STRAIGHT' | 'L_SHAPE' | 'U_SHAPE';
export type WallName = 'A' | 'B' | 'C';
export type ApplianceType = 'fridge' | 'stove' | 'sink' | 'hood-under' | 'hood-island' | 'pantry';
export type UnitType = 'mm' | 'cm' | 'm';
export type DoorType = 'vertical' | 'horizontal';
export type ConfigType = 'doors' | 'drawers' | 'u-drawer' | 'internal-drawer';

export interface ModuleTemplate {
  id: string;
  name: string;
  type: ModuleType;
  width: number;
  height: number;
  depth: number;
  basePrice: number;
  isHood?: boolean;
  isFridgeCabinet?: boolean;
  isStoveCabinet?: boolean;
  isSinkCabinet?: boolean;
}

export interface KitchenModule extends ModuleTemplate {
  uniqueId: string;
  wall: WallName | 'Island';
  positionX: number;
  quantity: number;
  label?: string;
  doorType: DoorType;
  configType: ConfigType;
  hasPlateRack: boolean;
  drawerCount: number;
  // Vistos: pieza lateral (15 o 19 mm) que cierra el costado del módulo que queda sin muro. Izquierda/derecha se ven
  // desde el frente del módulo. La pieza queda dentro de la medida del módulo (el cuerpo se acorta ese espesor).
  depthOffset?: number; // distancia (mm) del muro a la cara trasera del módulo: módulos partidos en frente y fondo
  // Convertir a módulos: el cubo pasa a ser un módulo con sus puertas o frentes de cajón (reglas del generador de Fusion)
  detailed?: boolean;
  frontsLayout?: 'open' | 'door1' | 'door2' | 'drawers' | 'upper-door1' | 'upper-door2-v' | 'upper-door2-h' | 'hood' | 'hood-h';
  // Esquinero en L: dos módulos unidos en uno. El módulo conserva su tramo a lo largo del muro A y `cornerArm` es el brazo que sigue
  // por el muro B o C (empieza tras la esquina ciega, CORNER_BLIND_OFFSET)
  cornerArm?: { wall: 'B' | 'C'; width: number; depth: number; positionX: number };
  islandId?: string; // módulos de una isla o península (wall = 'Island'): la isla a la que pertenecen; positionX va a lo largo de su largo
  vistoLeft?: boolean;
  vistoRight?: boolean;
  vistoThickness?: number;
  // Dilatada: pieza lateral que tapa la holgura contra un muro irregular. Izquierda/derecha vistas desde el frente. Como el
  // visto, queda dentro de la medida del módulo (el ancho del módulo ya viene restado). Fondo medido desde el frente del
  // módulo; la altura sugerida es la del módulo (sin valor = la del módulo).
  dilatLeft?: boolean;
  dilatRight?: boolean;
  dilatThickness?: number;
  dilatDepth?: number;
  dilatHeight?: number;
  topGap?: number; // aéreos: separación (mm) entre su borde superior y el techo (0: cuelgan del techo)
  heightLocked?: boolean; // el usuario fijó el alto a mano: no se recalcula al cambiar el muro o el zócalo
  // Coordenadas 3D en el espacio (milímetros)
  x3d?: number;  // Posición X en el espacio 3D
  y3d?: number;  // Posición Y en el espacio 3D (profundidad)
  z3d?: number;  // Posición Z en el espacio 3D (altura)
  // Dimensiones 3D del módulo (milímetros)
  width3d?: number;   // Ancho del módulo en el espacio 3D
  height3d?: number;  // Alto del módulo en el espacio 3D
  depth3d?: number;   // Profundidad del módulo en el espacio 3D
  // Rotación en el espacio (en grados)
  rotation3d?: number; // 0° para muro A, 90° para muro B, -90° para muro C
}

/** Columna o muro atravesado del espacio: pegado a un muro, de la misma altura del techo. La modulación lo respeta */
export interface ColumnItem {
  id: string;
  wall: 'A' | 'B' | 'C';
  distance: number;  // mm desde la esquina interior (punto 0 del muro) hasta el inicio de la columna, a lo largo del muro
  width: number;     // mm a lo largo del muro
  depth: number;     // mm hacia adentro del cuarto
}

/** Closet: base y zócalo. Los lados (muro o costado) se deducen del Espacio */
export interface ClosetConfig {
  bottomFrame: boolean;       // marco inferior: la base acostada (550 de fondo) sobre el piso o sobre el zócalo. Con zócalo y sin marco inferior queda el tipo T
  cajoneroPos: 'left' | 'center' | 'right'; // dónde va el cajonero (se sugiere según el espacio)
  cajonCount?: number;        // cajones del cajonero; sin valor = los que hagan falta para llegar a la altura del cajonero con frentes de 200 mm como máximo
  maleteroTop?: number;       // altura del tablero del maletero; sin valor = la menor de 1900 mm o (techo - 350)
  cajonFront?: 'parche' | 'embebido'; // frentes de cajón: de parche (adelante de los laterales, por defecto) o embebidos (dentro: ancho interno - 6 mm y el lateral se alarga 15 mm, canto al ras del frente)
  sinLateral?: boolean;       // solo con frentes embebidos y el cajonero junto a un costado del closet: se quita el lateral de ese lado y las correderas se amarran al costado
  lateralesAlMaletero?: boolean; // los laterales del cajonero (de parche o embebido) suben hasta el maletero (hacen de costados de los entrepaños) y la tapa queda entre ellos
  cajoneroDepth?: number;     // fondo del cajonero (tapa y costados de arriba; laterales y entrepaños 20 mm menos); sin valor = 450. Se estira con la flecha al seleccionarlo
  twoCajoneros?: boolean;     // dos cajoneros
  twoPlacement?: 'centro' | 'extremos'; // dos cajoneros: juntos al centro (con dilatada central de 60 mm para el traslape de las puertas) o uno en cada extremo
  cajonero2?: Partial<ClosetConfig>; // medidas propias del segundo cajonero (cajones, ancho, altura, fondo, frentes, entrepaños...); el primero usa los campos de arriba
  torreOn?: boolean;          // torre de entrepaños (columna con laterales, entrepaños y divisiones); solo con un cajonero
  torrePos?: 'left' | 'center' | 'right'; // dónde va la torre (como el cajonero); por defecto a la izquierda
  torreWidth?: number;        // ancho de la torre; sin valor = el sugerido del cajonero
  torreToCeiling?: boolean;   // hasta el techo (atraviesa el maletero) en vez de hasta el maletero
  torreShelves?: number;      // entrepaños por columna; sin valor = los que dejen huecos de ~330 mm
  torreDivisions?: number;    // divisiones verticales (columnas iguales); 0 por defecto
  torreSinLateral?: boolean;  // torre junto a un costado del closet (lado sin muro): se quita su lateral de ese lado y los entrepaños llegan al costado
  torreDepth?: number;        // fondo de la torre (laterales 20 mm menos; entrepaños y divisiones 20 mm menos que los laterales)
  torre2On?: boolean;         // otra torre de entrepaños en el extremo opuesto a la primera
  torre2?: Partial<ClosetConfig>; // medidas propias de la segunda torre (torreWidth, torreToCeiling, torreShelves, torreDivisions, torreDepth)
  cajoneroX?: number;         // posición libre del cajonero: distancia (mm) desde la cara izquierda del closet hasta su borde izquierdo; sin valor = izquierda / centro / derecha
  sheetSplit?: number;        // piezas largas (maletero, marcos, tapa de riel, base, zócalo) de más de 2400 mm: largo de la primera lámina; la segunda es lo que falta (lo que se suma a una se resta a la otra)
  doorType?: 'corredizas' | 'abatibles'; // puertas corredizas (por defecto) o abatibles de parche
  doorEdges?: Array<{ hinge?: 'izq' | 'der'; type?: 'costado' | 'marco' }>; // abatibles: por puerta, de qué lado va la bisagra (ahí lleva su propio costado o marco; el otro lado queda libre) y de qué tipo es
  doorGap?: number;           // abatibles: luz entre puertas (2 mm)
  doorCover?: number;         // abatibles de parche: cuánto cubre la puerta de su costado o marco al inicio y al cierre (13 mm)
  narizEntrepanos?: boolean;  // entrepaños (del cajonero y de la torre) con nariz: tira al frente de 15 mm de espesor; sin nariz por defecto
  narizMaletero?: boolean;    // maletero con nariz: el tablero llega a 470 mm de fondo con la nariz
  narizAlto?: number;         // alto de la nariz (sugerido 40 mm)
  dilatacion?: boolean;       // dilatación de 15 x 15 de piso a techo junto al muro (activa por defecto)
  shelvesOn?: boolean;        // sección de entrepaños (costados y entrepaños sobre el cajonero): activa por defecto
  costadoDepth?: number;      // fondo del costado piso-techo; la base toma el mismo fondo (sin valor = 550)
  costadoLeft?: boolean;      // costado izquierdo de los entrepaños: lleva (por defecto) o no; sin costado los entrepaños se alargan
  costadoRight?: boolean;     // ídem a la derecha
  sideCostado?: boolean;      // cajonero a un extremo: el costado de los entrepaños junto al lado del closet lleva (true, por defecto) o desaparece y los entrepaños se alargan
  shelfCount?: number;        // entrepaños sobre el cajonero, repartidos en el espacio hasta el maletero; sin valor = los sugeridos (a ~330 mm como máximo)
  cajoneroTop?: number;       // altura de la cara de arriba del cajonero medida desde el piso; sin valor = 800 (sugerido)
  cajoneroWidth?: number;     // ancho del cajonero; sin valor = el sugerido (ancho de la puerta - 200)
  doorCount?: number;         // puertas corredizas; sin valor = la sugerida (3 si el cajonero va al centro, 2 si va a un lado)
  overlap: number;            // traslape entre puertas corredizas (25)
  doorHeight?: number;        // alto de las puertas; sin valor = el sugerido (espacio libre - 20)
  tapaRiel: boolean;          // la tapa de riel (siempre va parada adelante del marco): activada o desactivada
  tapaRielHeight: number;     // altura de la tapa de riel (110 sugerido)
}

export const DEFAULT_CLOSET: ClosetConfig = { bottomFrame: true, cajoneroPos: 'center', overlap: 25, tapaRiel: true, tapaRielHeight: 110 };

export interface Appliance {
  type: ApplianceType;
  wall: WallName | 'Island';
  width: number;
  height: number;
  depth: number;
  distance: number;
  active: boolean;
  faucetHeight?: number; // Specific for sinks
  space?: number;        // nevera: ancho del espacio que se le deja (el hueco entre muebles); sin valor = ancho de la nevera + 5 cm por lado
}

export interface Material {
  id: string;
  name: string;
  type: 'structure' | 'facade' | 'back';
  thickness: number;
  pricePerSheet: number;
  color: string;
  sheetWidth: number;
  sheetHeight: number;
}

export interface Hardware {
  id: string;
  name: string;
  price: number;
  unit: string;
}

export interface SuggestionItem {
  moduleId: string;
  quantity: number;
  section: 'Pared A' | 'Pared B' | 'Pared C' | 'Isla';
  configType?: ConfigType;
  hasPlateRack?: boolean;
  isHood?: boolean;
  isFridgeCabinet?: boolean;
  isStoveCabinet?: boolean;
}

export interface SuggestionResponse {
  items: SuggestionItem[];
  explanation: string;
  totalWidthUsed: number;
}

export interface QuoteSummary {
  materialCost: number;
  hardwareCost: number;
  laborCost: number;
  installationCost: number;
  subtotal: number;
  margin: number;
  total: number;
  hardwareList: { name: string; qty: number; cost: number }[];
}

export interface BOMPiece {
  item: number;
  name: string;           // PARTE: "Lateral MB-01", "Espaldar MA-02", etc
  quantity: number;       // C/D: cantidad de piezas idénticas
  length: number;         // LAR: largo en mm
  width: number;          // AN: ancho en mm
  thickness: number;      // CAL: calibre/espesor en mm
  color: string;          // COLOR: "Blanco", "Ámbar", "Blanco RH"
  edgeType: string;       // CANTO: "1L", "2L", "4LR", "1L 2L", etc
}

export interface BOM {
  pieces: BOMPiece[];
  totalPieces: number;
  generatedAt: string;
  kitchenConfig: {
    wallWidth: number;
    lineType: string;
    faceColor: string;
  };
}

/** Isla o península: medida general (largo x ancho) y su esquina superior izquierda a (dx, dy) del punto 0 */
/** Alistonado: listones verticales (ancho x espesor) repartidos parejos con la separación pedida; con fondo de 6 o 15 detrás, o sin fondo (0) */
export interface Liston { ancho: number; esp: number; sep: number; fondo?: 0 | 6 | 15 }

export interface IslandItem {
  id: string;
  kind: 'isla' | 'peninsula';
  length: number; // mm, a lo largo del muro A
  width: number;  // mm, hacia el frente
  dx: number;     // mm desde el punto 0 (esquina interior superior izquierda) a lo largo del muro A
  dy: number;     // mm desde el punto 0 hacia el frente
  stove?: { distance: number };  // lleva estufa: distancia (mm) desde el punto 0 de la isla (su extremo izquierdo) al inicio del mueble
  sink?: { distance: number };   // lleva poceta / fregadero: igual
  campana?: boolean;  // campana de isla sobre la estufa (colgada del techo con su chimenea); solo si lleva estufa
  alistonado?: Liston; // espaldar de la isla o península (parte posterior de los módulos; el frente es el de las puertas) forrado con listones, del piso al mesón
  bar?: number;   // barra: voladizo del mesón por el frente (mm); los módulos miden ancho - barra de fondo y el zócalo retrocede la barra
}

/** Closet fit (closet personalizado): un cubo que cubre el área y se arma por cuerpos (inferiores y superiores), paso a paso */
/** Configuración de un cuerpo del Closet fit (doble clic): marco puerta o surrón, con sus puertas, entrepaños y cajones */
export interface FitBodyCfg {
  kind: 'marco' | 'surron' | 'alistonado';
  liston?: Liston; // espaldar alistonado: listones verticales del alto del cubo (ancho 65, espesor 15) repartidos con la separación pedida
  zocalo?: boolean;                       // zócalo de 80 abajo (si el cuerpo va al piso)
  ladoIzq?: 'ninguno' | 'dilatada' | 'visto15' | 'visto19'; // lado izquierdo del módulo: dilatada (15 x 70) o visto (15 / 19); restan ancho al módulo
  ladoDer?: 'ninguno' | 'dilatada' | 'visto15' | 'visto19'; // lado derecho
  base?: 'base' | 'puentes';              // surrón: base completa o puentes inferiores
  top?: 'tapa' | 'puente' | 'puenteL';    // surrón: arriba va tapa, puente o puente en L (dos piezas de 65: una vertical y otra horizontal)
  doors?: number;                         // cantidad de puertas de parche (0 = sin puertas)
  doorType?: 'parche' | 'corredizas';     // marco puerta: puertas de parche (por defecto) o corredizas en dos rieles
  doorDir?: 'vertical' | 'horizontal';    // vertical = una a la izquierda y otra a la derecha; horizontal = una sobre otra
  hinge?: 'izq' | 'der';                  // con una sola puerta vertical: de qué lado está la bisagra (por defecto izquierda)
  aberturas?: Record<string, 'izq' | 'der' | 'sup'>; // abertura de cada puerta (índice) cambiada con un clic: bisagra izquierda, derecha o arriba; sin valor = la simétrica por defecto
  vertMedio?: boolean;                    // pieza vertical entre las puertas (en medio de la puerta derecha y la izquierda); por defecto no lleva
  divider?: 'puentes' | 'costado';        // con más de 3 puertas: pieza vertical entre base y tapa (dos puentes verticales pegados, o puente + costado)
  shelves?: number;                       // entrepaños (fondo = fondo del módulo − 70)
  maletero?: number;                      // marco puerta: distancia desde la parte superior del cuerpo hacia abajo hasta la cara de arriba del maletero (mm); sin valor = sin maletero
  tubes?: 'camisero' | 'pantalonero' | 'ambos'; // marco puerta: tubos para colgar (camisero 40 mm bajo el maletero, pantalonero a 900 mm del piso)
  drawers?: number;                       // cajones (0 = sin cajones)
  drawerKind?: 'manija' | 'puenteL';      // manija: 2 mm entre frentes; puente en L: 30 mm
}
export interface ClosetFit {
  altoMueble?: number;    // baño: alto de los cuerpos (el cubo mide el espacio al piso + este alto)
  cellW?: Record<string, number>; // ancho propio de un cuerpo (clave = id) cuando es menor que el de su columna; sin valor = el ancho de la columna
  pieceAdj?: Record<string, { sx?: number; sy?: number; sz?: number }>; // ajuste manual de una pieza del módulo aislado (clave = id de la pieza): solo cambia esa pieza
  cellX?: Record<string, number>; // desplazamiento horizontal de un cuerpo movido con su flecha (clave = id de la celda): se desune de sus vecinos
  gaps?: Record<string, boolean>; // partes de un cuerpo dividido que se eliminaron: quedan como espacio libre (clave = id-sN)
  subs?: Record<string, number[]>; // un cuerpo dividido en varios lado a lado, solo él (clave = id del cuerpo; valores = anchos en mm); sus partes se llaman id-s0, id-s1...
  cellD?: Record<string, number>; // fondo propio de un cuerpo (clave = id); sin valor = el fondo general
  sobreMueble?: number;   // baño: cuerpos que se activan encima del mueble (0 = un espacio libre); el de abajo mide 200, el siguiente 700 y el de arriba lo que sobre
  flotado?: { on: boolean; alto: number }; // baño: mueble flotado; alto = espacio del mueble al piso (mm)
  mueble?: { x0: number; ancho: number }; // baño: posición del mueble medida desde el punto 0 (esquina izquierda del muro) y su ancho propio, sin depender de la medida del muro
  sanitario?: { on: boolean; x0: number; ancho: number }; // baño: x0 = distancia del muro auxiliar (o del extremo izquierdo del muro A si no hay) al lado del sanitario que mira a ese muro; ancho = ancho del sanitario (mm)
  tv?: { on: boolean; pulgadas: number; ancho: number; alto: number; desde: number }; // centro de entretenimiento: televisor de ambientación (no es pieza del mueble); desde = altura de su borde de abajo
  espejo?: { on: boolean; alto: number; ancho: number; desde: number }; // baño: espejo sobre el mueble; desde = altura desde el piso a su borde de abajo (mm)
  unirZocalos?: boolean;  // une los zócalos: los de los muros B y C se alargan hasta tocar el zócalo transversal del muro A (por defecto sí)
  cubes?: { A?: boolean; B?: boolean; C?: boolean }; // cubos activos por muro (por defecto los tres; B y C solo si el espacio tiene esos muros)
  armB?: ClosetFit;       // cubo del muro B (se gira desde el marco del muro A): fondo, cuerpos, zócalo...
  armC?: ClosetFit;       // cubo del muro C
  zocalo?: { on: boolean; alto: number; fondo: number; travesanos: number }; // zócalo del cubo: subensamble en forma de escalera (largueros delante y detrás con travesaños)
  bodies?: Record<string, FitBodyCfg>;    // configuración por cuerpo (clave = id del cuerpo, p. ej. fit-inf-0-0)
  converted?: boolean;                    // "Convertir a módulos": las placas representativas pasan a ser las piezas reales
  depth: number;          // fondo del cubo (mm)
  lowerBodies: number;    // cuerpos inferiores, uno al lado del otro
  upperBodies: number;    // cuerpos superiores (0 = ninguno)
  upperHeight: number;    // alto de los cuerpos superiores (mm)
  dilatacion?: boolean;   // dilatación de 15 x 15 de piso a techo junto al muro (activa por defecto)
  leftWall?: boolean;     // (se deduce del Espacio) hay muro a la izquierda
  rightWall?: boolean;    // (se deduce del Espacio) hay muro a la derecha
  lowerW?: number[];      // anchos de los cuerpos inferiores (mm); sin valor = iguales
  upperW?: number[];      // anchos de los cuerpos superiores (mm); sin valor = iguales
  lowerCells?: number[][]; // por cuerpo inferior: alturas de sus celdas de arriba hacia abajo (mm); sin valor = una sola celda
  upperCells?: number[][]; // lo mismo para los cuerpos superiores
}
export const DEFAULT_FIT: ClosetFit = { depth: 550, lowerBodies: 3, upperBodies: 1, upperHeight: 350 };
export const DEFAULT_ARM: ClosetFit = { depth: 550, lowerBodies: 2, upperBodies: 1, upperHeight: 350 };
