import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SECTIONS, SectionId } from './sections';
import { VisorDocumento } from './VisorDocumento';
import {
  Documento, DocumentoNuevo, borrarDocumento, enlaceDocumento, listarDocumentos, subirDocumentos,
  DisenoGuardado, Proyecto, ajustarDiseno, alCambiarSesion, borrarDiseno, borrarProyecto, crearProyecto, entrar, guardarDiseno,
  listarDisenos, listarProyectos, nubeConfigurada, registrarse, salir, sesionActual,
} from './nube';

/**
 * Proyectos: la cuenta del usuario y sus proyectos de cliente, cada uno con los diseños guardados (cocina, closet…).
 * "Guardar el diseño actual" sube el diseño que está abierto; "Abrir" lo vuelve a cargar en la app.
 */

/** Producto del proyecto que está abierto en Diseño (ahí se aprueba y se guardan render y fotos) */
export interface ProductoActivo { id: string; nombre: string; proyectoId: string; cliente: string; aprobado?: boolean }

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
  documentos: (nombre: string, cliente: string, nuevo: boolean) => DocumentoNuevo[]; // documentos que genera el diseño abierto
  onProductoActivo: (p: ProductoActivo | null) => void;
  onAbrir: (seccion: SectionId, datos: unknown, producto: ProductoActivo) => void;
}> = ({ seccion, diseñoActual, documentos, onProductoActivo, onAbrir }) => {
  const [docs, setDocs] = useState<Record<string, Documento[] | undefined>>({}); // documentos de cada producto (al desplegarlos)
  const [verDocs, setVerDocs] = useState<string | null>(null);
  // confirmación dentro de la página (las ventanitas del navegador no aparecen en algunos visores, como el panel de la app)
  const [confirmar, setConfirmar] = useState<{ texto: string; accion: () => void } | null>(null);
  const pedir = (texto: string, accion: () => void) => setConfirmar({ texto, accion });
  const [viendo, setViendo] = useState<Documento | null>(null); // documento abierto en el visor (dentro de la app, no en otra pestaña)
  const cargarDocs = async (id: string) => { const l = await listarDocumentos(id); setDocs(x => ({ ...x, [id]: l })); };
  const TIPO_DOC: Record<string, string> = { listado: 'Listado de corte (Excel)', laminas: 'Láminas', planos: 'Planos de ensamble', render: 'Render', foto_ia: 'Foto con IA', boceto: 'Boceto' };
  const [sesion, setSesion] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [disenos, setDisenos] = useState<DisenoGuardado[]>([]);
  const [nuevo, setNuevo] = useState({ cliente: '', nombre: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', ubicacion: '', cantidad: 1 }); // producto que se agrega con el diseño abierto
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
      {viendo && <VisorDocumento doc={viendo} onCerrar={() => setViendo(null)} />}
      {confirmar && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setConfirmar(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-black text-slate-800">{confirmar.texto}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmar(null)} className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700">Cancelar</button>
              <button onClick={() => { const f = confirmar.accion; setConfirmar(null); f(); }} className="rounded-xl px-4 py-2 text-xs font-black bg-rose-600 text-white">Sí, seguir</button>
            </div>
          </div>
        </div>
      )}
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
        {proyecto ? (() => {
          // el proyecto se organiza por producto: cada producto guardado lleva su diseño, dónde va y cuántas unidades
          const porTipo = (Object.keys(SECTIONS) as SectionId[]).map(t => ({ t, items: disenos.filter(d => d.seccion === t) })).filter(g => g.items.length);
          const unidades = disenos.reduce((a, d) => a + (d.cantidad ?? 1), 0);
          const cambiarCant = (d: DisenoGuardado, n: number) => {
            const c = Math.max(1, Math.min(999, Math.round(n) || 1));
            setDisenos(ds => ds.map(x => (x.id === d.id ? { ...x, cantidad: c } : x)));
            intentar(() => ajustarDiseno(d.id, { cantidad: c }));
          };
          return (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <div className="mr-auto">
                <div className="text-sm font-black text-slate-800 uppercase tracking-tight">{proyecto.cliente}{proyecto.nombre ? ` · ${proyecto.nombre}` : ''}</div>
                <div className="text-[11px] font-bold text-slate-400">{disenos.length} {disenos.length === 1 ? 'producto' : 'productos'} · {unidades} {unidades === 1 ? 'unidad' : 'unidades'}</div>
              </div>
              <button onClick={() => { pedir(`¿Borrar el proyecto de ${proyecto.cliente} con todos sus productos? No se puede deshacer.`, () => intentar(async () => { for (const d of disenos) for (const doc of await listarDocumentos(d.id)) await borrarDocumento(doc); await borrarProyecto(proyecto.id); setAbierto(null); await cargar(); setMsg({ ok: `Se borró el proyecto de ${proyecto.cliente}.` }); })); }} className="text-[11px] font-black text-rose-600">Borrar proyecto</button>
            </div>

            {/* resumen por tipo de producto */}
            {porTipo.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {porTipo.map(g => <span key={g.t} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">{SECTIONS[g.t].name} × {g.items.reduce((a, d) => a + (d.cantidad ?? 1), 0)}</span>)}
              </div>
            )}

            {/* agregar el diseño abierto como producto del proyecto */}
            <form className="grid grid-cols-2 md:grid-cols-[1.2fr_1.2fr_90px_auto] gap-2 items-end bg-indigo-50 border border-indigo-100 rounded-xl p-3"
              onSubmit={e => { e.preventDefault(); intentar(async () => {
                const nombre = nuevoProd.nombre.trim() || SECTIONS[seccion].name;
                const d = await guardarDiseno(proyecto.id, seccion, nombre, diseñoActual(), undefined, { cantidad: nuevoProd.cantidad, ubicacion: nuevoProd.ubicacion.trim() });
                // solo se guarda el diseño (y la foto del boceto, si se armó desde uno); los documentos se crean al aprobar el diseño
                await subirDocumentos(d.id, documentos(nombre, proyecto.cliente, true).filter(x => x.tipo === 'boceto'));
                onProductoActivo({ id: d.id, nombre, proyectoId: proyecto.id, cliente: proyecto.cliente });
                setNuevoProd({ nombre: '', ubicacion: '', cantidad: 1 }); setDisenos(await listarDisenos(proyecto.id)); await cargar();
                setMsg({ ok: `Se agregó ${nombre} (${SECTIONS[seccion].name}) × ${nuevoProd.cantidad}. Cuando el diseño esté listo, pulsa "Aprobar diseño" en Diseño para crear sus documentos.` });
              }); }}>
              <div className="col-span-2 md:col-span-4 text-[10px] font-black text-indigo-700 uppercase">Agregar el diseño abierto: {SECTIONS[seccion].name}</div>
              <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nombre</span>
                <input value={nuevoProd.nombre} onChange={e => setNuevoProd(x => ({ ...x, nombre: e.target.value }))} placeholder={SECTIONS[seccion].name} className={campo} /></label>
              <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dónde va</span>
                <input value={nuevoProd.ubicacion} onChange={e => setNuevoProd(x => ({ ...x, ubicacion: e.target.value }))} placeholder="Alcoba principal, apto 301…" className={campo} /></label>
              <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cantidad</span>
                <input type="number" min={1} max={999} value={nuevoProd.cantidad} onChange={e => setNuevoProd(x => ({ ...x, cantidad: Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)) }))} className={campo} /></label>
              <button className="rounded-xl px-4 py-2.5 text-sm font-black bg-indigo-600 text-white">Agregar</button>
            </form>

            {disenos.length === 0 && <div className="text-xs font-bold text-slate-400">Este proyecto aún no tiene productos. Arma uno en Diseño (o en Bosquejo) y agrégalo aquí.</div>}

            {/* productos agrupados por tipo */}
            {porTipo.map(g => (
              <div key={g.t} className="space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase">{SECTIONS[g.t].name}</div>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {g.items.map(d => (
                    <div key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <div className="mr-auto min-w-0">
                        <div className="text-sm font-black text-slate-800 truncate">{d.nombre}</div>
                        <div className="text-[11px] font-bold text-slate-400">{d.ubicacion ? `${d.ubicacion} · ` : ''}actualizado {fecha(d.updated_at)}
                          {' · '}{d.aprobado_at ? <span className="text-emerald-700">aprobado {fecha(d.aprobado_at)}</span> : <span className="text-amber-700">sin aprobar</span>}</div>
                      </div>
                      <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden" title="Cantidad de unidades de este producto">
                        <button onClick={() => cambiarCant(d, (d.cantidad ?? 1) - 1)} className="px-2.5 py-1.5 text-sm font-black text-slate-600 hover:bg-slate-100">−</button>
                        <span className="w-10 text-center text-sm font-black text-slate-800">{d.cantidad ?? 1}</span>
                        <button onClick={() => cambiarCant(d, (d.cantidad ?? 1) + 1)} className="px-2.5 py-1.5 text-sm font-black text-slate-600 hover:bg-slate-100">+</button>
                      </div>
                      <button onClick={() => { setVerDocs(v => (v === d.id ? null : d.id)); if (verDocs !== d.id) intentar(() => cargarDocs(d.id)); }} className={`rounded-xl px-3 py-1.5 text-xs font-black border ${verDocs === d.id ? 'border-indigo-500 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-700'}`}>Documentos</button>
                      <button onClick={() => onAbrir(d.seccion as SectionId, d.datos, { id: d.id, nombre: d.nombre, proyectoId: proyecto.id, cliente: proyecto.cliente, aprobado: !!d.aprobado_at })} className="rounded-xl px-3 py-1.5 text-xs font-black bg-slate-800 text-white">Abrir</button>
                      <button onClick={() => { pedir(`¿Reemplazar el diseño de "${d.nombre}" con el que está abierto (${SECTIONS[seccion].name})? La cantidad y la ubicación se conservan.`, () => intentar(async () => { await guardarDiseno(proyecto.id, seccion, d.nombre, diseñoActual(), d.id); onProductoActivo({ id: d.id, nombre: d.nombre, proyectoId: proyecto.id, cliente: proyecto.cliente }); setDisenos(await listarDisenos(proyecto.id)); setMsg({ ok: `Se actualizó "${d.nombre}". Queda sin aprobar: apruébalo en Diseño para rehacer sus documentos.` }); })); }} className="rounded-xl px-3 py-1.5 text-xs font-black border border-slate-200 text-slate-700">Reemplazar</button>
                      <button onClick={() => { pedir(`¿Quitar "${d.nombre}" del proyecto con sus documentos? No se puede deshacer.`, () => intentar(async () => { for (const doc of await listarDocumentos(d.id)) await borrarDocumento(doc); await borrarDiseno(d.id); setDisenos(await listarDisenos(proyecto.id)); })); }} className="text-[11px] font-black text-rose-600 px-1">Quitar</button>
                      {verDocs === d.id && (
                        <div className="w-full bg-slate-50 rounded-xl p-2 space-y-1">
                          {!docs[d.id] && <div className="text-[11px] font-bold text-slate-400">Cargando…</div>}
                          {docs[d.id]?.length === 0 && <div className="text-[11px] font-bold text-slate-400">Sin documentos. Abre el producto y pulsa "Aprobar diseño" en Diseño para crearlos; el render se guarda desde la pestaña Render.</div>}
                          {docs[d.id]?.map(doc => (
                            <div key={doc.id} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-black text-slate-700 mr-auto">{TIPO_DOC[doc.tipo] ?? doc.tipo} <span className="font-bold text-slate-400">· {doc.nombre} · {Math.max(1, Math.round(doc.bytes / 1024))} KB · {fecha(doc.created_at)}</span></span>
                              <button onClick={() => setViendo(doc)} className="font-black text-indigo-700">Abrir</button>
                              <button onClick={() => intentar(async () => { const a = document.createElement('a'); a.href = await enlaceDocumento(doc, true); a.click(); })} className="font-black text-indigo-700">Descargar</button>
                              <button onClick={() => { pedir(`¿Borrar ${doc.nombre}?`, () => intentar(async () => { await borrarDocumento(doc); await cargarDocs(d.id); })); }} className="font-black text-rose-600">Borrar</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          );
        })() : (
          <div className="text-sm font-bold text-slate-400 p-4">Elige un proyecto o crea uno nuevo.</div>
        )}
      </div>
    </div>
  );
};

/**
 * Aprobar diseño sin producto abierto: se elige el proyecto (o se crea el cliente) y se guarda ahí como producto nuevo.
 * Devuelve el producto para que la app cree sus documentos.
 */
export const DialogoAprobar: React.FC<{ seccion: SectionId; onListo: (p: { proyectoId: string; cliente: string; nombre: string; ubicacion: string; cantidad: number }) => void; onCerrar: () => void }> = ({ seccion, onListo, onCerrar }) => {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [elegido, setElegido] = useState<string>('');
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [prod, setProd] = useState({ nombre: SECTIONS[seccion].name, ubicacion: '', cantidad: 1 });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { sesionActual().then(s => { setSesion(s); if (s) listarProyectos().then(l => { setProyectos(l); setElegido(l[0]?.id ?? ''); }).catch(e => setError(e.message)); }); }, []);
  const continuar = async () => {
    setError(null);
    try {
      let pid = elegido, cliente = proyectos.find(p => p.id === elegido)?.cliente ?? '';
      if (!pid) { if (!nuevoCliente.trim()) { setError('Elige un proyecto o escribe el cliente.'); return; } const p = await crearProyecto(nuevoCliente.trim(), ''); pid = p.id; cliente = p.cliente; }
      onListo({ proyectoId: pid, cliente, nombre: prod.nombre.trim() || SECTIONS[seccion].name, ubicacion: prod.ubicacion.trim(), cantidad: prod.cantidad });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-black text-slate-800 uppercase tracking-tight">Aprobar diseño · {SECTIONS[seccion].name}</div>
        {sesion === undefined && <div className="text-xs font-bold text-slate-400">Cargando…</div>}
        {sesion === null && <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Entra con tu cuenta en la pestaña Proyectos para aprobar y guardar el diseño.</div>}
        {sesion && (<>
          <div className="text-[11px] font-bold text-slate-500">¿En qué proyecto va este producto? Al aprobarlo se guardan el diseño y sus documentos (listado de corte, láminas y planos).</div>
          <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Proyecto</span>
            <select value={elegido} onChange={e => setElegido(e.target.value)} className={campo}>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.cliente}{p.nombre ? ` · ${p.nombre}` : ''}</option>)}
              <option value="">+ Cliente nuevo</option>
            </select></label>
          {!elegido && <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cliente</span><input value={nuevoCliente} onChange={e => setNuevoCliente(e.target.value)} className={campo} /></label>}
          <div className="grid grid-cols-[1fr_1fr_80px] gap-2">
            <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nombre</span><input value={prod.nombre} onChange={e => setProd(x => ({ ...x, nombre: e.target.value }))} className={campo} /></label>
            <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dónde va</span><input value={prod.ubicacion} onChange={e => setProd(x => ({ ...x, ubicacion: e.target.value }))} className={campo} /></label>
            <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cantidad</span><input type="number" min={1} max={999} value={prod.cantidad} onChange={e => setProd(x => ({ ...x, cantidad: Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)) }))} className={campo} /></label>
          </div>
        </>)}
        {error && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700">Cancelar</button>
          {sesion && <button onClick={continuar} className="rounded-xl px-4 py-2 text-xs font-black bg-emerald-600 text-white">Aprobar y crear documentos</button>}
        </div>
      </div>
    </div>
  );
};
