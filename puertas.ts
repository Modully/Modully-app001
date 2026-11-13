import type { Box } from './boxes';

/**
 * Puerta de paso (sección Puertas). Reglas del carpintero (formato de puertas en Excel, 2026-11-12):
 * - Vano: alto, ancho y espesor del muro. La puerta va dentro del vano. Marcos laterales del alto del vano y de ancho = espesor del muro, en tablero de 15.
 * - Marcos dilatados: una dilatada de 15 x 15 a cada lado del marco, por delante y por detrás (4 por puerta, y se suman 2 por si se parte alguna);
 *   el marco se corre 15 hacia adentro.
 * - Sin marcos dilatados: el marco queda a 5 mm del muro por lado (por el desfase de los muros), siempre con cabezal y con tapaluz:
 *   lámina de 40 mm (de 15, 6 o 3) a lo largo de cada marco y arriba, por las dos caras, unida a 45 grados con el tapaluz superior.
 * - Cabezal: marco cabezal entre los marcos laterales; su batiente se apoya encima de las batientes de los marcos (batiente del marco = alto - 31).
 *   Sin cabezal la batiente del marco va del alto del marco y la hoja queda 20 mm más baja que el marco.
 * - Batiente: 40 mm menos que el ancho del marco (la hoja suele ser de 36).
 * - Hoja: 5 mm de luz a cada lado contra el marco; con cabezal, alto = vano - 35 (15 del cabezal, 5 de luz arriba, 15 abajo); sin cabezal, vano - 20.
 *   Maciza: un tablero del espesor de la hoja. Entamborada: dos tapas de 6 (10 mm más grandes para refilar) y un bastidor de listones de 30 x 25.
 */
export interface PuertaCfg {
  cantidad: number;
  alto: number;        // alto del vano (mm)
  ancho: number;       // ancho del vano (mm)
  espesor: number;     // espesor del muro (mm)
  tipo: 'maciza' | 'entamborada';
  dilatados: boolean;  // marcos dilatados a los lados
  cabezal: boolean;    // lleva marco cabezal (y su batiente); sin dilatados siempre lleva
  hojaEsp: number;     // espesor de la hoja (mm), normalmente 36
  travesanos: number;  // listones horizontales del bastidor de la hoja entamborada
  bisagra?: 'izq' | 'der'; // lado de las bisagras (la chapa va del otro lado); por defecto izquierda
  tapaluz?: boolean;       // lleva tapaluz (sin valor: sí cuando no lleva marcos dilatados)
  tapaluzAncho?: number;   // ancho de la lámina del tapaluz (mm), normalmente 40
  tapaluzEsp?: number;     // espesor del tapaluz (15, 6 o 3)
}

export const DEFAULT_PUERTA: PuertaCfg = { cantidad: 1, alto: 2100, ancho: 800, espesor: 100, tipo: 'entamborada', dilatados: true, cabezal: true, hojaEsp: 36, travesanos: 6, tapaluzEsp: 15 };

export interface PuertaPieza { parte: string; cant: number; largo: number; ancho: number; cal: number; canto: string }

const E = 15;        // espesor del tablero de los marcos y batientes
const LUZ = 5;       // luz de la hoja contra el marco
const PISO = 15;     // espacio de la hoja al piso
const CHAPA_ALTO = 900; // altura de la chapa desde el piso
const DESFASE = 5;   // sin dilatados: espacio del marco al muro por lado

/** Con marcos dilatados el cabezal es opcional; sin dilatados siempre lleva cabezal (y tapaluz) */
export const conCabezal = (p: PuertaCfg) => p.cabezal || !p.dilatados;
/** Lleva tapaluz: lo que se elija en el formulario; si no se ha elegido, sí cuando va sin marcos dilatados */
export const conTapaluz = (p: PuertaCfg) => p.tapaluz ?? !p.dilatados;

