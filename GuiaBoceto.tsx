import React from 'react';

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


/** Cocina con isla vista desde arriba: todas las distancias salen del punto 0 (la esquina interior del muro A y el muro B) */
const EjemploIsla: React.FC = () => {
  const ink = '#475569', az = '#4f46e5';
  const f = "'Segoe Print','Comic Sans MS',cursive";
  const t = (x: number, y: number, s: string, size = 10, anchor: 'start' | 'middle' | 'end' = 'middle', color = ink) => (
    <text x={x} y={y} fontSize={size} fontWeight={700} fill={color} textAnchor={anchor} fontFamily={f}>{s}</text>
  );
  // escala: 1 mm = 0,1 px; el punto 0 está en (60, 96)
  const X = (mm: number) => 60 + mm / 10, Y = (mm: number) => 96 + mm / 10;
  return (
    <svg viewBox="0 0 640 400" className="w-full h-auto rounded-xl border border-slate-200 bg-white" role="img" aria-label="Ejemplo de boceto de una cocina con isla vista desde arriba">
      <defs>
        <pattern id="cuadricula2" width={16} height={16} patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e2e8f0" strokeWidth={0.6} /></pattern>
        <pattern id="rayas2" width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={7} stroke="#94a3b8" strokeWidth={1.2} /></pattern>
      </defs>
      <rect width={640} height={400} fill="url(#cuadricula2)" />
      {t(320, 16, "vista superior · todas las distancias desde el punto 0", 11, "middle", az)}

      {/* muros A (arriba) y B (izquierda) sombreados */}
      <rect x={X(0) - 10} y={Y(0) - 10} width={X(4200) - X(0) + 10} height={10} fill="url(#rayas2)" stroke={ink} strokeWidth={0.8} />
      <rect x={X(0) - 10} y={Y(0) - 10} width={10} height={Y(2800) - Y(0) + 10} fill="url(#rayas2)" stroke={ink} strokeWidth={0.8} />
      {t(X(2100), Y(0) - 14, 'muro A', 10)}
      <text x={X(0) - 14} y={Y(1400)} fontSize={10} fontWeight={700} fill={ink} textAnchor="middle" transform={`rotate(-90 ${X(0) - 14} ${Y(1400)})`} fontFamily={f}>muro B</text>

      {/* nevera en la esquina (espacio) */}
      <rect x={X(0)} y={Y(0)} width={70} height={65} fill="none" stroke={ink} strokeWidth={1.2} strokeDasharray="5 3" />
      {t(X(350), Y(360), 'nevera', 10)}

      {/* bajos del muro A: poceta y estufa */}
      <rect x={X(700)} y={Y(0)} width={X(4200) - X(700)} height={60} fill="none" stroke={ink} strokeWidth={1.4} />
      <rect x={X(1100)} y={Y(100)} width={80} height={40} rx={4} fill="none" stroke={ink} strokeWidth={1.2} />
      <rect x={X(1140)} y={Y(160)} width={32} height={26} rx={3} fill="none" stroke={ink} strokeWidth={1} />
      {t(X(1500), Y(250), 'poceta', 10)}
      <rect x={X(2700)} y={Y(60)} width={60} height={45} fill="none" stroke={ink} strokeWidth={1.2} />
      {[[2780, 160], [2920, 160], [2780, 300], [2920, 300]].map(([x, y], i) => <circle key={i} cx={X(x)} cy={Y(y)} r={4.5} fill="none" stroke={ink} />)}
      {t(X(3000), Y(560), 'estufa', 10)}

      {/* bajos del muro B */}
      <rect x={X(0) + 70} y={Y(650)} width={60} height={Y(2800) - Y(650)} fill="none" stroke={ink} strokeWidth={1.4} />

      {/* isla */}
      <rect x={X(1500)} y={Y(1500)} width={200} height={90} fill="none" stroke={ink} strokeWidth={1.6} />
      <line x1={X(1500)} y1={Y(1500) + 50} x2={X(3500)} y2={Y(1500) + 50} stroke={ink} strokeWidth={0.8} strokeDasharray="3 3" />
      {t(X(2500), Y(1500) + 28, 'isla', 11)}
      {t(X(2500), Y(1500) + 68, 'barra', 9)}
      {[0, 1, 2, 3].map(i => <circle key={i} cx={X(1750 + i * 500)} cy={Y(1500) + 106} r={7} fill="none" stroke={ink} strokeWidth={1} />)}

      {/* punto 0 */}
      <circle cx={X(0)} cy={Y(0)} r={7} fill="#fff" stroke={az} strokeWidth={2} />
      <line x1={X(0) - 11} y1={Y(0)} x2={X(0) + 11} y2={Y(0)} stroke={az} strokeWidth={1.4} />
      <line x1={X(0)} y1={Y(0) - 11} x2={X(0)} y2={Y(0) + 11} stroke={az} strokeWidth={1.4} />
      {t(X(0) + 6, Y(0) - 14, '0', 13, 'start', az)}

      {/* cotas desde el 0 sobre el muro A */}
      {[{ mm: 1500, fila: 0, s: 'poceta 1.500' }, { mm: 3000, fila: 1, s: 'estufa 3.000' }, { mm: 4200, fila: 2, s: 'muro A 4.200' }].map(c => {
        const y = Y(0) - 28 - c.fila * 14;
        return (
          <g key={c.s}>
            <line x1={X(0)} y1={y} x2={X(c.mm)} y2={y} stroke={az} strokeWidth={1.1} />
            <line x1={X(0)} y1={y - 4} x2={X(0)} y2={y + 4} stroke={az} /><line x1={X(c.mm)} y1={y - 4} x2={X(c.mm)} y2={y + 4} stroke={az} />
            {c.mm < 4200 && <line x1={X(c.mm)} y1={y + 4} x2={X(c.mm)} y2={Y(0) + 8} stroke={az} strokeWidth={0.7} strokeDasharray="2 2" />}
            {t(X(c.mm) - 4, y - 3, c.s, 9, 'end', az)}
          </g>
        );
      })}
      {/* cotas desde el 0 sobre el muro B */}
      <line x1={X(0) - 26} y1={Y(0)} x2={X(0) - 26} y2={Y(1500)} stroke={az} strokeWidth={1.1} />
      <line x1={X(0) - 30} y1={Y(0)} x2={X(0) - 22} y2={Y(0)} stroke={az} /><line x1={X(0) - 30} y1={Y(1500)} x2={X(0) - 22} y2={Y(1500)} stroke={az} />
      <text x={X(0) - 29} y={Y(750)} fontSize={9} fontWeight={700} fill={az} textAnchor="middle" transform={`rotate(-90 ${X(0) - 29} ${Y(750)})`} fontFamily={f}>isla a 1.500</text>
      <line x1={X(0) - 40} y1={Y(0)} x2={X(0) - 40} y2={Y(2800)} stroke={az} strokeWidth={1.1} />
      <line x1={X(0) - 44} y1={Y(2800)} x2={X(0) - 36} y2={Y(2800)} stroke={az} />
      <text x={X(0) - 43} y={Y(2000)} fontSize={9} fontWeight={700} fill={az} textAnchor="middle" transform={`rotate(-90 ${X(0) - 43} ${Y(2000)})`} fontFamily={f}>muro B 2.800</text>
      {/* la isla desde el 0 sobre el muro A, debajo de la isla */}
      <line x1={X(0)} y1={Y(2750)} x2={X(1500)} y2={Y(2750)} stroke={az} strokeWidth={1.1} />
      <line x1={X(0)} y1={Y(2750) - 4} x2={X(0)} y2={Y(2750) + 4} stroke={az} /><line x1={X(1500)} y1={Y(2750) - 4} x2={X(1500)} y2={Y(2750) + 4} stroke={az} />
      {t(X(750), Y(2750) + 12, '1.500', 9, 'middle', az)}
      <line x1={X(1500)} y1={Y(2750)} x2={X(3500)} y2={Y(2750)} stroke={ink} strokeWidth={1} />
      <line x1={X(1500)} y1={Y(2750) - 4} x2={X(1500)} y2={Y(2750) + 4} stroke={ink} /><line x1={X(3500)} y1={Y(2750) - 4} x2={X(3500)} y2={Y(2750) + 4} stroke={ink} />
      {t(X(2500), Y(2750) + 12, 'isla 2.000 × 900', 9)}

      {/* lo que hay que dibujar, en pocas palabras */}
      <g transform="translate(496 96)">
        <rect x={0} y={0} width={136} height={200} rx={8} fill="#fff" stroke="#cbd5e1" />
        {t(68, 18, 'En la vista superior', 10, 'middle', az)}
        {['⊕ el 0 es la esquina interior', 'poceta: distancia al centro', 'estufa: distancia al centro', 'isla: dónde empieza y su', 'largo × ancho', 'fondo del pasillo libre', 'muro B: su largo total'].map((s, i) => t(8, 38 + i * 21, s, 8.5, 'start'))}
      </g>
    </svg>
  );
};

