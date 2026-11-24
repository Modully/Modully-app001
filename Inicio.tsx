import React from 'react';
import { SECTIONS, SectionId } from './sections';

/**
 * Pantalla de Inicio: punto de partida común a todas las secciones (productos).
 * Muestra "Continuar donde quedé" (la siguiente fase pendiente del producto abierto),
 * los productos para elegir uno y el camino de trabajo de Modully, de la toma de medidas al render,
 * con el avance de cada fase y un acceso directo a ella.
 */

export type Fase = 'bosquejo' | 'design' | 'listado' | 'laminas' | 'planos' | 'render';

/** Lo que la app sabe del diseño abierto, para marcar el avance. */
export interface Avance {
  /** nombre del producto/proyecto abierto, si hay uno */
  producto: string | null;
  cliente: string | null;
  /** hay un boceto aceptado o ya hay módulos armados */
  bosquejo: boolean;
  /** módulos puestos en el diseño */
  modulos: number;
  /** piezas de la lista de corte (0 = aún sin convertir a módulos) */
  piezas: number;
  /** el diseño actual está aprobado */
  aprobado: boolean;
}

const ORDEN: SectionId[] = ['cocinas', 'closets', 'closetfit', 'walking', 'bano', 'tv', 'puertas'];

const FASES: { id: Fase; titulo: string; texto: string }[] = [
  { id: 'bosquejo', titulo: 'Bosquejo', texto: 'Foto de un boceto a mano alzada, o las medidas, convertidas en el producto.' },
  { id: 'design', titulo: 'Diseño', texto: 'Ajusta módulos, puertas, cajones y accesorios en 3D.' },
  { id: 'listado', titulo: 'Listado', texto: 'Lista de piezas con cantos y Excel para CorteCloud.' },
  { id: 'laminas', titulo: 'Láminas', texto: 'Acomodo en láminas, aprovechamiento y retazos.' },
  { id: 'planos', titulo: 'Planos', texto: 'Hoja por módulo con vistas, cotas y lista; PDF.' },
  { id: 'render', titulo: 'Render', texto: 'Imagen del diseño para mostrar al cliente.' },
];

type Estado = 'hecho' | 'siguiente' | 'pendiente';

/** Estado de cada fase según lo avanzado. El render no se puede saber desde aquí: queda como paso final. */
function estados(a: Avance): Record<Fase, Estado> {
  const hecho: Record<Fase, boolean> = {
    bosquejo: a.bosquejo || a.modulos > 0 || a.piezas > 0, // si hay diseño armado, la fase de partida ya pasó
    design: a.piezas > 0 && a.aprobado, // el diseño está listo cuando tiene piezas y está aprobado
    listado: a.aprobado,
    laminas: a.aprobado,
    planos: a.aprobado,
    render: false,
  };
  const out = {} as Record<Fase, Estado>;
  let siguienteMarcada = false;
  for (const f of FASES) {
    if (hecho[f.id]) out[f.id] = 'hecho';
    else if (!siguienteMarcada) { out[f.id] = 'siguiente'; siguienteMarcada = true; }
    else out[f.id] = 'pendiente';
  }
  return out;
}

/** Siguiente paso pendiente y por qué. Si hay diseño aprobado, el siguiente es mostrarlo (render). */
function siguientePaso(a: Avance, est: Record<Fase, Estado>): { fase: Fase; texto: string } {
  if (est.bosquejo === 'siguiente') return { fase: 'bosquejo', texto: 'Empieza con el bosquejo: la foto de un boceto o las medidas.' };
  if (est.design === 'siguiente') {
    if (a.piezas > 0) return { fase: 'design', texto: 'Revisa el diseño y apruébalo para crear el listado, las láminas y los planos.' };
    return { fase: 'design', texto: a.modulos > 0 ? 'Ya tienes cubos: ajusta el diseño y conviértelos a módulos para sacar las piezas.' : 'Arma el diseño en 3D con los módulos.' };
  }
  return { fase: 'render', texto: 'Diseño aprobado: genera el render para mostrar al cliente.' };
}

export const Inicio: React.FC<{ section: SectionId; icons: Record<SectionId, React.ReactNode>; onProducto: (id: SectionId) => void; onFase: (f: Fase) => void; avance: Avance }> = ({ section, icons, onProducto, onFase, avance }) => {
  const est = estados(avance);
  const paso = siguientePaso(avance, est);
  const titulo = FASES.find(f => f.id === paso.fase)!.titulo;
  const hayAvance = avance.bosquejo || avance.modulos > 0 || avance.piezas > 0 || !!avance.producto;

  return (
    <div className="max-w-5xl space-y-8">
      {hayAvance && (
        <button onClick={() => onFase(paso.fase)} className="w-full flex items-center gap-4 p-5 rounded-3xl bg-indigo-600 text-white text-left shadow-lg hover:bg-indigo-700 transition-all">
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-200">
              Continuar donde quedé · {SECTIONS[section].name}{avance.producto ? ` · ${avance.producto}` : ''}{avance.cliente ? ` (${avance.cliente})` : ''}
            </span>
            <span className="block text-lg font-black uppercase tracking-tight mt-0.5">{titulo}</span>
            <span className="block text-[11px] font-bold text-indigo-100 mt-0.5">{paso.texto}</span>
          </span>
          <span className="shrink-0 text-2xl font-black">→</span>
        </button>
      )}
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
            const e = est[f.id];
            const sinPiezas = avance.piezas === 0 && (f.id === 'laminas' || f.id === 'planos');
            const borde = e === 'siguiente' ? 'border-indigo-400 ring-2 ring-indigo-100' : e === 'hecho' ? 'border-emerald-200' : 'border-slate-200';
            const num = e === 'hecho' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-600';
            return (
              <button key={f.id} onClick={() => onFase(f.id)} className={`flex gap-3 p-4 rounded-2xl border bg-white text-left hover:border-indigo-400 transition-all ${borde}`}>
                <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm font-black ${num}`}>{e === 'hecho' ? '✓' : i + 1}</span>
                <span>
                  <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">
                    {f.titulo}
                    {e === 'siguiente' && <span className="ml-2 align-middle text-[9px] font-black text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">Siguiente</span>}
                    {e === 'hecho' && <span className="ml-2 align-middle text-[9px] font-black text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Listo</span>}
                  </span>
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
};
