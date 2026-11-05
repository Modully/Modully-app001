import { LayoutType } from './types';

/**
 * Secciones de Modully: cada una es un tipo de producto con su propio diseño (espacio, módulos, vistas...). Todas comparten el mismo
 * motor (módulos, medir, espacio, especiales, accesorios y vistas); lo que cambia es esta configuración. Las reglas propias de cada
 * sección (qué lleva cada accesorio, cómo se modula) se van agregando aquí a medida que se definan.
 */
export type SectionId = 'cocinas' | 'closets' | 'walking' | 'puertas' | 'bano' | 'tv';

export interface SectionConfig {
  id: SectionId;
  name: string;            // nombre de la sección
  singular: string;        // "cocina", "closet"...: para los textos del formulario de Espacio
  layouts: LayoutType[];   // formas de espacio que admite
  defaults: {              // valores con los que arranca el espacio de la sección
    layout: LayoutType; wallA: number; wallB: number; wallC: number; spaceHeight: number;
    hasZocalo: boolean; zocaloHeight: number; zocaloDepth: number; hasCounter: boolean;
  };
  baseModuleHeight: number; // alto del módulo del nivel de abajo
  upperGap: number;         // espacio libre entre el nivel de abajo (con su mesón o tapa) y el de arriba
  hasUpper: boolean;        // si lleva módulos del nivel de arriba
  lowerName: string;        // cómo se llama el nivel de abajo en esta sección
  upperName: string;        // y el de arriba
  features: {
    counter: boolean;       // mesón, salpicadero y cascada
    islands: boolean;       // isla y península
  };
  accessories: string[];    // accesorios disponibles (tipos de electrodoméstico/elemento); vacío = aún sin definir
  specials: [string, string]; // nombres de los dos módulos especiales altos
  note: string;             // aviso cuando una sección aún no tiene reglas propias
}

export const SECTIONS: Record<SectionId, SectionConfig> = {
  cocinas: {
    id: 'cocinas', name: 'Cocinas integrales', singular: 'cocina',
    layouts: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'],
    defaults: { layout: 'STRAIGHT', wallA: 3600, wallB: 2400, wallC: 2400, spaceHeight: 2400, hasZocalo: true, zocaloHeight: 100, zocaloDepth: 500, hasCounter: true },
    baseModuleHeight: 800, upperGap: 600, hasUpper: true,
    lowerName: 'Bajo', upperName: 'Aéreo',
    features: { counter: true, islands: true },
    accessories: ['fridge', 'stove', 'sink', 'hood-under'],
    specials: ['Alacena Alta', 'Torre de Hornos'],
    note: '',
  },
  closets: {
    id: 'closets', name: 'Closets', singular: 'closet',
    layouts: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'],
    defaults: { layout: 'STRAIGHT', wallA: 2400, wallB: 1800, wallC: 1800, spaceHeight: 2400, hasZocalo: false, zocaloHeight: 100, zocaloDepth: 500, hasCounter: false },
    baseModuleHeight: 1900, upperGap: 0, hasUpper: true,
    lowerName: 'Cuerpo', upperName: 'Maletero',
    features: { counter: false, islands: false },
    accessories: [],
    specials: ['Columna de cajones', 'Columna zapatero'],
    note: 'Aún no hay reglas propias de closets: arranca con las de la cocina adaptadas (cuerpo de 1.9 m y maletero arriba).',
  },
  walking: {
    id: 'walking', name: 'Walking closets', singular: 'walking closet',
    layouts: ['U_SHAPE', 'L_SHAPE', 'STRAIGHT'],
    defaults: { layout: 'U_SHAPE', wallA: 3000, wallB: 2400, wallC: 2400, spaceHeight: 2400, hasZocalo: false, zocaloHeight: 100, zocaloDepth: 500, hasCounter: false },
    baseModuleHeight: 1900, upperGap: 0, hasUpper: true,
    lowerName: 'Cuerpo', upperName: 'Maletero',
    features: { counter: false, islands: false },
    accessories: [],
    specials: ['Columna de cajones', 'Columna zapatero'],
    note: 'Aún no hay reglas propias de walking closets: arranca con las del closet.',
  },
  puertas: {
    id: 'puertas', name: 'Puertas', singular: 'puerta',
    layouts: ['STRAIGHT'],
    defaults: { layout: 'STRAIGHT', wallA: 2400, wallB: 2400, wallC: 2400, spaceHeight: 2400, hasZocalo: false, zocaloHeight: 0, zocaloDepth: 0, hasCounter: false },
    baseModuleHeight: 2100, upperGap: 0, hasUpper: false,
    lowerName: 'Hoja', upperName: 'Sobreluz',
    features: { counter: false, islands: false },
    accessories: [],
    specials: ['Puerta doble', 'Puerta corrediza'],
    note: 'Aún no hay reglas propias de puertas: las hojas se modulan como módulos de 2.1 m de alto.',
  },
  bano: {
    id: 'bano', name: 'Muebles de baño', singular: 'baño',
    layouts: ['STRAIGHT', 'L_SHAPE'],
    defaults: { layout: 'STRAIGHT', wallA: 1800, wallB: 1500, wallC: 1500, spaceHeight: 2400, hasZocalo: true, zocaloHeight: 100, zocaloDepth: 400, hasCounter: true },
    baseModuleHeight: 600, upperGap: 600, hasUpper: true,
    lowerName: 'Mueble', upperName: 'Gabinete',
    features: { counter: true, islands: false },
    accessories: ['sink'],
    specials: ['Columna de baño', 'Torre lavandería'],
    note: 'Aún no hay reglas propias de baño: arranca con las de la cocina adaptadas (mueble bajo de 60 cm con tapa y gabinete arriba).',
  },
  tv: {
    id: 'tv', name: 'Centros de TV', singular: 'centro de TV',
    layouts: ['STRAIGHT'],
    defaults: { layout: 'STRAIGHT', wallA: 2400, wallB: 2400, wallC: 2400, spaceHeight: 2400, hasZocalo: false, zocaloHeight: 0, zocaloDepth: 0, hasCounter: false },
    baseModuleHeight: 450, upperGap: 800, hasUpper: true,
    lowerName: 'Base', upperName: 'Repisa',
    features: { counter: false, islands: false },
    accessories: [],
    specials: ['Columna lateral', 'Columna con repisas'],
    note: 'Aún no hay reglas propias de centros de TV: arranca con las de la cocina adaptadas (base baja y repisas arriba).',
  },
};

export const SECTION_ORDER: SectionId[] = ['cocinas', 'closets', 'walking', 'puertas', 'bano', 'tv'];
