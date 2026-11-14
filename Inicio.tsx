import React from 'react';
import { SECTIONS, SectionId } from './sections';

/**
 * Pantalla de Inicio: punto de partida común a todas las secciones (productos).
 * Muestra los productos para elegir uno y el camino de trabajo de Modully, de la toma de medidas al render,
 * con un acceso directo a cada fase.
 */

export type Fase = 'bosquejo' | 'design' | 'listado' | 'laminas' | 'planos' | 'render';

const ORDEN: SectionId[] = ['cocinas', 'closets', 'closetfit', 'walking', 'bano', 'tv', 'puertas'];

const FASES: { id: Fase; titulo: string; texto: string }[] = [
  { id: 'bosquejo', titulo: 'Bosquejo', texto: 'Foto de un boceto a mano alzada, o las medidas, convertidas en el producto.' },
  { id: 'design', titulo: 'Diseño', texto: 'Ajusta módulos, puertas, cajones y accesorios en 3D.' },
  { id: 'listado', titulo: 'Listado', texto: 'Lista de piezas con cantos y Excel para CorteCloud.' },
  { id: 'laminas', titulo: 'Láminas', texto: 'Acomodo en láminas, aprovechamiento y retazos.' },
  { id: 'planos', titulo: 'Planos', texto: 'Hoja por módulo con vistas, cotas y lista; PDF.' },
  { id: 'render', titulo: 'Render', texto: 'Imagen del diseño para mostrar al cliente.' },
];

export const Inicio: React.FC<{ section: SectionId; icons: Record<SectionId, React.ReactNode>; onProducto: (id: SectionId) => void; onFase: (f: Fase) => void; piezas: number }> = ({ section, icons, onProducto, onFase, piezas }) => (
  <div className="max-w-5xl space-y-8">
    <div>
      <div className="text-[10px] font-black text-slate-400 uppercase mb-3">Qué vas a diseñar</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ORDEN.map(id => (
          <button key={id} onClick={() => onProducto(id)} className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${id === section ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400'}`}>
            <span className={id === section ? 'text-white' : 'text-indigo-600'}>{icons[id]}</span>
            <span className="text-xs font-black uppercase tracking-tight">{SECTIONS[id].name}</span>
          </button>
        ))}
      </div>
    </div>
    <div>
      <div className="text-[10px] font-black text-slate-400 uppercase mb-3">Camino de trabajo · {SECTIONS[section].name}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FASES.map((f, i) => {
          const sinPiezas = piezas === 0 && (f.id === 'laminas' || f.id === 'planos');
          return (
            <button key={f.id} onClick={() => onFase(f.id)} className="flex gap-3 p-4 rounded-2xl border border-slate-200 bg-white text-left hover:border-indigo-400 transition-all">
              <span className="w-8 h-8 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black">{i + 1}</span>
              <span>
                <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">{f.titulo}</span>
                <span className="block text-[11px] font-bold text-slate-400 mt-0.5">{f.texto}</span>
                {sinPiezas && <span className="block text-[10px] font-bold text-amber-700 mt-1">Aún sin piezas: convierte los cubos a módulos en Diseño.</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
