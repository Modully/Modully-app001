import React, { useEffect, useState } from 'react';
import { PreviaModulo } from './PreviaModulo';

/**
 * Mis módulos: la biblioteca de módulos especiales del carpintero. Aquí se crea un módulo a su medida (nivel, ancho, alto, fondo,
 * qué lleva el frente), se guarda con su nombre y se agrega a cualquier diseño; también se puede guardar uno que ya está en el diseño.
 * Por ahora se guardan en este equipo (el navegador); no se pierden al cerrar la app.
 */

export type NivelEspecial = 'LOWER' | 'UPPER' | 'TALL';
export type FrenteEspecial = 'puertas' | 'cajones' | 'abierto';
export interface ModuloEspecial {
  id: string; nombre: string; nivel: NivelEspecial;
  ancho: number; alto: number; fondo: number;
  frente: FrenteEspecial; cajones: number; platero: boolean;
  muebleHorno?: 'std' | 'cond-izq' | 'cond-der' | 'corto-izq' | 'corto-der' | 'corto-cajon' | 'corto-cubiertero'; // mueble de horno de la biblioteca: lleva su despiece propio (el alto es el del mueble base del diseño)
}

/** Muebles de horno que ya vienen en la biblioteca (planos del carpintero) */
export const MUEBLES_HORNO: ModuloEspecial[] = [
  { id: 'horno-std', nombre: 'Mueble de horno', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false, muebleHorno: 'std' },
  { id: 'horno-cond-izq', nombre: 'Mueble de horno con condimentero a la izquierda', nivel: 'LOWER', ancho: 795, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false, muebleHorno: 'cond-izq' },
  { id: 'horno-cond-der', nombre: 'Mueble de horno con condimentero a la derecha', nivel: 'LOWER', ancho: 795, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false, muebleHorno: 'cond-der' },
  { id: 'horno-corto-cajon', nombre: 'Mueble de horno corto con cajón', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'cajones', cajones: 1, platero: false, muebleHorno: 'corto-cajon' },
  { id: 'horno-corto-cubiertero', nombre: 'Mueble de horno corto con cajón y cubiertero', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'cajones', cajones: 2, platero: false, muebleHorno: 'corto-cubiertero' },
  { id: 'horno-corto-izq', nombre: 'Mueble de horno corto con condimentero a la izquierda', nivel: 'LOWER', ancho: 795, alto: 800, fondo: 570, frente: 'cajones', cajones: 2, platero: false, muebleHorno: 'corto-izq' },
  { id: 'horno-corto-der', nombre: 'Mueble de horno corto con condimentero a la derecha', nivel: 'LOWER', ancho: 795, alto: 800, fondo: 570, frente: 'cajones', cajones: 2, platero: false, muebleHorno: 'corto-der' },
];

/** Muebles de la biblioteca que sirven para un equipo: el horno (hueco de 590) o el horno corto */
export const opcionesMuebleHorno = (tipo: 'oven' | 'oven-compact'): ModuloEspecial[] => MUEBLES_HORNO.filter(o => (tipo === 'oven') !== !!o.muebleHorno?.startsWith('corto'));
export const muebleDeVariante = (v?: string): ModuloEspecial | undefined => MUEBLES_HORNO.find(o => o.muebleHorno === v);
/** Mueble que se propone por defecto para cada equipo */
export const VARIANTE_POR_DEFECTO: Record<'oven' | 'oven-compact', NonNullable<ModuloEspecial['muebleHorno']>> = { oven: 'std', 'oven-compact': 'corto-cajon' };
export const etiquetaMueble = (v?: string): string => ({ std: 'Mueble de horno', 'cond-izq': 'Con condimentero izq.', 'cond-der': 'Con condimentero der.', 'corto-cajon': 'Con cajón', 'corto-cubiertero': 'Con cajón y cubiertero', 'corto-izq': 'Con condimentero izq.', 'corto-der': 'Con condimentero der.' } as Record<string, string>)[v ?? ''] ?? 'Mueble';

