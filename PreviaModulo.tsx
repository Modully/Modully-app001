import React from 'react';
import type { ModuloEspecial } from './ModulosEspeciales';

/**
 * Vista previa de un módulo de la biblioteca: alzado frontal con sus frentes, el hueco del horno y las cotas.
 * Las medidas salen de las mismas reglas del despiece (boxes.ts): luz de arriba de 30 con el mesón sin nariz, frentes con 2 mm de luz,
 * cajonero de dos frentes con 30 entre ellos, huecos de horno de 590 / 460 / 375.
 */

interface Frente { x0: number; x1: number; z0: number; h: number; nombre: string; tono?: 'decorativo' }
interface Hueco { x0: number; x1: number; z0: number; h: number; etiqueta: string }
interface Alzado { W: number; H: number; frentes: Frente[]; hueco?: Hueco; notas: string[] }

const E = 15, CUT = 30, G1 = 2, GAP = 30, DECORATIVO = 65, HUECO_CORTO = 460, PANDO = 60, GOLA = 65;

/** Alzado frontal (mm) de un módulo de la biblioteca */
export function alzadoDe(m: ModuloEspecial): Alzado {
  const W = m.ancho, H = m.alto, full = H - CUT;
  const f = (x0: number, x1: number, z0: number, h: number, nombre: string, tono?: 'decorativo'): Frente => ({ x0, x1, z0, h, nombre, tono });
  const notas: string[] = [];
  switch (m.muebleHorno) {
    case 'std': {
      const fr = Math.round((full - 590) / 2);
      notas.push(`Hueco del horno 590 · frentes de ${fr}`);
      return { W, H, frentes: [f(2, W - 3, 0, fr, 'Frente sup'), f(2, W - 3, full - fr, fr, 'Frente sup')], hueco: { x0: E, x1: W - E, z0: 90, h: 590, etiqueta: 'Horno' }, notas };
    }
    case 'cond-izq': case 'cond-der': {
      const izq = m.muebleHorno === 'cond-izq', CW = Math.max(100, W - 3 * E - 600), wCond = CW + 3 * E - 1, wCaj = 598;
      const uOven = izq ? 2 * E + CW : E;
      const zTop = 137 + 590, x0f = izq ? W - 1 - wCaj : 1, x1f = izq ? W - 1 : 1 + wCaj;
      notas.push(`Cajón de 130 abajo · hueco 590 · frente decorativo de ${full - zTop} · condimentero de ${wCond}`);
      return { W, H, frentes: [izq ? f(1, 1 + wCond, 0, full, 'Frente cond') : f(W - 1 - wCond, W - 1, 0, full, 'Frente cond'), f(x0f, x1f, 0, 130, 'Frente caj'), f(x0f, x1f, zTop, full - zTop, 'Frente decorativo', 'decorativo')],
        hueco: { x0: uOven, x1: uOven + 600, z0: 137, h: 590, etiqueta: 'Horno' }, notas };
    }
    case 'corto-izq': case 'corto-der': {
      const izq = m.muebleHorno === 'corto-izq', CW = Math.max(100, W - 3 * E - 570), wCond = 178, wCaj = 597;
      const uOven = izq ? 2 * E + CW : E;
      notas.push('Hueco 375 entre dos cajones · condimentero de 178');
      return { W, H, frentes: [izq ? f(1, 1 + wCond, 0, full, 'Puerta cond') : f(W - 1 - wCond, W - 1, 0, full, 'Puerta cond'),
        f(izq ? W - 1 - wCaj : 1, izq ? W - 1 : 1 + wCaj, full - 135, 135, 'Frente caj'), f(izq ? W - 1 - wCaj : 1, izq ? W - 1 : 1 + wCaj, 28, 200, 'Frente caj')],
        hueco: { x0: uOven, x1: uOven + 570, z0: 228, h: 375, etiqueta: 'Horno corto' }, notas };
    }
    case 'corto-cajon': case 'corto-cubiertero': {
      const cub = m.muebleHorno === 'corto-cubiertero';
      const zTop = cub ? H - GOLA - 2 * E - PANDO - 7 : full - DECORATIVO;
      const hC = zTop - HUECO_CORTO - 25 - 2 * E, zIni = hC + 25 + 2 * E;
      notas.push(cub ? `Cajón de ${hC} · hueco 460 · cajón pando de ${full - zTop} (caja de ${PANDO})` : `Cajón de ${hC} · hueco 460 · frente decorativo de ${DECORATIVO}`);
      return { W, H, frentes: [f(G1, W - G1, 0, hC, 'Frente cajón'), cub ? f(G1, W - G1, zTop, full - zTop, 'Frente cubiertero') : f(G1, W - G1, zTop, DECORATIVO, 'Frente decorativo', 'decorativo')],
        hueco: { x0: E, x1: W - E, z0: zIni, h: HUECO_CORTO, etiqueta: 'Horno corto' }, notas };
    }
  }
  // módulos sencillos: puertas, cajones o abierto
  if (m.frente === 'cajones') {
    const h = Math.round((full - GAP) / 2);
    notas.push(`Dos frentes de ${h} con ${GAP} entre ellos (gola media)`);
    return { W, H, frentes: [f(G1, W - G1, 0, h, 'Frente inferior'), f(G1, W - G1, h + GAP, h, 'Frente superior')], notas };
  }
  if (m.frente === 'abierto') { notas.push('Abierto: sin puertas ni cajones'); return { W, H, frentes: [], notas }; }
  const alto = m.nivel === 'UPPER' ? H : m.nivel === 'TALL' ? H - 20 : full;
  const w = W / 2 - 1;
  notas.push(W <= 450 ? `Una puerta de ${Math.round(W - 2 * G1)} × ${Math.round(alto)}` : `Dos puertas de ${Math.round(w)} × ${Math.round(alto)}`);
  return { W, H, frentes: W <= 450 ? [f(G1, W - G1, 0, alto, 'Puerta')] : [f(0.5, 0.5 + w, 0, alto, 'Puerta izq.'), f(W / 2 + 0.5, W / 2 + 0.5 + w, 0, alto, 'Puerta der.')], notas };
}

