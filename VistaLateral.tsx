import React from 'react';

/**
 * Vista lateral (corte) de la cocina con las alturas tal como salen de la configuración del espacio:
 * zócalo, mueble base, mesón, hueco hasta el aéreo, aéreo y margen al techo. Las medidas se editan en la ventana
 * (aquí solo se dibujan), y cada tramo se puede resaltar al tocar su campo.
 */

export type TramoAltura = 'zocalo' | 'base' | 'meson' | 'hueco' | 'aereo' | 'puente' | null;

export interface PropsLateral {
  techo: number;       // altura del espacio
  zocalo: number;      // 0 si no hay
  base: number;
  meson: number;       // 0 si no hay
  hueco: number;       // del mesón al aéreo
  aereo: number;
  margen: number;      // libre bajo el techo
  fondoBase: number;
  fondoAereo: number;
  resaltado: TramoAltura;
  puente?: { alto: number; fondo: number }; // doble módulo superior sobre el aéreo
}

export const VistaLateral: React.FC<PropsLateral> = ({ techo, zocalo, base, meson, hueco, aereo, margen, fondoBase, fondoAereo, resaltado, puente }) => {
  const H = 270, y0 = 12, x0 = 26;
  const s = H / Math.max(techo, 1);
  const Y = (z: number) => y0 + H - z * s; // z desde el piso
  const zZoc = zocalo, zBase = zZoc + base, zMes = zBase + meson, zAer0 = zMes + hueco, zAer1 = zAer0 + aereo, zPue1 = zAer0 + aereo + (puente?.alto ?? 0);
  const tramos: { id: Exclude<TramoAltura, null>; nombre: string; a: number; b: number }[] = [
    { id: 'zocalo', nombre: 'Zócalo', a: 0, b: zZoc },
    { id: 'base', nombre: 'Base', a: zZoc, b: zBase },
    { id: 'meson', nombre: 'Mesón', a: zBase, b: zMes },
    { id: 'hueco', nombre: 'Hueco', a: zMes, b: zAer0 },
    { id: 'aereo', nombre: 'Aéreo', a: zAer0, b: zAer1 },
    ...(puente ? [{ id: 'puente' as const, nombre: 'Puente', a: zAer1, b: zPue1 }] : []),
  ];
  const xd = x0 + Math.max(fondoBase, fondoAereo, puente?.fondo ?? 0) * s + 22; // línea de cotas
  const sobra = techo - zPue1; // lo que queda arriba del aéreo (margen al techo; si no coincide, se nota)
  return (
    <svg viewBox="0 0 190 295" className="w-full h-auto" role="img" aria-label="Vista lateral con las alturas de los muebles">
      {/* muro (izquierda), piso y techo */}
      <rect x={x0 - 8} y={y0} width={8} height={H} fill="#e2e8f0" />
      <line x1={x0 - 8} y1={Y(0)} x2={186} y2={Y(0)} stroke="#64748b" strokeWidth={1.2} />
      <line x1={x0 - 8} y1={Y(techo)} x2={186} y2={Y(techo)} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={186} y={Y(techo) - 2} textAnchor="end" fontSize={7} fontWeight={800} fill="#94a3b8">TECHO {techo}</text>

      {/* zócalo, base y mesón */}
      {zocalo > 0 && <rect x={x0} y={Y(zZoc)} width={(fondoBase - 50) * s} height={zocalo * s} fill="#cbd5e1" stroke="#64748b" strokeWidth={0.6} />}
      <rect x={x0} y={Y(zBase)} width={fondoBase * s} height={base * s} fill="#f8fafc" stroke="#475569" strokeWidth={0.8} />
      {meson > 0 && <rect x={x0} y={Y(zMes)} width={(fondoBase + 20) * s} height={meson * s} fill="#d6d3d1" stroke="#57534e" strokeWidth={0.6} />}
      {/* aéreo */}
      <rect x={x0} y={Y(zAer1)} width={fondoAereo * s} height={aereo * s} fill="#f8fafc" stroke="#475569" strokeWidth={0.8} />
      {puente && <rect x={x0} y={Y(zPue1)} width={puente.fondo * s} height={puente.alto * s} fill="#f8fafc" stroke="#475569" strokeWidth={0.8} />}
      {margen > 0 && <rect x={x0} y={Y(techo)} width={fondoAereo * s} height={Math.max(0, sobra) * s} fill="none" />}

      {/* tramo resaltado */}
      {tramos.filter(t => t.id === resaltado && t.b > t.a).map(t => (
        <rect key={t.id} x={x0 - 4} y={Y(t.b)} width={(t.id === 'puente' ? (puente?.fondo ?? 0) : t.id === 'aereo' ? fondoAereo : fondoBase) * s + 8} height={(t.b - t.a) * s} fill="rgba(99,102,241,.16)" stroke="#4f46e5" strokeWidth={1.4} strokeDasharray="4 3" />
      ))}

      {/* cotas */}
      <line x1={xd} y1={Y(0)} x2={xd} y2={Y(zPue1)} stroke="#94a3b8" strokeWidth={0.6} />
      {tramos.filter(t => t.b > t.a).map(t => {
        const ym = (Y(t.a) + Y(t.b)) / 2;
        return (
          <g key={t.id}>
            <line x1={xd - 3} y1={Y(t.b)} x2={xd + 3} y2={Y(t.b)} stroke="#64748b" strokeWidth={0.8} />
            <text x={xd + 6} y={ym + 2.5} fontSize={7.5} fontWeight={800} fill={t.id === resaltado ? '#4f46e5' : '#475569'}>{t.nombre} {Math.round(t.b - t.a)}</text>
          </g>
        );
      })}
      <line x1={xd - 3} y1={Y(0)} x2={xd + 3} y2={Y(0)} stroke="#64748b" strokeWidth={0.8} />
      <line x1={xd - 3} y1={Y(zPue1)} x2={xd + 3} y2={Y(zPue1)} stroke="#64748b" strokeWidth={0.8} />
      {sobra > 0.5 && <text x={xd + 6} y={(Y(zPue1) + Y(techo)) / 2 + 2.5} fontSize={7} fontWeight={800} fill={Math.abs(sobra - margen) < 1 ? '#94a3b8' : '#dc2626'}>Margen {Math.round(sobra)}</text>}
    </svg>
  );
};
