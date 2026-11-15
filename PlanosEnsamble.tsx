import React, { useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Box } from './boxes';
import { ContextoPiezas, listaDePiezas } from './piezas';

/**
 * Fase 3 · Planos de ensamble.
 *
 * Una hoja A4 horizontal por módulo (o una del conjunto, si el producto no se arma por módulos), como los planos de Inventor del carpintero:
 * vista frontal, corte, isométrica, cotas generales, lista de partes del módulo y rótulo con el logo.
 * Las hojas salen de las mismas cajas que el 3D y que el listado. Se exportan a PDF con la impresión del navegador ("Guardar como PDF").
 */

interface Local { nombre: string; u: number; v: number; w: number; du: number; dv: number; dw: number; frente: boolean }
interface Grupo { id: string; titulo: string; boxes: Box[]; locales: Local[]; W: number; D: number; H: number }

const ES_PIEZA = (b: Box) => (b.kind === 'panel' || b.kind === 'front' || (b.kind === 'filler' && Math.min(b.sx, b.sy, b.sz) <= 36)) && !/^(cuerpo |hueco |cubo closet fit|chapa|televisor|sanitario|espejo|tubo)/i.test(b.name);

/** Pasa las cajas de un módulo a medidas locales: u = ancho (izquierda a derecha), v = fondo (desde el frente), w = alto */
function aLocal(boxes: Box[]): { locales: Local[]; W: number; D: number; H: number } {
  const wall = boxes[0].wall;
  const x0 = Math.min(...boxes.map(b => b.x)), x1 = Math.max(...boxes.map(b => b.x + b.sx));
  const y0 = Math.min(...boxes.map(b => b.y)), y1 = Math.max(...boxes.map(b => b.y + b.sy));
  const z0 = Math.min(...boxes.map(b => b.z)), z1 = Math.max(...boxes.map(b => b.z + b.sz));
  const locales = boxes.map(b => {
    const base = { nombre: b.name, w: b.z - z0, dw: b.sz, frente: b.kind === 'front' };
    if (wall === 'B') return { ...base, u: b.y - y0, du: b.sy, v: x1 - (b.x + b.sx), dv: b.sx };       // el frente mira +X
    if (wall === 'C') return { ...base, u: y1 - (b.y + b.sy), du: b.sy, v: b.x - x0, dv: b.sx };        // el frente mira -X
    return { ...base, u: b.x - x0, du: b.sx, v: y1 - (b.y + b.sy), dv: b.sy };                          // muro A: el frente mira +Y
  });
  const alongX = wall !== 'B' && wall !== 'C';
  return { locales, W: alongX ? x1 - x0 : y1 - y0, D: alongX ? y1 - y0 : x1 - x0, H: z1 - z0 };
}

function grupos(boxes: Box[]): Grupo[] {
  const piezas = boxes.filter(ES_PIEZA);
  const porModulo = new Map<string, Box[]>();
  const sueltas: Box[] = [];
  piezas.forEach(b => { if (b.moduleId) porModulo.set(b.moduleId, [...(porModulo.get(b.moduleId) ?? []), b]); else sueltas.push(b); });
  const out: Grupo[] = [];
  porModulo.forEach((bs, id) => {
    const letra = /\s([A-Z]{1,2})$/.exec(bs[0].name)?.[1] ?? '';
    const tipo = bs.some(b => /-upper-/.test(b.id)) ? 'MA' : 'MB';
    out.push({ id, titulo: `Módulo ${tipo} ${letra}`.trim(), boxes: bs, ...aLocal(bs) });
  });
  out.sort((a, b) => a.titulo.localeCompare(b.titulo));
  if (sueltas.length > 0) out.push({ id: 'conjunto', titulo: 'Conjunto', boxes: sueltas, ...aLocal(sueltas) });
  return out;
}

const TXT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const LIN = '#111827';

