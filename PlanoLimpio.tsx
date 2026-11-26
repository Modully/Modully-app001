import React, { useMemo, useState } from 'react';
import type { Box } from './boxes';
import type { KitchenModule } from './types';

/**
 * Bosquejo pasado en limpio: vista de frente en 2D de cada muro con sus módulos marcados con su letra (A, B, C…) y, al lado,
 * la lista de módulos con sus medidas. Al tocar un módulo (en el dibujo o en la lista) se resalta en color en los dos lados.
 */

const TIPO: Record<string, string> = { LOWER: 'Bajo', UPPER: 'Aéreo', TALL: 'Torre' };
const NOMBRE_EQUIPO: Record<string, string> = { fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', 'hood-under': 'Campana', pantry: 'Alacena' };

export const PlanoLimpio: React.FC<{ boxes: Box[]; modules: KitchenModule[]; onCambiar?: (id: string, cambios: Partial<KitchenModule>) => void }> = ({ boxes, modules, onCambiar }) => {
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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
      <div className="text-base font-semibold tracking-tight text-slate-900">Boceto en limpio</div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          {muros.map((m: any) => {
            const W = m.x1 - m.x0, H = m.alto, pad = 120;
            const X = (v: number) => v - m.x0, Y = (z: number) => H - z;
            // el muro B es el de la izquierda: visto de frente desde la cocina, el muro A (el rincón) queda a su derecha, así que se dibuja invertido
            const fl = m.w === 'B';
            return (
              <div key={m.w}>
                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Muro {m.w} · de frente · {Math.round(m.w === 'A' ? W : m.x1)} × {Math.round(H)} mm{m.w === 'B' ? ' (largo útil · el muro A queda a la derecha)' : m.w === 'C' ? ' (largo útil · el muro A queda a la izquierda)' : ''}</div>
                <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`} className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
                  {/* techo, piso y muros de los lados (sombreados como en el boceto) */}
                  <defs>
                    <pattern id={`rayas-${m.w}`} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="40" stroke="#94a3b8" strokeWidth="6" /></pattern>
                  </defs>
                  <g transform={fl ? `translate(${W} 0) scale(-1 1)` : undefined}>
                  <rect x={-pad} y={-pad} width={W + 2 * pad} height={pad} fill={`url(#rayas-${m.w})`} />
                  <rect x={-pad} y={H} width={W + 2 * pad} height={pad} fill={`url(#rayas-${m.w})`} />
                  {m.cierres.map((c: Box) => <rect key={c.id} x={c.id === 'closure-left' ? -pad : W} y={0} width={pad} height={H} fill={`url(#rayas-${m.w})`} />)}
                  <rect x={0} y={0} width={W} height={H} fill="none" stroke="#475569" strokeWidth={6} />
                  {m.w !== 'A' && (() => {
                    // rincón: el muro A (su espesor y el fondo de sus muebles) ocupa el comienzo de este muro; los bajos de aquí arrancan a 570 y los aéreos a 330
                    const xa = X(0), zb = X(570), za = X(330);
                    const m0: Box | null = m.meson.length ? m.meson.reduce((p: Box, q: Box) => (m.along(q) < m.along(p) ? q : p)) : null;
                    const tBajo = Math.max(0, ...m.mods.filter((b: Box) => b.kind === 'lower').map((b: Box) => b.z + b.sz));
                    const aer = m.mods.filter((b: Box) => b.kind === 'upper');
                    const zA0 = aer.length ? Math.min(...aer.map((b: Box) => b.z)) : 0, zA1 = aer.length ? Math.max(...aer.map((b: Box) => b.z + b.sz)) : 0;
                    return (
                      <g pointerEvents="none">
                        <rect x={0} y={0} width={xa} height={H} fill={`url(#rayas-${m.w})`} />
                        {/* el mesón del brazo sigue por el rincón hasta tocar el muro A */}
                        {m0 && X(m.along(m0)) > xa + 1 && <rect x={xa} y={Y(m0.z + m0.sz)} width={X(m.along(m0)) - xa} height={m0.sz} fill="#94a3b8" />}
                        <rect x={xa} y={Y(tBajo)} width={zb - xa} height={tBajo} fill="#fde68a" fillOpacity={0.45} stroke="#d97706" strokeWidth={4} strokeDasharray="18 12" />
                        {aer.length > 0 && <rect x={xa} y={Y(zA1)} width={za - xa} height={zA1 - zA0} fill="#fde68a" fillOpacity={0.45} stroke="#d97706" strokeWidth={4} strokeDasharray="18 12" />}
                      </g>
                    );
                  })()}
                  {m.zocalo.map((b: Box) => <rect key={b.id} x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#cbd5e1" stroke="#64748b" strokeWidth={3} />)}
                  {m.meson.map((b: Box) => <rect key={b.id} x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#94a3b8" />)}
                  {m.equipos.map((b: Box) => (
                    <g key={b.id}>
                      <rect x={X(m.along(b))} y={Y(b.z + b.sz)} width={m.ancho(b)} height={b.sz} fill="#f1f5f9" stroke="#64748b" strokeWidth={4} strokeDasharray="20 12" />
                      <text x={X(m.along(b)) + m.ancho(b) / 2} y={Y(b.z + b.sz / 2)} transform={fl ? `translate(${2 * (X(m.along(b)) + m.ancho(b) / 2)} 0) scale(-1 1)` : undefined} textAnchor="middle" fontSize={70} fill="#64748b" fontWeight={700}>{NOMBRE_EQUIPO[b.applianceType ?? ''] ?? 'Equipo'}</text>
                    </g>
                  ))}
                  {m.mods.map((b: Box) => {
                    const mod = modules.find(x => x.uniqueId === b.moduleId), on = b.moduleId === sel;
                    const cx = X(m.along(b)) + m.ancho(b) / 2, cy = Y(b.z + b.sz / 2);
                    return (
                      <g key={b.id} onClick={() => setSel(on ? null : b.moduleId!)} onDoubleClick={() => {
                        // doble clic: los bajos (MB) pasan a cajones (y de nuevo a puertas) y los aéreos (MA) a puertas horizontales (y de nuevo a verticales)
                        if (!mod || !onCambiar || mod.isHood || mod.isFridgeCabinet) return;
                        if (mod.type === 'LOWER') {
                          const aCajones = mod.frontsLayout !== 'drawers';
                          onCambiar(mod.uniqueId, { detailed: true, frontsLayout: aCajones ? 'drawers' : mod.width <= 450 ? 'door1' : 'door2', configType: aCajones ? 'drawers' : 'doors', drawerCount: aCajones ? 3 : 0 });
                        } else if (mod.type === 'UPPER') {
                          const aHoriz = mod.frontsLayout !== 'upper-door2-h';
                          onCambiar(mod.uniqueId, { detailed: true, frontsLayout: aHoriz ? 'upper-door2-h' : mod.width < 450 ? 'upper-door1' : 'upper-door2-v' });
                        }
                      }} style={{ cursor: 'pointer' }}>
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
                        <text x={cx} transform={fl ? `translate(${2 * (cx)} 0) scale(-1 1)` : undefined} y={cy + Math.min(110, m.ancho(b) / 2.6) * 0.42} textAnchor="middle" fontSize={Math.min(130, m.ancho(b) / 2.2)} fontWeight={800} fill={on ? '#312e81' : '#3b2a1a'}>{mod?.label ?? '?'}</text>
                        <text x={cx} y={Y(b.z) - 25} transform={fl ? `translate(${2 * (cx)} 0) scale(-1 1)` : undefined}  textAnchor="middle" fontSize={56} fill={on ? '#ffffff' : '#7c5a35'} fontWeight={700}>{Math.round(m.ancho(b))}</text>
                      </g>
                    );
                  })}
                  {m.w === 'A' && (['B', 'C'] as const).map(brazo => {
                    // en el muro A, el brazo (B o C) tapa los primeros 570 mm de los bajos y 330 mm de los aéreos del rincón
                    const del = boxes.filter(b => b.wall === brazo && !b.islandId && b.moduleId);
                    if (!del.length) return null;
                    const dBajo = Math.max(0, ...del.filter(b => b.kind === 'lower' || b.kind === 'tall').map(b => b.sx));
                    const aereos = del.filter(b => b.kind === 'upper');
                    const dAereo = Math.max(0, ...aereos.map(b => b.sx));
                    const topeBajo = Math.max(0, ...m.mods.filter((b: Box) => b.kind === 'lower').map((b: Box) => b.z + b.sz));
                    const z0 = aereos.length ? Math.min(...aereos.map(b => b.z)) : 0, z1 = aereos.length ? Math.max(...aereos.map(b => b.z + b.sz)) : 0;
                    const izq = brazo === 'B';
                    const rx = (d: number) => (izq ? X(m.x0) : W - d);
                    return (
                      <g key={brazo} pointerEvents="none">
                        {dBajo > 0 && <rect x={rx(dBajo)} y={Y(topeBajo)} width={dBajo} height={topeBajo} fill="#fde68a" fillOpacity={0.5} stroke="#d97706" strokeWidth={4} strokeDasharray="18 12" />}
                        {dAereo > 0 && <rect x={rx(dAereo)} y={Y(z1)} width={dAereo} height={z1 - z0} fill="#fde68a" fillOpacity={0.5} stroke="#d97706" strokeWidth={4} strokeDasharray="18 12" />}
                      </g>
                    );
                  })}
                  {/* poceta con su grifería y estufa: dónde quedan sobre el mesón */}
                  {m.meson.flatMap((b: Box) => (b.cutouts ?? []).map((k, i) => {
                    const a0 = m.w === 'A' ? k.x : k.y, len = m.w === 'A' ? k.sx : k.sy;
                    if (a0 + len < m.x0 || a0 > m.x1) return null;
                    const x = X(a0), cx = x + len / 2, top = Y(b.z + b.sz), fondo = Y(b.z);
                    const tf = fl ? `translate(${2 * cx} 0) scale(-1 1)` : undefined;
                    if (/poceta/i.test(k.label)) return (
                      <g key={`${b.id}-p${i}`} pointerEvents="none">
                        <rect x={x} y={fondo} width={len} height={230} rx={30} fill="#bae6fd" fillOpacity={0.55} stroke="#0369a1" strokeWidth={5} strokeDasharray="16 10" />
                        <path d={`M ${cx} ${top} L ${cx} ${top - 300} Q ${cx} ${top - 380} ${cx + 90} ${top - 380} Q ${cx + 170} ${top - 380} ${cx + 170} ${top - 300} L ${cx + 170} ${top - 250}`} fill="none" stroke="#334155" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
                        <line x1={cx - 70} y1={top - 120} x2={cx - 10} y2={top - 120} stroke="#334155" strokeWidth={16} strokeLinecap="round" />
                      </g>
                    );
                    return (
                      <g key={`${b.id}-e${i}`} pointerEvents="none">
                        <rect x={x} y={top - 28} width={len} height={28} fill="#1e293b" fillOpacity={0.8} />
                        <text x={cx} y={top - 50} transform={tf} textAnchor="middle" fontSize={52} fontWeight={800} fill="#334155">Estufa</text>
                      </g>
                    );
                  }))}
                  </g>
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
          {muros.some((m: any) => m.w !== 'A') && <div className="text-[10px] font-bold text-amber-700 mt-2">En el muro A y en los brazos, la zona amarilla marca lo que tapa el brazo del rincón (570 mm en los bajos y 330 mm en los aéreos); el módulo que llega al rincón necesita puerta útil: 310 mm abajo y 350 mm arriba. En los muros B y C, la zona amarilla es el rincón: el muro A ocupa los primeros 570 mm de los bajos y 330 mm de los aéreos. Las líneas de división de bajos y aéreos coinciden en la misma posición.</div>}
          <div className="text-[10px] font-bold text-slate-400 mt-2">Ancho × alto × fondo, en mm. Toca un módulo para resaltarlo; con doble clic, los bajos cambian a cajones y los aéreos a puertas horizontales (otro doble clic los devuelve).</div>
        </div>
      </div>
    </div>
  );
};
