import * as XLSX from 'xlsx';
import type { Box } from './boxes';
import type { BOMPiece } from './types';
import { PuertaCfg, puertaDespiece } from './puertas';

/**
 * Fase 0 · Lista de piezas única.
 *
 * Todas las secciones (cocinas, closet constructor, Closet fit, walking, baño, centro de entretenimiento y puertas) dibujan sus piezas reales
 * como cajas (`buildBoxes`). Esta lista sale de esas mismas cajas, así el 3D y el despiece nunca se contradicen.
 *
 * Por cada caja:
 * - Se descarta lo que no se corta: muros, cubos sin convertir, espacios libres, ambientación (TV, sanitario, espejo), chapas y tubos
 *   (los tubos van a la lista de herrajes).
 * - CAL = la medida más delgada.
 * - LAR (sentido de la veta) y AN:
 *     · pieza parada (lateral, puerta, frente, espaldar): LAR = el alto; si es una tira (alto < 150, como un puente o un amarre), LAR = su largo.
 *     · pieza acostada (base, entrepaño, tapa): LAR = la medida más larga.
 * - Material según su papel: estructura, fachada, fondo o mesón (con la línea y el color del proyecto).
 * - Canto según la pieza (tabla `REGLAS`); se marca "por confirmar" lo que aún no validó el carpintero.
 * Las piezas iguales (misma parte, medidas, calibre, material y canto) se agrupan sumando la cantidad.
 */

export type Papel = 'estructura' | 'fachada' | 'fondo' | 'meson' | 'liston';

export interface Pieza extends BOMPiece {
  papel: Papel;
  modulos: string[];      // de qué módulos o cuerpos salen (para rastrear)
  confirmar?: boolean;    // regla de canto o veta aún por confirmar con el carpintero
}

export interface Herraje { nombre: string; cant: number; medida?: string }

export interface ListaPiezas { piezas: Pieza[]; herrajes: Herraje[]; omitidas: number }

