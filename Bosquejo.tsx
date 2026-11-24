import React, { useState } from 'react';
import { SECTIONS, SectionId } from './sections';
import type { LayoutType } from './types';
import { LecturaBoceto, ModuloDibujado, ProductoLeido, leerBoceto } from './bocetoIA';
import { GuiaBoceto } from './GuiaBoceto';

/**
 * Fase 5 · Bosquejo.
 *
 * El usuario adjunta la foto de su boceto a mano alzada. La IA lo lee y aquí se muestra, por cada mueble de la hoja, lo que se
 * entendió en frases cortas ("va en un muro de 2.400 mm…"). Con "Aceptar" se arma el diseño; con "Corregir" se ajustan solo las
 * medidas generales. En cocinas, la poceta va sobre el desagüe, la estufa sobre el gas y el resto lo modula la app.
 */

export type MuroPunto = 'A' | 'B' | 'C';
export interface Punto { muro: MuroPunto; dist: number }
export interface DatosBosquejo {
  producto: SectionId;
  forma: LayoutType;
  brazo: 'left' | 'right';
  A: number; B: number; C: number; alto: number;
  desague: Punto | null;
  gas: Punto | null;
  nevera: 'no' | 'inicio' | 'final';
  campana: boolean;
  modulos: number[]; // cocinas: anchos de los módulos del muro A, de izquierda a derecha (vacío = modulación automática)
  neveraEspacio?: number; // ancho del espacio de la nevera (mm), leído del boceto
  neveraAncho?: number;   // ancho y alto de la nevera: se preguntan al aceptar
  neveraAlto?: number;
  bajos?: ModuloDibujado[]; // módulos dibujados en el boceto (de izquierda a derecha): la cocina se arma con ellos, no con la modulación automática
  altos?: ModuloDibujado[];
  muroIzq: boolean; // muro pegado a la izquierda del muro A (el mueble queda entre muros)
  muroDer: boolean; // muro pegado a la derecha
}

const ORDEN: SectionId[] = ['cocinas', 'closets', 'closetfit', 'walking', 'bano', 'tv', 'puertas'];
const FORMAS: Record<string, string> = { STRAIGHT: 'Recta', L_SHAPE: 'En L', U_SHAPE: 'En U' };
const fmt = (n: number) => n.toLocaleString('es-CO');

