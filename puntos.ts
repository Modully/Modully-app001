import type { Appliance, KitchenModule } from './types';
import { CORNER_BLIND_OFFSET } from './boxes';

/**
 * Puntos de adecuación: las salidas de agua, desagüe, energía y gas que cada electrodoméstico necesita en el muro,
 * para que el plomero y el electricista las dejen antes de instalar la cocina. Alturas desde el piso (mm):
 * - Poceta: agua fría y caliente a 550, separadas 200 y centradas en la poceta; desagüe a 450, centrado.
 * - Lavavajillas: desagüe a 450 y toma eléctrica a 150, centrados en el lavavajillas.
 * - Estufa: gas a 600 en la mitad del condimentero (el módulo angosto pegado a la estufa); si no hay, en la mitad de la
 *   estufa. Toma eléctrica (encendido) a 600, 150 al lado del gas.
 * - Nevera: toma eléctrica a 1500, centrada; agua para el dispensador a 300, si se pidió.
 * - Campana: toma eléctrica a 1700, centrada.
 * Las coordenadas van en el mismo sistema de las cajas (mm): X a lo largo del muro A, Y desde el muro A, Z altura.
 */

export type TipoPunto = 'agua-fria' | 'agua-caliente' | 'desague' | 'electrico' | 'gas';
export interface PuntoAdecuacion {
  id: string;
  tipo: TipoPunto;
  wall: 'A' | 'B' | 'C';
  x: number; y: number; z: number;   // posición sobre la cara del muro
  electro: string;                   // de qué electrodoméstico es
}

export const PUNTO_INFO: Record<TipoPunto, { sigla: string; nombre: string; color: string }> = {
  'agua-fria': { sigla: 'AF', nombre: 'Agua fría', color: '#2563eb' },
  'agua-caliente': { sigla: 'AC', nombre: 'Agua caliente', color: '#dc2626' },
  desague: { sigla: 'D', nombre: 'Desagüe', color: '#475569' },
  electrico: { sigla: 'E', nombre: 'Toma eléctrica', color: '#d97706' },
  gas: { sigla: 'G', nombre: 'Gas', color: '#ca8a04' },
};

/** Alturas (mm desde el piso) de cada punto, por electrodoméstico */
export const ALTURAS_PUNTO = {
  pocetaAgua: 550, pocetaSeparacion: 200, pocetaDesague: 450,
  lavavajillasDesague: 450, lavavajillasElectrico: 150,
  estufaGas: 600, estufaElectrico: 600, estufaSeparacion: 150,
  neveraElectrico: 1500, neveraAgua: 300,
  campanaElectrico: 1700,
};

/** Resumen de los puntos de un electrodoméstico, para el formulario */
export function textoPuntos(a: Appliance): string {
  const cm = (mm: number) => `${Math.round(mm / 10)} cm`;
  const h = ALTURAS_PUNTO;
  switch (a.type) {
    case 'sink': return `Agua fría y caliente a ${cm(h.pocetaAgua)} · desagüe a ${cm(h.pocetaDesague)}`;
    case 'dishwasher': return `Desagüe a ${cm(h.lavavajillasDesague)} · toma eléctrica a ${cm(h.lavavajillasElectrico)}, centrada`;
    case 'stove': return `Gas a ${cm(h.estufaGas)} en el condimentero · toma eléctrica a ${cm(h.estufaElectrico)}`;
    case 'fridge': return `Toma eléctrica a ${cm(h.neveraElectrico)}${a.dispensador ? ` · agua para el dispensador a ${cm(h.neveraAgua)}` : ''}`;
    case 'hood-under': return `Toma eléctrica a ${cm(h.campanaElectrico)}, centrada`;
    default: return '';
  }
}

export function puntosAdecuacion(appliances: Appliance[], modules: KitchenModule[], wallA: number): PuntoAdecuacion[] {
  const out: PuntoAdecuacion[] = [];
  const CARA = 4; // a 4 mm del muro, para que se vean sobre su cara
  const lugar = (wall: 'A' | 'B' | 'C', along: number) => (wall === 'A' ? { x: along, y: CARA } : wall === 'B' ? { x: CARA, y: along } : { x: wallA - CARA, y: along });
  const add = (a: Appliance, tipo: TipoPunto, alongRel: number, z: number, sufijo = '') => {
    if (a.wall === 'Island') return;
    const wall = a.wall;
    const along = (wall === 'A' ? 0 : CORNER_BLIND_OFFSET) + alongRel;
    out.push({ id: `${a.type}-${tipo}${sufijo}`, tipo, wall, ...lugar(wall, along), z, electro: a.type });
  };
  const h = ALTURAS_PUNTO;
  appliances.filter(a => a.active && a.wall !== 'Island').forEach(a => {
    const c = a.distance + a.width / 2;
    if (a.type === 'sink') {
      add(a, 'agua-fria', c - h.pocetaSeparacion / 2, h.pocetaAgua);
      add(a, 'agua-caliente', c + h.pocetaSeparacion / 2, h.pocetaAgua);
      add(a, 'desague', c, h.pocetaDesague);
    } else if (a.type === 'dishwasher') {
      add(a, 'desague', c, h.lavavajillasDesague);
      add(a, 'electrico', c, h.lavavajillasElectrico);
    } else if (a.type === 'stove') {
      // condimentero: módulo bajo angosto (hasta 350 mm) pegado a la estufa; el gas va en su mitad
      const bajos = modules.filter(m => m.wall === a.wall && m.type === 'LOWER' && !m.isStoveCabinet);
      const cond = bajos.find(m => m.width <= 350 && (Math.abs(m.positionX + m.width - a.distance) < 5 || Math.abs(m.positionX - (a.distance + a.width)) < 5));
      const gas = cond ? cond.positionX + cond.width / 2 : c;
      add(a, 'gas', gas, h.estufaGas);
      // la toma del encendido va hacia el centro de la estufa
      add(a, 'electrico', gas + (gas <= c ? h.estufaSeparacion : -h.estufaSeparacion), h.estufaElectrico);
    } else if (a.type === 'fridge') {
      add(a, 'electrico', c, h.neveraElectrico);
      if (a.dispensador) add(a, 'agua-fria', c, h.neveraAgua);
    } else if (a.type === 'hood-under') {
      add(a, 'electrico', c, h.campanaElectrico);
    }
  });
  return out;
}
