import { KitchenModule, Appliance, LayoutType, WallName, IslandItem, ColumnItem, ClosetConfig, ClosetFit, FitBodyCfg, DEFAULT_ARM } from './types';

/**
 * LISTA ÚNICA DE CAJAS: fuente de verdad de la geometría de la cocina.
 *
 * Sistema de coordenadas (milímetros), igual para la escena 3D, el BOM y la exportación a Fusion:
 *   X: a lo largo del muro A, de izquierda a derecha (visto desde el frente)
 *   Y: profundidad, desde la cara interior del muro A hacia el centro de la cocina
 *   Z: altura desde el piso
 * Origen (0,0,0): esquina inferior izquierda de la cara interior del muro A.
 * Cada caja se define por su esquina mínima (x, y, z) y su tamaño (sx, sy, sz), todo alineado a los ejes.
 */

export type BoxKind = 'wall' | 'zocalo' | 'lower' | 'upper' | 'tall' | 'appliance' | 'counter' | 'filler' | 'front' | 'panel';
/** Ajustes manuales de un tramo de mesón (clave: id de la losa, p. ej. "counter-A-0"). Izquierda/derecha se ven desde el frente.
 *  Sin valor = automático (el salpicadero lateral va donde hay muro o un módulo más alto; la cascada no va). */
/** Canto del mesón: frentero (pieza a 45° con el mesón, con su alto) o reengruese (una pieza pegada por debajo, de ancho x alto) */
export interface CounterEdge {
  kind: 'none' | 'frentero' | 'reengruese';
  sides: { front: boolean; back: boolean; left: boolean; right: boolean }; // izquierda y derecha vistas desde el frente; "back" solo en islas
  height: number; // frentero: alto total desde la cara de arriba del mesón (mm); reengruese: alto de la pieza (mm)
  width: number;  // reengruese: ancho de la pieza hacia adentro (mm)
}

export interface CounterExtras {
  edge?: CounterEdge;
  splashLeft?: boolean;
  splashRight?: boolean;
  waterfallLeft?: boolean;  // cascada: el mesón baja hasta el piso por ese costado
  waterfallRight?: boolean;
  // Isla o península: medida inferior de la cascada (mm): el largo de su canto de abajo (arriba mide el ancho de la isla). Menor = chaflán por el frente
  waterfallBottomLeft?: number;
  waterfallBottomRight?: number;
}
export type BoxFacing = '+Y' | '-Y' | '+X' | '-X' | null; // hacia dónde mira el frente del módulo

