
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box, Settings, Layout, ShoppingCart, Trash2, Plus, Settings2, Palette,
  Sparkles, Printer, Save, RefreshCcw, Loader2, Wand2, Pencil,
  Square, Frame, BoxSelect, Globe, Eye, ChevronLeft, ChevronRight, Menu,
  Flame, Droplets, Refrigerator, Wind, Component, X, List, Layers, Info, WashingMachine,
  ZoomIn, ZoomOut, Zap, Maximize, Ruler, ArrowRight, MoveHorizontal, Move,
  TowerControl as Tower, AlertCircle, CheckCircle2, ChevronDown, Puzzle, ToggleLeft as Toggle,
  Construction, Minus, Target, ZapIcon, Layers2, Archive, Download, Table, Undo2, Redo2, Home, LayoutGrid, FolderOpen, FileText, Image as ImageIcon,
  UserRound, Search, Microwave, CookingPot, DoorOpen,
} from 'lucide-react';
import {
  KitchenModule, LayoutType, WallName,
  Appliance, ApplianceType, UnitType, QuoteSummary, ConfigType, DoorType, BOM
} from './types';
import {
  MODULE_TEMPLATES, LABOR_CONFIG, COLORS
} from './constants';
import { CounterEditor, KitchenViewer3D, cambiosDelMeson, ladosDelMeson } from './KitchenViewer3D';
import { getAgentAdvice, type KitchenAgentContext } from './agentService';
import { generateBOM, exportBOMToExcel } from './bomService';
import { listaDePiezas, exportarListadoDeCorte, bordesDeCanto, archivoListadoDeCorte } from './piezas';
import { Optimizador } from './PanelLaminas';
import { PlanosEnsamble } from './PlanosEnsamble';
import { RenderVista } from './RenderVista';
import { Bosquejo, DatosBosquejo, EvidenciasBoceto, tramoModulos, anchosFila, anchoComun, estrategiaPorAncho, HOLGURA_MURO } from './Bosquejo';
import { Inicio } from './Inicio';
import { EsquemaModulos, EsquemaCorredera, Foco } from './EsquemaModulos';
import { VistaLateral, TramoAltura } from './VistaLateral';
import { ModulosEspeciales, ModuloEspecial, opcionesMuebleHorno, muebleDeVariante, etiquetaMueble, VARIANTE_POR_DEFECTO } from './ModulosEspeciales';
import { ACABADOS, Acabados, AcabadosNivel, CALIBRES, PATAS_POR_MUEBLE, CATALOGO, Tablero, buscarColores, calTexto, colorDeCatalogo, completarAcabados, esBlanco, hexDe, tieneVeta } from './colores';
import { vetaMiniatura } from './veta';
import { PlanoLimpio } from './PlanoLimpio';
import { Proyectos, DialogoAprobar, ProductoActivo } from './Proyectos';
import { subirDocumentos, archivoDeDataURL, DocumentoNuevo, guardarDiseno, marcarAprobado, guardarEnBiblioteca, listarBiblioteca, sesionActual, alCambiarSesion } from './nube';
import { Biblioteca, huellaDiseno } from './Biblioteca';
import { Precios } from './Precios';
import { PUNTO_INFO, puntosAdecuacion } from './puntos';
import { MiniEspacio } from './MiniEspacio';
import { htmlLaminas } from './PanelLaminas';
import { htmlPlanos } from './PlanosEnsamble';
import { resizeSymmetric, snapToNeighbors } from './moduleResize';
import type { CounterExtras, Box as BoxData } from './boxes';
import { closetDerived } from './boxes';
import { PuertaCfg, DEFAULT_PUERTA, conTapaluz } from './puertas';
import type { IslandItem, ColumnItem, ClosetConfig } from './types';
import { DEFAULT_CLOSET, DEFAULT_FIT, DEFAULT_ARM, esEquipoTorre } from './types';
import type { ClosetFit } from './types';
import { SECTIONS, SECTION_ORDER, SectionId } from './sections';
import { buildBoxes, fitRows, boxesToJSON, armUpperOrigin, findCollisions, LOWER_DEPTH, UPPER_DEPTH, CORNER_BLIND_OFFSET, TOP_MARGIN, MAX_MODULE_WIDTH, SPLASH_HEIGHT_DEFAULT, COUNTER_THICKNESS_DEFAULT, COUNTER_OVERHANG_DEFAULT, FRIDGE_CLEARANCE, OVER_FRIDGE_DEPTH, DILATATION_GAP_DEFAULT, DILATATION_DEPTH_DEFAULT } from './boxes';

// Constantes de diseño técnico
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

/** Iconos lineales arquitectónicos para cada categoría del menú superior y panel 3D */
const SectionLineIcon: React.FC<{ id: SectionId; size?: number }> = ({ id, size = 19 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (id === 'cocinas') {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="6" height="16" rx="0.8" />
        <path d="M3 10h6" />
        <rect x="11" y="4" width="10" height="4.5" rx="0.7" />
        <rect x="9" y="12.5" width="12" height="7.5" rx="0.7" />
        <rect x="12.5" y="14.6" width="5" height="3.2" rx="0.4" />
      </svg>
    );
  }
  if (id === 'closets') {
    return (
      <svg {...props}>
        <rect x="3.5" y="4" width="17" height="16" rx="1" />
        <path d="M12 4v16" />
        <path d="M3.5 9.5h8.5M3.5 14.5h8.5" />
        <path d="M16 7.5v9M14 9.5L16 7.5l2 2M14 14.5L16 16.5l2-2" />
      </svg>
    );
  }
  if (id === 'closetfit') {
    return (
      <svg {...props}>
        <rect x="4.5" y="3.5" width="15" height="17" rx="1" />
        <path d="M4.5 15.5h15" />
        <path d="M12 3.5v12" />
        <path d="M9.5 8.5v2.5M14.5 8.5v2.5M10.5 18h3" />
      </svg>
    );
  }
  if (id === 'walking') {
    return (
      <svg {...props}>
        <path d="M5 4.5v15.5M19 4.5v15.5" />
        <path d="M3.5 5.5h17M3.5 17h17" />
        <path d="M12 5.5v2.2" />
        <path d="M12 7.7L7 11.4a.7.7 0 0 0 .4 1.3h9.2a.7.7 0 0 0 .4-1.3L12 7.7Z" />
      </svg>
    );
  }
  if (id === 'puertas') {
    return (
      <svg {...props}>
        <path d="M3 21h18" />
        <path d="M5.5 21V3.5h13V21" />
        <path d="M7.8 21V5.8h8.4V21" />
        <path d="M13.6 13h1.2" />
      </svg>
    );
  }
  if (id === 'bano') {
    return (
      <svg {...props}>
        <path d="M12 8.5V4.8a2 2 0 0 1 3.8-.6" />
        <path d="M6.5 8.5c0 2.4 2.2 3.8 5.5 3.8s5.5-1.4 5.5-3.8H6.5Z" />
        <path d="M3.5 12.3h17" />
        <rect x="5" y="12.3" width="14" height="7" rx="0.4" />
        <path d="M12 12.3v7M6.8 19.3V21M17.2 19.3V21" />
        <circle cx="9.8" cy="15.8" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="14.2" cy="15.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="5.5" y="4" width="13" height="8" rx="0.8" />
      <path d="M10.5 12v2.5M13.5 12v2.5" />
      <rect x="3.5" y="14.5" width="17" height="4.8" rx="0.6" />
      <path d="M9 14.5v4.8M15 14.5v4.8M11.3 16.9h1.4M5.5 19.3V21M18.5 19.3V21" />
    </svg>
  );
};

const SECTION_ICONS: Record<SectionId, React.ReactNode> = {
  cocinas: <SectionLineIcon id="cocinas" />,
  closets: <SectionLineIcon id="closets" />,
  closetfit: <SectionLineIcon id="closetfit" />,
  walking: <SectionLineIcon id="walking" />,
  puertas: <SectionLineIcon id="puertas" />,
  bano: <SectionLineIcon id="bano" />,
  tv: <SectionLineIcon id="tv" />,
};

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
/** Arrastre de una tarjeta flotante: se agarra por su título y se mueve libremente */
function useDragOffset() {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const start = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input,button,select,textarea,label,a,[data-nodrag]')) return; // los campos y botones siguen funcionando
    (e.currentTarget as HTMLElement).style.zIndex = String(++(window as any).__floatZ || ((window as any).__floatZ = 60)); // la tarjeta que se toca pasa al frente
    const x0 = e.clientX - off.x, y0 = e.clientY - off.y;
    const move = (ev: PointerEvent) => setOff({ x: ev.clientX - x0, y: ev.clientY - y0 });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return { style: { transform: `translate(${off.x}px, ${off.y}px)` } as React.CSSProperties, handle: { onPointerDown: start, style: { cursor: 'move', touchAction: 'none' } as React.CSSProperties } };
}

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

/** Dibujito que muestra a qué medida se refiere un campo del Espacio (en indigo, la medida; en gris, el resto) */
const MeasureSketch: React.FC<{ kind: 'A' | 'B' | 'C' | 'height' | 'zH' | 'zD' | 'iL' | 'iW' | 'iBar' | 'iX' | 'iY'; layout?: LayoutType; lArm?: 'left' | 'right' }> = ({ kind, layout = 'STRAIGHT', lArm = 'left' }) => {
  const hi = '#4f46e5', lo = '#cbd5e1';
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    const horiz = y1 === y2, d = 3;
    return (
      <g stroke={hi} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        {horiz ? <><polyline points={`${x1 + d},${y1 - d} ${x1},${y1} ${x1 + d},${y1 + d}`} /><polyline points={`${x2 - d},${y2 - d} ${x2},${y2} ${x2 - d},${y2 + d}`} /></>
          : <><polyline points={`${x1 - d},${y1 + d} ${x1},${y1} ${x1 + d},${y1 + d}`} /><polyline points={`${x2 - d},${y2 - d} ${x2},${y2} ${x2 + d},${y2 - d}`} /></>}
      </g>
    );
  };
  let body: React.ReactNode = null;
  if (kind === 'height') {
    body = <><rect x="10" y="5" width="40" height="30" rx="1" fill="#f8fafc" stroke={lo} strokeWidth="2" />{arrow(30, 8, 30, 32)}</>;
  } else if (kind === 'iL' || kind === 'iW' || kind === 'iBar') {
    // isla vista desde arriba: mesón (con la barra al frente, abajo) y los módulos dentro
    body = (
      <>
        <rect x="12" y="5" width="36" height="24" rx="1" fill="#f8fafc" stroke={lo} strokeWidth="2" />
        <rect x="12" y="5" width="36" height="16" fill="#e2e8f0" />
        {kind === 'iBar' && <rect x="12" y="21" width="36" height="8" fill="#e0e7ff" stroke={hi} strokeWidth="1.5" />}
        {kind === 'iL' && arrow(12, 35, 48, 35)}
        {kind === 'iW' && arrow(54, 5, 54, 29)}
        {kind === 'iBar' && arrow(30, 21, 30, 29)}
      </>
    );
  } else if (kind === 'iX' || kind === 'iY') {
    // cotas de la isla desde el punto 0 (esquina del cuarto)
    body = (
      <>
        <polyline points="6,34 6,5 54,5" fill="none" stroke={lo} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="5" r="2.5" fill={hi} />
        <rect x="26" y="16" width="24" height="14" rx="1" fill="#e2e8f0" stroke={lo} strokeWidth="2" />
        {kind === 'iX' && arrow(8, 23, 26, 23)}
        {kind === 'iY' && arrow(16, 7, 16, 30)}
      </>
    );
  } else if (kind === 'zH' || kind === 'zD') {
    body = (
      <>
        <rect x="14" y="4" width="32" height="22" rx="1" fill="#f1f5f9" stroke={lo} strokeWidth="2" />
        <rect x="19" y="26" width="27" height="8" fill={kind === 'zH' ? '#e0e7ff' : '#f8fafc'} stroke={kind === 'zH' || kind === 'zD' ? hi : lo} strokeWidth="1.5" />
        {kind === 'zH' ? arrow(52, 26, 52, 34) : arrow(19, 38, 46, 38)}
      </>
    );
  } else {
    // vista en planta de los muros: A arriba; el brazo de la L a un lado; en U, B y C a los dos lados
    const hasB = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left');
    const hasC = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right');
    const wall = (k: 'A' | 'B' | 'C', x1: number, y1: number, x2: number, y2: number) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={kind === k ? hi : lo} strokeWidth={kind === k ? 3.5 : 3} strokeLinecap="round" />;
    body = (
      <>
        {wall('A', 12, 8, 48, 8)}
        {hasB && wall('B', 12, 8, 12, 33)}
        {hasC && wall('C', 48, 8, 48, 33)}
        {kind === 'A' && arrow(14, 14, 46, 14)}
        {kind === 'B' && arrow(18, 10, 18, 31)}
        {kind === 'C' && arrow(42, 10, 42, 31)}
      </>
    );
  }
  return <svg width="52" height="36" viewBox="0 0 60 40" className="shrink-0" aria-hidden="true">{body}</svg>;
};