/* ───────── Closet, centro de entretenimiento y mueble de baño ───────── */

type ProductoGuia = 'cocina' | 'closet' | 'tv' | 'bano';
const NOMBRE_GUIA: Record<ProductoGuia, string> = { cocina: 'Cocina', closet: 'Closet', tv: 'Centro de TV', bano: 'Baño' };
export const guiaDe = (producto?: string): ProductoGuia => (producto === 'closets' || producto === 'closetfit' || producto === 'walking' ? 'closet' : producto === 'tv' ? 'tv' : producto === 'bano' ? 'bano' : 'cocina');

const NORMAS_CLOSET: { n: number; titulo: string; texto: string }[] = [
  { n: 1, titulo: 'Ancho total del espacio', texto: 'De muro a muro, en una sola cota larga.' },
  { n: 2, titulo: 'Altura del piso al techo', texto: 'Una cota vertical con la altura libre.' },
  { n: 3, titulo: 'Muros sombreados', texto: 'Con rayitas diagonales: la app deduce de ahí qué lados llevan marco y dilatada y cuál lleva costado propio.' },
  { n: 4, titulo: 'Ancho de cada cuerpo', texto: 'Las cotas de izquierda a derecha, en el orden en que se dibujan.' },
  { n: 5, titulo: 'Alturas clave', texto: 'Zócalo, cajonero (hasta dónde sube) y maletero (desde dónde empieza).' },
  { n: 6, titulo: 'Qué lleva cada cuerpo', texto: 'Tubo (corto o largo), entrepaños, cuántos cajones, maletero, zapatero.' },
  { n: 7, titulo: 'Puertas', texto: 'Sin puertas, batientes o corredizas, y cuántas hojas.' },
  { n: 8, titulo: 'En L, en U o walking closet: vista superior', texto: 'Dibuja la planta con los muros acotados, la entrada y el brazo.' },
  { n: 9, titulo: 'Obstáculos', texto: 'Ventana, puerta del cuarto, tomas o vigas: dónde están y a qué altura.' },
  { n: 10, titulo: 'Fondo, solo si no es el normal', texto: 'La profundidad escrita sobre una línea inclinada en una esquina (lo normal es 55).' },
];

