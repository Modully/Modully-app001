import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Edges, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Sparkles, Check, Download, Share2, Sun, Sunset, Loader2, Box as BoxIcon, Image as ImageIcon } from 'lucide-react';
import { applianceCenter, counterTopZ, findModuleBox, type Box } from './boxes';
import type { Appliance, KitchenModule } from './types';
import { hexConVeta, hexDe } from './colores';
import { texturaVeta } from './veta';
import { claveIAConfigurada, fotoConIA } from './fotoIA';

RectAreaLightUniformsLib.init();

const PISOS_IA = [
  { id: 'beige', label: 'Porcelanato Beige', swatch: '#E2D8C8', vein: false, prompt: 'porcelanato beige mate de formato grande' },
  { id: 'madera', label: 'Madera Clara', swatch: '#D5B58B', vein: false, prompt: 'piso laminado de madera roble claro natural' },
  { id: 'cemento', label: 'Gris Cemento', swatch: '#9CA3AF', vein: false, prompt: 'porcelanato gris cemento pulido minimalista' },
  { id: 'marmol', label: 'Mármol Blanco', swatch: '#F5F6F8', vein: true, prompt: 'mármol blanco brillante con vetas grises sutiles' },
] as const;

const LUCES_IA = [
  { id: 'dia', label: 'Luz Día', prompt: 'iluminación natural diurna suave entrando desde un lateral' },
  { id: 'calida', label: 'Luz Cálida', prompt: 'iluminación cálida de atardecer acogedor' },
] as const;

/**
 * Fase 4 · Render.
 *
 * Vista arquitectónica y renderizado realista del diseño a partir de las mismas cajas del 3D y electrodomésticos
 * (incluyendo poceta, grifería, estufa, campanas, vetas de madera y acabado tipo estudio europeo).
 */