/** Cota general: línea con marcas a 45° y la medida */
const Cota: React.FC<{ x1: number; y1: number; x2: number; y2: number; texto: string; lado: number }> = ({ x1, y1, x2, y2, texto, lado }) => {
  const horiz = Math.abs(y2 - y1) < 0.01, t = 1.1;
  const ox = horiz ? 0 : lado, oy = horiz ? lado : 0;
  const a = { x: x1 + ox, y: y1 + oy }, b = { x: x2 + ox, y: y2 + oy };
  return (
    <g stroke={LIN} strokeWidth={0.18} fill="none">
      <line x1={x1} y1={y1} x2={a.x + Math.sign(ox) * 1.5} y2={a.y + Math.sign(oy) * 1.5} strokeWidth={0.1} />
      <line x1={x2} y1={y2} x2={b.x + Math.sign(ox) * 1.5} y2={b.y + Math.sign(oy) * 1.5} strokeWidth={0.1} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {[a, b].map((p, i) => <line key={i} x1={p.x - t} y1={p.y + t} x2={p.x + t} y2={p.y - t} strokeWidth={0.3} />)}
      {horiz
        ? <text x={(a.x + b.x) / 2} y={a.y - 0.9} textAnchor="middle" fontSize={2.6} fill={LIN} stroke="none" {...TXT}>{texto}</text>
        : <text x={a.x - 0.9} y={(a.y + b.y) / 2} textAnchor="middle" fontSize={2.6} fill={LIN} stroke="none" transform={`rotate(-90 ${a.x - 0.9} ${(a.y + b.y) / 2})`} {...TXT}>{texto}</text>}
    </g>
  );
};