const NORMAS_TV: { n: number; titulo: string; texto: string }[] = [
  { n: 1, titulo: 'Ancho del muro o del nicho', texto: 'De lado a lado, en una cota larga.' },
  { n: 2, titulo: 'Altura del piso al techo', texto: 'Una cota vertical.' },
  { n: 3, titulo: 'El televisor', texto: 'Las pulgadas y la altura del piso al centro de la pantalla (o a su borde de abajo).' },
  { n: 4, titulo: 'Mueble de abajo', texto: 'Ancho, alto y fondo; si es flotante, a qué altura del piso; y qué lleva: puertas, cajones o abierto.' },
  { n: 5, titulo: 'Repisas o columnas a los lados', texto: 'Cuántas, su ancho, su alto y la separación.' },
  { n: 6, titulo: 'Espaldar o alistonado', texto: 'Hasta dónde llega y de qué alto.' },
  { n: 7, titulo: 'Puntos eléctricos y de datos', texto: 'Toma del televisor, HDMI y tomas: distancia desde el extremo izquierdo y altura al piso.' },
  { n: 8, titulo: 'Muros sombreados', texto: 'Con rayitas diagonales, para saber qué lados tienen muro.' },
  { n: 9, titulo: 'Luz LED o cableado oculto', texto: 'Dónde va, si lo lleva.' },
];

const NORMAS_BANO: { n: number; titulo: string; texto: string }[] = [
  { n: 1, titulo: 'Ancho del mueble o del espacio', texto: 'De muro a muro o el ancho que ocupa el mueble.' },
  { n: 2, titulo: 'Altura total y del mueble', texto: 'Si es flotante, a qué altura del piso queda.' },
  { n: 3, titulo: 'Fondo del mueble', texto: 'La profundidad escrita sobre una línea inclinada (lo normal es 46).' },
  { n: 4, titulo: 'El lavamanos', texto: 'Si va sobrepuesto, encastrado o integrado; su ancho y su centro.' },
  { n: 5, titulo: 'Puntos de agua y desagüe', texto: 'Distancia desde el extremo izquierdo y altura al piso de cada uno.' },
  { n: 6, titulo: 'Qué lleva el mueble', texto: 'Puertas, cajones, entrepaño; lo que no sea evidente, escrito dentro de la caja.' },
  { n: 7, titulo: 'Espejo o botiquín', texto: 'Ancho, alto y a qué altura del piso empieza.' },
  { n: 8, titulo: 'Columna o torre lateral', texto: 'Su ancho y su alto, si existe.' },
  { n: 9, titulo: 'Muros sombreados y obstáculos', texto: 'Ventana, puerta, toma o ducha cerca: dónde están.' },
];

