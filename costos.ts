import type { Box } from './boxes';
import { ContextoPiezas, ListaPiezas, Pieza, bordesDeCanto, listaDePiezas, moduloDe } from './piezas';
import { OPCIONES_LAMINA, OpcionesLamina, materialDe, optimizarListado } from './optimizador';
import { esBlanco } from './colores';

/**
 * Costeo de un diseño con la tabla de costos del usuario (Fase 1 de cotización).
 *
 * Mismo modelo del Excel del carpintero ("formato despiece cotizacion"), sin lo empírico:
 * - Lámina: las láminas que de verdad salen del optimizador × su precio, repartidas entre las piezas según su área
 *   (el desperdicio queda incluido; no hace falta multiplicar ×2 para comprar).
 * - Canto: metros reales de cada borde × precio por metro (blanco o color, flexible o rígido).
 * - Herrajes: bisagras por alto de puerta, correderas por cajón, manijas, pistones, soportes de entrepaño, tubos y perfiles.
 * - Mesón por metro lineal; fabricación e instalación por módulo; corte por lámina.
 * - Precio = costo ÷ (1 − ganancia): la ganancia es el % del precio de venta (la real), no un recargo sobre el costo.
 *   Ejemplo: costo 100 y ganancia 20 % → precio 125 (se ganan 25, el 20 % de 125). Con 120 se ganaría solo el 16,7 %.
 * Ningún precio está fijo en el código: todo sale de la tabla, que el usuario edita.
 */

export interface PrecioLamina { id: string; nombre: string; cal: number; largo: number; ancho: number; precio: number }
export interface PrecioCanto { id: string; tipo: 'Blanco' | 'Color'; rigido: boolean; precioMetro: number }
export type ClaveHerraje = 'bisagra' | 'corredera' | 'manija' | 'piston' | 'soporte' | 'tubo' | 'gola';
export interface TablaCostos {
  laminas: PrecioLamina[];
  cantos: PrecioCanto[];
  herrajes: Record<ClaveHerraje, number>;
  mesonMl: number;                                   // mesón por metro lineal (con su salpicadero)
  corteLamina: number;                               // corte por lámina, si el proveedor lo cobra aparte
  fabricacion: { MA: number; MB: number; alto: number; otro: number }; // mano de obra de taller por módulo
  instalacion: { MA: number; MB: number; alto: number; otro: number }; // instalación por módulo
  ganancia: number;                                  // 0,2 = se gana el 20 % del precio de venta (margen real)
  margen?: number;                                   // antes: recargo sobre el costo (0,4 = +40 %); solo para pasar tablas viejas
  redondeo: number;                                  // el precio se redondea hacia arriba a este múltiplo
}

export const NOMBRES_HERRAJE: Record<ClaveHerraje, { nombre: string; unidad: string }> = {
  bisagra: { nombre: 'Bisagra', unidad: 'unidad' },
  corredera: { nombre: 'Corredera full extensión (par)', unidad: 'par' },
  manija: { nombre: 'Manija', unidad: 'unidad' },
  piston: { nombre: 'Pistón de puerta abatible', unidad: 'unidad' },
  soporte: { nombre: 'Soporte de entrepaño', unidad: 'unidad' },
  tubo: { nombre: 'Tubo de closet', unidad: 'metro' },
  gola: { nombre: 'Perfil gola de aluminio', unidad: 'metro' },
};

