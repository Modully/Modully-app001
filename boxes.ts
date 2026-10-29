import { KitchenModule, Appliance, LayoutType, WallName } from './types';

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

export type BoxKind = 'wall' | 'zocalo' | 'lower' | 'upper' | 'tall' | 'appliance' | 'counter';
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
}

// Constantes de geometría compartidas por la app, la escena y la exportación
export const WALL_THICKNESS = 150;       // espesor de los muros (mm)
export const LOWER_DEPTH = 570;          // fondo módulo base (mm)
export const UPPER_DEPTH = 330;          // fondo módulo aéreo (mm)
export const CORNER_BLIND_OFFSET = LOWER_DEPTH; // esquina ciega: el muro B/C arranca tras el fondo del MB del muro A
export const TOP_MARGIN = 20;            // espacio libre bajo el techo (mm)
// Regla de la nevera: separación mínima entre la nevera y los módulos (base y aéreos) a cada lado, y fondo sugerido de la sobrenevera
export const FRIDGE_CLEARANCE = 50;      // mm
export const OVER_FRIDGE_DEPTH = 500;    // mm (más profundo que los demás aéreos, que miden 330)
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
  hasCounter?: boolean;
  counterThickness?: number;
  counterOverhang?: number;
}

export function buildBoxes(input: BuildBoxesInput): Box[] {
  const { layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth, modules, appliances } = input;
  const hasCounter = input.hasCounter ?? false;
  const counterThickness = input.counterThickness ?? COUNTER_THICKNESS_DEFAULT;
  const counterOverhang = input.counterOverhang ?? COUNTER_OVERHANG_DEFAULT;
  const T = WALL_THICKNESS;
  const zh = hasZocalo ? zocaloHeight : 0;
  const boxes: Box[] = [];
  const hasB = layout === 'L_SHAPE' || layout === 'U_SHAPE';
  const hasC = layout === 'U_SHAPE';

  // --- Muros ---
  boxes.push({ id: 'wall-A', name: 'Muro A', kind: 'wall', wall: 'A', x: 0, y: -T, z: 0, sx: wallA, sy: T, sz: spaceHeight, facing: null });
  if (hasB) {
    boxes.push({ id: 'wall-B', name: 'Muro B', kind: 'wall', wall: 'B', x: -T, y: -T, z: 0, sx: T, sy: wallB + T, sz: spaceHeight, facing: null });
  }
  if (hasC) {
    boxes.push({ id: 'wall-C', name: 'Muro C', kind: 'wall', wall: 'C', x: wallA, y: -T, z: 0, sx: T, sy: wallC + T, sz: spaceHeight, facing: null });
  }

  // --- Muros auxiliares: cierran el extremo libre de cada brazo de la cocina ---
  //   Recta: izquierdo = extremo izquierdo de A; derecho = extremo derecho de A.
  //   En L: izquierdo = extremo del brazo B (el brazo está a la izquierda); derecho = extremo derecho de A.
  //   En U: izquierdo = extremo del brazo B; derecho = extremo del brazo C.
  // Cada uno se prolonga sobre el espesor del muro con el que se une, así las esquinas quedan cerradas y alineadas.
  const CT = CLOSURE_THICKNESS;
  const CD = CLOSURE_DEPTH;
  if (input.hasLeftClosure) {
    const c = layout === 'STRAIGHT'
      ? { x: -CT, y: -T, sx: CT, sy: CD + T }      // junto al extremo izquierdo de A, hasta la cara exterior de A
      : { x: -T, y: wallB, sx: T + CD, sy: CT };   // al final del brazo B, desde la cara exterior de B
    boxes.push({ id: 'closure-left', name: 'Muro auxiliar izquierdo', kind: 'wall', wall: layout === 'STRAIGHT' ? 'A' : 'B', ...c, z: 0, sz: spaceHeight, facing: null });
  }
  if (input.hasRightClosure) {
    const c = layout === 'U_SHAPE'
      ? { x: wallA - CD, y: wallC, sx: CD + T, sy: CT }   // al final del brazo C, hasta la cara exterior de C
      : { x: wallA, y: -T, sx: CT, sy: CD + T };          // junto al extremo derecho de A, hasta la cara exterior de A
    boxes.push({ id: 'closure-right', name: 'Muro auxiliar derecho', kind: 'wall', wall: layout === 'U_SHAPE' ? 'C' : 'A', ...c, z: 0, sz: spaceHeight, facing: null });
  }

  // --- Zócalo ---
  if (hasZocalo && zh > 0) {
    boxes.push({ id: 'zocalo-A', name: 'Zócalo A', kind: 'zocalo', wall: 'A', x: 0, y: 0, z: 0, sx: wallA, sy: zocaloDepth, sz: zh, facing: null });
    const yStart = Math.min(zocaloDepth, CORNER_BLIND_OFFSET);
    if (hasB) {
      boxes.push({ id: 'zocalo-B', name: 'Zócalo B', kind: 'zocalo', wall: 'B', x: 0, y: yStart, z: 0, sx: zocaloDepth, sy: wallB - yStart, sz: zh, facing: null });
    }
    if (hasC) {
      boxes.push({ id: 'zocalo-C', name: 'Zócalo C', kind: 'zocalo', wall: 'C', x: wallA - zocaloDepth, y: yStart, z: 0, sx: zocaloDepth, sy: wallC - yStart, sz: zh, facing: null });
    }
  }

  // Coloca una caja contra el muro indicado: "along" es la posición a lo largo del muro y "width" su ancho en ese sentido
  const placeOnWall = (wall: WallName, along: number, width: number, depth: number) => {
    if (wall === 'B') return { x: 0, y: CORNER_BLIND_OFFSET + along, sx: depth, sy: width, facing: '+X' as BoxFacing };
    if (wall === 'C') return { x: wallA - depth, y: CORNER_BLIND_OFFSET + along, sx: depth, sy: width, facing: '-X' as BoxFacing };
    return { x: along, y: 0, sx: width, sy: depth, facing: '+Y' as BoxFacing };
  };

  // --- Módulos ---
  modules.forEach(mod => {
    if (mod.wall === 'Island') return;
    const kind: BoxKind = mod.type === 'UPPER' ? 'upper' : mod.type === 'TALL' ? 'tall' : 'lower';
    // Los aéreos cuelgan desde el techo (queda TOP_MARGIN libre); el resto se apoya sobre el zócalo
    const z = mod.type === 'UPPER' ? spaceHeight - TOP_MARGIN - mod.height : zh;
    const p = placeOnWall(mod.wall, mod.positionX, mod.width, mod.depth);
    boxes.push({
      id: mod.uniqueId,
      name: `${mod.label ? mod.label + ' ' : ''}${mod.name}`,
      kind,
      wall: mod.wall,
      x: p.x, y: p.y, z,
      sx: p.sx, sy: p.sy, sz: mod.height,
      facing: p.facing,
      moduleId: mod.uniqueId,
    });
  });

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

  // --- Mesón: una losa por tramo continuo de módulos bajos de cada muro, con aberturas para poceta y estufa ---
  if (hasCounter && counterThickness > 0) {
    (['A', 'B', 'C'] as WallName[]).forEach(wall => {
      const lowers = boxes.filter(b => b.kind === 'lower' && b.wall === wall);
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
        const start = range(run[0]).start;
        const end = range(run[run.length - 1]).end;
        const depth = Math.max(...run.map(b => (wall === 'A' ? b.sy : b.sx)));
        const topOfModules = Math.max(...run.map(b => b.z + b.sz));
        const length = end - start;
        const slabDepth = depth + counterOverhang;

        const slab = wall === 'A'
          ? { x: start, y: 0, sx: length, sy: slabDepth }
          : wall === 'B'
            ? { x: 0, y: start, sx: slabDepth, sy: length }
            : { x: wallA - slabDepth, y: start, sx: slabDepth, sy: length };

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

        boxes.push({
          id: `counter-${wall}-${index}`,
          name: `Mesón ${wall}${runs.length > 1 ? ` (${index + 1})` : ''}`,
          kind: 'counter',
          wall,
          x: slab.x, y: slab.y, z: topOfModules,
          sx: slab.sx, sy: slab.sy, sz: counterThickness,
          facing: wall === 'A' ? '+Y' : wall === 'B' ? '+X' : '-X',
          cutouts,
        });
      });
    });
  }

  return boxes;
}

/** Cara superior del mesón (mm) si existe; si no, la de los módulos bajos */
export function counterTopZ(boxes: Box[], fallback: number): number {
  const counter = boxes.find(b => b.kind === 'counter');
  return counter ? counter.z + counter.sz : fallback;
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