const FUENTE = "'Segoe Print','Comic Sans MS',cursive";
const TX = (x: number, y: number, s: string, size = 10, anchor: 'start' | 'middle' | 'end' = 'middle', color = '#475569') => (
  <text x={x} y={y} fontSize={size} fontWeight={700} fill={color} textAnchor={anchor} fontFamily={FUENTE}>{s}</text>
);
const AZ = '#4f46e5', INK = '#475569';
const Defs: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    <pattern id={'c' + id} width={16} height={16} patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e2e8f0" strokeWidth={0.6} /></pattern>
    <pattern id={'r' + id} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={7} stroke="#94a3b8" strokeWidth={1.2} /></pattern>
  </defs>
);
const Cota: React.FC<{ x1: number; y1: number; x2: number; y2: number; s?: string; v?: boolean }> = ({ x1, y1, x2, y2, s, v }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={AZ} strokeWidth={1.2} />
    {v ? (<><line x1={x1 - 6} y1={y1} x2={x1 + 6} y2={y1} stroke={AZ} /><line x1={x2 - 6} y1={y2} x2={x2 + 6} y2={y2} stroke={AZ} /></>) : (<><line x1={x1} y1={y1 - 6} x2={x1} y2={y1 + 6} stroke={AZ} /><line x1={x2} y1={y2 - 6} x2={x2} y2={y2 + 6} stroke={AZ} /></>)}
    {s && (v ? <text x={x1 - 8} y={(y1 + y2) / 2} fontSize={12} fontWeight={800} fill={AZ} textAnchor="middle" transform={'rotate(-90 ' + (x1 - 8) + ' ' + (y1 + y2) / 2 + ')'} fontFamily={FUENTE}>{s}</text> : TX((x1 + x2) / 2, y1 - 5, s, 12, 'middle', AZ))}
  </g>
);

