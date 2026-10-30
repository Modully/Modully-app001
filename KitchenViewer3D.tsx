
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Edges, PerspectiveCamera, OrthographicCamera, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { KitchenModule, Appliance, ApplianceType, LayoutType, WallName } from './types';
import { Box, findModuleBox, boxesBounds, applianceCenter, counterTopZ, CORNER_BLIND_OFFSET, WALL_THICKNESS } from './boxes';
import { COLORS } from './constants';
import { X, Plus, Ruler } from 'lucide-react';

// Constantes de elevación y espaciado (en milímetros)
const COUNTER_HEIGHT = 800;      // Alto del módulo base; el mesón queda a zócalo + este valor
const BACKSPLASH_GAP = 600;      // Espacio entre módulos bajos y aéreos
const HOOD_GAP = 650;            // Espacio sobre el mesón para campana
const TOP_MARGIN = 20;           // Espacio bajo el techo
const UPPER_BASE_HEIGHT = COUNTER_HEIGHT + BACKSPLASH_GAP; // Base de aéreos sobre el zócalo (zócalo + 800 + 600)


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
    <Html {...rest} transform distanceFactor={distanceFactor} style={{ ...rest.style, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </Html>
  );
};

/** Eje a lo largo del cual crece "positionX" en cada muro (A: +X de la escena; B y C: +Z) */
const wallAxis = (wall: string) => (wall === 'A' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));

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
  onSelect?: (id: string) => void;
  onOpenEditor?: (id: string) => void;
  onCloseEditor?: () => void;
  onApplyMeasures?: (id: string, m: { width: number; depth: number; height: number }) => void;
  onSetTop?: (id: string, height: number, topGap: number) => void;
  onSetVistos?: (id: string, v: SideConfig) => void;
  onSplitHorizontal?: (id: string) => void; // divide el módulo en dos a lo alto
  source?: KitchenModule; // módulo completo (la copia `module` puede venir con el cuerpo acortado por los vistos)
}

