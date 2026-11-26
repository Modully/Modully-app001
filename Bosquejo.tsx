import React, { useState } from 'react';
import { SECTIONS, SectionId } from './sections';
import type { LayoutType } from './types';
import { LecturaBoceto, ModuloDibujado, Pistas, PISTAS_AUTO, ProductoLeido, leerBoceto } from './bocetoIA';
import { GuiaBoceto } from './GuiaBoceto';
import { CATALOGO, colorDeCatalogo } from './colores';

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
  agua?: Punto | null;          // punto de agua
  electricidad?: Punto[];       // tomas o puntos eléctricos
  nevera: 'no' | 'inicio' | 'final';
  campana: boolean;
  modulos: number[]; // cocinas: anchos de los módulos del muro A, de izquierda a derecha (vacío = modulación automática)
  neveraEspacio?: number; // ancho del espacio de la nevera (mm), leído del boceto
  neveraAncho?: number;   // ancho y alto de la nevera: se preguntan al aceptar
  neveraAlto?: number;
  bajos?: ModuloDibujado[]; // módulos dibujados en el boceto (de izquierda a derecha): la cocina se arma con ellos, no con la modulación automática
  altos?: ModuloDibujado[];
  colorEstructura?: string; colorFachada?: string; colorFachadaAereos?: string; // colores nombrados en el boceto o en las notas (se aplican al aceptar)
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
    desague: cocina || prod === 'bano' ? q.desague : null, gas: cocina ? q.gas : null, agua: cocina || prod === 'bano' ? q.agua : null, electricidad: cocina || prod === 'tv' ? q.electricidad : [], nevera: q.nevera ?? 'no', campana: true, modulos: cocina && !q.filaBaja.length ? q.modulos : [],
    muroIzq: !!q.muroIzq, muroDer: !!q.muroDer,
    colorEstructura: q.colores?.estructura, colorFachada: q.colores?.fachada, colorFachadaAereos: q.colores?.fachadaAereos,
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

/** Ancho de módulo que más se repite en lo dibujado (a 100 mm): lo usan los brazos B y C, que el boceto no divide, para quedar como el muro A */
export function anchoComun(anchos: number[]): number {
  const v = anchos.filter(w => w > 0);
  if (!v.length) return 900;
  const cuenta = new Map<number, number>();
  v.forEach(w => { const k = Math.round(w / 100) * 100; cuenta.set(k, (cuenta.get(k) ?? 0) + 1); });
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
export const estrategiaPorAncho = (w: number): 'efficiency' | 'standard' | 'detailed' => (w >= 800 ? 'efficiency' : w >= 500 ? 'standard' : 'detailed');

/** Anchos de los módulos de abajo y de arriba tal como los usará la app (los acotados se respetan; el resto se reparte) */
export function anchosDibujados(d: DatosBosquejo): { bajos: number[]; altos: number[] } {
  if (d.producto !== 'cocinas') return { bajos: [], altos: [] };
  const [t0, t1] = tramoModulos(d);
  if (d.bajos?.length) return { bajos: anchosFila(d.bajos, t1 - t0), altos: anchosFila(d.altos?.length ? d.altos : d.bajos, t1 - t0) };
  return { bajos: d.modulos, altos: [] };
}

/** Revisor de normas del taller: lo que la app va a corregir o completar al pasar en limpio (no bloquea; informa para que se sepa) */
export function normasDelTaller(d: DatosBosquejo): string[] {
  const out: string[] = [];
  if (d.producto !== 'cocinas') return out;
  const { bajos, altos } = anchosDibujados(d);
  const frentes = d.bajos ?? [];
  frentes.forEach((m, i) => {
    const w = bajos[i];
    if (m.frente === 'estufa' && w && w !== 600) out.push(`La estufa y su campana son de 600 mm: el módulo dibujado de ${fmt(w)} mm se completa con otro módulo al lado.`);
    if (m.frente === 'poceta' && w && w < 600) out.push(`El mueble de la poceta mide mínimo 600 mm y el dibujado es de ${fmt(w)} mm.`);
  });
  const fuera = bajos.filter(w => w > 900 || (w > 0 && w < 300)); // los aéreos se alinean con los bajos: solo cuentan los de abajo
  if (fuera.length) out.push(`Un módulo mide entre 300 y 900 mm: ${[...new Set(fuera)].map(fmt).join(', ')} mm se parte o se ajusta.`);
  if (d.altos?.length && d.bajos?.length && d.altos.length !== d.bajos.length) out.push(`Arriba dibujaste ${d.altos.length} módulos y abajo ${d.bajos.length}: los aéreos se alinean con los de abajo.`);
  if (d.forma !== 'STRAIGHT') {
    const comun = anchoComun([...bajos].length ? bajos.filter((_, i) => frentes[i]?.frente !== 'estufa' && frentes[i]?.frente !== 'poceta') : d.modulos);
    out.push(`El boceto divide solo el muro A: los brazos B y C se modulan con módulos de ${fmt(comun)} mm, como el muro A.`);
  }
  return out;
}

const FRENTE: Record<string, string> = { puertas: 'puertas', cajones: 'cajones', abierto: 'abierto', poceta: 'poceta', estufa: 'estufa', campana: 'campana', platero: 'platero' };

const conB = (d: DatosBosquejo) => d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'left');
const conC = (d: DatosBosquejo) => d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'right');

