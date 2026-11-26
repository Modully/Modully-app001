import { CATALOGO } from './colores';
import { Type } from '@google/genai';
import { ia, iaDisponible } from './nube';

/**
 * Fase 5 · Bosquejo desde una foto: la IA lee un boceto a mano alzada (o una foto del sitio con medidas escritas)
 * y devuelve el producto y las medidas para armar el diseño. La foto sale hacia el servicio de Gemini (Google).
 * Lo leído NO se aplica solo: llena el formulario del bosquejo para que el carpintero lo revise antes de crear el diseño.
 */

// se prueban en orden: primero el que mejor lee letra a mano; si la cuenta no lo tiene o está en su límite, el siguiente
const MODELOS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];

export type FrenteDibujado = 'puertas' | 'cajones' | 'abierto' | 'poceta' | 'estufa' | 'campana' | 'platero';
/** Un módulo tal como se ve en el boceto: su frente, su ancho si está acotado y cuántos cuadritos de la hoja mide (para repartir el ancho) */
export interface ModuloDibujado { frente: FrenteDibujado; ancho: number | null; cuadros: number }

export interface ProductoLeido {
  producto: 'cocinas' | 'closets' | 'closetfit' | 'walking' | 'bano' | 'tv' | 'puertas' | null;
  nombre: string;    // cómo lo llamaría el carpintero: "Closet de 1,50", "Cocina de 2,40"
  forma: 'STRAIGHT' | 'L_SHAPE' | 'U_SHAPE' | null;
  brazo: 'left' | 'right' | null;
  muroA: number | null; muroB: number | null; muroC: number | null; alto: number | null; fondo: number | null; // mm
  desague: { muro: 'A' | 'B' | 'C'; dist: number } | null;
  gas: { muro: 'A' | 'B' | 'C'; dist: number } | null;
  agua: { muro: 'A' | 'B' | 'C'; dist: number } | null;                  // punto de agua (suministro)
  electricidad: { muro: 'A' | 'B' | 'C'; dist: number }[];                // tomas o puntos eléctricos acotados
  nevera: 'no' | 'inicio' | 'final' | null;
  neveraEspacio: number | null; // ancho del espacio que se deja para la nevera (mm), si está acotado
  muroIzq: boolean | null; // hay un muro (sombreado) pegado al lado izquierdo del mueble
  muroDer: boolean | null; // y al lado derecho
  techo: boolean | null;   // se dibujó el techo (sombreado arriba)
  piso: boolean | null;    // se dibujó el piso (sombreado abajo)
  modulos: number[]; // anchos de los módulos de izquierda a derecha (mm), si están acotados
  filaBaja: ModuloDibujado[]; // módulos dibujados abajo, de izquierda a derecha (sin el espacio de la nevera)
  filaAlta: ModuloDibujado[]; // y arriba (sin la sobrenevera)
  detalle: string;   // lo que se ve dibujado por dentro: puertas, cajones, entrepaños, alturas
  dudas: string[];   // lo que no pudo leer o tuvo que suponer
  tipoDibujo?: 'frente' | 'planta' | 'mixto' | null; // cómo está dibujado el boceto
  colores?: { estructura?: string; fachada?: string; fachadaAereos?: string }; // colores de los módulos nombrados en el boceto o en las notas, tal como se escribieron
}
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Colores que el carpintero escribió en las notas: por frase se ve de qué habla (estructura, fachada, aéreos) y qué color del catálogo nombra */
export function coloresDeNotas(notas: string): { estructura?: string; fachada?: string; fachadaAereos?: string } {
  const out: { estructura?: string; fachada?: string; fachadaAereos?: string } = {};
  const nombres = [...CATALOGO].sort((a, b) => b.nombre.length - a.nombre.length);
  sinTildes(notas).split(/[.;\n]+/).forEach(frase => {
    // dentro de la frase, cada tramo (separado por coma, " y " o "con") habla de una cosa
    frase.split(/,|\sy\s|\scon\s|\spero\s/).forEach(tramo => {
      const hit = nombres.find(c => new RegExp(`(^|[^a-z])${sinTildes(c.nombre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/o$/, '[oa]')}([^a-z]|$)`).test(tramo));
      if (!hit) return;
      const aereo = /aereo|superior|de arriba|altos?|alacena/.test(tramo);
      if (/estructura|carcasa|cuerpo/.test(tramo)) out.estructura = out.estructura ?? hit.nombre;
      else if (aereo) out.fachadaAereos = out.fachadaAereos ?? hit.nombre;
      else if (/fachada|puerta|frente|color|modulo|mueble|cocina/.test(tramo)) out.fachada = out.fachada ?? hit.nombre;
    });
  });
  return out;
}