const COLORES: Record<string, string> = {
  blanco: '#F4F4F2', ambar: '#b8804a', cinza: '#8c8f93', gris: '#9aa0a6', grafito: '#3f4347', negro: '#232427', nuez: '#6b4a32', roble: '#b99668',
  vienes: '#a9865e', champ: '#d8c8a8', bohem: '#7a6a58', azul: '#31496b', perla: '#e9e4d8', arena: '#d9c9ad', wengue: '#3a2a22', cerezo: '#8a4b32',
};
const normBlanco = (hex: string) => (/^#(ffffff|f8fafc|f4f4f1|f9fafb)$/i.test(hex.trim()) ? '#F4F4F2' : hex);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const colorDe = (nombre: string, respaldo: string) => { const n = norm(nombre); const k = Object.keys(COLORES).find(c => n.includes(c)); return k ? COLORES[k] : respaldo; };

type Papel = 'fachadaMA' | 'fachadaMB' | 'estructura' | 'meson' | 'muro' | 'electro' | 'zocalo';
const OCULTAR = /^(cuerpo |hueco |cubo closet fit)/i;

function esSuperior(b: Box, modById: Map<string, KitchenModule>): boolean {
  if (b.kind === 'upper') return true;
  if (b.id.includes('-upper-')) return true;
  const mod = b.moduleId ? modById.get(b.moduleId) : undefined;
  return mod?.type === 'UPPER';
}

function papelDe(b: Box, modById: Map<string, KitchenModule>): Papel | null {
  if (OCULTAR.test(b.name)) return null;
  if (b.kind === 'wall') return 'muro';
  if (b.kind === 'counter') return 'meson';
  if (b.kind === 'appliance') return 'electro';
  if (b.kind === 'zocalo') return 'zocalo';
  const sup = esSuperior(b, modById);
  if (b.kind === 'panel') {
    if (b.expuesto) return sup ? 'fachadaMA' : 'fachadaMB';
    return /^(visto|puerta|frente|hoja|liston|fondo alistonado)/i.test(b.name) ? (sup ? 'fachadaMA' : 'fachadaMB') : 'estructura';
  }
  return sup ? 'fachadaMA' : 'fachadaMB';
}

function prng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

const cacheMeson = new Map<string, THREE.CanvasTexture>();
function texturaCuarzo(hex: string): THREE.CanvasTexture {
  const k = hex.toLowerCase();
  const hit = cacheMeson.get(k);
  if (hit) return hit;
  const N = 512, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  g.fillStyle = k; g.fillRect(0, 0, N, N);
  const rnd = prng(`meson-${k}`);
  // vetas suaves de cuarzo/mármol
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = rnd() > 0.35 ? `rgba(148,163,184,${0.05 + rnd() * 0.08})` : `rgba(255,255,255,${0.08 + rnd() * 0.12})`;
    g.lineWidth = 0.8 + rnd() * 2.2;
    g.beginPath();
    let x = rnd() * N, y = rnd() * N;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rnd() - 0.3) * 95;
      y += (rnd() - 0.5) * 65;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // micro-grano mineral
  for (let i = 0; i < 420; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(100,116,139,0.05)' : 'rgba(255,255,255,0.08)';
    g.fillRect(rnd() * N, rnd() * N, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.85, 0.85);
  t.anisotropy = 4;
  cacheMeson.set(k, t);
  return t;
}

const cachePiso = new Map<string, THREE.CanvasTexture>();
function texturaPiso(hex: string): THREE.CanvasTexture {
  const k = hex.toLowerCase();
  const hit = cachePiso.get(k);
  if (hit) return hit;
  const N = 512, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#EDEBE6';
  g.fillRect(0, 0, N, N);
  // Piso de estudio tipo ciclorama: centro cálido mate que se difumina suavemente hacia el horizonte #EDEBE6
  const grad = g.createRadialGradient(N / 2, N / 2, N * 0.06, N / 2, N / 2, N * 0.46);
  grad.addColorStop(0, k);
  grad.addColorStop(0.45, k);
  grad.addColorStop(1, 'rgba(237,235,230,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  const rnd = prng(`piso-${k}`);
  for (let i = 0; i < 480; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.02)';
    g.fillRect(rnd() * N, rnd() * N, 3 + rnd() * 7, 2 + rnd() * 4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cachePiso.set(k, t);
  return t;
}

const cacheMadera = new Map<string, THREE.CanvasTexture>();
function texturaMaderaRealista(hex: string): THREE.CanvasTexture {
  const k = hex.toLowerCase();
  const hit = cacheMadera.get(k);
  if (hit) return hit;
  const N = 512, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  g.fillStyle = k; g.fillRect(0, 0, N, N);
  const rnd = prng(`madera-${k}`);
  // Tablas suaves y vetas orgánicas de baja saturación/contraste (roble europeo realista)
  for (let i = 0; i < 18; i++) {
    const x = rnd() * N, w = 16 + rnd() * 42;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)';
    g.fillRect(x, 0, w, N);
  }
  for (let i = 0; i < 240; i++) {
    const x0 = rnd() * N, amp = 1 + rnd() * 3.5, fase = rnd() * 6.28, frec = 0.005 + rnd() * 0.01;
    g.strokeStyle = rnd() > 0.45 ? `rgba(0,0,0,${0.025 + rnd() * 0.055})` : `rgba(255,255,255,${0.02 + rnd() * 0.045})`;
    g.lineWidth = 0.5 + rnd() * 1.2;
    g.beginPath();
    for (let y = 0; y <= N; y += 8) {
      const x = x0 + Math.sin(y * frec * 6.28 + fase) * amp;
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cacheMadera.set(k, t);
  return t;
}

/** Construye una losa extruida en metros (sistema de coordenadas de RenderVista: X = x, Y = z, Z = y) con huecos de poceta/estufa y muescas */
const BoxConHuecos: React.FC<{
  b: Box;
  extraCutouts?: Array<{ x: number; y: number; sx: number; sy: number }>;
  material: React.ReactNode;
  castShadow?: boolean;
  receiveShadow?: boolean;
  showEdges?: boolean;
}> = ({ b, extraCutouts, material, castShadow = true, receiveShadow = true, showEdges = false }) => {
  const holes = useMemo(() => [...(b.cutouts ?? []), ...(extraCutouts ?? [])], [b.cutouts, extraCutouts]);
  const holesKey = JSON.stringify(holes);
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    const x0 = b.x / 1000, x1 = (b.x + b.sx) / 1000, v0 = -b.y / 1000, v1 = -(b.y + b.sy) / 1000;
    if (b.polygon && b.polygon.length >= 3) {
      b.polygon.forEach(([px, py], i) => (i === 0 ? shape.moveTo(px / 1000, -py / 1000) : shape.lineTo(px / 1000, -py / 1000)));
      shape.closePath();
    } else if (b.notches && b.notches.length > 0) {
      const wl = b.wall;
      const aMin = wl === 'A' ? b.x : b.y, aMax = wl === 'A' ? b.x + b.sx : b.y + b.sy;
      const cMin = wl === 'C' ? (b.x + b.sx) : wl === 'B' ? b.x : b.y;
      const cFront = wl === 'C' ? b.x : wl === 'B' ? (b.x + b.sx) : (b.y + b.sy);
      const sgn = wl === 'C' ? -1 : 1;
      const pt = (a: number, c: number): [number, number] => (wl === 'A' ? [a / 1000, -c / 1000] : [c / 1000, -a / 1000]);
      const add = (p: [number, number], first = false) => (first ? shape.moveTo(p[0], p[1]) : shape.lineTo(p[0], p[1]));
      add(pt(aMin, cFront), true);
      add(pt(aMax, cFront));
      const list = [...b.notches].sort((p, q) => q.a0 - p.a0);
      if (Math.abs(list[0]?.a1 - aMax) > 0.5) add(pt(aMax, cMin));
      list.forEach(nn => {
        const cn = cMin + sgn * nn.c;
        add(pt(nn.a1, cn));
        add(pt(nn.a0, cn));
        if (Math.abs(nn.a0 - aMin) > 0.5) add(pt(nn.a0, cMin));
      });
      if (Math.abs(list[list.length - 1]?.a0 - aMin) > 0.5) add(pt(aMin, cMin));
      shape.closePath();
    } else {
      shape.moveTo(x0, v0); shape.lineTo(x1, v0); shape.lineTo(x1, v1); shape.lineTo(x0, v1); shape.closePath();
    }
    holes.forEach(c => {
      const hole = new THREE.Path();
      const a0 = c.x / 1000, a1 = (c.x + c.sx) / 1000, c0 = -c.y / 1000, c1 = -(c.y + c.sy) / 1000;
      hole.moveTo(a0, c0); hole.lineTo(a0, c1); hole.lineTo(a1, c1); hole.lineTo(a1, c0); hole.closePath();
      shape.holes.push(hole);
    });
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.sz / 1000, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [b.x, b.y, b.sx, b.sy, b.sz, holesKey, JSON.stringify(b.notches), JSON.stringify(b.polygon)]);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
    <mesh geometry={geom} position={[0, b.z / 1000, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {material}
      {showEdges && <Edges threshold={15} color="#000000" transparent opacity={0.18} />}
    </mesh>
  );
};

/** Poceta con cubeta honda de acero, desagüe y grifería cuello de ganso cromada */
const SinkRender3D: React.FC<{
  app: Appliance;
  position: [number, number, number];
  rotation: [number, number, number];
  realista: boolean;
  faucetFront?: boolean;
}> = ({ app, position, rotation, realista, faucetFront = false }) => {
  const cw = (app.width - 60) / 1000;
  const cd = (app.depth - 60) / 1000;
  const bh = 0.175;
  const t = 0.003;
  const rim = 0.022;

  const spoutGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.03, 0),
      new THREE.Vector3(0, 0.24, 0),
      new THREE.Vector3(0, 0.33, 0.045),
      new THREE.Vector3(0, 0.34, 0.115),
      new THREE.Vector3(0, 0.275, 0.155),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.0115, 16, false);
  }, []);
  useEffect(() => () => spoutGeo.dispose(), [spoutGeo]);

  const steelColor = '#B8BCC0';
  const steelProps = { color: steelColor, metalness: 0.75, roughness: 0.32 };
  const chromeProps = { color: '#C8CCD0', metalness: 0.82, roughness: 0.22 };

  return (
    <group position={position} rotation={rotation}>
      {/* Cubeta de acero inoxidable */}
      <mesh position={[0, -bh, 0]} receiveShadow><boxGeometry args={[cw, t, cd]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[0, -bh / 2, cd / 2]} receiveShadow><boxGeometry args={[cw, bh, t]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[0, -bh / 2, -cd / 2]} receiveShadow><boxGeometry args={[cw, bh, t]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[cw / 2, -bh / 2, 0]} receiveShadow><boxGeometry args={[t, bh, cd]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[-cw / 2, -bh / 2, 0]} receiveShadow><boxGeometry args={[t, bh, cd]} /><meshStandardMaterial {...steelProps} /></mesh>
      {/* Desagüe en el fondo de la cubeta */}
      <mesh position={[0, -bh + 0.0025, 0]}><cylinderGeometry args={[0.042, 0.042, 0.003, 24]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.25} /></mesh>
      <mesh position={[0, -bh + 0.0038, 0]}><cylinderGeometry args={[0.022, 0.022, 0.003, 20]} /><meshStandardMaterial color="#1f2937" roughness={0.7} /></mesh>
      {/* Marco borde sobre el mesón */}
      <mesh position={[0, 0.0025, cd / 2 + rim / 2]} castShadow receiveShadow><boxGeometry args={[cw + 2 * rim, 0.005, rim]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[0, 0.0025, -cd / 2 - rim / 2]} castShadow receiveShadow><boxGeometry args={[cw + 2 * rim, 0.005, rim]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[cw / 2 + rim / 2, 0.0025, 0]} castShadow receiveShadow><boxGeometry args={[rim, 0.005, cd]} /><meshStandardMaterial {...steelProps} /></mesh>
      <mesh position={[-cw / 2 - rim / 2, 0.0025, 0]} castShadow receiveShadow><boxGeometry args={[rim, 0.005, cd]} /><meshStandardMaterial {...steelProps} /></mesh>
      {/* Grifería cuello de ganso */}
      <group position={[0, 0, (faucetFront ? 1 : -1) * (cd / 2 + rim + 0.032)]} rotation={[0, faucetFront ? Math.PI : 0, 0]}>
        <mesh position={[0, 0.018, 0]} castShadow><cylinderGeometry args={[0.026, 0.032, 0.036, 20]} /><meshStandardMaterial {...chromeProps} /></mesh>
        <mesh geometry={spoutGeo} castShadow><meshStandardMaterial {...chromeProps} /></mesh>
        <mesh position={[0, 0.272, 0.155]} castShadow><cylinderGeometry args={[0.014, 0.014, 0.016, 16]} /><meshStandardMaterial {...chromeProps} /></mesh>
        <mesh position={[0.044, 0.068, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.007, 0.008, 0.068, 12]} /><meshStandardMaterial {...chromeProps} /></mesh>
      </group>
    </group>
  );
};