type EstadoDato = 'ok' | 'falta' | 'revisar' | 'opcional';
interface DatoLeido { clave: string; titulo: string; estado: EstadoDato; valor: string; editor?: React.ReactNode }
type SetD = (f: (d: DatosBosquejo) => DatosBosquejo) => void;

/** Editor de un punto (gas, agua, desagüe, toma): en qué muro está y a cuántos mm del 0 */
const PuntoEd: React.FC<{ p: Punto | null | undefined; onChange: (p: Punto | null) => void; muros?: MuroPunto[] }> = ({ p, onChange, muros = ['A', 'B', 'C'] }) => (
  <div className="flex flex-wrap items-end gap-2">
    <div className="flex gap-1">{muros.map(m => <Chip key={m} on={p?.muro === m} onClick={() => onChange({ muro: m, dist: p?.dist ?? 1000 })}>Muro {m}</Chip>)}</div>
    <div className="w-32"><Num label="Distancia al 0 (mm)" value={p?.dist ?? 0} onChange={n => onChange(n > 0 ? { muro: p?.muro ?? 'A', dist: n } : null)} /></div>
    {p && <button onClick={() => onChange(null)} className="text-[11px] font-black text-rose-600 pb-2">Quitar</button>}
  </div>
);

/** Lista de chequeo de lo que trae el boceto: qué se leyó, qué falta y qué hay que revisar; cada dato se toca y se edita ahí mismo */
function checklist(d: DatosBosquejo, q: ProductoLeido | undefined, ed: string[], set: SetD, marcar: (k: string) => void, abrirModulos: () => void): DatoLeido[] {
  const out: DatoLeido[] = [];
  const cocina = d.producto === 'cocinas', puerta = d.producto === 'puertas';
  const punto = (p: { muro: string; dist: number } | null | undefined) => (p ? `muro ${p.muro} a ${fmt(p.dist)} mm` : '');
  const upd = (f: (x: DatosBosquejo) => DatosBosquejo, k: string) => { set(f); marcar(k); };
  const dato = (clave: string, titulo: string, estado: EstadoDato, valor: string, editor?: React.ReactNode) => {
    const editado = ed.includes(clave);
    out.push({ clave, titulo, estado: editado && estado !== 'opcional' ? 'ok' : editado ? 'ok' : estado, valor: editado ? `${valor} · editado` : valor, editor });
  };
  const textoModulos = (clave: string) => (
    <label className="block max-w-md"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Anchos de izquierda a derecha (mm)</span>
      <input key={d.modulos.join('+')} defaultValue={d.modulos.join(' + ')} placeholder="Vacío = la app los reparte"
        onBlur={e => { const v = (e.target.value.match(/\d+/g) ?? []).map(Number).filter(n => n > 0); upd(x => ({ ...x, modulos: v }), clave); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800" /></label>
  );

  dato('A', puerta ? 'Largo del muro' : 'Medida total del muro', q?.muroA ? 'ok' : 'falta', q?.muroA ? `${fmt(d.A)} mm` : `no se vio · se usa ${fmt(d.A)} mm`,
    <div className="w-40"><Num label="Medida (mm)" value={d.A} onChange={n => upd(x => ({ ...x, A: n }), 'A')} /></div>);
  dato('alto', 'Altura del piso al techo', q?.alto ? 'ok' : 'falta', q?.alto ? `${fmt(d.alto)} mm` : `no se vio · se usa ${fmt(d.alto)} mm`,
    <div className="w-40"><Num label="Altura (mm)" value={d.alto} onChange={n => upd(x => ({ ...x, alto: n }), 'alto')} /></div>);
  if (!puerta) dato('forma', 'Forma', q?.forma ? 'ok' : 'revisar', `${FORMAS[d.forma]}${d.forma === 'L_SHAPE' ? (d.brazo === 'left' ? ' · brazo a la izquierda' : ' · brazo a la derecha') : ''}${q?.forma ? '' : ' (supuesto)'}`,
    SECTIONS[d.producto].layouts.length > 1 ? (
      <div className="flex flex-wrap gap-2">
        {SECTIONS[d.producto].layouts.map(f => <Chip key={f} on={d.forma === f} onClick={() => upd(x => ({ ...x, forma: f }), 'forma')}>{FORMAS[f]}</Chip>)}
        {d.forma === 'L_SHAPE' && <>
          <Chip on={d.brazo === 'left'} onClick={() => upd(x => ({ ...x, brazo: 'left' }), 'forma')}>Brazo a la izquierda</Chip>
          <Chip on={d.brazo === 'right'} onClick={() => upd(x => ({ ...x, brazo: 'right' }), 'forma')}>Brazo a la derecha</Chip></>}
      </div>) : undefined);
  if (!puerta && d.forma !== 'STRAIGHT') {
    const completa = (!conB(d) || !!q?.muroB) && (!conC(d) || !!q?.muroC);
    dato('brazos', 'Vista superior (muros B y C)', completa ? 'ok' : 'falta', completa ? `A ${fmt(d.A)}${conB(d) ? ` · B ${fmt(d.B)}` : ''}${conC(d) ? ` · C ${fmt(d.C)}` : ''} mm` : 'dibuja la planta con el muro B o C acotado',
      <div className="flex gap-3">
        {conB(d) && <div className="w-36"><Num label="Muro B (mm)" value={d.B} onChange={n => upd(x => ({ ...x, B: n }), 'brazos')} /></div>}
        {conC(d) && <div className="w-36"><Num label="Muro C (mm)" value={d.C} onChange={n => upd(x => ({ ...x, C: n }), 'brazos')} /></div>}
      </div>);
  } else if (!puerta) {
    dato('lados', 'Muros a los lados', 'ok', d.muroIzq && d.muroDer ? 'entre dos muros (dilatada de 7 cm en los dos)' : d.muroIzq ? 'a la izquierda (dilatada de 7 cm)' : d.muroDer ? 'a la derecha (dilatada de 7 cm)' : 'no hay',
      <div className="flex gap-2">
        <Chip on={d.muroIzq} onClick={() => upd(x => ({ ...x, muroIzq: !x.muroIzq }), 'lados')}>Muro a la izquierda</Chip>
        <Chip on={d.muroDer} onClick={() => upd(x => ({ ...x, muroDer: !x.muroDer }), 'lados')}>Muro a la derecha</Chip>
      </div>);
  }
  if (cocina) {
    const fila = (m: ModuloDibujado[]) => m.map(x => x.frente).join(', ');
    const botonModulos = <button onClick={abrirModulos} className="rounded-xl px-3 py-2 text-xs font-black border border-slate-200 text-slate-700">Editar módulos uno por uno</button>;
    dato('bajos', 'Módulos de abajo', d.bajos?.length ? 'ok' : 'falta', d.bajos?.length ? `${d.bajos.length}: ${fila(d.bajos)}` : 'no se vieron los frentes dibujados', botonModulos);
    dato('altos', 'Módulos de arriba', d.altos?.length ? 'ok' : 'falta', d.altos?.length ? `${d.altos.length}: ${fila(d.altos)}` : 'no se vieron los frentes dibujados', botonModulos);
    const suma = (q?.modulos ?? []).reduce((a, w) => a + w, 0);
    dato('modulos', 'Ancho de cada módulo', !q?.modulos.length ? 'falta' : suma !== d.A ? 'revisar' : 'ok', !d.modulos.length ? 'sin cotas por módulo: la app los reparte' : `${d.modulos.map(fmt).join(' + ')}${d.modulos.reduce((a, w) => a + w, 0) !== d.A ? ` = ${fmt(d.modulos.reduce((a, w) => a + w, 0))} y el muro mide ${fmt(d.A)}` : ''}`, textoModulos('modulos'));
    dato('nevera', 'Espacio de la nevera', d.nevera === 'no' ? 'opcional' : d.neveraEspacio ? 'ok' : 'revisar', d.nevera === 'no' ? 'sin nevera' : `a la ${d.nevera === 'inicio' ? 'izquierda' : 'derecha'}${d.neveraEspacio ? ` · espacio de ${fmt(d.neveraEspacio)} mm` : ' · falta acotar el espacio'}`,
      <div className="flex flex-wrap items-end gap-2">
        <Chip on={d.nevera === 'no'} onClick={() => upd(x => ({ ...x, nevera: 'no' }), 'nevera')}>Sin nevera</Chip>
        <Chip on={d.nevera === 'inicio'} onClick={() => upd(x => ({ ...x, nevera: 'inicio' }), 'nevera')}>A la izquierda</Chip>
        <Chip on={d.nevera === 'final'} onClick={() => upd(x => ({ ...x, nevera: 'final' }), 'nevera')}>A la derecha</Chip>
        {d.nevera !== 'no' && <div className="w-36"><Num label="Espacio (mm)" value={d.neveraEspacio ?? 0} onChange={n => upd(x => ({ ...x, neveraEspacio: n > 0 ? n : undefined }), 'nevera')} /></div>}
      </div>);
    {
      const cat = (t?: string) => (t ? colorDeCatalogo(t) : undefined);
      const partes = [['estructura', d.colorEstructura], ['fachada', d.colorFachada], ['fachada de los aéreos', d.colorFachadaAereos]].filter(([, v]) => v) as [string, string][];
      const sinCat = partes.filter(([, v]) => !cat(v));
      const campo = (rotulo: string, k: 'colorEstructura' | 'colorFachada' | 'colorFachadaAereos') => (
        <label className="block min-w-[10rem]"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{rotulo}</span>
          <input list="colores-catalogo" defaultValue={d[k] ?? ''} placeholder="Sin cambiar"
            onBlur={e => upd(x => ({ ...x, [k]: e.target.value.trim() || undefined }), 'colores')}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800" /></label>
      );
      dato('colores', 'Colores de los módulos', !partes.length ? 'opcional' : sinCat.length ? 'revisar' : 'ok',
        !partes.length ? 'no se nombran: quedan los de Configuración de módulos' : partes.map(([t, v]) => `${t}: ${cat(v)?.nombre ?? `${v} (no está en el catálogo)`}`).join(' · '),
        <div className="flex flex-wrap gap-3">
          {campo('Estructura', 'colorEstructura')}{campo('Fachada', 'colorFachada')}{campo('Fachada de los aéreos', 'colorFachadaAereos')}
          <datalist id="colores-catalogo">{CATALOGO.map(c => <option key={c.nombre} value={c.nombre} />)}</datalist>
        </div>);
    }
    dato('agua', 'Agua', d.agua ? 'ok' : 'falta', d.agua ? punto(d.agua) : 'no se ve el punto de agua', <PuntoEd p={d.agua} onChange={p => upd(x => ({ ...x, agua: p }), 'agua')} />);
    dato('desague', 'Desagüe (poceta)', d.desague ? 'ok' : 'falta', d.desague ? punto(d.desague) : 'no se ve el desagüe', <PuntoEd p={d.desague} onChange={p => upd(x => ({ ...x, desague: p }), 'desague')} />);
    dato('luz', 'Electricidad', d.electricidad?.length ? 'ok' : 'falta', d.electricidad?.length ? d.electricidad.map(punto).join(' · ') : 'no se ven tomas ni puntos eléctricos',
      <div className="space-y-2">
        {(d.electricidad ?? []).map((p, i) => <PuntoEd key={i} p={p} onChange={n => upd(x => ({ ...x, electricidad: n ? (x.electricidad ?? []).map((y, j) => (j === i ? n : y)) : (x.electricidad ?? []).filter((_, j) => j !== i) }), 'luz')} />)}
        <button onClick={() => upd(x => ({ ...x, electricidad: [...(x.electricidad ?? []), { muro: 'A', dist: 1000 }] }), 'luz')} className="text-[11px] font-black text-indigo-700">+ Agregar toma</button>
      </div>);
    dato('gas', 'Gas (estufa)', d.gas ? 'ok' : 'falta', d.gas ? punto(d.gas) : 'no se ve el punto de gas', <PuntoEd p={d.gas} onChange={p => upd(x => ({ ...x, gas: p }), 'gas')} />);
  }
  const detalleLeido = !!q?.detalle && q.detalle.trim().length > 8;
  if (d.producto === 'closets' || d.producto === 'closetfit' || d.producto === 'walking') {
    dato('modulos', 'Ancho de cada cuerpo', q?.modulos.length ? 'ok' : 'falta', d.modulos.length ? d.modulos.map(fmt).join(' + ') + ' mm' : 'sin cotas por cuerpo: la app los reparte', textoModulos('modulos'));
    dato('detalle', 'Qué lleva cada cuerpo', detalleLeido ? 'ok' : 'falta', detalleLeido ? 'tubos, entrepaños y cajones leídos (ver detalle)' : 'no se leyeron tubos, entrepaños ni cajones');
  } else if (d.producto === 'tv') {
    dato('modulos', 'Ancho de cada parte', q?.modulos.length ? 'ok' : 'falta', d.modulos.length ? d.modulos.map(fmt).join(' + ') + ' mm' : 'sin cotas por parte', textoModulos('modulos'));
    dato('detalle', 'Qué lleva el mueble', detalleLeido ? 'ok' : 'falta', detalleLeido ? 'leído (ver detalle)' : 'no se leyeron puertas, cajones ni repisas');
    dato('luz', 'Electricidad y datos', d.electricidad?.length ? 'ok' : 'falta', d.electricidad?.length ? d.electricidad.map(punto).join(' · ') : 'no se ven la toma del TV ni los datos',
      <div className="space-y-2">
        {(d.electricidad ?? []).map((p, i) => <PuntoEd key={i} p={p} onChange={n => upd(x => ({ ...x, electricidad: n ? (x.electricidad ?? []).map((y, j) => (j === i ? n : y)) : (x.electricidad ?? []).filter((_, j) => j !== i) }), 'luz')} />)}
        <button onClick={() => upd(x => ({ ...x, electricidad: [...(x.electricidad ?? []), { muro: 'A', dist: 1000 }] }), 'luz')} className="text-[11px] font-black text-indigo-700">+ Agregar punto</button>
      </div>);
  } else if (d.producto === 'bano') {
    dato('agua', 'Agua', d.agua ? 'ok' : 'falta', d.agua ? punto(d.agua) : 'no se ve el punto de agua', <PuntoEd p={d.agua} onChange={p => upd(x => ({ ...x, agua: p }), 'agua')} />);
    dato('desague', 'Desagüe', d.desague ? 'ok' : 'falta', d.desague ? punto(d.desague) : 'no se ve el desagüe', <PuntoEd p={d.desague} onChange={p => upd(x => ({ ...x, desague: p }), 'desague')} />);
    dato('detalle', 'Qué lleva el mueble', detalleLeido ? 'ok' : 'falta', detalleLeido ? 'puertas y cajones leídos (ver detalle)' : 'no se leyeron puertas ni cajones');
  }
  if (!puerta) dato('fondo', 'Fondo', q?.fondo ? 'ok' : 'opcional', q?.fondo ? `${fmt(q.fondo)} mm` : 'el normal del producto');
  return out;
}

const ICONO: Record<EstadoDato, { ico: string; caja: string }> = {
  ok: { ico: '✓', caja: 'bg-emerald-100 text-emerald-700' },
  falta: { ico: '✕', caja: 'bg-rose-100 text-rose-700' },
  revisar: { ico: '!', caja: 'bg-amber-100 text-amber-700' },
  opcional: { ico: '–', caja: 'bg-slate-100 text-slate-400' },
};

const ListaChequeo: React.FC<{ items: DatoLeido[] }> = ({ items }) => {
  const [abierto, setAbierto] = useState<string | null>(null);
  const cuenta = items.filter(i => i.estado !== 'opcional');
  const leidos = cuenta.filter(i => i.estado === 'ok').length;
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black text-slate-400 uppercase">Lo que trae el boceto · {leidos} de {cuenta.length} datos listos · toca un dato para corregirlo</div>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {items.map(it => (
          <li key={it.clave} className={`rounded-xl ${abierto === it.clave ? 'bg-slate-50 sm:col-span-2' : ''}`}>
            <button type="button" onClick={() => it.editor && setAbierto(a => (a === it.clave ? null : it.clave))} className={`w-full flex items-start gap-2 text-left p-1.5 rounded-xl ${it.editor ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}>
              <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[11px] font-black mt-0.5 ${ICONO[it.estado].caja}`}>{ICONO[it.estado].ico}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-slate-800">{it.titulo}</span>
                <span className={`block text-[11px] font-bold ${it.estado === 'falta' ? 'text-rose-600' : it.estado === 'revisar' ? 'text-amber-700' : 'text-slate-500'}`}>{it.valor}</span>
              </span>
              {it.editor && <span className="text-[11px] font-black text-indigo-600 shrink-0">{abierto === it.clave ? 'Listo' : 'Editar'}</span>}
            </button>
            {abierto === it.clave && it.editor && <div className="px-2 pb-3 pt-1" onClick={e => e.stopPropagation()}>{it.editor}</div>}
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

/** Limpia la foto para leerla mejor: escala de grises y contraste, y borra lo que es más claro que el trazo (cuadrícula, marcas de agua, sombras) */
function limpiarFoto(c: HTMLCanvasElement): string {
  const ctx = c.getContext('2d')!;
  const im = ctx.getImageData(0, 0, c.width, c.height), px = im.data;
  const grises = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) grises[j] = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  const hist = new Array(256).fill(0);
  grises.forEach(v => hist[v]++);
  const percentil = (p: number) => { let a = 0; const meta = grises.length * p; for (let v = 0; v < 256; v++) { a += hist[v]; if (a >= meta) return v; } return 255; };
  const negro = percentil(0.005), papel = percentil(0.6);
  if (papel - negro < 40) return c.toDataURL('image/jpeg', 0.9); // foto muy pareja: se envía como está
  const blanco = negro + 0.8 * (papel - negro); // lo más claro que el 80 % del camino entre el trazo y el papel se vuelve papel (el lápiz suave se conserva)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = Math.max(0, Math.min(255, ((grises[j] - negro) / (blanco - negro)) * 255));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
}

const OPC_DIBUJO: [Pistas['dibujo'], string][] = [['auto', 'Que la app lo decida'], ['frente', 'Vista de frente'], ['planta', 'Vista superior (planta)'], ['ambas', 'Las dos']];
const OPC_UNIDADES: [Pistas['unidades'], string][] = [['auto', 'Que la app lo decida'], ['cm', 'Centímetros'], ['mm', 'Milímetros'], ['m', 'Metros']];

export interface EvidenciasBoceto { fotos: string[]; notas: string }
export const Bosquejo: React.FC<{ actual: SectionId; onCrear: (d: DatosBosquejo, foto?: string, evidencias?: EvidenciasBoceto) => void }> = ({ actual, onCrear }) => {
  const [fotos, setFotos] = useState<{ vista: string; ia: string }[]>([]);
  const [pistas, setPistas] = useState<Pistas>(PISTAS_AUTO);
  const [limpiar, setLimpiar] = useState(true);
  const [lectura, setLectura] = useState<{ estado: 'nada' | 'leyendo' | 'lista' | 'error'; r?: LecturaBoceto; error?: string }>({ estado: 'nada' });
  const [datos, setDatos] = useState<DatosBosquejo[]>([]);
  const [editados, setEditados] = useState<Record<number, string[]>>({}); // datos de la lista que el carpintero corrigió a mano, por mueble
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [verGuia, setVerGuia] = useState(false); // normas y ejemplos del boceto: contraídos, al final de la página
  const abrirGuia = () => { setVerGuia(true); setTimeout(() => document.getElementById('guia-boceto')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  const leer = async () => {
    if (!fotos.length) return;
    setLectura({ estado: 'leyendo' }); setDatos([]); setCorrigiendo(null); setEditados({});
    try {
      const r = await leerBoceto(fotos.map(f => (limpiar ? f.ia : f.vista)), pistas);
      setLectura({ estado: 'lista', r });
      setDatos(r.productos.map(q => aDatos(q, actual)));
    } catch (e) { setLectura({ estado: 'error', error: e instanceof Error ? e.message : String(e) }); }
  };
  const cargarFoto = (f: File) => new Promise<{ vista: string; ia: string } | null>(res => {
    const lector = new FileReader();
    lector.onload = () => {
      // se achica a 1600 px de lado mayor: suficiente para leer la letra y más liviano de enviar
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        const vista = c.toDataURL('image/jpeg', 0.88);
        res({ vista, ia: limpiarFoto(c) });
      };
      img.onerror = () => res(null);
      img.src = String(lector.result);
    };
    lector.onerror = () => res(null);
    lector.readAsDataURL(f);
  });
  const agregar = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const nuevas = (await Promise.all([...lista].slice(0, 6).map(cargarFoto))).filter((x): x is { vista: string; ia: string } => !!x);
    setFotos(fs => [...fs, ...nuevas].slice(0, 6));
    setLectura({ estado: 'nada' }); setDatos([]);
  };
  const entrada = <input type="file" accept="image/*" multiple data-boceto className="hidden" onChange={e => { agregar(e.target.files); e.target.value = ''; }} />;
  const foto = fotos[0]?.vista ?? null;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* 1 · las imágenes (el boceto y todo lo que ayude: fotos del sitio, medidas, listas) y las pistas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        {!fotos.length ? (
          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40">
              <span className="text-sm font-black text-slate-800">Adjunta el boceto</span>
              <span className="text-[11px] font-bold text-slate-400 max-w-md">Puedes subir varias imágenes: el boceto, fotos del sitio, medidas escritas o una lista de lo que se pide. Se envían al servicio de Gemini (Google) para leerlas.</span>
              <span className="mt-2 rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white">Elegir imágenes</span>
              {entrada}
            </label>
            <button onClick={abrirGuia} className="w-full text-center text-[11px] font-black text-indigo-700">¿Cómo dibujar el boceto? Ver ejemplo y normas</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.vista} alt={`Imagen ${i + 1}`} className="h-36 w-auto max-w-[14rem] object-contain rounded-xl border border-slate-200 bg-slate-50" />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/70 text-white text-[10px] font-black px-1.5">{i === 0 ? 'Boceto' : `Imagen ${i + 1}`}</span>
                <button onClick={() => { setFotos(fs => fs.filter((_, j) => j !== i)); setLectura({ estado: 'nada' }); setDatos([]); }} title="Quitar esta imagen" className="absolute right-1.5 top-1.5 w-5 h-5 rounded-full bg-white/90 text-slate-600 text-xs font-black leading-none shadow">×</button>
              </div>
            ))}
            {fotos.length < 6 && <label className="h-36 w-28 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-center cursor-pointer hover:border-indigo-400"><span className="text-xl font-black text-indigo-600">+</span><span className="text-[10px] font-black text-slate-500">Agregar otra imagen</span>{entrada}</label>}
          </div>
        )}

        {fotos.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="space-y-1.5">
              <div className="text-[10px] font-black text-slate-400 uppercase">¿Qué dibujaste?</div>
              <div className="flex flex-wrap gap-2">{OPC_DIBUJO.map(([v, t]) => <Chip key={v} on={pistas.dibujo === v} onClick={() => setPistas(p => ({ ...p, dibujo: v }))}>{t}</Chip>)}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-black text-slate-400 uppercase">¿En qué unidades están las medidas?</div>
              <div className="flex flex-wrap gap-2">{OPC_UNIDADES.map(([v, t]) => <Chip key={v} on={pistas.unidades === v} onClick={() => setPistas(p => ({ ...p, unidades: v }))}>{t}</Chip>)}</div>
            </div>
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Notas para la lectura (opcional)</span>
              <textarea value={pistas.notas} onChange={e => setPistas(p => ({ ...p, notas: e.target.value }))} rows={2} placeholder="Ej: cocina en L con el brazo a la izquierda; el gas y el agua están en centímetros; la nevera es de 70 de ancho"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={limpiar} onChange={e => setLimpiar(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
              Limpiar las fotos antes de leerlas (quita cuadrícula, marcas de agua y sombras)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={lectura.estado === 'leyendo'} onClick={leer} className="rounded-xl px-5 py-2.5 text-sm font-black bg-indigo-600 text-white disabled:opacity-50">{lectura.estado === 'nada' ? 'Leer el boceto' : 'Leer otra vez con estas pistas'}</button>
              <button onClick={() => { setFotos([]); setLectura({ estado: 'nada' }); setDatos([]); }} className="rounded-xl px-4 py-2.5 text-xs font-black border border-slate-200 text-slate-700">Empezar de nuevo</button>
              <button onClick={abrirGuia} className="text-[11px] font-black text-indigo-700">¿Cómo dibujar el boceto?</button>
              {lectura.estado === 'leyendo' && <span className="text-sm font-black text-indigo-700">Leyendo… (puede tardar unos segundos)</span>}
            </div>
            {lectura.estado === 'error' && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{lectura.error}</div>}
            {lectura.estado === 'lista' && lectura.r && <div className="text-sm font-bold text-slate-700">{lectura.r.resumen}{lectura.r.modelo && <span className="ml-2 text-[10px] font-bold text-slate-400">leído con {lectura.r.modelo}</span>}</div>}
          </div>
        )}
      </div>

      {/* 2 · lo que se entendió de cada mueble, para aceptar o corregir */}
      {datos.map((d, k) => {
        const q = lectura.r?.productos[k];
        const avisos = avisosDe(d), bloquea = avisos.some(a => a.bloquea);
        const setD: SetD = f => setDatos(ds => ds.map((x, i) => (i === k ? f(x) : x)));
        const marcar = (clave: string) => setEditados(e => ({ ...e, [k]: [...new Set([...(e[k] ?? []), clave])] }));
        return (
          <div key={k} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{q?.nombre ?? 'Mueble'}</span>
              <span className="text-[11px] font-black text-indigo-600">{SECTIONS[d.producto].name}{q && !q.producto ? ' · no se identificó, revísalo' : ''}</span>
              <span className="flex gap-1 ml-auto">{ORDEN.map(p => <button key={p} onClick={() => setD(x => ({ ...x, producto: p, modulos: p === 'cocinas' ? x.modulos : [] }))} className={`rounded-lg px-2 py-0.5 text-[10px] font-black border ${d.producto === p ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-400 border-transparent hover:text-slate-600'}`}>{SECTIONS[p].name.split(' ')[0]}</button>)}</span>
            </div>
            <ListaChequeo items={checklist(d, q, editados[k] ?? [], setD, marcar, () => setCorrigiendo(k))} />
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
                  <Num label="Ancho de la nevera (mm)" value={d.neveraAncho ?? 0} onChange={v => setD(x => ({ ...x, neveraAncho: v > 0 ? v : undefined }))} />
                  <Num label="Alto de la nevera (mm)" value={d.neveraAlto ?? 0} onChange={v => setD(x => ({ ...x, neveraAlto: v > 0 ? v : undefined }))} />
                  <Num label="Espacio para la nevera (mm)" value={d.neveraEspacio ?? 0} onChange={v => setD(x => ({ ...x, neveraEspacio: v > 0 ? v : undefined }))} />
                </div>
                <div className="text-[10px] font-bold text-slate-400">La nevera va centrada en su espacio, con 5 cm libres a cada lado como mínimo. Encima va la sobrenevera.</div>
              </div>
            )}
            {normasDelTaller(d).length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 space-y-0.5">
                <div className="text-[10px] font-black text-indigo-700 uppercase">Normas del taller que se aplican</div>
                {normasDelTaller(d).map((t, i) => <div key={i} className="text-[11px] font-bold text-indigo-900">• {t}</div>)}
              </div>
            )}
            {avisos.map((a, i) => <div key={i} className={`text-[11px] font-bold rounded-xl px-3 py-2 border ${a.bloquea ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>{a.texto}</div>)}
            {corrigiendo === k
              ? <Corregir d={d} set={setD} onListo={() => setCorrigiendo(null)} />
              : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button disabled={bloquea} onClick={() => {
                    // evidencias del proyecto: todas las fotos del boceto y las notas (lo que escribió el carpintero, lo que se entendió, las dudas y lo corregido a mano)
                    const unid = { auto: 'la app decide', cm: 'centímetros', mm: 'milímetros', m: 'metros' }[pistas.unidades] ?? pistas.unidades;
                    const notas = [
                      pistas.notas.trim() ? `Notas del carpintero:\n${pistas.notas.trim()}` : '',
                      `Tipo de dibujo: ${pistas.dibujo === 'auto' ? 'la app decide' : pistas.dibujo}. Unidades: ${unid}.`,
                      q?.nombre ? `Mueble: ${q.nombre}` : '',
                      lectura.r?.resumen ? `Lo que se entendió: ${lectura.r.resumen}` : '',
                      q?.detalle ? `Detalle leído dentro de los muebles: ${q.detalle}` : '',
                      q && q.dudas.length ? `Dudas de la lectura:\n- ${q.dudas.join('\n- ')}` : '',
                      (editados[k] ?? []).length ? `Datos corregidos a mano: ${(editados[k] ?? []).join(', ')}` : '',
                    ].filter(Boolean).join('\n\n');
                    onCrear(d, foto ?? undefined, { fotos: fotos.map(f => f.vista), notas });
                  }} className="rounded-xl px-5 py-2.5 text-sm font-black bg-indigo-600 text-white disabled:opacity-40">Aceptar</button>
                  <button onClick={() => setCorrigiendo(k)} className="rounded-xl px-5 py-2.5 text-sm font-black border border-slate-200 text-slate-700">Corregir todo</button>
                  <span className="text-[11px] font-bold text-slate-400">Aceptar arma el diseño de {SECTIONS[d.producto].name} (reemplaza el que haya).</span>
                </div>
              )}
          </div>
        );
      })}
      <GuiaBoceto abierta={verGuia} onCambiar={setVerGuia} producto={datos[0]?.producto ?? actual} />
    </div>
  );
};