/**
 * En una vista superior, la cota larga del muro A y la del espacio de la nevera suelen estar acotadas aparte, una a continuación de la otra
 * (por ejemplo 2540 + 700). El muro A es la suma. Si el modelo dejó el muro A sin el tramo de la nevera y en el texto transcrito no aparece
 * la suma ya escrita, se suma y se avisa.
 */
export function sumarNevera(q: ProductoLeido, transcripcion: string, pistas: Pistas): void {
  const planta = pistas.dibujo === 'planta' || pistas.dibujo === 'ambas' || q.tipoDibujo === 'planta' || q.tipoDibujo === 'mixto' || (pistas.dibujo === 'auto' && !!q.muroB);
  if (q.producto !== 'cocinas' || !planta || !q.muroA || !q.neveraEspacio || !q.nevera || q.nevera === 'no') return;
  const nums = (transcripcion.match(/d[d.,]*/g) ?? []).map(t => parseInt(t.replace(/[.,]/g, ''), 10)).filter(n => n > 0);
  const suma = q.muroA + q.neveraEspacio;
  const escrita = nums.some(n => n === suma || n * 10 === suma);
  const aparte = nums.some(n => n === q.neveraEspacio || n * 10 === q.neveraEspacio) && nums.some(n => n === q.muroA || n * 10 === q.muroA);
  if (escrita || !aparte) return;
  q.dudas = [...q.dudas, `Sumé el espacio de la nevera al muro A: ${q.muroA} + ${q.neveraEspacio} = ${suma} mm (estaban acotados aparte).`];
  q.muroA = suma;
}

export interface LecturaBoceto { productos: ProductoLeido[]; resumen: string; modelo?: string }