const Module3D: React.FC<Module3DProps> = ({ module, position, rotation = [0, 0, 0], onDelete, onSplit, onEditDimension, onDragPosition, onResizeEdge, controlsRef, hideLeftArrow, hideRightArrow, viewMode, selected, costado = 'right', editing, onSelect, onOpenEditor, onCloseEditor, onApplyMeasures, onSetTop, onSetVistos, onSplitHorizontal, source }) => {
  const isPlan = viewMode === 'plan';
  const [hovered, setHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const { camera, size } = useThree();
  const dragStart = useRef<{ along: number; moduleX: number } | null>(null);
  const edgeStart = useRef<{ side: 'left' | 'right'; moduleX: number; initialWidth: number; sx: number; sy: number } | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const color = isResizing ? '#10b981' : (isDragging ? '#4f46e5' : (hovered ? '#FFD700' : (COLORS[module.type] || '#cccccc')));

  // Arrastre del módulo completo: se mide a lo largo del eje del muro (X en el muro A, Z en B y C)
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isOverlay(e)) return;
    if (onDragPosition && controlsRef?.current && !isResizing) {
      setIsDragging(true);
      controlsRef.current.enabled = false; // Desactivar OrbitControls durante arrastre
      dragStart.current = { along: e.point.dot(wallAxis(module.wall)), moduleX: module.positionX };
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
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
      if (st.field === 'top') {
        // Borde superior: los bajos crecen o se acortan por arriba; los aéreos suben hasta el techo o bajan dejando
        // espacio arriba, y su borde inferior no se mueve
        const d = st.sign * pixelsToMm(dx, dy, st.sx, st.sy);
        const upper = module.type === 'UPPER';
        const gap = upper ? Math.max(0, Math.round((st.gap - d) / 5) * 5) : 0;
        const height = Math.min(2400, Math.max(100, Math.round((st.value + (upper ? st.gap - gap : d)) / 5) * 5));
        onSetTop?.(module.uniqueId, height, gap);
        return;
      }
      const [lo, hi] = st.field === 'depth' ? [100, 1200] : [100, 2400];
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
      : module.wall === 'A' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(module.wall === 'B' ? 1 : -1, 0, 0);
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
        setHover(false);
        document.body.style.cursor = 'auto';
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => { e.stopPropagation(); if (isDragging) endDrag(); if (!isOverlay(e)) onSelect?.(module.uniqueId); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (isOverlay(e)) return; onSelect?.(module.uniqueId); onOpenEditor?.(module.uniqueId); }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[module.width / 1000, module.height / 1000, module.depth / 1000]} />
      {/* Solo es transparente mientras se arrastra: un material transparente siempre se dibuja después de las
          aristas y las tapa. polygonOffset empuja las caras hacia atrás para que las aristas queden a la vista. */}
      <meshStandardMaterial
        color={color}
        opacity={isDragging || isResizing ? 0.7 : 1}
        transparent={isDragging || isResizing !== null}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
      <Edges color={isResizing ? "#10b981" : (isDragging ? "#6366f1" : (selected ? "#ef4444" : "#3b2a1a"))} linewidth={isDragging || isResizing || selected ? 2 : 1} />
      <Text
        position={[0, 0, module.depth / 2000 + 0.01]}
        fontSize={0.06}
        fontWeight="bold"
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {module.label || ''}
      </Text>

      {/* En planta no se ve la cara frontal: el nombre del módulo va sobre su cara superior */}
      {isPlan && (
        <Html position={[0, module.height / 2000 + 0.002, 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
          <div className="select-none whitespace-nowrap text-[10px] leading-none font-bold text-white" style={{ textShadow: '0 0 3px #000, 0 0 3px #000, 0 0 2px #000', fontSize: 14 }}>
            {module.label || ''}
          </div>
        </Html>
      )}

      {/* Controles en miniatura */}
      {/* Botón eliminar - esquina superior izquierda */}
      {onDelete && (
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
            style={{ transform: `translateX(${isPlan ? -100 : -52}px)` }}
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
      {onSplit && (
        <HtmlScaled
          position={[0, module.height / 2000 - 0.05, module.depth / 2000 + 0.01]}
          center
          distanceFactor={1}
          zIndexRange={[100, 0]}
        >
          <button
            data-overlay
            style={{ transform: `translateX(${isPlan ? 100 : 52}px)` }}
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
                  <Line points={[[sx, -hh, z], [sx, hh, z]]} color="#ef4444" lineWidth={2} />
                  <Line points={[[sx - 0.03, -hh, z], [sx + 0.03, -hh, z]]} color="#ef4444" lineWidth={2} />
                  <Line points={[[sx - 0.03, hh, z], [sx + 0.03, hh, z]]} color="#ef4444" lineWidth={2} />
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
                  <Line points={[[sx, y, -hd], [sx, y, hd]]} color="#ef4444" lineWidth={2} />
                  <Line points={[[sx - 0.03, y, -hd], [sx + 0.03, y, -hd]]} color="#ef4444" lineWidth={2} />
                  <Line points={[[sx - 0.03, y, hd], [sx + 0.03, y, hd]]} color="#ef4444" lineWidth={2} />
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
            <Html position={labelPos} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }} {...(viewMode === 'isometric' || viewMode === '3d' ? { transform: true, distanceFactor: 3 } : {})}>
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
            </Html>
          </>
        );
      })()}

      {/* Módulo seleccionado: flechas en los dos extremos para alargarlo o contraerlo (sustituyen a las esferas en planta) */}
      {selected && onResizeEdge && !isDragging && (['left', 'right'] as const).filter(side => !(side === 'left' ? hideLeftArrow : hideRightArrow)).map(side => (
        <Html
          key={`handle-${side}`}
          position={[(side === 'left' ? -1 : 1) * module.width / 2000, isPlan ? module.height / 2000 + 0.002 : 0, isPlan ? 0 : module.depth / 2000 + 0.03]}
          center
          zIndexRange={[110, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <button
            data-overlay
            onPointerDown={(e) => { e.stopPropagation(); handleEdgePointerDown(e, side); }}
            className={`pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg text-white text-[15px] leading-none font-black cursor-ew-resize ${isResizing === side ? 'bg-emerald-500' : 'bg-red-500 hover:bg-red-600'}`}
            title="Arrastrar para alargar o contraer"
          >
            {side === 'left' ? '◀' : '▶'}
          </button>
        </Html>
      ))}

      {/* "+" arriba del módulo seleccionado: lo divide en dos a lo alto */}
      {selected && onSplitHorizontal && !isPlan && (
        <Html position={[0, module.height / 2000 + 0.07, module.depth / 2000 + 0.02]} center zIndexRange={[105, 0]} style={{ pointerEvents: 'none' }}>
          <button
            data-overlay
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSplitHorizontal(module.uniqueId); }}
            className="pointer-events-auto flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[16px] leading-none font-black"
            title="Dividir este módulo en dos a lo alto"
          >
            +
          </button>
        </Html>
      )}

      {/* Flechas de fondo y alto. Planta: ▼ del frente = fondo. Frontal: ▲ y ▼ = alto. Isométrica/3D: ▲ y ▼ = alto y ↘ en el costado = fondo */}
      {selected && onApplyMeasures && !isDragging && (() => {
        const arrows: Array<{ key: string; pos: [number, number, number]; glyph: string; field: 'depth' | 'height' | 'top'; sign: number; title: string }> = [];
        const h = module.height / 2000;
        const front = module.depth / 2000 + 0.03;
        if (isPlan) {
          arrows.push({ key: 'depth', pos: [0, h + 0.002, module.depth / 2000], glyph: '▼', field: 'depth', sign: 1, title: 'Arrastrar para cambiar el fondo' });
        } else {
          arrows.push({ key: 'h-top', pos: [module.width / 2000 * 0.5, h + 0.03, front], glyph: '▲', field: 'top', sign: 1, title: 'Arrastrar para cambiar el alto' });
          arrows.push({ key: 'h-bottom', pos: [0, -h - 0.03, front], glyph: '▼', field: 'height', sign: -1, title: 'Arrastrar para cambiar el alto' });
          if (viewMode !== 'frontal') arrows.push({ key: 'depth', pos: [module.width / 2000, h * 0.6, 0], glyph: '↘', field: 'depth', sign: 1, title: 'Arrastrar para cambiar el fondo' });
        }
        return arrows.map(ar => (
          <Html key={ar.key} position={ar.pos} center zIndexRange={[110, 0]} style={{ pointerEvents: 'none' }}>
            <button
              data-overlay
              onPointerDown={(e) => { e.stopPropagation(); handleMeasurePointerDown(e, ar.field, ar.sign); }}
              className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg bg-red-500 hover:bg-red-600 text-white text-[15px] leading-none font-black cursor-ns-resize"
              title={ar.title}
            >
              {ar.glyph}
            </button>
          </Html>
        ));
      })()}

      {/* Doble clic: editor de largo, ancho (fondo) y alto */}
      {editing && onApplyMeasures && onCloseEditor && (
        <Html position={[0, module.height / 2000 + 0.01, 0]} center zIndexRange={[200, 0]} style={{ pointerEvents: 'none' }}>
          <ModuleEditor module={source ?? module} onApply={(m) => { onApplyMeasures(module.uniqueId, { width: m.width, depth: m.depth, height: m.height }); onSetVistos?.(module.uniqueId, m.sides); }} onClose={onCloseEditor} />
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
  wall: WallName;
}

const JunctionControl3D: React.FC<JunctionControl3DProps> = ({ leftModule, rightModule, position, rotation = [0, 0, 0], onResizeJunction, controlsRef, wall }) => {
  const { camera, size } = useThree();
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
        className={`w-24 h-24 rounded-full ${isResizing ? 'bg-green-200 border-green-600' : 'bg-purple-100 border-purple-600'} border-4 shadow-2xl flex items-center justify-center backdrop-blur-sm cursor-ew-resize hover:bg-purple-200 hover:scale-110 transition-all`}
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
        <div className="flex items-center gap-0" style={{ transform: `rotate(${arrowAngle}deg)` }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="w-1 h-8 bg-purple-600 rounded"></div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
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

const Appliance3D: React.FC<{ appliance: Appliance, position: [number, number, number], rotation?: [number, number, number], spaceHeight: number, zh: number, basinDepth?: number, onGrab?: (e: ThreeEvent<PointerEvent>) => void }> = ({ appliance, position, rotation = [0, 0, 0], spaceHeight, zh, basinDepth = 0.02, onGrab }) => {
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
            {/* Grifería detrás de la cubeta */}
            <group position={[0, 0, -(cd / 2 + rim + 0.03)]}>
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
          <mesh position={[0, 0.15, 0]} castShadow><cylinderGeometry args={[appliance.width / 2500, appliance.width / 2000, 0.25, 4]} rotation={[0, Math.PI / 4, 0]} /><meshStandardMaterial color="#ddd" metalness={0.7} /><Edges color="#888" /></mesh>
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
type CounterSides = { splashLeft: boolean; splashRight: boolean; waterfallLeft: boolean; waterfallRight: boolean };

const CounterEditor: React.FC<{
  box: Box;
  wall: string;
  settings: CounterSettings;
  sides: CounterSides;
  onApply: (s: CounterSettings, sides: CounterSides) => void;
  onClose: () => void;
}> = ({ box, wall, settings, sides, onApply, onClose }) => {
  // Largo = a lo largo del muro (lo definen los módulos); fondo = hacia el frente (módulos + voladizo)
  const length = Math.round(wall === 'A' ? box.sx : box.sy);
  const baseDepth = Math.round((wall === 'A' ? box.sy : box.sx) - settings.overhang); // fondo de los módulos
  const [vals, setVals] = useState({ depth: String(baseDepth + settings.overhang), thickness: String(settings.thickness), splashHeight: String(settings.splashHeight) });
  const [hasSplash, setHasSplash] = useState(settings.hasSplash);
  const [side, setSide] = useState(sides);
  const apply = () => {
    const n = (s: string, f: number) => { const x = parseFloat(s); return isNaN(x) ? f : x; };
    onApply({
      thickness: Math.max(10, Math.min(80, n(vals.thickness, settings.thickness))),
      overhang: Math.max(0, Math.min(100, n(vals.depth, baseDepth + settings.overhang) - baseDepth)),
      hasSplash,
      splashHeight: Math.max(20, Math.min(600, n(vals.splashHeight, settings.splashHeight))),
    }, side);
    onClose();
  };
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
    <div data-overlay data-module-editor className="pointer-events-auto w-48 p-2.5 space-y-1.5 rounded-xl bg-white border border-slate-300 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 truncate">{box.name}</div>
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
        Largo
        <span className="w-20 px-1.5 py-1 rounded bg-slate-100 text-[12px] font-black text-slate-500" title="Lo definen los módulos del tramo">{length}</span>
      </div>
      {field('depth', 'Ancho (fondo)')}
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
      </div>
      <div className="flex gap-1.5 pt-1">
        <button className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black" onClick={apply}>Aplicar</button>
        <button className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-black" onClick={onClose}>Cerrar</button>
      </div>
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
    shape.moveTo(x0, v0); shape.lineTo(x1, v0); shape.lineTo(x1, v1); shape.lineTo(x0, v1); shape.lineTo(x0, v0);
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
    return g;
  }, [box.x, box.y, box.sx, box.sy, box.sz, cutoutsKey, JSON.stringify(box.mitreBottom), box.mitreTop]);

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
        <Html position={[(box.x + box.sx / 2 - wallA / 2) / 1000, (box.z + box.sz) / 1000 + 0.02, offsetZ + (box.y + box.sy / 2) / 1000]} center zIndexRange={[200, 0]} style={{ pointerEvents: 'none' }}>
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
  wallA: number; wallB: number; wallC: number;
  offsetZ: number;
  controlsRef: React.RefObject<any>;
  onMove: (type: ApplianceType, wall: WallName, distance: number) => void;
  onEnd: () => void;
}> = ({ drag, layout, wallA, wallB, wallC, offsetZ, controlsRef, onMove, onEnd }) => {
  const { camera, gl, raycaster } = useThree();
  const latest = useRef({ layout, wallA, wallB, wallC, onMove, onEnd });
  latest.current = { layout, wallA, wallB, wallC, onMove, onEnd };

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
        if (L.layout === 'U_SHAPE' && cx > L.wallA / 2) wall = 'C';
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
  fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', 'hood-under': 'Campana', 'hood-island': 'Campana', pantry: 'Alacena',
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
    <Html position={a.clone().add(b).multiplyScalar(0.5)} center zIndexRange={[150, 0]} style={{ pointerEvents: 'none' }}>
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
  <Html position={p} center zIndexRange={[140, 0]} style={{ pointerEvents: 'none' }}>
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
        if (score < bestScore) { bestScore = score; best = c; }
      }
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
}> = ({ module, onApply, onClose }) => {
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
              <label key={key} className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-600" title={key === 'height' ? 'Sugerida: la altura del módulo' : undefined}>
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
  const base = 'whitespace-nowrap px-1.5 py-0.5 rounded border text-[11px] leading-none font-black shadow-sm';

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
      className={`${base} ${tone === 'white' ? 'bg-white text-slate-800 border-slate-400' : tone === 'red' ? 'bg-white text-red-600 border-red-500' : 'bg-indigo-50 text-indigo-700 border-indigo-300'} ${onCommit ? `pointer-events-auto cursor-text ${tone === 'white' ? 'hover:bg-slate-100' : tone === 'red' ? 'hover:bg-red-50' : 'hover:bg-indigo-100'}` : ''}`}
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
              <Line points={[pt(0, off), pt(target, off)]} color="#4f46e5" lineWidth={2.5} />
              <Line points={[pt(0, off - 60), pt(0, off + 60)]} color="#64748b" lineWidth={1.5} />
              <Line points={[pt(target, off - 60), pt(target, off + 60)]} color="#4f46e5" lineWidth={1.5} />
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
  layout: LayoutType;
  wallA: number;
  wallB: number;
  wallC: number;
  spaceHeight: number;
  floorWidth: number;
  floorLength: number;
  modules: KitchenModule[];
  boxes: Box[]; // lista única de cajas: fuente de verdad de la geometría
  appliances: Appliance[];
  hasIsland: boolean;
  island: { length: number; width: number; height: number; dx: number; dy: number };
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
  onEditCounter?: (s: CounterSettings, counterId: string, extras: { splashLeft?: boolean; splashRight?: boolean; waterfallLeft?: boolean; waterfallRight?: boolean }) => void;
  onSetModuleVistos?: (id: string, v: SideConfig) => void;
  onSplitHorizontal?: (id: string) => void;
  onDragModule?: (id: string, newPositionX: number) => void;
  onResizeEdge?: (id: string, side: 'left' | 'right', deltaX: number, initialWidth: number, initialPositionX: number) => void;
  onMoveAppliance?: (type: ApplianceType, wall: WallName, distance: number) => void;
  visibility?: { upper: boolean; lower: boolean; counter: boolean; appliances: boolean };
  collisions?: Box[]; // cajas que chocan: se marcan en rojo
  measureMode?: boolean; // cinta métrica activa: la escena solo se mira y se mide
  onResizeJunction?: (leftId: string, rightId: string, deltaX: number, initialLeftWidth: number, initialRightWidth: number, initialLeftPositionX: number, initialRightPositionX: number) => void;
}

export const KitchenViewer3D: React.FC<KitchenViewer3DProps> = ({
  layout, wallA, wallB, wallC, spaceHeight, floorWidth, floorLength, modules, boxes, appliances, hasIsland, island, viewMode, hasZocalo, zocaloHeight = 100,
  hasLeftClosure, hasRightClosure, onDeleteModule, onSplitModule, onEditModuleDimension, onEditModuleMeasure, onSetModuleTopEdge, onSetModuleVistos, onSplitHorizontal, counterSettings, onEditCounter, onDragModule, onResizeEdge, onMoveAppliance, visibility, collisions = [], measureMode = false, onResizeJunction
}) => {
  const controlsRef = useRef<any>(null);
  // Módulo seleccionado (clic) y módulo cuyo editor de medidas está abierto (doble clic)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const [editingCounter, setEditingCounter] = useState<string | null>(null);
  const [measures, setMeasures] = useState<Measure[]>([]);
  // Al salir de la cinta se borran las mediciones, y mientras se mide no hay selección
  useEffect(() => {
    if (!measureMode) setMeasures([]);
    else { setSelectedId(null); setEditingId(null); setSelectedCounter(null); setEditingCounter(null); }
  }, [measureMode]);
  // Qué se dibuja. Lo que se oculta se lleva sus herramientas: etiquetas de medida, botones X y +, flechas dobles y cotas.
  const vis = visibility ?? { upper: true, lower: true, counter: true, appliances: true };
  modules = modules.filter(m => (m.type === 'UPPER' ? vis.upper : m.type === 'LOWER' ? vis.lower : true));
  // Electrodoméstico que se está arrastrando (datos del momento en que se agarró)
  const [dragApp, setDragApp] = useState<ApplianceDrag | null>(null);
  const wallThickness = 0.15; // Grosor constante de 150mm
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
      for (const X of [b.x, b.x + b.sx]) for (const Y of [b.y, b.y + b.sy]) for (const Z of [b.z, b.z + b.sz]) {
        out.push(new THREE.Vector3((X - wallA / 2) / 1000, Z / 1000, offsetZ + Y / 1000));
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, wallA]);
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
  const dimExtra = viewMode === 'plan' && dimensionRows(appliances.filter(a => a.active)) > 0
    ? (DIM_BASE_OFFSET + (dimensionRows(appliances) - 1) * DIM_ROW_SPACING + 400) / 1000 : 0;
  const planFrame: ViewFrame = { cx: planCx, cy: 0, cz: planCz, w: (bounds.maxX - bounds.minX) / 1000 + 0.8 + 2 * dimExtra, h: (bounds.maxY - bounds.minY) / 1000 + 0.8 + 2 * dimExtra };
  const frontalFrame: ViewFrame = { cx: 0, cy: spaceHeight / 2000, cz: 0, w: baseWidth + 0.8, h: spaceHeight / 1000 + 0.6 };

  // Calcular junctions (uniones entre módulos adyacentes)
  // Formato: { leftModule, rightModule, leftId, rightId, wall }
  const junctions: { leftModule: KitchenModule; rightModule: KitchenModule; leftId: string; rightId: string; wall: WallName }[] = [];

  // Agrupar módulos por muro y tipo (UPPER o LOWER)
  const modulesByWallAndType: Record<string, KitchenModule[]> = {};
  modules.forEach(m => {
    const key = `${m.wall}-${m.type}`;
    if (!modulesByWallAndType[key]) modulesByWallAndType[key] = [];
    modulesByWallAndType[key].push(m);
  });

  // Para cada grupo, detectar módulos adyacentes
  Object.entries(modulesByWallAndType).forEach(([key, mods]) => {
    const [wall] = key.split('-');
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
          wall: wall as WallName
        });
      }
    }
  });

  return (
    // z-0 + isolate crean un contexto de apilamiento propio: las capas altas de los controles Html (hasta 100)
    // quedan contenidas dentro de la escena y no se pintan por encima de los paneles de herramientas (z-45).
    <div className="absolute inset-0 z-0 isolate overflow-hidden bg-slate-100">
      <Canvas
        shadows
        camera={{ position: [5, 4, 5], fov: 45 }}
        onPointerMissed={(e) => {
          // Un clic en vacío deselecciona; los clics sobre los controles HTML (editor, flechas) no cuentan
          if ((e.target as HTMLElement | null)?.closest?.('[data-overlay]')) return;
          setSelectedId(null);
          setEditingId(null);
          setSelectedCounter(null);
          setEditingCounter(null);
        }}
      >
        {isOrtho
          ? <OrthographicCamera makeDefault position={[0, 10, 0]} near={0.1} far={100} />
          : <PerspectiveCamera makeDefault position={[5, 4, 5]} fov={45} />}
        <ambientLight intensity={0.6} /><directionalLight position={[5, 10, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} /><Environment preset="apartment" /><CameraController viewMode={viewMode} plan={planFrame} frontal={frontalFrame} />
        {viewMode === 'plan' && vis.appliances && <PlanDimensions appliances={appliances} wallA={wallA} offsetZ={offsetZ} onMoveAppliance={onMoveAppliance} />}
        <ApplianceDragController
          drag={dragApp} layout={layout} wallA={wallA} wallB={wallB} wallC={wallC} offsetZ={offsetZ} controlsRef={controlsRef}
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
              <Edges color="#cbd5e1" />
            </mesh>
            <mesh position={[slabX, spaceHeight / 1000 + 0.06, slabZ]}>
              <boxGeometry args={[slabW, 0.12, slabD]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
              <Edges color="#cbd5e1" />
            </mesh>
          </>
        )}

        {boxes.filter(b => b.kind === 'wall').map(b => (
          <mesh key={b.id} position={boxCenter(b)} castShadow receiveShadow>
            <boxGeometry args={[b.sx / 1000, b.sz / 1000, b.sy / 1000]} />
            <meshStandardMaterial
              color={viewMode === 'plan' ? '#64748b' : (b.id.startsWith('closure') ? '#e2e8f0' : (b.wall === 'A' ? '#ffffff' : '#f8fafc'))}
              opacity={viewMode === 'plan' ? 0.6 : 1}
              transparent={viewMode === 'plan'}
            />
            <Edges color={viewMode === 'plan' ? '#1e293b' : '#94a3b8'} linewidth={viewMode === 'plan' ? 2 : 1} />
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
            sides={(() => {
              // Qué hay hoy a cada lado del tramo (visto desde el frente): inicio del muro en A y C, final en B
              const has = (kind: string, label: string) => boxes.some(x => x.id === `${kind}-${b.wall}-${b.id.split('-')[2]}-${label}`);
              const l = b.wall === 'B' ? 'final' : 'inicio';
              const r = b.wall === 'B' ? 'inicio' : 'final';
              return { splashLeft: has('salpicadero', l), splashRight: has('salpicadero', r), waterfallLeft: has('cascada', l), waterfallRight: has('cascada', r) };
            })()}
            onSelect={measureMode || !onEditCounter ? undefined : (id) => { setSelectedCounter(id); setSelectedId(null); setEditingId(null); }}
            onOpenEditor={setEditingCounter}
            onCloseEditor={() => setEditingCounter(null)}
            onApply={onEditCounter ? ((s, now) => {
              // Solo se guarda lo que el usuario cambió; lo demás sigue automático
              const before = { splashLeft: boxes.some(x => x.id === `salpicadero-${b.wall}-${b.id.split('-')[2]}-${b.wall === 'B' ? 'final' : 'inicio'}`), splashRight: boxes.some(x => x.id === `salpicadero-${b.wall}-${b.id.split('-')[2]}-${b.wall === 'B' ? 'inicio' : 'final'}`), waterfallLeft: boxes.some(x => x.id === `cascada-${b.wall}-${b.id.split('-')[2]}-${b.wall === 'B' ? 'final' : 'inicio'}`), waterfallRight: boxes.some(x => x.id === `cascada-${b.wall}-${b.id.split('-')[2]}-${b.wall === 'B' ? 'inicio' : 'final'}`) };
              const extras: { splashLeft?: boolean; splashRight?: boolean; waterfallLeft?: boolean; waterfallRight?: boolean } = {};
              (Object.keys(now) as Array<keyof typeof now>).forEach(k => { if (now[k] !== before[k]) extras[k] = now[k]; });
              onEditCounter(s, b.id, extras);
            }) : undefined}
          />
        ))}

        {modules.map((mod) => {
          const box = findModuleBox(boxes, mod.uniqueId);
          if (!box) return null;
          const pos = boxCenter(box);
          const rot: [number, number, number] = [0, mod.wall === 'B' ? Math.PI / 2 : mod.wall === 'C' ? -Math.PI / 2 : 0, 0];

          // Verificar si este módulo tiene junctions a la izquierda o derecha
          const hasLeftJunction = junctions.some(j => j.rightId === mod.uniqueId);
          const hasRightJunction = junctions.some(j => j.leftId === mod.uniqueId);

          return <Module3D
            key={mod.uniqueId}
            module={mod}
            onSplitHorizontal={(!measureMode && mod.height >= 200) ? onSplitHorizontal : undefined}
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
            selected={!measureMode && selectedId === mod.uniqueId}
            costado={(() => {
              const touches = (a: number, b: number) => Math.abs(a - b) <= 1;
              const same = modules.filter(o => o.uniqueId !== mod.uniqueId && o.wall === mod.wall && o.type === mod.type);
              const rightBlocked = same.some(o => touches(o.positionX, mod.positionX + mod.width));
              const leftBlocked = same.some(o => touches(o.positionX + o.width, mod.positionX));
              return rightBlocked && !leftBlocked ? 'left' : 'right';
            })()}
            editing={editingId === mod.uniqueId}
            onSelect={measureMode ? undefined : (id) => { setSelectedId(id); setSelectedCounter(null); setEditingCounter(null); }}
            onOpenEditor={measureMode ? undefined : setEditingId}
            onCloseEditor={() => setEditingId(null)}
            onSetTop={onSetModuleTopEdge}
            onApplyMeasures={(id, m) => {
              if (Math.round(m.depth) !== Math.round(mod.depth)) onEditModuleMeasure?.(id, 'depth', m.depth);
              if (Math.round(m.height) !== Math.round(mod.height)) onEditModuleMeasure?.(id, 'height', m.height);
              if (Math.round(m.width) !== Math.round(mod.width)) onEditModuleDimension?.(id, m.width);
            }}
          />;
        })}

        {/* Renderizar controles de junctions */}
        {!measureMode && junctions.map((junction, idx) => {
          const { leftModule, rightModule, wall } = junction;
          const leftBox = findModuleBox(boxes, leftModule.uniqueId);
          if (!leftBox) return null;

          // El control va en la cara frontal, en el punto de unión entre los dos módulos
          const front = Math.max(leftModule.depth, rightModule.depth);
          let X: number, Y: number;
          let junctionRot: [number, number, number] = [0, 0, 0];
          if (wall === 'A') {
            X = leftBox.x + leftBox.sx; Y = front;
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

        {vis.appliances && appliances.filter(a => a.active).map((app, idx) => {
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

          return <Appliance3D key={idx} appliance={app} position={pos} rotation={rot} spaceHeight={spaceHeight} zh={zh} basinDepth={counterThickness}
            onGrab={onMoveAppliance ? (e) => {
              e.stopPropagation();
              setDragApp({ type: app.type, wall: app.wall as WallName, width: app.width, depth: app.depth, centerX, centerY, planeY: e.point.y });
            } : undefined}
          />;
        })}

        <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color={viewMode === 'plan' ? '#ffffff' : '#f8fafc'} />
        </mesh>
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.1} />
        {measureMode && <MeasureTool corners={measureCorners} measures={measures} onChange={setMeasures} />}
      </Canvas>
    </div>
  );
};