/** Abertura rectangular en una caja (mesón): misma convención de coordenadas que las cajas */
export interface Cutout {
  label: string;
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export interface Box {
  id: string;
  name: string;
  kind: BoxKind;
  wall: WallName;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  facing: BoxFacing;
  moduleId?: string;
  applianceType?: string;
  cutouts?: Cutout[]; // aberturas (poceta, estufa) cuando la caja es un mesón
  islandId?: string;  // módulos y piezas de una isla o península (no cuentan como parte de los muros A, B o C)
  // Ingletes a 45° entre el mesón y la cascada (solo se dibujan; las cajas siguen siendo prismas)
  mitreBottom?: Array<'x-' | 'x+' | 'y-' | 'y+'>; // mesón: lados donde el canto de abajo se recorta un espesor
  mitreTop?: 'x-' | 'x+' | 'y-' | 'y+';           // cascada: lado (el del mesón) donde el canto de arriba baja un espesor
  polygon?: Array<[number, number]>; // pieza con cortes a 45° (salpicadero que rodea una columna): contorno en planta (x, y); la caja es su rectángulo envolvente
  notches?: Array<{ a0: number; a1: number; c: number }>; // mesón: muescas contra el muro por las columnas (a lo largo del muro de a0 a a1, c de profundidad)
  face?: Array<[number, number]>; // contorno de la cara de frente (a lo largo del muro, alto) en mm desde la esquina de abajo a la izquierda: pieza con cortes a 45° (tapaluz)
  chamferY?: number;                               // cascada con chaflán: cuánto retrocede el canto de abajo por el frente (mm) respecto al de arriba
}

// Constantes de geometría compartidas por la app, la escena y la exportación
export const WALL_THICKNESS = 150;       // espesor de los muros (mm)
/** Frentes de los módulos convertidos (reglas del generador de Fusion): espesor, luces y alturas */
export const FRONT_THICKNESS = 18;    // espesor de las puertas y frentes de cajón (mm)
export const FRONT_SIDE_GAP = 2;      // luz por lado y entre puertas (mm)
export const FRONT_LOWER_BOTTOM_CUT = 50; // la puerta del bajo es 50 mm más corta que el módulo (deja luz arriba, bajo la gola)
export const FRONT_DRAWER_GAP = 30;   // espacio entre los dos frentes de un cajonero (mm)
export const UPPER_DOOR_TAB = 10;     // pestaña que cuelga bajo el aéreo (agarre sin jaladera)
export const HOOD_DOOR_GAP = 4;       // luz de seguridad de las puertas de la campana sobre su base
export const HOOD_CUT = 85;           // el módulo campana es 85 mm más corto que los aéreos vecinos
/** Piezas del módulo convertido (reglas del generador de Fusion) */
export const PANEL_THICKNESS = 15;    // laterales, base, techo, amarres, golas, entrepaños (mm)
export const PANEL_BACK = 6;          // espaldar y fondo de cajón (mm)
export const TIE_LOWER = 80;          // alto de los amarres traseros del bajo
export const TIE_UPPER = 60;          // alto de los amarres (cuchillas) del aéreo
export const GOLA_WIDTH = 65;         // ancho de la gola (el puente de arriba del bajo)
export const SHELF_Z = 400;           // altura del entrepaño sobre la base del módulo
/** Closet (planos del usuario): fondo del marco base, marcos de 80 x 15, tapa de riel y maletero */
export const CLOSET_DEPTH = 550;        // fondo del closet (marco base)
export const CLOSET_FRAME_WIDTH = 80;   // ancho de los marcos laterales y horizontal
export const CLOSET_RAIL_COVER = 110;   // alto de la tapa de riel
export const CLOSET_MALETERO_DEPTH = 455; // fondo del tablero del maletero
export const CLOSET_MALETERO_MAX = 1900;  // el tablero del maletero no pasa de esta altura...
export const CLOSET_MALETERO_CLEAR = 350; // ...y deja al menos esta medida libre hasta el techo
export const CLOSET_INTERIOR_DEPTH = 450;   // fondo del cajonero y de los entrepaños (los costados interiores son de 450)
export const CLOSET_DRAWER_FRONT_MAX = 200; // los frentes de los cajones no pasan de 200 mm de alto
export const CLOSET_DRAWER_GAP = 30;        // espacio entre frentes de cajón: 30 mm para meter la mano
export const CLOSET_CAJONERO_PUENTE = 70;   // puente amarre al frente del cajonero, sobre la base, para tapar el hueco bajo el cajón de abajo
export const CLOSET_CAJONERO_DIL = 45;      // dilatación del cajonero contra el marco: la tapa se alarga 45 mm y una pieza de 45 tapa el hueco
export const CLOSET_CAJONERO_TOP = 800;     // el cajonero se sugiere con su cara de arriba a 800 mm del piso
export const CLOSET_DRAWER_BOTTOM_GAP = 40; // el cajón de abajo queda 40 mm sobre la cara de arriba de la base
export const CLOSET_SHELF_PITCH = 315;      // separación de los entrepaños sobre el cajonero
export const LOWER_DEPTH = 570;          // fondo módulo base (mm)
export const ISLAND_PLINTH_INSET = 50;   // el zócalo de una isla o península queda 5 cm hacia adentro de su medida general, por cada lado
export const MAX_MODULE_WIDTH = 900;     // ancho máximo de un módulo (mm)
export const SPLASH_HEIGHT_DEFAULT = 70;   // alto del salpicadero (mm)
export const UPPER_DEPTH = 330;          // fondo módulo aéreo (mm)
export const CORNER_BLIND_OFFSET = LOWER_DEPTH; // esquina ciega: el muro B/C arranca tras el fondo del MB del muro A
export const TOP_MARGIN = 20;            // espacio libre bajo el techo (mm) en cocinas
export const CLOSET_TOP_MARGIN = 5;      // en closets se deja 5 mm al techo
// Regla de la nevera: separación mínima entre la nevera y los módulos (base y aéreos) a cada lado, y fondo sugerido de la sobrenevera
export const FRIDGE_CLEARANCE = 50;      // mm
export const OVER_FRIDGE_DEPTH = 500;    // mm (más profundo que los demás aéreos, que miden 330)
// Dilatación: los módulos pegados a un muro dejan una holgura (por los muros descuadrados) que se tapa con una pieza
export const ISLAND_HOOD_GAP = 750;          // campana de isla: altura de su borde inferior sobre el mesón (mm)
export const DILATATION_GAP_DEFAULT = 15;    // holgura contra el muro y espesor de la pieza (mm)
export const DILATATION_DEPTH_DEFAULT = 70;  // fondo de la pieza, medido desde el frente del módulo (mm)
export const CLOSURE_THICKNESS = 120;    // espesor de los muros auxiliares (mm)
export const CLOSURE_DEPTH = 600;        // fondo de los muros auxiliares (mm)

// Mesón (herramienta de mesón). Valores por defecto; el usuario los puede cambiar
export const COUNTER_THICKNESS_DEFAULT = 20;  // espesor del mesón (mm)
export const COUNTER_OVERHANG_DEFAULT = 20;   // voladizo del mesón sobre el frente de los módulos (mm)
const SINK_CUTOUT_MARGIN = 30;                // la abertura de la poceta es 30 mm menor por lado que el equipo
const STOVE_CUTOUT_MARGIN_X = 20;             // abertura de la estufa: 20 mm menos por lado en ancho...
const STOVE_CUTOUT_MARGIN_Y = 5;              // ...y 5 mm menos por lado en fondo

/**
 * Centro en planta (mm) de un electrodoméstico, en el sistema de coordenadas de las cajas.
 * La estufa y la poceta van centradas en el fondo del módulo base.
 */
export function applianceCenter(app: Appliance, wallA: number): { x: number; y: number } {
  const across = (app.type === 'sink' || app.type === 'stove') ? LOWER_DEPTH / 2 : app.depth / 2;
  const along = app.distance + app.width / 2;
  if (app.wall === 'B') return { x: across, y: CORNER_BLIND_OFFSET + along };
  if (app.wall === 'C') return { x: wallA - across, y: CORNER_BLIND_OFFSET + along };
  return { x: along, y: across };
}

/**
 * Hasta dónde llega hacia la esquina el primer aéreo de un brazo (B o C): a la profundidad del aéreo perpendicular, es
 * decir, el aéreo de A que está en esa esquina, para que las esquinas queden unidas. Si en la esquina no hay aéreo
 * de A, usa el fondo estándar de los aéreos. La profundidad de los módulos no cambia: se alarga el primer aéreo del
 * brazo (que arranca tras la esquina ciega, CORNER_BLIND_OFFSET, igual que los bajos) hasta ese punto.
 */
export function armUpperOrigin(modules: KitchenModule[], wallA: number, arm: 'B' | 'C', gap: number): number {
  const atCorner = modules.filter(m => m.wall === 'A' && m.type === 'UPPER'
    && (arm === 'B' ? m.positionX <= gap + 1 : m.positionX + m.width >= wallA - gap - 1));
  return atCorner.length ? Math.max(...atCorner.map(m => m.depth)) : UPPER_DEPTH;
}

import { PuertaCfg, puertaBoxes, muroConVano } from './puertas';
export interface BuildBoxesInput {
  puerta?: PuertaCfg; // sección Puertas: puerta de paso en el vano del muro A
  wallThickness?: number; // espesor del muro (mm); por defecto 150
  layout: LayoutType;
  wallA: number;
  wallB: number;
  wallC: number;
  spaceHeight: number;
  hasZocalo: boolean;
  zocaloHeight: number;
  zocaloDepth: number;
  modules: KitchenModule[];
  appliances: Appliance[];
  corredera?: { tipo: 'full' | 'oculta'; menos10?: boolean; fondo15?: boolean }; // corredera de los cajones (por defecto full extensión)
  aereoAbre?: 'pestana' | 'alras'; // aéreos: la puerta cuelga una pestaña (por defecto) o queda al ras del mueble (sin pestaña)
  calEstructura?: { MA: number; MB: number; otros: number }; // calibre de la estructura (15 o 18) de aéreos, bajos y demás
  laminaLargo?: number; // largo de la lámina del proveedor (por defecto 2400): el puente L corrido no la supera
  costadosCortos?: boolean; // opción del carpintero: puente L corrido entre varios bajos y costados internos 80 mm más cortos (no se les hace la caja)
  hasLeftClosure?: boolean;
  hasRightClosure?: boolean;
  hasDilatation?: boolean;
  dilatationGap?: number;
  dilatationDepth?: number;
  hasCounter?: boolean;
  counterThickness?: number;
  counterOverhang?: number;
  hasSplash?: boolean;   // salpicadero: pieza del mismo material del mesón, atrás y en los lados con muro o módulo más alto
  splashHeight?: number; // alto del salpicadero (por defecto 70 mm)
  counterExtras?: Record<string, CounterExtras>;
  islands?: IslandItem[];
  columns?: ColumnItem[]; // columnas o muros atravesados, pegados a un muro y de la altura del techo
  fit?: ClosetFit;                                  // sección Closet fit: cubo por cuerpos
  closet?: ClosetConfig & { leftWall: boolean; rightWall: boolean }; // sección Closets: base/zócalo y lados (muro o costado) deducidos del Espacio
  lArm?: 'left' | 'right'; // cocina en L: de qué lado está el brazo (izquierda = muro B, derecha = muro C)
}

export function buildBoxes(input: BuildBoxesInput): Box[] {
  const { layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth, modules, appliances } = input;
  const hasCounter = input.hasCounter ?? false;
  const counterThickness = input.counterThickness ?? COUNTER_THICKNESS_DEFAULT;
  const counterOverhang = input.counterOverhang ?? COUNTER_OVERHANG_DEFAULT;
  const hasSplash = input.hasSplash ?? false;
  const splashHeight = input.splashHeight ?? SPLASH_HEIGHT_DEFAULT;
  const T = input.wallThickness ?? WALL_THICKNESS;
  const closet = input.closet;
  // En el closet la base la define su configuración: zócalo (tipo T o base completa), marco inferior acostado (15) o nada
  const zh = closet ? (hasZocalo ? zocaloHeight + PANEL_THICKNESS : closet.bottomFrame ? PANEL_THICKNESS : 0) : (hasZocalo ? zocaloHeight : 0);
  const boxes: Box[] = [];
  // mesón con nariz: algún tramo lleva canto (frentero o reengruese)
  const conNariz = hasCounter && Object.values(input.counterExtras ?? {}).some(e => !!e?.edge && e.edge.kind !== 'none');
  // En L el brazo es el muro B (izquierda) o el muro C (derecha); en U están los dos
  const hasB = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && input.lArm !== 'right');
  const hasC = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && input.lArm === 'right');

  // --- Muros ---
  if (input.puerta) muroConVano(input.puerta, wallA, T, spaceHeight).forEach(b => boxes.push(b)); // puerta: el muro A lleva el hueco del vano
  else boxes.push({ id: 'wall-A', name: 'Muro A', kind: 'wall', wall: 'A', x: 0, y: -T, z: 0, sx: wallA, sy: T, sz: spaceHeight, facing: null });
  if (hasB) {
    boxes.push({ id: 'wall-B', name: 'Muro B', kind: 'wall', wall: 'B', x: -T, y: -T, z: 0, sx: T, sy: wallB + T, sz: spaceHeight, facing: null });
  }
  if (hasC) {
    boxes.push({ id: 'wall-C', name: 'Muro C', kind: 'wall', wall: 'C', x: wallA, y: -T, z: 0, sx: T, sy: wallC + T, sz: spaceHeight, facing: null });
  }

  // --- Columnas o muros atravesados: pegados al muro A, B o C, de la altura del techo ---
  (input.columns ?? []).forEach(c => {
    if (c.wall === 'B' ? !hasB : c.wall === 'C' ? !hasC : false) return;
    const armLen = c.wall === 'A' ? wallA : c.wall === 'B' ? wallB : wallC;
    const w = Math.max(0, Math.min(c.width, armLen - c.distance)), d = Math.max(0, c.depth);
    if (w <= 0 || d <= 0) return;
    const pos = c.wall === 'A' ? { x: c.distance, y: 0, sx: w, sy: d }
      : c.wall === 'B' ? { x: 0, y: c.distance, sx: d, sy: w }
        : { x: wallA - d, y: c.distance, sx: d, sy: w };
    boxes.push({ id: `column-${c.id}`, name: 'Columna', kind: 'wall', wall: c.wall, ...pos, z: 0, sz: spaceHeight, facing: null });
  });

  // --- Muros auxiliares: cierran el extremo libre de cada brazo de la cocina ---
  //   Recta: izquierdo = extremo izquierdo de A; derecho = extremo derecho de A.
  //   En L: izquierdo = extremo del brazo B (el brazo está a la izquierda); derecho = extremo derecho de A.
  //   En U: izquierdo = extremo del brazo B; derecho = extremo del brazo C.
  // Cada uno se prolonga sobre el espesor del muro con el que se une, así las esquinas quedan cerradas y alineadas.
  const CT = CLOSURE_THICKNESS;
  const CD = CLOSURE_DEPTH;
  if (input.hasLeftClosure) {
    const c = !hasB
      ? { x: -CT, y: -T, sx: CT, sy: CD + T }      // junto al extremo izquierdo de A, hasta la cara exterior de A
      : { x: -T, y: wallB, sx: T + CD, sy: CT };   // al final del brazo B, desde la cara exterior de B
    boxes.push({ id: 'closure-left', name: 'Muro auxiliar izquierdo', kind: 'wall', wall: !hasB ? 'A' : 'B', ...c, z: 0, sz: spaceHeight, facing: null });
  }
  if (input.hasRightClosure) {
    const c = hasC
      ? { x: wallA - CD, y: wallC, sx: CD + T, sy: CT }   // al final del brazo C, hasta la cara exterior de C
      : { x: wallA, y: -T, sx: CT, sy: CD + T };          // junto al extremo derecho de A, hasta la cara exterior de A
    boxes.push({ id: 'closure-right', name: 'Muro auxiliar derecho', kind: 'wall', wall: hasC ? 'C' : 'A', ...c, z: 0, sz: spaceHeight, facing: null });
  }

  // --- Zócalo ---
  // Va solo bajo los módulos: se abre un hueco donde está la nevera (su ancho más FRIDGE_CLEARANCE por lado,
  // igual que la separación de los módulos base), porque la nevera se apoya directamente en el piso.
  if (hasZocalo && zh > 0 && !closet) {
    // Recorta de [start, end] (a lo largo del muro) los huecos de las neveras activas de ese muro
    const plinthSegments = (wall: WallName, start: number, end: number): Array<[number, number]> => {
      const armStart = wall === 'A' ? 0 : CORNER_BLIND_OFFSET;
      // hueco de la nevera: su espacio (si se dio) o su ancho más FRIDGE_CLEARANCE por lado, centrado en ella
      // el lavavajillas también se apoya en el piso: su hueco es su propio ancho (ya trae su holgura)
      const holes = appliances
        .filter(a => a.active && (a.type === 'fridge' || a.type === 'dishwasher') && a.wall === wall)
        .map(a => { const hueco = a.type === 'dishwasher' ? a.width : Math.max(a.space ?? 0, a.width + 2 * FRIDGE_CLEARANCE), h0 = armStart + a.distance - (hueco - a.width) / 2; return [h0, h0 + hueco] as [number, number]; })
        .sort((x, y) => x[0] - y[0]);
      // regla del carpintero: el zócalo nunca es más largo que los muebles; en el lado libre (junto a la nevera) queda 5 cm más corto
      const LIBRE = 50;
      const segments: Array<[number, number]> = [];
      let cursor = start;
      // el lado libre se mide desde el mueble bajo más cercano al hueco (no desde el hueco: entre los dos puede quedar la holgura)
      const bajos = modules.filter(m => m.wall === wall && m.type === 'LOWER').map(m => [armStart + m.positionX, armStart + m.positionX + m.width] as [number, number]);
      holes.forEach(([h0, h1]) => {
        // último bajo que empieza antes del hueco y primer bajo que termina después de él
        const finAntes = Math.max(-Infinity, ...bajos.filter(([b0]) => b0 < h0).map(([, b1]) => b1));
        if (h0 > cursor) segments.push([cursor, Math.min((isFinite(finAntes) ? finAntes : h0) - LIBRE, end)]);
        const iniDespues = Math.min(Infinity, ...bajos.filter(([, b1]) => b1 > h1).map(([b0]) => b0));
        cursor = Math.max(cursor, (isFinite(iniDespues) ? iniDespues : h1) + LIBRE);
      });
      if (cursor < end) segments.push([cursor, end]);
      return segments.filter(([x0, x1]) => x1 - x0 > 1);
    };

    // Zócalo de cada isla o península: misma altura que el de la cocina, con el perímetro 5 cm más pequeño que su medida general
    (input.islands ?? []).forEach(isl => {
      const inset = ISLAND_PLINTH_INSET;
      // La península está pegada al muro perpendicular: ese costado no se retrae
      const wallSide = isl.kind === 'peninsula' ? inset : 0;
      const bar = isl.bar ?? 0;
      const frontRetreat = bar > 0 ? bar : inset; // el zócalo retrocede la barra por el frente
      if (isl.length - 2 * inset + wallSide < 50 || isl.width - inset - frontRetreat < 50) return;
      boxes.push({
        id: `zocalo-isla-${isl.id}`, name: `Zócalo ${isl.kind === 'peninsula' ? 'península' : 'isla'}`, kind: 'zocalo', wall: 'A',
        x: isl.dx + inset - (input.lArm === 'right' ? 0 : wallSide), y: isl.dy + inset, z: 0, sx: isl.length - 2 * inset + wallSide, sy: isl.width - inset - frontRetreat, sz: zh, facing: null,
      });
    });

    const yStart = Math.min(zocaloDepth, CORNER_BLIND_OFFSET);
    plinthSegments('A', 0, wallA).forEach(([x0, x1], i) => {
      boxes.push({ id: `zocalo-A-${i}`, name: 'Zócalo A', kind: 'zocalo', wall: 'A', x: x0, y: 0, z: 0, sx: x1 - x0, sy: zocaloDepth, sz: zh, facing: null });
    });
    // Con una península pegada al brazo, el zócalo de la cocina llega hasta ella y ahí lo toma el de la península: el tramo del
    // brazo que queda más allá de la península no lleva zócalo
    const peninsula = (input.islands ?? []).filter(i => i.kind === 'peninsula').sort((p, q) => p.dy - q.dy)[0];
    const armEnd = (wall: 'B' | 'C') => {
      const full = wall === 'B' ? wallB : wallC;
      const onThisArm = wall === (input.lArm === 'right' ? 'C' : 'B');
      return peninsula && onThisArm ? Math.min(full, peninsula.dy + ISLAND_PLINTH_INSET) : full;
    };
    if (hasB) {
      plinthSegments('B', yStart, armEnd('B')).forEach(([y0, y1], i) => {
        boxes.push({ id: `zocalo-B-${i}`, name: 'Zócalo B', kind: 'zocalo', wall: 'B', x: 0, y: y0, z: 0, sx: zocaloDepth, sy: y1 - y0, sz: zh, facing: null });
      });
    }
    if (hasC) {
      plinthSegments('C', yStart, armEnd('C')).forEach(([y0, y1], i) => {
        boxes.push({ id: `zocalo-C-${i}`, name: 'Zócalo C', kind: 'zocalo', wall: 'C', x: wallA - zocaloDepth, y: y0, z: 0, sx: zocaloDepth, sy: y1 - y0, sz: zh, facing: null });
      });
    }
  }

  // Los brazos se cuentan desde la esquina ciega para todos los niveles, así los cortes de los aéreos y de los bajos
  // quedan alineados. El primer aéreo del brazo se alarga hacia la esquina con una posición negativa (ver armUpperOrigin).
  const armOrigin = (wall: WallName, _isUpper: boolean) => (wall === 'A' ? 0 : CORNER_BLIND_OFFSET);

  // Coloca una caja contra el muro indicado: "along" es la posición a lo largo del muro (desde el inicio de ese brazo)
  // y "width" su ancho en ese sentido
  // across: distancia del muro a la cara trasera (módulos partidos en frente y fondo)
  const placeOnWall = (wall: WallName, along: number, width: number, depth: number, origin: number = CORNER_BLIND_OFFSET, across: number = 0) => {
    if (wall === 'B') return { x: across, y: origin + along, sx: depth, sy: width, facing: '+X' as BoxFacing };
    if (wall === 'C') return { x: wallA - depth - across, y: origin + along, sx: depth, sy: width, facing: '-X' as BoxFacing };
    return { x: along, y: across, sx: width, sy: depth, facing: '+Y' as BoxFacing };
  };

  // --- Puente L corrido (opción "costados cortos"): un solo puente en L por cada tramo de bajos pegados, de lateral extremo a lateral extremo ---
  // junto: para cada bajo de un puente corrido, si comparte el puente con el vecino de inicio / de fin (ahí el costado va más corto)
  const junto = new Map<string, { inicio: boolean; fin: boolean }>();
  const laminaGola = input.laminaLargo ?? 2400;
  if (input.costadosCortos) {
    (['A', 'B', 'C'] as WallName[]).forEach(w => {
      const bajos = modules.filter(m => m.wall === w && m.type === 'LOWER' && m.detailed && !!m.frontsLayout && !m.cornerArm && m.depth >= 60).sort((a, b) => a.positionX - b.positionX);
      const tramos: KitchenModule[][] = [];
      bajos.forEach(m => { const t = tramos[tramos.length - 1]; const u = t?.[t.length - 1]; if (u && Math.abs(u.positionX + u.width - m.positionX) < 2) t.push(m); else tramos.push([m]); });
      // Cocina en L o U: en el rincón el puente llega hasta la cara exterior (un espesor más largo) para que se encuentren las dos L del rincón y tapen los huecos
      const E0 = PANEL_THICKNESS;
      const hayBajosEn = (o: WallName) => modules.some(m => m.wall === o && m.type === 'LOWER');
      const rinconIni = (m: KitchenModule) => (w === 'A' ? hasB && hayBajosEn('B') && m.positionX < 250 : (w === 'B' ? hasB : hasC) && hayBajosEn('A') && m.positionX < 250);
      const rinconFin = (m: KitchenModule) => w === 'A' && hasC && hayBajosEn('C') && m.positionX + m.width > wallA - 250;
      const primeros = new Set(tramos.map(t => t[0].uniqueId)), ultimos = new Set(tramos.map(t => t[t.length - 1].uniqueId));
      const extremos = (s: KitchenModule[]) => {
        const a = s[0], z = s[s.length - 1];
        return { ini: a.positionX + (primeros.has(a.uniqueId) && rinconIni(a) ? 0 : E0), fin: z.positionX + z.width - (ultimos.has(z.uniqueId) && rinconFin(z) ? 0 : E0) };
      };
      // un puente más largo que la lámina se corta en el costado de un módulo y sigue otro puente hasta donde se necesite
      const segmentos: KitchenModule[][] = [];
      tramos.forEach(t => {
        let cur: KitchenModule[] = [t[0]];
        t.slice(1).forEach(m => {
          const e = extremos([...cur, m]);
          if (e.fin - e.ini <= laminaGola) cur.push(m);
          else { segmentos.push(cur); cur = [m]; }
        });
        segmentos.push(cur);
      });
      segmentos.filter(t => t.length >= 2).forEach((t, ti) => {
        t.forEach((m, i) => junto.set(m.uniqueId, { inicio: i > 0, fin: i < t.length - 1 }));
        const E = PANEL_THICKNESS, { ini, fin } = extremos(t), H = t[0].height, D = t[0].depth;
        const partes = 1, largo = fin - ini;
        for (let k = 0; k < partes; k++) {
          const pp = placeOnWall(w, ini + k * largo, largo, D, armOrigin(w, false), 0);
          ([['Puente L corrido horizontal', GOLA_WIDTH, E, 0, H - GOLA_WIDTH - E], ['Puente L corrido vertical', E, GOLA_WIDTH, E, H - GOLA_WIDTH]] as const).forEach(([name, dv, dw, ov, ow], q) => {
            const c = w === 'A' ? { x: pp.x, y: pp.y + pp.sy - ov - dv, sx: largo, sy: dv } : w === 'B' ? { x: pp.x + pp.sx - ov - dv, y: pp.y, sx: dv, sy: largo } : { x: pp.x + ov, y: pp.y, sx: dv, sy: largo };
            boxes.push({ id: `panel-lower-corrido-${w}-${ti}-${k}-${q}`, name, kind: 'panel', wall: w, ...c, z: zh + ow, sz: dw, facing: null });
          });
        }
      });
    });
  }

  // --- Módulos ---
  modules.forEach(mod => {
    const isl = mod.wall === 'Island' ? (input.islands ?? []).find(i => i.id === mod.islandId) : undefined;
    if (mod.wall === 'Island' && !isl) return; // módulo de una isla que ya no está activa
    const boxWall: WallName = mod.wall === 'Island' ? 'A' : mod.wall;
    const kind: BoxKind = mod.type === 'UPPER' ? 'upper' : mod.type === 'TALL' ? 'tall' : 'lower';
    // Los aéreos cuelgan desde el techo (queda TOP_MARGIN libre); el resto se apoya sobre el zócalo
    const z = mod.type === 'UPPER' ? spaceHeight - TOP_MARGIN - (mod.topGap ?? 0) - mod.height : zh;
    // Isla o península: el módulo va a lo largo del largo de la isla, con el frente hacia +Y
    const p = isl
      ? { x: isl.dx + mod.positionX, y: isl.dy + (mod.depthOffset ?? 0), sx: mod.width, sy: mod.depth, facing: '-Y' as BoxFacing }
      : placeOnWall(mod.wall as WallName, mod.positionX, mod.width, mod.depth, armOrigin(mod.wall as WallName, mod.type === 'UPPER'), mod.depthOffset ?? 0);
    // Piezas laterales pegadas al módulo: la dilatada (con su propio fondo y alto) y el visto (todo el fondo). El ancho del
    // módulo ya viene restado, así que el conjunto ocupa la misma medida. De adentro hacia afuera: dilatada y luego visto.
    // Mirando el frente, la izquierda es el inicio del muro A y del C, y el final del B.
    const leftAtStart = mod.wall !== 'B';
    const alongA = boxWall === 'A';
    const lateralTier = mod.type === 'UPPER' ? 'upper' : 'lower';
    const lateral = (l?: boolean, r?: boolean) => ({ start: leftAtStart ? l : r, end: leftAtStart ? r : l });
    const vs = lateral(mod.vistoLeft, mod.vistoRight);
    const ds = lateral(mod.dilatLeft, mod.dilatRight);
    const vt = mod.vistoThickness ?? 15;
    const dt = mod.dilatThickness ?? 15;
    const dd = Math.min(mod.dilatDepth ?? DILATATION_DEPTH_DEFAULT, mod.depth);
    const dh = mod.dilatHeight ?? mod.height;
    (['start', 'end'] as const).forEach(side => {
      let off = 0; // distancia ya ocupada hacia afuera del módulo
      const place = (thick: number, depthMm: number, heightMm: number, id: string, name: string) => {
        const along0 = side === 'start' ? -off - thick : (alongA ? p.sx : p.sy) + off;
        // fondo desde el frente del módulo (el frente mira +Y en A, +X en B y -X en C)
        const full = depthMm >= (alongA ? p.sy : p.sx);
        const acrossStart = full ? (alongA ? p.y : p.x) : (alongA ? p.y + p.sy - depthMm : mod.wall === 'B' ? p.x + p.sx - depthMm : p.x);
        const across = full ? (alongA ? p.sy : p.sx) : depthMm;
        boxes.push({
          id, name, kind: 'filler', wall: boxWall, islandId: isl?.id,
          x: alongA ? p.x + along0 : acrossStart, y: alongA ? acrossStart : p.y + along0, z,
          sx: alongA ? thick : across, sy: alongA ? across : thick, sz: heightMm, facing: null,
        });
        off += thick;
      };
      if (ds[side]) place(dt, dd, dh, `dilatacion-${lateralTier}-${mod.uniqueId}-${side}`, `Pieza de dilatación ${mod.label ?? ''}`.trim());
      if (vs[side]) place(vt, mod.depth, mod.height, `visto-${lateralTier}-${mod.uniqueId}-${side}`, `Visto ${mod.label ?? ''}`.trim());
    });
    boxes.push({
      id: mod.uniqueId,
      name: `${mod.label ? mod.label + ' ' : ''}${mod.name}`,
      kind,
      wall: boxWall,
      islandId: isl?.id,
      x: p.x, y: p.y, z,
      sx: p.sx, sy: p.sy, sz: mod.height,
      facing: p.facing,
      moduleId: mod.uniqueId,
    });
    // Módulo convertido: sus piezas (laterales, base, techo, puentes, amarres, espaldar y entrepaños), con las reglas del carpintero.
    // Local al módulo: u a lo largo del ancho (desde el inicio del muro), v hacia atrás desde el frente, w hacia arriba desde su base
    const convertido = !!mod.detailed && !!mod.frontsLayout && !mod.cornerArm && mod.depth >= 60;
    // Torre de hornos (módulo especial alto): tiene su propio despiece si le alcanza la altura
    const esTorreHornos = convertido && mod.type === 'TALL' && /tall-oven/.test(mod.uniqueId) && mod.height >= 1900;
    // Vecinos del mismo nivel pegados a cada lado (para los costados internos cortos y el puente L corrido)
    const vecino = (lado: 'inicio' | 'fin') => !isl && mod.type === 'LOWER' && modules.some(o => o !== mod && o.wall === mod.wall && o.type === 'LOWER' && o.detailed && !!o.frontsLayout && !o.cornerArm
      && Math.abs(lado === 'inicio' ? o.positionX + o.width - mod.positionX : o.positionX - (mod.positionX + mod.width)) < 2);
    const corrido = !!input.costadosCortos && convertido && mod.type === 'LOWER' && junto.has(mod.uniqueId);
    // Esquinero recto: el bajo del muro A que llega al rincón queda tapado en parte por el tramo del otro muro. Lleva puerta falsa
    // (lo que tapa el otro tramo), dilatadas en la esquina y una puerta que abre en lo que queda libre; su lateral del rincón es 80 mm más corto
    const armDepth = LOWER_DEPTH;
    const tramo = (w: 'B' | 'C') => modules.some(o => o.wall === w && o.type === 'LOWER');
    const ciegoInicio = convertido && !isl && mod.wall === 'A' && mod.type === 'LOWER' && hasB && tramo('B') && mod.positionX < 250 && (mod.frontsLayout === 'door1' || mod.frontsLayout === 'door2');
    const ciegoFin = convertido && !isl && mod.wall === 'A' && mod.type === 'LOWER' && hasC && tramo('C') && mod.positionX + mod.width > wallA - 250 && (mod.frontsLayout === 'door1' || mod.frontsLayout === 'door2');
    const ciego = ciegoInicio ? armDepth - mod.positionX : ciegoFin ? armDepth - (wallA - mod.positionX - mod.width) : 0; // largo del frente que queda tapado
    const esquinero = ciego > 0 && mod.width >= ciego + 10 + 300 ? (ciegoInicio ? 'inicio' : 'fin') : null;
    if (convertido) {
      // espesor de la estructura según el tipo de mueble (15 por defecto; con 18 las bases, tapas y puentes quedan 6 mm más cortas)
      const E = (mod.type === 'UPPER' ? input.calEstructura?.MA : mod.type === 'LOWER' ? input.calEstructura?.MB : input.calEstructura?.otros) ?? PANEL_THICKNESS, W = mod.width, D = mod.depth, H = mod.height;
      let n = 0;
      const tier = mod.type === 'UPPER' ? 'upper' : 'lower';
      const piece = (name: string, du: number, dv: number, dw: number, ou: number, ov: number, ow: number) => {
        if (du <= 0 || dv <= 0 || dw <= 0) return;
        let x0: number, y0: number, sx: number, sy: number;
        if (p.facing === '-Y') { sx = du; sy = dv; x0 = p.x + p.sx - ou - du; y0 = p.y + ov; } // isla: el frente mira hacia la cocina
        else if (boxWall === 'A') { sx = du; sy = dv; x0 = p.x + ou; y0 = p.y + p.sy - ov - dv; }
        else if (boxWall === 'B') { sx = dv; sy = du; x0 = p.x + p.sx - ov - dv; y0 = p.y + ou; }
        else { sx = dv; sy = du; x0 = p.x + ov; y0 = p.y + ou; }
        boxes.push({
          id: `panel-${tier}-${mod.uniqueId}-${n++}`, name: `${name} ${mod.label ?? ''}`.trim(), kind: 'panel', wall: boxWall, islandId: isl?.id,
          x: x0, y: y0, z: z + ow, sx, sy, sz: dw, facing: null, moduleId: mod.uniqueId,
        });
      };
      const inner = W - 2 * E;
      // Cajón según la corredera (reglas del carpintero):
      // · full extensión: 13 mm de luz por lado (testero = ancho del módulo − 86); fondo de 5,5 de (testero + 10) × (lateral − 20)
      // · oculta: 6 mm de luz por lado (testero = ancho − 72); lateral en pasos de 50 (menos 10 si la marca lo pide); con fondo de 15 el testero
      //   es 30 mm más bajo que el lateral y el fondo mide lo mismo que el testero; con fondo de 5,5 va ranurado: 10 mm más ancho y del largo del lateral
      const cor = input.corredera ?? { tipo: 'full' as const };
      const cajon = (nm: string, zb: number, hh: number, ov: number) => {
        const pre = nm ? `Cajón ${nm}` : 'Cajón';
        if (cor.tipo === 'oculta') {
          const luz = 6, ext = inner - 2 * luz, xl = E + luz;
          const prof = Math.min(500, Math.floor((D - 20) / 50) * 50) - (cor.menos10 ? 10 : 0);
          const hT = cor.fondo15 ? Math.max(30, hh - 30) : hh;
          piece(`${pre} lateral izquierdo`, E, prof, hh, xl, ov, zb);
          piece(`${pre} lateral derecho`, E, prof, hh, xl + ext - E, ov, zb);
          piece(`${pre} testero frontal`, ext - 2 * E, E, hT, xl + E, ov, zb + hh - hT);
          piece(`${pre} testero trasero`, ext - 2 * E, E, hT, xl + E, ov + prof - E, zb + hh - hT);
          if (cor.fondo15) piece(`${pre} fondo`, ext - 2 * E, prof, E, xl + E, ov, zb + hh - hT - E);
          else piece(`${pre} fondo`, ext - 2 * E + 10, prof, PANEL_BACK, xl + E - 5, ov, zb + 15);
          return;
        }
        const luz = 13, prof = Math.min(500, D - 20), ext = inner - 2 * luz, xl = E + luz;
        piece(`${pre} lateral izquierdo`, E, prof, hh, xl, ov, zb);
        piece(`${pre} lateral derecho`, E, prof, hh, xl + ext - E, ov, zb);
        piece(`${pre} testero frontal`, ext - 2 * E, E, hh, xl + E, ov, zb);
        piece(`${pre} testero trasero`, ext - 2 * E, E, hh, xl + E, ov + prof - E, zb);
        piece(`${pre} fondo`, ext - 20, prof - 20, PANEL_BACK, xl + E - 5, ov + 10, zb + 15);
      };
      if (esTorreHornos) {
        // Torre de hornos (planos de Dr Carlos y Helin): cajón abajo, hueco del horno (590 libres), hueco del segundo equipo (370) y mueble de puertas arriba.
        // Los pisos de los equipos (tapas base) miden 100 mm menos de fondo, para ventilación y cables; el espaldar (de 15) va solo detrás del mueble de arriba
        const CAJ = 356, HORNO = 590, MICRO = 370;
        const zHorno = E + CAJ + 14;                 // cara de arriba de la base del horno
        const zMicro = zHorno + HORNO + E;           // cara de arriba del piso del segundo equipo
        const zArriba = zMicro + MICRO + E;          // cara de arriba del piso del mueble superior
        piece('Lateral izquierdo', E, D, H, 0, 0, 0);
        piece('Lateral derecho', E, D, H, W - E, 0, 0);
        piece('Base', inner, D, E, E, 0, 0);                         // base del cajón
        piece('Base', inner, D, E, E, 0, zHorno - E);                // base del horno
        piece('Tapa base', inner, D - 100, E, E, 0, zMicro - E);     // piso del segundo equipo
        piece('Tapa base', inner, D - 100, E, E, 0, zArriba - E);    // piso del mueble superior
        piece('Tapa base', inner, D - 100, E, E, 0, H - E);          // techo del mueble superior
        // puentes de 70 atrás: amarran los laterales donde no hay espaldar (detrás del cajón y de cada equipo)
        ([E, zHorno, zMicro, zArriba - E - 70] as number[]).forEach(w0 => piece('Puente', inner, E, 70, E, D - E, w0));
        piece('Puente L torre', inner, GOLA_WIDTH, E, E, 0, zHorno - 2 * E);   // puente en L al frente, sobre el cajón (plano de la torre: 570 × 65, 1L)
        piece('Espaldar', inner, E, H - E - zArriba, E, D - 100 - E, zArriba);
        piece('Entrepaño', inner, D - 120, E, E, 0, zArriba + Math.round((H - E - zArriba) / 2));
        cajon('', E + 20, 180, 0); // cajón de abajo
      } else {
      // costados internos 80 mm más cortos (opción): el puente L corrido pasa por encima sin hacerles la caja; en el esquinero, el lateral del rincón
      const corto = (lado: 'inicio' | 'fin') => (corrido && !!junto.get(mod.uniqueId)?.[lado]) || esquinero === lado;
      piece(esquinero === 'inicio' ? 'Lateral rincón' : 'Lateral izquierdo', E, D, corto('inicio') ? H - 80 : H, 0, 0, 0);
      piece(esquinero === 'fin' ? 'Lateral rincón' : 'Lateral derecho', E, D, corto('fin') ? H - 80 : H, W - E, 0, 0);
      if (mod.type === 'LOWER') {
        // Bajo: sin techo ni espaldar (el mesón hace de tapa); base, 2 puentes traseros y puente en L arriba (propio, o corrido entre varios módulos)
        piece('Base', inner, D, E, E, 0, 0);
        piece('Amarre superior trasero', inner, E, TIE_LOWER, E, D - E, H - TIE_LOWER);
        piece('Amarre inferior trasero', inner, E, TIE_LOWER, E, D - E, E);
        if (!corrido) {
          piece('Gola superior horizontal', inner, GOLA_WIDTH, E, E, 0, H - GOLA_WIDTH - E);
          piece('Gola superior vertical', inner, E, GOLA_WIDTH, E, E, H - GOLA_WIDTH);
        }
        if (mod.frontsLayout === 'drawers') {
          // Cajonero: gola media y tres cajones reales (inferior, medio y cubiertero oculto)
          piece('Gola media horizontal', inner, GOLA_WIDTH, E, E, 0, 330);
          piece('Gola media vertical', inner, E, GOLA_WIDTH, E, E, 330 + E);
          ([['Inferior', 35, 180, 0], ['Medio', 445, 100, 0], ['Cubiertero', 605, 70, 18]] as const).forEach(([nm, zb, hh, ov]) => cajon(nm, zb, hh, ov));
        } else if (W >= 450) {
          // regla del carpintero: en el bajo el entrepaño mide el fondo del lateral − 90 y va atrás, contra los amarres
          piece('Entrepaño', inner, D - 90, E, E, 90 - E, SHELF_Z);
        }
        if (esquinero) {
          // dilatada de la esquina (70 de canto, al ras de las puertas); su pareja va en el otro tramo: en la lista sale una de 140 para cortar por la mitad
          const u0 = esquinero === 'inicio' ? ciego - 60 : W - ciego - 10;
          piece('Dilatada esquinero', 70, E, H - 80, u0, -E, 0);
        }
      } else if (mod.type === 'UPPER') {
        // Aéreo: base y tapa al ras del lateral (20 mm atrás si lleva platero, para que circule el aire), espaldar de (alto − 20) × (ancho − 20)
        // metido 5 mm en cada lateral, y dos soportes arriba (cuchillas)
        const dPiso = mod.hasPlateRack ? D - 20 : D;
        piece('Piso', inner, dPiso, E, E, 0, 0);
        piece('Techo', inner, dPiso, E, E, 0, H - E);
        piece('Espaldar', W - 20, PANEL_BACK, H - 20, 10, D - E - PANEL_BACK, 10);
        piece('Amarre superior 1', inner, E, TIE_UPPER, E, D - E, H - E - TIE_UPPER);
        piece('Amarre superior 2', inner, E, TIE_UPPER, E, D - E, H - E - 2 * TIE_UPPER);
        // regla del carpintero: en el aéreo el entrepaño mide el fondo del lateral − 60 y va atrás, contra el espaldar
        if (W >= 450) piece('Entrepaño', inner, D - 60, E, E, 60 - E - PANEL_BACK, SHELF_Z);
      } else {
        // Torres y alacenas: piso, techo, espaldar y dos amarres arriba
        piece('Piso', inner, D, E, E, 0, 0);
        piece('Techo', inner, D, E, E, 0, H - E);
        piece('Espaldar', inner, PANEL_BACK, H - 2 * E + 5, E, D - E - PANEL_BACK, E);
        piece('Amarre superior 1', inner, E, TIE_UPPER, E, D - E, H - E - TIE_UPPER);
        piece('Amarre superior 2', inner, E, TIE_UPPER, E, D - E, H - E - 2 * TIE_UPPER);
        if (W >= 450) piece('Entrepaño', inner, D - 20, E, E, 0, SHELF_Z);
      }
      }
    }
    // Módulo convertido: sus puertas o frentes de cajón (afuera de la cara frontal)
    if (mod.detailed && mod.frontsLayout) {
      const tabPuerta = input.aereoAbre === 'alras' ? 0 : UPPER_DOOR_TAB; // al ras: la puerta del aéreo no cuelga
      const T = FRONT_THICKNESS, G = FRONT_SIDE_GAP;
      type Fr = { name: string; a0: number; a1: number; z0: number; h: number };
      const fronts: Fr[] = [];
      const W = mod.width, H = mod.height;
      // regla del carpintero: la puerta del bajo mide el lateral − 30 con mesón sin nariz y − 50 con nariz (frentero o reengruese)
      const full = mod.type === 'UPPER' ? H : H - (conNariz ? FRONT_LOWER_BOTTOM_CUT : 30);
      // ancho: una sola puerta o frente = ancho del módulo − 2; dos puertas = cada una la mitad − 1
      const G1 = 1, G2 = 0.5;
      if (mod.frontsLayout === 'open') {
        // módulo abierto: no lleva puertas (va todo en el material de la fachada)
      } else if (esTorreHornos) {
        // frente del cajón de abajo y dos puertas en el mueble de arriba; los huecos de los equipos quedan abiertos
        const zArriba = PANEL_THICKNESS + 356 + 14 + 590 + PANEL_THICKNESS + 370 + PANEL_THICKNESS, w = W / 2 - 1, hP = H - zArriba + PANEL_THICKNESS - 2;
        fronts.push({ name: 'Frente cajón', a0: G1, a1: W - G1, z0: 0, h: 356 + PANEL_THICKNESS - 2 },
          { name: 'Puerta izquierda', a0: G2, a1: G2 + w, z0: zArriba - PANEL_THICKNESS, h: hP }, { name: 'Puerta derecha', a0: W / 2 + G2, a1: W / 2 + G2 + w, z0: zArriba - PANEL_THICKNESS, h: hP });
      } else if (esquinero) {
        // esquinero recto: puerta falsa en lo que tapa el otro tramo, y una puerta que abre en lo libre (la dilatada de la esquina va entre las dos)
        if (esquinero === 'inicio') fronts.push({ name: 'Puerta falsa', a0: G1, a1: ciego - 60, z0: 0, h: full }, { name: 'Puerta', a0: ciego + 12, a1: W - G1, z0: 0, h: full });
        else fronts.push({ name: 'Puerta', a0: G1, a1: W - ciego - 12, z0: 0, h: full }, { name: 'Puerta falsa', a0: W - ciego + 60, a1: W - G1, z0: 0, h: full });
      } else if (mod.frontsLayout === 'door1') {
        fronts.push({ name: 'Puerta', a0: G1, a1: W - G1, z0: 0, h: mod.type === 'TALL' ? H - 20 : full });
      } else if (mod.frontsLayout === 'door2') {
        const w = W / 2 - 1, h = mod.type === 'TALL' ? H - 20 : full;
        fronts.push({ name: 'Puerta izquierda', a0: G2, a1: G2 + w, z0: 0, h }, { name: 'Puerta derecha', a0: W / 2 + G2, a1: W / 2 + G2 + w, z0: 0, h });
      } else if (mod.frontsLayout === 'drawers') {
        const h = (full - FRONT_DRAWER_GAP) / 2;
        fronts.push({ name: 'Frente inferior', a0: G1, a1: W - G1, z0: 0, h }, { name: 'Frente superior', a0: G1, a1: W - G1, z0: h + FRONT_DRAWER_GAP, h });
      } else if (mod.frontsLayout === 'upper-door1') {
        fronts.push({ name: 'Puerta', a0: G1, a1: W - G1, z0: -tabPuerta, h: H + tabPuerta });
      } else if (mod.frontsLayout === 'upper-door2-v') {
        const w = W / 2 - 1;
        fronts.push({ name: 'Puerta izquierda', a0: G2, a1: G2 + w, z0: -tabPuerta, h: H + tabPuerta }, { name: 'Puerta derecha', a0: W / 2 + G2, a1: W / 2 + G2 + w, z0: -tabPuerta, h: H + tabPuerta });
      } else if (mod.frontsLayout === 'upper-door2-h') {
        const h = (H + tabPuerta - G) / 2;
        fronts.push({ name: 'Puerta inferior', a0: G1, a1: W - G1, z0: -tabPuerta, h }, { name: 'Puerta superior', a0: G1, a1: W - G1, z0: -tabPuerta + h + G, h });
      } else if (mod.frontsLayout === 'hood-h') {
        // Campana con puertas horizontales: la de arriba copia la altura de la del aéreo vecino (HOOD_CUT más alto); la de abajo absorbe el resto
        const hSup = (H + HOOD_CUT + tabPuerta - G) / 2;
        const hInf = (H - HOOD_DOOR_GAP) - hSup - G;
        fronts.push({ name: 'Puerta inferior', a0: G1, a1: W - G1, z0: HOOD_DOOR_GAP, h: hInf }, { name: 'Puerta superior', a0: G1, a1: W - G1, z0: HOOD_DOOR_GAP + hInf + G, h: hSup });
      } else if (mod.frontsLayout === 'hood') {
        // Campana con puertas verticales: arrancan HOOD_DOOR_GAP sobre la base (sin pestaña) y llegan al techo del módulo
        const h = H - HOOD_DOOR_GAP;
        if (W < 450) fronts.push({ name: 'Puerta', a0: G1, a1: W - G1, z0: HOOD_DOOR_GAP, h });
        else { const w = W / 2 - 1; fronts.push({ name: 'Puerta izquierda', a0: G2, a1: G2 + w, z0: HOOD_DOOR_GAP, h }, { name: 'Puerta derecha', a0: W / 2 + G2, a1: W / 2 + G2 + w, z0: HOOD_DOOR_GAP, h }); }
      }
      fronts.forEach((f, i) => {
        const along = boxWall === 'A' ? 'x' : 'y';
        const alongStart = along === 'x' ? p.x : p.y;
        const outward = p.facing === '+Y' ? { y: p.y + p.sy } : p.facing === '-Y' ? { y: p.y - T } : p.facing === '+X' ? { x: p.x + p.sx } : { x: p.x - T };
        const pos = boxWall === 'A'
          ? { x: p.facing === '-Y' ? p.x + p.sx - f.a1 : alongStart + f.a0, y: outward.y as number, sx: f.a1 - f.a0, sy: T }
          : { x: outward.x as number, y: alongStart + f.a0, sx: T, sy: f.a1 - f.a0 };
        boxes.push({
          id: `front-${mod.type === 'UPPER' ? 'upper' : 'lower'}-${mod.uniqueId}-${i}`, name: `${f.name} ${mod.label ?? ''}`.trim(), kind: 'front', wall: boxWall, islandId: isl?.id,
          ...pos, z: z + f.z0, sz: f.h, facing: null, moduleId: mod.uniqueId,
        });
      });
    }
    // Esquinero en L: el brazo sigue por el muro B o C, tras la esquina ciega, con la misma altura
    if (mod.cornerArm && !isl) {
      const ar = mod.cornerArm;
      const pa = placeOnWall(ar.wall, ar.positionX ?? 0, ar.width, ar.depth, CORNER_BLIND_OFFSET);
      boxes.push({
        id: `${mod.uniqueId}-arm`, name: `${mod.label ? mod.label + ' ' : ''}${mod.name} (brazo)`, kind, wall: ar.wall,
        x: pa.x, y: pa.y, z, sx: pa.sx, sy: pa.sy, sz: mod.height, facing: pa.facing, moduleId: mod.uniqueId,
      });
    }
  });

  // --- Piezas de dilatación ---
  // Cuando un módulo queda pegado a un muro (a una holgura de él) se coloca la pieza que tapa esa holgura:
  // espesor = holgura, alto = el del módulo, y fondo dilatationDepth medido desde el frente del módulo.
  // Solo hay pieza donde el módulo toca un muro (lateral B o C, o un muro auxiliar) y dejó la holgura.
  const dilGap = input.dilatationGap ?? DILATATION_GAP_DEFAULT;
  if (input.hasDilatation && dilGap > 0) {
    const dilDepth = input.dilatationDepth ?? DILATATION_DEPTH_DEFAULT;
    const armLength = (wall: WallName, tier: 'lower' | 'upper') => (wall === 'A' ? wallA : (wall === 'B' ? wallB : wallC) - armOrigin(wall, tier === 'upper'));
    const alongStart = (bx: Box, wall: WallName, tier: 'lower' | 'upper') => (wall === 'A' ? bx.x : bx.y - armOrigin(wall, tier === 'upper'));
    const alongSize = (bx: Box, wall: WallName) => (wall === 'A' ? bx.sx : bx.sy);

    (['A', 'B', 'C'] as WallName[]).forEach(wall => {
      (['lower', 'upper'] as const).forEach(tier => {
        const run = boxes.filter(bx => bx.moduleId && bx.wall === wall && bx.kind === tier && !bx.islandId)
          .sort((p, q) => alongStart(p, wall, tier) - alongStart(q, wall, tier));
        if (run.length === 0) return;

        const place = (side: 'start' | 'end', ref: Box) => {
          const fd = Math.min(dilDepth, wall === 'A' ? ref.sy : ref.sx); // fondo, desde el frente del módulo
          const c = wall === 'A'
            ? { x: side === 'start' ? 0 : wallA - dilGap, y: ref.y + ref.sy - fd, sx: dilGap, sy: fd }
            : wall === 'B'
              ? { x: ref.x + ref.sx - fd, y: wallB - dilGap, sx: fd, sy: dilGap }
              : { x: ref.x, y: wallC - dilGap, sx: fd, sy: dilGap };
          boxes.push({
            id: `dilatacion-${wall}-${tier}-${side}`, name: 'Pieza de dilatación', kind: 'filler', wall,
            ...c, z: ref.z, sz: ref.sz, facing: null,
          });
        };

        const first = run[0];
        const last = run[run.length - 1];
        // Extremos que tocan un muro: el inicio de A toca el muro B (L y U) o el muro auxiliar izquierdo (recta);
        // el final de A toca el muro C (U) o el muro auxiliar derecho; el final de cada brazo toca su muro auxiliar.
        const closesStart = wall === 'A' && (hasB || !!input.hasLeftClosure);
        const closesEnd = wall === 'A' ? hasC || !!input.hasRightClosure
          : wall === 'B' ? !!input.hasLeftClosure : !!input.hasRightClosure;
        if (closesStart && Math.abs(alongStart(first, wall, tier) - dilGap) <= 1) place('start', first);
        if (closesEnd && Math.abs(alongStart(last, wall, tier) + alongSize(last, wall) - (armLength(wall, tier) - dilGap)) <= 1) place('end', last);
      });
    });
  }

  // --- Electrodomésticos que ocupan volumen propio (nevera y alacena alta) ---
  // La estufa, la poceta y la campana se modelan con sus muebles (Mueble Estufa, Mueble Poceta, Mueble Campana)
  appliances.filter(a => a.active && a.wall !== 'Island' && (a.type === 'fridge' || a.type === 'pantry')).forEach(app => {
    const wall = app.wall as WallName;
    const p = placeOnWall(wall, app.distance, app.width, app.depth);
    const isPantry = app.type === 'pantry';
    boxes.push({
      id: `appliance-${app.type}-${wall}`,
      name: isPantry ? 'Alacena alta' : 'Nevera',
      kind: 'appliance',
      wall,
      x: p.x, y: p.y,
      z: isPantry ? zh : 0,
      sx: p.sx, sy: p.sy,
      sz: isPantry ? spaceHeight - TOP_MARGIN - zh : app.height,
      facing: p.facing,
      applianceType: app.type,
    });
  });

  // --- Lavavajillas: del piso hasta la cara de arriba de los bajos, bajo el mesón (el mesón pasa por encima) ---
  appliances.filter(a => a.active && a.type === 'dishwasher' && a.wall !== 'Island').forEach(app => {
    const wall = app.wall as WallName;
    const p = placeOnWall(wall, app.distance, app.width, LOWER_DEPTH);
    const bajos = boxes.filter(b => b.kind === 'lower' && b.wall === wall && !b.islandId);
    const tope = bajos.length ? Math.max(...bajos.map(b => b.z + b.sz)) : zh + 800;
    boxes.push({ id: `appliance-dishwasher-${wall}`, name: 'Lavavajillas', kind: 'appliance', wall, x: p.x, y: p.y, z: 0, sx: p.sx, sy: p.sy, sz: tope, facing: p.facing, applianceType: 'dishwasher' });
  });
  // --- Campana tipo península: sin mueble arriba (65 cm libres en los aéreos); la campana cuelga del muro y su chimenea
  // sube al techo, a la misma altura sobre el mesón que la de la isla ---
  appliances.filter(a => a.active && a.type === 'hood-under' && a.campanaTipo === 'libre' && a.wall !== 'Island').forEach(app => {
    const wall = app.wall as WallName;
    const bajos = boxes.filter(b => b.kind === 'lower' && b.wall === wall && !b.islandId);
    const tope = (bajos.length ? Math.max(...bajos.map(b => b.z + b.sz)) : zh + 800) + (hasCounter ? counterThickness : 0);
    const z0 = tope + ISLAND_HOOD_GAP, fondo = 500;
    const p = placeOnWall(wall, app.distance, app.width, fondo);
    boxes.push({ id: `campana-pared-${wall}`, name: 'Campana', kind: 'appliance', applianceType: 'hood-island', wall, x: p.x, y: p.y, z: z0, sx: p.sx, sy: p.sy, sz: Math.max(200, spaceHeight - z0), facing: null });
  });

  // --- Canto del mesón (frentero o reengruese): lados pedidos, uniones a 45° entre piezas y con el mesón (frentero) ---
  type EdgeCode = 'x-' | 'x+' | 'y-' | 'y+';
  const planEdge = (counterId: string, wall: WallName, island: boolean, blocked: EdgeCode[]) => {
    const edge = input.counterExtras?.[counterId]?.edge;
    if (!edge || edge.kind === 'none') return { edge: undefined, codes: [] as EdgeCode[] };
    const maps: Record<WallName, Partial<Record<'front' | 'back' | 'left' | 'right', EdgeCode>>> = {
      A: { front: 'y+', back: 'y-', left: 'x-', right: 'x+' },
      B: { front: 'x+', left: 'y+', right: 'y-' },
      C: { front: 'x-', left: 'y-', right: 'y+' },
    };
    const map = maps[wall];
    const codes = (['front', 'left', 'right', 'back'] as const)
      .filter(k => edge.sides[k] && map[k] && (k !== 'back' || island))
      .map(k => map[k] as EdgeCode)
      .filter(c => !blocked.includes(c));
    return { edge, codes };
  };
  const addEdgePieces = (counterId: string, wall: WallName, slab: { x: number; y: number; sx: number; sy: number; z: number; sz: number }, plan: { edge?: CounterEdge; codes: EdgeCode[] }, islandId?: string) => {
    const edge = plan.edge;
    if (!edge || plan.codes.length === 0) return;
    const frentero = edge.kind === 'frentero';
    const T = frentero ? slab.sz : Math.max(5, edge.width);                       // espesor de la pieza hacia adentro
    const H = frentero ? Math.max(slab.sz + 1, edge.height) : Math.max(5, edge.height); // alto
    const X0 = slab.x, X1 = slab.x + slab.sx, Y0 = slab.y, Y1 = slab.y + slab.sy;
    const has = (c: EdgeCode) => plan.codes.includes(c);
    plan.codes.forEach(code => {
      let poly: Array<[number, number]>;
      let inner: EdgeCode;
      if (code === 'y+' || code === 'y-') {
        const yo = code === 'y+' ? Y1 : Y0, yi = code === 'y+' ? Y1 - T : Y0 + T;
        const xa = X0, xb = X1, xai = has('x-') ? X0 + T : X0, xbi = has('x+') ? X1 - T : X1;
        poly = [[xa, yo], [xb, yo], [xbi, yi], [xai, yi]];
        inner = code === 'y+' ? 'y-' : 'y+';
      } else {
        const xo = code === 'x+' ? X1 : X0, xi = code === 'x+' ? X1 - T : X0 + T;
        const ya = Y0, yb = Y1, yai = has('y-') ? Y0 + T : Y0, ybi = has('y+') ? Y1 - T : Y1;
        poly = [[xo, ya], [xo, yb], [xi, ybi], [xi, yai]];
        inner = code === 'x+' ? 'x-' : 'x+';
      }
      const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
      boxes.push({
        id: `${frentero ? 'frentero' : 'reengruese'}-${counterId}-${code}`,
        name: `${frentero ? 'Frentero' : 'Reengruese'} ${counterId.replace('counter-', 'mesón ')} ${code}`,
        kind: 'counter',
        wall,
        islandId,
        x: Math.min(...xs), y: Math.min(...ys),
        sx: Math.max(...xs) - Math.min(...xs), sy: Math.max(...ys) - Math.min(...ys),
        z: frentero ? slab.z + slab.sz - H : slab.z - H,
        sz: H,
        facing: null,
        polygon: poly,
        mitreTop: frentero ? inner : undefined,
      });
    });
  };

  // --- Mesón: una losa por tramo continuo de módulos bajos de cada muro, con aberturas para poceta y estufa ---
  if (hasCounter && counterThickness > 0) {
    (['A', 'B', 'C'] as WallName[]).forEach(wall => {
      // el lavavajillas va bajo el mesón: cuenta como parte del tramo (no lo corta)
      const lowers = boxes.filter(b => (b.kind === 'lower' || b.applianceType === 'dishwasher') && b.wall === wall && !b.islandId);
      if (lowers.length === 0) return;
      const range = (b: Box) => (wall === 'A' ? { start: b.x, end: b.x + b.sx } : { start: b.y, end: b.y + b.sy });
      const sorted = [...lowers].sort((a, b) => range(a).start - range(b).start);

      // Tramos continuos (los huecos de nevera o alacena cortan el mesón)
      const runs: Box[][] = [];
      sorted.forEach(b => {
        const run = runs[runs.length - 1];
        if (run && range(b).start - range(run[run.length - 1]).end <= 1) run.push(b);
        else runs.push([b]);
      });

      runs.forEach((run, index) => {
        // El mesón cubre también las piezas laterales pegadas a sus módulos (dilatadas y vistos): llega hasta su borde exterior
        const lateral = boxes.filter(f => f.kind === 'filler' && f.wall === wall && (
          ((f.id.startsWith('dilatacion-lower-') || f.id.startsWith('visto-lower-')) && run.some(m => f.id.includes(`-lower-${m.moduleId}-`)))
          // dilatada contra el muro al final del tramo: el mesón la cubre y llega hasta el muro
          || (f.id.startsWith(`dilatacion-${wall}-lower-`) && (Math.abs(range(f).end - range(run[0]).start) < 2 || Math.abs(range(f).start - range(run[run.length - 1]).end) < 2))));
        const start = Math.min(range(run[0]).start, ...lateral.map(f => range(f).start));
        const end = Math.max(range(run[run.length - 1]).end, ...lateral.map(f => range(f).end));
        const depth = Math.max(...run.map(b => (wall === 'A' ? b.y + b.sy : wall === 'B' ? b.x + b.sx : wallA - b.x)));
        const topOfModules = Math.max(...run.map(b => b.z + b.sz));
        const slabDepth = depth + counterOverhang;
        const ct = counterThickness;
        const counterTop = topOfModules + ct;

        // Ajustes manuales del tramo: izquierda/derecha vistas desde el frente (inicio del muro en A y C, final en B)
        const counterId = `counter-${wall}-${index}`;
        const extras = input.counterExtras?.[counterId] ?? {};
        const leftIsStart = wall !== 'B';
        const side = (l?: boolean, r?: boolean) => (leftIsStart ? { start: l, end: r } : { start: r, end: l });
        const sp = side(extras.splashLeft, extras.splashRight);
        const wf = side(extras.waterfallLeft, extras.waterfallRight);

        // Cascada: el mesón baja del tope al piso por el costado, con inglete a 45° contra la losa. Ocupa un espesor
        // contra el extremo del tramo (el módulo de ese extremo se acorta ese espesor, así el conjunto no cambia de medida)
        // y la losa llega hasta el borde exterior de la cascada.
        // Frentero a la izquierda o derecha: igual que la cascada, ocupa un espesor contra el extremo (el módulo de ese extremo se acorta
        // ese espesor) y la losa llega hasta el borde exterior del frentero, así el conjunto no cambia de medida
        const fe = extras.edge;
        const frOn = (left: boolean) => fe?.kind === 'frentero' && (left ? fe.sides.left : fe.sides.right);
        // Si en ese extremo ya hay visto o dilatada, el módulo ya viene restado: el frentero queda encima de ellas y no se resta de nuevo
        const latStart = lateral.some(f => range(f).start < range(run[0]).start - 0.5);
        const latEnd = lateral.some(f => range(f).end > range(run[run.length - 1]).end + 0.5);
        const frStart = !wf.start && !latStart && !!frOn(leftIsStart), frEnd = !wf.end && !latEnd && !!frOn(!leftIsStart);
        const slabStart = start - (wf.start ? ct : 0) - (frStart ? ct : 0);
        const slabEnd = end + (wf.end ? ct : 0) + (frEnd ? ct : 0);
        const length = slabEnd - slabStart;

        const slab = wall === 'A'
          ? { x: slabStart, y: 0, sx: length, sy: slabDepth }
          : wall === 'B'
            ? { x: 0, y: slabStart, sx: slabDepth, sy: length }
            : { x: wallA - slabDepth, y: slabStart, sx: slabDepth, sy: length };

        const cutouts: Cutout[] = [];
        appliances.filter(a => a.active && a.wall === wall && (a.type === 'sink' || a.type === 'stove')).forEach(app => {
          const alongStart = (wall === 'A' ? 0 : CORNER_BLIND_OFFSET) + app.distance;
          if (alongStart < start - 1 || alongStart + app.width > end + 1) return; // no cae sobre este tramo
          const isSink = app.type === 'sink';
          const cw = app.width - 2 * (isSink ? SINK_CUTOUT_MARGIN : STOVE_CUTOUT_MARGIN_X); // medida a lo largo del muro
          const cd = app.depth - 2 * (isSink ? SINK_CUTOUT_MARGIN : STOVE_CUTOUT_MARGIN_Y);  // medida hacia el frente
          const c = applianceCenter(app, wallA);
          cutouts.push(wall === 'A'
            ? { label: isSink ? 'Poceta' : 'Estufa', x: c.x - cw / 2, y: c.y - cd / 2, sx: cw, sy: cd }
            : { label: isSink ? 'Poceta' : 'Estufa', x: c.x - cd / 2, y: c.y - cw / 2, sx: cd, sy: cw });
        });

        // Lados de la caja (en x o y) del inicio y del final del tramo
        const startSide = wall === 'A' ? 'x-' : 'y-';
        const endSide = wall === 'A' ? 'x+' : 'y+';
        const mitreBottom: Array<'x-' | 'x+' | 'y-' | 'y+'> = [];
        if (wf.start) mitreBottom.push(startSide);
        if (wf.end) mitreBottom.push(endSide);
        const edgePlan = planEdge(counterId, wall, false, mitreBottom);
        if (edgePlan.edge?.kind === 'frentero') mitreBottom.push(...edgePlan.codes);

        // Columnas o muros atravesados dentro del tramo: la losa lleva una muesca contra el muro por cada una
        const notches = (input.columns ?? []).filter(col => col.wall === wall)
          .map(col => ({ a0: Math.max(slabStart, col.distance), a1: Math.min(slabEnd, col.distance + col.width), c: Math.min(col.depth, slabDepth) }))
          .filter(nn => nn.a1 - nn.a0 > 1 && nn.c > 0)
          .sort((p, q) => p.a0 - q.a0);

        boxes.push({
          id: counterId,
          name: `Mesón ${wall}${runs.length > 1 ? ` (${index + 1})` : ''}`,
          kind: 'counter',
          wall,
          x: slab.x, y: slab.y, z: topOfModules,
          sx: slab.sx, sy: slab.sy, sz: ct,
          facing: wall === 'A' ? '+Y' : wall === 'B' ? '+X' : '-X',
          cutouts,
          mitreBottom: mitreBottom.length ? mitreBottom : undefined,
          notches: notches.length ? notches : undefined,
        });
        addEdgePieces(counterId, wall, { x: slab.x, y: slab.y, sx: slab.sx, sy: slab.sy, z: topOfModules, sz: ct }, edgePlan);
        // Visto o dilatada en un extremo con frentero o reengruese: pierde la altura de esa pieza (lo que baja del mesón) y queda al ras
        if (edgePlan.edge) {
          const drop = edgePlan.edge.kind === 'frentero' ? Math.max(0, edgePlan.edge.height - ct) : edgePlan.edge.height;
          if (drop > 0 && lateral.length > 0) {
            (['start', 'end'] as const).forEach(sideName => {
              if (!edgePlan.codes.includes(sideName === 'start' ? startSide : endSide)) return;
              // Solo las piezas laterales de ese extremo (las que quedan fuera del primer o del último módulo del tramo)
              const firstStart = range(run[0]).start, lastEnd = range(run[run.length - 1]).end;
              lateral.filter(f => (sideName === 'start' ? range(f).end <= firstStart + 0.5 : range(f).start >= lastEnd - 0.5))
                .forEach(f => { f.sz = Math.max(10, f.sz - drop); });
            });
          }
        }

        // (a lo largo del muro, hacia el frente) -> caja
        const piece = (a0: number, a1: number, c0: number, c1: number) => (wall === 'A'
          ? { x: a0, y: c0, sx: a1 - a0, sy: c1 - c0 }
          : wall === 'B'
            ? { x: c0, y: a0, sx: c1 - c0, sy: a1 - a0 }
            : { x: wallA - c1, y: a0, sx: c1 - c0, sy: a1 - a0 });

        // --- Salpicadero: del mismo material y espesor del mesón; va atrás (contra el muro) y en los extremos del tramo
        // que tocan un muro o un módulo más alto que el mesón (torre, nevera, alacena). Se apoya sobre el mesón ---
        if (splashHeight > 0) {
          const st = ct;
          // Un obstáculo cruza el nivel del mesón (muro, torre, nevera, alacena) y está pegado al extremo del tramo
          const along = (bx: Box) => (wall === 'A' ? [bx.x, bx.x + bx.sx] : [bx.y, bx.y + bx.sy]);
          const across = (bx: Box) => (wall === 'C' ? [wallA - (bx.x + bx.sx), wallA - bx.x] : wall === 'A' ? [bx.y, bx.y + bx.sy] : [bx.x, bx.x + bx.sx]);
          const touches = (a0: number, a1: number) => boxes.some(ob => {
            if (!(ob.kind === 'wall' || ob.kind === 'tall' || ob.kind === 'appliance')) return false;
            if (!(ob.z < counterTop - 1 && ob.z + ob.sz > counterTop + 1)) return false;
            const [p0, p1] = along(ob);
            const [q0, q1] = across(ob);
            return Math.min(p1, a1) - Math.max(p0, a0) > 0.5 && Math.min(q1, slabDepth) - Math.max(q0, 0) > 1;
          });
          const SPLASH_REACH = 20; // un obstáculo a esta distancia o menos del extremo (holgura de dilatación) cuenta como pegado
          // Donde hay cascada no hace falta salpicadero lateral: la losa termina en la cascada
          const wantStart = !wf.start && (sp.start ?? (hasSplash && touches(slabStart - SPLASH_REACH, slabStart)));
          const wantEnd = !wf.end && (sp.end ?? (hasSplash && touches(slabEnd, slabEnd + SPLASH_REACH)));
          const pieces: Array<[string, { x: number; y: number; sx: number; sy: number }, Array<[number, number]>?]> = [];
          // (a lo largo del muro, hacia el frente) -> (x, y) de la planta
          const toXY = (a: number, c: number): [number, number] => (wall === 'A' ? [a, c] : wall === 'B' ? [c, a] : [wallA - c, a]);
          if (hasSplash) {
            // Atrás, contra el muro; donde hay una columna el salpicadero la rodea: por su frente y por sus dos costados
            let at = slabStart, seg = 0;
            notches.forEach(nn => {
              if (nn.a0 - at > 0.5) pieces.push([seg++ ? `atrás-${seg}` : 'atrás', piece(at, nn.a0, 0, st)]);
              at = Math.max(at, nn.a1);
            });
            if (slabEnd - at > 0.5) pieces.push([seg++ ? `atrás-${seg}` : 'atrás', piece(at, slabEnd, 0, st)]);
            // En las esquinas de la columna, las piezas se unen a 45° (inglete)
            notches.forEach((nn, i) => {
              const cf = nn.c;
              const leftOk = nn.a0 > slabStart + 0.5, rightOk = nn.a1 < slabEnd - 0.5;
              const f0 = leftOk ? nn.a0 - st : nn.a0, f1 = rightOk ? nn.a1 + st : nn.a1;
              pieces.push([`columna-${i + 1}-frente`, piece(f0, f1, cf, cf + st), [[f0, cf + st], [f1, cf + st], [nn.a1, cf], [nn.a0, cf]].map(([a, c]) => toXY(a, c))]);
              if (leftOk) pieces.push([`columna-${i + 1}-inicio`, piece(nn.a0 - st, nn.a0, st, cf + st), [[nn.a0 - st, st], [nn.a0, st], [nn.a0, cf], [nn.a0 - st, cf + st]].map(([a, c]) => toXY(a, c))]);
              if (rightOk) pieces.push([`columna-${i + 1}-final`, piece(nn.a1, nn.a1 + st, st, cf + st), [[nn.a1, st], [nn.a1 + st, st], [nn.a1 + st, cf + st], [nn.a1, cf]].map(([a, c]) => toXY(a, c))]);
            });
          }
          if (wantStart) pieces.push(['inicio', piece(slabStart, slabStart + st, hasSplash ? st : 0, slabDepth)]);
          if (wantEnd) pieces.push(['final', piece(slabEnd - st, slabEnd, hasSplash ? st : 0, slabDepth)]);
          pieces.forEach(([label, p, poly]) => boxes.push({
            id: `salpicadero-${wall}-${index}-${label}`,
            name: `Salpicadero ${wall}${runs.length > 1 ? ` (${index + 1})` : ''} ${label}`,
            kind: 'counter',
            wall,
            x: p.x, y: p.y, z: counterTop,
            sx: p.sx, sy: p.sy, sz: splashHeight,
            facing: null,
            polygon: poly,
          }));
        }

        // --- Cascada (bajo el inglete): del piso hasta la cara superior del mesón; el canto de arriba baja un espesor
        // por el lado que mira al mesón ---
        ([['inicio', wf.start, piece(start - ct, start, 0, slabDepth), endSide], ['final', wf.end, piece(end, end + ct, 0, slabDepth), startSide]] as const).forEach(([label, on, p, inner]) => {
          if (!on) return;
          boxes.push({
            id: `cascada-${wall}-${index}-${label}`,
            name: `Cascada ${wall}${runs.length > 1 ? ` (${index + 1})` : ''} ${label}`,
            kind: 'counter',
            wall,
            x: p.x, y: p.y, z: 0,
            sx: p.sx, sy: p.sy, sz: counterTop,
            facing: null,
            mitreTop: inner,
          });
        });
      });
    });
  }

  // --- Mesón de las islas y penínsulas: es la medida general que se pidió (largo x ancho), a la altura de sus módulos bajos. Los
  // módulos miden ancho - barra de fondo, así la barra (voladizo del mesón por el frente) queda libre. Con cascada opcional ---
  if (hasCounter && counterThickness > 0) {
    (input.islands ?? []).forEach(isl => {
      const lowers = boxes.filter(bx => bx.kind === 'lower' && bx.islandId === isl.id);
      if (lowers.length === 0) return;
      const islTop = Math.max(...lowers.map(bx => bx.z + bx.sz));
      const islId = `counter-isla-${isl.id}-0`;
      const islExtras = input.counterExtras?.[islId] ?? {};
      // Aberturas de la estufa y la poceta: van centradas en su mueble (Mueble Estufa / Mueble Poceta), igual que en la cocina
      const islandCutouts: Cutout[] = [];
      lowers.forEach(lb => {
        const mod = modules.find(m => m.uniqueId === lb.moduleId);
        const kind = mod?.isStoveCabinet ? 'stove' : mod?.isSinkCabinet ? 'sink' : null;
        const app = kind ? appliances.find(a => a.type === kind) : undefined;
        if (!kind || !app) return;
        const isSink = kind === 'sink';
        const cw = app.width - 2 * (isSink ? SINK_CUTOUT_MARGIN : STOVE_CUTOUT_MARGIN_X);
        const cd = app.depth - 2 * (isSink ? SINK_CUTOUT_MARGIN : STOVE_CUTOUT_MARGIN_Y);
        islandCutouts.push({ label: isSink ? 'Poceta' : 'Estufa', x: lb.x + lb.sx / 2 - cw / 2, y: lb.y + lb.sy / 2 - cd / 2, sx: cw, sy: cd });
      });
      const wfL = !!islExtras.waterfallLeft, wfR = !!islExtras.waterfallRight;
      const islMitre: EdgeCode[] = [...(wfL ? ['x-' as const] : []), ...(wfR ? ['x+' as const] : [])];
      const islEdgePlan = planEdge(islId, 'A', true, islMitre);
      if (islEdgePlan.edge?.kind === 'frentero') islMitre.push(...islEdgePlan.codes);
      boxes.push({
        id: islId,
        name: `Mesón ${isl.kind === 'peninsula' ? 'península' : 'isla'}`,
        kind: 'counter',
        wall: 'A',
        islandId: isl.id,
        x: isl.dx, y: isl.dy,
        z: islTop,
        sx: isl.length, sy: isl.width, sz: counterThickness,
        facing: '+Y',
        cutouts: islandCutouts,
        mitreBottom: islMitre.length ? islMitre : undefined,
      });
      addEdgePieces(islId, 'A', { x: isl.dx, y: isl.dy, sx: isl.length, sy: isl.width, z: islTop, sz: counterThickness }, islEdgePlan, isl.id);
      // Campana de isla: centrada sobre el mueble de la estufa, la campana a 750 mm sobre el mesón y la chimenea hasta el techo
      const estufaIsla = isl.campana ? lowers.find(lb => modules.find(m => m.uniqueId === lb.moduleId)?.isStoveCabinet) : undefined;
      if (estufaIsla) {
        const ancho = Math.max(600, Math.min(900, estufaIsla.sx)), fondo = 600, z0 = islTop + counterThickness + ISLAND_HOOD_GAP;
        boxes.push({
          id: `campana-isla-${isl.id}`, name: `Campana ${isl.kind === 'peninsula' ? 'península' : 'isla'}`, kind: 'appliance', applianceType: 'hood-island', wall: 'A', islandId: isl.id,
          x: estufaIsla.x + estufaIsla.sx / 2 - ancho / 2, y: estufaIsla.y + estufaIsla.sy / 2 - fondo / 2, z: z0, sx: ancho, sy: fondo, sz: Math.max(200, spaceHeight - z0), facing: null,
        });
      }
      // espaldar alistonado: del piso al mesón, contra la parte posterior de los módulos (las puertas miran a la cocina, hacia -Y; atrás queda la barra)
      if (isl.alistonado) {
        const yBackMods = Math.max(...lowers.map(bx => bx.y + bx.sy));
        listonBoxes(`isla-liston-${isl.id}`, isl.alistonado, isl.dx, yBackMods, 0, isl.length, islTop, { islandId: isl.id }, 1).forEach(b => boxes.push(b));
      }
      // Visto o dilatada en un extremo de la isla con frentero o reengruese: pierde la altura de esa pieza y queda al ras
      if (islEdgePlan.edge) {
        const drop = islEdgePlan.edge.kind === 'frentero' ? Math.max(0, islEdgePlan.edge.height - counterThickness) : islEdgePlan.edge.height;
        const fills = boxes.filter(f => f.kind === 'filler' && f.islandId === isl.id && (f.id.startsWith('dilatacion-lower-') || f.id.startsWith('visto-lower-')));
        if (drop > 0 && fills.length > 0) {
          const rowMods = boxes.filter(f => f.kind === 'lower' && f.islandId === isl.id);
          if (rowMods.length > 0) {
            const firstX = Math.min(...rowMods.map(f => f.x)), lastX = Math.max(...rowMods.map(f => f.x + f.sx));
            if (islEdgePlan.codes.includes('x-')) fills.filter(f => f.x + f.sx <= firstX + 0.5).forEach(f => { f.sz = Math.max(10, f.sz - drop); });
            if (islEdgePlan.codes.includes('x+')) fills.filter(f => f.x >= lastX - 0.5).forEach(f => { f.sz = Math.max(10, f.sz - drop); });
          }
        }
      }

      // --- Cascada de la isla o península: dentro de la medida general (el módulo del extremo se acorta un espesor, como en la cocina),
      // del piso al mesón, con inglete a 45°. Vista de frente, la cascada mide arriba el ancho de la isla; la medida inferior es el largo
      // de su canto de abajo: si es menor, la cascada lleva un chaflán por el frente (el canto de abajo retrocede lo que falte) ---
      ([['izquierda', wfL, islExtras.waterfallBottomLeft, isl.dx, 'x+', 1], ['derecha', wfR, islExtras.waterfallBottomRight, isl.dx + isl.length - counterThickness, 'x-', -1]] as const).forEach(([label, on, bottom, cx, inner, dir]) => {
        if (!on) return;
        const chamfer = bottom === undefined ? 0 : Math.max(0, Math.min(isl.width - 100, isl.width - bottom));
        boxes.push({
          id: `cascada-isla-${isl.id}-${label}`,
          name: `Cascada ${isl.kind === 'peninsula' ? 'península' : 'isla'} ${label}`,
          kind: 'counter',
          wall: 'A',
          islandId: isl.id,
          x: cx, y: isl.dy, z: 0,
          sx: counterThickness, sy: isl.width, sz: islTop + counterThickness,
          facing: null,
          mitreTop: inner,
          chamferY: chamfer > 0 ? chamfer : undefined,
        });
      });

      // --- Salpicadero de la isla o península: las mismas reglas del mesón de la cocina. Con el salpicadero activo, va en cada
      // borde del mesón que toca un muro o un módulo más alto que el mesón (la península pegada al muro B lo lleva por ese lado;
      // una isla suelta no lleva). Izquierda/derecha se pueden pedir a mano. Del mismo material y espesor que el mesón ---
      if (splashHeight > 0) {
        const st = counterThickness;
        const top = islTop + counterThickness;
        const x0 = isl.dx, x1 = isl.dx + isl.length, y0 = isl.dy, y1 = isl.dy + isl.width;
        const REACH = 20;
        const crosses = (ob: Box) => (ob.kind === 'wall' || ob.kind === 'tall' || ob.kind === 'appliance') && ob.islandId !== isl.id && ob.z < top - 1 && ob.z + ob.sz > top + 1;
        const ovX = (ob: Box) => Math.min(ob.x + ob.sx, x1) - Math.max(ob.x, x0) > 0.5;
        const ovY = (ob: Box) => Math.min(ob.y + ob.sy, y1) - Math.max(ob.y, y0) > 0.5;
        const touch = (edge: 'x-' | 'x+' | 'y-' | 'y+') => boxes.some(ob => crosses(ob) && (
          edge === 'x-' ? ovY(ob) && ob.x + ob.sx >= x0 - REACH && ob.x + ob.sx <= x0 + 1
            : edge === 'x+' ? ovY(ob) && ob.x >= x1 - 1 && ob.x <= x1 + REACH
              : edge === 'y-' ? ovX(ob) && ob.y + ob.sy >= y0 - REACH && ob.y + ob.sy <= y0 + 1
                : ovX(ob) && ob.y >= y1 - 1 && ob.y <= y1 + REACH));
        const extras = input.counterExtras?.[islId] ?? {};
        const want = {
          left: !wfL && (extras.splashLeft ?? (hasSplash && touch('x-'))),
          right: !wfR && (extras.splashRight ?? (hasSplash && touch('x+'))),
          back: hasSplash && touch('y-'),
          front: hasSplash && touch('y+'),
        };
        const pieces: Array<[string, { x: number; y: number; sx: number; sy: number }]> = [];
        if (want.back) pieces.push(['atrás', { x: x0, y: y0, sx: x1 - x0, sy: st }]);
        if (want.front) pieces.push(['frente', { x: x0, y: y1 - st, sx: x1 - x0, sy: st }]);
        const sy0 = y0 + (want.back ? st : 0), sy1 = y1 - (want.front ? st : 0);
        if (want.left) pieces.push(['izquierda', { x: x0, y: sy0, sx: st, sy: sy1 - sy0 }]);
        if (want.right) pieces.push(['derecha', { x: x1 - st, y: sy0, sx: st, sy: sy1 - sy0 }]);
        pieces.forEach(([label, p]) => boxes.push({
          id: `salpicadero-isla-${isl.id}-${label}`,
          name: `Salpicadero ${isl.kind === 'peninsula' ? 'península' : 'isla'} ${label}`,
          kind: 'counter',
          wall: 'A',
          islandId: isl.id,
          x: p.x, y: p.y, z: top,
          sx: p.sx, sy: p.sy, sz: splashHeight,
          facing: null,
        }));
      }
    });
  }

  // (la función closetDerived está al final del archivo)
  // --- Estructura del closet sobre el muro A: lados (costado propio o marco lateral + dilatada contra el muro), marco horizontal, tapa de riel,
  // base (zócalo o marco inferior) y tablero del maletero. Las medidas salen de los planos (marcos de 80 x 15, dilatada de 15, fondo de 550) ---
  let closetAlertsOut: string[] = [];
  if (closet) {
    type ClosetInput = NonNullable<typeof closet>;
    const E = PANEL_THICKNESS, D = CLOSET_DEPTH, FW = CLOSET_FRAME_WIDTH;
    const Db = Math.max(200, closet.costadoDepth ?? D);  // fondo del costado piso-techo; la base y el zócalo siguen ese fondo
    const Hc = spaceHeight - CLOSET_TOP_MARGIN; // alto del closet: hasta 5 mm bajo el techo
    const bb = zh;                              // alto de la base (zócalo o marco inferior)
    let n = 0;
    const add = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (sx > 0 && sy > 0 && sz > 0) boxes.push({ id: `closet-${n++}`, name, kind: 'panel', wall: 'A', x, y, z, sx, sy, sz, facing: null });
    };
    // Láminas de 2400 mm como máximo: una pieza más larga se divide en dos (la primera de 2400 por defecto y editable; la segunda es lo que falta)
    const hinged = closet.doorType === 'abatibles';   // puertas abatibles de parche: sin riel ni tapa de riel; uniones con costado o marco
    const MAX_SHEET = 2400;
    const addLong = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (sx <= MAX_SHEET) { add(name, x, y, z, sx, sy, sz); return; }
      const first = Math.round(Math.min(MAX_SHEET, Math.max(sx - MAX_SHEET, closet.sheetSplit ?? MAX_SHEET)));
      add(name + ' (1/2)', x, y, z, first, sy, sz);
      add(name + ' (2/2)', x + first, y, z, sx - first, sy, sz);
    };
    const side = (isLeft: boolean) => {
      const hasWall = isLeft ? closet.leftWall : closet.rightWall;
      if (!hasWall) { add('Costado closet', isLeft ? 0 : wallA - E, 0, 0, E, Db, Hc); return; } // costado propio: del piso al tope
      // dilatación de 15 x 15 de piso a techo contra el muro (activa por defecto; si se desactiva la holgura queda sin pieza)
      if (closet.dilatacion !== false) add('Dilatada marco lateral', isLeft ? 0 : wallA - E, D - E, 0, E, E, Hc);
      add('Marco lateral closet', isLeft ? E : wallA - 2 * E, D - FW, bb, E, FW, Hc - bb);       // 80 x 15
    };
    side(true); side(false);
    const x0 = closet.leftWall ? 2 * E : E, x1 = wallA - (closet.rightWall ? 2 * E : E);          // entre lados: 30 por el lado del muro, 15 por el del costado
    const dv = closetDerived(closet, wallA, spaceHeight, hasZocalo, zocaloHeight);
    const topM = dv.maleteroTop;
    const nH = hinged ? dv.doorCount : 0;
    const elems: Array<{ x0: number; x1: number; type: 'costado' | 'marco'; name: string }> = [];
    for (let k = 0; k < nH; k++) {
      const h = closet.doorEdges?.[k]?.hinge ?? (k < nH / 2 ? 'izq' : 'der'), t = closet.doorEdges?.[k]?.type ?? 'costado';
      if (h === 'izq' && k > 0) elems.push({ x0: k * wallA / nH, x1: k * wallA / nH + E, type: t, name: `puerta ${k + 1} inicio` });
      if (h === 'der' && k < nH - 1) elems.push({ x0: (k + 1) * wallA / nH - E, x1: (k + 1) * wallA / nH, type: t, name: `puerta ${k + 1} cierre` });
    }
    // Marco puerta (abatibles): costados y marcos de las puertas suben hasta el techo; con la base completa sobre zócalo arrancan sobre la base y con zócalo en T, marco base al piso
    // o sin marco inferior arrancan del piso. Los marcos superior e inferior se dividen para quedar a tope de ellos
    const baseComplete = hasZocalo && zocaloHeight > 0 && closet.bottomFrame;
    const ceilingCase = hinged;                                   // siempre hasta el techo; con base completa arrancan sobre la base (la base queda entera) y en los demás casos del piso
    const gapsAll: Array<[number, number]> = ceilingCase ? elems.map(u => [u.x0, u.x1] as [number, number]) : [];
    const gapsCostado: Array<[number, number]> = elems.filter(u => u.type === 'costado').map(u => [u.x0, u.x1] as [number, number]);
    const addSplit = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, gaps: Array<[number, number]>) => {
      const segs: Array<[number, number]> = [];
      let cur = x;
      const end = x + sx;
      [...gaps].sort((p, q) => p[0] - q[0]).forEach(([g0, g1]) => { if (g1 <= cur || g0 >= end) return; if (g0 - cur > 1) segs.push([cur, g0]); cur = Math.max(cur, g1); });
      if (end - cur > 1) segs.push([cur, end]);
      if (segs.length === 1 && Math.abs(segs[0][0] - x) < 0.5 && Math.abs(segs[0][1] - end) < 0.5) { addLong(name, x, y, z, sx, sy, sz); return; }
      // el conjunto de la puerta se llama marco puerta (superior e inferior)
      const nm = name === 'Marco hor closet' ? 'Marco puerta superior' : name === 'Base marco hor closet' ? 'Marco puerta inferior' : name;
      segs.forEach(([a0, a1], i) => addLong(nm + ` [${i + 1}]`, a0, y, z, a1 - a0, sy, sz));
    };
    // Marco horizontal: acostado (80 de ancho, 15 de espesor), al tope del marco: a ras con la parte de arriba de los marcos laterales y con su frente
    addSplit('Marco hor closet', x0, D - FW, Hc - E, x1 - x0, FW, E, gapsAll);
    // Tapa de riel (se activa o se desactiva y se pregunta su altura): siempre parada adelante del marco
    const tapaH = Math.max(20, closet.tapaRielHeight ?? CLOSET_RAIL_COVER);
    if (closet.tapaRiel !== false && !hinged) addLong('Tapa riel closet', 0, D, Hc - tapaH, wallA, E, tapaH);
    // Base: entre el muro y el costado (sin pasar por el costado)
    const bx0 = closet.leftWall ? 0 : E, bx1 = closet.rightWall ? wallA : wallA - E;
    if (hasZocalo && zocaloHeight > 0) {
      // La base va encima del zócalo (sugerido de 80 mm): el zócalo es la pieza parada y sobre él va la base (o la pieza acostada de la T)
      if (closet.bottomFrame) {
        // Zócalo con marco inferior (base completa): el zócalo va al frente, a ras con el frente de la base
        addLong('Zócalo closet', bx0, Db - E, 0, bx1 - bx0, E, zocaloHeight);
        addLong('Base closet', bx0, 0, zocaloHeight, bx1 - bx0, Db, E);
      } else {
        // Zócalo sin marco inferior (tipo T): la acostada queda corrida a 5 mm del frente y la pieza parada va centrada bajo ella
        addSplit('Zócalo closet', bx0, D - 5 - FW / 2 - E / 2, 0, bx1 - bx0, E, zocaloHeight, gapsAll);
        addSplit('Zócalo closet (horizontal)', bx0, D - 5 - FW, zocaloHeight, bx1 - bx0, FW, E, gapsAll);
      }
    } else if (!hasZocalo && closet.bottomFrame) {
      addSplit('Base marco hor closet', bx0, 0, 0, bx1 - bx0, Db, E, gapsAll);
    }
    // Maletero: tablero de 455 de fondo; queda a la menor de 1.90 m o (techo - 350 mm); con puertas abatibles se corta alrededor de los costados
    addSplit('Maletero closet', closet.leftWall ? 0 : E, 0, topM - E, bx1 - bx0, CLOSET_MALETERO_DEPTH, E, gapsCostado);

    // --- Interior (según los planos de cajoneros): cajonero con dos laterales de 430 de fondo, la tapa POR ENCIMA de los laterales (de todo el ancho y
    // 450 de fondo) y los cajones; sobre la tapa, dos costados y los entrepaños DENTRO de esos dos costados; tubos para colgar en las zonas libres ---
    const inner = x1 - x0;                                        // ancho entre los lados
    // Puertas abatibles de parche: N puertas iguales. Cada puerta es izquierda o derecha (lado de la bisagra): ese lado lleva su propio costado o marco
    // (no se comparte con otra puerta) y el otro lado queda libre; así una puerta izquierda y una derecha juntas dejan el centro libre.
    // Los extremos del closet salen del Espacio (marco con muro, costado sin muro) y la puerta cubre 13 mm de ellos.
    const CAJ_CLEAR = 40;                                         // junto a un costado el cajonero deja 4 cm por lado
    const obstacles = elems.filter(u => u.type === 'costado').map(u => [u.x0 - CAJ_CLEAR, u.x1 + CAJ_CLEAR] as [number, number]);
    const alerts: string[] = [];
    const narizH = Math.max(15, closet.narizAlto ?? 40);          // nariz: tira de 15 de espesor y 40 de alto (sugerido) por debajo del tablero, con el canto del tablero a ras con su cara
    closetAlertsOut = alerts;
    // Un cajonero con sus laterales, puentes, cajones, costados y entrepaños. Con dos cajoneros se arma una vez por cada uno (el segundo con sus propias medidas)
    const buildCajonero = (closet: ClosetInput, dv: ReturnType<typeof closetDerived>, sfx: string, xcFixed?: number, maxW?: number) => {
      const addC = (name: string, ...rest: [number, number, number, number, number, number]) => add(name + sfx, ...rest);
      // Cajonero al lado del marco (lado con muro): la tapa se alarga 45 mm hasta quedar al ras del marco y una dilatación tapa el hueco que se forma
      const dilW = (closet.cajoneroPos === 'left' && closet.leftWall) || (closet.cajoneroPos === 'right' && closet.rightWall) ? CLOSET_CAJONERO_DIL : 0;
      const Wc0 = Math.min(Math.max(300, dv.cajoneroWidth), maxW ?? inner - dilW);
      // El conjunto (dilatación + cajonero) arranca en el muro, detrás del marco (el marco solo enmarca el frente): al ras del muro
      const wallL = closet.leftWall ? x0 - 2 * E : x0, wallR = closet.rightWall ? x1 + 2 * E : x1;
      const xc0 = xcFixed != null ? xcFixed : closet.cajoneroPos === 'left' ? (dilW ? wallL + dilW : x0) : closet.cajoneroPos === 'right' ? (dilW ? wallR - dilW - Wc0 : x1 - Wc0) : Math.min(Math.max(wallA / 2 - Wc0 / 2, x0), x1 - Wc0); // el centro es el del muro (y de la puerta central), no el del maletero ni el de lo que quede libre
      let Wc = Wc0, xc = xc0;
      if (obstacles.length) {
        // el cajonero no puede quedar a menos de 4 cm de un costado: se corre y, si no cabe, se angosta (con aviso)
        const sorted: Array<[number, number]> = [];
        [...obstacles].sort((p, q) => p[0] - q[0]).forEach(([a0, a1]) => {  // los costados juntos (dos puertas) se funden en un solo obstáculo
          const last = sorted[sorted.length - 1];
          if (last && a0 <= last[1]) last[1] = Math.max(last[1], a1); else sorted.push([a0, a1]);
        });
        const bays: Array<[number, number]> = [];
        let cur0 = x0;
        sorted.forEach(([a0, a1]) => { bays.push([cur0, a0]); cur0 = a1; });
        bays.push([cur0, x1]);
        const mid = xc0 + Wc0 / 2;
        const bay = bays.reduce((best, q) => (Math.abs((q[0] + q[1]) / 2 - mid) < Math.abs((best[0] + best[1]) / 2 - mid) ? q : best), bays[0]);
        Wc = Math.max(200, Math.min(Wc0, bay[1] - bay[0]));
        xc = Math.min(Math.max(xc0, bay[0]), Math.max(bay[0], bay[1] - Wc));
        if (Math.abs(xc - xc0) > 0.5 || Math.abs(Wc - Wc0) > 0.5) alerts.push(`El cajonero${sfx ? ' 2' : ''} se corrió o se angostó para dejar 4 cm junto a un costado de las puertas`);
      }
      const Dc = Math.max(300, Math.min(500, closet.cajoneroDepth ?? CLOSET_INTERIOR_DEPTH));                             // la tapa y los costados de arriba: 450 de fondo (adelante quedan los rieles de las puertas)
      const Dl0 = Dc - 20;                        // entrepaños y laterales del cajonero: 430
      const embebido = closet.cajonFront === 'embebido';           // frente embebido: el lateral se alarga 15 mm y su canto queda al ras del frente
      const Dl = Dl0 + (embebido ? E : 0);                          // laterales del cajonero
      const nDrawers = dv.drawerCount;
      const gapF = CLOSET_DRAWER_GAP;
      const z0 = dv.cajBase;                                        // tipo T: el cajonero baja al piso; con base se apoya en ella
      // El cajonero se sugiere a 800 mm del piso (cara de arriba) y los frentes no pasan de 200 mm de alto: si con los cajones pedidos los frentes
      // pasarían de 200, el cajonero queda más bajo. El cajón de abajo deja 40 mm sobre la cara de arriba de la base; arriba queda aire y la tapa
      // 30 mm entre frentes para meter la mano; el frente de arriba llega hasta la cara de abajo de la tapa y su frente queda a ras con el de la tapa
      const Hf = dv.drawerFront, Hcj = dv.cajoneroHeight;
      const colTop = topM - E;                                      // cara de abajo del tablero del maletero
      // Cajonero a un extremo: el costado de los entrepaños de ese lado (junto al muro con marco y dilatada, o junto al costado del closet) se puede quitar y los entrepaños se alargan hasta allá
      const dropL = closet.cajoneroPos === 'left' && (closet.costadoLeft === false || closet.sideCostado === false);
      const dropR = closet.cajoneroPos === 'right' && (closet.costadoRight === false || closet.sideCostado === false);
      // Costumbre colombiana: con frentes embebidos y el cajonero junto a un costado del closet (lado sin muro) se puede quitar el lateral de ese lado
      // y amarrar las correderas al costado: 13 mm del cajón al costado (medida técnica de la corredera) y 3 mm entre el costado y el frente
      const sinLat = embebido && closet.sinLateral === true && ((closet.cajoneroPos === 'left' && !closet.leftWall) || (closet.cajoneroPos === 'right' && !closet.rightWall));
      const latL = !(sinLat && closet.cajoneroPos === 'left'), latR = !(sinLat && closet.cajoneroPos === 'right');
      // Laterales hasta el maletero (solo embebido y con entrepaños): hacen de costados de los entrepaños y la tapa queda entre ellos
      const raised = closet.lateralesAlMaletero === true && closet.shelvesOn !== false && colTop - (z0 + Hcj) > 100;
      const raiseL = raised && latL && !dropL, raiseR = raised && latR && !dropR;
      if (latL) addC('Lateral cajonero izquierdo', xc, 0, z0, E, Dl, raiseL ? colTop - z0 : Hcj - E);
      if (latR) addC('Lateral cajonero derecho', xc + Wc - E, 0, z0, E, Dl, raiseR ? colTop - z0 : Hcj - E);
      const eL = latL ? E : 0, eR = latR ? E : 0;
      // Puente amarre de 70 mm al frente, sobre la base: tapa el hueco que queda bajo el cajón de abajo (retrocedido 15 mm del frente de los laterales para que no choque)
      // Puentes internos del cajonero (principio del oficio: 2 laterales y 5 puentes), entre los dos laterales y de 70 mm:
      // 2 arriba (acostados bajo la tapa, uno adelante y otro atrás, juntan la tapa), 2 atrás (parados contra el muro, uno arriba y otro abajo, para instalar) y 1 inferior frontal
      const PW = CLOSET_CAJONERO_PUENTE, bx = xc + eL, bwid = Wc - eL - eR, zTopC = z0 + Hcj - E;
      addC('Puente superior frontal cajonero', bx, Dl - PW - E, zTopC - E, bwid, PW, E);
      addC('Puente superior trasero cajonero', bx, E, zTopC - E, bwid, PW, E);
      addC('Puente trasero superior cajonero', bx, 0, zTopC - E - PW, bwid, E, PW);
      addC('Puente trasero inferior cajonero', bx, 0, z0, bwid, E, PW);
      // El inferior frontal: parado sobre la base si el cajón de abajo deja 70 mm o menos (puente amarre); si el hueco es mayor, va acostado justo bajo el cajón de abajo
      // (con el cajonero flotado este puente pasa a ser la base: pendiente)
      // Solo se pone cuando el cajón de abajo deja menos de 70 mm entre su frente y la base; si el hueco es mayor, no lleva
      const gapBajo = Hcj - E - nDrawers * Hf - (nDrawers - 1) * gapF;
      if (nDrawers > 0 && gapBajo <= CLOSET_CAJONERO_PUENTE) addC('Puente amarre cajonero', bx, Dl - 2 * E, z0, bwid, E, CLOSET_CAJONERO_PUENTE);
      else if (nDrawers > 0) addC('Puente inferior frontal cajonero', bx, Dl - PW - E, z0 + gapBajo - E, bwid, PW, E);
      // Zócalo tipo T: un puente vertical al frente del cajonero, del piso hasta el puente acostado (tapa el espacio de abajo)
      if (hasZocalo && !closet.bottomFrame && nDrawers > 0 && gapBajo > CLOSET_CAJONERO_PUENTE) addC('Puente vertical cajonero', bx, Dl - 2 * E, z0, bwid, E, gapBajo - E);
      {
        // La tapa va por encima de los laterales; si un lateral sube hasta el maletero, la tapa se reduce ese espesor y queda entre los laterales
        const tL = closet.cajoneroPos === 'left' ? xc - dilW : xc, tR = tL + Wc + dilW;
        const t0 = raiseL ? xc + E : tL, t1 = raiseR ? xc + Wc - E : tR;
        addC('Tapa cajonero', t0, 0, z0 + Hcj - E, t1 - t0, Dc, E);
        if (raiseL && dilW > 0 && closet.cajoneroPos === 'left') addC('Tapa cajonero', tL, 0, z0 + Hcj - E, dilW, Dc, E); // la franja de la dilatación sigue cubierta
        if (raiseR && dilW > 0 && closet.cajoneroPos === 'right') addC('Tapa cajonero', xc + Wc, 0, z0 + Hcj - E, dilW, Dc, E);
      }
      // (la tapa ya está puesta arriba) // la tapa va por encima de los laterales, del ancho completo (y los 45 mm de la dilatación)
      if (dilW > 0) addC('Dilatación lateral cajonero', closet.cajoneroPos === 'left' ? xc - dilW : xc + Wc, Dl - E, z0, dilW, E, Hcj - E); // a ras del costado (lateral) del cajonero: su frente queda en el mismo plano
      for (let i = 0; i < nDrawers; i++) {
        // Los cajones van pegados a la tapa (el de arriba al ras de la tapa); si sobra altura, el hueco queda abajo, sobre la base
        const zf = z0 + Hcj - E - (nDrawers - i) * Hf - (nDrawers - 1 - i) * gapF;
        const frontY = embebido ? Dl - E : Dc - E;
        if (embebido) addC(`Frente cajón ${i + 1}`, xc + eL + 3, frontY, zf, Wc - eL - eR - 6, E, Hf); // embebido: ancho interno - 6 mm
        else addC(`Frente cajón ${i + 1}`, xc + 4, frontY, zf, Wc - 8, E, Hf);                      // de parche: adelante de los laterales
        const bw = Wc - eL - eR - 26, bxl = xc + eL + 13, yb = frontY - 400, zb = zf + 20, hb = Math.max(80, Hf - 60); // caja del cajón: luz de 13 por lado, 400 de fondo; 60 mm más baja que el frente
        addC(`Cajón ${i + 1} lateral izquierdo`, bxl, yb, zb, E, 400, hb);
        addC(`Cajón ${i + 1} lateral derecho`, bxl + bw - E, yb, zb, E, 400, hb);
        addC(`Cajón ${i + 1} testero frontal`, bxl + E, yb + 400 - E, zb, bw - 2 * E, E, hb);
        addC(`Cajón ${i + 1} testero trasero`, bxl + E, yb, zb, bw - 2 * E, E, hb);
        addC(`Cajón ${i + 1} fondo`, bxl + E, yb + E, zb + 10, bw - 2 * E, 400 - 2 * E, PANEL_BACK - 2);
      }
      const leftZone = xc - x0 > 1, rightZone = x1 - (xc + Wc) > 1;
      const zt = z0 + Hcj;                                          // cara de arriba de la tapa del cajonero
      if (closet.shelvesOn !== false && colTop - zt > 100) {
        // Sobre la tapa: dos costados (siempre, también contra el lado del closet) y los entrepaños dentro de ellos, cada ~315 mm hasta cerca del maletero
        // Cajonero a un extremo: el costado junto al lado del closet se puede quitar (se pregunta); entonces los entrepaños se alargan hasta el largo de la tapa
        if (!dropL && !raiseL && latL) addC('Costado entrepaños izquierdo', xc, 0, zt, E, Dl, colTop - zt);
        if (!dropR && !raiseR && latR) addC('Costado entrepaños derecho', xc + Wc - E, 0, zt, E, Dl, colTop - zt);
        const tapaX0 = closet.cajoneroPos === 'left' ? xc - dilW : xc, tapaX1 = tapaX0 + Wc + dilW;
        // sin lateral o sin costado de entrepaños en ese lado: los entrepaños llegan al ras (del costado del closet o del muro)
        const shX0 = dropL || !latL ? tapaX0 : xc + E;
        const shX1 = dropR || !latR ? tapaX1 : xc + Wc - E;
        // Los entrepaños (cantidad que se pregunta) se reparten el espacio entre la tapa del cajonero y el maletero: los huecos quedan iguales
        const nSh = dv.shelfCount, gapS = (colTop - zt - nSh * E) / (nSh + 1);
        for (let i = 0; i < nSh; i++) {
          const dSh = embebido ? Dl0 : Dl - 20, zSh = zt + gapS * (i + 1) + E * i;
          // con nariz: la nariz va por debajo del entrepaño y el canto del entrepaño queda a ras con su cara (el entrepaño se alarga 15 mm)
          addC('Entrepaño closet', shX0, 0, zSh, shX1 - shX0, dSh + (closet.narizEntrepanos ? E : 0), E);
          if (closet.narizEntrepanos) addC('Nariz entrepaño closet', shX0, dSh, zSh - narizH, shX1 - shX0, E, narizH);
        } // de parche: los entrepaños quedan 2 cm detrás del frente de los laterales
      }
      return { xc, Wc, Dc, dilW, Hcj, z0, Dl, embebido };
    };
    const two = closet.twoCajoneros === true;
    const GAP_C = 60;                                             // dilatada central para el traslape de las puertas (dos cajoneros al centro)
    const mkCfg = (over: Partial<ClosetConfig> | undefined, pos: 'left' | 'center' | 'right') => {
      const cl = { ...closet, ...(over ?? {}), cajoneroPos: pos } as ClosetInput;
      return { cl, dvK: closetDerived(cl, wallA, spaceHeight, hasZocalo, zocaloHeight) };
    };
    const placed: Array<{ xc: number; Wc: number; Dc: number }> = [];
    let torreSpan: { xT: number; Wt: number } | null = null;
    // Posición libre del cajonero (distancia desde la izquierda) y centro del muro, siempre dentro del espacio disponible
    const freeOn = !two && closet.cajoneroX != null;
    const clampX = (v: number, a0: number, a1: number, W: number) => Math.min(Math.max(v, a0), Math.max(a0, a1 - W));
    const xFree = (a0: number, a1: number, W: number) => clampX(x0 + (closet.cajoneroX ?? 0), a0, a1, W);
    const xMid = (a0: number, a1: number, W: number) => clampX(wallA / 2 - W / 2, a0, a1, W);
    if (closet.torreOn === true) {
      // Torre de entrepaños: ocupa un lado (o el centro) y el cajonero se acomoda en el espacio que queda
      const cp = closet.cajoneroPos, tp = closet.torrePos ?? 'left';
      // Segunda torre en el extremo opuesto (no con la primera al centro)
      const t2On = closet.torre2On === true && tp !== 'center';
      const clT2 = { ...closet, ...(closet.torre2 ?? {}) } as ClosetInput;
      const dvT2 = closetDerived(clT2, wallA, spaceHeight, hasZocalo, zocaloHeight);
      const minRest = two ? 700 : 300;
      const Wt = Math.min(dv.torreWidth, inner - minRest - (t2On ? 300 : 0));
      const Wt2 = t2On ? Math.min(dvT2.torreWidth, inner - Wt - minRest) : 0;
      let xT2 = 0;
      // La torre del lado de un muro queda pegada al muro (detrás del marco lateral y la dilatada), no contra el marco
      const tL = closet.leftWall ? x0 - 2 * E : x0, tR = closet.rightWall ? x1 + 2 * E : x1;
      const capW = (a: number) => Math.min(Math.max(300, dv.cajoneroWidth), a);
      const o2Width = () => closetDerived({ ...closet, ...(closet.cajonero2 ?? {}), cajoneroPos: 'center' } as ClosetInput, wallA, spaceHeight, hasZocalo, zocaloHeight).cajoneroWidth;
      let xT = x0, xcF: number | undefined, maxW: number | undefined, posUse = cp;
      let second: { xcF?: number; maxW: number; pos: 'left' | 'center' | 'right' } | null = null;
      if (t2On) {
        // Dos torres, una en cada extremo: los cajoneros quedan entre ellas (el primero junto a la primera torre)
        const a0 = tp === 'left' ? tL + Wt : tL + Wt2, a1 = tp === 'left' ? tR - Wt2 : tR - Wt;
        xT = tp === 'left' ? tL : tR - Wt; xT2 = tp === 'left' ? tR - Wt2 : tL;
        posUse = 'center';
        if (two) { const each = (a1 - a0) / 2; const W2 = Math.min(Math.max(300, o2Width()), each); xcF = a0; maxW = each; second = { xcF: a1 - W2, maxW: each, pos: 'center' }; }
        else { const W = capW(a1 - a0); xcF = freeOn ? xFree(a0, a1, W) : cp === 'left' ? a0 : cp === 'right' ? a1 - W : xMid(a0, a1, W); maxW = a1 - a0; }
      } else if (two) {
        // Torre y dos cajoneros: el primero queda junto a la torre y el segundo en el otro extremo (con la torre al centro, uno a cada lado)
        const each = (tp === 'right' ? tR - Wt - x0 : tp === 'left' ? x1 - (tL + Wt) : inner - Wt) / 2, W1 = capW(each);
        if (tp === 'left') { xT = tL; xcF = tL + Wt; posUse = 'center'; maxW = each; second = { maxW: each - (closet.rightWall ? CLOSET_CAJONERO_DIL : 0), pos: 'right' }; }
        else if (tp === 'right') { xT = tR - Wt; xcF = tR - Wt - W1; posUse = 'center'; maxW = each; second = { maxW: each - (closet.leftWall ? CLOSET_CAJONERO_DIL : 0), pos: 'left' }; }
        else { xT = x0 + each; xcF = xT - W1; posUse = 'center'; maxW = each; second = { xcF: xT + Wt, maxW: each, pos: 'center' }; }
      } else if (tp === 'left') {
        xT = tL;
        const av = x1 - (tL + Wt);
        if (cp === 'right' && !freeOn) maxW = av - (closet.rightWall ? CLOSET_CAJONERO_DIL : 0);
        else { const W = capW(av); xcF = freeOn ? xFree(tL + Wt, x1, W) : cp === 'left' ? tL + Wt : xMid(tL + Wt, x1, W); maxW = av; posUse = 'center'; }
      } else if (tp === 'right') {
        xT = tR - Wt;
        const av = tR - Wt - x0;
        if (cp === 'left' && !freeOn) maxW = av - (closet.leftWall ? CLOSET_CAJONERO_DIL : 0);
        else { const W = capW(av); xcF = freeOn ? xFree(x0, tR - Wt, W) : cp === 'right' ? tR - Wt - W : xMid(x0, tR - Wt, W); maxW = av; posUse = 'center'; }
      } else if (cp === 'center') {
        const W = capW(inner - Wt);
        xT = x0 + (inner - Wt - W) / 2; xcF = xT + Wt; maxW = inner - Wt; posUse = 'center';
      } else {
        xT = x0 + (inner - Wt) / 2; maxW = (inner - Wt) / 2 - (cp === 'left' ? (closet.leftWall ? CLOSET_CAJONERO_DIL : 0) : (closet.rightWall ? CLOSET_CAJONERO_DIL : 0));
      }
      const o = mkCfg(undefined, posUse);
      placed.push(buildCajonero(o.cl, o.dvK, '', xcF, maxW));
      if (second) { const o2 = mkCfg(closet.cajonero2, second.pos); placed.push(buildCajonero(o2.cl, o2.dvK, ' · 2', second.xcF, second.maxW)); }
      // Torres: dos laterales y, entre ellos, columnas iguales separadas por divisiones (de la altura de los laterales y la profundidad de los entrepaños)
      const buildTorre = (cl: ClosetInput, dvT: ReturnType<typeof closetDerived>, xT: number, Wt: number, sfx: string, side: 'left' | 'center' | 'right') => {
        const Dct = Math.max(300, Math.min(500, cl.torreDepth ?? CLOSET_INTERIOR_DEPTH));
        const Dlt = Dct - 20, Dst = Dlt - 20;
        const zbT = dvT.cajBase, topT = dvT.torreTop, baseS = dvT.baseH;
        // Junto a un costado del closet (lado sin muro) se puede quitar el lateral de ese lado: el costado hace de lateral y los entrepaños llegan a él
        const sinL = cl.torreSinLateral === true && side === 'left' && !closet.leftWall, sinR = cl.torreSinLateral === true && side === 'right' && !closet.rightWall;
        const eL = sinL ? 0 : E, eR = sinR ? 0 : E;
        if (!sinL) add('Lateral torre izquierdo' + sfx, xT, 0, zbT, E, Dlt, topT - zbT);
        if (!sinR) add('Lateral torre derecho' + sfx, xT + Wt - E, 0, zbT, E, Dlt, topT - zbT);
        const nD = dvT.torreDivisions, colW = (Wt - eL - eR - nD * E) / (nD + 1);
        for (let k = 0; k < nD; k++) add('División torre' + sfx, xT + eL + (k + 1) * colW + k * E, 0, zbT, E, Dst, topT - zbT);
        const nS = dvT.torreShelves, gapT = (topT - baseS - nS * E) / (nS + 1);
        for (let k = 0; k <= nD; k++) for (let i = 0; i < nS; i++) {
          const zSh = baseS + gapT * (i + 1) + E * i;
          add('Entrepaño torre' + sfx, xT + eL + k * (colW + E), 0, zSh, colW, Dst + (closet.narizEntrepanos ? E : 0), E);
          if (closet.narizEntrepanos) add('Nariz entrepaño torre' + sfx, xT + eL + k * (colW + E), Dst, zSh - narizH, colW, E, narizH);
        }
        placed.push({ xc: xT, Wc: Wt, Dc: Dct });
        // Hasta el techo: la torre atraviesa el maletero, que se corta en su ancho
        if (cl.torreToCeiling) {
          const hit = boxes.filter(q => q.name.startsWith('Maletero closet') && q.x < xT + Wt && q.x + q.sx > xT);
          hit.forEach(m => {
            const mx0 = m.x, mx1 = m.x + m.sx, c0 = Math.max(mx0, xT), c1 = Math.min(mx1, xT + Wt);
            const parts: Array<[number, number]> = [];
            if (c0 - mx0 > 1) parts.push([mx0, c0]);
            if (mx1 - c1 > 1) parts.push([c1, mx1]);
            boxes.splice(boxes.indexOf(m), 1);
            parts.forEach(([p0, p1]) => add('Maletero closet', p0, m.y, m.z, p1 - p0, m.sy, m.sz));
          });
        }
      };
      buildTorre(closet, dv, xT, Wt, '', tp);
      if (t2On) buildTorre(clT2, dvT2, xT2, Wt2, ' · T2', tp === 'left' ? 'right' : 'left');
    } else if (!two) {
      const o = mkCfg(undefined, freeOn ? 'center' : closet.cajoneroPos);
      if (freeOn) { const W = Math.min(Math.max(300, o.dvK.cajoneroWidth), inner); placed.push(buildCajonero(o.cl, o.dvK, '', xFree(x0, x1, W), inner)); }
      else placed.push(buildCajonero(o.cl, o.dvK, ''));
    } else if (closet.twoPlacement === 'extremos') {
      const o1 = mkCfg(undefined, 'left'), o2 = mkCfg(closet.cajonero2, 'right');
      placed.push(buildCajonero(o1.cl, o1.dvK, '', undefined, inner / 2 - GAP_C));
      placed.push(buildCajonero(o2.cl, o2.dvK, ' · 2', undefined, inner / 2 - GAP_C));
    } else {
      const o1 = mkCfg(undefined, 'center'), o2 = mkCfg(closet.cajonero2, 'center');
      const cap = (inner - GAP_C) / 2;
      const w1 = Math.min(Math.max(300, o1.dvK.cajoneroWidth), cap), w2 = Math.min(Math.max(300, o2.dvK.cajoneroWidth), cap);
      const xA = x0 + (inner - (w1 + GAP_C + w2)) / 2;
      const r1 = buildCajonero(o1.cl, o1.dvK, '', xA, cap);
      const r2 = buildCajonero(o2.cl, o2.dvK, ' · 2', xA + w1 + GAP_C, cap);
      placed.push(r1, r2);
      // Dilatada central de 6 cm: tapa el hueco entre los dos cajoneros y sirve de apoyo al traslape de las puertas; va desde la base hasta el maletero
      add('Dilatada central cajonero', xA + w1, r1.Dl - E, r1.z0, GAP_C, E, topM - E - r1.z0); // sube hasta el maletero
    }
    const dilTop = topM - E;
    // --- Puertas corredizas: ancho = (marco horizontal + (n - 1) x traslape) / n, alto = espacio libre - 20; van en dos rieles (adelante y atrás) y se alternan ---
    const nDoors = dv.doorCount, dw = dv.doorWidth, DT = 18;
    if (hinged) {
      // Abatibles de parche: puertas iguales entre los bordes del closet; las uniones llevan costado o marco; cada puerta cubre el borde de los extremos y deja 2 mm con la vecina
      const g = closet.doorGap ?? 2, cov = closet.doorCover ?? 13;
      for (let k = 0; k < nDoors; k++) {
        const l = k === 0 ? x0 - cov : k * wallA / nDoors + g / 2, r = k === nDoors - 1 ? x1 + cov : (k + 1) * wallA / nDoors - g / 2;
        add(`Puerta abatible ${k + 1}`, l, D, bb, r - l, DT, dv.doorHeight);
      }
      elems.forEach(u => {
        // Marco puerta: entre la base y el marco superior (base completa) o del piso al techo (T, marco al piso o sin marco inferior)
        const zC = baseComplete ? bb : 0, hC = Hc - zC;
        if (u.type === 'costado') add(`Costado ${u.name}`, u.x0, 0, zC, u.x1 - u.x0, D, hC);
        else add(`Marco ${u.name}`, u.x0, D - FW, zC, u.x1 - u.x0, FW, hC);
      });
    }
    for (let i = 0; i < (hinged ? 0 : nDoors); i++) {
      // 3 puertas: una adelante (la del centro) y dos atrás; con cantidad par se alternan empezando por la de adelante
      const front = nDoors % 2 === 1 ? i % 2 === 1 : i % 2 === 0;
      add(`Puerta corrediza ${i + 1}`, x0 + i * (dw - closet.overlap), front ? D - 28 : D - 53, bb + 10, dw, DT, dv.doorHeight);
    }
    // Tubos para colgar en las zonas libres (entre y alrededor de los cajoneros): el primero 40 mm bajo el maletero y el segundo a 900 mm del piso
    const spans = [...placed.map(r => [r.xc, r.xc + r.Wc] as const), ...elems.filter(u => u.type === 'costado').map(u => [u.x0, u.x1] as const)].sort((p, q) => p[0] - q[0]);
    const zones: Array<[number, number]> = [];
    let cur = x0;
    spans.forEach(([s0, s1]) => { zones.push([cur, s0]); cur = s1; });
    zones.push([cur, x1]);
    zones.forEach(([zx0, zx1]) => {
      if (zx1 - zx0 < 200) return;
      add('Tubo colgar superior', zx0, placed[0].Dc / 2 - 12, dilTop - 40 - 25, zx1 - zx0, 25, 25);
      if (900 + 12 < dilTop - 40 - 25 - 200) add('Tubo colgar inferior', zx0, placed[0].Dc / 2 - 12, 900 - 12, zx1 - zx0, 25, 25);
    });
  }

  // Nariz del maletero: el tablero (455) llega a 470 con la nariz al frente
  if (closet && closet.narizMaletero) {
    const nh = Math.max(15, closet.narizAlto ?? 40);
    // la nariz va por debajo del tablero y el canto del tablero queda a ras con su cara: el tablero se alarga 15 mm (455 a 470)
    boxes.filter(m => m.name.startsWith('Maletero closet')).forEach(m => { boxes.push({ id: `${m.id}-nariz`, name: 'Nariz maletero', kind: 'panel', wall: 'A', x: m.x, y: m.y + m.sy, z: m.z - nh, sx: m.sx, sy: PANEL_THICKNESS, sz: nh, facing: null }); m.sy += PANEL_THICKNESS; });
  }
  // Closet fit: un cubo que cubre el área y, dentro, los cuerpos inferiores (uno al lado del otro) y los superiores.
  // Se arma en un marco local (x a lo largo del muro, y fondo desde el muro) con el prefijo `pre`; los muros B y C se giran después
  const buildFitCube = (f: ClosetFit, wallA: number, pre: string, boxes: Box[], zExt = 0) => {
    const Hf = fitTop(f, spaceHeight), dpt = Math.max(200, f.depth);
    const nLow = Math.max(1, Math.round(f.lowerBodies)), nUp = Math.max(0, Math.round(f.upperBodies));
    const upH = nUp > 0 ? Math.min(Math.max(100, f.upperHeight), Hf - 1) : 0;
    const put = (id: string, name: string, x: number, z: number, sx: number, sz: number, depth = dpt) => boxes.push({ id, name, kind: 'panel', wall: 'A', x, y: 0, z, sx, sy: depth, sz, facing: null });
    const ins = fitInsets(f, wallA);
    put(`${pre}cubo`, 'Cubo closet fit', ins.left, 0, wallA - ins.left - ins.right, Hf);
    // dilatación de 15 x 15 de piso a techo junto a cada muro (al frente del cubo)
    const dilPut = (id: string, x: number) => boxes.push({ id, name: 'Dilatación closet fit', kind: 'panel', wall: 'A', x, y: dpt - PANEL_THICKNESS, z: 0, sx: PANEL_THICKNESS, sy: PANEL_THICKNESS, sz: Hf, facing: null });
    // la dilatación solo va si el mueble llega hasta ese muro (en el baño puede quedar separado)
    if (ins.dl > 0 && ins.left <= ins.dl) dilPut(`${pre}dil-izq`, 0);
    if (ins.dr > 0 && ins.right <= ins.dr) dilPut(`${pre}dil-der`, wallA - PANEL_THICKNESS);
    const rows = fitRows(f, wallA);
    const cells = fitCells(f, wallA, spaceHeight);
    // zócalo del cubo: subensamble en forma de escalera (dos largueros a lo largo, delante y detrás, y travesaños entre ellos)
    if (f.zocalo?.on && f.zocalo.alto > 0 && !f.flotado?.on) {
      const zc = f.zocalo, cw = wallA - ins.left - ins.right, E2 = PANEL_THICKNESS;
      const depthZ = Math.max(3 * E2, Math.min(zc.fondo, dpt - 30));  // regla: el zócalo es menos profundo que el fondo de los módulos, 30 mm como mínimo
      const yBack = 0;                                              // el zócalo va siempre pegado al muro
      const yFront = yBack + depthZ - E2;
      const zp = (id: string, name: string, x: number, y: number, sx: number, sy: number) => boxes.push({ id, name, kind: 'panel', wall: 'A', x, y, z: 0, sx, sy, sz: zc.alto, facing: null } as Box);
      zp(`${pre}zoc-lf`, 'Zócalo largero fit', ins.left - zExt, yFront, cw + zExt, E2);
      zp(`${pre}zoc-lb`, 'Zócalo largero fit', ins.left - zExt, yBack, cw + zExt, E2);
      const nT = Math.max(0, Math.round(zc.travesanos));
      for (let k = 0; k < nT; k++) {
        const tx = nT === 1 ? ins.left - zExt + (cw + zExt - E2) / 2 : ins.left - zExt + ((cw + zExt - E2) * k) / (nT - 1);
        zp(`${pre}zoc-t${k}`, 'Zócalo travesaño fit', tx, yBack + E2, E2, depthZ - 2 * E2);
      }
    }
    // alcance horizontal de un marco puerta: hacia cada lado llega hasta el muro, o hasta el siguiente módulo configurado de su fila
    const colX = (row: number[]) => { let a = ins.left; return row.map(w => { const r = a; a += w; return r; }); };
    const spanOf = (low: boolean, i: number): [number, number] => {
      const row = low ? rows.lower : rows.upper, xs = colX(row), px = low ? `${pre}inf-` : `${pre}sup-`;
      const has = (c: number) => Object.keys(f.bodies ?? {}).some(k => k.startsWith(`${px}${c}-`));
      let l = ins.left, r = wallA - ins.right;
      for (let c = i - 1; c >= 0; c--) if (has(c)) { l = xs[c] + row[c]; break; }
      for (let c = i + 1; c < row.length; c++) if (has(c)) { r = xs[c]; break; }
      return [l, r];
    };
    // un cuerpo (celda) puede dividirse en varios lado a lado sin tocar el resto de su columna (`subs`): cada parte es un cuerpo independiente
    const emitCell = (low: boolean, i: number, j: number, hh: number, w: number, xa0: number, top: number, count: number) => {
      const nm = low ? 'inf' : 'sup', cellKey = `${pre}${nm}-${i}-${j}`, h = Math.abs(hh);
      const xa = xa0 + (hh >= 0 ? (f.cellX?.[cellKey] ?? 0) : 0); // cuerpo movido: se desplaza y queda separado de sus vecinos
      const wc = hh >= 0 ? Math.min(w, f.cellW?.[cellKey] ?? w) : w;
      const dc = hh >= 0 ? Math.max(15, f.cellD?.[cellKey] ?? dpt) : dpt;
      const label = `${low ? 'inferior' : 'superior'} ${i + 1}${count > 1 ? '.' + (j + 1) : ''}`;
      const subsW = hh >= 0 ? f.subs?.[cellKey] : undefined;
      if (subsW && subsW.length > 1) {
        const tot = subsW.reduce((a, b2) => a + b2, 0);
        let sx = xa;
        subsW.forEach((sw, k) => {
          const wk = (sw * wc) / tot, sid = `${cellKey}-s${k}`, cfgS = f.bodies?.[sid];
          const gapS = !!f.gaps?.[sid]; // parte eliminada: queda un espacio libre del mismo ancho, sin alargar a la vecina
          if (cfgS && !gapS) fitBodyParts(cfgS, sid, sx, top, wk, h, dc, !!f.converted, spanOf(low, i)).forEach(b2 => boxes.push(b2));
          put(sid, `${gapS ? 'Hueco' : 'Cuerpo'} ${label}.${k + 1}`, sx, top, wk, h, dc);
          sx += wk;
        });
        return;
      }
      const cfgB = hh >= 0 ? f.bodies?.[cellKey] : undefined;
      if (cfgB) fitBodyParts(cfgB, cellKey, xa, top, wc, h, dc, !!f.converted, spanOf(low, i)).forEach(b2 => boxes.push(b2));
      put(cellKey, `${hh < 0 ? 'Hueco' : 'Cuerpo'} ${label}`, xa, top, wc, h, dc);
    };
    let xa = ins.left;
    rows.lower.forEach((w, i) => {
      let top = cells.lowerHs[i];
      cells.lower[i].forEach((hh, j) => { top -= Math.abs(hh); emitCell(true, i, j, hh, w, xa, top, cells.lower[i].length); });
      xa += w;
    });
    xa = ins.left;
    rows.upper.forEach((w, i) => {
      let top = cells.Hf;
      cells.upper[i].forEach((hh, j) => { top -= Math.abs(hh); emitCell(false, i, j, hh, w, xa, top, cells.upper[i].length); });
      xa += w;
    });
    };
  if (input.fit) {
    const f0 = input.fit;
    const cubesOn = { A: true, B: true, C: true, ...(f0.cubes ?? {}) };
    const dptA = cubesOn.A ? Math.max(200, f0.depth) : 0;
    if (cubesOn.A) buildFitCube(f0, wallA, 'fit-', boxes);
    // centro de entretenimiento: televisor de ambientación (no es parte del mueble), centrado en el muro y pegado a él
    if (f0.tv?.on) {
      const insT = fitInsets(f0, wallA), cubeW = wallA - insT.left - insT.right, tw = Math.max(200, Math.min(f0.tv.ancho, cubeW));
      boxes.push({ id: 'tv-pantalla', name: 'Televisor', kind: 'panel', wall: 'A', x: insT.left + (cubeW - tw) / 2, y: 0, z: f0.tv.desde, sx: tw, sy: 60, sz: Math.max(100, f0.tv.alto), facing: null } as Box);
    }
    // baño: sanitario y espejo para ambientar el entorno (solo si se activan); no son parte del mueble
    const insA = fitInsets(f0, wallA);
    if (f0.sanitario?.on) {
      // el lado del sanitario que mira al muro auxiliar queda a `x0` de ese muro (1000 por defecto, editable); izquierdo si hay los dos; sin auxiliar se mide desde el extremo izquierdo del muro A
      const bw = Math.max(200, f0.sanitario.ancho), dist = Math.max(0, f0.sanitario.x0);
      const cx = (hasC && !hasB) ? wallA - dist - bw / 2 : dist + bw / 2;
      boxes.push({ id: 'bano-san-taza', name: 'Sanitario taza', kind: 'panel', wall: 'A', x: cx - bw / 2, y: 120, z: 0, sx: bw, sy: 530, sz: 400, facing: null } as Box);
      boxes.push({ id: 'bano-san-tanque', name: 'Sanitario tanque', kind: 'panel', wall: 'A', x: cx - bw / 2, y: 0, z: 400, sx: bw, sy: 190, sz: 400, facing: null } as Box);
    }
    if (f0.espejo?.on) {
      const cubeW = wallA - insA.left - insA.right, mw = Math.max(100, Math.min(f0.espejo.ancho, cubeW));
      boxes.push({ id: 'bano-espejo', name: 'Espejo bano', kind: 'panel', wall: 'A', x: insA.left + (cubeW - mw) / 2, y: 0, z: f0.espejo.desde, sx: mw, sy: 6, sz: Math.max(100, f0.espejo.alto), facing: null } as Box);
    }
    // muros B y C: el cubo del brazo empieza delante del cubo del muro A y se gira al muro correspondiente
    const arm = (key: 'B' | 'C', has: boolean, len: number) => {
      if (!has || !cubesOn[key]) return;
      const a0 = key === 'B' ? f0.armB : f0.armC;
      const fa: ClosetFit = { ...DEFAULT_ARM, ...(a0 ?? {}), flotado: f0.flotado, altoMueble: f0.altoMueble, bodies: f0.bodies, converted: f0.converted, leftWall: false, rightWall: false };
      const local: Box[] = [];
      // unir zócalos: el zócalo del brazo se alarga hacia el muro A hasta tocar el zócalo transversal
      const zA = f0.zocalo?.on && cubesOn.A ? Math.max(45, Math.min(f0.zocalo.fondo, dptA - 30)) : 0;
      const zExt = f0.unirZocalos !== false && zA > 0 && fa.zocalo?.on ? Math.max(0, dptA - zA) : 0;
      buildFitCube(fa, Math.max(300, len - dptA), `fit${key}-`, local, zExt);
      local.forEach(bx => boxes.push({
        ...bx, wall: key,
        x: key === 'B' ? bx.y : wallA - bx.y - bx.sy,
        y: dptA + bx.x, sx: bx.sy, sy: bx.sx,
      }));
    };
    arm('B', hasB, wallB);
    arm('C', hasC, wallC);
  }
  if (input.puerta) puertaBoxes(input.puerta, input.wallA).forEach(b => boxes.push(b));
  // ajustes manuales de piezas sueltas (flechas en el módulo aislado)
  const pAdj = input.fit?.pieceAdj;
  if (pAdj) boxes.forEach(bx => { const a = pAdj[bx.id]; if (a) { if (a.sx != null) bx.sx = a.sx; if (a.sy != null) bx.sy = a.sy; if (a.sz != null) bx.sz = a.sz; } });
  (boxes as Box[] & { closetAlerts?: string[] }).closetAlerts = closetAlertsOut;
  return boxes;
}

