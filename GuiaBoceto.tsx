import React, { useEffect, useState } from 'react';

/**
 * Normas del boceto: qué debe traer la hoja para que la app lo lea completo y el diseño salga en minutos.
 * Lleva un ejemplo dibujado (vista de frente de una cocina, con sus cotas, muros sombreados y puntos de adecuación)
 * y una vista superior de una cocina en L. Cada número del dibujo es el de la lista.
 */

export const NORMAS: { n: number; titulo: string; texto: string }[] = [
  { n: 1, titulo: 'Medida total del muro', texto: 'Una cota larga con el ancho del muro principal (A), de pared a pared.' },
  { n: 2, titulo: 'Altura del piso al techo', texto: 'Una cota vertical con la altura libre del espacio.' },
  { n: 3, titulo: 'Muros, techo y piso sombreados', texto: 'Con rayitas diagonales: así se sabe dónde hay muro a los lados y si la cocina queda entre muros.' },
  { n: 4, titulo: 'Ancho de cada módulo', texto: 'Las cotas de abajo y de arriba, de izquierda a derecha, en el mismo orden en que se dibujan.' },
  { n: 5, titulo: 'Alturas', texto: 'Muebles bajos, espacio libre hasta los aéreos, aéreos y remate superior.' },
  { n: 6, titulo: 'Espacio de la nevera', texto: 'Acota el espacio que se deja y escribe las medidas de la nevera (ancho y alto).' },
  { n: 7, titulo: 'Puntos de adecuación', texto: 'Agua, desagüe, electricidad y gas debajo del piso, cada uno con su distancia desde el extremo izquierdo del muro y, si puedes, su altura al piso.' },
  { n: 8, titulo: 'Cocina en L o en U: vista superior', texto: 'Dibuja además la planta (vista desde arriba) con los muros A, B y C acotados, y marca cuál es el brazo.' },
  { n: 9, titulo: 'Qué lleva cada módulo', texto: 'Puertas, cajones, abierto, poceta, estufa, campana o platero; escríbelo dentro de la caja si no es evidente.' },
  { n: 10, titulo: 'Fondo, solo si no es el normal', texto: 'La profundidad de los muebles escrita sobre una línea inclinada en una esquina.' },
];

const Bola: React.FC<{ x: number; y: number; n: number }> = ({ x, y, n }) => (
  <g>
    <circle cx={x} cy={y} r={9} fill="#4f46e5" />
    <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">{n}</text>
  </g>
);

