import React, { useState } from 'react';
import { SECTIONS, SectionId } from './sections';
import type { LayoutType } from './types';
import { LecturaBoceto, ProductoLeido, leerBoceto } from './bocetoIA';

/**
 * Fase 5 · Bosquejo.
 *
 * Punto de partida rápido para cualquier producto: se adjunta la foto de un boceto a mano alzada y la IA lo convierte en el producto
 * y sus medidas; el carpintero revisa lo leído (o llena las medidas a mano) y con eso se arma el diseño.
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
  modulos: number[]; // cocinas: anchos de los módulos del muro A, de izquierda a derecha (vacío = modulación automática)
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
    desague: { muro: 'A', dist: 1800 }, gas: { muro: 'A', dist: 900 }, nevera: 'no', campana: true, modulos: [],
  });
  // boceto a mano alzada: la foto se lee con IA y llena este formulario (no crea nada sin que el carpintero lo revise)
  const [foto, setFoto] = useState<string | null>(null);
  const [lectura, setLectura] = useState<{ estado: 'nada' | 'leyendo' | 'lista' | 'error'; r?: LecturaBoceto; error?: string }>({ estado: 'nada' });
  const cargarFoto = (f?: File) => {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      // se achica a 1600 px de lado mayor: suficiente para leer la letra y más liviano de enviar
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        setFoto(c.toDataURL('image/jpeg', 0.88)); setLectura({ estado: 'nada' });
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(f);
  };
  const [elegido, setElegido] = useState(0); // una hoja puede traer varios muebles: se elige cuál pasar al formulario
  const usar = (r: ProductoLeido, k: number) => {
    setElegido(k);
    setD(x => {
      const prod = r.producto ?? x.producto, df = SECTIONS[prod].defaults, cambia = prod !== x.producto;
      const forma = r.forma && SECTIONS[prod].layouts.includes(r.forma) ? r.forma : cambia ? df.layout : x.forma;
      return {
        ...x, producto: prod, forma, brazo: r.brazo ?? x.brazo,
        A: r.muroA ?? (cambia ? df.wallA : x.A), B: r.muroB ?? (cambia ? df.wallB : x.B), C: r.muroC ?? (cambia ? df.wallC : x.C), alto: r.alto ?? (cambia ? df.spaceHeight : x.alto),
        desague: prod === 'cocinas' ? r.desague : x.desague, gas: prod === 'cocinas' ? r.gas : x.gas, nevera: r.nevera ?? 'no', modulos: prod === 'cocinas' ? r.modulos : [],
      };
    });
  };
  const leer = async () => {
    if (!foto) return;
    setLectura({ estado: 'leyendo' });
    try {
      const r = await leerBoceto(foto);
      setLectura({ estado: 'lista', r });
      usar(r.productos[0], 0);
    } catch (e) { setLectura({ estado: 'error', error: e instanceof Error ? e.message : String(e) }); }
  };
  const cfg = SECTIONS[d.producto];
  const cocina = d.producto === 'cocinas', puerta = d.producto === 'puertas';
  const hayB = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'left');
  const hayC = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'right');
  const muros: MuroPunto[] = ['A', ...(hayB ? ['B' as const] : []), ...(hayC ? ['C' as const] : [])];
  const largo = (m: MuroPunto) => (m === 'A' ? d.A : m === 'B' ? d.B : d.C);
  const elegir = (p: SectionId) => { const df = SECTIONS[p].defaults; setD(x => ({ ...x, producto: p, forma: df.layout, A: df.wallA, B: df.wallB, C: df.wallC, alto: df.spaceHeight, modulos: [] })); };

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
  const sumaMods = d.modulos.reduce((a, w) => a + w, 0);
  if (cocina && d.modulos.length > 0 && sumaMods !== d.A) avisos.push(`Los módulos suman ${sumaMods} y el muro A mide ${d.A}: ${sumaMods > d.A ? 'el último módulo se recorta' : 'el espacio que sobra se llena con otro módulo'}. Corrige el ancho del muro o los módulos.`);
  if (cocina && d.modulos.length > 0 && d.nevera !== 'no') avisos.push(`El módulo de ${d.nevera === 'inicio' ? d.modulos[0] : d.modulos[d.modulos.length - 1]} del ${d.nevera === 'inicio' ? 'inicio' : 'final'} es el espacio de la nevera (con el mueble de arriba).`);
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="text-sm font-black text-slate-800 uppercase tracking-tight">Boceto a mano alzada</div>
            <div className="text-[11px] font-bold text-slate-400">Adjunta la foto del boceto (o del sitio con las medidas escritas). La IA lo lee y llena las medidas de abajo para que las revises. La foto se envía al servicio de Gemini (Google).</div>
          </div>
          <label className="rounded-xl px-4 py-2 text-xs font-black border border-slate-200 text-slate-700 cursor-pointer">
            {foto ? 'Cambiar foto' : 'Adjuntar foto'}
            <input type="file" accept="image/*" data-boceto className="hidden" onChange={e => { cargarFoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {foto && <button onClick={leer} disabled={lectura.estado === 'leyendo'} className="rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white disabled:opacity-50">{lectura.estado === 'leyendo' ? 'Leyendo…' : lectura.estado === 'lista' ? 'Leer otra vez' : 'Leer boceto'}</button>}
        </div>
        {foto && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <img src={foto} alt="Boceto adjunto" className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-slate-50" />
            <div className="space-y-2">
              {lectura.estado === 'nada' && <div className="text-[11px] font-bold text-slate-400">Pulsa "Leer boceto" para pasar la foto a medidas.</div>}
              {lectura.estado === 'error' && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{lectura.error}</div>}
              {lectura.r && (<>
                <div className="text-[10px] font-black text-slate-400 uppercase">Lo que entendí</div>
                <div className="text-xs font-bold text-slate-700">{lectura.r.resumen}</div>
                {lectura.r.productos.map((q, k) => (
                  <button key={k} onClick={() => usar(q, k)} className={`w-full text-left rounded-xl border p-3 space-y-1 ${k === elegido ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 uppercase mr-auto">{q.nombre}</span>
                      <span className="text-[10px] font-black text-indigo-600">{k === elegido ? 'En el formulario' : 'Usar este'}</span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-600">
                      {[q.producto ? SECTIONS[q.producto].name : 'Producto sin identificar', q.muroA && `ancho ${q.muroA}`, q.alto && `alto ${q.alto}`, q.fondo && `fondo ${q.fondo}`].filter(Boolean).join(' · ')}
                    </div>
                    {q.modulos.length > 0 && <div className="text-[11px] font-bold text-slate-600">Módulos: {q.modulos.join(' + ')}</div>}
                    {q.detalle && <div className="text-[11px] font-bold text-slate-500">{q.detalle}</div>}
                    {q.dudas.map((t, i) => <div key={i} className="text-[11px] font-bold text-amber-800">• {t}</div>)}
                  </button>
                ))}
                <div className="text-[11px] font-bold text-slate-400 pt-1">Las medidas del mueble marcado quedaron puestas abajo. Corrígelas si hace falta antes de crear el diseño.</div>
              </>)}
            </div>
          </div>
        )}
      </div>
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
          <label className="block">
            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Anchos de los módulos del muro A, de izquierda a derecha (mm)</span>
            <input
              key={d.modulos.join('+')} defaultValue={d.modulos.join(' + ')} placeholder="Vacío = modulación automática. Ejemplo: 700 + 600 + 600 + 600"
              onBlur={e => { const v = (e.target.value.match(/\d+/g) ?? []).map(Number).filter(n => n > 0); setD(x => ({ ...x, modulos: v })); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800"
            />
            {d.modulos.length > 0 && sumaMods !== d.A && <button onClick={() => setD(x => ({ ...x, A: sumaMods }))} className="mt-2 rounded-xl px-3 py-1.5 text-[11px] font-black border border-indigo-200 text-indigo-700">Usar {sumaMods} como ancho del muro A</button>}
          </label>
          <svg viewBox="0 0 600 100" className="w-full h-auto">
            <rect x={20} y={78} width={560} height={10} fill="#94a3b8" />
            <text x={20} y={98} fontSize={10} fill="#64748b">0</text>
            <text x={580} y={98} fontSize={10} fill="#64748b" textAnchor="end">Muro A · {d.A}</text>
            {d.modulos.reduce<{ x: number; els: React.ReactNode[] }>((acc, w, k) => { acc.els.push(<g key={k}><rect x={20 + acc.x * esc} y={48} width={w * esc} height={30} fill="#f8fafc" stroke="#94a3b8" /><text x={20 + (acc.x + w / 2) * esc} y={67} textAnchor="middle" fontSize={10} fill="#475569">{w}</text></g>); acc.x += w; return acc; }, { x: 0, els: [] }).els}
            {d.nevera !== 'no' && <rect x={d.nevera === 'inicio' ? 20 : 580 - (d.modulos.length ? d.modulos[d.modulos.length - 1] : 700) * esc} y={48} width={(d.modulos.length ? (d.nevera === 'inicio' ? d.modulos[0] : d.modulos[d.modulos.length - 1]) : 700) * esc} height={30} fill="#e2e8f0" fillOpacity={0.7} stroke="#64748b" />}
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