/**
 * Valores del closet que se sugieren y se pueden editar: puertas corredizas, cajonero y alto de las puertas.
 * Reglas del usuario: 3 puertas si el cajonero va al centro y 2 si va a un lado; puerta = (marco horizontal + (n - 1) x traslape) / n;
 * cajonero sugerido = ancho de la puerta - 200; alto de la puerta = espacio libre - 20 (espacio libre: de la cara de arriba de la base
 * a la cara de abajo del marco horizontal).
 */
export function closetDerived(cfg: ClosetConfig & { leftWall: boolean; rightWall: boolean }, wallA: number, spaceHeight: number, hasZocalo: boolean, zocaloHeight: number) {
  const E = PANEL_THICKNESS;
  const Hc = spaceHeight - CLOSET_TOP_MARGIN;
  const baseH = hasZocalo ? zocaloHeight + E : cfg.bottomFrame ? E : 0; // la base va encima del zócalo
  // Zócalo tipo T (con zócalo y sin marco inferior): no hay base; el cajonero baja hasta el piso y el cajón de abajo deja zócalo + marco + 30 mm
  // para no chocar con el zócalo por la abertura. Con base: el cajonero se apoya en ella y el cajón de abajo deja 40 mm
  const tZocalo = hasZocalo && !cfg.bottomFrame;
  const cajBase = tZocalo ? 0 : baseH;
  const drawerBottom = tZocalo ? zocaloHeight + E + 30 : CLOSET_DRAWER_BOTTOM_GAP;
  const opening = wallA - (cfg.leftWall ? 2 * E : E) - (cfg.rightWall ? 2 * E : E);        // largo del marco horizontal
  const suggestedDoors = cfg.doorType === 'abatibles' ? Math.max(2, Math.round(wallA / 600)) : cfg.twoCajoneros ? (cfg.twoPlacement === 'extremos' ? 3 : 4) : cfg.cajoneroPos === 'center' ? 3 : 2; // dos cajoneros: 4 puertas con el traslape en la dilatada central, 3 si van a los extremos
  const doorCount = Math.max(1, Math.round(cfg.doorCount ?? suggestedDoors));
  const doorWidth = (opening + (doorCount - 1) * cfg.overlap) / doorCount;
  const suggestedCajonero = Math.max(300, Math.round((doorWidth - 200) / 5) * 5);
  const cajoneroTop = cfg.cajoneroTop ?? CLOSET_CAJONERO_TOP;
  // Cajones sugeridos: los que hagan falta para llegar a la altura del cajonero con frentes de 200 mm como máximo
  const suggestedDrawers = Math.max(1, Math.ceil((cajoneroTop - cajBase - E - drawerBottom + CLOSET_DRAWER_GAP) / (CLOSET_DRAWER_FRONT_MAX + CLOSET_DRAWER_GAP)));
  const drawerCount = Math.max(1, Math.round(cfg.cajonCount ?? suggestedDrawers));
  // Cajonero: frentes de 200 como máximo con 30 mm entre ellos; el de abajo deja 40 mm sobre la base y el de arriba llega a la cara de abajo de la tapa
  // La altura del cajonero es la pedida (cara de arriba de la tapa a 800/850 mm...): si con los cajones pedidos los frentes pasarían de 200, los
  // cajones quedan abajo con frentes de 200 y los costados del cajonero se alargan hasta cumplir la medida (queda un hueco sobre el cajón de arriba)
  const minHeight = drawerBottom + drawerCount * 80 + (drawerCount - 1) * CLOSET_DRAWER_GAP + E;
  const cajoneroHeight = Math.max(minHeight, cajoneroTop - cajBase);
  const drawerFront = Math.max(80, Math.min(CLOSET_DRAWER_FRONT_MAX, (cajoneroHeight - E - drawerBottom - (drawerCount - 1) * CLOSET_DRAWER_GAP) / drawerCount));
  // Entrepaños sobre el cajonero: hasta el tablero del maletero, con huecos de ~330 mm como máximo
  const suggestedMaleteroTop = Math.min(CLOSET_MALETERO_MAX, spaceHeight - CLOSET_MALETERO_CLEAR);
  const maleteroTop = cfg.maleteroTop ?? suggestedMaleteroTop;
  const shelfZone = (maleteroTop - E) - (cajBase + cajoneroHeight);
  const suggestedShelves = shelfZone > 100 ? Math.max(0, Math.ceil(shelfZone / 330) - 1) : 0;
  // Torre de entrepaños: hasta el maletero o hasta el techo (debajo del marco horizontal), con columnas iguales entre sus divisiones
  const torreWidth = Math.max(300, Math.min(1200, Math.round(cfg.torreWidth ?? suggestedCajonero)));
  const torreTop = cfg.torreToCeiling ? Hc - E : maleteroTop - E;
  const suggestedTorreShelves = Math.max(0, Math.ceil((torreTop - baseH) / 330) - 1);
  const torreShelves = Math.max(0, Math.min(20, Math.round(cfg.torreShelves ?? suggestedTorreShelves)));
  const torreDivisions = Math.max(0, Math.min(5, Math.round(cfg.torreDivisions ?? 0)));
  const freeHeight = (Hc - E) - baseH; // de la cara de arriba de la base a la cara de abajo del marco horizontal (acostado, de 15)
  const suggestedDoorHeight = cfg.doorType === 'abatibles' ? Hc - baseH : freeHeight - 20; // abatibles: del piso o la base hasta el techo
  return {
    Hc, baseH, cajBase, drawerBottom, torreWidth, torreTop, suggestedTorreShelves, torreShelves, torreDivisions, opening, suggestedDoors, doorCount, doorWidth, suggestedCajonero, cajoneroWidth: cfg.cajoneroWidth ?? suggestedCajonero,
    freeHeight, suggestedDoorHeight, doorHeight: cfg.doorHeight ?? suggestedDoorHeight,
    maleteroTop, suggestedMaleteroTop,
    suggestedCajoneroTop: CLOSET_CAJONERO_TOP, cajoneroTop, suggestedDrawers, drawerCount, drawerFront, cajoneroHeight,
    shelfZone, suggestedShelves, shelfCount: shelfZone > 100 ? Math.max(0, Math.min(12, Math.round(cfg.shelfCount ?? suggestedShelves))) : 0,
  };
}

