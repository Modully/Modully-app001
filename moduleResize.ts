import { KitchenModule } from './types';

/**
 * Cambio del ancho de un módulo desde su número en la escena (igual que mover las flechas dobles de sus dos lados).
 *
 * - El módulo se amplía (o se reduce) SIMÉTRICAMENTE: la mitad hacia cada lado.
 * - SOLO cambian sus dos vecinos de los lados: al ampliar, el vecino cede ancho en el borde que se acerca; al reducir,
 *   el vecino que lo toca crece para seguir pegado. Ningún otro módulo se mueve, así la hilera sigue ocupando lo mismo.
 * - Si un lado no tiene vecino que ceda (extremo de la hilera, o un módulo de ancho fijo como la sobrenevera, la campana
 *   o los muebles de la estufa y la poceta), ese lado solo puede usar el espacio libre hasta el muro; si no le alcanza,
 *   el resto pasa al otro lado. Si ya no cabe de ningún modo, el ancho se limita al máximo posible.
 * - Los vecinos son los del mismo muro y el mismo nivel (bajos con bajos, aéreos con aéreos).
 */
export interface ResizeBounds {
  low: number;  // posición mínima permitida para el inicio de un módulo (mm)
  high: number; // posición máxima permitida para el final de un módulo (mm)
}

type Update = { positionX: number; width: number };

/** Módulos cuyo ancho depende de un electrodoméstico: no ceden ancho a un vecino */
const hasFixedWidth = (m: KitchenModule) => !!(m.isFridgeCabinet || m.isHood || m.isStoveCabinet || m.isSinkCabinet);

export function resizeSymmetric(
  modules: KitchenModule[],
  id: string,
  desiredWidth: number,
  bounds: ResizeBounds,
  step = 5,
  minWidth = 100
): KitchenModule[] {
  const target = modules.find(m => m.uniqueId === id);
  if (!target) return modules;

  const peers = modules
    .filter(p => p.wall === target.wall && p.islandId === target.islandId && p.type === target.type)
    .sort((a, b) => a.positionX - b.positionX);
  const index = peers.findIndex(p => p.uniqueId === id);
  const left = index > 0 ? peers[index - 1] : undefined;
  const right = index < peers.length - 1 ? peers[index + 1] : undefined;

  const snap = (v: number) => Math.round(v / step) * step;
  const floorStep = (v: number) => Math.max(0, Math.floor(v / step) * step);
  const wanted = Math.max(minWidth, snap(desiredWidth));
  const delta = wanted - target.width;
  if (delta === 0) return modules;

  const start = target.positionX;
  const end = target.positionX + target.width;
  const touchesLeft = !!left && Math.abs(left.positionX + left.width - start) <= 1;
  const touchesRight = !!right && Math.abs(right.positionX - end) <= 1;

  const updates = new Map<string, Update>();

  if (delta > 0) {
    // AMPLIAR: cuánto puede crecer cada borde = espacio libre + lo que el vecino pueda ceder (sin bajar de minWidth)
    const leftRoom = floorStep(left
      ? (start - (left.positionX + left.width)) + (hasFixedWidth(left) ? 0 : Math.max(0, left.width - minWidth))
      : start - bounds.low);
    const rightRoom = floorStep(right
      ? (right.positionX - end) + (hasFixedWidth(right) ? 0 : Math.max(0, right.width - minWidth))
      : bounds.high - end);

    const total = floorStep(Math.min(delta, leftRoom + rightRoom));
    if (total <= 0) return modules;

    // Lo más simétrico posible; si un lado no alcanza, el resto va al otro
    let leftGrow = Math.min(snap(total / 2), leftRoom);
    let rightGrow = total - leftGrow;
    if (rightGrow > rightRoom) { rightGrow = rightRoom; leftGrow = total - rightGrow; }

    const newStart = start - leftGrow;
    const newEnd = end + rightGrow;
    updates.set(id, { positionX: newStart, width: newEnd - newStart });

    // Solo los dos vecinos de los lados, y solo si el módulo llegó a su borde
    if (left && newStart < left.positionX + left.width) {
      updates.set(left.uniqueId, { positionX: left.positionX, width: newStart - left.positionX });
    }
    if (right && newEnd > right.positionX) {
      updates.set(right.uniqueId, { positionX: newEnd, width: right.positionX + right.width - newEnd });
    }
  } else {
    // REDUCIR: los vecinos que lo tocan crecen para seguir pegados; si no lo tocan, queda el espacio libre
    const total = -delta;
    const leftShrink = snap(total / 2);
    const rightShrink = total - leftShrink;
    const newStart = start + leftShrink;
    const newEnd = end - rightShrink;
    updates.set(id, { positionX: newStart, width: newEnd - newStart });
    if (left && touchesLeft && !hasFixedWidth(left)) {
      updates.set(left.uniqueId, { positionX: left.positionX, width: left.width + leftShrink });
    }
    if (right && touchesRight && !hasFixedWidth(right)) {
      updates.set(right.uniqueId, { positionX: right.positionX - rightShrink, width: right.width + rightShrink });
    }
  }

  return modules.map(m => (updates.has(m.uniqueId) ? { ...m, ...updates.get(m.uniqueId)! } : m));
}

/**
 * Imán entre módulos: si al mover o estirar un módulo queda una separación diminuta (hasta `threshold` mm) con su vecino
 * del mismo muro y nivel, se cierra sola y quedan pegados. Al mover, el módulo se corre; al estirar un borde, ese borde
 * se alarga hasta tocar al vecino.
 */
export function snapToNeighbors(
  modules: KitchenModule[],
  id: string,
  mode: 'move' | 'left' | 'right',
  threshold = 15
): KitchenModule[] {
  const m = modules.find(x => x.uniqueId === id);
  if (!m) return modules;
  const peers = modules.filter(p => p.uniqueId !== id && p.wall === m.wall && p.islandId === m.islandId && p.type === m.type);
  const start = m.positionX;
  const end = m.positionX + m.width;
  // Separación hasta el vecino más cercano de cada lado (solo si es positiva y pequeña)
  let gapLeft = Infinity;
  let gapRight = Infinity;
  peers.forEach(p => {
    const dl = start - (p.positionX + p.width);
    const dr = p.positionX - end;
    if (dl > 0.5 && dl <= threshold) gapLeft = Math.min(gapLeft, dl);
    if (dr > 0.5 && dr <= threshold) gapRight = Math.min(gapRight, dr);
  });
  if (gapLeft === Infinity && gapRight === Infinity) return modules;
  let next = m;
  if (mode === 'move') next = gapLeft <= gapRight ? { ...m, positionX: m.positionX - gapLeft } : { ...m, positionX: m.positionX + gapRight };
  else if (mode === 'left' && gapLeft !== Infinity) next = { ...m, positionX: m.positionX - gapLeft, width: m.width + gapLeft };
  else if (mode === 'right' && gapRight !== Infinity) next = { ...m, width: m.width + gapRight };
  return next === m ? modules : modules.map(x => (x.uniqueId === id ? next : x));
}
