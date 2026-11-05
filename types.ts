
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

export interface Appliance {
  type: ApplianceType;
  wall: WallName | 'Island';
  width: number;
  height: number;
  depth: number;
  distance: number;
  active: boolean;
  faucetHeight?: number; // Specific for sinks
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
export interface IslandItem {
  id: string;
  kind: 'isla' | 'peninsula';
  length: number; // mm, a lo largo del muro A
  width: number;  // mm, hacia el frente
  dx: number;     // mm desde el punto 0 (esquina interior superior izquierda) a lo largo del muro A
  dy: number;     // mm desde el punto 0 hacia el frente
  stove?: { distance: number };  // lleva estufa: distancia (mm) desde el punto 0 de la isla (su extremo izquierdo) al inicio del mueble
  sink?: { distance: number };   // lleva poceta / fregadero: igual
  bar?: number;   // barra: voladizo del mesón por el frente (mm); los módulos miden ancho - barra de fondo y el zócalo retrocede la barra
}