const Hoja: React.FC<{ g: Grupo; n: number; total: number; ctx: ContextoPiezas; proyecto: string; cliente: string; empresa: string; logo: string | null }> = ({ g, n, total, ctx, proyecto, cliente, empresa, logo }) => {
  const lista = useMemo(() => listaDePiezas(g.boxes, ctx).piezas, [g, ctx]);
  // --- vistas: frontal y corte con la misma escala; isométrica con la suya ---
  const top = 26, altoVistas = 82;
  const s = Math.min(78 / g.W, 52 / g.D, altoVistas / g.H);
  const fx = 22, cx = fx + g.W * s + 26, by = top + altoVistas; // base de las vistas (piso)
  const medio = g.W / 2;
  // isométrica: X = (u − d)·cos30, Y = (u + d)·sin30 − w, con d = distancia hacia el observador
  const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
  const iso = (u: number, v: number, w: number) => { const d = g.D - v; return { x: (u - d) * c30, y: (u + d) * s30 - w }; };
  const esquinas = [iso(0, 0, 0), iso(g.W, 0, 0), iso(0, g.D, 0), iso(g.W, g.D, 0), iso(0, 0, g.H), iso(g.W, 0, g.H), iso(0, g.D, g.H), iso(g.W, g.D, g.H)];
  const ix0 = Math.min(...esquinas.map(p => p.x)), ix1 = Math.max(...esquinas.map(p => p.x)), iy0 = Math.min(...esquinas.map(p => p.y)), iy1 = Math.max(...esquinas.map(p => p.y));
  const isoX = cx + g.D * s + 22, isoW = 285 - isoX;
  const si = Math.min(isoW / (ix1 - ix0), altoVistas / (iy1 - iy0));
  const P = (u: number, v: number, w: number) => { const p = iso(u, v, w); return `${(isoX + (isoW - (ix1 - ix0) * si) / 2 + (p.x - ix0) * si).toFixed(2)},${(top + (p.y - iy0) * si).toFixed(2)}`; };
  // se pinta de atrás hacia adelante; las puertas y frentes siempre al final (van por fuera)
  const orden = [...g.locales].sort((a, b) => (Number(a.frente) - Number(b.frente)) || (a.u + a.du / 2 + (g.D - a.v - a.dv / 2) + a.w + a.dw / 2) - (b.u + b.du / 2 + (g.D - b.v - b.dv / 2) + b.w + b.dw / 2));
  // --- lista de partes y rótulo ---
  const ty = 133, filas = lista.length + 1, fh = Math.min(4, 67 / filas);
  const cols = [[12, 'ITEM'], [22, 'PARTE'], [82, 'C/D'], [92, 'LAR'], [104, 'AN'], [116, 'CAL'], [126, 'COLOR'], [160, 'CANTO']] as const;
  const fecha = new Date().toLocaleDateString('es-CO');
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297 210" className="w-full h-auto bg-white border border-slate-300 rounded-lg" data-hoja>
      <rect x={0} y={0} width={297} height={210} fill="#ffffff" />
      <rect x={8} y={8} width={281} height={194} fill="none" stroke={LIN} strokeWidth={0.5} />
      <text x={12} y={16} fontSize={4.2} fontWeight={700} fill={LIN} {...TXT}>{g.titulo.toUpperCase()}</text>
      <text x={12} y={20.5} fontSize={2.6} fill="#475569" {...TXT}>{Math.round(g.W)} de ancho × {Math.round(g.D)} de fondo × {Math.round(g.H)} de alto (mm)</text>

      {/* vista frontal */}
      <g stroke={LIN} fill="none">
        {g.locales.filter(l => !l.frente).map((l, i) => <rect key={i} x={fx + l.u * s} y={by - (l.w + l.dw) * s} width={l.du * s} height={l.dw * s} strokeWidth={0.12} strokeDasharray="0.8 0.6" stroke="#64748b" />)}
        {g.locales.filter(l => l.frente).map((l, i) => <rect key={`f${i}`} x={fx + l.u * s} y={by - (l.w + l.dw) * s} width={l.du * s} height={l.dw * s} strokeWidth={0.35} fill="#ffffff" fillOpacity={0.75} />)}
        <rect x={fx} y={by - g.H * s} width={g.W * s} height={g.H * s} strokeWidth={0.35} />
      </g>
      <Cota x1={fx} y1={by} x2={fx + g.W * s} y2={by} texto={String(Math.round(g.W))} lado={7} />
      <Cota x1={fx} y1={by - g.H * s} x2={fx} y2={by} texto={String(Math.round(g.H))} lado={-7} />
      <text x={fx + (g.W * s) / 2} y={by + 13} textAnchor="middle" fontSize={2.8} fontWeight={700} fill={LIN} {...TXT}>VISTA FRONTAL</text>

      {/* corte por el centro del módulo: lo cortado va en gris; lo que queda detrás, en línea */}
      <g stroke={LIN}>
        {g.locales.map((l, i) => {
          const cortada = l.u <= medio && l.u + l.du >= medio;
          return <rect key={i} x={cx + (g.D - l.v - l.dv) * s} y={by - (l.w + l.dw) * s} width={l.dv * s} height={l.dw * s} strokeWidth={cortada ? 0.25 : 0.1} fill={cortada ? '#cbd5e1' : 'none'} stroke={cortada ? LIN : '#64748b'} />;
        })}
      </g>
      <Cota x1={cx} y1={by} x2={cx + g.D * s} y2={by} texto={String(Math.round(g.D))} lado={7} />
      <text x={cx + (g.D * s) / 2} y={by + 13} textAnchor="middle" fontSize={2.8} fontWeight={700} fill={LIN} {...TXT}>CORTE A-A</text>
      <text x={cx + (g.D * s) / 2} y={by + 16.5} textAnchor="middle" fontSize={2.1} fill="#475569" {...TXT}>frente a la derecha</text>

      {/* isométrica */}
      <g stroke={LIN} strokeWidth={0.15} strokeLinejoin="round">
        {orden.map((l, i) => {
          const u0 = l.u, u1 = l.u + l.du, v0 = l.v, v1 = l.v + l.dv, w0 = l.w, w1 = l.w + l.dw, f = l.frente ? '#e0e7ff' : '#ffffff';
          return (
            <g key={i} fill={f}>
              <polygon points={[P(u0, v0, w1), P(u1, v0, w1), P(u1, v1, w1), P(u0, v1, w1)].join(' ')} />
              <polygon points={[P(u0, v0, w0), P(u1, v0, w0), P(u1, v0, w1), P(u0, v0, w1)].join(' ')} fill={l.frente ? '#c7d2fe' : '#f1f5f9'} />
              <polygon points={[P(u1, v0, w0), P(u1, v1, w0), P(u1, v1, w1), P(u1, v0, w1)].join(' ')} fill={l.frente ? '#a5b4fc' : '#e2e8f0'} />
            </g>
          );
        })}
      </g>
      <text x={isoX + isoW / 2} y={by + 13} textAnchor="middle" fontSize={2.8} fontWeight={700} fill={LIN} {...TXT}>ISOMÉTRICA</text>

      {/* lista de partes */}
      <text x={12} y={ty - 1.5} fontSize={2.8} fontWeight={700} fill={LIN} {...TXT}>LISTA DE PARTES</text>
      <g fontSize={Math.min(2.4, fh * 0.66)} fill={LIN} {...TXT}>
        <rect x={11} y={ty} width={166} height={fh} fill="#e2e8f0" />
        {cols.map(([x, t]) => <text key={t} x={x} y={ty + fh * 0.72} fontWeight={700}>{t}</text>)}
        {lista.map((p, i) => {
          const y = ty + fh * (i + 1);
          return (
            <g key={i}>
              <line x1={11} y1={y} x2={177} y2={y} stroke="#94a3b8" strokeWidth={0.08} />
              {[p.item, p.name, p.quantity, p.length, p.width, p.thickness, p.color, p.edgeType || '—'].map((t, k) => <text key={k} x={cols[k][0]} y={y + fh * 0.72}>{String(t)}</text>)}
            </g>
          );
        })}
        <rect x={11} y={ty} width={166} height={fh * filas} fill="none" stroke={LIN} strokeWidth={0.2} />
      </g>

      {/* rótulo */}
      <g stroke={LIN} strokeWidth={0.25} fill="none">
        <rect x={184} y={150} width={105} height={52} />
        <line x1={184} y1={172} x2={289} y2={172} /><line x1={184} y1={182} x2={289} y2={182} /><line x1={184} y1={192} x2={289} y2={192} />
        <line x1={236} y1={182} x2={236} y2={202} />
      </g>
      {logo ? <image href={logo} x={186} y={152} width={36} height={18} preserveAspectRatio="xMidYMid meet" /> : <text x={188} y={163} fontSize={5} fontWeight={700} fill={LIN} {...TXT}>{(empresa || 'MODULLY').toUpperCase()}</text>}
      {logo && <text x={226} y={159} fontSize={3.4} fontWeight={700} fill={LIN} {...TXT}>{empresa}</text>}
      <text x={226} y={166} fontSize={2.3} fill="#475569" {...TXT}>Plano de ensamble</text>
      <g fontSize={2.1} fill="#64748b" {...TXT}>
        <text x={186} y={175.5}>PROYECTO</text><text x={186} y={185.5}>CLIENTE</text><text x={238} y={185.5}>FECHA</text><text x={186} y={195.5}>MATERIAL</text><text x={238} y={195.5}>HOJA</text>
      </g>
      <g fontSize={3} fontWeight={700} fill={LIN} {...TXT}>
        <text x={186} y={180}>{proyecto} · {g.titulo}</text>
        <text x={186} y={190}>{cliente || '—'}</text><text x={238} y={190}>{fecha}</text>
        <text x={186} y={200}>{ctx.faceColor || '—'} · Línea {ctx.lineType}</text><text x={238} y={200}>{n} de {total}</text>
      </g>
      <text x={287} y={206} textAnchor="end" fontSize={1.9} fill="#64748b" {...TXT}>Medidas en milímetros · sin escala</text>
    </svg>
  );
};