/** Medidas derivadas de una puerta (mm) */
export function puertaMedidas(p: PuertaCfg) {
  const D = p.dilatados ? E : DESFASE;                  // del muro al marco
  const cab = conCabezal(p);
  const hojaAlto = cab ? p.alto - E - LUZ - PISO : p.alto - 20;
  const hojaAncho = p.ancho - 2 * (D + E + LUZ);
  const batAncho = Math.max(10, p.espesor - 40);
  const batAlto = cab ? p.alto - 31 : p.alto;
  const cabLargo = p.ancho - 2 * (D + E);
  const tl = p.tapaluzEsp ?? 15, TAPALUZ = Math.max(10, p.tapaluzAncho ?? 40);
  // tapaluz: su borde interior queda al ras de la cara interior del marco (y del cabezal)
  const tlLat = p.alto - E + TAPALUZ, tlSup = p.ancho - 2 * (D + E) + 2 * TAPALUZ; // medidas a la punta del corte a 45
  return { D, cab, hojaAlto, hojaAncho, batAncho, batAlto, cabLargo, tl, tlA: TAPALUZ, tlLat, tlSup };
}

/** Despiece de la puerta (por puerta multiplicado por la cantidad), en el orden del formato de Excel */
export function puertaDespiece(p: PuertaCfg): PuertaPieza[] {
  const n = Math.max(1, Math.round(p.cantidad));
  const m = puertaMedidas(p);
  const out: PuertaPieza[] = [];
  if (p.tipo === 'maciza') out.push({ parte: 'Hoja', cant: n, largo: m.hojaAlto, ancho: m.hojaAncho, cal: p.hojaEsp, canto: '4L' });
  else {
    out.push({ parte: 'Tapa de hoja', cant: 2 * n, largo: m.hojaAlto + 10, ancho: m.hojaAncho + 10, cal: 6, canto: '4L' });
    out.push({ parte: 'Larguero bastidor', cant: 2 * n, largo: m.hojaAlto, ancho: 30, cal: 25, canto: '' });
    out.push({ parte: 'Travesaño bastidor', cant: Math.max(2, Math.round(p.travesanos)) * n, largo: m.hojaAncho - 50, ancho: 30, cal: 25, canto: '' });
  }
  out.push({ parte: 'Marco', cant: 2 * n, largo: p.alto, ancho: p.espesor, cal: E, canto: '2L' });
  out.push({ parte: 'Batiente marco', cant: 2 * n, largo: m.batAlto, ancho: m.batAncho, cal: E, canto: '2L' });
  if (m.cab) {
    out.push({ parte: 'Marco cabezal', cant: n, largo: m.cabLargo, ancho: p.espesor, cal: E, canto: '2L' });
    out.push({ parte: 'Batiente cabezal', cant: n, largo: m.cabLargo, ancho: m.batAncho, cal: E, canto: '2L' });
  }
  if (p.dilatados) out.push({ parte: 'Dilatada', cant: 4 * n + 2, largo: p.alto, ancho: E, cal: E, canto: '' });
  if (conTapaluz(p)) {
    out.push({ parte: 'Tapaluz lateral (45°)', cant: 4 * n, largo: m.tlLat, ancho: m.tlA, cal: m.tl, canto: '' });
    out.push({ parte: 'Tapaluz superior (45°)', cant: 2 * n, largo: m.tlSup, ancho: m.tlA, cal: m.tl, canto: '' });
  }
  return out;
}

/**
 * Piezas en 3D de una puerta dentro del vano del muro A, centrada a lo largo del muro.
 * El muro ocupa y de -T a 0 (0 = cara de adelante): la hoja queda al ras del frente y las batientes atrás.
 */
