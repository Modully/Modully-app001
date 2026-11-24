import React from 'react';

/**
 * Esquema en perspectiva (isométrica) de un mueble base con su aéreo, para Configuración de módulos.
 * Dibuja lo que cambia con cada respuesta: la apertura del aéreo (pestaña inferior o al ras), la gola del base
 * (melamina o aluminio), el zócalo (en aluminio con 4 patas plásticas por mueble, o corrido) y marca la zona que se está tocando.
 * Medidas de referencia en mm: base 1200 × 560 × 720, zócalo 100, mesón 30, aéreo 1200 × 320 × 700 a 600 sobre el mesón.
 */

export type Foco = 'aereo' | 'gola' | 'zocalo' | 'herrajes' | 'cajon' | 'puente' | null;

export interface PropsEsquema {
  aereoAbre: 'pestana' | 'alras';
  gola: 'melamina' | 'aluminio';
  zocaloAluminio: boolean;
  colorEst: string; // tono de la estructura
  colorFach: string; // tono de la fachada
  foco: Foco;
  puente?: boolean; // doble módulo superior (diseño en puente): un módulo más alto y más profundo sobre el aéreo
}

const C = 0.866, S = 0.5, K = 0.12, OX = 72, OY = 280;
const P = (x: number, y: number, z: number): [number, number] => [OX + (x - y) * C * K, OY + (x + y) * S * K - z * K];
const pts = (a: [number, number][]) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
/** cara frontal (plano y constante) */
const fr = (x0: number, x1: number, z0: number, z1: number, y: number) => pts([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)]);

function sombra(hex: string, f: number): string {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#e5e7eb';
  const n = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f)));
  return `rgb(${n(1)},${n(3)},${n(5)})`;
}

/** Caja con sus tres caras visibles: arriba, lado derecho (x1) y frente (y1) */
const Caja: React.FC<{ x0: number; y0: number; z0: number; w: number; d: number; h: number; color: string }> = ({ x0, y0, z0, w, d, h, color }) => {
  const x1 = x0 + w, y1 = y0 + d, z1 = z0 + h;
  return (
    <g stroke="#475569" strokeWidth={0.5} strokeLinejoin="round">
      <polygon points={pts([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)])} fill={sombra(color, 1.04)} />
      <polygon points={pts([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)])} fill={sombra(color, 0.8)} />
      <polygon points={fr(x0, x1, z0, z1, y1)} fill={color} />
    </g>
  );
};

export const EsquemaModulos: React.FC<PropsEsquema> = ({ aereoAbre, gola, zocaloAluminio, colorEst, colorFach, foco, puente }) => {
  const W = 1200, DB = 560, ZOC = 100, HB = 720, MES = 30, DA = 320, HA = 700;
  const zBaseTop = ZOC + HB; // 820
  const zAer0 = zBaseTop + MES + 600; // 1450
  const puerta = (x0: number, x1: number, z0: number, z1: number, y: number) => <polygon points={fr(x0 + 3, x1 - 3, z0, z1, y)} fill={colorFach} stroke="#475569" strokeWidth={0.5} />;
  const marca = (puntos: string) => <polygon points={puntos} fill="rgba(99,102,241,.12)" stroke="#4f46e5" strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />;
  const yFrente = DB;

  return (
    <svg viewBox={`0 0 220 ${puente ? 450 : 395}`} className="w-full h-auto" role="img" aria-label="Esquema en perspectiva del mueble base y el aéreo">
      <g transform={puente ? 'translate(0,55)' : undefined}>
      {/* muro y piso de referencia */}
      <polygon points={fr(-80, W + 80, 0, 2300, 0)} fill="#f1f5f9" />
      <polygon points={pts([P(-80, 0, 0), P(W + 80, 0, 0), P(W + 80, 700, 0), P(-80, 700, 0)])} fill="#e2e8f0" />

      {/* zócalo: en aluminio, con las 4 patas de plástico de cada mueble; si no, corrido en melamina */}
      {zocaloAluminio ? (
        <g>
          {[[70, 70], [W - 70, 70], [70, DB - 70], [W - 70, DB - 70]].map(([x, y], i) => {
            const [sx, sy0] = P(x, y, 0), [, sy1] = P(x, y, ZOC);
            return <g key={i}><line x1={sx} y1={sy0} x2={sx} y2={sy1} stroke="#0f172a" strokeWidth={3.2} strokeLinecap="round" /><ellipse cx={sx} cy={sy0} rx={3.6} ry={1.8} fill="#0f172a" /></g>;
          })}
          <polygon points={fr(0, W, 0, ZOC, DB - 50)} fill="rgba(203,213,225,.78)" stroke="#94a3b8" strokeWidth={0.6} />
        </g>
      ) : (
        <Caja x0={0} y0={0} z0={0} w={W} d={DB - 50} h={ZOC} color={sombra(colorEst, 0.9)} />
      )}

      {/* mueble base */}
      <Caja x0={0} y0={0} z0={ZOC} w={W} d={DB} h={HB} color={colorEst} />
      {puerta(0, W / 2, ZOC + 5, zBaseTop - 100, yFrente)}
      {puerta(W / 2, W, ZOC + 5, zBaseTop - 100, yFrente)}
      {/* gola: banda de arriba con la ranura para meter los dedos */}
      <polygon points={fr(0, W, zBaseTop - 95, zBaseTop, yFrente)} fill={gola === 'aluminio' ? '#cbd5e1' : sombra(colorEst, 1)} stroke="#475569" strokeWidth={0.5} />
      <polygon points={fr(0, W, zBaseTop - 62, zBaseTop - 30, yFrente)} fill="#0f172a" opacity={0.75} />
      {gola === 'aluminio' && <polyline points={pts([P(0, yFrente, zBaseTop - 88), P(W, yFrente, zBaseTop - 88)])} stroke="#fff" strokeWidth={1} fill="none" />}
      {/* mesón */}
      <Caja x0={0} y0={0} z0={zBaseTop} w={W} d={DB + 30} h={MES} color="#d6d3d1" />

      {/* aéreo */}
      <Caja x0={0} y0={0} z0={zAer0} w={W} d={DA} h={HA} color={colorEst} />
      {aereoAbre === 'pestana' ? (
        <g>
          {puerta(0, W / 2, zAer0 - 28, zAer0 + HA - 5, DA)}
          {puerta(W / 2, W, zAer0 - 28, zAer0 + HA - 5, DA)}
          {/* la pestaña: el borde de abajo de la puerta, que sobresale para agarrarla */}
          <polygon points={fr(3, W - 3, zAer0 - 28, zAer0 - 6, DA)} fill={sombra(colorFach, 0.82)} stroke="#475569" strokeWidth={0.5} />
          <polygon points={pts([P(3, DA, zAer0 - 28), P(W - 3, DA, zAer0 - 28), P(W - 3, DA + 22, zAer0 - 28), P(3, DA + 22, zAer0 - 28)])} fill={sombra(colorFach, 0.7)} />
        </g>
      ) : (
        <g>
          {puerta(0, W / 2, zAer0, zAer0 + HA - 3, DA)}
          {puerta(W / 2, W, zAer0, zAer0 + HA - 3, DA)}
          {/* al ras: sin pestaña, la puerta termina en el borde del mueble y se abre con tirador */}
          <polygon points={fr(W / 2 - 40, W / 2 - 18, zAer0 + 40, zAer0 + 190, DA + 8)} fill="#64748b" />
          <polygon points={fr(W / 2 + 18, W / 2 + 40, zAer0 + 40, zAer0 + 190, DA + 8)} fill="#64748b" />
        </g>
      )}

      {puente && (
        <g>
          <Caja x0={0} y0={0} z0={zAer0 + HA} w={W} d={450} h={450} color={colorEst} />
          {puerta(0, W / 2, zAer0 + HA + 5, zAer0 + HA + 445, 450)}
          {puerta(W / 2, W, zAer0 + HA + 5, zAer0 + HA + 445, 450)}
        </g>
      )}

      {/* zona que se está configurando */}
      {foco === 'aereo' && marca(pts([P(0, DA, zAer0 - 30), P(W, DA, zAer0 - 30), P(W, DA, zAer0 + HA), P(0, DA, zAer0 + HA)]))}
      {foco === 'gola' && marca(fr(-10, W + 10, zBaseTop - 102, zBaseTop + 8, yFrente))}
      {foco === 'zocalo' && marca(fr(-10, W + 10, 0, ZOC + 6, DB - 40))}
      {foco === 'herrajes' && marca(fr(-10, W + 10, ZOC, zBaseTop - 104, yFrente))}
      {foco === 'puente' && marca(fr(-10, W + 10, zAer0 + HA, zAer0 + HA + 450, 450))}
      </g>
    </svg>
  );
};