const Num: React.FC<{ label: string; value: number; onChange: (n: number) => void }> = ({ label, value, onChange }) => {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{label}</span>
      <input
        type="text" inputMode="numeric" value={txt ?? String(value)}
        onChange={e => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => { if (txt !== null) { const n = parseInt(txt, 10); onChange(isNaN(n) ? 0 : n); setTxt(null); } }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800"
      />
    </label>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-black border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{children}</button>
);

/** Si el boceto acota los anchos de abajo (con o sin el espacio de la nevera) y coinciden en cantidad con los módulos dibujados, cada uno toma su cota */
function conAnchos(fila: ModuloDibujado[], cotas: number[], nevera: string | null): ModuloDibujado[] {
  const c = cotas.length === fila.length + 1 && nevera === 'inicio' ? cotas.slice(1) : cotas.length === fila.length + 1 && nevera === 'final' ? cotas.slice(0, -1) : cotas;
  return c.length === fila.length ? fila.map((m, i) => ({ ...m, ancho: m.ancho ?? c[i] })) : fila;
}

/** Ancho de nevera sugerido: el que cabe en el espacio con 5 cm libres por lado (y la holgura del muro si va contra uno), redondeado a 50, sin pasar de 900 */
function sugerirAnchoNevera(espacio: number | null, contraMuro: boolean | null): number {
  if (!espacio) return 700;
  return Math.max(500, Math.min(900, Math.floor((espacio - 100 - (contraMuro ? 20 : 0)) / 50) * 50));
}

/** Pasa lo que leyó la IA de un mueble a los datos del diseño (lo que no aparece en el boceto toma el valor normal del producto) */
function aDatos(q: ProductoLeido, actual: SectionId): DatosBosquejo {
  const prod = q.producto ?? actual, df = SECTIONS[prod].defaults;
  const forma = q.forma && SECTIONS[prod].layouts.includes(q.forma) ? q.forma : df.layout;
  const cocina = prod === 'cocinas';
  return {
    producto: prod, forma, brazo: q.brazo ?? 'left',
    A: q.muroA ?? df.wallA, B: q.muroB ?? df.wallB, C: q.muroC ?? df.wallC, alto: q.alto ?? df.spaceHeight,
    desague: cocina ? q.desague : null, gas: cocina ? q.gas : null, nevera: q.nevera ?? 'no', campana: true, modulos: cocina && !q.filaBaja.length ? q.modulos : [],
    muroIzq: !!q.muroIzq, muroDer: !!q.muroDer,
    // con los módulos dibujados manda lo dibujado; los anchos acotados (si los hay) pasan a cada módulo dibujado
    bajos: cocina && q.filaBaja.length ? conAnchos(q.filaBaja, q.modulos, q.nevera) : undefined, altos: cocina && q.filaAlta.length ? q.filaAlta : undefined,
    neveraEspacio: cocina && q.nevera && q.nevera !== 'no' ? (q.neveraEspacio ?? (q.modulos.length ? (q.nevera === 'inicio' ? q.modulos[0] : q.modulos[q.modulos.length - 1]) : undefined)) : undefined,
    // medidas de la nevera precargadas (se pueden cambiar): la que cabe en el espacio con 5 cm libres por lado, o una normal de 700 × 1.800
    neveraAncho: cocina && q.nevera && q.nevera !== 'no' ? sugerirAnchoNevera(q.neveraEspacio, q.nevera === 'inicio' ? q.muroIzq : q.muroDer) : undefined,
    neveraAlto: cocina && q.nevera && q.nevera !== 'no' ? 1800 : undefined,
  };
}

/** Dilatada contra el muro (regla del carpintero: hasta 2 cm de holgura, dilatada de 7 cm de canto al ras de los frentes) */
export const HOLGURA_MURO = 20;

/** Tramo del muro A que ocupan los módulos dibujados: sin el espacio de la nevera y sin la holgura de las dilatadas contra los muros */
export function tramoModulos(d: DatosBosquejo): [number, number] {
  const esp = d.neveraEspacio ?? 0;
  const ini = d.nevera === 'inicio' && esp ? esp : d.muroIzq ? HOLGURA_MURO : 0;
  const fin = d.A - (d.nevera === 'final' && esp ? esp : d.muroDer ? HOLGURA_MURO : 0);
  return [ini, fin];
}

/** Reparte el tramo entre los módulos dibujados: los acotados conservan su medida y el resto se reparte según los cuadritos que miden */
export function anchosFila(fila: ModuloDibujado[], total: number): number[] {
  const fijo = fila.reduce((a, m) => a + (m.ancho ?? 0), 0), libres = fila.filter(m => !m.ancho);
  const cuadros = libres.reduce((a, m) => a + m.cuadros, 0) || 1, resto = Math.max(0, total - fijo);
  const out = fila.map(m => m.ancho ?? Math.floor((resto * m.cuadros) / cuadros / 5) * 5);
  const dif = total - out.reduce((a, w) => a + w, 0);
  const k = fila.map((m, i) => (m.ancho ? -1 : i)).filter(i => i >= 0).pop() ?? out.length - 1; // la diferencia de redondeo la absorbe el último no acotado
  if (k >= 0) out[k] += dif;
  return out;
}

const FRENTE: Record<string, string> = { puertas: 'puertas', cajones: 'cajones', abierto: 'abierto', poceta: 'poceta', estufa: 'estufa', campana: 'campana', platero: 'platero' };

const conB = (d: DatosBosquejo) => d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'left');
const conC = (d: DatosBosquejo) => d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'right');

