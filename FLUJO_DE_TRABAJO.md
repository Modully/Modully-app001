# Flujo de trabajo — cómo trabajamos Claude y el usuario en Modully

Este documento describe cómo avanzamos. Se irá ampliando con más funciones. La geometría y las reglas de la cocina están en `CONTEXTO_PROYECTO.md`; aquí va el **proceso**.

## 1. Ciclo de cada petición

1. El usuario describe un cambio (a veces con una imagen dibujada encima).
2. Claude lo interpreta y, si hay una duda real que cambia lo que se construye, **pregunta una vez** con opciones cortas. Si la duda es menor, elige un supuesto razonable, lo dice y avanza.
3. Claude implementa, comprueba que compile (`npx tsc --noEmit`) y **lo prueba en la app** (navegador integrado, cocina modulada con "Optimizar modulación").
4. Claude responde con: qué quedó, qué probó, qué **no** probó y los supuestos que tomó.
5. El usuario corrige o pide lo siguiente. Un cambio pequeño de seguimiento no abre un ciclo nuevo.

## 2. Guardar, commitear y subir (siempre se pregunta)

| Frase del usuario | Qué hace Claude |
|---|---|
| "comitea", "commit", "haz el commit" | Hace el commit con un mensaje en español que resume los cambios. |
| "commit y sube", "sí, súbelo" | Commit y push a GitHub (`modullyapp-001/modullly-app`, rama `main`). Después revisa con `git status -sb` que no quede nada sin subir. |
| "guardemos", "guarda" | Si hay cambios sin commitear: commit. Después actualiza la memoria del proyecto y las notas. Si ya estaba todo commiteado, solo actualiza la memoria y lo dice. |
| "sube", "push" | Sube a GitHub lo que ya está commiteado. El repositorio es privado y se sube con la credencial de colaborador ya guardada en el equipo. |

Reglas:
- **Claude no commitea ni sube por su cuenta.** Cuando se acumulan cambios, lo recuerda y **pregunta** si commitear.
- Se commitean solo los archivos del proyecto que cambiaron (no se usa `git add -A` a ciegas) y se revisa `git status` antes.
- Los commits llevan la línea `Co-Authored-By` que indica el sistema.
- Nunca se salta ni se forza nada (hooks, `--force`, `reset --hard`) sin que el usuario lo pida.
- Tras cada commit se informa el hash y que el árbol quedó limpio (o qué quedó fuera y por qué).

## 3. Qué se actualiza al cerrar un cambio

- `CONTEXTO_PROYECTO.md`: la regla nueva o corregida, con la fecha cuando importa. Los temas grandes van en su propio archivo enlazado desde ahí (`COSTEO_Y_COTIZACION.md`, `REGLAS_CLOSET.md`, `REGLAS_MODULOS_FIT.md`).
- Memoria del proyecto (`memory/estado_app_modully_...md` y su índice): resumen corto del estado, el hash del último commit y los pendientes.
- Si el usuario corrige una regla ya escrita, se **reemplaza** la regla anterior (no se deja contradictoria) y se avisa qué cambió.

## 4. Cómo se verifica

- Siempre en la app real: `npm run dev` (puerto 3000, `.claude/launch.json`), ventana del navegador integrado.
- Flujo habitual: abrir la app, "Optimizar modulación" → estrategia, cambiar de vista (Planta, Frontal, Isométrica, 3D) y probar la herramienta.
- El navegador de pruebas **no envía `pointerup`** en los clics: se despacha a mano (`window.dispatchEvent(new PointerEvent('pointerup', {bubbles:true}))`) tras arrastrar o hacer clic en módulos.
- La lógica pura (cálculos, geometría) se prueba aparte con `esbuild` + `node` antes de verla en pantalla.
- Errores de TypeScript que ya existían y se ignoran: `BottomNavItem` (`cloneElement`, `badge`) en `App.tsx` y `cylinderGeometry rotation` en `KitchenViewer3D.tsx`.
- Al terminar de probar se devuelve la ventana al tamaño normal.
- Lo que escribe en la cuenta del usuario (Supabase: proyectos, biblioteca, costos) solo se prueba con su permiso o con lo que él mismo ya hizo; Claude no escribe contraseñas ni claves, el usuario las pega.
- En el panel de la app no funcionan `window.confirm` ni `datalist`, y las ventanas emergentes se bloquean: las confirmaciones, listas y visores van dentro de la página.
- Lo que no se probó **se dice** (por ejemplo: paredes B y C, vista 3D, Fusion).

## 5. Principios del proyecto

- **Una sola fuente de geometría:** `boxes.ts` (`buildBoxes`). La escena, el listado de corte (BOM) y la exportación a Fusion leen de ahí.
- Las medidas que el usuario no sabe de antemano se **preguntan** (zócalo, alto del muro, espesor del mesón, altura del salpicadero…) con el valor sugerido ya puesto; en los formularios nunca se escribe la palabra "sugerido".
- Los precios no se fijan en el código: salen de la tabla "Mis costos" del usuario.
- Las piezas que ocupan espacio (visto, dilatada, cascada) van **dentro de la medida general**: restan al módulo, no se suman al muro.
- Las ediciones manuales no pueden crear choques nuevos entre módulos o electrodomésticos.
- "Optimizar modulación" es código con reglas escritas, no IA. Una regla nueva se escribe en el código y se aplica siempre igual.

## 6. Cómo se comunican las dudas

- Preguntas cortas, con opciones concretas y una recomendación cuando la hay.
- Si el usuario responde con otra idea ("va en el centro… cuando se toque se divide"), manda la respuesta del usuario, no las opciones.
- Las imágenes dibujadas por el usuario se leen como **lo que quiere ver**; Claude confirma lo que entendió si algo de la imagen es ambiguo.
- Las conversaciones son en español.

## 7. Pendientes del proceso (para ir ampliando)

- Probar los scripts de Fusion dentro de Fusion (`importar_cajas_fusion`, `generador_cocina_fusion_FINAL.py`).
- Añadir aquí las funciones nuevas del flujo a medida que las pidamos (por ejemplo: revisiones de código, listas de comprobación antes del commit, versiones numeradas).