/** Muebles inferiores (bajos) de la cocina integral: puertas y cajones de las medidas que se usan en las cocinas */
const MUEBLES_INFERIORES: ModuloEspecial[] = [
  { id: 'bajo-1p-450', nombre: 'Bajo de 1 puerta (450)', nivel: 'LOWER', ancho: 450, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false },
  { id: 'bajo-2p-600', nombre: 'Bajo de 2 puertas (600)', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false },
  { id: 'bajo-2p-900', nombre: 'Bajo de 2 puertas (900)', nivel: 'LOWER', ancho: 900, alto: 800, fondo: 570, frente: 'puertas', cajones: 0, platero: false },
  { id: 'cajonero-600', nombre: 'Cajonero (600)', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'cajones', cajones: 3, platero: false },
  { id: 'cajonero-900', nombre: 'Cajonero (900)', nivel: 'LOWER', ancho: 900, alto: 800, fondo: 570, frente: 'cajones', cajones: 3, platero: false },
  { id: 'bajo-abierto-600', nombre: 'Bajo abierto (600)', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'abierto', cajones: 0, platero: false },
];

const CLAVE = 'modully-modulos-especiales';
const cargar = (): ModuloEspecial[] => { try { const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const guardar = (l: ModuloEspecial[]) => { try { localStorage.setItem(CLAVE, JSON.stringify(l)); } catch { /* sin almacenamiento: queda solo en esta sesión */ } };

const NIVELES: Record<NivelEspecial, { nombre: string; ancho: number; alto: number; fondo: number }> = {
  LOWER: { nombre: 'Bajo', ancho: 600, alto: 800, fondo: 570 },
  UPPER: { nombre: 'Aéreo', ancho: 600, alto: 700, fondo: 330 },
  TALL: { nombre: 'Alto (hasta el techo)', ancho: 600, alto: 2100, fondo: 570 },
};
const FRENTES: Record<FrenteEspecial, string> = { puertas: 'Puertas', cajones: 'Cajones', abierto: 'Abierto' };
const fmt = (n: number) => n.toLocaleString('es-CO');

const Num: React.FC<{ label: string; value: number; onChange: (n: number) => void }> = ({ label, value, onChange }) => {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 block mb-1">{label}</span>
      <input type="text" inputMode="numeric" value={txt ?? String(value)}
        onChange={e => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => { if (txt !== null) { const n = parseInt(txt, 10); onChange(isNaN(n) ? 0 : n); setTxt(null); } }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500" />
    </label>
  );
};
const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} className={`rounded-xl px-3 py-1.5 text-xs border transition-colors ${on ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium'}`}>{children}</button>
);

const resumenModulo = (m: ModuloEspecial): string => {
  const med = `${NIVELES[m.nivel].nombre} · ${fmt(m.ancho)} × ${fmt(m.alto)} × ${fmt(m.fondo)} mm`;
  switch (m.muebleHorno) {
    case 'std': return `${med} · hueco del horno de 590 y frentes arriba y abajo`;
    case 'cond-izq': case 'cond-der': return `${med} · cajón de 130 abajo, hueco del horno de 590, frente decorativo arriba y condimentero al lado`;
    case 'corto-cajon': return `${med} · cajón (frente de 190), gola media, otra base, hueco del horno corto de 460 y frente decorativo arriba`;
    case 'corto-cubiertero': return `${med} · cajón (frente de 123), gola media, hueco del horno corto de 460 y cajón pando (cubiertero) arriba`;
    case 'corto-izq': case 'corto-der': return `${med} · hueco del horno corto de 375, dos cajones y condimentero al lado`;
  }
  return `${med} · ${FRENTES[m.frente].toLowerCase()}`;
};

const nuevo = (): ModuloEspecial => ({ id: '', nombre: '', nivel: 'LOWER', ancho: 600, alto: 800, fondo: 570, frente: 'puertas', cajones: 3, platero: false });

