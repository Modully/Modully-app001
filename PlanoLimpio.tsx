import React, { useMemo, useState } from 'react';
import type { Box } from './boxes';
import type { KitchenModule } from './types';

/**
 * Bosquejo pasado en limpio: vista de frente en 2D de cada muro con sus módulos marcados con su letra (A, B, C…) y, al lado,
 * la lista de módulos con sus medidas. Al tocar un módulo (en el dibujo o en la lista) se resalta en color en los dos lados.
 */

const TIPO: Record<string, string> = { LOWER: 'Bajo', UPPER: 'Aéreo', TALL: 'Torre' };
const NOMBRE_EQUIPO: Record<string, string> = { fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', 'hood-under': 'Campana', pantry: 'Alacena' };

export const PlanoLimpio: React.FC<{ boxes: Box[]; modules: KitchenModule[] }> = ({ boxes, modules }) => {
  const [sel, setSel] = useState<string | null>(null);
  const porLetra = useMemo(() => [...modules].filter(m => m.label).sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'es', { numeric: true })), [modules]);

  // un dibujo por muro: lo que va a lo largo de él (en A es la X; en B y C, la Y)
  const muros = useMemo(() => (['A', 'B', 'C'] as const).map(w => {
    const along = (b: Box) => (w === 'A' ? b.x : b.y), ancho = (b: Box) => (w === 'A' ? b.sx : b.sy);
    const mods = boxes.filter(b => b.wall === w && !b.islandId && (b.kind === 'lower' || b.kind === 'upper' || b.kind === 'tall') && b.moduleId);
    const frentes = boxes.filter(b => b.wall === w && !b.islandId && b.kind === 'front');
    if (!mods.length) return null;
    const equipos = boxes.filter(b => b.wall === w && !b.islandId && b.kind === 'appliance');
    const meson = boxes.filter(b => b.wall === w && !b.islandId && b.kind === 'counter');
    const zocalo = boxes.filter(b => b.wall === w && !b.islandId && b.kind === 'zocalo');
    const muro = boxes.find(b => b.id === `wall-${w}`);
    const cierres = w === 'A' ? boxes.filter(b => b.id === 'closure-left' || b.id === 'closure-right') : [];
    const todo = [...mods, ...equipos, ...meson];
    const x0 = muro ? along(muro) : Math.min(...todo.map(along)), x1 = muro ? along(muro) + ancho(muro) : Math.max(...todo.map(b => along(b) + ancho(b)));
    const alto = muro ? muro.sz : Math.max(...todo.map(b => b.z + b.sz));
    return { w, along, ancho, mods, frentes, equipos, meson, zocalo, cierres, x0, x1, alto };
  }).filter(Boolean) as NonNullable<ReturnType<typeof Object>>[], [boxes]);

  if (!porLetra.length) return null;
  const color = (id?: string) => (id && id === sel ? '#4f46e5' : '#e7d6bd');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="text-sm font-black text-slate-800 uppercase tracking-tight">Boceto en limpio</div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          {muros.map((m: any) => {
            const W = m.x1 - m.x0, H = m.alto, pad = 120;
            const X = (v: number) => v - m.x0, Y = (z: number) => H - z;
            return (
              <div key={m.w}>
                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Muro {m.w} · de frente · {Math.round(W)} × {Math.round(H)} mm</div>
                <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`} className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
                  {/* techo, piso y muros de los lados (sombreados como en el boceto) */}
                  <defs>
                    <pattern id={`rayas-${m.w}`} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="40" stroke="#94a3b8" strokeWidth="6" /></pattern>
                  </defs>
                  <rect x={-pad} y={-pad} width={W + 2 * pad} height={pad} fill={`url(#rayas-${m.w})`} />
                  <rect x={-pad} y={H} width={W + 2 * pad} height={pad} fill={`url(#rayas-${m.w})`} />
                  {m.cierres.map((c: Box) => <rect key={c.id} x={c.id === 'closure-left' ? -pad : W} y={0} width={pad} height={H} fill={`url(#rayas-${m.w})`} />)}
                  <rect x={0} y={0} width={W} height={H} fill="none" stroke="#475569" strokeWidth={6} />
                  {m.zocalo.map((b: Box) => <rect key={b.id} x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#cbd5e1" stroke="#64748b" strokeWidth={3} />)}
                  {m.meson.map((b: Box) => <rect key={b.id} x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#94a3b8" />)}
                  {m.equipos.map((b: Box) => (
                    <g key={b.id}>
                      <rect x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#f1f5f9" stroke="#64748b" strokeWidth={4} strokeDasharray="20 12" />
                      <text x={X(m.along(b)) + m.ancho(b) / 2} y={Y(b.z + b.sz / 2)} textAnchor="middle" fontSize={70} fill="#64748b" fontWeight={700}>{NOMBRE_EQUIPO[b.applianceType ?? ''] ?? 'Equipo'}</text>
                    </g>
                  ))}
                  {m.mods.map((b: Box) => {
                    const mod = modules.find(x => x.uniqueId === b.moduleId), on = b.moduleId === sel;
                    const cx = X(m.along(b)) + m.ancho(b) / 2, cy = Y(b.z + b.sz / 2);
                    return (
                      <g key={b.id} onClick={() => setSel(on ? null : b.moduleId!)} style={{ cursor: 'pointer' }}>
                        <rect x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill={color(b.moduleId)} stroke={on ? '#312e81' : '#7c5a35'} strokeWidth={on ? 10 : 5} />
                        {/* puertas y frentes del módulo: la puerta con las líneas de abertura y el cajón con su frente */}
                        {m.frentes.filter((f: Box) => f.moduleId === b.moduleId).map((f: Box) => {
                          const fx = X(m.along(f)), fy = Y(f.z + f.sz), fw = m.ancho(f), fh = f.sz, n = f.name.toLowerCase(), tono = on ? '#c7d2fe' : '#8a6a45';
                          if (/^frente/.test(n)) return (
                            <g key={f.id} pointerEvents="none">
                              <rect x={fx + 12} y={fy + 12} width={fw - 24} height={fh - 24} fill="none" stroke={tono} strokeWidth={5} />
                              <line x1={fx + fw * 0.35} y1={fy + 50} x2={fx + fw * 0.65} y2={fy + 50} stroke={tono} strokeWidth={8} strokeLinecap="round" />
                            </g>
                          );
                          if (/falsa/.test(n)) return <rect key={f.id} x={fx + 6} y={fy + 6} width={fw - 12} height={fh - 12} fill="none" stroke={tono} strokeWidth={4} pointerEvents="none" />;
                          const bis = /izquierda/.test(n) ? 'izq' : /derecha/.test(n) ? 'der' : /superior|inferior/.test(n) ? 'arriba' : 'izq';
                          // norma de la app: el vértice va en el borde libre (lado de la manija) y las líneas abren hacia las esquinas del lado de la bisagra
                          const [ax, ay] = bis === 'izq' ? [fx + fw, fy + fh / 2] : bis === 'der' ? [fx, fy + fh / 2] : [fx + fw / 2, fy + fh];
                          const [p1, p2] = bis === 'izq' ? [[fx, fy], [fx, fy + fh]] : bis === 'der' ? [[fx + fw, fy], [fx + fw, fy + fh]] : [[fx, fy], [fx + fw, fy]];
                          return (
                            <g key={f.id} pointerEvents="none">
                              <rect x={fx + 4} y={fy + 4} width={fw - 8} height={fh - 8} fill="none" stroke={tono} strokeWidth={4} />
                              <polyline points={`${p1[0]},${p1[1]} ${ax},${ay} ${p2[0]},${p2[1]}`} fill="none" stroke={tono} strokeWidth={4} strokeDasharray="22 12" />
                            </g>
                          );
                        })}
                        <circle cx={cx} cy={cy} r={Math.min(110, m.ancho(b) / 2.6)} fill="#ffffff" stroke={on ? '#312e81' : '#7c5a35'} strokeWidth={5} />
                        <text x={cx} y={cy + Math.min(110, m.ancho(b) / 2.6) * 0.42} textAnchor="middle" fontSize={Math.min(130, m.ancho(b) / 2.2)} fontWeight={800} fill={on ? '#312e81' : '#3b2a1a'}>{mod?.label ?? '?'}</text>
                        <text x={cx} y={Y(b.z) - 25} textAnchor="middle" fontSize={56} fill={on ? '#ffffff' : '#7c5a35'} fontWeight={700}>{Math.round(m.ancho(b))}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
        <div className="lg:w-72 shrink-0">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Módulos</div>
          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {porLetra.map(mod => {
              const on = mod.uniqueId === sel;
              return (
                <button key={mod.uniqueId} onClick={() => setSel(on ? null : mod.uniqueId)} className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-indigo-50 text-slate-700'}`}>
                  <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black border-2 ${on ? 'bg-white text-indigo-700 border-white' : 'bg-white text-slate-800 border-amber-800/40'}`}>{mod.label}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-black truncate">{mod.name}</span>
                    <span className={`block text-[10px] font-bold ${on ? 'text-indigo-100' : 'text-slate-400'}`}>{TIPO[mod.type] ?? mod.type} · muro {mod.wall} · {Math.round(mod.width)} × {Math.round(mod.height)} × {Math.round(mod.depth)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Ancho × alto × fondo, en mm. Toca un módulo para resaltarlo.</div>
        </div>
      </div>
    </div>
  );
};
