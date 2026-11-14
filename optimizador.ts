import type { Pieza } from './piezas';

/**
 * Optimización de lámina: acomoda las piezas del listado en láminas, por material (color + calibre).
 *
 * - Cortes de guillotina (de lado a lado), como los hace la seccionadora o la escuadradora.
 * - Refilado: se descuenta a cada borde de la lámina antes de acomodar.
 * - Sierra: entre pieza y pieza se descuenta el espesor del disco.
 * - Veta: el LAR de la pieza va a lo largo de la lámina; solo se gira si se permite (material sin veta).
 * - Retazos: los rectángulos libres que quedan en cada lámina y que sirven para otro trabajo.
 *
 * Se prueban varios órdenes y formas de partir el sobrante, y queda el acomodo que usa menos láminas.
 */

export interface OpcionesLamina {
  largo: number;        // largo de la lámina (mm), sentido de la veta
  ancho: number;        // ancho de la lámina (mm)
  sierra: number;       // espesor del disco (mm)
  refilado: number;     // lo que se limpia en cada borde de la lámina (mm)
  respetarVeta: boolean;
  retazoMin: number;    // lado mínimo para contar un sobrante como retazo (mm)
}

export const OPCIONES_LAMINA: OpcionesLamina = { largo: 2440, ancho: 1830, sierra: 4, refilado: 10, respetarVeta: true, retazoMin: 150 };

export interface Colocada { nombre: string; x: number; y: number; w: number; h: number; lar: number; an: number; girada: boolean; canto: string }
export interface Retazo { x: number; y: number; w: number; h: number }
export interface LaminaCortada { piezas: Colocada[]; retazos: Retazo[]; uso: number }
export interface ResultadoMaterial {
  material: string;
  laminas: LaminaCortada[];
  noCaben: { nombre: string; lar: number; an: number; cant: number }[];
  uso: number;          // aprovechamiento total (0 a 1) sobre las láminas completas
  areaPiezas: number;   // mm²
  piezas: number;
}

interface Item { nombre: string; lar: number; an: number; canto: string }
interface Libre { x: number; y: number; w: number; h: number }
interface Hoja { libres: Libre[]; piezas: Colocada[] }

type Orden = (a: Item, b: Item) => number;
const ORDENES: Orden[] = [
  (a, b) => b.lar * b.an - a.lar * a.an,
  (a, b) => Math.max(b.lar, b.an) - Math.max(a.lar, a.an) || b.lar * b.an - a.lar * a.an,
  (a, b) => b.an - a.an || b.lar - a.lar,
  (a, b) => b.lar - a.lar || b.an - a.an,
];
type Corte = 'corto' | 'largo' | 'area';

function acomodar(items: Item[], o: OpcionesLamina, orden: Orden, corte: Corte): { hojas: Hoja[]; fuera: Item[] } {
  const W = o.largo - 2 * o.refilado, H = o.ancho - 2 * o.refilado, k = o.sierra;
  const hojas: Hoja[] = [], fuera: Item[] = [];
  const nueva = (): Hoja => ({ libres: [{ x: o.refilado, y: o.refilado, w: W, h: H }], piezas: [] });
  [...items].sort(orden).forEach(it => {
    const giros = o.respetarVeta || it.lar === it.an ? [false] : [false, true];
    const buscar = (h: Hoja) => {
      let mejor: { i: number; g: boolean; s: number } | null = null;
      h.libres.forEach((r, i) => giros.forEach(g => {
        const w = g ? it.an : it.lar, hh = g ? it.lar : it.an;
        if (w > r.w + 0.01 || hh > r.h + 0.01) return;
        const s = Math.min(r.w - w, r.h - hh); // el hueco donde sobra menos por un lado
        if (!mejor || s < mejor.s) mejor = { i, g, s };
      }));
      return mejor as { i: number; g: boolean; s: number } | null;
    };
    let hoja: Hoja | undefined, sitio: { i: number; g: boolean; s: number } | null = null;
    for (const h of hojas) { const s = buscar(h); if (s && (!sitio || s.s < sitio.s)) { sitio = s; hoja = h; } }
    if (!sitio) { const h = nueva(); const s = buscar(h); if (!s) { fuera.push(it); return; } hojas.push(h); hoja = h; sitio = s; }
    const r = hoja!.libres[sitio.i];
    const w = sitio.g ? it.an : it.lar, hh = sitio.g ? it.lar : it.an;
    hoja!.piezas.push({ nombre: it.nombre, x: r.x, y: r.y, w, h: hh, lar: it.lar, an: it.an, girada: sitio.g, canto: it.canto });
    // el sobrante se parte en dos con un corte de guillotina (se descuenta la sierra)
    const dw = r.w - w - k, dh = r.h - hh - k;
    const aLoAncho = corte === 'corto' ? dw <= dh : corte === 'largo' ? dw > dh : (r.w * Math.max(dh, 0)) >= (r.h * Math.max(dw, 0));
    const der: Libre = aLoAncho ? { x: r.x + w + k, y: r.y, w: dw, h: hh } : { x: r.x + w + k, y: r.y, w: dw, h: r.h };
    const arr: Libre = aLoAncho ? { x: r.x, y: r.y + hh + k, w: r.w, h: dh } : { x: r.x, y: r.y + hh + k, w, h: dh };
    hoja!.libres.splice(sitio.i, 1);
    [der, arr].forEach(l => { if (l.w > 1 && l.h > 1) hoja!.libres.push(l); });
  });
  return { hojas, fuera };
}

