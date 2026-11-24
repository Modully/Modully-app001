import * as XLSX from 'xlsx';
import type { Box } from './boxes';
import type { BOMPiece } from './types';
import { PuertaCfg, puertaDespiece } from './puertas';
import { Acabados, PATAS_POR_MUEBLE, calTexto, esBlanco, nivelDe } from './colores';

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
  // esquinero recto: la puerta falsa no lleva canto; las dilatadas de la esquina salen de una pieza de 140 que se corta por la mitad
  { re: /^puerta falsa/, parte: 'Puerta falsa', papel: 'fachada', canto: '' },
  { re: /^dilatada esquinero/, parte: 'Dilatada esquinero (cortar por la mitad)', papel: 'fachada', canto: '1LR 2AR' },
  { re: /^lateral rincon/, parte: 'Lateral rincón', papel: 'estructura', canto: '1L' },
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
  { re: /^tapa base/, parte: 'Tapa base', papel: 'estructura', canto: '1L' },
  { re: /^(tapa|techo)/, parte: 'Tapa', papel: 'estructura', canto: '1L' },
  { re: /^(entrepano|maletero)/, parte: undefined, papel: 'estructura', canto: '1L 2A' },
  { re: /^nariz/, parte: 'Nariz', papel: 'estructura', canto: '1L', confirmar: true },
  { re: /^(lateral|costado|division)/, parte: undefined, papel: 'estructura', canto: '1L 2A' },
  { re: /^(base|piso)/, parte: 'Base', papel: 'estructura', canto: '1L' },
  { re: /^puente l corrido/, parte: 'Puente L', papel: 'estructura', canto: '1L' }, // el puente corrido entre módulos va 1L (plano de Helin)
  { re: /^(gola|puente l)/, parte: 'Puente L', papel: 'estructura', canto: '2L' },
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
export function moduloDe(b: Box): string {
  if (b.moduleId) return b.moduleId;
  const m = /^(fit[A-Z]?-(?:inf|sup)-\d+-\d+(?:-s\d+)?)/.exec(b.id);
  if (m) return m[1];
  return b.id.split('-').slice(0, 2).join('-');
}

export interface ContextoPiezas {
  lineType: string;   // Básica | Media | Alta
  faceColor: string;  // color de fachada del cliente
  puerta?: PuertaCfg; // sección Puertas: la puerta se despieza con su propia regla
  acabados?: Acabados; // colores de estructura por tipo de mueble, canto del frente y sistema gola (si no se dan, manda la línea)
  corredera?: 'full' | 'oculta'; // correderas de los cajones (para el costeo)
  conZocalo?: boolean; // la cocina lleva zócalo (con zócalo en aluminio, cada mueble base lleva patas)
  parcial?: boolean;   // lista de un módulo suelto (costeo): sin los herrajes globales de la cocina
  puentes?: string[]; // módulos en puente (el de arriba): llevan sus propios colores
  abiertos?: string[]; // módulos abiertos (sin puertas): todas sus piezas van en el material de la fachada, también el fondo
}

/** Orden de la lista del carpintero: calibre, luego color, luego canto */
const ORDEN_CANTO = ['', '1L', '1L 1A', '1L 2A', '2A', '2L', '4L', '4LR'];

/** Módulo de cocina de donde sale la pieza, como lo nombra el carpintero: "MB A", "MA C" */
function etiquetaModulo(b: Box): { resto: string; etiqueta: string } | null {
  const m = /^(panel|front|visto|dilatacion)-(lower|upper)-/.exec(b.id);
  const l = /^(.*\S)\s+([A-Z]{1,2})$/.exec(b.name);
  if (!m || !l) return null;
  const tipo = /tall-oven/.test(b.moduleId ?? '') ? 'TH' : /tall-pantry/.test(b.moduleId ?? '') ? 'AL' : m[2] === 'upper' ? 'MA' : 'MB';
  return { resto: l[1], etiqueta: `${tipo} ${l[2]}` };
}

/** Color de la fachada de ese tipo de mueble (aéreos con la suya; si no se dio, la general) */
const fachadaDe = (ctx: ContextoPiezas, tipo?: string) => (ctx.acabados ? nivelDe(ctx.acabados, tipo).fach.color : '') || ctx.faceColor || 'Color fachada';

