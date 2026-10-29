import { GoogleGenAI } from '@google/genai';
import { Appliance, KitchenModule, LayoutType } from './types';

export interface KitchenAgentContext {
  wallA: number;
  wallB: number;
  wallC: number;
  layout: LayoutType;
  spaceHeight: number;
  modules: KitchenModule[];
  appliances: Appliance[];
  specialModules: Array<{ id: string; name: string; active: boolean; width: number; distance: number }>;
  activeView: string;
}

const buildLocalAdvice = (context: KitchenAgentContext, prompt: string): string => {
  const activeAppliances = context.appliances.filter((item) => item.active).map((item) => item.type);
  const activeSummary = activeAppliances.length > 0 ? activeAppliances.join(', ') : 'ninguno';
  const moduleSummary = context.modules.length > 0
    ? context.modules.slice(0, 4).map((module) => `${module.name} (${module.width}mm)`).join(', ')
    : 'sin módulos añadidos';

  return `Asistente local activo. Para “${prompt}”, el contexto actual indica una cocina ${context.layout.toLowerCase()} con muro A de ${context.wallA}mm, altura de ${context.spaceHeight}mm y ${context.modules.length} módulos en escena. Los electrodomésticos activos son: ${activeSummary}. Tu diseño actual resume ${moduleSummary}. Revisa la distribución de la nevera y la estufa, deja continuidad en los módulos y prioriza el cierre exacto de los extremos.`;
};

export const getAgentAdvice = async (context: KitchenAgentContext, prompt: string): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    return buildLocalAdvice(context, prompt);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `
        Actúa como un asistente experto en diseño de cocinas modulares.
        Responde en español, con tono práctico y breve.
        Usa el siguiente contexto del proyecto:
        - Tipo de cocina: ${context.layout}
        - Muro A: ${context.wallA}mm
        - Muro B: ${context.wallB}mm
        - Muro C: ${context.wallC}mm
        - Altura libre: ${context.spaceHeight}mm
        - Vistas activas: ${context.activeView}
        - Módulos actuales: ${context.modules.map((module) => `${module.name} (${module.width}mm)`).join(', ') || 'ninguno'}
        - Electrodomésticos activos: ${context.appliances.filter((item) => item.active).map((item) => item.type).join(', ') || 'ninguno'}
        - Módulos especiales: ${context.specialModules.filter((item) => item.active).map((item) => item.name).join(', ') || 'ninguno'}

        Pregunta del usuario: ${prompt}

        Entrega una respuesta accionable, con hasta 5 recomendaciones concretas y un cierre claro.
      `
    });

    return response.text?.trim() || buildLocalAdvice(context, prompt);
  } catch (error) {
    return buildLocalAdvice(context, prompt);
  }
};