const INSTRUCCION = `Eres el asistente de un carpintero colombiano que fabrica muebles a medida en melamina. Te paso la foto de un boceto a mano alzada (o una foto del sitio con medidas escritas a mano). Léelo y devuelve los datos para armar cada mueble.

Reglas:
- Una misma hoja puede traer VARIOS muebles dibujados (por ejemplo un closet, un mueble de baño y una cocina). Devuelve un elemento en "productos" por cada mueble, en el orden en que aparecen. No mezcles las medidas de un mueble con las de otro: cada cota pertenece al dibujo que tiene más cerca.
- Ignora membretes, marcas de agua, logos, teléfonos y textos impresos de la hoja: no son parte del boceto.
- Lo SOMBREADO (con rayitas diagonales) son muros: el sombreado de arriba es el techo, el de abajo es el piso y los de los lados son muros laterales. Indica muroIzq, muroDer, techo y piso (true si están dibujados sombreados, false si no). Una vista de frente con muros sombreados a los dos lados es un mueble ENTRE MUROS sobre un solo muro (forma STRAIGHT), no una L ni una U.
- Las cotas escritas debajo del piso con una línea desde el extremo izquierdo y la palabra "desagüe" o "gas" son la distancia desde el muro izquierdo hasta ese punto. Una cota corta junto a un muro lateral sin palabra (por ejemplo 80 sobre el espacio sin mueble bajo) es el ancho del espacio de la nevera: ponlo en neveraEspacio (en mm). No lo pongas en "modulos" salvo que los demás módulos también estén acotados.
- Las medidas escritas a mano suelen estar en centímetros o en metros (1.50 = 1,50 m; 230 = 230 cm; 70 = 70 cm). Devuelve TODO en milímetros.
- producto: cocinas (cocina integral: muebles bajos y aéreos, poceta, estufa, platero), closets (closet con puertas, entrepaños, cajones, maletero), closetfit (closet por cuerpos o cubos), walking (walking closet), bano (mueble de baño o mueble flotante pequeño con cajón), tv (centro de entretenimiento), puertas (puerta de paso). Si no se sabe, null.
- nombre: corto, como lo diría el carpintero ("Closet de 1,50", "Cocina de 2,40", "Mueble flotante de 70").
- muroA = el ancho total del mueble o del muro principal visto de frente. muroB (brazo izquierdo) y muroC (brazo derecho) solo si el mueble dobla en L o en U. forma: STRAIGHT, L_SHAPE o U_SHAPE. En L, brazo = left o right.
- alto = altura total (piso a techo o alto del mueble). fondo = profundidad, si está acotada: suele estar escrita sobre una línea inclinada (en perspectiva) junto a una esquina del dibujo, por ejemplo "55" o "45".
- Los bocetos son vistas de frente. Un mueble es en L o en U SOLO si se dibuja un segundo muro o una vista en planta; un tramo más ancho o más alto a un lado NO es un brazo. Ante la duda, STRAIGHT.
- En cocinas, un tramo a un lado sin mueble bajo (solo con un mueble arriba) es el espacio de la nevera: nevera = inicio si está a la izquierda, final si está a la derecha. Ese tramo YA es uno de los anchos acotados (por ejemplo el 70 de "70, 60, 60, 60"): no agregues un módulo nuevo para la nevera.
- "modulos" lleva SOLO los números escritos en la fila de cotas de anchos, en el mismo orden y sin agregar, quitar ni corregir ninguno. Si su suma no coincide con el ancho total, déjalos como están y avísalo en dudas.
- Lee las alturas acotadas con cuidado y repítelas tal cual en "detalle" (por ejemplo 80 de bajos, 60 de espacio libre, 10 de remate).
- filaBaja y filaAlta (cocinas y muebles con módulos): cuenta los módulos DIBUJADOS, de izquierda a derecha. Abajo sin el espacio de la nevera; arriba sin el mueble que va sobre la nevera. Un módulo es cada caja separada por una línea vertical de arriba a abajo; dos puertas en X dentro de la misma caja son UN módulo de dos puertas. La estufa con su horno y su cajón debajo es UN solo módulo (frente = estufa); la campana dibujada en la parte de abajo de un mueble alto es parte de ESE módulo (frente = campana). Revisa que el módulo de la poceta quede sobre el desagüe y el de la estufa sobre el gas, si están acotados. Para cada uno: frente = poceta (donde está el lavaplatos o el grifo), estufa (donde están los quemadores o el horno), campana (arriba, encima de la estufa), platero (si lo dice), cajones (rectángulos horizontales apilados), abierto (sin puertas) o puertas (X, diagonales o manijas verticales); ancho = la cota en mm si está escrita sobre ese módulo, si no null; cuadros = cuántos cuadritos de la hoja mide de ancho (aproximado, con decimales si hace falta).
- muroA y alto casi siempre están en el dibujo: muroA es la cota de ancho total (si no hay, la suma de "modulos") y alto la cota vertical más larga. Solo van en null si de verdad no aparecen.
- modulos: SOLO cotas escritas a mano en el boceto, nunca anchos calculados ni estimados (para eso está "cuadros"). Si el dibujo acota el ancho de cada módulo (por ejemplo 70, 60, 60, 60), devuélvelos de izquierda a derecha en mm. Si no, lista vacía.
- Puntos de adecuación (en cocinas; en un mueble de baño, el agua y el desagüe del lavamanos; en un centro de entretenimiento, la electricidad: tomas de TV, HDMI o datos), todos como distancia en mm desde el extremo IZQUIERDO del muro hasta el centro del punto: agua = el punto de agua (suministro, fría o caliente), electricidad = una lista con cada toma o punto eléctrico dibujado (tomas, símbolo de enchufe, "luz"), vacía si no hay. No los confundas con el desagüe ni con el gas.
- Si junto a la vista de frente hay una vista superior (planta) de una cocina en L o en U, úsala para forma, brazo, muroB y muroC.
- colorEstructura, colorFachada, colorFachadaAereos: SOLO si en las imágenes o en las notas se escribe el color de los módulos (por ejemplo "fachada roble", "estructura blanca", "aéreos en gris"). colorFachada es la fachada (puertas y frentes) de los muebles de abajo o de todos, y colorFachadaAereos solo si los de arriba llevan otro color. Cópialos tal como están escritos (el nombre del color). Si no se nombra ningún color, van en null: no inventes.
- Solo en cocinas: desague = dónde está la poceta o el desagüe; gas = dónde está la estufa o el punto de gas. dist = mm desde el extremo IZQUIERDO del muro hasta el centro del punto. Si no están acotados pero se ve en qué módulo van, calcula el centro de ese módulo con los anchos de "modulos" y anótalo en dudas. nevera: inicio, final, no, o null.
- detalle: describe en español sencillo lo que se ve dibujado por dentro: cuántas puertas, cajones y entrepaños, qué va arriba y abajo, alturas acotadas (por ejemplo "bajos de 80, espacio de 60, aéreos arriba, platero sobre la poceta").
- No inventes medidas. Lo que no esté va en null y se anota en "dudas", igual que lo que tuviste que suponer.
- resumen: una frase con cuántos muebles encontraste y cuáles.`;