const Ejemplo: React.FC = () => {
  const ink = '#475569';
  const t = (x: number, y: number, s: string, size = 10, anchor: 'start' | 'middle' | 'end' = 'middle', color = ink) => (
    <text x={x} y={y} fontSize={size} fontWeight={700} fill={color} textAnchor={anchor} fontFamily="'Segoe Print','Comic Sans MS',cursive">{s}</text>
  );
  return (
    <svg viewBox="0 0 640 380" className="w-full h-auto rounded-xl border border-slate-200 bg-white" role="img" aria-label="Ejemplo de boceto de una cocina">
      <defs>
        <pattern id="cuadricula" width={16} height={16} patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e2e8f0" strokeWidth={0.6} /></pattern>
        <pattern id="rayas" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={7} stroke="#94a3b8" strokeWidth={1.2} /></pattern>
      </defs>
      <rect width={640} height={380} fill="url(#cuadricula)" />

      {/* muros, techo y piso sombreados */}
      <rect x={40} y={40} width={18} height={250} fill="url(#rayas)" stroke={ink} strokeWidth={0.8} />
      <rect x={452} y={40} width={18} height={250} fill="url(#rayas)" stroke={ink} strokeWidth={0.8} />
      <rect x={40} y={30} width={430} height={10} fill="url(#rayas)" stroke={ink} strokeWidth={0.8} />
      <rect x={40} y={290} width={430} height={10} fill="url(#rayas)" stroke={ink} strokeWidth={0.8} />

      {/* nevera (espacio) */}
      <rect x={58} y={96} width={70} height={194} fill="none" stroke={ink} strokeWidth={1.2} strokeDasharray="5 3" />
      {t(93, 190, 'nevera', 11)}
      {t(93, 204, '70', 11)}
      {/* sobrenevera */}
      <rect x={58} y={40} width={70} height={46} fill="none" stroke={ink} strokeWidth={1.4} />
      <line x1={93} y1={40} x2={93} y2={86} stroke={ink} strokeWidth={1} />

      {/* bajos */}
      {[128, 200, 272, 344].map((x, i) => (
        <g key={x}>
          <rect x={x} y={196} width={i === 3 ? 108 : 72} height={94} fill="none" stroke={ink} strokeWidth={1.4} />
          {i === 1 && (<><line x1={x} y1={227} x2={x + 72} y2={227} stroke={ink} /><line x1={x} y1={258} x2={x + 72} y2={258} stroke={ink} /></>)}
          {i === 2 && <line x1={x + 36} y1={196} x2={x + 36} y2={290} stroke={ink} />}
          {i === 3 && <line x1={x + 54} y1={196} x2={x + 54} y2={290} stroke={ink} />}
        </g>
      ))}
      {t(164, 280, '60', 11)}{t(236, 280, '60', 11)}{t(308, 280, '60', 11)}{t(398, 280, '90', 11)}
      {t(236, 246, 'cajones', 9)}
      {t(308, 232, 'poceta', 9)}
      {t(398, 232, 'estufa', 9)}

      {/* aéreos */}
      {[128, 200, 272, 344].map((x, i) => (
        <g key={x}>
          <rect x={x} y={40} width={i === 3 ? 108 : 72} height={100} fill="none" stroke={ink} strokeWidth={1.4} />
          <line x1={x + (i === 3 ? 54 : 36)} y1={40} x2={x + (i === 3 ? 54 : 36)} y2={140} stroke={ink} />
        </g>
      ))}
      {t(398, 100, 'campana', 9)}

      {/* 1 · cota del ancho total */}
      <line x1={58} y1={20} x2={452} y2={20} stroke="#4f46e5" strokeWidth={1.2} />
      <line x1={58} y1={14} x2={58} y2={26} stroke="#4f46e5" /><line x1={452} y1={14} x2={452} y2={26} stroke="#4f46e5" />
      {t(255, 15, '2.400', 12, 'middle', '#4f46e5')}
      <Bola x={150} y={16} n={1} />
      {/* 2 · altura */}
      <line x1={26} y1={30} x2={26} y2={300} stroke="#4f46e5" strokeWidth={1.2} />
      <line x1={20} y1={30} x2={32} y2={30} stroke="#4f46e5" /><line x1={20} y1={300} x2={32} y2={300} stroke="#4f46e5" />
      <text x={14} y={170} fontSize={12} fontWeight={800} fill="#4f46e5" transform="rotate(-90 14 170)" textAnchor="middle" fontFamily="'Segoe Print','Comic Sans MS',cursive">230</text>
      <Bola x={26} y={50} n={2} />
      {/* 3 · sombreado */}
      <Bola x={49} y={165} n={3} />
      {/* 4 · anchos */}
      <Bola x={236} y={312} n={4} />
      {t(236, 326, '60 · 60 · 60 · 90', 10)}
      {/* 5 · alturas (a la derecha) */}
      <line x1={486} y1={196} x2={486} y2={290} stroke="#4f46e5" /><line x1={486} y1={140} x2={486} y2={196} stroke="#4f46e5" /><line x1={486} y1={40} x2={486} y2={140} stroke="#4f46e5" /><line x1={486} y1={30} x2={486} y2={40} stroke="#4f46e5" />
      {t(504, 246, '80', 11, 'start', '#4f46e5')}{t(504, 172, '60', 11, 'start', '#4f46e5')}{t(504, 94, '80', 11, 'start', '#4f46e5')}{t(504, 38, '10', 11, 'start', '#4f46e5')}
      <Bola x={540} y={170} n={5} />
      {/* 6 · nevera */}
      <Bola x={93} y={150} n={6} />
      {t(93, 222, 'alto 180', 9)}
      {/* 9 · descripción */}
      <Bola x={236} y={212} n={9} />

      {/* 7 · puntos de adecuación bajo el piso, con su distancia desde el extremo izquierdo */}
      <line x1={58} y1={338} x2={452} y2={338} stroke="#94a3b8" strokeDasharray="3 3" />
      {[{ x: 98, s: 'agua', d: '40' }, { x: 244, s: 'desagüe', d: '186' }, { x: 308, s: 'luz', d: '250' }, { x: 410, s: 'gas', d: '352' }].map(p => (
        <g key={p.s}>
          <circle cx={p.x} cy={338} r={5} fill="#fff" stroke="#4f46e5" strokeWidth={1.6} />
          <line x1={p.x} y1={300} x2={p.x} y2={333} stroke="#4f46e5" strokeWidth={0.8} />
          {t(p.x, 358, `${p.s} ${p.d}`, 9, 'middle', '#4f46e5')}
        </g>
      ))}
      <Bola x={58} y={358} n={7} />

      {/* 8 · vista superior de una cocina en L */}
      <g transform="translate(500 205)">
        <rect x={0} y={0} width={124} height={150} fill="#fff" stroke="#cbd5e1" rx={6} />
        <rect x={14} y={16} width={96} height={16} fill="none" stroke={ink} strokeWidth={1.4} />
        <rect x={14} y={32} width={18} height={82} fill="none" stroke={ink} strokeWidth={1.4} />
        <rect x={8} y={10} width={108} height={4} fill="url(#rayas)" stroke={ink} strokeWidth={0.6} />
        <rect x={8} y={10} width={4} height={108} fill="url(#rayas)" stroke={ink} strokeWidth={0.6} />
        {t(62, 8, 'A  3.000', 9)}
        <text x={5} y={72} fontSize={9} fontWeight={700} fill={ink} transform="rotate(-90 5 72)" textAnchor="middle" fontFamily="'Segoe Print','Comic Sans MS',cursive">B  2.000</text>
        {t(62, 136, 'vista superior', 9)}
        <Bola x={108} y={104} n={8} />
      </g>
      {/* 10 · fondo */}
      <line x1={470} y1={290} x2={440} y2={310} stroke={ink} strokeWidth={0.8} />
      {t(430, 326, '55', 10)}
      <Bola x={452} y={332} n={10} />
    </svg>
  );
};

export const GuiaBoceto: React.FC<{ abierta?: boolean }> = ({ abierta = true }) => {
  const [ver, setVer] = useState(abierta);
  useEffect(() => { setVer(abierta); }, [abierta]);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <button onClick={() => setVer(v => !v)} className="w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Cómo dibujar el boceto</span>
          <span className="block text-[11px] font-bold text-slate-400">Con esta información la app lee todo y el diseño sale en minutos.</span>
        </span>
        <span className="text-[11px] font-black text-indigo-700 shrink-0">{ver ? 'Ocultar' : 'Ver ejemplo y normas'}</span>
      </button>
      {ver && (
        <div className="grid md:grid-cols-[1.25fr_1fr] gap-4 items-start">
          <Ejemplo />
          <ol className="space-y-2">
            {NORMAS.map(r => (
              <li key={r.n} className="flex gap-2.5">
                <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">{r.n}</span>
                <span>
                  <span className="block text-xs font-black text-slate-800">{r.titulo}</span>
                  <span className="block text-[11px] font-bold text-slate-500">{r.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