/** A qué sección del closet pertenece una pieza (para abrir su formulario con doble clic); sin sección = no se abre nada */
/** Cuál cajonero es una pieza: 2 si lleva el sufijo del segundo, si no 1 */
export function closetCajoneroIndex(name: string): 1 | 2 { return name.endsWith(' · 2') ? 2 : 1; }

/** Cuál torre es una pieza: 2 si lleva el sufijo de la segunda torre */
export function closetTorreIndex(name: string): 1 | 2 { return name.endsWith(' · T2') ? 2 : 1; }

/** Anchos de los cuerpos del Closet fit (inferiores y superiores): los guardados (ajustados al muro) o iguales */
/** Descuento por la dilatación (15 mm) en cada lado con muro: el cubo y los cuerpos quedan entre las dilataciones */
export function fitInsets(fit: ClosetFit, wallAll: number) {
  // ya no hay dilatación automática junto al muro: se pide por módulo (dilatada o visto), como en la cocina
  const dl = 0, dr = 0;
  // baño: el mueble tiene su propio ancho y su posición desde el punto 0; lo demás del muro queda libre
  if (fit.mueble) {
    const x0 = Math.max(0, Math.min(fit.mueble.x0, wallAll - 100)), x1 = Math.max(x0 + 100, Math.min(wallAll, x0 + fit.mueble.ancho));
    return { left: Math.max(dl, x0), right: Math.max(dr, wallAll - x1), dl, dr };
  }
  return { left: dl, right: dr, dl, dr };
}