/** Pistas que da el carpintero antes de leer: qué dibujó y en qué unidades, más notas libres. Quitan la mayor parte de la ambigüedad. */
export interface Pistas { dibujo: 'auto' | 'frente' | 'planta' | 'ambas'; unidades: 'auto' | 'cm' | 'mm' | 'm'; notas: string }
export const PISTAS_AUTO: Pistas = { dibujo: 'auto', unidades: 'auto', notas: '' };

const REGLAS_PLANTA = `
VISTA SUPERIOR (PLANTA):
- Si el dibujo se ve desde arriba, el "0" marca la esquina de origen. La cota larga del muro de arriba es el muro A; si un tramo (como el espacio de la nevera) está acotado aparte sobre el mismo muro, SUMA ese tramo al muro A. La cota vertical que baja por un lado es el LARGO del muro B (o C): NUNCA es la altura del piso al techo. En una planta no hay altura: alto = null salvo que esté escrita aparte como "alto", "h" o "techo".
- Dos muros dibujados en esquina forman una L: forma = L_SHAPE; el brazo es "left" si el muro que baja está a la izquierda y "right" si está a la derecha.
- Las distancias del gas, el agua y la electricidad se miden desde el 0 a lo largo del muro donde se dibujó el punto: si la línea del punto sale del muro de arriba es el muro A; si sale del muro lateral, es B o C.
- El agua y el desagüe son puntos distintos: no copies uno en el otro. Si solo se dibuja el agua, desague = null.
- Los sombreados con rayitas en las esquinas o en los extremos son muros o columnas de ahí; no los uses para decidir muroIzq o muroDer si el dibujo es una planta con dos muros en L.`;

const textoPistas = (p: Pistas, nImagenes: number): string => {
  const out: string[] = [];
  if (nImagenes > 1) out.push(`Recibes ${nImagenes} imágenes del MISMO trabajo: pueden ser el boceto, fotos del sitio, medidas escritas, listas de lo que se pide o ejemplos. Combínalas. Si se contradicen, manda la del boceto y anota la duda en "dudas".`);
  if (p.dibujo === 'planta') out.push('EL CARPINTERO DICE: el dibujo es una VISTA SUPERIOR (planta). Aplica las reglas de planta.');
  else if (p.dibujo === 'frente') out.push('EL CARPINTERO DICE: el dibujo es una VISTA DE FRENTE.');
  else if (p.dibujo === 'ambas') out.push('EL CARPINTERO DICE: hay una vista de frente y una vista superior; usa la planta para la forma y los muros, y la de frente para alturas y módulos.');
  if (p.unidades === 'cm') out.push('EL CARPINTERO DICE: las medidas escritas están en CENTÍMETROS (también las de gas, agua y electricidad). Multiplica por 10 para devolver milímetros.');
  else if (p.unidades === 'm') out.push('EL CARPINTERO DICE: las medidas escritas están en METROS. Multiplica por 1000 para devolver milímetros.');
  else if (p.unidades === 'mm') out.push('EL CARPINTERO DICE: las medidas escritas ya están en MILÍMETROS.');
  else out.push('Unidades sin confirmar: si la cota de un punto (gas, agua, luz) es menor que 400 y el muro mide más de 1500, está en centímetros y hay que multiplicarla por 10.');
  if (p.notas.trim()) out.push(`NOTAS DEL CARPINTERO (tienen prioridad sobre lo que creas ver): ${p.notas.trim()}`);
  return out.join('\n');
};

