import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Box } from './boxes';
import type { ContextoPiezas, ListaPiezas } from './piezas';
import { COSTOS_INICIALES, ClaveHerraje, ModuloCosteo, NOMBRES_HERRAJE, TablaCostos, completarCostos, costear, pesos, precioDe, recargoDe } from './costos';
import { Condiciones, EMPRESA_INICIAL, Empresa, completarEmpresa, htmlCotizacion } from './cotizacion';
import { guardarPerfilCostos, leerPerfilCostos, nubeConfigurada, sesionActual } from './nube';

/**
 * Pestaña Precios: costeo del diseño abierto con la tabla de costos del usuario, la tabla misma ("Mis costos") y la
 * cotización para el cliente. La tabla y los datos de la empresa se guardan en la cuenta (o en este equipo sin sesión).
 */

const CLAVE_LOCAL = 'modully.costos.v1';
const campo = 'w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500';
const titulo = 'text-xs font-semibold tracking-tight text-slate-900';
const pct = (f: number) => (f * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** Número que se escribe con libertad y se aplica al salir del campo o con Enter */
const Num: React.FC<{ value: number; onChange: (n: number) => void; step?: number; className?: string; sufijo?: string; aria?: string }> = ({ value, onChange, step, className, sufijo, aria }) => {
  const [t, setT] = useState(String(value));
  useEffect(() => setT(String(value).replace('.', ',')), [value]);
  const aplicar = () => {
    const s = t.trim();
    const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : /^\d{1,3}(\.\d{3})+$/.test(s) ? parseFloat(s.replace(/\./g, '')) : parseFloat(s);
    if (!isNaN(n) && n !== value) onChange(n); else setT(String(value).replace('.', ','));
  };
  return (
    <span className="relative block">
      <input inputMode="decimal" aria-label={aria} value={t} step={step} onFocus={e => e.currentTarget.select()} onChange={e => setT(e.target.value)} onBlur={aplicar}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={`${campo} text-right ${sufijo ? 'pr-7' : ''} ${className ?? ''}`} />
      {sufijo && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{sufijo}</span>}
    </span>
  );
};

export interface ProductoCotizacion { cliente: string; proyecto: string; producto: string; descripcion: string }

export const Precios: React.FC<{
  boxes: Box[];
  ctx: ContextoPiezas;
  lista: ListaPiezas;
  modulos: ModuloCosteo[];
  nombreResto: string;                 // nombre de lo que no es un módulo: "Zócalo, rellenos y mesón", "Closet"…
  datos: ProductoCotizacion;           // cliente, proyecto y producto de lo que está abierto
  onGuardarCotizacion?: (archivo: Blob, nombre: string) => Promise<void>; // guardarla en el producto del proyecto
  onContinuarEntregables?: () => void; // pasa al Paso 4 (Entregables)
}> = ({ boxes, ctx, lista, modulos, nombreResto, datos, onGuardarCotizacion, onContinuarEntregables }) => {
  const [vista, setVista] = useState<'costeo' | 'costos' | 'cotizacion'>('costeo');
  const [tabla, setTabla] = useState<TablaCostos>(COSTOS_INICIALES);
  const [empresa, setEmpresa] = useState<Empresa>(EMPRESA_INICIAL);
  const [cargado, setCargado] = useState(false);
  const [enNube, setEnNube] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState<string | null>(null);

  // cargar: de la cuenta si hay sesión; si no, de este equipo
  useEffect(() => {
    let vivo = true;
    (async () => {
      let costos: unknown, emp: unknown;
      try { const l = JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? 'null'); costos = l?.costos; emp = l?.empresa; } catch { /* sin almacenamiento */ }
      try {
        if (nubeConfigurada && (await sesionActual())) {
          const r = await leerPerfilCostos();
          if (vivo) setEnNube(true);
          if (r) { costos = r.costos; emp = r.empresa; }
        }
      } catch { /* sin conexión: queda lo de este equipo */ }
      if (!vivo) return;
      setTabla(completarCostos(costos)); setEmpresa(completarEmpresa(emp)); setCargado(true);
    })();
    return () => { vivo = false; };
  }, []);
  // guardar al cambiar (con una pausa para no guardar en cada tecla)
  const primera = useRef(true);
  useEffect(() => {
    if (!cargado) return;
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(async () => {
      try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify({ costos: tabla, empresa })); } catch { /* sin almacenamiento */ }
      if (enNube) {
        try { await guardarPerfilCostos(tabla, empresa); setEstadoGuardado('Guardado en tu cuenta'); }
        catch (e) { setEstadoGuardado(`No se pudo guardar en la cuenta: ${e instanceof Error ? e.message : String(e)}`); }
      } else setEstadoGuardado('Guardado en este equipo (entra con tu cuenta para tenerlo en todos)');
    }, 800);
    return () => clearTimeout(t);
  }, [tabla, empresa, cargado, enNube]);

  // siempre completa: una tabla guardada antes (con recargo sobre el costo) se pasa a la ganancia sobre el precio
  const tablaOk = useMemo(() => completarCostos(tabla), [tabla]);
  const costeo = useMemo(() => (cargado ? costear(boxes, ctx, lista, modulos, tablaOk, nombreResto) : null), [boxes, ctx, lista, modulos, tablaOk, nombreResto, cargado]);
  const setT = (p: Partial<TablaCostos>) => setTabla(t => ({ ...completarCostos(t), ...p }));

  if (!cargado || !costeo) return <div className="text-sm font-bold text-slate-400">Cargando tus costos…</div>;
  const sinPiezas = lista.piezas.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['costeo', 'Costeo'], ['costos', 'Mis costos'], ['cotizacion', 'Cotización']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} className={`rounded-xl px-4 py-2 text-xs border transition-colors ${vista === k ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium'}`}>{l}</button>
        ))}
        {estadoGuardado && <span className="self-center text-xs text-slate-500 ml-1">{estadoGuardado}</span>}
      </div>

      {costeo.faltan.length > 0 && !sinPiezas && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>Faltan precios para este diseño ({costeo.faltan.join(' · ')}). Se calculan en $0.</span>
          {vista !== 'costos' && <button onClick={() => setVista('costos')} className="font-semibold text-amber-900 underline shrink-0">Completar en Mis costos</button>}
        </div>
      )}

      {vista === 'costeo' && (sinPiezas ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 text-sm text-slate-500">Para costear, convierte el diseño a módulos en Diseño 3D: el costo sale de sus piezas reales.</div>
      ) : <VistaCosteo costeo={costeo} ganancia={tablaOk.ganancia} onGanancia={g => setT({ ganancia: g })} onContinuarEntregables={onContinuarEntregables} />)}

      {vista === 'costos' && <VistaCostos tabla={tablaOk} setT={setT} setTabla={setTabla} empresa={empresa} setEmpresa={setEmpresa} />}

      {vista === 'cotizacion' && (sinPiezas ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 text-sm text-slate-500">Convierte el diseño a módulos para armar la cotización.</div>
      ) : <VistaCotizacion costeo={costeo} empresa={empresa} datos={datos} onGuardar={onGuardarCotizacion} />)}
    </div>
  );
};