export function puertaBoxes(p: PuertaCfg, wallA: number): Box[] {
  const m = puertaMedidas(p), T = p.espesor, x0 = Math.max(0, (wallA - p.ancho) / 2), out: Box[] = [];
  const put = (id: string, name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    out.push({ id: `puerta-${id}`, name, kind: 'panel', wall: 'A', x: x0 + x, y, z, sx, sy, sz, facing: null } as Box);
  const y0 = -T;
  const xi = m.D, xd = p.ancho - m.D - E;                         // marcos laterales
  put('marco-izq', 'Marco puerta', xi, y0, 0, E, T, p.alto);
  put('marco-der', 'Marco puerta', xd, y0, 0, E, T, p.alto);
  if (p.dilatados) {
    put('dil-1', 'Dilatada puerta', 0, y0, 0, E, E, p.alto); put('dil-2', 'Dilatada puerta', 0, -E, 0, E, E, p.alto);
    put('dil-3', 'Dilatada puerta', p.ancho - E, y0, 0, E, E, p.alto); put('dil-4', 'Dilatada puerta', p.ancho - E, -E, 0, E, E, p.alto);
  }
  // batientes: atrás, contra ellas cierra la hoja (que va al ras del frente)
  put('bat-izq', 'Batiente puerta', xi + E, y0, 0, E, m.batAncho, m.batAlto);
  put('bat-der', 'Batiente puerta', xd - E, y0, 0, E, m.batAncho, m.batAlto);
  if (m.cab) {
    put('cab', 'Marco cabezal puerta', xi + E, y0, p.alto - E, m.cabLargo, T, E);
    put('bat-cab', 'Batiente puerta', xi + E, y0, p.alto - 2 * E, m.cabLargo, m.batAncho, E);
  }
  put('hoja', p.tipo === 'maciza' ? 'Hoja maciza' : 'Hoja entamborada', xi + E + LUZ, -p.hojaEsp, PISO, m.hojaAncho, p.hojaEsp, m.hojaAlto);
  // chapa a 900 del piso, del lado contrario a las bisagras (por defecto bisagras a la izquierda): roseta y manija por las dos caras
  const hx0 = xi + E + LUZ, cx = (p.bisagra ?? 'izq') === 'izq' ? hx0 + m.hojaAncho - 65 : hx0 + 65, sgn = (p.bisagra ?? 'izq') === 'izq' ? -1 : 1, zc = CHAPA_ALTO;
  ([['f', 0, 1], ['b', -p.hojaEsp, -1]] as const).forEach(([k, yf, dir]) => {
    const yR = dir > 0 ? yf : yf - 8, yM = dir > 0 ? yf + 8 : yf - 8 - 16;
    put(`chapa-ros-${k}`, 'Chapa puerta', cx - 25, yR, zc - 25, 50, 8, 50);
    put(`chapa-man-${k}`, 'Chapa puerta', sgn > 0 ? cx : cx - 120, yM, zc - 9, 120, 16, 18);
  });
  if (conTapaluz(p)) {
    const TAPALUZ = m.tlA;
    // tapaluz por las dos caras del muro: su borde interior al ras de la cara interior del marco
    const xa = xi + E - TAPALUZ, xb = xd, zTop = p.alto - E;
    ([['f', 0], ['b', y0 - m.tl]] as const).forEach(([k, yy]) => {
      // uniones a 45°: los laterales se cortan en diagonal arriba y el superior en las dos puntas
      const H = zTop + TAPALUZ, W = m.tlSup, L = TAPALUZ;
      put(`tl-izq-${k}`, 'Tapaluz puerta', xa, yy, 0, L, m.tl, H); out[out.length - 1].face = [[0, 0], [L, 0], [L, H - L], [0, H]];
      put(`tl-der-${k}`, 'Tapaluz puerta', xb, yy, 0, L, m.tl, H); out[out.length - 1].face = [[0, 0], [L, 0], [L, H], [0, H - L]];
      put(`tl-sup-${k}`, 'Tapaluz puerta', xa, yy, zTop, W, m.tl, L); out[out.length - 1].face = [[L, 0], [W - L, 0], [W, L], [0, L]];
    });
  }
  return out;
}

/** Muro A con el hueco del vano: tramo izquierdo, tramo derecho y dintel (se dibuja traslúcido para ver la puerta y el tapaluz de atrás) */
export function muroConVano(p: PuertaCfg, wallA: number, T: number, H: number): Box[] {
  const x0 = Math.max(0, (wallA - p.ancho) / 2), x1 = Math.min(wallA, x0 + p.ancho), out: Box[] = [];
  const w = (id: string, x: number, z: number, sx: number, sz: number) => { if (sx > 0 && sz > 0) out.push({ id, name: 'Muro vano', kind: 'wall', wall: 'A', x, y: -T, z, sx, sy: T, sz, facing: null } as Box); };
  w('wall-A', 0, 0, x0, H);
  w('wall-A-der', x1, 0, wallA - x1, H);
  w('wall-A-dintel', x0, p.alto, x1 - x0, H - p.alto);
  return out;
}
