import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Clock, FolderOpen, Pencil, Plus, Ruler,
} from 'lucide-react';
import { SECTIONS, SectionId } from './sections';
import {
  DisenoBiblioteca, DisenoGuardado, Proyecto, alCambiarSesion, listarBiblioteca, listarDisenos,
  listarDocumentos, listarProyectos, nubeConfigurada, sesionActual,
} from './nube';
import { hexDe } from './colores';
import type { ProductoActivo } from './Proyectos';
import type { LayoutType } from './types';

/**
 * Pantalla de Inicio (Dashboard):
 * Hero banner superior con degradado suave y dos CTA principales, seguido de un grid de 2 columnas:
 * Proyectos recientes (3 columnas de tarjetas visuales dentro de su panel) y Biblioteca & Inspiración + Cómo funciona Modully.
 */

export type Fase = 'bosquejo' | 'design' | 'listado' | 'laminas' | 'planos' | 'render';

/** Lo que la app sabe del diseño abierto en memoria, para mostrar avance y borrador activo. */
export interface Avance {
  producto: string | null;
  cliente: string | null;
  bosquejo: boolean;
  modulos: number;
  piezas: number;
  aprobado: boolean;
  preview?: {
    layout: LayoutType;
    wallA: number;
    wallB: number;
    wallC: number;
    faceColor: string;
    modules: { wall: string; type: string; positionX: number; width: number }[];
  };
}

type EstadoProyecto = 'En Diseño' | 'Presupuestado' | 'Completado';

interface TarjetaReciente {
  id: string;
  titulo: string;
  subtitulo: string;
  modulosTxt?: string;
  seccion: SectionId;
  fecha: string;
  estado: EstadoProyecto;
  datos: unknown;
  producto?: ProductoActivo;
  esBorrador?: boolean;
}

const BADGE_ESTADO: Record<EstadoProyecto, string> = {
  'Completado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Presupuestado': 'bg-indigo-50 text-indigo-600 border-indigo-200',
  'En Diseño': 'bg-sky-50 text-sky-700 border-sky-200',
};

const fechaCorta = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

