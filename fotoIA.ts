import { GoogleGenAI } from '@google/genai';
import { ia, iaDisponible } from './nube';

/**
 * Fase 4 · Foto con IA: convierte la vista 3D del render en una fotografía arquitectónica realista.
 * Usa la clave GEMINI_API_KEY de `.env.local` / `VITE_GEMINI_API_KEY` si está configurada, o el proxy de Supabase si no.
 */

// Se prueban en orden: si la cuenta no tiene acceso al primero, se intenta con el siguiente
const MODELOS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

const claveLocal = (): string => (
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
  process.env.GEMINI_API_KEY ||
  process.env.API_KEY ||
  ''
).trim();

export const claveIAConfigurada = (): boolean => Boolean(claveLocal()) || iaDisponible();

export interface PedidoFoto {
  imagenPng: string;
  pisoPrompt?: string;
  luzPrompt?: string;
  producto?: string;
  fachada?: string;
  meson?: string;
  ambiente?: string;
  extra?: string;
}

export function instruccionFoto(p: Omit<PedidoFoto, 'imagenPng'>): string {
  const valorPiso = p.pisoPrompt || 'porcelanato beige mate de formato grande';
  const valorLuz = p.luzPrompt || 'iluminación natural diurna suave entrando desde un lateral';
  return [
    'Convierte esta vista 3D de mobiliario en una fotografía arquitectónica fotorrealista de catálogo europeo.',
    'REGLAS ESTRICTAS:',
    '- Mantén EXACTAMENTE la misma geometría, cantidad de puertas, distribución, electrodomésticos y colores de los muebles de la imagen original. No agregues ni quites módulos, ni pongas decoración, platos ni plantas extra.',
    '- Mejora los materiales a acabado real: melamina mate con textura sutil, veta de madera natural realista, acero inoxidable cepillado en nevera/campana, y mesón de cuarzo con brillo suave.',
    `- Aplica un piso de ${valorPiso} con reflejos suaves y sombras de contacto reales debajo de los muebles.`,
    `- Usa ${valorLuz} más luz LED cálida (3000K) continua y realista debajo de los muebles altos.`,
    '- Nitidez fotográfica, encuadre limpio, estilo revista de diseño interior.',
    p.extra?.trim() ? `- Nota adicional: ${p.extra.trim()}` : '',
  ].filter(Boolean).join('\n');
}

/** Devuelve la foto generada como data URL (PNG o JPG) */
export async function fotoConIA(p: PedidoFoto): Promise<string> {
  const apiKey = claveLocal();
  if (!apiKey && !iaDisponible()) {
    throw new Error('Configura GEMINI_API_KEY en .env.local o conecta Supabase para generar fotos con IA.');
  }

  const data = p.imagenPng.replace(/^data:image\/\w+;base64,/, '');
  const prompt = instruccionFoto(p);
  const contents = [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data } }, { text: prompt }] }];
  const directAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

  let ultimo: unknown = null;
  for (const model of MODELOS) {
    try {
      const r = directAI
        ? await directAI.models.generateContent({ model, contents, config: { responseModalities: ['IMAGE', 'TEXT'] } })
        : await ia.models.generateContent({ model, contents });
      const parte = r.candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (parte?.inlineData?.data) return `data:${parte.inlineData.mimeType ?? 'image/png'};base64,${parte.inlineData.data}`;
      ultimo = new Error('El servicio respondió sin imagen.');
    } catch (e) {
      ultimo = e;
    }
  }

  const msg = ultimo instanceof Error ? ultimo.message : String(ultimo);
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    throw new Error('La cuota de generación de imágenes en Gemini está en 0 o agotada (429). Verifica la facturación del proyecto en Google AI Studio.');
  }
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    throw new Error('Gemini rechazó la clave API configurada. Verifica GEMINI_API_KEY en .env.local.');
  }
  if (/Entra con tu cuenta|no está puesta en el servidor|Supabase/i.test(msg)) throw new Error(msg);
  throw new Error(`No se pudo generar la foto: ${msg.slice(0, 300)}`);
}
