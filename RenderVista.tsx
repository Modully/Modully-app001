import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Edges } from '@react-three/drei';
import type { Box } from './boxes';
import { hexDe } from './colores';
import { claveIAConfigurada, fotoConIA } from './fotoIA';

/**
 * Fase 4 · Render.
 *
 * Imagen del diseño con materiales, luces y sombras, a partir de las mismas cajas del 3D (sin cotas ni controles de edición).
 * Los colores se eligen por material (fachada, estructura, mesón, muro y piso) y la imagen se descarga en PNG para mostrarla al cliente.
 */

const COLORES: Record<string, string> = {
  blanco: '#f4f4f1', ambar: '#b8804a', cinza: '#8c8f93', gris: '#9aa0a6', grafito: '#3f4347', negro: '#232427', nuez: '#6b4a32', roble: '#b99668',
  vienes: '#a9865e', champ: '#d8c8a8', bohem: '#7a6a58', azul: '#31496b', perla: '#e9e4d8', arena: '#d9c9ad', wengue: '#3a2a22', cerezo: '#8a4b32',
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const colorDe = (nombre: string, respaldo: string) => { const n = norm(nombre); const k = Object.keys(COLORES).find(c => n.includes(c)); return k ? COLORES[k] : respaldo; };

type Papel = 'fachada' | 'estructura' | 'meson' | 'muro' | 'electro' | 'zocalo';
const OCULTAR = /^(cuerpo |hueco |cubo closet fit)/i;

function papelDe(b: Box): Papel | null {
  if (OCULTAR.test(b.name)) return null;
  if (b.kind === 'wall') return 'muro';
  if (b.kind === 'counter') return 'meson';
  if (b.kind === 'appliance') return 'electro';
  if (b.kind === 'zocalo') return 'zocalo';
  if (b.kind === 'panel') return /^(visto|puerta|frente|hoja|liston|fondo alistonado)/i.test(b.name) ? 'fachada' : 'estructura';
  return 'fachada'; // puertas, frentes, vistos, dilatadas y cubos sin convertir
}

const Campo: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
    <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
    {label}
  </label>
);