const EjemploCloset: React.FC = () => {
  const x0 = 56, w = 144; // tres cuerpos de 144 px
  return (
    <svg viewBox="0 0 640 380" className="w-full h-auto rounded-xl border border-slate-200 bg-white" role="img" aria-label="Ejemplo de boceto de un closet">
      <Defs id="cl" />
      <rect width={640} height={380} fill="url(#ccl)" />
      <rect x={42} y={46} width={14} height={256} fill="url(#rcl)" stroke={INK} strokeWidth={0.8} />
      <rect x={x0 + 3 * w} y={46} width={14} height={256} fill="url(#rcl)" stroke={INK} strokeWidth={0.8} />
      <rect x={42} y={36} width={3 * w + 28} height={10} fill="url(#rcl)" stroke={INK} strokeWidth={0.8} />
      <rect x={42} y={302} width={3 * w + 28} height={10} fill="url(#rcl)" stroke={INK} strokeWidth={0.8} />
      {[0, 1, 2].map(i => <rect key={i} x={x0 + i * w} y={46} width={w} height={256} fill="none" stroke={INK} strokeWidth={1.4} />)}
      {/* maletero de los tres cuerpos y zócalo */}
      {[0, 1, 2].map(i => (<g key={'m' + i}><line x1={x0 + i * w} y1={96} x2={x0 + (i + 1) * w} y2={96} stroke={INK} />{i === 0 && TX(x0 + w / 2, 76, 'maletero', 10)}<line x1={x0 + i * w} y1={290} x2={x0 + (i + 1) * w} y2={290} stroke={INK} /></g>))}
      {/* cuerpo 1: tubo largo */}
      <line x1={x0 + 14} y1={110} x2={x0 + w - 14} y2={110} stroke={INK} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map(i => <path key={i} d={'M' + (x0 + 28 + i * 24) + ' 110 l-7 14 h14 z'} fill="none" stroke={INK} strokeWidth={0.9} />)}
      {TX(x0 + w / 2, 200, 'tubo largo', 10)}
      {/* cuerpo 2: entrepaños y cajonero */}
      {[132, 164, 196].map(y => <line key={y} x1={x0 + w + 8} y1={y} x2={x0 + 2 * w - 8} y2={y} stroke={INK} />)}
      {TX(x0 + 1.5 * w, 150, 'entrepaños', 10)}
      <rect x={x0 + w} y={214} width={w} height={76} fill="none" stroke={INK} strokeWidth={1.4} />
      {[233, 252, 271].map(y => <line key={y} x1={x0 + w} y1={y} x2={x0 + 2 * w} y2={y} stroke={INK} />)}
      {TX(x0 + 1.5 * w, 246, 'cajones 4', 10)}
      {/* cuerpo 3: dos tubos cortos */}
      <line x1={x0 + 2 * w + 14} y1={110} x2={x0 + 3 * w - 14} y2={110} stroke={INK} strokeWidth={2} />
      <line x1={x0 + 2 * w + 14} y1={196} x2={x0 + 3 * w - 14} y2={196} stroke={INK} strokeWidth={2} />
      {TX(x0 + 2.5 * w, 160, 'tubo corto', 10)}{TX(x0 + 2.5 * w, 250, 'tubo corto', 10)}
      {/* puertas corredizas */}
      <line x1={x0} y1={46} x2={x0 + 3 * w} y2={46} stroke={AZ} strokeWidth={2.2} strokeDasharray="8 4" />
      {TX(x0 + 1.5 * w, 41, 'corredizas · 3 hojas', 9, 'middle', AZ)}
      {/* cotas */}
      <Cota x1={x0} y1={26} x2={x0 + 3 * w} y2={26} s="2.400" />
      <Cota x1={26} y1={36} x2={26} y2={312} s="230" v />
      <Cota x1={x0} y1={332} x2={x0 + w} y2={332} s="80" />
      <Cota x1={x0 + w} y1={332} x2={x0 + 2 * w} y2={332} s="80" />
      <Cota x1={x0 + 2 * w} y1={332} x2={x0 + 3 * w} y2={332} s="80" />
      {TX(x0 + 3 * w + 40, 176, 'maletero a 190', 9, 'start', AZ)}
      {TX(x0 + 3 * w + 40, 250, 'cajonero 80', 9, 'start', AZ)}
      {TX(x0 + 3 * w + 40, 296, 'zócalo 10', 9, 'start', AZ)}
      <line x1={x0 + 3 * w + 14} y1={96} x2={x0 + 3 * w + 36} y2={172} stroke={AZ} strokeWidth={0.8} />
      <line x1={x0 + 3 * w + 14} y1={214} x2={x0 + 3 * w + 36} y2={246} stroke={AZ} strokeWidth={0.8} />
      {/* fondo */}
      <line x1={x0 + 3 * w + 14} y1={312} x2={x0 + 3 * w + 38} y2={332} stroke={INK} strokeWidth={0.8} />
      {TX(x0 + 3 * w + 50, 346, '55', 10, 'start')}
      {/* vista superior de un walking closet */}
      <g transform="translate(535 24)">
        <rect x={0} y={0} width={96} height={118} rx={6} fill="#fff" stroke="#cbd5e1" />
        <rect x={8} y={14} width={80} height={5} fill="url(#rcl)" stroke={INK} strokeWidth={0.6} />
        <rect x={8} y={14} width={5} height={70} fill="url(#rcl)" stroke={INK} strokeWidth={0.6} />
        <rect x={83} y={14} width={5} height={70} fill="url(#rcl)" stroke={INK} strokeWidth={0.6} />
        <rect x={13} y={19} width={70} height={14} fill="none" stroke={INK} strokeWidth={1.4} />
        <rect x={13} y={33} width={14} height={40} fill="none" stroke={INK} strokeWidth={1.4} />
        <rect x={69} y={33} width={14} height={40} fill="none" stroke={INK} strokeWidth={1.4} />
        <line x1={30} y1={84} x2={66} y2={84} stroke={AZ} strokeWidth={2} strokeDasharray="4 3" />
        {TX(48, 98, 'entrada', 9)}{TX(48, 110, 'vista superior', 9)}{TX(48, 10, 'A 2.400', 8.5)}
      </g>
      <Bola x={150} y={22} n={1} /><Bola x={26} y={70} n={2} /><Bola x={49} y={180} n={3} /><Bola x={x0 + 1.5 * w} y={352} n={4} />
      <Bola x={x0 + 3 * w + 24} y={175} n={5} /><Bola x={x0 + w / 2} y={236} n={6} /><Bola x={x0 + 2.5 * w} y={60} n={7} />
      <Bola x={622} y={34} n={8} /><Bola x={400} y={46} n={9} /><Bola x={x0 + 3 * w + 24} y={352} n={10} />
    </svg>
  );
};