/** Alto del cubo: hasta 5 mm bajo el techo */
export function fitTop(fit: ClosetFit, spaceHeight: number) {
  return spaceHeight - CLOSET_TOP_MARGIN; // el cubo llega hasta el techo; el mueble del baño es el cuerpo de abajo (alto del mueble) y encima queda un hueco que se puede dividir
}


/** Abertura de la puerta k de n (lado a lado): por defecto en parejas, puerta izquierda con bisagra a la izquierda y puerta derecha con bisagra a la derecha (nunca se sugiere la abertura horizontal; la elige el usuario con un clic) */
export function doorOpening(c: { aberturas?: Record<string, 'izq' | 'der' | 'sup'>; hinge?: 'izq' | 'der' }, k: number, n: number): 'izq' | 'der' | 'sup' {
  const o = c.aberturas?.[String(k)];
  if (o) return o;
  if (n <= 1) return c.hinge ?? 'izq';
  return k < n / 2 ? 'izq' : 'der';
}

/**
 * Piezas de un cuerpo del Closet fit configurado como marco puerta o surrón (reglas del carpintero, ver REGLAS_MODULOS_FIT.md).
 * Sin convertir solo salen las placas representativas (puertas y frentes de cajón); al convertir salen todas las piezas reales.
 * Medidas en mm: x a lo largo del muro, y fondo (el frente es dpt), z altura.
 */