const INSTRUCCION_TRANSCRIPCION = `Eres el asistente de un carpintero. Te paso fotos de un boceto hecho a mano. NO interpretes nada todavía: TRANSCRIBE lo que hay, con mucho cuidado con la letra a mano.
Devuelve:
- tipoDibujo: "frente" (se ve de frente), "planta" (se ve desde arriba), "mixto" (las dos) o "desconocido".
- textos: una lista con TODOS los números y palabras escritos (ignora marcas de agua, logos y textos impresos de la hoja). Para cada uno: texto (tal cual, por ejemplo "2540", "130", "gas", "agua", "nevera", "0"), imagen (1 si es la primera imagen, 2 la segunda...), ubicacion (dónde está, por ejemplo "sobre el muro de arriba, hacia la izquierda" o "junto a la línea vertical del lado izquierdo") y mide (qué parece medir o señalar, por ejemplo "ancho del muro de arriba", "largo del muro lateral", "distancia del gas desde el 0", "espacio de la nevera"). Si no estás seguro, dilo en mide.
- sombreados: dónde hay rayitas diagonales (muros, techo, piso, columnas).`;

const ESQUEMA_TRANSCRIPCION = {
  type: Type.OBJECT,
  properties: {
    tipoDibujo: { type: Type.STRING, enum: ['frente', 'planta', 'mixto', 'desconocido'] },
    textos: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { texto: { type: Type.STRING }, imagen: { type: Type.NUMBER }, ubicacion: { type: Type.STRING }, mide: { type: Type.STRING } }, required: ['texto', 'ubicacion', 'mide'] } },
    sombreados: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['tipoDibujo', 'textos'],
};

type Parte = { inlineData: { mimeType: string; data: string } } | { text: string };

/** Corrige con sentido común lo que Gemini suele equivocar (unidades, altura tomada de una planta, agua copiada en el desagüe) y anota las dudas */
export function corregirLectura(q: ProductoLeido, pistas: Pistas): ProductoLeido {
  const dudas = [...q.dudas];
  const largo = (m: 'A' | 'B' | 'C') => (m === 'A' ? q.muroA : m === 'B' ? q.muroB : q.muroC) ?? q.muroA ?? 0;
  type P = { muro: 'A' | 'B' | 'C'; dist: number };
  const enCm = new Set<string>(); // puntos leídos en centímetros: se avisa una sola vez
  const unidades = (p: P | null, nombre: string): P | null => {
    if (!p) return null;
    if (pistas.unidades === 'auto' && p.dist < 400 && largo(p.muro) >= 1500) { enCm.add(nombre); return { ...p, dist: p.dist * 10 }; }
    return p;
  };
  const gas = unidades(q.gas, 'Gas'), agua = unidades(q.agua, 'Agua'), desague = unidades(q.desague, 'Desagüe');
  const electricidad = q.electricidad.map(p => unidades(p, 'Electricidad')!).filter(Boolean);
  if (enCm.size) dudas.push(`${[...enCm].join(', ')}: leído en cm (×10).`);
  let alto = q.alto, muroB = q.muroB, forma = q.forma, brazo = q.brazo;
  const esPlanta = pistas.dibujo === 'planta' || q.tipoDibujo === 'planta';
  if (alto && esPlanta && alto < 2100) {
    // en una vista superior la cota vertical es el largo de un muro, no la altura del techo
    if (muroB == null && q.muroC == null && pistas.dibujo !== 'frente') {
      muroB = alto; forma = 'L_SHAPE'; brazo = brazo ?? 'left';
      dudas.push(`${alto} mm: tomado como muro B (L), no como altura.`);
    } else dudas.push(`${alto} mm parece un muro, no la altura: ponla a mano.`);
    alto = null;
  } else if (alto && alto < 1800) dudas.push(`Altura de ${alto} mm: es poco, revísala.`);
  let fondo = q.fondo;
  if (fondo && fondo < 150) { dudas.push(`Fondo ${fondo}: leído en cm (×10).`); fondo = fondo * 10; }
  if (agua && desague && agua.muro === desague.muro && agua.dist === desague.dist) dudas.push('Desagüe igual al agua: ¿supuesto?');
  // colores escritos en las "notas para la lectura": se aplican aunque el modelo no los haya recogido (lo que lea del dibujo manda)
  const dn = coloresDeNotas(pistas.notas);
  const colores = { estructura: q.colores?.estructura ?? dn.estructura, fachada: q.colores?.fachada ?? dn.fachada, fachadaAereos: q.colores?.fachadaAereos ?? dn.fachadaAereos };
  return { ...q, gas, agua, desague, electricidad, alto, fondo, muroB, forma, brazo, dudas, colores };
}