/** Los precios del Excel del carpintero; lo que el Excel no traía queda en 0 y la app avisa que falta */
export const COSTOS_INICIALES: TablaCostos = {
  laminas: [
    { id: 'l1', nombre: 'Blanco', cal: 15, largo: 2440, ancho: 1830, precio: 180000 },
    { id: 'l2', nombre: 'Blanco', cal: 18, largo: 2440, ancho: 1830, precio: 0 },
    { id: 'l3', nombre: 'Otros colores', cal: 15, largo: 2440, ancho: 1830, precio: 0 },
    { id: 'l4', nombre: 'Otros colores', cal: 18, largo: 2440, ancho: 1830, precio: 200000 },
    { id: 'l5', nombre: 'Blanco', cal: 4, largo: 2440, ancho: 1530, precio: 80000 },
    { id: 'l6', nombre: 'Blanco', cal: 5.5, largo: 2440, ancho: 1830, precio: 0 },
  ],
  cantos: [
    { id: 'c1', tipo: 'Blanco', rigido: false, precioMetro: 500 },
    { id: 'c2', tipo: 'Color', rigido: false, precioMetro: 700 },
    { id: 'c3', tipo: 'Blanco', rigido: true, precioMetro: 0 },
    { id: 'c4', tipo: 'Color', rigido: true, precioMetro: 0 },
  ],
  herrajes: { bisagra: 3500, corredera: 30000, manija: 2500, piston: 4000, soporte: 100, tubo: 0, gola: 0 },
  mesonMl: 370000,
  corteLamina: 0,
  fabricacion: { MA: 0, MB: 0, alto: 0, otro: 0 },
  instalacion: { MA: 40000, MB: 20000, alto: 0, otro: 0 },
  ganancia: 0.286, // equivale al +40 % sobre el costo del Excel
  redondeo: 1000,
};