/** Clave del material: las piezas del mismo color y calibre salen de la misma lámina */
export const materialDe = (p: Pieza) => `${p.color} · ${p.thickness} mm`;

/** Acomoda las piezas de un material en láminas (el mejor de varios intentos) */
export function optimizarMaterial(material: string, piezas: Pieza[], o: OpcionesLamina): ResultadoMaterial {
  const items: Item[] = [];
  piezas.forEach(p => { for (let i = 0; i < p.quantity; i++) items.push({ nombre: p.name, lar: p.length, an: p.width, canto: p.edgeType || '' }); });
  let mejor: { hojas: Hoja[]; fuera: Item[] } | null = null, nota = Infinity;
  const usoHoja = (h: Hoja) => h.piezas.reduce((a, c) => a + c.w * c.h, 0);
  ORDENES.forEach(ord => (['corto', 'largo', 'area'] as Corte[]).forEach(c => {
    const r = acomodar(items, o, ord, c);
    // menos láminas; en el empate, la última lámina lo más vacía posible (deja el retazo más grande)
    const ultima = r.hojas.length ? Math.min(...r.hojas.map(usoHoja)) / (o.largo * o.ancho) : 0;
    const n = r.fuera.length * 1000 + r.hojas.length + ultima;
    if (n < nota) { nota = n; mejor = r; }
  }));
  const res = mejor as unknown as { hojas: Hoja[]; fuera: Item[] };
  const areaLamina = o.largo * o.ancho;
  const laminas: LaminaCortada[] = res.hojas
    .map(h => ({ piezas: h.piezas, retazos: h.libres.filter(l => Math.min(l.w, l.h) >= o.retazoMin).sort((a, b) => b.w * b.h - a.w * a.h), uso: usoHoja(h) / areaLamina }))
    .sort((a, b) => b.uso - a.uso);
  const fuera = new Map<string, { nombre: string; lar: number; an: number; cant: number }>();
  res.fuera.forEach(f => { const kf = `${f.nombre}|${f.lar}|${f.an}`; const g = fuera.get(kf); if (g) g.cant++; else fuera.set(kf, { nombre: f.nombre, lar: f.lar, an: f.an, cant: 1 }); });
  const areaPiezas = laminas.reduce((a, l) => a + l.piezas.reduce((s, c) => s + c.w * c.h, 0), 0);
  return { material, laminas, noCaben: [...fuera.values()], uso: laminas.length ? areaPiezas / (laminas.length * areaLamina) : 0, areaPiezas, piezas: items.length - res.fuera.length };
}

/** Todas las piezas del listado, por material (el mesón no se corta en tablero) */
export function optimizarListado(piezas: Pieza[], opciones: (material: string) => OpcionesLamina): ResultadoMaterial[] {
  const grupos = new Map<string, Pieza[]>();
  piezas.filter(p => p.papel !== 'meson').forEach(p => { const m = materialDe(p); grupos.set(m, [...(grupos.get(m) ?? []), p]); });
  return [...grupos.entries()].map(([m, ps]) => optimizarMaterial(m, ps, opciones(m)));
}