/**
 * Listones verticales de un alistonado sobre una cara (a lo largo de x, del alto h), con su fondo opcional (6 o 15) detrás.
 * yBack = cara donde se apoya el fondo; los listones quedan delante del fondo (hacia +y). La cantidad sale de la separación y se reparten
 * parejos de borde a borde (los de las puntas al ras de los lados).
 */
export function listonBoxes(id: string, L: { ancho: number; esp: number; sep: number; fondo?: number } | undefined, x: number, yBack: number, z: number, w: number, h: number, extra?: Partial<Box>, dir: 1 | -1 = 1): Box[] {
  const lw = Math.max(10, L?.ancho ?? 65), le = Math.max(3, L?.esp ?? 15), sep = Math.max(0, L?.sep ?? 35), fondo = L?.fondo ?? 0;
  const out: Box[] = [];
  // dir = 1: el alistonado crece hacia +y desde yBack; dir = -1: hacia -y (espaldar de un módulo que mira hacia +y)
  if (fondo > 0) out.push({ id: `${id}-fondo`, name: 'Fondo alistonado', kind: 'panel', wall: 'A', x, y: dir > 0 ? yBack : yBack - fondo, z, sx: w, sy: fondo, sz: h, facing: null, ...extra } as Box);
  const n = Math.max(1, Math.floor((w + sep) / (lw + sep)));
  const gap = n > 1 ? (w - n * lw) / (n - 1) : 0;
  for (let k = 0; k < n; k++) {
    const px = n > 1 ? x + k * (lw + gap) : x + (w - lw) / 2;
    out.push({ id: `${id}-li${k}`, name: 'Listón', kind: 'panel', wall: 'A', x: px, y: dir > 0 ? yBack + fondo : yBack - fondo - le, z, sx: lw, sy: le, sz: h, facing: null, ...extra } as Box);
  }
  return out;
}