export const RenderVista: React.FC<{ boxes: Box[]; faceColor: string; lineType: string; nombre: string; estructura?: string; producto?: string | null; onGuardar?: (dataUrl: string, tipo: 'render' | 'foto_ia') => Promise<void> }> = ({ boxes, faceColor, lineType, nombre, estructura, producto, onGuardar }) => {
  const [guardado, setGuardado] = useState<string | null>(null);
  const guardarEn = async (url: string, tipo: 'render' | 'foto_ia') => { if (!onGuardar) return; setGuardado('Guardando…'); try { await onGuardar(url, tipo); setGuardado(`Guardada en ${producto}.`); } catch (e) { setGuardado(e instanceof Error ? e.message : String(e)); } };
  const fachadaIni = hexDe(faceColor, colorDe(faceColor, '#c9a26b'));
  const [col, setCol] = useState<Record<Papel | 'piso', string>>({
    fachada: fachadaIni, estructura: estructura ? hexDe(estructura, '#f4f4f1') : lineType === 'Básica' ? '#f4f4f1' : fachadaIni, meson: '#e7e5e0', muro: '#ecebe7', electro: '#b9bcc0', zocalo: '#2b2c2e', piso: '#bfae97',
  });
  const [vista, setVista] = useState(0);
  // foto con IA: la vista actual se manda a Gemini y vuelve como foto realista
  const [ia, setIa] = useState<{ estado: 'nada' | 'generando' | 'lista' | 'error'; foto?: string; error?: string }>({ estado: 'nada' });
  const [ambiente, setAmbiente] = useState('apartamento moderno y luminoso');
  const [mesonIA, setMesonIA] = useState('cuarzo blanco');
  const [extra, setExtra] = useState('');
  const lienzo = useRef<HTMLDivElement>(null);
  const controles = useRef<any>(null);

  const piezas = useMemo(() => boxes.map(b => ({ b, papel: papelDe(b) })).filter(x => x.papel) as { b: Box; papel: Papel }[], [boxes]);
  // límites del mueble (sin los muros) para encuadrar la cámara. En la escena: X = a lo largo del muro A, Y = alto, Z = hacia el frente
  const lim = useMemo(() => {
    const ms = piezas.filter(x => x.papel !== 'muro').map(x => x.b);
    const src = ms.length ? ms : piezas.map(x => x.b);
    if (!src.length) return null;
    const x0 = Math.min(...src.map(b => b.x)), x1 = Math.max(...src.map(b => b.x + b.sx)), y0 = Math.min(...src.map(b => b.y)), y1 = Math.max(...src.map(b => b.y + b.sy)), z1 = Math.max(...src.map(b => b.z + b.sz));
    const todo = piezas.map(x => x.b);
    return { cx: (x0 + x1) / 2000, cy: z1 / 2000, cz: (y0 + y1) / 2000, ancho: (x1 - x0) / 1000, alto: z1 / 1000, fondo: (y1 - y0) / 1000,
      px0: Math.min(...todo.map(b => b.x)) / 1000 - 1.5, px1: Math.max(...todo.map(b => b.x + b.sx)) / 1000 + 1.5, pz0: Math.min(...todo.map(b => b.y)) / 1000, pz1: Math.max(...todo.map(b => b.y + b.sy)) / 1000 + 4 };
  }, [piezas]);
  if (!lim) return <div className="text-sm font-bold text-slate-400">Agrega muebles al diseño para ver el render.</div>;

  const dist = Math.max(lim.ancho, lim.alto * 1.6, 1.5) * 1.15 + lim.fondo;
  const camaras: [string, [number, number, number]][] = [
    ['De frente', [lim.cx, lim.cy + 0.25, lim.cz + dist]],
    ['Desde la derecha', [lim.cx + dist * 0.62, lim.cy + 0.55, lim.cz + dist * 0.8]],
    ['Desde la izquierda', [lim.cx - dist * 0.62, lim.cy + 0.55, lim.cz + dist * 0.8]],
    ['Desde arriba', [lim.cx + dist * 0.25, lim.cy + dist * 0.75, lim.cz + dist * 0.75]],
  ];
  const generar = async () => {
    const c = lienzo.current?.querySelector('canvas');
    if (!c) return;
    setIa({ estado: 'generando' });
    try {
      const foto = await fotoConIA({ imagenPng: c.toDataURL('image/png'), producto: nombre, fachada: faceColor || 'del color que se ve en la imagen', meson: piezas.some(x => x.papel === 'meson') ? mesonIA : '', ambiente, extra });
      setIa({ estado: 'lista', foto });
    } catch (e) { setIa({ estado: 'error', error: e instanceof Error ? e.message : String(e) }); }
  };
  const descargarFoto = () => {
    if (!ia.foto) return;
    const a = document.createElement('a');
    a.href = ia.foto; a.download = `Foto_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`; a.click();
  };
  const descargar = () => {
    const c = lienzo.current?.querySelector('canvas');
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `Render_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {camaras.map(([t], i) => <button key={t} onClick={() => setVista(i)} className={`rounded-xl px-3 py-2 text-xs font-black border ${vista === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>)}
        <button onClick={descargar} className="ml-auto rounded-xl px-4 py-2 text-xs font-black bg-slate-800 text-white">Descargar imagen</button>
        {producto && onGuardar && <button onClick={() => { const c = lienzo.current?.querySelector('canvas'); if (c) guardarEn(c.toDataURL('image/png'), 'render'); }} className="rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white">Guardar en {producto}</button>}
        {guardado && <span className="w-full text-[11px] font-bold text-slate-500">{guardado}</span>}
      </div>
      <div ref={lienzo} className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100" style={{ aspectRatio: '16 / 9' }}>
        <Canvas key={vista} shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, antialias: true }} camera={{ position: camaras[vista][1], fov: 38, near: 0.05, far: 100 }}>
          <color attach="background" args={['#eef0f2']} />
          <hemisphereLight args={['#ffffff', '#cfc8bc', 1.5]} />
          <directionalLight position={[lim.cx + 3, lim.alto + 4, lim.cz + 5]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
            <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.1, 30]} />
          </directionalLight>
          <directionalLight position={[lim.cx - 4, lim.alto + 1, lim.cz + 3]} intensity={0.45} />
          {/* piso */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(lim.px0 + lim.px1) / 2, 0, (lim.pz0 + lim.pz1) / 2]} receiveShadow>
            <planeGeometry args={[lim.px1 - lim.px0, lim.pz1 - lim.pz0]} />
            <meshStandardMaterial color={col.piso} roughness={0.85} />
          </mesh>
          {piezas.map(({ b, papel }) => (
            <mesh key={b.id} position={[(b.x + b.sx / 2) / 1000, (b.z + b.sz / 2) / 1000, (b.y + b.sy / 2) / 1000]} castShadow={papel !== 'muro'} receiveShadow>
              <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
              <meshStandardMaterial color={col[papel]} roughness={papel === 'meson' ? 0.25 : papel === 'electro' ? 0.35 : papel === 'muro' ? 0.95 : 0.6} metalness={papel === 'electro' ? 0.6 : 0} />
              {papel !== 'muro' && <Edges threshold={15} color="#000000" transparent opacity={0.22} />}
            </mesh>
          ))}
          <ContactShadows position={[lim.cx, 0.002, lim.cz + lim.fondo / 2]} scale={Math.max(lim.ancho, 3) * 2} blur={2.4} opacity={0.35} far={1.2} />
          <OrbitControls ref={controles} target={[lim.cx, lim.cy, lim.cz]} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={dist * 3} />
        </Canvas>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-white rounded-2xl border border-slate-200 p-3">
        <Campo label="Fachada" value={col.fachada} onChange={v => setCol(c => ({ ...c, fachada: v }))} />
        <Campo label="Estructura" value={col.estructura} onChange={v => setCol(c => ({ ...c, estructura: v }))} />
        <Campo label="Mesón" value={col.meson} onChange={v => setCol(c => ({ ...c, meson: v }))} />
        <Campo label="Zócalo" value={col.zocalo} onChange={v => setCol(c => ({ ...c, zocalo: v }))} />
        <Campo label="Muro" value={col.muro} onChange={v => setCol(c => ({ ...c, muro: v }))} />
        <Campo label="Piso" value={col.piso} onChange={v => setCol(c => ({ ...c, piso: v }))} />
        <span className="text-[11px] font-bold text-slate-400 ml-auto">Arrastra para girar · rueda para acercar</span>
      </div>
      {/* foto con IA */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="text-sm font-black text-slate-800 uppercase tracking-tight">Foto con IA</div>
            <div className="text-[11px] font-bold text-slate-400">Convierte la vista de arriba en una foto realista. La imagen se envía al servicio de Gemini (Google) y cada foto tiene costo.</div>
          </div>
          <button onClick={generar} disabled={ia.estado === 'generando'} className="rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white disabled:opacity-50">{ia.estado === 'generando' ? 'Generando…' : ia.foto ? 'Generar otra' : 'Generar foto'}</button>
          {ia.foto && <button onClick={descargarFoto} className="rounded-xl px-4 py-2 text-xs font-black bg-slate-800 text-white">Descargar foto</button>}
          {ia.foto && producto && onGuardar && <button onClick={() => guardarEn(ia.foto!, 'foto_ia')} className="rounded-xl px-4 py-2 text-xs font-black bg-indigo-600 text-white">Guardar en {producto}</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Ambiente</span>
            <input value={ambiente} onChange={e => setAmbiente(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" /></label>
          <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Mesón</span>
            <input value={mesonIA} onChange={e => setMesonIA(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" /></label>
          <label className="block"><span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Detalles que quieras pedir</span>
            <input value={extra} onChange={e => setExtra(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800" /></label>
        </div>
        {!claveIAConfigurada() && <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Falta la clave de Gemini: ponla en el archivo .env.local como GEMINI_API_KEY y reinicia la app.</div>}
        {ia.estado === 'error' && <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{ia.error}</div>}
        {ia.foto && <img src={ia.foto} alt="Foto generada con IA" className="w-full rounded-2xl border border-slate-200" />}
        {ia.foto && <div className="text-[11px] font-bold text-slate-400">La IA puede cambiar detalles del mueble. Compara la foto con el diseño antes de mostrarla; las medidas y el despiece salen siempre del diseño, no de la foto.</div>}
      </div>
    </div>
  );
};