interface Regla { re: RegExp; parte?: string; papel: Papel; canto: string; confirmar?: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Reglas por nombre de pieza (en orden: gana la primera que coincide). Cantos confirmados por el carpintero con sus proyectos reales: base, tapa, puente y zócalo 1L; lateral, entrepaño y maletero 1L 2A; puente L y listón 2L; puerta, frente y visto 4LR; dilatada, espaldar y fondo sin canto (espaldar de 15: 2A) */
const REGLAS: Regla[] = [
  // puertas de paso (sección Puertas: la hoja se despieza con su regla propia, ver `puertaDespiece`)
  { re: /^tapaluz puerta/, parte: 'Tapaluz', papel: 'estructura', canto: '' },
  { re: /^marco cabezal puerta/, parte: 'Marco cabezal', papel: 'estructura', canto: '2L' },
  { re: /^batiente puerta/, parte: 'Batiente', papel: 'estructura', canto: '2L' },
  { re: /^marco puerta/, parte: 'Marco', papel: 'estructura', canto: '2L' },
  { re: /^dilatada puerta/, parte: 'Dilatada', papel: 'estructura', canto: '' },
  // fachadas
  { re: /^(puerta|frente)/, parte: undefined, papel: 'fachada', canto: '4LR' },
  // fondos
  { re: /fondo alistonado/, parte: 'Fondo alistonado', papel: 'fondo', canto: '' },
  { re: /(^fondo cajon|cajon .*fondo)/, parte: 'Fondo cajón', papel: 'fondo', canto: '' },
  { re: /^espaldar/, parte: 'Espaldar', papel: 'fondo', canto: '' },
  // alistonados
  { re: /^liston/, parte: 'Listón', papel: 'liston', canto: '2L' },
  // cajones
  { re: /(lateral cajon|cajon .*lateral)/, parte: 'Lateral cajón', papel: 'estructura', canto: '1L' },
  { re: /(testero cajon|cajon .*testero)/, parte: 'Testero cajón', papel: 'estructura', canto: '1L' },
  // vistos (siempre 4LR) y dilatadas (sin canto)
  { re: /^visto/, parte: 'Visto', papel: 'fachada', canto: '4LR' },
  { re: /^(dilatada|dilatacion|pieza de dilatacion)/, parte: 'Dilatada', papel: 'fachada', canto: '' },
  // zócalos
  { re: /^zocalo/, parte: 'Zócalo', papel: 'estructura', canto: '1L' },
  // estructura
  { re: /^(tapa|techo)/, parte: 'Tapa', papel: 'estructura', canto: '1L' },
  { re: /^(entrepano|maletero)/, parte: undefined, papel: 'estructura', canto: '1L 2A' },
  { re: /^nariz/, parte: 'Nariz', papel: 'estructura', canto: '1L', confirmar: true },
  { re: /^(lateral|costado|division)/, parte: undefined, papel: 'estructura', canto: '1L 2A' },
  { re: /^(base|piso)/, parte: 'Base', papel: 'estructura', canto: '1L' },
  { re: /^gola/, parte: 'Puente L', papel: 'estructura', canto: '2L' },
  { re: /^amarre/, parte: 'Puente', papel: 'estructura', canto: '1L' },
  { re: /^puente/, parte: undefined, papel: 'estructura', canto: '1L' },
  { re: /^marco/, parte: undefined, papel: 'estructura', canto: '2L', confirmar: true },
];

/** Lo que no se corta en tablero */
/** Piezas paradas cuya veta va vertical (el LAR es su alto), como en los planos: Lateral 400 x 532, Puerta Caj 298 x 748, Lat Caj 1800 x 250 */
const VETA_VERTICAL = /^(lateral(?! cajon)|costado|division|puerta|frente|hoja|tapa de hoja|espaldar|visto|marco|batiente|dilatada|liston|larguero|tapaluz)/;

const OMITIR = /^(cuerpo |hueco |cubo closet fit|chapa|televisor|sanitario|espejo|muro|columna)/;
const HERRAJE = /^tubo/;

/** Nombre de la parte sin números ni sufijos internos ("Lateral fit" → "Lateral", "Cajón 2 lateral izquierdo" → "Lateral cajón") */
function limpiar(name: string): string {
  return name
    .replace(/\s+(fit|closet|cajonero|rep)\b/gi, '')
    .replace(/\s+(MB|MA|MT|TA)[-\s]?\S*$/i, '')
    .replace(/\s*·\s*\d+/g, '')
    .replace(/\s+\d+(\.\d+)?/g, '')
    .replace(/\s+(izquierdo|derecho|izquierda|derecha|inicio|cierre)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Módulo o cuerpo de donde sale la caja (para rastrear la pieza) */
function moduloDe(b: Box): string {
  if (b.moduleId) return b.moduleId;
  const m = /^(fit[A-Z]?-(?:inf|sup)-\d+-\d+(?:-s\d+)?)/.exec(b.id);
  if (m) return m[1];
  return b.id.split('-').slice(0, 2).join('-');
}

export interface ContextoPiezas {
  lineType: string;   // Básica | Media | Alta
  faceColor: string;  // color de fachada del cliente
  puerta?: PuertaCfg; // sección Puertas: la puerta se despieza con su propia regla
}

/** Orden de la lista del carpintero: calibre, luego color, luego canto */
const ORDEN_CANTO = ['', '1L', '1L 1A', '1L 2A', '2A', '2L', '4L', '4LR'];

/** Módulo de cocina de donde sale la pieza, como lo nombra el carpintero: "MB A", "MA C" */
function etiquetaModulo(b: Box): { resto: string; etiqueta: string } | null {
  const m = /^(panel|front|visto|dilatacion)-(lower|upper)-/.exec(b.id);
  const l = /^(.*\S)\s+([A-Z]{1,2})$/.exec(b.name);
  if (!m || !l) return null;
  return { resto: l[1], etiqueta: `${m[2] === 'upper' ? 'MA' : 'MB'} ${l[2]}` };
}

function material(papel: Papel, ctx: ContextoPiezas): string {
  const est = ctx.lineType === 'Básica' ? 'Blanco RH' : `${ctx.faceColor || 'Color'} RH`;
  if (papel === 'fachada' || papel === 'liston') return ctx.faceColor || 'Color fachada';
  if (papel === 'fondo') return 'Blanco 5,5'; // el fondo se pide de 6 pero su calibre real es 5,5
  if (papel === 'meson') return 'Material del mesón';
  return est;
}

/** Lista de piezas única de un diseño, a partir de sus cajas */
export function listaDePiezas(boxes: Box[], ctx: ContextoPiezas): ListaPiezas {
  const herr = new Map<string, Herraje>();
  const grupos = new Map<string, Pieza>();
  let omitidas = 0;
  const push = (p: Omit<Pieza, 'item'>, mod: string) => {
    const k = [p.name, p.length, p.width, p.thickness, p.color, p.edgeType].join('|');
    const g = grupos.get(k);
    if (g) { g.quantity += p.quantity; if (!g.modulos.includes(mod)) g.modulos.push(mod); }
    else grupos.set(k, { ...p, item: 0, modulos: [mod] });
  };

  // sección Puertas: la puerta tiene su despiece propio (hoja entamborada con tapas y bastidor, dilatadas con repuesto…)
  if (ctx.puerta) {
    puertaDespiece(ctx.puerta).forEach(r => {
      const papel: Papel = /hoja|tapa de hoja/i.test(r.parte) ? 'fachada' : 'estructura';
      push({ name: r.parte, quantity: r.cant, length: Math.round(r.largo), width: Math.round(r.ancho), thickness: r.cal, color: material(papel, ctx), edgeType: r.canto, papel, modulos: [] }, 'puerta');
    });
  }

  boxes.forEach(b => {
    if (b.kind === 'wall' || b.kind === 'appliance') return;
    const n = norm(b.name);
    if (ctx.puerta && b.id.startsWith('puerta-')) return; // ya va en el despiece de la puerta
    if (OMITIR.test(n) || / rep fit$/.test(n)) { omitidas++; return; }
    // cubos de cocina sin convertir: no son piezas
    if (b.kind === 'lower' || b.kind === 'upper' || b.kind === 'tall') { omitidas++; return; }
    // de los rellenos solo se cortan los vistos y las dilatadas de tablero (el hueco de dilatación contra el muro no es una pieza)
    if (b.kind === 'filler' && Math.min(b.sx, b.sy, b.sz) > 36) { omitidas++; return; }
    if (HERRAJE.test(n)) {
      const nombre = limpiar(b.name), medida = `${Math.round(Math.max(b.sx, b.sy, b.sz))} mm`;
      const k = `${nombre}|${medida}`;
      const h = herr.get(k); if (h) h.cant++; else herr.set(k, { nombre, cant: 1, medida });
      return;
    }
    const dims = [b.sx, b.sy, b.sz];
    let cal = Math.round(Math.min(...dims));
    let lar: number, an: number;
    if (b.kind === 'counter') {
      lar = Math.round(Math.max(...dims)); an = Math.round(dims.sort((a, c) => a - c)[1]);
    } else if (b.sz > Math.min(b.sx, b.sy) && b.sz >= 150 && VETA_VERTICAL.test(n)) {
      // pieza parada con veta vertical (lateral, costado, puerta, frente, espaldar, visto, marco, listón): LAR = el alto
      lar = Math.round(b.sz); an = Math.round(b.sx <= b.sy ? b.sy : b.sx);
    } else {
      // el resto (bases, entrepaños, tapas, puentes, amarres y piezas de cajón): LAR = la medida más larga de su cara
      const cara = [...dims].sort((a, c) => a - c).slice(1);
      lar = Math.round(cara[1]); an = Math.round(cara[0]);
    }
    if (b.kind === 'counter') {
      push({ name: limpiar(b.name), quantity: 1, length: lar, width: an, thickness: cal, color: material('meson', ctx), edgeType: '', papel: 'meson', modulos: [] }, moduloDe(b));
      return;
    }
    // zócalo de cocina: la caja es el volumen; la pieza es una tira de 15 del alto del zócalo, en Blanco RH (va aparte de los laterales)
    if (b.kind === 'zocalo' && cal > 36) {
      // un zócalo más largo que la lámina se parte en tramos iguales (máximo 2400)
      const largoZ = Math.round(Math.max(b.sx, b.sy)), tramos = Math.ceil(largoZ / 2400);
      push({ name: 'Zócalo', quantity: tramos, length: Math.round(largoZ / tramos), width: Math.round(b.sz), thickness: 15, color: 'Blanco RH', edgeType: '1L', papel: 'estructura', modulos: [] }, moduloDe(b));
      return;
    }
    const r = REGLAS.find(x => x.re.test(n));
    const papel: Papel = r?.papel ?? 'estructura';
    const em = etiquetaModulo(b);
    let parte = r?.parte ?? limpiar(em ? em.resto : b.name);
    let canto = r?.canto ?? '';
    // módulo de cocina: el amarre del aéreo es su soporte (cuchilla) y el nombre lleva el módulo ("Lateral MB A")
    if (em) {
      if (parte === 'Puente' && em.etiqueta.startsWith('MA')) parte = 'Soporte';
      parte = `${parte} ${em.etiqueta}`;
      // fachada de cocina: 15 por defecto y 18 solo en la línea Alta
      if (papel === 'fachada' && b.kind === 'front') cal = ctx.lineType === 'Alta' ? 18 : 15;
    }
    if (/^espaldar/.test(n) && cal >= 15) canto = '2A'; // espaldar de 15: canto en los dos anchos
    push({ name: parte, quantity: 1, length: lar, width: an, thickness: cal, color: material(papel, ctx), edgeType: canto, papel, modulos: [], confirmar: !r || r.confirmar }, moduloDe(b));
  });

  // orden del carpintero: calibre, color, canto; el mesón al final
  const oc = (c: string) => { const k = ORDEN_CANTO.indexOf(c); return k < 0 ? ORDEN_CANTO.length : k; };
  const piezas = [...grupos.values()]
    .sort((a, c) => (a.papel === 'meson' ? 1 : 0) - (c.papel === 'meson' ? 1 : 0) || a.thickness - c.thickness || a.color.localeCompare(c.color) || oc(a.edgeType) - oc(c.edgeType) || a.name.localeCompare(c.name) || c.length - a.length)
    .map((p, i) => ({ ...p, item: i + 1 }));
  return { piezas, herrajes: [...herr.values()], omitidas };
}

/** Canto de cada borde de una pieza, para el optimizador: L1 y L2 son los dos largos, a1 y a2 los dos anchos. "Fl" = flexible, "RG" = rígido */
export function bordesDeCanto(canto: string, color: string): { l1: string; l2: string; a1: string; a2: string } {
  const base = color.replace(/\s+(RH|\d+(,\d+)?)$/i, '').trim();
  const largos = Number(/(\d)L/.exec(canto)?.[1] ?? 0), anchos = Number(/(\d)A/.exec(canto)?.[1] ?? 0);
  const t = (rigido: boolean) => `${base} ${rigido ? 'RG' : 'Fl'}`;
  const lr = /\dLR/.test(canto), ar = /\dAR/.test(canto);
  // "4L" y "4LR" son los cuatro bordes
  if (largos === 4) return { l1: t(lr), l2: t(lr), a1: t(lr), a2: t(lr) };
  return { l1: largos >= 1 ? t(lr) : '', l2: largos >= 2 ? t(lr) : '', a1: anchos >= 1 ? t(ar) : '', a2: anchos >= 2 ? t(ar) : '' };
}

/**
 * Fase 1 · Listado de corte en Excel, con dos hojas como los archivos del carpintero:
 * - "LISTA DE PARTES": su formato (ITEM, PARTE, C/D, LAR, AN, CAL, COLOR, CANTO).
 * - "CORTECLOUD": el formato del optimizador (C/D, LAR, AN, CANTO, L1, L2, a1, a2, COLOR, PARTE, Veta), con el canto de cada borde.
 * El mesón no va en la hoja del optimizador (no se corta en tablero).
 */
export function exportarListadoDeCorte(lista: ListaPiezas, nombre: string): void {
  const partes = [
    ['ITEM', 'PARTE', 'C/D', 'LAR', 'AN', 'CAL', 'COLOR', 'CANTO'],
    ...lista.piezas.map(p => [p.item, p.name, p.quantity, p.length, p.width, p.thickness, p.color, p.edgeType || '']),
  ];
  const corte = [
    ['C/D', 'LAR', 'AN', 'CANTO', 'L1', 'L2', 'a1', 'a2', 'COLOR', 'PARTE', 'Veta'],
    ...lista.piezas.filter(p => p.papel !== 'meson').map(p => {
      const b = bordesDeCanto(p.edgeType || '', p.color);
      // el color lleva el calibre cuando no es de 15 ni fondo: "Ambar 18"
      const color = p.thickness !== 15 && p.papel !== 'fondo' ? `${p.color} ${p.thickness}` : p.color;
      return [p.quantity, p.length, p.width, p.edgeType || 0, b.l1, b.l2, b.a1, b.a2, color, p.name, 'S'];
    }),
  ];
  const wb = XLSX.utils.book_new();
  const h1 = XLSX.utils.aoa_to_sheet(partes);
  h1['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 16 }, { wch: 10 }];
  const h2 = XLSX.utils.aoa_to_sheet(corte);
  h2['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(wb, h1, 'LISTA DE PARTES');
  XLSX.utils.book_append_sheet(wb, h2, 'CORTECLOUD');
  if (lista.herrajes.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['HERRAJE', 'CANT', 'MEDIDA'], ...lista.herrajes.map(h => [h.nombre, h.cant, h.medida ?? ''])]), 'HERRAJES');
  }
  XLSX.writeFile(wb, `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
