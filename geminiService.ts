
import { Type } from "@google/genai";
import { ia } from "./nube";
import { SuggestionResponse, LayoutType } from "./types";
import { MODULE_TEMPLATES } from "./constants";

export const getAILayoutSuggestion = async (
  wallA: number,
  wallB: number,
  wallC: number,
  layout: LayoutType,
  hasIsland: boolean,
  islandLength: number,
  hasFridge: boolean,
  spaceHeight: number
): Promise<SuggestionResponse> => {
  const ai = ia; // Gemini por el servidor

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `
      Actúa como un experto diseñador de cocinas modulares. Tu misión es generar un diseño técnico IMPECABLE y COMPLETO.

      CONTEXTO:
      - Pared A (Principal): ${wallA}mm. Es donde se concentra el diseño.
      - ¿Hay Nevera?: ${hasFridge ? 'SÍ' : 'NO'}.
      - Altura: ${spaceHeight}mm.

      REGLAS CRÍTICAS PARA EVITAR ERRORES (Ver Referencias):
      1. SIN HUECOS AL INICIO (Círculo Verde): El diseño debe empezar exactamente en el milímetro 0 de la pared A. No dejes espacios vacíos al principio.
      2. SIN HUECOS INTERMEDIOS (Círculo Amarillo): Los módulos deben ser contiguos. Si un módulo termina en X, el siguiente debe empezar en X.
      3. SOBRENEVERA OBLIGATORIO (Círculo Rojo): Si hasFridge es true, DEBES incluir un item con isFridgeCabinet: true. Su ancho debe ser el ancho de la nevera + 100mm.
      4. REGLA TALL / TORRES (Círculo Azul): Un mueble tipo TALL ocupa todo el espacio vertical. Si usas un TALL, no sugieras nada más (bajo o aéreo) en ese mismo tramo horizontal. Evita colisiones.
      5. CENTRADO DE ESTUFA: El mueble isStoveCabinet (>= 600mm) debe estar alineado con la posición de la estufa.

      ESTRATEGIA DE DISEÑO:
      - Paso 1: Ubica la Nevera (con su mueble superior) y la Estufa (con su mueble bajo).
      - Paso 2: Rellena TODO el espacio restante a la izquierda, derecha y entre ellos con módulos de 300, 600 o 900mm.
      - Paso 3: Asegúrate de que la fila inferior (Lowers) y la fila superior (Uppers) estén completas de extremo a extremo del muro.

      CATÁLOGO DE REFERENCIA:
      ${MODULE_TEMPLATES.map(m => `- ${m.id}: ${m.name} (Ancho: ${m.width}mm, Tipo: ${m.type})`).join('\n')}

      FORMATO DE SALIDA (JSON ÚNICAMENTE):
      {
        "items": [
          {
            "moduleId": "string",
            "quantity": 1,
            "section": "Pared A",
            "isFridgeCabinet": boolean,
            "isStoveCabinet": boolean,
            "configType": "doors" | "drawers"
          }
        ],
        "explanation": "Breve resumen de cómo se llenaron los huecos y se evitaron colisiones.",
        "totalWidthUsed": number
      }
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                moduleId: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                section: { type: Type.STRING },
                configType: { type: Type.STRING },
                isFridgeCabinet: { type: Type.BOOLEAN },
                isStoveCabinet: { type: Type.BOOLEAN }
              },
              required: ['moduleId', 'quantity', 'section']
            }
          },
          explanation: { type: Type.STRING },
          totalWidthUsed: { type: Type.NUMBER }
        },
        required: ['items', 'explanation', 'totalWidthUsed']
      }
    }
  });

  try {
    const jsonStr = response.text?.trim() || '{"items":[],"explanation":"Error","totalWidthUsed":0}';
    return JSON.parse(jsonStr);
  } catch (error) {
    return { items: [], explanation: "Error de comunicación con el experto en diseño.", totalWidthUsed: 0 };
  }
};