function material(papel: Papel, ctx: ContextoPiezas, tipo?: string): string {
  // estructura: el color elegido para ese tipo de mueble (aéreo, base u otros); sin acabados, según la línea
  const a = ctx.acabados ? nivelDe(ctx.acabados, tipo) : null; // MA para los aéreos; MB para los demás
  const est = a ? `${a.est.color || 'Blanco'}${a.est.rh ? ' RH' : ''}` : ctx.lineType === 'Básica' ? 'Blanco RH' : `${ctx.faceColor || 'Color'} RH`;
  if (papel === 'fachada' || papel === 'liston') return `${fachadaDe(ctx, tipo)}${a?.fach.rh ? ' RH' : ''}`;
  // fondo y espaldar: su color con el calibre real (se pide de 6 pero mide 5,5; también se vende de 2,5 y de 4)
  if (papel === 'fondo') return a ? `${a.fondo.color || 'Blanco'}${a.fondo.rh ? ' RH' : ''} ${calTexto(a.fondo.cal)}` : 'Blanco 5,5';
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
    // espacio que sobra contra el muro (regla del carpintero): hasta 2 cm, dilatada de 7 cm puesta de canto al ras de las puertas;
    // de más de 2 cm y hasta 10 cm, filler del color de la fachada (4LR, alto de la puerta vecina) delante de una dilatada
    const hueco = /^dilatacion-([ABC])-(lower|upper)-/.exec(b.id);
    if (b.kind === 'filler' && hueco) {
      const ancho = Math.round(hueco[1] === 'A' ? b.sx : b.sy), alto = Math.round(b.sz), altoPuerta = hueco[2] === 'upper' ? alto + 10 : alto - 30;
      if (ancho > 100 || ancho <= 0) { omitidas++; return; }
      const base = { quantity: 1, thickness: 15, color: material('fachada', ctx), papel: 'fachada' as Papel, modulos: [] as string[] };
      if (ancho > 20) push({ ...base, name: `Filler ${hueco[2] === 'upper' ? 'MA' : 'MB'}`, length: altoPuerta, width: ancho, edgeType: '4LR' }, moduloDe(b));
      push({ ...base, name: `Dilatada ${hueco[2] === 'upper' ? 'MA' : 'MB'}`, length: alto, width: 70, edgeType: '' }, moduloDe(b));
      return;
    }
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
      const largoZ = Math.round(Math.max(b.sx, b.sy)), tramos = Math.ceil(largoZ / (ctx.acabados?.laminaLargo ?? 2400));
      if (ctx.acabados?.herrajes?.zocaloAluminio) { // zócalo en aluminio: perfil por su largo, no la tira de melamina
        const medida = `${largoZ} mm`, k = `Perfil zócalo aluminio|${medida}`, h = herr.get(k);
        if (h) h.cant++; else herr.set(k, { nombre: 'Perfil zócalo aluminio', cant: 1, medida });
        return;
      }
      push({ name: 'Zócalo', quantity: tramos, length: Math.round(largoZ / tramos), width: Math.round(b.sz), thickness: 15, color: 'Blanco RH', edgeType: '1L', papel: 'estructura', modulos: [] }, moduloDe(b));
      return;
    }
    // sistema gola en aluminio: el puente en L no es de melamina, es un perfil (va a herrajes por su largo)
    if (ctx.acabados?.gola === 'aluminio' && /^(gola|puente l)/.test(n)) {
      if (/vertical/.test(n)) return; // el perfil reemplaza las dos piezas del puente en L
      const medida = `${Math.round(Math.max(b.sx, b.sy, b.sz))} mm`, k = `Perfil gola aluminio|${medida}`;
      const h = herr.get(k); if (h) h.cant++; else herr.set(k, { nombre: 'Perfil gola aluminio', cant: 1, medida });
      return;
    }
    const r = REGLAS.find(x => x.re.test(n));
    let papel: Papel = r?.papel ?? 'estructura';
    const em = etiquetaModulo(b);
    const esPu = !!(b.moduleId && ctx.puentes?.includes(b.moduleId));
    let parte = r?.parte ?? limpiar(em ? em.resto : b.name);
    let canto = r?.canto ?? '';
    // módulo de cocina: el amarre del aéreo es su soporte (cuchilla) y el nombre lleva el módulo ("Lateral MB A")
    if (em) {
      if (parte === 'Puente' && em.etiqueta.startsWith('MA')) parte = 'Soporte';
      parte = `${parte} ${em.etiqueta}`;
      // fachada de cocina: 15 por defecto y 18 solo en la línea Alta
      if (papel === 'fachada' && b.kind === 'front') cal = ctx.acabados ? nivelDe(ctx.acabados, esPu ? 'PU' : em.etiqueta.split(' ')[0]).fach.cal : ctx.lineType === 'Alta' ? 18 : 15;
    }
    if (/^espaldar/.test(n) && cal >= 15) { canto = '2A'; papel = 'estructura'; } // espaldar de 15 (torre de hornos): tablero de estructura con canto en los dos anchos
    if (papel === 'fondo' && cal >= 15 && !/^espaldar/.test(n)) papel = 'estructura'; // fondo de cajón de 15 (corredera oculta): tablero de estructura, sin canto
    const tipoMueble = esPu ? 'PU' : em?.etiqueta.split(' ')[0];
    let color = material(papel, ctx, tipoMueble);
    // calibre del fondo en la columna CAL: 3, 4 o 6 (el real va en el color)
    if (papel === 'fondo' && ctx.acabados && cal < 15) cal = Math.ceil(nivelDe(ctx.acabados, tipoMueble).fondo.cal);
    const fach = fachadaDe(ctx, tipoMueble);
    // estructura blanca con fachada de otro color: el canto del frente va en el color de la fachada (si así se pidió)
    const esBlanca = !!fach && !esBlanco(fach) && (ctx.acabados ? ctx.acabados.cantoFachada && esBlanco(color) : ctx.lineType === 'Básica');
    if (b.moduleId && ctx.abiertos?.includes(b.moduleId)) {
      // módulo abierto: todo en el material de la fachada, con el fondo del mismo color; se ve por dentro, así que sus cantos van completos
      color = papel === 'fondo' ? `${fach} 5,5` : fach;
      if (papel === 'estructura' && canto && !/cajon/.test(n)) canto = /^(lateral|entrepano|base|piso|techo|tapa)/.test(n) ? '4L' : canto;
    } else if (esBlanca && papel === 'estructura' && em && canto) {
      // estructura Blanco RH con fachada de color: el canto del frente (el largo que se ve) va en el color de la fachada y los anchos en blanco
      if (/^(lateral(?! cajon)|entrepano|base|piso|techo|tapa)/.test(n) && !/^tapa base/.test(n)) canto = canto.replace(/^1L/, `1L ${fach}`).replace(/2A$/, '2A Blanco');
      else if (/^(gola|puente l)/.test(n)) canto = `2L ${fach}`;
    }
    // canto rígido o flexible según lo elegido: estructura del tipo de mueble y fachada (R en cada grupo: 1LR, 2AR, 4LR)
    if (ctx.acabados && canto) {
      const nv = nivelDe(ctx.acabados, tipoMueble);
      const rig = papel === 'fachada' ? nv.fach.rigido : papel === 'estructura' ? nv.est.rigido : undefined;
      if (rig === true) canto = canto.replace(/(\d[LA])(?!R)/g, '$1R');
      else if (rig === false) canto = canto.replace(/(\d[LA])R/g, '$1');
    }
    if (/^dilatada esquinero/.test(n)) an = 140; // las dos dilatadas de la esquina (70 + 70) salen de una pieza de 140
    push({ name: parte, quantity: 1, length: lar, width: an, thickness: cal, color, edgeType: canto, papel, modulos: [], confirmar: !r || r.confirmar }, moduloDe(b));
  });

  // orden del carpintero: calibre, color, canto; el mesón al final
  const oc = (c0: string) => { const c = (c0.match(/\d[LA]R?/g) ?? []).join(' '); const k = ORDEN_CANTO.indexOf(c); return k < 0 ? ORDEN_CANTO.length : k; };
  const piezas = [...grupos.values()]
    .sort((a, c) => (a.papel === 'meson' ? 1 : 0) - (c.papel === 'meson' ? 1 : 0) || a.thickness - c.thickness || a.color.localeCompare(c.color) || oc(a.edgeType) - oc(c.edgeType) || a.name.localeCompare(c.name) || c.length - a.length)
    .map((p, i) => ({ ...p, item: i + 1 }));
  // herrajes de las respuestas de Configuración de módulos
  const hc = ctx.acabados?.herrajes;
  if (hc?.zocaloAluminio && ctx.conZocalo !== false) {
    const bajos = new Set(boxes.filter(b => b.kind === 'lower' && b.moduleId).map(b => b.moduleId as string));
    if (bajos.size) herr.set('Pata plástica', { nombre: 'Pata plástica', cant: bajos.size * PATAS_POR_MUEBLE });
  }
  if (!ctx.parcial) herrajesGlobales(ctx, boxes).forEach(h => herr.set(h.nombre, h));
  return { piezas, herrajes: [...herr.values()], omitidas };
}