const punto = { type: Type.OBJECT, nullable: true, properties: { muro: { type: Type.STRING, enum: ['A', 'B', 'C'] }, dist: { type: Type.NUMBER } }, required: ['muro', 'dist'] };
const ESQUEMA = {
  type: Type.OBJECT,
  properties: {
    productos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          producto: { type: Type.STRING, nullable: true, enum: ['cocinas', 'closets', 'closetfit', 'walking', 'bano', 'tv', 'puertas'] },
          nombre: { type: Type.STRING },
          colorEstructura: { type: Type.STRING, nullable: true }, colorFachada: { type: Type.STRING, nullable: true }, colorFachadaAereos: { type: Type.STRING, nullable: true },
          tipoDibujo: { type: Type.STRING, nullable: true, enum: ['frente', 'planta', 'mixto'] },
          forma: { type: Type.STRING, nullable: true, enum: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'] },
          brazo: { type: Type.STRING, nullable: true, enum: ['left', 'right'] },
          muroA: { type: Type.NUMBER, nullable: true }, muroB: { type: Type.NUMBER, nullable: true }, muroC: { type: Type.NUMBER, nullable: true },
          alto: { type: Type.NUMBER, nullable: true }, fondo: { type: Type.NUMBER, nullable: true },
          desague: punto, gas: punto, agua: punto,
          electricidad: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { muro: { type: Type.STRING, enum: ['A', 'B', 'C'] }, dist: { type: Type.NUMBER } }, required: ['muro', 'dist'] } },
          nevera: { type: Type.STRING, nullable: true, enum: ['no', 'inicio', 'final'] },
          neveraEspacio: { type: Type.NUMBER, nullable: true },
          muroIzq: { type: Type.BOOLEAN, nullable: true }, muroDer: { type: Type.BOOLEAN, nullable: true },
          techo: { type: Type.BOOLEAN, nullable: true }, piso: { type: Type.BOOLEAN, nullable: true },
          modulos: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          filaBaja: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { frente: { type: Type.STRING, enum: ['puertas', 'cajones', 'abierto', 'poceta', 'estufa', 'campana', 'platero'] }, ancho: { type: Type.NUMBER, nullable: true }, cuadros: { type: Type.NUMBER } }, required: ['frente', 'cuadros'] } },
          filaAlta: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { frente: { type: Type.STRING, enum: ['puertas', 'cajones', 'abierto', 'poceta', 'estufa', 'campana', 'platero'] }, ancho: { type: Type.NUMBER, nullable: true }, cuadros: { type: Type.NUMBER } }, required: ['frente', 'cuadros'] } },
          detalle: { type: Type.STRING },
          dudas: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['nombre', 'detalle', 'dudas', 'modulos'],
      },
    },
    resumen: { type: Type.STRING },
  },
  required: ['productos', 'resumen'],
};

