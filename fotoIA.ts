import { GoogleGenAI } from '@google/genai';

/**
 * Fase 4 · Foto con IA: convierte la vista del render en una foto realista.
 * La imagen del diseño sale hacia el servicio de Gemini (Google) con la clave GEMINI_API_KEY de `.env.local`; cada imagen tiene costo.
 */

// se prueban en orden: si la cuenta no tiene acceso al primero, se intenta con el siguiente
const MODELOS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

export const claveIAConfigurada = (): boolean => { const k = process.env.API_KEY; return !!k && k.length >= 30 && !/placeholder/i.test(k); };

export interface PedidoFoto { imagenPng: string; producto: string; fachada: string; meson: string; ambiente: string; extra?: string }

export function instruccionFoto(p: Omit<PedidoFoto, 'imagenPng'>): string {
  return [
    `Convierte esta imagen 3D de ${p.producto} en una fotografía de interiorismo realista.`,
    'Conserva EXACTAMENTE la geometría: la misma cantidad de módulos, puertas y cajones, las mismas proporciones, la misma posición de cada mueble y el mismo punto de vista de la cámara. No agregues ni quites muebles.',
    `Fachadas (puertas y frentes) en melamina ${p.fachada}, con su veta y textura reales.`,
    p.meson ? `Mesón en ${p.meson}.` : '',
    `Ambiente: ${p.ambiente}. Luz natural suave, sombras reales, piso y pared con materiales creíbles.`,
    'Puedes agregar detalles pequeños que no cambien el mueble: manijas o perfil de agarre discretos, grifería, algún objeto decorativo.',
    p.extra ?? '',
    'Sin texto, sin cotas, sin marcas de agua.',
  ].filter(Boolean).join(' ');
}

/** Devuelve la foto como data URL (PNG o JPG) */
export async function fotoConIA(p: PedidoFoto): Promise<string> {
  if (!claveIAConfigurada()) throw new Error('Falta la clave de Gemini. Ponla en el archivo .env.local como GEMINI_API_KEY y reinicia la app.');
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = p.imagenPng.replace(/^data:image\/\w+;base64,/, '');
  let ultimo: unknown = null;
  for (const model of MODELOS) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data } }, { text: instruccionFoto(p) }] }],
      });
      const parte = r.candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data);
      if (parte?.inlineData?.data) return `data:${parte.inlineData.mimeType ?? 'image/png'};base64,${parte.inlineData.data}`;
      ultimo = new Error('El servicio respondió sin imagen.');
    } catch (e) { ultimo = e; }
  }
  const msg = ultimo instanceof Error ? ultimo.message : String(ultimo);
  // la cuenta gratuita de Gemini no incluye generación de imágenes (cuota 0): hay que activar la facturación
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new Error('Tu clave funciona, pero la cuenta gratuita de Gemini no incluye generar imágenes (cuota en 0). Activa la facturación del proyecto en Google AI Studio y vuelve a intentar.');
  if (/API key not valid|401|403|PERMISSION_DENIED/i.test(msg)) throw new Error('Gemini rechazó la clave. Revisa que esté bien copiada en .env.local y reinicia la app.');
  throw new Error(`No se pudo generar la foto: ${msg.slice(0, 300)}`);
}