/** Estufa de inducción / vitrocerámica en render */
const StoveRender3D: React.FC<{ app: Appliance; position: [number, number, number]; rotation: [number, number, number]; realista: boolean }> = ({ app, position, rotation, realista }) => (
  <group position={position} rotation={rotation}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[app.width / 1000, 0.014, app.depth / 1000]} />
      <meshStandardMaterial color="#0b0d10" metalness={realista ? 0.3 : 0.7} roughness={realista ? 0.06 : 0.15} />
    </mesh>
    <group position={[0, 0.0078, 0]}>
      <mesh position={[-0.14, 0, -0.095]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.06, 0.064, 32]} /><meshBasicMaterial color="#e2e8f0" transparent opacity={0.28} /></mesh>
      <mesh position={[0.14, 0, -0.095]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.078, 0.082, 32]} /><meshBasicMaterial color="#e2e8f0" transparent opacity={0.28} /></mesh>
      <mesh position={[-0.12, 0, 0.105]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.07, 0.074, 32]} /><meshBasicMaterial color="#e2e8f0" transparent opacity={0.28} /></mesh>
      <mesh position={[0.13, 0, 0.105]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.06, 0.064, 32]} /><meshBasicMaterial color="#e2e8f0" transparent opacity={0.28} /></mesh>
    </group>
  </group>
);

const Campo: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
    <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-7 h-7 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
    {label}
  </label>
);

