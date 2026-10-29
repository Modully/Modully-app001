import { KitchenModule, BOMPiece, BOM } from './types';
import * as XLSX from 'xlsx';

// Parámetros fijos según manual (reglas estructurales validadas)
const PARAMS = {
  STRUCTURE_THICKNESS: 15,      // Laterales, base, techo, amarres (mm)
  FACADE_THICKNESS_BASIC: 15,   // Frentes línea básica (mm)
  FACADE_THICKNESS_MEDIA: 18,   // Frentes línea media/alta (mm)
  BACK_THICKNESS: 6,            // Espaldar (mm)
  MB_HEIGHT: 800,               // Alto base por defecto si el módulo no trae altura (mm)
  MB_DEPTH: 570,                // Profundo módulo base (mm)
  MA_HEIGHT: 1080,              // Alto aéreo por defecto si el módulo no trae altura (mm). Real: depende del muro
  MA_DEPTH: 330,                // Profundo módulo aéreo (mm)
  MB_DOOR_CLEARANCE: 50,        // Luz sobre las puertas del MB: puerta = alto módulo - 50 (mm)
  SHELF_HEIGHT: 400,            // Alto entrepaño (mm)
  SHELF_DEPTH_REDUCTION: 20,    // El entrepaño es 2cm menos profundo que el módulo (mm)
  MB_TIE_HEIGHT: 80,            // Alto de los amarres traseros del MB (mm)
  MA_CLEAT_HEIGHT: 60,          // Alto de las cuchillas (French cleat) del MA (mm)
  MA_BACK_SETBACK: 15,          // Retranqueo del espaldar del MA (mm)
  MA_BACK_GROOVE: 5,            // Penetración del espaldar en la ranura del techo MA (mm)
  MA_DOOR_TAB: 10,              // Pestaña de la puerta del MA que cuelga bajo la base (mm)
  GOLA_WIDTH: 65,               // Ancho gola (mm)
  LIGHT: 2,                     // Holgura perimetral (mm)
};

interface PieceRaw {
  name: string;
  length: number;
  width: number;
  thickness: number;
  color: string;
  edgeType: string;
}

/**
 * Canto de una pieza estructural según la línea. Regla validada: el canto lleva
 * el color de la propia pieza, nunca el de otra pieza o de la fachada.
 */
function structureEdge(lineType: string, colorName: string): string {
  if (lineType === 'Alta') return `4LF ${colorName}`;
  if (lineType === 'Media') return `1L ${colorName} 2A ${colorName}`;
  return `1L ${colorName}`; // Básica (Baja)
}

/** Color de la estructura: Básica = Blanco RH; Media/Alta = color del cliente RH. */
function structureColorName(lineType: string, faceColor: string): string {
  return lineType === 'Básica' ? 'Blanco' : faceColor;
}

/** Canto de las fachadas. TODO: rígido/flexible (4LR/4LF) se pregunta al cliente. */
const FACADE_EDGE = '4LR';

/**
 * Extrae todas las piezas individuales de un módulo base (MB).
 * El MB NO lleva techo ni espaldar (el mesón hace de tapa y el fondo queda abierto);
 * sí lleva amarres superior e inferior traseros.
 */
