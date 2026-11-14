import React, { useState } from 'react';
import { SECTIONS, SectionId } from './sections';
import type { LayoutType } from './types';

/**
 * Fase 5 · Bosquejo.
 *
 * Punto de partida rápido para cualquier producto: solo con las medidas del espacio se arma el diseño.
 * En cocinas, además, se marcan el punto de desagüe y el de gas: la poceta va sobre el desagüe, la estufa sobre el gas
 * y el resto del muro se llena con la misma modulación automática de "Optimizar modulación".
 */

export type MuroPunto = 'A' | 'B' | 'C';
export interface Punto { muro: MuroPunto; dist: number }
export interface DatosBosquejo {
  producto: SectionId;
  forma: LayoutType;
  brazo: 'left' | 'right';
  A: number; B: number; C: number; alto: number;
  desague: Punto | null;
  gas: Punto | null;
  nevera: 'no' | 'inicio' | 'final';
  campana: boolean;
}

const ORDEN: SectionId[] = ['cocinas', 'closets', 'closetfit', 'walking', 'bano', 'tv', 'puertas'];
const FORMAS: Record<string, string> = { STRAIGHT: 'Recta', L_SHAPE: 'En L', U_SHAPE: 'En U' };

const Num: React.FC<{ label: string; value: number; onChange: (n: number) => void; ayuda?: string }> = ({ label, value, onChange, ayuda }) => {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{label}</span>
      <input
        type="text" inputMode="numeric" value={txt ?? String(value)}
        onChange={e => setTxt(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => { if (txt !== null) { const n = parseInt(txt, 10); if (!isNaN(n)) onChange(n); setTxt(null); } }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800"
      />
      {ayuda && <span className="text-[9px] font-bold text-slate-400 block mt-1">{ayuda}</span>}
    </label>
  );
};

const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-black border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{children}</button>
);