/** Completa una tabla guardada antes (o a medias) con los valores iniciales */
export function completarCostos(v: unknown): TablaCostos {
  const a = (v && typeof v === 'object' ? v : {}) as Partial<TablaCostos>;
  const b = COSTOS_INICIALES;
  // tabla vieja con recargo sobre el costo: se pasa a la ganancia equivalente sobre el precio (los precios no cambian)
  const ganancia = typeof a.ganancia === 'number' ? a.ganancia : typeof a.margen === 'number' ? Math.round((a.margen / (1 + a.margen)) * 1000) / 1000 : b.ganancia;
  return {
    ...b, ...a, ganancia, margen: undefined,
    laminas: Array.isArray(a.laminas) && a.laminas.length ? a.laminas : b.laminas,
    cantos: Array.isArray(a.cantos) && a.cantos.length ? a.cantos : b.cantos,
    herrajes: { ...b.herrajes, ...(a.herrajes ?? {}) },
    fabricacion: { ...b.fabricacion, ...(a.fabricacion ?? {}) },
    instalacion: { ...b.instalacion, ...(a.instalacion ?? {}) },
  };
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Color y calibre reales del material de una pieza ("Blanco 5,5" es fondo de 5,5 aunque su CAL diga 6) */
export function materialReal(p: Pick<Pieza, 'color' | 'thickness'>): { color: string; cal: number; rh: boolean } {
  const m = /^(.*?)\s+(\d+(?:,\d+)?)$/.exec(p.color.trim());
  const base = m ? m[1] : p.color.trim();
  const cal = m ? parseFloat(m[2].replace(',', '.')) : p.thickness;
  return { color: base.replace(/\s+RH$/i, '').trim(), cal, rh: /\sRH$/i.test(base) };
}

/** Precio de lámina que corresponde: primero el color exacto; si no, "Blanco" u "Otros colores" del mismo calibre */
export function laminaPara(t: TablaCostos, p: Pick<Pieza, 'color' | 'thickness'>): PrecioLamina | undefined {
  const { color, cal, rh } = materialReal(p);
  const mismoCal = t.laminas.filter(l => Math.abs(l.cal - cal) < 0.3);
  const exacta = mismoCal.find(l => norm(l.nombre) === norm(`${color}${rh ? ' RH' : ''}`)) ?? mismoCal.find(l => norm(l.nombre) === norm(color));
  if (exacta) return exacta;
  return mismoCal.find(l => norm(l.nombre) === (esBlanco(color) ? 'blanco' : 'otros colores'));
}

/** Metros de canto de una pieza (una unidad) por tipo: "Blanco Fl", "Color RG"… */
export function cantoDePieza(p: Pick<Pieza, 'edgeType' | 'color' | 'length' | 'width'>): { tipo: 'Blanco' | 'Color'; rigido: boolean; metros: number }[] {
  if (!p.edgeType) return [];
  const b = bordesDeCanto(p.edgeType, p.color);
  const out: { tipo: 'Blanco' | 'Color'; rigido: boolean; metros: number }[] = [];
  ([[b.l1, p.length], [b.l2, p.length], [b.a1, p.width], [b.a2, p.width]] as [string, number][]).forEach(([e, mm]) => {
    if (!e) return;
    const rigido = / RG$/.test(e), color = e.replace(/ (RG|Fl)$/, '');
    const tipo = esBlanco(color) ? 'Blanco' : 'Color';
    const g = out.find(x => x.tipo === tipo && x.rigido === rigido);
    if (g) g.metros += mm / 1000; else out.push({ tipo, rigido, metros: mm / 1000 });
  });
  return out;
}

export interface CostoPieza { pieza: Pieza; material: number; canto: number; total: number }
export interface LineaHerraje { clave: ClaveHerraje; cant: number; precio: number; total: number }
export interface CostoGrupo {
  id: string; nombre: string; detalle: string; tipo: 'MA' | 'MB' | 'alto' | 'otro';
  piezas: CostoPieza[]; herrajes: LineaHerraje[];
  material: number; canto: number; herraje: number; meson: number; fabricacion: number; instalacion: number;
  costo: number; precio: number;
  ancho: number;               // ancho del módulo (mm), para el costo por metro lineal
  mesonMl: number;             // metros lineales de mesón del grupo
}
export interface UsoMaterial { material: string; lamina?: PrecioLamina; laminas: number; uso: number; costo: number }
export interface Costeo {
  grupos: CostoGrupo[];
  materiales: UsoMaterial[];
  faltan: string[];            // precios en 0 que el diseño sí usa
  frente: { ancho: number; alto: number; m2: number }; // medida del frente de todo el mueble (para el costo por m² de closets)
  totales: { material: number; canto: number; herraje: number; meson: number; corte: number; fabricacion: number; instalacion: number; costo: number; precio: number; ganancia: number };
}

export interface ModuloCosteo { uniqueId: string; label?: string; type: string; width: number; height: number; depth: number; name?: string }

/** Herrajes de un grupo de cajas (un módulo o el resto): se cuentan por las piezas reales */
function herrajesDe(cajas: Box[], lista: ListaPiezas, esAereo: boolean): Record<ClaveHerraje, number> {
  const h: Record<ClaveHerraje, number> = { bisagra: 0, corredera: 0, manija: 0, piston: 0, soporte: 0, tubo: 0, gola: 0 };
  const conGola = cajas.some(b => /^gola/i.test(b.name));
  cajas.filter(b => b.kind === 'front').forEach(b => {
    const n = norm(b.name);
    if (/^frente/.test(n)) { h.corredera += 1; if (!conGola) h.manija += 1; return; }
    if (!/^puerta/.test(n) || /falsa/.test(n)) return;
    const alto = b.sz;
    if (esAereo && /superior|inferior/.test(n)) { h.bisagra += 2; h.piston += 1; } // abatible: dos bisagras y un pistón
    else h.bisagra += alto <= 900 ? 2 : alto <= 1600 ? 3 : 4;
    // los aéreos abren con la pestaña de la puerta y los bajos con la gola: manija solo donde no hay ninguna de las dos
    if (!esAereo && !conGola) h.manija += 1;
  });
  cajas.filter(b => /^entrepa/i.test(norm(b.name))).forEach(() => { h.soporte += 4; });
  lista.herrajes.forEach(x => {
    const m = parseFloat(x.medida ?? '0') / 1000 * x.cant;
    if (/^tubo/i.test(x.nombre)) h.tubo += m;
    else if (/gola/i.test(x.nombre)) h.gola += m;
  });
  return h;
}

/** Precio para ganar ese % del precio de venta: costo ÷ (1 − ganancia) */
export const precioDe = (costo: number, ganancia: number) => costo / (1 - Math.min(Math.max(ganancia, 0), 0.95));
/** Lo mismo dicho como recargo sobre el costo: ganar el 20 % del precio = +25 % sobre el costo */
export const recargoDe = (ganancia: number) => { const g = Math.min(Math.max(ganancia, 0), 0.95); return g / (1 - g); };

const redondear = (n: number, a: number) => (a > 0 ? Math.ceil(n / a) * a : Math.round(n));

/** Costeo completo del diseño: láminas reales, piezas, módulos y totales */
export function costear(boxes: Box[], ctx: ContextoPiezas, listaTotal: ListaPiezas, modulos: ModuloCosteo[], t: TablaCostos, nombreResto: string): Costeo {
  const faltan = new Set<string>();
  // 1. Láminas reales por material (el mismo optimizador de la pestaña Láminas, con el tamaño de lámina de la tabla)
  const opciones = (m: string): OpcionesLamina => {
    const p = listaTotal.piezas.find(x => materialDe(x) === m);
    const l = p ? laminaPara(t, p) : undefined;
    return { ...OPCIONES_LAMINA, ...(l ? { largo: l.largo, ancho: l.ancho } : {}) };
  };
  const optim = optimizarListado(listaTotal.piezas, opciones);
  // costo de lámina por mm² de pieza en cada material: así el desperdicio se reparte entre las piezas que lo causan
  const porMm2 = new Map<string, number>();
  const materiales: UsoMaterial[] = optim.map(r => {
    const p = listaTotal.piezas.find(x => materialDe(x) === r.material)!;
    const l = laminaPara(t, p);
    if (!l || !l.precio) faltan.add(`Lámina ${materialReal(p).color} de ${String(materialReal(p).cal).replace('.', ',')} mm`);
    const n = r.laminas.length + r.noCaben.reduce((a, x) => a + x.cant, 0); // lo que no cabe en una lámina cuenta como otra
    const costo = n * (l?.precio ?? 0);
    porMm2.set(r.material, r.areaPiezas > 0 ? costo / r.areaPiezas : 0);
    return { material: r.material, lamina: l, laminas: n, uso: r.uso, costo };
  });
  const totalLaminas = materiales.reduce((a, m) => a + m.laminas, 0);

  const precioCanto = (tipo: 'Blanco' | 'Color', rigido: boolean) => {
    const c = t.cantos.find(x => x.tipo === tipo && x.rigido === rigido);
    if (!c || !c.precioMetro) faltan.add(`Canto ${tipo.toLowerCase()} ${rigido ? 'rígido' : 'flexible'}`);
    return c?.precioMetro ?? 0;
  };
  const costoPieza = (p: Pieza): CostoPieza => {
    if (p.papel === 'meson') return { pieza: p, material: 0, canto: 0, total: 0 };
    const material = p.length * p.width * p.quantity * (porMm2.get(materialDe(p)) ?? 0);
    const canto = cantoDePieza(p).reduce((a, c) => a + c.metros * precioCanto(c.tipo, c.rigido), 0) * p.quantity;
    return { pieza: p, material, canto, total: material + canto };
  };

  // 2. Grupos: cada módulo con sus cajas; lo demás (zócalo, rellenos, mesón, cuerpos de closet) va junto
  const porGrupo = new Map<string, Box[]>();
  boxes.forEach(b => {
    if (b.kind === 'wall' || b.kind === 'appliance') return;
    if (ctx.puerta && b.id.startsWith('puerta-')) return; // la puerta se despieza con su regla propia (va en el resto)
    const m = moduloDe(b);
    const k = modulos.some(x => x.uniqueId === m) ? m : '__resto';
    porGrupo.set(k, [...(porGrupo.get(k) ?? []), b]);
  });
  if (ctx.puerta && !porGrupo.has('__resto')) porGrupo.set('__resto', []);
  const orden = [...modulos.map(m => m.uniqueId).filter(id => porGrupo.has(id)), ...(porGrupo.has('__resto') ? ['__resto'] : [])];
  const grupos: CostoGrupo[] = orden.map(id => {
    const cajas = porGrupo.get(id)!;
    const mod = modulos.find(m => m.uniqueId === id);
    const tipo: CostoGrupo['tipo'] = !mod ? 'otro' : mod.type === 'UPPER' ? 'MA' : mod.type === 'LOWER' ? 'MB' : mod.type === 'TALL' ? 'alto' : 'otro';
    const lista = listaDePiezas(cajas, { ...ctx, puerta: id === '__resto' ? ctx.puerta : undefined });
    const piezas = lista.piezas.map(costoPieza);
    const cant = herrajesDe(cajas, lista, tipo === 'MA');
    const herrajes: LineaHerraje[] = (Object.keys(cant) as ClaveHerraje[]).filter(k => cant[k] > 0).map(k => {
      if (!t.herrajes[k]) faltan.add(NOMBRES_HERRAJE[k].nombre);
      return { clave: k, cant: cant[k], precio: t.herrajes[k], total: cant[k] * t.herrajes[k] };
    });
    // mesón por metro lineal: la losa y las cascadas (el salpicadero va incluido en el precio del metro)
    const ml = cajas.filter(b => b.kind === 'counter' && (/^counter-/.test(b.id) || /^cascada-/.test(b.id))).reduce((a, b) => a + (/^cascada-/.test(b.id) ? b.sz : Math.max(b.sx, b.sy)) / 1000, 0);
    if (ml > 0 && !t.mesonMl) faltan.add('Mesón por metro lineal');
    const material = piezas.reduce((a, c) => a + c.material, 0), canto = piezas.reduce((a, c) => a + c.canto, 0);
    const herraje = herrajes.reduce((a, c) => a + c.total, 0), meson = ml * t.mesonMl;
    const fabricacion = mod ? t.fabricacion[tipo] : 0, instalacion = mod ? t.instalacion[tipo] : 0;
    const costo = material + canto + herraje + meson + fabricacion + instalacion;
    const nombre = mod ? `${tipo === 'MA' ? 'Aéreo' : tipo === 'MB' ? 'Bajo' : tipo === 'alto' ? 'Alto' : 'Módulo'} ${mod.label ?? ''}`.trim() : nombreResto;
    const detalle = mod ? `${Math.round(mod.width)} × ${Math.round(mod.height)} × ${Math.round(mod.depth)} mm` : (ml > 0 ? `incluye ${ml.toFixed(2).replace('.', ',')} m de mesón` : '');
    return { id, nombre, detalle, tipo, piezas, herrajes, material, canto, herraje, meson, fabricacion, instalacion, costo, precio: 0, ancho: mod?.width ?? 0, mesonMl: ml };
  });

  // 3. Corte por lámina: se reparte entre los grupos según su material
  const corte = totalLaminas * t.corteLamina;
  const materialTotal = grupos.reduce((a, g) => a + g.material, 0);
  grupos.forEach(g => { if (materialTotal > 0) g.costo += corte * (g.material / materialTotal); g.precio = precioDe(g.costo, t.ganancia); });
  const costo = grupos.reduce((a, g) => a + g.costo, 0);
  const precio = redondear(precioDe(costo, t.ganancia), t.redondeo);
  const suma = (k: keyof CostoGrupo) => grupos.reduce((a, g) => a + (g[k] as number), 0);
  // frente del mueble: lo que ocupa de lado a lado y de abajo arriba (sin muros, electrodomésticos ni mesón)
  const piezasFrente = boxes.filter(b => b.kind !== 'wall' && b.kind !== 'appliance' && b.kind !== 'counter');
  const ext = (f: (b: Box) => [number, number]) => piezasFrente.length ? Math.max(...piezasFrente.map(b => f(b)[1])) - Math.min(...piezasFrente.map(b => f(b)[0])) : 0;
  const anchoF = Math.max(ext(b => [b.x, b.x + b.sx]), 0), altoF = ext(b => [b.z, b.z + b.sz]);
  return {
    grupos, materiales, faltan: [...faltan], frente: { ancho: anchoF, alto: altoF, m2: (anchoF * altoF) / 1e6 },
    totales: { material: suma('material'), canto: suma('canto'), herraje: suma('herraje'), meson: suma('meson'), corte, fabricacion: suma('fabricacion'), instalacion: suma('instalacion'), costo, precio, ganancia: precio - costo },
  };
}

export const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