const EjemploTV: React.FC = () => {
  const L = 56, R = 476; // muro de 3.000 mm = 420 px
  const xm = (mm: number) => L + mm * 0.14, ym = (mm: number) => 304 - mm * 0.113;
  return (
    <svg viewBox="0 0 640 390" className="w-full h-auto rounded-xl border border-slate-200 bg-white" role="img" aria-label="Ejemplo de boceto de un centro de entretenimiento">
      <Defs id="tv" />
      <rect width={640} height={390} fill="url(#ctv)" />
      <rect x={L - 14} y={46} width={14} height={258} fill="url(#rtv)" stroke={INK} strokeWidth={0.8} />
      <rect x={R} y={46} width={14} height={258} fill="url(#rtv)" stroke={INK} strokeWidth={0.8} />
      <rect x={L - 14} y={36} width={R - L + 28} height={10} fill="url(#rtv)" stroke={INK} strokeWidth={0.8} />
      <rect x={L - 14} y={304} width={R - L + 28} height={10} fill="url(#rtv)" stroke={INK} strokeWidth={0.8} />
      {/* alistonado detrás del televisor */}
      <rect x={xm(450)} y={ym(2150)} width={xm(2550) - xm(450)} height={ym(350) - ym(2150)} fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
      {Array.from({ length: 22 }).map((_, i) => <line key={i} x1={xm(450) + 6 + i * 10.2} y1={ym(2150)} x2={xm(450) + 6 + i * 10.2} y2={ym(350)} stroke="#cbd5e1" strokeWidth={1.2} />)}
      {TX(xm(1500), ym(2150) + 14, 'alistonado', 10)}
      {/* televisor de 65" */}
      <rect x={xm(1500) - 102} y={ym(1300) - 46} width={204} height={92} fill="#fff" stroke={INK} strokeWidth={1.6} />
      {TX(xm(1500), ym(1300) + 4, '65"', 14)}
      {/* repisas laterales */}
      {[0, 1].map(k => [900, 1300, 1700].map(y => <rect key={k + '-' + y} x={k === 0 ? xm(60) : xm(2460) - 6} y={ym(y)} width={xm(440) - xm(60)} height={6} fill="none" stroke={INK} strokeWidth={1.2} />))}
      {TX(xm(250), ym(1950), 'repisas', 10)}
      {/* mueble inferior flotante */}
      <rect x={xm(500)} y={ym(600)} width={xm(2500) - xm(500)} height={ym(200) - ym(600)} fill="none" stroke={INK} strokeWidth={1.6} />
      {[xm(1000), xm(1500), xm(2000)].map(x => <line key={x} x1={x} y1={ym(600)} x2={x} y2={ym(200)} stroke={INK} />)}
      <line x1={xm(1000)} y1={ym(400)} x2={xm(1500)} y2={ym(400)} stroke={INK} /><line x1={xm(1500)} y1={ym(400)} x2={xm(2000)} y2={ym(400)} stroke={INK} />
      {TX(xm(750), ym(400) + 4, 'puertas', 9)}{TX(xm(1250), ym(300) + 12, 'cajones', 9)}{TX(xm(1750), ym(300) + 12, 'cajones', 9)}{TX(xm(2250), ym(400) + 4, 'puertas', 9)}
      {/* puntos eléctricos y de datos */}
      {[{ mm: 1500, h: 500, s: 'toma TV', d: '1.500' }, { mm: 1620, h: 500, s: 'datos', d: '1.620' }, { mm: 2750, h: 300, s: 'toma', d: '2.750' }].map(p => (
        <g key={p.s}>
          <rect x={xm(p.mm) - 5} y={ym(p.h) - 5} width={10} height={10} rx={2} fill="#fff" stroke={AZ} strokeWidth={1.6} />
          <line x1={xm(p.mm)} y1={ym(p.h) + 5} x2={xm(p.mm)} y2={330} stroke={AZ} strokeWidth={0.7} strokeDasharray="2 2" />
          <circle cx={xm(p.mm)} cy={332} r={4} fill="#fff" stroke={AZ} strokeWidth={1.6} />
          {TX(xm(p.mm), p.s === 'datos' ? 368 : 352, p.s + ' ' + p.d, 9, 'middle', AZ)}
        </g>
      ))}
      <line x1={L} y1={332} x2={R} y2={332} stroke="#94a3b8" strokeDasharray="3 3" />
      {/* cotas */}
      <Cota x1={L} y1={26} x2={R} y2={26} s="3.000" />
      <Cota x1={30} y1={36} x2={30} y2={314} s="240" v />
      <line x1={xm(1500) + 112} y1={ym(1300)} x2={xm(1500) + 112} y2={ym(0) + 10} stroke={AZ} strokeWidth={0.8} />
      {TX(xm(1500) + 120, ym(1050), 'centro de pantalla a 130', 9, 'start', AZ)}
      {TX(xm(2500) + 10, ym(400), 'mueble 200 × 40', 9, 'start', AZ)}
      {TX(xm(2500) + 10, ym(400) + 12, 'a 20 del piso', 9, 'start', AZ)}
      {/* fondo */}
      <line x1={R + 14} y1={304} x2={R + 38} y2={322} stroke={INK} strokeWidth={0.8} />
      {TX(R + 44, 336, '40', 10, 'start')}
      <Bola x={150} y={22} n={1} /><Bola x={30} y={80} n={2} /><Bola x={xm(1500)} y={ym(1300) - 56} n={3} /><Bola x={xm(1750)} y={ym(400) - 30} n={4} />
      <Bola x={xm(250)} y={ym(1100)} n={5} /><Bola x={xm(2400)} y={ym(2150) + 6} n={6} /><Bola x={xm(1500) - 62} y={352} n={7} /><Bola x={L - 7} y={170} n={8} />
      <Bola x={xm(1500) + 60} y={ym(1300) + 36} n={9} />
      {TX(560, 120, 'LED en el', 9, 'start')}{TX(560, 132, 'frente de las', 9, 'start')}{TX(560, 144, 'repisas', 9, 'start')}
    </svg>
  );
};

