import React, { useEffect, useRef, useState } from 'react';
import type { Appliance, ColumnItem, IslandItem, KitchenModule } from './types';
import { CORNER_BLIND_OFFSET } from './boxes';
import { CotaElectro, PUNTO_INFO, PuntoAdecuacion, cotasPorElectro, siglaPunto } from './puntos';

/**
 * Mini vista del espacio, en planta y en vivo, fija arriba de la ventana de Configuración de espacio: muros con su largo,
 * muros auxiliares, módulos bajos (en gris), electrodomésticos, columnas, islas y los puntos de adecuación con su sigla
 * y altura. Cambia con cada dato que se escribe, para ver lo que se está haciendo sin cerrar la ventana.
 * Coordenadas en mm, como las cajas: X a lo largo del muro A, Y desde el muro A hacia el cuarto.
 * Se arrastra para moverla, la rueda del mouse (o los botones + y −) acerca y aleja, "Ajustar" vuelve a verla completa
 * y "Ampliar" la hace más alta.
 */

const NOMBRE: Partial<Record<Appliance['type'], string>> = { fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', dishwasher: 'Lavav.', pantry: 'Alacena' };

export const MiniEspacio: React.FC<{
  wallA: number; wallB: number; wallC: number;
  armB: boolean; armC: boolean;
  izq: boolean; der: boolean;           // muros auxiliares
  appliances: Appliance[];
  modules: KitchenModule[];
  columns: ColumnItem[];
  islands: IslandItem[];
  puntos: PuntoAdecuacion[];
}> = ({ wallA, wallB, wallC, armB, armC, izq, der, appliances, modules, columns, islands, puntos }) => {
  const largoB = armB ? wallB : 0, largoC = armC ? wallC : 0;
  const fondo = Math.max(850, largoB, largoC, ...islands.map(i => i.dy + i.width + 150), ...columns.map(c => c.depth + 100));
  const fs = Math.max(wallA, fondo) / 38;          // tamaño de letra en mm del dibujo
  const muro = fs * 0.55;                          // grosor del muro dibujado

  // rectángulo en planta de algo que va contra un muro (a lo largo + fondo)
  const contra = (wall: 'A' | 'B' | 'C', along0: number, ancho: number, prof: number, base = CORNER_BLIND_OFFSET, desde = 0) => {
    if (wall === 'A') return { x: along0, y: desde, w: ancho, h: prof };
    const y = base + along0;
    return wall === 'B' ? { x: desde, y, w: prof, h: ancho } : { x: wallA - desde - prof, y, w: prof, h: ancho };
  };

  const bajos = modules.filter(m => m.type === 'LOWER' && m.wall !== 'Island');
  const electros = appliances.filter(a => a.active && a.wall !== 'Island' && a.type !== 'hood-under' && a.type !== 'hood-island');
  const campana = appliances.find(a => a.active && a.type === 'hood-under' && a.wall !== 'Island');

  // cotas desde el punto 0 (esquina interior donde arranca el muro A; el C desde su esquina): una por electrodoméstico, en su
  // centro, con su nombre y sus puntos al lado (sigla y altura en cm). Sin línea de cota: solo la marca, la línea punteada y el texto
  const cotasA = cotasPorElectro(puntos, 'A'), cotasB = cotasPorElectro(puntos, 'B'), cotasC = cotasPorElectro(puntos, 'C');
  const largoTexto = (cs: CotaElectro[]) => Math.max(0, ...cs.map(c => `${c.x} ${c.nombre} `.length + c.puntos.reduce((n, p) => n + siglaPunto(p).length + 1, 0))) * fs * 0.48;
  const lineaA = -fs * 1.6;                                // altura (y) de las marcas del muro A
  const lineaB = -fs * 1.6, lineaC = wallA + fs * 1.6;     // x de las marcas de los muros B y C
  const izqExtra = (armB ? fs * 1.8 : 0) + (cotasB.length ? largoTexto(cotasB) + fs : 0), derExtra = (armC ? fs * 1.8 : 0) + (cotasC.length ? largoTexto(cotasC) + fs : 0);
  const arribaTotal = fs * 1.6 + (cotasA.length ? largoTexto(cotasA) * 0.72 + fs * 0.6 : 0) + fs * 1.3;
  const vb = { x: -fs - izqExtra, y: -arribaTotal - fs * 0.4, w: wallA + 2 * fs + izqExtra + derExtra, h: fondo + arribaTotal + fs * 1.2 };

  // zoom y arrastre: la vista es un recorte del dibujo (en mm); sin recorte se ve completo
  const [vista, setVista] = useState<typeof vb | null>(null);
  const [grande, setGrande] = useState(false);
  const v = vista ?? vb;
  const vRef = useRef(v); vRef.current = v;
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastre = useRef<{ x: number; y: number; v: typeof vb; escala: number } | null>(null);
  // punto de la pantalla → punto del dibujo (respeta el encuadre que hace el navegador)
  const aDibujo = (cx: number, cy: number) => {
    const svg = svgRef.current, m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    return pt.matrixTransform(m.inverse());
  };
  const zoom = (factor: number, centro?: { x: number; y: number }) => {
    const c = vRef.current, k = Math.min(Math.max(factor, 0.05 * vb.w / c.w), 4 * vb.w / c.w); // entre 20x de cerca y 4x de lejos
    const cx = centro?.x ?? c.x + c.w / 2, cy = centro?.y ?? c.y + c.h / 2;
    setVista({ x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k, w: c.w * k, h: c.h * k });
  };
  // la rueda se escucha a mano (no pasiva) para que no desplace la ventana mientras se hace zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rueda = (e: WheelEvent) => { e.preventDefault(); const p = aDibujo(e.clientX, e.clientY); zoom(e.deltaY > 0 ? 1.18 : 1 / 1.18, p ?? undefined); };
    svg.addEventListener('wheel', rueda, { passive: false });
    return () => svg.removeEventListener('wheel', rueda);
  });
  const boton = 'w-7 h-7 rounded-lg bg-white/90 border border-slate-200 text-slate-700 text-sm font-black shadow-sm hover:bg-white flex items-center justify-center';

  return (
    <div className="relative">
    <svg ref={svgRef} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className={`w-full ${grande ? 'h-[55vh]' : 'h-52 md:h-80'} bg-slate-50 rounded-2xl border border-slate-200 touch-none select-none ${arrastre.current ? 'cursor-grabbing' : 'cursor-grab'}`} role="img" aria-label="Vista en planta del espacio"
      onPointerDown={e => { const m = svgRef.current?.getScreenCTM(); if (!m) return; (e.target as Element).setPointerCapture?.(e.pointerId); arrastre.current = { x: e.clientX, y: e.clientY, v: vRef.current, escala: m.a }; }}
      onPointerMove={e => { const a = arrastre.current; if (!a) return; if (e.buttons === 0) { arrastre.current = null; return; } setVista({ ...a.v, x: a.v.x - (e.clientX - a.x) / a.escala, y: a.v.y - (e.clientY - a.y) / a.escala }); }}
      onPointerUp={() => { arrastre.current = null; }} onPointerCancel={() => { arrastre.current = null; }}
      onDoubleClick={e => { const p = aDibujo(e.clientX, e.clientY); zoom(1 / 1.8, p ?? undefined); }}>
      {/* módulos bajos, de referencia */}
      {bajos.map(m => {
        const r = contra(m.wall as 'A' | 'B' | 'C', m.positionX, m.width, m.depth, CORNER_BLIND_OFFSET, m.depthOffset ?? 0);
        return <rect key={m.uniqueId} {...{ x: r.x, y: r.y, width: r.w, height: r.h }} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={fs * 0.08} />;
      })}
      {/* columnas */}
      {columns.map(c => {
        const r = c.wall === 'A' ? { x: c.distance, y: 0, w: c.width, h: c.depth } : contra(c.wall, c.distance, c.width, c.depth, 0);
        return <rect key={c.id} x={r.x} y={r.y} width={r.w} height={r.h} fill="#94a3b8" />;
      })}
      {/* islas y penínsulas */}
      {islands.map(i => (
        <g key={i.id}>
          <rect x={i.dx} y={i.dy} width={i.length} height={i.width} fill="#eef2ff" stroke="#6366f1" strokeWidth={fs * 0.1} strokeDasharray={`${fs * 0.4} ${fs * 0.25}`} />
          <text x={i.dx + i.length / 2} y={i.dy + i.width / 2 + fs * 0.35} fontSize={fs} textAnchor="middle" fill="#4338ca" fontWeight={800}>{i.kind === 'peninsula' ? 'Península' : 'Isla'}</text>
        </g>
      ))}
      {/* electrodomésticos */}
      {electros.map(a => {
        const r = contra(a.wall as 'A' | 'B' | 'C', a.distance, a.width, a.type === 'dishwasher' ? 570 : a.depth);
        return (
          <g key={a.type}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#ffffff" stroke="#4f46e5" strokeWidth={fs * 0.12} />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fs * 0.35} fontSize={fs * 0.9} textAnchor="middle" fill="#3730a3" fontWeight={800}>{NOMBRE[a.type] ?? ''}</text>
          </g>
        );
      })}
      {campana && (() => {
        const r = contra(campana.wall as 'A' | 'B' | 'C', campana.distance, campana.width, 450);
        return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#64748b" strokeWidth={fs * 0.1} strokeDasharray={`${fs * 0.3} ${fs * 0.2}`} />;
      })()}
      {/* muros */}
      <line x1={0} y1={-muro / 2} x2={wallA} y2={-muro / 2} stroke="#0f172a" strokeWidth={muro} />
      {armB && <line x1={-muro / 2} y1={0} x2={-muro / 2} y2={largoB} stroke="#0f172a" strokeWidth={muro} />}
      {armC && <line x1={wallA + muro / 2} y1={0} x2={wallA + muro / 2} y2={largoC} stroke="#0f172a" strokeWidth={muro} />}
      {/* muros auxiliares: cierran el extremo libre */}
      {izq && (armB ? <line x1={0} y1={largoB + muro / 2} x2={CORNER_BLIND_OFFSET + 150} y2={largoB + muro / 2} stroke="#0f172a" strokeWidth={muro} /> : <line x1={-muro / 2} y1={0} x2={-muro / 2} y2={CORNER_BLIND_OFFSET + 150} stroke="#0f172a" strokeWidth={muro} />)}
      {der && (armC ? <line x1={wallA - CORNER_BLIND_OFFSET - 150} y1={largoC + muro / 2} x2={wallA} y2={largoC + muro / 2} stroke="#0f172a" strokeWidth={muro} /> : <line x1={wallA + muro / 2} y1={0} x2={wallA + muro / 2} y2={CORNER_BLIND_OFFSET + 150} stroke="#0f172a" strokeWidth={muro} />)}
      {/* largos */}
      <text x={wallA} y={-arribaTotal + fs * 0.4} fontSize={fs} textAnchor="end" fill="#334155" fontWeight={800}>Muro A · {wallA} mm</text>
      {/* punto 0 y cotas: una por electrodoméstico con su nombre y sus puntos */}
      {(cotasA.length > 0 || cotasB.length > 0) && <g>
        <circle cx={0} cy={0} r={fs * 0.45} fill="#ffffff" stroke="#7c3aed" strokeWidth={fs * 0.14} />
        <circle cx={0} cy={0} r={fs * 0.14} fill="#7c3aed" />
      </g>}
      {cotasC.length > 0 && <circle cx={wallA} cy={0} r={fs * 0.45} fill="#ffffff" stroke="#7c3aed" strokeWidth={fs * 0.14} />}
      {([['A', cotasA], ['B', cotasB], ['C', cotasC]] as const).map(([w, cs]) => cs.length > 0 && (
        <g key={w} stroke="#334155" strokeWidth={fs * 0.05}>
          {[null, ...cs, { x: Math.round(w === 'A' ? wallA : w === 'B' ? wallB : wallC), nombre: '', puntos: [], total: true }].map(c => {
            const d = c ? c.x : 0;
            const contenido = <>{c ? `${c.x}${c.nombre ? ` ${c.nombre}` : ''}` : '0'}{c?.puntos.map(p => <tspan key={p.id} fill={PUNTO_INFO[p.tipo].color}> {siglaPunto(p)}</tspan>)}</>;
            if (w === 'A') return (
              <g key={d}>
                <line x1={d} y1={0} x2={d} y2={lineaA} strokeDasharray={c && c.puntos.length ? `${fs * 0.2} ${fs * 0.15}` : undefined} />
                <line x1={d - fs * 0.22} y1={lineaA + fs * 0.22} x2={d + fs * 0.22} y2={lineaA - fs * 0.22} strokeWidth={fs * 0.09} />
                <text x={d + fs * 0.25} y={lineaA - fs * 0.4} fontSize={fs * 0.8} fill="#0f172a" stroke="none" fontWeight={800} transform={`rotate(-45 ${d + fs * 0.25} ${lineaA - fs * 0.4})`}>{contenido}</text>
              </g>
            );
            const xl = w === 'B' ? lineaB : lineaC, x0 = w === 'B' ? 0 : wallA;
            return (
              <g key={d}>
                <line x1={x0} y1={d} x2={xl} y2={d} strokeDasharray={c && c.puntos.length ? `${fs * 0.2} ${fs * 0.15}` : undefined} />
                <line x1={xl - fs * 0.22} y1={d - fs * 0.22} x2={xl + fs * 0.22} y2={d + fs * 0.22} strokeWidth={fs * 0.09} />
                <text x={w === 'B' ? xl - fs * 0.4 : xl + fs * 0.4} y={d + fs * 0.3} fontSize={fs * 0.8} fill="#0f172a" stroke="none" fontWeight={800} textAnchor={w === 'B' ? 'end' : 'start'}>{contenido}</text>
              </g>
            );
          })}
        </g>
      ))}
      {armB && <text x={-muro - fs * 0.4} y={largoB / 2} fontSize={fs} textAnchor="middle" fill="#334155" fontWeight={800} transform={`rotate(-90 ${-muro - fs * 0.4} ${largoB / 2})`}>B · {wallB}</text>}
      {armC && <text x={wallA + muro + fs * 0.9} y={largoC / 2} fontSize={fs} textAnchor="middle" fill="#334155" fontWeight={800} transform={`rotate(90 ${wallA + muro + fs * 0.9} ${largoC / 2})`}>C · {wallC}</text>}
      {/* puntos de adecuación: círculo sobre el muro (sus siglas van en la cota de su electrodoméstico) */}
      {puntos.map(p => {
        const [cx, cy] = p.wall === 'A' ? [p.x, 0] : p.wall === 'B' ? [0, p.y] : [wallA, p.y];
        return <circle key={p.id} cx={cx} cy={cy} r={fs * 0.32} fill={PUNTO_INFO[p.tipo].color} stroke="#fff" strokeWidth={fs * 0.08} />;
      })}
    </svg>
      <div className="absolute right-2 top-2 flex gap-1">
        <button type="button" className={boton} onClick={() => zoom(1 / 1.4)} aria-label="Acercar">+</button>
        <button type="button" className={boton} onClick={() => zoom(1.4)} aria-label="Alejar">−</button>
        <button type="button" className={`${boton} w-auto px-2 text-[10px]`} onClick={() => setVista(null)}>Ajustar</button>
        <button type="button" className={`${boton} w-auto px-2 text-[10px]`} onClick={() => setGrande(g => !g)}>{grande ? 'Reducir' : 'Ampliar'}</button>
      </div>
      <p className="absolute left-3 bottom-2 text-[9px] font-bold text-slate-400 pointer-events-none">Arrastra para mover · rueda o doble clic para acercar</p>
    </div>
  );
};
