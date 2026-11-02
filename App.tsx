
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box, Settings, Layout, ShoppingCart, Trash2, Plus, Settings2,
  Sparkles, Printer, Save, RefreshCcw, Loader2, Wand2, Pencil,
  Square, Frame, BoxSelect, Globe, Eye, ChevronLeft, ChevronRight, Menu,
  Flame, Droplets, Refrigerator, Wind, Component, X, List, Layers, Info,
  ZoomIn, ZoomOut, Zap, Maximize, Ruler, ArrowRight, MoveHorizontal, Move,
  TowerControl as Tower, AlertCircle, CheckCircle2, ChevronDown, ToggleLeft as Toggle,
  Construction, Minus, Utensils, Target, ZapIcon, Layers2, Archive, Download, Table, Undo2, Redo2
} from 'lucide-react';
import {
  KitchenModule, LayoutType, WallName,
  Appliance, ApplianceType, UnitType, QuoteSummary, ConfigType, DoorType, BOM
} from './types';
import {
  MODULE_TEMPLATES, LABOR_CONFIG, COLORS
} from './constants';
import { KitchenViewer3D } from './KitchenViewer3D';
import { getAgentAdvice, type KitchenAgentContext } from './agentService';
import { generateBOM, exportBOMToExcel } from './bomService';
import { resizeSymmetric, snapToNeighbors } from './moduleResize';
import type { CounterExtras, Box as BoxData } from './boxes';
import type { IslandItem } from './types';
import { buildBoxes, boxesToJSON, armUpperOrigin, findCollisions, LOWER_DEPTH, UPPER_DEPTH, CORNER_BLIND_OFFSET, TOP_MARGIN, MAX_MODULE_WIDTH, SPLASH_HEIGHT_DEFAULT, COUNTER_THICKNESS_DEFAULT, COUNTER_OVERHANG_DEFAULT, FRIDGE_CLEARANCE, OVER_FRIDGE_DEPTH, DILATATION_GAP_DEFAULT, DILATATION_DEPTH_DEFAULT } from './boxes';

// Constantes de diseño técnico
const BASE_MODULE_HEIGHT = 800; // Alto del módulo base (MB). El mesón queda a zócalo + módulo base
const BACKSPLASH_GAP = 600; // Espacio estándar entre mueble bajo y aéreo
const HOOD_GAP = 650;       // Espacio específico para la campana (65cm)
const HOOD_SHORTEN = 85;    // El mueble sobre campana es 8.5cm más corto (regla validada)
// LOWER_DEPTH, UPPER_DEPTH, CORNER_BLIND_OFFSET y TOP_MARGIN viven en boxes.ts (fuente única de la geometría)
const INDUCTION_THICKNESS = 4; // Espesor visual de la estufa de inducción en mm

type OptimizationStrategy = 'efficiency' | 'standard' | 'detailed';

/** Icono de la forma de la cocina vista desde arriba: el muro es la línea fina y los muebles, la pieza gruesa */
const KitchenShapeIcon: React.FC<{ shape: LayoutType; size?: number }> = ({ shape, size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {shape === 'STRAIGHT' && (
      <>
        <path d="M2 6.5H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        <rect x="2" y="9.5" width="20" height="6" rx="1.2" fill="currentColor" />
      </>
    )}
    {shape === 'L_SHAPE' && (
      <>
        <path d="M2 21.5V3H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        <path d="M5 6H22V11.5H10.5V21.5H5Z" fill="currentColor" strokeLinejoin="round" />
      </>
    )}
    {shape === 'U_SHAPE' && (
      <>
        <path d="M2 21.5V3H22V21.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        <path d="M5 6H19V21.5H14.5V11.5H9.5V21.5H5Z" fill="currentColor" strokeLinejoin="round" />
      </>
    )}
  </svg>
);

/** Isla y península vistas desde arriba: la cocina en L (muros y mueble) con una península pegada al brazo y una isla suelta */
const IslandIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 21.5V3H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
    <path d="M5 6H22V9.5H8.5V21.5H5Z" fill="currentColor" strokeLinejoin="round" />
    <rect x="8.5" y="14.5" width="5.5" height="4.5" rx="0.6" fill="currentColor" />
    <rect x="16.5" y="13" width="5.5" height="6.5" rx="0.8" fill="currentColor" opacity="0.7" />
  </svg>
);

/** Campo de medida: se escribe libremente y se aplica con Enter o al salir del campo; Escape cancela */
/** Campo numérico que deja escribir libremente y aplica (con sus límites) al salir del campo o con Enter; así un mínimo no impide teclear */
const DeferredNumber: React.FC<{ value: number; onCommit: (n: number) => void; className?: string }> = ({ value, onCommit, className }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (apply: boolean) => {
    const n = draft === null ? NaN : parseFloat(draft);
    setDraft(null);
    if (apply && !isNaN(n)) onCommit(n);
  };
  return (
    <input
      type="number"
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
      onBlur={() => finish(true)}
      className={className}
    />
  );
};