/** Corte frontal de un cajón: full extensión (riel al costado, 13 mm de luz por lado) u oculta (riel bajo el cajón, 6 mm por lado) */
export const EsquemaCorredera: React.FC<{ tipo: 'full' | 'oculta'; colorEst: string; colorFach: string }> = ({ tipo, colorEst, colorFach }) => {
  const oculta = tipo === 'oculta';
  const luz = oculta ? 6 : 13;
  const x0 = 20, x1 = 200, E = 10; // costados del mueble
  const gap = luz * 1.6;
  const cx0 = x0 + E + gap, cx1 = x1 - E - gap; // caja del cajón
  return (
    <svg viewBox="0 0 220 120" className="w-full h-auto" role="img" aria-label="Corte frontal del cajón con su corredera">
      <rect x={x0} y={10} width={E} height={100} fill={colorEst} stroke="#475569" strokeWidth={0.6} />
      <rect x={x1 - E} y={10} width={E} height={100} fill={colorEst} stroke="#475569" strokeWidth={0.6} />
      <rect x={x0} y={104} width={x1 - x0} height={E - 4} fill={colorEst} stroke="#475569" strokeWidth={0.6} />
      {/* cajón: fondo + laterales vistos de frente */}
      <rect x={cx0} y={40} width={cx1 - cx0} height={56} fill="#f8fafc" stroke="#475569" strokeWidth={0.8} />
      <rect x={cx0} y={40} width={6} height={56} fill={colorFach} stroke="#475569" strokeWidth={0.6} />
      <rect x={cx1 - 6} y={40} width={6} height={56} fill={colorFach} stroke="#475569" strokeWidth={0.6} />
      {oculta ? (
        <g fill="#64748b">
          <rect x={cx0 + 1} y={96} width={22} height={5} rx={1} />
          <rect x={cx1 - 23} y={96} width={22} height={5} rx={1} />
        </g>
      ) : (
        <g fill="#64748b">
          <rect x={x0 + E} y={64} width={gap} height={5} rx={1} />
          <rect x={cx1} y={64} width={gap} height={5} rx={1} />
        </g>
      )}
      <text x={110} y={22} textAnchor="middle" fontSize={9} fontWeight={800} fill="#475569">{oculta ? 'Riel oculto · 6 mm por lado' : 'Full extensión · 13 mm por lado'}</text>
      <text x={110} y={34} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#94a3b8">{oculta ? 'va debajo del cajón, no se ve' : 'va en el costado del cajón'}</text>
    </svg>
  );
};