export function fitBodyParts(c: FitBodyCfg, id: string, x: number, z: number, w: number, h: number, dpt: number, converted: boolean, span?: [number, number]): Box[] {
  const E = PANEL_THICKNESS, ZOC = 80;
  const out: Box[] = [];
  if (c.kind === 'alistonado') {
    // espaldar alistonado: al frente del cubo, con su fondo (6 o 15) detrás o sin fondo
    const le = Math.max(3, c.liston?.esp ?? 15), fondo = c.liston?.fondo ?? 0;
    return listonBoxes(id, c.liston, x, dpt - le - fondo, z, w, h);
  }
  // dilatada o visto a cada lado: restan ancho al módulo (como en la cocina); la dilatada es de 15 x 70 y el visto cubre todo el fondo
  const sideT = (v?: string) => (v === 'dilatada' || v === 'visto15' ? 15 : v === 'visto19' ? 19 : 0);
  const eL = sideT(c.ladoIzq), eR = sideT(c.ladoDer);
  const sidePiece = (v: string | undefined, e: number, px: number, key: string) => {
    if (!e || !converted) return;
    const dil = v === 'dilatada', dp = dil ? 70 : dpt;
    out.push({ id: `${id}-${key}`, name: dil ? 'Dilatada fit' : 'Visto fit', kind: 'panel', wall: 'A', x: px, y: dpt - dp, z, sx: e, sy: dp, sz: h, facing: null } as Box);
  };
  sidePiece(c.ladoIzq, eL, x, 'vi');
  sidePiece(c.ladoDer, eR, x + w - eR, 'vd');
  x += eL; w -= eL + eR;
  const add = (suffix: string, name: string, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
    if (sx > 0.01 && sy > 0.01 && sz > 0.01) out.push({ id: `${id}-${suffix}`, name, kind: 'panel', wall: 'A', x: px, y: py, z: pz, sx, sy, sz, facing: null } as Box);
  };
  // puente en L: dos piezas de 65 mm: una vertical de canto al frente (con su parte de arriba en zTop) y una horizontal acostada en la parte inferior de la vertical
  const addL = (suffix: string, px: number, pw: number, dptL: number, zTop: number) => {
    // la vertical (65 de alto, de canto) queda sobre la horizontal (65 de ancho, acostada) sin tocarse en volumen; la vertical va al frente y la horizontal se extiende hacia atrás
    // la horizontal queda al ras del frente del lateral (dptL) y la vertical a 15 mm de ese borde, apoyada sobre la horizontal
    add(`${suffix}v`, 'Puente L fit', px, dptL - E - 15, zTop - 65, pw, E, 65);
    add(`${suffix}h`, 'Puente L fit', px, dptL - 65, zTop - 65 - E, pw, 65, E);  // los cantos de las dos van al ras de los laterales del surrón (ancho interior)
  };
  const marco = c.kind === 'marco';
  const zh = c.zocalo ? ZOC : 0;
  const depth = marco ? 80 : dpt;                 // el marco puerta es solo un marco de 80 de fondo
  const yF = dpt - depth;                         // y del fondo de las piezas (el marco va pegado al frente)
  const drawers = marco ? 0 : Math.max(0, Math.round(c.drawers ?? 0));
  const doors = Math.max(0, Math.round(c.doors ?? 0));
  const baseKind = drawers > 0 ? 'puentes' : (c.base ?? 'base'); // con cajones solo puentes inferiores
  const tapa = !marco && c.top === 'tapa';
  const real = (rep: string, name: string) => (converted ? name : rep);
  // frentes de cajón
  if (drawers > 0) {
    const gap = c.drawerKind === 'puenteL' ? 30 : 2;
    // con puente en L arriba, el frente de arriba queda a 30 mm del tope del lateral (igual que la separación entre frentes)
    const topL = !marco && c.top === 'puenteL';
    const avail = h - zh - (topL ? 30 : 0);
    const f = (avail - (drawers - 1) * gap) / drawers;
    const topLimit = z + h - (topL ? 65 + E : E) - 10; // el cajón de arriba deja 1 cm libre bajo el puente en L, el puente o la tapa
    const lTop = (kk: number) => z + zh + (kk + 1) * (f + gap) - gap / 2 + 32; // parte de arriba del puente en L entre el cajón kk y el de arriba (80 de alto en total: 65 + 15)
    // todos los cajones del mismo surrón tienen la misma altura: la mayor que quepa en el cajón más apretado (máximo 240), con 1 cm libre arriba y abajo
    const isLK = c.drawerKind === 'puenteL';
    const loOf = (k: number) => Math.max(z + zh + k * (f + gap) + 10, k === 0 ? z + zh + E + 10 : (isLK ? lTop(k - 1) + 10 : z + zh + k * (f + gap) + 10));
    const hiOf = (k: number) => (k < drawers - 1 ? (isLK ? lTop(k) - 80 - 10 : z + zh + k * (f + gap) + f + gap) : topLimit);
    let common = 240; // hasta 24 cm de alto
    for (let k = 0; k < drawers; k++) common = Math.min(common, hiOf(k) - loOf(k));
    common = Math.max(20, common);
    for (let k = 0; k < drawers; k++) {
      const fz = z + zh + k * (f + gap);
      add(`fr${k}`, real('Frente rep fit', 'Frente cajón fit'), x + 1, dpt, fz, w - 2, E, f);
      if (converted && c.drawerKind === 'puenteL' && k < drawers - 1) addL(`pl${k}`, x + E, w - 2 * E, dpt, lTop(k)); // entre este cajón y el de arriba
      if (converted) {
        const lx1 = x + E + 13, lx2 = x + w - E - 13 - E, dl = depth - 32, dy = dpt - dl; // el cajón queda al ras del frente (su testero toca el frente de cajón)
        // el cajón se administra para no chocar: arranca sobre el puente o la base de abajo y llega como máximo hasta el puente en L de arriba (o el puente/tapa del tope); si no cabe 120, se reduce
        // 1 cm libre como mínimo arriba y abajo: sobre la base o el puente en L de abajo y bajo el puente en L (o el puente/tapa) de arriba; si no cabe 120 se reduce el alto
        const bz = loOf(k), bh = common;
        add(`lc${k}a`, 'Lateral cajón fit', lx1, dy, bz, E, dl, bh);
        add(`lc${k}b`, 'Lateral cajón fit', lx2, dy, bz, E, dl, bh);
        add(`tc${k}a`, 'Testero cajón fit', lx1 + E, dy, bz, w - 2 * E - 56, E, bh);
        add(`tc${k}b`, 'Testero cajón fit', lx1 + E, dy + dl - E, bz, w - 2 * E - 56, E, bh);
        add(`fc${k}`, 'Fondo cajón fit', x + E + 23, dy + 6, bz + 8, w - 2 * E - 46, dl - 20, E);
      }
    }
  }
  // puertas de parche: vertical = una a la izquierda y otra a la derecha; horizontal = una sobre otra
  if (doors > 0 && marco && c.doorType === 'corredizas') {
    // puertas corredizas (reglas del closet): traslape de 25, ancho = (abertura + (n − 1) × 25) / n, alto = espacio libre − 20; dos rieles (delante y detrás)
    const opening = w - 2 * E, ov = 25, dwC = (opening + (doors - 1) * ov) / doors, dhC = h - zh - 2 * E - 20;
    for (let i = 0; i < doors; i++) {
      const front = doors % 2 === 1 ? i % 2 === 1 : i % 2 === 0;
      add(`pu${i}`, real('Puerta rep fit', 'Puerta corrediza fit'), x + E + i * (dwC - ov), dpt - (front ? 28 : 53), z + zh + E + 10, dwC, 18, dhC);
    }
  } else if (doors > 0) {
    // con puente en L arriba la puerta pierde 30 mm por arriba (deja ver el puente en L)
    const dh = h - zh - 3 - (!marco && c.top === 'puenteL' ? 30 : 0);
    // horizontal: con 1 o 2 puertas van una sobre otra; con más de 2 siguen lado a lado pero con abertura horizontal (bisagra arriba)
    if (c.doorDir === 'horizontal' && doors <= 2) {
      const eh = (dh - (doors - 1) * 2) / doors;
      for (let k = 0; k < doors; k++) add(`pu${k}`, real('Puerta rep fit', 'Puerta fit'), x + 1, dpt, z + zh + 1 + k * (eh + 2), w - 2, E, eh);
    } else {
      const ew = (w - 2 - (doors - 1) * 2) / doors;
      for (let k = 0; k < doors; k++) add(`pu${k}`, real('Puerta rep fit', 'Puerta fit'), x + 1 + k * (ew + 2), dpt, z + zh + 1, ew, E, dh);
    }
  }
  if (!converted) return out;
  // estructura real
  // los laterales llegan al piso; el zócalo va entre ellos y la base (o los puentes) a la altura del zócalo
  const hL = h - (tapa ? E : 0);
  if (zh > 0) add('zoc', 'Zócalo fit', x + E, dpt - E - 15, z, w - 2 * E, E, ZOC); // zócalo corrido hacia adelante: su cara frontal queda 15 mm detrás del frente
  add('la', marco ? 'Lateral marco fit' : 'Lateral fit', x, yF, z, E, depth, hL);
  add('lb', marco ? 'Lateral marco fit' : 'Lateral fit', x + w - E, yF, z, E, depth, hL);
  if (!marco && baseKind === 'base') {
    add('base', 'Base fit', x + E, yF, z + zh, w - 2 * E, depth, E);
    add('pit', 'Puente inferior fit', x + E, yF, z + zh + E, w - 2 * E, E, 80); // con base también lleva el puente de atrás, de canto y de cara al muro, apoyado sobre la base
  }
  else {
    add('pif', marco ? 'Marco inferior fit' : 'Puente inferior fit', x + E, dpt - 80, z + zh, w - 2 * E, 80, E);
    if (!marco) add('pit', 'Puente inferior fit', x + E, yF, z, w - 2 * E, E, 80);   // el puente de atrás va de canto, de cara al muro y al ras de la parte inferior de los laterales
  }
  if (tapa) add('tapa', 'Tapa fit', x - 1, yF, z + h - E, w + 2, depth, E);
  else if (!marco && c.top === 'puenteL') {
    addL('plt', x + E, w - 2 * E, dpt, z + h);                                  // puente en L arriba, al frente
    add('pst', 'Puente superior fit', x + E, yF, z + h - 80, w - 2 * E, E, 80); // y el puente de atrás, de canto y de cara al muro
    add('pst2', 'Puente superior fit', x + E, yF + E, z + h - E, w - 2 * E, 80, E); // más un segundo puente atrás, acostado, pegado al de canto
  } else {
    add('psf', marco ? 'Marco superior fit' : 'Puente superior fit', x + E, dpt - 80, z + h - E, w - 2 * E, 80, E);
    if (!marco) {
      add('pst', 'Puente superior fit', x + E, yF, z + h - 80, w - 2 * E, E, 80);          // atrás, de canto y de cara al muro
      add('pst2', 'Puente superior fit', x + E, yF + E, z + h - E, w - 2 * E, 80, E);      // más un segundo puente atrás, acostado, pegado al de canto
    }
  }
  // marco puerta: entrepaños, maletero y tubos van de muro a módulo, de módulo a muro o de muro a muro (span)
  if (marco) {
    const [sx0, sx1] = span ?? [x, x + w];
    const sw = sx1 - sx0;
    const ns = Math.max(0, Math.round(c.shelves ?? 0));
    const topM = c.maletero && c.maletero > 0 ? z + h - Math.min(c.maletero, h - 200) : 0; // se mide desde la parte superior hacia abajo
    const zb = z + zh, zt = topM > 0 ? topM - E : z + h - E;
    if (topM > 0) add('mal', 'Maletero marco fit', sx0, 0, topM - E, sw, CLOSET_MALETERO_DEPTH, E);
    for (let k = 1; k <= ns; k++) add(`en${k}`, 'Entrepaño marco fit', sx0, 0, zb + ((zt - zb) * k) / (ns + 1) - E / 2, sw, dpt - 70, E);
    const camisero = c.tubes === 'camisero' || c.tubes === 'ambos', pantalonero = c.tubes === 'pantalonero' || c.tubes === 'ambos';
    if (camisero && topM > 0) add('tubc', 'Tubo camisero fit', sx0, dpt / 2 - 12.5, topM - E - 40 - 25, sw, 25, 25);
    if (pantalonero) add('tubp', 'Tubo pantalonero fit', sx0, dpt / 2 - 12.5, 900 - 12.5, sw, 25, 25);
  }
  // puertas lado a lado: pieza vertical en las uniones donde empieza una puerta (su bisagra) y, solo si se pide, en el cierre del medio
  // (donde se juntan las puertas de la izquierda con las de la derecha); dos pegadas: dos puentes verticales, o puente + costado
  const vObst: number[] = []; // centros de las uniones con pieza vertical: los entrepaños se dividen ahí
  if (doors >= 2 && (c.doorDir !== 'horizontal' || doors > 2)) {
    const vh = h - zh - 2 * E;
    // simetría: con cantidad par, la mitad de la izquierda lleva la bisagra a la izquierda y la mitad de la derecha a la derecha; con cantidad impar la puerta
    // del centro tiene abertura horizontal (bisagra arriba) y las demás se espejan. Se pone pieza vertical donde empieza una puerta con bisagra; las demás uniones son cierres
    const hingeL = (j: number) => doorOpening(c, j, doors) === 'izq', hingeR = (j: number) => doorOpening(c, j, doors) === 'der';
    for (let k = 1; k < doors; k++) {
      const isClosure = !(hingeL(k) || hingeR(k - 1));
      const need = c.doorDir !== 'horizontal' ? (!isClosure || !!c.vertMedio) : (isClosure && !!c.vertMedio);
      if (!need) continue;
      vObst.push(x + (w * k) / doors); // centro de la unión; el costado completo ocupa [centro − 15, centro] y el puente vertical (80 de fondo, al frente) [centro, centro + 15]
      const dx = x + (w * k) / doors - E / 2;
      add(`dv${k}a`, c.divider === 'costado' ? 'Costado vertical fit' : 'Puente vertical fit', dx - E / 2, c.divider === 'costado' ? yF : dpt - 80, z + zh + E, E, c.divider === 'costado' ? depth : 80, vh);
      add(`dv${k}b`, 'Puente vertical fit', dx + E / 2, dpt - 80, z + zh + E, E, 80, vh);
    }
  }
  // entrepaños: fondo del módulo − 70 (retranqueados desde el frente)
  const ns = marco ? 0 : Math.max(0, Math.round(c.shelves ?? 0));
  if (ns > 0 && drawers === 0) {
    const zb = z + zh + E, zt = z + h - E;
    // los entrepaños se dividen solo donde hay un costado completo (llegan a ras de él por cada lado); el puente vertical está solo al frente, así que el entrepaño pasa por detrás de él:
    // por eso, con piezas verticales, todos los entrepaños tienen el mismo fondo (fondo − 80) y quedan detrás del puente
    const segs: Array<[number, number]> = []; let st = x + E;
    if (c.divider === 'costado') vObst.forEach(xc => { if (xc - E - st > 20) segs.push([st, xc - E]); st = xc; });
    if (x + w - E - st > 20) segs.push([st, x + w - E]);
    const shelfDepth = vObst.length > 0 ? depth - 80 : depth - 70;
    for (let k = 1; k <= ns; k++) segs.forEach(([a0, a1], si) => add(`en${k}-${si}`, 'Entrepaño fit', a0, yF, zb + ((zt - zb) * k) / (ns + 1) - E / 2, a1 - a0, shelfDepth, E));
  }
  return out;
}