export const ModulosEspeciales: React.FC<{
  /** módulos del diseño abierto, para guardarlos como especiales */
  delDiseno: { uniqueId: string; label?: string; name: string; type: string; width: number; height: number; depth: number; frontsLayout?: string; configType?: string; drawerCount?: number; hasPlateRack?: boolean }[];
  onAgregar: (m: ModuloEspecial) => void;
}> = ({ delDiseno, onAgregar }) => {
  const [pestana, setPestana] = useState<'cocina' | 'mios'>('cocina');
  const [sub, setSub] = useState<'inferiores' | 'hornos'>('inferiores');
  const [selId, setSelId] = useState<string>(MUEBLES_INFERIORES[0].id);
  const [lista, setLista] = useState<ModuloEspecial[]>(cargar);
  const [f, setF] = useState<ModuloEspecial>(nuevo);
  useEffect(() => { guardar(lista); }, [lista]);
  const editando = f.id !== '' && lista.some(x => x.id === f.id);
  const valido = f.nombre.trim().length > 0 && f.ancho >= 100 && f.alto >= 100 && f.fondo >= 100;

  const cambiarNivel = (n: NivelEspecial) => setF(x => ({ ...x, nivel: n, alto: NIVELES[n].alto, fondo: NIVELES[n].fondo }));
  const guardarForm = () => {
    if (!valido) return;
    const m = { ...f, nombre: f.nombre.trim(), id: f.id || `esp-${Date.now().toString(36)}` };
    setLista(l => (l.some(x => x.id === m.id) ? l.map(x => (x.id === m.id ? m : x)) : [...l, m]));
    setF(nuevo());
  };
  const desdeDiseno = (d: (typeof delDiseno)[number]) => {
    const frente: FrenteEspecial = d.frontsLayout === 'open' ? 'abierto' : d.frontsLayout === 'drawers' || d.configType === 'drawers' ? 'cajones' : 'puertas';
    const nivel: NivelEspecial = d.type === 'UPPER' ? 'UPPER' : d.type === 'TALL' ? 'TALL' : 'LOWER';
    setF({ id: '', nombre: d.name, nivel, ancho: Math.round(d.width), alto: Math.round(d.height), fondo: Math.round(d.depth), frente, cajones: d.drawerCount || 3, platero: !!d.hasPlateRack });
    window.scrollTo?.({ top: 0 });
  };

  const tabBtn = (on: boolean) => `px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${on ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`;
  const catalogo = sub === 'hornos' ? MUEBLES_HORNO : MUEBLES_INFERIORES;
  const sel = catalogo.find(m => m.id === selId) ?? catalogo[0];
  const cambiarSub = (k: 'inferiores' | 'hornos') => { setSub(k); setSelId((k === 'hornos' ? MUEBLES_HORNO : MUEBLES_INFERIORES)[0].id); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button className={tabBtn(pestana === 'cocina')} onClick={() => setPestana('cocina')}>Cocina integral</button>
        <button className={tabBtn(pestana === 'mios')} onClick={() => setPestana('mios')}>Mis módulos{lista.length > 0 ? ` · ${lista.length}` : ''}</button>
      </div>

      {pestana === 'cocina' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button className={tabBtn(sub === 'inferiores')} onClick={() => cambiarSub('inferiores')}>Muebles inferiores · {MUEBLES_INFERIORES.length}</button>
            <button className={tabBtn(sub === 'hornos')} onClick={() => cambiarSub('hornos')}>Muebles de horno · {MUEBLES_HORNO.length}</button>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 items-start">
            <div className="space-y-3">
              {catalogo.map(m => (
                <div key={m.id} role="button" tabIndex={0} onClick={() => setSelId(m.id)} onKeyDown={e => { if (e.key === 'Enter') setSelId(m.id); }}
                  className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-wrap items-center gap-3 cursor-pointer transition-colors ${sel.id === m.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200/80 hover:border-slate-300'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{m.nombre}</div>
                    <div className="text-xs text-slate-500">{resumenModulo(m)}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onAgregar(m); }} className="rounded-xl px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors">Agregar al diseño</button>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3 lg:sticky lg:top-0">
              <div className="text-xs font-semibold tracking-tight text-slate-500">Vista previa</div>
              <div className="text-sm font-semibold text-slate-900">{sel.nombre}</div>
              <PreviaModulo m={sel} />
              <button onClick={() => onAgregar(sel)} className="w-full rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors">Agregar al diseño</button>
            </div>
          </div>
        </div>
      )}

      {pestana === 'mios' && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 items-start">
          <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div>
          <div className="text-base font-semibold tracking-tight text-slate-900">{editando ? 'Editar módulo' : 'Crear un módulo a tu medida'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Ponle nombre, medidas y qué lleva el frente; se guarda aquí para usarlo en cualquier diseño.</div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 block mb-1">Nombre</span>
          <input value={f.nombre} onChange={e => setF(x => ({ ...x, nombre: e.target.value }))} placeholder="Ej: Cajonero de 45, Torre de despensa, Bar"
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(NIVELES) as NivelEspecial[]).map(n => <Chip key={n} on={f.nivel === n} onClick={() => cambiarNivel(n)}>{NIVELES[n].nombre}</Chip>)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Num label="Ancho (mm)" value={f.ancho} onChange={n => setF(x => ({ ...x, ancho: n }))} />
          <Num label="Alto (mm)" value={f.alto} onChange={n => setF(x => ({ ...x, alto: n }))} />
          <Num label="Fondo (mm)" value={f.fondo} onChange={n => setF(x => ({ ...x, fondo: n }))} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">Qué lleva el frente</div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FRENTES) as FrenteEspecial[]).map(k => <Chip key={k} on={f.frente === k} onClick={() => setF(x => ({ ...x, frente: k }))}>{FRENTES[k]}</Chip>)}
            {f.nivel === 'UPPER' && f.frente === 'puertas' && <Chip on={f.platero} onClick={() => setF(x => ({ ...x, platero: !x.platero }))}>Con platero</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button disabled={!valido} onClick={guardarForm} className="rounded-xl px-5 py-2.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 transition-colors">{editando ? 'Guardar cambios' : 'Guardar en biblioteca'}</button>
          {(editando || f.nombre) && <button onClick={() => setF(nuevo())} className="rounded-xl px-5 py-2.5 text-sm font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors">Limpiar</button>}
        </div>
      </div>


      <div className="space-y-3">
        <div className="text-xs font-semibold tracking-tight text-slate-900 px-1">Guardados · {lista.length}</div>
        {lista.length === 0 && <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">Aún no hay módulos guardados. Crea uno arriba, o guarda uno de tu diseño.</div>}
        {lista.map(m => (
          <div key={m.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{m.nombre}</div>
              <div className="text-xs text-slate-500">{NIVELES[m.nivel].nombre} · {fmt(m.ancho)} × {fmt(m.alto)} × {fmt(m.fondo)} mm · {FRENTES[m.frente].toLowerCase()}{m.platero ? ' con platero' : ''}</div>
            </div>
            <button onClick={() => onAgregar(m)} className="rounded-xl px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors">Agregar al diseño</button>
            <button onClick={() => { setF(m); window.scrollTo?.({ top: 0 }); }} className="rounded-xl px-3 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors">Editar</button>
            <button onClick={() => setLista(l => l.filter(x => x.id !== m.id))} className="rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700">Quitar</button>
          </div>
        ))}
      </div>

      {delDiseno.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold tracking-tight text-slate-900 px-1">Guardar uno del diseño abierto</div>
          <div className="flex flex-wrap gap-2">
            {delDiseno.map(d => (
              <button key={d.uniqueId} onClick={() => desdeDiseno(d)} title={`${d.name} · ${Math.round(d.width)} × ${Math.round(d.height)} × ${Math.round(d.depth)} mm`}
                className="rounded-xl px-3 py-2 text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">{d.label ?? ''} {Math.round(d.width)}×{Math.round(d.height)}</button>
            ))}
          </div>
          <div className="text-xs text-slate-500 px-1">Al elegirlo se carga arriba con sus medidas: ajústalo, ponle nombre y guárdalo.</div>
        </div>
      )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3 lg:sticky lg:top-0">
            <div className="text-xs font-semibold tracking-tight text-slate-500">Vista previa</div>
            <div className="text-sm font-semibold text-slate-900">{f.nombre || 'Tu módulo'}</div>
            <PreviaModulo m={f} />
          </div>
        </div>
      )}
    </div>
  );
};
