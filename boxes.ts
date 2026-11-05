import { KitchenModule, Appliance, LayoutType, WallName, IslandItem, ColumnItem } from './types';

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

export type BoxKind = 'wall' | 'zocalo' | 'lower' | 'upper' | 'tall' | 'appliance' | 'counter' | 'filler';
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
export type BoxFacing = '+Y' | '+X' | '-X' | null; // hacia dónde mira el frente del módulo

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
  chamferY?: number;                               // cascada con chaflán: cuánto retrocede el canto de abajo por el frente (mm) respecto al de arriba
}

// Constantes de geometría compartidas por la app, la escena y la exportación
export const WALL_THICKNESS = 150;       // espesor de los muros (mm)
export const LOWER_DEPTH = 570;          // fondo módulo base (mm)
export const ISLAND_PLINTH_INSET = 50;   // el zócalo de una isla o península queda 5 cm hacia adentro de su medida general, por cada lado
export const MAX_MODULE_WIDTH = 900;     // ancho máximo de un módulo (mm)
export const SPLASH_HEIGHT_DEFAULT = 70;   // alto del salpicadero (mm)
export const UPPER_DEPTH = 330;          // fondo módulo aéreo (mm)
export const CORNER_BLIND_OFFSET = LOWER_DEPTH; // esquina ciega: el muro B/C arranca tras el fondo del MB del muro A
export const TOP_MARGIN = 20;            // espacio libre bajo el techo (mm)
// Regla de la nevera: separación mínima entre la nevera y los módulos (base y aéreos) a cada lado, y fondo sugerido de la sobrenevera
export const FRIDGE_CLEARANCE = 50;      // mm
export const OVER_FRIDGE_DEPTH = 500;    // mm (más profundo que los demás aéreos, que miden 330)
// Dilatación: los módulos pegados a un muro dejan una holgura (por los muros descuadrados) que se tapa con una pieza
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

export interface BuildBoxesInput {
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
  lArm?: 'left' | 'right'; // cocina en L: de qué lado está el brazo (izquierda = muro B, derecha = muro C)
}

export function buildBoxes(input: BuildBoxesInput): Box[] {
  const { layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth, modules, appliances } = input;
  const hasCounter = input.hasCounter ?? false;
  const counterThickness = input.counterThickness ?? COUNTER_THICKNESS_DEFAULT;
  const counterOverhang = input.counterOverhang ?? COUNTER_OVERHANG_DEFAULT;
  const hasSplash = input.hasSplash ?? false;
  const splashHeight = input.splashHeight ?? SPLASH_HEIGHT_DEFAULT;
  const T = WALL_THICKNESS;
  const zh = hasZocalo ? zocaloHeight : 0;
  const boxes: Box[] = [];
  // En L el brazo es el muro B (izquierda) o el muro C (derecha); en U están los dos
  const hasB = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && input.lArm !== 'right');
  const hasC = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && input.lArm === 'right');

  // --- Muros ---
  boxes.push({ id: 'wall-A', name: 'Muro A', kind: 'wall', wall: 'A', x: 0, y: -T, z: 0, sx: wallA, sy: T, sz: spaceHeight, facing: null });
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
  if (hasZocalo && zh > 0) {
    // Recorta de [start, end] (a lo largo del muro) los huecos de las neveras activas de ese muro
    const plinthSegments = (wall: WallName, start: number, end: number): Array<[number, number]> => {
      const armStart = wall === 'A' ? 0 : CORNER_BLIND_OFFSET;
      const holes = appliances
        .filter(a => a.active && a.type === 'fridge' && a.wall === wall)
        .map(a => [armStart + a.distance - FRIDGE_CLEARANCE, armStart + a.distance + a.width + FRIDGE_CLEARANCE] as [number, number])
        .sort((x, y) => x[0] - y[0]);
      const segments: Array<[number, number]> = [];
      let cursor = start;
      holes.forEach(([h0, h1]) => {
        if (h0 > cursor) segments.push([cursor, Math.min(h0, end)]);
        cursor = Math.max(cursor, h1);
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
      ? { x: isl.dx + mod.positionX, y: isl.dy + (mod.depthOffset ?? 0), sx: mod.width, sy: mod.depth, facing: '+Y' as BoxFacing }
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
      const lowers = boxes.filter(b => b.kind === 'lower' && b.wall === wall && !b.islandId);
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
        const lateral = boxes.filter(f => f.kind === 'filler' && f.wall === wall
          && (f.id.startsWith('dilatacion-lower-') || f.id.startsWith('visto-lower-'))
          && run.some(m => f.id.includes(`-lower-${m.moduleId}-`)));
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

  return boxes;
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