type EstadoDato = 'ok' | 'falta' | 'revisar' | 'opcional';
interface DatoLeido { titulo: string; estado: EstadoDato; valor: string }

/** Lista de chequeo de lo que trae el boceto: qué se leyó, qué falta y qué hay que revisar */
function checklist(d: DatosBosquejo, q?: ProductoLeido): DatoLeido[] {
  const out: DatoLeido[] = [];
  const cocina = d.producto === 'cocinas', puerta = d.producto === 'puertas';
  const dato = (titulo: string, estado: EstadoDato, valor: string) => out.push({ titulo, estado, valor });
  const punto = (p: { muro: string; dist: number } | null | undefined) => (p ? `muro ${p.muro} a ${fmt(p.dist)} mm` : '');
  dato(puerta ? 'Largo del muro' : 'Medida total del muro', q?.muroA ? 'ok' : 'falta', q?.muroA ? `${fmt(d.A)} mm` : `no se vio · se usa ${fmt(d.A)} mm`);
  dato('Altura del piso al techo', q?.alto ? 'ok' : 'falta', q?.alto ? `${fmt(d.alto)} mm` : `no se vio · se usa ${fmt(d.alto)} mm`);
  if (!puerta) dato('Forma', q?.forma ? 'ok' : 'revisar', `${FORMAS[d.forma]}${q?.forma ? '' : ' (supuesto)'}`);
  if (!puerta && d.forma !== 'STRAIGHT') {
    const completa = (!conB(d) || !!q?.muroB) && (!conC(d) || !!q?.muroC);
    dato('Vista superior (muros B y C)', completa ? 'ok' : 'falta', completa ? `A ${fmt(d.A)}${conB(d) ? ` · B ${fmt(d.B)}` : ''}${conC(d) ? ` · C ${fmt(d.C)}` : ''} mm` : 'dibuja la planta con el muro B o C acotado');
  } else if (!puerta) {
    dato('Muros a los lados', 'ok', d.muroIzq && d.muroDer ? 'entre dos muros (dilatada de 7 cm en los dos)' : d.muroIzq ? 'a la izquierda (dilatada de 7 cm)' : d.muroDer ? 'a la derecha (dilatada de 7 cm)' : 'no hay');
  }
  if (cocina) {
    const fila = (m: ModuloDibujado[]) => m.map(x => x.frente).join(', ');
    dato('Módulos de abajo', d.bajos?.length ? 'ok' : 'falta', d.bajos?.length ? `${d.bajos.length}: ${fila(d.bajos)}` : 'no se vieron los frentes dibujados');
    dato('Módulos de arriba', d.altos?.length ? 'ok' : 'falta', d.altos?.length ? `${d.altos.length}: ${fila(d.altos)}` : 'no se vieron los frentes dibujados');
    const suma = (q?.modulos ?? []).reduce((a, w) => a + w, 0);
    dato('Ancho de cada módulo', !q?.modulos.length ? 'falta' : suma !== d.A ? 'revisar' : 'ok', !q?.modulos.length ? 'sin cotas por módulo: la app los reparte' : `${q.modulos.map(fmt).join(' + ')}${suma !== d.A ? ` = ${fmt(suma)} y el muro mide ${fmt(d.A)}` : ''}`);
    dato('Espacio de la nevera', d.nevera === 'no' ? 'opcional' : d.neveraEspacio ? 'ok' : 'revisar', d.nevera === 'no' ? 'sin nevera' : `a la ${d.nevera === 'inicio' ? 'izquierda' : 'derecha'}${d.neveraEspacio ? ` · espacio de ${fmt(d.neveraEspacio)} mm` : ' · falta acotar el espacio'}`);
    dato('Agua', q?.agua ? 'ok' : 'falta', q?.agua ? punto(q.agua) : 'no se ve el punto de agua');
    dato('Desagüe (poceta)', d.desague ? 'ok' : 'falta', d.desague ? punto(d.desague) : 'no se ve el desagüe');
    dato('Electricidad', q?.electricidad.length ? 'ok' : 'falta', q?.electricidad.length ? q.electricidad.map(punto).join(' · ') : 'no se ven tomas ni puntos eléctricos');
    dato('Gas (estufa)', d.gas ? 'ok' : 'falta', d.gas ? punto(d.gas) : 'no se ve el punto de gas');
  }
  if (!puerta) dato('Fondo', q?.fondo ? 'ok' : 'opcional', q?.fondo ? `${fmt(q.fondo)} mm` : 'el normal del producto');
  return out;
}