function extractMBPieces(module: KitchenModule, lineType: string, faceColor: string): PieceRaw[] {
  const pieces: PieceRaw[] = [];
  const width = module.width; // module.width ya está en mm (width3d puede ser la profundidad en muros rotados)
  const height = module.height || PARAMS.MB_HEIGHT; // el alto del módulo viene de la app
  const depth = module.depth || PARAMS.MB_DEPTH; // el fondo se puede editar por módulo
  const innerWidth = width - PARAMS.STRUCTURE_THICKNESS * 2;
  const label = module.label || module.id;
  const facadeThickness = lineType === 'Básica' ? PARAMS.FACADE_THICKNESS_BASIC : PARAMS.FACADE_THICKNESS_MEDIA;
  const structName = structureColorName(lineType, faceColor);
  const structColor = `${structName} RH`;
  const structEdge = structureEdge(lineType, structName);
  const doorHeight = height - PARAMS.MB_DOOR_CLEARANCE;

  // Laterales (2x)
  for (let i = 0; i < 2; i++) {
    pieces.push({
      name: `Lateral ${label}`,
      length: height,
      width: depth,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: structColor,
      edgeType: structEdge,
    });
  }

  // Base (1x), entre laterales
  pieces.push({
    name: `Base ${label}`,
    length: innerWidth,
    width: depth,
    thickness: PARAMS.STRUCTURE_THICKNESS,
    color: structColor,
    edgeType: structEdge,
  });

  // Amarres traseros superior e inferior (sin canto: quedan ocultos)
  ['Superior', 'Inferior'].forEach(pos => {
    pieces.push({
      name: `Amarre ${pos} ${label}`,
      length: innerWidth,
      width: PARAMS.MB_TIE_HEIGHT,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: structColor,
      edgeType: '',
    });
  });

  // Puertas (según configType)
  if (module.configType === 'doors') {
    const doorWidth = (width - PARAMS.LIGHT * 2) / 2 - PARAMS.LIGHT;
    pieces.push({
      name: `Puerta Izq ${label}`,
      length: doorHeight,
      width: doorWidth,
      thickness: facadeThickness,
      color: faceColor,
      edgeType: FACADE_EDGE,
    });
    pieces.push({
      name: `Puerta Der ${label}`,
      length: doorHeight,
      width: doorWidth,
      thickness: facadeThickness,
      color: faceColor,
      edgeType: FACADE_EDGE,
    });
  } else if (module.configType === 'drawers' || module.configType === 'internal-drawer') {
    const drawerWidth = width - PARAMS.LIGHT * 2;
    for (let i = 0; i < (module.drawerCount || 3); i++) {
      pieces.push({
        name: `Frente Cajón ${i + 1} ${label}`,
        length: 350,  // Alto típico de cajón
        width: drawerWidth,
        thickness: facadeThickness,
        color: faceColor,
        edgeType: FACADE_EDGE,
      });
    }
  }

  // Entrepaño a 40cm. No va en el cajonero. Material siempre Blanco RH, canto de su propio color.
  if (width >= 450 && module.configType !== 'drawers' && module.configType !== 'internal-drawer') {
    pieces.push({
      name: `Entrepaño ${label}`,
      length: innerWidth,
      width: depth - PARAMS.SHELF_DEPTH_REDUCTION,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: 'Blanco RH',
      edgeType: structureEdge(lineType, 'Blanco'),
    });
  }

  // Gola superior (siempre)
  pieces.push({
    name: `Gola Superior ${label}`,
    length: width,
    width: PARAMS.GOLA_WIDTH,
    thickness: PARAMS.STRUCTURE_THICKNESS,
    color: 'Blanco RH',
    edgeType: '1L',
  });

  return pieces;
}

/**
 * Extrae todas las piezas individuales de un módulo aéreo (MA).
 * El MA lleva piso, techo y espaldar retranqueado 15 mm (entra 5 mm en la ranura del techo),
 * y 2 amarres superiores (cuchillas). No lleva amarre inferior.
 */
function extractMAPieces(module: KitchenModule, lineType: string, faceColor: string): PieceRaw[] {
  const pieces: PieceRaw[] = [];
  const width = module.width; // module.width ya está en mm
  const depth = module.depth || PARAMS.MA_DEPTH; // la sobrenevera es más profunda que los demás aéreos
  const innerWidth = width - PARAMS.STRUCTURE_THICKNESS * 2;
  const height = module.height || PARAMS.MA_HEIGHT; // depende del muro: lo calcula la app
  const innerHeight = height - PARAMS.STRUCTURE_THICKNESS * 2;
  const label = module.label || module.id;
  const facadeThickness = lineType === 'Básica' ? PARAMS.FACADE_THICKNESS_BASIC : PARAMS.FACADE_THICKNESS_MEDIA;
  const structName = structureColorName(lineType, faceColor);
  const structColor = `${structName} RH`;
  const structEdge = structureEdge(lineType, structName);

  // Laterales (2x)
  for (let i = 0; i < 2; i++) {
    pieces.push({
      name: `Lateral Aéreo ${label}`,
      length: height,
      width: depth,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: structColor,
      edgeType: structEdge,
    });
  }

  // Piso (1x) y Techo (1x), entre laterales
  ['Piso', 'Techo'].forEach(pos => {
    pieces.push({
      name: `${pos} Aéreo ${label}`,
      length: innerWidth,
      width: depth,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: structColor,
      edgeType: structEdge,
    });
  });

  // Espaldar retranqueado: apoya en el piso y entra 5 mm en la ranura del techo
  pieces.push({
    name: `Espaldar Aéreo ${label}`,
    length: innerWidth,
    width: innerHeight + PARAMS.MA_BACK_GROOVE,
    thickness: PARAMS.BACK_THICKNESS,
    color: 'Blanco',
    edgeType: '',
  });

  // 2 amarres superiores (cuchillas / French cleat) en el hueco del retranqueo, sin canto
  for (let i = 0; i < 2; i++) {
    pieces.push({
      name: `Amarre Superior Aéreo ${label}`,
      length: innerWidth,
      width: PARAMS.MA_CLEAT_HEIGHT,
      thickness: PARAMS.STRUCTURE_THICKNESS,
      color: structColor,
      edgeType: '',
    });
  }

  // Puertas aéreas: rasantes arriba, con pestaña de 10 mm que cuelga bajo la base
  const doorWidth = (width - PARAMS.LIGHT * 2) / 2 - PARAMS.LIGHT;
  const doorHeight = height + PARAMS.MA_DOOR_TAB - PARAMS.LIGHT;
  pieces.push({
    name: `Puerta Aérea Izq ${label}`,
    length: doorHeight,
    width: doorWidth,
    thickness: facadeThickness,
    color: faceColor,
    edgeType: FACADE_EDGE,
  });
  pieces.push({
    name: `Puerta Aérea Der ${label}`,
    length: doorHeight,
    width: doorWidth,
    thickness: facadeThickness,
    color: faceColor,
    edgeType: FACADE_EDGE,
  });

  return pieces;
}