export const PlanosEnsamble: React.FC<{ boxes: Box[]; ctx: ContextoPiezas; proyecto: string }> = ({ boxes, ctx, proyecto }) => {
  const gs = useMemo(() => grupos(boxes), [boxes]);
  const [ver, setVer] = useState(false);
  const [cliente, setCliente] = useState('');
  const [empresa, setEmpresa] = useState(() => { try { return localStorage.getItem('modully-empresa') ?? ''; } catch { return ''; } });
  const [logo, setLogo] = useState<string | null>(() => { try { return localStorage.getItem('modully-logo'); } catch { return null; } });
  const hojas = useRef<HTMLDivElement>(null);
  if (gs.length === 0) return null;

  const cargarLogo = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { const d = String(r.result); setLogo(d); try { localStorage.setItem('modully-logo', d); } catch { /* sin espacio: el logo vale solo para esta sesión */ } };
    r.readAsDataURL(f);
  };
  const exportar = () => {
    const svgs = [...(hojas.current?.querySelectorAll('svg[data-hoja]') ?? [])].map(s => s.outerHTML).join('');
    if (!svgs) return;
    const marco = document.createElement('iframe');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(marco);
    const d = marco.contentDocument!;
    d.open();
    d.write(`<!doctype html><html><head><meta charset="utf-8"><title>Planos ${proyecto}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0}svg{display:block;width:297mm;height:209mm;page-break-after:always;border:0!important;border-radius:0!important}</style></head><body>${svgs}</body></html>`);
    d.close();
    setTimeout(() => { marco.contentWindow?.focus(); marco.contentWindow?.print(); setTimeout(() => marco.remove(), 2000); }, 300);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="text-sm font-black text-slate-800 uppercase tracking-tight">Planos de ensamble</div>
          <div className="text-[11px] font-bold text-slate-400">{gs.length} {gs.length === 1 ? 'hoja' : 'hojas'}: vista frontal, corte, isométrica, cotas, lista de partes y rótulo.</div>
        </div>
        <button onClick={() => setVer(v => !v)} className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700">{ver ? 'Ocultar planos' : 'Ver planos'}</button>
        <button onClick={() => { if (!ver) { setVer(true); setTimeout(exportar, 400); } else exportar(); }} className="rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white">Exportar a PDF</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Empresa</span>
          <input value={empresa} onChange={e => { setEmpresa(e.target.value); try { localStorage.setItem('modully-empresa', e.target.value); } catch { /* nada */ } }} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" /></label>
        <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cliente</span>
          <input value={cliente} onChange={e => setCliente(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" /></label>
        <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Logo del rótulo</span>
          <span className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={e => cargarLogo(e.target.files?.[0])} className="text-[11px] font-bold text-slate-600 w-full" />
            {logo && <button onClick={() => { setLogo(null); try { localStorage.removeItem('modully-logo'); } catch { /* nada */ } }} className="text-[11px] font-black text-rose-600 whitespace-nowrap">Quitar</button>}
          </span></label>
      </div>
      {ver && (
        <div ref={hojas} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {gs.map((g, i) => <Hoja key={g.id} g={g} n={i + 1} total={gs.length} ctx={ctx} proyecto={proyecto} cliente={cliente} empresa={empresa} logo={logo} />)}
        </div>
      )}
    </div>
  );
};

/** Página HTML lista para abrir y guardar como PDF (Ctrl+P) */
const paginaHTML = (titulo: string, cuerpo: string, horizontal = false) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>@page{size:${horizontal ? 'A4 landscape' : 'A4'};margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:16px}h1{font-size:18px}h2{font-size:14px;margin:18px 0 6px}
.lam{page-break-inside:avoid;margin-bottom:14px}.nota{font-size:11px;color:#475569}svg{max-width:100%;height:auto}.hoja{page-break-after:always}</style></head><body>${cuerpo}</body></html>`;

/** Planos de ensamble del producto (una hoja por módulo) como página para guardar en el proyecto */
export function htmlPlanos(boxes: Box[], ctx: ContextoPiezas, proyecto: string, cliente: string): string {
  const gs = grupos(boxes);
  let empresa = '', logo: string | null = null;
  try { empresa = localStorage.getItem('modully-empresa') ?? ''; logo = localStorage.getItem('modully-logo'); } catch { /* sin almacenamiento */ }
  const hojas = gs.map((g, i) => `<div class="hoja">${renderToStaticMarkup(<Hoja g={g} n={i + 1} total={gs.length} ctx={ctx} proyecto={proyecto} cliente={cliente} empresa={empresa} logo={logo} />)}</div>`).join('');
  return paginaHTML(`Planos · ${proyecto}`, hojas || '<p>Sin módulos convertidos.</p>', true);
}