/** Herrajes de toda la cocina marcados en Configuración de módulos (platillero, condimentero, basurera, esquina mágica) */
export function herrajesGlobales(ctx: ContextoPiezas, boxes: Box[]): Herraje[] {
  const hc = ctx.acabados?.herrajes;
  if (!hc) return [];
  const out: Herraje[] = [];
  if (hc.platillero) out.push({ nombre: 'Platillero', cant: 1 });
  if (hc.condimentero) out.push({ nombre: 'Condimentero', cant: 1 });
  if (hc.basurera) out.push({ nombre: 'Basurera', cant: 1 });
  if (hc.esquinaMagica) out.push({ nombre: 'Esquina mágica', cant: 1 });
  return out;
}

/** Canto de cada borde de una pieza, para el optimizador: L1 y L2 son los dos largos, a1 y a2 los dos anchos. "Fl" = flexible, "RG" = rígido */
export function bordesDeCanto(canto: string, color: string): { l1: string; l2: string; a1: string; a2: string } {
  const base = color.replace(/\s+(RH|\d+(,\d+)?)$/i, '').trim();
  const largos = Number(/(\d)L/.exec(canto)?.[1] ?? 0), anchos = Number(/(\d)A/.exec(canto)?.[1] ?? 0);
  // el canto puede traer su propio color después de cada grupo: "1L Ambar 2A Blanco" (frente en el color de la fachada, anchos en blanco)
  const colorL = /\dLR?\s+([^\d\s][^\d]*?)(?=\s+\d|$)/.exec(canto)?.[1]?.trim() || base;
  const colorA = /\dAR?\s+([^\d\s][^\d]*?)(?=\s+\d|$)/.exec(canto)?.[1]?.trim() || base;
  const lr = /\dLR/.test(canto), ar = /\dAR/.test(canto);
  const tl = `${colorL} ${lr ? 'RG' : 'Fl'}`, ta = `${colorA} ${ar ? 'RG' : 'Fl'}`;
  // "4L" y "4LR" son los cuatro bordes
  if (largos === 4) return { l1: tl, l2: tl, a1: tl, a2: tl };
  return { l1: largos >= 1 ? tl : '', l2: largos >= 2 ? tl : '', a1: anchos >= 1 ? ta : '', a2: anchos >= 2 ? ta : '' };
}

/**
 * Fase 1 · Listado de corte en Excel, con dos hojas como los archivos del carpintero:
 * - "LISTA DE PARTES": su formato (ITEM, PARTE, C/D, LAR, AN, CAL, COLOR, CANTO).
 * - "CORTECLOUD": el formato del optimizador (C/D, LAR, AN, CANTO, L1, L2, a1, a2, COLOR, PARTE, Veta), con el canto de cada borde.
 * El mesón no va en la hoja del optimizador (no se corta en tablero).
 */
function libroDeCorte(lista: ListaPiezas): XLSX.WorkBook {
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
  return wb;
}
export function exportarListadoDeCorte(lista: ListaPiezas, nombre: string): void {
  XLSX.writeFile(libroDeCorte(lista), `${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
/** El mismo Excel (LISTA DE PARTES, CORTECLOUD y HERRAJES) como archivo, para guardarlo en el proyecto */
export function archivoListadoDeCorte(lista: ListaPiezas): Blob {
  const datos = XLSX.write(libroDeCorte(lista), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
