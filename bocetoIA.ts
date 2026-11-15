import { GoogleGenAI, Type } from '@google/genai';
import { claveIAConfigurada } from './fotoIA';

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
}
export interface LecturaBoceto { productos: ProductoLeido[]; resumen: string }

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
- Solo en cocinas: desague = dónde está la poceta o el desagüe; gas = dónde está la estufa o el punto de gas. dist = mm desde el extremo IZQUIERDO del muro hasta el centro del punto. Si no están acotados pero se ve en qué módulo van, calcula el centro de ese módulo con los anchos de "modulos" y anótalo en dudas. nevera: inicio, final, no, o null.
- detalle: describe en español sencillo lo que se ve dibujado por dentro: cuántas puertas, cajones y entrepaños, qué va arriba y abajo, alturas acotadas (por ejemplo "bajos de 80, espacio de 60, aéreos arriba, platero sobre la poceta").
- No inventes medidas. Lo que no esté va en null y se anota en "dudas", igual que lo que tuviste que suponer.
- resumen: una frase con cuántos muebles encontraste y cuáles.`;

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
          forma: { type: Type.STRING, nullable: true, enum: ['STRAIGHT', 'L_SHAPE', 'U_SHAPE'] },
          brazo: { type: Type.STRING, nullable: true, enum: ['left', 'right'] },
          muroA: { type: Type.NUMBER, nullable: true }, muroB: { type: Type.NUMBER, nullable: true }, muroC: { type: Type.NUMBER, nullable: true },
          alto: { type: Type.NUMBER, nullable: true }, fondo: { type: Type.NUMBER, nullable: true },
          desague: punto, gas: punto,
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

export async function leerBoceto(imagen: string): Promise<LecturaBoceto> {
  if (!claveIAConfigurada()) throw new Error('Falta la clave de Gemini. Ponla en el archivo .env.local como GEMINI_API_KEY y reinicia la app.');
  const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(imagen);
  if (!m) throw new Error('No se pudo leer la imagen. Usa una foto en JPG o PNG.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let ultimo: unknown = null;
  const errores: string[] = []; // el error de cada modelo: se informa el más útil (límite de uso antes que modelo no disponible)
  for (const model of MODELOS) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: INSTRUCCION }] }],
        config: { responseMimeType: 'application/json', responseSchema: ESQUEMA as any, temperature: 0.1 },
      });
      const j = JSON.parse(r.text ?? '{}');
      const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? Math.round(v) : null);
      const fila = (v: any): ModuloDibujado[] => (Array.isArray(v) ? v : []).filter((m: any) => m && typeof m.frente === 'string').map((m: any) => ({ frente: m.frente, ancho: n(m.ancho), cuadros: typeof m.cuadros === 'number' && m.cuadros > 0 ? m.cuadros : 1 }));
      const p = (v: any) => (v && ['A', 'B', 'C'].includes(v.muro) && n(v.dist) !== null ? { muro: v.muro as 'A' | 'B' | 'C', dist: n(v.dist)! } : null);
      const productos: ProductoLeido[] = (Array.isArray(j.productos) ? j.productos : []).map((q: any) => ({
        producto: q.producto ?? null, nombre: String(q.nombre ?? 'Mueble'), forma: q.forma ?? null, brazo: q.brazo ?? null,
        muroA: n(q.muroA), muroB: n(q.muroB), muroC: n(q.muroC), alto: n(q.alto), fondo: n(q.fondo),
        desague: p(q.desague), gas: p(q.gas), nevera: q.nevera ?? null,
        neveraEspacio: n(q.neveraEspacio),
        muroIzq: typeof q.muroIzq === 'boolean' ? q.muroIzq : null, muroDer: typeof q.muroDer === 'boolean' ? q.muroDer : null,
        techo: typeof q.techo === 'boolean' ? q.techo : null, piso: typeof q.piso === 'boolean' ? q.piso : null,
        modulos: Array.isArray(q.modulos) ? q.modulos.map(n).filter((v: number | null): v is number => v !== null) : [],
        filaBaja: fila(q.filaBaja), filaAlta: fila(q.filaAlta),
        detalle: String(q.detalle ?? ''), dudas: Array.isArray(q.dudas) ? q.dudas.map(String) : [],
      }));
      if (productos.length === 0) throw new Error('No encontré ningún mueble en la foto.');
      return { productos, resumen: String(j.resumen ?? '') };
    } catch (e) { ultimo = e; errores.push(`${model}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const msg = errores.find(t => /429|quota|RESOURCE_EXHAUSTED/i.test(t)) ?? errores.find(t => /API key not valid|401|403|PERMISSION_DENIED/i.test(t)) ?? (ultimo instanceof Error ? ultimo.message : String(ultimo));
  console.warn('Lectura del boceto falló:', errores);
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new Error('La cuenta de Gemini llegó a su límite de uso. Espera un momento y vuelve a intentar, o activa la facturación en Google AI Studio.');
  if (/API key not valid|401|403|PERMISSION_DENIED/i.test(msg)) throw new Error('Gemini rechazó la clave. Revisa que esté bien copiada en .env.local y reinicia la app.');
  throw new Error(`No se pudo leer el boceto: ${msg.slice(0, 300)}`);
}
