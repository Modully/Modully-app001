
import { ModuleTemplate, Material, Hardware } from './types';

export const MODULE_TEMPLATES: ModuleTemplate[] = [
  { id: 'upper-300', name: 'Aéreo 300mm', type: 'UPPER', width: 300, height: 1080, depth: 330, basePrice: 120000 },
  { id: 'upper-600', name: 'Aéreo 600mm', type: 'UPPER', width: 600, height: 1080, depth: 330, basePrice: 210000 },
  { id: 'upper-900', name: 'Aéreo 900mm', type: 'UPPER', width: 900, height: 1080, depth: 330, basePrice: 310000 },
  { id: 'lower-300', name: 'Bajo 300mm', type: 'LOWER', width: 300, height: 800, depth: 570, basePrice: 160000 },
  { id: 'lower-600', name: 'Bajo 600mm', type: 'LOWER', width: 600, height: 800, depth: 570, basePrice: 280000 },
  { id: 'lower-900', name: 'Bajo 900mm', type: 'LOWER', width: 900, height: 800, depth: 570, basePrice: 390000 },
  { id: 'tall-oven', name: 'Torre Horno', type: 'TALL', width: 600, height: 2100, depth: 570, basePrice: 720000 },
  { id: 'fridge-space', name: 'Espacio Nevera', type: 'APPLIANCE', width: 800, height: 1900, depth: 700, basePrice: 0 },
];

export const MATERIALS: Material[] = [
  { id: 'white-15', name: 'Blanco 15mm', type: 'structure', thickness: 15, pricePerSheet: 160000, color: '#FFFFFF', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'smoke-15', name: 'Humo 15mm', type: 'structure', thickness: 15, pricePerSheet: 165000, color: '#E5E5E5', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'wenge-15', name: 'Wengué 15mm', type: 'structure', thickness: 15, pricePerSheet: 170000, color: '#2D1E12', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'oak-18', name: 'Roble Aserrado 18mm', type: 'facade', thickness: 18, pricePerSheet: 210000, color: '#D4B996', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'grey-18', name: 'Gris Claro 18mm', type: 'facade', thickness: 18, pricePerSheet: 200000, color: '#CCCCCC', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'red-18', name: 'Rojo 18mm', type: 'facade', thickness: 18, pricePerSheet: 225000, color: '#B22222', sheetWidth: 2440, sheetHeight: 1830 },
  { id: 'white-4', name: 'Fondo Blanco 4mm', type: 'back', thickness: 4, pricePerSheet: 80000, color: '#FFFFFF', sheetWidth: 2440, sheetHeight: 1530 },
];

export const HARDWARE: Hardware[] = [
  { id: 'hinge-std', name: 'Bisagra Parche', price: 5000, unit: 'und' },
  { id: 'hinge-soft', name: 'Bisagra Cierre Lento', price: 8000, unit: 'und' },
  { id: 'slide-ext', name: 'Corredera Full Extension', price: 30000, unit: 'par' },
  { id: 'handle-128', name: 'Manija Tubular 128mm', price: 5000, unit: 'und' },
];

export const LABOR_CONFIG = {
  COST_PER_MODULE_LOWER: 50000,
  COST_PER_MODULE_UPPER: 40000,
  COST_PER_MODULE_TALL: 80000,
  INSTALLATION_PER_MODULE: 15000,
};

export const MARGIN_CONFIG = {
  DEFAULT_MARGIN_PERCENT: 40,
};

export const WALL_COLORS = {
  A: '#f0f0f0',
  B: '#e0e0e0',
  C: '#d0d0d0',
};

export const COLORS = {
  UPPER: '#A67C52',
  LOWER: '#8B7355',
  TALL: '#6F5436',
  FRIDGE: '#E8E8E8',
  STOVE: '#2C2C2C',
  SINK: '#C0C0C0',
  ISLAND: '#7A5C3D',
};
