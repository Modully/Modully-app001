
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Edges, PerspectiveCamera, OrthographicCamera, Html as DreiHtml, Line } from '@react-three/drei';
import * as THREE from 'three';
import { IslandItem, KitchenModule, Appliance, ApplianceType, LayoutType, WallName } from './types';
import type { CounterEdge, CounterExtras, closetDerived } from './boxes';
import { closetSectionOf, closetCajoneroIndex, closetTorreIndex, fitRows, fitCells, fitInsets, fitBodyParts, doorOpening } from './boxes';
import type { ClosetConfig, ClosetFit, FitBodyCfg } from './types';
import type { PuertaCfg } from './puertas';
import { Box, findModuleBox, boxesBounds, applianceCenter, counterTopZ, CORNER_BLIND_OFFSET, WALL_THICKNESS } from './boxes';
import { COLORS } from './constants';
import { PUNTO_INFO, PuntoAdecuacion, cotasPorElectro, siglaPunto } from './puntos';
import { X, Plus, Ruler, ArrowUp, ArrowLeft, ArrowRight, ArrowDownLeft } from 'lucide-react';

// Constantes de elevación y espaciado (en milímetros)
const COUNTER_HEIGHT = 800;      // Alto del módulo base; el mesón queda a zócalo + este valor
const BACKSPLASH_GAP = 600;      // Espacio entre módulos bajos y aéreos
const HOOD_GAP = 650;            // Espacio sobre el mesón para campana
const TOP_MARGIN = 20;           // Espacio bajo el techo
const SINK_BASIN_DEPTH = 0.2;    // profundidad de la cubeta de la poceta (m), medida desde la cara superior del mesón
const UPPER_BASE_HEIGHT = COUNTER_HEIGHT + BACKSPLASH_GAP; // Base de aéreos sobre el zócalo (zócalo + 800 + 600)


/**
 * Html de drei que, en las vistas en perspectiva (isométrica y 3D), se oculta cuando algo de la escena (un muro, otro módulo) queda
 * entre la cámara y su punto: letras, medidas, notas y botones solo se ven si están a la vista. En planta y frontal no se oculta.
 */
const Html: React.FC<React.ComponentProps<typeof DreiHtml>> = (props) => {
  const persp = useThree((state) => (state.camera as any).isPerspectiveCamera);
  return <DreiHtml occlude={persp ? true : undefined} {...props} />;
};

/**
 * Html de drei con tamaño coherente en cualquier cámara. Con cámara en perspectiva usa distanceFactor;
 * en las vistas ortogonales (planta/frontal) distanceFactor se multiplica por el zoom y los controles
 * salen gigantes, así que se muestran a tamaño fijo reducido.
 */
const HtmlScaled: React.FC<React.ComponentProps<typeof Html> & { zoomScale?: boolean }> = ({ children, distanceFactor, zoomScale, ...rest }) => {
  const isOrtho = useThree((state) => (state.camera as any).isOrthographicCamera);
  // zoomScale: en vistas ortogonales el control crece o se encoge con el zoom (1 = el zoom del encuadre inicial de la vista)
  const [zoomK, setZoomK] = useState(1);
  useFrame(({ camera }) => {
    if (!zoomScale || !(camera as any).isOrthographicCamera) return;
    const fit = camera.userData.fitZoom || camera.zoom;
    const k = Math.min(3, Math.max(0.4, Math.round((camera.zoom / fit) * 20) / 20));
    if (k !== zoomK) setZoomK(k);
  });
  // El contenedor de drei mide el tamaño SIN escalar del control (p. ej. 40x40 px) aunque se vea mucho más pequeño,
  // y capturaba los clics: tapaba los botones vecinos (la "X" y el "+"). Por eso el contenedor no recibe clics
  // (pointer-events none en su estilo) y solo el contenido visible los recibe.
  if (isOrtho) {
    return (
      <Html {...rest} style={{ ...rest.style, pointerEvents: 'none' }}>
        <div style={{ transform: `scale(${0.3 * (zoomScale ? zoomK : 1)})`, transformOrigin: 'center', pointerEvents: 'auto' }}>{children}</div>
      </Html>
    );
  }
  return (
    // sin `transform`: el control mira siempre a la cámara; con transform es un plano fijo que se ve de canto (y desaparece) al girar la vista 3D
    <Html {...rest} distanceFactor={distanceFactor} style={{ ...rest.style, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </Html>
  );
};

/** Eje a lo largo del cual crece "positionX" en cada muro (A: +X de la escena; B y C: +Z) */
const wallAxis = (wall: string) => (wall === 'A' || wall === 'Island' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));

/** Píxeles de pantalla que recorre 1 metro a lo largo de un eje, vistos desde la cámara actual */
function screenPixelsPerMeter(camera: THREE.Camera, size: { width: number; height: number }, origin: THREE.Vector3, axis: THREE.Vector3) {
  const a = origin.clone().project(camera);
  const b = origin.clone().add(axis).project(camera);
  return { sx: ((b.x - a.x) * size.width) / 2, sy: (-(b.y - a.y) * size.height) / 2 };
}

/** Convierte un desplazamiento del ratón (píxeles) en milímetros a lo largo del eje del muro */
const pixelsToMm = (dx: number, dy: number, sx: number, sy: number) => {
  const k = sx * sx + sy * sy;
  return k < 1 ? 0 : ((dx * sx + dy * sy) / k) * 1000; // sin proyección útil (eje de frente a la cámara) no se arrastra
};

/**
 * Arrastre a nivel de documento. Los manejadores se guardan en refs para que siempre usen el estado
 * más reciente (antes quedaban con el estado del momento del clic y el arrastre nunca se aplicaba).
 */
function useDocumentDrag(onMove: (dx: number, dy: number, ev: MouseEvent) => void, onEnd: () => void) {
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);
  moveRef.current = onMove;
  endRef.current = onEnd;
  return (start: { clientX: number; clientY: number }) => {
    const x0 = start.clientX;
    const y0 = start.clientY;
    const move = (ev: MouseEvent) => moveRef.current(ev.clientX - x0, ev.clientY - y0, ev);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      endRef.current();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
}

type FaceKey = 'left' | 'right' | 'front' | 'top' | 'bottom';
/** Módulo bajo el cursor (y el punto tocado) mientras se arrastra una manija: su cara sirve de referencia para el estiramiento */
type HoverRef = React.MutableRefObject<{ id: string; point: THREE.Vector3 } | null>;
/** Medidas que dejaría esa cara de referencia en el módulo que se estira */
type ReferenceResult = { width?: number; depth?: number; height?: number; topGap?: number };

/**
 * Manija azul de una cara del módulo seleccionado. Flota frente al centro de la cara y su flecha apunta hacia donde se
 * extruye o jala (se calcula con la dirección de la cara en pantalla, así sirve en cualquier vista). Con clic sostenido y
 * arrastre la cara se mueve y se muestra la cota; con un clic simple el módulo se estira hasta la siguiente cara de referencia.
 */
const FaceHandle: React.FC<{
  position: [number, number, number];
  normal: [number, number, number];
  meshPosition: [number, number, number];
  meshRotation: [number, number, number];
  label: string;
  title: string;
  onStart: (e: { clientX: number; clientY: number }) => void;
  onClick: () => void;
}> = ({ position, normal, meshPosition, meshRotation, label, title, onStart, onClick }) => {
  const { camera, size } = useThree();
  const [holding, setHolding] = useState(false);
  const [hover, setHover] = useState(false);
  const [showVal, setShowVal] = useState(false);
  const hideT = useRef<any>(null);
  useEffect(() => () => { if (hideT.current) clearTimeout(hideT.current); }, []);
  // flecha 3D hacia afuera de la cara (mismo estilo que las del Closet fit); la medida queda visible mientras se arrastra y 3 segundos después
  const dir = useMemo(() => new THREE.Vector3(...normal), [normal[0], normal[1], normal[2]]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir]);
  const color = holding ? '#1d4ed8' : hover ? '#3b82f6' : '#2563eb';
  const shaftL = 0.1, headL = 0.08;

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const ne = e.nativeEvent as MouseEvent;
    ne.preventDefault();
    const x0 = ne.clientX, y0 = ne.clientY;
    setHolding(true); setShowVal(true); if (hideT.current) clearTimeout(hideT.current);
    onStart(ne);
    let done = false;
    const up = (ev: MouseEvent | PointerEvent) => {
      if (done) return;
      done = true;
      document.removeEventListener('mouseup', up);
      document.removeEventListener('pointerup', up);
      setHolding(false);
      hideT.current = setTimeout(() => setShowVal(false), 3000);
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) onClick(); // clic simple: estirar hasta la siguiente cara
    };
    document.addEventListener('mouseup', up);
    document.addEventListener('pointerup', up);
  };

  return (
    <group
      position={position}
      quaternion={quat}
      renderOrder={50}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { setHover(false); if (!holding) document.body.style.cursor = 'auto'; }}
      onPointerDown={down}
    >
      <mesh position={[0, shaftL / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.016, 0.016, shaftL, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, shaftL + headL / 2, 0]} raycast={() => null}>
        <coneGeometry args={[0.042, headL, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {/* zona más ancha e invisible para agarrar la flecha con facilidad */}
      <mesh position={[0, (shaftL + headL) / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, shaftL + headL, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(holding || showVal) && (
        <HtmlScaled zoomScale position={[0, shaftL + headL + 0.09, 0]} center distanceFactor={1} zIndexRange={[120, 0]}>
          <div data-overlay className="whitespace-nowrap px-3 py-1 rounded-lg bg-white text-blue-700 text-xl font-black shadow-xl border-2 border-blue-500">{label}</div>
        </HtmlScaled>
      )}
    </group>
  );
};


/** Flecha azul para estirar el fondo del cajonero (arrastre = cambia el fondo; los entrepaños y laterales quedan 20 mm menos) */
const CajoneroStretch: React.FC<{ position: [number, number, number]; depth: number; onChange: (d: number) => void; controlsRef?: React.RefObject<any> }> = ({ position, depth, onChange, controlsRef }) => {
  const { camera, size } = useThree();
  const st = useRef<{ value: number; sx: number; sy: number } | null>(null);
  const [live, setLive] = useState(depth);
  const [from, setFrom] = useState(depth);   // fondo con el que empezó el arrastre: la cota muestra cuánto se ha movido
  useEffect(() => { if (!st.current) { setLive(depth); setFrom(depth); } }, [depth]);
  const startDrag = useDocumentDrag(
    (dx, dy) => {
      const s = st.current;
      if (!s) return;
      const v = Math.min(500, Math.max(300, Math.round((s.value + pixelsToMm(dx, dy, s.sx, s.sy)) / 5) * 5));
      setLive(v);
      onChange(v);
    },
    () => { st.current = null; if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  return (
    <FaceHandle
      position={position}
      normal={[0, 0, 1]}
      meshPosition={[0, 0, 0]}
      meshRotation={[0, 0, 0]}
      label={`${Math.round(live)} mm  (${live - from >= 0 ? '+' : ''}${Math.round(live - from)})`}
      title="Estirar el fondo del cajonero (los entrepaños quedan 20 mm menos)"
      onStart={(e) => {
        const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), new THREE.Vector3(0, 0, 1));
        st.current = { value: depth, sx, sy };
        setLive(depth);
        setFrom(depth);
        if (controlsRef?.current) controlsRef.current.enabled = false;
        document.body.style.cursor = 'ns-resize';
        startDrag(e);
      }}
      onClick={() => {}}
    />
  );
};


/** Flecha para arrastrar un borde de un cuerpo del Closet fit (mueve el borde y muestra la medida) */
const FitEdgeHandle: React.FC<{ position: [number, number, number]; normal: [number, number, number]; axis: [number, number, number]; label: string; begin: () => (deltaMm: number) => void; controlsRef?: React.RefObject<any> }> = ({ position, normal, axis, label, begin, controlsRef }) => {
  const { camera, size } = useThree();
  const st = useRef<{ sx: number; sy: number; apply: (d: number) => void } | null>(null);
  const startDrag = useDocumentDrag(
    (dx, dy) => { const s = st.current; if (s) s.apply(pixelsToMm(dx, dy, s.sx, s.sy)); },
    () => { st.current = null; if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  return (
    <FaceHandle
      position={position}
      normal={normal}
      meshPosition={[0, 0, 0]}
      meshRotation={[0, 0, 0]}
      label={label}
      title="Arrastrar para mover este borde"
      onStart={(e) => {
        const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), new THREE.Vector3(...axis));
        st.current = { sx, sy, apply: begin() };
        if (controlsRef?.current) controlsRef.current.enabled = false;
        document.body.style.cursor = 'ew-resize';
        startDrag(e);
      }}
      onClick={() => {}}
    />
  );
};


/** Flecha doble en el contacto entre dos cuerpos del Closet fit (como la unión de las cocinas): arrastrarla mueve la cara compartida */
const FitJunction: React.FC<{ position: [number, number, number]; axis: [number, number, number]; vertical?: boolean; locked?: boolean; single?: 1 | -1; limit?: { at: number; from: number; to: number }; posMm: number; group: string; begin: () => (deltaMm: number, exact?: boolean) => void; controlsRef?: React.RefObject<any> }> = ({ position, axis, vertical, locked, single, limit, posMm, group, begin, controlsRef }) => {
  const { camera, size } = useThree();
  const [isResizing, setIsResizing] = useState(false);
  const [matched, setMatched] = useState(false);
  const matchedEl = useRef<HTMLElement | null>(null);
  const st = useRef<{ sx: number; sy: number; startPos: number; apply: (d: number, exact?: boolean) => void } | null>(null);
  const highlight = (el: HTMLElement | null) => {
    if (matchedEl.current === el) return;
    matchedEl.current?.classList.remove('ring-8', 'ring-emerald-500');
    el?.classList.add('ring-8', 'ring-emerald-500');
    matchedEl.current = el;
    setMatched(el !== null);
  };
  const startDrag = useDocumentDrag(
    (dx, dy, ev) => {
      const t = st.current;
      if (!t) return;
      let d = pixelsToMm(dx, dy, t.sx, t.sy);
      // si el cursor toca otra flecha doble del mismo eje (de otra fila o cuerpo), la unión queda perfectamente alineada con ella
      // se busca la flecha más cercana al cursor (a menos de 36 px) aunque haya una nota encima: no hace falta acertar exacto
      let valid: HTMLElement | null = null, best = 36;
      document.querySelectorAll<HTMLElement>('[data-fit-pos]').forEach(el => {
        if (el.dataset.fitAxis !== (vertical ? 'y' : 'x') || el.dataset.fitGroup === group) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        const dist = Math.hypot(r.left + r.width / 2 - ev.clientX, r.top + r.height / 2 - ev.clientY);
        if (dist < best) { best = dist; valid = el; }
      });
      highlight(valid);
      // el desplazamiento se mide desde donde empezó el arrastre (posMm cambia a medida que la unión se mueve)
      if (valid) d = Number((valid as HTMLElement).dataset.fitPos) - t.startPos;
      t.apply(d, !!valid); // alineado: medida exacta, sin redondear a 5 mm
    },
    () => { highlight(null); st.current = null; setIsResizing(false); if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  return (
    <>
    {/* cuando la cara se acerca al límite del espacio libre (a menos de 20 mm), esa línea se marca en naranja oscuro; al llegar (queda menos de 3 mm) la flecha y la línea desaparecen porque el cuerpo ya toca el otro */}
    {limit && Math.abs((vertical ? position[1] : position[0]) - limit.at) < 0.02 && (
      <Line points={vertical ? [[limit.from, limit.at, position[2]], [limit.to, limit.at, position[2]]] : [[limit.at, limit.from, position[2]], [limit.at, limit.to, position[2]]]} color="#c2410c" lineWidth={3} />
    )}
    <HtmlScaled zoomScale position={position} center distanceFactor={1} zIndexRange={[100, 0]}>
      <div
        className={`w-14 h-14 rounded-full ${isResizing ? 'bg-green-200 border-green-600' : single ? 'bg-blue-50 border-blue-600' : 'bg-purple-100 border-purple-600'} border-[3px] shadow-xl flex items-center justify-center backdrop-blur-sm ${locked ? 'cursor-not-allowed opacity-80' : vertical ? 'cursor-ns-resize' : 'cursor-ew-resize'} relative`}
        title={locked ? 'Bloqueada: una de las medidas tiene candado. Desbloquéala en su nota para mover esta línea' : single ? 'Espacio libre: arrastra para mover esta cara del cuerpo (si tocas otra flecha, quedan alineadas)' : 'Contacto con la cara interna del otro cuerpo: arrastra para mover la unión (si tocas otra flecha doble, quedan alineadas)'}
        data-fit-pos={posMm}
        data-fit-axis={vertical ? 'y' : 'x'}
        data-fit-group={group}
        style={{ pointerEvents: isResizing ? 'none' : undefined }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (locked) return;
          const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), new THREE.Vector3(...axis));
          st.current = { sx, sy, startPos: posMm, apply: begin() };
          setIsResizing(true);
          if (controlsRef?.current) controlsRef.current.enabled = false;
          document.body.style.cursor = vertical ? 'ns-resize' : 'ew-resize';
          startDrag(e);
        }}
      >
        {single ? (
          // una sola flecha: no hay otro cuerpo al otro lado, solo se arrastra esta cara hacia el espacio libre
          <div className="flex items-center gap-0" style={{ transform: `rotate(${vertical ? (single > 0 ? 90 : -90) : (single > 0 ? 0 : 180)}deg)` }}>
            <div className="w-4 h-[4px] bg-blue-600 rounded"></div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        ) : (
        <div className="flex items-center gap-0" style={{ transform: `rotate(${vertical ? 90 : 0}deg)` }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div className="w-[3px] h-4 bg-purple-600 rounded"></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        )}
        {locked && (
          // candado: la línea no se puede arrastrar porque una de las medidas que toca está bloqueada
          <span className="absolute top-1/2 -translate-y-1/2 left-full ml-1 flex items-center justify-center w-10 h-10 rounded-full bg-amber-500 border-[3px] border-white shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </span>
        )}
      </div>
      {isResizing && (
        <div className="absolute top-full mt-2 px-3 py-1 bg-green-600 text-white text-lg font-black rounded-lg shadow-2xl border-2 border-white whitespace-nowrap">{matched ? '✓ IGUALADA' : single ? (vertical ? '↕ CARA' : '↔ CARA') : (vertical ? '↕ UNIÓN' : '↔ UNIÓN')}</div>
      )}
    </HtmlScaled>
    </>
  );
};



/** Calculadora básica de suma y resta: "800-30", "250+20-5", "1.200 + 30". Devuelve null si la expresión no es válida */
export function calcSimple(raw: string): number | null {
  const t = raw.replace(/\s+/g, '').replace(/,/g, '.');
  if (!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)*$/.test(t)) return null;
  const parts = t.match(/[+-]?\d+(\.\d+)?/g);
  if (!parts) return null;
  const v = parts.reduce((a, x) => a + parseFloat(x), 0);
  return Number.isFinite(v) ? v : null;
}

/** Campo de medida que acepta sumas y restas (por ejemplo 800-30); se aplica al salir del campo o con Enter y Escape cancela */
const CalcInput: React.FC<{ value: number; onCommit: (n: number) => void; className?: string; disabled?: boolean; title?: string; style?: React.CSSProperties }> = ({ value, onCommit, className, disabled, title, style }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (apply: boolean) => {
    const raw = draft;
    setDraft(null);
    if (!apply || raw === null || raw.trim() === '') return;
    const n = calcSimple(raw);
    if (n !== null && n > 0) onCommit(Math.round(n));
  };
  return (
    <input ref={(el) => { if (el && style?.fontSize != null) el.style.setProperty('font-size', `${style.fontSize}px`, 'important'); }} type="text" inputMode="decimal" className={className} style={style} title={title ?? 'Puedes escribir sumas y restas, por ejemplo 800-30'} disabled={disabled} value={draft ?? String(Math.round(value))}
      onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') finish(false); }} />
  );
};


/** Flechas azules en 3D del cubo seleccionado: arriba estira el alto, a los lados el ancho y adelante el fondo; son objetos de la escena (flecha con punta) que se arrastran con el ratón */
const FitFaceHandle: React.FC<{ kind: 'up' | 'left' | 'right' | 'front'; position: [number, number, number]; axis: [number, number, number]; sign: 1 | -1; start: () => number; onValue: (v: number) => void; current?: number; min?: number; snaps?: number[]; targets?: { min: [number, number, number]; max: [number, number, number]; vals: number[] }[]; controlsRef?: React.RefObject<any> }> = ({ kind, position, axis, sign, start, onValue, current, min, snaps, targets, controlsRef }) => {
  const { camera, size, gl } = useThree();
  const [active, setActive] = useState(false);
  // medida resultante: se muestra mientras se arrastra y queda activa 3 segundos (se puede escribir otra)
  const [showVal, setShowVal] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const hideT = useRef<any>(null);
  useEffect(() => () => { if (hideT.current) clearTimeout(hideT.current); }, []);
  const keepOpen = () => { setShowVal(true); if (hideT.current) clearTimeout(hideT.current); hideT.current = setTimeout(() => { setShowVal(false); setDraft(null); }, 3000); };
  const [hover, setHover] = useState(false);
  const st = useRef<{ sx: number; sy: number; v0: number } | null>(null);
  const startDrag = useDocumentDrag(
    (dx, dy, ev) => {
      const t = st.current;
      if (!t) return;
      const d = pixelsToMm(dx, dy, t.sx, t.sy);
      let v = Math.max(min ?? 15, Math.round((t.v0 + sign * d) / 5) * 5);
      // tope magnético: si la cara llega a la altura de la cara de otro cubo, se queda ahí
      const hit = (snaps ?? []).filter(x => x > (min ?? 15) && Math.abs(x - (t.v0 + sign * d)) <= 40).sort((a, b) => Math.abs(a - (t.v0 + sign * d)) - Math.abs(b - (t.v0 + sign * d)))[0];
      if (hit != null) v = hit;
      // si el mouse toca la cara de otro cubo, la cara que se estira llega hasta ahí (tiene prioridad sobre el imán)
      if (targets && targets.length) {
        const r = gl.domElement.getBoundingClientRect();
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
        let best: { dist: number; vals: number[] } | null = null;
        const tmp = new THREE.Vector3();
        targets.forEach(tg => {
          const hitP = rc.ray.intersectBox(new THREE.Box3(new THREE.Vector3(...tg.min), new THREE.Vector3(...tg.max)), tmp);
          if (hitP) { const dist = hitP.distanceTo(rc.ray.origin); if (!best || dist < best.dist) best = { dist, vals: tg.vals }; }
        });
        const bv = best as { dist: number; vals: number[] } | null;
        if (bv) { const raw = t.v0 + sign * d; const cand = bv.vals.filter(x => x > 100).sort((a, b) => Math.abs(a - raw) - Math.abs(b - raw))[0]; if (cand != null) v = cand; }
      }
      onValue(v);
    },
    () => { st.current = null; setActive(false); keepOpen(); if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  // la flecha apunta hacia afuera de la cara
  const dir = useMemo(() => new THREE.Vector3(...(kind === 'up' ? [0, 1, 0] : kind === 'left' ? [-1, 0, 0] : kind === 'right' ? [1, 0, 0] : [0, 0, 1])), [kind]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), [dir]);
  const color = active ? '#1d4ed8' : hover ? '#3b82f6' : '#2563eb';
  const shaftL = 0.1, headL = 0.08;
  return (
    <group
      position={position}
      quaternion={quat}
      renderOrder={50}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = kind === 'up' ? 'ns-resize' : kind === 'front' ? 'move' : 'ew-resize'; }}
      onPointerOut={() => { setHover(false); if (!st.current) document.body.style.cursor = 'auto'; }}
      onPointerDown={(e) => {
        e.stopPropagation();
        const ne = e.nativeEvent as MouseEvent;
        ne.preventDefault();
        const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), new THREE.Vector3(...axis));
        st.current = { sx, sy, v0: start() };
        setActive(true); setShowVal(true); if (hideT.current) clearTimeout(hideT.current);
        if (controlsRef?.current) controlsRef.current.enabled = false;
        document.body.style.cursor = kind === 'up' ? 'ns-resize' : kind === 'front' ? 'move' : 'ew-resize';
        startDrag(ne);
      }}
    >
      <mesh position={[0, shaftL / 2, 0]}>
        <cylinderGeometry args={[0.016, 0.016, shaftL, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, shaftL + headL / 2, 0]}>
        <coneGeometry args={[0.042, headL, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {(showVal || active) && current != null && (
        <HtmlScaled zoomScale position={[0, shaftL + headL + 0.09, 0]} center distanceFactor={1} zIndexRange={[120, 0]}>
          <input
            data-overlay
            className="w-24 text-center text-xl font-black text-blue-700 bg-white border-2 border-blue-500 rounded-lg shadow-xl py-1 outline-none"
            value={draft ?? String(Math.round(current))}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={() => { if (hideT.current) clearTimeout(hideT.current); }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const n = Number(String(draft ?? '').replace(',', '.')); if (isFinite(n) && n >= 15) onValue(Math.round(n)); setDraft(null); keepOpen(); (e.target as HTMLInputElement).blur(); } }}
            onBlur={() => { if (draft !== null) { const n = Number(draft.replace(',', '.')); if (isFinite(n) && n >= 15) onValue(Math.round(n)); setDraft(null); } keepOpen(); }}
          />
        </HtmlScaled>
      )}
      {/* zona más ancha e invisible para agarrar la flecha con facilidad */}
      <mesh position={[0, (shaftL + headL) / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, shaftL + headL, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};



/** Cota verde de un espacio (vertical 'v' u horizontal 'h') que se puede mover: se arrastra la medida y la línea se corre a un lado */
const MovableCota: React.FC<{ kind: 'v' | 'h'; from: number; to: number; at: number; zf: number; label: number; ext?: [number, number]; onEdit?: (n: number) => void; controlsRef?: React.RefObject<any> }> = ({ kind, from: from0, to: to0, at, zf, label: label0, ext, onEdit: onEdit0, controlsRef }) => {
  const { camera, size } = useThree();
  const [off, setOff] = useState(0);
  // si se arrastra un extremo, la cota deja de seguir al espacio original y mide lo que quede entre los dos extremos (doble clic en la medida: vuelve a la referencia)
  const [eo, setEo] = useState<[number, number]>([0, 0]);
  const moved = eo[0] !== 0 || eo[1] !== 0;
  const from = from0 + eo[0], to = to0 + eo[1];
  const label = moved ? Math.abs(to - from) * 1000 : label0;
  const onEdit = moved ? undefined : onEdit0;
  const endRef = useRef<{ k: 0 | 1; sx: number; sy: number; e0: number; other: number } | null>(null);
  const startEnd = useDocumentDrag(
    (dx, dy) => {
      const t = endRef.current; if (!t) return;
      const d = Math.round(pixelsToMm(dx, dy, t.sx, t.sy) / 5) * 5 / 1000;
      setEo(prev => (t.k === 0 ? [t.e0 + d, prev[1]] : [prev[0], t.e0 + d]));
    },
    () => { endRef.current = null; if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  const beginEnd = (k: 0 | 1, pos: [number, number, number]) => (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...pos), new THREE.Vector3(kind === 'v' ? 0 : 1, kind === 'v' ? 1 : 0, 0));
    endRef.current = { k, sx, sy, e0: eo[k], other: 0 };
    if (controlsRef?.current) controlsRef.current.enabled = false;
    document.body.style.cursor = 'grabbing';
    startEnd(e);
  };
  const [drag, setDrag] = useState(false);
  const st = useRef<{ sx: number; sy: number; o0: number } | null>(null);
  const startDrag = useDocumentDrag(
    (dx, dy) => { const t = st.current; if (!t) return; setOff(t.o0 + pixelsToMm(dx, dy, t.sx, t.sy) / 1000); },
    () => { st.current = null; setDrag(false); if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  // estilo de dibujo técnico: líneas de extensión finas que salen del objeto (con una pequeña separación) y pasan un poco la línea de cota,
  // línea de cota fina, marcas oblicuas a 45° en los extremos y la medida escrita sobre la línea (girada en las verticales)
  const C = moved ? '#047857' : '#111827', EXT = moved ? '#34d399' : '#94a3b8', tk = 0.014, p = at + off;
  const tick = (a: number): [number, number, number][] => (kind === 'v' ? [[p - tk, a - tk, zf], [p + tk, a + tk, zf]] : [[a - tk, p - tk, zf], [a + tk, p + tk, zf]]);
  const mid: [number, number, number] = kind === 'v' ? [p, (from + to) / 2, zf] : [(from + to) / 2, p, zf];
  const extLine = (a: number): [number, number, number][] => {
    if (!ext) return [];
    const o = ext[0], dirS = Math.sign(p - o) || 1, gapE = 0.012, over = 0.025;
    return kind === 'v' ? [[o + dirS * gapE, a, zf], [p + dirS * over, a, zf]] : [[a, o + dirS * gapE, zf], [a, p + dirS * over, zf]];
  };
  return (
    <>
      {ext && <>
        <Line points={extLine(from)} color={EXT} lineWidth={1} raycast={() => null} />
        <Line points={extLine(to)} color={EXT} lineWidth={1} raycast={() => null} />
      </>}
      <Line points={[kind === 'v' ? [p, from, zf] : [from, p, zf], kind === 'v' ? [p, to, zf] : [to, p, zf]] as [number, number, number][]} color={C} lineWidth={1} raycast={() => null} />
      <Line points={tick(from)} color={C} lineWidth={1.5} raycast={() => null} />
      <Line points={tick(to)} color={C} lineWidth={1.5} raycast={() => null} />
      {([0, 1] as const).map(k => {
        const pos: [number, number, number] = kind === 'v' ? [p, k === 0 ? from : to, zf] : [k === 0 ? from : to, p, zf];
        return (
          <Html key={`end-${k}`} position={pos} center occlude={false} zIndexRange={[61, 0]} style={{ pointerEvents: 'none' }}>
            <div data-overlay title="Arrastra este extremo hasta donde quieras medir" onMouseDown={beginEnd(k, pos)} onPointerDown={(e) => e.stopPropagation()} className={`${kind === 'v' ? 'w-6 h-3 cursor-ns-resize' : 'w-3 h-6 cursor-ew-resize'} rounded-full hover:bg-slate-400/30`} style={{ pointerEvents: 'auto' }} />
          </Html>
        );
      })}
      <Html position={mid} center occlude={false} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
        {(() => {
          const beginDrag = (e: React.MouseEvent) => {
            e.stopPropagation(); e.preventDefault();
            const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...mid), new THREE.Vector3(kind === 'v' ? 1 : 0, kind === 'v' ? 0 : 1, 0));
            st.current = { sx, sy, o0: off };
            setDrag(true);
            if (controlsRef?.current) controlsRef.current.enabled = false;
            document.body.style.cursor = 'grabbing';
            startDrag(e);
          };
          return (
            <div
              data-overlay
              title={onEdit ? 'Cota editable (puedes escribir sumas y restas); arrastra el asa ⠿ para moverla' : 'Arrastra para mover esta cota'}
              className={`select-none relative px-0.5 text-[11px] leading-none font-bold flex items-center justify-center rounded-sm hover:bg-white/80 ${moved ? 'text-emerald-700' : 'text-slate-900'} ${drag ? 'bg-white/80' : ''}`}
              style={{ pointerEvents: drag ? 'none' : 'auto', cursor: onEdit ? 'default' : 'grab', textShadow: '0 0 3px #fff, 0 0 3px #fff', transform: kind === 'v' ? 'rotate(-90deg) translateY(-9px)' : 'translateY(-9px)' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => { e.stopPropagation(); if (moved) setEo([0, 0]); }}
              onMouseDown={onEdit ? (e) => e.stopPropagation() : beginDrag}
            >
              {onEdit && <span className="cursor-grab text-slate-400 leading-none text-[9px] mr-0.5" onMouseDown={beginDrag}>⠿</span>}
              {onEdit ? <CalcInput value={label} onCommit={onEdit} className="w-10 text-center bg-transparent text-[11px] leading-none font-bold text-slate-900 outline-none border-b border-transparent hover:border-slate-400 focus:border-indigo-500" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, textShadow: '0 0 3px #fff' }} title="Cota editable: puedes escribir sumas y restas, por ejemplo 800-30" /> : Math.round(label)}
            </div>
          );
        })()}
      </Html>
    </>
  );
};

/** Geometría de una pieza con su contorno de frente (cortes a 45°): se extruye a lo largo de su espesor; reemplaza la caja */
const FaceExtrude: React.FC<{ b: Box }> = ({ b }) => {
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    (b.face ?? []).forEach(([u, v], i) => { const x = (u - b.sx / 2) / 1000, y = (v - b.sz / 2) / 1000; if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); });
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: b.sy / 1000, bevelEnabled: false });
    g.translate(0, 0, -b.sy / 2000);
    return g;
  }, [b.face, b.sx, b.sy, b.sz]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <primitive object={geo} attach="geometry" />;
};

/** Flecha de mover un cuerpo (cruz verde): arrastrar lo desplaza a lo largo del muro y lo desune de sus vecinos */
const FitMoveHandle: React.FC<{ position: [number, number, number]; begin: () => (dxMm: number, dyMm: number) => void; controlsRef?: React.RefObject<any> }> = ({ position, begin, controlsRef }) => {
  const { camera, size } = useThree();
  const st = useRef<{ sx: number; sy: number; vx: number; vy: number; apply: (dxMm: number, dyMm: number) => void } | null>(null);
  const [on, setOn] = useState(false);
  const startDrag = useDocumentDrag(
    (dx, dy) => { const t = st.current; if (!t) return; t.apply(pixelsToMm(dx, dy, t.sx, t.sy), pixelsToMm(dx, dy, t.vx, t.vy)); },
    () => { st.current = null; setOn(false); if (controlsRef?.current) controlsRef.current.enabled = true; document.body.style.cursor = 'auto'; }
  );
  return (
    <HtmlScaled zoomScale position={position} center distanceFactor={1} zIndexRange={[110, 0]}>
      <button
        data-overlay
        title="Arrastra para mover este cubo (se desune de los vecinos)"
        style={{ pointerEvents: on ? 'none' : undefined }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.stopPropagation(); e.preventDefault();
          const p3 = new THREE.Vector3(...position);
          const { sx, sy } = screenPixelsPerMeter(camera, size, p3, new THREE.Vector3(1, 0, 0));
          const { sx: vx, sy: vy } = screenPixelsPerMeter(camera, size, p3, new THREE.Vector3(0, 1, 0));
          st.current = { sx, sy, vx, vy, apply: begin() };
          setOn(true);
          if (controlsRef?.current) controlsRef.current.enabled = false;
          document.body.style.cursor = 'grabbing';
          startDrag(e);
        }}
        className={`w-14 h-14 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${on ? 'bg-emerald-800' : 'bg-emerald-700 hover:bg-emerald-800'} cursor-grab`}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" /></svg>
      </button>
    </HtmlScaled>
  );
};

/** Nota con las medidas de un cuerpo del Closet fit: ancho y alto se pueden escribir (Enter o salir del campo para aplicar) */
const FitDimLabel: React.FC<{ onGuide?: (k: 'w' | 'h' | null) => void; onHold?: (on: boolean) => void; w: number; h: number; canEditH: boolean; lockW: boolean; lockH: boolean; onLock: (k: 'w' | 'h') => void; onCommit: (patch: { width?: number; height?: number }) => void; offset: { x: number; y: number }; onOffset: (o: { x: number; y: number }) => void }> = ({ onGuide, onHold, w, h, canEditH, lockW, lockH, onLock, onCommit, offset, onOffset }) => {
  const [dw, setDw] = useState<string | null>(null);
  const [dh, setDh] = useState<string | null>(null);
  const done = (kind: 'w' | 'h') => {
    const raw = kind === 'w' ? dw : dh;
    if (raw !== null) { const n = Number(raw); if (Number.isFinite(n) && n > 0) onCommit(kind === 'w' ? { width: Math.round(n) } : { height: Math.round(n) }); }
    if (kind === 'w') setDw(null); else setDh(null);
  };
  // se agarra por el asa de la izquierda y se mueve donde estorbe menos
  const startMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    const x0 = e.clientX - offset.x, y0 = e.clientY - offset.y;
    const move = (ev: PointerEvent) => onOffset({ x: ev.clientX - x0, y: ev.clientY - y0 });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  const cls = (locked: boolean) => `w-9 px-0 h-3.5 text-center rounded-sm border text-[8px] leading-none font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${locked ? 'bg-transparent text-amber-700 border-transparent group-hover:border-amber-400' : 'bg-transparent text-slate-500 border-transparent group-hover:bg-white group-hover:text-slate-800 group-hover:border-slate-300 focus:border-sky-500 focus:bg-white'}`;
  // candado: bloquea esa medida para que no cambie al editar otra
  const lock = (k: 'w' | 'h', on: boolean) => (
    <button type="button" onClick={() => onLock(k)} className={`flex items-center justify-center w-3 h-3 rounded-sm ${on ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`} title={on ? 'Medida bloqueada: clic para desbloquear' : 'Clic para bloquear esta medida'}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{on ? <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> : <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>}</svg>
    </button>
  );
  return (
    <div data-overlay onMouseEnter={() => onHold?.(true)} onMouseLeave={() => onHold?.(false)} onFocus={() => onHold?.(true)} onBlur={() => onHold?.(false)} className="flex items-center gap-px select-none whitespace-nowrap rounded bg-transparent hover:bg-white/95 focus-within:bg-white/95 hover:shadow-sm border border-transparent hover:border-slate-300/70 px-0.5 py-px transition-all group" style={{ pointerEvents: 'auto', transform: `translate(${offset.x}px, ${offset.y}px)` }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <span onPointerDown={startMove} className="cursor-move text-[8px] leading-none text-slate-400 px-px opacity-0 group-hover:opacity-100" style={{ touchAction: 'none' }} title="Arrastra para mover la nota">⠿</span>
      {/* regla: primero el alto y después el ancho; al pasar por cada medida se ve en el cubo la línea guía de lo que va a cambiar */}
      <span className="flex items-center" onMouseEnter={() => onGuide?.('h')} onMouseLeave={() => onGuide?.(null)} onFocus={() => onGuide?.('h')} onBlur={() => onGuide?.(null)}>
        <CalcInput style={{ fontSize: 10 }} className={cls(lockH)} value={h} disabled={!canEditH || lockH} onCommit={(n) => onCommit({ height: n })} title={canEditH ? 'Alto (mm): puedes escribir sumas y restas' : 'El alto de este cuerpo sale de la altura del Espacio'} />
        {lock('h', lockH)}
      </span>
      <span className="text-[8px] leading-none text-slate-400">×</span>
      <span className="flex items-center" onMouseEnter={() => onGuide?.('w')} onMouseLeave={() => onGuide?.(null)} onFocus={() => onGuide?.('w')} onBlur={() => onGuide?.(null)}>
        <CalcInput style={{ fontSize: 10 }} className={cls(lockW)} value={w} disabled={lockW} onCommit={(n) => onCommit({ width: n })} title="Ancho (mm): puedes escribir sumas y restas" />
        {lock('w', lockW)}
      </span>
    </div>
  );
};

interface Module3DProps {
  module: KitchenModule;
  position: [number, number, number];
  rotation?: [number, number, number];
  onDelete?: (id: string) => void;
  onSplit?: (id: string) => void;
  onEditDimension?: (id: string, width: number) => void;
  onDragPosition?: (id: string, newPositionX: number) => void;
  onResizeEdge?: (id: string, side: 'left' | 'right', deltaX: number, initialWidth: number, initialPositionX: number) => void;
  controlsRef?: React.RefObject<any>;
  hideLeftArrow?: boolean;
  hideRightArrow?: boolean;
  viewMode?: 'plan' | 'frontal' | 'isometric' | '3d';
  selected?: boolean;
  costado?: 'left' | 'right'; // lado libre (sin vecino) donde va la cota del fondo
  editing?: boolean;
  onSelect?: (id: string, additive?: boolean) => void; // additive: Shift + clic (elegir dos módulos para unirlos en esquina)
  marked?: boolean; // módulo elegido con Shift + clic
  lShape?: { x0: number; x1: number; z0: number; z1: number }; // esquinero en L: el brazo (m, respecto al centro del módulo)
  pocket?: { dx: number; dz: number; w: number; d: number; depth: number }; // mueble de la poceta: hueco de la cubeta en su cara superior (m, respecto al centro del módulo)
  onOpenEditor?: (id: string) => void;
  onCloseEditor?: () => void;
  contextOpen?: boolean; // clic derecho: formulario del módulo (por ahora, si lleva puertas o cajones)
  onContext?: (id: string) => void;
  onCloseContext?: () => void;
  onChooseFronts?: (id: string, kind: 'doors' | 'drawers' | 'vertical' | 'horizontal' | 'open') => void;
  onApplyMeasures?: (id: string, m: { width: number; depth: number; height: number }) => void;
  onSetTop?: (id: string, height: number, topGap: number) => void;
  tono?: string; // color parecido al elegido para este módulo (cubo sin convertir)
  onSetVistos?: (id: string, v: SideConfig) => void;
  onSplitHorizontal?: (id: string) => void; // divide el módulo en dos a lo alto
  onSplitDepth?: (id: string) => void;       // divide el módulo en dos: frente y fondo
  showLabel?: boolean; // la letra del módulo solo se muestra si el módulo se ve (en planta, un bajo bajo el mesón o bajo un aéreo no se ve)
  faces?: { left: boolean; right: boolean; front: boolean; top: boolean; bottom: boolean }; // caras que no tocan otro módulo
  onExtendFace?: (id: string, face: FaceKey) => void;
  hoverRef?: HoverRef;
  resolveReference?: (selfId: string, face: FaceKey, hoverId: string, point: THREE.Vector3) => ReferenceResult | null;
  source?: KitchenModule; // módulo completo (la copia `module` puede venir con el cuerpo acortado por los vistos)
}

const Module3D: React.FC<Module3DProps> = ({ module, position, rotation = [0, 0, 0], onDelete, onSplit, onEditDimension, onDragPosition, onResizeEdge, controlsRef, hideLeftArrow, hideRightArrow, viewMode, selected, marked, lShape, pocket, costado = 'right', editing, onSelect, onOpenEditor, onCloseEditor, contextOpen, onContext, onCloseContext, onChooseFronts, onApplyMeasures, onSetTop, tono, onSetVistos, onSplitHorizontal, onSplitDepth, faces, onExtendFace, hoverRef, resolveReference, showLabel = true, source }) => {
  const isPlan = viewMode === 'plan';
  const [hovered, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const { camera, size } = useThree();
  const dragStart = useRef<{ along: number; moduleX: number } | null>(null);
  const edgeStart = useRef<{ side: 'left' | 'right'; moduleX: number; initialWidth: number; sx: number; sy: number } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Esquinero en L: un solo cuerpo con forma de L (sin la costura entre los dos tramos)
  const lGeometry = useMemo(() => {
    if (!lShape) return null;
    const w = module.width / 2000, d = module.depth / 2000;
    const m = { x0: -w, x1: w, z0: -d, z1: d };
    const a = lShape;
    if (Math.abs(a.z0 - m.z1) > 0.003) return null;
    let pts: Array<[number, number]> | null = null;
    if (Math.abs(a.x0 - m.x0) < 0.003) pts = [[m.x0, m.z0], [m.x1, m.z0], [m.x1, m.z1], [a.x1, m.z1], [a.x1, a.z1], [a.x0, a.z1]];
    else if (Math.abs(a.x1 - m.x1) < 0.003) pts = [[m.x0, m.z0], [m.x1, m.z0], [m.x1, a.z1], [a.x0, a.z1], [a.x0, m.z1], [m.x0, m.z1]];
    if (!pts) return null;
    const shape = new THREE.Shape();
    pts.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    shape.closePath();
    const h = module.height / 1000;
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    return g;
  }, [lShape?.x0, lShape?.x1, lShape?.z0, lShape?.z1, module.width, module.depth, module.height]);
  const isL = !!lGeometry;
  const isD = !!module.detailed && !!module.frontsLayout && !module.cornerArm && module.depth >= 60; // módulo convertido: se ve por sus piezas

  // Mueble de la poceta: el cuerpo lleva un hueco en la cara superior, del tamaño de la cubeta, para que se vea su profundidad
  const pocketGeos = useMemo(() => {
    if (!pocket) return null;
    const W = module.width / 1000, D = module.depth / 1000, H = module.height / 1000;
    const pd = Math.max(0.02, Math.min(pocket.depth, H - 0.1));
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, D / 2); shape.lineTo(W / 2, D / 2); shape.lineTo(W / 2, -D / 2); shape.lineTo(-W / 2, -D / 2); shape.closePath();
    const hole = new THREE.Path();
    const m = 0.006; // el hueco es un poco mayor que la cubeta, para que las paredes de acero no se confundan con las del mueble
    const x0 = pocket.dx - pocket.w / 2 - m, x1 = pocket.dx + pocket.w / 2 + m, z0 = pocket.dz - pocket.d / 2 - m, z1 = pocket.dz + pocket.d / 2 + m;
    hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.closePath();
    shape.holes.push(hole);
    const ring = new THREE.ExtrudeGeometry(shape, { depth: pd, bevelEnabled: false });
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, H / 2 - pd, 0);
    return { ring, lowerH: H - pd, shift: -pd / 2 };
  }, [pocket?.dx, pocket?.dz, pocket?.w, pocket?.d, pocket?.depth, module.width, module.depth, module.height]);
  const isP = !!pocketGeos;

  const color = isResizing ? '#10b981' : (isDragging ? '#4f46e5' : (hovered ? '#FFD700' : (tono ?? COLORS[module.type] ?? '#cccccc')));

  // Arrastre del módulo completo: se mide a lo largo del eje del muro (X en el muro A, Z en B y C)
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isOverlay(e)) return;
    if (e.nativeEvent.button === 2) return; // el clic derecho abre el formulario del módulo: no arrastra
    if (onDragPosition && controlsRef?.current && !isResizing) {
      setIsDragging(true);
      controlsRef.current.enabled = false; // Desactivar OrbitControls durante arrastre
      dragStart.current = { along: e.point.dot(wallAxis(module.wall)), moduleX: module.positionX };
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (hoverRef) hoverRef.current = { id: module.uniqueId, point: e.point.clone() };
    if (isDragging && dragStart.current && onDragPosition && !isResizing) {
      e.stopPropagation();
      const deltaMm = (e.point.dot(wallAxis(module.wall)) - dragStart.current.along) * 1000;
      const rawPositionX = Math.max(0, dragStart.current.moduleX + deltaMm);
      // Redondear a múltiplos de 5mm para snap grid
      onDragPosition(module.uniqueId, Math.round(rawPositionX / 5) * 5);
    }
  };

  const endDrag = () => {
    setIsDragging(false);
    dragStart.current = null;
    if (controlsRef?.current) controlsRef.current.enabled = true; // Reactivar OrbitControls
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      e.stopPropagation();
      endDrag();
    }
  };

  // Si se suelta el botón fuera del módulo, igual se termina el arrastre
  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('pointerup', endDrag);
    return () => window.removeEventListener('pointerup', endDrag);
  }, [isDragging]);

  // Redimensionar desde un borde (esferas laterales)
  const startEdgeDrag = useDocumentDrag(
    (dx, dy) => {
      const st = edgeStart.current;
      if (!st || !onResizeEdge) return;
      // Si el cursor toca la cara de otro módulo, esa cara es la referencia: el costado se alinea con ella
      const hv = hoverRef?.current;
      const ref = hv && hv.id !== module.uniqueId ? resolveReference?.(module.uniqueId, st.side, hv.id, hv.point) : null;
      if (ref?.width != null) {
        onResizeEdge(module.uniqueId, st.side, st.side === 'right' ? ref.width - st.initialWidth : st.initialWidth - ref.width, st.initialWidth, st.moduleX);
        return;
      }
      onResizeEdge(module.uniqueId, st.side, pixelsToMm(dx, dy, st.sx, st.sy), st.initialWidth, st.moduleX);
    },
    () => {
      edgeStart.current = null;
      setIsResizing(null);
      if (controlsRef?.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
    }
  );

  // Fondo o alto del módulo: se arrastra una flecha a lo largo del eje correspondiente (profundidad o vertical)
  const measureStart = useRef<{ field: 'depth' | 'height' | 'top'; value: number; gap: number; sx: number; sy: number; sign: number } | null>(null);
  const startMeasureDrag = useDocumentDrag(
    (dx, dy) => {
      const st = measureStart.current;
      if (!st || !onApplyMeasures) return;
      const hv = hoverRef?.current;
      if (hv && hv.id !== module.uniqueId) {
        const face: FaceKey = st.field === 'depth' ? 'front' : st.field === 'top' ? 'top' : 'bottom';
        const ref = resolveReference?.(module.uniqueId, face, hv.id, hv.point);
        if (ref) {
          const clampH = (n: number) => Math.min(2400, Math.max(15, n));
          if (st.field === 'top') { if (ref.height != null) onSetTop?.(module.uniqueId, clampH(ref.height), Math.max(0, ref.topGap ?? 0)); }
          else onApplyMeasures(module.uniqueId, { width: module.width, depth: ref.depth != null ? Math.min(1200, Math.max(15, ref.depth)) : module.depth, height: ref.height != null ? clampH(ref.height) : module.height });
          return;
        }
      }
      if (st.field === 'top') {
        // Borde superior: los bajos crecen o se acortan por arriba; los aéreos suben hasta el techo o bajan dejando
        // espacio arriba, y su borde inferior no se mueve
        const d = st.sign * pixelsToMm(dx, dy, st.sx, st.sy);
        const upper = module.type === 'UPPER';
        const gap = upper ? Math.max(0, Math.round((st.gap - d) / 5) * 5) : 0;
        const height = Math.min(2400, Math.max(15, Math.round((st.value + (upper ? st.gap - gap : d)) / 5) * 5));
        onSetTop?.(module.uniqueId, height, gap);
        return;
      }
      const [lo, hi] = st.field === 'depth' ? [15, 1200] : [15, 2400];
      const value = Math.min(hi, Math.max(lo, Math.round((st.value + st.sign * pixelsToMm(dx, dy, st.sx, st.sy)) / 5) * 5));
      onApplyMeasures(module.uniqueId, { width: module.width, depth: st.field === 'depth' ? value : module.depth, height: st.field === 'height' ? value : module.height });
    },
    () => {
      measureStart.current = null;
      if (controlsRef?.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
    }
  );
  const handleMeasurePointerDown = (e: { clientX: number; clientY: number }, field: 'depth' | 'height' | 'top', sign = 1) => {
    if (!onApplyMeasures || !controlsRef?.current) return;
    const axis = field === 'height' || field === 'top' ? new THREE.Vector3(0, 1, 0)
      : module.wall === 'A' || module.wall === 'Island' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(module.wall === 'B' ? 1 : -1, 0, 0);
    const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), axis);
    measureStart.current = { field, value: field === 'depth' ? module.depth : module.height, gap: module.topGap ?? 0, sx, sy, sign };
    controlsRef.current.enabled = false;
    document.body.style.cursor = 'ns-resize';
    startMeasureDrag(e);
  };

  const handleEdgePointerDown = (e: { clientX: number; clientY: number }, side: 'left' | 'right') => {
    if (!onResizeEdge || !controlsRef?.current) return;
    const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), wallAxis(module.wall));
    edgeStart.current = { side, moduleX: module.positionX, initialWidth: module.width, sx, sy };
    setIsResizing(side);
    controlsRef.current.enabled = false;
    document.body.style.cursor = 'ew-resize';
    startEdgeDrag(e);
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'move';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (hoverRef?.current?.id === module.uniqueId) hoverRef.current = null;
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => { e.stopPropagation(); if (isDragging) endDrag(); if (!isOverlay(e)) onSelect?.(module.uniqueId, !!(e.nativeEvent as MouseEvent).shiftKey); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (isOverlay(e)) return; onSelect?.(module.uniqueId); onOpenEditor?.(module.uniqueId); }}
      onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); if (isOverlay(e) || !onContext) return; onSelect?.(module.uniqueId); onContext(module.uniqueId); }}
      castShadow={!isD}
      receiveShadow={!isD}
    >
      <boxGeometry args={[module.width / 1000, module.height / 1000, module.depth / 1000]} />
      {/* Solo es transparente mientras se arrastra: un material transparente siempre se dibuja después de las
          aristas y las tapa. polygonOffset empuja las caras hacia atrás para que las aristas queden a la vista. */}
      <meshStandardMaterial
        color={color}
        visible={!isD}
        opacity={isL || isP || isD ? 0 : (isDragging || isResizing ? 0.7 : 1)}
        transparent={isL || isP || isD || isDragging || isResizing !== null}
        depthWrite={!isL && !isP && !isD}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
      {!isL && !isD && <Edges color={isResizing ? "#10b981" : (isDragging ? "#6366f1" : (marked ? "#f59e0b" : (selected ? "#ef4444" : "#3b2a1a")))} linewidth={isDragging || isResizing || selected || marked ? 3 : 1} />}
      {isP && pocketGeos && (
        <>
          <mesh position={[0, pocketGeos.shift, 0]} castShadow receiveShadow>
            <boxGeometry args={[module.width / 1000, pocketGeos.lowerH, module.depth / 1000]} />
            <meshStandardMaterial color={color} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
          <mesh geometry={pocketGeos.ring} castShadow receiveShadow>
            <meshStandardMaterial color={color} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          </mesh>
        </>
      )}
      {isL && lGeometry && (
        <mesh geometry={lGeometry} castShadow receiveShadow>
          <meshStandardMaterial color={color} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          <Edges color={isResizing ? "#10b981" : (isDragging ? "#6366f1" : (marked ? "#f59e0b" : (selected ? "#ef4444" : "#3b2a1a")))} linewidth={isDragging || isResizing || selected || marked ? 3 : 1} />
        </mesh>
      )}
      {/* El nombre del módulo se ve igual en todas las vistas: en planta sobre su cara superior y en las demás al centro de su cara frontal */}
      {showLabel && (
        <Html position={isPlan ? [0, module.height / 2000 + 0.002, 0] : [0, 0, module.depth / 2000 + 0.01]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
          <div className="select-none whitespace-nowrap text-[10px] leading-none font-bold text-white" style={{ textShadow: '0 0 3px #000, 0 0 3px #000, 0 0 2px #000', fontSize: 14 }}>
            {module.label || ''}
          </div>
        </Html>
      )}

      {/* Controles en miniatura */}
      {/* Botón eliminar - esquina superior izquierda */}
      {selected && onDelete && (
        // Los dos botones van en el centro superior del módulo, uno a cada lado del centro. En las esquinas, el "+" de un
        // módulo caía exactamente sobre la "X" del siguiente y la tapaba (y en Planta, las flechas dobles).
        <HtmlScaled
          position={[0, module.height / 2000 - 0.05, module.depth / 2000 + 0.01]}
          center
          distanceFactor={1}
          zIndexRange={[100, 0]}
        >
          <button
            data-overlay
            style={{ transform: `translateX(${isPlan ? -100 : -70}px)` }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(module.uniqueId);
            }}
            className="w-18 h-18 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110"
            title="Eliminar"
          >
            <X size={36} strokeWidth={3} />
          </button>
        </HtmlScaled>
      )}

      {/* Botón dividir - esquina superior derecha */}
      {selected && onSplit && (
        <HtmlScaled
          position={[0, module.height / 2000 - 0.05, module.depth / 2000 + 0.01]}
          center
          distanceFactor={1}
          zIndexRange={[100, 0]}
        >
          <button
            data-overlay
            style={{ transform: `translateX(${isPlan ? 100 : 70}px)` }}
            onClick={(e) => {
              e.stopPropagation();
              onSplit(module.uniqueId);
            }}
            className="w-18 h-18 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110"
            title="Dividir"
          >
            <Plus size={36} strokeWidth={3} />
          </button>
        </HtmlScaled>
      )}

      {/* Etiqueta de dimensión. En planta va separada del frente del módulo (así no tapa la X y el +); si el módulo está
          seleccionado se dibuja como cota roja con su línea. Tamaño fijo en pantalla (sin distanceFactor). */}
      {(() => {
        const labelPos: [number, number, number] = isPlan
          ? [0, module.height / 2000 + 0.002, module.depth / 2000 + (selected ? 0.16 : 0.09)]
          : [0, -module.height / 2000 - (selected ? 0.14 : 0.05), module.depth / 2000 + 0.01];
        const halfW = module.width / 2000;
        const cotaZ = labelPos[2];
        return (
          <>
            {selected && !isPlan && (() => {
              // Cota del alto al costado libre del módulo (el largo ya está en el número de abajo)
              const sx = (costado === 'left' ? -1 : 1) * (halfW + 0.07);
              const hh = module.height / 2000;
              const z = module.depth / 2000 + 0.01;
              return (
                <>
                  <Line points={[[sx, -hh, z], [sx, hh, z]]} color="#111827" lineWidth={1} />
                  <Line points={[[sx - 0.018, -hh - 0.018, z], [sx + 0.018, -hh + 0.018, z]]} color="#111827" lineWidth={1.5} />
                  <Line points={[[sx - 0.018, hh - 0.018, z], [sx + 0.018, hh + 0.018, z]]} color="#111827" lineWidth={1.5} />
                  <Html position={[sx, -hh * 0.6, z]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }} {...(viewMode === 'isometric' || viewMode === '3d' ? { transform: true, distanceFactor: 3 } : {})}>
                    <div data-overlay>
                      <DimLabel
                        text={String(Math.round(module.height))}
                        value={module.height}
                        tone="red"
                        title={`${Math.round(module.height)} mm. Clic para editar el alto`}
                        onCommit={onApplyMeasures ? (typed) => onApplyMeasures(module.uniqueId, { width: module.width, depth: module.depth, height: typed }) : undefined}
                      />
                    </div>
                  </Html>
                </>
              );
            })()}
            {selected && isPlan && (() => {
              // Cota al costado (derecha) del módulo: línea paralela al fondo, separada del borde
              const sx = (costado === 'left' ? -1 : 1) * (halfW + 0.07);
              const hd = module.depth / 2000;
              const y = labelPos[1];
              return (
                <>
                  <Line points={[[sx, y, -hd], [sx, y, hd]]} color="#111827" lineWidth={1} />
                  <Line points={[[sx - 0.018, y, -hd - 0.018], [sx + 0.018, y, -hd + 0.018]]} color="#111827" lineWidth={1.5} />
                  <Line points={[[sx - 0.018, y, hd - 0.018], [sx + 0.018, y, hd + 0.018]]} color="#111827" lineWidth={1.5} />
                  <Html position={[sx, y, 0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                    <div data-overlay>
                      <DimLabel
                        text={String(Math.round(module.depth))}
                        value={module.depth}
                        tone="red"
                        title={`${Math.round(module.depth)} mm. Clic para editar el ancho (fondo)`}
                        onCommit={onApplyMeasures ? (typed) => onApplyMeasures(module.uniqueId, { width: module.width, depth: typed, height: module.height }) : undefined}
                      />
                    </div>
                  </Html>
                </>
              );
            })()}
            {!isL && <Html position={labelPos} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }} {...(viewMode === 'isometric' || viewMode === '3d' ? { transform: true, distanceFactor: 3 } : {})}>
              {/* Clic para escribir el largo: el módulo se amplía hacia los dos lados y arrastra a sus vecinos */}
              <div data-overlay>
                <DimLabel
                  text={String(Math.round((source ?? module).width))}
                  value={(source ?? module).width}
                  tone={selected && isPlan ? 'red' : 'white'}
                  title={`${Math.round((source ?? module).width)} mm. Clic para editar el largo`}
                  onCommit={onEditDimension ? (typed) => onEditDimension(module.uniqueId, typed) : undefined}
                />
              </div>
            </Html>}
          </>
        );
      })()}

      {/* Módulo seleccionado: manijas azules flotando frente al centro de cada cara libre (sin otro módulo pegado). Clic sostenido y
          arrastre = extruir o jalar esa cara con su cota; clic simple = estirar hasta la siguiente cara de referencia */}
      {selected && faces && !isDragging && (() => {
        const w = module.width / 2000, h = module.height / 2000, d = module.depth / 2000, out = 0.08;
        const start = (field: 'depth' | 'height' | 'top', sign: number) => (e: { clientX: number; clientY: number }) => handleMeasurePointerDown(e, field, sign);
        const list: Array<{ face: FaceKey; on: boolean; pos: [number, number, number]; n: [number, number, number]; label: string; title: string; start: (e: { clientX: number; clientY: number }) => void }> = [
          { face: 'left', on: faces.left && !!onResizeEdge, pos: [-w - out, 0, 0], n: [-1, 0, 0], label: `${Math.round(module.width)} mm`, title: 'Jalar el costado izquierdo (clic simple: estirar hasta el siguiente tope)', start: (e) => handleEdgePointerDown(e, 'left') },
          { face: 'right', on: faces.right && !!onResizeEdge, pos: [w + out, 0, 0], n: [1, 0, 0], label: `${Math.round(module.width)} mm`, title: 'Jalar el costado derecho (clic simple: estirar hasta el siguiente tope)', start: (e) => handleEdgePointerDown(e, 'right') },
          { face: 'front', on: faces.front && !!onApplyMeasures, pos: [0, 0, d + out], n: [0, 0, 1], label: `${Math.round(module.depth)} mm`, title: 'Jalar el frente (clic simple: estirar hasta el siguiente tope)', start: start('depth', 1) },
          { face: 'top', on: faces.top && !!onApplyMeasures, pos: [0, h + out, 0], n: [0, 1, 0], label: `${Math.round(module.height)} mm`, title: 'Jalar la cara de arriba (clic simple: estirar hasta el siguiente tope)', start: start('top', 1) },
          { face: 'bottom', on: faces.bottom && !!onApplyMeasures, pos: [0, -h - out, 0], n: [0, -1, 0], label: `${Math.round(module.height)} mm`, title: 'Jalar la cara de abajo (clic simple: estirar hasta el siguiente tope)', start: start('height', -1) },
        ];
        return list.filter(f => f.on).map(f => (
          <FaceHandle
            key={f.face}
            position={f.pos}
            normal={f.n}
            meshPosition={position}
            meshRotation={rotation}
            label={f.label}
            title={f.title}
            onStart={f.start}
            onClick={() => onExtendFace?.(module.uniqueId, f.face)}
          />
        ));
      })()}

      {/* Con el módulo seleccionado (clic), cada cara trae su X roja (eliminar) y su + verde (dividir): la cara de arriba lo divide
          en uno superior y uno inferior; el costado, en uno frontal y uno posterior. Solo en isométrica y 3D, donde esas caras se ven */}
      {selected && (viewMode === 'isometric' || viewMode === '3d') && ([
        { key: 'top', pos: [0, module.height / 2000 + 0.002, -module.depth / 2000 * 0.5] as [number, number, number], rot: [-Math.PI / 2, 0, 0] as [number, number, number], split: onSplitHorizontal, title: 'Dividir en uno superior y uno inferior' },
        { key: 'side', pos: [module.width / 2000 + 0.002, module.height / 2000 * 0.55, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], split: onSplitDepth, title: 'Dividir en uno frontal y uno posterior' },
      ]).map(face => (
        <HtmlScaled key={face.key} position={face.pos} rotation={face.rot} center distanceFactor={1} zIndexRange={[105, 0]}>
          <div data-overlay className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(module.uniqueId); }}
                className="w-18 h-18 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110"
                title="Eliminar"
              >
                <X size={36} strokeWidth={3} />
              </button>
            )}
            {face.split && (
              <button
                onClick={(e) => { e.stopPropagation(); face.split!(module.uniqueId); }}
                className="w-18 h-18 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg border-2 border-white flex items-center justify-center transition-all hover:scale-110"
                title={face.title}
              >
                <Plus size={36} strokeWidth={3} />
              </button>
            )}
          </div>
        </HtmlScaled>
      ))}

      {/* Clic derecho: formulario del módulo. Por ahora pregunta si lleva puertas o cajones (solo módulos base) */}
      {contextOpen && onChooseFronts && onCloseContext && (module.type === 'LOWER' || module.type === 'UPPER') && !module.cornerArm && (
        <Html position={[0, module.height / 2000 + 0.01, 0]} center zIndexRange={[210, 0]} occlude={false} style={{ pointerEvents: 'none' }}>
          <div data-overlay data-module-editor className="pointer-events-auto w-52 p-3 space-y-2 rounded-xl bg-white border border-slate-300 shadow-xl" onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">{module.label ? `${module.label} · ` : ''}{Math.round(module.width)} mm</div>
            <div className="text-[12px] font-black text-slate-800">{module.type === 'UPPER' ? '¿Puertas verticales, horizontales o abierto?' : '¿Puertas, cajones o abierto?'}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(module.type === 'UPPER' ? [['vertical', 'Verticales'], ['horizontal', 'Horizontales'], ['open', 'Abierto']] as const : [['doors', 'Puertas'], ['drawers', 'Cajones'], ['open', 'Abierto']] as const).map(([k, label]) => {
                const horizontal = module.frontsLayout === 'upper-door2-h' || module.frontsLayout === 'hood-h';
                const current = !module.detailed ? null : module.frontsLayout === 'open' ? 'open' : module.type === 'UPPER' ? (horizontal ? 'horizontal' : 'vertical') : (module.frontsLayout === 'drawers' ? 'drawers' : 'doors');
                return (
                  <button key={k} onClick={() => { onChooseFronts(module.uniqueId, k); onCloseContext(); }} className={`py-2 rounded-lg text-[11px] font-black border-2 transition-colors ${current === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>{label}</button>
                );
              })}
            </div>
            <button className="w-full py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={onCloseContext}>Cerrar</button>
          </div>
        </Html>
      )}

      {/* Doble clic: editor de largo, ancho (fondo) y alto */}
      {editing && onApplyMeasures && onCloseEditor && (
        <Html position={[0, module.height / 2000 + 0.01, 0]} center zIndexRange={[200, 0]} occlude={false} style={{ pointerEvents: 'none' }}>
          <ModuleEditor module={source ?? module} onApply={(m) => { onApplyMeasures(module.uniqueId, { width: m.width, depth: m.depth, height: m.height }); onSetVistos?.(module.uniqueId, m.sides); }} onClose={onCloseEditor} onChooseFronts={onChooseFronts} />
        </Html>
      )}

      {/* Indicador de arrastre/redimensionamiento activo */}
      {(isDragging || isResizing) && (
        <HtmlScaled
          position={[0, module.height / 2000 + 0.15, 0]}
          center
          distanceFactor={1}
          zIndexRange={[100, 0]}
        >
          <div className={`px-4 py-2 ${isResizing ? 'bg-green-600' : 'bg-blue-600'} text-white text-xl font-black rounded-lg shadow-2xl border-2 border-white animate-pulse`}>
            {isResizing ? '↔️ REDIMENSIONANDO' : '🔄 MOVIENDO'}
          </div>
        </HtmlScaled>
      )}
    </mesh>
  );
};

// Componente para controlar la unión entre dos módulos adyacentes
interface JunctionControl3DProps {
  leftModule: KitchenModule;
  rightModule: KitchenModule;
  position: [number, number, number];
  rotation?: [number, number, number];
  onResizeJunction?: (leftId: string, rightId: string, deltaX: number, initialLeftWidth: number, initialRightWidth: number, initialLeftPositionX: number, initialRightPositionX: number) => void;
  controlsRef?: React.RefObject<any>;
  wall: WallName | 'Island';
}

const JunctionControl3D: React.FC<JunctionControl3DProps> = ({ leftModule, rightModule, position, rotation = [0, 0, 0], onResizeJunction, controlsRef, wall }) => {
  const { camera, size } = useThree();
  const isOrtho = !!(camera as any).isOrthographicCamera;
  const [isResizing, setIsResizing] = useState(false);
  const [matched, setMatched] = useState(false);
  const matchedEl = useRef<HTMLElement | null>(null);
  // Ángulo del eje del muro en pantalla: la flecha doble gira para apuntar a lo largo del muro
  // (en planta, los brazos B y C son verticales). Se mantiene entre -90 y 90 para no quedar al revés.
  const [arrowAngle, setArrowAngle] = useState(0);
  const arrowAngleRef = useRef(0);
  useFrame(() => {
    const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), wallAxis(wall));
    const degrees = sx * sx + sy * sy < 4 ? 0 : (Math.atan2(sy, sx) * 180) / Math.PI; // eje de frente a la cámara: sin giro
    const normalized = Math.round((((degrees + 90) % 180) + 180) % 180 - 90);
    if (normalized !== arrowAngleRef.current) { arrowAngleRef.current = normalized; setArrowAngle(normalized); }
  });
  const dragStart = useRef<{ leftId: string; rightId: string; leftWidth: number; rightWidth: number; leftPositionX: number; rightPositionX: number; sx: number; sy: number } | null>(null);
  const row = leftModule.type === 'UPPER' ? 'upper' : 'lower';

  const highlightTarget = (el: HTMLElement | null) => {
    if (matchedEl.current === el) return;
    matchedEl.current?.classList.remove('ring-8', 'ring-emerald-500');
    el?.classList.add('ring-8', 'ring-emerald-500');
    matchedEl.current = el;
    setMatched(el !== null);
  };

  // El arrastre usa refs (ver useDocumentDrag) para no quedarse con el estado del momento del clic
  const startDrag = useDocumentDrag(
    (dx, dy, ev) => {
      const st = dragStart.current;
      if (!st || !onResizeJunction) return;
      let deltaMm = pixelsToMm(dx, dy, st.sx, st.sy);

      // Si el cursor toca la flecha doble de la otra fila (arriba o abajo) del mismo muro, la unión se iguala a ella
      const hit = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-junction-pos]') as HTMLElement | null;
      const valid = hit && hit.dataset.junctionWall === wall && hit.dataset.junctionRow !== row ? hit : null;
      highlightTarget(valid);
      if (valid) deltaMm = Number(valid.dataset.junctionPos) - (st.leftPositionX + st.leftWidth);

      onResizeJunction(st.leftId, st.rightId, deltaMm, st.leftWidth, st.rightWidth, st.leftPositionX, st.rightPositionX);
    },
    () => {
      highlightTarget(null);
      dragStart.current = null;
      setIsResizing(false);
      if (controlsRef?.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
    }
  );

  const handlePointerDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onResizeJunction) return;
    const { sx, sy } = screenPixelsPerMeter(camera, size, new THREE.Vector3(...position), wallAxis(wall));
    dragStart.current = {
      leftId: leftModule.uniqueId,
      rightId: rightModule.uniqueId,
      leftWidth: leftModule.width,
      rightWidth: rightModule.width,
      leftPositionX: leftModule.positionX,
      rightPositionX: rightModule.positionX,
      sx, sy,
    };
    setIsResizing(true);
    if (controlsRef?.current) controlsRef.current.enabled = false;
    document.body.style.cursor = 'ew-resize';
    startDrag(e);
  };

  // Calcular la altura promedio de los dos módulos para centrar el control
  const avgHeight = (leftModule.height + rightModule.height) / 2;
  const depth = Math.max(leftModule.depth, rightModule.depth);

  return (
    <HtmlScaled
      zoomScale
      position={position}
      rotation={rotation}
      center
      distanceFactor={1}
      zIndexRange={[100, 0]}
    >
      <div
        className={`w-8 h-8 rounded-full ${isResizing ? 'bg-green-200 border-green-600' : 'bg-purple-100 border-purple-600'} border-2 shadow-md flex items-center justify-center backdrop-blur-sm cursor-ew-resize hover:bg-purple-200 hover:scale-110 transition-all`}
        title="Arrastra para redimensionar"
        data-junction-pos={leftModule.positionX + leftModule.width}
        data-junction-wall={wall}
        data-junction-row={row}
        style={{ pointerEvents: isResizing ? 'none' : undefined }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handlePointerDown(e);
        }}
      >
        {/* En ortogonales la flecha gira para seguir el eje del muro en pantalla; en perspectiva el control ya está apoyado en la cara
            del módulo (su transformación 3D lo orienta), así que no se gira: la línea central queda paralela a la unión entre módulos */}
        <div className="flex items-center gap-0" style={{ transform: `rotate(${isOrtho ? arrowAngle : 0}deg)` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-[2px] h-2.5 bg-purple-600 rounded"></div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {isResizing && (
        <div className="absolute top-full mt-2 px-4 py-2 bg-green-600 text-white text-xl font-black rounded-lg shadow-2xl border-2 border-white animate-pulse whitespace-nowrap">
          {matched ? '✓ IGUALADA' : '↔️ UNIÓN'}
        </div>
      )}
    </HtmlScaled>
  );
};

const Appliance3D: React.FC<{ appliance: Appliance, position: [number, number, number], rotation?: [number, number, number], spaceHeight: number, zh: number, basinDepth?: number, faucetFront?: boolean, onGrab?: (e: ThreeEvent<PointerEvent>) => void }> = ({ appliance, position, rotation = [0, 0, 0], spaceHeight, zh, basinDepth = 0.02, faucetFront = false, onGrab }) => {
  const color = appliance.type === 'fridge' ? COLORS.FRIDGE : (appliance.type === 'stove' ? '#0a0a0a' : appliance.type === 'pantry' ? '#d1d5db' : COLORS.SINK);
  const metalness = (appliance.type === 'fridge' || appliance.type === 'sink') ? 0.6 : 0.4;
  const roughness = 0.2;

  const isDetailed = ['hood-under', 'hood-island', 'sink', 'stove', 'pantry'].includes(appliance.type);

  return (
    <group
      position={position}
      rotation={rotation}
      onPointerDown={onGrab}
      onPointerOver={(e) => { if (onGrab) { e.stopPropagation(); document.body.style.cursor = 'grab'; } }}
      onPointerOut={() => { if (onGrab) document.body.style.cursor = 'auto'; }}
    >
      {/* Zona invisible para agarrar la estufa y la poceta, que son muy delgadas */}
      {(appliance.type === 'stove' || appliance.type === 'sink') && (
        <mesh>
          <boxGeometry args={[appliance.width / 1000, 0.08, appliance.depth / 1000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {!isDetailed && (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[appliance.width / 1000, appliance.height / 1000, appliance.depth / 1000]} />
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
          <Edges color="#374151" />
        </mesh>
      )}

      {appliance.type === 'fridge' && (
        <group position={[0, 0, appliance.depth / 2000 + 0.01]}>
          <mesh position={[-0.05, 0, 0.01]}><boxGeometry args={[0.02, 0.8, 0.02]} /><meshStandardMaterial color="#888" metalness={0.9} /></mesh>
          <mesh position={[0.05, 0, 0.01]}><boxGeometry args={[0.02, 0.8, 0.02]} /><meshStandardMaterial color="#888" metalness={0.9} /></mesh>
          <mesh position={[-appliance.width / 4000, 0.15, 0.005]}><boxGeometry args={[0.12, 0.18, 0.01]} /><meshStandardMaterial color="#333" /></mesh>
          <mesh position={[0, 0, -0.005]}><boxGeometry args={[0.002, appliance.height / 1000, 0.01]} /><meshStandardMaterial color="#000" /></mesh>
        </group>
      )}

      {appliance.type === 'pantry' && (
        <group>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[appliance.width / 1000, (spaceHeight - TOP_MARGIN) / 1000 - zh, appliance.depth / 1000]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            <Edges color="#64748b" />
          </mesh>
          <mesh position={[0, 0, appliance.depth / 2000 + 0.001]}>
            <boxGeometry args={[0.002, (spaceHeight - TOP_MARGIN) / 1000 - zh, 0.005]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0, appliance.depth / 2000 + 0.001]}>
            <boxGeometry args={[appliance.width / 1000, 0.002, 0.005]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>
        </group>
      )}

      {appliance.type === 'stove' && (
        <group>
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <boxGeometry args={[appliance.width / 1000, 0.015, appliance.depth / 1000]} />
            <meshStandardMaterial color="#050505" metalness={0.9} roughness={0.05} />
            <Edges color="#222" />
          </mesh>
          <group position={[0, 0.008, 0]}>
            <mesh position={[-0.15, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.06, 0.062, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
            </mesh>
            <mesh position={[0.15, 0, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.082, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
            </mesh>
            <mesh position={[0, 0, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.07, 0.072, 32]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
            </mesh>
          </group>
        </group>
      )}

      {appliance.type === 'sink' && (() => {
        // El origen del grupo está en la cara superior del mesón. La poceta cae por la abertura del mesón
        // (30 mm menor por lado que el equipo) y el borde descansa sobre el mesón.
        const cw = (appliance.width - 60) / 1000;   // ancho de la cubeta
        const cd = (appliance.depth - 60) / 1000;   // fondo de la cubeta
        // En esta etapa los módulos son cajas macizas: la cubeta se dibuja con la profundidad del mesón
        // (hundida hasta la cara superior del módulo) para que se vea dentro de la abertura
        const bh = Math.max(basinDepth - 0.002, 0.01);
        const t = 0.002;                            // espesor de la lámina
        const rim = 0.02;                           // ancho del borde que apoya sobre el mesón
        const steel = <meshStandardMaterial color="#c9ced4" metalness={0.85} roughness={0.25} />;
        return (
          <group>
            {/* Cubeta: fondo y cuatro paredes */}
            <mesh position={[0, -bh, 0]}><boxGeometry args={[cw, t, cd]} />{steel}</mesh>
            <mesh position={[0, -bh / 2, cd / 2]}><boxGeometry args={[cw, bh, t]} />{steel}</mesh>
            <mesh position={[0, -bh / 2, -cd / 2]}><boxGeometry args={[cw, bh, t]} />{steel}</mesh>
            <mesh position={[cw / 2, -bh / 2, 0]}><boxGeometry args={[t, bh, cd]} />{steel}</mesh>
            <mesh position={[-cw / 2, -bh / 2, 0]}><boxGeometry args={[t, bh, cd]} />{steel}</mesh>
            {/* Borde sobre el mesón */}
            <mesh position={[0, 0.002, cd / 2 + rim / 2]}><boxGeometry args={[cw + 2 * rim, 0.004, rim]} />{steel}</mesh>
            <mesh position={[0, 0.002, -cd / 2 - rim / 2]}><boxGeometry args={[cw + 2 * rim, 0.004, rim]} />{steel}</mesh>
            <mesh position={[cw / 2 + rim / 2, 0.002, 0]}><boxGeometry args={[rim, 0.004, cd]} />{steel}</mesh>
            <mesh position={[-cw / 2 - rim / 2, 0.002, 0]}><boxGeometry args={[rim, 0.004, cd]} />{steel}</mesh>
            {/* Grifería detrás de la cubeta (contra el muro). En la isla o península va al frente, vuelta hacia adentro: el pico apunta al muro A */}
            <group position={[0, 0, (faucetFront ? 1 : -1) * (cd / 2 + rim + 0.03)]} rotation={[0, faucetFront ? Math.PI : 0, 0]}>
              <mesh><cylinderGeometry args={[0.035, 0.04, 0.04, 16]} /><meshStandardMaterial color="#eee" metalness={1} /></mesh>
              <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.015, 0.015, 0.34, 16]} /><meshStandardMaterial color="#eee" metalness={1} /></mesh>
              <mesh position={[0, 0.34, 0.07]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.14, 16]} /><meshStandardMaterial color="#eee" metalness={1} /></mesh>
              <mesh position={[0.05, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.03, 0.08, 0.02]} /><meshStandardMaterial color="#ccc" metalness={0.8} /></mesh>
            </group>
          </group>
        );
      })()}

      {appliance.type === 'hood-under' && (
        <group position={[0, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[appliance.width / 1000, 0.12, appliance.depth / 1000]} />
            <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
            <Edges color="#444" />
          </mesh>
          <mesh position={[0.1, -0.02, appliance.depth / 2000 + 0.002]}>
            <boxGeometry args={[0.15, 0.03, 0.005]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}

      {appliance.type === 'hood-island' && (
        <group position={[0, -appliance.height / 2000, 0]}>
          <mesh castShadow><boxGeometry args={[appliance.width / 1000, 0.05, appliance.depth / 1000]} /><meshStandardMaterial color="#ddd" metalness={0.7} /><Edges color="#888" /></mesh>
          <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[appliance.width / 2500, appliance.width / 2000, 0.25, 4]} /><meshStandardMaterial color="#ddd" metalness={0.7} /><Edges color="#888" /></mesh>
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[appliance.width / 2500, 0.5, appliance.width / 2500]} /><meshStandardMaterial color="#ddd" metalness={0.7} /><Edges color="#888" /></mesh>
        </group>
      )}
    </group>
  );
};

/** Mesón: losa con aberturas (poceta, estufa) construida a partir de su caja en la lista */
/** Doble clic en el mesón: sus tres medidas (largo, fondo y espesor) y el salpicadero */
type CounterSettings = { thickness: number; overhang: number; hasSplash: boolean; splashHeight: number };
/** Estado izquierda/derecha (visto desde el frente) del salpicadero lateral y de la cascada de un tramo de mesón */
export type CounterSides = { splashLeft: boolean; splashRight: boolean; waterfallLeft: boolean; waterfallRight: boolean; bottomLeft?: number; bottomRight?: number; edge?: CounterEdge };

export const CounterEditor: React.FC<{
  box: Box;
  wall: string;
  settings: CounterSettings;
  sides: CounterSides;
  onApply: (s: CounterSettings, sides: CounterSides) => void;
  onClose: () => void;
  registrar?: (aplicar: () => void) => void; // embebido en otro formulario: ese formulario lo aplica con su botón
}> = ({ box, wall, settings, sides, onApply, onClose, registrar }) => {
  // Largo = a lo largo del muro (lo definen los módulos); fondo = hacia el frente (módulos + voladizo)
  // Isla o península: el voladizo va por delante y por detrás (2 lados); lleva salpicadero y cascada (con medida inferior)
  const isIsland = box.id.startsWith('counter-isla-');
  const overhangs = isIsland ? 2 : 1;
  const length = Math.round(wall === 'A' ? box.sx : box.sy);
  const baseDepth = Math.round((wall === 'A' ? box.sy : box.sx) - settings.overhang * overhangs); // fondo de los módulos
  const [vals, setVals] = useState({ depth: String(baseDepth + settings.overhang * overhangs), thickness: String(settings.thickness), splashHeight: String(settings.splashHeight) });
  const [hasSplash, setHasSplash] = useState(settings.hasSplash);
  const [side, setSide] = useState(sides);
  const [edge, setEdge] = useState<CounterEdge>(sides.edge ?? { kind: 'none', sides: { front: true, back: false, left: false, right: false }, height: 30, width: 20 }); // nariz o frentero sugerido: 30 mm
  const apply = () => {
    const n = (s: string, f: number) => { const x = parseFloat(s); return isNaN(x) ? f : x; };
    onApply({
      thickness: Math.max(10, Math.min(80, n(vals.thickness, settings.thickness))),
      overhang: isIsland ? settings.overhang : Math.max(0, Math.min(100, (n(vals.depth, baseDepth + settings.overhang * overhangs) - baseDepth) / overhangs)),
      hasSplash,
      splashHeight: Math.max(20, Math.min(600, n(vals.splashHeight, settings.splashHeight))),
    }, { ...side, edge });
    onClose();
  };
  registrar?.(apply);
  const field = (key: 'depth' | 'thickness' | 'splashHeight', label: string) => (
    <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
      {label}
      <input
        type="number"
        value={vals[key]}
        onChange={(e) => setVals({ ...vals, [key]: e.target.value })}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
        className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );
  return (
    <div data-overlay data-module-editor className={registrar ? 'w-full space-y-1.5' : 'pointer-events-auto w-48 p-2.5 space-y-1.5 rounded-xl bg-white border border-slate-300 shadow-xl'} onMouseDown={(e) => e.stopPropagation()}>
      {!registrar && <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">{box.name}</div>}
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
        Largo
        <span className="w-20 px-1.5 py-1 rounded bg-slate-100 text-[12px] font-black text-slate-500" title="Lo definen los módulos del tramo">{length}</span>
      </div>
      {isIsland ? (
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          Ancho (fondo)
          <span className="w-20 px-1.5 py-1 rounded bg-slate-100 text-[12px] font-black text-slate-500" title="Es la medida general de la isla o península: se cambia en su tarjeta de Espacio">{vals.depth}</span>
        </div>
      ) : field('depth', 'Ancho (fondo)')}
      {field('thickness', 'Espesor')}
      <div className="pt-1 border-t border-slate-200 space-y-1">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <input type="checkbox" checked={hasSplash} onChange={(e) => setHasSplash(e.target.checked)} />
          Salpicadero
        </label>
        {hasSplash && field('splashHeight', 'Altura')}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
          Lados
          <span className="flex items-center gap-2">
            <label className="flex items-center gap-1"><input type="checkbox" checked={side.splashLeft} onChange={(e) => setSide({ ...side, splashLeft: e.target.checked })} />Izq.</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={side.splashRight} onChange={(e) => setSide({ ...side, splashRight: e.target.checked })} />Der.</label>
          </span>
        </div>
      </div>
      <div className="pt-1 border-t border-slate-200 space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500" title="El mesón baja del tope al piso por el costado">Cascada</div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={side.waterfallLeft} onChange={(e) => setSide({ ...side, waterfallLeft: e.target.checked })} />Izquierda</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={side.waterfallRight} onChange={(e) => setSide({ ...side, waterfallRight: e.target.checked })} />Derecha</label>
        </div>
        {/* Solo en la isla o península: medida inferior de la cascada (largo de su canto de abajo; arriba mide el ancho de la isla). Menor = chaflán */}
        {isIsland && ([['left', 'Izq.', 'bottomLeft', side.waterfallLeft], ['right', 'Der.', 'bottomRight', side.waterfallRight]] as const).filter(r => r[3]).map(([k, label, key]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600" title="Largo del canto de abajo de la cascada. Arriba mide el ancho de la isla; si abajo mide menos, la cascada lleva un chaflán por el frente">
            Medida inferior {label}
            <input
              type="number"
              value={side[key] ?? Math.round(box.sy)}
              onChange={(e) => setSide({ ...side, [key]: parseFloat(e.target.value) || 0 })}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
              className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
            />
          </label>
        ))}
      </div>
      <div className="pt-1 border-t border-slate-200 space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500" title="Frentero: pieza unida a 45° con el mesón. Reengruese: una pieza pegada por debajo del mesón">Canto</div>
        <div className="grid grid-cols-3 gap-1">
          {([['none', 'Ninguno'], ['frentero', 'Frentero'], ['reengruese', 'Reengruese']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setEdge({ ...edge, kind: k })} className={`py-1 rounded-lg text-[10px] font-black border ${edge.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
          ))}
        </div>
        {edge.kind !== 'none' && (
          <>
            <div className="text-[11px] font-bold text-slate-600">Lados</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-600">
              {([['front', 'Frente'], ['left', 'Izquierdo'], ['right', 'Derecho'], ...(isIsland ? [['back', 'Posterior']] : [])] as Array<[keyof CounterEdge['sides'], string]>).map(([k, label]) => (
                <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={edge.sides[k]} onChange={(e) => setEdge({ ...edge, sides: { ...edge.sides, [k]: e.target.checked } })} />{label}</label>
              ))}
            </div>
            {edge.kind === 'frentero' ? (
              <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600" title="Alto del frentero, medido desde la cara de arriba del mesón">
                Alto del frentero
                <input type="number" value={edge.height} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setEdge({ ...edge, height: parseFloat(e.target.value) || 0 })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }} className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500" />
              </label>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setEdge({ ...edge, width: 20, height: 20 })} className="py-1 rounded-lg text-[10px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50" title="Pieza de 2 x 2 cm">2 × 2 cm</button>
                  <button onClick={() => setEdge({ ...edge, width: 2 * settings.thickness, height: settings.thickness })} className="py-1 rounded-lg text-[10px] font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50" title="Pieza de 2 veces el espesor del mesón de ancho, y el espesor de alto">2 × espesor</button>
                </div>
                <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                  Ancho
                  <input type="number" value={edge.width} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setEdge({ ...edge, width: parseFloat(e.target.value) || 0 })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }} className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500" />
                </label>
                <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                  Alto
                  <input type="number" value={edge.height} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setEdge({ ...edge, height: parseFloat(e.target.value) || 0 })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }} className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500" />
                </label>
              </>
            )}
          </>
        )}
      </div>
      {!registrar && <div className="flex gap-1.5 pt-1">
        <button className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black" onClick={apply}>Aplicar</button>
        <button className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={onClose}>Cerrar</button>
      </div>}
    </div>
  );
};

/** Qué tiene hoy el mesón a cada lado (salpicaderos, cascadas, canto), visto desde el frente */
export function ladosDelMeson(b: Box, boxes: Box[], counterExtras?: Record<string, CounterExtras>): CounterSides {
  if (b.islandId) {
    const hasI = (label: string) => boxes.some(x => x.id === `salpicadero-isla-${b.islandId}-${label}`);
    const wf = (label: string) => boxes.find(x => x.id === `cascada-isla-${b.islandId}-${label}`);
    const bottom = (label: string) => b.sy - (wf(label)?.chamferY ?? 0);
    return { splashLeft: hasI('izquierda'), splashRight: hasI('derecha'), waterfallLeft: !!wf('izquierda'), waterfallRight: !!wf('derecha'), bottomLeft: bottom('izquierda'), bottomRight: bottom('derecha'), edge: counterExtras?.[b.id]?.edge };
  }
  // inicio del muro en A y C, final en B
  const has = (kind: string, label: string) => boxes.some(x => x.id === `${kind}-${b.wall}-${b.id.split('-')[2]}-${label}`);
  const l = b.wall === 'B' ? 'final' : 'inicio';
  const r = b.wall === 'B' ? 'inicio' : 'final';
  return { splashLeft: has('salpicadero', l), splashRight: has('salpicadero', r), waterfallLeft: has('cascada', l), waterfallRight: has('cascada', r), edge: counterExtras?.[b.id]?.edge };
}

/** Solo lo que el usuario cambió en el mesón (lo demás sigue automático) */
export function cambiosDelMeson(b: Box, boxes: Box[], counterExtras: Record<string, CounterExtras> | undefined, now: CounterSides): CounterExtras {
  const before = ladosDelMeson(b, boxes, counterExtras);
  const extras: CounterExtras = {};
  if (JSON.stringify(now.edge ?? null) !== JSON.stringify(counterExtras?.[b.id]?.edge ?? null) && !(now.edge?.kind === 'none' && !counterExtras?.[b.id]?.edge)) extras.edge = now.edge;
  (['splashLeft', 'splashRight', 'waterfallLeft', 'waterfallRight'] as const).forEach(k => { if (now[k] !== before[k]) extras[k] = now[k]; });
  if (b.islandId) {
    if (now.bottomLeft !== undefined && Math.round(now.bottomLeft) !== Math.round(before.bottomLeft ?? 0)) extras.waterfallBottomLeft = Math.round(now.bottomLeft);
    if (now.bottomRight !== undefined && Math.round(now.bottomRight) !== Math.round(before.bottomRight ?? 0)) extras.waterfallBottomRight = Math.round(now.bottomRight);
  }
  return extras;
}

/**
 * Isla o península en la escena: medida general sobre el piso (se arrastra con el ratón), etiqueta, botón para eliminarla
 * (con confirmación) y, en planta, las dos cotas editables desde el punto 0.
 */
const Island3D: React.FC<{
  isl: IslandItem;
  toWorld: (X: number, Y: number) => [number, number];
  viewMode: string;
  interactive: boolean;
  controlsRef: React.RefObject<any>;
  onEdit?: (id: string, patch: Partial<IslandItem>) => void;
  onDelete?: (id: string) => void;
  onAbrir?: (id: string) => void;
}> = ({ isl, toWorld, viewMode, interactive, controlsRef, onEdit, onDelete, onAbrir }) => {
  const { camera, size } = useThree();
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ length: '', width: '' });
  const applyMeasure = () => {
    const l = Math.round(parseFloat(draft.length) || 0);
    const w = Math.round(parseFloat(draft.width) || 0);
    if (l >= 300 && w >= 300 && onEdit) onEdit(isl.id, { length: l, width: w });
    setEditing(false);
  };
  const start = useRef<{ dx: number; dy: number; ax: { x: number; y: number }; az: { x: number; y: number } } | null>(null);

  const [x0, z0] = toWorld(isl.dx, isl.dy);
  const [x1, z1] = toWorld(isl.dx + isl.length, isl.dy + isl.width);
  const [ox, oz] = toWorld(0, 0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const y = 0.004;
  const label = isl.kind === 'peninsula' ? 'Península' : 'Isla';

  // El arrastre se mide en pantalla y se pasa a milímetros a lo largo de los ejes X (muro A) y Y (hacia el frente) de la
  // cocina, resolviendo el sistema 2x2 de cómo se ven esos ejes desde la cámara (sirve igual en planta y en perspectiva)
  const startDrag = useDocumentDrag(
    (px, py) => {
      const st = start.current;
      if (!st || !onEdit) return;
      const det = st.ax.x * st.az.y - st.ax.y * st.az.x;
      if (Math.abs(det) < 1) return;
      const mx = ((px * st.az.y - py * st.az.x) / det) * 1000;
      const my = ((st.ax.x * py - st.ax.y * px) / det) * 1000;
      // La península va pegada al muro perpendicular: solo se desliza hacia el frente
      onEdit(isl.id, { dx: isl.kind === 'peninsula' ? isl.dx : Math.max(0, Math.round((st.dx + mx) / 5) * 5), dy: Math.max(0, Math.round((st.dy + my) / 5) * 5) });
    },
    () => {
      start.current = null;
      setDragging(false);
      if (controlsRef.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
    }
  );
  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || !onEdit || isOverlay(e) || !controlsRef.current) return;
    e.stopPropagation();
    const origin = new THREE.Vector3(cx, y, cz);
    const a = screenPixelsPerMeter(camera, size, origin, new THREE.Vector3(1, 0, 0));
    const b = screenPixelsPerMeter(camera, size, origin, new THREE.Vector3(0, 0, 1));
    start.current = { dx: isl.dx, dy: isl.dy, ax: { x: a.sx, y: a.sy }, az: { x: b.sx, y: b.sy } };
    setDragging(true);
    controlsRef.current.enabled = false;
    document.body.style.cursor = 'grabbing';
    startDrag(e.nativeEvent);
  };

  // La huella, la nota, el borde punteado y la × de la isla o península son herramientas de la vista de planta; en las demás
  // vistas solo se ven sus módulos y su zócalo
  if (viewMode !== 'plan') return null;

  return (
    <group>
      <mesh
        position={[cx, y, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleDown}
        onDoubleClick={e => { if (!interactive || !onAbrir || isOverlay(e)) return; e.stopPropagation(); onAbrir(isl.id); }}
        onPointerOver={() => { if (interactive && !dragging) document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!dragging) document.body.style.cursor = 'auto'; }}
      >
        <planeGeometry args={[isl.length / 1000, isl.width / 1000]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={dragging ? 0.28 : 0.12} depthWrite={false} />
      </mesh>
      <Line points={[[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]]} color="#6366f1" lineWidth={2} dashed dashSize={0.06} gapSize={0.04} />
      <Html position={[cx, y, cz]} center zIndexRange={[110, 0]} style={{ pointerEvents: 'none' }}>
        {editing ? (
          <div data-overlay className="pointer-events-auto p-2 w-44 rounded-xl bg-white border border-slate-300 shadow-xl space-y-1.5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}: medida general</div>
            {(['length', 'width'] as const).map(k => (
              <label key={k} className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                {k === 'length' ? 'Largo' : 'Ancho'}
                <input
                  autoFocus={k === 'length'}
                  type="number"
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') applyMeasure(); if (e.key === 'Escape') setEditing(false); }}
                  className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
                />
              </label>
            ))}
            <div className="flex gap-1.5 pt-0.5">
              <button className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black" onClick={applyMeasure}>Aplicar</button>
              <button className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={() => setEditing(false)}>Cerrar</button>
            </div>
          </div>
        ) : (
          <div
            data-overlay
            className={`select-none whitespace-nowrap px-2 py-1 rounded-lg bg-indigo-600/90 text-white text-[10px] leading-none font-black shadow ${interactive && onEdit ? 'pointer-events-auto cursor-text hover:bg-indigo-700' : ''}`}
            title={interactive && onEdit ? 'Clic para editar la medida general' : undefined}
            onClick={() => { if (interactive && onEdit) { setDraft({ length: String(Math.round(isl.length)), width: String(Math.round(isl.width)) }); setEditing(true); } }}
          >
            {label} {Math.round(isl.length)} × {Math.round(isl.width)}
          </div>
        )}
      </Html>

      {/* Eliminar: pide confirmación antes de borrar */}
      {interactive && onDelete && (
        <Html position={[x1, y, z0]} center zIndexRange={[120, 0]} style={{ pointerEvents: 'none' }}>
          <div data-overlay className="pointer-events-auto">
            {confirming ? (
              <div className="p-2 w-40 rounded-xl bg-white border border-slate-300 shadow-xl space-y-1.5 text-center" onMouseDown={(e) => e.stopPropagation()}>
                <div className="text-[11px] font-black text-slate-700">¿Eliminar {label.toLowerCase()}?</div>
                <div className="flex gap-1.5">
                  <button className="flex-1 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-black" onClick={() => { setConfirming(false); onDelete(isl.id); }}>Eliminar</button>
                  <button className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={() => setConfirming(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white border-2 border-white shadow-lg flex items-center justify-center text-[14px] leading-none font-black" title={`Eliminar ${label.toLowerCase()}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => setConfirming(true)}>×</button>
            )}
          </div>
        </Html>
      )}

      {viewMode === 'plan' && (
        <>
          {/* Cota X: del punto 0 a la esquina de la isla, a lo largo del muro A (la península está pegada al muro: sin cota X) */}
          {isl.kind !== 'peninsula' && <Line points={[[ox, y, z0], [x0, y, z0]]} color="#111827" lineWidth={2} />}
          {isl.kind !== 'peninsula' && <Html position={[(ox + x0) / 2, y, z0]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <div data-overlay><DimLabel text={String(Math.round(isl.dx))} value={isl.dx} onCommit={onEdit ? (typed) => onEdit(isl.id, { dx: Math.max(0, Math.round(typed)) }) : undefined} title={`${Math.round(isl.dx)} mm desde el punto 0. Clic para editar`} /></div>
          </Html>}
          {/* Cota Y: del muro A a la esquina de la isla, hacia el frente */}
          <Line points={[[x0, y, oz], [x0, y, z0]]} color="#111827" lineWidth={2} />
          <Html position={[x0, y, (oz + z0) / 2]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <div data-overlay><DimLabel text={String(Math.round(isl.dy))} value={isl.dy} onCommit={onEdit ? (typed) => onEdit(isl.id, { dy: Math.max(0, Math.round(typed)) }) : undefined} title={`${Math.round(isl.dy)} mm desde el punto 0. Clic para editar`} /></div>
          </Html>
          {/* Cotas completas: del punto 0 al borde lejano de la isla, por fuera de ella (de dónde a dónde va). Escribir el total mueve la isla */}
          {(() => {
            const gap = 0.16;
            const yTotX = x1 + gap, xTotZ = z1 + gap;
            const totalY = isl.dy + isl.width, totalX = isl.dx + isl.length;
            const tick = 0.05;
            return (
              <>
                <Line points={[[yTotX, y, oz], [yTotX, y, z1]]} color="#111827" lineWidth={2} />
                <Line points={[[yTotX - tick * 0.6, y, oz - tick * 0.6], [yTotX + tick * 0.6, y, oz + tick * 0.6]]} color="#111827" lineWidth={1.5} />
                <Line points={[[yTotX - tick * 0.6, y, z1 - tick * 0.6], [yTotX + tick * 0.6, y, z1 + tick * 0.6]]} color="#111827" lineWidth={1.5} />
                <Line points={[[x1, y, z1], [yTotX + tick, y, z1]]} color="#111827" lineWidth={1} dashed dashSize={0.03} gapSize={0.03} />
                <Html position={[yTotX, y, (oz + z1) / 2]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                  <div data-overlay><DimLabel text={String(Math.round(totalY))} value={totalY} tone="white" onCommit={onEdit ? (typed) => onEdit(isl.id, { dy: Math.max(0, Math.round(typed) - isl.width) }) : undefined} title={`${Math.round(totalY)} mm: del punto 0 al borde lejano. Clic para editar`} /></div>
                </Html>
                {isl.kind !== 'peninsula' && (
                  <>
                    <Line points={[[ox, y, xTotZ], [x1, y, xTotZ]]} color="#111827" lineWidth={2} />
                    <Line points={[[ox - tick * 0.6, y, xTotZ - tick * 0.6], [ox + tick * 0.6, y, xTotZ + tick * 0.6]]} color="#111827" lineWidth={1.5} />
                    <Line points={[[x1 - tick * 0.6, y, xTotZ - tick * 0.6], [x1 + tick * 0.6, y, xTotZ + tick * 0.6]]} color="#111827" lineWidth={1.5} />
                    <Line points={[[x1, y, z1], [x1, y, xTotZ + tick]]} color="#111827" lineWidth={1} dashed dashSize={0.03} gapSize={0.03} />
                    <Html position={[(ox + x1) / 2, y, xTotZ]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                      <div data-overlay><DimLabel text={String(Math.round(totalX))} value={totalX} tone="white" onCommit={onEdit ? (typed) => onEdit(isl.id, { dx: Math.max(0, Math.round(typed) - isl.length) }) : undefined} title={`${Math.round(totalX)} mm: del punto 0 al borde lejano. Clic para editar`} /></div>
                    </Html>
                  </>
                )}
              </>
            );
          })()}
        </>
      )}
    </group>
  );
};

/** Datos y acciones del closet que el visor necesita para abrir el formulario de cada sección con doble clic */
export interface ClosetFormApi {
  config: ClosetConfig;
  derived: ReturnType<typeof closetDerived>;
  hasZocalo: boolean;
  zocaloHeight: number;
  leftWall: boolean;
  rightWall: boolean;
  layout: 'STRAIGHT' | 'L_SHAPE' | 'U_SHAPE';
  lArm: 'left' | 'right';
  onLayout: (l: 'STRAIGHT' | 'L_SHAPE' | 'U_SHAPE') => void;
  onLArm: (side: 'left' | 'right') => void;
  onChange: (patch: Partial<ClosetConfig>) => void;
  onZocalo: (patch: { hasZocalo?: boolean; zocaloHeight?: number }) => void;
  // dos cajoneros: el segundo tiene sus propias medidas y su propio formulario
  doorsGhost?: boolean;                 // puertas translúcidas
  onDoorsGhost?: (on: boolean) => void;
  torreIdx?: 1 | 2;
  onRemove?: () => void; // quitar esta torre (la segunda)
  onRoot?: (patch: Partial<ClosetConfig>) => void; // cambios de la configuración general (cantidad y ubicación de los cajoneros) aunque el formulario sea del segundo
  torre2Config?: ClosetConfig;
  torre2Derived?: ReturnType<typeof closetDerived>;
  onTorre2?: (patch: Partial<ClosetConfig>) => void;
  onRemoveTorre2?: () => void;
  config2?: ClosetConfig;
  derived2?: ReturnType<typeof closetDerived>;
  onChange2?: (patch: Partial<ClosetConfig>) => void;
}

/** Campo numérico del formulario del closet: se escribe libremente y se aplica con Enter o al salir del campo */
const ClosetNumber: React.FC<{ label: string; value: number; hint?: number; onCommit: (n: number) => void }> = ({ label, value, hint, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (apply: boolean) => { const n = draft === null ? NaN : parseFloat(draft); setDraft(null); if (apply && !isNaN(n)) onCommit(n); };
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
      <span>{label}</span>
      <input
        type="number"
        value={draft ?? Math.round(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
        onBlur={() => finish(true)}
        className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );
};

const ClosetToggle: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600">
    {label}
    <span className={`w-9 h-5 rounded-full relative transition-all ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  </button>
);

const isFitBody = (n: string) => n.startsWith('Cuerpo ') || n.startsWith('Hueco ') || n === 'Cubo closet fit';
const isClosetDoor = (n: string) => n.startsWith('Puerta corrediza') || n.startsWith('Puerta abatible') || n === 'Puerta rep fit' || n === 'Puerta fit' || n === 'Frente rep fit' || n === 'Frente cajón fit';



/** Campo numérico que deja borrar y escribir libremente; aplica (con sus límites) al salir del campo o con Enter */
const DraftNum: React.FC<{ value: number; onCommit: (n: number) => void; min?: number; max?: number; className?: string }> = ({ value, onCommit, min = 0, max = 100000, className }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (apply: boolean) => {
    const n = draft === null ? NaN : Number(draft);
    setDraft(null);
    if (apply && draft !== null && draft.trim() !== '' && Number.isFinite(n)) onCommit(Math.max(min, Math.min(max, Math.round(n))));
  };
  return (
    <input type="number" min={min} max={max} className={className} value={draft ?? value} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') finish(false); }} />
  );
};


/** Líneas de abertura de una puerta (norma de dibujo de arquitectura): dos líneas segmentadas y suaves con el vértice en el borde libre; `face` = en qué cara de la pieza se dibujan */
const SwingLines: React.FC<{ hw: number; hh: number; op: 'izq' | 'der' | 'sup' | 'inf'; face: 'z+' | 'z-' | 'x+' | 'x-'; depth: number }> = ({ hw, hh, op, face, depth }) => {
  const uv: [number, number][] = op === 'izq' ? [[-hw, hh], [hw, 0], [-hw, -hh]] : op === 'der' ? [[hw, hh], [-hw, 0], [hw, -hh]] : op === 'sup' ? [[-hw, hh], [0, -hh], [hw, hh]] : [[-hw, -hh], [0, hh], [hw, -hh]];
  const f = depth + 0.002;
  const pts = uv.map(([u, v]) => (face === 'z+' ? [u, v, f] : face === 'z-' ? [-u, v, -f] : face === 'x+' ? [f, v, u] : [-f, v, u]) as [number, number, number]);
  // polygonOffset: el frente lleva el suyo y, visto en ángulo (isométrica), se adelanta y tapaba las líneas; estas se adelantan más
  return <Line points={pts} color="#475569" lineWidth={1.2} dashed dashSize={0.035} gapSize={0.025} transparent opacity={0.75} polygonOffset polygonOffsetFactor={-8} polygonOffsetUnits={-8} raycast={() => null} />;
};

/** Contorno oscuro de un frente (puerta o cajón) en su cara visible: marca las luces entre puertas y frentes, que con las aristas finas no se notaban */
const FrontOutline: React.FC<{ hw: number; hh: number; face: 'z+' | 'z-' | 'x+' | 'x-'; depth: number; color: string }> = ({ hw, hh, face, depth, color }) => {
  const f = depth + 0.001, i = 0.0015; // un poco hacia adentro del borde, para que dos frentes vecinos dejen ver la luz entre ellos
  const uv: [number, number][] = [[-hw + i, -hh + i], [hw - i, -hh + i], [hw - i, hh - i], [-hw + i, hh - i], [-hw + i, -hh + i]];
  const pts = uv.map(([u, v]) => (face === 'z+' ? [u, v, f] : face === 'z-' ? [-u, v, -f] : face === 'x+' ? [f, v, u] : [-f, v, u]) as [number, number, number]);
  return <Line points={pts} color={color} lineWidth={1.5} polygonOffset polygonOffsetFactor={-8} polygonOffsetUnits={-8} raycast={() => null} />;
};

/** Formulario de un cuerpo del Closet fit (doble clic): ¿marco puerta o surrón? y sus puertas, entrepaños y cajones */
const FitBodyForm: React.FC<{ label: string; cfg: FitBodyCfg | undefined; onChange: (c: FitBodyCfg | undefined) => void; onClose: () => void; hiddenCount?: number; onShowAll?: () => void; suggestedMaletero?: number; fondo?: number; onFondo?: (n: number) => void; desde?: number; onDesde?: (n: number) => void }> = ({ label, cfg, onChange, onClose, hiddenCount = 0, onShowAll, suggestedMaletero = 1900, fondo, onFondo, desde, onDesde }) => {
  const drag = useDragOffset();
  const set = (patch: Partial<FitBodyCfg>) => onChange({ ...(cfg ?? { kind: 'surron' }), ...patch } as FitBodyCfg);
  const btn = (on: boolean) => `flex-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase ${on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`;
  const num = (v: number | undefined, onV: (n: number) => void, min = 0, max = 12) => (
    <DraftNum value={v ?? 0} min={min} max={max} onCommit={onV} className="w-14 text-center rounded border border-slate-300 text-xs font-black py-0.5" />
  );
  const row = (t: string, children: React.ReactNode) => (<div className="space-y-1"><div className="text-[10px] font-black uppercase text-slate-500">{t}</div><div className="flex flex-wrap gap-1 items-center">{children}</div></div>);
  // cápsula para activar o desactivar una opción; al activarla se despliegan sus campos
  const cap = (title: string, on: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
      <span>{title}</span>
      <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
    </button>
  );
  const isSurron = cfg?.kind === 'surron';
  const drawers = cfg?.drawers ?? 0, doors = cfg?.doors ?? 0;
  return createPortal(
    <div data-overlay data-module-editor {...drag.handle} className="fixed right-4 top-[250px] z-[200] pointer-events-auto w-64 p-3 space-y-2 rounded-xl bg-white border border-slate-300 shadow-xl max-h-[70vh] overflow-y-auto" style={{ ...drag.handle.style, ...drag.style }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-slate-500 select-none"><span>⠿ {label}</span><button className="text-slate-400 hover:text-slate-700" onClick={onClose}>✕</button></div>
      {hiddenCount > 0 && <button className="w-full px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-black uppercase hover:bg-amber-100" onClick={onShowAll}>Mostrar piezas ocultas ({hiddenCount})</button>}
      {desde !== undefined && onDesde && row('Altura desde el piso (mm)', <DraftNum value={Math.round(desde)} min={0} max={3000} onCommit={onDesde} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" />)}
      {fondo !== undefined && onFondo && row('Fondo de este cubo (mm)', <DraftNum value={Math.round(fondo)} min={100} max={900} onCommit={onFondo} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" />)}
      {row('¿Qué es?', <><button className={btn(cfg?.kind === 'marco')} onClick={() => set({ kind: 'marco', doors: cfg?.doors || 2, doorDir: cfg?.doorDir ?? 'vertical' })}>Marco puerta</button><button className={btn(isSurron)} onClick={() => set({ kind: 'surron', top: cfg?.top ?? 'puente', base: cfg?.base ?? 'base', doors: cfg?.doors ?? 2, doorDir: cfg?.doorDir ?? 'vertical' })}>Surrón</button><button className={btn(cfg?.kind === 'alistonado')} onClick={() => set({ kind: 'alistonado', liston: cfg?.liston ?? { ancho: 65, esp: 15, sep: 35 } })}>Alistonado</button></>)}
      {cfg && cfg.kind === 'alistonado' && (() => {
        // espaldar alistonado: listones verticales; la cantidad sale de la separación y se reparten parejos de borde a borde
        const L = cfg.liston ?? { ancho: 65, esp: 15, sep: 35 };
        const setL = (p: Partial<typeof L>) => set({ liston: { ...L, ...p } });
        return <>
          {row('Ancho del listón (mm)', <DraftNum value={L.ancho} min={10} max={300} onCommit={(n) => setL({ ancho: Math.round(n) })} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" />)}
          {row('Espesor del listón (mm)', <DraftNum value={L.esp} min={3} max={60} onCommit={(n) => setL({ esp: Math.round(n) })} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" />)}
          {row('Separación entre listones (mm)', <DraftNum value={L.sep} min={0} max={500} onCommit={(n) => setL({ sep: Math.round(n) })} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" />)}
          {row('Fondo', <>{([[0, 'Sin fondo'], [6, 'De 6'], [15, 'De 15']] as const).map(([fv, fl]) => <button key={fv} className={btn((L.fondo ?? 0) === fv)} onClick={() => setL({ fondo: fv })}>{fl}</button>)}</>)}
        </>;
      })()}
      {cfg && cfg.kind !== 'alistonado' && (
        <>
          {([['izq', 'Lado izquierdo', cfg.ladoIzq], ['der', 'Lado derecho', cfg.ladoDer]] as Array<['izq' | 'der', string, FitBodyCfg['ladoIzq']]>).map(([side, title, cur]) => <React.Fragment key={side}>{row(`${title}: dilatada o visto`, <>{([['ninguno', 'Nada'], ['dilatada', 'Dilatada'], ['visto15', 'Visto 15'], ['visto19', 'Visto 19']] as Array<[NonNullable<FitBodyCfg['ladoIzq']>, string]>).map(([val, lab]) => (<button key={val} className={btn((cur ?? 'ninguno') === val)} onClick={() => set(side === 'izq' ? { ladoIzq: val } : { ladoDer: val })}>{lab}</button>))}</>)}</React.Fragment>)}
          {row('Zócalo (80 mm) si va al piso', <><button className={btn(!!cfg.zocalo)} onClick={() => set({ zocalo: true })}>Con zócalo</button><button className={btn(!cfg.zocalo)} onClick={() => set({ zocalo: false })}>Sin zócalo</button></>)}
          {isSurron && drawers === 0 && row('Abajo', <><button className={btn((cfg.base ?? 'base') === 'base')} onClick={() => set({ base: 'base' })}>Base completa</button><button className={btn(cfg.base === 'puentes')} onClick={() => set({ base: 'puentes' })}>Puentes</button></>)}
          {isSurron && drawers > 0 && <div className="text-[10px] text-slate-500">Con cajones solo lleva puentes inferiores.</div>}
          {isSurron && row('Arriba', <><button className={btn(cfg.top === 'puenteL')} onClick={() => set({ top: 'puenteL' })}>Puente en L</button><button className={btn((cfg.top ?? 'puente') === 'puente')} onClick={() => set({ top: 'puente' })}>Puente</button><button className={btn(cfg.top === 'tapa')} onClick={() => set({ top: 'tapa' })}>Tapa</button></>)}
          {isSurron && row('El surrón lleva', <><button className={btn(drawers === 0)} onClick={() => set({ doors: cfg.doors || 2, drawers: 0 })}>Puertas</button><button className={btn(drawers > 0)} onClick={() => set({ drawers: cfg.drawers || 3, doors: 0, base: 'puentes' })}>Cajones</button></>)}
          {cfg.kind === 'marco' && row('Tipo de puertas', <><button className={btn(cfg.doorType !== 'corredizas')} onClick={() => set({ doorType: 'parche', doors: Math.min(2, cfg.doors || 2) })}>De parche</button><button className={btn(cfg.doorType === 'corredizas')} onClick={() => set({ doorType: 'corredizas', doors: Math.max(2, cfg.doors || 2) })}>Corredizas</button></>)}
          {(cfg.kind === 'marco' || drawers === 0) && row('Cantidad de puertas', <>{num(cfg.doors, (n) => set({ doors: cfg.doorType === 'corredizas' ? Math.max(2, n) : n }), cfg.doorType === 'corredizas' ? 2 : 0, cfg.kind === 'marco' ? (cfg.doorType === 'corredizas' ? 6 : 2) : 8)}</>)}
          {doors > 0 && cfg.doorType !== 'corredizas' && row('Puertas', <><button className={btn((cfg.doorDir ?? 'vertical') === 'vertical')} onClick={() => set({ doorDir: 'vertical' })}>Vertical (izq/der)</button><button className={btn(cfg.doorDir === 'horizontal')} onClick={() => set({ doorDir: 'horizontal' })}>{doors > 2 ? 'Horizontal (abertura horizontal)' : 'Horizontal (una sobre otra)'}</button></>)}
          {doors === 1 && cfg.doorDir !== 'horizontal' && row('Bisagra de la puerta', <><button className={btn((cfg.hinge ?? 'izq') === 'izq')} onClick={() => set({ hinge: 'izq' })}>Izquierda</button><button className={btn(cfg.hinge === 'der')} onClick={() => set({ hinge: 'der' })}>Derecha</button></>)}
          {isSurron && doors >= 2 && (cfg.doorDir !== 'horizontal' || doors > 2) && row('¿Pieza vertical en medio de las puertas?', <><button className={btn(!cfg.vertMedio)} onClick={() => set({ vertMedio: false })}>Sin pieza</button><button className={btn(!!cfg.vertMedio)} onClick={() => set({ vertMedio: true })}>Con pieza vertical</button></>)}
          {isSurron && doors >= 2 && (cfg.vertMedio || (doors >= 3 && cfg.doorDir !== 'horizontal')) && (cfg.doorDir !== 'horizontal' || doors > 2) && row('Pieza vertical entre puertas', <><button className={btn((cfg.divider ?? 'puentes') === 'puentes')} onClick={() => set({ divider: 'puentes' })}>Puente vertical</button><button className={btn(cfg.divider === 'costado')} onClick={() => set({ divider: 'costado' })}>Costado completo</button></>)}
          {isSurron && drawers > 0 && row('Cantidad de cajones', <>{num(cfg.drawers, (n) => set({ drawers: Math.max(1, n), base: 'puentes' }), 1, 8)}</>)}
          {isSurron && drawers > 0 && row('Frentes de cajón', <><button className={btn((cfg.drawerKind ?? 'manija') === 'manija')} onClick={() => set({ drawerKind: 'manija' })}>Manija</button><button className={btn(cfg.drawerKind === 'puenteL')} onClick={() => set({ drawerKind: 'puenteL' })}>Adicionar puentes en L</button></>)}
          {(cfg.kind === 'marco' || (isSurron && drawers === 0)) && (
            <>
              {cap('Entrepaños', (cfg.shelves ?? 0) > 0, () => set({ shelves: (cfg.shelves ?? 0) > 0 ? 0 : 2 }))}
              {(cfg.shelves ?? 0) > 0 && row('Cantidad (fondo − 70)', <>{num(cfg.shelves, (n) => set({ shelves: Math.max(1, n) }), 1, 12)}</>)}
            </>
          )}
          {cfg.kind === 'marco' && (
            <>
              {cap('Maletero', !!cfg.maletero, () => set(cfg.maletero ? { maletero: undefined, tubes: cfg.tubes === 'camisero' ? undefined : cfg.tubes === 'ambos' ? 'pantalonero' : cfg.tubes } : { maletero: suggestedMaletero }))}
              {!!cfg.maletero && row('Medida desde la parte superior hacia abajo (mm)', <><DraftNum value={cfg.maletero ?? 0} min={50} max={5000} onCommit={(n) => set({ maletero: n })} className="w-20 text-center rounded border border-slate-300 text-xs font-black py-0.5" /></>)}
              {cap('Tubos para colgar', !!cfg.tubes, () => set(cfg.tubes ? { tubes: undefined } : { tubes: 'pantalonero' }))}
              {!!cfg.tubes && row('Tipo de tubo (puedes elegir los dos)', (() => {
                const hasC = cfg.tubes === 'camisero' || cfg.tubes === 'ambos', hasP = cfg.tubes === 'pantalonero' || cfg.tubes === 'ambos';
                const flip = (kind: 'c' | 'p') => {
                  const c2 = kind === 'c' ? !hasC : hasC, p2 = kind === 'p' ? !hasP : hasP;
                  if (!c2 && !p2) return; // al menos uno; para quitarlos se apaga la cápsula
                  set({ tubes: c2 && p2 ? 'ambos' : c2 ? 'camisero' : 'pantalonero', ...(c2 ? { maletero: cfg.maletero || suggestedMaletero } : {}) });
                };
                return <><button className={btn(hasC)} onClick={() => flip('c')}>Camisero</button><button className={btn(hasP)} onClick={() => flip('p')}>Pantalonero</button></>;
              })())}
              <div className="text-[10px] text-slate-500">Entrepaños, maletero y tubos van de muro a módulo, de módulo a muro o de muro a muro.</div>
            </>
          )}
          <button className="w-full mt-1 px-2 py-1 rounded-lg border border-red-200 text-red-600 text-[10px] font-black uppercase hover:bg-red-50" onClick={() => { onChange(undefined); onClose(); }}>Quitar configuración</button>
        </>
      )}
      <button className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase" onClick={onClose} title="Los cambios ya están aplicados; cierra el formulario">Aplicar</button>
    </div>,
    document.body
  );
};

const CLOSET_SECTION_TITLES: Record<string, string> = { torre: 'Torre de entrepaños', puertas: 'Puertas closet', muro: 'Muros del closet', taparriel: 'Tapa de riel', costado: 'Costado piso a techo', zocalo: 'Zócalo', base: 'Base (marco inferior)', cajonero: 'Cajonero', entrepanos: 'Entrepaños', maletero: 'Maletero' };

/** Arrastre de un formulario flotante: se agarra por su título y se mueve libremente (desplazamiento en píxeles) */
function useDragOffset() {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const start = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input,button,select,textarea,label,a,[data-nodrag]')) return; // los campos y botones siguen funcionando
    (e.currentTarget as HTMLElement).style.zIndex = String(++(window as any).__floatZ || ((window as any).__floatZ = 60)); // la tarjeta que se toca pasa al frente
    e.stopPropagation();
    const x0 = e.clientX - off.x, y0 = e.clientY - off.y;
    const move = (ev: PointerEvent) => setOff({ x: ev.clientX - x0, y: ev.clientY - y0 });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return { style: { transform: `translate(${off.x}px, ${off.y}px)` } as React.CSSProperties, handle: { onPointerDown: start, style: { cursor: 'move', touchAction: 'none' } as React.CSSProperties } };
}

/** Formulario de una sección del closet (doble clic sobre sus piezas): zócalo, base, cajonero, entrepaños o maletero */
const ClosetSectionForm: React.FC<{ section: string; api: ClosetFormApi; onClose: () => void }> = ({ section, api, onClose }) => {
  const { config: c, derived: d, onChange } = api;
  const drag = useDragOffset();
  return (
    <div data-overlay data-module-editor {...drag.handle} className="pointer-events-auto w-60 p-3 space-y-2 rounded-xl bg-white border border-slate-300 shadow-xl" style={{ ...drag.handle.style, ...drag.style }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 flex items-center justify-between select-none" title="Arrastra para mover el formulario">{CLOSET_SECTION_TITLES[section]}<span className="text-slate-300">⠿</span></div>
      {section === 'torre' && (
        <>
          <div className="grid grid-cols-3 gap-1">
            {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as const).map(([val, label]) => (
              <button key={val} onClick={() => onChange({ torrePos: val })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${(c.torrePos ?? 'left') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          <ClosetToggle label="Hasta el techo" on={c.torreToCeiling === true} onClick={() => onChange({ torreToCeiling: c.torreToCeiling !== true, torreShelves: undefined })} />
          {(() => { const side = api.torreIdx === 2 ? ((c.torrePos ?? 'left') === 'left' ? 'right' : 'left') : (c.torrePos ?? 'left'); const hasCostado = (side === 'left' && !api.leftWall) || (side === 'right' && !api.rightWall); return hasCostado ? <ClosetToggle label="Sin lateral junto al costado" on={c.torreSinLateral === true} onClick={() => onChange({ torreSinLateral: c.torreSinLateral !== true })} /> : null; })()}
          <ClosetNumber label="Ancho (mm)" value={d.torreWidth} hint={d.suggestedCajonero} onCommit={(n) => onChange({ torreWidth: Math.max(300, Math.min(1200, Math.round(n))) })} />
          <ClosetToggle label="Con nariz" on={c.narizEntrepanos === true} onClick={() => onChange({ narizEntrepanos: c.narizEntrepanos !== true })} />
          {c.narizEntrepanos === true && <ClosetNumber label="Alto de la nariz (mm)" value={c.narizAlto ?? 40} hint={40} onCommit={(n) => onChange({ narizAlto: Math.max(15, Math.min(100, Math.round(n))) })} />}
          <ClosetNumber label="Entrepaños por columna" value={d.torreShelves} hint={d.suggestedTorreShelves} onCommit={(n) => onChange({ torreShelves: Math.max(0, Math.min(20, Math.round(n))) })} />
          <ClosetNumber label="Divisiones" value={d.torreDivisions} hint={0} onCommit={(n) => onChange({ torreDivisions: Math.max(0, Math.min(5, Math.round(n))) })} />
          <ClosetNumber label="Fondo (mm)" value={c.torreDepth ?? 450} hint={450} onCommit={(n) => onChange({ torreDepth: Math.max(300, Math.min(500, Math.round(n))) })} />
          <button className="w-full py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-black" onClick={() => { if (api.onRemove) api.onRemove(); else onChange({ torreOn: false }); onClose(); }}>Quitar la torre</button>
          <p className="text-[9px] font-bold text-slate-400">Las divisiones tienen la altura de los laterales y la profundidad de los entrepaños (20 mm menos que los laterales).</p>
        </>
      )}
      {section === 'puertas' && (
        <>
          <div className="grid grid-cols-2 gap-1">
            {([['corredizas', 'Corredizas'], ['abatibles', 'Abatibles de parche']] as const).map(([val, label]) => (
              <button key={val} onClick={() => (api.onRoot ?? onChange)({ doorType: val, doorCount: undefined, doorHeight: undefined })} className={`py-1 rounded-lg text-[10px] font-black border-2 leading-tight ${(c.doorType ?? 'corredizas') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          <ClosetNumber label="Cantidad de puertas" value={d.doorCount} hint={d.suggestedDoors} onCommit={(n) => (api.onRoot ?? onChange)({ doorCount: Math.max(2, Math.min(6, Math.round(n))) })} />
          <ClosetNumber label="Alto de las puertas (mm)" value={d.doorHeight} hint={d.suggestedDoorHeight} onCommit={(n) => onChange({ doorHeight: Math.max(500, Math.round(n)) })} />
          {c.doorType === 'abatibles' && (
            <>
              {(() => {
                const N = d.doorCount;
                const edges = c.doorEdges ?? [];
                const setEdge = (k: number, patch: { hinge?: 'izq' | 'der'; type?: 'costado' | 'marco' }) => {
                  const arr = Array.from({ length: N }, (_, j) => ({ ...(edges[j] ?? {}) }));
                  arr[k] = { ...arr[k], ...patch };
                  onChange({ doorEdges: arr });
                };
                const btn = (on: boolean, label: string, onClick: () => void) => <button key={label} onClick={onClick} className={`py-1 rounded-lg text-[10px] font-black border-2 ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>;
                return Array.from({ length: N }, (_, k) => {
                  const hinge = edges[k]?.hinge ?? (k < N / 2 ? 'izq' : 'der');
                  const type = edges[k]?.type ?? 'costado';
                  const extremo = (hinge === 'izq' && k === 0) || (hinge === 'der' && k === N - 1);
                  const extName = hinge === 'izq' ? (api.leftWall ? 'marco' : 'costado') : (api.rightWall ? 'marco' : 'costado');
                  return (
                    <div key={k} className="rounded-lg border border-slate-200 p-1.5 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-slate-700">Puerta {k + 1}</span>
                        <div className="grid grid-cols-2 gap-1 w-36">
                          {btn(hinge === 'izq', 'Izquierda', () => setEdge(k, { hinge: 'izq' }))}
                          {btn(hinge === 'der', 'Derecha', () => setEdge(k, { hinge: 'der' }))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-bold text-slate-500">{hinge === 'izq' ? 'Inicio' : 'Cierre'} (bisagra)</span>
                        {extremo ? <span className="text-[10px] font-black text-indigo-600">{extName} (del Espacio)</span> : (
                          <div className="grid grid-cols-2 gap-1 w-36">
                            {btn(type === 'costado', 'Costado', () => setEdge(k, { type: 'costado' }))}
                            {btn(type === 'marco', 'Marco', () => setEdge(k, { type: 'marco' }))}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">{hinge === 'izq' ? 'Cierre' : 'Inicio'}: libre</div>
                    </div>
                  );
                });
              })()}
              <p className="text-[9px] font-bold text-slate-400">La bisagra define el lado con costado o marco propio; el otro lado queda libre. Una puerta izquierda y una derecha juntas dejan el centro libre.</p>
              <ClosetNumber label="Luz entre puertas (mm)" value={c.doorGap ?? 2} hint={2} onCommit={(n) => onChange({ doorGap: Math.max(0, Math.min(10, Math.round(n))) })} />
              <ClosetNumber label="Cubre del costado/marco (mm)" value={c.doorCover ?? 13} hint={13} onCommit={(n) => onChange({ doorCover: Math.max(0, Math.min(40, Math.round(n))) })} />
            </>
          )}
          <ClosetToggle label="Translúcidas" on={api.doorsGhost === true} onClick={() => api.onDoorsGhost?.(api.doorsGhost !== true)} />
          <p className="text-[9px] font-bold text-slate-400">Translúcidas para ver el interior sin ocultar las puertas.</p>
        </>
      )}
      {section === 'muro' && (
        <>
          <div className="grid grid-cols-3 gap-1">
            {([['STRAIGHT', 'Recto'], ['L_SHAPE', 'En L'], ['U_SHAPE', 'En U']] as const).map(([val, label]) => (
              <button key={val} onClick={() => api.onLayout(val)} className={`py-1 rounded-lg text-[10px] font-black border-2 ${api.layout === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          {api.layout === 'L_SHAPE' && (
            <div className="grid grid-cols-2 gap-1">
              {([['left', 'Brazo izquierdo'], ['right', 'Brazo derecho']] as const).map(([val, label]) => (
                <button key={val} onClick={() => api.onLArm(val)} className={`py-1 rounded-lg text-[10px] font-black border-2 ${api.lArm === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
              ))}
            </div>
          )}
          <p className="text-[9px] font-bold text-slate-400">El lado con muro lleva marco lateral y dilatada; el lado sin muro lleva costado.</p>
        </>
      )}
      {section === 'taparriel' && (
        <>
          <ClosetToggle label="Lleva tapa de riel" on={c.tapaRiel !== false} onClick={() => onChange({ tapaRiel: c.tapaRiel === false })} />
          <ClosetNumber label="Altura (mm)" value={c.tapaRielHeight ?? 110} hint={110} onCommit={(n) => onChange({ tapaRielHeight: Math.max(20, Math.min(400, Math.round(n))) })} />
          <p className="text-[9px] font-bold text-slate-400">Va parada, adelante del marco. Si no la quieres, apágala (se vuelve a activar en el formulario del closet del Espacio).</p>
        </>
      )}
      {section === 'costado' && (
        <>
          <ClosetNumber label="Profundidad (mm)" value={c.costadoDepth ?? 550} hint={550} onCommit={(n) => onChange({ costadoDepth: Math.max(200, Math.min(900, Math.round(n))) })} />
          <p className="text-[9px] font-bold text-slate-400">La base toma la misma profundidad del costado.</p>
        </>
      )}
      {section === 'zocalo' && (
        <>
          <ClosetToggle label="Lleva zócalo" on={api.hasZocalo} onClick={() => api.onZocalo({ hasZocalo: !api.hasZocalo })} />
          {api.hasZocalo && <ClosetNumber label="Altura del zócalo" value={api.zocaloHeight} hint={80} onCommit={(n) => api.onZocalo({ zocaloHeight: Math.max(30, Math.min(200, Math.round(n))) })} />}
          <ClosetToggle label="Marco inferior / base" on={c.bottomFrame} onClick={() => onChange({ bottomFrame: !c.bottomFrame })} />
          <p className="text-[9px] font-bold text-slate-400">La base va encima del zócalo. Sin marco inferior queda el tipo T.</p>
        </>
      )}
      {section === 'base' && (
        <>
          <ClosetToggle label="Marco inferior (base acostada)" on={c.bottomFrame} onClick={() => onChange({ bottomFrame: !c.bottomFrame })} />
          <ClosetToggle label="Lleva zócalo" on={api.hasZocalo} onClick={() => api.onZocalo({ hasZocalo: !api.hasZocalo })} />
          {api.hasZocalo && <ClosetNumber label="Altura del zócalo" value={api.zocaloHeight} hint={80} onCommit={(n) => api.onZocalo({ zocaloHeight: Math.max(30, Math.min(200, Math.round(n))) })} />}
          <p className="text-[9px] font-bold text-slate-400">Va sobre el piso o sobre el zócalo. Con zócalo y sin marco queda el tipo T.</p>
        </>
      )}
      {section === 'cajonero' && (
        <>
          <div className="grid grid-cols-2 gap-1">
            {([[false, '1 cajonero'], [true, '2 cajoneros']] as const).map(([val, label]) => (
              <button key={label} onClick={() => (api.onRoot ?? onChange)({ twoCajoneros: val, doorCount: undefined })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${(c.twoCajoneros === true) === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          {c.twoCajoneros === true && c.torreOn === true ? null : c.twoCajoneros === true ? (
            <div className="grid grid-cols-2 gap-1">
              {([['centro', 'Al centro'], ['extremos', 'A los extremos']] as const).map(([val, label]) => (
                <button key={val} onClick={() => (api.onRoot ?? onChange)({ twoPlacement: val, doorCount: undefined })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${(c.twoPlacement ?? 'centro') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1">
                {([['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => onChange({ cajoneroPos: val, cajoneroX: undefined })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${c.cajoneroX == null && c.cajoneroPos === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                ))}
                <button onClick={() => onChange({ cajoneroX: Math.max(0, Math.round((d.opening - d.cajoneroWidth) / 2)) })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${c.cajoneroX != null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Libre</button>
              </div>
              {c.cajoneroX != null && <ClosetNumber label="Distancia desde la izquierda (mm)" value={c.cajoneroX} hint={Math.round((d.opening - d.cajoneroWidth) / 2)} onCommit={(n) => onChange({ cajoneroX: Math.max(0, Math.round(n)) })} />}
            </>
          )}
          <div className="grid grid-cols-2 gap-1">
            {([['parche', 'De parche'], ['embebido', 'Embebido']] as const).map(([val, label]) => (
              <button key={val} onClick={() => onChange({ cajonFront: val })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${(c.cajonFront ?? 'parche') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          {c.cajonFront === 'embebido' && ((c.cajoneroPos === 'left' && !api.leftWall) || (c.cajoneroPos === 'right' && !api.rightWall)) && (
            <ClosetToggle label="Sin lateral (correderas al costado)" on={c.sinLateral === true} onClick={() => onChange({ sinLateral: c.sinLateral !== true })} />
          )}
          <>
              <ClosetToggle label="Laterales hasta el maletero" on={c.lateralesAlMaletero === true} onClick={() => onChange({ lateralesAlMaletero: c.lateralesAlMaletero !== true, shelvesOn: true })} />
              {c.lateralesAlMaletero === true && <ClosetNumber label="Entrepaños" value={d.shelfCount} hint={d.suggestedShelves} onCommit={(n) => onChange({ shelfCount: Math.max(0, Math.min(12, Math.round(n))) })} />}
          </>
          <p className="text-[9px] font-bold text-slate-400">Parche: el frente va adelante del lateral. Embebido: va dentro (ancho interno − 6 mm) y el lateral se alarga 15 mm.</p>
          <ClosetNumber label="Cajones" value={d.drawerCount} hint={d.suggestedDrawers} onCommit={(n) => onChange({ cajonCount: Math.max(1, Math.min(8, Math.round(n))) })} />
          <ClosetNumber label="Altura (mm del piso)" value={d.cajoneroTop} hint={d.suggestedCajoneroTop} onCommit={(n) => onChange({ cajoneroTop: Math.max(300, Math.min(1800, Math.round(n))) })} />
          <ClosetNumber label="Ancho" value={d.cajoneroWidth} hint={d.suggestedCajonero} onCommit={(n) => onChange({ cajoneroWidth: Math.max(300, Math.round(n)) })} />
        </>
      )}
      {section === 'entrepanos' && (
        <>
          <ClosetToggle label="Lleva entrepaños" on={c.shelvesOn !== false} onClick={() => onChange({ shelvesOn: c.shelvesOn === false })} />
          <ClosetNumber label="Entrepaños" value={d.shelfCount} hint={d.suggestedShelves} onCommit={(n) => onChange({ shelfCount: Math.max(0, Math.min(12, Math.round(n))) })} />
          <ClosetToggle label="Con nariz" on={c.narizEntrepanos === true} onClick={() => onChange({ narizEntrepanos: c.narizEntrepanos !== true })} />
          {c.narizEntrepanos === true && <ClosetNumber label="Alto de la nariz (mm)" value={c.narizAlto ?? 40} hint={40} onCommit={(n) => onChange({ narizAlto: Math.max(15, Math.min(100, Math.round(n))) })} />}
          <p className="text-[9px] font-bold text-slate-400">Se reparten el espacio entre la tapa del cajonero y el maletero.</p>
          {c.cajoneroPos === 'left' && <ClosetToggle label={api.leftWall ? 'Costado junto al muro (izquierdo)' : 'Costado junto al costado (izquierdo)'} on={c.costadoLeft !== false && c.sideCostado !== false} onClick={() => onChange({ costadoLeft: !(c.costadoLeft !== false && c.sideCostado !== false), sideCostado: undefined })} />}
          {c.cajoneroPos === 'right' && <ClosetToggle label={api.rightWall ? 'Costado junto al muro (derecho)' : 'Costado junto al costado (derecho)'} on={c.costadoRight !== false && c.sideCostado !== false} onClick={() => onChange({ costadoRight: !(c.costadoRight !== false && c.sideCostado !== false), sideCostado: undefined })} />}
        </>
      )}
      {section === 'maletero' && (
        <>
          <ClosetNumber label="Altura del tablero (mm del piso)" value={d.maleteroTop} hint={d.suggestedMaleteroTop} onCommit={(n) => onChange({ maleteroTop: Math.max(900, Math.min(2300, Math.round(n))) })} />
          <ClosetToggle label="Con nariz (maletero a 470 mm)" on={c.narizMaletero === true} onClick={() => onChange({ narizMaletero: c.narizMaletero !== true })} />
          {c.narizMaletero === true && <ClosetNumber label="Alto de la nariz (mm)" value={c.narizAlto ?? 40} hint={40} onCommit={(n) => onChange({ narizAlto: Math.max(15, Math.min(100, Math.round(n))) })} />}
          <p className="text-[9px] font-bold text-slate-400">Maletero: la menor de 1900 mm o el techo menos 350 mm. Tubos: el primero 40 mm bajo el tablero y el segundo a 900 mm del piso.</p>
        </>
      )}
      <button className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase" onClick={onClose} title="Los cambios ya están aplicados; cierra el formulario">Aplicar</button>
    </div>
  );
};

const Counter3D: React.FC<{
  box: Box; wallA: number; offsetZ: number; translucent: boolean;
  selected?: boolean; editing?: boolean; settings?: CounterSettings; sides?: CounterSides;
  onSelect?: (id: string) => void; onOpenEditor?: (id: string) => void; onCloseEditor?: () => void; onApply?: (s: CounterSettings, sides: CounterSides) => void;
}> = ({ box, wallA, offsetZ, translucent, selected, editing, settings, sides, onSelect, onOpenEditor, onCloseEditor, onApply }) => {
  const cutoutsKey = JSON.stringify(box.cutouts || []);
  const geometry = useMemo(() => {
    // La forma se dibuja en el plano (X, -Y) y se extruye hacia arriba; al girarla, -Y pasa a ser la profundidad de la escena
    const shape = new THREE.Shape();
    const x0 = box.x / 1000, x1 = (box.x + box.sx) / 1000, v0 = -box.y / 1000, v1 = -(box.y + box.sy) / 1000;
    if (box.polygon && box.polygon.length >= 3) {
      // Pieza con cortes a 45° (salpicadero que rodea una columna): se dibuja con su contorno en planta
      box.polygon.forEach(([px, py], i) => (i === 0 ? shape.moveTo(px / 1000, -py / 1000) : shape.lineTo(px / 1000, -py / 1000)));
      shape.closePath();
    } else if (box.notches && box.notches.length > 0) {
      // Mesón con muescas contra el muro (columnas): el contorno se recorre a lo largo del muro (a) y hacia el frente (c)
      const wl = box.wall;
      const aMin = wl === 'A' ? box.x : box.y, aMax = wl === 'A' ? box.x + box.sx : box.y + box.sy;
      const cMax = wl === 'A' ? box.sy : box.sx;
      const toXY = (a: number, c: number): [number, number] => (wl === 'A' ? [a, box.y + c] : wl === 'B' ? [box.x + c, a] : [box.x + box.sx - c, a]);
      const outline: Array<[number, number]> = [[aMin, 0]];
      box.notches.forEach(nn => { outline.push([nn.a0, 0], [nn.a0, nn.c], [nn.a1, nn.c], [nn.a1, 0]); });
      outline.push([aMax, 0], [aMax, cMax], [aMin, cMax]);
      const pts = outline.filter((p, i) => i === 0 || Math.abs(p[0] - outline[i - 1][0]) > 1e-6 || Math.abs(p[1] - outline[i - 1][1]) > 1e-6).map(([a, c]) => toXY(a, c));
      pts.forEach(([px, py], i) => (i === 0 ? shape.moveTo(px / 1000, -py / 1000) : shape.lineTo(px / 1000, -py / 1000)));
      shape.closePath();
    } else {
      shape.moveTo(x0, v0); shape.lineTo(x1, v0); shape.lineTo(x1, v1); shape.lineTo(x0, v1); shape.lineTo(x0, v0);
    }
    (box.cutouts || []).forEach(c => {
      const hole = new THREE.Path();
      const a0 = c.x / 1000, a1 = (c.x + c.sx) / 1000, b0 = -c.y / 1000, b1 = -(c.y + c.sy) / 1000;
      hole.moveTo(a0, b0); hole.lineTo(a0, b1); hole.lineTo(a1, b1); hole.lineTo(a1, b0); hole.lineTo(a0, b0);
      shape.holes.push(hole);
    });
    const g = new THREE.ExtrudeGeometry(shape, { depth: box.sz / 1000, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    // Inglete a 45° entre el mesón y la cascada: el canto de abajo del mesón (o de arriba de la cascada) se corre un espesor
    if (box.mitreBottom || box.mitreTop) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      const e = 1e-6;
      const bx0 = box.x / 1000, bx1 = (box.x + box.sx) / 1000, bz0 = box.y / 1000, bz1 = (box.y + box.sy) / 1000, h = box.sz / 1000;
      const t = (box.mitreBottom ? box.sz : Math.min(box.sx, box.sy)) / 1000;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (box.mitreBottom && y < e) {
          box.mitreBottom.forEach(s => {
            if (s === 'x+' && Math.abs(x - bx1) < e) x -= t;
            else if (s === 'x-' && Math.abs(x - bx0) < e) x += t;
            else if (s === 'y+' && Math.abs(z - bz1) < e) z -= t;
            else if (s === 'y-' && Math.abs(z - bz0) < e) z += t;
          });
        }
        if (box.mitreTop && y > h - e) {
          const s = box.mitreTop;
          if ((s === 'x+' && Math.abs(x - bx1) < e) || (s === 'x-' && Math.abs(x - bx0) < e) || (s === 'y+' && Math.abs(z - bz1) < e) || (s === 'y-' && Math.abs(z - bz0) < e)) y -= t;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    }
    // Cascada con chaflán: el canto de abajo retrocede por el frente (+Y) y el de arriba se queda donde está
    if (box.chamferY) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      const h = box.sz / 1000, zf = (box.y + box.sy) / 1000;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getZ(i) - zf) < 1e-6) pos.setZ(i, pos.getZ(i) - (box.chamferY / 1000) * (1 - pos.getY(i) / h));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    }
    return g;
  }, [box.x, box.y, box.sx, box.sy, box.sz, cutoutsKey, JSON.stringify(box.mitreBottom), box.mitreTop, box.chamferY, JSON.stringify(box.notches), JSON.stringify(box.polygon)]);

  const interactive = !!onSelect && box.id.startsWith('counter-'); // los salpicaderos se editan desde su mesón
  return (
    <>
      <mesh
        geometry={geometry}
        position={[-wallA / 2000, box.z / 1000, offsetZ]}
        castShadow
        receiveShadow
        onClick={interactive ? (e) => { e.stopPropagation(); if (!isOverlay(e)) onSelect!(box.id); } : undefined}
        onDoubleClick={interactive ? (e) => { e.stopPropagation(); if (isOverlay(e)) return; onSelect!(box.id); onOpenEditor?.(box.id); } : undefined}
      >
        <meshStandardMaterial color="#d8d3ca" roughness={0.35} metalness={0.05} transparent={translucent} opacity={translucent ? 0.85 : 1} />
        <Edges color={selected ? '#ef4444' : '#8b8579'} linewidth={selected ? 2 : 1} />
      </mesh>
      {editing && settings && sides && onApply && onCloseEditor && (
        <Html position={[(box.x + box.sx / 2 - wallA / 2) / 1000, (box.z + box.sz) / 1000 + 0.02, offsetZ + (box.y + box.sy / 2) / 1000]} center zIndexRange={[200, 0]} occlude={false} style={{ pointerEvents: 'none' }}>
          <CounterEditor box={box} wall={box.wall} settings={settings} sides={sides} onApply={onApply} onClose={onCloseEditor} />
        </Html>
      )}
    </>
  );
};

/** Datos del electrodoméstico agarrado: tamaño, centro (mm, sistema de las cajas) y altura del plano de arrastre */
interface ApplianceDrag {
  type: ApplianceType;
  wall: WallName;
  width: number;
  depth: number;
  centerX: number;
  centerY: number;
  planeY: number; // altura (m) del punto agarrado: el cursor se proyecta sobre el plano horizontal a esa altura
}

/**
 * Arrastra un electrodoméstico con el cursor y decide en qué muro cae (A, B o C según la forma de la cocina).
 * En la vista frontal el plano horizontal queda de canto, así que ahí solo se desplaza a lo largo del muro A.
 */
const ApplianceDragController: React.FC<{
  drag: ApplianceDrag | null;
  layout: LayoutType;
  lArm?: 'left' | 'right';
  wallA: number; wallB: number; wallC: number;
  offsetZ: number;
  controlsRef: React.RefObject<any>;
  onMove: (type: ApplianceType, wall: WallName, distance: number) => void;
  onEnd: () => void;
}> = ({ drag, layout, lArm, wallA, wallB, wallC, offsetZ, controlsRef, onMove, onEnd }) => {
  const { camera, gl, raycaster } = useThree();
  const latest = useRef({ layout, lArm, wallA, wallB, wallC, onMove, onEnd });
  latest.current = { layout, lArm, wallA, wallB, wallC, onMove, onEnd };

  useEffect(() => {
    if (!drag) return;
    if (controlsRef.current) controlsRef.current.enabled = false; // sin esto la cámara giraría mientras se arrastra
    document.body.style.cursor = 'grabbing';

    let offset: { x: number; y: number } | null = null; // distancia entre el cursor y el centro al agarrar
    let currentWall: WallName = drag.wall;
    const hit = new THREE.Vector3();
    const dir = new THREE.Vector3();

    const pointerToPlan = (ev: PointerEvent): { x: number; y: number; planView: boolean } | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -(((ev.clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      camera.getWorldDirection(dir);
      const steep = Math.abs(dir.y) > 0.25; // la cámara mira lo bastante hacia abajo para usar un plano horizontal
      const plane = steep
        ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -drag.planeY)
        : new THREE.Plane(new THREE.Vector3(0, 0, 1), -(offsetZ + drag.depth / 2000));
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      const L = latest.current;
      return { x: hit.x * 1000 + L.wallA / 2, y: steep ? (hit.z - offsetZ) * 1000 : drag.centerY, planView: steep };
    };

    const move = (ev: PointerEvent) => {
      const p = pointerToPlan(ev);
      if (!p) return;
      if (!offset) offset = { x: p.x - drag.centerX, y: p.planView ? p.y - drag.centerY : 0 };
      const cx = p.x - offset.x;
      const cy = p.y - offset.y;
      const L = latest.current;

      // Muro según la zona: pegado al muro A, o en la zona de los brazos laterales (más allá de la esquina ciega)
      let wall: WallName = 'A';
      if (p.planView && cy > CORNER_BLIND_OFFSET + 100 && L.layout !== 'STRAIGHT') {
        // L: el brazo está a la izquierda (B) o a la derecha (C); U: B a la izquierda y C a la derecha
        if (L.layout === 'U_SHAPE') wall = cx > L.wallA / 2 ? 'C' : 'B';
        else if (L.lArm === 'right') { if (cx > L.wallA / 2) wall = 'C'; }
        else if (cx <= L.wallA / 2) wall = 'B';
      } else if (!p.planView && currentWall !== 'A') {
        return; // en la vista frontal no se puede mover algo que está en un brazo lateral
      }
      currentWall = wall;

      const along = wall === 'A' ? cx : cy - CORNER_BLIND_OFFSET;
      const length = wall === 'A' ? L.wallA : (wall === 'B' ? L.wallB : L.wallC) - CORNER_BLIND_OFFSET;
      const distance = Math.min(Math.max(Math.round((along - drag.width / 2) / 5) * 5, 0), Math.max(0, length - drag.width));
      L.onMove(drag.type, wall, distance);
    };

    const up = () => latest.current.onEnd();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (controlsRef.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
    };
  }, [drag]);

  return null;
};

const APPLIANCE_NAMES: Record<string, string> = {
  fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', 'hood-under': 'Campana', 'hood-island': 'Campana', pantry: 'Alacena', dishwasher: 'Lavavajillas',
};

// Separación de las cotas respecto al muro y entre filas (mm)
const DIM_BASE_OFFSET = 250;
const DIM_ROW_SPACING = 220;

/** Filas de cotas que necesita un muro: una por electrodoméstico activo */
const dimensionRows = (appliances: Appliance[]) =>
  Math.max(0, ...(['A', 'B', 'C'] as WallName[]).map(w => appliances.filter(a => a.active && a.wall === w).length));

/** Etiqueta de cota editable: clic para escribir el valor; Enter o salir del campo lo aplica; Escape cancela */
/** Una medición hecha con la cinta: dos puntos de la escena (metros) */
type Measure = { a: THREE.Vector3; b: THREE.Vector3 };

/** Texto con la distancia y sus componentes (largo = a lo largo del muro A, fondo = hacia el frente, alto = vertical) */
const measureParts = (a: THREE.Vector3, b: THREE.Vector3) => {
  const mm = (v: number) => Math.round(Math.abs(v) * 1000);
  const total = Math.round(a.distanceTo(b) * 1000);
  const parts = [['largo', mm(b.x - a.x)], ['alto', mm(b.y - a.y)], ['fondo', mm(b.z - a.z)]].filter(([, v]) => (v as number) > 0);
  return { total, detail: parts.map(([n, v]) => `${n} ${v}`).join(' · ') };
};

const MeasureLabel: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; ghost?: boolean; onRemove?: () => void }> = ({ a, b, ghost, onRemove }) => {
  const { total, detail } = measureParts(a, b);
  return (
    <Html position={a.clone().add(b).multiplyScalar(0.5)} center occlude={false} zIndexRange={[150, 0]} style={{ pointerEvents: 'none' }}>
      <div data-overlay className={`select-none whitespace-nowrap px-2 py-1 rounded-lg border-2 shadow-lg text-center ${ghost ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-amber-500 border-white text-white'}`}>
        <div className="flex items-center justify-center gap-1.5 text-[12px] leading-none font-black">
          {total} mm
          {onRemove && (
            <button className="pointer-events-auto w-4 h-4 rounded-full bg-white/30 hover:bg-white/60 text-[10px] leading-none" title="Borrar esta medición" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>×</button>
          )}
        </div>
        {detail && <div className="mt-0.5 text-[9px] leading-none font-bold opacity-90">{detail}</div>}
      </div>
    </Html>
  );
};

const MeasureDot: React.FC<{ p: THREE.Vector3; ring?: boolean }> = ({ p, ring }) => (
  <Html position={p} center occlude={false} zIndexRange={[140, 0]} style={{ pointerEvents: 'none' }}>
    <div className={ring ? 'w-4 h-4 rounded-full border-2 border-amber-500 bg-amber-200/60' : 'w-2.5 h-2.5 rounded-full bg-amber-500 border border-white'} />
  </Html>
);

/**
 * Cinta métrica en la escena 3D. Clic en dos puntos y se dibuja la distancia con su largo, alto y fondo.
 * Los puntos se pegan a las esquinas de las cajas (módulos, muros, mesón, electrodomésticos) si hay una cerca del
 * cursor; si no, a lo que esté debajo del cursor. Esc cancela el punto A, Supr/Retroceso borra la última medición.
 */
const MeasureTool: React.FC<{ corners: THREE.Vector3[]; measures: Measure[]; onChange: (m: Measure[]) => void }> = ({ corners, measures, onChange }) => {
  const { gl, camera, scene, raycaster } = useThree();
  const [first, setFirst] = useState<THREE.Vector3 | null>(null);
  const [hover, setHover] = useState<THREE.Vector3 | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const live = useRef({ corners, measures, first, onChange });
  live.current = { corners, measures, first, onChange };

  useEffect(() => {
    const el = gl.domElement;
    const SNAP_PX = 14;
    const pick = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      // 1) esquina más cercana en pantalla (a igualdad, la más cercana a la cámara)
      let best: THREE.Vector3 | null = null;
      let bestScore = Infinity;
      const isSolid = (h: THREE.Intersection) => {
        const o = h.object as any;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        return o.isMesh && !o.isLine2 && o.visible && !o.userData?.noMeasure && o.geometry?.type !== 'SphereGeometry' && !(mat?.transparent && mat.opacity < 0.9);
      };
      // una esquina tapada por otra pieza (detrás de un cajón, de una puerta, de un costado...) no se puede tocar
      const occluded = (c: THREE.Vector3) => {
        const p = c.clone().project(camera);
        raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
        const t = c.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
        const hit = raycaster.intersectObjects(scene.children, true).find(isSolid);
        return !!hit && hit.distance < t - 0.02;
      };
      const cands: Array<{ c: THREE.Vector3; score: number }> = [];
      const topDown = Math.abs(camera.getWorldDirection(new THREE.Vector3()).y) > 0.95;
      const v = new THREE.Vector3();
      for (const c of live.current.corners) {
        v.copy(c).project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const d = Math.hypot((v.x + 1) / 2 * rect.width - px, (1 - v.y) / 2 * rect.height - py);
        if (d > SNAP_PX) continue;
        // Vista desde arriba: muchas esquinas caen en el mismo punto de pantalla; con un punto A puesto se prefiere la de su misma altura
        const ref = live.current.first;
        const sameLevel = topDown && ref ? Math.abs(c.y - ref.y) * 40 : 0;
        const score = d + sameLevel + c.distanceTo(camera.position) * 0.01;
        cands.push({ c, score });
      }
      cands.sort((p, q) => p.score - q.score);
      for (const cand of cands.slice(0, 12)) { if (!occluded(cand.c)) { best = cand.c; bestScore = cand.score; break; } }
      if (best) return best.clone();
      // 2) lo que haya bajo el cursor
      raycaster.setFromCamera(new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1), camera);
      const hit = raycaster.intersectObjects(scene.children, true).find(h => {
        const o = h.object as any;
        return o.isMesh && !o.isLine2 && o.visible && !o.userData?.noMeasure && o.geometry?.type !== 'SphereGeometry';
      });
      return hit ? hit.point.clone() : null;
    };
    const onMove = (e: PointerEvent) => setHover(pick(e.clientX, e.clientY));
    const onDown = (e: PointerEvent) => { down.current = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const d = down.current;
      down.current = null;
      if (!d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // arrastre = mover la cámara
      const p = pick(e.clientX, e.clientY);
      if (!p) return;
      const { first: f, measures: m, onChange: change } = live.current;
      if (!f) setFirst(p);
      else { change([...m, { a: f, b: p }]); setFirst(null); }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input,textarea')) return;
      if (e.key === 'Escape') setFirst(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && live.current.measures.length) live.current.onChange(live.current.measures.slice(0, -1));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    el.style.cursor = 'crosshair';
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      el.style.cursor = '';
    };
  }, [gl, camera, scene, raycaster]);

  return (
    <group>
      {measures.map((m, i) => (
        <group key={i}>
          <Line points={[m.a, m.b]} color="#f59e0b" lineWidth={2.5} depthTest={false} renderOrder={30} />
          <MeasureDot p={m.a} />
          <MeasureDot p={m.b} />
          <MeasureLabel a={m.a} b={m.b} onRemove={() => onChange(measures.filter((_, j) => j !== i))} />
        </group>
      ))}
      {first && <MeasureDot p={first} />}
      {first && hover && (
        <>
          <Line points={[first, hover]} color="#f59e0b" lineWidth={2} dashed dashSize={0.03} gapSize={0.02} depthTest={false} renderOrder={30} />
          <MeasureLabel a={first} b={hover} ghost />
        </>
      )}
      {hover && <MeasureDot p={hover} ring />}
    </group>
  );
};

/** Marca los elementos HTML superpuestos para que el módulo de debajo no los tome como clic o arrastre propio */
const isOverlay = (e: { nativeEvent?: Event }) => !!(e.nativeEvent?.target as HTMLElement | null)?.closest?.('[data-overlay]');

/** Piezas laterales de un módulo: visto (todo el fondo) y dilatada (fondo y altura propios). Izquierda/derecha vistas desde el frente */
type SideConfig = {
  visto: { left: boolean; right: boolean; thickness: number };
  dilat: { left: boolean; right: boolean; thickness: number; depth: number; height?: number };
};

/** Doble clic en un módulo: se escriben las tres medidas (largo, ancho = fondo y alto) */
const ModuleEditor: React.FC<{
  module: KitchenModule;
  onApply: (m: { width: number; depth: number; height: number; sides: SideConfig }) => void;
  onClose: () => void;
  onChooseFronts?: (id: string, kind: 'doors' | 'drawers' | 'vertical' | 'horizontal' | 'open') => void;
}> = ({ module, onApply, onClose, onChooseFronts }) => {
  const [visto, setVisto] = useState({ left: !!module.vistoLeft, right: !!module.vistoRight, thickness: module.vistoThickness ?? 15 });
  const [dilat, setDilat] = useState({ left: !!module.dilatLeft, right: !!module.dilatRight, thickness: String(module.dilatThickness ?? 15), depth: String(module.dilatDepth ?? 70), height: String(module.dilatHeight ?? module.height) });
  const [vals, setVals] = useState({ width: String(Math.round(module.width)), depth: String(Math.round(module.depth)), height: String(Math.round(module.height)) });
  const apply = () => {
    const n = (s: string, fallback: number) => { const x = parseFloat(s); return isNaN(x) ? fallback : x; };
    onApply({ width: n(vals.width, module.width), depth: n(vals.depth, module.depth), height: n(vals.height, module.height),
      sides: {
        visto,
        dilat: {
          left: dilat.left, right: dilat.right,
          thickness: Math.max(1, Math.min(50, n(dilat.thickness, 15))),
          depth: Math.max(10, Math.min(1200, n(dilat.depth, 70))),
          // La altura sugerida es la del módulo: si no se cambia, la pieza sigue la altura del módulo
          height: Math.round(n(dilat.height, module.height)) === Math.round(n(vals.height, module.height)) ? undefined : n(dilat.height, module.height),
        },
      },
    });
    onClose();
  };
  const field = (key: 'width' | 'depth' | 'height', label: string, autoFocus = false) => (
    <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
      {label}
      <input
        autoFocus={autoFocus}
        type="number"
        value={vals[key]}
        onChange={(e) => setVals({ ...vals, [key]: e.target.value })}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') apply();
          if (e.key === 'Escape') onClose();
        }}
        className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );
  return (
    <div data-overlay data-module-editor className="pointer-events-auto w-44 p-2.5 space-y-1.5 rounded-xl bg-white border border-slate-300 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">{module.name}</div>
      {field('width', 'Largo', true)}
      {field('depth', 'Ancho (fondo)')}
      {field('height', 'Alto')}
      {/* frentes: lo mismo que el clic derecho (bajo: puertas o cajones; aéreo: puertas verticales u horizontales); se aplica al momento */}
      {onChooseFronts && (module.type === 'LOWER' || module.type === 'UPPER') && !module.cornerArm && (() => {
        const horizontal = module.frontsLayout === 'upper-door2-h' || module.frontsLayout === 'hood-h';
        const current = !module.detailed ? null : module.frontsLayout === 'open' ? 'open' : module.type === 'UPPER' ? (horizontal ? 'horizontal' : 'vertical') : (module.frontsLayout === 'drawers' ? 'drawers' : 'doors');
        const ops = module.type === 'UPPER' ? [['vertical', 'Verticales'], ['horizontal', 'Horizontales'], ['open', 'Abierto']] as const : [['doors', 'Puertas'], ['drawers', 'Cajones'], ['open', 'Abierto']] as const;
        return (
          <div className="pt-1 border-t border-slate-200 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{module.type === 'UPPER' ? 'Puertas' : 'Frente'}</div>
            <div className="grid grid-cols-1 gap-1">
              {ops.map(([k, label]) => (
                <button key={k} onClick={() => onChooseFronts(module.uniqueId, k)} className={`py-1 rounded-lg text-[11px] font-black border-2 ${current === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'}`}>{label}</button>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="pt-1 border-t border-slate-200 space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Visto (lado sin muro)</div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={visto.left} onChange={(e) => setVisto({ ...visto, left: e.target.checked })} />Izquierda</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={visto.right} onChange={(e) => setVisto({ ...visto, right: e.target.checked })} />Derecha</label>
        </div>
        <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
          Espesor
          <select value={visto.thickness} onChange={(e) => setVisto({ ...visto, thickness: Number(e.target.value) })} className="w-20 px-1 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800">
            <option value={15}>15 mm</option>
            <option value={19}>19 mm</option>
          </select>
        </label>
      </div>
      <div className="pt-1 border-t border-slate-200 space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Dilatada (lado)</div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={dilat.left} onChange={(e) => setDilat({ ...dilat, left: e.target.checked })} />Izquierda</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={dilat.right} onChange={(e) => setDilat({ ...dilat, right: e.target.checked })} />Derecha</label>
        </div>
        {(dilat.left || dilat.right) && (
          <>
            {([['thickness', 'Espesor'], ['depth', 'Profundidad'], ['height', 'Altura']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600">
                {label}
                <input
                  type="number"
                  value={dilat[key]}
                  onChange={(e) => setDilat({ ...dilat, [key]: e.target.value })}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') apply(); if (e.key === 'Escape') onClose(); }}
                  className="w-20 px-1.5 py-1 rounded border border-slate-300 bg-white text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500"
                />
              </label>
            ))}
          </>
        )}
      </div>
      <div className="flex gap-1.5 pt-1">
        <button className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black" onClick={apply}>Aplicar</button>
        <button className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
};

const DimLabel: React.FC<{ text: string; value: number; onCommit?: (value: number) => void; tone?: 'indigo' | 'white' | 'red'; title?: string }> = ({ text, value, onCommit, tone = 'indigo', title = 'Clic para editar la cota' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const finished = useRef(false);
  const base = 'whitespace-nowrap inline-flex items-center justify-center px-0.5 rounded-sm text-[11px] leading-none font-bold'; // estilo técnico: la medida escrita sobre la línea, sin cajetín

  // Aplica o cancela una sola vez (Enter, Escape y perder el foco pueden llegar seguidos)
  const finish = (apply: boolean) => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    const typed = parseFloat(draft);
    if (apply && !isNaN(typed) && onCommit && Math.round(typed) !== Math.round(value)) onCommit(typed);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
        }}
        onBlur={() => finish(true)}
        className="pointer-events-auto w-24 px-1.5 py-0.5 rounded border-2 border-indigo-500 bg-white text-[11px] leading-none font-black text-indigo-700 outline-none shadow-md"
      />
    );
  }
  return (
    <div
      className={`${base} text-slate-900 ${onCommit ? `pointer-events-auto cursor-text hover:bg-white/90` : ''}`}
      style={{ textShadow: '0 0 3px #fff, 0 0 3px #fff' }}
      title={onCommit ? title : undefined}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => { finished.current = false; setDraft(String(Math.round(value))); setEditing(true); }}
    >
      {text}
    </div>
  );
};

/** Electrodomésticos altos: su cota llega al lado más cercano al 0. Los demás (estufa, campana, poceta) llevan la cota al centro. */
const isTallAppliance = (type: string) => type === 'fridge' || type === 'pantry';

/**
 * Cotas de la vista de planta, siempre desde el mismo punto 0: la esquina interior de arriba a la izquierda
 * (donde el muro A se une con el B), tanto en horizontal como en vertical.
 * Hay UNA cota por electrodoméstico: al centro de la estufa, la campana y la poceta, y al lado más cercano al 0
 * de la nevera y la alacena. Van por fuera de los muros (arriba del A, a la izquierda del B, a la derecha del C),
 * una fila por electrodoméstico.
 */
const PlanDimensions: React.FC<{ appliances: Appliance[]; wallA: number; offsetZ: number; onMoveAppliance?: (type: ApplianceType, wall: WallName, distance: number) => void }> = ({ appliances, wallA, offsetZ, onMoveAppliance }) => {
  const T = WALL_THICKNESS;
  const lift = 0.03; // un poco sobre el piso para que no se confunda con él
  const toWorld = (X: number, Y: number): [number, number, number] => [(X - wallA / 2) / 1000, lift, offsetZ + Y / 1000];

  return (
    <>
      {(['A', 'B', 'C'] as WallName[]).flatMap(wall => {
        const list = appliances.filter(a => a.active && a.wall === wall).sort((a, b) => a.distance - b.distance);
        // "along" va a lo largo del muro (desde el 0) y "across" hacia afuera de él
        const pt = (along: number, across: number): [number, number, number] =>
          wall === 'A' ? toWorld(along, -T - across)
            : wall === 'B' ? toWorld(-T - across, along)
              : toWorld(wallA + T + across, along);
        // En B y C la posición del electrodoméstico se mide desde la esquina ciega; la cota, desde el 0 de la esquina
        const armStart = wall === 'A' ? 0 : CORNER_BLIND_OFFSET;

        return list.map((app, row) => {
          const off = DIM_BASE_OFFSET + row * DIM_ROW_SPACING;
          const near = armStart + app.distance;
          const target = isTallAppliance(app.type) ? near : near + app.width / 2;
          const pill = 'whitespace-nowrap px-1.5 py-0.5 rounded border text-[11px] leading-none font-black shadow-sm';
          return (
            <group key={`${wall}-${app.type}`}>
              <Line points={[pt(0, off), pt(target, off)]} color="#111827" lineWidth={2.5} />
              <Line points={[pt(-35, off - 35), pt(35, off + 35)]} color="#111827" lineWidth={1.5} />
              <Line points={[pt(target - 35, off - 35), pt(target + 35, off + 35)]} color="#111827" lineWidth={1.5} />
              {row === 0 && (
                <Html position={pt(0, off + 150)} center style={{ pointerEvents: 'none' }}>
                  <div className={`${pill} bg-white text-slate-500 border-slate-300`}>0</div>
                </Html>
              )}
              <Html position={pt(target, off + 150)} center style={{ pointerEvents: 'none' }}>
                <DimLabel
                  text={`${APPLIANCE_NAMES[app.type] || app.type} ${Math.round(target)}`}
                  value={target}
                  // El valor escrito es la cota desde el 0: se convierte a la "Posición" del electrodoméstico
                  onCommit={onMoveAppliance ? (typed) => onMoveAppliance(app.type, wall, typed - armStart - (isTallAppliance(app.type) ? 0 : app.width / 2)) : undefined}
                />
              </Html>
            </group>
          );
        });
      })}
    </>
  );
};

/** Medidas de los muros en planta (A arriba, el brazo B o C a un lado), por fuera de las cotas de los electrodomésticos; se editan con un clic */
const WallDimensions: React.FC<{ layout: LayoutType; lArm: 'left' | 'right'; appliances: Appliance[]; wallA: number; wallB: number; wallC: number; offsetZ: number; onEditWall?: (wall: 'A' | 'B' | 'C', value: number) => void }> = ({ layout, lArm, appliances, wallA, wallB, wallC, offsetZ, onEditWall }) => {
  const T = WALL_THICKNESS;
  const lift = 0.03;
  const toWorld = (X: number, Y: number): [number, number, number] => [(X - wallA / 2) / 1000, lift, offsetZ + Y / 1000];
  const walls: Array<{ wall: 'A' | 'B' | 'C'; length: number }> = [{ wall: 'A', length: wallA }];
  if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) walls.push({ wall: 'B', length: wallB });
  if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) walls.push({ wall: 'C', length: wallC });
  return (
    <>
      {walls.map(({ wall, length }) => {
        const rows = new Set(appliances.filter(a => a.active && a.wall === wall).map(a => a.type)).size;
        const off = DIM_BASE_OFFSET + Math.max(1, rows) * DIM_ROW_SPACING + 120;
        const pt = (along: number, across: number): [number, number, number] =>
          wall === 'A' ? toWorld(along, -T - across)
            : wall === 'B' ? toWorld(-T - across, along)
              : toWorld(wallA + T + across, along);
        return (
          <group key={wall}>
            <Line points={[pt(0, off), pt(length, off)]} color="#111827" lineWidth={2} />
            <Line points={[pt(-35, off - 35), pt(35, off + 35)]} color="#111827" lineWidth={1.5} />
            <Line points={[pt(length - 35, off - 35), pt(length + 35, off + 35)]} color="#111827" lineWidth={1.5} />
            <Html position={pt(length / 2, off)} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
              <div data-overlay><DimLabel text={`Muro ${wall} ${Math.round(length)}`} value={length} tone="white" onCommit={onEditWall ? (typed) => onEditWall(wall, typed) : undefined} title={`Largo del muro ${wall}: ${Math.round(length)} mm. Clic para editar`} /></div>
            </Html>
          </group>
        );
      })}
    </>
  );
};

// Encuadre (en metros) de las vistas ortogonales: centro y tamaño de lo que debe caber en pantalla
interface ViewFrame { cx: number; cy: number; cz: number; w: number; h: number; }

/**
 * Planta y Frontal son cámaras ORTOGONALES de la misma escena 3D (no un dibujo aparte),
 * así todas las vistas muestran exactamente la misma geometría.
 */
const CameraController: React.FC<{ viewMode: 'plan' | 'frontal' | 'isometric' | '3d'; plan: ViewFrame; frontal: ViewFrame }> = ({ viewMode, plan, frontal }) => {
  const { camera, controls, size } = useThree() as any;
  const planKey = `${plan.cx}|${plan.cz}|${plan.w}|${plan.h}`;
  const frontalKey = `${frontal.cx}|${frontal.cy}|${frontal.w}|${frontal.h}`;

  useEffect(() => {
    const target = new THREE.Vector3(0, 0, 0);
    let rotate = true;

    if (viewMode === 'plan') {
      // Desde arriba; el pequeño desplazamiento en Z deja el muro A en la parte superior de la pantalla
      camera.position.set(plan.cx, 10, plan.cz + 0.01);
      target.set(plan.cx, 0, plan.cz);
      rotate = false;
      if (camera.isOrthographicCamera) { camera.zoom = Math.min(size.width / plan.w, size.height / plan.h); camera.userData.fitZoom = camera.zoom; }
    } else if (viewMode === 'frontal') {
      camera.position.set(frontal.cx, frontal.cy, 10);
      target.set(frontal.cx, frontal.cy, 0);
      rotate = false;
      if (camera.isOrthographicCamera) { camera.zoom = Math.min(size.width / frontal.w, size.height / frontal.h); camera.userData.fitZoom = camera.zoom; }
    } else {
      // Isométrica y 3D: perspectiva centrada en la cocina, a una distancia que depende de su tamaño
      const d = Math.max(plan.w, plan.h) * 0.85;
      target.set(plan.cx, frontal.cy * 0.6, plan.cz);
      if (viewMode === 'isometric') camera.position.set(target.x + d, target.y + d * 0.9, target.z + d);
      else camera.position.set(target.x + d * 0.8, target.y + d * 0.55, target.z + d * 1.1);
    }

    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();

    if (controls) {
      controls.target.copy(target);
      controls.enableRotate = rotate;
      // En vistas ortogonales el clic izquierdo desplaza la vista (no hay rotación)
      controls.mouseButtons = {
        LEFT: rotate ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      controls.screenSpacePanning = true;
      controls.update();
    }
  }, [viewMode, camera, controls, size.width, size.height, planKey, frontalKey]);
  return null;
};

interface KitchenViewer3DProps {
  wallThickMm?: number; // espesor del muro (mm); por defecto 150
  layout: LayoutType;
  lArm?: 'left' | 'right';
  wallA: number;
  wallB: number;
  wallC: number;
  spaceHeight: number;
  floorWidth: number;
  floorLength: number;
  modules: KitchenModule[];
  boxes: Box[]; // lista única de cajas: fuente de verdad de la geometría
  appliances: Appliance[];
  puntos?: PuntoAdecuacion[]; // puntos de adecuación (agua, desagüe, energía, gas) en el muro
  hasIsland: boolean;
  island: { length: number; width: number; height: number; dx: number; dy: number };
  islands?: IslandItem[];
  onEditIsland?: (id: string, patch: Partial<IslandItem>) => void;
  onAbrirIsla?: (id: string) => void; // doble clic en la isla: su formulario (medidas, barra, electrodomésticos…)
  onEditWall?: (wall: 'A' | 'B' | 'C', value: number) => void;
  closetForm?: ClosetFormApi; // closet: doble clic en una de sus secciones abre su formulario
  puertaApi?: { cfg: PuertaCfg; onChange: (p: PuertaCfg) => void; onOpenForm: () => void }; // Puertas: clic = flechas del vano, doble clic = formulario
  fitApi?: { fit: ClosetFit; onChange: (f: ClosetFit) => void }; // Closet fit: seleccionar un cuerpo, arrastrar sus bordes, dividirlo o eliminarlo
  onDeleteIsland?: (id: string) => void;
  viewMode: 'plan' | 'frontal' | 'isometric' | '3d';
  hasZocalo?: boolean;
  zocaloHeight?: number;
  hasLeftClosure?: boolean;
  hasRightClosure?: boolean;
  onDeleteModule?: (id: string) => void;
  onSplitModule?: (id: string) => void;
  onEditModuleDimension?: (id: string, width: number) => void;
  onEditModuleMeasure?: (id: string, field: 'height' | 'depth', value: number) => void;
  onSetModuleTopEdge?: (id: string, height: number, topGap: number) => void;
  counterSettings?: CounterSettings;
  onEditCounter?: (s: CounterSettings, counterId: string, extras: CounterExtras) => void;
  counterExtras?: Record<string, CounterExtras>;
  onSetModuleVistos?: (id: string, v: SideConfig) => void;
  onSetModuleFronts?: (id: string, kind: 'doors' | 'drawers' | 'vertical' | 'horizontal' | 'open') => void;
  onSplitHorizontal?: (id: string) => void;
  onSplitDepth?: (id: string) => void;
  onExtendFace?: (id: string, face: FaceKey) => void;
  onJoinCorner?: (aId: string, armId: string) => void;
  onSplitCorner?: (id: string) => void;
  onEditCornerArm?: (id: string, width: number) => void;
  onDragModule?: (id: string, newPositionX: number) => void;
  onResizeEdge?: (id: string, side: 'left' | 'right', deltaX: number, initialWidth: number, initialPositionX: number) => void;
  onMoveAppliance?: (type: ApplianceType, wall: WallName, distance: number) => void;
  colores?: { fachada: string; fachadaMA?: string; ma: string; mb: string; otros: string; fondo?: string; fondoMA?: string }; // tonos parecidos a los colores elegidos (catálogo)
  visibility?: { upper: boolean; lower: boolean; counter: boolean; appliances: boolean; puntos?: boolean; isla?: boolean; muros?: boolean; doors?: boolean; shelves?: boolean; cajonero?: boolean; costado?: boolean; dims?: boolean; wallA?: boolean; wallB?: boolean; wallC?: boolean; hoja?: boolean; marco?: boolean; tapaluz?: boolean };
  collisions?: Box[]; // cajas que chocan: se marcan en rojo
  measureMode?: boolean; // cinta métrica activa: la escena solo se mira y se mide
  onResizeJunction?: (leftId: string, rightId: string, deltaX: number, initialLeftWidth: number, initialRightWidth: number, initialLeftPositionX: number, initialRightPositionX: number) => void;
}

export const KitchenViewer3D: React.FC<KitchenViewer3DProps> = ({
  wallThickMm, puertaApi, colores,
  layout, lArm, wallA, wallB, wallC, spaceHeight, floorWidth, floorLength, modules: modulesIn, boxes: boxesIn, appliances, puntos = [], onAbrirIsla, hasIsland, island, islands = [], onEditIsland, onEditWall, closetForm, fitApi, onDeleteIsland, viewMode, hasZocalo, zocaloHeight = 100,
  hasLeftClosure, hasRightClosure, counterExtras, onDeleteModule, onSplitModule, onEditModuleDimension, onEditModuleMeasure, onSetModuleTopEdge, onSetModuleVistos, onSetModuleFronts, onSplitHorizontal, onSplitDepth, onExtendFace, onJoinCorner, onSplitCorner, onEditCornerArm, counterSettings, onEditCounter, onDragModule, onResizeEdge, onMoveAppliance, visibility, collisions = [], measureMode = false, onResizeJunction
}) => {
  const controlsRef = useRef<any>(null);
  // botones Isla y Muros de la barra de vistas: ocultan las islas (con su mesón, campana y piezas) y los muros
  const verIsla = visibility?.isla !== false, verMuros = visibility?.muros !== false;
  const boxes = useMemo(() => boxesIn.filter(b => (verIsla || !b.islandId) && (verMuros || (b.kind !== 'wall' && !b.id.startsWith('closure-')))), [boxesIn, verIsla, verMuros]);
  let modules = useMemo(() => (verIsla ? modulesIn : modulesIn.filter(m => m.wall !== 'Island')), [modulesIn, verIsla]);
  // Módulo seleccionado (clic) y módulo cuyo editor de medidas está abierto (doble clic)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Dos módulos elegidos con Shift + clic para unirlos en un esquinero en L
  const [pair, setPair] = useState<string[]>([]);
  const selectModule = (id: string, additive?: boolean) => {
    setSelectedCounter(null); setEditingCounter(null);
    if (additive && selectedId && selectedId !== id) { setPair([selectedId, id]); setSelectedId(null); setEditingId(null); return; }
    setPair([]); setSelectedId(id);
    setContextId(prev => (prev === id ? prev : null));
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fitSel, setFitSel] = useState<string | null>(null); // cuerpo del Closet fit seleccionado
  const [fitLabelOff, setFitLabelOff] = useState<Record<string, { x: number; y: number }>>({}); // notas de medidas movidas a mano
  const [fitLocks, setFitLocks] = useState<Record<string, { w?: boolean; h?: boolean }>>({}); // candados: medidas que no deben cambiar al editar otras
  const fitLocked = (id: string, kind: 'w' | 'h') => !!fitLocks[id]?.[kind];
  // Editar las medidas de un cuerpo del Closet fit desde su nota: el ancho se reparte con el vecino y el alto con la celda vecina (o con el cuerpo de arriba / abajo)
  const fitMoveV = (id: string, up: number) => {
    if (!fitApi) return;
    const m = /^fit-(inf|sup)-(\d+)-(\d+)$/.exec(id);
    if (!m) return;
    const lower = m[1] === 'inf', i = Number(m[2]), j = Number(m[3]);
    const f2 = fitApi.fit, rs = fitRows(f2, wallA), cs2 = fitCells(f2, wallA, spaceHeight);
    const lc2 = cs2.lower.map(c => [...c]), uc2 = cs2.upper.map(c => [...c]);
    const baseC = [...((lower ? cs2.lower : cs2.upper)[i] ?? [])];
    const hasA = j >= 1 && baseC[j - 1] < 0, hasB = baseC[j + 1] !== undefined && baseC[j + 1] < 0;
    const ua = hasA ? Math.abs(baseC[j - 1]) : 0, ub = hasB ? Math.abs(baseC[j + 1]) : 0;
    const d = Math.round(Math.max(-(hasB ? ub - 1 : 0), Math.min(hasA ? ua - 1 : 0, up)));
    if (d === 0) return;
    const nc = [...baseC];
    if (d > 0) { nc[j - 1] = -(ua - d); if (hasB) nc[j + 1] = -(ub + d); else nc.splice(j + 1, 0, -d); }
    else { const dd = -d; nc[j + 1] = -(ub - dd); if (hasA) nc[j - 1] = -(ua + dd); else nc.splice(j, 0, -dd); }
    (lower ? lc2 : uc2)[i] = nc;
    fitApi.onChange({ ...f2, lowerW: [...rs.lower], lowerBodies: rs.lower.length, lowerCells: lc2, upperW: [...rs.upper], upperBodies: rs.upper.length, upperCells: uc2 });
  };
  const fitEdit = (id: string, patch: { width?: number; height?: number }, side?: 'l' | 'r'): void => {
    if (!fitApi) return;
    const f = fitApi.fit;
    // parte de un cuerpo dividido (id-sN): el alto es el de su celda y el ancho se reparte solo con sus hermanas
    const subM = /^(fit-(?:inf|sup)-\d+-\d+)-s(\d+)$/.exec(id);
    if (subM) {
      if (patch.height != null) return fitEdit(subM[1], patch);
      const cellKey = subM[1], k = Number(subM[2]), cur = f.subs?.[cellKey];
      const bx = boxes.find(x => x.id === cellKey + '-s0');
      if (patch.width != null && cur && cur.length > 1 && bx) {
        const tot = cur.reduce((a, b) => a + b, 0), cellW = boxes.filter(x => x.id.startsWith(cellKey + '-s')).reduce((a, x) => a + x.sx, 0);
        const ws = cur.map(x => (x * cellW) / tot);
        const nb = k < ws.length - 1 ? k + 1 : k - 1;
        const pair = ws[k] + ws[nb];
        const nw = Math.min(Math.max(patch.width, 15), pair - 15);
        ws[k] = nw; ws[nb] = pair - nw;
        fitApi.onChange({ ...f, subs: { ...(f.subs ?? {}), [cellKey]: ws } });
      }
      return;
    }
    const rows = fitRows(f, wallA);
    const cs = fitCells(f, wallA, spaceHeight);
    const parts = id.split('-');
    const lower = parts[1] === 'inf', i = Number(parts[2]), j = Number(parts[3]);
    const wl = [...rows.lower], wu = [...rows.upper];
    const row = lower ? wl : wu;
    const lc = cs.lower.map(c => [...c]), uc = cs.upper.map(c => [...c]);
    const idOf = (low: boolean, a: number, b: number) => `fit-${low ? 'inf' : 'sup'}-${a}-${b}`;
    // cada cuerpo de una columna con varios cuerpos tiene su ancho propio: uno más angosto que la columna solo cambia ese cuerpo;
    // uno más ancho ensancha la columna y deja los demás con el ancho que ya tenían
    let cellWNext = f.cellW;
    if (patch.width != null && (lower ? cs.lower : cs.upper)[i]?.length > 1 && !fitLocked(id, 'w')) {
      const colW = row[i];
      const cw = { ...(f.cellW ?? {}) };
      if (patch.width <= colW + 0.5) { cw[id] = Math.max(15, Math.round(patch.width)); fitApi.onChange({ ...f, cellW: cw }); return; }
      (lower ? cs.lower : cs.upper)[i].forEach((_, k) => { const kid = idOf(lower, i, k); if (kid !== id && cw[kid] === undefined) cw[kid] = colW; });
      delete cw[id];
      cellWNext = cw;
    }
    if (patch.width != null && row.length === 1 && lower && f.mueble) {
      // baño con un solo cuerpo: el ancho que se pide es el ancho del mueble
      const m0 = f.mueble, nw = Math.max(200, Math.min(wallA, Math.round(patch.width)));
      // estirar por la izquierda mueve el borde izquierdo (el mueble crece hacia el muro de ese lado); por la derecha crece hacia el otro
      const x0n = side === 'l' ? Math.max(0, m0.x0 - (nw - m0.ancho)) : m0.x0;
      fitApi.onChange({ ...f, cellW: cellWNext, mueble: { x0: x0n, ancho: Math.min(nw, wallA - x0n) } });
      return;
    }
    if (patch.width != null && row.length > 1) {
      // el ancho se reparte con el vecino que no tenga candado; si el cuerpo o todos sus vecinos están bloqueados, no cambia
      const nb = (side === 'l' ? [i - 1] : side === 'r' ? [i + 1] : [i + 1, i - 1]).find(n => n >= 0 && n < row.length && !fitLocked(idOf(lower, n, 0), 'w'));
      if (nb === undefined || fitLocked(idOf(lower, i, 0), 'w')) return;
      const total = row[i] + row[nb];
      const wi = Math.min(Math.max(patch.width, 15), total - 15);
      row[i] = wi; row[nb] = total - wi;
    }
    if (patch.height != null) {
      const cells = lower ? lc : uc;
      const c = cells[i];
      if (fitLocked(idOf(lower, i, j), 'h')) return;
      if (c.length > 1) {
        const nb = [j + 1, j - 1].find(n => n >= 0 && n < c.length && !fitLocked(idOf(lower, i, n), 'h'));
        if (nb === undefined) return;
        const sj = c[j] < 0 ? -1 : 1, sn = c[nb] < 0 ? -1 : 1;
        const total = Math.abs(c[j]) + Math.abs(c[nb]);
        const nj = Math.min(Math.max(patch.height, 15), total - 15);
        c[j] = sj * nj; c[nb] = sn * (total - nj);
      } else if (!lower) {
        c[0] = (c[0] < 0 ? -1 : 1) * Math.min(Math.max(patch.height, 15), cs.Hf - 300);
      } else if (rows.upper.length > 0) {
        // el alto de un cuerpo de abajo lo definen los cuerpos de arriba que le quedan encima
        const a0 = rows.lower.slice(0, i).reduce((a, b) => a + b, 0), b0 = a0 + rows.lower[i];
        let acc = 0;
        const nh = Math.min(Math.max(cs.Hf - cs.base - patch.height, 15), cs.Hf - 300);
        rows.upper.forEach((w, k) => { if (Math.min(b0, acc + w) - Math.max(a0, acc) > 0.5) uc[k] = [(uc[k][0] < 0 ? -1 : 1) * nh]; acc += w; });
      } else if (f.altoMueble && f.altoMueble > 0) {
        // baño sin cuerpos arriba: el alto del cuerpo es el alto del mueble
        fitApi.onChange({ ...f, altoMueble: Math.max(150, Math.min(1500, Math.round(patch.height))) });
        return;
      }
    }
    fitApi.onChange({ ...f, cellW: cellWNext, lowerW: wl, lowerBodies: wl.length, lowerCells: lc, upperW: wu, upperBodies: wu.length, upperCells: uc });
  };
  // Igualar dos o tres cuerpos (shift + clic en cada uno): en la misma fila quedan del mismo ancho y en la misma columna de la misma altura.
  // Las medidas se mantienen en múltiplos de 5 mm: si no se puede quedar exacto, la diferencia la absorbe otro cuerpo sin candado que no esté elegido, o si no hay, los elegidos se ajustan de 5 en 5 mm.
  const fitEqualizeMany = (ids: string[]): string => {
    if (!fitApi || ids.length < 2) return '';
    if (ids.some(i => !i.startsWith('fit-'))) return 'Igualar medidas solo funciona en el muro A por ahora';
    if (ids.some(i => /-s\d+$/.test(i))) return 'Igualar no funciona con cuerpos divididos; usa sus notas de medidas';
    const f = fitApi.fit;
    const rows = fitRows(f, wallA);
    const cs = fitCells(f, wallA, spaceHeight);
    const parts = ids.map(i => i.split('-'));
    if (parts.some(p => p[1] !== parts[0][1])) return 'Deben estar en la misma fila o columna';
    const lower = parts[0][1] === 'inf';
    const wl = [...rows.lower], wu = [...rows.upper];
    const lc = cs.lower.map(c => [...c]), uc = cs.upper.map(c => [...c]);
    const idOf = (a: number, b: number) => `fit-${lower ? 'inf' : 'sup'}-${a}-${b}`;
    const floor5 = (v: number) => Math.floor(v / 5) * 5;
    const cols = parts.map(p => Number(p[2])), cellsJ = parts.map(p => Number(p[3]));
    const sameRow = new Set(cols).size === ids.length;
    const sameCol = new Set(cols).size === 1 && new Set(cellsJ).size === ids.length;
    if (sameRow) {
      const row = lower ? wl : wu;
      if (cols.some(c => fitLocked(idOf(c, 0), 'w'))) return 'Una de las medidas tiene candado';
      const S = cols.reduce((a, c) => a + row[c], 0);
      const t = floor5(S / cols.length);
      let r = S - t * cols.length;
      cols.forEach(c => { row[c] = t; });
      const mid = cols.reduce((a, c) => a + c, 0) / cols.length;
      const third = row.map((_, k) => k).filter(k => !cols.includes(k) && !fitLocked(idOf(k, 0), 'w')).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
      if (third !== undefined) row[third] += r;
      else { for (let n = cols.length - 1; n >= 0 && r >= 5; n--) { row[cols[n]] += 5; r -= 5; } row[cols[cols.length - 1]] += r; }
    } else if (sameCol) {
      const c = (lower ? lc : uc)[cols[0]];
      if (cellsJ.some(j => fitLocked(idOf(cols[0], j), 'h'))) return 'Una de las medidas tiene candado';
      const S = cellsJ.reduce((a, j) => a + Math.abs(c[j]), 0);
      const t = floor5(S / cellsJ.length);
      let r = S - t * cellsJ.length;
      const sg = cellsJ.map(j => (c[j] < 0 ? -1 : 1));
      cellsJ.forEach((j, n) => { c[j] = sg[n] * t; });
      const mid = cellsJ.reduce((a, j) => a + j, 0) / cellsJ.length;
      const third = c.map((_, k) => k).filter(k => !cellsJ.includes(k) && !fitLocked(idOf(cols[0], k), 'h')).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
      if (third !== undefined) c[third] = (c[third] < 0 ? -1 : 1) * (Math.abs(c[third]) + r);
      else { for (let n = cellsJ.length - 1; n >= 0 && r >= 5; n--) { c[cellsJ[n]] += sg[n] * 5; r -= 5; } const lj = cellsJ[cellsJ.length - 1]; c[lj] += sg[sg.length - 1] * r; }
    } else return 'Deben estar en la misma fila o columna';
    fitApi.onChange({ ...f, lowerW: wl, lowerBodies: wl.length, lowerCells: lc, upperW: wu, upperBodies: wu.length, upperCells: uc });
    return 'Cuerpos igualados';
  };
  const [isoHidden, setIsoHidden] = useState<string[]>([]); // piezas ocultadas con clic sostenido mientras el módulo está aislado
  const isoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isoSel, setIsoSel] = useState<string | null>(null);
  const [dimGuide, setDimGuide] = useState<{ id: string; k: 'w' | 'h' } | null>(null); // línea guía de la medida que se va a cambiar en la nota de un cubo
  const [puertaSel, setPuertaSel] = useState(false); // Puertas: la puerta seleccionada muestra las flechas del vano // pieza del módulo aislado con sus flechas
  // sanitario y espejo del baño son solo ambientación: se ven translúcidos, no se pueden seleccionar y no son piezas del mueble
  const isAmb = (n: string) => n === 'Espejo bano' || n.startsWith('Sanitario');
  // el zócalo del cubo (escalera) se ve translúcido mientras no se convierte a módulos
  const zocGhost = (n: string) => (n === 'Zócalo largero fit' || n === 'Zócalo travesaño fit') && !!fitApi && !fitApi.fit.converted;
  const [fitIsolate, setFitIsolate] = useState<string | null>(null); // triple clic: el módulo se aísla para editarlo; al aplicar vuelve al ensamble general
  const [fitForm, setFitForm] = useState<string | null>(null); // cuerpo del Closet fit con el formulario (marco puerta / surrón) abierto
  const [fitMulti, setFitMulti] = useState<string[]>([]); // cuerpos elegidos con shift + clic para igualarlos (se pintan como el seleccionado)
  // Clic derecho sobre un cubo del Closet fit / baño: el cubo se convierte en un espacio libre (como el espacio bajo un mueble flotado); clic derecho sobre un espacio lo vuelve cubo
  const fitToggleGap = (id: string) => {
    if (!fitApi || !id.startsWith('fit-') || /-s\d+$/.test(id)) return; // las partes de un cuerpo dividido se quitan con su X
    const f = fitApi.fit;
    const rows = fitRows(f, wallA);
    const cs = fitCells(f, wallA, spaceHeight);
    const parts = id.split('-');
    const lower = parts[1] === 'inf', i = Number(parts[2]), j = Number(parts[3]);
    const lc = cs.lower.map(c => [...c]), uc = cs.upper.map(c => [...c]);
    const cells = (lower ? lc : uc)[i];
    if (!cells || cells[j] === undefined) return;
    cells[j] = -cells[j];
    setFitSel(null);
    fitApi.onChange({ ...f, lowerW: [...rows.lower], lowerBodies: rows.lower.length, lowerCells: lc, upperW: [...rows.upper], upperBodies: rows.upper.length, upperCells: uc });
  };
  const [fitAsk, setFitAsk] = useState<{ ids: string[]; dim: 'ancho' | 'alto' } | null>(null);
  const [fitCopySrc, setFitCopySrc] = useState<string | null>(null); // cuerpo cuyo módulo se copia con alt + clic // pregunta antes de igualar
  const [fitMsg, setFitMsg] = useState<Record<string, string>>({}); // letreros pequeños sobre los cuerpos al igualar
  const [doorsGhost, setDoorsGhost] = useState(true); // puertas del closet translúcidas
  const [cajoneroSel, setCajoneroSel] = useState<0 | 1 | 2>(0); // cajonero seleccionado con un clic: muestra la flecha para estirar su fondo
  const [closetSection, setClosetSection] = useState<{ section: string; idx?: 1 | 2; pos: [number, number, number] } | null>(null); // sección del closet con su formulario abierto
  const [contextId, setContextId] = useState<string | null>(null); // módulo con el formulario del clic derecho abierto
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const [editingCounter, setEditingCounter] = useState<string | null>(null);
  const [measures, setMeasures] = useState<Measure[]>([]);
  // Módulo bajo el cursor mientras se arrastra una manija: su cara es la referencia del estiramiento
  const hoverRef = useRef<{ id: string; point: THREE.Vector3 } | null>(null);
  // Al salir de la cinta se borran las mediciones, y mientras se mide no hay selección
  useEffect(() => {
    if (!measureMode) setMeasures([]);
    else { setSelectedId(null); setEditingId(null); setSelectedCounter(null); setEditingCounter(null); setCajoneroSel(0); setClosetSection(null); }
  }, [measureMode]);
  // Qué se dibuja. Lo que se oculta se lleva sus herramientas: etiquetas de medida, botones X y +, flechas dobles y cotas.
  const vis = visibility ?? { upper: true, lower: true, counter: true, appliances: true };
  // Aislamiento de un módulo del Closet fit: solo se dibujan los muros, el cuerpo y sus piezas reales
  const wallHidden = (w: string | undefined) => (w === 'A' && vis.wallA === false) || (w === 'B' && vis.wallB === false) || (w === 'C' && vis.wallC === false);
  // puertas: chips Hoja, Marco y Tapaluz para ocultar o mostrar cada grupo de piezas
  const puertaHidden = (n: string) => (vis.hoja === false && (n.startsWith('Hoja ') || n === 'Chapa puerta')) || (vis.marco === false && (n === 'Marco puerta' || n === 'Batiente puerta' || n === 'Marco cabezal puerta' || n === 'Dilatada puerta')) || (vis.tapaluz === false && n === 'Tapaluz puerta');
  const vBoxes0 = useMemo(() => {
    if (!fitIsolate || !fitApi) return fitApi && (vis.wallA === false || vis.wallB === false || vis.wallC === false) ? boxes.filter(x => !wallHidden(x.wall)) : boxes;
    const body = boxes.find(x => x.id === fitIsolate);
    if (!body) return boxes;
    const cfgI = fitApi.fit.bodies?.[fitIsolate];
    const parts = cfgI ? fitBodyParts(cfgI, fitIsolate, body.x, body.z, body.sx, body.sz, body.sy, true) : [];
    const pa = fitApi.fit.pieceAdj;
    return [body, ...parts.filter(p => !isoHidden.includes(p.id)).map(p => (pa?.[p.id] ? { ...p, ...pa[p.id] } : p))]; // sin muros: solo el cuerpo y sus piezas (con sus ajustes manuales)
  }, [boxes, fitIsolate, fitApi, isoHidden, vis.wallA, vis.wallB, vis.wallC]);
  const vBoxes = useMemo(() => (vis.hoja === false || vis.marco === false || vis.tapaluz === false ? vBoxes0.filter(b => !puertaHidden(b.name)) : vBoxes0), [vBoxes0, vis.hoja, vis.marco, vis.tapaluz]);
  useEffect(() => {
    if (!fitIsolate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (isoSel) { setIsoSel(null); return; } setFitIsolate(null); setFitForm(null); setIsoHidden([]); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitIsolate, isoSel]);
  useEffect(() => { if (!fitIsolate) setIsoSel(null); }, [fitIsolate]);
  // Con las dimensiones ocultas, al arrastrar una flecha aparecen 2 segundos las notas de los cuerpos que cambian de medida (por si se quieren editar)
  const [dimFlash, setDimFlash] = useState<string[]>([]);
  const prevSizes = useRef<Record<string, string>>({});
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDimsSoon = () => { if (dimTimer.current) clearTimeout(dimTimer.current); dimTimer.current = setTimeout(() => setDimFlash([]), 2000); };
  useEffect(() => {
    if (!fitApi) return;
    const cur: Record<string, string> = {};
    const changed: string[] = [];
    boxes.forEach(b => {
      if (!b.name.startsWith('Cuerpo ')) return;
      const k = `${Math.round(b.sx)}x${Math.round(b.sz)}`;
      cur[b.id] = k;
      if (prevSizes.current[b.id] && prevSizes.current[b.id] !== k) changed.push(b.id);
    });
    prevSizes.current = cur;
    if (changed.length && vis.dims === false) { setDimFlash(prev => Array.from(new Set([...prev, ...changed]))); hideDimsSoon(); }
  }, [boxes]);
  modules = modules.filter(m => (m.type === 'UPPER' ? vis.upper : m.type === 'LOWER' ? vis.lower : true));
  // Electrodoméstico que se está arrastrando (datos del momento en que se agarró)
  const [dragApp, setDragApp] = useState<ApplianceDrag | null>(null);
  const wallThickness = (wallThickMm ?? 150) / 1000; // espesor del muro (por defecto 150 mm)
  const closureThickness = 0.12;
  const closureDepth = 0.6; // 60cm de profundidad
  const fridge = appliances.find(a => a.active && a.type === 'fridge');
  const zh = hasZocalo ? zocaloHeight / 1000 : 0;

  const offsetX = -wallA / 2000;
  const offsetZ = -0.3;

  // Convierte coordenadas de la lista de cajas (mm; X a lo largo del muro A, Y profundidad) a la escena (m)
  const toWorldXZ = (X: number, Y: number): [number, number] => [(X - wallA / 2) / 1000, offsetZ + Y / 1000];
  // Esquinas de todas las cajas (en la escena, metros): puntos a los que se pega la cinta métrica
  const measureCorners = useMemo(() => {
    const out: THREE.Vector3[] = [];
    boxes.forEach(b => {
      // piezas ocultas con los botones de vista (puertas, entrepaños, cajonero, costado) no cuentan
      if (b.kind === 'panel') {
        const sec = closetSectionOf(b.name);
        if (isClosetDoor(b.name) && vis.doors === false) return;
        if (vis.shelves === false && (sec === 'entrepanos' || sec === 'torre')) return;
        if (vis.cajonero === false && sec === 'cajonero') return;
        if (vis.costado === false && sec === 'costado') return;
      }
      for (const X of [b.x, b.x + b.sx]) for (const Y of [b.y, b.y + b.sy]) for (const Z of [b.z, b.z + b.sz]) {
        out.push(new THREE.Vector3((X - wallA / 2) / 1000, Z / 1000, offsetZ + Y / 1000));
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, wallA, vis.doors, vis.shelves, vis.cajonero, vis.costado]);
  const boxCenter = (b: Box): [number, number, number] => {
    const [x, z] = toWorldXZ(b.x + b.sx / 2, b.y + b.sy / 2);
    return [x, (b.z + b.sz / 2) / 1000, z];
  };

  const baseWidth = wallA / 1000 + ((hasLeftClosure || hasRightClosure) ? (closureThickness * 2.5) : 0);
  const baseDepth = viewMode === 'plan' ? wallThickness : 1.5;

  // Encuadre de las vistas ortogonales (Planta y Frontal)
  const isOrtho = viewMode === 'plan' || viewMode === 'frontal';
  const bounds = boxesBounds(boxes);
  const [slabX, slabZ] = toWorldXZ((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const slabW = (bounds.maxX - bounds.minX) / 1000;
  const slabD = (bounds.maxY - bounds.minY) / 1000;
  const [planCx, planCz] = toWorldXZ((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  // Las cotas de los electrodomésticos van por fuera de los muros: la planta deja espacio para sus filas
  // y las medidas de los muros van una fila más afuera
  const dimExtra = viewMode === 'plan'
    ? (DIM_BASE_OFFSET + Math.max(1, dimensionRows(appliances.filter(a => a.active))) * DIM_ROW_SPACING + 450) / 1000 : 0;
  const planFrame: ViewFrame = { cx: planCx, cy: 0, cz: planCz, w: (bounds.maxX - bounds.minX) / 1000 + 0.8 + 2 * dimExtra, h: (bounds.maxY - bounds.minY) / 1000 + 0.8 + 2 * dimExtra };
  // con cotas de puntos bajo el piso (muro A), el encuadre de la frontal baja para que se lean completas
  const extraCotas = visibility?.puntos !== false && puntos.some(p => p.wall === 'A') ? 1.1 : 0;
  const frontalFrame: ViewFrame = { cx: 0, cy: spaceHeight / 2000 - extraCotas / 2, cz: 0, w: baseWidth + 0.8, h: spaceHeight / 1000 + 0.6 + extraCotas };

  // Calcular junctions (uniones entre módulos adyacentes)
  // Formato: { leftModule, rightModule, leftId, rightId, wall }
  const junctions: { leftModule: KitchenModule; rightModule: KitchenModule; leftId: string; rightId: string; wall: WallName | 'Island' }[] = [];

  // Agrupar módulos por muro y tipo (UPPER o LOWER)
  const modulesByWallAndType: Record<string, KitchenModule[]> = {};
  modules.forEach(m => {
    const key = `${m.wall}${m.islandId ? ':' + m.islandId : ''}-${m.type}`;
    if (!modulesByWallAndType[key]) modulesByWallAndType[key] = [];
    modulesByWallAndType[key].push(m);
    // El brazo de un esquinero en L cuenta como un módulo más del brazo: así tiene su unión con el siguiente módulo
    if (m.cornerArm) {
      const armKey = `${m.cornerArm.wall}-${m.type}`;
      if (!modulesByWallAndType[armKey]) modulesByWallAndType[armKey] = [];
      modulesByWallAndType[armKey].push({ ...m, uniqueId: `${m.uniqueId}:arm`, wall: m.cornerArm.wall, positionX: m.cornerArm.positionX ?? 0, width: m.cornerArm.width, depth: m.cornerArm.depth, cornerArm: undefined });
    }
  });

  // Para cada grupo, detectar módulos adyacentes
  Object.entries(modulesByWallAndType).forEach(([key, mods]) => {
    const wall = mods[0].wall;
    const sortedMods = [...mods].sort((a, b) => a.positionX - b.positionX);

    for (let i = 0; i < sortedMods.length - 1; i++) {
      const left = sortedMods[i];
      const right = sortedMods[i + 1];

      // Si la posición final del módulo izquierdo coincide con la posición inicial del derecho (tolerancia 1mm)
      if (Math.abs((left.positionX + left.width) - right.positionX) < 1) {
        junctions.push({
          leftModule: left,
          rightModule: right,
          leftId: left.uniqueId,
          rightId: right.uniqueId,
          wall
        });
      }
    }
  });

  return (
    // z-0 + isolate crean un contexto de apilamiento propio: las capas altas de los controles Html (hasta 100)
    // quedan contenidas dentro de la escena y no se pintan por encima de los paneles de herramientas (z-45).
    <div className="absolute inset-0 z-0 isolate overflow-hidden bg-slate-100">
      {fitApi && fitForm && boxes.some(x => x.id === fitForm) && (
        <FitBodyForm
          key={fitForm}
          label={`${boxes.find(x => x.id === fitForm)?.name ?? 'Cuerpo'} · ${Math.round(boxes.find(x => x.id === fitForm)?.sx ?? 0)} × ${Math.round(boxes.find(x => x.id === fitForm)?.sz ?? 0)}`}
          cfg={fitApi.fit.bodies?.[fitForm]}
          onChange={(c) => { const bodies = { ...(fitApi.fit.bodies ?? {}) }; if (c) bodies[fitForm] = c; else delete bodies[fitForm]; fitApi.onChange({ ...fitApi.fit, bodies }); }}
          onClose={() => { setFitForm(null); setFitIsolate(null); setIsoHidden([]); }}
          suggestedMaletero={(() => { const bb = boxes.find(x => x.id === fitForm); return bb ? Math.max(350, Math.round((bb.z + bb.sz - Math.min(1900, bb.z + bb.sz - 350)) / 5) * 5) : 350; })()} /* distancia sugerida: deja el maletero a la menor de 1900 mm o (tope − 350 mm) */
          fondo={boxes.find(x => x.id === fitForm)?.sy}
          desde={boxes.find(x => x.id === fitForm)?.z}
          onDesde={(n) => { const bb = boxes.find(x => x.id === fitForm); if (bb) fitMoveV(bb.id, n - bb.z); }}
          onFondo={(n) => { const fid = fitForm!; fitApi.onChange({ ...fitApi.fit, cellD: { ...(fitApi.fit.cellD ?? {}), [fid]: n } }); }}
          hiddenCount={isoHidden.length}
          onShowAll={() => setIsoHidden([])}
        />
      )}
      <Canvas
        shadows
        camera={{ position: [5, 4, 5], fov: 45 }}
        onPointerMissed={(e) => {
          // Un clic en vacío deselecciona; los clics sobre los controles HTML (editor, flechas) no cuentan
          if ((e.target as HTMLElement | null)?.closest?.('[data-overlay]')) return;
          setSelectedId(null);
          setEditingId(null);
          setContextId(null);
          setPuertaSel(false);
          setClosetSection(null);
          setCajoneroSel(0);
          setFitSel(null);
          setSelectedCounter(null);
          setEditingCounter(null);
          setPair([]);
        }}
      >
        {isOrtho
          ? <OrthographicCamera makeDefault position={[0, 10, 0]} near={0.1} far={100} />
          : <PerspectiveCamera makeDefault position={[5, 4, 5]} fov={45} />}
        <ambientLight intensity={0.6} /><directionalLight position={[5, 10, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} /><Environment preset="apartment" /><CameraController viewMode={viewMode} plan={planFrame} frontal={frontalFrame} />
        {/* Planta: con puntos de adecuación visibles, sus cotas desde el 0 (con el nombre del electrodoméstico) reemplazan las cotas
            de los electrodomésticos y la del muro; sin puntos queda la cota del muro (editable con un clic) */}
        {viewMode === 'plan' && !(vis.puntos !== false && puntos.length > 0) && <WallDimensions layout={layout} lArm={lArm} appliances={[]} wallA={wallA} wallB={wallB} wallC={wallC} offsetZ={offsetZ} onEditWall={onEditWall} />}
        <ApplianceDragController
          drag={dragApp} layout={layout} lArm={lArm} wallA={wallA} wallB={wallB} wallC={wallC} offsetZ={offsetZ} controlsRef={controlsRef}
          onMove={(type, wall, distance) => onMoveAppliance?.(type, wall, distance)}
          onEnd={() => setDragApp(null)}
        />

        {/* Piso y techo con la misma huella que los muros (recta, L o U). En planta no se dibujan: se veían como
            una franja gris de más pegada al muro A. */}
        {viewMode !== 'plan' && (
          <>
            <mesh position={[slabX, -0.06, slabZ]} receiveShadow>
              <boxGeometry args={[slabW, 0.12, slabD]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
              {viewMode !== 'frontal' && <Edges color="#cbd5e1" />}
            </mesh>
            {/* El techo es translúcido: no tapa las herramientas y medidas (no cuenta al ocultar lo que no se ve). En la vista frontal no se dibuja: solo sumaba líneas */}
            {viewMode !== 'frontal' && (
              // solo el contorno: con relleno blanco translúcido, sobre los muebles altos (la sobrenevera) parecía una tabla flotando encima
              <mesh position={[slabX, spaceHeight / 1000 + 0.06, slabZ]} raycast={() => null}>
                <boxGeometry args={[slabW, 0.12, slabD]} />
                <meshBasicMaterial visible={false} />
                <Edges color="#cbd5e1" />
              </mesh>
            )}
          </>
        )}

        {vBoxes.filter(b => b.kind === 'wall').map(b => (
          <mesh key={b.id} position={boxCenter(b)} castShadow receiveShadow
            {...(closetForm && !measureMode ? { onDoubleClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setClosetSection({ section: 'muro', pos: [e.point.x, e.point.y, e.point.z] }); } } : {})}>
            <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
            <meshStandardMaterial
              color={viewMode === 'plan' ? '#64748b' : (b.id.startsWith('closure') ? '#e2e8f0' : (b.wall === 'A' ? '#ffffff' : '#f8fafc'))}
              opacity={viewMode === 'plan' ? 0.6 : b.name === 'Muro vano' ? 0.3 : 1}
              transparent={viewMode === 'plan' || b.name === 'Muro vano'}
              depthWrite={b.name !== 'Muro vano'}
            />
            {viewMode !== 'frontal' && <Edges color={viewMode === 'plan' ? '#1e293b' : '#94a3b8'} linewidth={viewMode === 'plan' ? 2 : 1} />}
          </mesh>
        ))}

        {/* Piezas de los módulos convertidos: laterales, base, techo, puentes, amarres, espaldar y entrepaños */}
        {vBoxes.filter(b => b.kind === 'panel' && !(b.name === 'Cubo closet fit' && (fitApi?.fit.altoMueble ?? 0) > 0) && !(viewMode === 'frontal' && (b.name.startsWith('Cajón ') || b.name.startsWith('Puente') || b.name === 'Zócalo travesaño fit' || b.id === 'fit-zoc-lb')) && !((vis.shelves === false && (closetSectionOf(b.name) === 'entrepanos' || closetSectionOf(b.name) === 'torre')) || (vis.cajonero === false && closetSectionOf(b.name) === 'cajonero') || (vis.costado === false && closetSectionOf(b.name) === 'costado')) && (isClosetDoor(b.name) ? vis.doors !== false : (b.id.startsWith('panel-upper-') ? vis.upper : vis.lower))).map(b => (
          <mesh
            key={b.id}
            position={boxCenter(b)}
            castShadow={viewMode !== 'frontal' && !isFitBody(b.name)}
            receiveShadow={viewMode !== 'frontal' && !isFitBody(b.name)}
            {...(fitApi && !measureMode && (b.name.startsWith('Cuerpo ') || b.name.startsWith('Hueco ')) ? {
              onDoubleClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (b.name.startsWith('Cuerpo ')) setFitForm(b.id); },
              onContextMenu: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); (e.nativeEvent as MouseEvent | undefined)?.preventDefault?.(); fitToggleGap(b.id); },
              onClick: (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                if ((e.nativeEvent as MouseEvent | undefined)?.detail === 3 && b.name.startsWith('Cuerpo ')) { setFitIsolate(b.id); setFitForm(b.id); setFitSel(b.id); return; } // triple clic: aislar el módulo
                const shift = (e as any).shiftKey || (e.nativeEvent as MouseEvent | undefined)?.shiftKey;
                const alt = (e as any).altKey || (e.nativeEvent as MouseEvent | undefined)?.altKey;
                if (alt && b.name.startsWith('Cuerpo ')) {
                  // alt + clic: copia las características del módulo (no las medidas). El primero con módulo es el origen; los siguientes reciben una copia
                  const flash = (m: string) => { setFitMsg({ [b.id]: m }); setTimeout(() => setFitMsg({}), 2500); };
                  if (!fitCopySrc || fitCopySrc === b.id) {
                    if (fitApi.fit.bodies?.[b.id]) setFitCopySrc(fitCopySrc === b.id ? null : b.id); else flash('Este cuerpo no tiene módulo para copiar');
                  } else {
                    const src = fitApi.fit.bodies?.[fitCopySrc];
                    if (src) { fitApi.onChange({ ...fitApi.fit, bodies: { ...(fitApi.fit.bodies ?? {}), [b.id]: JSON.parse(JSON.stringify(src)) } }); flash('= Copiado'); }
                  }
                  setFitSel(b.id);
                  return;
                }
                if (fitCopySrc) setFitCopySrc(null);
                if (shift && b.name.startsWith('Cuerpo ')) {
                  // shift + clic en dos o tres cuerpos: se pintan como el seleccionado y se pregunta si se igualan
                  const next = fitMulti.includes(b.id) ? fitMulti.filter(i => i !== b.id) : [...fitMulti, b.id].slice(-3);
                  setFitMulti(next); setFitAsk(null);
                  if (next.length >= 2) {
                    const ps = next.map(i => i.split('-'));
                    const bs = next.map(i => boxes.find(x => x.id === i)!);
                    const flash = (m: string) => { setFitMsg({ [b.id]: m }); setTimeout(() => setFitMsg({}), 2500); };
                    let dim: 'ancho' | 'alto' | null = null, msg = '';
                    if (ps.some(q => q[1] !== ps[0][1])) msg = 'Deben estar en la misma fila o columna';
                    else if (new Set(ps.map(q => q[2])).size === next.length) {
                      if (bs.every(x => Math.abs(x.sx - bs[0].sx) < 1)) msg = 'El ancho ya es igual'; else dim = 'ancho';
                    } else if (new Set(ps.map(q => q[2])).size === 1 && new Set(ps.map(q => q[3])).size === next.length) {
                      if (bs.every(x => Math.abs(x.sz - bs[0].sz) < 1)) msg = 'El alto ya es igual'; else dim = 'alto';
                    } else msg = 'Deben estar en la misma fila o columna';
                    if (dim) setFitAsk({ ids: next, dim }); else flash(msg);
                  }
                } else { setFitMulti([]); setFitAsk(null); }
                setFitSel(b.id);
              },
              onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
              onPointerOut: () => { document.body.style.cursor = 'auto'; },
            } : fitApi && b.name === 'Cubo closet fit' ? { raycast: () => null } : {})}
            {...(closetForm && !measureMode && closetSectionOf(b.name) ? {
              onDoubleClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setClosetSection({ section: closetSectionOf(b.name)!, idx: closetSectionOf(b.name) === 'torre' ? closetTorreIndex(b.name) : closetCajoneroIndex(b.name), pos: [boxCenter(b)[0], (closetSectionOf(b.name) === 'costado' || closetSectionOf(b.name) === 'puertas' || closetSectionOf(b.name) === 'torre') ? (b.z + b.sz * 0.5) / 1000 : (b.z + b.sz) / 1000 + 0.05, boxCenter(b)[2]] }); },
              onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setCajoneroSel(closetSectionOf(b.name) === 'cajonero' ? closetCajoneroIndex(b.name) : 0); },
              onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
              onPointerOut: () => { document.body.style.cursor = 'auto'; },
            } : closetForm ? {} : puertaApi && b.id.startsWith('puerta-') ? {
              // puerta: un clic muestra las flechas del vano; doble clic abre el formulario
              onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if ((e.nativeEvent as MouseEvent).detail >= 2) return; setPuertaSel(true); },
              onDoubleClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setPuertaSel(false); puertaApi.onOpenForm(); },
              onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
              onPointerOut: () => { document.body.style.cursor = 'auto'; },
            } : fitApi && (b.name.startsWith('Cuerpo ') || b.name.startsWith('Hueco ')) ? {} : fitIsolate && b.id.startsWith(fitIsolate + '-') ? {} : (b.name === 'Puerta rep fit' || b.name === 'Puerta fit') && fitApi && !measureMode ? {} : { raycast: () => null })}
            {...((b.name === 'Puerta rep fit' || b.name === 'Puerta fit') && fitApi && !measureMode && !fitIsolate ? {
              // clic en una puerta: si su cuerpo está seleccionado cambia la abertura de esa puerta (bisagra izquierda, derecha o arriba); si no, selecciona el cuerpo
              onClick: (e: ThreeEvent<MouseEvent>) => {
                const ne = e.nativeEvent as MouseEvent | undefined;
                if (ne?.shiftKey || ne?.altKey) return; // shift y alt siguen siendo para igualar y copiar: pasan al cuerpo
                e.stopPropagation();
                const m = /^(.*)-pu(\d+)$/.exec(b.id);
                if (!m) return;
                if (ne?.detail === 3) { setFitIsolate(m[1]); setFitForm(m[1]); setFitSel(m[1]); return; }
                if (ne && ne.detail >= 2) return;
                const cfgP = fitApi.fit.bodies?.[m[1]];
                if (fitSel !== m[1] || !cfgP || cfgP.doorType === 'corredizas' || (cfgP.doorDir === 'horizontal' && (cfgP.doors ?? 1) <= 2)) { setFitSel(m[1]); return; }
                const k = Number(m[2]), n = Math.max(1, cfgP.doors ?? 1), cur = doorOpening(cfgP, k, n), next = cur === 'izq' ? 'der' : cur === 'der' ? 'sup' : 'izq';
                fitApi.onChange({ ...fitApi.fit, bodies: { ...(fitApi.fit.bodies ?? {}), [m[1]]: { ...cfgP, aberturas: { ...(cfgP.aberturas ?? {}), [k]: next } } } });
              },
              onDoubleClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const m = /^(.*)-pu(\d+)$/.exec(b.id); if (m) setFitForm(m[1]); },
              onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
              onPointerOut: () => { document.body.style.cursor = 'auto'; },
            } : {})}
            {...(fitIsolate && b.id.startsWith(fitIsolate + '-') ? {
              // clic sostenido sobre una pieza del módulo aislado: se oculta
              onPointerDown: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); if (isoTimer.current) clearTimeout(isoTimer.current); isoTimer.current = setTimeout(() => setIsoHidden(prev => (prev.includes(b.id) ? prev : [...prev, b.id])), 450); },
              onPointerUp: () => { if (isoTimer.current) clearTimeout(isoTimer.current); },
              onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if ((e.nativeEvent as MouseEvent).detail >= 2) return; setIsoSel(prev => (prev === b.id ? null : b.id)); }, // un clic: la pieza muestra sus flechas
              onPointerOut: () => { if (isoTimer.current) clearTimeout(isoTimer.current); document.body.style.cursor = 'auto'; },
              onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
            } : {})}
          >
            {b.face ? <FaceExtrude b={b} /> : <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />}
            <meshStandardMaterial color={isFitBody(b.name) ? (b.name === 'Cubo closet fit' ? '#bfdbfe' : fitCopySrc === b.id ? '#22c55e' : (fitSel === b.id || fitMulti.includes(b.id) || fitCopySrc === b.id) ? '#fb923c' : '#60a5fa') : b.name.startsWith('Sanitario') ? '#f8fafc' : isAmb(b.name) ? '#bae6fd' : b.name.startsWith('Espaldar') || b.name.includes('fondo') ? ((b.id.startsWith('panel-upper-') ? colores?.fondoMA : colores?.fondo) ?? '#e5e7eb') : isClosetDoor(b.name) ? '#cdb592' : (b.name.startsWith('Tubo') || b.name === 'Chapa puerta') ? '#9ca3af' : b.name === 'Televisor' ? '#111827' : colores && b.moduleId ? (/^(Visto|Pieza de dilatación|Dilatada)/.test(b.name) ? colores.fachada : b.id.startsWith('panel-upper-') ? colores.ma : /tall-/.test(b.moduleId) ? colores.otros : colores.mb) : b.name.startsWith('Entrepaño') ? '#f3e8d2' : (b.id.startsWith('panel-upper-') ? '#e8d3b0' : '#dcc5a0')} roughness={0.7} key={isFitBody(b.name) ? 'fit' : (doorsGhost && isClosetDoor(b.name)) || zocGhost(b.name) || isAmb(b.name) ? 'ghost' : 'solid'} transparent={isFitBody(b.name) || isAmb(b.name) || ((doorsGhost && isClosetDoor(b.name)) || zocGhost(b.name))} opacity={isFitBody(b.name) ? (b.name === 'Cubo closet fit' ? 0.08 : (fitApi?.fit.converted && fitApi.fit.bodies?.[b.id] && fitCopySrc !== b.id) ? 0.03 : b.name.startsWith('Hueco ') ? ((fitSel === b.id || fitMulti.includes(b.id) || fitCopySrc === b.id) ? 0.25 : 0.02) : (fitSel === b.id || fitMulti.includes(b.id) || fitCopySrc === b.id) ? 0.4 : 0.22) : isAmb(b.name) ? 0.5 : ((doorsGhost && isClosetDoor(b.name)) || zocGhost(b.name)) ? 0.25 : 1} depthWrite={!(isFitBody(b.name) || isAmb(b.name) || ((doorsGhost && isClosetDoor(b.name)) || zocGhost(b.name)))}  polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
            {isFitBody(b.name) && viewMode === 'frontal' ? (
              // En frontal solo se dibuja el contorno de la cara frontal (una línea), sin las aristas de profundidad que se ven dobles
              b.name !== 'Cubo closet fit' && (() => { const hw = b.sx / 2000, hh = b.sz / 2000, zf = b.sy / 2000 + 0.002; return (
                <Line points={[[-hw, -hh, zf], [hw, -hh, zf], [hw, hh, zf], [-hw, hh, zf], [-hw, -hh, zf]]} color={fitCopySrc === b.id ? '#16a34a' : (fitSel === b.id || fitMulti.includes(b.id) || fitCopySrc === b.id) ? '#f97316' : b.name.startsWith('Hueco ') ? '#cbd5e1' : '#2563eb'} lineWidth={1} />
              ); })()
            ) : (
            <Edges color={isFitBody(b.name) ? (fitCopySrc === b.id ? '#16a34a' : (fitSel === b.id || fitMulti.includes(b.id) || fitCopySrc === b.id) ? '#f97316' : b.name.startsWith('Hueco ') ? '#cbd5e1' : '#2563eb') : cajoneroSel !== 0 && closetSectionOf(b.name) === 'cajonero' && closetCajoneroIndex(b.name) === cajoneroSel ? '#ef4444' : b.moduleId && b.moduleId === selectedId ? '#ef4444' : (b.moduleId && pair.includes(b.moduleId) ? '#f59e0b' : '#5b4630')} linewidth={b.moduleId && (b.moduleId === selectedId || pair.includes(b.moduleId)) ? 3 : 1} />
            )}
            {isoSel === b.id && fitIsolate && <Edges color="#f97316" linewidth={3} />}
            {puertaSel && puertaApi && b.id.startsWith('puerta-') && b.name !== 'Chapa puerta' && <Edges color="#f97316" linewidth={2} />}
            {b.name.startsWith('Cuerpo ') && fitApi && !fitApi.fit.converted && viewMode !== 'plan' && (() => {
              // en cubos: una línea por cada entrepaño del surrón (al convertir salen las piezas reales)
              const c = fitApi.fit.bodies?.[b.id];
              const ns = c && c.kind === 'surron' && !(c.drawers && c.drawers > 0) ? Math.max(0, Math.round(c.shelves ?? 0)) : 0;
              if (ns === 0) return null;
              const E = 15, zh = c!.zocalo ? 80 : 0, zb = zh + E, zt = b.sz - E;
              const hw = b.sx / 2000, zf = b.sy / 2000 + 0.003;
              return Array.from({ length: ns }, (_, i) => {
                const yy = (zb + ((zt - zb) * (i + 1)) / (ns + 1) - b.sz / 2) / 1000;
                return <Line key={`shelf-${i}`} points={[[-hw + E / 1000, yy, zf], [hw - E / 1000, yy, zf]]} color="#a8896a" lineWidth={1} transparent opacity={0.5} raycast={() => null} />;
              });
            })()}
            {b.name.startsWith('Puerta abatible') && closetForm && (() => {
              const k = (Number(b.name.replace('Puerta abatible ', '').split(' ')[0]) || 1) - 1, N = closetForm.derived.doorCount;
              const op: 'izq' | 'der' = (closetForm.config.doorEdges?.[k]?.hinge ?? (k < N / 2 ? 'izq' : 'der'));
              return <SwingLines hw={b.sx / 2000} hh={b.sz / 2000} op={op} face="z+" depth={b.sy / 2000} />;
            })()}
            {(b.name === 'Puerta rep fit' || b.name === 'Puerta fit') && fitApi && (() => {
              // líneas de abertura (norma de dibujo de arquitectura): dos líneas segmentadas y suaves que convergen en el lado de la bisagra
              const m = /^(.*)-pu(\d+)$/.exec(b.id);
              const cfgD = m ? fitApi.fit.bodies?.[m[1]] : undefined;
              if (!m || !cfgD || cfgD.doorType === 'corredizas') return null;
              const k = Number(m[2]), n = Math.max(1, cfgD.doors ?? 1);
              const hw = b.sx / 2000, hh = b.sz / 2000, zf = b.sy / 2000 + 0.002;
              let pts: [number, number][];
              // el vértice queda en el borde libre (lado de la manija) y las líneas abren hacia las esquinas del lado de la bisagra
              if (cfgD.doorDir === 'horizontal' && n > 2) pts = [[-hw, hh], [0, -hh], [hw, hh]]; // más de 2 puertas con abertura horizontal: lado a lado, bisagra arriba y líneas en V
              else if (cfgD.doorDir === 'horizontal') pts = k < n - 1 || n === 1 ? [[-hw, hh], [0, -hh], [hw, hh]] : [[-hw, -hh], [0, hh], [hw, -hh]]; // arriba: bisagra arriba; la de abajo: bisagra abajo
              else { const op = doorOpening(cfgD, k, n); pts = op === 'sup' ? [[-hw, hh], [0, -hh], [hw, hh]] : op === 'izq' ? [[-hw, hh], [hw, 0], [-hw, -hh]] : [[hw, hh], [-hw, 0], [hw, -hh]]; } // la abertura simétrica por defecto o la que se cambió con un clic
              return <Line points={pts.map(([x, y]) => [x, y, zf] as [number, number, number])} color="#64748b" lineWidth={1} dashed dashSize={0.03} gapSize={0.025} transparent opacity={0.45} raycast={() => null} />;
            })()}
            {fitAsk && fitAsk.ids[fitAsk.ids.length - 1] === b.id && viewMode === 'frontal' && (
              <Html position={[0, b.sz / 2000 - 0.04, b.sy / 2000 + 0.01]} center occlude={false} zIndexRange={[80, 0]} style={{ pointerEvents: 'none' }}>
                <div data-overlay className="flex items-center gap-1 select-none whitespace-nowrap rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  <><span>¿Igualar {fitAsk.dim}?</span>
                  <button type="button" className="rounded bg-white/90 px-1 text-amber-700" onClick={() => { const ids = fitAsk.ids; const m = fitEqualizeMany(ids); const ok = m === 'Cuerpos igualados'; setFitMsg(Object.fromEntries((ok ? ids : [b.id]).map(i => [i, ok ? '= Igualados' : m]))); setTimeout(() => setFitMsg({}), 2500); setFitAsk(null); setFitMulti([]); }}>Sí</button></>
                  <button type="button" className="rounded bg-amber-700/60 px-1" onClick={() => { setFitAsk(null); setFitMulti([]); }}>No</button>
                </div>
              </Html>
            )}
            {((fitMulti.includes(b.id) && !fitAsk) || fitCopySrc === b.id || fitMsg[b.id]) && viewMode === 'frontal' && (
              <Html position={[0, b.sz / 2000 - 0.04, b.sy / 2000 + 0.01]} center occlude={false} zIndexRange={[70, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`select-none whitespace-nowrap rounded px-1.5 py-px text-[9px] font-black text-white shadow ${fitCopySrc === b.id && !fitMsg[b.id] ? 'bg-emerald-600' : 'bg-amber-500'}`}>{fitMsg[b.id] ?? (fitCopySrc === b.id ? '= copiar: alt + clic en otro' : '= igualar')}</div>
              </Html>
            )}
            {dimGuide && dimGuide.id === b.id && (() => {
              // línea guía: muestra en el cubo la medida que se va a modificar (vertical = alto, horizontal = ancho), con marcas a 45°
              const hw = b.sx / 2000, hh = b.sz / 2000, zg = b.sy / 2000 + 0.006, t = 0.018, G = '#4f46e5';
              const pts: [number, number, number][] = dimGuide.k === 'h' ? [[-hw + 0.05, -hh, zg], [-hw + 0.05, hh, zg]] : [[-hw, hh - 0.05, zg], [hw, hh - 0.05, zg]];
              const tk = (q: [number, number, number]): [number, number, number][] => [[q[0] - t, q[1] - t, zg], [q[0] + t, q[1] + t, zg]];
              return (
                <>
                  <Line points={pts} color={G} lineWidth={2} raycast={() => null} />
                  <Line points={tk(pts[0])} color={G} lineWidth={2} raycast={() => null} />
                  <Line points={tk(pts[1])} color={G} lineWidth={2} raycast={() => null} />
                  <Line points={[[-hw, -hh, zg], [hw, -hh, zg], [hw, hh, zg], [-hw, hh, zg], [-hw, -hh, zg]]} color={G} lineWidth={1} dashed dashSize={0.03} gapSize={0.02} transparent opacity={0.6} raycast={() => null} />
                </>
              );
            })()}
            {b.name.startsWith('Cuerpo ') && b.id.startsWith('fit-') && viewMode === 'frontal' && fitApi && (vis.dims !== false || dimFlash.includes(b.id)) && (
              <Html position={[0, 0, b.sy / 2000 + 0.01]} center occlude={false} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
                <FitDimLabel onGuide={(k) => setDimGuide(k ? { id: b.id, k } : null)} onHold={(on) => { if (on) { if (dimTimer.current) clearTimeout(dimTimer.current); } else if (vis.dims === false) hideDimsSoon(); }} w={b.sx} h={b.sz} lockW={fitLocked(b.id.replace(/-\d+$/, '-0'), 'w')} lockH={fitLocked(b.id, 'h')} onLock={(k) => { const key = k === 'w' ? b.id.replace(/-\d+$/, '-0') : b.id; setFitLocks(prev => ({ ...prev, [key]: { ...prev[key], [k]: !prev[key]?.[k] } })); }} canEditH={b.id.startsWith('fit-sup') || b.name.includes('.') || fitApi.fit.upperBodies > 0 || (fitApi.fit.altoMueble ?? 0) > 0} onCommit={(patch) => fitEdit(b.id, patch)} offset={fitLabelOff[b.id] ?? { x: 0, y: 0 }} onOffset={(o) => setFitLabelOff(prev => ({ ...prev, [b.id]: o }))} />
              </Html>
            )}
          </mesh>
        ))}

        {/* cotas de la vista frontal: del piso al borde de abajo del mueble (espacio al piso) y del piso a su borde de arriba (alto total del mueble) */}
        {!fitApi && viewMode === 'frontal' && !measureMode && (() => {
          // cotas técnicas del frontal para los productos que no son por cubos (cocinas, closet constructor, puertas): ancho general arriba y,
          // a la izquierda, la cadena de alturas (cada nivel donde empieza o termina una pieza del muro A) y el alto general; se mueven y miden como las del Closet fit
          const items = vBoxes.filter(b => b.wall === 'A' && !b.islandId && b.kind !== 'wall' && !b.name.startsWith('Chapa') && b.sx > 1 && b.sz > 1);
          if (!items.length) return null;
          const x0 = Math.min(...items.map(b => b.x)), x1 = Math.max(...items.map(b => b.x + b.sx)), zTop = Math.max(...items.map(b => b.z + b.sz));
          const zf = offsetZ + Math.max(...items.map(b => b.y + b.sy)) / 1000 + 0.01;
          const toXw = (X: number) => (X - wallA / 2) / 1000;
          const levels: number[] = [];
          // la cadena solo usa los cuerpos principales (zócalo, módulos bajos, mesón, aéreos, torres); las piezas sueltas (entrepaños, cajones) la llenarían de cotas
          const main = items.filter(b => b.kind === 'zocalo' || b.kind === 'lower' || b.kind === 'upper' || b.kind === 'tall' || b.kind === 'counter');
          [0, ...main.flatMap(b => [b.z, b.z + b.sz]), zTop].map(v => Math.round(v)).sort((a, b) => a - b).forEach(v => { if (!levels.length || v - levels[levels.length - 1] >= 20) levels.push(v); });
          const xl = toXw(x0);
          return (
            <>
              <MovableCota kind="h" from={toXw(x0)} to={toXw(x1)} at={(zTop + 120) / 1000} zf={zf} label={x1 - x0} ext={[zTop / 1000, 0]} controlsRef={controlsRef} />
              {/* alturas desde el punto 0 (el piso): una marca por cada nivel con su altura acumulada, como las cotas de los puntos;
                  la de arriba, el alto general, en azul */}
              {(() => {
                const xT = xl - 0.3, gris = '#334155';
                // arriba de todo, el alto del muro (techo); la última altura de los muebles es su alto total
                const muro = Math.round(spaceHeight);
                const alturas = muro > levels[levels.length - 1] + 1 ? [...levels, muro] : levels;
                const iMuebles = levels.length - 1, iMuro = alturas.length - 1;
                // alturas muy juntas (base, mesón, salpicadero, muebles y techo): cada número sube lo justo para no taparse con el de abajo
                const ys: number[] = [];
                alturas.forEach((z, k) => { ys.push(Math.max(z / 1000, k ? ys[k - 1] + 0.075 : -Infinity)); });
                return (
                  <group>
                    {/* punto 0: una sola diana (anillo, punto y cruz) en la esquina del muro A con el piso; de ahí salen las alturas y
                        las cotas de los puntos */}
                    <group position={[toXw(0), 0, zf + 0.002]}>
                      <mesh raycast={() => null} renderOrder={23}><ringGeometry args={[0.032, 0.042, 32]} /><meshBasicMaterial color="#0f172a" depthTest={false} transparent /></mesh>
                      <mesh raycast={() => null} renderOrder={23}><circleGeometry args={[0.012, 20]} /><meshBasicMaterial color="#0f172a" depthTest={false} transparent /></mesh>
                      <Line points={[[-0.06, 0, 0], [0.06, 0, 0]]} color="#0f172a" lineWidth={1} depthTest={false} renderOrder={23} raycast={() => null} />
                      <Line points={[[0, -0.06, 0], [0, 0.06, 0]]} color="#0f172a" lineWidth={1} depthTest={false} renderOrder={23} raycast={() => null} />
                    </group>
                    {alturas.map((z, k) => {
                      const total = k === iMuebles || k === iMuro;
                      const texto = k === iMuro && iMuro !== iMuebles ? `${z} muro` : k === iMuebles ? `${z} muebles` : `${z}`;
                      return (
                        <group key={`alt-${z}`}>
                          <Line points={[[xl, z / 1000, zf], [xT - 0.04, z / 1000, zf]]} color={gris} lineWidth={0.8} dashed={k > 0 && !total} dashSize={0.04} gapSize={0.03} depthTest={false} renderOrder={20} raycast={() => null} />
                          <Line points={[[xT - 0.03, z / 1000 - 0.03, zf], [xT + 0.03, z / 1000 + 0.03, zf]]} color={gris} lineWidth={2} depthTest={false} renderOrder={20} raycast={() => null} />
                          {ys[k] - z / 1000 > 0.01 && <Line points={[[xT - 0.04, z / 1000, zf], [xT - 0.09, ys[k], zf]]} color={gris} lineWidth={0.8} depthTest={false} renderOrder={20} raycast={() => null} />}
                          <Html position={[xT - 0.1, ys[k], zf]} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
                            <div style={{ transform: 'translate(-100%, -50%)', font: '800 11px system-ui', color: k === iMuro && iMuro !== iMuebles ? '#0f172a' : total ? '#4338ca' : '#0f172a', whiteSpace: 'nowrap' }}>{texto}</div>
                          </Html>
                        </group>
                      );
                    })}
                  </group>
                );
              })()}
            </>
          );
        })()}
        {fitApi && viewMode === 'frontal' && vis.dims !== false && !fitIsolate && vis.wallA !== false && (() => {
          const f = fitApi.fit;
          const cs = fitCells(f, wallA, spaceHeight);
          const col = cs.lower[0];
          if (!col || col.length === 0) return null;
          const base = cs.base, top = base + Math.abs(col[col.length - 1]);
          const xl = fitInsets(f, wallA).left;
          const zf = offsetZ + Math.max(200, f.depth) / 1000 + 0.003;
          const toXw = (X: number) => (X - wallA / 2) / 1000;
          const cota = (key: string, xmm: number, z0: number, z1: number, label: number, onEdit: (n: number) => void) => (
            <MovableCota key={key} kind="v" from={z0 / 1000} to={z1 / 1000} at={toXw(xmm)} zf={zf} label={label} ext={[toXw(xl), 0]} onEdit={onEdit} controlsRef={controlsRef} />
          );
          // editar la cota de abajo cambia el espacio al piso (flotado o zócalo); editar la de arriba cambia el alto del cuerpo de abajo (el resto se ajusta con su vecino)
          const editBase = (n: number) => { if (f.flotado?.on) fitApi.onChange({ ...f, flotado: { ...f.flotado, alto: Math.max(0, Math.min(1200, n)) } }); else if (f.zocalo?.on) fitApi.onChange({ ...f, zocalo: { ...f.zocalo, alto: Math.max(30, Math.min(300, n)) } }); };
          const editTop = (n: number) => fitEdit(`fit-inf-0-${col.length - 1}`, { height: Math.max(50, n - base) });
          // cotas generales: ancho total y alto total del conjunto de cuerpos (de borde a borde, desde el piso)
          const bodiesA = boxes.filter(b => b.id.startsWith('fit-') && b.name.startsWith('Cuerpo ') && b.wall === 'A');
          const gen = (() => {
            if (!bodiesA.length) return null;
            const x0 = Math.min(...bodiesA.map(b => b.x)), x1 = Math.max(...bodiesA.map(b => b.x + b.sx)), zTop = Math.max(...bodiesA.map(b => b.z + b.sz));
            const GC = '#111827', tk = 0.03, yTop = (zTop + 90) / 1000, xLeft = toXw(x0) - 0.55;
            const chip = (txt: number) => <div data-overlay className="select-none rounded bg-white/95 border-2 border-emerald-600 shadow-sm px-1 text-[12px] font-black text-emerald-800" style={{ pointerEvents: 'none' }}>{Math.round(txt)}</div>;
            return (
              <React.Fragment key="cotas-generales">
                <MovableCota kind="h" from={toXw(x0)} to={toXw(x1)} at={yTop} zf={zf} label={x1 - x0} ext={[zTop / 1000, 0]} controlsRef={controlsRef} />
                <MovableCota kind="v" from={0} to={zTop / 1000} at={xLeft} zf={zf} label={zTop} ext={[toXw(x0), 0]} controlsRef={controlsRef} />
              </React.Fragment>
            );
          })();
          // cotas de los espacios libres (huecos): una cota vertical a la derecha por cada espacio, para referenciar los cubos
          const huecos = (() => {
            const hs = boxes.filter(b => b.id.startsWith('fit-') && b.name.startsWith('Hueco ') && b.wall === 'A' && b.sz >= 3);
            if (!bodiesA.length) return null;
            const xr = Math.max(...bodiesA.map(b => b.x + b.sx));
            const seen = new Set<string>();
            const vs = hs.filter(h => { const k = `${Math.round(h.z)}-${Math.round(h.sz)}`; if (seen.has(k)) return false; seen.add(k); return true; }).map(h => (
              <MovableCota key={`cota-hueco-${h.id}`} kind="v" from={h.z / 1000} to={(h.z + h.sz) / 1000} at={toXw(xr) + 0.14} zf={zf} label={h.sz} ext={[toXw(xr), 0]} controlsRef={controlsRef} />
            ));
            // cotas horizontales: de dónde a dónde queda libre al lado de un cubo más angosto que el conjunto
            const xl0 = Math.min(...bodiesA.map(b => b.x));
            const hz = bodiesA.filter(b => b.x - xl0 > 3 || xr - (b.x + b.sx) > 3).flatMap(b => {
              const out: React.ReactNode[] = [];
              if (b.x - xl0 > 3) out.push(<MovableCota key={`cota-izq-${b.id}`} kind="h" from={toXw(xl0)} to={toXw(b.x)} at={(b.z + b.sz) / 1000 + 0.06} zf={zf} label={b.x - xl0} ext={[(b.z + b.sz) / 1000, 0]} controlsRef={controlsRef} />);
              if (xr - (b.x + b.sx) > 3) out.push(<MovableCota key={`cota-der-${b.id}`} kind="h" from={toXw(b.x + b.sx)} to={toXw(xr)} at={(b.z + b.sz) / 1000 + 0.06} zf={zf} label={xr - (b.x + b.sx)} ext={[(b.z + b.sz) / 1000, 0]} controlsRef={controlsRef} />);
              return out;
            });
            void hz; // cotas horizontales de los lados: retiradas (en frontal quedan solo las verticales y la general horizontal de arriba)
            return <>{vs}</>;
          })();
          return <>{gen}{huecos}{cota('cota-top', xl - 180, 0, top, top, editTop)}{base > 0 && cota('cota-base', xl - 90, 0, base, base, editBase)}</>;
        })()}
        {/* al convertir a módulos se ocultan las flechas de arrastre y los botones de eliminar y dividir cubos */}
        {fitApi && !measureMode && !fitApi.fit.converted && !fitIsolate && vis.wallA !== false && (() => {
          const f = fitApi.fit;
          const rows = fitRows(f, wallA);
          const cs = fitCells(f, wallA, spaceHeight);
          const dpt = Math.max(200, f.depth);
          const frontZ = offsetZ + dpt / 1000 + 0.003; // pegados a la cara frontal del cubo, como un parche
          const toX = (X: number) => (X - wallA / 2) / 1000;
          const fo = fitInsets(f, wallA).left; // descuento por la dilatación al lado del muro izquierdo
          const sum = (c: number[]) => c.reduce((a, b) => a + Math.abs(b), 0);
          const sgn = (v: number) => (v < 0 ? -1 : 1);
          const rowsAll = () => ({ lw: [...rows.lower], uw: [...rows.upper], lc: cs.lower.map(c => [...c]), uc: cs.upper.map(c => [...c]) });
          const commit = (st: { lw: number[]; uw: number[]; lc: number[][]; uc: number[][] }) => {
            // un hueco al pie de un cuerpo de arriba, sobre un cuerpo de abajo que también es espacio libre, es un solo espacio libre: se funde con el de abajo
            let a0 = fo;
            const lr: [number, number][] = st.lw.map(w => { const r: [number, number] = [a0, a0 + w]; a0 += w; return r; });
            a0 = fo;
            st.uw.forEach((w, m) => {
              const c = st.uc[m];
              if (c && c.length > 1 && c[c.length - 1] < 0) {
                const li = lr.findIndex(([x, y]) => Math.abs(x - a0) < 1 && Math.abs(y - (a0 + w)) < 1);
                if (li >= 0 && st.lc[li].every(v => v < 0)) c.pop();
              }
              a0 += w;
            });
            fitApi.onChange({ ...f, lowerW: st.lw, lowerBodies: st.lw.length, lowerCells: st.lc, upperW: st.uw, upperBodies: st.uw.length, upperCells: st.uc });
          };
          // mover el borde entre el cuerpo k y el k + 1 de una fila: lo que gana uno lo pierde el otro (mínimo 100 mm)
          // si la unión de la otra fila está en el mismo lugar, las dos se mueven juntas (así los cuerpos no chocan ni se sobreponen)
          const bid = (low: boolean, a: number, b = 0) => `fit-${low ? 'inf' : 'sup'}-${a}-${b}`;
          const edgeLocked = (low: boolean, k: number) => fitLocked(bid(low, k), 'w') || fitLocked(bid(low, k + 1), 'w');
          const cellLocked = (low: boolean, i: number, j: number) => fitLocked(bid(low, i, j), 'h') || fitLocked(bid(low, i, j + 1), 'h');
          const pairLocked = (m: number, li: number) => fitLocked(`fit-sup-${m}-${cs.upper[m].length - 1}`, 'h') || (li >= 0 && fitLocked(`fit-inf-${li}-0`, 'h'));
          const beginEdge = (lower: boolean, k: number, independent = false, freeSide?: 'l' | 'r') => () => {
            const nid = (low: boolean, a: number) => `fit-${low ? 'inf' : 'sup'}-${a}-0`;
            if (fitLocked(nid(lower, k), 'w') || fitLocked(nid(lower, k + 1), 'w')) return () => {}; // una de las dos medidas tiene candado
            const base = [...(lower ? rows.lower : rows.upper)];
            const other = [...(lower ? rows.upper : rows.lower)];
            const pos = base.slice(0, k + 1).reduce((a, b) => a + b, 0);
            let om = -1, acc2 = 0;
            if (!independent) for (let m = 0; m < other.length - 1; m++) { acc2 += other[m]; if (Math.abs(acc2 - pos) < 1) om = m; } // la flecha sencilla (espacio libre) es independiente: no arrastra la unión de la otra fila
            return (d: number, exact?: boolean) => {
              // la cara que da al espacio libre puede comerse casi todo ese espacio (1 mm); el cuerpo real conserva 100 mm
              let lo = -(base[k] - (freeSide === 'l' ? 1 : 15)), hi = base[k + 1] - (freeSide === 'r' ? 1 : 15);
              if (om >= 0) { lo = Math.max(lo, -(other[om] - 15)); hi = Math.min(hi, other[om + 1] - 15); }
              const dd = Math.max(lo, Math.min(hi, d));
              if (dd !== d) exact = true; // en el límite: medida exacta
              const w = [...base]; w[k] = exact ? base[k] + dd : Math.round((base[k] + dd) / 5) * 5; w[k + 1] = base[k] + base[k + 1] - w[k];
              const st = rowsAll();
              if (lower) st.lw = w; else st.uw = w;
              if (om >= 0) {
                const ow = [...other]; ow[om] = other[om] + (w[k] - base[k]); ow[om + 1] = other[om] + other[om + 1] - ow[om];
                if (lower) st.uw = ow; else st.lw = ow;
              }
              commit(st);
            };
          };
          // mover la línea entre dos celdas apiladas del mismo cuerpo
          const beginCell = (lower: boolean, i: number, j: number) => () => {
            if (fitLocked(`fit-${lower ? 'inf' : 'sup'}-${i}-${j}`, 'h') || fitLocked(`fit-${lower ? 'inf' : 'sup'}-${i}-${j + 1}`, 'h')) return () => {};
            const base = [...(lower ? cs.lower[i] : cs.upper[i])];
            return (d: number, exact?: boolean) => {
              const aj = Math.abs(base[j]), an = Math.abs(base[j + 1]);
              const dd = Math.max(-(an - (base[j + 1] < 0 ? 1 : 15)), Math.min(aj - (base[j] < 0 ? 1 : 15), d)); // el espacio libre puede reducirse hasta 1 mm
              if (dd !== d) exact = true;
              const nj = exact ? aj - dd : Math.round((aj - dd) / 5) * 5;
              const c = [...base]; c[j] = sgn(base[j]) * nj; c[j + 1] = sgn(base[j + 1]) * (aj + an - nj);
              const st = rowsAll(); (lower ? st.lc : st.uc)[i] = c;
              commit(st);
            };
          };
          // contacto de un cuerpo de arriba con el de abajo (mismo ancho): solo esos dos cambian de alto
          const beginPair = (m: number, lowFree = false, li = -1) => () => {
            if (fitLocked(`fit-sup-${m}-${cs.upper[m].length - 1}`, 'h') || (li >= 0 && fitLocked(`fit-inf-${li}-0`, 'h'))) return () => {};
            const base = [...cs.upper[m]];
            const total = sum(base);
            return (d: number, exact?: boolean) => {
              const last = base.length - 1;
              const dd = Math.min(Math.max(d, -(cs.Hf - (lowFree ? 1 : 300) - total)), Math.abs(base[last]) - (base[last] < 0 ? 1 : 15)); // si abajo hay espacio libre la cara puede bajar hasta casi el piso
              if (dd !== d) exact = true;
              const c = [...base]; c[last] = sgn(base[last]) * (exact ? Math.abs(base[last]) - dd : Math.round((Math.abs(base[last]) - dd) / 5) * 5);
              const st = rowsAll(); st.uc[m] = c;
              commit(st);
            };
          };
          // sin pareja de igual ancho: la altura general de los superiores se mueve desde el borde izquierdo
          const beginHeight = () => {
            const baseUc = cs.upper.map(c => [...c]);
            return (d: number, exact?: boolean) => {
              const nh0 = cs.upH - d;
              const nh = Math.max(15, Math.min(cs.Hf - 300, exact ? nh0 : Math.round(nh0 / 5) * 5));
              const st = rowsAll();
              st.uc = baseUc.map(cc => { const sm = sum(cc); return cc.map(x => (x * nh) / sm); });
              fitApi.onChange({ ...f, upperHeight: nh, lowerW: st.lw, lowerBodies: st.lw.length, lowerCells: st.lc, upperW: st.uw, upperBodies: st.uw.length, upperCells: st.uc });
            };
          };
          const nodes: React.ReactNode[] = [];
          // posiciones (mm) de los contactos entre dos cuerpos reales: ahí ya hay una flecha doble y no hace falta otra sencilla sobre la misma línea
          // (con el tramo vertical que cubren, para que solo cuenten si tocan el mismo tramo de la línea)
          const doublePos: { pos: number; lo: number; hi: number }[] = [];
          ([[rows.lower, cs.lower, true], [rows.upper, cs.upper, false]] as const).forEach(([row, cells, isLow]) => {
            let a = fo;
            for (let k = 0; k < row.length - 1; k++) {
              a += row[k];
              if (!cells[k].every(c => c < 0) && !cells[k + 1].every(c => c < 0)) {
                const t0 = isLow ? cs.lowerHs[k] : cs.Hf, t1 = isLow ? cs.lowerHs[k + 1] : cs.Hf;
                doublePos.push({ pos: a, lo: Math.min(t0 - sum(cells[k]), t1 - sum(cells[k + 1])), hi: Math.max(t0, t1) });
              }
            }
          });
          ([[true, rows.lower, cs.lower], [false, rows.upper, cs.upper]] as const).forEach(([lower, row, cells]) => {
            let acc = fo;
            for (let k = 0; k < row.length; k++) {
              const bodyTop = lower ? cs.lowerHs[k] : cs.Hf;
              const bodyH = sum(cells[k]);
              // contacto entre cuerpos vecinos: flecha doble a media altura del cuerpo
              if (k < row.length - 1) {
                acc += row[k];
                // si un lado es espacio libre (todo hueco) la flecha es sencilla, va en el centro del espacio libre y apunta hacia él
                const meFree = cells[k].every(c => c < 0), nbFree = cells[k + 1].every(c => c < 0);
                let single: 1 | -1 | undefined, yMid = bodyTop - bodyH / 2, fLo = 0, fHi = 0, limit: { at: number; from: number; to: number } | undefined;
                if (meFree !== nbFree) {
                  const fk = nbFree ? k + 1 : k;
                  single = nbFree ? 1 : -1;
                  fHi = lower ? cs.lowerHs[fk] : cs.Hf; fLo = fHi - sum(cells[fk]);
                  yMid = (fHi + fLo) / 2;
                  limit = { at: toX(nbFree ? acc + row[k + 1] : acc - row[k]), from: fLo / 1000, to: fHi / 1000 };
                }
                // si esa línea ya la controla una flecha doble, la sencilla sobra
                if (!(single && ((limit && Math.abs(limit.at - toX(acc)) < 0.003) || fHi - fLo < 3)) && !(single && doublePos.some(d => Math.abs(d.pos - acc) < 1 && Math.min(fHi, d.hi) - Math.max(fLo, d.lo) > 1))) nodes.push(<FitJunction key={`fj-${lower ? 'l' : 'u'}-${k}`} position={[toX(acc), yMid / 1000, frontZ]} axis={[1, 0, 0]} locked={edgeLocked(lower, k)} single={single} limit={limit} posMm={acc} group={lower ? 'l' : 'u'} begin={beginEdge(lower, k, !!single, single ? (nbFree ? 'r' : 'l') : undefined)} controlsRef={controlsRef} />);
              }
              // contacto entre las partes de un cuerpo dividido (independientes del resto de la columna): flechas dobles horizontales
              {
                let topC = bodyTop; const x0c = fo + row.slice(0, k).reduce((a, b) => a + b, 0);
                cells[k].forEach((hc, jj) => {
                  const cellKey = `fit-${lower ? 'inf' : 'sup'}-${k}-${jj}`, subsW = hc > 0 ? f.subs?.[cellKey] : undefined;
                  if (subsW && subsW.length > 1) {
                    const wc0 = Math.min(row[k], f.cellW?.[cellKey] ?? row[k]), tot0 = subsW.reduce((a, b) => a + b, 0), ys = (topC - Math.abs(hc) / 2) / 1000;
                    let acc3 = x0c;
                    for (let kk = 0; kk < subsW.length - 1; kk++) {
                      acc3 += (subsW[kk] * wc0) / tot0;
                      const accK = acc3, kk2 = kk;
                      const beginSub = () => {
                        const baseWs = subsW.map(x => (x * wc0) / tot0);
                        return (d: number, exact?: boolean) => {
                          const dd = Math.max(-(baseWs[kk2] - 15), Math.min(baseWs[kk2 + 1] - 15, d));
                          const ws = [...baseWs]; ws[kk2] = exact ? baseWs[kk2] + dd : Math.round((baseWs[kk2] + dd) / 5) * 5; ws[kk2 + 1] = baseWs[kk2] + baseWs[kk2 + 1] - ws[kk2];
                          fitApi.onChange({ ...f, subs: { ...(f.subs ?? {}), [cellKey]: ws } });
                        };
                      };
                      nodes.push(<FitJunction key={`fs-${cellKey}-${kk}`} position={[toX(accK), ys, frontZ]} axis={[1, 0, 0]} posMm={accK} group={`s-${cellKey}`} begin={beginSub} controlsRef={controlsRef} />);
                    }
                  }
                  topC -= Math.abs(hc);
                });
              }
              // contacto entre celdas apiladas del mismo cuerpo: flecha doble vertical
              let top = bodyTop;
              const cx = fo + row.slice(0, k).reduce((a, b) => a + b, 0) + row[k] / 2;
              for (let j = 0; j < cells[k].length - 1; j++) {
                top -= Math.abs(cells[k][j]);
                const aFree = cells[k][j] < 0, bFree = cells[k][j + 1] < 0;
                // dos cuerpos separados por un espacio libre ya agotado (≤ 3 mm): las dos flechas sencillas se funden en un solo botón morado de unión
                if (j > 0 && cells[k][j] < 0 && Math.abs(cells[k][j]) < 3 && cells[k][j - 1] > 0 && cells[k][j + 1] > 0) continue; // lo dibuja el botón de la unión anterior
                if (!aFree && bFree && Math.abs(cells[k][j + 1]) < 3 && cells[k][j + 2] > 0) {
                  const jj = j, lw = lower, kk0 = k;
                  const beginMerged = () => {
                    if (fitLocked(`fit-${lw ? 'inf' : 'sup'}-${kk0}-${jj}`, 'h') || fitLocked(`fit-${lw ? 'inf' : 'sup'}-${kk0}-${jj + 2}`, 'h')) return () => {};
                    const base = [...(lw ? cs.lower[kk0] : cs.upper[kk0])];
                    return (d: number, exact?: boolean) => {
                      const aj = base[jj], bj = base[jj + 2];
                      const dd = Math.max(-(bj - 15), Math.min(aj - 15, d));
                      if (dd !== d) exact = true;
                      const nj = exact ? aj - dd : Math.round((aj - dd) / 5) * 5;
                      const c = [...base]; c[jj] = nj; c[jj + 2] = aj + bj - nj;
                      const st = rowsAll(); (lw ? st.lc : st.uc)[kk0] = c;
                      commit(st);
                    };
                  };
                  nodes.push(<FitJunction key={`fc-${lower ? 'l' : 'u'}-${k}-${j}`} position={[toX(cx), top / 1000, frontZ]} axis={[0, 1, 0]} vertical locked={cellLocked(lower, k, j)} posMm={top} group={`${lower ? 'l' : 'u'}-${k}`} begin={beginMerged} controlsRef={controlsRef} />);
                  continue;
                }
                if (aFree !== bFree && Math.abs(cells[k][aFree ? j : j + 1]) < 3) continue; // el espacio libre ya se agotó: el cuerpo toca al otro
                nodes.push(<FitJunction key={`fc-${lower ? 'l' : 'u'}-${k}-${j}`} position={[toX(cx), top / 1000, frontZ]} axis={[0, 1, 0]} vertical locked={cellLocked(lower, k, j)} single={aFree !== bFree ? (bFree ? 1 : -1) : undefined} limit={aFree !== bFree ? { at: (bFree ? top - Math.abs(cells[k][j + 1]) : top + Math.abs(cells[k][j])) / 1000, from: toX(cx - row[k] / 2), to: toX(cx + row[k] / 2) } : undefined} posMm={top} group={`${lower ? 'l' : 'u'}-${k}`} begin={beginCell(lower, k, j)} controlsRef={controlsRef} />);
              }
            }
          });
          if (rows.upper.length > 0) {
            // un cuerpo de arriba con el mismo ancho y posición que uno de abajo: botón de unión; al arrastrarlo solo cambian de alto esos dos
            let any = false, a = fo;
            rows.lower.forEach((w, i) => {
              const m = cs.match[i];
              if (m >= 0) {
                any = true;
                const lowFree = cs.lower[i].every(c => c < 0), upFree = cs.upper[m][cs.upper[m].length - 1] < 0;
                // si un lado del contacto es espacio libre, la flecha es sencilla y apunta hacia él
                if (lowFree !== upFree && (lowFree ? cs.lowerHs[i] - cs.base : Math.abs(cs.upper[m][cs.upper[m].length - 1])) < 3) { any = true; } else nodes.push(<FitJunction key={`fj-h-${i}`} position={[toX(a + w / 2), cs.lowerHs[i] / 1000, frontZ]} axis={[0, 1, 0]} vertical locked={pairLocked(m, i)} single={lowFree !== upFree ? (lowFree ? 1 : -1) : undefined} limit={lowFree !== upFree ? { at: (lowFree ? cs.base : cs.Hf - (sum(cs.upper[m]) - Math.abs(cs.upper[m][cs.upper[m].length - 1]))) / 1000, from: toX(a), to: toX(a + w) } : undefined} posMm={cs.lowerHs[i]} group={`h-${i}`} begin={beginPair(m, lowFree, i)} controlsRef={controlsRef} />);
              }
              a += w;
            });
            if (!any) nodes.push(<FitJunction key="fj-h" position={[toX(0), (cs.Hf - cs.upH) / 1000, frontZ]} axis={[0, 1, 0]} vertical posMm={cs.Hf - cs.upH} group="h" begin={beginHeight} controlsRef={controlsRef} />);
          }
          const sel = fitSel && fitSel.startsWith('fit-') ? boxes.find(x => x.id === fitSel) : null; // los cubos de los muros B y C no tienen botones de dividir ni eliminar por ahora
          if (sel) {
            const parts = sel.id.split('-');
            const lower = parts[1] === 'inf', i = Number(parts[2]), j = Number(parts[3]);
            const row = lower ? rows.lower : rows.upper;
            // dividir en dos cuerpos uno al lado del otro (botón de arriba a la derecha)
            // cada cuerpo es independiente: si la columna tiene varios cuerpos (o ya está dividido), solo se divide ese cuerpo; si la columna tiene uno solo, se divide la columna
            const cellKey = `fit-${lower ? 'inf' : 'sup'}-${i}-${j}`, subM2 = /-s(\d+)$/.exec(sel.id), subIdx = subM2 ? Number(subM2[1]) : -1;
            const subsCur = f.subs?.[cellKey];
            const cellWidth = (subsCur ? boxes.filter(x => x.id.startsWith(cellKey + '-s')).reduce((a, x) => a + x.sx, 0) : sel.sx);
            const subWs = () => { const tot = (subsCur ?? [1]).reduce((a, b) => a + b, 0); return (subsCur ?? [1]).map(x => (x * cellWidth) / tot); };
            // al cambiar la cantidad de partes se renumeran: se conserva la configuración y el hueco de cada una (map: índice viejo -> índice nuevo, null = se pierde)
            const remapParts = (map: (k: number) => number | null, dup?: { from: number; to: number }) => {
              const bodies = { ...(f.bodies ?? {}) }, gaps = { ...(f.gaps ?? {}) };
              const oldB: Record<number, FitBodyCfg | undefined> = {}, oldG: Record<number, boolean> = {};
              (subsCur ?? []).forEach((_, k) => { oldB[k] = bodies[`${cellKey}-s${k}`]; oldG[k] = !!gaps[`${cellKey}-s${k}`]; delete bodies[`${cellKey}-s${k}`]; delete gaps[`${cellKey}-s${k}`]; });
              (subsCur ?? []).forEach((_, k) => { const nk = map(k); if (nk === null) return; if (oldB[k]) bodies[`${cellKey}-s${nk}`] = oldB[k]; if (oldG[k]) gaps[`${cellKey}-s${nk}`] = true; });
              if (dup && oldB[dup.from]) bodies[`${cellKey}-s${dup.to}`] = JSON.parse(JSON.stringify(oldB[dup.from]));
              return { bodies, gaps };
            };
            const splitSide = () => {
              if (subIdx >= 0 && subsCur) {
                const ws = subWs(); const half = ws[subIdx] / 2; ws.splice(subIdx, 1, half, half);
                const { bodies, gaps } = remapParts(k => (k <= subIdx ? k : k + 1), { from: subIdx, to: subIdx + 1 });
                setFitSel(null);
                fitApi.onChange({ ...f, subs: { ...(f.subs ?? {}), [cellKey]: ws }, bodies, gaps });
                return;
              }
              if ((lower ? cs.lower : cs.upper)[i].length > 1) {
                const half = cellWidth / 2, bodies = { ...(f.bodies ?? {}) }, src = bodies[cellKey];
                if (src) { bodies[`${cellKey}-s0`] = JSON.parse(JSON.stringify(src)); bodies[`${cellKey}-s1`] = JSON.parse(JSON.stringify(src)); delete bodies[cellKey]; }
                setFitSel(null);
                fitApi.onChange({ ...f, subs: { ...(f.subs ?? {}), [cellKey]: [half, half] }, bodies });
                return;
              }
              const st = rowsAll(); const w = lower ? st.lw : st.uw, cc = lower ? st.lc : st.uc;
              const half = w[i] / 2; w.splice(i, 1, half, half); cc.splice(i, 1, [...cc[i]], [...cc[i]]);
              commit(st);
            };
            // dividir la celda en dos, una sobre otra (botón de abajo a la izquierda)
            const splitHorizontal = () => { const st = rowsAll(); const cc = lower ? st.lc : st.uc; cc[i].splice(j, 1, cc[i][j] / 2, cc[i][j] / 2); commit(st); };
            const isGap = sel.name.startsWith('Hueco ');
            // eliminar: el cuerpo desaparece y queda el espacio libre (un hueco); eliminar el hueco quita el espacio y lo suma al vecino
            const remove = () => {
              if (subIdx >= 0 && subsCur) {
                if (!isGap) {
                  // eliminar una parte: queda un espacio libre del mismo ancho y la vecina NO se alarga
                  setFitSel(null);
                  fitApi.onChange({ ...f, gaps: { ...(f.gaps ?? {}), [sel.id]: true } });
                  return;
                }
                // quitar el espacio: su ancho se lo queda la vecina
                const ws = subWs(); const gone = ws.splice(subIdx, 1)[0]; ws[subIdx > 0 ? subIdx - 1 : 0] += gone;
                const { bodies, gaps } = remapParts(k => (k === subIdx ? null : k > subIdx ? k - 1 : k));
                const subs = { ...(f.subs ?? {}) }; if (ws.length > 1) subs[cellKey] = ws; else delete subs[cellKey];
                setFitSel(null); fitApi.onChange({ ...f, subs, bodies, gaps });
                return;
              }
              const st = rowsAll(); const w = lower ? st.lw : st.uw, cc = lower ? st.lc : st.uc;
              if (!isGap) { cc[i][j] = -Math.abs(cc[i][j]); setFitSel(null); commit(st); return; }
              if (cc[i].length > 1) { const gone = Math.abs(cc[i].splice(j, 1)[0]); const t = j > 0 ? j - 1 : 0; cc[i][t] = sgn(cc[i][t]) * (Math.abs(cc[i][t]) + gone); setFitSel(null); commit(st); return; }
              if (row.length <= 1) return;
              const gone = w.splice(i, 1)[0]; cc.splice(i, 1);
              if (w.length) w[i > 0 ? i - 1 : 0] += gone;
              setFitSel(null); commit(st);
            };
            // rellenar un hueco con un cuerpo otra vez
            const restore = () => {
              if (subIdx >= 0) { const gaps = { ...(f.gaps ?? {}) }; delete gaps[sel.id]; setFitSel(null); fitApi.onChange({ ...f, gaps }); return; }
              const st = rowsAll(); (lower ? st.lc : st.uc)[i][j] = Math.abs((lower ? st.lc : st.uc)[i][j]); setFitSel(null); commit(st); };
            const left = toX(sel.x) + 0.1, right = toX(sel.x + sel.sx) - 0.1, top = (sel.z + sel.sz) / 1000 - 0.1, bottom = sel.z / 1000 + 0.1;
            const bigBtn = 'w-14 h-14 rounded-full text-white shadow-lg border-2 border-white flex items-center justify-center';
            // flechas azules de estirar (en isométrica y 3D): arriba el alto, a los lados el ancho
            if (!isGap && (viewMode === 'isometric' || viewMode === '3d')) {
              // las flechas quedan separadas de la cara (si están justo sobre ella titilan al taparse con el propio cubo)
              const zMid = offsetZ + sel.sy / 2000, yTop = (sel.z + sel.sz) / 1000 + 0.02, yMid = (sel.z + sel.sz / 2) / 1000, off = 0.02;
              // regla: si la cara toca (es tangente) a otro cubo, ese lado no se puede estirar y su flecha no sale
              const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 1;
              const others = boxes.filter(o => o.id !== sel.id && o.kind === 'panel' && o.name.startsWith('Cuerpo ') && o.wall === sel.wall);
              const touches = (face: 'l' | 'r' | 'u' | 'f') => others.some(o => (
                face === 'l' ? Math.abs(o.x + o.sx - sel.x) < 1 && ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy)
                : face === 'r' ? Math.abs(o.x - (sel.x + sel.sx)) < 1 && ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy)
                : face === 'u' ? Math.abs(o.z - (sel.z + sel.sz)) < 1 && ov(o.x, o.x + o.sx, sel.x, sel.x + sel.sx) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy)
                : Math.abs(o.y - (sel.y + sel.sy)) < 1 && ov(o.x, o.x + o.sx, sel.x, sel.x + sel.sx) && ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz)));
              // estirar hacia arriba solo se come el espacio libre (hueco) que hay encima: el alto de este cuerpo sube y el del hueco baja
              const stretchUp = (newH: number) => {
                const f2 = fitApi.fit, rs = fitRows(f2, wallA), cs2 = fitCells(f2, wallA, spaceHeight);
                const lc2 = cs2.lower.map(c => [...c]), uc2 = cs2.upper.map(c => [...c]);
                const cc = (lower ? lc2 : uc2)[i];
                if (!cc || j < 1 || cc[j - 1] >= 0) return;
                const total = Math.abs(cc[j]) + Math.abs(cc[j - 1]), nj = Math.min(Math.max(newH, 15), total - 20);
                cc[j] = nj; cc[j - 1] = -(total - nj);
                fitApi.onChange({ ...f2, lowerW: [...rs.lower], lowerBodies: rs.lower.length, lowerCells: lc2, upperW: [...rs.upper], upperBodies: rs.upper.length, upperCells: uc2 });
              };
              // restricciones de medida: si ese lado ya no tiene espacio para crecer (mínimo del vecino, medida bloqueada o tope) tampoco sale la flecha
              const cellIdW = `fit-${lower ? 'inf' : 'sup'}-${i}-0`, wLocked = fitLocked(cellIdW, 'w') || fitLocked(sel.id, 'w');
              const colStart = fo + row.slice(0, i).reduce((a2, b2) => a2 + b2, 0);
              const nbL = i > 0 && !fitLocked(`fit-${lower ? 'inf' : 'sup'}-${i - 1}-0`, 'w') ? Math.max(0, row[i - 1] - 15) : 0;
              const nbR = i < row.length - 1 && !fitLocked(`fit-${lower ? 'inf' : 'sup'}-${i + 1}-0`, 'w') ? Math.max(0, row[i + 1] - 15) : 0;
              const mu = row.length === 1 && lower ? f.mueble : undefined;
              // los cubos empiezan desde su borde fijo: por defecto el izquierdo (crecen hacia la derecha); el mueble pegado al muro derecho empieza desde ahí y crece hacia la izquierda.
              // La flecha solo sale hacia el lado por el que puede crecer
              const anchoredRight = !!mu && mu.x0 + mu.ancho >= wallA - 1 && mu.x0 > 1;
              const inColR = Math.max(0, colStart + row[i] - (sel.x + sel.sx));
              const roomR = wLocked ? 0 : inColR + (mu ? Math.max(0, wallA - (mu.x0 + mu.ancho)) : nbR);
              const roomL = wLocked ? 0 : (mu ? Math.max(0, mu.x0) : nbL);
              const upRoom = (j >= 1 && (lower ? cs.lower : cs.upper)[i]?.[j - 1] < 0) ? Math.abs((lower ? cs.lower : cs.upper)[i][j - 1]) - 20 : 0;
              // regla: al estirar una cara, si choca con la cara de otro cubo el estiramiento llega hasta ahí (distancia libre hasta el cubo más cercano en esa dirección)
              const freeTo = (face: 'l' | 'r' | 'u' | 'f') => others.reduce((m, o) => {
                const d = face === 'l' ? (ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy) ? sel.x - (o.x + o.sx) : Infinity)
                  : face === 'r' ? (ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy) ? o.x - (sel.x + sel.sx) : Infinity)
                  : face === 'u' ? (ov(o.x, o.x + o.sx, sel.x, sel.x + sel.sx) && ov(o.y, o.y + o.sy, sel.y, sel.y + sel.sy) ? o.z - (sel.z + sel.sz) : Infinity)
                  : (ov(o.x, o.x + o.sx, sel.x, sel.x + sel.sx) && ov(o.z, o.z + o.sz, sel.z, sel.z + sel.sz) ? o.y - (sel.y + sel.sy) : Infinity);
                return d >= -1 && d < m ? Math.max(0, d) : m;
              }, Infinity);
              const fU = freeTo('u'), fL = freeTo('l'), fR = freeTo('r'), fF = freeTo('f');
              // medidas a las que la cara queda a ras de la cara de otro cubo (tope magnético del arrastre)
              const snapU = others.flatMap(o => [o.z - sel.z, o.z + o.sz - sel.z]);
              const snapL = others.flatMap(o => [sel.x + sel.sx - o.x, sel.x + sel.sx - (o.x + o.sx)]);
              const snapR = others.flatMap(o => [o.x - sel.x, o.x + o.sx - sel.x]);
              const snapF = others.flatMap(o => [o.y - sel.y, o.y + o.sy - sel.y]);
              const tgFor = (vals: (o: typeof others[number]) => number[]) => others.map(o => ({ min: [toX(o.x), o.z / 1000, offsetZ + o.y / 1000] as [number, number, number], max: [toX(o.x + o.sx), (o.z + o.sz) / 1000, offsetZ + (o.y + o.sy) / 1000] as [number, number, number], vals: vals(o) }));
              const tgU = tgFor(o => [o.z - sel.z, o.z + o.sz - sel.z]), tgL = tgFor(o => [sel.x + sel.sx - o.x, sel.x + sel.sx - (o.x + o.sx)]), tgR = tgFor(o => [o.x - sel.x, o.x + o.sx - sel.x]), tgF = tgFor(o => [o.y - sel.y, o.y + o.sy - sel.y]);
              const canUp = !touches('u') && !fitLocked(sel.id, 'h') && upRoom > 5;
              const canFront = !touches('f') && sel.sy < 899;
              nodes.push(
                ...(canUp ? [<FitFaceHandle key="fh-up" kind="up" position={[toX(sel.x + sel.sx / 2), yTop, zMid]} axis={[0, 1, 0]} sign={1} start={() => sel.sz} onValue={(v) => stretchUp(Math.min(v, sel.sz + upRoom, sel.sz + fU))} current={sel.sz} snaps={snapU} targets={tgU} controlsRef={controlsRef} />] : []),
                ...(anchoredRight && !touches('l') && roomL > 5 ? [<FitFaceHandle key="fh-left" kind="left" position={[toX(sel.x) - off, yMid, zMid]} axis={[1, 0, 0]} sign={-1} start={() => sel.sx} onValue={(v) => fitEdit(sel.id, { width: Math.min(v, sel.sx + roomL, sel.sx + fL) }, 'l')} current={sel.sx} snaps={snapL} targets={tgL} controlsRef={controlsRef} />] : []),
                ...(!anchoredRight && !touches('r') && roomR > 5 ? [<FitFaceHandle key="fh-right" kind="right" position={[toX(sel.x + sel.sx) + off, yMid, zMid]} axis={[1, 0, 0]} sign={1} start={() => sel.sx} onValue={(v) => fitEdit(sel.id, { width: Math.min(v, sel.sx + roomR, sel.sx + fR) }, 'r')} current={sel.sx} snaps={snapR} targets={tgR} controlsRef={controlsRef} />] : []),
                ...(canFront ? [<FitFaceHandle key="fh-front" kind="front" position={[toX(sel.x + sel.sx / 2), yMid, offsetZ + sel.sy / 1000 + off]} axis={[0, 0, 1]} sign={1} start={() => sel.sy} onValue={(v) => { const f2 = fitApi.fit; fitApi.onChange({ ...f2, cellD: { ...(f2.cellD ?? {}), [sel.id]: Math.min(v, 900, sel.sy + fF) } }); }} current={sel.sy} snaps={snapF} targets={tgF} controlsRef={controlsRef} />] : [])
              );
            }
            // mover el cuerpo a lo largo del muro (se desune de sus vecinos): cruz verde, sin pasar a otros cuerpos ni los muros
            if (!isGap && viewMode !== 'plan' && true) {
              const ckey = sel.id.replace(/-s\d+$/, ''), subM0 = /-s\d+$/.test(sel.id);
              const cur = f.cellX?.[ckey] ?? 0;
              const oth = boxes.filter(o => o.id !== sel.id && o.kind === 'panel' && o.name.startsWith('Cuerpo ') && o.wall === sel.wall && !(o.id.startsWith(ckey + '-s')) && o.id !== ckey && Math.min(o.z + o.sz, sel.z + sel.sz) - Math.max(o.z, sel.z) > 1 && Math.min(o.y + o.sy, sel.y + sel.sy) - Math.max(o.y, sel.y) > 1);
              const parts = boxes.filter(o => o.id === ckey || o.id.startsWith(ckey + '-s'));
              const gx0 = Math.min(...parts.map(o => o.x)), gx1 = Math.max(...parts.map(o => o.x + o.sx));
              const loX = Math.max(0, ...oth.filter(o => o.x + o.sx <= gx0 + 1).map(o => o.x + o.sx)), hiX = Math.min(wallA, ...oth.filter(o => o.x >= gx1 - 1).map(o => o.x));
              const minC = cur + (loX - gx0), maxC = cur + (hiX - gx1);
              // vertical: el cuerpo sube o baja comiéndose el espacio libre que tiene encima (o debajo) y dejando uno al otro lado, así se desune del cuerpo de abajo
              const cellsCol = (lower ? cs.lower : cs.upper)[i];
              const ua0 = cellsCol && j >= 1 && cellsCol[j - 1] < 0 ? Math.abs(cellsCol[j - 1]) : 0;
              const ub0 = cellsCol && cellsCol[j + 1] !== undefined && cellsCol[j + 1] < 0 ? Math.abs(cellsCol[j + 1]) : 0;
              const canVert = !!cellsCol && !subM0;
              const beginMove = () => {
                const f2 = fitApi.fit, rs = fitRows(f2, wallA), cs2 = fitCells(f2, wallA, spaceHeight);
                const lc2 = cs2.lower.map(c => [...c]), uc2 = cs2.upper.map(c => [...c]);
                const baseC = [...((lower ? cs2.lower : cs2.upper)[i] ?? [])];
                const hasA = j >= 1 && baseC[j - 1] < 0, hasB = baseC[j + 1] !== undefined && baseC[j + 1] < 0;
                const ua = hasA ? Math.abs(baseC[j - 1]) : 0, ub = hasB ? Math.abs(baseC[j + 1]) : 0;
                const room = hasA ? ua - 1 : 0, roomD = hasB ? ub - 1 : 0;
                return (dxMm: number, dyMm: number) => {
                  const c = Math.min(maxC, Math.max(minC, cur + Math.round(dxMm / 5) * 5));
                  const cx = Math.abs(c - minC) < 15 ? minC : Math.abs(c - maxC) < 15 ? maxC : c;
                  let up = Math.round(dyMm / 5) * 5;
                  up = canVert && Math.abs(dyMm) >= 8 ? Math.max(-roomD, Math.min(room, up)) : 0;
                  const nc = [...baseC];
                  if (up > 0) { nc[j - 1] = -(ua - up); if (hasB) nc[j + 1] = -(ub + up); else nc.splice(j + 1, 0, -up); }
                  else if (up < 0) { const d = -up; nc[j + 1] = -(ub - d); if (hasA) nc[j - 1] = -(ua + d); else nc.splice(j, 0, -d); }
                  (lower ? lc2 : uc2)[i] = nc;
                  fitApi.onChange({ ...f2, cellX: { ...(f2.cellX ?? {}), [ckey]: cx }, lowerW: [...rs.lower], lowerBodies: rs.lower.length, lowerCells: lc2, upperW: [...rs.upper], upperBodies: rs.upper.length, upperCells: uc2 });
                };
              };
              if (maxC - minC > 5 || (canVert && (ua0 > 6 || ub0 > 6))) nodes.push(
                <FitMoveHandle key="fit-move" position={[toX(sel.x + sel.sx / 2), (sel.z + sel.sz * 0.22) / 1000, offsetZ + sel.sy / 1000 + 0.02]} begin={beginMove} controlsRef={controlsRef} />
              );
            }
            if (isGap) {
              nodes.push(
                <HtmlScaled key="fit-x" zoomScale position={[left, top, frontZ]} center distanceFactor={1} zIndexRange={[110, 0]}>
                  <button data-overlay onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(); }} className={`${bigBtn} bg-red-500 hover:bg-red-600`} title="Quitar este espacio"><X size={28} strokeWidth={3} /></button>
                </HtmlScaled>,
                <HtmlScaled key="fit-fill" zoomScale position={[(left + right) / 2, (top + bottom) / 2, frontZ]} center distanceFactor={1} zIndexRange={[110, 0]}>
                  <button data-overlay onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); restore(); }} className={`${bigBtn} bg-green-600 hover:bg-green-700`} title="Poner un cuerpo en este espacio"><Plus size={28} strokeWidth={3} /></button>
                </HtmlScaled>
              );
            } else {
              nodes.push(
                <HtmlScaled key="fit-x" zoomScale position={[left, top, frontZ]} center distanceFactor={1} zIndexRange={[110, 0]}>
                  <button data-overlay onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(); }} className={`${bigBtn} bg-red-500 hover:bg-red-600`} title="Eliminar (queda el espacio libre)"><X size={28} strokeWidth={3} /></button>
                </HtmlScaled>,
                <HtmlScaled key="fit-plus" zoomScale position={[right, top, frontZ]} center distanceFactor={1} zIndexRange={[110, 0]}>
                  <button data-overlay onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); splitSide(); }} className={`${bigBtn} bg-green-600 hover:bg-green-700`} title="Dividir en dos cuerpos, uno al lado del otro"><Plus size={28} strokeWidth={3} /></button>
                </HtmlScaled>,
                subIdx >= 0 ? null : <HtmlScaled key="fit-plus-h" zoomScale position={[left, bottom, frontZ]} center distanceFactor={1} zIndexRange={[110, 0]}>
                  <button data-overlay onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); splitHorizontal(); }} className={`${bigBtn} bg-green-600 hover:bg-green-700`} title="Dividir en dos, uno sobre otro (horizontal)"><Plus size={28} strokeWidth={3} /></button>
                </HtmlScaled>
              );
            }
          }
          return <>{nodes}</>;
        })()}

        {puertaApi && puertaSel && viewMode !== 'plan' && (() => {
          // flechas del vano: arriba el alto y a la derecha el ancho (el vano sigue centrado en el muro); la puerta se recalcula con él
          const P = puertaApi.cfg, x1 = (wallA + P.ancho) / 2, zf = offsetZ + 0.03;
          const set = (patch: Partial<PuertaCfg>) => puertaApi.onChange({ ...puertaApi.cfg, ...patch });
          return (
            <>
              <FitFaceHandle key="pv-up" kind="up" position={[0, P.alto / 1000 + 0.02, zf]} axis={[0, 1, 0]} sign={1} start={() => P.alto} onValue={(n) => set({ alto: Math.max(1000, Math.min(Math.min(3000, spaceHeight - 50), Math.round(n))) })} current={P.alto} controlsRef={controlsRef} />
              <FitFaceHandle key="pv-r" kind="right" position={[(x1 - wallA / 2) / 1000 + 0.02, P.alto / 2000, zf]} axis={[1, 0, 0]} sign={1} start={() => P.ancho} onValue={(n) => set({ ancho: Math.max(400, Math.min(Math.min(2000, wallA - 100), Math.round(n))) })} current={P.ancho} controlsRef={controlsRef} />
            </>
          );
        })()}

        {fitApi && fitIsolate && isoSel && (() => {
          // pieza del módulo aislado: flechas 3D (derecha, arriba y frente) que cambian solo la medida de esa pieza
          const pc = vBoxes.find(x => x.id === isoSel);
          if (!pc) return null;
          const [cx0, cy0, cz0] = boxCenter(pc);
          const off = 0.02;
          const setAdj = (patch: { sx?: number; sy?: number; sz?: number }) => {
            const f2 = fitApi.fit;
            fitApi.onChange({ ...f2, pieceAdj: { ...(f2.pieceAdj ?? {}), [pc.id]: { ...(f2.pieceAdj?.[pc.id] ?? {}), ...patch } } });
          };
          const clampV = (n: number) => Math.min(2400, Math.max(10, Math.round(n)));
          return (
            <>
              <FitFaceHandle key={`pa-r-${pc.id}`} kind="right" position={[cx0 + pc.sx / 2000 + off, cy0, cz0]} axis={[1, 0, 0]} sign={1} start={() => pc.sx} onValue={(n) => setAdj({ sx: clampV(n) })} current={pc.sx} min={10} controlsRef={controlsRef} />
              <FitFaceHandle key={`pa-u-${pc.id}`} kind="up" position={[cx0, cy0 + pc.sz / 2000 + off, cz0]} axis={[0, 1, 0]} sign={1} start={() => pc.sz} onValue={(n) => setAdj({ sz: clampV(n) })} current={pc.sz} min={10} controlsRef={controlsRef} />
              <FitFaceHandle key={`pa-f-${pc.id}`} kind="front" position={[cx0, cy0, cz0 + pc.sy / 2000 + off]} axis={[0, 0, 1]} sign={1} start={() => pc.sy} onValue={(n) => setAdj({ sy: clampV(n) })} current={pc.sy} min={10} controlsRef={controlsRef} />
            </>
          );
        })()}

        {closetForm && !measureMode && cajoneroSel !== 0 && (() => {
          const tapa = boxes.find(x => x.name === (cajoneroSel === 2 ? 'Tapa cajonero · 2' : 'Tapa cajonero'));
          if (!tapa) return null;
          const cfgK = cajoneroSel === 2 && closetForm.config2 ? closetForm.config2 : closetForm.config;
          const changeK = cajoneroSel === 2 && closetForm.onChange2 ? closetForm.onChange2 : closetForm.onChange;
          const c = boxCenter(tapa);
          const front = toWorldXZ(0, tapa.y + tapa.sy)[1];
          return <CajoneroStretch position={[c[0], c[1] + 0.12, front + 0.06]} depth={cfgK.cajoneroDepth ?? 450} onChange={(d) => changeK({ cajoneroDepth: d })} controlsRef={controlsRef} />;
        })()}

        {closetForm && !measureMode && closetSection && (
          <Html position={closetSection.pos} center zIndexRange={[220, 0]} occlude={false} style={{ pointerEvents: 'none' }}>
            <ClosetSectionForm key={`${closetSection.section}-${closetSection.idx ?? 0}`} section={closetSection.section} api={{ ...(closetSection.section === 'torre' && closetSection.idx === 2 && closetForm.torre2Config && closetForm.torre2Derived && closetForm.onTorre2 ? { ...closetForm, config: closetForm.torre2Config, derived: closetForm.torre2Derived, onChange: closetForm.onTorre2, onRemove: closetForm.onRemoveTorre2, torreIdx: 2 as const } : closetSection.idx === 2 && closetForm.config2 && closetForm.derived2 && closetForm.onChange2 ? { ...closetForm, config: closetForm.config2, derived: closetForm.derived2, onChange: closetForm.onChange2 } : closetForm), onRoot: closetForm.onChange, doorsGhost, onDoorsGhost: setDoorsGhost }} onClose={() => setClosetSection(null)} />
          </Html>
        )}

        {/* Puertas y frentes de cajón de los módulos convertidos */}
        {boxes.filter(b => b.kind === 'front' && (b.id.startsWith('front-upper-') ? vis.upper : vis.lower)).map(b => (
          <mesh key={b.id} position={boxCenter(b)} castShadow receiveShadow raycast={() => null}>
            <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
            <meshStandardMaterial color={(b.id.startsWith('front-upper-') ? colores?.fachadaMA ?? colores?.fachada : colores?.fachada) ?? (b.id.startsWith('front-upper-') ? '#d6b48a' : '#c19a6b')} roughness={0.55} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            <Edges color={b.moduleId && b.moduleId === selectedId ? '#ef4444' : (b.moduleId && pair.includes(b.moduleId) ? '#f59e0b' : '#3b2a1a')} linewidth={b.moduleId && (b.moduleId === selectedId || pair.includes(b.moduleId)) ? 3 : 1} />
            {(b.wall === 'A' || b.wall === 'B' || b.wall === 'C') && (
              <FrontOutline hw={(b.wall === 'A' ? b.sx : b.sy) / 2000} hh={b.sz / 2000} face={b.islandId ? 'z-' : b.wall === 'A' ? 'z+' : b.wall === 'B' ? 'x+' : 'x-'} depth={(b.wall === 'A' ? b.sy : b.sx) / 2000}
                color={b.moduleId && b.moduleId === selectedId ? '#ef4444' : '#334155'} />
            )}
            {b.name.startsWith('Puerta') && (b.wall === 'A' || b.wall === 'B' || b.wall === 'C') && (() => {
              // mismas reglas de abertura que en el Closet fit: parejas puerta izquierda y puerta derecha (la bisagra en el borde exterior) y una sola puerta con bisagra a la izquierda
              const doors = boxes.filter(q => q.kind === 'front' && q.moduleId === b.moduleId && q.name.startsWith('Puerta'));
              const n = doors.length, k = doors.findIndex(q => q.id === b.id);
              const op: 'izq' | 'der' | 'sup' | 'inf' = b.name.startsWith('Puerta superior') ? 'sup' : b.name.startsWith('Puerta inferior') ? 'inf' : n <= 1 ? 'izq' : k < n / 2 ? 'izq' : 'der';
              const alongW = (b.wall === 'A' ? b.sx : b.sy) / 2000, thick = (b.wall === 'A' ? b.sy : b.sx) / 2000;
              return <SwingLines hw={alongW} hh={b.sz / 2000} op={op} face={b.islandId ? 'z-' : b.wall === 'A' ? 'z+' : b.wall === 'B' ? 'x+' : 'x-'} depth={thick} />;
            })()}
          </mesh>
        ))}

        {boxes.filter(b => b.kind === 'zocalo' || (b.kind === 'filler' && (b.id.includes('-upper-') ? vis.upper : vis.lower))).map(b => (
          <mesh key={b.id} position={boxCenter(b)} castShadow receiveShadow>
            <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
            {/* La pieza de dilatación va en gris oscuro para distinguirla del zócalo */}
            <meshStandardMaterial color={b.kind === 'filler' ? '#6b7280' : '#94a3b8'} metalness={0.2} roughness={0.8} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
            {b.kind === 'filler' && <Edges color="#1f2937" />}
          </mesh>
        ))}

        {/* Choques entre módulos y electrodomésticos: la caja se marca en rojo (no recibe clics) */}
        {collisions.map(b => (
          <mesh key={`choque-${b.id}`} position={boxCenter(b)} raycast={() => null} renderOrder={10}>
            <boxGeometry args={[b.sx / 1000 + 0.004, b.sz / 1000 + 0.004, b.sy / 1000 + 0.004]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.4} depthWrite={false} />
            <Edges color="#b91c1c" />
          </mesh>
        ))}

        {vis.counter && boxes.filter(b => b.kind === 'counter').map(b => (
          <Counter3D
            key={b.id}
            box={b}
            wallA={wallA}
            offsetZ={offsetZ}
            translucent={viewMode === 'plan'}
            selected={!measureMode && selectedCounter === b.id}
            editing={!measureMode && editingCounter === b.id}
            settings={counterSettings}
            sides={ladosDelMeson(b, boxes, counterExtras)}
            onSelect={measureMode || !onEditCounter ? undefined : (id) => { setSelectedCounter(id); setSelectedId(null); setEditingId(null); }}
            onOpenEditor={b.islandId && onAbrirIsla ? () => onAbrirIsla(b.islandId!) : setEditingCounter}
            onCloseEditor={() => setEditingCounter(null)}
            onApply={onEditCounter ? ((s, now) => onEditCounter(s, b.id, cambiosDelMeson(b, boxes, counterExtras, now))) : undefined}
          />
        ))}

        {/* Islas y penínsulas */}
        {islands.map(isl => (
          verIsla && <Island3D key={isl.id} isl={isl} toWorld={toWorldXZ} viewMode={viewMode} interactive={!measureMode} controlsRef={controlsRef} onEdit={onEditIsland} onDelete={onDeleteIsland} onAbrir={onAbrirIsla} />
        ))}

        {modules.map((mod) => {
          const box = findModuleBox(boxes, mod.uniqueId);
          if (!box) return null;
          const pos = boxCenter(box);
          const rot: [number, number, number] = [0, mod.wall === 'Island' ? Math.PI : mod.wall === 'B' ? Math.PI / 2 : mod.wall === 'C' ? -Math.PI / 2 : 0, 0];

          // Verificar si este módulo tiene junctions a la izquierda o derecha
          const hasLeftJunction = junctions.some(j => j.rightId === mod.uniqueId);
          const hasRightJunction = junctions.some(j => j.leftId === mod.uniqueId);

          const armBox = mod.cornerArm ? boxes.find(b => b.id === `${mod.uniqueId}-arm`) : undefined;
          return <React.Fragment key={mod.uniqueId}>
          <Module3D
            key={mod.uniqueId}
            pocket={(() => {
              if (!mod.isSinkCabinet) return undefined;
              const slabs = boxes.filter(bx => bx.kind === 'counter' && bx.cutouts && bx.cutouts.length > 0);
              const cut = slabs.flatMap(sb => (sb.cutouts || []).map(c => ({ c, ct: sb.sz }))).find(({ c }) => c.label === 'Poceta'
                && c.x + c.sx / 2 >= box.x - 1 && c.x + c.sx / 2 <= box.x + box.sx + 1 && c.y + c.sy / 2 >= box.y - 1 && c.y + c.sy / 2 <= box.y + box.sy + 1);
              if (!cut) return undefined;
              const th = mod.wall === 'B' ? Math.PI / 2 : mod.wall === 'C' ? -Math.PI / 2 : 0;
              const xw = (cut.c.x + cut.c.sx / 2 - (box.x + box.sx / 2)) / 1000, zw = (cut.c.y + cut.c.sy / 2 - (box.y + box.sy / 2)) / 1000;
              return {
                dx: xw * Math.cos(th) - zw * Math.sin(th), dz: xw * Math.sin(th) + zw * Math.cos(th),
                w: (th === 0 ? cut.c.sx : cut.c.sy) / 1000, d: (th === 0 ? cut.c.sy : cut.c.sx) / 1000,
                depth: SINK_BASIN_DEPTH - cut.ct / 1000,
              };
            })()}
            lShape={armBox ? {
              x0: (armBox.x - (box.x + box.sx / 2)) / 1000, x1: (armBox.x + armBox.sx - (box.x + box.sx / 2)) / 1000,
              z0: (armBox.y - (box.y + box.sy / 2)) / 1000, z1: (armBox.y + armBox.sy - (box.y + box.sy / 2)) / 1000,
            } : undefined}
            module={mod}
            onSplitHorizontal={(!measureMode && mod.height >= 200) ? onSplitHorizontal : undefined}
            onSplitDepth={(!measureMode && mod.depth >= 200) ? onSplitDepth : undefined}
            showLabel={(() => {
              // En planta un módulo bajo queda tapado por el mesón o por un aéreo: su letra no se muestra
              if (viewMode !== 'plan' || mod.type === 'UPPER' || mod.type === 'TALL') return true;
              const cx = box.x + box.sx / 2, cy = box.y + box.sy / 2;
              const inside = (b: Box) => cx >= b.x && cx <= b.x + b.sx && cy >= b.y && cy <= b.y + b.sy;
              const underCounter = vis.counter && boxes.some(b => b.kind === 'counter' && b.id.startsWith('counter-') && inside(b));
              const underUpper = vis.upper && boxes.some(b => b.kind === 'upper' && inside(b));
              return !(underCounter || underUpper);
            })()}
            onExtendFace={measureMode ? undefined : onExtendFace}
            hoverRef={hoverRef}
            resolveReference={(selfId, face, hoverId, point) => {
              const sb = findModuleBox(boxes, selfId);
              const hb = findModuleBox(boxes, hoverId);
              const sm = modules.find(m => m.uniqueId === selfId);
              if (!sb || !hb || !sm) return null;
              const snap = (n: number) => Math.round(n / 5) * 5;
              const nearest = (cands: number[], x: number) => cands.reduce((p, c) => (Math.abs(c - x) < Math.abs(p - x) ? c : p));
              const alongA = sm.wall === 'A' || sm.wall === 'Island';
              const X = point.x * 1000 + wallA / 2, Y = (point.z - offsetZ) * 1000, Z = point.y * 1000;
              const along = (b: Box) => (alongA ? [b.x, b.x + b.sx] : [b.y, b.y + b.sy]);
              const across = (b: Box) => (sm.wall === 'C' ? [wallA - (b.x + b.sx), wallA - b.x] : sm.wall === 'B' ? [b.x, b.x + b.sx] : [b.y, b.y + b.sy]);
              const hitAlong = alongA ? X : Y;
              const hitAcross = sm.wall === 'C' ? wallA - X : sm.wall === 'B' ? X : Y;
              if (face === 'right') return { width: snap(nearest(along(hb), hitAlong) - along(sb)[0]) };
              if (face === 'left') return { width: snap(along(sb)[1] - nearest(along(hb), hitAlong)) };
              if (face === 'front') return { depth: snap(nearest(across(hb), hitAcross) - across(sb)[0]) };
              const P = nearest([hb.z, hb.z + hb.sz], Z);
              if (face === 'top') return { height: snap(P - sb.z), topGap: sm.type === 'UPPER' ? snap(spaceHeight - TOP_MARGIN - P) : 0 };
              return { height: snap(sb.z + sb.sz - P) };
            }}
            faces={(() => {
              // Una cara está libre si no tiene otro módulo (o electrodoméstico) pegado
              const solids = boxes.filter(o => (o.kind === 'lower' || o.kind === 'upper' || o.kind === 'tall' || o.kind === 'appliance') && o.id !== box.id);
              const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 1;
              const near = (a: number, b: number) => Math.abs(a - b) <= 1;
              const touches = (dir: 'x+' | 'x-' | 'y+' | 'z+' | 'z-') => solids.some(o => {
                const ox = ov(box.x, box.x + box.sx, o.x, o.x + o.sx), oy = ov(box.y, box.y + box.sy, o.y, o.y + o.sy), oz = ov(box.z, box.z + box.sz, o.z, o.z + o.sz);
                if (dir === 'z+') return near(o.z, box.z + box.sz) && ox && oy;
                if (dir === 'z-') return near(o.z + o.sz, box.z) && ox && oy;
                if (dir === 'y+') return near(o.y, box.y + box.sy) && ox && oz;
                if (dir === 'x+') return near(o.x, box.x + box.sx) && oy && oz;
                return near(o.x + o.sx, box.x) && oy && oz;
              });
              const frontDir = mod.wall === 'B' ? 'x+' : mod.wall === 'C' ? 'x-' : 'y+';
              const isUpper = mod.type === 'UPPER';
              return {
                left: !hasLeftJunction,
                right: !hasRightJunction,
                front: !touches(frontDir),
                top: !touches('z+') && !(isUpper && (mod.topGap ?? 0) <= 0),
                bottom: isUpper && !touches('z-'),
              };
            })()}
            onSetVistos={onSetModuleVistos}
            position={pos}
            rotation={rot}
            onDelete={measureMode ? undefined : onDeleteModule}
            onSplit={measureMode ? undefined : onSplitModule}
            onEditDimension={measureMode ? undefined : onEditModuleDimension}
            onDragPosition={measureMode ? undefined : onDragModule}
            onResizeEdge={measureMode ? undefined : onResizeEdge}
            controlsRef={controlsRef}
            hideLeftArrow={hasLeftJunction}
            hideRightArrow={hasRightJunction}
            viewMode={viewMode}
            selected={!measureMode && pair.length < 2 && selectedId === mod.uniqueId}
            marked={!measureMode && pair.includes(mod.uniqueId)}
            costado={(() => {
              const touches = (a: number, b: number) => Math.abs(a - b) <= 1;
              const same = modules.filter(o => o.uniqueId !== mod.uniqueId && o.wall === mod.wall && o.type === mod.type);
              const rightBlocked = same.some(o => touches(o.positionX, mod.positionX + mod.width));
              const leftBlocked = same.some(o => touches(o.positionX + o.width, mod.positionX));
              return rightBlocked && !leftBlocked ? 'left' : 'right';
            })()}
            editing={editingId === mod.uniqueId}
            onSelect={measureMode ? undefined : selectModule}
            onOpenEditor={measureMode ? undefined : mod.wall === 'Island' && onAbrirIsla && mod.islandId ? () => onAbrirIsla(mod.islandId!) : setEditingId}
            onCloseEditor={() => setEditingId(null)}
            contextOpen={contextId === mod.uniqueId}
            onContext={measureMode || !onSetModuleFronts ? undefined : (id) => { setEditingId(null); setContextId(id); }}
            onCloseContext={() => setContextId(null)}
            onChooseFronts={onSetModuleFronts}
            onSetTop={onSetModuleTopEdge}
            tono={colores?.fachada}
            onApplyMeasures={(id, m) => {
              if (Math.round(m.depth) !== Math.round(mod.depth)) onEditModuleMeasure?.(id, 'depth', m.depth);
              if (Math.round(m.height) !== Math.round(mod.height)) onEditModuleMeasure?.(id, 'height', m.height);
              if (Math.round(m.width) !== Math.round(mod.width)) onEditModuleDimension?.(id, m.width);
            }}
          />
          {/* Medidas del esquinero en L: atrás (arriba, junto a cada muro) y al frente (abajo, junto al piso) de cada tramo */}
          {armBox && (() => {
            const mb = box, ab = armBox;
            const right = mod.cornerArm!.wall === 'C';
            const topY = (mb.z + mb.sz) / 1000 + 0.05, botY = mb.z / 1000 - 0.05;
            const wp = (X: number, Y: number, y: number): [number, number, number] => { const [wx, wz] = toWorldXZ(X, Y); return [wx, y, wz]; };
            const armWallX = right ? ab.x + ab.sx : ab.x;   // cara del muro B o C
            const innerX = right ? ab.x : ab.x + ab.sx;     // cara del brazo hacia el cuarto
            const innerA = right ? innerX - mb.x : mb.x + mb.sx - innerX; // frente del tramo del muro A
            const labels: Array<{ key: string; pos: [number, number, number]; value: number; title: string; onCommit?: (n: number) => void }> = [
              { key: 'atras-A', pos: wp(mb.x + mb.sx / 2, mb.y, topY), value: mb.sx, title: 'Largo atrás, a lo largo del muro A', onCommit: onEditModuleDimension ? (n) => onEditModuleDimension(mod.uniqueId, n) : undefined },
              { key: 'atras-brazo', pos: wp(armWallX, (mb.y + ab.y + ab.sy) / 2, topY), value: ab.y + ab.sy - mb.y, title: 'Largo atrás, a lo largo del brazo' },
              { key: 'frente-A', pos: wp(right ? (mb.x + innerX) / 2 : (innerX + mb.x + mb.sx) / 2, mb.y + mb.sy, botY), value: innerA, title: 'Largo del frente del tramo del muro A', onCommit: onEditModuleDimension ? (n) => onEditModuleDimension(mod.uniqueId, n + ab.sx) : undefined },
              { key: 'frente-brazo', pos: wp(innerX, ab.y + ab.sy / 2, botY), value: ab.sy, title: 'Largo del frente del brazo', onCommit: onEditCornerArm ? (n) => onEditCornerArm(mod.uniqueId, n) : undefined },
            ];
            return labels.filter(l => l.value > 0).map(l => (
              <Html key={l.key} position={l.pos} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                <div data-overlay>
                  <DimLabel text={String(Math.round(l.value))} value={l.value} tone="white" title={`${Math.round(l.value)} mm. ${l.title}`} onCommit={l.onCommit} />
                </div>
              </Html>
            ));
          })()}
          </React.Fragment>;
        })}

        {/* Renderizar controles de junctions */}
        {!measureMode && junctions.map((junction, idx) => {
          const { leftModule, rightModule, wall } = junction;
          const leftBox = leftModule.uniqueId.endsWith(':arm')
            ? boxes.find(b => b.id === leftModule.uniqueId.replace(':arm', '-arm'))
            : findModuleBox(boxes, leftModule.uniqueId);
          if (!leftBox) return null;

          // El control va en la cara frontal, en el punto de unión entre los dos módulos
          const front = Math.max(leftModule.depth, rightModule.depth);
          let X: number, Y: number;
          let junctionRot: [number, number, number] = [0, 0, 0];
          if (wall === 'A' || wall === 'Island') {
            X = leftBox.x + leftBox.sx; Y = leftBox.y + front;
          } else if (wall === 'B') {
            X = front; Y = leftBox.y + leftBox.sy; junctionRot = [0, Math.PI / 2, 0];
          } else {
            X = wallA - front; Y = leftBox.y + leftBox.sy; junctionRot = [0, -Math.PI / 2, 0];
          }
          const [jx, jz] = toWorldXZ(X, Y);

          return <JunctionControl3D
            key={`junction-${idx}`}
            leftModule={leftModule}
            rightModule={rightModule}
            position={[jx, (leftBox.z + leftBox.sz / 2) / 1000, jz]}
            rotation={junctionRot}
            onResizeJunction={onResizeJunction}
            controlsRef={controlsRef}
            wall={wall}
          />;
        })}

        {/* Campana de isla: cuerpo bajo (la campana), pirámide y chimenea hasta el techo */}
        {vis.appliances && boxes.filter(b => b.applianceType === 'hood-island').map(b => {
          const [cx, , cz] = boxCenter(b), w = b.sx / 1000, d = b.sy / 1000, y0 = b.z / 1000, alto = b.sz / 1000, chim = Math.max(0.22, Math.min(w, d) * 0.4);
          const metal = <meshStandardMaterial color="#d4d7db" metalness={0.75} roughness={0.3} />;
          return (
            <group key={b.id} position={[cx, y0, cz]}>
              <mesh position={[0, 0.03, 0]} castShadow>{<boxGeometry args={[w, 0.06, d]} />}{metal}<Edges color="#6b7280" /></mesh>
              <mesh position={[0, 0.06 + 0.12, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><cylinderGeometry args={[chim * 0.75, Math.min(w, d) * 0.7, 0.24, 4]} />{metal}<Edges color="#6b7280" /></mesh>
              <mesh position={[0, 0.3 + (alto - 0.3) / 2, 0]} castShadow><boxGeometry args={[chim, Math.max(0.05, alto - 0.3), chim]} />{metal}<Edges color="#6b7280" /></mesh>
            </group>
          );
        })}
        {/* Puntos de adecuación: un círculo de color sobre la cara del muro con su sigla y altura (AF, AC, D, E, G) */}
        {vis.puntos !== false && viewMode !== 'plan' && (() => {
          // etiquetas sin encimarse: cada una sube lo justo para no tapar a las de los puntos cercanos del mismo muro
          const along = (q: PuntoAdecuacion) => (q.wall === 'A' ? q.x : q.y);
          const ys: number[] = [];
          puntos.forEach((pt, i) => {
            let y = pt.z / 1000 + 0.075, movio = true;
            while (movio) {
              movio = false;
              for (let j = 0; j < i; j++) {
                const q = puntos[j];
                if (q.wall === pt.wall && Math.abs(along(q) - along(pt)) < 300 && Math.abs(ys[j] - y) < 0.169 && ys[j] + 0.17 > y + 1e-6) { y = ys[j] + 0.17; movio = true; } // solo sube: así termina siempre
              }
            }
            ys.push(y);
          });
          return puntos.map((pt, i) => {
            const [x, z] = toWorldXZ(pt.x, pt.y), info = PUNTO_INFO[pt.tipo];
            const rot: [number, number, number] = pt.wall === 'A' ? [0, 0, 0] : pt.wall === 'B' ? [0, Math.PI / 2, 0] : [0, -Math.PI / 2, 0];
            const dy = ys[i] - pt.z / 1000;
            return (
              <group key={pt.id} position={[x, pt.z / 1000, z]} rotation={rot}>
                <mesh raycast={() => null} renderOrder={20}><circleGeometry args={[0.035, 24]} /><meshBasicMaterial color={info.color} depthTest={false} transparent /></mesh>
                <mesh position={[0, 0, 0.001]} raycast={() => null} renderOrder={21}><ringGeometry args={[0.035, 0.042, 24]} /><meshBasicMaterial color="#ffffff" depthTest={false} transparent /></mesh>
                {!(viewMode === 'frontal' && pt.wall === 'A') && <>
                {dy > 0.09 && <Line points={[[0, 0.042, 0.002], [0, dy - 0.015, 0.002]]} color={info.color} lineWidth={1} depthTest={false} renderOrder={20} raycast={() => null} />}
                <Html center position={[0, dy, 0.01]} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
                  <div title={`${info.nombre} a ${Math.round(pt.z / 10)} cm del piso`} style={{ background: info.color, color: '#fff', font: '800 10px system-ui', padding: '1px 5px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}>{info.sigla} {Math.round(pt.z / 10)}</div>
                </Html>
                </>}
              </group>
            );
          });
        })()}

        {/* Cotas de los puntos de adecuación desde el punto 0 (mm): una por electrodoméstico, en su centro, con su nombre y sus puntos
            al lado (sigla y altura en cm), y al final la cota total del muro. Línea punteada, marca a 45° y el texto en diagonal.
            En la vista frontal van bajo el piso (muro A); en planta, por fuera de cada muro, con los puntos como círculos sobre su cara */}
        {vis.puntos !== false && (viewMode === 'frontal' || viewMode === 'plan') && puntos.length > 0 && (() => {
          const gris = '#334155';
          // marcas de un muro: el 0, una por electrodoméstico y la total del muro
          type Marca = { x: number; texto: string; puntos?: PuntoAdecuacion[]; total?: boolean };
          const marcas = (wall: 'A' | 'B' | 'C', largo: number): Marca[] => [
            { x: 0, texto: '0' },
            ...cotasPorElectro(puntos, wall).map(c => ({ x: c.x, texto: `${c.x} ${c.nombre}`, puntos: c.puntos })),
            { x: Math.round(largo), texto: `${Math.round(largo)}`, total: true },
          ];
          // texto en diagonal: "arriba" sube a 45° desde la marca; "abajo" baja a 45°; "lado" queda horizontal (muros B y C en planta)
          const etiqueta = (m: Marca, modo: 'arriba' | 'abajo' | 'izq' | 'der') => (
            <div style={{
              transformOrigin: modo === 'arriba' ? '0 100%' : '0 0',
              transform: modo === 'arriba' ? 'translateY(-100%) rotate(-45deg)' : modo === 'abajo' ? 'rotate(45deg)' : modo === 'izq' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
              font: '800 11px system-ui', color: m.total ? '#4338ca' : '#0f172a', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <span>{m.texto}</span>
              {m.puntos?.map(p => <span key={p.id} title={`${PUNTO_INFO[p.tipo].nombre} a ${Math.round(p.z / 10)} cm del piso`} style={{ background: PUNTO_INFO[p.tipo].color, color: '#fff', font: '800 9px system-ui', padding: '1px 3px', borderRadius: 4 }}>{siglaPunto(p)}</span>)}
            </div>
          );
          if (viewMode === 'frontal') {
            if (!puntos.some(p => p.wall === 'A')) return null;
            const zFace = toWorldXZ(0, 6)[1], yLinea = -0.42;
            const X = (mm: number) => toWorldXZ(mm, 0)[0];
            return (
              <group>
                {marcas('A', wallA).map(m => {
                  const x = m.x;
                  const zTop = m.puntos ? Math.min(...m.puntos.map(p => p.z)) / 1000 - 0.05 : 0;
                  return (
                    <group key={`${x}-${m.total ? 't' : ''}`}>
                      <Line points={[[X(x), zTop, zFace], [X(x), yLinea - 0.04, zFace]]} color={gris} lineWidth={0.8} dashed={!!m.puntos} dashSize={0.04} gapSize={0.03} depthTest={false} renderOrder={20} raycast={() => null} />
                      <Line points={[[X(x) - 0.03, yLinea - 0.03, zFace], [X(x) + 0.03, yLinea + 0.03, zFace]]} color={gris} lineWidth={2} depthTest={false} renderOrder={20} raycast={() => null} />
                      <Html position={[X(x), yLinea - 0.06, zFace]} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>{etiqueta(m, 'abajo')}</Html>
                    </group>
                  );
                })}
              </group>
            );
          }
          // planta
          const T = WALL_THICKNESS, lift = 0.05;
          const W = (X: number, Y: number): [number, number, number] => [(X - wallA / 2) / 1000, lift, offsetZ + Y / 1000];
          const fuera = (wall: 'A' | 'B' | 'C', along: number, across: number) => (wall === 'A' ? W(along, -T - across) : wall === 'B' ? W(-T - across, along) : W(wallA + T + across, along));
          const plano = [-Math.PI / 2, 0, 0] as [number, number, number];
          const off = DIM_BASE_OFFSET;
          return (
            <group>
              {puntos.map(p => (
                <mesh key={`pl-${p.id}`} position={p.wall === 'A' ? W(p.x, 4) : p.wall === 'B' ? W(4, p.y) : W(wallA - 4, p.y)} rotation={plano} raycast={() => null} renderOrder={22}>
                  <circleGeometry args={[0.04, 24]} /><meshBasicMaterial color={PUNTO_INFO[p.tipo].color} depthTest={false} transparent />
                </mesh>
              ))}
              {(['A', 'B', 'C'] as const).map(wall => {
                if (!puntos.some(p => p.wall === wall)) return null;
                const cero = wall === 'C' ? W(wallA, 0) : W(0, 0);
                return (
                  <group key={`cotas-${wall}`}>
                    <mesh position={cero} rotation={plano} raycast={() => null} renderOrder={22}><ringGeometry args={[0.035, 0.06, 24]} /><meshBasicMaterial color="#7c3aed" depthTest={false} transparent /></mesh>
                    {marcas(wall, wall === 'A' ? wallA : wall === 'B' ? wallB : wallC).map(m => {
                      const x = m.x;
                      return (
                        <group key={`${x}-${m.total ? 't' : ''}`}>
                          <Line points={[fuera(wall, x, -T), fuera(wall, x, off + 40)]} color={gris} lineWidth={0.8} dashed={!!m.puntos} dashSize={0.04} gapSize={0.03} depthTest={false} renderOrder={20} raycast={() => null} />
                          <Line points={[fuera(wall, x - 30, off - 30), fuera(wall, x + 30, off + 30)]} color={gris} lineWidth={2} depthTest={false} renderOrder={20} raycast={() => null} />
                          <Html position={fuera(wall, x, off + 70)} zIndexRange={[60, 0]} style={{ pointerEvents: 'none' }}>
                            {etiqueta(m, wall === 'A' ? 'arriba' : wall === 'B' ? 'izq' : 'der')}
                          </Html>
                        </group>
                      );
                    })}
                  </group>
                );
              })}
            </group>
          );
        })()}

        {/* Lavavajillas: cuerpo bajo el mesón con su frente de acero */}
        {vis.appliances && boxes.filter(b => b.applianceType === 'dishwasher').map(b => (
          <mesh key={b.id} position={boxCenter(b)} castShadow receiveShadow>
            <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
            <meshStandardMaterial color="#c9ccd1" metalness={0.6} roughness={0.35} />
            <Edges color="#4b5563" />
          </mesh>
        ))}

        {vis.appliances && appliances.filter(a => a.active && a.type !== 'dishwasher' && !(a.type === 'hood-under' && a.campanaTipo === 'libre')).map((app, idx) => {
          // Cara superior del mesón (o de los módulos bajos si no hay mesón)
          const counterTop = counterTopZ(boxes, zh * 1000 + COUNTER_HEIGHT) / 1000;
          const counterThickness = (boxes.find(bx => bx.kind === 'counter')?.sz ?? 20) / 1000;
          let pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0];

          // Calcular elevación según tipo de electrodoméstico
          let y: number;

          if (app.type === 'fridge') {
            // Nevera: desde el suelo
            y = app.height / 2000;
          } else if (app.type === 'pantry') {
            // Alacena: desde zócalo hasta techo
            const topOfPantry = (spaceHeight - TOP_MARGIN) / 1000;
            y = (topOfPantry + zh) / 2;
          } else if (app.type === 'stove') {
            // Estufa: sobre el mesón
            y = counterTop + 0.0075;
          } else if (app.type === 'sink') {
            // Lavaplatos: sobre el mesón
            y = counterTop;
          } else if (app.type === 'hood-under' || app.type === 'hood-island') {
            // Campana: sobre el mesón + gap
            y = counterTop + (HOOD_GAP / 1000);
          } else {
            // Default: desde zócalo
            y = zh + app.height / 2000;
          }

          // Posición en planta con el mismo sistema de coordenadas que la lista de cajas
          const applianceBox = boxes.find(bx => bx.applianceType === app.type && bx.wall === app.wall);
          let centerX: number, centerY: number;
          if (applianceBox) {
            centerX = applianceBox.x + applianceBox.sx / 2;
            centerY = applianceBox.y + applianceBox.sy / 2;
          } else {
            ({ x: centerX, y: centerY } = applianceCenter(app, wallA));
          }
          const [ax, az] = toWorldXZ(centerX, centerY);
          pos = [ax, y, az];
          if (app.wall === 'B') rot = [0, Math.PI / 2, 0];
          else if (app.wall === 'C') rot = [0, -Math.PI / 2, 0];

          return <Appliance3D key={idx} appliance={app} position={pos} rotation={rot} spaceHeight={spaceHeight} zh={zh} basinDepth={app.type === 'sink' ? SINK_BASIN_DEPTH : counterThickness}
            onGrab={onMoveAppliance ? (e) => {
              e.stopPropagation();
              setDragApp({ type: app.type, wall: app.wall as WallName, width: app.width, depth: app.depth, centerX, centerY, planeY: e.point.y });
            } : undefined}
          />;
        })}

        {/* Estufa y poceta de las islas y penínsulas: sobre su mesón, centradas en su mueble (Mueble Estufa / Mueble Poceta) */}
        {vis.appliances && modules.filter(m => m.islandId && (m.isStoveCabinet || m.isSinkCabinet)).map(m => {
          const mb = findModuleBox(boxes, m.uniqueId);
          const kind = m.isStoveCabinet ? 'stove' : 'sink';
          const tmpl = appliances.find(a => a.type === kind);
          if (!mb || !tmpl) return null;
          const slab = boxes.find(bx => bx.id === `counter-isla-${m.islandId}-0`);
          const top = slab ? (slab.z + slab.sz) / 1000 : (mb.z + mb.sz) / 1000;
          const [ax, az] = toWorldXZ(mb.x + mb.sx / 2, mb.y + mb.sy / 2);
          return <Appliance3D key={`isl-${m.uniqueId}`} appliance={{ ...tmpl, wall: 'Island', active: true }} position={[ax, kind === 'stove' ? top + 0.0075 : top, az]} rotation={[0, 0, 0]} spaceHeight={spaceHeight} zh={zh} basinDepth={kind === 'sink' ? SINK_BASIN_DEPTH : 0.02} faucetFront={kind === 'sink'} />;
        })}

        <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color={viewMode === 'plan' ? '#ffffff' : '#f8fafc'} />
        </mesh>
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.1} />
        {measureMode && <MeasureTool corners={measureCorners} measures={measures} onChange={setMeasures} />}
      </Canvas>

      {/* Esquinero en L: con dos módulos elegidos (clic + Shift + clic) se pueden unir; un esquinero elegido se puede separar */}
      {!measureMode && (() => {
        const mods = pair.map(id => modules.find(m => m.uniqueId === id));
        let info: { ok: boolean; msg: string; a?: KitchenModule; arm?: KitchenModule } | null = null;
        if (pair.length === 2 && mods[0] && mods[1]) {
          const a = mods[0].wall === 'A' ? mods[0] : mods[1].wall === 'A' ? mods[1] : undefined;
          const arm = a === mods[0] ? mods[1] : mods[0];
          if (!a || (arm.wall !== 'B' && arm.wall !== 'C')) info = { ok: false, msg: 'Elige un módulo del muro A y uno del brazo de la L (B o C).' };
          else if (a.type !== arm.type || (a.type !== 'LOWER' && a.type !== 'UPPER')) info = { ok: false, msg: 'Los dos módulos deben ser del mismo nivel: bajos con bajos o aéreos con aéreos.' };
          else if (a.cornerArm || arm.cornerArm) info = { ok: false, msg: 'Uno de los dos ya es un esquinero en L.' };
          else {
            const aAtCorner = arm.wall === 'B' ? a.positionX <= 20 : a.positionX + a.width >= wallA - 20;
            if (!aAtCorner || arm.positionX > 20) info = { ok: false, msg: 'Deben ser los dos módulos de la esquina: el primero del muro A y el primero del brazo.' };
            else info = { ok: true, msg: `Unir ${a.label} y ${arm.label} en un solo módulo esquinero en L`, a, arm };
          }
        }
        const single = pair.length < 2 && selectedId ? modules.find(m => m.uniqueId === selectedId) : undefined;
        if (!info && !(single && single.cornerArm)) return null;
        return (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[min(90%,34rem)] flex justify-center">
            <div className={`flex items-center justify-center flex-wrap gap-x-3 gap-y-2 w-max max-w-full px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white text-white text-[12px] font-black ${info ? (info.ok ? 'bg-amber-500' : 'bg-red-500') : 'bg-indigo-600'}`}>
              <span>{info ? info.msg : `Esquinero en L ${Math.round(single!.width)} × ${Math.round(single!.cornerArm!.width)}`}</span>
              {info?.ok && (
                <button className="px-3 py-1 rounded-xl bg-white text-amber-600 hover:bg-amber-50" onClick={() => { onJoinCorner?.(info!.a!.uniqueId, info!.arm!.uniqueId); setPair([]); setSelectedId(info!.a!.uniqueId); }}>Unir</button>
              )}
              {!info && (
                <button className="px-3 py-1 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50" onClick={() => { onSplitCorner?.(single!.uniqueId); setSelectedId(null); }}>Separar</button>
              )}
              {info && <button className="px-3 py-1 rounded-xl bg-white/25 hover:bg-white/40" onClick={() => setPair([])}>Cancelar</button>}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
