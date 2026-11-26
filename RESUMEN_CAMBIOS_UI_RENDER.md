# Resumen de cambios UI/UX, Render 3D y Foto con IA — Modully

Fecha: 2026-11-26  
Alcance: Rediseño visual completo (estilo minimalista Linear / Apple / Figma) y mejoras del motor 3D / Renderizado sin modificar lógica de negocio, medidas, cálculos, despiece ni rutas de datos.

---

## 1. Sistema de diseño y navegación (Fase 1)

- **Paleta global unificada**:
  - Fondo general `bg-slate-50`, tarjetas `bg-white border border-slate-200/80 rounded-2xl shadow-sm`.
  - Botón protagonista único por pantalla (`bg-slate-900 hover:bg-slate-800 text-white rounded-xl`), botones secundarios (`bg-white border border-slate-200 text-slate-700 rounded-xl`) y acento (`text-indigo-600 bg-indigo-50 border-indigo-200`).
  - Títulos en tipo oración (`font-semibold tracking-tight text-slate-900`), eliminando encabezados en todo mayúsculas.
- **Navegación superior en 2 niveles**:
  - Reemplazada la barra inferior de 11 ítems y el botón flotante `← Inicio` por barra superior fija (`sticky top-0`) con logo, menú simple (`Inicio`, `Proyectos`, `Biblioteca de Módulos`, `Configuración`), selector de categoría de producto, `+ Nuevo Proyecto`, `Ajustes` y `Perfil`.
  - Dentro de un proyecto activo se muestra el stepper horizontal de 4 pasos: **1. Boceto**, **2. Diseño 3D**, **3. Precios** y **4. Entregables** (con sub-pestañas `Render 3D`, `Planos`, `Láminas` y `Listado`).
- **Selector de categorías (`SECTION_ICONS` / `SectionLineIcon`)**:
  - Íconos lineales arquitectónicos personalizados para `Cocinas integrales`, `Closet constructor`, `Closet fit`, `Walking closets`, `Puertas`, `Muebles de baño` y `Centro de entretenimiento`.

## 2. Pantalla de Inicio / Dashboard (Fase 2)

- **Hero Banner** con saludo personalizado, subtítulo corto y 2 acciones principales: **Empezar desde un Boceto** y **Crear desde Cero**.
- **Proyectos recientes**: tarjetas visuales en cuadrícula conectadas al estado/Supabase y enlace `Ver todos los proyectos`.
- **Biblioteca & Inspiración**: 4 tarjetas rápidas (`Cocinas Integrales`, `Closets & Vestidores`, `Muebles de Baño`, `Centros de Entretenimiento`) con ilustraciones SVG ampliadas (isométricas arquitectónicas en cocina, closet y baño; vista frontal clara en centros de entretenimiento).
- **Cómo funciona Modully**: guía compacta de 3 pasos.

## 3. Boceto y Visor 3D intuitivos (Fase 3)

- **Paso 1 · Boceto** ([Bosquejo.tsx](Bosquejo.tsx)):
  - Opciones técnicas de lectura agrupadas en acordeón discreto (`⚙ Ajustar lectura (unidades y vista)` con `Auto-detectar` por defecto).
  - Un botón protagonista `Analizar boceto` y tarjeta de resultado limpia a la derecha con botón `Ver mi diseño en 3D →`.
- **Paso 2 · Diseño 3D** ([App.tsx](App.tsx), [KitchenViewer3D.tsx](KitchenViewer3D.tsx)):
  - Canvas amplio con barra superior flotante de vistas (`Vista 3D`, `Planta`, `Frontal`, `Isométrica`) y menú desplegable `Capas: Mostrar / Ocultar`.
  - Jerga técnica `MA` y `MB` reemplazada por **Muebles altos** y **Muebles bajos**.
  - Panel derecho simplificado con sección de `Color & Material`, bloque `Módulos / Ver todos` colapsable debajo de `Personalizar`, y CTA `Ver Costos y Precios →`.

## 4. Precios y Entregables (Fase 4)

- **Precios** ([Precios.tsx](Precios.tsx)):
  - Tarjeta blanca limpia para `Precio de venta` con cifra destacada en negro, badge verde suave de margen y CTA `Continuar a Entregables →`.
  - Alertas suavizadas a `bg-amber-50` y corrección de texto (`este diseño`).
- **Entregables** ([App.tsx](App.tsx), [RenderVista.tsx](RenderVista.tsx), [PlanosEnsamble.tsx](PlanosEnsamble.tsx), [PanelLaminas.tsx](PanelLaminas.tsx), [PlanoLimpio.tsx](PlanoLimpio.tsx)):
  - Sub-pestañas limpias: `Render 3D`, `Planos`, `Láminas` y `Listado`.

## 5. Mejoras del Render 3D y Acabado de Estudio

- **Correcciones en `RenderVista.tsx` y `App.tsx`**:
  - Aberturas reales en el mesón mediante `ExtrudeGeometry` (`BoxConHuecos`) y renderizado completo de **poceta** (cubeta honda de acero, borde y desagüe), **grifería** cuello de ganso cromada (`SinkRender3D`), **estufa** vitrocerámica (`StoveRender3D`), **campanas** y detalles de **nevera** e islas/penínsulas.
  - Eliminado el parpadeo (`z-fighting`) en tapas superiores omitiendo envolventes sólidas de módulos ya detallados en piezas.
  - Separación independiente de fachadas `Muebles altos` (`faceColorMA`) y `Muebles bajos` (`faceColor`).
  - Botón `Renderizar` con texturas PBR procedurales locales (veta de madera suave vertical, cuarzo veteado en mesón y piso ciclorama).