/* ---------------- Costeo ---------------- */
const VistaCosteo: React.FC<{ costeo: ReturnType<typeof costear>; ganancia: number; onGanancia: (g: number) => void; onContinuarEntregables?: () => void }> = ({ costeo, ganancia, onGanancia, onContinuarEntregables }) => {
  const [abierto, setAbierto] = useState<string | null>(null);
  const t = costeo.totales;
  const margenPct = pct(t.precio > 0 ? t.ganancia / t.precio : 0);
  const partes = ([['Lámina', t.material, '#6366f1'], ['Canto', t.canto, '#a78bfa'], ['Herrajes', t.herraje, '#0ea5e9'], ['Mesón', t.meson, '#14b8a6'], ['Corte', t.corte, '#94a3b8'], ['Fabricación', t.fabricacion, '#f59e0b'], ['Instalación', t.instalacion, '#f97316']] as [string, number, string][]).filter(p => p[1] > 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className={titulo}>Nos cuesta</div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900 mt-1.5">{pesos(t.costo)}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={titulo}>Precio de venta</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Margen {margenPct} %
              </span>
            </div>
            <div className="text-3xl font-semibold tracking-tight text-slate-900 mt-1.5">{pesos(t.precio)}</div>
          </div>
          {onContinuarEntregables && (
            <button
              type="button"
              onClick={onContinuarEntregables}
              className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-sm"
            >
              Continuar a Entregables →
            </button>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className={titulo}>Ganancia</div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-700 mt-1.5">{pesos(t.ganancia)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Equivale a +{pct(t.costo > 0 ? t.ganancia / t.costo : 0)} % sobre el costo</div>
          <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-600">Margen deseado <span className="w-20"><Num value={Math.round(ganancia * 1000) / 10} onChange={n => onGanancia(Math.min(95, Math.max(0, n)) / 100)} sufijo="%" aria="Ganancia sobre el precio de venta" /></span></label>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 space-y-2.5">
        <div className={titulo}>De dónde sale el costo</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">{partes.map(([n, v, c]) => <div key={n} style={{ width: `${(v / (t.costo || 1)) * 100}%`, background: c }} title={`${n}: ${pesos(v)}`} />)}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{partes.map(([n, v, c]) => <span key={n} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{n} {pesos(v)} · {Math.round((v / (t.costo || 1)) * 100)} %</span>)}</div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 space-y-2.5">
        <div className={titulo}>Láminas reales (del optimizador)</div>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-xs font-medium text-slate-500"><th className="py-1.5">Material</th><th>Precio usado</th><th className="text-right">Láminas</th><th className="text-right">Aprovechamiento</th><th className="text-right">Costo</th></tr></thead>
          <tbody>{costeo.materiales.map(m => (
            <tr key={m.material} className="border-t border-slate-100 font-medium text-slate-700">
              <td className="py-2">{m.material}</td>
              <td className={m.lamina?.precio ? '' : 'text-amber-700'}>{m.lamina ? `${m.lamina.nombre} ${String(m.lamina.cal).replace('.', ',')} · ${pesos(m.lamina.precio)}` : 'sin precio'}</td>
              <td className="text-right">{m.laminas}</td><td className="text-right">{Math.round(m.uso * 100)} %</td><td className="text-right font-semibold text-slate-900">{pesos(m.costo)}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="text-xs text-slate-500">El costo de cada lámina se reparte entre sus piezas según su área: el desperdicio ya va incluido en cada pieza.</p>
      </div>

      <Unitarios costeo={costeo} ganancia={ganancia} />

      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-baseline justify-between"><span className={titulo}>Por módulo</span><span className="text-xs text-slate-400">Toca uno para ver sus piezas</span></div>
        <div className="divide-y divide-slate-100">
          {costeo.grupos.map(g => (
            <div key={g.id}>
              <button onClick={() => setAbierto(a => (a === g.id ? null : g.id))} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-wrap items-center gap-x-4 gap-y-1 transition-colors">
                <span className="mr-auto min-w-0"><span className="text-sm font-semibold text-slate-900">{g.nombre}</span>{g.detalle && <span className="ml-2 text-xs text-slate-400">{g.detalle}</span>}</span>
                <span className="text-xs text-slate-500">costo {pesos(g.costo)}</span>
                <span className="text-sm font-semibold text-indigo-600">{pesos(g.precio)}</span>
              </button>
              {abierto === g.id && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
                    <span>Lámina {pesos(g.material)}</span><span>Canto {pesos(g.canto)}</span><span>Herrajes {pesos(g.herraje)}</span>
                    {g.meson > 0 && <span>Mesón {pesos(g.meson)}</span>}{g.fabricacion > 0 && <span>Fabricación {pesos(g.fabricacion)}</span>}{g.instalacion > 0 && <span>Instalación {pesos(g.instalacion)}</span>}
                  </div>
                  <div className="overflow-x-auto"><table className="w-full text-[11px]">
                    <thead><tr className="text-left text-[9px] uppercase text-slate-400"><th className="py-1">Pieza</th><th className="text-right">Cant.</th><th className="text-right">Medidas</th><th>Material</th><th>Canto</th><th className="text-right">Lámina</th><th className="text-right">Canto</th><th className="text-right">Total</th></tr></thead>
                    <tbody>{g.piezas.map((c, i) => (
                      <tr key={i} className="border-t border-slate-100 font-bold text-slate-700">
                        <td className="py-1">{c.pieza.name}</td><td className="text-right">{c.pieza.quantity}</td><td className="text-right whitespace-nowrap">{c.pieza.length} × {c.pieza.width}</td>
                        <td className="whitespace-nowrap">{c.pieza.color} · {c.pieza.thickness}</td><td>{c.pieza.edgeType}</td>
                        <td className="text-right">{pesos(c.material)}</td><td className="text-right">{pesos(c.canto)}</td><td className="text-right">{pesos(c.total)}</td>
                      </tr>
                    ))}
                    {g.herrajes.map(h => (
                      <tr key={h.clave} className="border-t border-slate-100 font-bold text-sky-800">
                        <td className="py-1" colSpan={2}>{NOMBRES_HERRAJE[h.clave].nombre}</td><td className="text-right">{h.clave === 'tubo' || h.clave === 'gola' || h.clave === 'zocaloAl' ? `${h.cant.toFixed(2).replace('.', ',')} m` : h.cant}</td>
                        <td colSpan={3} className="text-slate-400">{pesos(h.precio)} c/u</td><td /><td className="text-right">{pesos(h.total)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Costo y precio por metro lineal de aéreos y bajos (y del mesón), o por m² de frente cuando no hay módulos de cocina (closets) */
const Unitarios: React.FC<{ costeo: ReturnType<typeof costear>; ganancia: number }> = ({ costeo, ganancia }) => {
  const fila = (nombre: string, medida: string, unidad: string, costo: number, cant: number) => ({ nombre, medida, unidad, costo: cant > 0 ? costo / cant : 0, precio: cant > 0 ? precioDe(costo, ganancia) / cant : 0 });
  const filas: ReturnType<typeof fila>[] = [];
  const suma = (tipo: string) => { const gs = costeo.grupos.filter(g => g.tipo === tipo); return { costo: gs.reduce((a, g) => a + g.costo, 0), m: gs.reduce((a, g) => a + g.ancho, 0) / 1000, n: gs.length }; };
  const ma = suma('MA'), mb = suma('MB'), alto = suma('alto');
  // zócalo y rellenos (lo que queda en el grupo del resto fuera del mesón) se cargan al metro de los bajos
  const resto = costeo.grupos.find(g => g.id === '__resto');
  if (mb.n && resto) mb.costo += Math.max(0, resto.costo - resto.meson);
  const coma = (n: number) => n.toFixed(2).replace('.', ',');
  if (mb.n) filas.push(fila('Muebles bajos', `${coma(mb.m)} m`, 'm lineal', mb.costo, mb.m));
  if (ma.n) filas.push(fila('Muebles altos', `${coma(ma.m)} m`, 'm lineal', ma.costo, ma.m));
  if (alto.n) filas.push(fila('Muebles altos', `${alto.n} ${alto.n === 1 ? 'unidad' : 'unidades'}`, 'unidad', alto.costo, alto.n));
  const mesonMl = costeo.grupos.reduce((a, g) => a + g.mesonMl, 0);
  if (mesonMl > 0) filas.push(fila('Mesón', `${coma(mesonMl)} m`, 'm lineal', costeo.totales.meson, mesonMl));
  if (!ma.n && !mb.n && !alto.n && costeo.frente.m2 > 0) {
    filas.push(fila('Mueble completo (frente)', `${Math.round(costeo.frente.ancho)} × ${Math.round(costeo.frente.alto)} mm = ${coma(costeo.frente.m2)} m²`, 'm²', costeo.totales.costo, costeo.frente.m2));
  }
  if (!filas.length) return null;
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
      <div className={titulo}>Costo por metro lineal y m²</div>
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase text-slate-400"><th className="py-1">Mueble</th><th>Medida</th><th className="text-right">Costo</th><th className="text-right">Precio</th></tr></thead>
        <tbody>{filas.map(f => (
          <tr key={f.nombre} className="border-t border-slate-100 font-bold text-slate-700">
            <td className="py-1.5">{f.nombre}</td><td className="text-slate-500">{f.medida}</td>
            <td className="text-right whitespace-nowrap">{pesos(f.costo)} <span className="text-slate-400 font-bold">/ {f.unidad}</span></td>
            <td className="text-right whitespace-nowrap text-indigo-700">{pesos(f.precio)} <span className="text-slate-400 font-bold">/ {f.unidad}</span></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="text-[10px] font-bold text-slate-400">Cada metro incluye lámina, canto, herrajes, fabricación e instalación de esos módulos (los bajos, también el zócalo y los rellenos); el mesón va aparte. Sirve para dar un precio rápido de otra cocina o closet parecido.</p>
    </div>
  );
};

/* ---------------- Mis costos ---------------- */
const VistaCostos: React.FC<{ tabla: TablaCostos; setT: (p: Partial<TablaCostos>) => void; setTabla: React.Dispatch<React.SetStateAction<TablaCostos>>; empresa: Empresa; setEmpresa: React.Dispatch<React.SetStateAction<Empresa>> }> = ({ tabla, setT, setTabla, empresa, setEmpresa }) => {
  const tarjeta = 'rounded-2xl bg-white border border-slate-200 p-4 space-y-3';
  const setLam = (id: string, p: Partial<TablaCostos['laminas'][number]>) => setTabla(t => ({ ...t, laminas: t.laminas.map(l => (l.id === id ? { ...l, ...p } : l)) }));
  const setEmp = (p: Partial<Empresa>) => setEmpresa(e => ({ ...e, ...p }));
  const setCond = (k: keyof Condiciones, v: string) => setEmpresa(e => ({ ...e, condiciones: { ...e.condiciones, [k]: v } }));
  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className={titulo}>Láminas</div>
        <p className="text-[11px] font-bold text-slate-500">Precio por lámina completa. "Blanco" y "Otros colores" valen para cualquier color de ese calibre; agrega un renglón con el nombre exacto (Humo, Ámbar…) si ese color tiene otro precio.</p>
        <div className="space-y-2">
          {tabla.laminas.map(l => (
            <div key={l.id} className="flex flex-wrap gap-2 items-center pb-2 border-b border-slate-100 last:border-0">
              <span className="flex-1 min-w-[130px]"><input value={l.nombre} onChange={e => setLam(l.id, { nombre: e.target.value })} className={campo} aria-label="Color" placeholder="Color" /></span>
              <span className="w-20"><Num value={l.cal} onChange={n => setLam(l.id, { cal: n })} sufijo="mm" aria="Calibre" /></span>
              <span className="flex items-center gap-1"><span className="w-[68px]"><Num value={l.largo} onChange={n => setLam(l.id, { largo: n })} aria="Largo de la lámina" /></span><span className="text-slate-400 text-xs">×</span><span className="w-[68px]"><Num value={l.ancho} onChange={n => setLam(l.id, { ancho: n })} aria="Ancho de la lámina" /></span></span>
              <span className="w-28"><Num value={l.precio} onChange={n => setLam(l.id, { precio: n })} className={l.precio ? '' : 'border-amber-300 bg-amber-50'} aria="Precio de la lámina" /></span>
              <button onClick={() => setTabla(t => ({ ...t, laminas: t.laminas.filter(x => x.id !== l.id) }))} className="text-[11px] font-black text-rose-600 px-1" aria-label="Quitar lámina">✕</button>
            </div>
          ))}
          <button onClick={() => setTabla(t => ({ ...t, laminas: [...t.laminas, { id: Math.random().toString(36).slice(2, 8), nombre: '', cal: 15, largo: 2440, ancho: 1830, precio: 0 }] }))} className="rounded-lg px-3 py-1.5 text-[11px] font-black border border-slate-200 text-slate-700">+ Agregar lámina</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={tarjeta}>
          <div className={titulo}>Canto (por metro)</div>
          {tabla.cantos.map(c => (
            <label key={c.id} className="grid grid-cols-[1fr_120px] gap-2 items-center text-xs font-bold text-slate-600">
              <span>{c.tipo} {c.rigido ? 'rígido' : 'flexible'}</span>
              <Num value={c.precioMetro} onChange={n => setTabla(t => ({ ...t, cantos: t.cantos.map(x => (x.id === c.id ? { ...x, precioMetro: n } : x)) }))} className={c.precioMetro ? '' : 'border-amber-300 bg-amber-50'} />
            </label>
          ))}
        </div>
        <div className={tarjeta}>
          <div className={titulo}>Herrajes</div>
          {(Object.keys(NOMBRES_HERRAJE) as ClaveHerraje[]).map(k => (
            <label key={k} className="grid grid-cols-[1fr_120px] gap-2 items-center text-xs font-bold text-slate-600">
              <span>{NOMBRES_HERRAJE[k].nombre} <span className="text-slate-400">· por {NOMBRES_HERRAJE[k].unidad}</span></span>
              <Num value={tabla.herrajes[k]} onChange={n => setT({ herrajes: { ...tabla.herrajes, [k]: n } })} />
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={tarjeta}>
          <div className={titulo}>Mesón y corte</div>
          <label className="grid grid-cols-[1fr_120px] gap-2 items-center text-xs font-bold text-slate-600"><span>Mesón por metro lineal (con salpicadero)</span><Num value={tabla.mesonMl} onChange={n => setT({ mesonMl: n })} /></label>
          <label className="grid grid-cols-[1fr_120px] gap-2 items-center text-xs font-bold text-slate-600"><span>Corte por lámina (si se cobra aparte)</span><Num value={tabla.corteLamina} onChange={n => setT({ corteLamina: n })} /></label>
        </div>
        <div className={tarjeta}>
          <div className={titulo}>Mano de obra por módulo</div>
          <div className="grid grid-cols-[1fr_100px_100px] gap-2 text-[10px] font-black text-slate-400 uppercase"><span /><span className="text-right">Fabricación</span><span className="text-right">Instalación</span></div>
          {([['MA', 'Muebles altos'], ['MB', 'Muebles bajos'], ['alto', 'Alto (torre, alacena)'], ['otro', 'Otro']] as const).map(([k, l]) => (
            <div key={k} className="grid grid-cols-[1fr_100px_100px] gap-2 items-center text-xs font-bold text-slate-600">
              <span>{l}</span>
              <Num value={tabla.fabricacion[k]} onChange={n => setT({ fabricacion: { ...tabla.fabricacion, [k]: n } })} />
              <Num value={tabla.instalacion[k]} onChange={n => setT({ instalacion: { ...tabla.instalacion, [k]: n } })} />
            </div>
          ))}
        </div>
      </div>

      <div className={tarjeta}>
        <div className={titulo}>Precio de venta</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs font-bold text-slate-600 space-y-1 block col-span-2"><span>Ganancia sobre el precio de venta</span><Num value={Math.round(tabla.ganancia * 1000) / 10} onChange={n => setT({ ganancia: Math.min(95, Math.max(0, n)) / 100 })} sufijo="%" />
            <span className="block text-[10px] text-slate-400">Es la ganancia real: de cada $100 que cobras te quedan ${(tabla.ganancia * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}. Equivale a +{(recargoDe(tabla.ganancia) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} % sobre el costo.</span></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Redondear a</span><Num value={tabla.redondeo} onChange={n => setT({ redondeo: Math.max(0, n) })} /></label>
        </div>
      </div>

      <div className={tarjeta}>
        <div className={titulo}>Tu empresa (sale en la cotización)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {([['nombre', 'Nombre o razón social'], ['nit', 'NIT'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['ciudad', 'Ciudad']] as const).map(([k, l]) => (
            <label key={k} className="text-xs font-bold text-slate-600 space-y-1 block"><span>{l}</span><input value={empresa[k]} onChange={e => setEmp({ [k]: e.target.value })} className={campo} /></label>
          ))}
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Anticipo</span><Num value={empresa.anticipo} onChange={n => setEmp({ anticipo: Math.max(0, Math.min(100, Math.round(n))) })} sufijo="%" /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Vigencia de la cotización</span><Num value={empresa.vigenciaDias} onChange={n => setEmp({ vigenciaDias: Math.max(1, Math.round(n)) })} sufijo="días" /></label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([['entrega', 'Entrega'], ['noIncluye', 'No incluye'], ['garantia', 'Garantía'], ['notas', 'Notas']] as const).map(([k, l]) => (
            <label key={k} className="text-xs font-bold text-slate-600 space-y-1 block"><span>{l} <span className="text-slate-400">· un renglón por punto</span></span>
              <textarea rows={3} value={empresa.condiciones[k]} onChange={e => setCond(k, e.target.value)} className={`${campo} font-medium`} /></label>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------------- Cotización ---------------- */
const VistaCotizacion: React.FC<{ costeo: ReturnType<typeof costear>; empresa: Empresa; datos: ProductoCotizacion; onGuardar?: (archivo: Blob, nombre: string) => Promise<void> }> = ({ costeo, empresa, datos, onGuardar }) => {
  const [cliente, setCliente] = useState(datos.cliente);
  const [proyecto, setProyecto] = useState(datos.proyecto);
  const [producto, setProducto] = useState(datos.producto);
  const [descripcion, setDescripcion] = useState(datos.descripcion);
  const [cantidad, setCantidad] = useState(1);
  const [detalle, setDetalle] = useState<'mueble' | 'modulo'>('mueble');
  const [aviso, setAviso] = useState<string | null>(null);
  const [fecha] = useState(() => new Date());
  const numero = useMemo(() => { const p = (n: number) => String(n).padStart(2, '0'); return `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${p(fecha.getHours())}${p(fecha.getMinutes())}`; }, [fecha]);
  const html = useMemo(() => htmlCotizacion({ numero, fecha, cliente, proyecto, producto, descripcion, cantidad, detalle, costeo, empresa }), [numero, fecha, cliente, proyecto, producto, descripcion, cantidad, detalle, costeo, empresa]);
  const marco = useRef<HTMLIFrameElement>(null);
  const nombreArchivo = `Cotizacion_${numero}_${(cliente || 'cliente').replace(/[^\wáéíóúñÁÉÍÓÚÑ-]+/g, '_')}.html`;
  const descargar = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = nombreArchivo; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Cliente</span><input value={cliente} onChange={e => setCliente(e.target.value)} className={campo} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Proyecto</span><input value={proyecto} onChange={e => setProyecto(e.target.value)} className={campo} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Producto</span><input value={producto} onChange={e => setProducto(e.target.value)} className={campo} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Descripción</span><input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={campo} /></label>
          <label className="text-xs font-bold text-slate-600 space-y-1 block"><span>Cantidad</span><Num value={cantidad} onChange={n => setCantidad(Math.max(1, Math.round(n)))} /></label>
          <div className="text-xs font-bold text-slate-600 space-y-1"><span>Detalle para el cliente</span>
            <div className="grid grid-cols-2 gap-1">{([['mueble', 'Mueble completo'], ['modulo', 'Por módulo']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDetalle(k)} className={`rounded-lg py-1.5 text-[11px] font-black border ${detalle === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
            ))}</div>
          </div>
        </div>
        {!empresa.nombre && <div className="rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Agrega el nombre de tu empresa en Mis costos para incluirlo aquí.</div>}
        <div className="flex flex-wrap gap-2">
          <button onClick={descargar} className="rounded-xl px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors">Descargar</button>
          <button onClick={() => marco.current?.contentWindow?.print()} className="rounded-xl px-4 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors">Imprimir o PDF</button>
          {onGuardar && <button onClick={async () => { setAviso('Guardando…'); try { await onGuardar(new Blob([html], { type: 'text/html' }), nombreArchivo); setAviso('Quedó en los documentos del producto (Proyectos).'); } catch (e) { setAviso(e instanceof Error ? e.message : String(e)); } }} className="rounded-xl px-4 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors">Guardar en el proyecto</button>}
          {aviso && <span className="self-center text-xs text-slate-500">{aviso}</span>}
        </div>
      </div>
      <iframe ref={marco} title="Vista de la cotización" srcDoc={html} className="w-full h-[900px] rounded-2xl border border-slate-200 bg-slate-100" />
    </div>
  );
};