/**
 * Agrupa piezas idénticas y calcula cantidades
 */
function groupPieces(allPieces: PieceRaw[]): BOMPiece[] {
  const pieceMap = new Map<string, { piece: PieceRaw; count: number }>();

  allPieces.forEach(piece => {
    const key = `${piece.length}x${piece.width}x${piece.thickness}-${piece.color}-${piece.edgeType}`;
    if (pieceMap.has(key)) {
      const entry = pieceMap.get(key)!;
      entry.count += 1;
    } else {
      pieceMap.set(key, { piece, count: 1 });
    }
  });

  const result: BOMPiece[] = [];
  let itemNum = 1;

  pieceMap.forEach(({ piece, count }) => {
    result.push({
      item: itemNum++,
      name: piece.name,
      quantity: count,
      length: piece.length,
      width: piece.width,
      thickness: piece.thickness,
      color: piece.color,
      edgeType: piece.edgeType,
    });
  });

  return result;
}

/**
 * Genera BOM completo desde módulos
 */
export function generateBOM(
  modules: KitchenModule[],
  lineType: string,
  faceColor: string,
  wallWidth: number
): BOM {
  const allPieces: PieceRaw[] = [];

  modules.forEach(module => {
    if (module.type === 'LOWER') {
      allPieces.push(...extractMBPieces(module, lineType, faceColor));
    } else if (module.type === 'UPPER') {
      allPieces.push(...extractMAPieces(module, lineType, faceColor));
    }
  });

  const pieces = groupPieces(allPieces);

  return {
    pieces,
    totalPieces: pieces.reduce((sum, p) => sum + p.quantity, 0),
    generatedAt: new Date().toISOString(),
    kitchenConfig: {
      wallWidth,
      lineType,
      faceColor,
    },
  };
}

/**
 * Exporta BOM a Excel formato CNC
 */
export function exportBOMToExcel(bom: BOM, filename: string = 'Listado_Partes_Cocina'): void {
  const worksheetData = [
    ['ITEM', 'PARTE', 'C/D', 'LAR (mm)', 'AN (mm)', 'CAL (mm)', 'COLOR', 'CANTO'],
    ...bom.pieces.map(p => [
      p.item,
      p.name,
      p.quantity,
      p.length,
      p.width,
      p.thickness,
      p.color,
      p.edgeType || '—',
    ]),
    [],
    ['RESUMEN', '', '', '', '', '', '', ''],
    ['Total de piezas:', bom.totalPieces],
    ['Fecha de generación:', new Date().toLocaleDateString('es-ES')],
    ['Ancho pared (mm):', bom.kitchenConfig.wallWidth],
    ['Línea de producto:', bom.kitchenConfig.lineType],
    ['Color fachada:', bom.kitchenConfig.faceColor],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Ajustar anchos de columna
  worksheet['!cols'] = [
    { wch: 6 },   // ITEM
    { wch: 25 },  // PARTE
    { wch: 6 },   // C/D
    { wch: 10 },  // LAR
    { wch: 10 },  // AN
    { wch: 10 },  // CAL
    { wch: 15 },  // COLOR
    { wch: 12 },  // CANTO
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Listado de Partes');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const finalFilename = `${filename}_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, finalFilename);
}

/**
 * Exporta BOM a CSV (alternativa lightweight)
 */
export function exportBOMToCSV(bom: BOM, filename: string = 'Listado_Partes_Cocina'): void {
  const csvContent = [
    ['ITEM', 'PARTE', 'C/D', 'LAR (mm)', 'AN (mm)', 'CAL (mm)', 'COLOR', 'CANTO'].join(','),
    ...bom.pieces.map(p =>
      [p.item, p.name, p.quantity, p.length, p.width, p.thickness, p.color, p.edgeType || '—'].join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${timestamp}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
