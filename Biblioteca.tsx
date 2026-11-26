import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SECTIONS, SectionId } from './sections';
import { DisenoBiblioteca, ajustarBiblioteca, alCambiarSesion, borrarDeBiblioteca, listarBiblioteca, nubeConfigurada, sesionActual } from './nube';

/**
 * Biblioteca de diseños aprobados: productos que ya se diseñaron y aprobaron, guardados para volver a usarlos en otro
 * proyecto sin rehacer todo el proceso. "Usar en un proyecto" abre el diseño y pide el proyecto para aprobarlo ahí
 * (se crean sus documentos); "Abrir" lo carga en Diseño para cambiarlo antes.
 */

/** Huella del diseño que no depende del orden de las claves (la base de datos las reordena): sirve para saber si ya está guardado */
export function huellaDiseno(v: unknown): string {
  const orden = (x: unknown): unknown => (Array.isArray(x) ? x.map(orden) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x as object).sort().map(k => [k, orden((x as Record<string, unknown>)[k])])) : x);
  return JSON.stringify(orden(v));
}

const fecha = (s: string) => new Date(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const campo = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500';

/** Resumen corto del diseño guardado: medidas del espacio */
function resumen(d: DisenoBiblioteca): string {
  const s = (d.datos ?? {}) as Record<string, unknown>;
  const partes: string[] = [];
  const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : undefined);
  const forma = s.layout === 'L_SHAPE' ? 'en L' : s.layout === 'U_SHAPE' ? 'en U' : s.layout === 'STRAIGHT' ? 'lineal' : '';
  if (d.seccion === 'cocinas' && forma) partes.push(forma);
  const A = n('wallA'), B = n('wallB'), C = n('wallC');
  if (A) partes.push(`A ${A}`);
  if (B && (s.layout === 'L_SHAPE' || s.layout === 'U_SHAPE')) partes.push(`B ${B}`);
  if (C && s.layout === 'U_SHAPE') partes.push(`C ${C}`);
  const H = n('spaceHeight'); if (H) partes.push(`alto ${H}`);
  const mods = Array.isArray(s.modules) ? (s.modules as unknown[]).length : 0;
  if (mods) partes.push(`${mods} módulos`);
  const islas = Array.isArray(s.islands) ? (s.islands as unknown[]).length : 0;
  if (islas) partes.push(islas === 1 ? 'con isla' : `${islas} islas`);
  return partes.join(' · ');
}

export const Biblioteca: React.FC<{
  onUsar: (seccion: SectionId, datos: unknown, nombre: string) => void;  // abrir y aprobar en un proyecto
  onAbrir: (seccion: SectionId, datos: unknown) => void;                  // abrir para cambiarlo
  recargar?: number;                                                      // cambia cuando se guarda algo nuevo
}> = ({ onUsar, onAbrir, recargar }) => {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [items, setItems] = useState<DisenoBiblioteca[] | null>(null);
  const [filtro, setFiltro] = useState<SectionId | 'todos'>('todos');
  const [buscar, setBuscar] = useState('');
  const [editando, setEditando] = useState<{ id: string; nombre: string; notas: string } | null>(null);
  const [confirmar, setConfirmar] = useState<DisenoBiblioteca | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { sesionActual().then(setSesion); return alCambiarSesion(setSesion); }, []);
  const cargar = () => listarBiblioteca().then(setItems).catch(e => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { if (sesion) cargar(); else setItems(null); }, [sesion?.user.id, recargar]);
  const intentar = async (f: () => Promise<void>) => { setError(null); try { await f(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };

  if (!nubeConfigurada || !sesion) return null;
  const tipos = Array.from(new Set((items ?? []).map(d => d.seccion))) as SectionId[];
  const q = buscar.trim().toLowerCase();
  const vistos = (items ?? []).filter(d => (filtro === 'todos' || d.seccion === filtro) && (!q || `${d.nombre} ${d.notas}`.toLowerCase().includes(q)));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Biblioteca</h3>
        <p className="text-xs text-slate-500">Diseños aprobados que guardaste para volver a usarlos en otros proyectos sin rehacer el proceso.</p>
      </div>
      {error && <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
      {confirmar && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmar(null)}>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-slate-900">¿Quitar "{confirmar.nombre}" de la biblioteca? Los proyectos donde ya se usó no cambian.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmar(null)} className="rounded-xl px-4 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700">Cancelar</button>
              <button onClick={() => { const d = confirmar; setConfirmar(null); intentar(async () => { await borrarDeBiblioteca(d.id); await cargar(); }); }} className="rounded-xl px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white">Sí, quitar</button>
            </div>
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(['todos', ...tipos] as const).map(t => (
            <button key={t} onClick={() => setFiltro(t)} className={`rounded-full px-3 py-1 text-xs border transition-colors ${filtro === t ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium'}`}>
              {t === 'todos' ? `Todos · ${items.length}` : `${SECTIONS[t]?.name ?? t} · ${items.filter(d => d.seccion === t).length}`}
            </button>
          ))}
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o nota" className="ml-auto w-52 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500" />
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100">
        {items === null && <div className="p-4 text-xs text-slate-400">Cargando…</div>}
        {items?.length === 0 && <div className="p-4 text-xs text-slate-500">La biblioteca está vacía. Al aprobar un diseño en Diseño 3D, elige "Guardar en la biblioteca".</div>}
        {items && items.length > 0 && vistos.length === 0 && <div className="p-4 text-xs text-slate-500">No hay diseños que coincidan.</div>}
        {vistos.map(d => (
          <div key={d.id} className="px-4 py-3 space-y-2">
            {editando?.id === d.id ? (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_auto] gap-2 items-end">
                <label className="block"><span className="text-xs font-medium text-slate-600 block mb-1">Nombre</span><input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} className={campo} /></label>
                <label className="block"><span className="text-xs font-medium text-slate-600 block mb-1">Nota</span><input value={editando.notas} onChange={e => setEditando({ ...editando, notas: e.target.value })} placeholder="Color, línea, para qué tipo de espacio…" className={campo} /></label>
                <div className="flex gap-2">
                  <button onClick={() => { const e = editando; intentar(async () => { await ajustarBiblioteca(e.id, { nombre: e.nombre.trim() || d.nombre, notas: e.notas.trim() }); setEditando(null); await cargar(); }); }} className="rounded-xl px-3.5 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white">Guardar</button>
                  <button onClick={() => setEditando(null)} className="rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-auto min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{d.nombre}</div>
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-indigo-600">{SECTIONS[d.seccion as SectionId]?.name ?? d.seccion}</span>
                    {resumen(d) ? ` · ${resumen(d)}` : ''} · guardado {fecha(d.created_at)}
                  </div>
                  {d.notas && <div className="text-xs text-slate-500">{d.notas}</div>}
                </div>
                <button onClick={() => onUsar(d.seccion as SectionId, d.datos, d.nombre)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white" title="Abre el diseño y pide el proyecto donde va: se aprueba ahí con sus documentos">Usar en un proyecto</button>
                <button onClick={() => onAbrir(d.seccion as SectionId, d.datos)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700" title="Carga el diseño en Diseño 3D para cambiarlo antes de usarlo">Abrir</button>
                <button onClick={() => setEditando({ id: d.id, nombre: d.nombre, notas: d.notas })} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700">Editar</button>
                <button onClick={() => setConfirmar(d)} className="text-xs font-medium text-rose-600 hover:text-rose-700 px-1">Quitar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
