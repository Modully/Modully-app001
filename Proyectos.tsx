import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SECTIONS, SectionId } from './sections';
import {
  DisenoGuardado, Proyecto, alCambiarSesion, borrarDiseno, borrarProyecto, crearProyecto, entrar, guardarDiseno,
  listarDisenos, listarProyectos, nubeConfigurada, registrarse, salir, sesionActual,
} from './nube';

/**
 * Proyectos: la cuenta del usuario y sus proyectos de cliente, cada uno con los diseños guardados (cocina, closet…).
 * "Guardar el diseño actual" sube el diseño que está abierto; "Abrir" lo vuelve a cargar en la app.
 */

const campo = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800';
const fecha = (s: string) => new Date(s).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const Acceso: React.FC = () => {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [correo, setCorreo] = useState(''); const [clave, setClave] = useState(''); const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState<{ cargando?: boolean; error?: string; aviso?: string }>({});
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setEstado({ cargando: true });
    try {
      if (modo === 'entrar') { await entrar(correo, clave); setEstado({}); }
      else {
        const conSesion = await registrarse(correo, clave, nombre);
        setEstado(conSesion ? {} : { aviso: 'Cuenta creada. Te llegó un correo de Supabase: abre el enlace para confirmarla y después entra aquí.' });
        if (!conSesion) setModo('entrar');
      }
    } catch (err) { setEstado({ error: err instanceof Error ? err.message : String(err) }); }
  };
  return (
    <form onSubmit={enviar} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 max-w-md">
      <div className="flex gap-2">
        {(['entrar', 'crear'] as const).map(m => (
          <button type="button" key={m} onClick={() => { setModo(m); setEstado({}); }} className={`flex-1 rounded-xl px-3 py-2 text-xs font-black border ${modo === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </button>
        ))}
      </div>
      {modo === 'crear' && <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nombre o empresa</span><input value={nombre} onChange={e => setNombre(e.target.value)} className={campo} autoComplete="organization" /></label>}
      <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Correo</span><input type="email" required value={correo} onChange={e => setCorreo(e.target.value)} className={campo} autoComplete="email" /></label>
      <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Contraseña</span><input type="password" required minLength={6} value={clave} onChange={e => setClave(e.target.value)} className={campo} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></label>
      {estado.error && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{estado.error}</div>}
      {estado.aviso && <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{estado.aviso}</div>}
      <button disabled={estado.cargando} className="w-full rounded-xl px-4 py-2.5 text-sm font-black bg-indigo-600 text-white disabled:opacity-50">{estado.cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
  );
};

export const Proyectos: React.FC<{
  seccion: SectionId;                       // producto abierto en la app
  diseñoActual: () => unknown;              // el diseño que está abierto (para guardarlo)
  onAbrir: (seccion: SectionId, datos: unknown) => void;
}> = ({ seccion, diseñoActual, onAbrir }) => {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [disenos, setDisenos] = useState<DisenoGuardado[]>([]);
  const [nuevo, setNuevo] = useState({ cliente: '', nombre: '' });
  const [nombreDiseno, setNombreDiseno] = useState('');
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  useEffect(() => { sesionActual().then(s => { setSesion(s); setListo(true); }); return alCambiarSesion(setSesion); }, []);
  const cargar = async () => { try { setProyectos(await listarProyectos()); } catch (e) { setMsg({ error: e instanceof Error ? e.message : String(e) }); } };
  useEffect(() => { if (sesion) cargar(); else { setProyectos([]); setAbierto(null); } }, [sesion?.user.id]);
  useEffect(() => { if (abierto) listarDisenos(abierto).then(setDisenos).catch(e => setMsg({ error: e.message })); else setDisenos([]); }, [abierto]);
  const intentar = async (f: () => Promise<void>) => { setMsg({}); try { await f(); } catch (e) { setMsg({ error: e instanceof Error ? e.message : String(e) }); } };

  if (!nubeConfigurada) return <div className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-4">Falta configurar Supabase en el archivo .env.local.</div>;
  if (!listo) return <div className="text-sm font-bold text-slate-400">Cargando…</div>;
  if (!sesion) return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-500 max-w-md">Entra con tu cuenta para guardar tus diseños por proyecto y abrirlos desde cualquier computador.</p>
      <Acceso />
    </div>
  );

  const proyecto = proyectos.find(p => p.id === abierto);
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        <span>Sesión: <span className="text-slate-800">{sesion.user.email}</span></span>
        <button onClick={() => salir()} className="rounded-xl px-3 py-1.5 border border-slate-200 text-slate-600 font-black">Salir</button>
      </div>
      {msg.error && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{msg.error}</div>}
      {msg.ok && <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{msg.ok}</div>}

      {/* nuevo proyecto */}
      <form className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end"
        onSubmit={e => { e.preventDefault(); intentar(async () => { const p = await crearProyecto(nuevo.cliente.trim(), nuevo.nombre.trim()); setNuevo({ cliente: '', nombre: '' }); await cargar(); setAbierto(p.id); }); }}>
        <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cliente</span><input required value={nuevo.cliente} onChange={e => setNuevo(n => ({ ...n, cliente: e.target.value }))} className={campo} /></label>
        <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Proyecto u obra</span><input value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} placeholder="Apto 301, casa campestre…" className={campo} /></label>
        <button className="rounded-xl px-4 py-2.5 text-sm font-black bg-indigo-600 text-white">Nuevo proyecto</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* lista de proyectos */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 self-start">
          {proyectos.length === 0 && <div className="p-4 text-xs font-bold text-slate-400">Aún no tienes proyectos.</div>}
          {proyectos.map(p => (
            <button key={p.id} onClick={() => setAbierto(p.id)} className={`w-full text-left px-4 py-3 ${p.id === abierto ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-slate-700'}`}>
              <div className="text-sm font-black truncate">{p.cliente || 'Sin cliente'}</div>
              <div className={`text-[11px] font-bold truncate ${p.id === abierto ? 'text-indigo-100' : 'text-slate-400'}`}>{p.nombre || 'Sin nombre'} · {fecha(p.updated_at)}</div>
            </button>
          ))}
        </div>

        {/* diseños del proyecto */}
        {proyecto ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="text-sm font-black text-slate-800 uppercase tracking-tight mr-auto">{proyecto.cliente}{proyecto.nombre ? ` · ${proyecto.nombre}` : ''}</div>
              <button onClick={() => { if (window.confirm(`¿Borrar el proyecto de ${proyecto.cliente} con todos sus diseños? No se puede deshacer.`)) intentar(async () => { await borrarProyecto(proyecto.id); setAbierto(null); await cargar(); }); }} className="text-[11px] font-black text-rose-600">Borrar proyecto</button>
            </div>
            <form className="flex flex-wrap items-end gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3"
              onSubmit={e => { e.preventDefault(); intentar(async () => {
                await guardarDiseno(proyecto.id, seccion, nombreDiseno.trim() || SECTIONS[seccion].name, diseñoActual());
                setNombreDiseno(''); setDisenos(await listarDisenos(proyecto.id)); await cargar(); setMsg({ ok: `Se guardó el diseño de ${SECTIONS[seccion].name}.` });
              }); }}>
              <label className="block flex-1 min-w-[180px]"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Guardar el diseño abierto ({SECTIONS[seccion].name})</span>
                <input value={nombreDiseno} onChange={e => setNombreDiseno(e.target.value)} placeholder={SECTIONS[seccion].name} className={campo} /></label>
              <button className="rounded-xl px-4 py-2.5 text-sm font-black bg-indigo-600 text-white">Guardar</button>
            </form>
            {disenos.length === 0 && <div className="text-xs font-bold text-slate-400">Este proyecto aún no tiene diseños.</div>}
            <div className="divide-y divide-slate-100">
              {disenos.map(d => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="mr-auto min-w-0">
                    <div className="text-sm font-black text-slate-800 truncate">{d.nombre}</div>
                    <div className="text-[11px] font-bold text-slate-400">{SECTIONS[d.seccion as SectionId]?.name ?? d.seccion} · {fecha(d.updated_at)}</div>
                  </div>
                  <button onClick={() => onAbrir(d.seccion as SectionId, d.datos)} className="rounded-xl px-3 py-1.5 text-xs font-black bg-slate-800 text-white">Abrir</button>
                  <button onClick={() => { if (window.confirm(`¿Reemplazar "${d.nombre}" con el diseño abierto (${SECTIONS[seccion].name})?`)) intentar(async () => { await guardarDiseno(proyecto.id, seccion, d.nombre, diseñoActual(), d.id); setDisenos(await listarDisenos(proyecto.id)); setMsg({ ok: `Se actualizó "${d.nombre}".` }); }); }} className="rounded-xl px-3 py-1.5 text-xs font-black border border-slate-200 text-slate-700">Reemplazar</button>
                  <button onClick={() => { if (window.confirm(`¿Borrar el diseño "${d.nombre}"? No se puede deshacer.`)) intentar(async () => { await borrarDiseno(d.id); setDisenos(await listarDisenos(proyecto.id)); }); }} className="text-[11px] font-black text-rose-600 px-1">Borrar</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm font-bold text-slate-400 p-4">Elige un proyecto o crea uno nuevo.</div>
        )}
      </div>
    </div>
  );
};