export function fitRows(fit: ClosetFit, wallAll: number) {
  const ins = fitInsets(fit, wallAll);
  const wallA = wallAll - ins.left - ins.right;
  const norm = (w: number[] | undefined, n: number) => {
    if (w && w.length === n && n > 0) { const sum = w.reduce((a, b) => a + b, 0); return w.map(x => (x * wallA) / sum); }
    return Array.from({ length: n }, () => wallA / n);
  };
  const nl = Math.max(1, Math.round(fit.lowerBodies)), nu = Math.max(0, Math.round(fit.upperBodies));
  return { lower: norm(fit.lowerW, nl), upper: nu > 0 ? norm(fit.upperW, nu) : [] as number[] };
}

/**
 * Celdas de cada cuerpo del Closet fit (alturas de arriba hacia abajo). Cada cuerpo de arriba tiene su propia altura (la suma de sus celdas);
 * el cuerpo de abajo que está justo debajo (mismo ancho y posición) llega hasta él. Los demás de abajo usan la altura general de los superiores.
 */
/** Altura del zócalo del cubo (los cuerpos de abajo arrancan sobre él) */
export function fitBase(fit: ClosetFit) { return fit.flotado?.on ? Math.max(0, fit.flotado.alto) : fit.zocalo?.on ? Math.max(0, fit.zocalo.alto) : 0; }

export function fitCells(fit: ClosetFit, wallA: number, spaceHeight: number) {
  const Hf = fitTop(fit, spaceHeight);
  const base = fitBase(fit);
  const rows = fitRows(fit, wallA);
  const baseUp = rows.upper.length > 0 ? Math.min(Math.max(100, fit.upperHeight), Hf - 1) : 0; // el límite real (300 mm para un cuerpo de abajo) lo pone el arrastre; si abajo hay espacio libre puede llegar casi al piso
  // un alto negativo marca un hueco (espacio libre que dejó un cuerpo eliminado); para las medidas se usa su valor absoluto
  const sum = (c: number[]) => c.reduce((a, b) => a + Math.abs(b), 0);
  const upper = rows.upper.map((_, i) => {
    const c = fit.upperCells?.[i];
    if (c && c.length > 0) { const t = Math.min(Math.max(100, sum(c)), Hf - 1); const k = t / sum(c); return c.map(x => x * k); }
    return [baseUp];
  });
  const upTotals = upper.map(sum);
  const ranges = (row: number[]) => { let a = 0; return row.map(w => { const r: [number, number] = [a, a + w]; a += w; return r; }); };
  const lr = ranges(rows.lower), ur = ranges(rows.upper);
  const match = lr.map(([a, b]) => ur.findIndex(([c, d]) => Math.abs(a - c) < 1 && Math.abs(b - d) < 1));
  // sin choques: cada cuerpo de abajo llega hasta el más bajo de los cuerpos de arriba que le quedan encima (nunca se sobreponen)
  const lowerHs = lr.map(([a, b]) => { let t = 0, any = false; ur.forEach(([c, d], k) => { if (Math.min(b, d) - Math.max(a, c) > 0.5) { any = true; t = Math.max(t, upTotals[k]); } }); return Hf - (any ? t : baseUp); });
  const lower = rows.lower.map((_, i) => {
    const c = fit.lowerCells?.[i], h = Math.max(15, lowerHs[i] - base); // los cuerpos de abajo arrancan sobre el zócalo
    if (c && c.length > 0) {
      // si el espacio disponible cambió (zócalo, flotado, cuerpos de arriba), los cuerpos de abajo conservan su alto y el de arriba absorbe la diferencia
      const tot = sum(c);
      if (c.length > 1 && Math.abs(tot - h) > 0.01) {
        const first = Math.abs(c[0]) + (h - tot);
        if (first >= 50) return c.map((x, k) => (k === 0 ? (x < 0 ? -first : first) : x));
      }
      const k = h / tot; return c.map(x => x * k);
    }
    // baño: el mueble tiene su alto propio y encima queda un hueco libre hasta el techo (o hasta los cuerpos de arriba)
    if (fit.altoMueble && fit.altoMueble > 0 && h > fit.altoMueble + 50) {
      const rest = h - fit.altoMueble, n = Math.max(0, Math.round(fit.sobreMueble ?? 0));
      if (n === 0) return [-rest, fit.altoMueble];
      // cuerpos encima del mueble, de abajo hacia arriba: 200 (franja), 700 (el grande) y el de arriba con lo que sobre; si no caben se reparten por igual
      const fixed = [200, 700];
      let up: number[];
      if (n === 1) up = [rest];
      else if (n === 2) up = [rest - fixed[0], fixed[0]];
      else { const topAll = rest - fixed[0] - fixed[1], extra = n - 2; up = [...Array.from({ length: extra }, () => topAll / extra), fixed[1], fixed[0]]; }
      if (up.some(x => x < 50)) up = Array.from({ length: n }, () => rest / n);
      return [...up, fit.altoMueble];
    }
    return [h];
  });
  return { lower, upper, Hf, upH: baseUp, lowerHs, upTotals, match, base };
}

export function closetSectionOf(rawName: string): 'torre' | 'puertas' | 'taparriel' | 'costado' | 'zocalo' | 'base' | 'cajonero' | 'entrepanos' | 'maletero' | null {
  const name = rawName.replace(/ \[\d+\]$/, '').replace(/ \([12]\/2\)$/, '').replace(/ · (2|T2)$/, '');
  if (name === 'Costado closet') return 'costado';
  if (name === 'Tapa riel closet') return 'taparriel';
  if (name.startsWith('Puerta corrediza') || name.startsWith('Puerta abatible')) return 'puertas';
  if (name.startsWith('Zócalo closet')) return 'zocalo';
  if (name === 'Base closet' || name === 'Base marco hor closet' || name === 'Marco puerta inferior') return 'base';
  if (name.startsWith('Lateral cajonero') || name === 'Tapa cajonero' || name.startsWith('Frente cajón') || name.startsWith('Cajón ') || name.startsWith('Puente') && name.endsWith('cajonero') || name === 'Dilatación lateral cajonero' || name === 'Dilatada central cajonero') return 'cajonero';
  if (name === 'Entrepaño closet' || name === 'Nariz entrepaño closet' || name.startsWith('Costado entrepaños')) return 'entrepanos';
  if (name.startsWith('Maletero closet') || name === 'Nariz maletero') return 'maletero';
  if (name.startsWith('Lateral torre') || name === 'División torre' || name === 'Entrepaño torre' || name === 'Nariz entrepaño torre') return 'torre';
  return null;
}

/** Cara superior del mesón (mm) si existe; si no, la de los módulos bajos */
export function counterTopZ(boxes: Box[], fallback: number): number {
  const counter = boxes.find(b => b.kind === 'counter');
  return counter ? counter.z + counter.sz : fallback;
}

/**
 * REGLA: los módulos y los electrodomésticos no pueden ocupar el mismo espacio. Devuelve cada par de cajas macizas
 * (módulos bajos, aéreos y torres, más la nevera y la alacena) que se superponen en los tres ejes. Tocarse por una
 * cara no es choque. Los muros, el zócalo, el mesón y las piezas de dilatación no cuentan.
 */
export function findCollisions(boxes: Box[], tolerance = 1): Array<[Box, Box]> {
  const solids = boxes.filter(bx => bx.kind === 'lower' || bx.kind === 'upper' || bx.kind === 'tall' || bx.kind === 'appliance');
  const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > tolerance;
  const pairs: Array<[Box, Box]> = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const p = solids[i];
      const q = solids[j];
      if (overlap(p.x, p.x + p.sx, q.x, q.x + q.sx) && overlap(p.y, p.y + p.sy, q.y, q.y + q.sy) && overlap(p.z, p.z + p.sz, q.z, q.z + q.sz)) {
        pairs.push([p, q]);
      }
    }
  }
  return pairs;
}

/** Caja que ocupa el módulo con ese id, si existe */
export function findModuleBox(boxes: Box[], moduleId: string): Box | undefined {
  return boxes.find(b => b.moduleId === moduleId);
}

/** Límites que abarcan todas las cajas (útil para encuadrar las cámaras) */
export function boxesBounds(boxes: Box[]) {
  const b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  boxes.forEach(box => {
    b.minX = Math.min(b.minX, box.x); b.maxX = Math.max(b.maxX, box.x + box.sx);
    b.minY = Math.min(b.minY, box.y); b.maxY = Math.max(b.maxY, box.y + box.sy);
    b.minZ = Math.min(b.minZ, box.z); b.maxZ = Math.max(b.maxZ, box.z + box.sz);
  });
  return b;
}

/** Exportación para otras herramientas (Fusion, BOM, etc.) */
export function boxesToJSON(boxes: Box[], meta: { layout: LayoutType; spaceHeight: number; zocaloHeight: number; hasZocalo: boolean }) {
  return {
    version: 1,
    units: 'mm',
    axes: 'X a lo largo del muro A (izquierda a derecha), Y profundidad desde el muro A, Z altura desde el piso',
    layout: meta.layout,
    spaceHeight: meta.spaceHeight,
    zocalo: meta.hasZocalo ? meta.zocaloHeight : 0,
    boxes: boxes.map(b => ({
      id: b.id,
      name: b.name,
      kind: b.kind,
      wall: b.wall,
      x: Math.round(b.x), y: Math.round(b.y), z: Math.round(b.z),
      sx: Math.round(b.sx), sy: Math.round(b.sy), sz: Math.round(b.sz),
      facing: b.facing,
      ...(b.cutouts && b.cutouts.length ? { cutouts: b.cutouts.map(c => ({ label: c.label, x: Math.round(c.x), y: Math.round(c.y), sx: Math.round(c.sx), sy: Math.round(c.sy) })) } : {}),
    })),
  };
}