/** Campos de estufa y poceta de una isla o península: si lleva, y a qué distancia de su punto 0 (su extremo izquierdo) */
/** Campo de color con lista propia del catálogo: al escribir las iniciales se despliegan los colores que coinciden (con su tono) */
const CampoColor: React.FC<{ label: string; value: string; onChange: (v: string) => void; calibres?: number[]; cal?: number; onCal?: (n: number) => void; rh?: boolean; onRh?: (v: boolean) => void; rigido?: boolean; onRigido?: (v: boolean) => void }> = ({ label, value, onChange, calibres, cal, onCal, rh, onRh, rigido, onRigido }) => {
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const c = colorDeCatalogo(value);
  const sinTilde = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const q = sinTilde(value);
  // primero los que empiezan por lo escrito, después los que lo contienen; vacío o igual a un color = todo el catálogo
  const exacto = CATALOGO.some(x => sinTilde(x.nombre) === q);
  const opciones = !q || exacto ? CATALOGO : [...CATALOGO.filter(x => sinTilde(x.nombre).startsWith(q)), ...CATALOGO.filter(x => !sinTilde(x.nombre).startsWith(q) && sinTilde(x.nombre).includes(q))];
  const elegir = (n: string) => { onChange(n); setAbierto(false); };
  return (
    <label className="block relative">
      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">{label}</span>
      <span className="flex items-center gap-2">
        <span className="w-8 h-8 shrink-0 rounded-lg border border-slate-300" style={{ background: c?.hex ?? 'repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 4px,#fff 4px,#fff 8px)' }} title={c ? c.nombre : 'Color fuera del catálogo'} />
        <input value={value} autoComplete="off"
          onChange={e => { onChange(e.target.value); setAbierto(true); setMarcado(0); }}
          onFocus={e => { e.currentTarget.select(); setAbierto(true); setMarcado(0); }}
          onBlur={() => setTimeout(() => { setAbierto(false); const m = colorDeCatalogo(value); if (m && m.nombre !== value) onChange(m.nombre); }, 150)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setMarcado(k => Math.min(opciones.length - 1, k + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado(k => Math.max(0, k - 1)); }
            else if (e.key === 'Enter' && abierto && opciones[marcado]) { e.preventDefault(); elegir(opciones[marcado].nombre); }
            else if (e.key === 'Escape') setAbierto(false);
          }}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-indigo-500" />
      </span>
      {abierto && opciones.length > 0 && (
        <div className="absolute left-10 right-0 top-full mt-1 z-[400] max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1">
          {opciones.map((o, k) => (
            <button key={o.nombre} type="button" onMouseDown={e => { e.preventDefault(); elegir(o.nombre); }} onMouseEnter={() => setMarcado(k)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${k === marcado ? 'bg-indigo-50' : ''}`}>
              <span className="w-5 h-5 shrink-0 rounded border border-slate-300" style={{ background: o.hex }} />
              <span className="text-xs font-black text-slate-800">{o.nombre}</span>
              <span className="ml-auto text-[9px] font-bold text-slate-400 uppercase">{o.grupo}</span>
            </button>
          ))}
        </div>
      )}
      {abierto && opciones.length === 0 && <div className="absolute left-10 right-0 top-full mt-1 z-[400] bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 text-[11px] font-bold text-slate-400">No está en el catálogo: se usará tal cual.</div>}
      {/* calibre del tablero y RH (resistente a la humedad) */}
      {(calibres || onRh) && (
        <span className="block mt-1.5 pl-10 space-y-1.5">
          {calibres && (
            <span className="flex items-center gap-1">
              {calibres.map(n => (
                <button key={n} type="button" onClick={e => { e.preventDefault(); onCal?.(n); }} className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${cal === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{calTexto(n)}</button>
              ))}
              <span className="text-[9px] font-bold text-slate-400">mm</span>
            </span>
          )}
          <span className="flex items-center gap-4">
            {([[onRigido, rigido, 'Rígido', 'Canto rígido; sin marcar va flexible'], [onRh, rh, 'RH', 'Resistente a la humedad']] as const).filter(([f]) => f).map(([f, v, t, title]) => (
              <span key={t} className="flex items-center gap-1 text-[10px] font-black text-slate-600 cursor-pointer" title={title} onClick={e => { e.preventDefault(); f!(!v); }} role="checkbox" aria-checked={!!v}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${v ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>{v ? '✓' : ''}</span>{t}
              </span>
            ))}
          </span>
        </span>
      )}
    </label>
  );
};

const IslandApplianceFields: React.FC<{
  stove?: { distance: number | string }; sink?: { distance: number | string };
  onToggle: (kind: 'stove' | 'sink', on: boolean) => void;
  onDistance: (kind: 'stove' | 'sink', value: string) => void;
  campana?: boolean; onCampana?: (on: boolean) => void; // campana de isla (solo con estufa)
}> = ({ stove, sink, onToggle, onDistance, campana, onCampana }) => (
  <div className="space-y-2 pt-1">
    {([['stove', 'Lleva estufa', stove], ['sink', 'Lleva poceta / fregadero', sink]] as const).map(([kind, label, val]) => (
      <div key={kind} className="space-y-1">
        <label className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-wide">
          <input type="checkbox" checked={!!val} onChange={(e) => onToggle(kind, e.target.checked)} />
          {label}
        </label>
        {val && (
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Distancia desde el punto 0 de la isla (mm)</label>
            <input
              type="number"
              value={val.distance}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => onDistance(kind, e.target.value.replace(/^0+(?=\d)/, ''))}
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        )}
        {kind === 'stove' && val && onCampana && (
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-wide pt-1">
            <input type="checkbox" checked={!!campana} onChange={(e) => onCampana(e.target.checked)} />
            Lleva campana de isla
          </label>
        )}
      </div>
    ))}
  </div>
);

/**
 * Hilera de módulos bajos de una isla o península: a lo largo de su largo, del fondo de su ancho menos la barra. Si lleva estufa o
 * poceta, van sus muebles (Mueble Estufa y Mueble Poceta, con las mismas reglas de la cocina) en la distancia pedida desde el
 * punto 0 de la isla, y el resto se llena con módulos
 */
const buildIslandRow = (isl: IslandItem, widths: number[], baseHeight: number, stoveWidth = 600, sinkWidth = 600): KitchenModule[] => {
  const row: KitchenModule[] = [];
  const minW = widths[widths.length - 1];
  const depth = Math.max(200, isl.width - (isl.bar ?? 0)); // la barra (voladizo del mesón) queda libre por el frente
  const newId = () => Math.random().toString(36).substr(2, 9);
  const base = (w: number, x: number): KitchenModule => {
    const template = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === w) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
    return {
      ...template, uniqueId: newId(), wall: 'Island', islandId: isl.id, positionX: x, width: w, depth, height: baseHeight,
      quantity: 1, doorType: 'vertical', configType: w > 300 ? 'drawers' : 'doors', hasPlateRack: false, drawerCount: w > 300 ? 3 : 0,
    };
  };

  // Muebles reservados (estufa y poceta), de izquierda a derecha, sin salirse de la isla ni pisarse
  const reserved = ([
    isl.stove ? { kind: 'stove' as const, start: isl.stove.distance, w: Math.min(stoveWidth, isl.length) } : null,
    isl.sink ? { kind: 'sink' as const, start: isl.sink.distance, w: Math.min(Math.max(600, sinkWidth), isl.length) } : null,
  ].filter(Boolean) as Array<{ kind: 'stove' | 'sink'; start: number; w: number }>).sort((p, q) => p.start - q.start);
  let cursor = 0;
  reserved.forEach((r, i) => {
    r.start = Math.max(cursor, Math.min(Math.round(r.start), isl.length - r.w));
    if (r.start - cursor > 0 && r.start - cursor < 120) r.start = cursor; // un hueco menor al mínimo: el mueble se pega al anterior
    const last = i === reserved.length - 1;
    if (last && isl.length - (r.start + r.w) > 0 && isl.length - (r.start + r.w) < 120) r.start = Math.max(cursor, isl.length - r.w);
    cursor = r.start + r.w;
  });

  // Rellena un tramo [from, to] con módulos; si sobra menos del mínimo, se suma al último
  const fill = (from: number, to: number) => {
    let x = from;
    let remaining = to - from;
    const first = row.length;
    while (remaining >= minW) { const w = widths.find(v => v <= remaining) || minW; row.push(base(w, x)); x += w; remaining -= w; }
    if (remaining >= 120) row.push(base(remaining, x));
    else if (remaining > 0 && row.length > first) row[row.length - 1].width += remaining;
  };
  let at = 0;
  reserved.forEach(r => {
    fill(at, r.start);
    const m = base(r.w, r.start);
    row.push(r.kind === 'stove'
      ? { ...m, name: 'Mueble Estufa', isStoveCabinet: true, configType: 'drawers', drawerCount: 2 }
      : { ...m, name: 'Mueble Poceta', isSinkCabinet: true, configType: 'doors', drawerCount: 0 });
    at = r.start + r.w;
  });
  fill(at, isl.length);
  return row;
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

const SidebarToolButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; collapsed: boolean; badge?: string }> = ({ active, onClick, icon, label, collapsed, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center rounded-xl transition-all group relative shrink-0 ${
      collapsed ? 'w-11 h-11 justify-center' : 'w-full px-3 py-2.5 gap-3'
    } ${
      active 
        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/80'
    }`}
    title={collapsed ? label : undefined}
  >
    <div className="flex-shrink-0">{icon}</div>
    {!collapsed && (
      <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-indigo-600 font-semibold' : 'text-slate-700'}`}>
        {label}
      </span>
    )}
    {badge && (
      <div className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-semibold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
        {badge}
      </div>
    )}
  </button>
);

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="absolute inset-0 z-[100] bg-white/85 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-5">
      <Loader2 size={44} className="text-indigo-600 animate-spin" />
      <Sparkles size={20} className="text-indigo-500 absolute -top-2 -right-2 animate-pulse" />
    </div>
    <h3 className="text-lg font-semibold tracking-tight text-slate-900 mb-1.5">Calculando muro exacto...</h3>
    <p className="text-xs font-medium text-slate-500 max-w-xs">{message}</p>
    <div className="mt-6 flex gap-2">
      {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
    </div>
  </div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; onApply?: () => void; title: string; children: React.ReactNode; ancho?: string }> = ({ isOpen, onClose, onApply, title, children, ancho = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white border border-slate-200/80 rounded-2xl shadow-xl w-full ${ancho} overflow-hidden flex flex-col modal-content animate-in zoom-in-95 duration-200`}>
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[72vh] no-scrollbar">
          {children}
        </div>
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200/80 flex justify-end">
          <button 
            onClick={() => { onApply?.(); onClose(); }}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm active:scale-[0.99] transition-all"
          >
            Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

const COTA_COLOR = '#111827'; // negro: cota con referencia (un cubo, una línea o una medida general); si pierde la referencia se pinta verde
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
}> = ({ x, y, width, scale, label, onEdit, orientation = 'top', isGap = false }) => {
  if (width < 1) return null;
  const color = COTA_COLOR; // todas las cotas de todos los productos comparten color
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
        fill={isGap ? "#f43f5e" : color} 
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
}> = ({ x, y, height, scale, label, orientation = 'left' }) => {
  if (height < 1) return null;
  const color = COTA_COLOR;
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
  const [activeTab, setActiveTab] = useState<'design' | 'catalog' | 'quote' | 'config' | 'listado' | 'laminas' | 'planos' | 'render' | 'bosquejo' | 'inicio' | 'proyectos'>('inicio');
  const [lastDeliverableTab, setLastDeliverableTab] = useState<'render' | 'planos' | 'laminas' | 'listado'>('render');
  const [nuevoProyectoTick, setNuevoProyectoTick] = useState(0);
  useEffect(() => {
    if (activeTab === 'render' || activeTab === 'planos' || activeTab === 'laminas' || activeTab === 'listado') {
      setLastDeliverableTab(activeTab);
    }
  }, [activeTab]);
  const [activeView, setActiveView] = useState<'plan' | 'frontal' | 'isometric' | '3d'>('3d');
  const [isCapasMenuOpen, setIsCapasMenuOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [modulosPanelOpen, setModulosPanelOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  const [isElementsPanelOpen, setIsElementsPanelOpen] = useState(false);
  const [isViewsPanelOpen, setIsViewsPanelOpen] = useState(false);
  const [isAccessoriesPanelOpen, setIsAccessoriesPanelOpen] = useState(false);
  const [isSpecialModulesPanelOpen, setIsSpecialModulesPanelOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [tramoLateral, setTramoLateral] = useState<TramoAltura>(null);
  // sesión de la cuenta (la pantalla para entrar está en Proyectos): el botón de arriba la muestra y lleva allá
  const [correoSesion, setCorreoSesion] = useState<string | null>(null);
  useEffect(() => { sesionActual().then(s => setCorreoSesion(s?.user.email ?? null)).catch(() => {}); return alCambiarSesion(s => setCorreoSesion(s?.user.email ?? null)); }, []);
  const [focoEsquema, setFocoEsquema] = useState<Foco>(null); // zona del esquema que se está configurando en Configuración de módulos
  const [modoAbrir, setModoAbrir] = useState(false); // 3D: puertas y cajones abiertos (con clic en cada frente se abre o cierra solo)
  const [busquedaColor, setBusquedaColor] = useState(''); // buscador de colores del panel Color & Material
  const [isModulosModalOpen, setIsModulosModalOpen] = useState(false); // Configuración de módulos: colores y sistema, mesón, dilatación
  const guiaEspacio = useRef(false); // diseño nuevo: Espacio se abrió solo y al aplicarlo sigue Configuración de módulos
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
  
  const wallsDrag = useDragOffset();
  // En closets, al pedir L o U los brazos (muros B y C) se sugieren de 600 mm; después se pueden editar
  const chooseLayout = (l: LayoutType) => {
    if (isClosetSection || isFitSection) {
      if (l !== 'STRAIGHT' && layout === 'STRAIGHT') setWallB(600);
      if (l === 'U_SHAPE' && layout !== 'U_SHAPE') setWallC(600);
    }
    setLayout(l);
  };
  const [wallsHidden, setWallsHidden] = useState(false); // la tarjeta de muros se oculta del todo (queda un botón para volver a abrirla)
  const [wallsCardOpen, setWallsCardOpen] = useState(true); // formulario básico de muros del closet (recto, L o U con sus medidas y la altura)
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
  const [verCorte, setVerCorte] = useState(true); // corte A con su sección en la vista frontal
  const [visibility, setVisibility] = useState({ puntos: true, isla: true, muros: true, upper: true, lower: true, counter: true, appliances: true, doors: true, shelves: true, cajonero: true, costado: true, dims: true, wallA: true, wallB: true, wallC: true, hoja: true, marco: true, tapaluz: true });
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
  const [acabadosGuardados, setAcabados] = useState<Acabados>(ACABADOS);
  // siempre completos: un diseño guardado antes (o el estado de antes de una actualización) puede no traer fondo, calibres ni RH
  const acabados = useMemo(() => {
    const a = completarAcabados(acabadosGuardados);
    return { ...a, MA: { ...a.MA, fach: { ...a.MA.fach, color: a.MA.fach.color || faceColor } }, MB: { ...a.MB, fach: { ...a.MB.fach, color: faceColor } } };
  }, [acabadosGuardados, faceColor]);
  // cambia un tablero de un nivel; la fachada de MB es el color de fachada general
  const setTablero = (n: 'MA' | 'MB' | 'PU' | 'AL' | 'TH', k: keyof AcabadosNivel, p: Partial<Tablero>) => {
    if (n === 'PU' || n === 'AL' || n === 'TH') { setAcabados(prev => { const a = completarAcabados(prev); const base = a[n] ?? (n === 'PU' ? a.MA : a.MB); return { ...a, [n]: { ...base, [k]: { ...base[k], ...p } } }; }); return; }
    if (n === 'MB' && k === 'fach' && p.color !== undefined) setFaceColor(p.color);
    setAcabados(prev => { const a = completarAcabados(prev); return { ...a, [n]: { ...a[n], [k]: { ...a[n][k], ...p } } }; });
  }; // estructura por tipo de mueble, canto del frente y sistema gola
  const [bom, setBom] = useState<BOM | null>(null);

  const [appliances, setAppliances] = useState<Appliance[]>([
    { type: 'fridge', wall: 'A', width: 700, height: 1800, depth: 800, distance: 0, active: false },
    { type: 'stove', wall: 'A', width: 600, height: 850, depth: 500, distance: 1000, active: false },
    { type: 'hood-under', wall: 'A', width: 600, height: 120, depth: 450, distance: 1000, active: false, campanaTipo: 'convencional' },
    { type: 'sink', wall: 'A', width: 550, height: 850, depth: 450, distance: 2000, active: false, faucetHeight: 400 },
    { type: 'dishwasher', wall: 'A', width: 630, height: 850, depth: 570, distance: 2600, active: false, lado: 'der' },
    // hornos de empotrar (van en el hueco de la Torre de hornos): horno 595 × 595 × 451, hueco mínimo 600 × 587; corto 595 × 455 × 520, hueco 560-568 × 460
    { type: 'oven', wall: 'A', width: 595, height: 595, depth: 451, distance: 0, active: false },
    { type: 'oven-compact', wall: 'A', width: 595, height: 455, depth: 520, distance: 0, active: false },
  ]);

  // REGLAS TÉCNICAS DE ALTURA
  // El zócalo lo define el usuario (generalmente 100mm). El mesón se apoya sobre los módulos base
  // y el aéreo arranca 600mm sobre la cara superior del mesón.
  // Los 600mm hasta el aéreo se miden desde la cara superior del mesón: zócalo + módulo base + espesor del mesón
  // Sección activa (cocinas, closets...): cambia el alto de los módulos, el espacio entre niveles y lo que se ofrece
  const [section, setSection] = useState<SectionId>('cocinas');
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const cfg = SECTIONS[section];
  // alturas editables en Configuración de módulos (vista lateral): null = la medida de la sección
  // diseño en puente (cocinas rectas): doble módulo superior; el de arriba es más profundo y se genera solo encima de cada aéreo
  const [puente, setPuente] = useState<{ on: boolean; alto: number; fondo: number }>({ on: false, alto: 450, fondo: 450 });
  const puenteAlto = puente.on && layout === 'STRAIGHT' && cfg.hasUpper ? puente.alto : 0;
  const [alturaBase, setAlturaBase] = useState<number | null>(null);
  const [huecoAereo, setHuecoAereo] = useState<number | null>(null);
  const currentBaseModuleHeight = alturaBase ?? cfg.baseModuleHeight;
  const currentUpperGap = huecoAereo ?? cfg.upperGap;
  const counterHeight = useMemo(() => (hasZocalo ? zocaloHeight : 0) + currentBaseModuleHeight + (hasCounter ? counterThickness : 0), [hasZocalo, zocaloHeight, hasCounter, counterThickness, currentBaseModuleHeight]);
  const currentUpperModuleHeight = useMemo(() => spaceHeight - counterHeight - currentUpperGap - TOP_MARGIN, [spaceHeight, counterHeight, currentUpperGap]);

  // En cualquier campo numérico, al entrar se selecciona todo el valor: así lo que se escribe lo reemplaza y no se queda pegado el cero
  useEffect(() => {
    let justFocused: HTMLInputElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.tagName === 'INPUT' && t.type === 'number' && !t.disabled) { justFocused = t; setTimeout(() => { try { t.select(); } catch { /* algunos navegadores no permiten select() en number */ } }, 0); }
    };
    const onMouseUp = (e: MouseEvent) => { if (justFocused && e.target === justFocused) { e.preventDefault(); } justFocused = null; }; // el clic que dio el foco no debe quitar la selección
    // la rueda del ratón no debe cambiar el número de un campo (se pegaba hacia arriba o abajo) y no se escriben negativos ni signos
    const onWheel = (e: WheelEvent) => { const t = e.target as HTMLInputElement | null; if (t && t.tagName === 'INPUT' && t.type === 'number' && document.activeElement === t) t.blur(); };
    const onKey = (e: KeyboardEvent) => { const t = e.target as HTMLInputElement | null; if (t && t.tagName === 'INPUT' && t.type === 'number' && (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') && !(t.min !== '' && Number(t.min) < 0)) e.preventDefault(); };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('focusin', onFocusIn); document.removeEventListener('mouseup', onMouseUp, true); document.removeEventListener('wheel', onWheel, true); document.removeEventListener('keydown', onKey, true); };
  }, []);

  useEffect(() => {
    setModules(prev => prev.map(m => {
      if (m.heightLocked) return m; // alto editado a mano en el panel
      if (m.esPuente) return { ...m, height: puente.alto, topGap: 0, depth: puente.fondo };
      if (m.type === 'LOWER' && !m.isStoveCabinet) return { ...m, height: currentBaseModuleHeight };
      if (m.type === 'UPPER' && !m.isFridgeCabinet && !m.isHood) return { ...m, height: currentUpperModuleHeight - puenteAlto, topGap: puenteAlto };
      if (m.type === 'UPPER' && m.isHood) return { ...m, height: currentUpperModuleHeight - HOOD_SHORTEN };
      if (m.type === 'TALL') return { ...m, height: spaceHeight - TOP_MARGIN };
      return m;
    }));
  }, [currentBaseModuleHeight, currentUpperModuleHeight, spaceHeight, puenteAlto, puente.alto, puente.fondo]);

  // Diseño en puente: cada aéreo del muro A lleva encima su módulo superior (mismo ancho y posición); al apagarlo se quitan
  useEffect(() => {
    setModules(prev => {
      const base = prev.filter(m => !m.esPuente);
      if (!puenteAlto) return base.length === prev.length ? prev : base;
      const next: KitchenModule[] = [];
      base.forEach(orig => {
        const elegible = orig.type === 'UPPER' && orig.wall === 'A' && !orig.isHood && !orig.isFridgeCabinet && !orig.cornerArm;
        // un aéreo recién modulado nace con el alto completo: se acorta lo del módulo de arriba
        const m = elegible && !orig.heightLocked && (orig.height !== currentUpperModuleHeight - puenteAlto || (orig.topGap ?? 0) !== puenteAlto) ? { ...orig, height: currentUpperModuleHeight - puenteAlto, topGap: puenteAlto } : orig;
        next.push(m);
        if (!elegible) return;
        const ant = prev.find(p => p.puenteDe === m.uniqueId);
        const nuevo = { ...(ant ?? { ...m, uniqueId: Math.random().toString(36).substr(2, 9), esPuente: true, puenteDe: m.uniqueId, isSinkCabinet: false, hasPlateRack: false, heightLocked: false, label: undefined }), name: `Puente ${Math.round(m.width)}mm`, wall: m.wall, positionX: m.positionX, width: m.width, height: puente.alto, topGap: 0, depth: puente.fondo } as KitchenModule;
        next.push(nuevo);
      });
      const igual = next.length === prev.length && next.every((m, i) => { const p = prev[i]; return p === m || (p.uniqueId === m.uniqueId && p.positionX === m.positionX && p.width === m.width && p.height === m.height && p.depth === m.depth && p.topGap === m.topGap && p.name === m.name); });
      return igual ? prev : next;
    });
  }, [modules, puenteAlto, puente.alto, puente.fondo, currentUpperModuleHeight]);

  const [hasIsland, setHasIsland] = useState(false);
  const [island] = useState({ length: 1800, width: 900, height: 900, dx: 1500, dy: 1000 });
  // Islas y penínsulas (Módulos especiales): medida general y dos cotas editables desde el punto 0
  const [islands, setIslands] = useState<IslandItem[]>([]);
  const [columns, setColumns] = useState<ColumnItem[]>([]); // columnas o muros atravesados del espacio
  const [closet, setCloset] = useState<ClosetConfig>(DEFAULT_CLOSET); // formulario del closet
  const [fit, setFit] = useState<ClosetFit>(DEFAULT_FIT); // Closet fit: cubo por cuerpos
  const [puerta, setPuerta] = useState<PuertaCfg>(DEFAULT_PUERTA); // sección Puertas: vano, tipo de hoja, marcos dilatados y cabezal
  const [puertaHidden, setPuertaHidden] = useState(false);
  const [fitWall, setFitWall] = useState<'A' | 'B' | 'C'>('A'); // muro cuyo cubo se edita en la tarjeta
  const fitDrag = useDragOffset();
  const [fitHidden, setFitHidden] = useState(false); // tarjeta de cuerpos del Closet fit oculta (queda un botón para volver a abrirla)
  // Cocina en L: el brazo va a la izquierda (muro B) o a la derecha (muro C); se pregunta al elegir la forma
  const [lArm, setLArm] = useState<'left' | 'right'>('left');
  // Borrado con confirmación dentro de la app (isla o tarjeta especial pendiente de confirmar)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [islandEnabled, setIslandEnabled] = useState(false); // sección Isla / Península activada (con islas creadas siempre está activa)
  const [islandDraft, setIslandDraft] = useState<{ kind: 'isla' | 'peninsula' | null; length: string; width: string; bar: string; dx: string; dy: string; stove: { distance: string } | null; sink: { distance: string } | null }>({ kind: null, length: '1800', width: '900', bar: '0', dx: '1000', dy: '1000', stove: null, sink: null });
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState('');

  // ===== Historial: deshacer (Ctrl+Z) y rehacer (Ctrl+Y) =====
  // Se guarda una foto del diseño cuando los cambios se estabilizan (500ms sin cambios), así un arrastre
  // largo o varias teclas seguidas cuentan como un solo paso.
  const designSnapshot = useMemo(() => ({
    layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands, columns, closet, fit, puerta, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth, alturaBase, huecoAereo, puente,
    modules, specialModules, appliances, hasIsland, lineType, faceColor, acabados,
  }), [acabados, alturaBase, huecoAereo, puente, puerta, layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands, columns, closet, fit, lArm, hasLeftClosure, hasRightClosure,
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
    setLayout(snap.layout); setWallA(snap.wallA); setPuerta(snap.puerta ?? DEFAULT_PUERTA); setWallB(snap.wallB); setWallC(snap.wallC);
    setSpaceHeight(snap.spaceHeight); setHasZocalo(snap.hasZocalo); setZocaloHeight(snap.zocaloHeight);
    setZocaloDepth(snap.zocaloDepth); setHasCounter(snap.hasCounter); setCounterThickness(snap.counterThickness);
    setCounterOverhang(snap.counterOverhang); setHasSplash(snap.hasSplash); setSplashHeight(snap.splashHeight); setCounterExtras(snap.counterExtras); setIslands(snap.islands); setColumns(snap.columns ?? []); setFit({ ...DEFAULT_FIT, ...(snap.fit ?? {}) }); setCloset({ ...DEFAULT_CLOSET, ...(snap.closet ?? {}) }); setLArm(snap.lArm); setHasLeftClosure(snap.hasLeftClosure); setHasRightClosure(snap.hasRightClosure);
    setHasDilatation(snap.hasDilatation); setDilatationGap(snap.dilatationGap); setDilatationDepth(snap.dilatationDepth); setAlturaBase(snap.alturaBase ?? null); setHuecoAereo(snap.huecoAereo ?? null); setPuente(snap.puente ?? { on: false, alto: 450, fondo: 450 });
    setModules(snap.modules); setSpecialModules(snap.specialModules); setAppliances(prev => [...snap.appliances, ...prev.filter(p => !snap.appliances.some((a: Appliance) => a.type === p.type)).map(p => ({ ...p, active: false }))]);
    setHasIsland(snap.hasIsland); setLineType(snap.lineType); setFaceColor(snap.faceColor); setAcabados(completarAcabados(snap.acabados));
  };

  // Cada sección guarda su propio diseño: al cambiar de sección se guarda el actual y se carga el de la otra (o uno nuevo con sus valores)
  const initialDesign = useRef<DesignSnapshot | null>(null);
  if (!initialDesign.current) initialDesign.current = designSnapshot;
  const sectionStore = useRef<Partial<Record<SectionId, DesignSnapshot>>>({});
  const makeSectionDefaults = (id: SectionId): DesignSnapshot => {
    const c = SECTIONS[id];
    const first = initialDesign.current!;
    return {
      ...first, ...c.defaults, puerta: { ...DEFAULT_PUERTA },
      modules: [], islands: [], columns: [], closet: { ...DEFAULT_CLOSET }, fit: id === 'bano' ? { ...DEFAULT_FIT, depth: 480, lowerBodies: 1, upperBodies: 0, altoMueble: 600, flotado: { on: true, alto: 250 }, mueble: { x0: 700, ancho: 1000 }, sobreMueble: 3, cubes: { B: false, C: false } } : id === 'tv' ? {
        // centro de entretenimiento: torre, centro (puente arriba, espacio libre del televisor y mueble bajo) y torre; los cubos se mueven y se convierten como en el Closet fit
        ...DEFAULT_FIT, depth: 450, lowerBodies: 3, upperBodies: 0, lowerW: [500, 1400, 500],
        // de abajo hacia arriba: mueble bajo de 450, torres de 1450 y puente de 350 sobre el espacio del televisor (1100); arriba queda espacio libre hasta el techo
        lowerCells: [[-500, 1450, 450], [-500, 350, -1100, 450], [-500, 1450, 450]],
        cellD: { 'fit-inf-0-1': 350, 'fit-inf-1-1': 300, 'fit-inf-2-1': 350 },
        cubes: { B: false, C: false },
      } : { ...DEFAULT_FIT }, counterExtras: {}, hasLeftClosure: false, hasRightClosure: false, hasIsland: false, lArm: 'left',
      specialModules: first.specialModules.map((sm, i) => ({ ...sm, active: false, name: c.specials[i] ?? sm.name })),
      appliances: first.appliances.map(ap => ({ ...ap, active: false })),
    } as DesignSnapshot;
  };
  // Convertir a módulos: cada cubo se cambia por un módulo con sus piezas (laterales, base, techo, puentes, amarres, espaldar, entrepaños)
  // y sus puertas. Sugerencia inicial: todos con puertas verticales (una si el módulo es angosto, dos si es ancho); después se indica
  // cómo acomodarlos (cajones, otras puertas)
  const convertToModules = () => {
    // Closet fit: las placas representativas de los cuerpos configurados pasan a ser las piezas reales (y al revés)
    if (isFitSection) { setFit(f => ({ ...f, converted: !f.converted })); return; }
    setModules(prev => {
      const allDone = prev.length > 0 && prev.every(m => m.detailed || m.cornerArm);
      if (allDone) return prev.map(m => ({ ...m, detailed: false })); // vuelve a cubos
      return prev.map(m => {
        if (m.cornerArm) return { ...m, detailed: false }; // el esquinero en L aún no se convierte
        let layout: KitchenModule['frontsLayout'];
        if (m.depth < 60) layout = undefined; // un cubre-columna casi sin fondo no lleva módulo
        else if (m.muebleHorno) layout = 'oven';
        else if (m.type === 'UPPER') layout = m.isHood ? 'hood' : (m.width < 450 ? 'upper-door1' : 'upper-door2-v');
        else layout = m.width <= 450 ? 'door1' : 'door2';
        if (!layout) return { ...m, detailed: false };
        return { ...m, detailed: true, frontsLayout: layout, configType: 'doors', drawerCount: 0 };
      });
    });
  };

  // Clic derecho en un módulo base: con puertas (una o dos, según el ancho) o con cajones (3 cajones reales); convierte ese módulo
  const setModuleFronts = (id: string, kind: 'doors' | 'drawers' | 'vertical' | 'horizontal' | 'open') => {
    setModules(prev => prev.map(m => {
      if (m.uniqueId !== id || m.cornerArm || m.muebleHorno) return m; // el mueble de horno lleva sus frentes fijos
      // abierto: sin puertas ni cajones; va todo en el material de la fachada
      if (kind === 'open' && (m.type === 'UPPER' || m.type === 'LOWER')) return { ...m, detailed: true, frontsLayout: 'open' as const, configType: 'doors' as const, drawerCount: 0 };
      if (m.type === 'UPPER') {
        // Aéreo: puertas verticales (una si es angosto, dos si es ancho) u horizontales (una sobre otra); la campana mantiene su regla
        const layout = kind === 'horizontal' ? (m.isHood ? 'hood-h' : 'upper-door2-h') : (m.isHood ? 'hood' : (m.width < 450 ? 'upper-door1' : 'upper-door2-v'));
        return { ...m, detailed: true, frontsLayout: layout as 'hood' | 'hood-h' | 'upper-door1' | 'upper-door2-v' | 'upper-door2-h', configType: 'doors' as const, drawerCount: 0 };
      }
      if (m.type !== 'LOWER') return m;
      if (kind === 'drawers') return { ...m, detailed: true, frontsLayout: 'drawers' as const, configType: 'drawers' as const, drawerCount: 3 };
      return { ...m, detailed: true, frontsLayout: (m.width <= 450 ? 'door1' : 'door2') as 'door1' | 'door2', configType: 'doors' as const, drawerCount: 0 };
    }));
  };

  const switchSection = (next: SectionId) => {
    setIsSectionMenuOpen(false);
    if (next === section) return;
    sectionStore.current[section] = latestSnapshot.current.snapshot;
    const h = history.current;
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    h.past = []; h.future = []; h.committed = null; h.committedKey = '';
    setSection(next);
    if (next === 'closets' || next === 'walking' || next === 'closetfit' || next === 'bano') { setFitHidden(false); setActiveView('frontal'); setWallsCardOpen(true); setWallsHidden(false); } // al entrar a closets: vista frontal con las puertas translúcidas y el formulario de muros
    applySnapshot(sectionStore.current[next] ?? makeSectionDefaults(next));
    setIsElementsPanelOpen(false); setIsAccessoriesPanelOpen(false); setIsViewsPanelOpen(false); setIsSpecialModulesPanelOpen(false); setIsWorkspaceModalOpen(false);
    bumpHistory();
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
  // Closet: los lados con muro o con costado salen del Espacio (muros auxiliares, L o U); el lado sin muro lleva costado propio
  const isClosetSection = cfg.id === 'closets';
  const isFitSection = cfg.id === 'closetfit' || cfg.id === 'walking' || cfg.id === 'bano' || cfg.id === 'tv'; // el walking closet y el baño arrancan como el Closet fit: cubos por cuerpos
  const isBano = cfg.id === 'bano';
  const closetInput = useMemo(() => (isClosetSection ? {
    ...closet,
    leftWall: layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left') || hasLeftClosure,
    rightWall: layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right') || hasRightClosure,
  } : undefined), [isClosetSection, closet, layout, lArm, hasLeftClosure, hasRightClosure]);

  // Closet fit: muros a los lados (como en el closet) para la dilatación de 15 x 15 junto a ellos
  const fitInput = useMemo(() => (isFitSection ? {
    ...fit,
    leftWall: layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left') || hasLeftClosure,
    rightWall: layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right') || hasRightClosure,
  } : undefined), [isFitSection, fit, layout, lArm, hasLeftClosure, hasRightClosure]);
  const closetPos2 = closet.twoPlacement === 'extremos' ? 'right' as const : 'center' as const;
  const closetDerived2 = useMemo(() => (closetInput && closet.twoCajoneros ? closetDerived({ ...closetInput, ...closet.cajonero2, cajoneroPos: closetPos2 }, wallA, spaceHeight, hasZocalo, zocaloHeight) : null), [closetInput, closet, closetPos2, wallA, spaceHeight, hasZocalo, zocaloHeight]);
  const closetTorre2Cfg = useMemo(() => ({ ...closet, ...(closet.torre2 ?? {}) }), [closet]);
  const closetDerivedT2 = useMemo(() => (closetInput && closet.torreOn && closet.torre2On ? closetDerived({ ...closetInput, ...(closet.torre2 ?? {}) }, wallA, spaceHeight, hasZocalo, zocaloHeight) : null), [closetInput, closet, wallA, spaceHeight, hasZocalo, zocaloHeight]);
  const closetDerivedValues = useMemo(() => (closetInput ? closetDerived(closetInput, wallA, spaceHeight, hasZocalo, zocaloHeight) : null), [closetInput, wallA, spaceHeight, hasZocalo, zocaloHeight]);

  const activeIslands = useMemo(() => islands
    .filter(i => i.kind === 'isla' || layout === 'L_SHAPE')
    .map(i => (i.kind === 'peninsula' ? { ...i, dx: lArm === 'right' ? Math.max(0, wallA - i.length) : 0 } : i)), [islands, layout, lArm, wallA]);

  // Lista única de cajas: la escena 3D, el BOM y la exportación a Fusion leen la geometría de aquí
  // Opción del carpintero (no se guarda con el diseño): puente L corrido entre los bajos y costados internos 80 mm más cortos
  // gola en melamina corrida entre bajos (puente L continuo, costados internos 80 mm más cortos): se pide en Configuración de módulos
  const costadosCortos = acabados.golaCorrida && acabados.gola === 'melamina' && cfg.id === 'cocinas';
  const [corredera, setCorredera] = useState<{ tipo: 'full' | 'oculta'; menos10?: boolean; fondo15?: boolean }>({ tipo: 'full' });
  const boxes = useMemo(() => buildBoxes({
    puerta: cfg.id === 'puertas' ? puerta : undefined, wallThickness: cfg.id === 'puertas' ? puerta.espesor : undefined, layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth,
    modules: labeledModules, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands: activeIslands, columns, closet: closetInput, fit: fitInput, lArm, hasLeftClosure, hasRightClosure,
    hasDilatation, dilatationGap, dilatationDepth, costadosCortos, laminaLargo: acabados.laminaLargo, corredera, aereoAbre: acabados.aereoAbre,
    calEstructura: { MA: acabados.MA.est.cal, MB: acabados.MB.est.cal, otros: acabados.MB.est.cal },
  }), [acabados.MA.est.cal, acabados.MB.est.cal, acabados.aereoAbre, acabados.laminaLargo, costadosCortos, corredera, cfg.id, puerta, layout, wallA, wallB, wallC, spaceHeight, hasZocalo, zocaloHeight, zocaloDepth, labeledModules, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, activeIslands, columns, closetInput, fitInput, lArm, hasLeftClosure, hasRightClosure, hasDilatation, dilatationGap, dilatationDepth]);

  // Fase 0: lista de piezas única, sacada de las mismas cajas que se dibujan
  const ctxPiezas = useMemo(() => ({ lineType, faceColor: colorDeCatalogo(faceColor)?.nombre ?? faceColor, acabados, corredera: corredera.tipo, conZocalo: hasZocalo, puentes: modules.filter(m => m.esPuente).map(m => m.uniqueId), puerta: cfg.id === 'puertas' ? puerta : undefined, abiertos: modules.filter(m => m.frontsLayout === 'open').map(m => m.uniqueId) }), [lineType, faceColor, acabados, corredera.tipo, hasZocalo, cfg.id, puerta, modules]);
  const nivelPU = acabados.PU ?? acabados.MA; // colores del módulo en puente
  const nivelAL = acabados.AL ?? acabados.MB; // alacena alta y torre de hornos: como los bajos hasta que se elija otro
  const nivelTH = acabados.TH ?? acabados.MB;
  const alacenaOn = specialModules.some(sm => sm.active && sm.kind === 'tall-pantry');
  const torreOn = specialModules.some(sm => sm.active && sm.kind === 'tall-oven');
  const lista = useMemo(() => listaDePiezas(boxes, ctxPiezas), [boxes, ctxPiezas]);
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
        return { ...m, height: Math.min(Math.max(v, 15), maxHeight), heightLocked: true };
      }
      return { ...m, depth: Math.min(Math.max(v, 15), 1200) };
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
  const runAutoModulation = useCallback((currentAppliances: Appliance[], strategy: OptimizationStrategy = 'efficiency', cortesA?: number[], cortesAltos?: number[], frentes?: { bajos: string[]; altos: string[] }) => {
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
      // campana tipo península: no lleva mueble encima; en los aéreos queda un espacio libre centrado en la estufa
      // de la medida nominal de la campana + 5 cm (60 → 65, 75 → 80, 90 → 95)
      const hoodLibre = hood?.campanaTipo === 'libre';
      const LIBRE_CAMPANA = (hood?.width ?? 600) + 50;
      const dishwasher = currentAppliances.find(a => a.type === 'dishwasher' && a.active && a.wall === currentWall);

      // Sobrenevera: cubre la nevera y sobresale FRIDGE_CLEARANCE por cada lado (ancho de la nevera + 10cm), centrada sobre ella,
      // sin salirse del muro. Si la nevera está en un extremo, se corre hacia adentro.
      // con espacio de la nevera dado (boceto), la sobrenevera y el hueco miden ese espacio, centrado en la nevera
      const overFridgeWidth = fridge ? (fridge.space ?? fridge.width + 2 * FRIDGE_CLEARANCE) : 0;
      const overFridgeX = fridge
        ? Math.min(Math.max(fridge.distance - (overFridgeWidth - fridge.width) / 2, startGap), Math.max(startGap, usableEnd - overFridgeWidth))
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

      // Hornos en mueble de horno: el mueble elegido (de la biblioteca) en su lugar; el despiece y el hueco salen al convertir a módulos
      const hornosMueble = currentAppliances.filter(a => esEquipoTorre(a.type) && a.active && a.donde === 'mueble' && a.wall === currentWall).map(a => {
        const opc = muebleDeVariante(a.variante ?? VARIANTE_POR_DEFECTO[a.type as 'oven' | 'oven-compact'])!;
        return { app: a, opc, ancho: opc.ancho };
      });
      hornosMueble.forEach(({ app, opc, ancho }) => {
        const lowerTemplate = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
        newModules.push({ ...lowerTemplate, uniqueId: `oven-cabinet-auto-${app.type}-${currentWall}`, name: opc.nombre, wall: currentWall, positionX: app.distance, width: ancho, height: currentBaseModuleHeight, muebleHorno: opc.muebleHorno, quantity: 1, doorType: 'vertical', configType: 'doors', hasPlateRack: false, drawerCount: 0 });
      });

      // Módulo Obligatorio: MUEBLE BAJO POCETA (Mínimo 60cm)
      if (sink) {
        const lowerTemplate = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
        const sinkModuleWidth = sink.space ?? Math.max(600, sink.width); // con boceto: el ancho del módulo dibujado
        newModules.push({
          ...lowerTemplate,
          uniqueId: `sink-cabinet-auto-${currentWall}`,
          name: 'Mueble Poceta',
          wall: currentWall,
          positionX: sink.space ? sink.distance - (sink.space - sink.width) / 2 : sink.distance,
          width: sinkModuleWidth,
          height: currentBaseModuleHeight,
          isSinkCabinet: true,
          quantity: 1,
          doorType: 'vertical',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });

        // Módulo Obligatorio: MUEBLE SUPERIOR SOBRE POCETA (mismas dimensiones); con el boceto, los aéreos salen de lo dibujado
        if (!(cortesAltos && currentWall === 'A')) {
        const upperTemplate = MODULE_TEMPLATES.find(t => t.type === 'UPPER' && t.width === 600) || MODULE_TEMPLATES.find(t => t.type === 'UPPER')!;
        newModules.push({
          ...upperTemplate,
          uniqueId: `sink-upper-cabinet-auto-${currentWall}`,
          name: 'Mueble Superior Poceta',
          wall: currentWall,
          positionX: sink.space ? sink.distance - (sink.space - sink.width) / 2 : sink.distance,
          width: sinkModuleWidth,
          height: currentUpperModuleHeight,
          quantity: 1,
          doorType: 'vertical',
          configType: 'doors',
          hasPlateRack: false,
          drawerCount: 0
        });
        }
      }

      // Módulo Obligatorio: MUEBLE SOBRE CAMPANA (8cm más corto); la campana tipo península no lleva mueble
      if (hood && !hoodLibre) {
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
      
      // Columnas o muros atravesados de este muro: no van módulos ahí (en los brazos se miden desde la esquina ciega)
      const columnObstacles = columns.filter(c => c.wall === currentWall).flatMap(c => {
        const armStart = currentWall === 'A' ? 0 : CORNER_BLIND_OFFSET;
        const cs = Math.max(0, c.distance - armStart);
        const ce = Math.min(targetWidth, c.distance + c.width - armStart);
        return ce > cs ? [{ distance: cs, width: ce - cs }] : [];
      });

      const fillTier = (tier: 'upper' | 'lower') => {
        const specialModulesActiveForWall = specialModulesActive.filter(m => m.wall === currentWall);
        const tierObstacles = tier === 'lower'
          ? [
              ...currentAppliances.filter(a => a.active && a.wall === currentWall && a.type === 'pantry'),
              // Nevera con FRIDGE_CLEARANCE libres a cada lado (sin salirse del inicio del muro)
              ...(fridge ? [{ distance: overFridgeX, width: overFridgeWidth }] : []),
              ...(stove ? [{ distance: stove.distance, width: stove.width }] : []),
              ...hornosMueble.map(h => ({ distance: h.app.distance, width: h.ancho })),
              ...(dishwasher ? [{ distance: dishwasher.distance, width: dishwasher.width }] : []),
              ...columnObstacles,
              ...(sink ? [{ distance: sink.space ? sink.distance - (sink.space - sink.width) / 2 : sink.distance, width: sink.space ?? Math.max(600, sink.width) }] : []),
              ...specialModulesActiveForWall.map(m => ({ distance: m.positionX, width: m.width })),
              // La península pegada a este muro ocupa su espacio: ahí no van módulos del brazo (los pone la península)
              ...activeIslands.filter(i => i.kind === 'peninsula' && currentWall === (lArm === 'right' ? 'C' : 'B')).map(i => ({
                distance: Math.max(0, i.dy - CORNER_BLIND_OFFSET),
                width: Math.max(0, Math.min(i.dy + i.width, (currentWall === 'B' ? wallB : wallC)) - Math.max(i.dy, CORNER_BLIND_OFFSET)),
              }))
            ]
          : [
              ...(fridge ? [{ distance: overFridgeX, width: overFridgeWidth }] : []),
              ...(hood ? [hoodLibre ? { distance: Math.max(0, hood.distance + hood.width / 2 - LIBRE_CAMPANA / 2), width: LIBRE_CAMPANA } : { distance: hood.distance, width: hood.width }] : []),
              ...columnObstacles,
              ...(sink && !(cortesAltos && currentWall === 'A') ? [{ distance: sink.space ? sink.distance - (sink.space - sink.width) / 2 : sink.distance, width: sink.space ?? Math.max(600, sink.width) }] : []),
              ...currentAppliances.filter(a => a.active && a.wall === currentWall && (a.type === 'pantry')),
              ...specialModulesActiveForWall.map(m => ({ distance: m.positionX, width: m.width }))
            ];

        const solveGap = (gapWidth: number, startX: number, isUpper: boolean): void => {
          let remaining = gapWidth;
          let x = startX;

          // Rincón de una L o U (muro A): el brazo tapa los primeros 570 mm del frente del módulo bajo que llega al rincón, así que ese módulo
          // necesita mínimo 880 mm para tener puerta útil (esquinero recto). Se arma primero, de hasta 900 mm (o todo el tramo si es de hasta 1.200),
          // y el resto del tramo se reparte aparte. Los aéreos siguen los bordes de los bajos.
          if (!isUpper && currentWall === 'A' && gapWidth >= 880 && !(cortesA && cortesA.length > 0)) {
            const alInicio = (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) && startX <= startGap + 1;
            const alFinal = !alInicio && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) && startX + gapWidth >= usableEnd - 1;
            if (alInicio || alFinal) {
              const esq = gapWidth <= 1200 ? gapWidth : 900;
              const xEsq = alInicio ? startX : startX + gapWidth - esq;
              const tpl = MODULE_TEMPLATES.find(t => t.type === 'LOWER' && t.width === esq) || MODULE_TEMPLATES.find(t => t.type === 'LOWER')!;
              newModules.push({
                ...tpl, name: `Bajo ${esq}mm`, uniqueId: Math.random().toString(36).substr(2, 9), wall: currentWall, positionX: xEsq, width: esq, height: currentBaseModuleHeight, quantity: 1,
                doorType: 'vertical', configType: 'doors', hasPlateRack: false, drawerCount: 0,
              });
              if (gapWidth > esq) solveGap(gapWidth - esq, alInicio ? startX + esq : startX, false);
              return;
            }
          }
          
          // Bosquejo: si el boceto trae los anchos de los módulos del muro A, el espacio se parte en esas divisiones (no con los anchos de la estrategia)
          // regla del carpintero: el MA va alineado con el MB, así que los aéreos se parten en las mismas divisiones de los bajos de ese muro
          const bordesBajos = isUpper ? [...new Set(newModules.filter(m => m.wall === currentWall && m.type === 'LOWER').flatMap(m => [m.positionX, m.positionX + m.width]))].sort((a, b) => a - b) : [];
          const cortesFila = isUpper ? (cortesAltos ?? (bordesBajos.length ? bordesBajos : undefined)) : (currentWall === 'A' ? cortesA : undefined);
          if (cortesFila && cortesFila.length > 0 && (currentWall === 'A' || (isUpper && !cortesAltos))) {
            const fin = startX + gapWidth;
            const bordes = [startX, ...cortesFila.filter(c => c > startX + 1 && c < fin - 1), fin];
            for (let k = 0; k < bordes.length - 1; k++) {
              const w = Math.round(bordes[k + 1] - bordes[k]);
              if (w < 120) continue;
              const template = MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER') && t.width === w) || MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER'))!;
              newModules.push({
                ...template, uniqueId: Math.random().toString(36).substr(2, 9), wall: currentWall, positionX: Math.round(bordes[k]), width: w,
                height: isUpper ? currentUpperModuleHeight : currentBaseModuleHeight, quantity: 1, doorType: 'vertical', configType: 'doors', hasPlateRack: false, drawerCount: 0,
              });
            }
            return;
          }

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
          
          const inicioTramo = newModules.length; // para rehacer el tramo si queda un sobrante chico
          const gapTotal = remaining;
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
          
          // Sobrante menor de 300 mm en un tramo de 300 mm o más: en vez de un módulo de 140, se reparte todo el tramo en módulos
          // iguales (entre 300 y 900 mm, cerca del ancho de la estrategia), de 5 en 5 mm
          if (remaining > 0 && gapTotal >= 300) {
            newModules.length = inicioTramo;
            const base = prioritizedWidths[0];
            let n = Math.max(Math.ceil(gapTotal / 900), Math.round(gapTotal / base), 1);
            while (n > 1 && gapTotal / n < 300) n--;
            const w0 = Math.floor(gapTotal / n / 5) * 5;
            const finalH = isUpper ? currentUpperModuleHeight : currentBaseModuleHeight;
            let xx = x - (gapTotal - remaining);
            for (let k = 0; k < n; k++) {
              const w = k === n - 1 ? Math.round(gapTotal - w0 * (n - 1)) : w0;
              const template = MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER') && t.width === w) || MODULE_TEMPLATES.find(t => t.type === (isUpper ? 'UPPER' : 'LOWER'))!;
              newModules.push({
                ...template, name: `${isUpper ? 'Aéreo' : 'Bajo'} ${w}mm`, uniqueId: Math.random().toString(36).substr(2, 9), wall: currentWall, positionX: xx, width: w, height: finalH, quantity: 1,
                doorType: 'vertical', configType: w > 300 ? 'drawers' : 'doors', hasPlateRack: false, drawerCount: w > 300 ? 3 : 0,
              });
              xx += w;
            }
            remaining = 0;
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
          lastX = Math.max(lastX, obsDist + obsWidth);
          
        }); 
        
        // Rellenar el espacio restante hasta el final del muro
        if (lastX < usableEnd) {
          const remainingGap = usableEnd - lastX;
          solveGap(remainingGap, lastX, tier === 'upper');
        }
      };

      fillTier('lower'); 
      if (cfg.hasUpper) fillTier('upper');

      // Cubre-columna: el espacio de enfrente de la columna (entre ella y el frente de los módulos) se cubre con un módulo del ancho de la
      // columna y del fondo que sobra (fondo del módulo - profundidad de la columna), en bajos y en aéreos
      columnObstacles.forEach(co => {
        (['LOWER', 'UPPER'] as const).filter(t => t === 'LOWER' || cfg.hasUpper).forEach(type => {
          const template = MODULE_TEMPLATES.find(t => t.type === type)!;
          const colDepth = columns.find(c => c.wall === currentWall && Math.abs(Math.max(0, c.distance - (currentWall === 'A' ? 0 : CORNER_BLIND_OFFSET)) - co.distance) < 1)?.depth ?? 0;
          const depth = template.depth - colDepth;
          if (depth < 20) return; // la columna llega al frente de los módulos: no queda espacio que cubrir
          newModules.push({
            ...template,
            uniqueId: Math.random().toString(36).substr(2, 9),
            name: type === 'LOWER' ? 'Bajo cubre-columna' : 'Aéreo cubre-columna',
            wall: currentWall,
            positionX: co.distance,
            width: co.width,
            depth,
            depthOffset: colDepth,
            height: type === 'LOWER' ? currentBaseModuleHeight : currentUpperModuleHeight,
            quantity: 1,
            doorType: 'vertical',
            configType: 'doors',
            hasPlateRack: false,
            drawerCount: 0,
          });
        });
      });

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
    activeIslands.forEach(isl => newModules.push(...buildIslandRow(isl, prioritizedWidths, currentBaseModuleHeight, currentAppliances.find(a => a.type === 'stove')?.width, currentAppliances.find(a => a.type === 'sink')?.width)));

    // Ningún módulo pasa del ancho máximo (900 mm): si alguno lo supera (un resto sumado al último, el aéreo alargado hacia la
    // esquina...) se parte en partes iguales, de 5 en 5 mm
    // Los módulos toman los nombres de la sección (Bajo / Aéreo en cocinas; Cuerpo / Maletero en closets...)
    newModules.forEach(m => { m.name = m.name.replace(/^Bajo/, cfg.lowerName).replace(/^Aéreo/, cfg.upperName); });
    const capped: KitchenModule[] = [];
    newModules.forEach(m => {
      const enRincon = m.type === 'LOWER' && m.wall === 'A' && m.width <= 1200 && ((m.positionX <= 60 && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left'))) || (m.positionX + m.width >= wallA - 60 && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right'))));
      if (m.width <= MAX_MODULE_WIDTH || m.type === 'TALL' || enRincon) { capped.push(m); return; }
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

    // Módulo del rincón de una L o U (muro A): el brazo tapa los primeros 570 mm del frente de los bajos y 330 mm de los aéreos, así que ese módulo
    // necesita puerta útil: abajo 310 mm (ancho mínimo 880) y arriba 350 mm (mínimo 680). Si quedó más angosto (por ejemplo, con los anchos del boceto)
    // se une con el siguiente hasta llegar al mínimo (hasta 1.200 mm). Los aéreos se alinean con el corte de los bajos si éste no es menor a 680.
    const rincones: ('izq' | 'der')[] = [];
    if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) rincones.push('izq');
    if (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) rincones.push('der');
    const equiposA = currentAppliances.filter(a => a.active && a.wall === 'A' && (a.type === 'stove' || a.type === 'sink' || a.type === 'hood-under' || (esEquipoTorre(a.type) && a.donde === 'mueble')));
    const fijo = (m: KitchenModule) => !!m.isFridgeCabinet || !!m.isHood || !!m.depthOffset || equiposA.some(a => Math.min(a.distance + a.width, m.positionX + m.width) - Math.max(a.distance, m.positionX) > 1);
    const arreglarRincon = (tipo: 'LOWER' | 'UPPER', lado: 'izq' | 'der', minimo: number) => {
      const fila = () => newModules.filter(m => m.wall === 'A' && m.type === tipo).sort((p, q) => p.positionX - q.positionX);
      const rename = (m: KitchenModule) => { m.name = m.name.replace(/d+mm/, `${Math.round(m.width)}mm`); };
      for (let it = 0; it < 6; it++) {
        const f = fila();
        const esq = lado === 'izq' ? f[0] : f[f.length - 1], sig = lado === 'izq' ? f[1] : f[f.length - 2];
        if (!esq || esq.width >= minimo || fijo(esq)) return;
        const alBorde = lado === 'izq' ? esq.positionX <= 60 : esq.positionX + esq.width >= wallA - 60;
        if (!alBorde) return;
        const pegado = sig && Math.abs(lado === 'izq' ? sig.positionX - (esq.positionX + esq.width) : esq.positionX - (sig.positionX + sig.width)) <= 5;
        if (!pegado || fijo(sig)) { // no hay con quién unirlo: se ensancha hacia adentro si hay lugar
          const libre = lado === 'izq' ? (sig ? sig.positionX : wallA) - esq.positionX : esq.positionX + esq.width - (sig ? sig.positionX + sig.width : 0);
          const w = Math.min(libre, minimo); if (w <= esq.width) return;
          if (lado === 'der') esq.positionX = esq.positionX + esq.width - w;
          esq.width = w; rename(esq); return;
        }
        const total = esq.width + sig.width, ini = Math.min(esq.positionX, sig.positionX);
        if (total <= 1200 && (total <= MAX_MODULE_WIDTH || total - minimo < 300)) {
          esq.positionX = ini; esq.width = total; rename(esq);
          newModules.splice(newModules.indexOf(sig), 1);
          // el frente dibujado del módulo absorbido se quita de la lista para que los demás frentes sigan en su módulo
          const lista = frentes ? (tipo === 'LOWER' ? frentes.bajos : frentes.altos) : undefined;
          if (lista && lista.length > 1) lista.splice(lado === 'izq' ? 1 : lista.length - 2, 1);
          if (total >= minimo) return;
        } else {
          const w1 = Math.ceil(minimo / 5) * 5, w2 = total - w1;
          if (lado === 'izq') { esq.positionX = ini; esq.width = w1; sig.positionX = ini + w1; sig.width = w2; }
          else { sig.positionX = ini; sig.width = w2; esq.positionX = ini + w2; esq.width = w1; }
          rename(esq); rename(sig); return;
        }
      }
    };
    rincones.forEach(lado => {
      arreglarRincon('LOWER', lado, CORNER_BLIND_OFFSET + 310);
      const bajos = newModules.filter(m => m.wall === 'A' && m.type === 'LOWER').sort((p, q) => p.positionX - q.positionX);
      const bajoEsq = lado === 'izq' ? bajos[0] : bajos[bajos.length - 1];
      const alineado = bajoEsq && bajoEsq.width <= MAX_MODULE_WIDTH ? bajoEsq.width : 0;
      arreglarRincon('UPPER', lado, Math.max(UPPER_DEPTH + 350, alineado));
    });

    // Regla: ningún módulo se sale del muro. En A el largo es el del muro; en los brazos B y C se cuenta desde donde empiezan los módulos (tras los 570 mm del rincón)
    for (let i = newModules.length - 1; i >= 0; i--) {
      const m = newModules[i];
      if (m.type === 'TALL') continue;
      const largoMuro = (m.wall === 'A' ? wallA : m.wall === 'B' ? wallB : wallC) - (m.wall === 'A' ? 0 : CORNER_BLIND_OFFSET);
      if (m.positionX + m.width <= largoMuro + 1) continue;
      if (largoMuro - m.positionX < 120) { newModules.splice(i, 1); continue; }
      m.width = Math.floor((largoMuro - m.positionX) / 5) * 5;
      m.name = m.name.replace(/d+mm/, `${m.width}mm`);
    }

    // Bosquejo: cada módulo lleva el frente que se dibujó (puertas, cajones, abierto, platero), de izquierda a derecha en el muro A
    if (frentes) {
      const fila = (tipo: 'LOWER' | 'UPPER') => newModules.filter(m => m.wall === 'A' && m.type === tipo && !m.isFridgeCabinet && !m.muebleHorno).sort((a, b) => a.positionX - b.positionX);
      newModules.filter(m => m.wall === 'A' && !!m.muebleHorno).forEach(m => { m.detailed = true; m.frontsLayout = 'oven'; m.configType = 'doors'; m.drawerCount = 0; }); // lleva sus frentes fijos
      fila('LOWER').forEach((m, i) => {
        const f = frentes.bajos[i] ?? 'puertas';
        m.detailed = true;
        m.frontsLayout = f === 'cajones' || f === 'estufa' ? 'drawers' : f === 'abierto' ? 'open' : m.width <= 450 ? 'door1' : 'door2';
        m.configType = m.frontsLayout === 'drawers' ? 'drawers' : 'doors'; m.drawerCount = m.frontsLayout === 'drawers' ? 3 : 0;
      });
      fila('UPPER').forEach((m, i) => {
        const f = frentes.altos[i] ?? 'puertas';
        m.detailed = true;
        m.frontsLayout = m.isHood ? 'hood' : f === 'abierto' ? 'open' : m.width < 450 ? 'upper-door1' : 'upper-door2-v';
        m.hasPlateRack = f === 'platero';
      });
      // Brazos B y C: los mismos frentes que se sugieren en el muro A (los bajos con cajones o con puertas según predominen en A; la estufa con cajones,
      // la poceta con puertas; los aéreos con una o dos puertas según su ancho)
      const propios = frentes.bajos.filter(f => f !== 'estufa' && f !== 'poceta');
      const conCajones = propios.filter(f => f === 'cajones').length > propios.length / 2;
      newModules.filter(m => m.wall !== 'A' && (m.type === 'LOWER' || m.type === 'UPPER') && !m.isFridgeCabinet && !m.cornerArm).forEach(m => {
        m.detailed = true;
        if (m.muebleHorno) { m.frontsLayout = 'oven'; return; }
        if (m.type === 'LOWER') {
          const cajones = m.isStoveCabinet || (!m.isSinkCabinet && conCajones);
          m.frontsLayout = cajones ? 'drawers' : m.width <= 450 ? 'door1' : 'door2';
          m.configType = cajones ? 'drawers' : 'doors'; m.drawerCount = cajones ? 3 : 0;
        } else {
          m.frontsLayout = m.isHood ? 'hood' : m.width < 450 ? 'upper-door1' : 'upper-door2-v';
        }
      });
      newModules.filter(m => m.isFridgeCabinet).forEach(m => { m.detailed = true; m.frontsLayout = m.width < 450 ? 'upper-door1' : 'upper-door2-h'; });
    }

    setModules([...newModules, ...specialModulesActive]);
    setCounterExtras({}); // al optimizar se recalcula todo: los ajustes manuales del mesón (cascadas, salpicaderos laterales) se reinician
  }, [wallA, wallB, wallC, layout, lArm, activeIslands, columns, cfg, currentBaseModuleHeight, currentUpperModuleHeight, spaceHeight, modules, activeWall, hasDilatation, dilatationGap, hasLeftClosure, hasRightClosure]);

  // Antes de optimizar se revisa que las islas y penínsulas no choquen entre sí ni con los muros de la cocina:
  // si hay choques, la optimización no se hace y se dice cuáles son
  const islandConflicts = (): string[] => {
    type R = { name: string; x0: number; x1: number; y0: number; y1: number };
    const overlap = (a: R, b: R) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1;
    const rooms: R[] = [{ name: 'los módulos del muro A', x0: 0, x1: wallA, y0: 0, y1: CORNER_BLIND_OFFSET }];
    if (armB) rooms.push({ name: 'los módulos del muro B', x0: 0, x1: CORNER_BLIND_OFFSET, y0: 0, y1: wallB });
    if (armC) rooms.push({ name: 'los módulos del muro C', x0: wallA - CORNER_BLIND_OFFSET, x1: wallA, y0: 0, y1: wallC });
    columns.forEach(c => {
      if (c.wall === 'A') rooms.push({ name: 'una columna del muro A', x0: c.distance, x1: c.distance + c.width, y0: 0, y1: c.depth });
      else if (c.wall === 'B' && armB) rooms.push({ name: 'una columna del muro B', x0: 0, x1: c.depth, y0: c.distance, y1: c.distance + c.width });
      else if (c.wall === 'C' && armC) rooms.push({ name: 'una columna del muro C', x0: wallA - c.depth, x1: wallA, y0: c.distance, y1: c.distance + c.width });
    });
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

  // Muebles de horno (horno u horno corto en su mueble): ancho del mueble elegido y espacio que ocupan en el muro
  const anchoMuebleHorno = (a: Appliance) => muebleDeVariante(a.variante ?? VARIANTE_POR_DEFECTO[a.type as 'oven' | 'oven-compact'])?.ancho ?? 600;
  const ocupaEnMuro = (a: Appliance): [number, number] => {
    if (esEquipoTorre(a.type)) return [a.distance, a.distance + anchoMuebleHorno(a)];
    if (a.type === 'sink') return [a.space ? a.distance - (a.space - a.width) / 2 : a.distance, (a.space ? a.distance - (a.space - a.width) / 2 : a.distance) + (a.space ?? Math.max(600, a.width))];
    if (a.type === 'fridge') { const w = a.space ?? a.width + 2 * FRIDGE_CLEARANCE; const d0 = a.distance - (w - a.width) / 2; return [d0, d0 + w]; }
    return [a.distance, a.distance + a.width];
  };
  // equipos que ocupan lugar en el piso del mismo muro (la campana va sobre la estufa y la torre es otro módulo alto)
  const ocupantesDelMuro = (self: Appliance) => appliances.filter(o => o !== self && o.active && o.wall === self.wall && o.type !== 'hood-under' && !(esEquipoTorre(o.type) && o.donde !== 'mueble'));
  const cruzesMuebleHorno = (): string[] => {
    const out: string[] = [];
    appliances.filter(a => esEquipoTorre(a.type) && a.active && a.donde === 'mueble' && a.wall !== 'Island').forEach(a => {
      const [x0, x1] = ocupaEnMuro(a);
      const largo = wallUsableLength(a.wall as WallName);
      if (x1 > largo + 1) out.push(`${NOMBRE_ELECTRO[a.type]} en mueble: se sale del muro ${a.wall} (${Math.round(x1)} de ${Math.round(largo)})`);
      ocupantesDelMuro(a).forEach(o => { const [y0, y1] = ocupaEnMuro(o); if (Math.min(x1, y1) - Math.max(x0, y0) > 1) out.push(`${NOMBRE_ELECTRO[a.type]} en mueble se cruza con ${(NOMBRE_ELECTRO[o.type] ?? o.type).toLowerCase()} (muro ${a.wall})`); });
    });
    return out;
  };
  // Primer lugar del muro donde cabe un mueble de ese ancho sin cruzarse con otro equipo (de 50 en 50)
  const primerHuecoMuro = (self: Appliance, wall: WallName, ancho: number): number => {
    const largo = wallUsableLength(wall);
    const otros = appliances.filter(o => o !== self && o.active && o.wall === wall && o.type !== 'hood-under' && !(esEquipoTorre(o.type) && o.donde !== 'mueble')).map(ocupaEnMuro);
    for (let d = 0; d + ancho <= largo + 1; d += 50) if (otros.every(([y0, y1]) => Math.min(d + ancho, y1) - Math.max(d, y0) <= 1)) return d;
    return 0;
  };

  const handleMathematicalSuggestion = async (strategy: OptimizationStrategy) => {
    setIsOptMenuOpen(false);
    if (isFitSection) {
      window.alert('Closet fit: el cubo se arma por cuerpos con el formulario de la derecha, paso a paso.');
      return;
    }
    if (isClosetSection) {
      window.alert('En el closet la estructura y el interior (cajonero, entrepaños, tubos) se arman solos con las respuestas del formulario de Espacio. Las puertas corredizas se agregan en el siguiente paso.');
      return;
    }
    const cruces = cruzesMuebleHorno();
    if (cruces.length > 0) {
      window.alert('No se puede optimizar: el mueble de horno se cruza con otro equipo.\n\n• ' + cruces.join('\n• ') + '\n\nCambia su posición en Electrodomésticos → Ubicación en el muro y vuelve a optimizar.');
      return;
    }
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

  // Fase 5 · Bosquejo: arma el diseño de cualquier producto solo con las medidas. En cocinas, la poceta va sobre el desagüe y la estufa sobre el gas,
  // y el resto se llena con la modulación automática (se lanza en el siguiente render, cuando ya están puestas las medidas nuevas)
  const [bosquejoPend, setBosquejoPend] = useState(false);
  const [bosquejoListo, setBosquejoListo] = useState(false);
  const [evidenciasBoceto, setEvidenciasBoceto] = useState<EvidenciasBoceto | null>(null); // todas las fotos y las notas del boceto: evidencias del proyecto
  const [fotoBoceto, setFotoBoceto] = useState<string | null>(null); // foto del boceto con que se armó el diseño abierto: se guarda con el producto
  const [productoActivo, setProductoActivo] = useState<ProductoActivo | null>(null);
  // aprobación del diseño abierto: el diseño (su clave) que se aprobó; si se cambia algo, vuelve a quedar sin aprobar
  const [aprobadoKey, setAprobadoKey] = useState<string | null>(null);
  const [aprobando, setAprobando] = useState<'dialogo' | 'guardando' | null>(null);
  const [avisoAprobar, setAvisoAprobar] = useState<string | null>(null);
  // al abrir un producto ya aprobado, su diseño cargado cuenta como aprobado (se toma la clave cuando la app termina de cargarlo)
  // Biblioteca: después de aprobar se ofrece guardar el diseño para volver a usarlo en otros proyectos
  const [paraBiblioteca, setParaBiblioteca] = useState<{ disenoId: string; nombre: string; seccion: SectionId; datos: unknown } | null>(null);
  const [bibEstado, setBibEstado] = useState<'guardando' | null>(null);
  const [bibRecargar, setBibRecargar] = useState(0);
  const [nombreAprobar, setNombreAprobar] = useState<string | undefined>(undefined); // nombre del producto traído de la biblioteca
  const huellaBiblioteca = useRef<string | null>(null); // diseño tal como salió de la biblioteca: no se ofrece guardarlo otra vez
  const aprobadoAlAbrir = useRef(false); // producto del proyecto abierto ahora (render y fotos se guardan en él) // ya se aceptó un boceto: se muestra pasado en limpio
  useEffect(() => { if (!fotoBoceto) setEvidenciasBoceto(null); }, [fotoBoceto]);
  useEffect(() => { if (aprobadoAlAbrir.current) { aprobadoAlAbrir.current = false; setAprobadoKey(snapshotKey); } }, [snapshotKey]);
  // documentos del producto: Excel de corte (lista de partes, CorteCloud y herrajes), láminas y planos; con el boceto si se armó desde uno
  const docsDelDiseno = (nombre: string, cliente: string, nuevo: boolean): DocumentoNuevo[] => {
    const docs: DocumentoNuevo[] = [];
    const base = nombre.replace(/[^\wáéíóúñÁÉÍÓÚÑ -]+/g, '').trim().replace(/\s+/g, '_') || 'producto';
    if (lista.piezas.length) {
      docs.push({ tipo: 'listado', nombre: `Listado_${base}.xlsx`, archivo: archivoListadoDeCorte(lista) });
      docs.push({ tipo: 'laminas', nombre: `Laminas_${base}.html`, archivo: new Blob([htmlLaminas(lista.piezas, nombre)], { type: 'text/html' }) });
      docs.push({ tipo: 'planos', nombre: `Planos_${base}.html`, archivo: new Blob([htmlPlanos(boxes, { lineType, faceColor }, nombre, cliente)], { type: 'text/html' }) });
    }
    // evidencias del boceto: cada foto y las notas
    if (nuevo && (evidenciasBoceto?.fotos.length || fotoBoceto)) {
      const fotosB = evidenciasBoceto?.fotos.length ? evidenciasBoceto.fotos : [fotoBoceto!];
      fotosB.forEach((f, i) => docs.push({ tipo: 'boceto', nombre: `Boceto_${base}${i ? `_${i + 1}` : ''}.jpg`, archivo: archivoDeDataURL(f) }));
      if (evidenciasBoceto?.notas) docs.push({ tipo: 'notas', nombre: `Notas_boceto_${base}.txt`, archivo: new Blob([evidenciasBoceto.notas], { type: 'text/plain;charset=utf-8' }) });
    }
    return docs;
  };
  // Aprobar diseño: guarda el diseño abierto en su producto, crea sus documentos y lo marca aprobado
  const aprobarDiseno = async (p: ProductoActivo, nuevo?: { ubicacion: string; cantidad: number }) => {
    setAprobando('guardando'); setAvisoAprobar(null); setParaBiblioteca(null);
    const clave = snapshotKey;
    try {
      const d = await guardarDiseno(p.proyectoId, section, p.nombre, latestSnapshot.current.snapshot, nuevo ? undefined : p.id, nuevo);
      const docs = docsDelDiseno(p.nombre, p.cliente, !!nuevo);
      const n = await subirDocumentos(d.id, docs);
      await marcarAprobado(d.id);
      setProductoActivo({ ...p, id: d.id, aprobado: true }); setAprobadoKey(clave); if (nuevo) setFotoBoceto(null);
      setAvisoAprobar(`Aprobado: ${p.nombre} de ${p.cliente}, con ${n} ${n === 1 ? 'documento' : 'documentos'}. Están en Proyectos.`);
      setParaBiblioteca(huellaDiseno(latestSnapshot.current.snapshot) === huellaBiblioteca.current ? null : { disenoId: d.id, nombre: p.nombre, seccion: section, datos: latestSnapshot.current.snapshot });
    } catch (e) { setAvisoAprobar(e instanceof Error ? e.message : String(e)); }
    setAprobando(null);
  };
  // Diseño nuevo de cocina: al entrar a Diseño se abre sola "Configuración de espacio" (y al aplicarla, "Configuración de
  // módulos"). Solo una vez por producto en la sesión y solo si aún no hay módulos; después se abren con sus botones.
  const espacioGuiado = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (activeTab !== 'design' || cfg.id !== 'cocinas' || labeledModules.length > 0 || espacioGuiado.current[section]) return;
    espacioGuiado.current[section] = true;
    guiaEspacio.current = true;
    setIsWorkspaceModalOpen(true);
  }, [activeTab, section, cfg.id, labeledModules.length]);

  const guardarBiblioteca = async () => {
    if (!paraBiblioteca) return;
    setBibEstado('guardando');
    try {
      // si ese mismo diseño ya está en la biblioteca no se guarda repetido
      const h = huellaDiseno(paraBiblioteca.datos);
      const ya = (await listarBiblioteca()).find(b => b.seccion === paraBiblioteca.seccion && huellaDiseno(b.datos) === h);
      if (ya) { setAvisoAprobar(`Este diseño ya está en la biblioteca como "${ya.nombre}".`); setParaBiblioteca(null); setBibEstado(null); return; }
      await guardarEnBiblioteca(paraBiblioteca.seccion, paraBiblioteca.nombre.trim() || SECTIONS[paraBiblioteca.seccion].name, paraBiblioteca.datos, paraBiblioteca.disenoId);
      setAvisoAprobar(`"${paraBiblioteca.nombre.trim() || SECTIONS[paraBiblioteca.seccion].name}" quedó en la biblioteca (Proyectos): úsalo en otro proyecto sin rehacer el diseño.`);
      setParaBiblioteca(null); setBibRecargar(n => n + 1);
    } catch (e) { setAvisoAprobar(e instanceof Error ? e.message : String(e)); }
    setBibEstado(null);
  };
  // abrir un diseño de la biblioteca: queda como diseño suelto (sin producto); con "usar" se pide de una vez el proyecto para aprobarlo
  const abrirDeBiblioteca = (sec: SectionId, datos: unknown, usarComo?: string) => {
    switchSection(sec); applySnapshot(datos as DesignSnapshot); bumpHistory();
    setProductoActivo(null); setAprobadoKey(null); aprobadoAlAbrir.current = false; setFotoBoceto(null);
    setParaBiblioteca(null); setAvisoAprobar(null); huellaBiblioteca.current = huellaDiseno(datos);
    setActiveTab('design');
    if (usarComo !== undefined) { setNombreAprobar(usarComo); setAprobando('dialogo'); }
  };
  const abrirProductoGuardado = (sec: SectionId, datos: unknown, prod: ProductoActivo) => {
    switchSection(sec);
    applySnapshot(datos as DesignSnapshot);
    bumpHistory();
    setProductoActivo(prod);
    setAprobadoKey(null);
    aprobadoAlAbrir.current = !!prod.aprobado;
    setFotoBoceto(null);
    setActiveTab('design');
  };
  const crearDesdeBosquejo = (d: DatosBosquejo, foto?: string, evidencias?: EvidenciasBoceto) => {
    setFotoBoceto(foto ?? null); setEvidenciasBoceto(evidencias ?? null); setProductoActivo(null);
    espacioGuiado.current[d.producto] = true;
    switchSection(d.producto);
    setWallA(d.A); setSpaceHeight(d.alto);
    setBosquejoListo(true);
    if (d.producto === 'cocinas') setActiveView('3d');
    setActiveTab('design');
    if (d.producto === 'puertas') return;
    setLayout(d.forma); setLArm(d.brazo); setWallB(d.B); setWallC(d.C);
    // muros a los lados del muro A (mueble entre muros): en la app son los muros de cierre izquierdo y derecho
    if (d.forma === 'STRAIGHT') { setHasLeftClosure(d.muroIzq); setHasRightClosure(d.muroDer); }
    // dilatada contra los muros (regla del carpintero): 2 cm de holgura y dilatada de 7 cm de canto
    if (d.muroIzq || d.muroDer) { setHasDilatation(true); setDilatationGap(HOLGURA_MURO); }
    // colores nombrados en el boceto o en las notas: se buscan en el catálogo y se aplican al diseño (los que no están en el catálogo quedan como estaban)
    {
      const col = (t?: string) => (t ? colorDeCatalogo(t)?.nombre : undefined);
      const est = col(d.colorEstructura), fach = col(d.colorFachada), fachA = col(d.colorFachadaAereos);
      if (fach) setFaceColor(fach);
      if (d.producto === 'cocinas' && (est || fach || fachA)) {
        setAcabados(prev => {
          const x = completarAcabados(prev);
          return {
            ...x,
            MA: { ...x.MA, est: est ? { ...x.MA.est, color: est } : x.MA.est, fach: fachA || fach ? { ...x.MA.fach, color: (fachA ?? fach)! } : x.MA.fach },
            MB: { ...x.MB, est: est ? { ...x.MB.est, color: est } : x.MB.est, fach: fach ? { ...x.MB.fach, color: fach } : x.MB.fach },
          };
        });
      }
    }
    if (d.producto !== 'cocinas') return;
    const largo = (m: 'A' | 'B' | 'C') => (m === 'A' ? d.A : m === 'B' ? d.B : d.C);
    // el equipo se centra en el punto (su mueble mide mínimo 600), sin salirse del muro
    // en los brazos B y C la posición se cuenta desde donde empiezan los módulos (después de los 570 mm del rincón), no desde la esquina
    const centrar = (pt: { muro: 'A' | 'B' | 'C'; dist: number }, ancho = 600) => { const o = pt.muro === 'A' ? 0 : CORNER_BLIND_OFFSET; return Math.max(0, Math.min(Math.round(pt.dist - ancho / 2) - o, largo(pt.muro) - o - Math.max(600, ancho))); };
    // anchos de módulo del boceto (muro A, de izquierda a derecha): la cocina se parte en esas divisiones, y la poceta y la estufa
    // se acomodan al módulo donde cae su punto
    const mods = d.modulos.filter(w => w > 0);
    const cortes: number[] = []; mods.reduce((x, w) => { cortes.push(x + w); return x + w; }, 0);
    const moduloEn = (dist: number) => { let x = 0; for (const w of mods) { if (dist >= x && dist < x + w) return { x, w }; x += w; } return null; };
    const enModulo = (pt: { muro: 'A' | 'B' | 'C'; dist: number }, ancho: number) => { const m = pt.muro === 'A' ? moduloEn(pt.dist) : null; return m && m.w >= 600 ? { distance: m.x, width: m.w } : { distance: centrar(pt, ancho), width: ancho }; };
    const anchoNevera = (w?: number) => (w && w >= 400 ? w - 2 * FRIDGE_CLEARANCE : undefined); // el espacio de la nevera deja 5 cm libres a cada lado
    // módulos dibujados en el boceto: la cocina se parte en ellos (abajo y arriba por separado); poceta, estufa y campana van en el módulo
    // donde se dibujaron
    const conFilas = !mods.length && !!d.bajos?.length;
    const [t0, t1] = tramoModulos(d);
    const filaX = (fila: DatosBosquejo['bajos']) => {
      if (!fila?.length) return [] as { x: number; w: number; frente: string }[];
      const ws = anchosFila(fila, t1 - t0); let x = t0;
      return fila.map((m, i) => { const r = { x, w: ws[i], frente: m.frente }; x += ws[i]; return r; });
    };
    const bajosX = conFilas ? filaX(d.bajos) : [], altosX = conFilas ? filaX(d.altos?.length ? d.altos : d.bajos) : [];
    const en = (fila: { x: number; w: number; frente: string }[], f: string) => fila.find(m => m.frente === f);
    const pocetaB = en(bajosX, 'poceta'), estufaB = en(bajosX, 'estufa'), campanaA = estufaB; // la campana va sobre el módulo de la estufa
    setAppliances(prev => prev.map(a => {
      // la poceta va centrada en el desagüe del boceto (muro A), sin pasar de los muros ni meterse bajo el brazo del rincón
      if (a.type === 'sink' && d.desague && d.desague.muro === 'A') {
        const ciegoIzq = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'left') ? CORNER_BLIND_OFFSET : 0;
        const ciegoDer = d.forma === 'U_SHAPE' || (d.forma === 'L_SHAPE' && d.brazo === 'right') ? CORNER_BLIND_OFFSET : 0;
        const w = a.width;
        const dist = Math.round(Math.max(ciegoIzq, Math.min(d.desague.dist - w / 2, d.A - ciegoDer - w)));
        return { ...a, active: true, wall: 'A', distance: dist, width: w, space: undefined };
      }
      if (a.type === 'sink') return pocetaB ? { ...a, active: true, wall: 'A', distance: pocetaB.x + Math.max(0, (pocetaB.w - Math.min(a.width, pocetaB.w - 50)) / 2), width: Math.min(a.width, pocetaB.w - 50), space: pocetaB.w } : d.desague ? { ...a, active: true, wall: d.desague.muro, distance: enModulo(d.desague, a.width).distance } : { ...a, active: false };
      if (a.type === 'stove') return estufaB ? { ...a, active: true, wall: 'A', distance: estufaB.x, width: 600 } : d.gas ? { ...a, active: true, wall: d.gas.muro, ...enModulo(d.gas, 600), width: 600 } : { ...a, active: false };
      if (a.type === 'hood-under') return campanaA && (estufaB || d.gas) && d.campana ? { ...a, active: true, wall: 'A', distance: campanaA.x, width: 600 } : d.gas && d.campana ? { ...a, active: true, wall: d.gas.muro, ...enModulo(d.gas, 600), width: 600 } : { ...a, active: false };
      if (a.type === 'fridge') {
        if (d.nevera === 'no') return { ...a, active: false };
        // espacio de la nevera: el del boceto (o el primer/último módulo); la nevera, con su ancho y alto reales, va centrada en él
        const esp = d.neveraEspacio ?? (mods.length ? (d.nevera === 'inicio' ? mods[0] : mods[mods.length - 1]) : undefined);
        const w = d.neveraAncho ?? anchoNevera(esp) ?? a.width, h = d.neveraAlto ?? a.height;
        const hueco = Math.max(esp ?? 0, w + 2 * FRIDGE_CLEARANCE);
        // contra un muro, la sobrenevera deja la holgura de la dilatada: el espacio empieza (o termina) 2 cm más adentro
        const g = d.nevera === 'inicio' ? (d.muroIzq ? HOLGURA_MURO : 0) : (d.muroDer ? HOLGURA_MURO : 0);
        const huecoU = esp ? esp - g : w + 2 * FRIDGE_CLEARANCE; // con espacio dado, la sobrenevera termina donde empiezan los bajos
        const ini = d.nevera === 'inicio' ? g : Math.max(0, d.A - g - huecoU);
        return { ...a, active: true, wall: 'A', width: w, height: h, space: esp ? huecoU : undefined, distance: Math.round(ini + (huecoU - w) / 2) };
      }
      return a;
    }));
    if (conFilas) {
      bosquejoCortes.current = bajosX.slice(1).map(m => m.x);
      bosquejoAltos.current = undefined; // los aéreos se alinean con los bajos
      bosquejoFrentes.current = { bajos: bajosX.map(m => m.frente), altos: altosX.map(m => m.frente) };
    } else { bosquejoCortes.current = cortes; bosquejoAltos.current = undefined; bosquejoFrentes.current = undefined; }
    const anchosA = conFilas ? bajosX.filter(m => m.frente !== 'estufa' && m.frente !== 'poceta').map(m => m.w) : mods;
    bosquejoEstrategia.current = estrategiaPorAncho(anchoComun(anchosA));
    setBosquejoPend(true);
  };
  const bosquejoEstrategia = useRef<OptimizationStrategy>('efficiency');
  const bosquejoCortes = useRef<number[]>([]);
  const bosquejoAltos = useRef<number[] | undefined>(undefined);
  const bosquejoFrentes = useRef<{ bajos: string[]; altos: string[] } | undefined>(undefined);
  useEffect(() => {
    if (!bosquejoPend) return;
    setBosquejoPend(false);
    runAutoModulation(appliances, bosquejoEstrategia.current, bosquejoCortes.current, bosquejoAltos.current, bosquejoFrentes.current);
    bosquejoEstrategia.current = 'efficiency';
    bosquejoCortes.current = []; bosquejoAltos.current = undefined; bosquejoFrentes.current = undefined;
  }, [bosquejoPend, runAutoModulation, appliances]);

  // Modula solo las islas y penínsulas (el resto de la cocina no se toca): reemplaza los módulos de cada una por una hilera nueva
  const modulateIslandsOnly = async () => {
    setIsOptMenuOpen(false);
    const conflicts = islandConflicts();
    if (conflicts.length > 0) {
      window.alert('No se puede modular mientras haya choques:\n\n• ' + conflicts.join('\n• ') + '\n\nMueve o cambia la medida de la isla o península y vuelve a intentarlo.');
      return;
    }
    if (activeIslands.length === 0) return;
    setIsSuggesting(true);
    setSuggestMessage('Modulando la isla o península...');
    await new Promise(resolve => setTimeout(resolve, 500));
    const ids = new Set(activeIslands.map(i => i.id));
    // la cascada (o el frentero) que ya tenga el mesón de la isla ocupa un espesor dentro de la medida general:
    // el módulo de ese extremo se acorta ese espesor, igual que cuando se activa la cascada
    const recortarExtremos = (isl: IslandItem, row: KitchenModule[]): KitchenModule[] => {
      const ex = counterExtras[`counter-isla-${isl.id}-0`];
      if (!ex || row.length === 0) return row;
      const fr = (side: 'left' | 'right') => ex.edge?.kind === 'frentero' && ex.edge.sides[side];
      const izq = !!ex.waterfallLeft || fr('left'), der = !!ex.waterfallRight || fr('right');
      const first = row.reduce((p, q) => (q.positionX < p.positionX ? q : p));
      const last = row.reduce((p, q) => (q.positionX + q.width > p.positionX + p.width ? q : p));
      return row.map(m => {
        let n = m;
        if (izq && m.uniqueId === first.uniqueId && n.width - counterThickness >= 15) n = { ...n, width: n.width - counterThickness, positionX: n.positionX + counterThickness };
        if (der && m.uniqueId === last.uniqueId && n.width - counterThickness >= 15) n = { ...n, width: n.width - counterThickness };
        return n;
      });
    };
    setModules(prev => [...prev.filter(m => !(m.wall === 'Island' && m.islandId && ids.has(m.islandId))), ...activeIslands.flatMap(isl => recortarExtremos(isl, buildIslandRow(isl, [900, 600, 300], currentBaseModuleHeight, appliances.find(a => a.type === 'stove')?.width, appliances.find(a => a.type === 'sink')?.width)))]);
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

  // Mis módulos: agrega un módulo especial guardado al final de su nivel en el muro activo, con las medidas y el frente que se definieron
  const addModuloEspecial = (e: ModuloEspecial) => {
    const wall: WallName | 'Island' = activeWall;
    const type = e.nivel;
    const wallLength = moduleWallLength(wall, type);
    const isUpper = type === 'UPPER';
    const sameTierItems = isUpper ? modules.filter(m => m.wall === wall && (m.type === 'UPPER' || m.type === 'TALL')) : [...modules.filter(m => m.wall === wall && m.type !== 'UPPER'), ...appliances.filter(a => a.wall === wall && a.active && a.type !== 'hood-under')];
    const currentWidth = sameTierItems.reduce((acc, it) => acc + it.width, 0);
    if (currentWidth + e.ancho > wallLength) { alert('⚠️ SOBREPASO: el módulo no cabe en el muro disponible.'); return; }
    const alto = e.muebleHorno ? currentBaseModuleHeight : type === 'TALL' ? Math.min(e.alto, spaceHeight - TOP_MARGIN) : e.alto; // el mueble de horno mide lo del mueble base del diseño
    const frontsLayout = e.muebleHorno ? 'oven' as const : e.frente === 'abierto' ? 'open' as const : e.frente === 'cajones' ? 'drawers' as const : isUpper ? (e.ancho < 450 ? 'upper-door1' as const : 'upper-door2-v' as const) : (e.ancho <= 450 ? 'door1' as const : 'door2' as const);
    const nuevo: KitchenModule = {
      id: e.id, name: e.nombre, type, width: e.ancho, height: alto, depth: e.fondo, basePrice: 0,
      uniqueId: Math.random().toString(36).substr(2, 9), wall, positionX: currentWidth, quantity: 1, doorType: 'vertical',
      configType: e.frente === 'cajones' ? 'drawers' : 'doors', hasPlateRack: e.platero, drawerCount: e.frente === 'cajones' ? e.cajones : 0,
      heightLocked: true, detailed: true, frontsLayout, ...(e.muebleHorno ? { muebleHorno: e.muebleHorno } : {}),
    };
    setModules(prev => [...prev, nuevo]);
    setActiveTab('design');
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
  // Unir dos cubos contiguos del mismo nivel en uno solo (Shift + clic en los dos): el de la izquierda crece y el otro desaparece
  const mergeModules = (aId: string, bId: string) => {
    setModules(prev => {
      const a = prev.find(m => m.uniqueId === aId), b = prev.find(m => m.uniqueId === bId);
      if (!a || !b) return prev;
      const [l, rr] = a.positionX <= b.positionX ? [a, b] : [b, a];
      const w = Math.round(l.width + rr.width);
      const joined: KitchenModule = { ...l, width: w, name: l.name.replace(/\d+\s?mm/, `${w}mm`) };
      return prev.filter(m => m.uniqueId !== rr.uniqueId).map(m => (m.uniqueId === l.uniqueId ? joined : m));
    });
  };

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
      let w = Math.max(15, Math.round(width / 5) * 5);
      if (next) {
        // El siguiente conserva al menos 100 mm y queda pegado al brazo
        w = Math.min(w, ca.width + next.width - 15);
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
      // Frentero a la izquierda o derecha: el módulo del extremo se acorta un espesor (y se devuelve al quitarlo)
      if (extras.edge !== undefined) {
        const prev = counterExtras[counterId]?.edge;
        const was = (side: 'left' | 'right') => prev?.kind === 'frentero' && prev.sides[side];
        const now = (side: 'left' | 'right') => extras.edge!.kind === 'frentero' && extras.edge!.sides[side];
        (['left', 'right'] as const).forEach(side => {
          if (was(side) === now(side)) return;
          const atStart = side === 'left' ? leftIsStart : !leftIsStart;
          if (changes.some(c => c.atStart === atStart)) return; // ya hay un cambio de cascada en ese extremo
          // Si el módulo de ese extremo ya tiene visto o dilatada, ya viene restado: el frentero queda encima y no se resta de nuevo
          const endModuleId = (atStart ? lowersInRun.reduce((p, q) => (along(q).a0 < along(p).a0 ? q : p)) : lowersInRun.reduce((p, q) => (along(q).a1 > along(p).a1 ? q : p)))?.moduleId;
          const endModule = modules.find(mm => mm.uniqueId === endModuleId);
          if (endModule) {
            const startIsLeft = endModule.wall !== 'B';
            const hasLateral = (atStart === startIsLeft) ? (endModule.vistoLeft || endModule.dilatLeft) : (endModule.vistoRight || endModule.dilatRight);
            if (hasLateral) return;
          }
          changes.push({ atStart, on: now(side) });
        });
      }
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
            if (next.width + dw < 15) return;
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
    modules: mods, appliances, hasCounter, counterThickness, counterOverhang, hasSplash, splashHeight, counterExtras, islands: activeIslands, columns, closet: closetInput, fit: fitInput, lArm, hasLeftClosure, hasRightClosure,
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
  // Extremos del módulo (inicio y final del muro) donde el mesón que lo cubre lleva frentero: el módulo de ese extremo ya viene restado
  const frenteroEnds = (m: KitchenModule): { start: boolean; end: boolean } => {
    const none = { start: false, end: false };
    const mb = boxes.find(bx => bx.moduleId === m.uniqueId);
    if (!mb) return none;
    const alongOf = (bx: BoxData) => (bx.wall === 'A' ? { a0: bx.x, a1: bx.x + bx.sx } : { a0: bx.y, a1: bx.y + bx.sy });
    const mAlong = alongOf(mb);
    const slab = boxes.find(bx => bx.kind === 'counter' && bx.id.startsWith('counter-') && bx.wall === mb.wall && (mb.islandId ? bx.islandId === mb.islandId : !bx.islandId)
      && alongOf(bx).a0 <= mAlong.a0 + 1 && alongOf(bx).a1 >= mAlong.a1 - 1);
    const edge = slab ? counterExtras[slab.id]?.edge : undefined;
    if (!slab || edge?.kind !== 'frentero') return none;
    const runLowers = boxes.filter(bx => bx.kind === 'lower' && bx.wall === slab.wall && (slab.islandId ? bx.islandId === slab.islandId : !bx.islandId) && alongOf(bx).a0 >= alongOf(slab).a0 - 1 && alongOf(bx).a1 <= alongOf(slab).a1 + 1);
    if (runLowers.length === 0) return none;
    const first = runLowers.reduce((p, q) => (alongOf(q).a0 < alongOf(p).a0 ? q : p));
    const last = runLowers.reduce((p, q) => (alongOf(q).a1 > alongOf(p).a1 ? q : p));
    const leftIsStart = slab.wall !== 'B';
    return {
      start: first.moduleId === m.uniqueId && !!(leftIsStart ? edge.sides.left : edge.sides.right),
      end: last.moduleId === m.uniqueId && !!(leftIsStart ? edge.sides.right : edge.sides.left),
    };
  };

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
      if (m.width - delta < 15) return m;
      // Si el mesón tiene frentero en ese extremo, el frentero ya le había restado un espesor al módulo; al aparecer el visto o la
      // dilatada, el frentero queda encima de ellos y ese espesor se devuelve (y se vuelve a restar si se quitan)
      const fr = frenteroEnds(m);
      let widthAdj = 0, posAdj = 0;
      (['start', 'end'] as const).forEach(e => {
        if (!fr[e]) return;
        const appears = before[e] === 0 && after[e] > 0, disappears = before[e] > 0 && after[e] === 0;
        const sign = appears ? 1 : disappears ? -1 : 0;
        widthAdj += sign * counterThickness;
        if (e === 'start') posAdj -= sign * counterThickness;
      });
      return {
        ...m,
        vistoLeft: v.visto.left, vistoRight: v.visto.right, vistoThickness: v.visto.thickness,
        dilatLeft: v.dilat.left, dilatRight: v.dilat.right, dilatThickness: v.dilat.thickness, dilatDepth: v.dilat.depth, dilatHeight: v.dilat.height,
        width: m.width - delta + widthAdj, positionX: m.positionX + (after.start - before.start) + posAdj,
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
        const newWidth = Math.max(15, Math.round((initialWidth - deltaX) / 5) * 5);
        const positionChange = initialWidth - newWidth;
        return { ...m, positionX: Math.max(0, initialPositionX + positionChange), width: newWidth };
      } else {
        // Redimensionar desde el borde derecho
        const newWidth = Math.max(15, Math.round((initialWidth + deltaX) / 5) * 5);
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
    const MIN_WIDTH = 15;
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
          {appliances.filter(a => a.wall === 'A' && a.active && !esEquipoTorre(a.type)).map((app, idx) => {
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
    
    const currentWallModules = modulesWithCoords3D.filter(m => m.wall === 'A'), currentWallApps = appliances.filter(a => a.wall === 'A' && a.active && !esEquipoTorre(a.type));
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

  // Un clic fuera de los paneles laterales (Elementos, Electrodomésticos, Módulos especiales) los cierra; los botones de la barra lateral
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
      const est = prev.find(a => a.type === 'stove');
      const encenderCampana = type === 'stove' && est && !est.active;
      return prev.map(a => (a.type === type ? { ...a, active: !a.active }
        : encenderCampana && a.type === 'hood-under' ? { ...a, active: true, wall: est!.wall, distance: est!.distance, width: est!.width } : a));
    });
  };
  // La campana sigue a la estufa y el lavavajillas va pegado a la poceta, del lado que se pidió
  useEffect(() => {
    setAppliances(prev => {
      const est = prev.find(a => a.type === 'stove' && a.active), poc = prev.find(a => a.type === 'sink' && a.active);
      let cambio = false;
      const next = prev.map(a => {
        if (a.type === 'hood-under' && a.active && est && (a.wall !== est.wall || a.distance !== est.distance || a.width !== est.width)) { cambio = true; return { ...a, wall: est.wall, distance: est.distance, width: est.width }; }
        if (a.type === 'dishwasher' && a.active && poc && poc.wall !== 'Island') {
          const ini = poc.space ? poc.distance - (poc.space - poc.width) / 2 : poc.distance, ancho = poc.space ?? Math.max(600, poc.width);
          const d = Math.max(0, (a.lado ?? 'der') === 'der' ? ini + ancho : ini - a.width);
          if (a.wall !== poc.wall || a.distance !== d) { cambio = true; return { ...a, wall: poc.wall, distance: d }; }
        }
        return a;
      });
      return cambio ? next : prev;
    });
  }, [appliances]);

  // Isla o península: se pide la medida general y se crea a 1 m del punto 0 en ambas cotas (después se editan)
  const addIsland = () => {
    if (!islandDraft.kind) return;
    const length = Math.round(parseFloat(islandDraft.length) || 0);
    const width = Math.round(parseFloat(islandDraft.width) || 0);
    if (length < 300 || width < 300) { window.alert('La isla o península necesita al menos 300 mm de largo y de ancho.'); return; }
    if (islandDraft.kind === 'peninsula' && layout !== 'L_SHAPE') { window.alert('La península solo se crea en cocinas en L: va pegada al muro perpendicular.'); return; }
    // La isla nace a 1 m del punto 0 en ambas cotas; la península va pegada al muro perpendicular B (cota X = 0, contra su cara interior) y a 1 m en Y
    const bar = Math.max(0, Math.min(Math.round(parseFloat(islandDraft.bar) || 0), width - 200));
    setIslands(prev => [...prev, { id: Math.random().toString(36).substr(2, 6), kind: islandDraft.kind, length, width, dx: islandDraft.kind === 'peninsula' ? 0 : Math.max(0, Math.round(parseFloat(islandDraft.dx) || 0)), dy: Math.max(0, Math.round(parseFloat(islandDraft.dy) || 0)), bar,
      stove: islandDraft.stove ? { distance: Math.max(0, Math.round(parseFloat(islandDraft.stove.distance) || 0)) } : undefined,
      sink: islandDraft.sink ? { distance: Math.max(0, Math.round(parseFloat(islandDraft.sink.distance) || 0)) } : undefined }]);
    setIslandDraft(d => ({ ...d, kind: null, stove: null, sink: null }));
  };
  // formulario propio de la isla (doble clic en ella): medidas, barra, alistonado, electrodomésticos y su mesón
  const [islaAbierta, setIslaAbierta] = useState<string | null>(null);
  const aplicarMesonIsla = useRef<(() => void) | null>(null);
  const updateIsland = (id: string, patch: Partial<IslandItem>) => setIslands(prev => prev.map(i => (i.id === id ? { ...i, ...patch, ...(i.kind === 'peninsula' ? { dx: 0 } : {}) } : i)));
  const removeIsland = (id: string) => { setIslands(prev => prev.filter(i => i.id !== id)); setModules(prev => prev.filter(m => m.islandId !== id)); };

  const contenidoIsla = (isl: IslandItem) => (
    <>
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
        {([['length', 'Largo'], ['width', 'Ancho'], ['dx', 'Cota X desde 0'], ['dy', 'Cota Y desde 0'], ['bar', 'Barra']] as const).map(([key, label]) => (
          <div key={key} className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label><MeasureSketch kind={({ length: 'iL', width: 'iW', dx: 'iX', dy: 'iY', bar: 'iBar' } as const)[key]} /></div>
            <input type="number" disabled={isl.kind === 'peninsula' && key === 'dx'} value={isl[key]} onChange={(e) => updateIsland(isl.id, { [key]: Math.max(key === 'length' || key === 'width' ? 300 : 0, parseInt(e.target.value) || 0) })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
        ))}
      </div>
      {(() => {
        // espaldar alistonado de la isla o península (parte posterior de los módulos): listones del piso al mesón, con fondo de 6 o 15 o sin fondo
        const L = isl.alistonado;
        const setL = (p: Partial<NonNullable<typeof L>>) => updateIsland(isl.id, { alistonado: { ancho: 65, esp: 15, sep: 35, fondo: 0, ...(L ?? {}), ...p } });
        return (
          <div className="space-y-2">
            <button type="button" onClick={() => updateIsland(isl.id, { alistonado: L ? undefined : { ancho: 65, esp: 15, sep: 35, fondo: 0 } })} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${L ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
              <span>Espaldar alistonado</span>
              <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${L ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
            </button>
            {L && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {([['ancho', 'Ancho listón'], ['esp', 'Espesor'], ['sep', 'Separación']] as const).map(([k, label]) => (
                    <div key={k} className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                      <DeferredNumber value={L[k]} onCommit={(n) => setL({ [k]: Math.max(k === 'sep' ? 0 : 3, Math.round(n)) })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([[0, 'Sin fondo'], [6, 'Fondo 6'], [15, 'Fondo 15']] as const).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setL({ fondo: v })} className={`py-1.5 rounded-lg text-[9px] font-black uppercase border-2 ${(L.fondo ?? 0) === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
      <IslandApplianceFields
        stove={isl.stove}
        sink={isl.sink}
        onToggle={(k, on) => updateIsland(isl.id, { [k]: on ? { distance: k === 'stove' ? 0 : 900 } : undefined, ...(k === 'stove' && !on ? { campana: false } : {}) })}
        onDistance={(k, v) => updateIsland(isl.id, { [k]: { distance: Math.max(0, parseInt(v) || 0) } })}
        campana={isl.campana} onCampana={on => updateIsland(isl.id, { campana: on })}
      />
    </>
  );

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
  // La nevera normalmente va en un extremo del muro. En cocina en L nunca se deja en la esquina: ese extremo queda
  // BORDE_NEVERA_L mm libre (en B y C el arranque ya descuenta la esquina ciega) y el otro extremo, el libre, es donde se ofrece.
  const BORDE_NEVERA_L = 600;
  const esquinaIzq = (wall: WallName) => wall !== 'A' || lArm === 'left'; // en A la esquina del L está a la izquierda solo si el brazo B va ahí
  const limitarPosicion = (a: Appliance, wall: WallName, distance: number) => {
    const usable = wallUsableLength(wall);
    const maxDistance = Math.max(0, usable - a.width);
    if (a.type === 'fridge' && layout === 'L_SHAPE') {
      const izq = esquinaIzq(wall);
      const minL = izq ? BORDE_NEVERA_L : 0, maxL = usable - a.width - (izq ? 0 : BORDE_NEVERA_L);
      if (maxL >= minL) return Math.min(Math.max(distance, minL), maxL);
    }
    return Math.min(Math.max(distance, 0), maxDistance);
  };
  // posición de la nevera en el muro: pegada a la izquierda, centrada o pegada a la derecha
  const posNevera = (a: Appliance, wall: WallName, donde: 'izq' | 'centro' | 'der') => {
    const libre = Math.max(0, wallUsableLength(wall) - a.width);
    return limitarPosicion(a, wall, donde === 'izq' ? 0 : donde === 'der' ? libre : Math.round(libre / 2));
  };

  const moveAppliance = (type: ApplianceType, wall: WallName, distance: number) => {
    setAppliances(prev => prev.map(a => (a.type !== type ? a : { ...a, wall, distance: limitarPosicion(a, wall, distance) })));
  };

  // Horno y horno corto van en el hueco de la Torre de hornos: al encender uno se activa la torre (si no estaba) y se ensancha lo que pida el equipo
  // (el horno necesita un hueco de 600 de ancho: laterales de 15 + 600 = 630)
  const toggleHorno = (type: ApplianceType, soloTorre = false) => {
    const on = appliances.find(a => a.type === type)?.active;
    if (!soloTorre) toggleAppliance(type);
    if ((on && !soloTorre) || (!soloTorre && appliances.find(a => a.type === type)?.donde === 'mueble')) return;
    const necesario = type === 'oven' ? 630 : 600;
    const sm = specialModules.find(s => s.kind === 'tall-oven');
    if (!sm) return;
    if (!sm.active) {
      const inst = { ...sm, width: Math.max(sm.width, necesario) };
      const used = modules.filter(m => m.wall === activeWall && m.type === 'TALL').reduce((acc, m) => acc + m.width, 0);
      if (placeSpecialModule(inst, used)) setSpecialModules(prev => prev.map(s => (s.id === sm.id ? { ...inst, active: true } : s)));
    } else if (sm.width < necesario) {
      updateSpecialModuleProp(sm.id, 'width', necesario);
    }
  };
  // El horno cambia de la torre al mueble de horno (o al revés): la torre se quita si ya no lleva ningún horno y se pone si lo necesita
  const cambiarDondeHorno = (type: 'oven' | 'oven-compact', k: 'torre' | 'mueble', variante?: ModuloEspecial['muebleHorno']) => {
    updateApplianceProp(type, 'donde', k);
    if (variante) updateApplianceProp(type, 'variante', variante);
    if (k === 'mueble') {
      // el mueble se pone en el primer hueco libre del muro (si donde estaba se cruza con otro equipo o se sale)
      const ap = appliances.find(x => x.type === type);
      const opc = muebleDeVariante(variante ?? ap?.variante ?? VARIANTE_POR_DEFECTO[type]);
      if (ap && opc && ap.wall !== 'Island') {
        const wall = ap.wall as WallName;
        const dist = (ap.donde ?? 'torre') === 'torre' ? 0 : ap.distance;
        const libre = ocupantesDelMuro(ap).every(o => { const [y0, y1] = ocupaEnMuro(o); return Math.min(dist + opc.ancho, y1) - Math.max(dist, y0) <= 1; }) && dist + opc.ancho <= wallUsableLength(wall) + 1;
        updateApplianceProp(type, 'distance', libre ? dist : primerHuecoMuro(ap, wall, opc.ancho));
      }
    }
    const sm = specialModules.find(s => s.kind === 'tall-oven');
    const activo = appliances.find(a => a.type === type)?.active;
    const otroEnTorre = appliances.some(a => esEquipoTorre(a.type) && a.type !== type && a.active && (a.donde ?? 'torre') === 'torre');
    if (!sm || !activo) return;
    if (k === 'mueble' && sm.active && !otroEnTorre) toggleSpecialGroup('tall-oven');
    if (k === 'torre' && !sm.active) toggleHorno(type, true);
  };
  // Los hornos siguen a la torre: mismo muro y centrados en ella
  useEffect(() => {
    const torreModulo = modules.find(m => m.type === 'TALL' && /tall-oven/.test(m.uniqueId));
    setAppliances(prev => {
      let cambio = false;
      const next = prev.map(a => {
        const torre = torreModulo;
        if (!esEquipoTorre(a.type) || !a.active || !torre || a.donde === 'mueble') return a;
        const d = Math.round(torre.positionX + (torre.width - a.width) / 2);
        if (a.wall === torre.wall && a.distance === d) return a;
        cambio = true; return { ...a, wall: torre.wall as Appliance['wall'], distance: d };
      });
      return cambio ? next : prev;
    });
  }, [modules, appliances.filter(a => esEquipoTorre(a.type) && a.active).length]);

  // Al pasar a cocina en L (o al encender la nevera / cambiarla de muro) se aparta de las esquinas
  useEffect(() => {
    setAppliances(prev => {
      let cambio = false;
      const next = prev.map(a => {
        if (a.type !== 'fridge' || !a.active || a.wall === 'Island' || layout !== 'L_SHAPE') return a;
        if (limitarPosicion(a, a.wall, a.distance) === a.distance) return a;
        // estaba en la esquina: pasa al extremo libre del muro
        const d = posNevera(a, a.wall, esquinaIzq(a.wall) ? 'der' : 'izq');
        cambio = true; return { ...a, distance: d };
      });
      return cambio ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, lArm, wallA, wallB, wallC, appliances.find(a => a.type === 'fridge')?.active, appliances.find(a => a.type === 'fridge')?.wall]);

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
        const splash = bx.id.startsWith('salpicadero-') || bx.id.startsWith('frentero-') || bx.id.startsWith('reengruese-');
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

  // electrodomésticos: la misma lista en la ventana de Espacio (paso 3) y en el panel Electrodomésticos. Una línea por cada uno:
  // icono, nombre, interruptor; activo: muro, ancho y posición en línea, sus puntos como etiquetas y lo propio de cada uno
  const ICONO_ELECTRO: Partial<Record<ApplianceType, React.ReactNode>> = { fridge: <Refrigerator size={16} />, stove: <Flame size={16} />, sink: <Droplets size={16} />, 'hood-under': <Wind size={16} />, pantry: <Archive size={16} />, dishwasher: <WashingMachine size={16} />, oven: <CookingPot size={16} />, 'oven-compact': <Microwave size={16} /> };
  const NOMBRE_ELECTRO: Partial<Record<ApplianceType, string>> = { fridge: 'Nevera', stove: 'Estufa', sink: 'Poceta', 'hood-under': 'Campana', pantry: 'Alacena alta', dishwasher: 'Lavavajillas', oven: 'Horno', 'oven-compact': 'Horno corto' };
  const chip = (on: boolean) => `px-2 py-1 rounded-lg text-[10px] font-black border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`;
  const numMini = 'w-16 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black text-slate-800 text-right outline-none focus:border-indigo-500';
  const listaElectro = (
                  <div className="space-y-2">
                    {cfg.accessories.length === 0 && (<div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-500">Aún no hay electrodomésticos definidos para {cfg.name.toLowerCase()}.</div>)}
                    {appliances.filter(ap => cfg.accessories.includes(ap.type)).map((app) => {
                      const sigue = app.type === 'dishwasher' ? 'poceta' : app.type === 'hood-under' ? 'estufa' : esEquipoTorre(app.type) ? (app.donde === 'mueble' ? null : 'torre de hornos') : null; // va pegado a otro: sin muro ni posición propios
                      const pts = app.active ? puntosAdecuacion([app], modules, wallA) : [];
                      return (
                      <div key={app.type} className={`px-3 py-2 rounded-2xl border transition-all space-y-1.5 ${app.active ? 'bg-indigo-50/60 border-indigo-300' : 'bg-white border-slate-100'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`p-1.5 rounded-lg ${app.active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{ICONO_ELECTRO[app.type]}</span>
                          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight mr-auto">{NOMBRE_ELECTRO[app.type] ?? app.type}</span>
                          <button onClick={() => (esEquipoTorre(app.type) ? toggleHorno(app.type) : toggleAppliance(app.type))} aria-label={`${app.active ? 'Quitar' : 'Poner'} ${NOMBRE_ELECTRO[app.type] ?? ''}`} className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${app.active ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${app.active ? 'left-[18px]' : 'left-0.5'}`} /></button>
                        </div>
                        {app.active && (
                          <div className="grid grid-cols-1 gap-2">
                            {/* Lo que mide el electrodoméstico */}
                            <div className="rounded-xl bg-white/70 border border-slate-200 px-2.5 py-1.5 space-y-1">
                              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Medidas del equipo</div>
                              <div className="flex items-end gap-2">
                                {esEquipoTorre(app.type) ? (
                                  <div className="text-[11px] font-bold text-slate-700">{app.width} × {app.height} × {app.depth} mm
                                    <div className="text-[9px] font-bold text-slate-400">{app.donde === 'mueble' ? (app.type === 'oven' ? 'Hueco de 600 × 590 · en su mueble' : 'Hueco de 560-568 × 460 · en su mueble') : app.type === 'oven' ? 'Hueco de 600 × 590 · la torre pasa a 630 de ancho' : 'Hueco de 560-568 × 460'}</div></div>
                                ) : (
                                <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-400" title="Ancho del electrodoméstico (mm)">Ancho (mm)
                                  <input type="number" value={app.width} onFocus={e => e.currentTarget.select()} onChange={(e) => updateApplianceProp(app.type, 'width', parseInt(e.target.value) || 0)} className={numMini} /></label>
                                )}
                                {app.type === 'fridge' && (
                                  <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-400" title="Altura de la nevera (mm): define el espacio del mueble sobre ella">Alto (mm)
                                    <input type="number" value={app.height} onFocus={e => e.currentTarget.select()} onChange={(e) => updateApplianceProp('fridge', 'height', parseInt(e.target.value) || 0)} className={numMini} /></label>
                                )}
                              </div>
                            </div>
                            {/* Dónde va en el muro */}
                            {!sigue && (
                              <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 px-2.5 py-1.5 space-y-1">
                                <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Ubicación en el muro</div>
                                <div className="flex items-end gap-2 flex-wrap">
                                  {(['A', 'B', 'C'] as WallName[]).filter(w => w === 'A' || (w === 'B' && armB) || (w === 'C' && armC)).length > 1 && (
                                    <div className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-400">Muro
                                      <span className="flex gap-0.5">{(['A', 'B', 'C'] as WallName[]).filter(w => w === 'A' || (w === 'B' && armB) || (w === 'C' && armC)).map(w => (
                                        <button key={w} type="button" title={`Muro ${w}`} onClick={() => moveAppliance(app.type, w, app.wall === w ? app.distance : app.type === 'fridge' && layout === 'L_SHAPE' ? posNevera(app, w, esquinaIzq(w) ? 'der' : 'izq') : 0)} className={chip(app.wall === w)}>{w}</button>
                                      ))}</span>
                                    </div>
                                  )}
                                  {app.type === 'fridge' && app.wall !== 'Island' && (() => {
                                    const w = app.wall as WallName;
                                    return (
                                      <div className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-400">Va a la
                                        <span className="flex gap-0.5">{([['izq', 'Izquierda'], ['centro', 'Centro'], ['der', 'Derecha']] as const).map(([k, t]) => {
                                          const esquina = layout === 'L_SHAPE' && k !== 'centro' && (k === 'izq') === esquinaIzq(w);
                                          return <button key={k} type="button" disabled={esquina} title={esquina ? 'Es la esquina: ahí no va la nevera' : undefined} onClick={() => updateApplianceProp('fridge', 'distance', posNevera(app, w, k))} className={`${chip(app.distance === posNevera(app, w, k))} disabled:opacity-40 disabled:cursor-not-allowed`}>{t}</button>;
                                        })}</span>
                                      </div>
                                    );
                                  })()}
                                  <label className="flex flex-col gap-0.5 text-[9px] font-bold text-slate-400" title="Distancia desde el inicio del muro hasta el borde del equipo (mm)">{app.type === 'fridge' ? 'Ajustar posición (mm)' : 'Distancia al inicio (mm)'}
                                    <input type="number" value={app.distance} onFocus={e => e.currentTarget.select()} onChange={(e) => updateApplianceProp(app.type, 'distance', parseInt(e.target.value) || 0)} onBlur={() => app.wall !== 'Island' && moveAppliance(app.type, app.wall as WallName, app.distance)} className={numMini} /></label>
                                </div>
                                {app.type === 'fridge' && layout === 'L_SHAPE' && <div className="text-[9px] font-bold text-indigo-500">En L la nevera no va en la esquina: se ofrece el extremo libre del muro.</div>}
                              </div>
                            )}
                          </div>
                        )}
                        {app.active && (
                          <div className="flex items-center gap-1 flex-wrap pl-9">
                            {pts.map(pt => { const info = PUNTO_INFO[pt.tipo]; return <span key={pt.id} title={`${info.nombre} a ${Math.round(pt.z / 10)} cm del piso`} className="px-1.5 py-0.5 rounded-md text-[9px] font-black text-white" style={{ background: info.color }}>{info.sigla} {Math.round(pt.z / 10)}</span>; })}
                            {sigue && <span className="text-[9px] font-bold text-slate-400">va con la {sigue}</span>}
                            {app.type === 'fridge' && <button type="button" onClick={() => updateApplianceProp('fridge', 'dispensador', !app.dispensador)} className={chip(!!app.dispensador)}>Dispensador {app.dispensador ? 'sí' : 'no'}</button>}
                            {app.type === 'oven' && <button type="button" title="El horno lleva energía; con gas, además una entrada de gas" onClick={() => updateApplianceProp('oven', 'gas', !app.gas)} className={chip(!!app.gas)}>Gas {app.gas ? 'sí' : 'no'}</button>}
                            {esEquipoTorre(app.type) && (() => {
                              const tipo = app.type as 'oven' | 'oven-compact';
                              const elegida = app.variante ?? VARIANTE_POR_DEFECTO[tipo];
                              const opcionElegida = muebleDeVariante(elegida);
                              return <>
                                <span className="text-[9px] font-bold text-slate-400 mr-0.5 w-full">Va en · opciones para este equipo</span>
                                <button type="button" title="Hueco en la Torre de hornos" onClick={() => cambiarDondeHorno(tipo, 'torre')} className={chip((app.donde ?? 'torre') === 'torre')}>Torre de hornos</button>
                                {opcionesMuebleHorno(tipo).map(o => <button key={o.id} type="button" title={o.nombre} onClick={() => cambiarDondeHorno(tipo, 'mueble', o.muebleHorno)} className={chip(app.donde === 'mueble' && elegida === o.muebleHorno)}>{etiquetaMueble(o.muebleHorno)}</button>)}
                                {app.donde === 'mueble' && opcionElegida && !modules.some(m => m.muebleHorno === elegida) && <button type="button" onClick={() => addModuloEspecial(opcionElegida)} className="px-2 py-1 rounded-lg text-[10px] font-black border border-indigo-300 bg-white text-indigo-600">+ Agregar el mueble</button>}
                                {app.donde === 'mueble' && opcionElegida && <span className="text-[9px] font-bold text-slate-400 w-full">{opcionElegida.nombre} ({opcionElegida.ancho} de ancho){modules.some(m => m.muebleHorno === elegida) ? '' : ' · se coloca al optimizar la modulación'}</span>}
                              </>;
                            })()}
                            {app.type === 'dishwasher' && (['izq', 'der'] as const).map(l => <button key={l} type="button" onClick={() => updateApplianceProp('dishwasher', 'lado', l)} className={chip((app.lado ?? 'der') === l)}>{l === 'izq' ? 'Izquierda' : 'Derecha'}</button>)}
                            {app.type === 'dishwasher' && !appliances.find(a => a.type === 'sink')?.active && <span className="text-[9px] font-bold text-amber-700">activa la poceta</span>}
                            {app.type === 'hood-under' && ([['convencional', 'Horizontal', 'Bajo un mueble aéreo'], ['libre', 'Península', 'Sin mueble arriba: los aéreos dejan libre la medida de la campana + 5 cm (vuelve a optimizar)'], ['extraplana', 'Extraplana', 'Bajo un mueble aéreo (su mueble superior propio está pendiente: por ahora usa el de la horizontal)'], ['oculta', 'Oculta', 'Dentro del mueble aéreo (su mueble superior propio está pendiente: por ahora usa el de la horizontal)']] as const).map(([k, t, d]) => <button key={k} type="button" title={d} onClick={() => updateApplianceProp('hood-under', 'campanaTipo', k)} className={chip((app.campanaTipo ?? 'convencional') === k)}>{t}</button>)}
                          </div>
                        )}
                      </div>
                      );
                    })}
                    {/* Campana de isla: va sobre la estufa de la isla o península; se activa y desactiva aquí o en la configuración de la isla */}
                    {cfg.accessories.includes('hood-under') && (() => {
                      const conEstufa = activeIslands.filter(i => i.stove);
                      const on = conEstufa.length > 0 && conEstufa.some(i => i.campana);
                      return (
                        <div className={`px-3 py-2 rounded-2xl border transition-all space-y-1 ${on ? 'bg-indigo-50/60 border-indigo-300' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Wind size={20} /></div>
                              <div>
                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Campana de isla</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{conEstufa.length === 0 ? 'Necesita una isla con estufa' : on ? 'Activo' : 'Desactivado'}</p>
                              </div>
                            </div>
                            <button disabled={conEstufa.length === 0} onClick={() => conEstufa.forEach(i => updateIsland(i.id, { campana: !on }))} className={`w-10 h-5 rounded-full transition-all relative disabled:opacity-40 ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} /></button>
                          </div>
                          {conEstufa.length === 0 && <p className="text-[9px] font-bold text-slate-400">Agrega una isla o península y marca "Lleva estufa" en su configuración.</p>}
                        </div>
                      );
                    })()}
                  </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {isSuggesting && <LoadingOverlay message={suggestMessage} />}
      {aprobando === 'dialogo' && <DialogoAprobar seccion={section} nombreInicial={nombreAprobar} onCerrar={() => { setAprobando(null); setNombreAprobar(undefined); }}
        onListo={p => { setNombreAprobar(undefined); aprobarDiseno({ id: '', nombre: p.nombre, proyectoId: p.proyectoId, cliente: p.cliente }, { ubicacion: p.ubicacion, cantidad: p.cantidad }); }} />}
      {(() => {
        const isDeliverableTab = activeTab === 'render' || activeTab === 'planos' || activeTab === 'laminas' || activeTab === 'listado';
        const isInProjectFlow = activeTab === 'bosquejo' || activeTab === 'design' || activeTab === 'quote' || isDeliverableTab;
        const globalNavItems: { id: 'inicio' | 'proyectos' | 'catalog' | 'config'; label: string }[] = [
          { id: 'inicio', label: 'Inicio' },
          { id: 'proyectos', label: 'Proyectos' },
          { id: 'catalog', label: 'Biblioteca de Módulos' },
          { id: 'config', label: 'Configuración' },
        ];
        const steps = [
          { n: 1, id: 'bosquejo' as const, label: 'Boceto', active: activeTab === 'bosquejo', done: bosquejoListo || labeledModules.length > 0 },
          { n: 2, id: 'design' as const, label: 'Diseño 3D', active: activeTab === 'design', done: lista.piezas.length > 0 && aprobadoKey === snapshotKey },
          { n: 3, id: 'quote' as const, label: 'Precios', active: activeTab === 'quote', done: false },
          { n: 4, id: lastDeliverableTab, label: 'Entregables', active: isDeliverableTab, done: aprobadoKey !== null && aprobadoKey === snapshotKey },
        ];
        return (
          <>
            <header className="sticky top-0 z-[60] bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 min-h-14 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('inicio')}
                  className="flex items-center gap-2.5 text-left shrink-0 group"
                  title="Ir a Inicio"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm group-hover:bg-slate-800 transition-colors">
                    <Box size={17} />
                  </div>
                  <div className="leading-tight">
                    <span className="block text-sm font-semibold tracking-tight text-slate-900">Modully</span>
                    <span className="hidden sm:block text-[11px] font-medium text-slate-400 leading-none">Cierre exacto</span>
                  </div>
                </button>
                <div className="hidden md:block w-px h-5 bg-slate-200" />
                <nav aria-label="Navegación principal" className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
                  {globalNavItems.map(item => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap border transition-colors ${
                          active
                            ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border-transparent font-medium'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className="relative flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSectionMenuOpen(!isSectionMenuOpen)}
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                  title="Cambiar tipo de producto"
                >
                  <span className="text-indigo-600">{SECTION_ICONS[section]}</span>
                  <span>{cfg.name}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSectionMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {(activeTab === 'inicio' || activeTab === 'proyectos') && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab('proyectos'); setNuevoProyectoTick(t => t + 1); }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-sm transition-colors"
                  >
                    <Plus size={14} />
                    <span>Nuevo Proyecto</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  title="Ajustes"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    activeTab === 'config'
                      ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <Settings size={14} />
                  <span className="hidden lg:inline">Ajustes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('proyectos')}
                  title={correoSesion ? `Sesión: ${correoSesion}` : 'Perfil y cuenta'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                >
                  <UserRound size={14} className={correoSesion ? 'text-indigo-600' : 'text-slate-500'} />
                  <span className="max-w-[110px] truncate">{correoSesion ? correoSesion.split('@')[0] : 'Perfil'}</span>
                  {correoSesion && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
                {isSectionMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-lg border border-slate-200/80 p-1.5 z-[90] flex flex-col gap-0.5">
                    {SECTION_ORDER.map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => switchSection(id)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          id === section
                            ? 'text-indigo-600 bg-indigo-50 border border-indigo-200 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700 border border-transparent font-medium'
                        }`}
                      >
                        <span className={id === section ? 'text-indigo-600' : 'text-slate-500'}>{SECTION_ICONS[id]}</span>
                        <span>{SECTIONS[id].name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {isInProjectFlow && (
              <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-[58] shrink-0">
                <div className="flex items-center gap-1.5 min-w-0 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('proyectos')}
                    className="font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Proyectos
                  </button>
                  <span className="text-slate-300">/</span>
                  <span className="font-semibold tracking-tight text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">
                    {productoActivo ? `${productoActivo.cliente} — ${productoActivo.nombre}` : cfg.name}
                  </span>
                </div>

                <nav aria-label="Pasos del proyecto" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {steps.map((s, idx) => (
                    <React.Fragment key={s.label}>
                      {idx > 0 && <ChevronRight size={14} className="text-slate-300 shrink-0 hidden sm:block" />}
                      <button
                        type="button"
                        onClick={() => setActiveTab(s.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap border transition-all ${
                          s.active
                            ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent font-medium'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                            s.active
                              ? 'bg-indigo-600 text-white'
                              : s.done
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.done && !s.active ? '✓' : s.n}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </React.Fragment>
                  ))}
                </nav>

                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                      aprobadoKey !== null && aprobadoKey === snapshotKey
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : productoActivo
                          ? 'bg-slate-100 text-slate-600 border-slate-200/80'
                          : 'bg-slate-50 text-slate-500 border-slate-200/80'
                    }`}
                  >
                    {aprobadoKey !== null && aprobadoKey === snapshotKey
                      ? 'Diseño aprobado'
                      : productoActivo
                        ? 'Proyecto guardado'
                        : 'Borrador activo'}
                  </span>
                </div>
              </div>
            )}
          </>
        );
      })()}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'design' && (
          <div className="relative flex-1 bg-[#F3F4F6] overflow-hidden flex flex-row h-full">
            <aside className={`relative h-full transition-all duration-300 ease-in-out bg-white border-r border-slate-200/80 flex flex-col items-center py-3 gap-2 z-[55] overflow-y-auto no-scrollbar ${isSidebarVisible ? (isSidebarCollapsed ? 'w-16' : 'w-44') : 'w-0 opacity-0 pointer-events-none'}`}>
              <div className="flex flex-col gap-1.5 w-full px-2.5"><button onClick={() => setIsSidebarVisible(false)} title="Ocultar barra de herramientas" className="w-full h-8 flex items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"><X size={15} /></button><button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title={isSidebarCollapsed ? 'Expandir herramientas' : 'Contraer herramientas'} className="w-full h-8 flex items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100/70 transition-colors">{isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button></div>
              <div className="flex flex-col gap-2 w-full px-2.5 mt-1">
                <SidebarToolButton active={isElementsPanelOpen} onClick={() => togglePanel('elements')} icon={<Settings2 size={18} />} label="Módulos" collapsed={isSidebarCollapsed} badge={modules.length > 0 ? modules.length.toString() : undefined} />
                <SidebarToolButton active={isAccessoriesPanelOpen} onClick={() => togglePanel('accessories')} icon={<Microwave size={18} />} label="Electrodomésticos" collapsed={isSidebarCollapsed} badge={appliances.filter(a => a.active).length > 0 ? appliances.filter(a => a.active).length.toString() : undefined} />
                <SidebarToolButton active={isSpecialModulesPanelOpen} onClick={() => togglePanel('special')} icon={<Archive size={18} />} label="Especiales" collapsed={isSidebarCollapsed} badge={specialModules.filter(sm => sm.active).length > 0 ? specialModules.filter(sm => sm.active).length.toString() : undefined} />
                <SidebarToolButton active={isWorkspaceModalOpen} onClick={() => togglePanel('workspace')} icon={<Maximize size={18} />} label="Espacio" collapsed={isSidebarCollapsed} />
                <SidebarToolButton active={isModulosModalOpen} onClick={() => setIsModulosModalOpen(o => !o)} icon={<Palette size={18} />} label="Acabados" collapsed={isSidebarCollapsed} />
                <SidebarToolButton 
                  active={isMeasureMode} 
                  onClick={() => {
                    setIsMeasureMode(!isMeasureMode);
                    setMeasurePoints([]);
                    setSnapPreview(null);
                  }} 
                  icon={<Ruler size={18} />} 
                  label="Medir" 
                  collapsed={isSidebarCollapsed}
                  badge={measurePoints.length > 0 ? measurePoints.length.toString() : undefined}
                />
                <SidebarToolButton 
                  active={isAgentPanelOpen} 
                  onClick={() => setIsAgentPanelOpen(!isAgentPanelOpen)} 
                  icon={<Sparkles size={18} />} 
                  label="Asistente" 
                  collapsed={isSidebarCollapsed}
                />
              </div>
            </aside>
            <div className="flex-1 relative bg-[#F3F4F6] self-stretch min-h-0">
              {!isSidebarVisible && (<button onClick={() => setIsSidebarVisible(true)} className="absolute left-0 top-1/2 -translate-y-1/2 z-[50] bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-r-2xl shadow-sm text-indigo-600 hover:pr-4 transition-all group"><Menu size={18} /></button>)}
              
              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-xl z-[45] border-r border-slate-200/80 shadow-xl transition-all duration-300 ease-out transform ${isElementsPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-6">
                  <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight text-slate-900">Plan de diseño</h2><p className="text-xs font-medium text-indigo-600">Cotas editables ISO</p></div><button onClick={() => setIsElementsPanelOpen(false)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800"><X size={18} /></button></div>
                  <div className="space-y-4 flex-1 flex flex-col min-h-0"><div className="flex items-center justify-between px-1"><h3 className="text-xs font-semibold text-slate-500">Módulos en escena</h3><span className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-semibold px-2 py-0.5 rounded-full">{modules.length}</span></div><div className="flex-1 overflow-y-auto no-scrollbar space-y-2">{labeledModules.map(m => (
                    <div key={m.uniqueId} className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold text-xs">{m.label}</div>
                          <p className="text-xs font-semibold text-slate-900">{m.name}</p>
                        </div>
                        <button onClick={() => deleteModule(m.uniqueId)} className="p-2 text-slate-400 hover:text-red-500" title="Eliminar módulo"><Trash2 size={14} /></button>
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

              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-xl z-[45] border-r border-slate-200/80 shadow-xl transition-all duration-300 ease-out transform ${isAccessoriesPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-6">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-lg font-semibold tracking-tight text-slate-900">Electrodomésticos</h2><p className="text-xs font-medium text-indigo-600">Gasodomésticos y equipos de la cocina</p></div>
                    <button onClick={() => setIsAccessoriesPanelOpen(false)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800"><X size={18} /></button>
                  </div>
                  {listaElectro}
                </div>
              </div>

              <div data-side-panel className={`absolute top-0 bottom-0 left-0 w-80 bg-white/95 backdrop-blur-xl z-[45] border-r border-slate-200/80 shadow-xl transition-all duration-300 ease-out transform ${isSpecialModulesPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col p-6 overflow-y-auto no-scrollbar space-y-6">
                  <div className="flex items-center justify-between">
                    <div><h2 className="text-lg font-semibold tracking-tight text-slate-900">Módulos especiales</h2><p className="text-xs font-medium text-indigo-600">Configuración avanzada</p></div>
                    <button onClick={() => setIsSpecialModulesPanelOpen(false)} className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800"><X size={18} /></button>
                  </div>
                  {isClosetSection && (
                    <div className="space-y-3">
                      {(
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Torre de entrepaños</label>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Columna con laterales, entrepaños y divisiones; se ajusta con doble clic sobre ella</p>
                          </div>
                          <button onClick={() => setCloset(c => ({ ...c, torreOn: c.torreOn !== true }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${closet.torreOn === true ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${closet.torreOn === true ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      )}

                      {closet.torreOn === true && closetDerivedValues && (
                        <div className="p-3 bg-slate-50 rounded-2xl space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Torre de entrepaños (zapatero)</label>
                          <div className="grid grid-cols-3 gap-2">
                            {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as const).map(([val, label]) => (
                              <button key={val} onClick={() => setCloset(c => ({ ...c, torrePos: val }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${(closet.torrePos ?? 'left') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {([[false, 'Hasta el maletero'], [true, 'Hasta el techo']] as const).map(([val, label]) => (
                              <button key={label} onClick={() => setCloset(c => ({ ...c, torreToCeiling: val, torreShelves: undefined }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${(closet.torreToCeiling === true) === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                            ))}
                          </div>
                          {(() => { const side = closet.torrePos ?? 'left'; const hasCostado = (side === 'left' && !closetInput?.leftWall) || (side === 'right' && !closetInput?.rightWall); return hasCostado ? (
                            <button onClick={() => setCloset(c => ({ ...c, torreSinLateral: c.torreSinLateral !== true }))} className={`w-full py-2 rounded-xl text-[10px] font-black border-2 ${closet.torreSinLateral === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Sin lateral junto al costado</button>
                          ) : null; })()}
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              ['Ancho (mm)', closetDerivedValues.torreWidth, closetDerivedValues.suggestedCajonero, (n: number) => setCloset(c => ({ ...c, torreWidth: Math.max(300, Math.min(1200, Math.round(n))) }))],
                              ['Entrepaños por columna', closetDerivedValues.torreShelves, closetDerivedValues.suggestedTorreShelves, (n: number) => setCloset(c => ({ ...c, torreShelves: Math.max(0, Math.min(20, Math.round(n))) }))],
                              ['Divisiones', closetDerivedValues.torreDivisions, 0, (n: number) => setCloset(c => ({ ...c, torreDivisions: Math.max(0, Math.min(5, Math.round(n))) }))],
                              ['Fondo (mm)', closet.torreDepth ?? 450, 450, (n: number) => setCloset(c => ({ ...c, torreDepth: Math.max(300, Math.min(500, Math.round(n))) }))],
                            ] as Array<[string, number, number, (n: number) => void]>).map(([label, value, suggested, onCommit]) => (
                              <div key={label} className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                <DeferredNumber value={Math.round(value)} onCommit={onCommit} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400">Las divisiones tienen la altura de los laterales y la profundidad de los entrepaños.</p>
                        </div>
                      )}
                      {closet.torreOn === true && (closet.torrePos ?? 'left') !== 'center' && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Otra torre al otro extremo</label>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Segunda torre de entrepaños con sus propias medidas</p>
                          </div>
                          <button onClick={() => setCloset(c => ({ ...c, torre2On: c.torre2On !== true }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${closet.torre2On === true ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${closet.torre2On === true ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      )}
                      {closet.torreOn === true && closet.torre2On === true && (closet.torrePos ?? 'left') !== 'center' && closetDerivedT2 && (
                        <div className="p-3 bg-slate-50 rounded-2xl space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Segunda torre</label>
                          <div className="grid grid-cols-2 gap-2">
                            {([[false, 'Hasta el maletero'], [true, 'Hasta el techo']] as const).map(([val, label]) => (
                              <button key={label} onClick={() => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreToCeiling: val, torreShelves: undefined } }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${(closetTorre2Cfg.torreToCeiling === true) === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                            ))}
                          </div>
                          {(() => { const side = (closet.torrePos ?? 'left') === 'left' ? 'right' : 'left'; const hasCostado = (side === 'left' && !closetInput?.leftWall) || (side === 'right' && !closetInput?.rightWall); return hasCostado ? (
                            <button onClick={() => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreSinLateral: !(c.torre2?.torreSinLateral === true) } }))} className={`w-full py-2 rounded-xl text-[10px] font-black border-2 ${closetTorre2Cfg.torreSinLateral === true ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Sin lateral junto al costado</button>
                          ) : null; })()}
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              ['Ancho (mm)', closetDerivedT2.torreWidth, closetDerivedT2.suggestedCajonero, (n: number) => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreWidth: Math.max(300, Math.min(1200, Math.round(n))) } }))],
                              ['Entrepaños por columna', closetDerivedT2.torreShelves, closetDerivedT2.suggestedTorreShelves, (n: number) => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreShelves: Math.max(0, Math.min(20, Math.round(n))) } }))],
                              ['Divisiones', closetDerivedT2.torreDivisions, 0, (n: number) => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreDivisions: Math.max(0, Math.min(5, Math.round(n))) } }))],
                              ['Fondo (mm)', closetTorre2Cfg.torreDepth ?? 450, 450, (n: number) => setCloset(c => ({ ...c, torre2: { ...c.torre2, torreDepth: Math.max(300, Math.min(500, Math.round(n))) } }))],
                            ] as Array<[string, number, number, (n: number) => void]>).map(([label, value, suggested, onCommit]) => (
                              <div key={label} className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                <DeferredNumber value={Math.round(value)} onCommit={onCommit} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}


                    </div>
                  )}
                  <div className="space-y-4">
                    {(isClosetSection || isFitSection ? [] : ['tall-pantry', 'tall-oven'] as const).map(kind => {
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

              {(() => {
                const isl = islands.find(i => i.id === islaAbierta);
                if (!isl) return null;
                const meson = boxes.find(b => b.kind === 'counter' && b.islandId === isl.id);
                return (
                  <Modal isOpen onClose={() => { setIslaAbierta(null); aplicarMesonIsla.current = null; }} onApply={() => aplicarMesonIsla.current?.()} title={isl.kind === 'peninsula' ? 'Península' : 'Isla'}>
                    <div className="space-y-4">
                      <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">{contenidoIsla(isl)}</div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mesón de la {isl.kind === 'peninsula' ? 'península' : 'isla'}</p>
                        {meson ? (
                          <CounterEditor key={meson.id} box={meson} wall={meson.wall} settings={{ thickness: counterThickness, overhang: counterOverhang, hasSplash, splashHeight }}
                            sides={ladosDelMeson(meson, boxes, counterExtras)}
                            onApply={(st, now) => applyCounterEdit(st, meson.id, cambiosDelMeson(meson, boxes, counterExtras, now))}
                            onClose={() => {}} registrar={fn => { aplicarMesonIsla.current = fn; }} />
                        ) : (
                          <p className="text-[10px] font-bold text-slate-500">{hasCounter ? 'Aparece cuando la isla tenga módulos: usa "Modular isla / península".' : 'El mesón está apagado: actívalo en Espacio.'}</p>
                        )}
                      </div>
                    </div>
                  </Modal>
                );
              })()}
              <Modal isOpen={isWorkspaceModalOpen} onClose={() => setIsWorkspaceModalOpen(false)} onApply={() => { addIsland(); if (guiaEspacio.current) { guiaEspacio.current = false; setIsModulosModalOpen(true); } }} title="Configuración de Espacio" ancho={!isFitSection && cfg.id !== 'puertas' ? 'max-w-6xl' : 'max-w-lg'}>
                <div className={!isFitSection && cfg.id !== 'puertas' ? 'grid md:grid-cols-[1.9fr_1fr] gap-8 items-start' : ''}>
                  {!isFitSection && cfg.id !== 'puertas' && (
                    <div className="md:sticky md:top-0 space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Así queda</div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-2">
                        <MiniEspacio wallA={wallA} wallB={wallB} wallC={wallC} armB={armB} armC={armC} izq={hasLeftClosure} der={hasRightClosure}
                        appliances={appliances} modules={modules} columns={columns} islands={activeIslands} puntos={puntosAdecuacion(appliances, modules, wallA)} />
                      </div>
                    </div>
                  )}
                <div className="space-y-8">
                  <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">1</span><span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Forma y medidas</span><span className="text-[10px] font-bold text-slate-400">tipo, largo, alto y zócalo</span></div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de {cfg.singular}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['STRAIGHT', 'L_SHAPE', 'U_SHAPE'] as LayoutType[]).filter(l => cfg.layouts.includes(l)).map((l) => (
                        <button key={l} onClick={() => chooseLayout(l)} className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all gap-2 ${layout === l ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}>
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
                      <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Largo Muro A (mm)</label><MeasureSketch kind="A" layout={layout} lArm={lArm} /></div><div className="relative group"><DeferredNumber  value={wallA} onCommit={n => setWallA(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                      <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Altura Techo (mm)</label><MeasureSketch kind="height" /></div><div className="relative group"><DeferredNumber  value={spaceHeight} onCommit={n => setSpaceHeight(Math.max(1000, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                    </div>
                    
                    {(layout === 'L_SHAPE' || layout === 'U_SHAPE') && (
                      <div className={`grid ${layout === 'U_SHAPE' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 animate-in fade-in slide-in-from-top-2 duration-300`}>
                        <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{layout === 'L_SHAPE' && lArm === 'right' ? 'Largo del brazo (muro C) (mm)' : layout === 'L_SHAPE' ? 'Largo del brazo (muro B) (mm)' : 'Largo Muro B (mm)'}</label><MeasureSketch kind={layout === 'L_SHAPE' && lArm === 'right' ? 'C' : 'B'} layout={layout} lArm={lArm} /></div><div className="relative group"><DeferredNumber  value={layout === 'L_SHAPE' && lArm === 'right' ? wallC : wallB} onCommit={n => (layout === 'L_SHAPE' && lArm === 'right' ? setWallC : setWallB)(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                        {layout === 'U_SHAPE' && (
                          <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Largo Muro C (mm)</label><MeasureSketch kind="C" layout={layout} lArm={lArm} /></div><div className="relative group"><DeferredNumber  value={wallC} onCommit={n => setWallC(Math.max(500, n))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" /><div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">MM</div></div></div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isClosetSection && !isFitSection && (
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
                          <div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Altura Zócalo (mm)</label><MeasureSketch kind="zH" /></div>
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
                          <div className="flex items-center justify-between gap-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Profundidad (mm)</label><MeasureSketch kind="zD" /></div>
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
                  )}

                  {isClosetSection && closetDerivedValues && (
                    <div className="p-4 rounded-3xl border-2 border-slate-100 bg-white space-y-4">
                      <div>
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Formulario del closet</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">Los lados salen del Espacio: el lado con muro lleva marco lateral y dilatada de 15 mm; el lado sin muro lleva costado propio.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-wide">
                        {([['Izquierdo', closetInput?.leftWall], ['Derecho', closetInput?.rightWall]] as const).map(([lado, hasWall]) => (
                          <div key={lado} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600">{lado}: <span className="text-indigo-600">{hasWall ? 'con muro' : 'con costado'}</span></div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Zócalo</label>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">La base va encima del zócalo</p>
                        </div>
                        <button onClick={() => setHasZocalo(!hasZocalo)} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${hasZocalo ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${hasZocalo ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      {hasZocalo && (
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Altura del zócalo (mm)</label>
                          <DeferredNumber value={zocaloHeight} onCommit={n => setZocaloHeight(Math.max(30, Math.min(200, Math.round(n))))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Marco inferior</label>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">Acostado sobre el piso o sobre el zócalo; con zócalo y sin marco queda el tipo T</p>
                        </div>
                        <button onClick={() => setCloset(c => ({ ...c, bottomFrame: !c.bottomFrame }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${closet.bottomFrame ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${closet.bottomFrame ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Tapa de riel</label>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">Va siempre adelante del marco</p>
                        </div>
                        <button onClick={() => setCloset(c => ({ ...c, tapaRiel: !c.tapaRiel }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${closet.tapaRiel ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${closet.tapaRiel ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      {closet.tapaRiel && (
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Altura de la tapa de riel (mm)</label>
                          <DeferredNumber value={closet.tapaRielHeight} onCommit={n => setCloset(c => ({ ...c, tapaRielHeight: Math.max(30, Math.min(300, Math.round(n))) }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cantidad de cajoneros</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([[false, '1 cajonero'], [true, '2 cajoneros']] as const).map(([val, label]) => (
                            <button key={label} onClick={() => setCloset(c => ({ ...c, twoCajoneros: val, doorCount: undefined }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${(closet.twoCajoneros === true) === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                          ))}
                        </div>
                        {closet.twoCajoneros === true && closet.torreOn !== true && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {([['centro', 'Al centro (dilatada central de 6 cm)'], ['extremos', 'A los extremos']] as const).map(([val, label]) => (
                              <button key={val} onClick={() => setCloset(c => ({ ...c, twoPlacement: val, doorCount: undefined }))} className={`py-2 px-2 rounded-xl text-[10px] font-black border-2 leading-tight ${(closet.twoPlacement ?? 'centro') === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {closet.twoCajoneros !== true && (
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cajonero: dónde va</label>
                        <div className="grid grid-cols-4 gap-2">
                          {([['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']] as const).map(([val, label]) => (
                            <button key={val} onClick={() => setCloset(c => ({ ...c, cajoneroPos: val, cajoneroX: undefined }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${closet.cajoneroX == null && closet.cajoneroPos === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                          ))}
                          <button onClick={() => setCloset(c => ({ ...c, cajoneroX: Math.max(0, Math.round(((closetDerivedValues?.opening ?? 0) - (closetDerivedValues?.cajoneroWidth ?? 0)) / 2)) }))} className={`py-2 rounded-xl text-[10px] font-black border-2 ${closet.cajoneroX != null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Libre</button>
                        </div>
                        {closet.cajoneroX != null && (
                          <div className="space-y-1 pt-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Distancia desde la izquierda (mm)</label>
                            <DeferredNumber value={closet.cajoneroX} onCommit={n => setCloset(c => ({ ...c, cajoneroX: Math.max(0, Math.round(n)) }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                          </div>
                        )}
                      </div>
                      )}

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div>
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Entrepaños sobre el cajonero</label>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">Activa o desactiva la sección (costados y entrepaños)</p>
                        </div>
                        <button onClick={() => setCloset(c => ({ ...c, shelvesOn: c.shelvesOn === false }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${closet.shelvesOn !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${closet.shelvesOn !== false ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      {closet.cajoneroPos === 'left' && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Costado de los entrepaños (izquierdo)</label>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Si no lleva, los entrepaños se alargan hasta el muro o el costado de ese lado</p>
                          </div>
                          <button onClick={() => setCloset(c => ({ ...c, costadoLeft: !(c.costadoLeft !== false && c.sideCostado !== false), sideCostado: undefined }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${(closet.costadoLeft !== false && closet.sideCostado !== false) ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${(closet.costadoLeft !== false && closet.sideCostado !== false) ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      )}
                      {closet.cajoneroPos === 'right' && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Costado de los entrepaños (derecho)</label>
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">Si no lleva, los entrepaños se alargan hasta el muro o el costado de ese lado</p>
                          </div>
                          <button onClick={() => setCloset(c => ({ ...c, costadoRight: !(c.costadoRight !== false && c.sideCostado !== false), sideCostado: undefined }))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${(closet.costadoRight !== false && closet.sideCostado !== false) ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${(closet.costadoRight !== false && closet.sideCostado !== false) ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {([
                          ['Altura del cajonero (mm del piso)', closetDerivedValues.cajoneroTop, closetDerivedValues.suggestedCajoneroTop, (n: number) => setCloset(c => ({ ...c, cajoneroTop: Math.max(300, Math.min(Math.round(n), 1800)) }))],
          ['Cajones (frentes de 200 mm como máximo)', closetDerivedValues.drawerCount, closetDerivedValues.suggestedDrawers, (n: number) => setCloset(c => ({ ...c, cajonCount: Math.max(1, Math.min(6, Math.round(n))) }))],
                          ['Entrepaños (repartidos en el espacio)', closetDerivedValues.shelfCount, closetDerivedValues.suggestedShelves, (n: number) => setCloset(c => ({ ...c, shelfCount: Math.max(0, Math.min(12, Math.round(n))) }))],
          ['Puertas corredizas', closetDerivedValues.doorCount, closetDerivedValues.suggestedDoors, (n: number) => setCloset(c => ({ ...c, doorCount: Math.max(2, Math.min(6, Math.round(n))) }))],
                          ['Ancho del cajonero (mm)', closetDerivedValues.cajoneroWidth, closetDerivedValues.suggestedCajonero, (n: number) => setCloset(c => ({ ...c, cajoneroWidth: Math.max(300, Math.round(n)) }))],
                          ['Traslape de puertas (mm)', closet.overlap, 25, (n: number) => setCloset(c => ({ ...c, overlap: Math.max(0, Math.min(100, Math.round(n))) }))],
                          ['Alto de las puertas (mm)', closetDerivedValues.doorHeight, closetDerivedValues.suggestedDoorHeight, (n: number) => setCloset(c => ({ ...c, doorHeight: Math.max(500, Math.round(n)) }))],
                        ] as Array<[string, number, number, (n: number) => void]>).map(([label, value, suggested, onCommit]) => (
                          <div key={label} className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                            <DeferredNumber value={Math.round(value)} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                          </div>
                        ))}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Ancho de cada puerta</label>
                          <div className="w-full bg-slate-100 rounded-xl p-2 text-xs font-black text-slate-500">{Math.round(closetDerivedValues.doorWidth)} mm</div>
                        </div>
                      </div>

                      <div className="px-3 py-2 rounded-xl bg-slate-50 text-[9px] font-bold text-slate-500 space-y-0.5">
                        <p>Espacio libre para las puertas: {Math.round(closetDerivedValues.freeHeight)} mm (de la cara de arriba de la base a la cara de abajo del marco horizontal).</p>
                        <p>Maletero: tablero a {Math.round(closetDerivedValues.maleteroTop)} mm; primer tubo 40 mm más abajo y el segundo a 900 mm del piso.</p>
                      </div>
                      <button onClick={() => setCloset({ ...DEFAULT_CLOSET, bottomFrame: closet.bottomFrame })} className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wide">Restablecer valores</button>
                    </div>
                  )}

                  <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">2</span><span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Muros y columnas</span><span className="text-[10px] font-bold text-slate-400">paredes en los extremos y columnas atravesadas</span></div>
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

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Columnas o muros atravesados</label>
                        <p className="text-[9px] font-bold text-slate-500 mt-1">Pegados a un muro, de la altura del techo. La modulación los respeta: ahí no van módulos</p>
                      </div>
                      <button
                        onClick={() => setColumns(prev => [...prev, { id: Math.random().toString(36).substr(2, 6), wall: 'A', distance: 0, width: 300, depth: 300 }])}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wide shrink-0"
                      >+ Agregar</button>
                    </div>
                    {columns.map((c, idx) => (
                      <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black text-slate-700 uppercase">Columna {idx + 1}</p>
                          <div className="flex items-center gap-2">
                            <select value={c.wall} onChange={(e) => setColumns(prev => prev.map(x => (x.id === c.id ? { ...x, wall: e.target.value as 'A' | 'B' | 'C' } : x)))} className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-black text-slate-700 outline-none">
                              <option value="A">Muro A</option>
                              {(layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) && <option value="B">Muro B</option>}
                              {(layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) && <option value="C">Muro C</option>}
                            </select>
                            <button onClick={() => setColumns(prev => prev.filter(x => x.id !== c.id))} className="p-1 rounded-lg bg-white text-slate-400 hover:text-red-500" title="Eliminar"><X size={14} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([['distance', 'Desde la esquina'], ['width', 'Ancho'], ['depth', 'Profundidad']] as const).map(([key, label]) => (
                            <div key={key} className="space-y-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label} (mm)</label>
                              <DeferredNumber value={c[key]} onCommit={n => setColumns(prev => prev.map(x => (x.id === c.id ? { ...x, [key]: Math.max(key === 'distance' ? 0 : 50, Math.round(n)) } : x)))} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {cfg.accessories.length > 0 && <>
                  <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">3</span><span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Puntos de adecuación</span><span className="text-[10px] font-bold text-slate-400">agua, energía y gas de cada electrodoméstico</span></div>
                  {listaElectro}
                  </>}

                  {cfg.features.islands && <>
                  <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">4</span><span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Isla o península</span><span className="text-[10px] font-bold text-slate-400"></span></div>
                  </>}
                  {cfg.features.islands && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-3xl border-2 border-slate-100 bg-white space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-500"><IslandIcon size={22} /></div>
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Isla / Península</p>
                          <p className="text-[9px] font-bold text-slate-400">Medida general · isla a 1 m del punto 0 · península solo en cocina en L, pegada al muro perpendicular · zócalo 5 cm más pequeño</p>
                        </div>
                        <button
                          disabled={islands.length > 0}
                          title={islands.length > 0 ? 'Elimina primero las islas o penínsulas creadas' : undefined}
                          onClick={() => { if (islandEnabled) setIslandDraft(d => ({ ...d, kind: null })); setIslandEnabled(!islandEnabled); }}
                          className={`w-10 h-5 rounded-full transition-all relative shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${islandEnabled || islands.length > 0 ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${islandEnabled || islands.length > 0 ? 'left-5.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      {(islandEnabled || islands.length > 0) && <>
                      <div className="grid grid-cols-2 gap-2">
                        {(['isla', 'peninsula'] as const).map(k => (
                          <button key={k} disabled={k === 'peninsula' && layout !== 'L_SHAPE'} title={k === 'peninsula' && layout !== 'L_SHAPE' ? 'La península solo se crea en cocinas en L' : undefined} onClick={() => setIslandDraft({ ...islandDraft, kind: islandDraft.kind === k ? null : k })} className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border-2 disabled:opacity-40 disabled:cursor-not-allowed ${islandDraft.kind === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{k === 'isla' ? 'Isla' : 'Península'}</button>
                        ))}
                      </div>
                      {layout !== 'L_SHAPE' && <p className="text-[9px] font-bold text-amber-600 px-1">La península solo está disponible en cocinas en L: elige "En L" en el tipo de cocina.</p>}
                      {islandDraft.kind && <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Largo (mm)</label><MeasureSketch kind="iL" /></div><input type="number" value={islandDraft.length} onChange={(e) => setIslandDraft({ ...islandDraft, length: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                        <div className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Ancho (mm)</label><MeasureSketch kind="iW" /></div><input type="number" value={islandDraft.width} onChange={(e) => setIslandDraft({ ...islandDraft, width: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                      </div>
                      <div className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Barra (mm) · voladizo del mesón por el frente</label><MeasureSketch kind="iBar" /></div><input type="number" value={islandDraft.bar} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setIslandDraft({ ...islandDraft, bar: e.target.value.replace(/^0+(?=\d)/, '') })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cota X desde 0 (mm)</label><MeasureSketch kind="iX" /></div><input type="number" disabled={islandDraft.kind === 'peninsula'} value={islandDraft.kind === 'peninsula' ? '0' : islandDraft.dx} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setIslandDraft({ ...islandDraft, dx: e.target.value.replace(/^0+(?=\d)/, '') })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500 disabled:opacity-50"/></div>
                        <div className="space-y-1"><div className="flex items-center justify-between gap-1"><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cota Y desde 0 (mm)</label><MeasureSketch kind="iY" /></div><input type="number" value={islandDraft.dy} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setIslandDraft({ ...islandDraft, dy: e.target.value.replace(/^0+(?=\d)/, '') })} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"/></div>
                      </div>
                      <IslandApplianceFields
                        stove={islandDraft.stove ?? undefined}
                        sink={islandDraft.sink ?? undefined}
                        onToggle={(k, on) => setIslandDraft(d => ({ ...d, [k]: on ? { distance: k === 'stove' ? '0' : '900' } : null }))}
                        onDistance={(k, v) => setIslandDraft(d => ({ ...d, [k]: { distance: v } }))}
                      />
                      </>}

                      {islands.map(isl => (
                        <div key={isl.id} className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
                          {contenidoIsla(isl)}
                        </div>
                      ))}
                      </>}
                    </div>
                  </div>
                  )}
                </div>
              </div>
              </Modal>
              <Modal isOpen={isModulosModalOpen} onClose={() => { setIsModulosModalOpen(false); setFocoEsquema(null); }} title="Configuración de Módulos" ancho={cfg.id === 'cocinas' ? 'max-w-4xl' : 'max-w-lg'}>
                <div className={cfg.id === 'cocinas' ? 'grid md:grid-cols-[250px_1fr] gap-8 items-start' : ''}>
                {cfg.id === 'cocinas' && (
                  <div className="md:sticky md:top-0 space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Así queda</div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-2">
                      <EsquemaModulos aereoAbre={acabados.aereoAbre} gola={acabados.gola} zocaloAluminio={acabados.herrajes.zocaloAluminio}
                        colorEst={hexDe(acabados.MB.est.color)} colorFach={hexDe(acabados.MB.fach.color || acabados.MB.est.color)}
                        colorEstPuente={hexDe(nivelPU.est.color)} colorFachPuente={hexDe(nivelPU.fach.color || acabados.MA.fach.color || acabados.MA.est.color)} colorEstAereo={hexDe(acabados.MA.est.color)} colorFachAereo={hexDe(acabados.MA.fach.color || acabados.MB.fach.color || acabados.MA.est.color)} foco={focoEsquema} puente={puenteAlto > 0} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">{focoEsquema === 'aereo' ? (acabados.aereoAbre === 'pestana' ? 'Pestaña inferior: el borde de abajo de la puerta sobresale para agarrarla.' : 'Al ras: la puerta queda pareja con el mueble y abre con tirador.')
                      : focoEsquema === 'gola' ? (acabados.gola === 'aluminio' ? 'Gola en perfil de aluminio sobre el frente del mueble base.' : 'Gola en melamina: puente en L en la parte de arriba del mueble base.')
                      : focoEsquema === 'zocalo' ? (acabados.herrajes.zocaloAluminio ? 'Zócalo en aluminio: cada mueble base lleva 4 patas de plástico.' : 'Zócalo corrido en melamina.')
                      : focoEsquema === 'herrajes' ? 'Los herrajes marcados van dentro de los muebles base.' : focoEsquema === 'puente' ? 'Diseño en puente: un módulo más alto y más profundo encima de cada aéreo.' : focoEsquema === 'cajon' ? 'Corte del cajón: así queda la corredera.' : 'Toca una opción y se marca aquí lo que cambia.'}</div>
                  </div>
                )}
                <div className="space-y-8">
                  {/* Sistema, herrajes, alturas y puente primero; los colores van justo antes del mesón */}
                {cfg.id === 'cocinas' && (
                  <div className="space-y-4">
                    {cfg.hasUpper && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-black text-slate-700 px-1">Muebles aéreos: ¿cómo abre la puerta?</div>
                        <div className="grid grid-cols-2 gap-2">
                          {([['pestana', 'Con pestaña inferior'], ['alras', 'Al ras del mueble']] as const).map(([v, t]) => (
                            <button key={v} type="button" onClick={() => { setAcabados(a => ({ ...a, aereoAbre: v })); setFocoEsquema('aereo'); }} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${acabados.aereoAbre === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-[11px] font-black text-slate-700 px-1">Muebles base: ¿la gola va en aluminio o en melamina?</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([['melamina', 'En melamina (puente en L)'], ['aluminio', 'En aluminio (perfil)']] as const).map(([v, t]) => (
                          <button key={v} type="button" onClick={() => { setAcabados(a => ({ ...a, gola: v })); setFocoEsquema('gola'); }} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${acabados.gola === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    {acabados.gola === 'melamina' && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-black text-slate-700 px-1">Gola en melamina: ¿corrida entre módulos, sin cortes al instalar?</div>
                        <div className="grid grid-cols-2 gap-2">
                          {([[true, 'Sí, corrida'], [false, 'No, una por módulo']] as const).map(([v, t]) => (
                            <button key={String(v)} type="button" onClick={() => { setAcabados(a => ({ ...a, golaCorrida: v })); setFocoEsquema('gola'); }} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${acabados.golaCorrida === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                          ))}
                        </div>
                        {acabados.golaCorrida && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 px-1">El puente en L (65 + 15 = 80 mm) pasa de un módulo a otro y los costados internos bajan 80 mm. Si supera la lámina, se corta en el costado de un módulo y sigue otro puente.</div>
                            <div className="grid grid-cols-2 gap-2">
                              {([2400, 2800] as const).map(v => (
                                <button key={v} type="button" onClick={() => setAcabados(a => ({ ...a, laminaLargo: v }))} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${acabados.laminaLargo === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>Lámina de {v} mm</button>
                              ))}
                            </div>
                            {(() => {
                              const tr = boxes.filter(b => /^panel-lower-corrido-.*-0$/.test(b.id)).map(b => Math.round(Math.max(b.sx, b.sy)));
                              return tr.length > 0 ? <div className="text-[10px] font-black text-indigo-700 px-1">Puentes corridos: {tr.map(n => `${n} mm`).join(' · ')}</div> : <div className="text-[10px] font-bold text-slate-400 px-1">Se arman al convertir a módulos, cuando hay bajos pegados.</div>;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-[11px] font-black text-slate-700 px-1">Cajones: ¿correderas full extensión o riel oculto (montaje bajo)?</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([['full', 'Full extensión'], ['oculta', 'Riel oculto']] as const).map(([v, t]) => (
                          <button key={v} type="button" onClick={() => { setCorredera(c => ({ ...c, tipo: v })); setFocoEsquema('cajon'); }} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${corredera.tipo === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                        ))}
                      </div>
                      {corredera.tipo === 'oculta' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {([['menos10', 'Descontar 10 mm al largo'], ['fondo15', 'Fondo de 15']] as const).map(([k, t]) => (
                            <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-[10px] font-black ${corredera[k] ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                              <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={!!corredera[k]} onChange={e => { const v = e.target.checked; setCorredera(c => ({ ...c, [k]: v })); }} />{t}
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-1 max-w-[260px] mx-auto"><EsquemaCorredera tipo={corredera.tipo} colorEst={hexDe(acabados.MB.est.color)} colorFach={hexDe(acabados.MB.fach.color || acabados.MB.est.color)} /></div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-black text-slate-700 px-1">Herrajería de la cocina</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([['platillero', 'Platillero'], ['condimentero', 'Condimentero'], ['basurera', 'Basurera'], ['esquinaMagica', 'Esquina mágica'], ['zocaloAluminio', 'Zócalo en aluminio']] as const).map(([k, t]) => (
                          <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-[11px] font-black ${acabados.herrajes[k] ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'} ${k === 'zocaloAluminio' ? 'col-span-2' : ''}`}>
                            <input type="checkbox" className="accent-indigo-600 w-4 h-4" checked={acabados.herrajes[k]}
                              onChange={e => { const v = e.target.checked; setAcabados(a => ({ ...a, herrajes: { ...a.herrajes, [k]: v } })); setFocoEsquema(k === 'zocaloAluminio' ? 'zocalo' : 'herrajes'); }} />
                            <span>{t}{k === 'zocaloAluminio' && <span className="block text-[9px] font-bold text-slate-400 normal-case">Cada mueble base lleva {PATAS_POR_MUEBLE} patas de plástico</span>}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}


                  {cfg.id === 'cocinas' && cfg.hasUpper && (() => {
                    const zoc = hasZocalo ? zocaloHeight : 0, mes = hasCounter ? counterThickness : 0;
                    const campo = (id: Exclude<TramoAltura, null>, t: string, v: number, onC: (n: number) => void, nota?: string) => (
                      <div key={id} onFocusCapture={() => setTramoLateral(id)} className="space-y-0.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t} (mm)</label>
                        <DeferredNumber value={v} onCommit={onC} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                        {nota && <div className="text-[9px] font-bold text-slate-400 px-1">{nota}</div>}
                      </div>
                    );
                    const resto = spaceHeight - zoc - currentBaseModuleHeight - mes - TOP_MARGIN; // para hueco + aéreo
                    return (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alturas de los muebles · vista lateral</label>
                        <div className="grid grid-cols-[210px_1fr] gap-4 items-start">
                          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-1">
                            <VistaLateral techo={spaceHeight} zocalo={zoc} base={currentBaseModuleHeight} meson={mes} hueco={currentUpperGap} aereo={currentUpperModuleHeight - puenteAlto} margen={TOP_MARGIN} fondoBase={LOWER_DEPTH} fondoAereo={UPPER_DEPTH} resaltado={tramoLateral} puente={puenteAlto ? { alto: puente.alto, fondo: puente.fondo } : undefined} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {campo('base', 'Mueble base', currentBaseModuleHeight, n => setAlturaBase(Math.max(300, Math.min(1200, Math.round(n)))), 'Sin zócalo ni mesón')}
                            {campo('hueco', 'Hueco al aéreo', currentUpperGap, n => setHuecoAereo(Math.max(0, Math.min(resto - 200, Math.round(n)))), 'Desde la cara del mesón')}
                            {campo('aereo', 'Alto del aéreo', currentUpperModuleHeight - puenteAlto, n => setHuecoAereo(Math.max(0, Math.min(resto - 200, resto - puenteAlto - Math.max(200, Math.round(n))))), puenteAlto ? 'Debajo del módulo en puente' : 'Cuelga del techo')}
                            <div className="text-[10px] font-bold text-slate-500 self-center px-1">Zócalo {zoc} y mesón {mes} se editan en Espacio y arriba. Techo {spaceHeight}.</div>
                          </div>
                        </div>
                        {(alturaBase !== null || huecoAereo !== null) && <button type="button" onClick={() => { setAlturaBase(null); setHuecoAereo(null); }} className="text-[10px] font-black text-indigo-600 uppercase px-1">Volver a las alturas de siempre ({cfg.baseModuleHeight} y {cfg.upperGap})</button>}
                      </div>
                    );
                  })()}

                  {cfg.id === 'cocinas' && cfg.hasUpper && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Diseño en puente</label>
                      {layout !== 'STRAIGHT' ? (
                        <div className="p-3 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-500">El diseño en puente se pide en cocinas rectas. Cambia la forma en Espacio para usarlo.</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-[11px] font-black text-slate-700 px-1">¿Lleva doble módulo superior, un módulo más alto y más profundo sobre el aéreo?</div>
                          <div className="grid grid-cols-2 gap-2">
                            {([[true, 'Sí, con doble módulo'], [false, 'No']] as const).map(([v, t]) => (
                              <button key={String(v)} type="button" onClick={() => { setPuente(p => ({ ...p, on: v })); setFocoEsquema(v ? 'puente' : null); setTramoLateral(v ? 'puente' : null); }} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${puente.on === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                            ))}
                          </div>
                          {puente.on && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-0.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Alto del módulo de arriba (mm)</label>
                                <DeferredNumber value={puente.alto} onCommit={n => setPuente(p => ({ ...p, alto: Math.max(200, Math.min(900, Math.round(n))) }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Fondo (mm)</label>
                                <DeferredNumber value={puente.fondo} onCommit={n => setPuente(p => ({ ...p, fondo: Math.max(250, Math.min(700, Math.round(n))) }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                              <div className="col-span-2 text-[10px] font-bold text-slate-400 px-1">Cada aéreo lleva encima su módulo de {puente.alto} mm; el aéreo se acorta lo mismo y la altura total no cambia. La campana y el módulo sobre la nevera quedan como están.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Colores: estructura por tipo de mueble (aéreo, base y, si hay puente, el módulo de arriba), fachada y fondos */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Colores</label>
                  <div className={`grid ${cfg.hasUpper ? 'grid-cols-2 divide-x divide-slate-300' : 'grid-cols-1'}`}>
                    {((cfg.hasUpper ? ['MA', 'MB'] : ['MB']) as ('MA' | 'MB')[]).map(n => (
                      <div key={n} className={`space-y-4 min-w-0 ${cfg.hasUpper ? (n === 'MA' ? 'pr-4' : 'pl-4') : ''}`}>
                        <div className="text-xs font-semibold text-indigo-600 pb-1 border-b border-indigo-100">{cfg.id === 'cocinas' ? (n === 'MA' ? 'Muebles altos' : 'Muebles bajos') : (n === 'MA' ? cfg.upperName : cfg.lowerName)}</div>
                        {([['est', 'Estructura', CALIBRES.estructura, true], ['fach', 'Fachada', CALIBRES.fachada, true], ['fondo', 'Espaldares y fondos', CALIBRES.fondo, false]] as const).map(([k, t, cals, canto]) => (
                          <CampoColor key={k} label={t} value={acabados[n][k].color} onChange={v => setTablero(n, k, { color: v })}
                            calibres={cals as unknown as number[]} cal={acabados[n][k].cal} onCal={c => setTablero(n, k, { cal: c })}
                            rh={acabados[n][k].rh} onRh={v => setTablero(n, k, { rh: v })}
                            {...(canto ? { rigido: acabados[n][k].rigido, onRigido: (v: boolean) => setTablero(n, k, { rigido: v }) } : {})} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {(['MA', 'MB'] as const).some(n => esBlanco(acabados[n].est.color) && !esBlanco(acabados[n].fach.color)) && (
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                      <div className="text-[11px] font-black text-slate-700">La estructura es blanca y la fachada es de color. ¿El canto del frente va del color de la fachada?</div>
                      <div className="grid grid-cols-2 gap-2">
                        {([[true, 'Sí, del color de la fachada'], [false, 'No, todo blanco']] as const).map(([v, t]) => (
                          <button key={String(v)} type="button" onClick={() => setAcabados(a => ({ ...a, cantoFachada: v }))} className={`py-2 rounded-xl text-[10px] font-black uppercase border-2 ${acabados.cantoFachada === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>{t}</button>
                        ))}
                      </div>
                      {acabados.cantoFachada && <div className="text-[10px] font-bold text-slate-400">Laterales y entrepaños: 1L del color de la fachada y 2A blanco. Bases y tapas: 1L del color de la fachada.</div>}
                    </div>
                  )}
                    {cfg.id === 'cocinas' && ([['PU', 'Módulo en puente (el de arriba)', puenteAlto > 0, nivelPU, acabados.MA.fach.color], ['AL', 'Alacena alta', alacenaOn, nivelAL, acabados.MB.fach.color], ['TH', 'Torre de hornos', torreOn, nivelTH, acabados.MB.fach.color]] as const).filter(x => x[2]).map(([n, t, , nv, fb]) => (
                      <div key={n} className="space-y-3" onFocusCapture={() => n === 'PU' && setFocoEsquema('puente')} onMouseEnter={() => n === 'PU' && setFocoEsquema('puente')}>
                        <div className="text-[11px] font-black text-indigo-700 uppercase pb-1 border-b border-indigo-100">{t}</div>
                        <div className="grid grid-cols-2 gap-4">
                          {([['est', 'Estructura', CALIBRES.estructura, true], ['fach', 'Fachada', CALIBRES.fachada, true], ['fondo', 'Espaldares y fondos', CALIBRES.fondo, false]] as const).map(([k, tt, cals, canto]) => (
                            <CampoColor key={k} label={tt} value={k === 'fach' ? (nv.fach.color || fb) : nv[k].color} onChange={v => setTablero(n, k, { color: v })}
                              calibres={cals as unknown as number[]} cal={nv[k].cal} onCal={c => setTablero(n, k, { cal: c })}
                              rh={nv[k].rh} onRh={v => setTablero(n, k, { rh: v })}
                              {...(canto ? { rigido: nv[k].rigido, onRigido: (v: boolean) => setTablero(n, k, { rigido: v }) } : {})} />
                          ))}
                        </div>
                      </div>
                    ))}
                  <div className="text-[10px] font-bold text-slate-400">En el diseño se ven tonos parecidos; el color real se ve en el render.</div>
                  </div>

                  {cfg.features.counter && (
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
                  )}

                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dilatación</label>
                    <p className="text-[9px] font-bold text-slate-500 mt-1">Se pide por módulo: doble clic sobre el módulo, sección "Dilatada" (lado, espesor, fondo y altura)</p>
                  </div>
                </div>
                </div>
              </Modal>

              {/* Las 4 vistas (planta, frontal, isométrica y 3D) son cámaras de la misma escena 3D */}
              {(
                <KitchenViewer3D
                  puntos={puntosAdecuacion(appliances, modules, wallA)}
                  colores={{ cantoFachada: acabados.cantoFachada, al: hexDe(nivelAL.est.color, '#f4f4f1'), fachadaAL: hexDe(nivelAL.fach.color || acabados.MB.fach.color), fondoAL: hexDe(nivelAL.fondo.color, '#e5e7eb'), th: hexDe(nivelTH.est.color, '#f4f4f1'), fachadaTH: hexDe(nivelTH.fach.color || acabados.MB.fach.color), fondoTH: hexDe(nivelTH.fondo.color, '#e5e7eb'), puentes: modules.filter(m => m.esPuente).map(m => m.uniqueId), pu: hexDe(nivelPU.est.color, '#f4f4f1'), fachadaPU: hexDe(nivelPU.fach.color || acabados.MA.fach.color), fondoPU: hexDe(nivelPU.fondo.color, '#e5e7eb'), fachada: hexDe(acabados.MB.fach.color), fachadaMA: hexDe(acabados.MA.fach.color), ma: hexDe(acabados.MA.est.color, '#f4f4f1'), mb: hexDe(acabados.MB.est.color, '#f4f4f1'), otros: hexDe(acabados.MB.est.color, '#f4f4f1'), fondo: hexDe(acabados.MB.fondo.color, '#e5e7eb'), fondoMA: hexDe(acabados.MA.fondo.color, '#e5e7eb') }}
                  wallThickMm={cfg.id === 'puertas' ? puerta.espesor : undefined}
                  puertaApi={cfg.id === 'puertas' ? { cfg: puerta, onChange: setPuerta, onOpenForm: () => setPuertaHidden(false) } : undefined}
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
                  onAbrirIsla={setIslaAbierta}
                  fitApi={isFitSection && fitInput ? { fit: fitInput, onChange: setFit } : undefined}
                  closetForm={isClosetSection && closetDerivedValues ? {
                    config: closet.twoCajoneros ? { ...closet, cajoneroPos: closet.twoPlacement === 'extremos' ? 'left' : 'center' } : closet,
                    config2: closet.twoCajoneros ? { ...closet, ...closet.cajonero2, cajoneroPos: closetPos2 } : undefined,
                    derived2: closetDerived2 ?? undefined,
                    onChange2: (patch) => setCloset(c => ({ ...c, cajonero2: { ...c.cajonero2, ...patch } })),
                    torre2Config: closet.torre2On ? closetTorre2Cfg : undefined,
                    torre2Derived: closetDerivedT2 ?? undefined,
                    onTorre2: (patch) => setCloset(c => ({ ...c, torre2: { ...c.torre2, ...patch } })),
                    onRemoveTorre2: () => setCloset(c => ({ ...c, torre2On: false })),
                    derived: closetDerivedValues,
                    hasZocalo,
                    zocaloHeight,
                    leftWall: !!closetInput?.leftWall,
                    rightWall: !!closetInput?.rightWall,
                    layout, lArm,
                    onLayout: (l) => setLayout(l),
                    onLArm: (side) => setLArm(side),
                    onChange: (patch) => setCloset(c => ({ ...c, ...patch })),
                    onZocalo: (patch) => { if (patch.hasZocalo !== undefined) setHasZocalo(patch.hasZocalo); if (patch.zocaloHeight !== undefined) setZocaloHeight(patch.zocaloHeight); },
                  } : undefined}
                  onEditWall={(wall, v) => (wall === 'A' ? setWallA : wall === 'B' ? setWallB : setWallC)(Math.max(500, Math.round(v)))}
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
                  counterExtras={counterExtras}
                  onSetModuleVistos={setModuleVistos}
                  onSetModuleFronts={setModuleFronts}
                  onSplitHorizontal={splitModuleHorizontal}
                  onSplitDepth={splitModuleDepthwise}
                  onExtendFace={extendModuleFace}
                  onJoinCorner={joinCornerModules}
                  onMergeModules={mergeModules}
                  onSplitCorner={splitCornerModule}
                  onEditCornerArm={editCornerArmWidth}
                  onDragModule={handleDragModule3D}
                  onResizeEdge={handleResizeEdge3D}
                  onMoveAppliance={moveAppliance}
                  visibility={visibility}
                  modoAbrir={modoAbrir}
                  verCorte={verCorte}
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
              
              {cfg.id === 'puertas' && puertaHidden && (
                <button onClick={() => setPuertaHidden(false)} className="absolute right-4 bottom-4 z-30 pointer-events-auto px-3 py-2 rounded-xl bg-white/95 shadow-xl border border-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-tight">Puerta</button>
              )}
              {cfg.id === 'puertas' && !puertaHidden && (() => {
                const P = puerta, up = (patch: Partial<PuertaCfg>) => setPuerta(p => ({ ...p, ...patch }));
                const num = (label: string, v: number, f: (n: number) => void) => (
                  <label className="block"><span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                    <DeferredNumber value={v} onCommit={n => f(Math.round(n))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" /></label>
                );
                const two = (label: string, val: boolean, a: [string, string], f: (b: boolean) => void) => (
                  <div><span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                    <div className="grid grid-cols-2 gap-1.5">{[true, false].map(b => (
                      <button key={String(b)} onClick={() => f(b)} className={`py-1.5 rounded-lg text-[11px] font-black border-2 ${val === b ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>{b ? a[0] : a[1]}</button>
                    ))}</div></div>
                );
                return (
                  <div {...fitDrag.handle} className="absolute right-4 bottom-4 z-30 pointer-events-auto w-72 max-h-[80%] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3" style={{ ...fitDrag.handle.style, ...fitDrag.style }}>
                    <div className="flex items-center justify-between">
                      <span className="flex-1 text-[11px] font-black text-slate-800 uppercase tracking-tight select-none" title="Arrastra para mover la tarjeta">⠿ Puerta</span>
                      <button onClick={() => setPuertaHidden(true)} className="p-1 text-slate-400 hover:text-red-500" title="Ocultar la tarjeta"><X size={16} /></button>
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase">Vano</div>
                    <div className="grid grid-cols-3 gap-2">
                      {num('Alto', P.alto, n => up({ alto: Math.max(1000, Math.min(3000, n)) }))}
                      {num('Ancho', P.ancho, n => up({ ancho: Math.max(400, Math.min(2000, n)) }))}
                      {num('Espesor muro', P.espesor, n => up({ espesor: Math.max(60, Math.min(400, n)) }))}
                    </div>
                    {two('Hoja', P.tipo === 'maciza', ['Maciza', 'Entamborada'], b => up({ tipo: b ? 'maciza' : 'entamborada' }))}
                    {two('Marcos dilatados', P.dilatados, ['Sí', 'No'], b => up({ dilatados: b }))}
                    {P.dilatados ? two('Cabezal', P.cabezal, ['Sí', 'No'], b => up({ cabezal: b })) : (
                      <div className="text-[10px] font-bold text-slate-500">Sin marcos dilatados: siempre con cabezal; el marco queda a 5 mm del muro por lado.</div>
                    )}
                    {two('Tapaluz', conTapaluz(P), ['Sí', 'No'], b => up({ tapaluz: b }))}
                    {conTapaluz(P) && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {num('Ancho tapaluz', P.tapaluzAncho ?? 40, n => up({ tapaluzAncho: Math.max(10, Math.min(200, n)) }))}
                          {num('Espesor tapaluz', P.tapaluzEsp ?? 15, n => up({ tapaluzEsp: Math.max(3, Math.min(30, n)) }))}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">{[15, 6, 3].map(t => (
                          <button key={t} onClick={() => up({ tapaluzEsp: t })} className={`py-1 rounded-lg text-[10px] font-black border-2 ${(P.tapaluzEsp ?? 15) === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>{t} mm</button>
                        ))}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {num('Cantidad', P.cantidad, n => up({ cantidad: Math.max(1, Math.min(50, n)) }))}
                      {num('Esp. hoja', P.hojaEsp, n => up({ hojaEsp: Math.max(15, Math.min(60, n)) }))}
                      {P.tipo === 'entamborada' && num('Travesaños', P.travesanos, n => up({ travesanos: Math.max(2, Math.min(12, n)) }))}
                    </div>
                    <button onClick={() => setPuertaHidden(true)} className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-wide">Aplicar</button>
                  </div>
                );
              })()}
              {isFitSection && fitHidden && (
                <button onClick={() => setFitHidden(false)} className="absolute right-4 bottom-4 z-30 pointer-events-auto px-3 py-2 rounded-xl bg-white/95 shadow-xl border border-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-tight">{isBano ? 'Mueble de baño · cuerpos' : cfg.id === 'tv' ? 'Centro de entretenimiento · cuerpos' : 'Closet fit · cuerpos'}</button>
              )}
              {isFitSection && !fitHidden && (
                <div {...fitDrag.handle} className="absolute right-4 bottom-4 z-30 pointer-events-auto w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3" style={{ ...fitDrag.handle.style, ...fitDrag.style }}>
                  <div className="flex items-center justify-between">
                    <span className="flex-1 text-[11px] font-black text-slate-800 uppercase tracking-tight select-none" title="Arrastra para mover la tarjeta">⠿ {isBano ? 'Mueble de baño · cuerpos' : cfg.id === 'tv' ? 'Centro de entretenimiento · cuerpos' : 'Closet fit · cuerpos'}</span>
                    <button onClick={() => setFitHidden(true)} className="p-1 text-slate-400 hover:text-red-500" title="Ocultar la tarjeta"><X size={16} /></button>
                  </div>
                  {(() => {
                    // muros con cubo: A siempre; B y C según la forma del espacio (L o U)
                    const hasB = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left'), hasC = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right');
                    const walls = (['A', ...(hasB ? ['B'] : []), ...(hasC ? ['C'] : [])] as Array<'A' | 'B' | 'C'>);
                    const sel = walls.includes(fitWall) ? fitWall : 'A';
                    const cubesOn = { A: true, B: true, C: true, ...(fit.cubes ?? {}) };
                    const cur: ClosetFit = sel === 'A' ? fit : { ...DEFAULT_ARM, ...((sel === 'B' ? fit.armB : fit.armC) ?? {}) };
                    const fixZ = (o: ClosetFit): ClosetFit => (o.zocalo && o.zocalo.fondo > o.depth - 30 ? { ...o, zocalo: { ...o.zocalo, fondo: Math.max(60, o.depth - 30) } } : o); // el zócalo siempre menos profundo que el fondo
                    const patchCur = (p: Partial<ClosetFit>) => setFit(f => sel === 'A' ? fixZ({ ...f, ...p }) : sel === 'B' ? { ...f, armB: fixZ({ ...DEFAULT_ARM, ...(f.armB ?? {}), ...p }) } : { ...f, armC: fixZ({ ...DEFAULT_ARM, ...(f.armC ?? {}), ...p }) });
                    const armLen = sel === 'A' ? wallA : (sel === 'B' ? wallB : wallC) - (cubesOn.A ? Math.max(200, fit.depth) : 0);
                    const rowsOf = fitRows(sel === 'A' ? (fitInput ?? fit) : { ...cur, leftWall: false, rightWall: false }, armLen);
                    return (
                      <>
                        {walls.length > 1 && (
                          <div className="flex gap-1">
                            {walls.map(k => (
                              <div key={k} className={`flex-1 flex items-center justify-between gap-1 px-1.5 py-1 rounded-full border text-[10px] font-black uppercase ${sel === k ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300'}`}>
                                <button type="button" className="flex-1 text-left pl-1" onClick={() => setFitWall(k)}>Muro {k}</button>
                                <button type="button" title={cubesOn[k] ? 'Cubos activados: clic para desactivarlos' : 'Cubos desactivados: clic para activarlos'} onClick={() => setFit(f => ({ ...f, cubes: { ...(f.cubes ?? {}), [k]: !cubesOn[k] } }))} className={`flex items-center w-7 h-4 rounded-full p-0.5 ${cubesOn[k] ? (sel === k ? 'bg-white/40' : 'bg-indigo-500') + ' justify-end' : 'bg-slate-300 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ['Fondo (mm)', cur.depth, (n: number) => patchCur({ depth: Math.max(200, Math.min(900, Math.round(n))) })],
                            ['Cuerpos inferiores', cur.lowerBodies, (n: number) => patchCur({ lowerBodies: Math.max(1, Math.min(10, Math.round(n))), lowerW: undefined, lowerCells: undefined, cellW: undefined, cellD: undefined, subs: undefined, gaps: undefined, cellX: undefined })],
                            ['Cuerpos superiores', cur.upperBodies, (n: number) => patchCur({ upperBodies: Math.max(0, Math.min(10, Math.round(n))), upperW: undefined, upperCells: undefined, cellW: undefined, cellD: undefined, subs: undefined, gaps: undefined, cellX: undefined })],
                            ['Alto superior (mm)', cur.upperHeight, (n: number) => patchCur({ upperHeight: Math.max(100, Math.min(1200, Math.round(n))), upperCells: undefined })],
                          ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                            <div key={label} className="space-y-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                              <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                            </div>
                          ))}
                        </div>
                        {cfg.id === 'tv' && sel === 'A' && (() => {
                          // televisor de ambientación: se pide por pulgadas (16:9) o por ancho y alto; desde = altura de su borde de abajo
                          const T = fit.tv ?? { on: false, pulgadas: 55, ancho: 1218, alto: 685, desde: 700 };
                          const setT = (p: Partial<typeof T>) => setFit(f => ({ ...f, tv: { ...(f.tv ?? T), ...p } }));
                          const porPulgadas = (inch: number) => { const d = inch * 25.4; return { pulgadas: inch, ancho: Math.round(d * 0.8716), alto: Math.round(d * 0.4903) }; };
                          return (
                            <>
                              <button type="button" onClick={() => setT({ on: !T.on })} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${T.on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                <span>Televisor</span>
                                <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${T.on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                              </button>
                              {T.on && (
                                <div className="grid grid-cols-2 gap-2">
                                  {([
                                    ['Pulgadas', T.pulgadas, (n: number) => setT(porPulgadas(Math.max(20, Math.min(110, Math.round(n)))))],
                                    ['Desde el piso (mm)', T.desde, (n: number) => setT({ desde: Math.max(0, Math.min(2500, Math.round(n))) })],
                                    ['Ancho (mm)', T.ancho, (n: number) => setT({ ancho: Math.max(200, Math.min(3000, Math.round(n))) })],
                                    ['Alto (mm)', T.alto, (n: number) => setT({ alto: Math.max(100, Math.min(2000, Math.round(n))) })],
                                  ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                                    <div key={label} className="space-y-1">
                                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                      <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {isBano && sel === 'A' && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Alto del mueble (mm)</label>
                              <DeferredNumber value={fit.altoMueble ?? 600} onCommit={(n) => setFit(f => ({ ...f, altoMueble: Math.max(150, Math.min(1500, Math.round(n))), lowerCells: undefined, cellW: undefined, cellD: undefined, subs: undefined, gaps: undefined, cellX: undefined }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Cuerpos sobre el mueble</label>
                              <DeferredNumber value={fit.sobreMueble ?? 0} onCommit={(n) => setFit(f => ({ ...f, sobreMueble: Math.max(0, Math.min(8, Math.round(n))), lowerCells: undefined, cellW: undefined, cellD: undefined, subs: undefined, gaps: undefined, cellX: undefined }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {([
                                ['Mueble desde el 0 (mm)', fit.mueble?.x0 ?? 0, (n: number) => setFit(f => ({ ...f, mueble: { ancho: wallA, ...(f.mueble ?? {}), x0: Math.max(0, Math.min(wallA - 200, Math.round(n))) } }))],
                                ['Ancho del mueble (mm)', fit.mueble?.ancho ?? wallA, (n: number) => setFit(f => ({ ...f, mueble: { x0: 0, ...(f.mueble ?? {}), ancho: Math.max(200, Math.min(wallA, Math.round(n))) } }))],
                              ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                                <div key={label} className="space-y-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                  <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => setFit(f => ({ ...f, flotado: { alto: 250, ...(f.flotado ?? {}), on: !f.flotado?.on } }))} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${fit.flotado?.on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                              <span>Flotado</span>
                              <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${fit.flotado?.on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                            </button>
                            {fit.flotado?.on && (
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Espacio del mueble al piso (mm)</label>
                                <DeferredNumber value={fit.flotado.alto} onCommit={(n) => setFit(f => ({ ...f, flotado: { ...(f.flotado ?? { on: true, alto: 250 }), on: true, alto: Math.max(0, Math.min(1200, Math.round(n))) } }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                            )}
                            <button type="button" onClick={() => setFit(f => ({ ...f, sanitario: { x0: 1000, ancho: 380, ...(f.sanitario ?? {}), on: !f.sanitario?.on } }))} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${fit.sanitario?.on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                              <span>Sanitario</span>
                              <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${fit.sanitario?.on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                            </button>
                            {fit.sanitario?.on && <p className="text-[9px] font-bold text-slate-500 px-1">{layout === 'STRAIGHT' ? 'Se mide desde el extremo izquierdo del muro hasta el lado del sanitario.' : 'Se mide desde el muro auxiliar hasta el lado del sanitario que lo mira.'}</p>}
                            {fit.sanitario?.on && (
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  ...(true ? ([['Distancia al muro (mm)', fit.sanitario.x0, (n: number) => setFit(f => ({ ...f, sanitario: { ...(f.sanitario ?? { on: true, x0: 1000, ancho: 380 }), on: true, x0: Math.max(0, Math.min(wallA, Math.round(n))) } }))]]) as Array<[string, number, (n: number) => void]> : []),
                                  ['Ancho (mm)', fit.sanitario.ancho, (n: number) => setFit(f => ({ ...f, sanitario: { ...(f.sanitario ?? { on: true, x0: 1000, ancho: 380 }), on: true, ancho: Math.max(200, Math.min(900, Math.round(n))) } }))],
                                ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                                  <div key={label} className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                    <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                                  </div>
                                ))}
                              </div>
                            )}
                            <button type="button" onClick={() => setFit(f => ({ ...f, espejo: { alto: 800, ancho: 700, desde: 1100, ...(f.espejo ?? {}), on: !f.espejo?.on } }))} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${fit.espejo?.on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                              <span>Espejo</span>
                              <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${fit.espejo?.on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                            </button>
                            {fit.espejo?.on && (
                              <div className="grid grid-cols-3 gap-2">
                                {([
                                  ['Alto (mm)', fit.espejo.alto, (n: number) => setFit(f => ({ ...f, espejo: { ...(f.espejo ?? { on: true, alto: 800, ancho: 700, desde: 1100 }), on: true, alto: Math.max(100, Math.min(2000, Math.round(n))) } }))],
                                  ['Ancho (mm)', fit.espejo.ancho, (n: number) => setFit(f => ({ ...f, espejo: { ...(f.espejo ?? { on: true, alto: 800, ancho: 700, desde: 1100 }), on: true, ancho: Math.max(100, Math.min(3000, Math.round(n))) } }))],
                                  ['Desde el piso (mm)', fit.espejo.desde, (n: number) => setFit(f => ({ ...f, espejo: { ...(f.espejo ?? { on: true, alto: 800, ancho: 700, desde: 1100 }), on: true, desde: Math.max(0, Math.min(2000, Math.round(n))) } }))],
                                ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                                  <div key={label} className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                    <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {/* Zócalo del cubo: subensamble en forma de escalera (largueros delante y detrás con travesaños) */}
                        {!(isBano && fit.flotado?.on) && <button type="button" onClick={() => patchCur({ zocalo: cur.zocalo?.on ? { ...cur.zocalo, on: false } : { alto: 80, fondo: Math.max(60, cur.depth - 100), travesanos: 3, ...(cur.zocalo ?? {}), on: true } })} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${cur.zocalo?.on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                          <span>Zócalo</span>
                          <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${cur.zocalo?.on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                        </button>}
                        {cur.zocalo?.on && !(isBano && fit.flotado?.on) && (
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              ['Altura (mm)', cur.zocalo.alto, (n: number) => patchCur({ zocalo: { ...cur.zocalo!, alto: Math.max(30, Math.min(300, Math.round(n))) } })],
                              ['Profundidad (mm)', cur.zocalo.fondo, (n: number) => patchCur({ zocalo: { ...cur.zocalo!, fondo: Math.max(60, Math.min(cur.depth - 30, Math.round(n))) } })],
                              ['Travesaños', cur.zocalo.travesanos, (n: number) => patchCur({ zocalo: { ...cur.zocalo!, travesanos: Math.max(0, Math.min(20, Math.round(n))) } })],
                            ] as Array<[string, number, (n: number) => void]>).map(([label, value, onCommit]) => (
                              <div key={label} className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                                <DeferredNumber value={value} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                              </div>
                            ))}
                          </div>
                        )}
                        {walls.length > 1 && (
                          <button type="button" title="Alarga los zócalos de los muros B y C hasta tocar el zócalo transversal del muro A" onClick={() => setFit(f => ({ ...f, unirZocalos: f.unirZocalos === false }))} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${fit.unirZocalos !== false ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                            <span>Unir zócalos</span>
                            <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${fit.unirZocalos !== false ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                          </button>
                        )}
                        <p className="text-[9px] font-bold text-slate-500">Inferiores: {rowsOf.lower.map(w => Math.round(w)).join(' · ')} mm{cur.upperBodies > 0 ? ` — Superiores: ${rowsOf.upper.map(w => Math.round(w)).join(' · ')} mm` : ''}</p>
                      </>
                    );
                  })()}
                </div>
              )}
              {(isClosetSection || isFitSection) && wallsHidden && (
                <button onClick={() => setWallsHidden(false)} className="absolute left-4 bottom-4 z-30 pointer-events-auto px-3 py-2 rounded-xl bg-white/95 shadow-xl border border-slate-200 text-[10px] font-black text-slate-700 uppercase tracking-tight">Muros del {cfg.singular}</button>
              )}
              {(isClosetSection || isFitSection) && !wallsHidden && (
                <div {...wallsDrag.handle} className="absolute left-4 bottom-4 z-30 pointer-events-auto w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200" style={{ ...wallsDrag.handle.style, ...wallsDrag.style }}>
                  <div className="w-full flex items-center justify-between px-4 py-2.5">
                    <span className="flex-1 text-[11px] font-black text-slate-800 uppercase tracking-tight select-none" title="Arrastra para mover la tarjeta">⠿ Muros del {cfg.singular}</span>
                    <button onClick={() => setWallsCardOpen(o => !o)} className="p-1"><ChevronDown size={16} className={`text-slate-400 transition-transform ${wallsCardOpen ? '' : 'rotate-180'}`} /></button>
                    <button onClick={() => setWallsHidden(true)} className="p-1 ml-1 text-slate-400 hover:text-red-500" title="Ocultar la tarjeta"><X size={16} /></button>
                  </div>
                  {wallsCardOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {isBano ? (
                        // baño: muros auxiliares izquierdo y derecho, cada uno se activa o no por separado
                        (() => {
                          const hasL = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left'), hasR = layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right');
                          const setAux = (l: boolean, r: boolean) => {
                            // el mueble se pega al muro auxiliar que se acaba de pedir (sin crear cubos en ese muro)
                            if (l && !hasL) setFit(f => ({ ...f, mueble: { ancho: wallA, ...(f.mueble ?? {}), x0: 0 } }));
                            else if (r && !hasR) setFit(f => ({ ...f, mueble: { ancho: wallA, ...(f.mueble ?? {}), x0: Math.max(0, wallA - (f.mueble?.ancho ?? wallA)) } }));
                            if (l && r) chooseLayout('U_SHAPE');
                            else if (l || r) { setLArm(l ? 'left' : 'right'); chooseLayout('L_SHAPE'); }
                            else chooseLayout('STRAIGHT');
                          };
                          return (
                            <div className="space-y-1.5">
                              {([['izquierdo', hasL, () => setAux(!hasL, hasR)], ['derecho', hasR, () => setAux(hasL, !hasR)]] as Array<[string, boolean, () => void]>).map(([name, on, toggle]) => (
                                <button key={name} type="button" onClick={toggle} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full border text-[10px] font-black uppercase transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                  <span>Muro auxiliar {name}</span>
                                  <span className={`flex items-center w-8 h-4 rounded-full p-0.5 ${on ? 'bg-white/40 justify-end' : 'bg-slate-200 justify-start'}`}><span className="w-3 h-3 rounded-full bg-white shadow" /></span>
                                </button>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        <>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['STRAIGHT', 'L_SHAPE', 'U_SHAPE'] as LayoutType[]).filter(l => cfg.layouts.includes(l)).map(l => (
                          <button key={l} onClick={() => chooseLayout(l)} className={`py-1.5 rounded-lg text-[10px] font-black border-2 ${layout === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{l === 'STRAIGHT' ? 'Recto' : l === 'L_SHAPE' ? 'En L' : 'En U'}</button>
                        ))}
                      </div>
                      {layout === 'L_SHAPE' && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['left', 'right'] as const).map(side => (
                            <button key={side} onClick={() => setLArm(side)} className={`py-1.5 rounded-lg text-[10px] font-black border-2 ${lArm === side ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>Brazo {side === 'left' ? 'izquierdo' : 'derecho'}</button>
                          ))}
                        </div>
                      )}
                        </>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          ['Muro A (mm)', wallA, (n: number) => setWallA(Math.max(500, Math.round(n))), true],
                          [isBano ? 'Auxiliar izquierdo (mm)' : 'Muro B (mm)', wallB, (n: number) => setWallB(Math.max(500, Math.round(n))), isBano ? (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')) : layout !== 'STRAIGHT'],
                          [isBano ? 'Auxiliar derecho (mm)' : 'Muro C (mm)', wallC, (n: number) => setWallC(Math.max(500, Math.round(n))), isBano ? (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')) : layout === 'U_SHAPE'],
                          ['Altura (mm)', spaceHeight, (n: number) => setSpaceHeight(Math.max(1000, Math.round(n))), true],
                        ] as Array<[string, number, (n: number) => void, boolean]>).filter(r => r[3]).map(([label, value, onCommit]) => (
                          <div key={label} className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
                            <DeferredNumber value={Math.round(value)} onCommit={onCommit} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-800 outline-none focus:border-indigo-500" />
                          </div>
                        ))}
                      </div>
                      {!isFitSection && (closetInput?.leftWall || closetInput?.rightWall) && (
                        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl">
                          <div>
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Dilatación 15 × 15</label>
                            <p className="text-[9px] font-bold text-slate-400">De piso a techo junto al muro</p>
                          </div>
                          <button onClick={() => (isFitSection ? setFit(f => ({ ...f, dilatacion: f.dilatacion === false })) : setCloset(c => ({ ...c, dilatacion: c.dilatacion === false })))} className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${(isFitSection ? fit.dilatacion : closet.dilatacion) !== false ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${(isFitSection ? fit.dilatacion : closet.dilatacion) !== false ? 'left-5.5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      )}
                      {((boxes as unknown as { closetAlerts?: string[] }).closetAlerts ?? []).map((m, i) => (
                        <div key={i} className="rounded-xl border-2 border-amber-300 bg-amber-50 p-2 text-[9px] font-bold text-amber-700">{m}</div>
                      ))}
                      {isClosetSection && wallA > 2400 && (
                        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5 space-y-2">
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-tight">Alarma: lámina de máximo 2400 mm</p>
                          <p className="text-[9px] font-bold text-amber-700">El muro mide {wallA} mm: el maletero, los marcos, la tapa de riel, la base y el zócalo se dividen en dos láminas. Lo que sumes a una se le resta a la otra.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-amber-700 uppercase tracking-widest px-1">Primera (mm)</label>
                              <DeferredNumber value={Math.round(Math.min(2400, Math.max(wallA - 2400, closet.sheetSplit ?? 2400)))} onCommit={n => setCloset(c => ({ ...c, sheetSplit: Math.round(Math.min(2400, Math.max(wallA - 2400, n))) }))} className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-black text-slate-800 outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-amber-700 uppercase tracking-widest px-1">Segunda (mm)</label>
                              <div className="w-full bg-white/60 border border-amber-200 rounded-xl p-2 text-xs font-black text-slate-500">{wallA - Math.round(Math.min(2400, Math.max(wallA - 2400, closet.sheetSplit ?? 2400)))}</div>
                            </div>
                          </div>
                          <p className="text-[8px] font-bold text-amber-600">Valores de la tapa de riel (largo del muro); en las otras piezas la primera es igual y la segunda es lo que falte.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Barra flotante superior izquierda (vistas) + menú desplegable superior derecha (Capas) */}
              <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-start gap-2 z-30 pointer-events-none">
                <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center gap-1">
                  {([
                    ['3d', 'Vista 3D'],
                    ['plan', 'Planta'],
                    ['frontal', 'Frontal'],
                    ['isometric', 'Isométrica'],
                  ] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setActiveView(v)} className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${activeView === v ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-transparent hover:bg-slate-50 text-slate-600 border-transparent font-medium'}`}>{label}</button>
                  ))}
                  {activeView === 'frontal' && (
                    <button onClick={() => setVerCorte(v => !v)} aria-pressed={verCorte} title={verCorte ? 'Ocultar el corte A y su sección' : 'Mostrar el corte A y su sección'} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${verCorte ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-semibold' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Corte</button>
                  )}
                  <button onClick={() => setModoAbrir(v => !v)} aria-pressed={modoAbrir} title={modoAbrir ? 'Cerrar puertas y cajones' : 'Abrir puertas y cajones (luego un clic en un frente lo abre o lo cierra solo)'} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border inline-flex items-center gap-1.5 ${modoAbrir ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'bg-transparent hover:bg-slate-50 text-slate-600 border-transparent'}`}><DoorOpen size={13} />{modoAbrir ? 'Cerrar' : 'Abrir'}</button>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" />
                  <button onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Undo2 size={14} />
                  </button>
                  <button onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)" aria-label="Rehacer" className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <Redo2 size={14} />
                  </button>
                  {collisions.length > 0 && (
                    <div
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold ml-1"
                      title={collisions.map(([p, q]) => `${p.name} choca con ${q.name}`).join('\n')}
                      role="alert"
                    >
                      <AlertCircle size={13} />
                      {collisions.length} {collisions.length === 1 ? 'choque' : 'choques'}
                    </div>
                  )}
                </div>

                {/* Desplegable de capas arriba a la derecha */}
                <div className="relative pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setIsCapasMenuOpen(o => !o)}
                    className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-md hover:bg-white px-3.5 py-2 rounded-xl shadow-sm border border-slate-200/80 text-xs font-medium text-slate-700 transition-colors"
                  >
                    <Layers size={14} className="text-indigo-600" />
                    <span>Capas: Mostrar / Ocultar</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCapasMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCapasMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-lg border border-slate-200/80 p-2 z-[80] space-y-1">
                      <div className="px-2 py-1 text-[11px] font-medium text-slate-400">Elementos visibles en el 3D</div>
                      {([
                        ['upper', 'Muebles altos', 'los muebles altos'],
                        ['lower', 'Muebles bajos', 'los muebles bajos'],
                        ['counter', 'Mesón', 'el mesón'],
                        ['appliances', 'Electrodomésticos', 'los electrodomésticos'],
                        ['puntos', 'Puntos de agua y luz', 'los puntos de adecuación (agua, desagüe, energía y gas)'],
                        ['isla', 'Isla / Península', 'las islas y penínsulas'],
                        ['muros', 'Muros', 'los muros'],
                        ['doors', 'Puertas', 'las puertas corredizas'],
                        ['shelves', 'Entrepaños', 'los entrepaños'],
                        ['cajonero', 'Cajonero', 'el cajonero'],
                        ['costado', 'Costado', 'el costado piso a techo'],
                        ['hoja', 'Hoja', 'la hoja y la chapa'],
                        ['marco', 'Marco', 'los marcos, batientes y dilatadas'],
                        ['tapaluz', 'Tapaluz', 'el tapaluz'],
                        ['dims', 'Dimensiones', 'las notas de dimensiones'],
                        ['wallA', 'Muro A', 'el muro A con sus cubos'],
                        ['wallB', 'Muro B', 'el muro B con sus cubos'],
                        ['wallC', 'Muro C', 'el muro C con sus cubos'],
                      ] as const).filter(([key]) => (key !== 'puntos' || cfg.accessories.length > 0) && (key !== 'isla' || (cfg.features.islands && islands.length > 0)) && (key !== 'muros' || cfg.id !== 'puertas') && ((key !== 'hoja' && key !== 'marco' && key !== 'tapaluz') || cfg.id === 'puertas') && (cfg.id !== 'puertas' || key === 'hoja' || key === 'marco' || key === 'tapaluz') && (key !== 'dims' || isFitSection) && (key !== 'wallA' || (isFitSection && layout !== 'STRAIGHT')) && (key !== 'wallB' || (isFitSection && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'left')))) && (key !== 'wallC' || (isFitSection && (layout === 'U_SHAPE' || (layout === 'L_SHAPE' && lArm === 'right')))) && ((key !== 'doors' && key !== 'shelves' && key !== 'cajonero' && key !== 'costado') || isClosetSection || (key as string) === 'dims' || (key as string).startsWith('wall')) && (key !== 'upper' || (cfg.hasUpper && !isClosetSection && !isFitSection)) && (key !== 'lower' || !(isClosetSection || isFitSection)) && (key !== 'counter' || cfg.features.counter) && (key !== 'appliances' || cfg.accessories.length > 0)).map(([key, label, full]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setVisibility(v => ({ ...v, [key]: !v[key] }))}
                          title={`${visibility[key] ? 'Ocultar' : 'Mostrar'} ${full}`}
                          aria-pressed={visibility[key]}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                            visibility[key] ? 'bg-indigo-50/70 text-indigo-700 font-medium' : 'text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <span>{label}</span>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                            visibility[key] ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'
                          }`}>
                            {visibility[key] ? '✓' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel derecho intuitivo: resumen, acciones clave, tarjetas de módulos, Color & Material y CTA final */}
            <aside className="w-80 xl:w-[360px] shrink-0 bg-white border-l border-slate-200/80 flex flex-col h-full overflow-hidden z-20">
              {/* Resumen y acciones rápidas de modulación */}
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                  {fotoBoceto ? (
                    <img src={fotoBoceto} alt="Boceto" className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                      {SECTION_ICONS[section]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight text-slate-900 truncate">
                      {fotoBoceto ? 'Resumen del boceto' : cfg.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {cfg.id === 'cocinas' ? (layout === 'L_SHAPE' ? 'En L' : layout === 'U_SHAPE' ? 'En U' : 'Lineal') : cfg.singular}
                      {' · '}
                      {(wallA / 1000).toFixed(2)} m{layout !== 'STRAIGHT' ? ` × ${(wallB / 1000).toFixed(2)} m` : ''}
                    </div>
                  </div>
                </div>

                {/* Acciones de modulación y aprobación */}
                <div className="relative flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsOptMenuOpen(!isOptMenuOpen)}
                    disabled={isSuggesting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 border border-indigo-200 text-xs font-medium transition-colors"
                  >
                    <Sparkles size={14} className={isSuggesting ? 'animate-spin' : ''} />
                    <span>Optimizar</span>
                    <ChevronDown size={13} className={`transition-transform ${isOptMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={convertToModules}
                    disabled={isSuggesting || (modules.length === 0 && !isFitSection)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Convierte los cubos en módulos con sus puertas y frentes de cajón"
                  >
                    <Box size={14} className="text-slate-500" />
                    <span>{isFitSection ? (fit.converted ? 'Ver cubos' : 'A módulos') : (modules.length > 0 && modules.every(m => m.detailed) ? 'Ver cubos' : 'A módulos')}</span>
                  </button>

                  {isOptMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-lg border border-slate-200/80 p-1.5 z-[80] flex flex-col gap-1">
                      <button
                        onClick={() => handleMathematicalSuggestion('efficiency')}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 text-left transition-colors group"
                      >
                        <div className="bg-amber-50 text-amber-600 border border-amber-200/60 p-1.5 rounded-lg">
                          <ZapIcon size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Estrategia eficiencia</p>
                          <p className="text-[11px] text-slate-500">Prioriza módulos anchos (90 cm)</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleMathematicalSuggestion('standard')}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 text-left transition-colors group"
                      >
                        <div className="bg-blue-50 text-blue-600 border border-blue-200/60 p-1.5 rounded-lg">
                          <Target size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Estrategia estándar</p>
                          <p className="text-[11px] text-slate-500">Prioriza módulos medios (60 cm)</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleMathematicalSuggestion('detailed')}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 text-left transition-colors group"
                      >
                        <div className="bg-emerald-50 text-emerald-600 border border-emerald-200/60 p-1.5 rounded-lg">
                          <Layers2 size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Estrategia detallada</p>
                          <p className="text-[11px] text-slate-500">Prioriza módulos angostos (30 cm)</p>
                        </div>
                      </button>
                      {activeIslands.length > 0 && (
                        <button
                          onClick={modulateIslandsOnly}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 text-left transition-colors border-t border-slate-100 mt-0.5"
                        >
                          <div className="bg-indigo-50 text-indigo-600 border border-indigo-200/60 p-1.5 rounded-lg">
                            <IslandIcon size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">Modular isla / península</p>
                            <p className="text-[11px] text-slate-500">Solo la isla; la cocina no se toca</p>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(isFitSection ? fit.converted : modules.length > 0 && modules.every(m => m.detailed)) && (
                  <button
                    onClick={() => { if (aprobadoKey === snapshotKey) return; if (productoActivo) aprobarDiseno(productoActivo); else setAprobando('dialogo'); }}
                    disabled={aprobando === 'guardando'}
                    className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-center gap-2 transition-all border text-xs font-medium ${aprobadoKey === snapshotKey ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'} disabled:opacity-60`}
                    title={aprobadoKey === snapshotKey ? 'Este diseño ya está aprobado; si lo cambias, hay que volver a aprobarlo' : 'Guarda el diseño en el proyecto y crea sus documentos'}
                  >
                    <CheckCircle2 size={15} className={aprobadoKey === snapshotKey ? 'text-emerald-600' : 'text-indigo-600'} />
                    <span>{aprobando === 'guardando' ? 'Aprobando…' : aprobadoKey === snapshotKey ? 'Diseño aprobado' : 'Guardar y aprobar diseño'}</span>
                  </button>
                )}
                {avisoAprobar && <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">{avisoAprobar}</div>}
                {paraBiblioteca && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-900">¿Guardar este diseño en la biblioteca?</div>
                    <input value={paraBiblioteca.nombre} onChange={e => setParaBiblioteca(b => (b ? { ...b, nombre: e.target.value } : b))} className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800" aria-label="Nombre en la biblioteca" />
                    <div className="flex gap-1.5">
                      <button onClick={guardarBiblioteca} disabled={bibEstado === 'guardando'} className="flex-1 rounded-xl px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50">{bibEstado === 'guardando' ? 'Guardando…' : 'Guardar'}</button>
                      <button onClick={() => setParaBiblioteca(null)} className="rounded-xl px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 border border-slate-200 text-slate-700">No</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selector rápido de Color & Material + lista desplegable de módulos debajo */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 no-scrollbar">
                {/* Selector rápido de Color & Material */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold tracking-tight text-slate-900">Color & Material</div>
                      <div className="text-[11px] text-slate-500">{acabados.MB.fach.color || faceColor}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsModulosModalOpen(true)}
                      className="text-[11px] font-medium text-indigo-600 hover:underline"
                    >
                      Personalizar
                    </button>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="search"
                      value={busquedaColor}
                      onChange={e => setBusquedaColor(e.target.value)}
                      placeholder="Buscar color: nuez, veta, piedra…"
                      aria-label="Buscar color"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500"
                    />
                  </div>
                  {(() => {
                    const q = busquedaColor.trim();
                    const lista = q ? buscarColores(q) : ['Blanco', 'Arena', 'Riviera', 'Bosco', 'Nuez', 'Humo', 'Risco', 'Negro'].map(n => colorDeCatalogo(n)!).filter(Boolean);
                    const actual = (acabados.MB.fach.color || faceColor).toLowerCase();
                    if (q && lista.length === 0) return <div className="text-[11px] text-slate-400 px-1">No hay colores que se llamen "{q}".</div>;
                    return (
                      <div className={q ? 'grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-0.5' : 'flex flex-wrap gap-2'}>
                        {lista.map(cat => {
                          const activo = actual === cat.nombre.toLowerCase();
                          const veta = tieneVeta(cat);
                          const fondo = veta ? { backgroundImage: `url(${vetaMiniatura(cat.hex, 56)})`, backgroundSize: 'cover' } : { background: cat.hex };
                          return (
                            <button
                              key={cat.nombre}
                              type="button"
                              onClick={() => setTablero('MB', 'fach', { color: cat.nombre })}
                              title={`${cat.nombre} · ${cat.grupo}${veta ? ' · con veta' : ''}`}
                              aria-label={`Color ${cat.nombre}`}
                              className={q ? `flex items-center gap-2 p-1 rounded-lg border text-left ${activo ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}` : `w-7 h-7 rounded-lg border transition-all ${activo ? 'ring-2 ring-indigo-600 ring-offset-1 border-slate-400 scale-105' : 'border-slate-300 hover:scale-105'}`}
                              style={q ? undefined : fondo}
                            >
                              {q && <>
                                <span className="w-7 h-7 rounded-md border border-slate-300 shrink-0" style={fondo} />
                                <span className="min-w-0"><span className="block text-[11px] font-medium text-slate-800 truncate">{cat.nombre}</span><span className="block text-[9px] text-slate-400 truncate">{veta ? 'Con veta' : cat.grupo}</span></span>
                              </>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Lista desplegable de módulos detectados */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  {labeledModules.length === 0 ? (
                    <>
                      <div className="text-xs font-semibold tracking-tight text-slate-900">Módulos (0)</div>
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center space-y-2.5">
                        <p className="text-xs text-slate-500">Aún no hay módulos en este espacio.</p>
                        <button
                          type="button"
                          onClick={() => handleMathematicalSuggestion('efficiency')}
                          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 transition-colors"
                        >
                          Generar modulación automática
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setModulosPanelOpen(o => !o)}
                        aria-expanded={modulosPanelOpen}
                        className="w-full flex items-center justify-between text-left group py-0.5"
                      >
                        <span className="text-xs font-semibold tracking-tight text-slate-900">Módulos ({labeledModules.length})</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 group-hover:underline">
                          <span>{modulosPanelOpen ? 'Contraer' : 'Ver todos'}</span>
                          <ChevronDown size={13} className={`transition-transform ${modulosPanelOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {modulosPanelOpen && (
                        <div className="space-y-2">
                          {labeledModules.map(m => {
                            const nombreHumano = m.name
                              .replace(/\bMA\b/g, 'Mueble alto')
                              .replace(/\bMB\b/g, 'Mueble bajo');
                            const nivelHumano = m.type === 'UPPER' ? 'Mueble alto' : m.type === 'TALL' ? 'Mueble torre' : 'Mueble bajo';
                            const abierto = editingModuleId === m.uniqueId;
                            return (
                              <div key={m.uniqueId} className="rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white p-2.5 transition-colors space-y-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-semibold flex items-center justify-center shrink-0">
                                    {m.label}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-slate-900 truncate">{nombreHumano}</div>
                                    <div className="text-[11px] text-slate-500">{nivelHumano} · {Math.round(m.width / 10)} cm</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditingModuleId(abierto ? null : m.uniqueId)}
                                    title="Editar medidas"
                                    className={`p-1.5 rounded-lg border transition-colors ${abierto ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-400 hover:text-slate-700 border-slate-200/80'}`}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteModule(m.uniqueId)}
                                    title="Eliminar módulo"
                                    className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-rose-600 border border-slate-200/80 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                {abierto && (
                                  <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/60">
                                    <MeasureInput label="Ancho" value={m.width} onCommit={(v) => applyDimensionChange('module', m.uniqueId, v)} />
                                    <MeasureInput label="Alto" value={m.height} onCommit={(v) => updateModuleMeasure(m.uniqueId, 'height', v)} />
                                    <MeasureInput label="Fondo" value={m.depth} onCommit={(v) => updateModuleMeasure(m.uniqueId, 'depth', v)} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Botón protagonista inferior */}
              <div className="p-4 border-t border-slate-200/80 bg-white space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('quote')}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Ver Costos y Precios</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(true)}
                  className="w-full py-1 text-center text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  ← Modificar medidas o espacio
                </button>
              </div>
            </aside>
          </div>
        )}
        {activeTab === 'catalog' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Biblioteca de módulos</h2>
                <p className="text-sm text-slate-500 mt-1">Tus módulos especiales: créalos a tu medida, guárdalos aquí y agrégalos a cualquier diseño.</p>
              </div>
              <ModulosEspeciales delDiseno={labeledModules} onAgregar={addModuloEspecial} />
            </div>
          </div>
        )}
        {activeTab === 'quote' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Precios</h2>
                <p className="text-sm text-slate-500 mt-1">Lo que nos cuesta cada pieza, módulo y mueble con tu tabla de costos, y la cotización para el cliente.</p>
              </div>
              <Precios boxes={boxes} ctx={ctxPiezas} lista={lista}
                modulos={labeledModules.map(m => ({ uniqueId: m.uniqueId, label: m.label, type: m.type, width: m.width, height: m.height, depth: m.depth }))}
                nombreResto={cfg.id === 'cocinas' ? 'Zócalo, rellenos y mesón' : cfg.name}
                datos={{
                  cliente: productoActivo?.cliente ?? '', proyecto: productoActivo?.nombre ?? '', producto: cfg.id === 'cocinas' ? 'Cocina integral' : cfg.singular.charAt(0).toUpperCase() + cfg.singular.slice(1),
                  descripcion: [cfg.id === 'cocinas' ? (layout === 'L_SHAPE' ? 'En L' : layout === 'U_SHAPE' ? 'En U' : 'Lineal') : '', `${wallA}${layout !== 'STRAIGHT' && cfg.id === 'cocinas' ? ` × ${wallB}` : ''} mm`, `alto ${spaceHeight} mm`, faceColor ? `fachada ${faceColor}` : ''].filter(Boolean).join(' · '),
                }}
                onGuardarCotizacion={productoActivo ? async (archivo, nombre) => { await subirDocumentos(productoActivo.id, [{ tipo: 'cotizacion', nombre, archivo }], false); } : undefined}
                onContinuarEntregables={() => setActiveTab(lastDeliverableTab)} />
            </div>
          </div>
        )}
        {(activeTab === 'render' || activeTab === 'planos' || activeTab === 'laminas' || activeTab === 'listado') && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Entregables</h2>
                  <p className="text-sm text-slate-500 mt-1">Render 3D, planos de ensamble, optimización de láminas y listado de partes.</p>
                </div>
                {activeTab === 'listado' && (
                  <div className="flex items-center gap-2">
                    <button onClick={exportBoxesJSON} disabled={boxes.length === 0} className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <Download size={15} />
                      Cajas para Fusion
                    </button>
                    <button onClick={() => { if (lista.piezas.length > 0) exportarListadoDeCorte(lista, `Listado_${cfg.name.replace(/\s+/g, '_')}`); else if (bom) exportBOMToExcel(bom); }} disabled={lista.piezas.length === 0 && !bom} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                      <Download size={15} />
                      Descargar Excel
                    </button>
                  </div>
                )}
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
                {([
                  { id: 'render' as const, label: 'Render 3D', icon: <ImageIcon size={15} /> },
                  { id: 'planos' as const, label: 'Planos', icon: <FileText size={15} /> },
                  { id: 'laminas' as const, label: 'Láminas', icon: <LayoutGrid size={15} /> },
                  { id: 'listado' as const, label: 'Listado', icon: <Table size={15} />, count: lista.piezas.length > 0 ? lista.piezas.reduce((a, p) => a + p.quantity, 0) : bom ? bom.pieces.length : 0 },
                ]).map(sub => {
                  const active = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveTab(sub.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs border transition-colors ${
                        active
                          ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-transparent font-medium'
                      }`}
                    >
                      {sub.icon}
                      <span>{sub.label}</span>
                      {sub.count ? (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {sub.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'render' && (
                <RenderVista
                  key={`${faceColor}|${acabados.MA.fach.color}|${acabados.MB.est.color}`}
                  boxes={boxes}
                  appliances={appliances}
                  modules={modules}
                  wallA={wallA}
                  spaceHeight={spaceHeight}
                  zocaloHeight={hasZocalo ? zocaloHeight : 0}
                  faceColor={faceColor}
                  faceColorMA={acabados.MA.fach.color}
                  lineType={lineType}
                  nombre={cfg.name}
                  estructura={acabados.MB.est.color}
                  producto={productoActivo?.nombre ?? null}
                  onGuardar={productoActivo ? async (url, tipo) => { await subirDocumentos(productoActivo.id, [{ tipo, nombre: `${tipo === 'render' ? 'Render' : 'Foto_IA'}_${productoActivo.nombre.replace(/\s+/g, '_')}.png`, archivo: archivoDeDataURL(url) }], false); } : undefined}
                />
              )}

              {activeTab === 'planos' && (
                lista.piezas.length > 0 ? (
                  <PlanosEnsamble boxes={boxes} ctx={{ lineType, faceColor }} proyecto={cfg.name} />
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-8 text-center text-sm font-medium text-slate-500">
                    Todavía no hay piezas para dibujar. En cocinas, convierte los cubos a módulos en Diseño 3D.
                  </div>
                )
              )}

              {activeTab === 'laminas' && (
                lista.piezas.length > 0 ? (
                  <Optimizador piezas={lista.piezas} />
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-8 text-center text-sm font-medium text-slate-500">
                    Todavía no hay piezas para acomodar. En cocinas, convierte los cubos a módulos en Diseño 3D.
                  </div>
                )
              )}

              {activeTab === 'listado' && (
                lista.piezas.length > 0 ? (
                  <div className="space-y-4">
                    {/* lista de piezas única (fase 0): sale de las mismas piezas que se dibujan en 3D */}
                    {lista.piezas.some(p => p.confirmar) && (
                      <div className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200/70 rounded-xl px-4 py-2.5">Las filas con ● tienen canto o veta por confirmar.</div>
                    )}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80">
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">ITEM</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">PARTE</th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-700">C/D</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">LAR</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">AN</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">CAL</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">COLOR</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">CANTO</th>
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">L1</th>
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">L2</th>
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">a1</th>
                              <th className="px-2 py-2.5 text-left font-semibold text-slate-500">a2</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lista.piezas.map(piece => (
                              <tr key={piece.item} className="hover:bg-slate-50/70" title={`Sale de: ${piece.modulos.join(', ')}`}>
                                <td className="px-3 py-2 font-semibold text-slate-900">{piece.item}</td>
                                <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{piece.name}{piece.confirmar && <span className="ml-1 text-amber-500" title="Canto o veta por confirmar">●</span>}</td>
                                <td className="px-3 py-2 text-center font-semibold text-slate-800">{piece.quantity}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{piece.length}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{piece.width}</td>
                                <td className="px-3 py-2 text-right text-slate-600">{piece.thickness}</td>
                                <td className="px-3 py-2 text-slate-600">{piece.color}</td>
                                <td className="px-3 py-2 text-slate-600">{piece.edgeType || '—'}</td>
                                {(() => { const b = bordesDeCanto(piece.edgeType || '', piece.color); return [b.l1, b.l2, b.a1, b.a2].map((t, i) => <td key={i} className="px-2 py-2 text-[11px] text-slate-500 whitespace-nowrap">{t}</td>); })()}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {lista.herrajes.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-1.5">
                        <div className="text-xs font-semibold text-slate-900">Herrajes</div>
                        {lista.herrajes.map((h, i) => <div key={i} className="text-xs text-slate-600 font-medium">{h.cant} × {h.nombre}{h.medida ? ` (${h.medida})` : ''}</div>)}
                      </div>
                    )}
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
                      <p className="text-sm font-semibold text-slate-900">Total: <span className="text-indigo-600">{lista.piezas.reduce((a, p) => a + p.quantity, 0)} piezas</span> en {lista.piezas.length} referencias</p>
                    </div>
                  </div>
                ) : bom && bom.pieces.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80">
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">ITEM</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">PARTE</th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-700">C/D</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">LAR</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">AN</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">CAL</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">COLOR</th>
                              <th className="px-3 py-2.5 text-left font-semibold text-slate-700">CANTO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bom.pieces.map(piece => (
                              <tr key={`${piece.item}-${piece.name}`} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 font-semibold text-slate-900">{piece.item}</td>
                                <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{piece.name}</td>
                                <td className="px-3 py-2 text-center font-semibold text-slate-800">{piece.quantity}</td>
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
                      <p className="text-sm font-semibold text-slate-900">Total: <span className="text-indigo-600">{bom.totalPieces} piezas</span> · Muro: <span className="text-indigo-600">{bom.kitchenConfig.wallWidth}mm</span> · Línea: <span className="text-indigo-600">{bom.kitchenConfig.lineType}</span> · Color: <span className="text-indigo-600">{bom.kitchenConfig.faceColor}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-8 text-center text-sm font-medium text-slate-500">
                    Agrega módulos en Diseño 3D para generar el listado.
                  </div>
                )
              )}
            </div>
          </div>
        )}
        {activeTab === 'proyectos' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Proyectos</h2>
                <p className="text-sm text-slate-500 mt-1">Tus clientes y los diseños guardados de cada uno.</p>
              </div>
              <Proyectos seccion={section} diseñoActual={() => latestSnapshot.current.snapshot}
                documentos={docsDelDiseno}
                nuevoTrigger={nuevoProyectoTick}
                onProductoActivo={p => { setProductoActivo(p); setAprobadoKey(null); if (p) setFotoBoceto(null); }}
                onAbrir={abrirProductoGuardado} />
              <div className="pt-2">
                <Biblioteca recargar={bibRecargar} onUsar={(sec, datos, nombre) => abrirDeBiblioteca(sec, datos, nombre)} onAbrir={(sec, datos) => abrirDeBiblioteca(sec, datos)} />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'inicio' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-6xl mx-auto">
              <Inicio
                section={section}
                icons={SECTION_ICONS}
                correoSesion={correoSesion}
                onProducto={id => switchSection(id)}
                onAbrirCategoria={id => { switchSection(id); setActiveTab('design'); }}
                onFase={f => setActiveTab(f)}
                onCrearDesdeCero={() => {
                  setProductoActivo(null);
                  setAprobadoKey(null);
                  setBosquejoListo(false);
                  setFotoBoceto(null);
                  setEvidenciasBoceto(null);
                  applySnapshot(makeSectionDefaults(section));
                  bumpHistory();
                  setActiveTab('design');
                  setIsWorkspaceModalOpen(true);
                }}
                onIrProyectos={() => setActiveTab('proyectos')}
                onAbrirProyecto={abrirProductoGuardado}
                avance={{
                  producto: productoActivo?.nombre ?? null,
                  cliente: productoActivo?.cliente ?? null,
                  bosquejo: bosquejoListo,
                  modulos: labeledModules.length,
                  piezas: lista.piezas.length,
                  aprobado: aprobadoKey !== null && aprobadoKey === snapshotKey,
                  preview: {
                    layout,
                    wallA,
                    wallB,
                    wallC,
                    faceColor,
                    modules: labeledModules.map(m => ({ wall: m.wall, type: m.type, positionX: m.positionX, width: m.width })),
                  },
                }}
              />
            </div>
          </div>
        )}
        {activeTab === 'bosquejo' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Boceto</h2>
                <p className="text-sm text-slate-500 mt-1">Sube la foto de tu boceto a mano y revisa la lectura automática antes de pasar al 3D.</p>
              </div>
              {bosquejoListo && labeledModules.length > 0 && (
                <div className="space-y-3">
                  <PlanoLimpio boxes={boxes} modules={labeledModules} onCambiar={(id, cambios) => setModules(prev => prev.map(m => (m.uniqueId === id ? { ...m, ...cambios } : m)))} />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab('design')} className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-sm">Ver mi diseño en 3D →</button>
                    <button onClick={() => setBosquejoListo(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors">Volver a mi boceto y notas</button>
                  </div>
                </div>
              )}
              {!bosquejoListo && labeledModules.length > 0 && (fotoBoceto || evidenciasBoceto) && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <button onClick={() => setBosquejoListo(true)} className="rounded-xl px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors">Ver resumen en limpio</button>
                  <span className="text-xs font-medium text-indigo-700">Aquí están tu foto y tus notas. Se guardan como evidencias cuando agregas el diseño a un proyecto.</span>
                </div>
              )}
              <div className={bosquejoListo && labeledModules.length > 0 ? 'hidden' : ''}><Bosquejo actual={section} onCrear={crearDesdeBosquejo} /></div>
            </div>
          </div>
        )}
        {activeTab === 'config' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 px-6 py-6 pb-12">
            <div className="max-w-3xl mx-auto space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Configuración</h2>
                <p className="text-sm text-slate-500 mt-1">Ajustes generales del espacio, línea de producto y herrajes.</p>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-5">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 block mb-1.5">Largo muro A (mm)</span>
                  <input type="number" value={wallA} onChange={e => setWallA(parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 block mb-1.5">Línea de producto</span>
                  <select value={lineType} onChange={e => setLineType(e.target.value as any)} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500">
                    <option>Básica</option>
                    <option>Media</option>
                    <option>Alta</option>
                  </select>
                </label>
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="text-sm font-semibold tracking-tight text-slate-900">Corredera de los cajones</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCorredera({ tipo: 'full' })} className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-colors ${corredera.tipo === 'full' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>Full extensión</button>
                    <button onClick={() => setCorredera(c => ({ ...c, tipo: 'oculta' }))} className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-colors ${corredera.tipo === 'oculta' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>Oculta</button>
                    {corredera.tipo === 'oculta' && (
                      <>
                        <button onClick={() => setCorredera(c => ({ ...c, menos10: !c.menos10 }))} className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-colors ${!!corredera.menos10 ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>Descontar 10 mm al largo</button>
                        <button onClick={() => setCorredera(c => ({ ...c, fondo15: !c.fondo15 }))} className={`rounded-xl px-3.5 py-2 text-xs font-medium border transition-colors ${!!corredera.fondo15 ? 'text-indigo-600 bg-indigo-50 border-indigo-200 font-semibold' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}>Fondo de 15</button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Full extensión: 13 mm de luz por lado. Oculta: 6 mm por lado y lateral en medidas de 50 en 50; algunas marcas piden 10 mm menos de largo.</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-slate-900">Costados internos más cortos</div>
                    <div className="text-xs text-slate-500 mt-0.5">Con puente en L de melamina corrido entre varios bajos: los costados internos van 80 mm más cortos y no se les hace la caja.</div>
                  </div>
                  <button onClick={() => setAcabados(a => ({ ...a, golaCorrida: !a.golaCorrida }))} className={`w-11 h-6 rounded-full relative shrink-0 transition-all ${costadosCortos ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${costadosCortos ? 'left-[22px]' : 'left-0.5'}`} /></button>
                </div>
                <label className="block pt-2 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-600 block mb-1.5">Color de fachada</span>
                  <input type="text" value={faceColor} onChange={e => setFaceColor(e.target.value)} placeholder="Ej: Blanco, Ámbar, Gris" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500" />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