const EjemploBano: React.FC = () => {
  const L = 70, xm = (mm: number) => L + mm * 0.3, ym = (mm: number) => 306 - mm * 0.113;
  return (
    <svg viewBox="0 0 640 390" className="w-full h-auto rounded-xl border border-slate-200 bg-white" role="img" aria-label="Ejemplo de boceto de un mueble de baño">
      <Defs id="ba" />
      <rect width={640} height={390} fill="url(#cba)" />
      <rect x={L - 14} y={46} width={14} height={260} fill="url(#rba)" stroke={INK} strokeWidth={0.8} />
      <rect x={xm(1300)} y={46} width={14} height={260} fill="url(#rba)" stroke={INK} strokeWidth={0.8} />
      <rect x={L - 14} y={36} width={xm(1300) - L + 28} height={10} fill="url(#rba)" stroke={INK} strokeWidth={0.8} />
      <rect x={L - 14} y={306} width={xm(1300) - L + 28} height={10} fill="url(#rba)" stroke={INK} strokeWidth={0.8} />
      {/* espejo */}
      <rect x={xm(250)} y={ym(2000)} width={xm(850) - xm(250)} height={ym(1200) - ym(2000)} fill="none" stroke={INK} strokeWidth={1.4} />
      <line x1={xm(250) + 10} y1={ym(2000) + 38} x2={xm(250) + 40} y2={ym(2000) + 8} stroke="#cbd5e1" strokeWidth={2} />
      {TX(xm(550), ym(1600), 'espejo', 10)}
      {/* mueble flotante con lavamanos sobrepuesto */}
      <rect x={xm(100)} y={ym(850)} width={xm(1000) - xm(100)} height={ym(150) - ym(850)} fill="none" stroke={INK} strokeWidth={1.6} />
      <path d={'M' + xm(350) + ' ' + ym(850) + ' q0 -20 ' + (xm(550) - xm(350)) / 2 + ' -20 q' + (xm(550) - xm(350)) / 2 + ' 0 ' + (xm(550) - xm(350)) / 2 + ' 20'} fill="none" stroke={INK} strokeWidth={1.4} />
      {TX(xm(550), ym(850) - 26, 'lavamanos sobrepuesto', 9)}
      <line x1={xm(550)} y1={ym(850)} x2={xm(550)} y2={ym(500)} stroke={INK} />
      <line x1={xm(100)} y1={ym(620)} x2={xm(1000)} y2={ym(620)} stroke={INK} />
      {TX(xm(325), ym(720), 'cajón', 9)}{TX(xm(775), ym(720), 'cajón', 9)}
      {TX(xm(325), ym(400), 'puerta', 9)}{TX(xm(775), ym(400), 'puerta', 9)}
      {/* columna lateral */}
      <rect x={xm(1000)} y={ym(1800)} width={xm(1300) - xm(1000)} height={ym(0) - ym(1800)} fill="none" stroke={INK} strokeWidth={1.6} />
      <line x1={xm(1000)} y1={ym(900)} x2={xm(1300)} y2={ym(900)} stroke={INK} />
      {TX(xm(1150), ym(1400), 'columna', 9)}
      {/* puntos de agua y desagüe */}
      <line x1={L} y1={336} x2={xm(1300)} y2={336} stroke="#94a3b8" strokeDasharray="3 3" />
      {[{ mm: 330, s: 'agua', d: '330', h: 'h 55' }, { mm: 550, s: 'desagüe', d: '550', h: 'h 50' }].map(p => (
        <g key={p.s}>
          <circle cx={xm(p.mm)} cy={336} r={5} fill="#fff" stroke={AZ} strokeWidth={1.6} />
          <line x1={xm(p.mm)} y1={306} x2={xm(p.mm)} y2={331} stroke={AZ} strokeWidth={0.8} />
          {TX(xm(p.mm), 356, p.s + ' ' + p.d, 9, 'middle', AZ)}
          {TX(xm(p.mm), 368, p.h, 9, 'middle', AZ)}
        </g>
      ))}
      {/* cotas */}
      <Cota x1={L} y1={26} x2={xm(1300)} y2={26} s="1.300" />
      <Cota x1={36} y1={36} x2={36} y2={316} s="230" v />
      <Cota x1={xm(100)} y1={ym(850) - 58} x2={xm(1000)} y2={ym(850) - 58} s="90" />
      <line x1={xm(1000) + 40} y1={ym(850)} x2={xm(1000) + 40} y2={ym(150)} stroke={AZ} strokeWidth={0.8} />
      {TX(xm(1300) + 24, ym(500), 'mueble 85', 9, 'start', AZ)}
      {TX(xm(1300) + 24, ym(500) + 12, 'a 15 del piso', 9, 'start', AZ)}
      {TX(xm(1300) + 24, ym(1600), 'espejo desde 120', 9, 'start', AZ)}
      {/* fondo */}
      <line x1={xm(1300) + 14} y1={306} x2={xm(1300) + 38} y2={326} stroke={INK} strokeWidth={0.8} />
      {TX(xm(1300) + 44, 338, '46', 10, 'start')}
      <Bola x={170} y={22} n={1} /><Bola x={36} y={90} n={2} /><Bola x={xm(1300) + 36} y={316} n={3} /><Bola x={xm(450)} y={ym(850) - 32} n={4} />
      <Bola x={xm(330) - 16} y={356} n={5} /><Bola x={xm(550)} y={ym(300)} n={6} /><Bola x={xm(250) + 14} y={ym(1200) - 14} n={7} />
      <Bola x={xm(1150)} y={ym(1100)} n={8} /><Bola x={L - 7} y={170} n={9} />
    </svg>
  );
};