const ICONO: Record<EstadoDato, { ico: string; caja: string }> = {
  ok: { ico: '✓', caja: 'bg-emerald-100 text-emerald-700' },
  falta: { ico: '✕', caja: 'bg-rose-100 text-rose-700' },
  revisar: { ico: '!', caja: 'bg-amber-100 text-amber-700' },
  opcional: { ico: '–', caja: 'bg-slate-100 text-slate-400' },
};

const ListaChequeo: React.FC<{ items: DatoLeido[] }> = ({ items }) => {
  const cuenta = items.filter(i => i.estado !== 'opcional');
  const leidos = cuenta.filter(i => i.estado === 'ok').length;
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black text-slate-400 uppercase">Lo que trae el boceto · {leidos} de {cuenta.length} datos leídos</div>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[11px] font-black mt-0.5 ${ICONO[it.estado].caja}`}>{ICONO[it.estado].ico}</span>
            <span className="min-w-0">
              <span className="block text-xs font-black text-slate-800">{it.titulo}</span>
              <span className={`block text-[11px] font-bold ${it.estado === 'falta' ? 'text-rose-600' : it.estado === 'revisar' ? 'text-amber-700' : 'text-slate-500'}`}>{it.valor}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Avisos antes de aceptar: si bloquean, no deja crear el diseño */
function avisosDe(d: DatosBosquejo): { texto: string; bloquea: boolean }[] {
  const out: { texto: string; bloquea: boolean }[] = [];
  if (d.producto !== 'cocinas') return out;
  const suma = d.modulos.reduce((a, w) => a + w, 0);
  if (d.modulos.length && suma !== d.A) out.push({ texto: `Los módulos suman ${fmt(suma)} mm y el muro mide ${fmt(d.A)} mm. Corrige uno de los dos.`, bloquea: false });
  if (d.nevera !== 'no') {
    if (!d.neveraAncho || !d.neveraAlto) out.push({ texto: 'Escribe el ancho y el alto de la nevera para dejarle bien su espacio.', bloquea: true });
    else {
      // contra un muro, la sobrenevera deja la holgura de la dilatada: el espacio útil es menor
      const g = d.nevera === 'inicio' ? (d.muroIzq ? HOLGURA_MURO : 0) : (d.muroDer ? HOLGURA_MURO : 0);
      if (d.neveraEspacio && d.neveraAncho + 100 > d.neveraEspacio - g) out.push({ texto: `La nevera de ${fmt(d.neveraAncho)} mm necesita 5 cm libres a cada lado${g ? ` y la dilatada contra el muro (${g} mm)` : ''}: no cabe en el espacio de ${fmt(d.neveraEspacio)} mm. El espacio se agranda a ${fmt(d.neveraAncho + 100 + g)} mm.`, bloquea: false });
      if (d.alto - d.neveraAlto - 60 < 250) out.push({ texto: `Sobre una nevera de ${fmt(d.neveraAlto)} mm quedan ${fmt(Math.max(0, d.alto - d.neveraAlto - 60))} mm para la sobrenevera: es muy poco.`, bloquea: false });
    }
  }
  if (d.desague && d.gas && d.desague.muro === d.gas.muro && Math.abs(d.desague.dist - d.gas.dist) < 600) out.push({ texto: 'El desagüe y el gas están a menos de 600 mm: la poceta y la estufa no caben juntas.', bloquea: true });
  return out;
}

/** Corregir: solo las medidas generales del mueble */
const Corregir: React.FC<{ d: DatosBosquejo; set: (f: (d: DatosBosquejo) => DatosBosquejo) => void; onListo: () => void }> = ({ d, set, onListo }) => {
  const cfg = SECTIONS[d.producto], puerta = d.producto === 'puertas';
  return (
    <div className="border-t border-slate-200 pt-3 space-y-3">
      <div className="flex flex-wrap gap-2">{ORDEN.map(p => <Chip key={p} on={d.producto === p} onClick={() => set(x => ({ ...x, producto: p, modulos: p === 'cocinas' ? x.modulos : [] }))}>{SECTIONS[p].name}</Chip>)}</div>
      {!puerta && cfg.layouts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {cfg.layouts.map(f => <Chip key={f} on={d.forma === f} onClick={() => set(x => ({ ...x, forma: f }))}>{FORMAS[f]}</Chip>)}
          {d.forma === 'L_SHAPE' && <>
            <Chip on={d.brazo === 'left'} onClick={() => set(x => ({ ...x, brazo: 'left' }))}>Brazo a la izquierda</Chip>
            <Chip on={d.brazo === 'right'} onClick={() => set(x => ({ ...x, brazo: 'right' }))}>Brazo a la derecha</Chip></>}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Num label={puerta ? 'Largo del muro (mm)' : 'Muro principal (mm)'} value={d.A} onChange={n => set(x => ({ ...x, A: n }))} />
        {conB(d) && !puerta && <Num label="Muro izquierdo (mm)" value={d.B} onChange={n => set(x => ({ ...x, B: n }))} />}
        {conC(d) && !puerta && <Num label="Muro derecho (mm)" value={d.C} onChange={n => set(x => ({ ...x, C: n }))} />}
        <Num label="Alto (mm)" value={d.alto} onChange={n => set(x => ({ ...x, alto: n }))} />
      </div>
      {!puerta && d.forma === 'STRAIGHT' && (
        <div className="flex flex-wrap gap-2">
          <Chip on={d.muroIzq} onClick={() => set(x => ({ ...x, muroIzq: !x.muroIzq }))}>Muro a la izquierda</Chip>
          <Chip on={d.muroDer} onClick={() => set(x => ({ ...x, muroDer: !x.muroDer }))}>Muro a la derecha</Chip>
        </div>
      )}
      {d.producto === 'cocinas' && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Num label="Desagüe a (mm)" value={d.desague?.dist ?? 0} onChange={n => set(x => ({ ...x, desague: n > 0 ? { muro: x.desague?.muro ?? 'A', dist: n } : null }))} />
          <Num label="Gas a (mm)" value={d.gas?.dist ?? 0} onChange={n => set(x => ({ ...x, gas: n > 0 ? { muro: x.gas?.muro ?? 'A', dist: n } : null }))} />
          <label className={`block col-span-2 ${d.bajos?.length ? 'hidden' : ''}`}>
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Módulos de izquierda a derecha (mm)</span>
            <input key={d.modulos.join('+')} defaultValue={d.modulos.join(' + ')} placeholder="Vacío = la app los reparte"
              onBlur={e => { const v = (e.target.value.match(/\d+/g) ?? []).map(Number).filter(n => n > 0); set(x => ({ ...x, modulos: v })); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on={d.nevera === 'no'} onClick={() => set(x => ({ ...x, nevera: 'no' }))}>Sin nevera</Chip>
          <Chip on={d.nevera === 'inicio'} onClick={() => set(x => ({ ...x, nevera: 'inicio' }))}>Nevera a la izquierda</Chip>
          <Chip on={d.nevera === 'final'} onClick={() => set(x => ({ ...x, nevera: 'final' }))}>Nevera a la derecha</Chip>
        </div>
        <div className="text-[10px] font-bold text-slate-400">Las distancias van del extremo izquierdo del muro al centro del punto. Pon 0 si no lleva.</div>
        {(['bajos', 'altos'] as const).map(fila => (
          <div key={fila} className="space-y-1.5">
            <div className="text-[9px] font-black text-slate-400 uppercase">Módulos {fila === 'bajos' ? 'de abajo' : 'de arriba'}, de izquierda a derecha</div>
            {(d[fila] ?? []).map((m, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-xs font-black text-slate-500">{i + 1}</span>
                <select value={m.frente} onChange={e => set(x => ({ ...x, [fila]: (x[fila] ?? []).map((y, j) => (j === i ? { ...y, frente: e.target.value as ModuloDibujado['frente'] } : y)) }))}
                  className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-black text-slate-800">
                  {(fila === 'bajos' ? ['puertas', 'cajones', 'abierto', 'poceta', 'estufa'] : ['puertas', 'abierto', 'campana', 'platero']).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input defaultValue={m.ancho ?? ''} placeholder="ancho (vacío = se reparte)" key={`${i}-${m.ancho}`}
                  onBlur={e => { const v = parseInt(e.target.value.replace(/[^\d]/g, ''), 10); set(x => ({ ...x, [fila]: (x[fila] ?? []).map((y, j) => (j === i ? { ...y, ancho: v > 0 ? v : null } : y)) })); }}
                  className="w-44 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-black text-slate-800" />
                <button onClick={() => set(x => ({ ...x, [fila]: (x[fila] ?? []).filter((_, j) => j !== i) }))} className="text-[11px] font-black text-rose-600">Quitar</button>
              </div>
            ))}
            <button onClick={() => set(x => ({ ...x, [fila]: [...(x[fila] ?? []), { frente: 'puertas', ancho: null, cuadros: 4 }] }))} className="text-[11px] font-black text-indigo-700">+ Agregar módulo</button>
          </div>
        ))}
      </>)}
      <button onClick={onListo} className="rounded-xl px-4 py-2 text-xs font-black bg-slate-800 text-white">Listo</button>
    </div>
  );
};

export const Bosquejo: React.FC<{ actual: SectionId; onCrear: (d: DatosBosquejo, foto?: string) => void }> = ({ actual, onCrear }) => {
  const [foto, setFoto] = useState<string | null>(null);
  const [lectura, setLectura] = useState<{ estado: 'nada' | 'leyendo' | 'lista' | 'error'; r?: LecturaBoceto; error?: string }>({ estado: 'nada' });
  const [datos, setDatos] = useState<DatosBosquejo[]>([]);
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);

  const leer = async (img: string) => {
    setLectura({ estado: 'leyendo' }); setDatos([]); setCorrigiendo(null);
    try {
      const r = await leerBoceto(img);
      setLectura({ estado: 'lista', r });
      setDatos(r.productos.map(q => aDatos(q, actual)));
    } catch (e) { setLectura({ estado: 'error', error: e instanceof Error ? e.message : String(e) }); }
  };
  const cargarFoto = (f?: File) => {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      // se achica a 1600 px de lado mayor: suficiente para leer la letra y más liviano de enviar; se lee apenas se adjunta
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.88);
        setFoto(url); leer(url);
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(f);
  };
  const entrada = <input type="file" accept="image/*" data-boceto className="hidden" onChange={e => { cargarFoto(e.target.files?.[0]); e.target.value = ''; }} />;

  return (
    <div className="space-y-4 max-w-4xl">
      <GuiaBoceto abierta={!foto} />
      {/* 1 · la foto del boceto */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        {!foto ? (
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40">
            <span className="text-sm font-black text-slate-800">Adjunta la foto del boceto</span>
            <span className="text-[11px] font-bold text-slate-400 max-w-md">Una hoja con el dibujo a mano y sus medidas; puede traer varios muebles. La foto se envía al servicio de Gemini (Google) para leerla.</span>
            <span className="mt-2 rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white">Elegir foto</span>
            {entrada}
          </label>
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <img src={foto} alt="Boceto adjunto" className="w-full sm:w-64 max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50" />
            <div className="flex-1 min-w-[200px] space-y-3">
              {lectura.estado === 'leyendo' && <div className="text-sm font-black text-indigo-700">Leyendo el boceto…</div>}
              {lectura.estado === 'error' && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{lectura.error}</div>}
              {lectura.estado === 'lista' && lectura.r && <div className="text-sm font-bold text-slate-700">{lectura.r.resumen}</div>}
              <div className="flex flex-wrap gap-2">
                <label className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700 cursor-pointer">Cambiar foto{entrada}</label>
                {lectura.estado !== 'leyendo' && <button onClick={() => leer(foto)} className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700">Leer otra vez</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2 · lo que se entendió de cada mueble, para aceptar o corregir */}
      {datos.map((d, k) => {
        const q = lectura.r?.productos[k];
        const avisos = avisosDe(d), bloquea = avisos.some(a => a.bloquea);
        return (
          <div key={k} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{q?.nombre ?? 'Mueble'}</span>
              <span className="text-[11px] font-black text-indigo-600">{SECTIONS[d.producto].name}{q && !q.producto ? ' · no se identificó, revísalo' : ''}</span>
            </div>
            <ListaChequeo items={checklist(d, q)} />
            {q?.detalle && <details className="text-[11px] font-bold text-slate-400"><summary className="cursor-pointer text-indigo-700 font-black">Ver lo que se leyó dentro de los muebles</summary><div className="pt-1">{q.detalle}</div></details>}
            {q && q.dudas.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-0.5">
                <div className="text-[10px] font-black text-amber-700 uppercase">Revisa esto</div>
                {q.dudas.map((t, i) => <div key={i} className="text-[11px] font-bold text-amber-800">• {t}</div>)}
              </div>
            )}
            {d.producto === 'cocinas' && d.nevera !== 'no' && corrigiendo !== k && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                <div className="text-xs font-black text-slate-800">¿Qué medidas tiene la nevera?</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Num label="Ancho de la nevera (mm)" value={d.neveraAncho ?? 0} onChange={v => setDatos(ds => ds.map((x, i) => (i === k ? { ...x, neveraAncho: v > 0 ? v : undefined } : x)))} />
                  <Num label="Alto de la nevera (mm)" value={d.neveraAlto ?? 0} onChange={v => setDatos(ds => ds.map((x, i) => (i === k ? { ...x, neveraAlto: v > 0 ? v : undefined } : x)))} />
                  <Num label="Espacio para la nevera (mm)" value={d.neveraEspacio ?? 0} onChange={v => setDatos(ds => ds.map((x, i) => (i === k ? { ...x, neveraEspacio: v > 0 ? v : undefined } : x)))} />
                </div>
                <div className="text-[10px] font-bold text-slate-400">La nevera va centrada en su espacio, con 5 cm libres a cada lado como mínimo. Encima va la sobrenevera.</div>
              </div>
            )}
            {avisos.map((a, i) => <div key={i} className={`text-[11px] font-bold rounded-xl px-3 py-2 border ${a.bloquea ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>{a.texto}</div>)}
            {corrigiendo === k
              ? <Corregir d={d} set={f => setDatos(ds => ds.map((x, i) => (i === k ? f(x) : x)))} onListo={() => setCorrigiendo(null)} />
              : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button disabled={bloquea} onClick={() => onCrear(d, foto ?? undefined)} className="rounded-xl px-5 py-2.5 text-sm font-black bg-indigo-600 text-white disabled:opacity-40">Aceptar</button>
                  <button onClick={() => setCorrigiendo(k)} className="rounded-xl px-5 py-2.5 text-sm font-black border border-slate-200 text-slate-700">Corregir</button>
                  <span className="text-[11px] font-bold text-slate-400">Aceptar arma el diseño de {SECTIONS[d.producto].name} (reemplaza el que haya).</span>
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
};