export const RenderVista: React.FC<{
  boxes: Box[];
  appliances?: Appliance[];
  modules?: KitchenModule[];
  wallA?: number;
  spaceHeight?: number;
  zocaloHeight?: number;
  faceColor: string;
  faceColorMA?: string;
  lineType: string;
  nombre: string;
  estructura?: string;
  producto?: string | null;
  onGuardar?: (dataUrl: string, tipo: 'render' | 'foto_ia') => Promise<void>;
}> = ({
  boxes,
  appliances = [],
  modules = [],
  wallA = 3600,
  spaceHeight = 2400,
  zocaloHeight = 100,
  faceColor,
  faceColorMA,
  lineType,
  nombre,
  estructura,
  producto,
  onGuardar,
}) => {
  const [guardado, setGuardado] = useState<string | null>(null);
  const guardarEn = async (url: string, tipo: 'render' | 'foto_ia') => { if (!onGuardar) return; setGuardado('Guardando…'); try { await onGuardar(url, tipo); setGuardado(`Guardada en ${producto}.`); } catch (e) { setGuardado(e instanceof Error ? e.message : String(e)); } };
  const fachadaMBIni = normBlanco(hexDe(faceColor, colorDe(faceColor, '#c9a26b')));
  const fachadaMAIni = faceColorMA ? normBlanco(hexDe(faceColorMA, colorDe(faceColorMA, fachadaMBIni))) : fachadaMBIni;
  const [col, setCol] = useState<Record<Papel | 'piso', string>>({
    fachadaMA: fachadaMAIni,
    fachadaMB: fachadaMBIni,
    estructura: estructura ? normBlanco(hexDe(estructura, '#F4F4F2')) : lineType === 'Básica' ? '#F4F4F2' : fachadaMBIni,
    meson: '#eceae4',
    muro: '#f1f0ec',
    electro: '#B8BCC0',
    zocalo: '#2b2c2e',
    piso: '#EDEBE6',
  });
  const [vista, setVista] = useState(0);
  const [realista, setRealista] = useState(true);
  const [renderizando, setRenderizando] = useState(false);

  // Foto Realista con IA (Gemini Image-to-Image)
  const [ia, setIa] = useState<{ estado: 'nada' | 'generando' | 'lista' | 'error'; foto?: string; error?: string }>({ estado: 'nada' });
  const [pisoIA, setPisoIA] = useState<(typeof PISOS_IA)[number]['id']>('beige');
  const [luzIA, setLuzIA] = useState<(typeof LUCES_IA)[number]['id']>('dia');
  const [verFotoIA, setVerFotoIA] = useState(false);
  const lienzo = useRef<HTMLDivElement>(null);
  const controles = useRef<any>(null);

  const modById = useMemo(() => new Map(modules.map(m => [m.uniqueId, m])), [modules]);
  const detailedModules = useMemo(
    () => new Set(boxes.filter(b => b.moduleId && (b.kind === 'panel' || b.kind === 'front')).map(b => b.moduleId!)),
    [boxes],
  );
  const sinkCutouts = useMemo(
    () => boxes.filter(b => b.kind === 'counter').flatMap(b => (b.cutouts ?? []).filter(c => c.label === 'Poceta')),
    [boxes],
  );

  // Filtramos las cajas: omitimos las envolventes sólidas de módulos ya convertidos a piezas para evitar traslape (z-fighting)
  const piezas = useMemo(() => {
    const out: { b: Box; papel: Papel }[] = [];
    boxes.forEach(b => {
      if ((b.kind === 'lower' || b.kind === 'upper' || b.kind === 'tall') && b.moduleId && detailedModules.has(b.moduleId)) return;
      const papel = papelDe(b, modById);
      if (papel) out.push({ b, papel });
    });
    return out;
  }, [boxes, detailedModules, modById]);

  const lim = useMemo(() => {
    const ms = piezas.filter(x => x.papel !== 'muro').map(x => x.b);
    const src = ms.length ? ms : piezas.map(x => x.b);
    if (!src.length) return null;
    const x0 = Math.min(...src.map(b => b.x)), x1 = Math.max(...src.map(b => b.x + b.sx)), y0 = Math.min(...src.map(b => b.y)), y1 = Math.max(...src.map(b => b.y + b.sy)), z1 = Math.max(...src.map(b => b.z + b.sz));
    const todo = piezas.map(x => x.b);
    return {
      cx: (x0 + x1) / 2000, cy: z1 / 2000, cz: (y0 + y1) / 2000, ancho: (x1 - x0) / 1000, alto: z1 / 1000, fondo: (y1 - y0) / 1000,
      px0: Math.min(...todo.map(b => b.x)) / 1000 - 1.5, px1: Math.max(...todo.map(b => b.x + b.sx)) / 1000 + 1.5, pz0: Math.min(...todo.map(b => b.y)) / 1000, pz1: Math.max(...todo.map(b => b.y + b.sy)) / 1000 + 4,
    };
  }, [piezas]);
  if (!lim) return <div className="text-sm font-bold text-slate-400">Agrega muebles al diseño para ver el render.</div>;

  const dist = Math.max(lim.ancho, lim.alto * 1.6, 1.5) * 1.15 + lim.fondo;
  const camaras: [string, [number, number, number]][] = [
    ['De frente', [lim.cx, lim.cy + 0.25, lim.cz + dist]],
    ['Desde la derecha', [lim.cx + dist * 0.62, lim.cy + 0.55, lim.cz + dist * 0.8]],
    ['Desde la izquierda', [lim.cx - dist * 0.62, lim.cy + 0.55, lim.cz + dist * 0.8]],
    ['Desde arriba', [lim.cx + dist * 0.25, lim.cy + dist * 0.75, lim.cz + dist * 0.75]],
  ];

  const ejecutarRender = () => {
    setVerFotoIA(false);
    setRenderizando(true);
    setRealista(true);
    setTimeout(() => {
      setRenderizando(false);
      setGuardado('Render realista actualizado.');
    }, 350);
  };

  const generar = async () => {
    const c = lienzo.current?.querySelector('canvas');
    if (!c) return;
    const pisoSel = PISOS_IA.find(x => x.id === pisoIA) ?? PISOS_IA[0];
    const luzSel = LUCES_IA.find(x => x.id === luzIA) ?? LUCES_IA[0];
    setIa(prev => ({ ...prev, estado: 'generando', error: undefined }));
    try {
      const foto = await fotoConIA({
        imagenPng: c.toDataURL('image/png'),
        pisoPrompt: pisoSel.prompt,
        luzPrompt: luzSel.prompt,
        producto: nombre,
      });
      setIa({ estado: 'lista', foto });
      setVerFotoIA(true);
      setGuardado('Foto realista generada con IA.');
    } catch (e) {
      setIa(prev => ({ ...prev, estado: 'error', error: e instanceof Error ? e.message : String(e) }));
    }
  };
  const descargar = () => {
    if (verFotoIA && ia.foto) {
      const a = document.createElement('a');
      a.href = ia.foto;
      a.download = `Foto_IA_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      return;
    }
    const c = lienzo.current?.querySelector('canvas');
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `Render_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };
  const compartirOCopiar = () => {
    const c = lienzo.current?.querySelector('canvas');
    if (!c) return;
    c.toBlob(async blob => {
      if (!blob) return;
      const archivo = new File([blob], `Render_${nombre.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ files: [archivo], title: `Render · ${nombre}` });
          setGuardado('Imagen compartida.');
          return;
        }
      } catch {
        // usuario canceló o compartir no disponible: intentamos copiar
      }
      try {
        if (navigator.clipboard && 'ClipboardItem' in window) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setGuardado('Imagen copiada al portapapeles.');
          return;
        }
      } catch {
        // sin permisos de portapapeles
      }
      setGuardado('No se pudo copiar desde este navegador; usa Descargar imagen.');
    }, 'image/png');
  };

  // Texturas PBR generadas localmente en memoria
  const texMeson = texturaCuarzo(col.meson);
  const texPiso = texturaPiso(col.piso);
  const texMA = hexConVeta(col.fachadaMA) ? (realista ? texturaMaderaRealista(col.fachadaMA) : texturaVeta(col.fachadaMA)) : null;
  const texMB = hexConVeta(col.fachadaMB) ? (realista ? texturaMaderaRealista(col.fachadaMB) : texturaVeta(col.fachadaMB)) : null;

  const counterTop = counterTopZ(boxes, zocaloHeight + 800) / 1000;
  const activosElectro = appliances.filter(a => a.active && a.type !== 'dishwasher' && a.type !== 'oven' && a.type !== 'oven-compact' && !(a.type === 'hood-under' && a.campanaTipo === 'libre'));

  // Tiras LED continuas cálidas (#FFE8C8) bajo muebles altos
  const upperRaw = useMemo(() => boxes.filter(b => b.kind === 'upper'), [boxes]);

  // Tomacorrientes discretos en el salpicadero del muro A (solo si hay mesón y pared A sin obstrucción)
  const wallOutlets = useMemo(() => {
    if (!realista) return [];
    const counterA = boxes.find(b => b.kind === 'counter' && b.wall === 'A');
    const wallABox = boxes.find(b => b.kind === 'wall' && b.id.includes('A'));
    if (!counterA || !wallABox || counterA.sx < 900) return [];
    const cands = [counterA.x + counterA.sx * 0.22, counterA.x + counterA.sx * 0.78];
    return cands.filter(cx => {
      const blockedByApp = activosElectro.some(a => {
        if (a.wall !== 'A') return false;
        const ctr = applianceCenter(a, wallA);
        return Math.abs(cx - ctr.x) < a.width / 2 + 120;
      });
      return !blockedByApp;
    });
  }, [realista, boxes, activosElectro, wallA]);

  const matPara = (papel: Papel) => {
    if (papel === 'meson') {
      return realista
        ? <meshPhysicalMaterial key={`meson-r-${col.meson}`} color="#ffffff" map={texMeson} roughness={0.2} metalness={0.02} clearcoat={0.28} clearcoatRoughness={0.22} />
        : <meshStandardMaterial key={`meson-p-${col.meson}`} color={col.meson} roughness={0.28} />;
    }
    if (papel === 'fachadaMA' || papel === 'fachadaMB') {
      const hex = normBlanco(col[papel]);
      const tex = papel === 'fachadaMA' ? texMA : texMB;
      return tex
        ? <meshStandardMaterial key={`${papel}-v-${realista}-${hex}`} color="#ffffff" map={tex} roughness={0.65} metalness={0.0} />
        : <meshStandardMaterial key={`${papel}-l-${realista}-${hex}`} color={hex} roughness={0.72} metalness={0.02} />;
    }
    if (papel === 'electro') {
      return <meshStandardMaterial color={col.electro} metalness={0.75} roughness={0.32} />;
    }
    if (papel === 'muro') {
      return <meshStandardMaterial color={normBlanco(col.muro)} roughness={0.92} metalness={0.0} />;
    }
    if (papel === 'zocalo') {
      return <meshStandardMaterial color={col.zocalo} roughness={0.55} metalness={0.1} />;
    }
    return <meshStandardMaterial color={normBlanco(col.estructura)} roughness={0.72} metalness={0.02} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {camaras.map(([t], i) => (
          <button
            key={t}
            type="button"
            onClick={() => { setVista(i); setVerFotoIA(false); }}
            className={`rounded-xl px-3.5 py-2 text-xs border transition-colors ${!verFotoIA && vista === i ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-medium'}`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {ia.foto && (
            <button
              type="button"
              onClick={() => setVerFotoIA(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 transition-colors"
            >
              {verFotoIA ? <BoxIcon size={14} /> : <ImageIcon size={14} />}
              <span>{verFotoIA ? 'Ver 3D' : 'Ver Foto IA'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setVerFotoIA(false); setRealista(r => !r); }}
            className={`rounded-xl px-3 py-2 text-xs border transition-colors ${!verFotoIA && realista ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 font-medium'}`}
            title="Alternar entre vista previa y acabado realista 3D"
          >
            {realista ? 'Acabado realista' : 'Vista previa'}
          </button>
          <button
            type="button"
            onClick={ejecutarRender}
            disabled={renderizando}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-60 transition-colors"
          >
            {renderizando ? <Sparkles size={14} className="animate-spin" /> : realista ? <Check size={14} /> : <Sparkles size={14} />}
            <span>{renderizando ? 'Renderizando…' : 'Renderizar'}</span>
          </button>
          <button
            type="button"
            onClick={compartirOCopiar}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
          >
            <Share2 size={14} />
            <span>Copiar / Compartir</span>
          </button>
          {producto && onGuardar && (
            <button
              type="button"
              onClick={() => {
                if (verFotoIA && ia.foto) { guardarEn(ia.foto, 'foto_ia'); return; }
                const c = lienzo.current?.querySelector('canvas');
                if (c) guardarEn(c.toDataURL('image/png'), 'render');
              }}
              className="rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
            >
              Guardar en {producto}
            </button>
          )}
          <button
            type="button"
            onClick={descargar}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-colors"
          >
            <Download size={14} />
            <span>Descargar imagen</span>
          </button>
        </div>
        {guardado && <span className="w-full text-xs text-slate-500">{guardado}</span>}
      </div>

      <div ref={lienzo} className="relative w-full rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm bg-[#EDEBE6]" style={{ aspectRatio: '16 / 9' }}>
        {verFotoIA && ia.foto && (
          <div className="absolute inset-0 z-10 bg-[#EDEBE6]">
            <img src={ia.foto} alt="Foto realista generada con IA" className="w-full h-full object-contain" />
            <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-white/90 backdrop-blur border border-slate-200/80 text-indigo-600 shadow-sm">
              <Sparkles size={12} />
              <span>Foto Realista (IA)</span>
            </span>
          </div>
        )}
        {ia.estado === 'generando' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/35 backdrop-blur-sm">
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/95 border border-slate-200 shadow-lg text-sm font-semibold text-slate-900">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span>Renderizando acabado fotorrealista...</span>
            </div>
          </div>
        )}
        <Canvas
          key={`${vista}-${realista ? 'r' : 'p'}`}
          shadows="soft"
          dpr={realista ? [1.5, 2] : [1, 2]}
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
          camera={{ position: camaras[vista][1], fov: 38, near: 0.05, far: 100 }}
        >
          <color attach="background" args={['#EDEBE6']} />
          <hemisphereLight args={['#fffdf9', '#d8d1c7', 0.48]} />
          <directionalLight position={[lim.cx + 3.2, lim.alto + 4.8, lim.cz + 5.2]} intensity={1.35} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} shadow-radius={4}>
            <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.1, 30]} />
          </directionalLight>

          {/* Mapa de entorno suave (baja intensidad 0.45 para reflejo satinado real sin brillo quemado en la nevera) */}
          <Environment frames={1} resolution={256} environmentIntensity={0.45}>
            <color attach="background" args={['#e5e3de']} />
            <Lightformer form="rect" intensity={1.6} color="#fffaf2" position={[0, 6, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 6, 1]} />
            <Lightformer form="rect" intensity={0.9} color="#eef4fb" position={[-6, 3, -2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 4, 1]} />
            <Lightformer form="rect" intensity={0.8} color="#fff7ed" position={[6, 3, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 4, 1]} />
          </Environment>

          {/* Piso continuo tipo ciclorama mate (#EDEBE6) */}
          {realista ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lim.cx, -0.001, lim.cz]} receiveShadow>
              <circleGeometry args={[Math.max(8, lim.ancho * 3.5), 64]} />
              <meshStandardMaterial key={`piso-r-${col.piso}`} color="#ffffff" map={texPiso} roughness={0.88} metalness={0.0} />
            </mesh>
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(lim.px0 + lim.px1) / 2, 0, (lim.pz0 + lim.pz1) / 2]} receiveShadow>
              <planeGeometry args={[lim.px1 - lim.px0, lim.pz1 - lim.pz0]} />
              <meshStandardMaterial key={`piso-p-${col.piso}`} color={col.piso} roughness={0.88} metalness={0.0} />
            </mesh>
          )}

          {/* Tira LED continua cálida (#FFE8C8) bajo muebles altos con RectAreaLight suave sobre el salpicadero */}
          {realista && upperRaw.map((u, idx) => {
            const alongA = u.wall === 'A';
            const lx = alongA ? (u.x + u.sx / 2) / 1000 : u.wall === 'B' ? (u.x + 45) / 1000 : (u.x + u.sx - 45) / 1000;
            const lz = alongA ? (u.y + 45) / 1000 : (u.y + u.sy / 2) / 1000;
            const rotY = u.wall === 'B' ? Math.PI / 2 : u.wall === 'C' ? -Math.PI / 2 : 0;
            const wLen = Math.max(0.12, (alongA ? u.sx : u.sy) / 1000 - 0.02);
            return (
              <group key={`led-${idx}`} position={[lx, u.z / 1000 - 0.003, lz]} rotation={[0, rotY, 0]}>
                <mesh>
                  <boxGeometry args={[wLen, 0.004, 0.014]} />
                  <meshBasicMaterial color="#FFE8C8" />
                </mesh>
                <rectAreaLight color="#FFE8C8" intensity={1.35} width={wLen} height={0.045} position={[0, -0.004, 0]} rotation={[-Math.PI / 2 + 0.2, 0, 0]} />
              </group>
            );
          })}

          {/* Tomacorrientes discretos en el salpicadero del muro A */}
          {wallOutlets.map((cx, idx) => (
            <group key={`out-${idx}`} position={[cx / 1000, counterTop + 0.145, 0.004]}>
              <mesh><boxGeometry args={[0.105, 0.068, 0.007]} /><meshStandardMaterial color="#F4F4F2" roughness={0.5} /></mesh>
              <mesh position={[-0.022, 0, 0.004]}><boxGeometry args={[0.022, 0.032, 0.002]} /><meshStandardMaterial color="#e2e8f0" roughness={0.6} /></mesh>
              <mesh position={[0.022, 0, 0.004]}><boxGeometry args={[0.022, 0.032, 0.002]} /><meshStandardMaterial color="#e2e8f0" roughness={0.6} /></mesh>
            </group>
          ))}

          {/* Módulos, piezas, frentes y mesones (con aberturas reales) */}
          {piezas.map(({ b, papel }) => {
            const conAbertura = b.kind === 'counter' && ((b.cutouts && b.cutouts.length > 0) || (b.notches && b.notches.length > 0) || (b.polygon && b.polygon.length >= 3));
            const extraPoceta = !conAbertura && b.kind === 'lower'
              ? sinkCutouts.filter(c => c.x + c.sx / 2 >= b.x - 1 && c.x + c.sx / 2 <= b.x + b.sx + 1 && c.y + c.sy / 2 >= b.y - 1 && c.y + c.sy / 2 <= b.y + b.sy + 1)
              : [];
            if (conAbertura || extraPoceta.length > 0) {
              return (
                <BoxConHuecos
                  key={b.id}
                  b={b}
                  extraCutouts={extraPoceta}
                  material={matPara(papel)}
                  castShadow
                  receiveShadow
                  showEdges={!realista}
                />
              );
            }
            const showEdge = b.kind === 'front' || (!realista && papel !== 'muro');
            return (
              <mesh key={b.id} position={[(b.x + b.sx / 2) / 1000, (b.z + b.sz / 2) / 1000, (b.y + b.sy / 2) / 1000]} castShadow={papel !== 'muro'} receiveShadow>
                <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
                {matPara(papel)}
                {showEdge && <Edges threshold={25} color={realista ? '#1c1917' : '#000000'} transparent opacity={realista ? 0.14 : 0.18} />}
              </mesh>
            );
          })}

          {/* Electrodomésticos y detalles realistas (poceta, grifería, estufa, nevera, campana) */}
          {activosElectro.map((app, idx) => {
            const appBox = boxes.find(bx => bx.applianceType === app.type && bx.wall === app.wall);
            const ctr = appBox ? { x: appBox.x + appBox.sx / 2, y: appBox.y + appBox.sy / 2 } : applianceCenter(app, wallA);
            const rotY = app.wall === 'B' ? Math.PI / 2 : app.wall === 'C' ? -Math.PI / 2 : 0;

            if (app.type === 'sink') {
              return <SinkRender3D key={`el-${idx}`} app={app} position={[ctr.x / 1000, counterTop, ctr.y / 1000]} rotation={[0, rotY, 0]} realista={realista} />;
            }
            if (app.type === 'stove') {
              return <StoveRender3D key={`el-${idx}`} app={app} position={[ctr.x / 1000, counterTop + 0.007, ctr.y / 1000]} rotation={[0, rotY, 0]} realista={realista} />;
            }
            if (app.type === 'fridge') {
              const fy = app.height / 2000;
              const fh = app.height / 1000;
              const fw = app.width / 1000;
              return (
                <group key={`el-${idx}`} position={[ctr.x / 1000, fy, ctr.y / 1000]} rotation={[0, rotY, 0]}>
                  <group position={[0, 0, app.depth / 2000 + 0.008]}>
                    {/* Juntas de puerta francesa + cajón inferior congelador */}
                    <mesh position={[0, fh * 0.16, -0.003]}><boxGeometry args={[0.004, fh * 0.68, 0.008]} /><meshStandardMaterial color="#1f2937" roughness={0.6} /></mesh>
                    <mesh position={[0, -fh * 0.18, -0.003]}><boxGeometry args={[fw, 0.005, 0.008]} /><meshStandardMaterial color="#1f2937" roughness={0.6} /></mesh>
                    {/* Manijas acero satinado */}
                    <mesh position={[-0.045, fh * 0.16, 0.015]} castShadow><boxGeometry args={[0.016, fh * 0.42, 0.016]} /><meshStandardMaterial color="#B8BCC0" metalness={0.78} roughness={0.28} /></mesh>
                    <mesh position={[0.045, fh * 0.16, 0.015]} castShadow><boxGeometry args={[0.016, fh * 0.42, 0.016]} /><meshStandardMaterial color="#B8BCC0" metalness={0.78} roughness={0.28} /></mesh>
                    <mesh position={[0, -fh * 0.25, 0.015]} castShadow><boxGeometry args={[fw * 0.65, 0.016, 0.016]} /><meshStandardMaterial color="#B8BCC0" metalness={0.78} roughness={0.28} /></mesh>
                    {/* Dispensador de agua */}
                    <mesh position={[-fw * 0.24, fh * 0.14, 0.003]}><boxGeometry args={[0.13, 0.21, 0.008]} /><meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.15} /></mesh>
                  </group>
                </group>
              );
            }
            if (app.type === 'hood-under') {
              return (
                <group key={`el-${idx}`} position={[ctr.x / 1000, counterTop + 0.65, ctr.y / 1000]} rotation={[0, rotY, 0]}>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[app.width / 1000, 0.055, app.depth / 1000]} />
                    <meshStandardMaterial color="#B8BCC0" metalness={0.75} roughness={0.32} />
                  </mesh>
                  <mesh position={[0, -0.01, app.depth / 2000 + 0.001]}>
                    <boxGeometry args={[0.12, 0.016, 0.003]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.4} />
                  </mesh>
                </group>
              );
            }
            if (app.type === 'hood-island') {
              return (
                <group key={`el-${idx}`} position={[ctr.x / 1000, counterTop + 0.75, ctr.y / 1000]}>
                  <mesh castShadow><boxGeometry args={[app.width / 1000, 0.045, app.depth / 1000]} /><meshStandardMaterial color="#B8BCC0" metalness={0.75} roughness={0.32} /></mesh>
                  <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[app.width / 2500, app.width / 2000, 0.25, 4]} /><meshStandardMaterial color="#B8BCC0" metalness={0.75} roughness={0.32} /></mesh>
                  <mesh position={[0, Math.max(0.25, (spaceHeight / 1000 - (counterTop + 0.75)) / 2), 0]} castShadow><boxGeometry args={[app.width / 2500, Math.max(0.4, spaceHeight / 1000 - (counterTop + 0.75) - 0.15), app.width / 2500]} /><meshStandardMaterial color="#B8BCC0" metalness={0.75} roughness={0.32} /></mesh>
                </group>
              );
            }
            return null;
          })}

          {/* Pocetas y estufas en islas / penínsulas */}
          {modules.filter(m => m.islandId && (m.isStoveCabinet || m.isSinkCabinet)).map(m => {
            const mb = findModuleBox(boxes, m.uniqueId);
            const kind = m.isStoveCabinet ? 'stove' : 'sink';
            const tmpl = appliances.find(a => a.type === kind);
            if (!mb || !tmpl) return null;
            const slab = boxes.find(bx => bx.id === `counter-isla-${m.islandId}-0`);
            const top = slab ? (slab.z + slab.sz) / 1000 : (mb.z + mb.sz) / 1000;
            const pos: [number, number, number] = [(mb.x + mb.sx / 2) / 1000, kind === 'stove' ? top + 0.007 : top, (mb.y + mb.sy / 2) / 1000];
            return kind === 'sink'
              ? <SinkRender3D key={`isl-${m.uniqueId}`} app={{ ...tmpl, wall: 'Island', active: true }} position={pos} rotation={[0, 0, 0]} realista={realista} faucetFront />
              : <StoveRender3D key={`isl-${m.uniqueId}`} app={{ ...tmpl, wall: 'Island', active: true }} position={pos} rotation={[0, 0, 0]} realista={realista} />;
          })}

          <ContactShadows position={[lim.cx, 0.002, lim.cz + lim.fondo / 2]} scale={Math.max(lim.ancho, 3) * 2.1} blur={2.4} opacity={0.25} far={1.2} />
          <OrbitControls ref={controles} target={[lim.cx, lim.cy, lim.cz]} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={dist * 3} />
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5">
        <Campo label="Fachada altos" value={col.fachadaMA} onChange={v => setCol(c => ({ ...c, fachadaMA: v }))} />
        <Campo label="Fachada bajos" value={col.fachadaMB} onChange={v => setCol(c => ({ ...c, fachadaMB: v }))} />
        <Campo label="Estructura" value={col.estructura} onChange={v => setCol(c => ({ ...c, estructura: v }))} />
        <Campo label="Mesón" value={col.meson} onChange={v => setCol(c => ({ ...c, meson: v }))} />
        <Campo label="Zócalo" value={col.zocalo} onChange={v => setCol(c => ({ ...c, zocalo: v }))} />
        <Campo label="Muro" value={col.muro} onChange={v => setCol(c => ({ ...c, muro: v }))} />
        <Campo label="Piso" value={col.piso} onChange={v => setCol(c => ({ ...c, piso: v }))} />
        <span className="text-xs text-slate-400 ml-auto">Arrastra para girar · rueda para acercar</span>
      </div>

      {/* Generar Foto Realista (IA) + Selector Visual de Piso y Luz */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-slate-900">Generar Foto Realista (IA)</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">Gemini IA</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Elige piso y luz para convertir la vista 3D actual en fotografía arquitectónica conservando geometría y medidas exactas.</p>
          </div>
          {ia.foto && (
            <button
              type="button"
              onClick={() => setVerFotoIA(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
            >
              {verFotoIA ? <BoxIcon size={14} /> : <ImageIcon size={14} />}
              <span>{verFotoIA ? 'Ver 3D' : 'Ver Foto IA'}</span>
            </button>
          )}
          {ia.foto && producto && onGuardar && (
            <button
              type="button"
              onClick={() => guardarEn(ia.foto!, 'foto_ia')}
              className="rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
            >
              Guardar en {producto}
            </button>
          )}
          {ia.foto && (
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = ia.foto!;
                a.download = `Foto_IA_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
                a.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
            >
              <Download size={14} />
              <span>Descargar imagen</span>
            </button>
          )}
          <button
            type="button"
            onClick={generar}
            disabled={ia.estado === 'generando'}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm disabled:opacity-60 transition-colors"
          >
            {ia.estado === 'generando' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{ia.estado === 'generando' ? 'Renderizando acabado fotorrealista...' : 'Generar Foto Realista (IA)'}</span>
          </button>
        </div>

        {/* Selector visual compacto de Piso y Luz */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
          <div className="lg:col-span-8 space-y-1.5">
            <span className="text-xs font-semibold tracking-tight text-slate-700 block">Tipo de piso</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PISOS_IA.map(op => {
                const activo = pisoIA === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setPisoIA(op.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-xs transition-all ${
                      activo
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 font-semibold shadow-sm'
                        : 'bg-slate-50/70 hover:bg-white border-slate-200/80 text-slate-700 font-medium'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg border border-slate-300/80 shrink-0 relative overflow-hidden"
                      style={{ backgroundColor: op.swatch }}
                    >
                      {op.vein && <span className="absolute inset-0 opacity-40 bg-gradient-to-tr from-transparent via-slate-400/50 to-transparent" />}
                    </span>
                    <span className="leading-tight truncate">{op.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <span className="text-xs font-semibold tracking-tight text-slate-700 block">Ambiente de luz</span>
            <div className="grid grid-cols-2 gap-2">
              {LUCES_IA.map(op => {
                const activo = luzIA === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setLuzIA(op.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${
                      activo
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 font-semibold shadow-sm'
                        : 'bg-slate-50/70 hover:bg-white border-slate-200/80 text-slate-700 font-medium'
                    }`}
                  >
                    {op.id === 'dia' ? <Sun size={14} /> : <Sunset size={14} />}
                    <span>{op.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!claveIAConfigurada() && (
          <div className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200/70 rounded-xl px-3.5 py-2.5">
            Configura GEMINI_API_KEY en .env.local para usar Generar Foto Realista (IA).
          </div>
        )}
        {ia.estado === 'error' && (
          <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
            {ia.error}
          </div>
        )}
        {ia.foto && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">Resultado fotorrealista (IA)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVerFotoIA(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-colors"
                >
                  {verFotoIA ? <BoxIcon size={13} /> : <ImageIcon size={13} />}
                  <span>{verFotoIA ? 'Ver 3D' : 'Ver Foto IA'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = ia.foto!;
                    a.download = `Foto_IA_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                >
                  <Download size={13} />
                  <span>Descargar imagen</span>
                </button>
              </div>
            </div>
            <img src={ia.foto} alt="Foto generada con IA" className="w-full rounded-2xl border border-slate-200" />
            <div className="text-xs text-slate-500">Compara la foto generada con tu diseño 3D antes de compartirla; las medidas y el despiece salen siempre del modelo 3D.</div>
          </div>
        )}
      </div>
    </div>
  );
};