export const Bosquejo: React.FC<{ actual: SectionId; onCrear: (d: DatosBosquejo) => void }> = ({ actual, onCrear }) => {
  const ini = SECTIONS[actual].defaults;
  const [d, setD] = useState<DatosBosquejo>({
    producto: actual, forma: ini.layout, brazo: 'left', A: ini.wallA, B: ini.wallB, C: ini.wallC, alto: ini.spaceHeight,
    desague: { muro: 'A', dist: 1800 }, gas: { muro: 'A', dist: 900 }, nevera: 'no', campana: true,
  });
  const cfg = SECTIONS[d.producto];
  const cocina = d.producto === 'cocinas', puerta = d.producto === 'puertas';
  const hayB = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'left');
  const hayC = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'right');
  const muros: MuroPunto[] = ['A', ...(hayB ? ['B' as const] : []), ...(hayC ? ['C' as const] : [])];
  const largo = (m: MuroPunto) => (m === 'A' ? d.A : m === 'B' ? d.B : d.C);
  const elegir = (p: SectionId) => { const df = SECTIONS[p].defaults; setD(x => ({ ...x, producto: p, forma: df.layout, A: df.wallA, B: df.wallB, C: df.wallC, alto: df.spaceHeight })); };

  // avisos antes de crear (solo cocinas): puntos fuera del muro o poceta y estufa encimadas
  const avisos: string[] = [];
  if (cocina) {
    ([['desagüe', d.desague], ['gas', d.gas]] as const).forEach(([n, p]) => {
      if (!p) return;
      if (!muros.includes(p.muro)) avisos.push(`El punto de ${n} está en el muro ${p.muro}, que no existe en esta forma.`);
      else if (p.dist < 300 || p.dist > largo(p.muro) - 300) avisos.push(`El punto de ${n} queda a menos de 300 mm de un extremo del muro ${p.muro}: el mueble de 600 se correrá para caber.`);
    });
    if (d.desague && d.gas && d.desague.muro === d.gas.muro && Math.abs(d.desague.dist - d.gas.dist) < 600) avisos.push('El desagüe y el gas están a menos de 600 mm: la poceta y la estufa no caben una al lado de la otra.');
  }
  const bloqueado = avisos.some(a => /no caben|no existe/.test(a));

  const PuntoForm: React.FC<{ titulo: string; color: string; p: Punto | null; set: (p: Punto | null) => void }> = ({ titulo, color, p, set }) => (
    <div className="border border-slate-200 rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: color }} />
        <span className="text-xs font-black text-slate-700 uppercase mr-auto">{titulo}</span>
        <Chip on={!!p} onClick={() => set(p ? null : { muro: 'A', dist: 1000 })}>{p ? 'Lleva' : 'No lleva'}</Chip>
      </div>
      {p && (
        <div className="grid grid-cols-2 gap-2 items-end">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Muro</span>
            <div className="flex gap-1">{muros.map(m => <Chip key={m} on={p.muro === m} onClick={() => set({ ...p, muro: m })}>{m}</Chip>)}</div>
          </div>
          <Num label="Distancia al punto (mm)" value={p.dist} onChange={n => set({ ...p, dist: n })} />
        </div>
      )}
    </div>
  );

  // dibujo del muro A con los puntos marcados
  const esc = 560 / Math.max(d.A, 1);
  const marca = (p: Punto | null, color: string, texto: string) => p && p.muro === 'A' && (
    <g>
      <line x1={20 + p.dist * esc} y1={30} x2={20 + p.dist * esc} y2={78} stroke={color} strokeWidth={2} strokeDasharray="4 3" />
      <circle cx={20 + p.dist * esc} cy={30} r={6} fill={color} />
      <text x={20 + p.dist * esc} y={18} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}>{texto} · {p.dist}</text>
    </g>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="text-[10px] font-black text-slate-400 uppercase">Qué vas a diseñar</div>
        <div className="flex flex-wrap gap-2">{ORDEN.map(p => <Chip key={p} on={d.producto === p} onClick={() => elegir(p)}>{SECTIONS[p].name}</Chip>)}</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="text-[10px] font-black text-slate-400 uppercase">Medidas del espacio</div>
        {!puerta && cfg.layouts.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {cfg.layouts.map(f => <Chip key={f} on={d.forma === f} onClick={() => setD(x => ({ ...x, forma: f }))}>{FORMAS[f]}</Chip>)}
            {d.forma === 'L_SHAPE' && <><span className="text-[10px] font-black text-slate-400 uppercase ml-3">Brazo</span>
              <Chip on={d.brazo === 'left'} onClick={() => setD(x => ({ ...x, brazo: 'left' }))}>A la izquierda</Chip>
              <Chip on={d.brazo === 'right'} onClick={() => setD(x => ({ ...x, brazo: 'right' }))}>A la derecha</Chip></>}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Num label={puerta ? 'Largo del muro (mm)' : 'Muro A · ancho (mm)'} value={d.A} onChange={n => setD(x => ({ ...x, A: n }))} />
          {hayB && !puerta && <Num label="Muro B · izquierda (mm)" value={d.B} onChange={n => setD(x => ({ ...x, B: n }))} />}
          {hayC && !puerta && <Num label="Muro C · derecha (mm)" value={d.C} onChange={n => setD(x => ({ ...x, C: n }))} />}
          <Num label="Alto del espacio (mm)" value={d.alto} onChange={n => setD(x => ({ ...x, alto: n }))} />
        </div>
      </div>

      {cocina && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="text-[10px] font-black text-slate-400 uppercase">Puntos de la obra</div>
          <div className="text-[11px] font-bold text-slate-400">La distancia se mide desde el extremo izquierdo del muro hasta el centro del punto. La poceta queda sobre el desagüe y la estufa sobre el gas.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PuntoForm titulo="Desagüe (poceta)" color="#2563eb" p={d.desague} set={p => setD(x => ({ ...x, desague: p }))} />
            <PuntoForm titulo="Gas (estufa)" color="#ea580c" p={d.gas} set={p => setD(x => ({ ...x, gas: p }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Nevera</span>
            <Chip on={d.nevera === 'no'} onClick={() => setD(x => ({ ...x, nevera: 'no' }))}>No lleva</Chip>
            <Chip on={d.nevera === 'inicio'} onClick={() => setD(x => ({ ...x, nevera: 'inicio' }))}>Al inicio del muro A</Chip>
            <Chip on={d.nevera === 'final'} onClick={() => setD(x => ({ ...x, nevera: 'final' }))}>Al final del muro A</Chip>
            {d.gas && <><span className="text-[10px] font-black text-slate-400 uppercase ml-3 mr-1">Campana</span>
              <Chip on={d.campana} onClick={() => setD(x => ({ ...x, campana: !x.campana }))}>{d.campana ? 'Sobre la estufa' : 'No lleva'}</Chip></>}
          </div>
          <svg viewBox="0 0 600 100" className="w-full h-auto">
            <rect x={20} y={78} width={560} height={10} fill="#94a3b8" />
            <text x={20} y={98} fontSize={10} fill="#64748b">0</text>
            <text x={580} y={98} fontSize={10} fill="#64748b" textAnchor="end">Muro A · {d.A}</text>
            {d.nevera !== 'no' && <rect x={d.nevera === 'inicio' ? 20 : 580 - 700 * esc} y={48} width={700 * esc} height={30} fill="#e2e8f0" stroke="#64748b" />}
            {marca(d.desague, '#2563eb', 'Desagüe')}
            {marca(d.gas, '#ea580c', 'Gas')}
          </svg>
        </div>
      )}

      {avisos.map((a, i) => <div key={i} className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{a}</div>)}
      <div className="flex items-center gap-3">
        <button disabled={bloqueado} onClick={() => onCrear(d)} className="rounded-2xl px-6 py-3 text-sm font-black bg-indigo-600 text-white disabled:opacity-40">Crear diseño</button>
        <span className="text-[11px] font-bold text-slate-400">Reemplaza el diseño actual de {cfg.name}. Después lo ajustas en Diseño.</span>
      </div>
    </div>
  );
};