/** Pestaña contraída con las normas y los ejemplos; la abre el que quiera (o el botón del paso 1) */
export const GuiaBoceto: React.FC<{ abierta: boolean; onCambiar: (v: boolean) => void; producto?: string }> = ({ abierta, onCambiar, producto }) => {
  const ver = abierta;
  const [elegido, setElegido] = React.useState<ProductoGuia | null>(null);
  const g = elegido ?? guiaDe(producto);
  const normas = g === 'closet' ? NORMAS_CLOSET : g === 'tv' ? NORMAS_TV : g === 'bano' ? NORMAS_BANO : NORMAS;
  return (
    <div id="guia-boceto" className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <button onClick={() => onCambiar(!ver)} className="w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Cómo dibujar el boceto</span>
          <span className="block text-[11px] font-bold text-slate-400">Con esta información la app lee todo y el diseño sale en minutos.</span>
        </span>
        <span className="text-[11px] font-black text-indigo-700 shrink-0">{ver ? 'Ocultar' : 'Ver ejemplo y normas'}</span>
      </button>
      {ver && (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(NOMBRE_GUIA) as ProductoGuia[]).map(k => (
              <button key={k} onClick={() => setElegido(k)} className={'rounded-xl px-3 py-1.5 text-xs font-black border ' + (g === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200')}>{NOMBRE_GUIA[k]}</button>
            ))}
          </div>
          <div className="grid md:grid-cols-[1.25fr_1fr] gap-4 items-start">
            <div className="space-y-4">
              {g === 'cocina' && <><Ejemplo /><EjemploIsla /></>}
              {g === 'closet' && <EjemploCloset />}
              {g === 'tv' && <EjemploTV />}
              {g === 'bano' && <EjemploBano />}
            </div>
            <ol className="space-y-2">
              {normas.map(r => (
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
        </>
      )}
    </div>
  );
};