export async function leerBoceto(imagenes: string[], pistas: Pistas = PISTAS_AUTO): Promise<LecturaBoceto> {
  if (!iaDisponible()) throw new Error('Falta configurar Supabase en .env.local.');
  if (!imagenes.length) throw new Error('Adjunta al menos una imagen.');
  const imgs: Parte[] = imagenes.map(im => {
    const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(im);
    if (!m) throw new Error('No se pudo leer una de las imágenes. Usa fotos en JPG o PNG.');
    return { inlineData: { mimeType: m[1], data: m[2] } };
  });
  const ai = ia; // Gemini por el servidor: la clave no viaja en la app
  let ultimo: unknown = null;
  const errores: string[] = []; // el error de cada modelo: se informa el más útil (límite de uso antes que modelo no disponible)
  for (const model of MODELOS) {
    try {
      // paso 1: transcribir lo que hay, sin interpretar (si falla, se lee sin transcripción)
      let transcripcion = '';
      try {
        const t = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [...imgs, { text: INSTRUCCION_TRANSCRIPCION }] }],
          config: { responseMimeType: 'application/json', responseSchema: ESQUEMA_TRANSCRIPCION, temperature: 0 },
        });
        transcripcion = (t.text ?? '').slice(0, 6000);
      } catch (e) { console.warn('Transcripción del boceto falló, se lee directo:', e); }
      // paso 2: interpretar con las reglas, las pistas y la transcripción
      const partesTexto = [INSTRUCCION, REGLAS_PLANTA, textoPistas(pistas, imagenes.length), transcripcion ? `TRANSCRIPCIÓN PREVIA (hecha antes, puede tener errores: verifícala con las imágenes y usa lo que sea correcto):\n${transcripcion}` : ''].filter(Boolean).join('\n\n');
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [...imgs, { text: partesTexto }] }],
        config: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.1 },
      });
      const j = JSON.parse(r.text ?? '{}');
      const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v) : null);
      const fila = (v: any): ModuloDibujado[] => (Array.isArray(v) ? v : []).filter((m: any) => m && typeof m.frente === 'string').map((m: any) => ({ frente: m.frente, ancho: n(m.ancho), cuadros: typeof m.cuadros === 'number' && m.cuadros > 0 ? m.cuadros : 1 }));
      const p = (v: any) => (v && ['A', 'B', 'C'].includes(v.muro) && n(v.dist) !== null ? { muro: v.muro as 'A' | 'B' | 'C', dist: n(v.dist)! } : null);
      const productos: ProductoLeido[] = (Array.isArray(j.productos) ? j.productos : []).map((q: any) => corregirLectura({
        producto: q.producto ?? null, nombre: String(q.nombre ?? 'Mueble'), forma: q.forma ?? null, brazo: q.brazo ?? null,
        muroA: n(q.muroA), muroB: n(q.muroB), muroC: n(q.muroC), alto: n(q.alto), fondo: n(q.fondo),
        desague: p(q.desague), gas: p(q.gas), agua: p(q.agua), electricidad: (Array.isArray(q.electricidad) ? q.electricidad : []).map(p).filter((v: { muro: 'A' | 'B' | 'C'; dist: number } | null): v is { muro: 'A' | 'B' | 'C'; dist: number } => v !== null), nevera: q.nevera ?? null,
        neveraEspacio: n(q.neveraEspacio),
        muroIzq: typeof q.muroIzq === 'boolean' ? q.muroIzq : null, muroDer: typeof q.muroDer === 'boolean' ? q.muroDer : null,
        techo: typeof q.techo === 'boolean' ? q.techo : null, piso: typeof q.piso === 'boolean' ? q.piso : null,
        modulos: Array.isArray(q.modulos) ? q.modulos.map(n).filter((v: number | null): v is number => v !== null) : [],
        filaBaja: fila(q.filaBaja), filaAlta: fila(q.filaAlta),
        detalle: String(q.detalle ?? ''), dudas: Array.isArray(q.dudas) ? q.dudas.map(String) : [],
        tipoDibujo: ['frente', 'planta', 'mixto'].includes(q.tipoDibujo) ? q.tipoDibujo : null,
        colores: (() => { const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : undefined); return { estructura: s(q.colorEstructura), fachada: s(q.colorFachada), fachadaAereos: s(q.colorFachadaAereos) }; })(),
      }, pistas));
      productos.forEach(q => sumarNevera(q, transcripcion, pistas));
      if (productos.length === 0) throw new Error('No encontré ningún mueble en la foto.');
      return { productos, resumen: String(j.resumen ?? ''), modelo: model };
    } catch (e) { ultimo = e; errores.push(`${model}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const msg = errores.find(t => /429|quota|RESOURCE_EXHAUSTED/i.test(t)) ?? errores.find(t => /API key not valid|401|403|PERMISSION_DENIED/i.test(t)) ?? (ultimo instanceof Error ? ultimo.message : String(ultimo));
  console.warn('Lectura del boceto falló:', errores);
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new Error('La cuenta de Gemini llegó a su límite de uso. Espera un momento y vuelve a intentar, o activa la facturación en Google AI Studio.');
  if (/API key not valid|PERMISSION_DENIED/i.test(msg)) throw new Error('Gemini rechazó la clave del servidor. Revísala en Supabase → Edge Functions → Secrets.');
  if (/Entra con tu cuenta|no está puesta en el servidor|Supabase/i.test(msg)) throw new Error(msg);
  throw new Error(`No se pudo leer el boceto: ${msg.slice(0, 300)}`);
}