export const PreviaModulo: React.FC<{ m: ModuloEspecial }> = ({ m }) => {
  const a = alzadoDe(m);
  const PAD = 90, vw = a.W + PAD * 2, vh = a.H + PAD * 2;
  const Y = (z: number) => PAD + a.H - z;           // el piso (z = 0) abajo
  const fs = Math.max(22, Math.min(a.W, a.H) / 22);  // tamaño del texto en unidades del dibujo
  const cota = (txt: string, x: number, y: number, rot = false) => <text x={x} y={y} fontSize={fs} fill="#64748b" textAnchor="middle" fontWeight={600} transform={rot ? `rotate(-90 ${x} ${y})` : undefined}>{txt}</text>;
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full max-h-[420px]" role="img" aria-label={`Vista previa de ${m.nombre}`}>
        {/* cuerpo: laterales */}
        <rect x={PAD} y={Y(a.H)} width={a.W} height={a.H} fill="#e2e8f0" stroke="#475569" strokeWidth={4} />
        {a.hueco && (
          <g>
            <rect x={PAD + a.hueco.x0} y={Y(a.hueco.z0 + a.hueco.h)} width={a.hueco.x1 - a.hueco.x0} height={a.hueco.h} fill="#1f2937" stroke="#0f172a" strokeWidth={3} />
            <rect x={PAD + a.hueco.x0 + 24} y={Y(a.hueco.z0 + a.hueco.h) + 24} width={Math.min(160, (a.hueco.x1 - a.hueco.x0) / 3)} height={Math.min(36, a.hueco.h / 8)} fill="#2563eb" opacity={0.55} />
            <text x={PAD + (a.hueco.x0 + a.hueco.x1) / 2} y={Y(a.hueco.z0 + a.hueco.h / 2) + fs / 3} fontSize={fs} fill="#e2e8f0" textAnchor="middle" fontWeight={700}>{a.hueco.etiqueta} · {a.hueco.h}</text>
          </g>
        )}
        {a.frentes.map((fr, i) => (
          <g key={i}>
            <rect x={PAD + fr.x0} y={Y(fr.z0 + fr.h)} width={fr.x1 - fr.x0} height={fr.h} fill={fr.tono === 'decorativo' ? '#f1f5f9' : '#ffffff'} stroke="#334155" strokeWidth={3} />
            <text x={PAD + (fr.x0 + fr.x1) / 2} y={Y(fr.z0 + fr.h / 2) + fs / 3} fontSize={fs} fill="#334155" textAnchor="middle" fontWeight={600}>{fr.h >= fs * 1.8 ? `${fr.nombre} · ${Math.round(fr.h)}` : Math.round(fr.h)}</text>
          </g>
        ))}
        {cota(`${a.W}`, PAD + a.W / 2, PAD - 26)}
        {cota(`${a.H}`, PAD - 26, PAD + a.H / 2, true)}
      </svg>
      <div className="text-xs text-slate-500">{a.notas.join(' · ')}</div>
    </div>
  );
};
