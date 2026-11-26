import React, { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Pieza } from './piezas';
import { OPCIONES_LAMINA, OpcionesLamina, ResultadoMaterial, materialDe, optimizarMaterial } from './optimizador';

/** Optimización de lámina: medidas de lámina por material, sierra, refilado y veta; diagrama por lámina, aprovechamiento, retazos y consejos */

const Num: React.FC<{ label: string; value: number; min?: number; onChange: (n: number) => void }> = ({ label, value, min = 0, onChange }) => {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 block mb-1">{label}</span>
      <input
        type="text" inputMode="numeric" value={txt ?? String(value)}
        onChange={e => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => { if (txt !== null) { const n = parseInt(txt, 10); if (!isNaN(n) && n >= min) onChange(n); setTxt(null); } }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500"
      />
    </label>
  );
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const m2 = (mm2: number) => (mm2 / 1e6).toFixed(2);

const Diagrama: React.FC<{ o: OpcionesLamina; lam: ResultadoMaterial['laminas'][number] }> = ({ o, lam }) => {
  const f = o.largo / 100; // tamaño de letra proporcional a la lámina
  return (
    <svg viewBox={`0 0 ${o.largo} ${o.ancho}`} className="w-full h-auto rounded-lg bg-white border border-slate-300">
      <rect x={0} y={0} width={o.largo} height={o.ancho} fill="#f1f5f9" />
      <rect x={o.refilado} y={o.refilado} width={o.largo - 2 * o.refilado} height={o.ancho - 2 * o.refilado} fill="#ffffff" stroke="#cbd5e1" strokeWidth={2} />
      {lam.retazos.map((r, i) => (
        <g key={`r${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#dcfce7" stroke="#16a34a" strokeWidth={3} strokeDasharray="14 10" />
          {r.w > f * 9 && r.h > f * 2 && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + f * 0.35} textAnchor="middle" fontSize={f * 1.1} fontWeight={700} fill="#15803d">{Math.round(r.w)} × {Math.round(r.h)}</text>}
        </g>
      ))}
      {lam.piezas.map((p, i) => {
        const cabe = p.w > f * 7 && p.h > f * 3.2, chico = p.w > f * 4.5 && p.h > f * 1.4;
        return (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.canto.includes('4L') ? '#e0e7ff' : '#f8fafc'} stroke="#334155" strokeWidth={3}>
              <title>{`${p.nombre} · ${p.lar} × ${p.an}${p.canto ? ` · ${p.canto}` : ''}${p.girada ? ' · girada' : ''}`}</title>
            </rect>
            {cabe && <text x={p.x + p.w / 2} y={p.y + p.h / 2 - f * 0.2} textAnchor="middle" fontSize={f} fontWeight={700} fill="#1e293b">{p.nombre.length > p.w / (f * 0.62) ? p.nombre.slice(0, Math.max(3, Math.floor(p.w / (f * 0.62)) - 1)) + '…' : p.nombre}</text>}
            {(cabe || chico) && <text x={p.x + p.w / 2} y={p.y + p.h / 2 + (cabe ? f * 1.1 : f * 0.35)} textAnchor="middle" fontSize={f * 0.95} fill="#475569">{p.lar} × {p.an}</text>}
          </g>
        );
      })}
    </svg>
  );
};

export const Optimizador: React.FC<{ piezas: Pieza[] }> = ({ piezas }) => {
  const [base, setBase] = useState<OpcionesLamina>(OPCIONES_LAMINA);
  const [porMaterial, setPorMaterial] = useState<Record<string, { largo?: number; ancho?: number }>>({});
  const [abierto, setAbierto] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const g = new Map<string, Pieza[]>();
    piezas.filter(p => p.papel !== 'meson').forEach(p => { const m = materialDe(p); g.set(m, [...(g.get(m) ?? []), p]); });
    return [...g.entries()];
  }, [piezas]);

  const resultados = useMemo(() => grupos.map(([m, ps]) => {
    const o: OpcionesLamina = { ...base, largo: porMaterial[m]?.largo ?? base.largo, ancho: porMaterial[m]?.ancho ?? base.ancho };
    const r = optimizarMaterial(m, ps, o);
    // comparación para el consejo: cuántas láminas saldrían girando piezas (sin respetar la veta)
    const libre = o.respetarVeta ? optimizarMaterial(m, ps, { ...o, respetarVeta: false }) : null;
    return { o, r, libre };
  }), [grupos, base, porMaterial]);

  if (grupos.length === 0) return null;
  const totalLaminas = resultados.reduce((a, x) => a + x.r.laminas.length, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      <div>
        <div className="text-base font-semibold tracking-tight text-slate-900">Optimización de lámina</div>
        <div className="text-xs text-slate-500">Cortes de lado a lado (guillotina). El largo de cada pieza va en el sentido de la veta de la lámina.</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <Num label="Largo de lámina (mm)" value={base.largo} min={300} onChange={n => setBase(b => ({ ...b, largo: n }))} />
        <Num label="Ancho de lámina (mm)" value={base.ancho} min={300} onChange={n => setBase(b => ({ ...b, ancho: n }))} />
        <Num label="Sierra (mm)" value={base.sierra} onChange={n => setBase(b => ({ ...b, sierra: n }))} />
        <Num label="Refilado por borde (mm)" value={base.refilado} onChange={n => setBase(b => ({ ...b, refilado: n }))} />
        <button onClick={() => setBase(b => ({ ...b, respetarVeta: !b.respetarVeta }))} className={`rounded-xl px-3 py-2 text-xs border transition-colors ${base.respetarVeta ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium'}`}>
          {base.respetarVeta ? 'Respeta la veta' : 'Gira piezas (sin veta)'}
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900">
        Total: <span className="text-indigo-600">{totalLaminas} {totalLaminas === 1 ? 'lámina' : 'láminas'}</span> en {resultados.length} {resultados.length === 1 ? 'material' : 'materiales'}
      </div>

      {resultados.map(({ o, r, libre }) => {
        const ultima = r.laminas[r.laminas.length - 1];
        const consejos: string[] = [];
        if (libre && libre.laminas.length < r.laminas.length && libre.noCaben.length <= r.noCaben.length) consejos.push(`Si este material no tiene veta (o no importa), girando piezas salen ${libre.laminas.length} ${libre.laminas.length === 1 ? 'lámina' : 'láminas'} en vez de ${r.laminas.length}.`);
        if (r.laminas.length > 1 && ultima && ultima.uso < 0.25) consejos.push(`La última lámina solo se usa en ${pct(ultima.uso)} (${ultima.piezas.length} ${ultima.piezas.length === 1 ? 'pieza' : 'piezas'}). Revisa si esas piezas salen de un retazo que ya tengas o si un ajuste pequeño de medidas ahorra esa lámina.`);
        if (r.laminas.length === 1 && r.uso < 0.3) consejos.push(`Este material usa solo ${pct(r.uso)} de una lámina: puede salir de un retazo o de media lámina.`);
        const grandes = r.laminas.flatMap(l => l.retazos).filter(z => z.w * z.h >= 0.25 * 1e6).length;
        if (grandes > 0) consejos.push(`${grandes === 1 ? 'Queda 1 retazo grande' : `Quedan ${grandes} retazos grandes`} (más de 0,25 m²): ${grandes === 1 ? 'guárdalo marcado' : 'guárdalos marcados'} con el color y el calibre.`);
        const ver = abierto === r.material;
        return (
          <div key={r.material} className="border border-slate-200 rounded-2xl overflow-hidden">
            <button onClick={() => setAbierto(ver ? null : r.material)} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 bg-slate-50 text-left">
              <span className="text-sm font-black text-slate-800">{r.material}</span>
              <span className="text-xs font-bold text-slate-600">{r.laminas.length} {r.laminas.length === 1 ? 'lámina' : 'láminas'} de {o.largo} × {o.ancho}</span>
              <span className="text-xs font-bold text-slate-600">{r.piezas} piezas · {m2(r.areaPiezas)} m²</span>
              <span className={`text-xs font-black ${r.uso >= 0.7 ? 'text-emerald-600' : r.uso >= 0.45 ? 'text-amber-600' : 'text-rose-600'}`}>Aprovechamiento {pct(r.uso)}</span>
              <span className="ml-auto text-[11px] font-black text-indigo-600">{ver ? 'Ocultar' : 'Ver láminas'}</span>
            </button>
            {(consejos.length > 0 || r.noCaben.length > 0) && (
              <div className="px-4 py-2 space-y-1 border-t border-slate-200">
                {r.noCaben.map((n, i) => <div key={`n${i}`} className="text-[11px] font-bold text-rose-700">No cabe en la lámina: {n.cant} × {n.nombre} ({n.lar} × {n.an}).</div>)}
                {consejos.map((c, i) => <div key={i} className="text-[11px] font-bold text-amber-800">• {c}</div>)}
              </div>
            )}
            {ver && (
              <div className="p-4 space-y-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <Num label="Largo de esta lámina" value={o.largo} min={300} onChange={n => setPorMaterial(s => ({ ...s, [r.material]: { ...s[r.material], largo: n } }))} />
                  <Num label="Ancho de esta lámina" value={o.ancho} min={300} onChange={n => setPorMaterial(s => ({ ...s, [r.material]: { ...s[r.material], ancho: n } }))} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {r.laminas.map((l, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-black text-slate-700">Lámina {i + 1} de {r.laminas.length}</span>
                        <span className="text-[11px] font-bold text-slate-500">{l.piezas.length} piezas · usa {pct(l.uso)}</span>
                      </div>
                      <Diagrama o={o} lam={l} />
                      {l.retazos.length > 0 && <div className="text-[11px] font-bold text-emerald-700 mt-1">Retazos: {l.retazos.map(z => `${Math.round(z.w)} × ${Math.round(z.h)}`).join(' · ')}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Página HTML lista para abrir y guardar como PDF (Ctrl+P) */
const paginaHTML = (titulo: string, cuerpo: string, horizontal = false) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>@page{size:${horizontal ? 'A4 landscape' : 'A4'};margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:16px}h1{font-size:18px}h2{font-size:14px;margin:18px 0 6px}
.lam{page-break-inside:avoid;margin-bottom:14px}.nota{font-size:11px;color:#475569}svg{max-width:100%;height:auto}.hoja{page-break-after:always}</style></head><body>${cuerpo}</body></html>`;

/** Láminas del producto (con los valores normales de lámina, sierra y refilado) como página para guardar en el proyecto */
export function htmlLaminas(piezas: Pieza[], titulo: string): string {
  const grupos = new Map<string, Pieza[]>();
  piezas.filter(p => p.papel !== 'meson').forEach(p => { const m = materialDe(p); grupos.set(m, [...(grupos.get(m) ?? []), p]); });
  const o = OPCIONES_LAMINA;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const cuerpo = [...grupos.entries()].map(([m, ps]) => {
    const r = optimizarMaterial(m, ps, o);
    const laminas = r.laminas.map((l, i) => `<div class="lam"><div class="nota">Lámina ${i + 1} de ${r.laminas.length} · ${l.piezas.length} piezas · usa ${pct(l.uso)}${l.retazos.length ? ` · retazos: ${l.retazos.map(z => `${Math.round(z.w)} × ${Math.round(z.h)}`).join(', ')}` : ''}</div>${renderToStaticMarkup(<Diagrama o={o} lam={l} />)}</div>`).join('');
    const fuera = r.noCaben.map(n => `<div class="nota">No cabe en la lámina: ${n.cant} × ${n.nombre} (${n.lar} × ${n.an})</div>`).join('');
    return `<h2>${m} · ${r.laminas.length} ${r.laminas.length === 1 ? 'lámina' : 'láminas'} de ${o.largo} × ${o.ancho} · aprovechamiento ${pct(r.uso)}</h2>${fuera}${laminas}`;
  }).join('');
  return paginaHTML(`Láminas · ${titulo}`, `<h1>Láminas · ${titulo}</h1><div class="nota">Sierra ${o.sierra} mm · refilado ${o.refilado} mm por borde · respeta la veta</div>${cuerpo}`);
}