const MeasureInput: React.FC<{ label: string; value: number; onCommit: (value: number) => void }> = ({ label, value, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (apply: boolean) => {
    const typed = draft === null ? NaN : parseFloat(draft);
    setDraft(null);
    if (apply && !isNaN(typed) && Math.round(typed) !== Math.round(value)) onCommit(typed);
  };
  return (
    <label className="block">
      <span className="block text-[7px] font-black text-slate-400 uppercase tracking-widest px-0.5">{label}</span>
      <input
        type="number"
        value={draft ?? Math.round(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
        onBlur={() => finish(true)}
        title={`${label} en mm`}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
      />
    </label>
  );
};

const BottomNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${active ? 'text-indigo-600' : 'text-gray-400'}`}
  >
    <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-indigo-50' : ''}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: active ? 2.5 : 2 })}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

const SidebarToolButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; collapsed: boolean; badge?: string }> = ({ active, onClick, icon, label, collapsed, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center rounded-2xl transition-all group relative shrink-0 ${
      collapsed ? 'w-12 h-12 justify-center' : 'w-full px-4 py-3 gap-3'
    } ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
        : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-indigo-500 border border-slate-100 shadow-sm'
    }`}
    title={collapsed ? label : undefined}
  >
    <div className="flex-shrink-0">{icon}</div>
    {!collapsed && (
      <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${active ? 'text-white' : 'text-slate-600'}`}>
        {label}
      </span>
    )}
    {badge && (
      <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
        {badge}
      </div>
    )}
  </button>
);

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-6">
      <Loader2 size={48} className="text-indigo-600 animate-spin" />
      <Sparkles size={24} className="text-amber-400 absolute -top-2 -right-2 animate-bounce" />
    </div>
    <h3 className="text-lg font-black text-slate-800 mb-2">Calculando Muro Exacto...</h3>
    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest max-w-xs">{message}</p>
    <div className="mt-8 flex gap-2">
      {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </div>
  </div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col modal-content animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[70vh] no-scrollbar">
          {children}
        </div>
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 active:scale-95 transition-all"
          >
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

const DimensionLine: React.FC<{ 
  x: number, 
  y: number, 
  width: number, 
  scale: number, 
  label: string, 
  onEdit?: (clientX: number, clientY: number) => void,
  color?: string, 
  orientation?: 'top' | 'bottom',
  isGap?: boolean
}> = ({ x, y, width, scale, label, onEdit, color = "#64748b", orientation = 'top', isGap = false }) => {
  if (width < 1) return null;
  const w = width * scale;
  const extOffset = 2;
  const dimOffset = 10;
  const tickSize = 3.5;
  
  const sign = orientation === 'top' ? -1 : 1;
  const dimY = y + (dimOffset * sign);
  const extYStart = y + (extOffset * sign);
  const extYEnd = y + ((dimOffset + 4) * sign);
  const textY = dimY + (orientation === 'top' ? -3 : 7);

  return (
    <g className="select-none group">
      <line x1={x} y1={extYStart} x2={x} y2={extYEnd} stroke={isGap ? "#f43f5e" : color} strokeWidth="0.3" />
      <line x1={x + w} y1={extYStart} x2={x + w} y2={extYEnd} stroke={isGap ? "#f43f5e" : color} strokeWidth="0.3" />
      <line x1={x} y1={dimY} x2={x + w} y2={dimY} stroke={isGap ? "#f43f5e" : color} strokeWidth="0.5" />
      <line x1={x - tickSize/2} y1={dimY + tickSize/2} x2={x + tickSize/2} y2={dimY - tickSize/2} stroke={isGap ? "#f43f5e" : color} strokeWidth="0.6" />
      <line x1={x + w - tickSize/2} y1={dimY + tickSize/2} x2={x + w + tickSize/2} y2={dimY - tickSize/2} stroke={isGap ? "#f43f5e" : color} strokeWidth="0.6" />
      
      <text 
        x={x + w / 2} 
        y={textY} 
        fontSize="4.5" 
        textAnchor="middle" 
        fill={isGap ? "#f43f5e" : (onEdit ? "#4f46e5" : color)} 
        className={`font-black transition-all ${onEdit ? 'cursor-pointer pointer-events-auto hover:scale-125' : ''}`}
        onDoubleClick={(e) => {
          if (onEdit) {
            e.stopPropagation();
            onEdit(e.clientX, e.clientY);
          }
        }}
      >
        {label}
      </text>
    </g>
  );
};

const VerticalDimensionLine: React.FC<{ 
  x: number, 
  y: number, 
  height: number, 
  scale: number, 
  label: string, 
  color?: string,
  orientation?: 'left' | 'right'
}> = ({ x, y, height, scale, label, color = "#64748b", orientation = 'left' }) => {
  if (height < 1) return null;
  const h = height * scale;
  const extOffset = 2;
  const dimOffset = 10;
  const tickSize = 3.5;
  
  const sign = orientation === 'left' ? -1 : 1;
  const dimX = x + (dimOffset * sign);
  const extXStart = x + (extOffset * sign);
  const extXEnd = x + ((dimOffset + 4) * sign);
  const textX = dimX + (orientation === 'left' ? -2 : 2);

  return (
    <g className="select-none">
      <line x1={extXStart} y1={y} x2={extXEnd} y2={y} stroke={color} strokeWidth="0.3" />
      <line x1={extXStart} y1={y - h} x2={extXEnd} y2={y - h} stroke={color} strokeWidth="0.3" />
      <line x1={dimX} y1={y} x2={dimX} y2={y - h} stroke={color} strokeWidth="0.5" />
      <line x1={dimX - tickSize/2} y1={y + tickSize/2} x2={dimX + tickSize/2} y2={y - tickSize/2} stroke={color} strokeWidth="0.6" />
      <line x1={dimX - tickSize/2} y1={y - h + tickSize/2} x2={dimX + tickSize/2} y2={y - h - tickSize/2} stroke={color} strokeWidth="0.6" />
      <text 
        x={textX} 
        y={y - h / 2} 
        fontSize="3.5" 
        textAnchor="middle" 
        fill={color} 
        dominantBaseline="middle"
        className="font-black"
        transform={`rotate(-90, ${textX}, ${y - h/2})`}
      >
        {label}
      </text>
    </g>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'design' | 'catalog' | 'quote' | 'config' | 'listado'>('design');
  const [activeView, setActiveView] = useState<'plan' | 'frontal' | 'isometric' | '3d'>('plan');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  const [isElementsPanelOpen, setIsElementsPanelOpen] = useState(false);
  const [isViewsPanelOpen, setIsViewsPanelOpen] = useState(false);
  const [isAccessoriesPanelOpen, setIsAccessoriesPanelOpen] = useState(false);
  const [isSpecialModulesPanelOpen, setIsSpecialModulesPanelOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isOptMenuOpen, setIsOptMenuOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('Ayúdame a mejorar la distribución del muro A.');
  const [agentResponse, setAgentResponse] = useState('El asistente puede revisar la distribución actual y proponer mejoras en tiempo real.');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  
  // Estado para medición auxiliar
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{x: number, y: number}[]>([]);
  const [snapPreview, setSnapPreview] = useState<{x: number, y: number} | null>(null);
  
  const [editingDimension, setEditingDimension] = useState<'wallA' | 'wallB' | 'wallC' | null>(null);
  const [tempDimValue, setTempDimValue] = useState('');

  const [activeWall, setActiveWall] = useState<WallName>('A');
  const [layout, setLayout] = useState<LayoutType>('STRAIGHT');
  
  const [floorWidth, setFloorWidth] = useState(4000);
  const [floorLength, setFloorLength] = useState(4000);
  
  const [wallA, setWallA] = useState(3600);
  const [wallB, setWallB] = useState(2400);
  const [wallC, setWallC] = useState(2400);
  const [spaceHeight, setSpaceHeight] = useState(2400);

  const [hasZocalo, setHasZocalo] = useState(true);
  const [zocaloHeight, setZocaloHeight] = useState(100);
  const [zocaloDepth, setZocaloDepth] = useState(500);
  // Herramienta de mesón: losa sobre los módulos bajos, con aberturas para poceta y estufa
  const [hasCounter, setHasCounter] = useState(true);
  const [counterThickness, setCounterThickness] = useState(COUNTER_THICKNESS_DEFAULT);
  const [counterOverhang, setCounterOverhang] = useState(COUNTER_OVERHANG_DEFAULT);
  // Salpicadero: parte del mesón, del mismo material, atrás y en los lados con muro o módulo más alto (altura habitual: 7 cm)
  const [hasSplash, setHasSplash] = useState(true);
  const [splashHeight, setSplashHeight] = useState(SPLASH_HEIGHT_DEFAULT);
  // Ajustes manuales por tramo de mesón: salpicadero izquierdo/derecho y cascada izquierda/derecha
  const [counterExtras, setCounterExtras] = useState<Record<string, CounterExtras>>({});
  // Dilatación: holgura contra los muros (por los descuadres) tapada con una pieza
  // La dilatación se pide por módulo (doble clic -> Dilatada); la automática contra muros laterales queda apagada
  const [hasDilatation, setHasDilatation] = useState(false);
  const [dilatationGap, setDilatationGap] = useState(DILATATION_GAP_DEFAULT);
  const [dilatationDepth, setDilatationDepth] = useState(DILATATION_DEPTH_DEFAULT);
  // Qué se ve en la escena (solo visual: no cambia el diseño, el despiece ni la exportación)
  const [visibility, setVisibility] = useState({ upper: true, lower: true, counter: true, appliances: true });
  const [hasLeftClosure, setHasLeftClosure] = useState(false);
  const [hasRightClosure, setHasRightClosure] = useState(false);

  const [modules, setModules] = useState<KitchenModule[]>([]);

  // Alacenas altas y torres de hornos: se puede pedir más de una de cada tipo (kind); cada una es una tarjeta con su propio módulo
  const [specialModules, setSpecialModules] = useState<Array<{ id: string; kind: 'tall-pantry' | 'tall-oven'; name: string; active: boolean; width: number; distance: number }>>([
    { id: 'tall-pantry', kind: 'tall-pantry', name: 'Alacena Alta', active: false, width: 600, distance: 0 },
    { id: 'tall-oven', kind: 'tall-oven', name: 'Torre de Hornos', active: false, width: 600, distance: 0 }
  ]);

  // BOM y configuración de producto
  const [lineType, setLineType] = useState<'Básica' | 'Media' | 'Alta'>('Media');
  const [faceColor, setFaceColor] = useState('Blanco');
  const [bom, setBom] = useState<BOM | null>(null);

  const [appliances, setAppliances] = useState<Appliance[]>([
    { type: 'fridge', wall: 'A', width: 700, height: 1800, depth: 800, distance: 0, active: false },
    { type: 'stove', wall: 'A', width: 600, height: 850, depth: 500, distance: 1000, active: false },
    { type: 'sink', wall: 'A', width: 550, height: 850, depth: 450, distance: 2000, active: false, faucetHeight: 400 },
    { type: 'hood-under', wall: 'A', width: 600, height: 120, depth: 450, distance: 1000, active: false },
  ]);

  // REGLAS TÉCNICAS DE ALTURA
  // El zócalo lo define el usuario (generalmente 100mm). El mesón se apoya sobre los módulos base
  // y el aéreo arranca 600mm sobre la cara superior del mesón.
  // Los 600mm hasta el aéreo se miden desde la cara superior del mesón: zócalo + módulo base + espesor del mesón
  const counterHeight = useMemo(() => (hasZocalo ? zocaloHeight : 0) + BASE_MODULE_HEIGHT + (hasCounter ? counterThickness : 0), [hasZocalo, zocaloHeight, hasCounter, counterThickness]);
  const currentBaseModuleHeight = BASE_MODULE_HEIGHT;
  const currentUpperModuleHeight = useMemo(() => spaceHeight - counterHeight - BACKSPLASH_GAP - TOP_MARGIN, [spaceHeight, counterHeight]);

  useEffect(() => {
    setModules(prev => prev.map(m => {
      if (m.heightLocked) return m; // alto editado a mano en el panel
      if (m.type === 'LOWER' && !m.isStoveCabinet) return { ...m, height: currentBaseModuleHeight };
      if (m.type === 'UPPER' && !m.isFridgeCabinet && !m.isHood) return { ...m, height: currentUpperModuleHeight };
      if (m.type === 'UPPER' && m.isHood) return { ...m, height: currentUpperModuleHeight - HOOD_SHORTEN };
      if (m.type === 'TALL') return { ...m, height: spaceHeight - TOP_MARGIN };
      return m;
    }));
  }, [currentBaseModuleHeight, currentUpperModuleHeight, spaceHeight]);

  const [hasIsland, setHasIsland] = useState(false);
  const [island] = useState({ length: 1800, width: 900, height: 900, dx: 1500, dy: 1000 });
  // Islas y penínsulas (Módulos especiales): medida general y dos cotas editables desde el punto 0
  const [islands, setIslands] = useState<IslandItem[]>([]);
  // Cocina en L: el brazo va a la izquierda (muro B) o a la derecha (muro C); se pregunta al elegir la forma
  const [lArm, setLArm] = useState<'left' | 'right'>('left');
  // Borrado con confirmación dentro de la app (isla o tarjeta especial pendiente de confirmar)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [islandDraft, setIslandDraft] = useState<{ kind: 'isla' | 'peninsula'; length: string; width: string }>({ kind: 'isla', length: '1800', width: '900' });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState('');

  // ===== Historial: deshacer (Ctrl+Z) y rehacer (Ctrl+Y) =====
  // Se guarda una foto del diseño cuando los cambios se estabilizan (500ms sin cambios), así un arrastre
  // largo o varias teclas seguidas cuentan como un solo paso.
  const designSnapshot = useMemo(() => ({
    layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth,
    modules, specialModules, appliances, hasIsland, lineType, faceColor,
  }), [layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth,
    modules, specialModules, appliances, hasIsland, lineType, faceColor]);
  type DesignSnapshot = typeof designSnapshot;
  // Se compara por valor: los efectos que recalculan alturas crean objetos nuevos con los mismos valores
  const snapshotKey = useMemo(() => JSON.stringify(designSnapshot), [designSnapshot]);

  const history = useRef<{ past: DesignSnapshot[]; future: DesignSnapshot[]; committed: DesignSnapshot | null; committedKey: string; timer: ReturnType<typeof setTimeout> | null }>(
    { past: [], future: [], committed: null, committedKey: '', timer: null }
  );
  const latestSnapshot = useRef({ snapshot: designSnapshot, key: snapshotKey });
  latestSnapshot.current = { snapshot: designSnapshot, key: snapshotKey };
  const [, setHistoryTick] = useState(0);
  const bumpHistory = () => setHistoryTick(t => t + 1);

  useEffect(() => {
    const h = history.current;
    if (h.committed === null) { // estado inicial: punto de partida del historial
      h.committed = designSnapshot;
      h.committedKey = snapshotKey;
      return;
    }
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    if (snapshotKey !== h.committedKey) {
      const tryCommit = () => {
        const cur = history.current;
        // Mientras el botón del ratón siga presionado (arrastre en curso) no se guarda ningún paso
        if (mouseDown.current) { cur.timer = setTimeout(tryCommit, 150); return; }
        if (cur.committed) cur.past.push(cur.committed);
        if (cur.past.length > 100) cur.past.shift();
        cur.committed = latestSnapshot.current.snapshot;
        cur.committedKey = latestSnapshot.current.key;
        cur.future = [];
        cur.timer = null;
        bumpHistory();
      };
      h.timer = setTimeout(tryCommit, 500);
    }
    bumpHistory();
  }, [snapshotKey]);

  const mouseDown = useRef(false);
  useEffect(() => {
    const down = () => { mouseDown.current = true; };
    const up = () => { mouseDown.current = false; };
    window.addEventListener('mousedown', down, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('blur', up);
    };
  }, []);

  // Si la forma de la cocina ya no tiene el muro B o C, los electrodomésticos que estaban ahí pasan al muro A
  useEffect(() => {
    setAppliances(prev => {
      const orphan = (a: Appliance) => (a.wall === 'B' && !(layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left'))) || (a.wall === 'C' && !(layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')));
      return prev.some(orphan) ? prev.map(a => (orphan(a) ? { ...a, wall: 'A' as WallName, distance: 0 } : a)) : prev;
    });
  }, [layout, lArm]);

  const applySnapshot = (snap: DesignSnapshot) => {
    setLayout(snap.layout); setWallA(snap.wallA); setWallB(snap.wallB); setWallC(snap.wallC);
    setSpaceHeight(snap.spaceHeight); setHasZocalo(snap.hasZocalo); setZocaloHeight(snap.zocaloHeight);
    setZocaloDepth(snap.zocaloDepth); setHasCounter(snap.hasCounter); setCounterThickness(snap.counterThickness);
    setCounterOverhang(snap.counterOverhang); setHasSplash(snap.hasSplash); setSplashHeight(snap.splashHeight); setCounterExtras(snap.counterExtras); setIslands(snap.islands); setLArm(snap.lArm); setHasLeftClosure(snap.hasLeftClosure); setHasRightClosure(snap.hasRightClosure);
    setHasDilatation(snap.hasDilatation); setDilatationGap(snap.dilatationGap); setDilatationDepth(snap.dilatationDepth);
    setModules(snap.modules); setSpecialModules(snap.specialModules); setAppliances(snap.appliances);
    setHasIsland(snap.hasIsland); setLineType(snap.lineType); setFaceColor(snap.faceColor);
  };

  const hasPendingChange = () => latestSnapshot.current.key !== history.current.committedKey;

  const undo = () => {
    const h = history.current;
    if (!h.committed) return;
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    let target: DesignSnapshot;
    if (hasPendingChange()) { // cambio aún sin confirmar: se revierte al último punto guardado
      target = h.committed;
      h.future.push(latestSnapshot.current.snapshot);
    } else if (h.past.length > 0) {
      target = h.past.pop()!;
      h.future.push(h.committed);
    } else {
      return;
    }
    h.committed = target;
    h.committedKey = JSON.stringify(target);
    applySnapshot(target);
    bumpHistory();
  };

  const redo = () => {
    const h = history.current;
    if (!h.committed || h.future.length === 0 || hasPendingChange()) return;
    const target = h.future.pop()!;
    h.past.push(h.committed);
    h.committed = target;
    h.committedKey = JSON.stringify(target);
    applySnapshot(target);
    bumpHistory();
  };

  const canUndo = history.current.past.length > 0 || (history.current.committed !== null && snapshotKey !== history.current.committedKey);
  const canRedo = history.current.future.length > 0 && snapshotKey === history.current.committedKey;

  // Atajos de teclado: Ctrl+Z deshace; Ctrl+Y o Ctrl+Mayús+Z rehacen (no se activan al escribir en un campo)
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingAppType, setDraggingAppType] = useState<ApplianceType | null>(null);
  const [draggingJunction, setDraggingJunction] = useState<{leftId: string, rightId: string} | null>(null);
  const [draggingEdge, setDraggingEdge] = useState<{moduleId: string, side: 'left' | 'right'} | null>(null);
  const dragStartInfo = useRef({ initialX: 0, mouseStartX: 0, initialWidthLeft: 0, initialWidthRight: 0, initialPosXRight: 0, initialWidth: 0 });

  const [editingDim, setEditingDim] = useState<{
    type: 'module' | 'gap';
    id: string;
    value: string;
    clientX: number;
    clientY: number;
  } | null>(null);

  const frontalScale = 320 / Math.max(wallA, wallB, wallC, 3000);
  const frontalHeightScale = 120 / spaceHeight;

  // Los módulos de una isla o península que ya no está activa (península fuera de una L) se guardan pero no cuentan
  const activeModules = useMemo(() => modules.filter(m => m.wall !== 'Island' || islands.some(i => i.id === m.islandId && (i.kind === 'isla' || layout === 'L_SHAPE'))), [modules, islands, layout]);
  const labeledModules = useMemo(() => activeModules.map((m, i) => ({ ...m, label: String.fromCharCode(65 + i) })), [activeModules]);

  /**
   * Calcula las coordenadas 3D (x, y, z) y dimensiones 3D para cada módulo
   * Sistema de coordenadas:
   * - X: Ancho horizontal del muro A (de izquierda a derecha)
   * - Y: Profundidad (alejándose del muro hacia el frente)
   * - Z: Altura vertical (desde el suelo hacia arriba)
   * 
   * Origen (0,0,0): Esquina superior izquierda del Muro A a nivel del suelo
   */
  const modulesWithCoords3D = useMemo(() => {
    return labeledModules.map(mod => {
      let x3d = 0, y3d = 0, z3d = 0;
      let width3d = mod.width;
      let height3d = mod.height;
      let depth3d = mod.type === 'UPPER' ? UPPER_DEPTH : LOWER_DEPTH;
      let rotation3d = 0;
      
      // Calcular Z (altura de montaje)
      if (mod.type === 'LOWER') {
        // Módulos bajos: Base a nivel del zócalo (o suelo si no hay zócalo)
        z3d = hasZocalo ? zocaloHeight : 0;
      } else if (mod.type === 'UPPER') {
        // Módulos superiores: "Cuelgan" del techo a 20mm (TOP_MARGIN)
        // Su base está en: spaceHeight - TOP_MARGIN - altura_del_módulo
        z3d = spaceHeight - TOP_MARGIN - mod.height;
      } else if (mod.type === 'TALL') {
        // Módulos altos: Base a nivel del zócalo (o suelo)
        z3d = hasZocalo ? zocaloHeight : 0;
      }
      
      // Calcular X, Y y rotación según el muro
      if (mod.wall === 'A') {
        // Muro A (horizontal): Orientación estándar
        x3d = mod.positionX;
        y3d = 0; // Pegado al muro
        rotation3d = 0;
        // Dimensiones estándar
        width3d = mod.width;
        depth3d = mod.type === 'UPPER' ? UPPER_DEPTH : LOWER_DEPTH;
        
      } else if (mod.wall === 'B') {
        // Muro B (perpendicular): Rotación 90° en sentido horario
        rotation3d = 90;
        
        if (layout === 'L_SHAPE') {
          // Layout L: Muro B en esquina derecha, proyecta hacia interior (izquierda)
          x3d = wallA - depth3d; // Posición X en el límite derecho del muro A, menos la profundidad
          y3d = CORNER_BLIND_OFFSET + mod.positionX; // Offset de esquina ciega + posición en el muro B
          
        } else if (layout === 'U_SHAPE') {
          // Layout U: Muro B en esquina izquierda, proyecta hacia interior (derecha)
          x3d = 0; // Posición X en el límite izquierdo
          y3d = CORNER_BLIND_OFFSET + mod.positionX; // Offset de esquina ciega + posición en el muro B
        }
        
        // En muro B: width se convierte en profundidad Y, depth se convierte en ancho X
        width3d = depth3d; // El "ancho" ahora es la profundidad del módulo
        depth3d = mod.width; // La "profundidad" ahora es el ancho original del módulo
        
      } else if (mod.wall === 'C') {
        // Muro C (perpendicular derecho en U): Rotación -90° (o 270°)
        rotation3d = -90;
        
        // Layout U: Muro C en esquina derecha, proyecta hacia interior (izquierda)
        x3d = wallA - depth3d; // Posición X en el límite derecho del muro A, menos la profundidad
        y3d = CORNER_BLIND_OFFSET + mod.positionX; // Offset de esquina ciega + posición en el muro C
        
        // En muro C: width se convierte en profundidad Y, depth se convierte en ancho X
        width3d = depth3d; // El "ancho" ahora es la profundidad del módulo
        depth3d = mod.width; // La "profundidad" ahora es el ancho original del módulo
      }
      
      return {
        ...mod,
        x3d,
        y3d,
        z3d,
        width3d,
        height3d,
        depth3d,
        rotation3d
      };
    });
  }, [labeledModules, wallA, wallB, wallC, layout, hasZocalo, zocaloHeight]);

  // Muros presentes según la forma: el brazo de la L es B (izquierda) o C (derecha); la U tiene los dos
  const armB = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left');
  const armC = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right');

  // La península solo existe en cocinas en L (va pegada al muro perpendicular: B a la izquierda o C a la derecha); si cambia
  // la forma queda guardada pero no se dibuja
  const activeIslands = useMemo(() => islands
    .filter(i => i.kind === 'isla' || layout === 'L_SHAPE')
    .map(i => (i.kind === 'peninsula' ? { ...i, dx: lArm === 'right' ? Math.max(0, wallA - i.length) : 0 } : i)), [islands, layout, lArm, wallA]);

  // Lista única de cajas: la escena 3D, el BOM y la exportación a Fusion leen la geometría de aquí
  const boxes = useMemo(() => buildBoxes({
    layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    modules: labeledModules, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands: activeIslands, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth,
  }), [layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth, labeledModules, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, activeIslands, lArm, hasLeftClosure, hasRightClosure, hasDilatation, dilatationGap, dilatationDepth]);

  // Regla: ningún módulo puede ocupar el mismo espacio que un electrodoméstico (ni otro módulo)
  const collisions = useMemo(() => findCollisions(boxes), [boxes]);
  const collidingBoxes = useMemo(() => {
    const seen = new Map<string, typeof boxes[number]>();
    collisions.forEach(([p, q]) => { seen.set(p.id, p); seen.set(q.id, q); });
    return [...seen.values()];
  }, [collisions]);

  const exportBoxesJSON = () => {
    const data = boxesToJSON(boxes, { layout, spaceHeight, zocaloHeight, hasZocalo });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cajas_cocina_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * FUNCIONES DE PROYECCIÓN 3D -> 2D
   * Convierten coordenadas 3D del modelo único a coordenadas 2D para cada vista
   */
  
  // Proyección para Vista de Planta (vista cenital: X-Y, ignora Z)
  const project3DToPlant = (x3d: number, y3d: number, width3d: number, depth3d: number, rotation3d: number) => {
    const planScale = 0.08; // mm a unidades SVG
    const originX = 50;
    const originY = 50;
    
    // Vista de planta ve el plano X-Y desde arriba
    if (rotation3d === 0) {
      // Muro A: orientación estándar - módulos pegados al muro
      return {
        x: originX + x3d * planScale,
        y: originY + 10, // Justo después del muro (10 unidades de espesor)
        width: width3d * planScale,
        height: depth3d * planScale // Profundidad del módulo (600mm o 300mm)
      };
    } else if (rotation3d === 90) {
      // Muro B rotado 90°: intercambiar dimensiones
      return {
        x: originX + x3d * planScale,
        y: originY + 10 + y3d * planScale, // La profundidad Y se convierte en posición Y en planta
        width: width3d * planScale,  // width3d ya contiene la profundidad del módulo
        height: depth3d * planScale  // depth3d ya contiene el ancho original
      };
    } else if (rotation3d === -90) {
      // Muro C rotado -90°: intercambiar dimensiones
      return {
        x: originX + x3d * planScale,
        y: originY + 10 + y3d * planScale,
        width: width3d * planScale,
        height: depth3d * planScale
      };
    }
    
    return {x: 0, y: 0, width: 0, height: 0};
  };
  
  // Proyección para Vista Frontal (vista frontal: X-Z para muro A, Y-Z para muros B/C)
  const project3DToFrontal = (mod: KitchenModule & {x3d: number, y3d: number, z3d: number, width3d: number, height3d: number, depth3d: number, rotation3d: number}) => {
    const frontalScale = 320 / Math.max(wallA, wallB, wallC, 3000);
    const frontalHeightScale = 120 / spaceHeight;
    const originX = 50;
    const floorY = 200;
    
    // Vista frontal muestra diferentes muros según el layout
    if (mod.wall === 'A') {
      // Muro A: proyección X-Z (horizontal-vertical)
      return {
        x: originX + mod.x3d * frontalScale,
        y: floorY - mod.z3d * frontalHeightScale - mod.height3d * frontalHeightScale,
        width: mod.width3d * frontalScale,
        height: mod.height3d * frontalHeightScale
      };
    } else if (mod.wall === 'B' || mod.wall === 'C') {
      // Muros B y C: proyección Y-Z (profundidad-vertical)
      // En vista frontal, la posición X se mapea desde la profundidad Y
      return {
        x: originX + mod.y3d * frontalScale,
        y: floorY - mod.z3d * frontalHeightScale - mod.height3d * frontalHeightScale,
        width: mod.depth3d * frontalScale, // depth3d contiene el ancho original del módulo
        height: mod.height3d * frontalHeightScale
      };
    }
    
    return {x: 0, y: 0, width: 0, height: 0};
  };

  // Largo útil de un muro para un módulo (en los brazos B y C se cuenta desde la esquina ciega)
  const moduleWallLength = (wall: WallName | 'Island', _type: string) => {
    if (wall === 'A') return wallA;
    if (wall === 'Island') return 99999;
    return (wall === 'B' ? wallB : wallC) - CORNER_BLIND_OFFSET;
  };

  // Ancho de un módulo escrito en su número de la escena: se amplía simétricamente y arrastra a sus vecinos.
  // Los límites son el muro, descontando la holgura de dilatación en los extremos que la tienen.
  const resizeModuleFromLabel = (id: string, desiredWidth: number) => {
    setModulesNoCollision(prev => {
      const m = prev.find(x => x.uniqueId === id);
      if (!m) return prev;
      const peers = prev.filter(p => p.wall === m.wall && p.islandId === m.islandId && p.type === m.type);
      const wallLength = m.wall === 'Island' ? (islands.find(i => i.id === m.islandId)?.length ?? 0) : moduleWallLength(m.wall, m.type);
      const gap = hasDilatation ? dilatationGap : 0;
      const firstStart = Math.min(...peers.map(p => p.positionX));
      const lastEnd = Math.max(...peers.map(p => p.positionX + p.width));
      const low = gap > 0 && Math.abs(firstStart - gap) <= 1 ? gap : Math.min(0, firstStart);
      const high = wallLength - (gap > 0 && lastEnd >= wallLength - gap - 1 ? gap : 0);
      return resizeSymmetric(prev, id, desiredWidth, { low, high });
    });
  };

  const applyDimensionChange = (type: 'module' | 'gap', id: string, value: number) => {
    let newVal = Math.round(value / 5) * 5;
    if (newVal < 0) newVal = 0;
    
    if (type === 'module') {
      setModules(prev => prev.map(m => {
        if (m.uniqueId === id) {
          // Validar que el módulo no sobrepase el límite del muro
          const wallWidth = moduleWallLength(m.wall, m.type);
          const maxWidth = wallWidth - m.positionX;
          const validatedWidth = Math.min(Math.max(5, newVal), maxWidth);
          return { ...m, width: validatedWidth };
        }
        return m;
      }));
    } else {
      setModules(prev => {
        const target = prev.find(m => m.uniqueId === id);
        if (!target) return prev;
        const tier = (target.type === 'UPPER' || target.isFridgeCabinet) ? 'upper' : 'lower';
        const sameTier = tier === 'upper' 
          ? prev.filter(m => m.wall === target.wall && (m.type === 'UPPER' || m.isFridgeCabinet))
          : [ ...prev.filter(m => m.wall === target.wall && m.type !== 'UPPER' && !m.isFridgeCabinet), ...appliances.filter(a => a.wall === target.wall && a.active && a.type !== 'hood-under') ];
        const sorted = sameTier.sort((a,b) => ('positionX' in a ? (a as any).positionX : (a as any).distance) - ('positionX' in b ? (b as any).positionX : (b as any).distance));
        const idx = sorted.findIndex(it => 'uniqueId' in it && (it as any).uniqueId === id);
        let prevXEnd = 0;
        if (idx > 0) { const prevIt = sorted[idx-1]; prevXEnd = ('positionX' in prevIt ? (prevIt as any).positionX : (prevIt as any).distance) + prevIt.width; }
        
        // Validar que el nuevo gap no haga que el módulo sobrepase el límite del muro
        const wallWidth = moduleWallLength(target.wall, target.type);
        const maxGap = wallWidth - prevXEnd - target.width;
        const validatedGap = Math.min(newVal, maxGap);
        const newX = prevXEnd + validatedGap;
        
        return prev.map(m => m.uniqueId === id ? { ...m, positionX: newX } : m);
      });
    }
    setEditingDim(null);
  };

  // Alto y fondo de un módulo, editados desde el panel (el ancho usa applyDimensionChange, que respeta el largo del muro)
  const updateModuleMeasure = (id: string, field: 'height' | 'depth', value: number) => {
    const v = Math.round(value / 5) * 5;
    setModulesNoCollision(prev => prev.map(m => {
      if (m.uniqueId !== id) return m;
      if (field === 'height') {
        // No puede pasar del techo (queda TOP_MARGIN libre) ni hundirse bajo el zócalo
        const maxHeight = spaceHeight - TOP_MARGIN - (hasZocalo ? zocaloHeight : 0);
        return { ...m, height: Math.min(Math.max(v, 100), maxHeight), heightLocked: true };
      }
      return { ...m, depth: Math.min(Math.max(v, 100), 1200) };
    }));
  };

  const editDimensionValue = (type: 'module' | 'gap', id: string, value: number, event?: React.MouseEvent) => {
    setEditingDim({
      type,
      id,
      value: value.toString(),
      clientX: event ? event.clientX : window.innerWidth / 2,
      clientY: event ? event.clientY : window.innerHeight / 2
    });
  };

  const splitModule = (id: string) => {
    setModules(prev => {
      const index = prev.findIndex(m => m.uniqueId === id);
      if (index === -1) return prev;
      const target = prev[index];
      const halfWidth = Math.round((target.width / 2) / 5) * 5;
      // Los vistos solo van en el costado exterior: la mitad del inicio conserva el del inicio y la otra el del final.
      // La profundidad (y el resto de la configuración) se copia al vecino nuevo.
      const leftAtStart = target.wall !== 'B';
      const startVisto = leftAtStart ? !!target.vistoLeft : !!target.vistoRight;
      const endVisto = leftAtStart ? !!target.vistoRight : !!target.vistoLeft;
      const withVisto = (m: typeof target, atStart: boolean, atEnd: boolean) => ({
        ...m,
        vistoLeft: leftAtStart ? atStart : atEnd,
        vistoRight: leftAtStart ? atEnd : atStart,
      });
      const mod1 = withVisto({ ...target, width: halfWidth }, startVisto, false);
      const mod2 = withVisto({ ...target, uniqueId: Math.random().toString(36).substr(2, 9), positionX: target.positionX + halfWidth, width: target.width - halfWidth }, false, endVisto);
      const next = [...prev]; next.splice(index, 1, mod1, mod2);
      return next;
    });
  };

  /**
   * Refactor: Lógica de modulación automática (Matemática) con Estrategias, SOBRENEVERA, MUEBLE ESTUFA, ALACENAS y MUEBLE CAMPANA
   */
  const runAutoModulation = useCallback((currentAppliances: Appliance[], strategy: OptimizationStrategy = 'efficiency') => {
    const newModules: KitchenModule[] = [];
    
    // Preservar módulos especiales activos (tipo TALL)
    const specialModulesActive = modules.filter(m => m.type === 'TALL');
    
    const widthsByStrategy: Record<OptimizationStrategy, number[]> = {
      'efficiency': [900, 600, 300], 
      'standard': [600, 900, 300],  
      'detailed': [300, 600, 900]   
    };

    const prioritizedWidths = widthsByStrategy[strategy];
    
    // Determinar qué muros procesar según el layout
    const wallsToProcess: WallName[] = ['A'];
    if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) wallsToProcess.push('B');
    if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) wallsToProcess.push('C');
    
    // Procesar cada muro
    wallsToProcess.forEach(currentWall => {
      // Para muros B y C, restar 600mm por el offset de esquina ciega para evitar colisión con Muro A
      const targetWidth = currentWall === 'A' ? wallA : currentWall === 'B' ? wallB - CORNER_BLIND_OFFSET : wallC - CORNER_BLIND_OFFSET;
      // Dilatación: en los extremos que tocan un muro. El inicio de A toca el muro B (L y U) o el muro auxiliar izquierdo
      // (recta); el final de A toca el muro C (U) o el auxiliar derecho; el final de cada brazo, su muro auxiliar.
      const closesStart = currentWall === 'A' && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left') || hasLeftClosure);
      const closesEnd = currentWall === 'A' ? layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right') || hasRightClosure : currentWall === 'B' ? hasLeftClosure : hasRightClosure;
      const startGap = hasDilatation && closesStart ? dilatationGap : 0;
      const endGap = hasDilatation && closesEnd ? dilatationGap : 0;
      const usableEnd = targetWidth - endGap;
      
      const fridge = currentAppliances.find(a => a.type === 'fridge' && a.active && a.wall === currentWall);
      const stove = currentAppliances.find(a => a.type === 'stove' && a.active && a.wall === currentWall);
      const sink = currentAppliances.find(a => a.type === 'sink' && a.active && a.wall === currentWall);
      const hood = currentAppliances.find(a => a.type === 'hood-under' && a.active && a.wall === currentWall);

      // Sobrenevera: cubre la nevera y sobresale FRIDGE_CLEARANCE por cada lado (ancho de la nevera + 10cm), centrada sobre ella,
      // sin salirse del muro. Si la nevera está en un extremo, se corre hacia adentro.
      const overFridgeWidth = fridge ? fridge.width + 2 * FRIDGE_CLEARANCE : 0;
      const overFridgeX = fridge
        ? Math.min(Math.max(fridge.distance - FRIDGE_CLEARANCE, startGap), Math.max(startGap, usableEnd - overFridgeWidth))
        : 0;
      // Módulo Obligatorio: SOBRENEVERA
      if (fridge) {
        const fridgeTemplate = MODULE_TEMPLATES.find(t => t.type === 'UPPER')!;
        const overFridgeHeight = spaceHeight - fridge.height - 40; 

        newModules.push({
          ...fridgeTemplate,
          uniqueId: `over-fridge-auto-${currentWall}`,
          name: 'Sobrenevera Técnica',
          wall: currentWall,
          positionX: overFridgeX,
          width: overFridgeWidth,
          depth: OVER_FRIDGE_DEPTH, // siempre más profunda que los demás aéreos (50 cm sugeridos)
          height: overFridgeHeight,
          isFridgeCabinet: true,
          quantity: 1,
          doorType: 'horizontal',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });
      }

      // Módulo Obligatorio: MUEBLE BAJO ESTUFA
      if (stove) {
        const lowerTemplate = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
        newModules.push({
          ...lowerTemplate,
          uniqueId: `stove-cabinet-auto-${currentWall}`,
          name: 'Mueble Estufa',
          wall: currentWall,
          positionX: stove.distance,
          width: stove.width,
          height: currentBaseModuleHeight,
          isStoveCabinet: true,
          quantity: 1,
          doorType: 'vertical',
          configType: 'drawers',
          hasPlateRack: false,
          drawerCount: 2
        });
      }

      // Módulo Obligatorio: MUEBLE BAJO POCETA (Mínimo 60cm)
      if (sink) {
        const lowerTemplate = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
        const sinkModuleWidth = Math.max(600, sink.width);
        newModules.push({
          ...lowerTemplate,
          uniqueId: `sink-cabinet-auto-${currentWall}`,
          name: 'Mueble Poceta',
          wall: currentWall,
          positionX: sink.distance,
          width: sinkModuleWidth,
          height: currentBaseModuleHeight,
          isSinkCabinet: true,
          quantity: 1,
          doorType: 'vertical',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });

        // Módulo Obligatorio: MUEBLE SUPERIOR SOBRE POCETA (mismas dimensiones)
        const upperTemplate = MODULE_TEMPLATES.find(t => t.type === 'UPPER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'UPPER')!;
        newModules.push({
          ...upperTemplate,
          uniqueId: `sink-upper-cabinet-auto-${currentWall}`,
          name: 'Mueble Superior Poceta',
          wall: currentWall,
          positionX: sink.distance,
          width: sinkModuleWidth,
          height: currentUpperModuleHeight,
          quantity: 1,
          doorType: 'vertical',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });
      }

      // Módulo Obligatorio: MUEBLE SOBRE CAMPANA (8cm más corto)
      if (hood) {
        const hoodTemplate = MODULE_TEMPLATES.find(t => t.type === 'UPPER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'UPPER')!;
        newModules.push({
          ...hoodTemplate,
          uniqueId: `hood-cabinet-auto-${currentWall}`,
          name: 'Mueble Campana',
          wall: currentWall,
          positionX: hood.distance,
          width: hood.width,
          height: currentUpperModuleHeight - HOOD_SHORTEN,
          isHood: true,
          quantity: 1,
          doorType: 'vertical',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });
      }
      
      const fillTier = (tier: 'upper' | 'lower') => {
        const specialModulesActiveForWall = specialModulesActive.filter(m => m.wall === currentWall);
        const tierObstacles = tier === 'lower'
          ? [
              ...currentAppliances.filter(a => a.active && a.wall === currentWall && a.type === 'pantry'),
              // Nevera con FRIDGE_CLEARANCE libres a cada lado (sin salirse del inicio del muro)
              ...(fridge ? [{
                distance: Math.max(0, fridge.distance - FRIDGE_CLEARANCE),
                width: fridge.distance + fridge.width + FRIDGE_CLEARANCE - Math.max(0, fridge.distance - FRIDGE_CLEARANCE),
              }] : []),
              ...(stove ? [{ distance: stove.distance, width: stove.width }] : []),
              ...(sink ? [{ distance: sink.distance, width: Math.max(600, sink.width) }] : []),
              ...specialModulesActiveForWall.map(m => ({ distance: m.positionX, width: m.width })),
              // La península pegada a este muro ocupa su espacio: ahí no van módulos del brazo (los pone la península)
              ...activeIslands.filter(i => i.kind === 'peninsula' && currentWall === (lArm === 'right' ? 'C' : 'B')).map(i => ({
                distance: Math.max(0, i.dy - CORNER_BLIND_OFFSET),
                width: Math.max(0, Math.min(i.dy + i.width, (currentWall === 'B' ? wallB : wallC)) - Math.max(i.dy, CORNER_BLIND_OFFSET)),
              }))
            ]
          : [
              ...(fridge ? [{ distance: overFridgeX, width: overFridgeWidth }] : []),
              ...(hood ? [{ distance: hood.distance, width: hood.width }] : []),
              ...(sink ? [{ distance: sink.distance, width: Math.max(600, sink.width) }] : []),
              ...currentAppliances.filter(a => a.active && a.wall === currentWall && (a.type === 'pantry')),
              ...specialModulesActiveForWall.map(m => ({ distance: m.positionX, width: m.width }))
            ];

        const solveGap = (gapWidth: number, startX: number, isUpper: boolean) => {
          let remaining = gapWidth; 
          let x = startX;
          
          // Si el gap es menor a 120mm (mínimo permitido), buscar módulo adyacente para extender
          if (remaining < 120) {
            if (remaining > 0) {
              // Buscar el último módulo en este tier para extenderlo
              const lastInTier = newModules.filter(m => m.wall === currentWall && m.type === (isUpper ? 'UPPER' : 'LOWER')).slice(-1)[0];
              if (lastInTier && lastInTier.positionX + lastInTier.width === x) { 
                lastInTier.width += remaining;
              } else {
                // Si no hay módulo adyacente, buscar módulo especial cercano para extender
                const nearbySpecial = specialModulesActiveForWall.find(sm => 
                  sm.positionX + sm.width === x || sm.positionX === x + remaining
                );
                if (nearbySpecial) {
                  nearbySpecial.width += remaining;
                }
              }
            }
            return;
          }
          
          while (remaining >= prioritizedWidths[prioritizedWidths.length - 1]) {
            let bestWidth = prioritizedWidths.find(w => w <= remaining) || prioritizedWidths[prioritizedWidths.length - 1];
            const template = MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER') && t.width === bestWidth) || MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER'))!;
            const finalH = isUpper ? currentUpperModuleHeight : currentBaseModuleHeight;
            
            newModules.push({ 
              ...template, 
              uniqueId: Math.random().toString(36).substr(2, 9), 
              wall: currentWall, 
              positionX: x, 
              width: bestWidth, 
              height: finalH, 
              quantity: 1, 
              doorType: 'vertical', 
              configType: bestWidth > 300 ? 'drawers' : 'doors', 
              hasPlateRack: false, 
              drawerCount: bestWidth > 300 ? 3 : 0 
            }); 
            x += bestWidth; 
            remaining -= bestWidth;
          }
          
          // Manejar el espacio restante
          if (remaining > 0) {
            if (remaining >= 120) {
              // Si el espacio restante es >= 120mm, crear un módulo del tamaño exacto
              const template = MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER'))!;
              const finalH = isUpper ? currentUpperModuleHeight : currentBaseModuleHeight;
              newModules.push({ 
                ...template, 
                uniqueId: Math.random().toString(36).substr(2, 9), 
                wall: currentWall, 
                positionX: x, 
                width: remaining, 
                height: finalH, 
                quantity: 1, 
                doorType: 'vertical', 
                configType: 'doors', 
                hasPlateRack: false, 
                drawerCount: 0 
              });
            } else {
              // Si es menor a 120mm, extender el último módulo adyacente
              const lastInTier = newModules.filter(m => m.wall === currentWall && m.type === (isUpper ? 'UPPER' : 'LOWER')).slice(-1)[0];
              if (lastInTier && lastInTier.positionX + lastInTier.width === x) { 
                lastInTier.width += remaining; 
              }
            }
          }
        };

        const sortedObstacles = [...tierObstacles].sort((a, b) => {
          const ax = 'distance' in a ? a.distance : (a as any).positionX;
          const bx = 'distance' in b ? b.distance : (b as any).positionX;
          return ax - bx;
        });
        
        let lastX = startGap; 
        sortedObstacles.forEach((obs, obsIdx) => { 
          const obsDist = 'distance' in obs ? obs.distance : (obs as any).positionX;
          const obsWidth = obs.width;
          
          // Crear gap antes del obstáculo
          if (obsDist > lastX) {
            const gapBeforeObstacle = obsDist - lastX;
            solveGap(gapBeforeObstacle, lastX, tier === 'upper');
          }
          
          // Avanzar después del obstáculo
          lastX = obsDist + obsWidth;
          
        }); 
        
        // Rellenar el espacio restante hasta el final del muro
        if (lastX < usableEnd) {
          const remainingGap = usableEnd - lastX;
          solveGap(remainingGap, lastX, tier === 'upper');
        }
      };

      fillTier('lower'); 
      fillTier('upper');

      // Esquina unida: en los brazos B y C el primer aéreo (el perpendicular al mueble de A) se alarga hacia la esquina
      // hasta tocar el aéreo de A. No cambia la profundidad de nadie y los cortes siguen alineados con los de los bajos.
      // El módulo alargado queda con posición negativa (empieza antes de la esquina ciega).
      if (currentWall !== 'A') {
        const extension = CORNER_BLIND_OFFSET - armUpperOrigin(newModules, wallA, currentWall as 'B' | 'C', hasDilatation ? dilatationGap : 0);
        const firstUpper = newModules.filter(m => m.wall === currentWall && m.type === 'UPPER').sort((p, q) => p.positionX - q.positionX)[0];
        // Solo si es un aéreo normal pegado al inicio (la sobrenevera y la campana conservan su ancho)
        if (extension > 0 && firstUpper && !firstUpper.isFridgeCabinet && !firstUpper.isHood && firstUpper.positionX <= 1) {
          firstUpper.positionX -= extension;
          firstUpper.width += extension;
        }
      }
    });
    
    // Agregar los módulos especiales preservados al final
    // Islas y penínsulas: una hilera de módulos bajos a lo largo de su largo, del fondo de su ancho, que cubre su espacio
    activeIslands.forEach(isl => {
      const minW = prioritizedWidths[prioritizedWidths.length - 1];
      let x = 0;
      let remaining = isl.length;
      const push = (w: number) => {
        const template = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === w) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
        newModules.push({
          ...template,
          uniqueId: Math.random().toString(36).substr(2, 9),
          wall: 'Island',
          islandId: isl.id,
          positionX: x,
          width: w,
          depth: isl.width,
          height: currentBaseModuleHeight,
          quantity: 1,
          doorType: 'vertical',
          configType: w > 300 ? 'drawers' : 'doors',
          hasPlateRack: false,
          drawerCount: w > 300 ? 3 : 0,
        });
        x += w;
        remaining -= w;
      };
      while (remaining >= minW) push(prioritizedWidths.find(w => w <= remaining) || minW);
      if (remaining >= 120) push(remaining);
      else if (remaining > 0) {
        // Sobra menos del mínimo: se suma al último módulo para que la hilera llegue justo al borde de la isla
        const last = newModules.filter(m => m.wall === 'Island' && m.islandId === isl.id).slice(-1)[0];
        if (last) last.width += remaining;
      }
    });

    // Ningún módulo pasa del ancho máximo (900 mm): si alguno lo supera (un resto sumado al último, el aéreo alargado hacia la
    // esquina...) se parte en partes iguales, de 5 en 5 mm
    const capped: KitchenModule[] = [];
    newModules.forEach(m => {
      if (m.width <= MAX_MODULE_WIDTH || m.type === 'TALL') { capped.push(m); return; }
      const n = Math.ceil(m.width / MAX_MODULE_WIDTH);
      const part = Math.floor(m.width / n / 5) * 5;
      let x = m.positionX;
      for (let i = 0; i < n; i++) {
        const w = i === n - 1 ? m.width - part * (n - 1) : part;
        capped.push({ ...m, uniqueId: i === 0 ? m.uniqueId : Math.random().toString(36).substr(2, 9), positionX: x, width: w, name: m.name.replace(/\d+mm/, `${w}mm`) });
        x += w;
      }
    });
    newModules.length = 0;
    newModules.push(...capped);

    setModules([...newModules, ...specialModulesActive]);
    setCounterExtras({}); // al optimizar se recalcula todo: los ajustes manuales del mesón (cascadas, salpicaderos laterales) se reinician
  }, [wallA, wallB, wallC, layout, lArm, activeIslands, currentBaseModuleHeight, currentUpperModuleHeight, spaceHeight, modules, activeWall, hasDilatation, dilatationGap, hasLeftClosure, hasRightClosure]);

  // Antes de optimizar se revisa que las islas y penínsulas no choquen entre sí ni con los muros de la cocina:
  // si hay choques, la optimización no se hace y se dice cuáles son
  const islandConflicts = (): string[] => {
    type R = { name: string; x0: number; x1: number; y0: number; y1: number };
    const overlap = (a: R, b: R) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1;
    const rooms: R[] = [{ name: 'los módulos del muro A', x0: 0, x1: wallA, y0: 0, y1: CORNER_BLIND_OFFSET }];
    if (armB) rooms.push({ name: 'los módulos del muro B', x0: 0, x1: CORNER_BLIND_OFFSET, y0: 0, y1: wallB });
    if (armC) rooms.push({ name: 'los módulos del muro C', x0: wallA - CORNER_BLIND_OFFSET, x1: wallA, y0: 0, y1: wallC });
    const label = (i: IslandItem) => (i.kind === 'peninsula' ? 'la península' : 'la isla');
    const out: string[] = [];
    const rects = activeIslands.map(i => ({ i, r: { name: label(i), x0: i.dx, x1: i.dx + i.length, y0: i.dy, y1: i.dy + i.width } as R }));
    rects.forEach(({ i, r }, idx) => {
      if (r.x1 > wallA + 1) out.push(`${label(i)} de ${i.length} × ${i.width} se sale del largo del muro A`);
      rooms.forEach(room => {
        // La península ocupa su espacio en el brazo: no cuenta como choque con el muro al que va pegada
        const ownArm = i.kind === 'peninsula' && room.name.endsWith(lArm === 'right' ? 'muro C' : 'muro B');
        if (!ownArm && overlap(r, room)) out.push(`${label(i)} de ${i.length} × ${i.width} choca con ${room.name}`);
      });
      rects.slice(idx + 1).forEach(other => { if (overlap(r, other.r)) out.push(`${label(i)} choca con ${label(other.i)}`); });
    });
    return out;
  };

  const handleMathematicalSuggestion = async (strategy: OptimizationStrategy) => {
    setIsOptMenuOpen(false);
    const conflicts = islandConflicts();
    if (conflicts.length > 0) {
      window.alert('No se puede optimizar la modulación mientras haya choques:\n\n• ' + conflicts.join('\n• ') + '\n\nMueve o cambia la medida de la isla o península y vuelve a intentarlo.');
      return;
    }
    setIsSuggesting(true);
    const msg = strategy === 'efficiency' ? "Estrategia de Alta Eficiencia..." : (strategy === 'standard' ? "Ajuste Estándar ISO..." : "Modulación Detallada Rítmica...");
    setSuggestMessage(msg);
    await new Promise(resolve => setTimeout(resolve, 800));
    runAutoModulation(appliances, strategy);
    setIsSuggesting(false); 
    setActiveTab('design');
  };

  const handleAgentRequest = async () => {
    setIsAgentLoading(true);
    setAgentResponse('Analizando la distribución actual...');

    const context: KitchenAgentContext = {
      wallA,
      wallB,
      wallC,
      layout,
      spaceHeight,
      modules,
      appliances,
      specialModules,
      activeView
    };

    const suggestion = await getAgentAdvice(context, agentPrompt);
    setAgentResponse(suggestion);
    setIsAgentLoading(false);
    setIsAgentPanelOpen(true);
  };

  const addModule = (templateId: string, wall: WallName | 'Island' = activeWall) => {
    const template = MODULE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    // Restar 600mm para muros B y C por el offset de esquina ciega
    const wallLength = moduleWallLength(wall, template.type);
    const isUpper = template.type === 'UPPER';
    const sameTierItems = isUpper ? modules.filter(m => m.wall === wall && (m.type === 'UPPER' || m.type === 'TALL')) : [ ...modules.filter(m => m.wall === wall && m.type !== 'UPPER'), ...appliances.filter(a => a.wall === wall && a.active && a.type !== 'hood-under') ];
    const currentWidth = sameTierItems.reduce((acc, it) => acc + it.width, 0);
    if (currentWidth + template.width > wallLength) { alert(`⚠️ SOBREPASO: El módulo excede el muro disponible.`); return; }
    
    const finalHeight = template.type === 'TALL' 
      ? (spaceHeight - TOP_MARGIN) 
      : (isUpper ? currentUpperModuleHeight : currentBaseModuleHeight);

    const newModule: KitchenModule = { ...template, uniqueId: Math.random().toString(36).substr(2, 9), wall, positionX: currentWidth, quantity: 1, height: finalHeight, doorType: 'vertical', configType: template.width > 300 ? 'drawers' : 'doors', hasPlateRack: false, drawerCount: 3 };
    setModules(prev => [...prev, newModule]); return newModule.uniqueId;
  };

  // Clic simple en la manija de una cara: el módulo se estira por esa cara hasta la siguiente cara de referencia (otro módulo,
  // electrodoméstico, el límite del muro o el techo). Se busca el mayor valor (de 5 en 5 mm) que no crea choques nuevos.
  const extendModuleFace = (id: string, face: 'left' | 'right' | 'front' | 'top' | 'bottom') => {
    const m = modules.find(x => x.uniqueId === id);
    if (!m) return;
    const zh = hasZocalo ? zocaloHeight : 0;
    const ceiling = spaceHeight - TOP_MARGIN;
    const before = collisionKeys(modules);
    const valid = (mods: KitchenModule[]) => { for (const k of collisionKeys(mods)) if (!before.has(k)) return false; return true; };
    const wallLength = m.wall === 'Island' ? (islands.find(i => i.id === m.islandId)?.length ?? 0) : moduleWallLength(m.wall, m.type);
    const withMod = (patch: Partial<KitchenModule>) => modules.map(x => (x.uniqueId === id ? { ...x, ...patch } : x));
    let lo = 0, hi = 0;
    let make: (v: number) => KitchenModule[] = () => modules;
    if (face === 'right') { lo = m.width; hi = Math.max(lo, wallLength - m.positionX); make = v => withMod({ width: v }); }
    else if (face === 'left') { lo = m.width; hi = Math.max(lo, m.positionX + m.width); make = v => withMod({ width: v, positionX: m.positionX + m.width - v }); }
    else if (face === 'front') { lo = m.depth; hi = 1200; make = v => withMod({ depth: v }); }
    else if (face === 'top' && m.type === 'UPPER') { lo = m.height; hi = m.height + (m.topGap ?? 0); make = v => withMod({ height: v, topGap: (m.topGap ?? 0) - (v - m.height), heightLocked: true }); }
    else if (face === 'top') { lo = m.height; hi = ceiling - zh; make = v => withMod({ height: v, heightLocked: true }); }
    else { lo = m.height; hi = ceiling - (m.topGap ?? 0) - zh; make = v => withMod({ height: v, heightLocked: true }); } // abajo (aéreos)
    // Búsqueda binaria del mayor valor válido (si crece por una cara, los choques solo aumentan)
    let a = 0, b = Math.max(0, Math.floor((hi - lo) / 5));
    while (a < b) {
      const mid = Math.ceil((a + b) / 2);
      if (valid(make(lo + mid * 5))) a = mid; else b = mid - 1;
    }
    if (a > 0) setModules(make(lo + a * 5));
  };

  // Esquinero en L: el módulo del muro A y el primero del brazo (B o C) pasan a ser un solo módulo con dos brazos
  const joinCornerModules = (aId: string, armId: string) => {
    setModules(prev => {
      const a = prev.find(m => m.uniqueId === aId);
      const arm = prev.find(m => m.uniqueId === armId);
      if (!a || !arm || (arm.wall !== 'B' && arm.wall !== 'C')) return prev;
      const joined: KitchenModule = { ...a, name: `Esquinero L ${Math.round(a.width)}×${Math.round(arm.width)}`, cornerArm: { wall: arm.wall, width: arm.width, depth: arm.depth, positionX: arm.positionX } };
      return prev.filter(m => m.uniqueId !== armId).map(m => (m.uniqueId === aId ? joined : m));
    });
  };

  // Largo del brazo de un esquinero en L (se escribe en la medida del frente del brazo): el módulo siguiente del brazo cede o gana
  // lo mismo, como con la flecha doble; si no hay siguiente, el brazo llega como mucho al final del muro
  const editCornerArmWidth = (id: string, width: number) => {
    setModulesNoCollision(prev => {
      const m = prev.find(x => x.uniqueId === id);
      if (!m?.cornerArm) return prev;
      const ca = m.cornerArm;
      const armStart = ca.positionX ?? 0;
      const oldEnd = armStart + ca.width;
      const next = prev.filter(x => x.wall === ca.wall && x.type === m.type && x.uniqueId !== id && Math.abs(x.positionX - oldEnd) <= 1).sort((p, q) => p.positionX - q.positionX)[0];
      let w = Math.max(100, Math.round(width / 5) * 5);
      if (next) {
        // El siguiente conserva al menos 100 mm y queda pegado al brazo
        w = Math.min(w, ca.width + next.width - 100);
      } else {
        w = Math.min(w, moduleWallLength(ca.wall, m.type) - armStart);
      }
      const delta = w - ca.width;
      return prev.map(x => {
        if (x.uniqueId === id) return { ...x, cornerArm: { ...ca, width: w } };
        if (next && x.uniqueId === next.uniqueId) return { ...x, positionX: x.positionX + delta, width: x.width - delta };
        return x;
      });
    });
  };

  // Separa un esquinero en L en dos módulos: el del muro A y el primero del brazo
  const splitCornerModule = (id: string) => {
    setModules(prev => {
      const m = prev.find(x => x.uniqueId === id);
      if (!m?.cornerArm) return prev;
      const ca = m.cornerArm;
      const first: KitchenModule = { ...m, name: `${m.type === 'UPPER' ? 'Aéreo' : 'Bajo'} ${Math.round(m.width)}mm`, cornerArm: undefined };
      const arm: KitchenModule = { ...m, uniqueId: Math.random().toString(36).substr(2, 9), wall: ca.wall, positionX: ca.positionX ?? 0, width: ca.width, depth: ca.depth, name: `${m.type === 'UPPER' ? 'Aéreo' : 'Bajo'} ${Math.round(ca.width)}mm`, cornerArm: undefined, vistoLeft: false, vistoRight: false, dilatLeft: false, dilatRight: false };
      return prev.flatMap(x => (x.uniqueId === id ? [first, arm] : [x]));
    });
  };

  // "+" del costado de un módulo (con el módulo seleccionado): lo divide en dos, uno frontal y otro posterior, del mismo ancho,
  // alto y posición. El posterior queda contra el muro; el frontal se corre el fondo del posterior (`depthOffset`).
  const splitModuleDepthwise = (id: string) => {
    setModules(prev => {
      const index = prev.findIndex(m => m.uniqueId === id);
      const target = prev[index];
      if (!target || target.depth < 200) return prev;
      const backDepth = Math.round((target.depth / 2) / 5) * 5;
      const frontDepth = target.depth - backDepth;
      const clean = { isFridgeCabinet: false, isHood: false, isStoveCabinet: false, isSinkCabinet: false };
      const back = { ...target, depth: backDepth };
      const front = { ...target, ...clean, uniqueId: Math.random().toString(36).substr(2, 9), depth: frontDepth, depthOffset: (target.depthOffset ?? 0) + backDepth } as KitchenModule;
      const next = [...prev];
      next.splice(index, 1, back, front);
      return next;
    });
  };

  // "+" arriba de un módulo (con el módulo seleccionado): lo divide en dos a lo alto, uno encima del otro, con el mismo
  // ancho, posición, profundidad y vistos. La mitad de abajo conserva el tipo y la de arriba queda colgada de la mitad
  // de abajo (aéreo con separación del techo). En un aéreo ambas mitades quedan colgadas del techo en su sitio.
  const splitModuleHorizontal = (id: string) => {
    setModules(prev => {
      const index = prev.findIndex(m => m.uniqueId === id);
      const target = prev[index];
      if (!target || target.wall === 'Island' || target.height < 200) return prev;
      const ceiling = spaceHeight - TOP_MARGIN;
      const lowerH = Math.round((target.height / 2) / 5) * 5;
      const upperH = target.height - lowerH;
      const clean = { isFridgeCabinet: false, isHood: false, isStoveCabinet: false, isSinkCabinet: false };
      let bottom: KitchenModule;
      let top: KitchenModule;
      if (target.type === 'UPPER') {
        const gap = target.topGap ?? 0;
        top = { ...target, ...clean, uniqueId: Math.random().toString(36).substr(2, 9), height: upperH, topGap: gap, heightLocked: true } as KitchenModule;
        bottom = { ...target, height: lowerH, topGap: gap + upperH, heightLocked: true };
      } else {
        const base = (hasZocalo ? zocaloHeight : 0) + lowerH; // cara de arriba de la mitad de abajo
        bottom = { ...target, height: lowerH, heightLocked: true };
        top = { ...target, ...clean, uniqueId: Math.random().toString(36).substr(2, 9), type: 'UPPER', name: `Aéreo ${Math.round(target.width)}mm`, height: upperH, topGap: Math.max(0, ceiling - base - upperH), heightLocked: true } as KitchenModule;
      }
      const next = [...prev];
      next.splice(index, 1, bottom, top);
      return next;
    });
  };

  // Mesón editado: ajustes globales y por tramo. La cascada ocupa un espesor del mesón dentro de la medida general, así que
  // al activarla el módulo del extremo se acorta ese espesor (y al quitarla se lo devuelve). Izquierda/derecha se ven desde
  // el frente: izquierda es el inicio del muro A y C, y el final del B.
  const applyCounterEdit = (s: { thickness: number; overhang: number; hasSplash: boolean; splashHeight: number }, counterId: string, extras: CounterExtras) => {
    const slab = boxes.find(bx => bx.id === counterId);
    if (slab) {
      const wall = slab.wall;
      const leftIsStart = wall !== 'B';
      const along = (bx: BoxData) => (wall === 'A' ? { a0: bx.x, a1: bx.x + bx.sx } : { a0: bx.y, a1: bx.y + bx.sy });
      const slabRange = along(slab);
      const lowersInRun = boxes.filter(bx => bx.kind === 'lower' && bx.wall === wall && bx.moduleId && (slab.islandId ? bx.islandId === slab.islandId : !bx.islandId) && along(bx).a0 >= slabRange.a0 - 1 && along(bx).a1 <= slabRange.a1 + 1);
      const changes: Array<{ atStart: boolean; on: boolean }> = [];
      if (extras.waterfallLeft !== undefined) changes.push({ atStart: leftIsStart, on: extras.waterfallLeft });
      if (extras.waterfallRight !== undefined) changes.push({ atStart: !leftIsStart, on: extras.waterfallRight });
      if (changes.length && lowersInRun.length) {
        const first = lowersInRun.reduce((p, q) => (along(q).a0 < along(p).a0 ? q : p));
        const last = lowersInRun.reduce((p, q) => (along(q).a1 > along(p).a1 ? q : p));
        setModules(prev => prev.map(m => {
          let next = m;
          changes.forEach(({ atStart, on }) => {
            const target = atStart ? first : last;
            if (m.uniqueId !== target.moduleId) return;
            const t = on ? s.thickness : counterThickness; // al quitarla se devuelve el espesor con el que se activó
            const dw = on ? -t : t;
            if (next.width + dw < 100) return;
            next = { ...next, width: next.width + dw, positionX: atStart ? next.positionX - dw : next.positionX };
          });
          return next;
        }));
      }
    }
    setCounterThickness(s.thickness); setCounterOverhang(s.overhang); setHasSplash(s.hasSplash); setSplashHeight(s.splashHeight);
    setCounterExtras(prev => ({ ...prev, [counterId]: { ...prev[counterId], ...extras } }));
  };

  const deleteModule = (id: string) => { setModules(prev => prev.filter(m => m.uniqueId !== id)); };

  // Regla: un cambio hecho a mano (arrastrar, alargar, fondo, alto) no se aplica si crea un choque nuevo con otro módulo
  // o con un electrodoméstico. Los choques que ya existían no bloquean.
  const collisionKeys = (mods: KitchenModule[]) => new Set(findCollisions(buildBoxes({
    layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    modules: mods, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands: activeIslands, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth,
  })).map(([p, q]) => `${p.id}|${q.id}`));
  const setModulesNoCollision = (update: (prev: KitchenModule[]) => KitchenModule[]) => {
    setModules(prev => {
      const next = update(prev);
      if (next === prev) return prev;
      const before = collisionKeys(prev);
      for (const k of collisionKeys(next)) if (!before.has(k)) return prev;
      return next;
    });
  };

  // Borde superior de un módulo arrastrado con la flecha ▲: el alto y, en los aéreos, la separación con el techo
  const setModuleTopEdge = (id: string, height: number, topGap: number) => {
    setModulesNoCollision(prev => prev.map(m => m.uniqueId === id ? { ...m, height: Math.round(height), topGap: Math.round(topGap), heightLocked: true } : m));
  };

  // Vistos y dilatadas de un módulo (se piden al hacer doble clic sobre él)
  const setModuleVistos = (id: string, v: {
    visto: { left: boolean; right: boolean; thickness: number };
    dilat: { left: boolean; right: boolean; thickness: number; depth: number; height?: number };
  }) => {
    // Ambas piezas salen de la medida del módulo (900 con visto de 15 = módulo de 885 + visto de 15): al activarlas o quitarlas
    // se resta o se devuelve el espesor; si van al inicio del muro, el módulo también se corre ese espesor.
    setModules(prev => prev.map(m => {
      if (m.uniqueId !== id) return m;
      const leftAtStart = m.wall !== 'B';
      const side = (vl: boolean, vr: boolean, vt: number, dl: boolean, dr: boolean, dt: number) => ({
        start: ((leftAtStart ? vl : vr) ? vt : 0) + ((leftAtStart ? dl : dr) ? dt : 0),
        end: ((leftAtStart ? vr : vl) ? vt : 0) + ((leftAtStart ? dr : dl) ? dt : 0),
      });
      const before = side(!!m.vistoLeft, !!m.vistoRight, m.vistoThickness ?? 15, !!m.dilatLeft, !!m.dilatRight, m.dilatThickness ?? 15);
      const after = side(v.visto.left, v.visto.right, v.visto.thickness, v.dilat.left, v.dilat.right, v.dilat.thickness);
      const delta = (after.start + after.end) - (before.start + before.end);
      if (m.width - delta < 100) return m;
      return {
        ...m,
        vistoLeft: v.visto.left, vistoRight: v.visto.right, vistoThickness: v.visto.thickness,
        dilatLeft: v.dilat.left, dilatRight: v.dilat.right, dilatThickness: v.dilat.thickness, dilatDepth: v.dilat.depth, dilatHeight: v.dilat.height,
        width: m.width - delta, positionX: m.positionX + (after.start - before.start),
      };
    }));
  };

  const handleDragModule3D = (id: string, newPositionX: number) => {
    setModulesNoCollision(prev => snapToNeighbors(prev.map(m => m.uniqueId === id ? { ...m, positionX: Math.round(newPositionX) } : m), id, 'move'));
  };

  const handleResizeEdge3D = (id: string, side: 'left' | 'right', deltaX: number, initialWidth: number, initialPositionX: number) => {
    setModulesNoCollision(prev => snapToNeighbors(prev.map(m => {
      if (m.uniqueId !== id) return m;
      
      if (side === 'left') {
        // Redimensionar desde el borde izquierdo
        const newWidth = Math.max(100, Math.round((initialWidth - deltaX) / 5) * 5);
        const positionChange = initialWidth - newWidth;
        return { ...m, positionX: Math.max(0, initialPositionX + positionChange), width: newWidth };
      } else {
        // Redimensionar desde el borde derecho
        const newWidth = Math.max(100, Math.round((initialWidth + deltaX) / 5) * 5);
        return { ...m, width: newWidth };
      }
    }), id, side));
  };

  const handleResizeJunction3D = (
    leftId: string, 
    rightId: string, 
    deltaX: number, 
    initialLeftWidth: number, 
    initialRightWidth: number, 
    initialLeftPositionX: number, 
    initialRightPositionX: number
  ) => {
    // La unión solo se mueve mientras ambos módulos queden de al menos 100mm; así el ancho total no cambia
    const MIN_WIDTH = 100;
    const clamped = Math.min(Math.max(deltaX, MIN_WIDTH - initialLeftWidth), initialRightWidth - MIN_WIDTH);
    const change = Math.round(clamped / 5) * 5; // snap a 5mm
    setModules(prev => prev.map(m => {
      // El brazo de un esquinero en L (id "<módulo>:arm") es el lado izquierdo de la unión: cambia el largo de su brazo
      if (leftId.endsWith(':arm') && m.uniqueId === leftId.slice(0, -4) && m.cornerArm) {
        return { ...m, cornerArm: { ...m.cornerArm, width: initialLeftWidth + change } };
      }
      if (m.uniqueId === leftId) {
        // El módulo izquierdo crece/decrece desde el borde derecho
        return { ...m, width: initialLeftWidth + change };
      } else if (m.uniqueId === rightId) {
        // El módulo derecho cede o gana lo mismo y su borde izquierdo se mueve con la unión
        return { ...m, positionX: initialRightPositionX + change, width: initialRightWidth - change };
      }
      return m;
    }));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isMeasureMode) return; // No interferir con el modo de medición
    if ((e.target as any).closest('.draggable-element') || (e.target as any).closest('.modal-content') || (e.target as any).closest('.module-action-btn') || (e.target as any).closest('.junction-handle') || (e.target as any).closest('.pointer-events-auto') || (e.target as any).closest('.edge-handle')) return;
    isDraggingCanvas.current = true; lastPoint.current = { x: e.clientX, y: e.clientY }; (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isMeasureMode) return; // No interferir con el modo de medición
    if (isDraggingCanvas.current) { const dx = (e.clientX - lastPoint.current.x); const dy = (e.clientY - lastPoint.current.y); setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); lastPoint.current = { x: e.clientX, y: e.clientY }; return; }
    const deltaX = (e.clientX - dragStartInfo.current.mouseStartX) / transform.scale / frontalScale;
    const snapThreshold = 40; 
    if (draggingEdge) {
      const { moduleId, side } = draggingEdge;
      setModules(prev => prev.map(m => {
        if (m.uniqueId !== moduleId) return m;
        const tier = (m.type === 'UPPER' || m.isFridgeCabinet) ? 'upper' : 'lower';
        const neighbors = (tier === 'upper' ? prev.filter(n => n.wall === m.wall && (n.type === 'UPPER' || n.isFridgeCabinet)) : [ ...prev.filter(n => n.wall === m.wall && n.type !== 'UPPER' && !n.isFridgeCabinet), ...appliances.filter(a => a.wall === m.wall && a.active && a.type !== 'hood-under') ]).filter(it => (it as any).uniqueId !== moduleId);
        if (side === 'left') {
          let rawNewX = dragStartInfo.current.initialX + deltaX; let minX = 0;
          neighbors.forEach(n => { const nxEnd = ('positionX' in n ? (n as KitchenModule).positionX : (n as Appliance).distance) + n.width; if (nxEnd <= dragStartInfo.current.initialX + 5) { minX = Math.max(minX, nxEnd); if (Math.abs(rawNewX - nxEnd) < snapThreshold) rawNewX = nxEnd; } });
          if (Math.abs(rawNewX) < snapThreshold) rawNewX = 0;
          let finalX = Math.round(Math.max(minX, Math.min(m.positionX + m.width - 5, rawNewX)) / 5) * 5;
          return { ...m, positionX: finalX, width: m.positionX + m.width - finalX };
        } else {
          let rawNewXEnd = dragStartInfo.current.initialX + dragStartInfo.current.initialWidth + deltaX; let maxX = wallA;
          neighbors.forEach(n => { const nxStart = 'positionX' in n ? (n as KitchenModule).positionX : (n as Appliance).distance; if (nxStart >= dragStartInfo.current.initialX + dragStartInfo.current.initialWidth - 5) { maxX = Math.min(maxX, nxStart); if (Math.abs(rawNewXEnd - nxStart) < snapThreshold) rawNewXEnd = nxStart; } });
          if (Math.abs(rawNewXEnd - wallA) < snapThreshold) rawNewXEnd = wallA;
          let finalXEnd = Math.round(Math.max(m.positionX + 5, Math.min(maxX, rawNewXEnd)) / 5) * 5;
          return { ...m, width: finalXEnd - m.positionX };
        }
      }));
      return;
    }
    if (draggingJunction) {
      const { leftId, rightId } = draggingJunction;
      let newWidthLeft = Math.round((dragStartInfo.current.initialWidthLeft + deltaX) / 5) * 5;
      if (newWidthLeft < 5) newWidthLeft = 5;
      setModules(prev => prev.map(m => {
        if (m.uniqueId === leftId) return { ...m, width: newWidthLeft };
        if (m.uniqueId === rightId) return { ...m, positionX: dragStartInfo.current.initialPosXRight + (newWidthLeft - dragStartInfo.current.initialWidthLeft), width: dragStartInfo.current.initialWidthLeft + dragStartInfo.current.initialWidthRight - newWidthLeft };
        return m;
      }));
      return;
    }
    if (draggingId || draggingAppType) {
      let rawNewX = dragStartInfo.current.initialX + deltaX;
      const activeModule = draggingId ? modules.find(m => m.uniqueId === draggingId) : null;
      const activeApp = draggingAppType ? appliances.find(a => a.type === draggingAppType) : null;
      const width = activeModule ? activeModule.width : (activeApp ? activeApp.width : 0);
      const wall = activeModule ? activeModule.wall : (activeApp ? activeApp.wall : 'A');
      const tier = activeModule ? (activeModule.type === 'UPPER' || activeModule.isFridgeCabinet ? 'upper' : 'lower') : 'lower';
      const neighbors = (tier === 'upper' ? modules.filter(m => m.wall === wall && (m.type === 'UPPER' || m.isFridgeCabinet)) : [ ...modules.filter(m => m.wall === wall && m.type !== 'UPPER' && !m.isFridgeCabinet), ...appliances.filter(a => a.wall === wall && a.active && a.type !== 'hood-under') ]).filter(it => draggingId ? (it as any).uniqueId !== draggingId : (it as any).type !== draggingAppType);
      
      // Obtener el ancho disponible del muro, restando 600mm para muros B y C (offset de esquina ciega)
      const wallWidth = wall === 'A' ? wallA : wall === 'B' ? wallB - CORNER_BLIND_OFFSET : wallC - CORNER_BLIND_OFFSET;
      let minX = 0, maxX = wallWidth - width;
      
      neighbors.forEach(n => {
        const nx = 'positionX' in n ? (n as KitchenModule).positionX : (n as Appliance).distance;
        if (nx + n.width <= dragStartInfo.current.initialX + 5) minX = Math.max(minX, nx + n.width);
        if (nx >= dragStartInfo.current.initialX + width - 5) maxX = Math.min(maxX, nx - width);
        if (Math.abs(rawNewX - (nx + n.width)) < snapThreshold) rawNewX = nx + n.width;
        if (Math.abs((rawNewX + width) - nx) < snapThreshold) rawNewX = nx - width;
      });
      if (Math.abs(rawNewX) < snapThreshold) rawNewX = 0;
      if (Math.abs(rawNewX + width - wallWidth) < snapThreshold) rawNewX = wallWidth - width;
      let finalX = Math.round(Math.max(minX, Math.min(maxX, rawNewX)) / 5) * 5;
      if (draggingId) setModules(prev => prev.map(m => m.uniqueId === draggingId ? { ...m, positionX: finalX } : m));
      else if (draggingAppType) setAppliances(prev => prev.map(a => a.type === draggingAppType ? { ...a, distance: finalX } : a));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => { 
    if (isMeasureMode) return; // No interferir con el modo de medición
    isDraggingCanvas.current = false; 
    setDraggingId(null); 
    setDraggingAppType(null); 
    setDraggingJunction(null); 
    setDraggingEdge(null); 
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignorar errores si el pointer capture no existe
    }
  };

  const initiateDrag = (e: React.PointerEvent, id: string | null, appType: ApplianceType | null, initialX: number) => {
    if ((e.target as any).closest('.module-action-btn') || (e.target as any).closest('.junction-handle') || (e.target as any).closest('.edge-handle') || (e.target as any).closest('.pointer-events-auto')) return;
    e.stopPropagation(); setDraggingId(id); setDraggingAppType(appType); dragStartInfo.current = { ...dragStartInfo.current, initialX, mouseStartX: e.clientX }; (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const initiateJunctionDrag = (e: React.PointerEvent, leftId: string, rightId: string) => {
    e.stopPropagation(); const leftMod = modules.find(m => m.uniqueId === leftId), rightMod = modules.find(m => m.uniqueId === rightId); if (!leftMod || !rightMod) return;
    setDraggingJunction({ leftId, rightId }); dragStartInfo.current = { ...dragStartInfo.current, mouseStartX: e.clientX, initialWidthLeft: leftMod.width, initialWidthRight: rightMod.width, initialPosXRight: rightMod.positionX }; (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const initiateEdgeDrag = (e: React.PointerEvent, moduleId: string, side: 'left' | 'right') => {
    e.stopPropagation(); const mod = modules.find(m => m.uniqueId === moduleId); if (!mod) return;
    setDraggingEdge({ moduleId, side }); dragStartInfo.current = { ...dragStartInfo.current, mouseStartX: e.clientX, initialX: mod.positionX, initialWidth: mod.width }; (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.2, Math.min(5, prev.scale * delta))
    }));
  };

  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(5, prev.scale * 1.2) }));
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(0.2, prev.scale / 1.2) }));
  const resetZoom = () => setTransform({ x: 0, y: 0, scale: 1 });

  const renderPlanView = () => {
    const planScale = 0.08; // Escala para vista de planta
    const originX = 50, originY = 50;
    const wallAWidth = wallA * planScale;
    const wallBWidth = (layout === 'L_SHAPE' || layout === 'U_SHAPE') ? wallB * planScale : 0;
    const wallCWidth = layout === 'U_SHAPE' ? wallC * planScale : 0;
    
    // Profundidad estándar de módulos base (500mm para zócalo + módulos)
    const baseDepth = LOWER_DEPTH * planScale;
    const upperDepth = UPPER_DEPTH * planScale; // Módulos superiores menos profundos
    const closureDepth = 600 * planScale; // 60cm de profundidad para muros auxiliares
    
    // Calcular todos los endpoints para snap
    const getSnapPoints = () => {
      const snapPoints: {x: number, y: number}[] = [];
      
      // Esquinas principales de muros
      // Layout STRAIGHT
      snapPoints.push(
        {x: originX, y: originY}, // Esquina superior izquierda
        {x: originX + wallAWidth, y: originY}, // Esquina superior derecha
        {x: originX, y: originY + 10}, // Inicio muro inferior izquierdo
        {x: originX + wallAWidth, y: originY + 10}, // Inicio muro inferior derecho
        {x: originX, y: originY + 10 + baseDepth}, // Fin profundidad izquierda
        {x: originX + wallAWidth, y: originY + 10 + baseDepth} // Fin profundidad derecha
      );
      
      // Layout L_SHAPE - agregar puntos del muro B
      if (layout === 'L_SHAPE') {
        snapPoints.push(
          {x: originX + wallAWidth, y: originY + 10 + wallBWidth}, // Esquina inferior muro B
          {x: originX + wallAWidth + 10, y: originY + 10 + wallBWidth} // Esquina exterior muro B
        );
      }
      
      // Layout U_SHAPE - agregar puntos de muros B y C
      if (layout === 'U_SHAPE') {
        snapPoints.push(
          {x: originX - 10, y: originY + 10 + wallBWidth}, // Esquina inferior muro B
          {x: originX, y: originY + 10 + wallBWidth}, // Esquina interior muro B
          {x: originX + wallAWidth, y: originY + 10 + wallCWidth}, // Esquina inferior muro C
          {x: originX + wallAWidth + 10, y: originY + 10 + wallCWidth} // Esquina exterior muro C
        );
      }
      
      // Endpoints de módulos del muro A
      modulesWithCoords3D.filter(m => m.wall === 'A' && (m.type === 'LOWER' || m.type === 'TALL')).forEach(mod => {
        const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
        snapPoints.push(
          {x: projected.x, y: projected.y}, // Esquina superior izquierda del módulo
          {x: projected.x + projected.width, y: projected.y}, // Esquina superior derecha del módulo
          {x: projected.x, y: projected.y + projected.height}, // Esquina inferior izquierda
          {x: projected.x + projected.width, y: projected.y + projected.height} // Esquina inferior derecha
        );
      });
      
      // Endpoints de módulos del muro B (Layout L)
      if (layout === 'L_SHAPE') {
        modulesWithCoords3D.filter(m => m.wall === 'B' && (m.type === 'LOWER' || m.type === 'TALL')).forEach(mod => {
          const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
          snapPoints.push(
            {x: projected.x, y: projected.y},
            {x: projected.x + projected.width, y: projected.y},
            {x: projected.x, y: projected.y + projected.height},
            {x: projected.x + projected.width, y: projected.y + projected.height}
          );
        });
      }
      
      // Endpoints de módulos del muro B (Layout U)
      if (layout === 'U_SHAPE') {
        modulesWithCoords3D.filter(m => m.wall === 'B' && (m.type === 'LOWER' || m.type === 'TALL')).forEach(mod => {
          const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
          snapPoints.push(
            {x: projected.x, y: projected.y},
            {x: projected.x + projected.width, y: projected.y},
            {x: projected.x, y: projected.y + projected.height},
            {x: projected.x + projected.width, y: projected.y + projected.height}
          );
        });
      }
      
      // Endpoints de módulos del muro C (Layout U)
      if (layout === 'U_SHAPE') {
        modulesWithCoords3D.filter(m => m.wall === 'C' && (m.type === 'LOWER' || m.type === 'TALL')).forEach(mod => {
          const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
          snapPoints.push(
            {x: projected.x, y: projected.y},
            {x: projected.x + projected.width, y: projected.y},
            {x: projected.x, y: projected.y + projected.height},
            {x: projected.x + projected.width, y: projected.y + projected.height}
          );
        });
      }
      
      // Muros auxiliares
      if (hasLeftClosure) {
        snapPoints.push(
          {x: originX - 10, y: originY},
          {x: originX - 10, y: originY + closureDepth},
          {x: originX, y: originY + closureDepth}
        );
      }
      
      if (hasRightClosure) {
        snapPoints.push(
          {x: originX + wallAWidth, y: originY},
          {x: originX + wallAWidth + 10, y: originY},
          {x: originX + wallAWidth + 10, y: originY + closureDepth}
        );
      }
      
      return snapPoints;
    };
    
    const findNearestSnapPoint = (x: number, y: number) => {
      const snapPoints = getSnapPoints();
      const snapTolerance = 5;
      
      let nearestPoint: {x: number, y: number, distance: number} | null = null;
      
      snapPoints.forEach(sp => {
        const distance = Math.sqrt(Math.pow(sp.x - x, 2) + Math.pow(sp.y - y, 2));
        if (distance < snapTolerance && (!nearestPoint || distance < nearestPoint.distance)) {
          nearestPoint = {x: sp.x, y: sp.y, distance};
        }
      });
      
      return nearestPoint ? {x: nearestPoint.x, y: nearestPoint.y} : {x, y};
    };
    
    const handleDimensionClick = (dimType: 'wallA' | 'wallB' | 'wallC', currentValue: number) => {
      setEditingDimension(dimType);
      setTempDimValue(currentValue.toString());
    };
    
    const handleDimensionSubmit = (dimType: 'wallA' | 'wallB' | 'wallC') => {
      const newValue = parseInt(tempDimValue);
      if (!isNaN(newValue) && newValue >= 600 && newValue <= 10000) {
        if (dimType === 'wallA') setWallA(newValue);
        else if (dimType === 'wallB') setWallB(newValue);
        else if (dimType === 'wallC') setWallC(newValue);
      }
      setEditingDimension(null);
      setTempDimValue('');
    };
    
    const handleDimensionKeyDown = (e: React.KeyboardEvent, dimType: 'wallA' | 'wallB' | 'wallC') => {
      if (e.key === 'Enter') {
        handleDimensionSubmit(dimType);
      } else if (e.key === 'Escape') {
        setEditingDimension(null);
        setTempDimValue('');
      }
    };
    
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isMeasureMode) return;
      e.stopPropagation(); // Prevenir que el evento llegue al contenedor padre
      
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // Aplicar transformación inversa
      let x = (svgP.x - transform.x) / transform.scale;
      let y = (svgP.y - transform.y) / transform.scale;
      
      // Aplicar snap al punto más cercano
      const snappedPoint = findNearestSnapPoint(x, y);
      x = snappedPoint.x;
      y = snappedPoint.y;
      
      if (measurePoints.length < 2) {
        setMeasurePoints([...measurePoints, {x, y}]);
      } else {
        // Reiniciar con el nuevo punto
        setMeasurePoints([{x, y}]);
      }
    };
    
    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isMeasureMode) {
        setSnapPreview(null);
        return;
      }
      e.stopPropagation(); // Prevenir que el evento llegue al contenedor padre
      
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // Aplicar transformación inversa
      const x = (svgP.x - transform.x) / transform.scale;
      const y = (svgP.y - transform.y) / transform.scale;
      
      // Obtener punto de snap
      const snappedPoint = findNearestSnapPoint(x, y);
      
      // Solo mostrar preview si realmente se está haciendo snap (no es el punto original)
      if (Math.abs(snappedPoint.x - x) > 0.1 || Math.abs(snappedPoint.y - y) > 0.1) {
        setSnapPreview(snappedPoint);
      } else {
        setSnapPreview(null);
      }
    };
    
    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden touch-none relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg 
          viewBox="0 0 400 200" 
          className="w-full h-full bg-slate-100 rounded-3xl shadow-inner border border-slate-200"
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
          style={{ cursor: isMeasureMode ? 'crosshair' : 'default' }}
        >
          <defs>
            <pattern id="wall-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`} style={{ transformOrigin: 'center' }}>
          
          {/* Área de piso - sin patrón de líneas */}
          <rect 
            x={originX - 10} 
            y={originY - 10} 
            width={layout === 'U_SHAPE' ? wallAWidth + 20 : wallAWidth + 20} 
            height={layout === 'U_SHAPE' ? wallBWidth + 20 : (layout === 'L_SHAPE' ? wallBWidth + 20 : baseDepth + 20)} 
            fill="#ffffff" 
            stroke="#cbd5e1" 
            strokeWidth="1"
          />
          
          {/* LAYOUT RECTA */}
          {layout === 'STRAIGHT' && (
            <>
              {/* Muro A (único muro) - con espesor 12cm */}
              <rect x={originX} y={originY} width={wallAWidth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallA' ? (
                <foreignObject x={originX + wallAWidth/2 - 25} y={originY - 10} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallA')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallA')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX + wallAWidth/2} 
                  y={originY - 3} 
                  fontSize="5" 
                  textAnchor="middle" 
                  fill="#64748b" 
                  className="font-bold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallA', wallA)}
                >
                  {wallA}mm
                </text>
              )}
              
              {/* Muro auxiliar izquierdo */}
              {hasLeftClosure && (
                <rect x={originX - 10} y={originY} width="10" height={closureDepth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
              
              {/* Muro auxiliar derecho */}
              {hasRightClosure && (
                <rect x={originX + wallAWidth} y={originY} width="10" height={closureDepth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
            </>
          )}
          
          {/* LAYOUT EN L */}
          {layout === 'L_SHAPE' && (
            <>
              {/* Muro A (horizontal superior) - con espesor 12cm */}
              <rect x={originX} y={originY} width={wallAWidth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallA' ? (
                <foreignObject x={originX + wallAWidth/2 - 25} y={originY - 10} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallA')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallA')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX + wallAWidth/2} 
                  y={originY - 3} 
                  fontSize="5" 
                  textAnchor="middle" 
                  fill="#64748b" 
                  className="font-bold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallA', wallA)}
                >
                  {wallA}mm
                </text>
              )}
              
              {/* Muro B (vertical derecho) - con espesor 12cm */}
              <rect x={originX + wallAWidth} y={originY + 10} width="10" height={wallBWidth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallB' ? (
                <foreignObject x={originX + wallAWidth + 3} y={originY + wallBWidth/2 - 7} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallB')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallB')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX + wallAWidth + 8} 
                  y={originY + wallBWidth/2} 
                  fontSize="5" 
                  textAnchor="start" 
                  fill="#64748b" 
                  className="font-bold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallB', wallB)}
                >
                  {wallB}mm
                </text>
              )}
              
              {/* Muro auxiliar izquierdo */}
              {hasLeftClosure && (
                <rect x={originX - 10} y={originY} width="10" height={closureDepth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
              
              {/* Muro auxiliar derecho - horizontal en la esquina */}
              {hasRightClosure && (
                <rect x={originX + wallAWidth - closureDepth} y={originY + wallBWidth} width={closureDepth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
            </>
          )}
          
          {/* LAYOUT EN U */}
          {layout === 'U_SHAPE' && (
            <>
              {/* Muro A (horizontal superior) - con espesor 12cm */}
              <rect x={originX} y={originY} width={wallAWidth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallA' ? (
                <foreignObject x={originX + wallAWidth/2 - 25} y={originY - 10} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallA')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallA')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX + wallAWidth/2} 
                  y={originY - 3} 
                  fontSize="5" 
                  textAnchor="middle" 
                  fill="#64748b" 
                  className="font-bold"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallA', wallA)}
                >
                  {wallA}mm
                </text>
              )}
              
              {/* Muro B (vertical izquierdo) - con espesor 12cm */}
              <rect x={originX - 10} y={originY + 10} width="10" height={wallBWidth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallB' ? (
                <foreignObject x={originX - 60} y={originY + wallBWidth/2 - 7} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallB')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallB')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX - 15} 
                  y={originY + wallBWidth/2} 
                  fontSize="5" 
                  textAnchor="end" 
                  fill="#64748b" 
                  className="font-bold"
                  transform={`rotate(-90, ${originX - 15}, ${originY + wallBWidth/2})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallB', wallB)}
                >
                  {wallB}mm
                </text>
              )}
              
              {/* Muro C (vertical derecho) - con espesor 12cm */}
              <rect x={originX + wallAWidth} y={originY + 10} width="10" height={wallCWidth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              {editingDimension === 'wallC' ? (
                <foreignObject x={originX + wallAWidth + 10} y={originY + wallCWidth/2 - 7} width="50" height="15">
                  <input
                    type="number"
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onBlur={() => handleDimensionSubmit('wallC')}
                    onKeyDown={(e) => handleDimensionKeyDown(e, 'wallC')}
                    autoFocus
                    style={{
                      width: '100%',
                      height: '100%',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #3b82f6',
                      borderRadius: '2px',
                      outline: 'none'
                    }}
                  />
                </foreignObject>
              ) : (
                <text 
                  x={originX + wallAWidth + 15} 
                  y={originY + wallCWidth/2} 
                  fontSize="5" 
                  textAnchor="start" 
                  fill="#64748b" 
                  className="font-bold"
                  transform={`rotate(90, ${originX + wallAWidth + 15}, ${originY + wallCWidth/2})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleDimensionClick('wallC', wallC)}
                >
                  {wallC}mm
                </text>
              )}
              
              {/* Muro auxiliar izquierdo */}
              {hasLeftClosure && (
                <rect x={originX - 10} y={originY} width="10" height={closureDepth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
              
              {/* Muro auxiliar derecho */}
              {hasRightClosure && (
                <rect x={originX + wallAWidth} y={originY} width="10" height={closureDepth} fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
              
              {/* Muro auxiliar en el extremo izquierdo del muro B - horizontal */}
              {hasLeftClosure && (
                <rect x={originX - 10} y={originY + wallBWidth} width={closureDepth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
              
              {/* Muro auxiliar en el extremo derecho del muro C - horizontal */}
              {hasRightClosure && (
                <rect x={originX + wallAWidth - 10 - closureDepth} y={originY + wallCWidth} width={closureDepth} height="10" fill="url(#wall-hatch)" stroke="#1e293b" strokeWidth="0.5"/>
              )}
            </>
          )}
          
          {/* Zócalo perimetral - Muro A */}
          {hasZocalo && (
            <rect 
              x={originX} 
              y={originY + 10} 
              width={wallAWidth} 
              height={zocaloDepth * planScale} 
              fill="#e2e8f0" 
              opacity="0.4"
              stroke="#94a3b8"
              strokeWidth="0.2"
            />
          )}
          
          {/* Zócalo perimetral - Muro B en Layout L */}
          {hasZocalo && layout === 'L_SHAPE' && (
            <rect 
              x={originX + wallAWidth - zocaloDepth * planScale} 
              y={originY + 10 + baseDepth} 
              width={zocaloDepth * planScale} 
              height={wallBWidth - baseDepth} 
              fill="#e2e8f0" 
              opacity="0.4"
              stroke="#94a3b8"
              strokeWidth="0.2"
            />
          )}
          
          {/* Zócalo perimetral - Muro B en Layout U */}
          {hasZocalo && layout === 'U_SHAPE' && (
            <rect 
              x={originX} 
              y={originY + 10 + baseDepth} 
              width={zocaloDepth * planScale} 
              height={wallBWidth - baseDepth} 
              fill="#e2e8f0" 
              opacity="0.4"
              stroke="#94a3b8"
              strokeWidth="0.2"
            />
          )}
          
          {/* Zócalo perimetral - Muro C (si es U) */}
          {hasZocalo && layout === 'U_SHAPE' && (
            <rect 
              x={originX + wallAWidth - zocaloDepth * planScale} 
              y={originY + 10 + baseDepth} 
              width={zocaloDepth * planScale} 
              height={wallCWidth - baseDepth} 
              fill="#e2e8f0" 
              opacity="0.4"
              stroke="#94a3b8"
              strokeWidth="0.2"
            />
          )}
          
          {/* Módulos base del Muro A */}
          {modulesWithCoords3D.filter(m => m.wall === 'A' && (m.type === 'LOWER' || m.type === 'TALL')).map((mod) => {
            const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
            return (
              <g key={`plan-base-${mod.uniqueId}`}>
                <rect 
                  x={projected.x} 
                  y={projected.y} 
                  width={projected.width} 
                  height={projected.height}
                  fill={mod.type === 'TALL' ? '#94a3b8' : '#cbd5e1'}
                  stroke="#1e293b" 
                  strokeWidth="0.5"
                  opacity="0.9"
                />
                <text 
                  x={projected.x + projected.width/2} 
                  y={projected.y + projected.height/2} 
                  fontSize="4" 
                  textAnchor="middle" 
                  fill="#1e293b"
                  className="font-bold"
                >
                  {mod.label}
                </text>
              </g>
            );
          })}
          
          {/* Módulos superiores del Muro A */}
          {modulesWithCoords3D.filter(m => m.wall === 'A' && m.type === 'UPPER').map((mod) => {
            const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
            return (
              <g key={`plan-upper-${mod.uniqueId}`}>
                <rect 
                  x={projected.x} 
                  y={projected.y} 
                  width={projected.width} 
                  height={projected.height}
                  fill="#e0e7ff"
                  stroke="#6366f1" 
                  strokeWidth="0.3"
                  strokeDasharray="2,1"
                  opacity="0.7"
                />
              </g>
            );
          })}
          
          {/* Electrodomésticos del Muro A */}
          {appliances.filter(a => a.wall === 'A' && a.active).map((app, idx) => {
            const depth = app.depth * planScale;
            let fill = '#f87171';
            if (app.type === 'sink') fill = '#60a5fa';
            if (app.type === 'fridge') fill = '#a78bfa';
            
            return (
              <g key={`plan-app-${idx}`}>
                <rect 
                  x={originX + app.distance * planScale} 
                  y={originY + 10} 
                  width={app.width * planScale} 
                  height={depth}
                  fill={fill}
                  stroke="#1e293b" 
                  strokeWidth="0.5"
                  opacity="0.8"
                />
                <text 
                  x={originX + app.distance * planScale + (app.width * planScale)/2} 
                  y={originY + 10 + depth/2} 
                  fontSize="3" 
                  textAnchor="middle" 
                  fill="white"
                  className="font-bold uppercase"
                >
                  {app.type === 'fridge' ? 'NEV' : app.type === 'sink' ? 'LAV' : 'EST'}
                </text>
              </g>
            );
          })}
          
          {/* Muro B en Layout L */}
          {layout === 'L_SHAPE' && (
            <>
              {/* Módulos base del Muro B */}
              {modulesWithCoords3D.filter(m => m.wall === 'B' && (m.type === 'LOWER' || m.type === 'TALL')).map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-base-B-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x} 
                      y={projected.y}
                      width={projected.width} 
                      height={projected.height}
                      fill={mod.type === 'TALL' ? '#94a3b8' : '#cbd5e1'}
                      stroke="#1e293b" 
                      strokeWidth="0.5"
                      opacity="0.9"
                    />
                    <text 
                      x={projected.x + projected.width/2} 
                      y={projected.y + projected.height/2} 
                      fontSize="4" 
                      textAnchor="middle" 
                      fill="#1e293b"
                      className="font-bold"
                    >
                      {mod.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Módulos superiores del Muro B */}
              {modulesWithCoords3D.filter(m => m.wall === 'B' && m.type === 'UPPER').map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-upper-B-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x} 
                      y={projected.y}
                      width={projected.width} 
                      height={projected.height}
                      fill="#e0e7ff"
                      stroke="#6366f1" 
                      strokeWidth="0.3"
                      strokeDasharray="2,1"
                      opacity="0.7"
                    />
                  </g>
                );
              })}
            </>
          )}
          
          {/* Muro B en Layout U */}
          {layout === 'U_SHAPE' && (
            <>
              {/* Módulos base del Muro B */}
              {modulesWithCoords3D.filter(m => m.wall === 'B' && (m.type === 'LOWER' || m.type === 'TALL')).map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-base-B-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x} 
                      y={projected.y}
                      width={projected.width} 
                      height={projected.height}
                      fill={mod.type === 'TALL' ? '#94a3b8' : '#cbd5e1'}
                      stroke="#1e293b" 
                      strokeWidth="0.5"
                      opacity="0.9"
                    />
                    <text 
                      x={projected.x + projected.width/2} 
                      y={projected.y + projected.height/2} 
                      fontSize="4" 
                      textAnchor="middle" 
                      fill="#1e293b"
                      className="font-bold"
                    >
                      {mod.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Módulos superiores del Muro B en Layout U */}
              {modulesWithCoords3D.filter(m => m.wall === 'B' && m.type === 'UPPER').map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-upper-B-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x} 
                      y={projected.y}
                      width={projected.width} 
                      height={projected.height}
                      fill="#e0e7ff"
                      stroke="#6366f1" 
                      strokeWidth="0.3"
                      strokeDasharray="2,1"
                      opacity="0.7"
                    />
                  </g>
                );
              })}
            </>
          )}
          
          {/* Muro C (si es U) */}
          {layout === 'U_SHAPE' && (
            <>
              {/* Módulos base del Muro C */}
              {modulesWithCoords3D.filter(m => m.wall === 'C' && (m.type === 'LOWER' || m.type === 'TALL')).map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-base-C-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x}
                      y={projected.y}
                      width={projected.width}
                      height={projected.height}
                      fill={mod.type === 'TALL' ? '#94a3b8' : '#cbd5e1'}
                      stroke="#1e293b" 
                      strokeWidth="0.5"
                      opacity="0.9"
                    />
                    <text 
                      x={projected.x + projected.width/2}
                      y={projected.y + projected.height/2} 
                      fontSize="4" 
                      textAnchor="middle" 
                      fill="#1e293b"
                      className="font-bold"
                    >
                      {mod.label}
                    </text>
                  </g>
                );
              })}
              
              {/* Módulos superiores del Muro C */}
              {modulesWithCoords3D.filter(m => m.wall === 'C' && m.type === 'UPPER').map((mod) => {
                const projected = project3DToPlant(mod.x3d, mod.y3d, mod.width3d, mod.depth3d, mod.rotation3d);
                return (
                  <g key={`plan-upper-C-${mod.uniqueId}`}>
                    <rect 
                      x={projected.x}
                      y={projected.y}
                      width={projected.width}
                      height={projected.height}
                      fill="#e0e7ff"
                      stroke="#6366f1" 
                      strokeWidth="0.3"
                      strokeDasharray="2,1"
                      opacity="0.7"
                    />
                  </g>
                );
              })}
            </>
          )}
          
          {/* Líneas de profundidad - oculto en vista de planta */}
          {/* <line x1={originX} y1={originY + 3} x2={originX} y2={originY + 3 + baseDepth} stroke="#94a3b8" strokeWidth="0.3" strokeDasharray="1,1"/>
          <text x={originX - 3} y={originY + 3 + baseDepth/2} fontSize="4" textAnchor="end" fill="#64748b">600mm</text> */}
          
          {/* Medición auxiliar */}
          {isMeasureMode && measurePoints.length > 0 && (
            <>
              {/* Puntos de medición */}
              {measurePoints.map((point, index) => (
                <g key={`measure-point-${index}`}>
                  <circle cx={point.x} cy={point.y} r="2" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.5" />
                  <text 
                    x={point.x} 
                    y={point.y - 4} 
                    fontSize="4" 
                    textAnchor="middle" 
                    fill="#f59e0b"
                    className="font-black"
                  >
                    {String.fromCharCode(65 + index)}
                  </text>
                </g>
              ))}
              
              {/* Línea de medición */}
              {measurePoints.length === 2 && (
                <>
                  <line 
                    x1={measurePoints[0].x} 
                    y1={measurePoints[0].y} 
                    x2={measurePoints[1].x} 
                    y2={measurePoints[1].y} 
                    stroke="#f59e0b" 
                    strokeWidth="1" 
                    strokeDasharray="2,2"
                  />
                  {/* Distancia */}
                  {(() => {
                    const dx = measurePoints[1].x - measurePoints[0].x;
                    const dy = measurePoints[1].y - measurePoints[0].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const distanceMm = Math.round(distance / planScale);
                    const midX = (measurePoints[0].x + measurePoints[1].x) / 2;
                    const midY = (measurePoints[0].y + measurePoints[1].y) / 2;
                    
                    return (
                      <g>
                        <rect 
                          x={midX - 15} 
                          y={midY - 5} 
                          width="30" 
                          height="8" 
                          fill="#f59e0b" 
                          rx="2"
                        />
                        <text 
                          x={midX} 
                          y={midY + 1.5} 
                          fontSize="4.5" 
                          textAnchor="middle" 
                          fill="#ffffff"
                          className="font-black"
                        >
                          {distanceMm}mm
                        </text>
                      </g>
                    );
                  })()}
                </>
              )}
            </>
          )}
          
          {/* Indicador visual de snap */}
          {isMeasureMode && snapPreview && (
            <g>
              <circle 
                cx={snapPreview.x} 
                cy={snapPreview.y} 
                r="3" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.5"
                opacity="0.8"
              />
              <circle 
                cx={snapPreview.x} 
                cy={snapPreview.y} 
                r="1.5" 
                fill="#10b981" 
                opacity="0.8"
              />
            </g>
          )}
          </g>
        </svg>
      </div>
    );
  };

  const renderFrontalView = () => {
    const originX = 55, floorY = 170;
    const roomW = wallA * frontalScale;
    const roomH = spaceHeight * frontalHeightScale;
    const zh_mm = hasZocalo ? zocaloHeight : 0;
    const zh_px = zh_mm * frontalHeightScale;
    const closureDepth = 600 * frontalScale; // 60cm de profundidad para muros auxiliares
    
    const currentWallModules = modulesWithCoords3D.filter(m => m.wall === 'A'), currentWallApps = appliances.filter(a => a.wall === 'A' && a.active);
    const uppers = currentWallModules.filter(m => m.type === 'UPPER' || m.isFridgeCabinet).sort((a,b) => a.positionX - b.positionX);
    const lowers = [ ...currentWallModules.filter(m => m.type === 'LOWER' || m.type === 'TALL' || m.isStoveCabinet), ...currentWallApps.filter(a => a.type === 'fridge' || a.type === 'sink' || a.type === 'pantry') ].sort((a,b) => {
      const ax = 'positionX' in a ? (a as any).positionX : (a as any).distance;
      const bx = 'positionX' in b ? (b as any).positionX : (b as any).distance;
      return ax - bx;
    });
    
    // Calcular todos los endpoints para snap en vista frontal
    const getSnapPointsFrontal = () => {
      const snapPoints: {x: number, y: number}[] = [];
      
      // Esquinas principales
      snapPoints.push(
        {x: originX, y: floorY}, // Esquina inferior izquierda piso
        {x: originX + roomW, y: floorY}, // Esquina inferior derecha piso
        {x: originX, y: floorY - roomH}, // Esquina superior izquierda techo
        {x: originX + roomW, y: floorY - roomH}, // Esquina superior derecha techo
        {x: originX, y: floorY - 10}, // Inferior del piso izquierda
        {x: originX + roomW, y: floorY - 10}, // Inferior del piso derecha
        {x: originX, y: floorY - roomH - 10}, // Superior del techo izquierda
        {x: originX + roomW, y: floorY - roomH - 10} // Superior del techo derecha
      );
      
      // Línea del zócalo
      if (hasZocalo) {
        snapPoints.push(
          {x: originX, y: floorY - zh_px},
          {x: originX + roomW, y: floorY - zh_px}
        );
      }
      
      // Línea del counter (encimera) - usando coordenadas 3D consistentes
      // La línea del counter está en z = zocaloHeight + altura_de_módulos_bajos
      const counterZ3d = hasZocalo ? zocaloHeight + currentBaseModuleHeight : currentBaseModuleHeight;
      const counterY = floorY - counterZ3d * frontalHeightScale;
      snapPoints.push(
        {x: originX, y: counterY},
        {x: originX + roomW, y: counterY}
      );
      
      // Endpoints de módulos base
      lowers.forEach((mod) => {
        if ('uniqueId' in mod) {
          const projected = project3DToFrontal(mod as any);
          snapPoints.push(
            {x: projected.x, y: projected.y}, // Esquina superior izquierda
            {x: projected.x + projected.width, y: projected.y}, // Esquina superior derecha
            {x: projected.x, y: projected.y + projected.height}, // Esquina inferior izquierda
            {x: projected.x + projected.width, y: projected.y + projected.height} // Esquina inferior derecha
          );
        } else {
          // Para appliances, mantener cálculo manual por ahora
          const modX = originX + mod.distance * frontalScale;
          const modW = mod.width * frontalScale;
          const modH = currentBaseModuleHeight * frontalHeightScale;
          const modY = floorY - zh_px - modH;
          snapPoints.push(
            {x: modX, y: modY},
            {x: modX + modW, y: modY},
            {x: modX, y: floorY - zh_px},
            {x: modX + modW, y: floorY - zh_px}
          );
        }
      });
      
      // Endpoints de módulos superiores
      uppers.forEach((mod) => {
        const projected = project3DToFrontal(mod);
        snapPoints.push(
          {x: projected.x, y: projected.y}, // Esquina superior izquierda
          {x: projected.x + projected.width, y: projected.y}, // Esquina superior derecha
          {x: projected.x, y: projected.y + projected.height}, // Esquina inferior izquierda
          {x: projected.x + projected.width, y: projected.y + projected.height} // Esquina inferior derecha
        );
      });
      
      // Muros auxiliares laterales
      if (hasLeftClosure) {
        snapPoints.push(
          {x: originX - closureDepth, y: floorY},
          {x: originX - closureDepth, y: floorY - roomH},
          {x: originX - closureDepth, y: floorY - 10},
          {x: originX - closureDepth, y: floorY - roomH - 10}
        );
      }
      
      if (hasRightClosure) {
        snapPoints.push(
          {x: originX + roomW + closureDepth, y: floorY},
          {x: originX + roomW + closureDepth, y: floorY - roomH},
          {x: originX + roomW + closureDepth, y: floorY - 10},
          {x: originX + roomW + closureDepth, y: floorY - roomH - 10}
        );
      }
      
      return snapPoints;
    };
    
    const findNearestSnapPointFrontal = (x: number, y: number) => {
      const snapPoints = getSnapPointsFrontal();
      const snapTolerance = 5;
      
      let nearestPoint: {x: number, y: number, distance: number} | null = null;
      
      snapPoints.forEach(sp => {
        const distance = Math.sqrt(Math.pow(sp.x - x, 2) + Math.pow(sp.y - y, 2));
        if (distance < snapTolerance && (!nearestPoint || distance < nearestPoint.distance)) {
          nearestPoint = {x: sp.x, y: sp.y, distance};
        }
      });
      
      return nearestPoint ? {x: nearestPoint.x, y: nearestPoint.y} : {x, y};
    };
    
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isMeasureMode) return;
      e.stopPropagation(); // Prevenir que el evento llegue al contenedor padre
      
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // Aplicar transformación inversa
      let x = (svgP.x - transform.x) / transform.scale;
      let y = (svgP.y - transform.y) / transform.scale;
      
      // Aplicar snap al punto más cercano
      const snappedPoint = findNearestSnapPointFrontal(x, y);
      x = snappedPoint.x;
      y = snappedPoint.y;
      
      if (measurePoints.length < 2) {
        setMeasurePoints([...measurePoints, {x, y}]);
      } else {
        // Reiniciar con el nuevo punto
        setMeasurePoints([{x, y}]);
      }
    };
    
    const handleSvgMouseMoveFrontal = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isMeasureMode) {
        setSnapPreview(null);
        return;
      }
      e.stopPropagation(); // Prevenir que el evento llegue al contenedor padre
      
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      
      // Aplicar transformación inversa
      const x = (svgP.x - transform.x) / transform.scale;
      const y = (svgP.y - transform.y) / transform.scale;
      
      // Obtener punto de snap
      const snappedPoint = findNearestSnapPointFrontal(x, y);
      
      // Solo mostrar preview si realmente se está haciendo snap (no es el punto original)
      if (Math.abs(snappedPoint.x - x) > 0.1 || Math.abs(snappedPoint.y - y) > 0.1) {
        setSnapPreview(snappedPoint);
      } else {
        setSnapPreview(null);
      }
    };
    
    const junctions: {x: number, y: number, leftId: string, rightId: string}[] = [];
    
    // Junctions para módulos superiores
    for(let i=0; i<uppers.length - 1; i++) { 
      const left = uppers[i], right = uppers[i+1]; 
      if (Math.abs((left.positionX + left.width) - right.positionX) < 1) {
        const projectedRight = project3DToFrontal(right);
        junctions.push({ 
          x: projectedRight.x, 
          y: projectedRight.y + projectedRight.height / 2, 
          leftId: left.uniqueId, 
          rightId: right.uniqueId 
        });
      }
    }
    
    // Junctions para módulos inferiores
    for(let i=0; i<lowers.length - 1; i++) { 
      const left = lowers[i] as KitchenModule, right = lowers[i+1] as KitchenModule; 
      if (!left.uniqueId || !right.uniqueId) continue; 
      if (Math.abs((left.positionX + left.width) - right.positionX) < 1) {
        const projectedRight = project3DToFrontal(right as any);
        junctions.push({ 
          x: projectedRight.x, 
          y: projectedRight.y + projectedRight.height / 2, 
          leftId: left.uniqueId, 
          rightId: right.uniqueId 
        });
      }
    }

    const verticalCotaX = originX - 35;

    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden touch-none relative" 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg 
          viewBox="0 0 400 200" 
          className="w-full h-full bg-slate-100 rounded-3xl shadow-inner border border-slate-200"
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMoveFrontal}
          style={{ cursor: isMeasureMode ? 'crosshair' : 'default' }}
        >
          <defs>
            <pattern id="wall-hatch-frontal" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="3" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`} style={{ transformOrigin: 'center' }}>
            {/* Muro del piso - con espesor 12cm y hatch */}
            <rect x={originX - (hasLeftClosure ? closureDepth : 10)} y={floorY} width={roomW + (hasLeftClosure ? closureDepth : 10) + (hasRightClosure ? closureDepth : 10)} height={10} fill="url(#wall-hatch-frontal)" stroke="#1e293b" strokeWidth="0.5" />
            
            {/* Muro del techo - con espesor 12cm y hatch */}
            <rect x={originX - (hasLeftClosure ? closureDepth : 10)} y={floorY - roomH - 10} width={roomW + (hasLeftClosure ? closureDepth : 10) + (hasRightClosure ? closureDepth : 10)} height={10} fill="url(#wall-hatch-frontal)" stroke="#1e293b" strokeWidth="0.5" />
            
            {/* Muro trasero */}
            <rect x={originX} y={floorY - roomH} width={roomW} height={roomH} fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
            
            {/* Muro auxiliar izquierdo - 60cm de profundidad */}
            {hasLeftClosure && <rect x={originX - closureDepth} y={floorY - roomH} width={closureDepth} height={roomH} fill="url(#wall-hatch-frontal)" stroke="#1e293b" strokeWidth="0.5" />}
            
            {/* Muro auxiliar derecho - 60cm de profundidad */}
            {hasRightClosure && <rect x={originX + roomW} y={floorY - roomH} width={closureDepth} height={roomH} fill="url(#wall-hatch-frontal)" stroke="#1e293b" strokeWidth="0.5" />}
            
            {/* Muro auxiliar horizontal derecho (para layout L y U) */}
            {hasRightClosure && (layout === 'L_SHAPE' || layout === 'U_SHAPE') && (
              <rect x={originX + roomW} y={floorY - 10} width={closureDepth} height={10} fill="url(#wall-hatch-frontal)" stroke="#1e293b" strokeWidth="0.5" />
            )}
            
            {hasZocalo && <rect x={originX} y={floorY - zh_px} width={roomW} height={zh_px} fill="#e2e8f0" className="opacity-60" />}
            
            {/* Cotas verticales - usando alturas REALES de los módulos */}
            {(() => {
              // Obtener alturas reales de los módulos del muro A
              const lowerModule = currentWallModules.find(m => m.type === 'LOWER');
              const upperModule = currentWallModules.find(m => m.type === 'UPPER' && !m.isFridgeCabinet && !m.isHood);
              
              // Alturas reales de los módulos (las que se están dibujando)
              const realLowerHeight = lowerModule ? lowerModule.height : currentBaseModuleHeight;
              const realUpperHeight = upperModule ? upperModule.height : currentUpperModuleHeight;
              
              // Calcular el espacio REAL entre módulos base y superiores
              // Base termina en: zh_mm + realLowerHeight
              // Superior empieza en: spaceHeight - TOP_MARGIN - realUpperHeight
              const realGap = spaceHeight - TOP_MARGIN - realUpperHeight - (zh_mm + realLowerHeight);
              
              return (
                <>
                  {hasZocalo && <VerticalDimensionLine x={verticalCotaX} y={floorY} height={zh_mm} scale={frontalHeightScale} label={`${zh_mm}`} color="#94a3b8" orientation="left" />}
                  <VerticalDimensionLine x={verticalCotaX} y={floorY - zh_px} height={realLowerHeight} scale={frontalHeightScale} label={`${realLowerHeight}`} color="#94a3b8" orientation="left" />
                  <VerticalDimensionLine x={verticalCotaX} y={floorY - zh_px - (realLowerHeight * frontalHeightScale)} height={realGap} scale={frontalHeightScale} label={`${realGap}`} color="#94a3b8" orientation="left" />
                  <VerticalDimensionLine x={verticalCotaX} y={floorY - zh_px - (realLowerHeight * frontalHeightScale) - (realGap * frontalHeightScale)} height={realUpperHeight} scale={frontalHeightScale} label={`${realUpperHeight}`} color="#94a3b8" orientation="left" />
                  <VerticalDimensionLine x={verticalCotaX} y={floorY - roomH + (TOP_MARGIN * frontalHeightScale)} height={TOP_MARGIN} scale={frontalHeightScale} label={`${TOP_MARGIN}`} color="#94a3b8" orientation="left" />
                  
                  <VerticalDimensionLine x={verticalCotaX - 10} y={floorY} height={counterHeight} scale={frontalHeightScale} label={`LÍNEA ${counterHeight}`} color="#4f46e5" orientation="left" />
                  
                  <VerticalDimensionLine x={verticalCotaX - 25} y={floorY} height={spaceHeight} scale={frontalHeightScale} label={`TOTAL ${spaceHeight}`} color="#1e293b" orientation="left" />
                </>
              );
            })()}
            <DimensionLine x={originX} y={floorY} width={wallA} scale={frontalScale} label={`${wallA}mm`} color="#94a3b8" orientation="bottom" />
            
            {currentWallModules.map((m) => {
              const projected = project3DToFrontal(m);
              const handleY = projected.y + projected.height / 2;
              return (
                <g key={`body-${m.uniqueId}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, m.uniqueId, null, m.positionX)}>
                  <rect x={projected.x} y={projected.y} width={projected.width} height={projected.height} fill={m.isFridgeCabinet || m.isStoveCabinet || m.isHood ? "#e5e7eb" : COLORS[m.type]} stroke={draggingId === m.uniqueId ? "#6366f1" : "#1e293b"} strokeWidth="0.5" rx="2" />
                  <text x={projected.x+projected.width/2} y={projected.y+projected.height/2} fontSize="6" textAnchor="middle" fill={m.isFridgeCabinet || m.isStoveCabinet || m.isHood ? "#374151" : "white"} className="font-black pointer-events-none uppercase">{m.label || (m.isFridgeCabinet ? 'SN' : (m.isStoveCabinet ? 'ME' : (m.isHood ? 'MC' : '')))}</text>
                </g>
              );
            })}
            {currentWallApps.map((a, idx) => {
              // Calcular coordenadas 3D para electrodomésticos (consistente con módulos)
              let z3d = 0;  // Base del electrodoméstico
              let height3d = a.height;
              
              if (a.type === 'fridge') {
                z3d = 0;  // Nevera desde el suelo
              } else if (a.type === 'pantry') {
                z3d = hasZocalo ? zocaloHeight : 0;  // Alacena desde zócalo
                height3d = spaceHeight - TOP_MARGIN - (hasZocalo ? zocaloHeight : 0);
              } else if (a.type === 'stove' || a.type === 'sink') {
                z3d = (hasZocalo ? zocaloHeight : 0) + currentBaseModuleHeight;  // Sobre el mesón
                height3d = a.height;  // Altura del electrodoméstico
              } else if (a.type === 'hood-under' || a.type === 'hood-island') {
                z3d = (hasZocalo ? zocaloHeight : 0) + currentBaseModuleHeight + HOOD_GAP;  // Sobre el mesón + gap
                height3d = a.height;
              }
              
              // Proyectar usando la misma lógica que los módulos
              const x = originX + a.distance * frontalScale;
              const y = floorY - z3d * frontalHeightScale - height3d * frontalHeightScale;
              const w = a.width * frontalScale;
              const h = height3d * frontalHeightScale;
              
              // Casos especiales de dibujo
              if (a.type === 'pantry') {
                return (
                  <g key={`app-body-${idx}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, null, a.type, a.distance)}>
                    <rect x={x} y={y} width={w} height={h} fill="#cbd5e1" stroke="#1e293b" strokeWidth="0.5" />
                    <text x={x+w/2} y={y+h/2} fontSize="4" textAnchor="middle" className="uppercase font-bold fill-slate-700">Alacena</text>
                  </g>
                );
              }

              if (a.type === 'stove') {
                const thicknessPx = INDUCTION_THICKNESS * frontalHeightScale;
                return (
                  <g key={`app-body-${idx}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, null, a.type, a.distance)}>
                    <rect x={x} y={y} width={w} height={thicknessPx} fill="#1e293b" />
                    <rect x={x + (w*0.1)} y={y + 0.5} width={w*0.8} height={0.2} fill="#ffffff" opacity="0.3" />
                  </g>
                );
              }

              if (a.type === 'sink') {
                return (
                  <g key={`app-body-${idx}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, null, a.type, a.distance)}>
                    <rect x={x} y={y} width={w} height={h} fill="#94a3b8" stroke="#1e293b" strokeWidth="0.5" rx="1" />
                    <text x={x+w/2} y={y+h/2} fontSize="3" textAnchor="middle" fill="white" className="font-bold">SINK</text>
                  </g>
                );
              }

              if (a.type === 'hood-under' || a.type === 'hood-island') {
                return (
                  <g key={`app-body-${idx}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, null, a.type, a.distance)}>
                    <rect x={x} y={y} width={w} height={h} fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
                    <text x={x+w/2} y={y+h/2} fontSize="3" textAnchor="middle" fill="white" className="font-bold">HOOD</text>
                  </g>
                );
              }

              // Default para otros electrodomésticos
              return (
                <g key={`app-body-${idx}`} className="draggable-element cursor-move" onPointerDown={(e) => initiateDrag(e, null, a.type, a.distance)}>
                   <rect x={x} y={y} width={w} height={h} fill="#f8fafc" stroke="#1e293b" strokeWidth="0.5" />
                   <text x={x+w/2} y={y+h/2} fontSize="4" textAnchor="middle" className="uppercase font-bold">{a.type}</text>
                </g>
              );
            })}
            {currentWallModules.map((m) => {
              // Usar las coordenadas 3D proyectadas para consistencia
              const projected = project3DToFrontal(m);
              const x = projected.x;
              const y = projected.y;
              const w = projected.width;
              const h = projected.height;
              
              const tierItems = (m.type === 'UPPER' || m.isFridgeCabinet || m.isHood) ? uppers : lowers;
              const idx = tierItems.findIndex(it => 'uniqueId' in it && it.uniqueId === m.uniqueId);
              
              let gapLeftWidth = 0;
              if (idx === 0) { if (m.positionX > 0) gapLeftWidth = m.positionX; } else {
                const prevItem = tierItems[idx-1];
                const prevEnd = ('positionX' in prevItem ? (prevItem as any).positionX : (prevItem as any).distance) + prevItem.width;
                if (m.positionX > prevEnd) gapLeftWidth = m.positionX - prevEnd;
              }

              let gapRightWidth = 0;
              if (idx === tierItems.length - 1) {
                const moduleEnd = m.positionX + m.width;
                if (moduleEnd < wallA) gapRightWidth = wallA - moduleEnd;
              }

              const handleY = y + h / 2;
              // Posición Y para DimensionLines según orientación
              const dimLineY = (m.type === 'UPPER' || m.isFridgeCabinet || m.isHood) ? y : (y + h);
              
              return (
                <g key={`interaction-${m.uniqueId}`}>
                  {gapLeftWidth > 0 && (
                    <DimensionLine 
                      x={originX + (m.positionX - gapLeftWidth) * frontalScale} 
                      y={dimLineY} 
                      width={gapLeftWidth} 
                      scale={frontalScale} 
                      label={`${Math.round(gapLeftWidth)}`} 
                      isGap 
                      orientation={m.type === 'UPPER' || m.isFridgeCabinet || m.isHood ? 'top' : 'bottom'} 
                      onEdit={(cx, cy) => editDimensionValue('gap', m.uniqueId, Math.round(gapLeftWidth), { clientX: cx, clientY: cy } as any)} 
                    />
                  )}
                  
                  <DimensionLine 
                    x={x} 
                    y={dimLineY} 
                    width={m.width} 
                    scale={frontalScale} 
                    label={`${m.width}`} 
                    orientation={m.type === 'UPPER' || m.isFridgeCabinet || m.isHood ? 'top' : 'bottom'} 
                    onEdit={(cx, cy) => editDimensionValue('module', m.uniqueId, m.width, { clientX: cx, clientY: cy } as any)} 
                  />

                  {gapRightWidth > 0 && (
                    <DimensionLine 
                      x={originX + (m.positionX + m.width) * frontalScale} 
                      y={dimLineY} 
                      width={gapRightWidth} 
                      scale={frontalScale} 
                      label={`${Math.round(gapRightWidth)}`} 
                      isGap 
                      orientation={m.type === 'UPPER' || m.isFridgeCabinet || m.isHood ? 'top' : 'bottom'}
                    />
                  )}
                  
                  <g className="edge-handle cursor-ew-resize group pointer-events-auto" onPointerDown={(e) => initiateEdgeDrag(e, m.uniqueId, 'left')}>
                    <circle cx={x} cy={handleY} r="4.5" fill="white" stroke="#6366f1" strokeWidth="0.8" className="shadow-sm group-hover:fill-indigo-50" />
                    <path d="M-2.5,0 L-0.5,-2 L-0.5,2 Z" fill="#4f46e5" transform={`translate(${x}, ${handleY})`} />
                    <path d="M2.5,0 L0.5,-2 L0.5,2 Z" fill="#4f46e5" transform={`translate(${x}, ${handleY})`} />
                  </g>
                  <g className="edge-handle cursor-ew-resize group pointer-events-auto" onPointerDown={(e) => initiateEdgeDrag(e, m.uniqueId, 'right')}>
                    <circle cx={x + w} cy={handleY} r="4.5" fill="white" stroke="#6366f1" strokeWidth="0.8" className="shadow-sm group-hover:fill-indigo-50" />
                    <path d="M-2.5,0 L-0.5,-2 L-0.5,2 Z" fill="#4f46e5" transform={`translate(${x + w}, ${handleY})`} />
                    <path d="M2.5,0 L0.5,-2 L0.5,2 Z" fill="#4f46e5" transform={`translate(${x + w}, ${handleY})`} />
                  </g>

                  <g className="module-action-btn cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); deleteModule(m.uniqueId); }}>
                    <circle cx={x + 10} cy={y + 10} r={5} fill="#ef4444" stroke="white" strokeWidth="1.2" /><line x1={x + 7.5} y1={y + 7.5} x2={x + 12.5} y2={y + 12.5} stroke="white" strokeWidth="1.8" /><line x1={x + 12.5} y1={y + 7.5} x2={x + 7.5} y2={y + 12.5} stroke="white" strokeWidth="1.8" />
                  </g>
                  <g className="module-action-btn cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); splitModule(m.uniqueId); }}>
                    <circle cx={x + w - 10} cy={y + 10} r={5} fill="#22c55e" stroke="white" strokeWidth="1.2" /><line x1={x + w - 13} y1={y + 10} x2={x + w - 7} y2={y + 10} stroke="white" strokeWidth="1.8" /><line x1={x + w - 10} y1={y + 7} x2={x + w - 10} y2={y + 13} stroke="white" strokeWidth="1.8" />
                  </g>
                </g>
              );
            })}
            {junctions.map((j, idx) => (
              <g key={`junction-${idx}`} className="junction-handle cursor-ew-resize group pointer-events-auto" onPointerDown={(e) => initiateJunctionDrag(e, j.leftId, j.rightId)}>
                <line x1={j.x} y1={j.y-15} x2={j.x} y2={j.y+15} stroke="#6366f1" strokeWidth="1" strokeDasharray="2,2" /><rect x={j.x-8} y={j.y-4} width="16" height="8" rx="4" fill="white" stroke="#6366f1" strokeWidth="1" /><path d="M-5,0 L-2,-3 L-2,3 Z" fill="#4f46e5" transform={`translate(${j.x}, ${j.y})`} /><path d="M5,0 L2,-3 L2,3 Z" fill="#4f46e5" transform={`translate(${j.x}, ${j.y})`} />
              </g>
            ))}
            {currentWallApps.map((a, idx) => { 
              // Usar mismas coordenadas 3D que para el dibujo
              let z3d = 0;
              let height3d = a.height;
              
              if (a.type === 'fridge') {
                z3d = 0;
              } else if (a.type === 'pantry') {
                z3d = hasZocalo ? zocaloHeight : 0;
                height3d = spaceHeight - TOP_MARGIN - (hasZocalo ? zocaloHeight : 0);
              } else if (a.type === 'stove' || a.type === 'sink') {
                z3d = (hasZocalo ? zocaloHeight : 0) + currentBaseModuleHeight;
                height3d = a.height;
              } else if (a.type === 'hood-under' || a.type === 'hood-island') {
                z3d = (hasZocalo ? zocaloHeight : 0) + currentBaseModuleHeight + HOOD_GAP;
                height3d = a.height;
              }
              
              const x = originX + a.distance * frontalScale;
              const y = floorY - z3d * frontalHeightScale - height3d * frontalHeightScale + height3d * frontalHeightScale;  // y + height para DimensionLine en bottom
              
              return <DimensionLine key={`app-cota-${idx}`} x={x} y={y} width={a.width} scale={frontalScale} label={`${a.width}`} color="#94a3b8" orientation="bottom" />; 
            })}
            
            {/* Medición auxiliar */}
            {isMeasureMode && measurePoints.length > 0 && (
              <>
                {/* Puntos de medición */}
                {measurePoints.map((point, index) => (
                  <g key={`measure-point-${index}`}>
                    <circle cx={point.x} cy={point.y} r="2" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.5" />
                    <text 
                      x={point.x} 
                      y={point.y - 4} 
                      fontSize="4" 
                      textAnchor="middle" 
                      fill="#f59e0b"
                      className="font-black"
                    >
                      {String.fromCharCode(65 + index)}
                    </text>
                  </g>
                ))}
                
                {/* Línea de medición */}
                {measurePoints.length === 2 && (
                  <>
                    <line 
                      x1={measurePoints[0].x} 
                      y1={measurePoints[0].y} 
                      x2={measurePoints[1].x} 
                      y2={measurePoints[1].y} 
                      stroke="#f59e0b" 
                      strokeWidth="1" 
                      strokeDasharray="2,2"
                    />
                    {/* Distancia */}
                    {(() => {
                      const dx = measurePoints[1].x - measurePoints[0].x;
                      const dy = measurePoints[1].y - measurePoints[0].y;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      // Para vista frontal, usar escala frontal para el ancho y frontalHeightScale para la altura
                      const distanceMm = Math.round(Math.sqrt(
                        Math.pow(dx / frontalScale, 2) + 
                        Math.pow(dy / frontalHeightScale, 2)
                      ));
                      const midX = (measurePoints[0].x + measurePoints[1].x) / 2;
                      const midY = (measurePoints[0].y + measurePoints[1].y) / 2;
                      
                      return (
                        <g>
                          <rect 
                            x={midX - 15} 
                            y={midY - 5} 
                            width="30" 
                            height="8" 
                            fill="#f59e0b" 
                            rx="2"
                          />
                          <text 
                            x={midX} 
                            y={midY + 1.5} 
                            fontSize="4.5" 
                            textAnchor="middle" 
                            fill="#ffffff"
                            className="font-black"
                          >
                            {distanceMm}mm
                          </text>
                        </g>
                      );
                    })()}
                  </>
                )}
              </>
            )}
            
            {/* Indicador visual de snap */}
            {isMeasureMode && snapPreview && (
              <g>
                <circle 
                  cx={snapPreview.x} 
                  cy={snapPreview.y} 
                  r="3" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="1.5"
                  opacity="0.8"
                />
                <circle 
                  cx={snapPreview.x} 
                  cy={snapPreview.y} 
                  r="1.5" 
                  fill="#10b981" 
                  opacity="0.8"
                />
              </g>
            )}
          </g>
        </svg>

        {editingDim && (
          <div 
            className="fixed z-[100] animate-in zoom-in-95 duration-200"
            style={{ left: editingDim.clientX, top: editingDim.clientY, transform: 'translate(-50%, -50%)' }}
          >
            <div className="bg-white p-1 rounded-xl shadow-2xl border-2 border-indigo-600 flex items-center gap-1">
              <input 
                autoFocus
                type="number"
                value={editingDim.value}
                onChange={(e) => setEditingDim({ ...editingDim, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyDimensionChange(editingDim.type, editingDim.id, parseInt(editingDim.value) || 0);
                  if (e.key === 'Escape') setEditingDim(null);
                }}
                className="w-20 px-2 py-1 font-black text-indigo-600 text-sm outline-none bg-indigo-50 rounded-lg"
              />
              <button 
                onClick={() => applyDimensionChange(editingDim.type, editingDim.id, parseInt(editingDim.value) || 0)}
                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <CheckCircle2 size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="absolute right-6 bottom-6 flex flex-col gap-2 pointer-events-auto z-40">
          <button onClick={zoomIn} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100 active:scale-90">
            <Plus size={24} />
          </button>
          <button onClick={resetZoom} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100 active:scale-90">
            1:1
          </button>
          <button onClick={zoomOut} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100 active:scale-90">
            <Minus size={24} />
          </button>
        </div>
      </div>
    );
  };

  // Un clic fuera de los paneles laterales (Elementos, Accesorios, Módulos especiales) los cierra; los botones de la barra lateral
  // y el propio panel no cuentan como "fuera"
  useEffect(() => {
    if (!(isViewsPanelOpen || isElementsPanelOpen || isAccessoriesPanelOpen || isSpecialModulesPanelOpen)) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-side-panel], aside, .modal-content')) return;
      setIsViewsPanelOpen(false); setIsElementsPanelOpen(false); setIsAccessoriesPanelOpen(false); setIsSpecialModulesPanelOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [isViewsPanelOpen, isElementsPanelOpen, isAccessoriesPanelOpen, isSpecialModulesPanelOpen]);

  const togglePanel = (p: 'views'|'elements'|'workspace'|'accessories'|'special') => { 
    if(p==='views'){setIsViewsPanelOpen(!isViewsPanelOpen);setIsElementsPanelOpen(false);setIsAccessoriesPanelOpen(false);setIsSpecialModulesPanelOpen(false);}
    else if(p==='elements'){setIsElementsPanelOpen(!isElementsPanelOpen);setIsViewsPanelOpen(false);setIsAccessoriesPanelOpen(false);setIsSpecialModulesPanelOpen(false);}
    else if(p==='accessories'){setIsAccessoriesPanelOpen(!isAccessoriesPanelOpen);setIsElementsPanelOpen(false);setIsViewsPanelOpen(false);setIsSpecialModulesPanelOpen(false);}
    else if(p==='special'){setIsSpecialModulesPanelOpen(!isSpecialModulesPanelOpen);setIsElementsPanelOpen(false);setIsViewsPanelOpen(false);setIsAccessoriesPanelOpen(false);}
    else if(p==='workspace'){setIsWorkspaceModalOpen(!isWorkspaceModalOpen);}
  };

  const toggleAppliance = (type: ApplianceType) => {
    setAppliances(prev => {
      return prev.map(a => a.type === type ? { ...a, active: !a.active } : a);
    });
  };

  // Isla o península: se pide la medida general y se crea a 1 m del punto 0 en ambas cotas (después se editan)
  const addIsland = () => {
    const length = Math.round(parseFloat(islandDraft.length) || 0);
    const width = Math.round(parseFloat(islandDraft.width) || 0);
    if (length < 300 || width < 300) { window.alert('La isla o península necesita al menos 300 mm de largo y de ancho.'); return; }
    if (islandDraft.kind === 'peninsula' && layout !== 'L_SHAPE') { window.alert('La península solo se crea en cocinas en L: va pegada al muro perpendicular.'); return; }
    // La isla nace a 1 m del punto 0 en ambas cotas; la península va pegada al muro perpendicular B (cota X = 0, contra su cara interior) y a 1 m en Y
    setIslands(prev => [...prev, { id: Math.random().toString(36).substr(2, 6), kind: islandDraft.kind, length, width, dx: islandDraft.kind === 'peninsula' ? 0 : 1000, dy: 1000 }]);
  };
  const updateIsland = (id: string, patch: Partial<IslandItem>) => setIslands(prev => prev.map(i => (i.id === id ? { ...i, ...patch, ...(i.kind === 'peninsula' ? { dx: 0 } : {}) } : i)));
  const removeIsland = (id: string) => { setIslands(prev => prev.filter(i => i.id !== id)); setModules(prev => prev.filter(m => m.islandId !== id)); };

  type SpecialItem = { id: string; kind: 'tall-pantry' | 'tall-oven'; name: string; active: boolean; width: number; distance: number };

  // Coloca el módulo alto de una unidad (alacena alta o torre de hornos) si cabe en el muro activo. `used` = ancho ya ocupado
  // por módulos altos en ese muro (se pasa al activar varias a la vez). Devuelve false si no cabe.
  const placeSpecialModule = (special: SpecialItem, used?: number): boolean => {
    const wallLength = activeWall === 'A' ? wallA : activeWall === 'B' ? wallB - CORNER_BLIND_OFFSET : wallC - CORNER_BLIND_OFFSET;
    const currentWidth = used ?? modules.filter(m => m.wall === activeWall && m.type === 'TALL').reduce((acc, m) => acc + m.width, 0);
    if (currentWidth + special.width > wallLength) {
      alert(`⚠️ SOBREPASO: El módulo especial excede el espacio disponible en el muro.`);
      return false;
    }
    const tallHeight = spaceHeight - TOP_MARGIN - (hasZocalo ? zocaloHeight : 0);
    const template = MODULE_TEMPLATES.find(t => t.id === 'tall-oven');
    if (!template) return false;
    const newModule: KitchenModule = {
      ...template,
      uniqueId: `special-${special.id}-${Date.now()}`,
      wall: activeWall,
      positionX: special.distance,
      quantity: 1,
      height: tallHeight,
      width: special.width,
      name: special.name,
      type: 'TALL',
      doorType: 'vertical',
      configType: 'doors',
      hasPlateRack: false,
      drawerCount: 0,
    };
    setModules(prev => [...prev, newModule]);
    return true;
  };

  const removeSpecialModuleOnly = (id: string) => setModules(prev => prev.filter(m => !(m.type === 'TALL' && m.uniqueId.startsWith(`special-${id}-`))));

  // Interruptor de una alacena alta o torre de hornos: activa o desactiva TODAS las unidades de ese tipo
  const toggleSpecialGroup = (kind: 'tall-pantry' | 'tall-oven') => {
    const items = specialModules.filter(sm => sm.kind === kind);
    if (items.some(sm => sm.active)) {
      items.filter(sm => sm.active).forEach(sm => removeSpecialModuleOnly(sm.id));
      setSpecialModules(prev => prev.map(sm => (sm.kind === kind ? { ...sm, active: false } : sm)));
      return;
    }
    let used = modules.filter(m => m.wall === activeWall && m.type === 'TALL').reduce((acc, m) => acc + m.width, 0);
    const placed: string[] = [];
    for (const sm of items) {
      if (!placeSpecialModule(sm, used)) break;
      used += sm.width;
      placed.push(sm.id);
    }
    setSpecialModules(prev => prev.map(sm => (placed.includes(sm.id) ? { ...sm, active: true } : sm)));
  };

  // "+" de la tarjeta: crea otra unidad del mismo tipo, a continuación de las demás (si el tipo está activo, se coloca ya)
  const addSpecialModule = (kind: 'tall-pantry' | 'tall-oven') => {
    const sameKind = specialModules.filter(sm => sm.kind === kind);
    const n = sameKind.reduce((acc, sm) => Math.max(acc, parseInt(sm.name.match(/(\d+)$/)?.[1] ?? '1', 10)), 1) + 1;
    const baseName = kind === 'tall-pantry' ? 'Alacena Alta' : 'Torre de Hornos';
    const nextFree = specialModules.reduce((acc, sm) => Math.max(acc, sm.distance + sm.width), 0);
    const inst: SpecialItem = { id: `${kind}-${Date.now().toString(36)}`, kind, name: `${baseName} ${n}`, active: sameKind.some(sm => sm.active), width: 600, distance: nextFree };
    if (inst.active && !placeSpecialModule(inst)) inst.active = false;
    setSpecialModules(prev => [...prev, inst]);
  };

  // Quita una tarjeta adicional (y su módulo si estaba activa); las dos primeras no se quitan, solo se desactivan
  const removeSpecialModule = (id: string) => {
    setModules(prev => prev.filter(m => !(m.type === 'TALL' && m.uniqueId.startsWith(`special-${id}-`))));
    setSpecialModules(prev => prev.filter(sm => sm.id !== id));
  };

  const updateSpecialModuleProp = (id: string, prop: string, value: any) => {
    setSpecialModules(prev => prev.map(sm => sm.id === id ? { ...sm, [prop]: value } : sm));
    
    // También actualizar el módulo correspondiente si está activo
    const special = specialModules.find(sm => sm.id === id);
    if (special?.active) {
      setModules(prev => prev.map(m => 
        m.type === 'TALL' && m.uniqueId.startsWith(`special-${id}-`) 
          ? { ...m, [prop === 'distance' ? 'positionX' : prop]: value }
          : m
      ));
    }
  };

  // Largo útil de cada muro para ubicar electrodomésticos (en B y C se descuenta la esquina ciega)
  const wallUsableLength = (wall: WallName) => (wall === 'A' ? wallA : (wall === 'B' ? wallB : wallC) - CORNER_BLIND_OFFSET);

  // Mueve un electrodoméstico a un muro y posición (la usa el arrastre en la escena y el selector de muro)
  const moveAppliance = (type: ApplianceType, wall: WallName, distance: number) => {
    setAppliances(prev => prev.map(a => {
      if (a.type !== type) return a;
      const maxDistance = Math.max(0, wallUsableLength(wall) - a.width);
      return { ...a, wall, distance: Math.min(Math.max(distance, 0), maxDistance) };
    }));
  };

  const updateApplianceProp = (type: ApplianceType, prop: keyof Appliance, value: any) => {
    setAppliances(prev => {
      return prev.map(a => a.type === type ? { ...a, [prop]: value } : a);
    });
  };
  
  const quoteSummary = useMemo<QuoteSummary>(() => {
    let materialCost = 0, laborCost = 0, installationCost = 15000 * labeledModules.length;
    labeledModules.forEach(m => { materialCost += (m.basePrice||0)*0.5; laborCost += m.type==='LOWER'?50000:m.type==='UPPER'?40000:80000; });
    const subtotal = materialCost + laborCost + installationCost;
    return { materialCost, hardwareCost: 0, laborCost, installationCost, subtotal, margin: subtotal*0.4, total: subtotal*1.4, hardwareList: [] };
  }, [labeledModules]);

  // Generar BOM automáticamente
  useEffect(() => {
    if (labeledModules.length > 0) {
      const fillers: Array<{ height: number; depth: number; thickness: number; name: string; color?: string }> = boxes.filter(bx => bx.kind === 'filler').map(bx => ({ height: bx.sz, depth: Math.max(bx.sx, bx.sy), thickness: Math.min(bx.sx, bx.sy), name: bx.id.startsWith('visto-') ? 'Visto' : 'Pieza de dilatación' }));
      // Mesón y salpicaderos: largo x ancho x espesor (el salpicadero: largo x alto x espesor)
      boxes.filter(bx => bx.kind === 'counter').forEach(bx => {
        const splash = bx.id.startsWith('salpicadero-');
        const waterfall = bx.id.startsWith('cascada-');
        fillers.push(waterfall
          ? { height: bx.sz, depth: Math.max(bx.sx, bx.sy), thickness: Math.min(bx.sx, bx.sy), name: bx.name, color: 'Material del mesón' }
          : splash
          ? { height: Math.max(bx.sx, bx.sy), depth: bx.sz, thickness: Math.min(bx.sx, bx.sy), name: bx.name, color: 'Material del mesón' }
          : { height: Math.max(bx.sx, bx.sy), depth: Math.min(bx.sx, bx.sy), thickness: bx.sz, name: bx.name, color: 'Material del mesón' });
      });
      // El brazo de un esquinero en L se despieza como otro módulo bajo (del ancho y fondo de su brazo)
      const forBom = labeledModules.flatMap(m => (m.cornerArm ? [m, { ...m, uniqueId: `${m.uniqueId}-arm`, wall: m.cornerArm.wall, positionX: m.cornerArm.positionX ?? 0, width: m.cornerArm.width, depth: m.cornerArm.depth, cornerArm: undefined }] : [m]));
      const generatedBOM = generateBOM(forBom, lineType, faceColor, wallA, fillers);
      setBom(generatedBOM);
    }
  }, [labeledModules, lineType, faceColor, wallA, boxes]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {isSuggesting && <LoadingOverlay message={suggestMessage} />}
      <header className="px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur-lg border-b border-slate-200 z-[60]">
        <div className="flex items-center gap-3"><div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Box size={20} /></div><div><h1 className="text-base font-black text-slate-800 tracking-tighter uppercase">MODULLY</h1><span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none block">Cierre Exacto</span></div></div>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'design' && (
          <div className="relative flex-1 bg-white overflow-hidden flex flex-row h-full">
            <aside className={`relative h-full transition-all duration-300 ease-in-out bg-slate-50 border-r border-slate-200 flex flex-col items-center py-4 gap-4 z-[55] shadow-xl overflow-y-auto no-scrollbar ${isSidebarVisible ? (isSidebarCollapsed ? 'w-20' : 'w-48') : 'w-0 opacity-0 pointer-events-none'}`}>
              <div className="flex flex-col gap-2 w-full px-3"><button onClick={() => setIsSidebarVisible(false)} className="w-full h-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-red-500 transition-colors shadow-sm mb-2"><X size={18} /></button><button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full h-10 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors mb-2 shadow-sm">{isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button></div>
              <div className="flex flex-col gap-4 w-full px-3 mt-4">
                <SidebarToolButton active={isViewsPanelOpen} onClick={() => togglePanel('views')} icon={<Eye size={24} />} label="Vistas" collapsed={isSidebarCollapsed} />
                <SidebarToolButton active={isElementsPanelOpen} onClick={() => togglePanel('elements')} icon={<Settings2 size={24} />} label="Elementos" collapsed={isSidebarCollapsed} badge={modules.length > 0 ? modules.length.toString() : undefined} />
                <SidebarToolButton active={isAccessoriesPanelOpen} onClick={() => togglePanel('accessories')} icon={<Utensils size={24} />} label="Accesorios" collapsed={isSidebarCollapsed} badge={appliances.filter(a => a.active).length > 0 ? appliances.filter(a => a.active).length.toString() : undefined} />
                <SidebarToolButton active={isSpecialModulesPanelOpen} onClick={() => togglePanel('special')} icon={<Archive size={24} />} label="Especiales" collapsed={isSidebarCollapsed} badge={specialModules.filter(sm => sm.active).length > 0 ? specialModules.filter(sm => sm.active).length.toString() : undefined} />
                <SidebarToolButton active={isWorkspaceModalOpen} onClick={() => togglePanel('workspace')} icon={<Maximize size={24} />} label="Espacio" collapsed={isSidebarCollapsed} />
                <SidebarToolButton 
                  active={isMeasureMode} 
                  onClick={() => {
                    setIsMeasureMode(!isMeasureMode);
                    setMeasurePoints([]);
                    setSnapPreview(null);
                  }} 
                  icon={<Ruler size={24} />} 
                  label="Medir" 
                  collapsed={isSidebarCollapsed}
                  badge={measurePoints.length > 0 ? measurePoints.length.toString() : undefined}
                />
                <SidebarToolButton 
                  active={isAgentPanelOpen} 
                  onClick={() => setIsAgentPanelOpen(!isAgentPanelOpen)} 
                  icon={<Sparkles size={24} />} 
                  label="Asistente" 
                  collapsed={isSidebarCollapsed}
                />
              </div>
            </aside>
            <div className="flex-1 relative bg-slate-50 self-stretch min-h-0">
              {!isSidebarVisible && (<button onClick={() => setIsSidebarVisible(true)} className="absolute left-0 top-1/2 -translate-y-1/2 z-[50] bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-r-2xl shadow-xl text-indigo-600 hover:pr-5 transition-all group"><Menu size={20} /></button>)}
              
              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-2xl z-[45] border-r border-slate-200 shadow-2xl transition-all duration-500 ease-out transform ${isElementsPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-8">
                  <div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Plan de Diseño</h2><p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Cotas Editables ISO</p></div><button onClick={() => setIsElementsPanelOpen(false)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500"><X size={20} /></button></div>
                  <div className="space-y-4 flex-1 flex flex-col min-h-0"><div className="flex items-center justify-between px-1"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulos en Escena</h3><span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full">{modules.length}</span></div><div className="flex-1 overflow-y-auto no-scrollbar space-y-2">{labeledModules.map(m => (
                    <div key={m.uniqueId} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-600 text-white font-black text-xs">{m.label}</div>
                          <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{m.name}</p>
                        </div>
                        <button onClick={() => deleteModule(m.uniqueId)} className="p-2 text-slate-300 hover:text-red-500" title="Eliminar módulo"><Trash2 size={14} /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <MeasureInput label="Ancho" value={m.width} onCommit={(v) => applyDimensionChange('module', m.uniqueId, v)} />
                        <MeasureInput label="Alto" value={m.height} onCommit={(v) => updateModuleMeasure(m.uniqueId, 'height', v)} />
                        <MeasureInput label="Fondo" value={m.depth} onCommit={(v) => updateModuleMeasure(m.uniqueId, 'depth', v)} />
                      </div>
                    </div>
                  ))}</div></div>
                </div>
              </div>

              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-2xl z-[45] border-r border-slate-200 shadow-2xl transition-all duration-500 ease-out transform ${isAccessoriesPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-8">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Accesorios</h2><p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Electrodomésticos</p></div>
                    <button onClick={() => setIsAccessoriesPanelOpen(false)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    {appliances.map((app) => (
                      <div key={app.type} className={`p-4 rounded-3xl border-2 transition-all space-y-4 ${app.active ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${app.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              {app.type === 'fridge' && <Refrigerator size={20} />}
                              {app.type === 'stove' && <Flame size={20} />}
                              {app.type === 'sink' && <Droplets size={20} />}
                              {app.type === 'hood-under' && <Wind size={20} />}
                              {app.type === 'pantry' && <Archive size={20} />}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                {app.type === 'fridge' ? 'Nevera' : app.type === 'stove' ? 'Estufa' : app.type === 'sink' ? 'Poceta / Grifería' : app.type === 'pantry' ? 'Alacena Alta' : 'Campana'}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{app.active ? 'Activo' : 'Desactivado'}</p>
                            </div>
                          </div>
                          <button onClick={() => toggleAppliance(app.type)} className={`w-10 h-5 rounded-full transition-all relative ${app.active ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${app.active ? 'left-5.5' : 'left-0.5'}`} /></button>
                        </div>
                        {app.active && (
                          <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Muro</label>
                            <div className="flex gap-2">
                              {(['A', 'B', 'C'] as WallName[]).filter(w => w === 'A' || (w === 'B' && armB) || (w === 'C' && armC)).map(w => (
                                <button
                                  key={w}
                                  onClick={() => moveAppliance(app.type, w, app.wall === w ? app.distance : 0)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${app.wall === w ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-400'}`}
                                  title={`Ubicar en el muro ${w}`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {app.active && (
                          <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Ancho (mm)</label><input type="number" value={app.width} onChange={(e) => updateApplianceProp(app.type, 'width', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                            <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Posición (mm)</label><input type="number" value={app.distance} onChange={(e) => updateApplianceProp(app.type, 'distance', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-2xl z-[45] border-r border-slate-200 shadow-2xl transition-all duration-500 ease-out transform ${isSpecialModulesPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-8">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Módulos Especiales</h2><p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Configuración Avanzada</p></div>
                    <button onClick={() => setIsSpecialModulesPanelOpen(false)} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500"><X size={20} /></button>
                  </div>
                  <div className="space-y-4">
                    {(['tall-pantry', 'tall-oven'] as const).map(kind => {
                      const items = specialModules.filter(sm => sm.kind === kind);
                      const anyActive = items.some(sm => sm.active);
                      const title = kind === 'tall-pantry' ? 'Alacena Alta' : 'Torre de Hornos';
                      return (
                        <div key={kind} className={`p-4 rounded-3xl border-2 transition-all space-y-4 ${anyActive ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${anyActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {kind === 'tall-pantry' ? <Archive size={20} /> : <Flame size={20} />}
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{title}{items.length > 1 ? ` × ${items.length}` : ''}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{anyActive ? 'Activo' : 'Desactivado'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => addSpecialModule(kind)}
                                className="w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white border-2 border-white shadow flex items-center justify-center"
                                title={`Crear otra ${kind === 'tall-pantry' ? 'alacena alta' : 'torre de hornos'}`}
                              ><Plus size={14} strokeWidth={3} /></button>
                              <button onClick={() => toggleSpecialGroup(kind)} className={`w-10 h-5 rounded-full transition-all relative ${anyActive ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${anyActive ? 'left-5.5' : 'left-0.5'}`} /></button>
                            </div>
                          </div>
                          {anyActive && items.map(special => (
                            <div key={special.id} className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                              {items.length > 1 && (
                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-black text-indigo-600 uppercase">{special.name}</p>
                                  {pendingDelete === special.id ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-[9px] font-black text-slate-600 uppercase">¿Borrar?</span>
                                      <button onClick={() => { removeSpecialModule(special.id); setPendingDelete(null); }} className="px-1.5 py-0.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase">Sí</button>
                                      <button onClick={() => setPendingDelete(null)} className="px-1.5 py-0.5 rounded-md bg-white text-slate-500 text-[9px] font-black uppercase border border-slate-200">No</button>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setPendingDelete(special.id)}
                                      className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white border-2 border-white shadow flex items-center justify-center"
                                      title={`Borrar ${special.name}`}
                                    ><X size={12} strokeWidth={3} /></button>
                                  )}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Ancho (mm)</label><input type="number" value={special.width} onChange={(e) => updateSpecialModuleProp(special.id, 'width', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                                <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Posición (mm)</label><input type="number" value={special.distance} onChange={(e) => updateSpecialModuleProp(special.id, 'distance', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <Modal isOpen={isAgentPanelOpen} onClose={() => setIsAgentPanelOpen(false)} title="Asistente de Diseño">
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Describe qué quieres mejorar y el asistente revisará la distribución actual con base en las dimensiones, módulos y electrodomésticos activos.</p>
                  <textarea
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleAgentRequest}
                    disabled={isAgentLoading}
                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isAgentLoading ? 'Analizando...' : 'Consultar asistente'}
                  </button>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                    {isAgentLoading ? 'Generando respuesta...' : agentResponse}
                  </div>
                </div>
              </Modal>

              <Modal isOpen={isWorkspaceModalOpen} onClose={() => setIsWorkspaceModalOpen(false)} title="Configuración de Espacio">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Cocina</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['STRAIGHT', 'L_SHAPE', 'U_SHAPE'] as LayoutType[]).map((l) => (
                        <button key={l} onClick={() => setLayout(l)} className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 ${layout === l ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
                          <KitchenShapeIcon shape={l} size={30} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">{l === 'STRAIGHT' ? 'Recta' : l === 'L_SHAPE' ? 'En L' : 'En U'}</span>
                        </button>
                      ))}
                    </div>
                    {layout === 'L_SHAPE' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">¿De qué lado va el brazo de la L?</label>
                        <div className="grid grid-cols-2 gap-3">
                          {(['left', 'right'] as const).map(side => (
                            <button key={side} onClick={() => setLArm(side)} className={`py-3 rounded-2xl border-2 text-[11px] font-black uppercase tracking-wide transition-all ${lArm === side ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>{side === 'left' ? 'Izquierda' : 'Derecha'}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Largo Muro A (mm)</label><div className="relative group"><DeferredNumber  value={wallA} onCommit={n => setWallA(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Altura Techo (mm)</label><div className="relative group"><DeferredNumber  value={spaceHeight} onCommit={n => setSpaceHeight(Math.max(1000, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                    </div>
                    
                    {(layout === 'L_SHAPE' || layout === 'U_SHAPE') && (
                      <div className={`grid ${layout === 'U_SHAPE' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 animate-in fade-in slide-in-from-top-2 duration-300`}>
                        <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{layout === 'L_SHAPE' && lArm === 'right' ? 'Largo del brazo (muro C) (mm)' : layout === 'L_SHAPE' ? 'Largo del brazo (muro B) (mm)' : 'Largo Muro B (mm)'}</label><div className="relative group"><DeferredNumber  value={layout === 'L_SHAPE' && lArm === 'right' ? wallC : wallB} onCommit={n => (layout === 'L_SHAPE' && lArm === 'right' ? setWallC : setWallB)(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                        {layout === 'U_SHAPE' && (
                          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Largo Muro C (mm)</label><div className="relative group"><DeferredNumber  value={wallC} onCommit={n => setWallC(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zócalo Perimetral</label>
                        <p className="text-[9px] font-bold text-slate-500 mt-1">Base inferior de los muebles</p>
                      </div>
                      <button onClick={() => setHasZocalo(!hasZocalo)} className={`w-10 h-5 rounded-full transition-all relative ${hasZocalo ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasZocalo ? 'left-5.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    
                    {hasZocalo && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Altura Zócalo (mm)</label>
                          <div className="relative group">
                            <DeferredNumber 
                               
                              value={zocaloHeight} 
                              onCommit={n => setZocaloHeight(Math.max(50, Math.min(200, n)))} 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Profundidad (mm)</label>
                          <div className="relative group">
                            <DeferredNumber 
                               
                              value={zocaloDepth} 
                              onCommit={n => setZocaloDepth(Math.max(100, Math.min(800, n)))} 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-3xl border-2 border-slate-100 bg-white space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500"><IslandIcon size={22} /></div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Isla / Península</p>
                          <p className="text-[9px] font-bold text-slate-400">Medida general · isla a 1 m del punto 0 · península solo en cocina en L, pegada al muro perpendicular · zócalo 5 cm más pequeño</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['isla', 'peninsula'] as const).map(k => (
                          <button key={k} disabled={k === 'peninsula' && layout !== 'L_SHAPE'} title={k === 'peninsula' && layout !== 'L_SHAPE' ? 'La península solo se crea en cocinas en L' : undefined} onClick={() => setIslandDraft({ ...islandDraft, kind: k })} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border-2 disabled:opacity-40 disabled:cursor-not-allowed ${islandDraft.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{k === 'isla' ? 'Isla' : 'Península'}</button>
                        ))}
                      </div>
                      {layout !== 'L_SHAPE' && <p className="text-[9px] font-bold text-amber-600 px-1">La península solo está disponible en cocinas en L: elige "En L" en el tipo de cocina.</p>}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Largo (mm)</label><input type="number" value={islandDraft.length} onChange={(e) => setIslandDraft({ ...islandDraft, length: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Ancho (mm)</label><input type="number" value={islandDraft.width} onChange={(e) => setIslandDraft({ ...islandDraft, width: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                      </div>
                      <button onClick={addIsland} className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest">Aceptar y crear</button>

                      {islands.map(isl => (
                        <div key={isl.id} className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-indigo-700 uppercase">{isl.kind === 'isla' ? 'Isla' : 'Península'} {isl.length} × {isl.width}{isl.kind === 'peninsula' && layout !== 'L_SHAPE' ? ' · inactiva (solo en L)' : ''}</p>
                            {pendingDelete === isl.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-600 uppercase">¿Eliminar?</span>
                                <button onClick={() => { removeIsland(isl.id); setPendingDelete(null); }} className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase">Sí</button>
                                <button onClick={() => setPendingDelete(null)} className="px-2 py-1 rounded-lg bg-white text-slate-500 hover:text-slate-700 text-[9px] font-black uppercase border border-slate-200">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setPendingDelete(isl.id)} className="p-1 rounded-lg bg-white text-slate-400 hover:text-red-500" title="Eliminar"><X size={14} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(['isla', 'peninsula'] as const).map(k => (
                              <button
                                key={k}
                                disabled={k === 'peninsula' && layout !== 'L_SHAPE' && isl.kind !== 'peninsula'}
                                title={k === 'peninsula' && layout !== 'L_SHAPE' ? 'La península solo se crea en cocinas en L' : undefined}
                                onClick={() => updateIsland(isl.id, k === 'peninsula' ? { kind: 'peninsula' } : { kind: 'isla', dx: 1000 })}
                                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide border-2 disabled:opacity-40 disabled:cursor-not-allowed ${isl.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}
                              >{k === 'isla' ? 'Isla' : 'Península'}</button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {([['length', 'Largo'], ['width', 'Ancho'], ['dx', 'Cota X desde 0'], ['dy', 'Cota Y desde 0']] as const).map(([key, label]) => (
                              <div key={key} className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                <input type="number" disabled={isl.kind === 'peninsula' && key === 'dx'} value={isl[key]} onChange={(e) => updateIsland(isl.id, { [key]: Math.max(key === 'length' || key === 'width' ? 300 : 0, parseInt(e.target.value) || 0) })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mesón</label>
                        <p className="text-[9px] font-bold text-slate-500 mt-1">Losa sobre los módulos bajos, con aberturas para poceta y estufa</p>
                      </div>
                      <button onClick={() => setHasCounter(!hasCounter)} className={`w-10 h-5 rounded-full transition-all relative ${hasCounter ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasCounter ? 'left-5.5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {hasCounter && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Espesor (mm)</label>
                          <div className="relative group">
                            <DeferredNumber
                              
                              value={counterThickness}
                              onCommit={n => setCounterThickness(Math.max(10, Math.min(80, n)))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Voladizo frontal (mm)</label>
                          <div className="relative group">
                            <DeferredNumber
                              
                              value={counterOverhang}
                              onCommit={n => setCounterOverhang(Math.max(0, Math.min(100, n)))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasCounter && (
                      <>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salpicadero</label>
                            <p className="text-[9px] font-bold text-slate-500 mt-1">Parte del mesón, del mismo material: atrás y en los lados donde hay muro o un módulo más alto</p>
                          </div>
                          <button onClick={() => setHasSplash(!hasSplash)} className={`w-10 h-5 rounded-full transition-all relative ${hasSplash ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasSplash ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                        {hasSplash && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Altura del salpicadero (mm)</label>
                            <div className="relative group">
                              <DeferredNumber
                                
                                value={splashHeight}
                                onCommit={n => setSplashHeight(Math.max(20, Math.min(600, n)))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dilatación</label>
                    <p className="text-[9px] font-bold text-slate-500 mt-1">Se pide por módulo: doble clic sobre el módulo, sección "Dilatada" (lado, espesor, fondo y altura)</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Muros Auxiliares</label>
                        <p className="text-[9px] font-bold text-slate-500 mt-1">Paredes en extremos del perímetro</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Muro Izquierdo</label>
                          <p className="text-[9px] font-bold text-slate-500 mt-0.5">Inicio del perímetro</p>
                        </div>
                        <button onClick={() => setHasLeftClosure(!hasLeftClosure)} className={`w-10 h-5 rounded-full transition-all relative ${hasLeftClosure ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasLeftClosure ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Muro Derecho</label>
                          <p className="text-[9px] font-bold text-slate-500 mt-0.5">Final del perímetro</p>
                        </div>
                        <button onClick={() => setHasRightClosure(!hasRightClosure)} className={`w-10 h-5 rounded-full transition-all relative ${hasRightClosure ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasRightClosure ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Modal>

              {/* Las 4 vistas (planta, frontal, isométrica y 3D) son cámaras de la misma escena 3D */}
              {(
                <KitchenViewer3D
                  layout={layout} 
                  wallA={wallA} 
                  wallB={wallB} 
                  wallC={wallC} 
                  spaceHeight={spaceHeight} 
                  floorWidth={floorWidth} 
                  floorLength={floorLength} 
                  modules={modulesWithCoords3D}
                  boxes={boxes}
                  appliances={appliances}
                  hasIsland={hasIsland} 
                  island={island} 
                  islands={activeIslands}
                  lArm={lArm}
                  onEditIsland={updateIsland}
                  onDeleteIsland={removeIsland}
                  viewMode={activeView} 
                  hasZocalo={hasZocalo} 
                  zocaloHeight={zocaloHeight} 
                  hasLeftClosure={hasLeftClosure} 
                  hasRightClosure={hasRightClosure}
                  onDeleteModule={deleteModule}
                  onSplitModule={splitModule}
                  onEditModuleDimension={(id, width) => resizeModuleFromLabel(id, width)}
                  onEditModuleMeasure={updateModuleMeasure}
                  onSetModuleTopEdge={setModuleTopEdge}
                  counterSettings={{ thickness: counterThickness, overhang: counterOverhang, hasSplash, splashHeight }}
                  onEditCounter={(s, counterId, extras) => { applyCounterEdit(s, counterId, extras); }}
                  onSetModuleVistos={setModuleVistos}
                  onSplitHorizontal={splitModuleHorizontal}
                  onSplitDepth={splitModuleDepthwise}
                  onExtendFace={extendModuleFace}
                  onJoinCorner={joinCornerModules}
                  onSplitCorner={splitCornerModule}
                  onEditCornerArm={editCornerArmWidth}
                  onDragModule={handleDragModule3D}
                  onResizeEdge={handleResizeEdge3D}
                  onMoveAppliance={moveAppliance}
                  visibility={visibility}
                  collisions={collidingBoxes}
                  measureMode={isMeasureMode}
                  onResizeJunction={handleResizeJunction3D}
                />
              )}
              {/* Indicador de modo de medici\u00f3n */}
              {isMeasureMode && (
                <div className="absolute top-20 left-4 z-40 pointer-events-auto animate-in slide-in-from-left duration-300">
                  <div className="bg-amber-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-b-4 border-amber-700">
                    <Ruler size={24} className="animate-pulse" />
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight">Modo Medición Activo</p>
                      <p className="text-[10px] font-bold opacity-90">
                        Clic en dos puntos · se pega a las esquinas · Esc cancela · Supr borra la última
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsMeasureMode(false);
                        setMeasurePoints([]);
                        setSnapPreview(null);
                      }}
                      className="ml-4 bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all"
                      title="Cerrar modo medici\u00f3n"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-30 pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/50 flex flex-wrap items-center gap-x-3 gap-y-2 max-w-[calc(100%-12rem)]">
                  <div className="flex gap-1">
                    {['plan', 'frontal', 'isometric', '3d'].map(v => (
                      <button key={v} onClick={() => setActiveView(v as any)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeView === v ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{v}</button>
                    ))}
                  </div>
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="flex gap-1">
                    <button onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <Undo2 size={16} />
                    </button>
                    <button onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)" aria-label="Rehacer" className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <Redo2 size={16} />
                    </button>
                  </div>
                  {collisions.length > 0 && (
                    <div
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 border border-red-300 text-red-600 text-[9px] font-black uppercase tracking-wide"
                      title={collisions.map(([p, q]) => `${p.name} choca con ${q.name}`).join('\n')}
                      role="alert"
                    >
                      <AlertCircle size={12} />
                      {collisions.length} {collisions.length === 1 ? 'choque' : 'choques'}
                    </div>
                  )}
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="flex gap-1">
                    {([['upper', 'MA', 'los muebles aéreos (MA)'], ['lower', 'MB', 'los muebles base (MB)'], ['counter', 'Mesón', 'el mesón'], ['appliances', 'Electro', 'los electrodomésticos']] as const).map(([key, label, full]) => (
                      <button
                        key={key}
                        onClick={() => setVisibility(v => ({ ...v, [key]: !v[key] }))}
                        title={`${visibility[key] ? 'Ocultar' : 'Mostrar'} ${full}`}
                        aria-pressed={visibility[key]}
                        className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all border ${visibility[key] ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-300 border-transparent line-through'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative pointer-events-auto flex flex-col items-end gap-2">
                  <button 
                    onClick={() => setIsOptMenuOpen(!isOptMenuOpen)}
                    disabled={isSuggesting} 
                    className="bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 active:scale-95 transition-all border-b-4 border-indigo-800 group"
                  >
                    <Sparkles size={20} className={isSuggesting ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'} />
                    <span className="text-xs font-black uppercase tracking-tight">Optimizar Modulación</span>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${isOptMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOptMenuOpen && (
                    <div className="absolute top-full mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[80] animate-in slide-in-from-top-2 duration-300 flex flex-col gap-1">
                      <button 
                        onClick={() => handleMathematicalSuggestion('efficiency')}
                        className="flex items-center gap-4 p-3 rounded-2xl hover:bg-indigo-50 text-left transition-all group"
                      >
                        <div className="bg-amber-100 text-amber-600 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <ZapIcon size={18} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Estrategia Eficiencia</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Prioriza módulos de 900mm</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleMathematicalSuggestion('standard')}
                        className="flex items-center gap-4 p-3 rounded-2xl hover:bg-indigo-50 text-left transition-all group"
                      >
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Target size={18} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Estrategia Estándar</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Prioriza módulos de 600mm</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleMathematicalSuggestion('detailed')}
                        className="flex items-center gap-4 p-3 rounded-2xl hover:bg-indigo-50 text-left transition-all group"
                      >
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Layers2 size={18} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Estrategia Detallada</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Prioriza módulos de 300mm</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'catalog' && (<div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24"><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Catálogo</h2><div className="grid grid-cols-1 gap-3">{MODULE_TEMPLATES.map(m => (<button key={m.id} onClick={() => { addModule(m.id); setActiveTab('design'); }} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-indigo-500 transition-all"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xs" style={{ background: COLORS[m.type] }}>{m.width}</div><p className="text-sm font-black text-slate-800 uppercase">{m.name}</p></div><Plus size={20} className="text-indigo-600" /></button>))}</div></div>)}
        {activeTab === 'quote' && (<div className="flex-1 overflow-y-auto p-6 pb-24"><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Presupuesto</h2><div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col gap-2"><p className="text-xs font-black uppercase tracking-widest opacity-80">Total Proyecto Estimado</p><p className="text-5xl font-black">${quoteSummary.total.toLocaleString()}</p></div></div>)}
        {activeTab === 'listado' && (
          <div className="flex-1 overflow-y-auto p-6 pb-24">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Listado de Partes</h2>
              <div className="flex items-center gap-2">
                <button onClick={exportBoxesJSON} disabled={boxes.length === 0} className="flex items-center gap-2 bg-slate-700 text-white px-6 py-2 rounded-2xl font-black text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors shadow-lg">
                  <Download size={16} />
                  Cajas para Fusion
                </button>
                <button onClick={() => bom && exportBOMToExcel(bom)} disabled={!bom} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors shadow-lg">
                  <Download size={16} />
                  Descargar Excel
                </button>
              </div>
            </div>
            {bom && bom.pieces.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-slate-100 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="px-3 py-2 text-left font-black text-slate-700">ITEM</th>
                          <th className="px-3 py-2 text-left font-black text-slate-700">PARTE</th>
                          <th className="px-3 py-2 text-center font-black text-slate-700">C/D</th>
                          <th className="px-3 py-2 text-right font-black text-slate-700">LAR</th>
                          <th className="px-3 py-2 text-right font-black text-slate-700">AN</th>
                          <th className="px-3 py-2 text-right font-black text-slate-700">CAL</th>
                          <th className="px-3 py-2 text-left font-black text-slate-700">COLOR</th>
                          <th className="px-3 py-2 text-left font-black text-slate-700">CANTO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {bom.pieces.map(piece => (
                          <tr key={`${piece.item}-${piece.name}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-black text-slate-700">{piece.item}</td>
                            <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{piece.name}</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-700">{piece.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{piece.length}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{piece.width}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{piece.thickness}</td>
                            <td className="px-3 py-2 text-slate-600">{piece.color}</td>
                            <td className="px-3 py-2 text-slate-600">{piece.edgeType || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
                  <p className="text-sm font-black text-slate-700">📊 Total: <span className="text-indigo-600">{bom.totalPieces} piezas</span> • 📏 Muro: <span className="text-indigo-600">{bom.kitchenConfig.wallWidth}mm</span> • 🎨 Línea: <span className="text-indigo-600">{bom.kitchenConfig.lineType}</span> • 🌈 Color: <span className="text-indigo-600">{bom.kitchenConfig.faceColor}</span></p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-center">
                <p className="text-slate-400 font-bold uppercase">Agrega módulos para generar el listado</p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'config' && (<div className="flex-1 overflow-y-auto p-6 pb-24"><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-4">Ajustes</h2><label className="block mb-4"><span className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1">Largo Muro A (mm)</span><input type="number" value={wallA} onChange={e => setWallA(parseInt(e.target.value))} className="w-full bg-white border rounded-2xl p-4 font-black text-slate-800" /></label><label className="block mb-4"><span className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1">Línea de Producto</span><select value={lineType} onChange={e => setLineType(e.target.value as any)} className="w-full bg-white border rounded-2xl p-4 font-black text-slate-800"><option>Básica</option><option>Media</option><option>Alta</option></select></label><label className="block mb-4"><span className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1">Color de Fachada</span><input type="text" value={faceColor} onChange={e => setFaceColor(e.target.value)} placeholder="Ej: Blanco, Ámbar, Gris" className="w-full bg-white border rounded-2xl p-4 font-black text-slate-800" /></label></div>)}
      </main>
      <nav className="h-20 bg-white border-t border-slate-200 flex items-center px-4 pb-2 shadow-2xl z-[70]"><BottomNavItem active={activeTab === 'design'} onClick={() => setActiveTab('design')} icon={<Layout />} label="DISEÑO" /><BottomNavItem active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')} icon={<Component />} label="MÓDULOS" /><BottomNavItem active={activeTab === 'quote'} onClick={() => setActiveTab('quote')} icon={<ShoppingCart />} label="PRECIOS" /><BottomNavItem active={activeTab === 'listado'} onClick={() => setActiveTab('listado')} icon={<Table />} label="LISTADO" badge={bom ? bom.pieces.length.toString() : undefined} /><BottomNavItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings />} label="AJUSTES" /></nav>
    </div>
  );
}