/** Miniatura vectorial generada desde los datos reales del diseño (muros, módulos y color de fachada). */
const MiniaturaDiseno: React.FC<{ seccion: SectionId; datos: unknown }> = ({ seccion, datos }) => {
  const s = (datos ?? {}) as {
    layout?: LayoutType;
    wallA?: number;
    wallB?: number;
    wallC?: number;
    faceColor?: string;
    modules?: { wall?: string; type?: string; positionX?: number; width?: number }[];
  };
  const layout = s.layout ?? 'STRAIGHT';
  const wallA = Math.max(800, Number(s.wallA) || 2400);
  const wallB = Math.max(600, Number(s.wallB) || 1800);
  const wallC = Math.max(600, Number(s.wallC) || 1800);
  const fach = hexDe(s.faceColor || 'Blanco', '#e2e8f0');
  const mods = Array.isArray(s.modules) ? s.modules : [];
  const modsA = mods.filter(m => m.wall === 'A' || !m.wall);

  if (seccion === 'closets' || seccion === 'closetfit' || seccion === 'walking') {
    const cols = Math.max(2, Math.min(4, modsA.length || 3));
    return (
      <svg viewBox="0 0 180 86" className="w-full h-full max-h-24" aria-hidden="true">
        <rect x="26" y="8" width="128" height="70" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="30" y="12" width="120" height="14" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        {Array.from({ length: cols }).map((_, i) => {
          const w = 120 / cols;
          return (
            <g key={i}>
              <rect x={30 + i * w} y="28" width={w - 2} height="46" rx="1.5" fill={i === 1 ? '#f8fafc' : fach} stroke="#94a3b8" strokeWidth="1" />
              {i === 1 && (
                <>
                  <line x1={32 + i * w} y1="44" x2={26 + (i + 1) * w} y2="44" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1={32 + i * w} y1="54" x2={26 + (i + 1) * w} y2="54" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1={32 + i * w} y1="64" x2={26 + (i + 1) * w} y2="64" stroke="#cbd5e1" strokeWidth="1" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  if (seccion === 'bano') {
    return (
      <svg viewBox="0 0 180 86" className="w-full h-full max-h-24" aria-hidden="true">
        <rect x="46" y="8" width="88" height="28" rx="14" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" />
        <rect x="36" y="42" width="108" height="26" rx="3" fill={fach} stroke="#94a3b8" strokeWidth="1.2" />
        <line x1="90" y1="42" x2="90" y2="68" stroke="#94a3b8" strokeWidth="1" />
        <rect x="34" y="39" width="112" height="4" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
      </svg>
    );
  }

  if (seccion === 'tv') {
    return (
      <svg viewBox="0 0 180 86" className="w-full h-full max-h-24" aria-hidden="true">
        <rect x="24" y="10" width="24" height="66" rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        <rect x="132" y="10" width="24" height="66" rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        <rect x="50" y="10" width="80" height="14" rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        <rect x="60" y="29" width="60" height="26" rx="2" fill="#1e293b" />
        <rect x="50" y="60" width="80" height="16" rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1" />
      </svg>
    );
  }

  if (layout === 'L_SHAPE' || layout === 'U_SHAPE') {
    const maxW = Math.max(wallA, wallB, wallC, 1200);
    const scale = 110 / maxW;
    const aw = Math.max(44, wallA * scale);
    const bh = Math.max(28, wallB * scale * 0.6);
    const ch = Math.max(28, wallC * scale * 0.6);
    const x0 = (180 - aw) / 2;
    return (
      <svg viewBox="0 0 180 86" className="w-full h-full max-h-24" aria-hidden="true">
        <rect x={x0} y="14" width={aw} height="16" rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1.2" />
        <rect x={x0} y="14" width="16" height={bh} rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1.2" />
        {layout === 'U_SHAPE' && (
          <rect x={x0 + aw - 16} y="14" width="16" height={ch} rx="2" fill={fach} stroke="#94a3b8" strokeWidth="1.2" />
        )}
        <path d={`M ${x0 - 4} ${14 + bh} V 10 H ${x0 + aw + 4}${layout === 'U_SHAPE' ? ` V ${14 + ch}` : ''}`} fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  const lower = modsA.filter(m => m.type === 'LOWER' || m.type === 'TALL');
  const upper = modsA.filter(m => m.type === 'UPPER');
  const sx = 128 / wallA;

  return (
    <svg viewBox="0 0 180 86" className="w-full h-full max-h-24" aria-hidden="true">
      <line x1="22" y1="74" x2="158" y2="74" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      {upper.length > 0 ? upper.map((m, idx) => (
        <rect key={`u-${idx}`} x={26 + (m.positionX ?? 0) * sx} y="14" width={Math.max(6, (m.width ?? 600) * sx - 1)} height="20" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
      )) : (
        <>
          <rect x="26" y="14" width="40" height="20" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
          <rect x="68" y="14" width="40" height="20" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
          <rect x="110" y="14" width="44" height="20" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        </>
      )}
      <rect x="25" y="45" width="130" height="3.5" rx="1" fill="#cbd5e1" />
      {lower.length > 0 ? lower.map((m, idx) => (
        <rect key={`l-${idx}`} x={26 + (m.positionX ?? 0) * sx} y="48.5" width={Math.max(6, (m.width ?? 600) * sx - 1)} height="25.5" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
      )) : (
        <>
          <rect x="26" y="48.5" width="40" height="25.5" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
          <rect x="68" y="48.5" width="40" height="25.5" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
          <rect x="110" y="48.5" width="44" height="25.5" rx="1.5" fill={fach} stroke="#94a3b8" strokeWidth="1" />
        </>
      )}
    </svg>
  );
};

/** Ilustración isométrica arquitectónica para cada tarjeta de "Biblioteca & Inspiración". */
const IlustracionCategoria: React.FC<{ id: SectionId }> = ({ id }) => {
  const mk = (ox: number, oy: number) => {
    const p = (u: number, v: number, w: number) => `${(ox + 0.866 * (u - v)).toFixed(1)},${(oy + 0.5 * (u + v) - w).toFixed(1)}`;
    const poly = (pts: [number, number, number][], fill: string, stroke = '#64748b', sw = 0.55) => (
      <polygon points={pts.map(([u, v, w]) => p(u, v, w)).join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    );
    const box = (u0: number, v0: number, w0: number, u1: number, v1: number, w1: number, c: { t: string; l: string; r: string; s?: string; sw?: number }) => (
      <g>
        {poly([[u0, v1, w0], [u1, v1, w0], [u1, v1, w1], [u0, v1, w1]], c.l, c.s, c.sw)}
        {poly([[u1, v0, w0], [u1, v1, w0], [u1, v1, w1], [u1, v0, w1]], c.r, c.s, c.sw)}
        {poly([[u0, v0, w1], [u1, v0, w1], [u1, v1, w1], [u0, v1, w1]], c.t, c.s, c.sw)}
      </g>
    );
    const line = (a: [number, number, number], b: [number, number, number], stroke = '#64748b', sw = 0.65) => {
      const [x1, y1] = p(...a).split(','), [x2, y2] = p(...b).split(',');
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
    };
    return { p, poly, box, line };
  };

  const OAK = { t: '#edd0ae', l: '#d7a875', r: '#be8c58', s: '#5c4632', sw: 0.55 };
  const OAK_IN = { t: '#dfba91', l: '#c89763', r: '#b07e4b', s: '#6e553e', sw: 0.5 };
  const WHT = { t: '#ffffff', l: '#e9eef5', r: '#f8fafc', s: '#64748b', sw: 0.55 };
  const WALL = { t: '#f8fafc', l: '#e2e8f0', r: '#f1f5f9', s: '#94a3b8', sw: 0.5 };
  const STL = { t: '#e2e8f0', l: '#94a3b8', r: '#cbd5e1', s: '#64748b', sw: 0.5 };

  if (id === 'cocinas') {
    const { poly, box, line } = mk(55, 45);
    return (
      <svg viewBox="22 11 66 72" className="w-28 h-20" aria-hidden="true">
        {poly([[0, 0, -1], [35, 0, -1], [35, 35, -1], [0, 35, -1]], '#e2e8f0', 'none', 0)}
        {poly([[0, 0, 0], [34, 0, 0], [34, 34, 0], [0, 34, 0]], '#f8fafc', '#cbd5e1', 0.5)}
        {/* Muros esquina */}
        {box(-1.6, 0, 0, 0, 34, 31, WALL)}
        {box(0, -1.6, 0, 34, 0, 31, WALL)}
        {/* Módulos bajos blancos (esquina + brazo izquierdo + brazo derecho) */}
        {box(0, 0, 0, 10, 10, 11, WHT)}
        {box(0, 10, 0, 10, 22, 11, WHT)}
        {box(0, 22, 0, 10, 33, 11, WHT)}
        {box(10, 0, 0, 22, 10, 11, WHT)}
        {box(22, 0, 0, 33, 10, 11, WHT)}
        {/* Horno en módulo izquierdo */}
        {poly([[10.05, 12, 2.5], [10.05, 20, 2.5], [10.05, 20, 9.2], [10.05, 12, 9.2]], '#1e293b', '#475569', 0.4)}
        {line([10.08, 13, 9.8], [10.08, 19, 9.8], '#64748b', 0.7)}
        {/* Divisiones puertas brazo derecho */}
        {line([16, 10.05, 0.5], [16, 10.05, 10.8], '#94a3b8', 0.5)}
        {line([27.5, 10.05, 0.5], [27.5, 10.05, 10.8], '#94a3b8', 0.5)}
        {/* Mesón continuo */}
        {box(0, 0, 11, 10.5, 33.4, 12.2, WHT)}
        {box(10.5, 0, 11, 33.4, 10.5, 12.2, WHT)}
        {/* Estufa inducción */}
        {poly([[2, 12.5, 12.3], [8, 12.5, 12.3], [8, 19.5, 12.3], [2, 19.5, 12.3]], '#1e293b', '#334155', 0.4)}
        {/* Poceta y grifería */}
        {poly([[22, 2.5, 12.3], [29, 2.5, 12.3], [29, 8, 12.3], [22, 8, 12.3]], '#e2e8f0', '#64748b', 0.45)}
        {line([25.5, 1.8, 12.3], [25.5, 1.8, 15.6], '#475569', 0.8)}
        {line([25.5, 1.8, 15.6], [25.5, 3.6, 15.2], '#475569', 0.7)}
        {/* Campana y muebles altos en roble */}
        {box(0, 0, 19, 7, 10, 28, OAK)}
        {box(0, 12, 18, 8, 20, 20, STL)}
        {box(0, 14, 20, 4, 18, 29, STL)}
        {box(0, 22, 19, 7, 32, 28, OAK)}
        {box(10, 0, 19, 21, 7, 28, OAK)}
        {box(21, 0, 19, 32, 7, 28, OAK)}
        {line([15.5, 7.05, 19.3], [15.5, 7.05, 27.7], '#6e553e', 0.5)}
        {line([26.5, 7.05, 19.3], [26.5, 7.05, 27.7], '#6e553e', 0.5)}
      </svg>
    );
  }

  if (id === 'closets') {
    const { poly, box, line } = mk(35, 49);
    return (
      <svg viewBox="17 15 57 64" className="w-28 h-20" aria-hidden="true">
        {poly([[-2, 1, -0.5], [43, 1, -0.5], [41, 14, -0.5], [-4, 14, -0.5]], '#e2e8f0', 'none', 0)}
        {/* Fondo y base */}
        {box(0, 0, 0, 42, 1.5, 31, OAK_IN)}
        {box(0, 1.5, 0, 42, 13, 1.5, OAK)}
        {/* Costado izquierdo y división 1 */}
        {box(0, 1.5, 1.5, 1.4, 13, 30, OAK)}
        {/* Cuerpo izquierdo: tubo + maletero */}
        {line([1.6, 6.5, 22], [13.6, 6.5, 22], '#64748b', 0.9)}
        {box(1.4, 1.5, 24.5, 13.8, 12.6, 25.6, OAK_IN)}
        {box(13.8, 1.5, 1.5, 15, 13, 30, OAK)}
        {/* Cuerpo central: 3 cajones + entrepaño + maletero */}
        {box(15, 1.5, 1.5, 27, 12.6, 5, OAK)}
        {box(15, 1.5, 5.2, 27, 12.6, 8.6, OAK)}
        {box(15, 1.5, 8.8, 27, 12.6, 12.2, OAK)}
        {line([19.5, 12.7, 3.3], [22.5, 12.7, 3.3], '#5c4632', 0.6)}
        {line([19.5, 12.7, 6.9], [22.5, 12.7, 6.9], '#5c4632', 0.6)}
        {line([19.5, 12.7, 10.5], [22.5, 12.7, 10.5], '#5c4632', 0.6)}
        {box(15, 1.5, 18.5, 27, 12.6, 19.6, OAK_IN)}
        {box(15, 1.5, 24.5, 27, 12.6, 25.6, OAK_IN)}
        {box(27, 1.5, 1.5, 28.2, 13, 30, OAK)}
        {/* Cuerpo derecho: tubo + maletero */}
        {line([28.4, 6.5, 22], [40.4, 6.5, 22], '#64748b', 0.9)}
        {box(28.2, 1.5, 24.5, 40.6, 12.6, 25.6, OAK_IN)}
        {box(40.6, 1.5, 1.5, 42, 13, 30, OAK)}
        {/* Tapa superior */}
        {box(0, 0, 30, 42, 13, 31.4, OAK)}
      </svg>
    );
  }

  if (id === 'bano') {
    const { p, poly, box, line } = mk(43, 55);
    // Puntos de un espejo circular en el plano del muro (v = 0, centro u = 14, w = 34)
    const mirrorPts = Array.from({ length: 24 }).map((_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return p(14 + Math.cos(a) * 10.5, 0, 34 + Math.sin(a) * 10.5);
    }).join(' ');
    const mirrorInner = Array.from({ length: 24 }).map((_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return p(14 + Math.cos(a) * 9.3, 0.3, 34 + Math.sin(a) * 9.3);
    }).join(' ');
    return (
      <svg viewBox="28 15 43 62" className="w-28 h-20" aria-hidden="true">
        <defs>
          <linearGradient id="modully-mirror" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0e7ff" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
        </defs>
        {/* Sombra en el piso bajo el mueble flotado */}
        {poly([[2, 2, 0], [28, 2, 0], [26, 13, 0], [0, 13, 0]], '#e2e8f0', 'none', 0)}
        {/* Espejo redondo */}
        <polygon points={mirrorPts} fill="#cbd5e1" stroke="#64748b" strokeWidth="0.65" />
        <polygon points={mirrorInner} fill="url(#modully-mirror)" stroke="#94a3b8" strokeWidth="0.45" />
        {line([10, 0.4, 37], [17, 0.4, 31], '#ffffff', 1.1)}
        {/* Mueble flotado 2 cajones */}
        {box(0, 0, 8, 28, 12.5, 19, OAK)}
        {line([0.4, 12.55, 13.5], [27.6, 12.55, 13.5], '#5c4632', 0.6)}
        {line([28.05, 0.4, 13.5], [28.05, 12.1, 13.5], '#5c4632', 0.6)}
        {/* Mesón blanco + lavamanos + grifería */}
        {box(-0.6, -0.5, 19, 28.6, 13.2, 21, WHT)}
        {poly([[7, 2.5, 21.1], [21, 2.5, 21.1], [21, 10.5, 21.1], [7, 10.5, 21.1]], '#e2e8f0', '#64748b', 0.5)}
        {line([14, 1.5, 21.1], [14, 1.5, 25], '#475569', 0.9)}
        {line([14, 1.5, 25], [14, 3.8, 24.4], '#475569', 0.8)}
      </svg>
    );
  }

  // Centros de entretenimiento (tv) — vista frontal arquitectónica limpia
  return (
    <svg viewBox="-2 2 114 90" className="w-24 h-20" aria-hidden="true">
      <defs>
        <linearGradient id="modully-tv-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="55%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Sombra suave en el piso */}
      <ellipse cx="55" cy="79" rx="44" ry="3.8" fill="#e2e8f0" />

      {/* Panel trasero detrás del televisor */}
      <rect x="28" y="22" width="54" height="36" fill="#f5e3cc" stroke="#5c4632" strokeWidth="0.65" />
      <line x1="38" y1="22.5" x2="38" y2="57.5" stroke="#dfc29f" strokeWidth="0.45" />
      <line x1="49" y1="22.5" x2="49" y2="57.5" stroke="#dfc29f" strokeWidth="0.45" />
      <line x1="61" y1="22.5" x2="61" y2="57.5" stroke="#dfc29f" strokeWidth="0.45" />
      <line x1="72" y1="22.5" x2="72" y2="57.5" stroke="#dfc29f" strokeWidth="0.45" />

      {/* Torre izquierda con repisas abiertas */}
      <rect x="13" y="16" width="15" height="42" fill="#dfba91" stroke="#5c4632" strokeWidth="0.65" strokeLinejoin="round" />
      <rect x="15.2" y="18.2" width="10.6" height="11.2" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />
      <rect x="15.2" y="31.4" width="10.6" height="11.2" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />
      <rect x="15.2" y="44.6" width="10.6" height="11.4" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />

      {/* Torre derecha con repisas abiertas */}
      <rect x="82" y="16" width="15" height="42" fill="#dfba91" stroke="#5c4632" strokeWidth="0.65" strokeLinejoin="round" />
      <rect x="84.2" y="18.2" width="10.6" height="11.2" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />
      <rect x="84.2" y="31.4" width="10.6" height="11.2" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />
      <rect x="84.2" y="44.6" width="10.6" height="11.4" fill="#f5e3cc" stroke="#8a6c4c" strokeWidth="0.45" />

      {/* Repisa puente superior */}
      <rect x="13" y="15" width="84" height="7" rx="0.8" fill="#d7a875" stroke="#5c4632" strokeWidth="0.65" />
      <rect x="13.5" y="15.4" width="83" height="2" fill="#edd0ae" />

      {/* Mueble bajo / consola TV */}
      <rect x="13" y="58" width="84" height="17.5" rx="0.8" fill="#d7a875" stroke="#5c4632" strokeWidth="0.65" />
      <rect x="13.5" y="58.4" width="83" height="2.2" fill="#edd0ae" />
      {/* Zócalo / patas */}
      <rect x="16" y="75.5" width="4" height="2.5" fill="#8a6c4c" stroke="#5c4632" strokeWidth="0.45" />
      <rect x="90" y="75.5" width="4" height="2.5" fill="#8a6c4c" stroke="#5c4632" strokeWidth="0.45" />

      {/* Cajones laterales blancos + nicho central consola */}
      <rect x="15.5" y="61.8" width="24" height="11.6" rx="0.6" fill="#ffffff" stroke="#64748b" strokeWidth="0.55" />
      <line x1="23.5" y1="64.5" x2="31.5" y2="64.5" stroke="#94a3b8" strokeWidth="0.9" strokeLinecap="round" />

      <rect x="41.5" y="61.8" width="27" height="11.6" rx="0.6" fill="#b07e4b" stroke="#5c4632" strokeWidth="0.55" />
      <line x1="42" y1="67.6" x2="68" y2="67.6" stroke="#edd0ae" strokeWidth="1.2" />
      <rect x="46" y="64" width="18" height="2.2" rx="0.5" fill="#1e293b" />

      <rect x="70.5" y="61.8" width="24" height="11.6" rx="0.6" fill="#ffffff" stroke="#64748b" strokeWidth="0.55" />
      <line x1="78.5" y1="64.5" x2="86.5" y2="64.5" stroke="#94a3b8" strokeWidth="0.9" strokeLinecap="round" />

      {/* Base soporte del televisor */}
      <rect x="52" y="53.5" width="6" height="4.5" fill="#334155" stroke="#0f172a" strokeWidth="0.5" />
      <rect x="44" y="56.8" width="22" height="1.4" rx="0.5" fill="#1e293b" />

      {/* Pantalla de TV protagonista (frontal) */}
      <rect x="33" y="26.5" width="44" height="27" rx="1.6" fill="#0f172a" stroke="#1e293b" strokeWidth="0.7" />
      <rect x="34.8" y="28.3" width="40.4" height="23.4" rx="0.6" fill="url(#modully-tv-screen)" />
      {/* Reflejo diagonal sutil en pantalla */}
      <polygon points="35.5,28.8 49,28.8 39,51.2 35.5,51.2" fill="#ffffff" opacity="0.14" />
      <circle cx="55" cy="52.6" r="0.6" fill="#94a3b8" />
    </svg>
  );
};

const CATEGORIAS_RAPIDAS: { id: SectionId; titulo: string }[] = [
  { id: 'cocinas', titulo: 'Cocinas Integrales' },
  { id: 'closets', titulo: 'Closets & Vestidores' },
  { id: 'bano', titulo: 'Muebles de Baño' },
  { id: 'tv', titulo: 'Centros de Entretenimiento' },
];

export const Inicio: React.FC<{
  section: SectionId;
  icons: Record<SectionId, React.ReactNode>;
  correoSesion?: string | null;
  onProducto: (id: SectionId) => void;
  onAbrirCategoria: (id: SectionId) => void;
  onFase: (f: Fase) => void;
  onCrearDesdeCero: () => void;
  onIrProyectos: () => void;
  onAbrirProyecto: (seccion: SectionId, datos: unknown, producto: ProductoActivo) => void;
  avance: Avance;
}> = ({ section, correoSesion, onAbrirCategoria, onFase, onCrearDesdeCero, onIrProyectos, onAbrirProyecto, avance }) => {
  const [sesion, setSesion] = useState<boolean>(!!correoSesion);
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);
  const [totalProyectos, setTotalProyectos] = useState<number>(0);
  const [recientes, setRecientes] = useState<TarjetaReciente[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState<boolean>(nubeConfigurada);
  const [bibPorCategoria, setBibPorCategoria] = useState<Partial<Record<SectionId, number>>>({});

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      if (!nubeConfigurada) {
        if (vivo) setCargandoRecientes(false);
        return;
      }
      try {
        const s = await sesionActual();
        if (!vivo) return;
        setSesion(!!s);
        const metaNombre = (s?.user.user_metadata?.nombre as string | undefined)?.trim();
        setNombreUsuario(metaNombre || (s?.user.email ? s.user.email.split('@')[0] : null));
        if (!s) {
          setTotalProyectos(0);
          setRecientes([]);
          setBibPorCategoria({});
          setCargandoRecientes(false);
          return;
        }
        setCargandoRecientes(true);
        const [proyectos, biblioteca] = await Promise.all([
          listarProyectos().catch(() => [] as Proyecto[]),
          listarBiblioteca().catch(() => [] as DisenoBiblioteca[]),
        ]);
        if (!vivo) return;
        setTotalProyectos(proyectos.length);

        const conteo: Partial<Record<SectionId, number>> = {};
        biblioteca.forEach(b => {
          const sec = b.seccion as SectionId;
          conteo[sec] = (conteo[sec] ?? 0) + 1;
        });
        setBibPorCategoria(conteo);

        const topProyectos = proyectos.slice(0, 6);
        const disenosPorProyecto = await Promise.all(
          topProyectos.map(async p => ({ proyecto: p, disenos: await listarDisenos(p.id).catch(() => [] as DisenoGuardado[]) }))
        );
        if (!vivo) return;

        const items: { proyecto: Proyecto; diseno: DisenoGuardado }[] = [];
        disenosPorProyecto.forEach(({ proyecto, disenos }) => {
          disenos.forEach(diseno => items.push({ proyecto, diseno }));
        });
        items.sort((a, b) => new Date(b.diseno.updated_at).getTime() - new Date(a.diseno.updated_at).getTime());

        const top6 = items.slice(0, 6);
        const docsMap = await Promise.all(
          top6.map(async ({ diseno }) => {
            if (diseno.aprobado_at) return [diseno.id, 'Completado' as EstadoProyecto] as const;
            const docs = await listarDocumentos(diseno.id).catch(() => []);
            const tieneCotizacion = docs.some(d => d.tipo === 'cotizacion');
            return [diseno.id, (tieneCotizacion ? 'Presupuestado' : 'En Diseño') as EstadoProyecto] as const;
          })
        );
        if (!vivo) return;
        const estadoPorId = Object.fromEntries(docsMap) as Record<string, EstadoProyecto>;

        const tarjetas: TarjetaReciente[] = top6.map(({ proyecto, diseno }) => {
          const dDatos = (diseno.datos ?? {}) as { modules?: unknown[] };
          const modCant = Array.isArray(dDatos.modules) ? dDatos.modules.length : 0;
          return {
            id: diseno.id,
            titulo: diseno.nombre || SECTIONS[diseno.seccion as SectionId]?.name || 'Proyecto',
            subtitulo: `Cliente: ${proyecto.cliente}${proyecto.nombre ? ` · ${proyecto.nombre}` : ''}`,
            modulosTxt: modCant > 0 ? `${modCant} ${modCant === 1 ? 'módulo' : 'módulos'}` : undefined,
            seccion: (SECTIONS[diseno.seccion as SectionId] ? diseno.seccion : 'cocinas') as SectionId,
            fecha: fechaCorta(diseno.updated_at),
            estado: estadoPorId[diseno.id] ?? 'En Diseño',
            datos: diseno.datos,
            producto: {
              id: diseno.id,
              nombre: diseno.nombre,
              proyectoId: proyecto.id,
              cliente: proyecto.cliente,
              aprobado: !!diseno.aprobado_at,
            },
          };
        });

        if (tarjetas.length < 6) {
          for (const p of topProyectos) {
            if (tarjetas.length >= 6) break;
            if (!items.some(it => it.proyecto.id === p.id)) {
              tarjetas.push({
                id: `proj-${p.id}`,
                titulo: p.nombre || p.cliente,
                subtitulo: `Cliente: ${p.cliente}`,
                seccion: 'cocinas',
                fecha: fechaCorta(p.updated_at),
                estado: 'En Diseño',
                datos: null,
              });
            }
          }
        }

        setRecientes(tarjetas);
      } finally {
        if (vivo) setCargandoRecientes(false);
      }
    };
    cargar();
    const unsub = alCambiarSesion(() => { cargar(); });
    return () => { vivo = false; unsub(); };
  }, [correoSesion]);

  const hayBorradorEnMemoria = !avance.producto && (avance.bosquejo || avance.modulos > 0);
  const borradorTarjeta: TarjetaReciente | null = hayBorradorEnMemoria
    ? {
        id: 'borrador-actual',
        titulo: `${SECTIONS[section].name} (borrador)`,
        subtitulo: 'Diseño actual en memoria',
        modulosTxt: `${avance.modulos} ${avance.modulos === 1 ? 'módulo' : 'módulos'}${avance.piezas > 0 ? ` · ${avance.piezas} ${avance.piezas === 1 ? 'pieza' : 'piezas'}` : ''}`,
        seccion: section,
        fecha: 'Ahora',
        estado: avance.aprobado ? 'Completado' : 'En Diseño',
        datos: avance.preview ?? null,
        esBorrador: true,
      }
    : null;

  const tarjetasVisibles = (borradorTarjeta ? [borradorTarjeta, ...recientes] : recientes).slice(0, 6);
  const saludo = nombreUsuario
    ? `¡Hola, ${nombreUsuario}! Diseña tu próximo mueble exacto`
    : 'Diseña tu próximo mueble exacto';

  return (
    <div className="space-y-6">
      {/* 1. Hero Banner superior */}
      <section className="rounded-2xl border border-slate-200/80 shadow-sm bg-gradient-to-r from-indigo-50/40 via-white/90 to-amber-50/40 p-6 sm:p-8 space-y-5">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            {saludo}
          </h1>
          <p className="text-sm text-slate-600">
            Sube un boceto a mano, define medidas y obtén despiece, costos y planos en minutos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onFase('bosquejo')}
            className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-left shadow-sm transition-all"
          >
            <Pencil size={17} className="text-slate-200 shrink-0" />
            <div>
              <span className="block text-sm font-semibold tracking-tight leading-tight">Empezar desde un Boceto</span>
              <span className="block text-[11px] text-slate-300 mt-0.5">Sube una foto o dibujo</span>
            </div>
          </button>

          <button
            type="button"
            onClick={onCrearDesdeCero}
            className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-left shadow-sm transition-all"
          >
            <Ruler size={17} className="text-indigo-600 shrink-0" />
            <div>
              <span className="block text-sm font-semibold tracking-tight leading-tight">Crear desde Cero</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">Define espacio y medidas</span>
            </div>
          </button>

          {(avance.producto || hayBorradorEnMemoria) && (
            <button
              type="button"
              onClick={() => onFase('design')}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 border border-indigo-200 text-xs font-medium transition-colors"
            >
              <span>Continuar: {avance.producto ? `${avance.cliente} — ${avance.producto}` : SECTIONS[section].name}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </section>

      {/* 2. Grid de 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna izquierda (más ancha): Proyectos Recientes */}
        <section className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Proyectos recientes</h2>
            <button
              type="button"
              onClick={onIrProyectos}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors shrink-0"
            >
              <span>Ver todos los proyectos</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {cargandoRecientes && tarjetasVisibles.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-3 space-y-3 animate-pulse">
                  <div className="h-24 rounded-xl bg-slate-100" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : tarjetasVisibles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {tarjetasVisibles.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.esBorrador) onFase('design');
                      else if (item.producto) onAbrirProyecto(item.seccion, item.datos, item.producto);
                      else onIrProyectos();
                    }}
                    className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-indigo-200 hover:shadow transition-all overflow-hidden text-left group flex flex-col"
                  >
                    <div className="h-28 bg-slate-50/90 border-b border-slate-100 flex items-center justify-center p-3 relative">
                      <MiniaturaDiseno seccion={item.seccion} datos={item.datos} />
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {item.titulo}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.subtitulo}{item.modulosTxt ? ` · ${item.modulosTxt}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${BADGE_ESTADO[item.estado]}`}>
                          {item.estado}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={11} />
                          {item.fecha}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={onIrProyectos}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <span>Ver todos los proyectos{totalProyectos > 0 ? ` (${totalProyectos})` : ''}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
                <FolderOpen size={18} />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                  {sesion ? 'Aún no tienes proyectos guardados' : 'Inicia sesión para ver tus proyectos recientes'}
                </h3>
                <p className="text-xs text-slate-500">
                  {sesion
                    ? 'Empieza subiendo un boceto o creando un espacio desde cero para guardar tu primer diseño.'
                    : 'Conecta tu cuenta en Proyectos para sincronizar clientes, diseños, renders y planos de corte.'}
                </p>
              </div>
              <div className="pt-1 flex justify-center">
                {sesion ? (
                  <button
                    type="button"
                    onClick={onCrearDesdeCero}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                  >
                    <Plus size={14} />
                    <span>Crear primer diseño</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onIrProyectos}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
                  >
                    <span>Ir a Proyectos</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Columna derecha: Biblioteca & Inspiración + Cómo funciona Modully */}
        <aside className="lg:col-span-5 xl:col-span-4 space-y-5">
          <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">Biblioteca & Inspiración</h2>
              <p className="text-xs text-slate-500">¿Qué vas a diseñar hoy?</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
              {CATEGORIAS_RAPIDAS.map(cat => {
                const activa = section === cat.id || (cat.id === 'closets' && (section === 'closetfit' || section === 'walking'));
                const cantBib = bibPorCategoria[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onAbrirCategoria(cat.id)}
                    className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border text-center transition-all group ${
                      activa
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-slate-50/60 hover:bg-white border-slate-200/80 hover:border-indigo-200'
                    }`}
                  >
                    {cantBib > 0 && (
                      <span className="absolute right-2 top-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200">
                        {cantBib}
                      </span>
                    )}
                    <div className="group-hover:scale-105 transition-transform">
                      <IlustracionCategoria id={cat.id} />
                    </div>
                    <span className="text-xs font-semibold tracking-tight text-slate-900 leading-tight">
                      {cat.titulo}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Cómo funciona Modully</h3>
              <p className="text-xs text-slate-500">Guía rápida</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2.5">
              {[
                { titulo: '1. Sube tu idea', desc: 'Toma foto a un boceto o define medidas.' },
                { titulo: '2. Ajusta en 3D', desc: 'Modifica módulos, acabados y colores.' },
                { titulo: '3. Descarga entregables', desc: 'Render, planos, láminas y despiece.' },
              ].map(paso => (
                <div key={paso.titulo} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-1">
                  <div className="text-xs font-semibold text-slate-900">{paso.titulo}</div>
                  <div className="text-[11px] text-slate-500 leading-snug">{paso.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