- **5 ajustes técnicos de acabado estudio europeo** ([KitchenViewer3D.tsx](KitchenViewer3D.tsx), [RenderVista.tsx](RenderVista.tsx), [constants.ts](constants.ts)):
  1. **Renderer y Tone Mapping**: `ACESFilmicToneMapping`, `toneMappingExposure = 1.05`, `SRGBColorSpace` y `PCFSoftShadowMap`.
  2. **Iluminación de estudio**: eliminación de luces puntuales frontales sobre la nevera, `<Environment environmentIntensity={0.45}>` con fondo difuso `#e5e3de` y `<Lightformer>` suaves, `DirectionalLight` principal suave (`2048×2048`, `shadow-bias={-0.0005}`) y `<hemisphereLight>` cálida de relleno.
  3. **Sombras de contacto y piso `#EDEBE6`**: `<ContactShadows opacity={0.25} blur={2.4} far={1.2} />` sobre fondo/piso mate `#EDEBE6` continuo.
  4. **Materiales PBR**: melamina blanca mate `#F4F4F2` (`roughness: 0.72`, `metalness: 0.02`), madera (`roughness: 0.65`, `metalness: 0.0`), acero inoxidable satinado en nevera/poceta/campana (`#B8BCC0`, `metalness: 0.75`, `roughness: 0.32`) y juntas sutiles entre puertas (`Edges` a `opacity={0.14}`).
  5. **Tira LED continua bajo muebles altos**: `RectAreaLightUniformsLib.init()` con `<rectAreaLight color="#FFE8C8" />` y difusor continuo sobre el salpicadero.

## 6. Generar Foto Realista (IA) con Gemini

- **Configuración de entorno y cliente** ([vite.config.ts](vite.config.ts), [fotoIA.ts](fotoIA.ts)):
  - Exposición de `GEMINI_API_KEY` desde `.env.local` y soporte directo vía `@google/genai` (`GoogleGenAI`) con respaldo hacia Supabase Edge Function si no existe clave local.
  - Prompt arquitectónico estricto Image-to-Image parametrizado por piso y luz.
- **UX de Render + IA** ([RenderVista.tsx](RenderVista.tsx)):
  - Selector visual compacto de **Tipo de piso** (`Porcelanato Beige`, `Madera Clara`, `Gris Cemento`, `Mármol Blanco`) y **Ambiente de luz** (`Luz Día`, `Luz Cálida`).
  - Estado de carga `Renderizando acabado fotorrealista...`, alternador `Ver 3D / Ver Foto IA` y botón principal negro `Descargar imagen`.

## 7. Archivos modificados y creados

| Archivo | Propósito principal |
| --- | --- |
| `App.tsx` | Sistema de diseño, navegación de 2 niveles, stepper de 4 pasos, iconos lineales `SectionLineIcon`, flujo 3D/entregables y paso de accesorios/acabados a `RenderVista`. |
| `Inicio.tsx` | Rediseño del dashboard e ilustraciones de categorías en `Biblioteca & Inspiración`. |
| `Bosquejo.tsx` | Acordeón técnico discreto y tarjeta limpia de análisis para Paso 1. |
| `Precios.tsx` | Tarjeta limpia de precio de venta, badge de margen y alertas suavizadas. |
| `RenderVista.tsx` | Motor de render realista PBR, poceta/grifería/electrodomésticos, `RectAreaLight` LED, botón `Renderizar` y panel `Generar Foto Realista (IA)`. |
| `KitchenViewer3D.tsx` | Ajustes de estudio en el visor 3D principal (`ACESFilmic`, `PCFSoftShadowMap`, `Environment`, `ContactShadows`, piso `#EDEBE6`, PBR y `RectAreaLight`). |
| `constants.ts` | Acero inoxidable satinado `#B8BCC0` en `COLORS.FRIDGE`. |
| `fotoIA.ts` | Conexión Image-to-Image con Gemini (`@google/genai`), `responseModalities` y prompt dinámico de piso/luz. |
| `vite.config.ts` | Inyección de `GEMINI_API_KEY` de `.env.local` para `Foto con IA`. |
| `Biblioteca.tsx`, `ModulosEspeciales.tsx`, `PanelLaminas.tsx`, `PlanoLimpio.tsx`, `PlanosEnsamble.tsx`, `Proyectos.tsx` | Adaptación de tarjetas, botones, bordes y tipografía al nuevo sistema de diseño. |
| `RESUMEN_CAMBIOS_UI_RENDER.md` | Documento resumen de todos los cambios realizados. |

## 8. Verificación final

- **TypeScript y compilación de producción (`npx tsc --noEmit` + `npm run build`)**: exitosos con código `0`.
- **Pruebas visuales en navegador (`http://localhost:3000/`)**: todas las pantallas y ajustes 3D/Render verificados sin errores de consola ni WebGL. Al probar en vivo `Generar Foto Realista (IA)` con `GEMINI_API_KEY` de `.env.local`, la conexión llegó a la API de Gemini y mostró el aviso controlado de cuota `429` pendiente de facturación/cuota en Google AI Studio.
