Skill: Diseño Parametrizado de Cocinas Modulares para Fusion 360

## 📋 Descripción General

Este skill automatiza el diseño jerárquico y parametrizado de cocinas modulares en Autodesk Fusion 360 basándose en un sistema de reglas constructivas validadas para manufactura de melamina y herrajes. Transforma especificaciones de ancho total de pared y configuración de módulos en modelos 3D completos, listos para extracción de planos y listados de corte CNC.

---

## 🎯 Propósito

Agilizar el proceso de diseño de cocinas integrales desde la especificación del cliente hasta la generación de:
- Modelo 3D parametrizado en Fusion 360
- Planos 2D (vista frontal, secciones, sub-ensambles)
- Listado de partes (BOM) con dimensiones exactas, colores y tipos de canto

---

## 🔧 Cuándo Usar Este Skill

**TRIGGERS** (casos de uso):
- Usuario solicita: "Diseña una cocina de 3585mm con módulos base cajonero 90, estufa 60, condimentero 20, lavaplatos 60 y cierre 68.5"
- Usuario solicita: "Genera el código Python para una cocina integral personalizada en Fusion 360"
- Usuario necesita: "Crear modelo 3D de cocina + planos + listado de partes para cliente"
- Usuario pregunta: "¿Puedo hacer una cocina con estos módulos específicos?" (validar contra reglas)

---

## 📥 INPUTS Esperados

El usuario debe proporcionar:

### 1. **Ancho Total de la Pared** (en cm)
   - Ejemplo: 358.5 cm
   - Rango típico: 200 cm a 500 cm

### 2. **Configuración de Módulos Base (MB)** - De izquierda a derecha
   - Formato: `Tipo_Modulo: Ancho_cm`
   - Ejemplos válidos:
     - `Cajonero: 90`
     - `Estufa: 60`
     - `Condimentero: 20`
     - `Lavaplatos: 60`
     - `2 Puertas: 60`
     - `Cierre Pared: 68.5`

### 3. **Línea/Gama de Producto**
   - Opciones: `Básica`, `Media`, `Alta`
   - Define espesores, colores, cantos y herrajes

### 4. **Color de Fachada** (para líneas media y alta)
   - Ejemplos: Blanco, Ámbar, Gris, Negro, etc.
   - Para línea básica: Preguntar al usuario antes de proceder

### 5. **Opciones de Herrajes y Acabados** (opcional)
   - ¿Lleva manija o P2O (push-to-open)?
   - ¿Incluir campana extractora?
   - ¿Cajones con corredera oculta o visible?

---

## 📤 OUTPUTS Generados

### 1. **Código Python**
   - Script ejecutable en Fusion 360
   - Genera ensamble jerárquico completo con módulos padre e hijos
   - Parámetros globales al inicio para fácil edición

### 2. **Especificación de Parámetros** (a usar en Fusion)
   - Espesor estructura: 1.5 cm
   - Espesor frentes: Varía según línea (15mm o 18mm)
   - Alto MB: 80 cm | Profundidad MB: 57 cm
   - Alto MA: 108 cm | Profundidad MA: 33 cm
   - Desfase Y aéreos: 24 cm (alineación a muro)

### 3. **Estructura de Módulos Generada**
   - Listado de todos los componentes creados
   - Posiciones en X, Y, Z
   - Dimensiones finales de cada pieza

### 4. **Validación de Reglas**
   - Confirmación de que la configuración cumple con:
     - Módulos máximo 90 cm
     - Holguras y espacios correctos
     - Alineación de líneas de apertura en campana

---

## 🔑 PARÁMETROS GLOBALES (Inamovibles)

### Espesores de Materiales
| Componente | Espesor | Notas |
|---|---|---|
| Estructura (laterales, base, techo) | 1.5 cm | Melamina estándar |
| Frentes/Puertas | 1.5 cm (Básica) / 1.8 cm (Media/Alta) | Melamina o MDF |
| Fondo (Espaldar) | 0.6 cm | Panel ranurado |
| Holgura frentes | 0.2 cm | Dilatación perimetral |

### Dimensiones Base
| Componente | Valor | Descripción |
|---|---|---|
| Alto MB | 80.0 cm | Altura módulos base |
| Fondo MB | 57.0 cm | Profundidad módulos base |
| Alto MA | 108.0 cm | Altura módulos aéreos estándar |
| Fondo MA | 33.0 cm | Profundidad módulos aéreos |
| Desfase Y (MA) | 24.0 cm | Alineación a muro trasero |
| Puente L (Gola) | 6.5 cm | Ancho del perfil superior |
| Z Base Aéreos | 147.0 cm | Altura de instalación en Z global |

---

## 📐 REGLAS CONSTRUCTIVAS POR TIPO DE MÓDULO

### Módulo Cajonero (MB)
- Lleva Gola superior + **Gola intermedia a 33 cm**
- 3 cajones con frentes de cajon + cubiertero oculto
- Entrepaño a 40 cm
- Frentes divididos (inferior 36cm, superior 36cm)

### Módulo Estufa (MB)
- Gola superior únicamente (sin Gola intermedia)
- Puertas dobles batientes de 75 cm
- Entrepaño a 40 cm
- Aéreo superior: **Campana extractora** (altura reducida 99.5 cm, elevada +8.5 cm)

### Módulo Condimentero (MB)
- Gola superior únicamente
- Puerta única de 75 cm
- Sin entrepaño
- Aéreo pequeño (20 cm) → **Se fusiona con lavaplatos** formando platero de 80 cm

### Módulo Lavaplatos (MB)
- Gola superior únicamente
- Puertas dobles batientes de 75 cm
- **Entrepaño obligatorio a 40 cm**
- Aéreo: Platero fusionado de 80 cm (sin entrepaños)

### Módulo 2 Puertas / Cierre Pared (MB)
- Gola superior únicamente
- Puertas dobles batientes de 75 cm
- Entrepaño a 40 cm
- Aéreo estándar: 2 puertas horizontales con entrepaños

### Módulo Campana Extractora (MA)
- **Altura reducida: 99.5 cm** (108 - 8.5)
- **Base elevada: +8.5 cm** en Z (para alinear techos)
- **Puerta superior**: Hereda altura exacta de mueble adyacente
- **Puerta inferior**: Absorbe descuento, arranque a +4 mm de base (sin pestaña)
- **Línea de abertura horizontal continua** con mueble contiguo
- Frentes: 2 puertas divididas (no necesariamente iguales)

---

## 🎨 LÍNEAS/GAMAS DE PRODUCTO

### LÍNEA BÁSICA
| Aspecto | Especificación |
|---|---|
| **Estructura MB** | Blanco RH (fijo) |
| **Espesor frentes** | 15 mm |
| **Color frentes** | Variable (preguntar cliente) |
| **Cantos** | Flexible O Rígido (depende cliente) |
| **Herrajes** | Sin cierre suave |
| **Cantos MA lados cortos** | Blanco |
| **Cantos MA lados largos** | Color de fachada |

### LÍNEA MEDIA
| Aspecto | Especificación |
|---|---|
| **Estructura MB** | Color RH (puede ser igual o diferente a fachada) |
| **Espesor frentes** | 15 mm O 18 mm (cliente elige) |
| **Color frentes** | Variable (preguntar cliente) |
| **Cantos** | SIEMPRE Rígido (4LR típicamente) |
| **Herrajes** | Cierre suave + corredera oculta en cajones |
| **Acabado** | Semimates o mates |

### LÍNEA ALTA (Premium)
| Aspecto | Especificación |
|---|---|
| **Estructura MB** | Color RH (mismo que fachada) |
| **Espesor frentes** | 18 mm SIEMPRE |
| **Material frentes** | RH SIEMPRE |
| **Color frentes** | Variable (preguntar cliente) |
| **Cantos** | SIEMPRE Rígido (perimetral) |
| **Herrajes** | Cierre suave + soft-close |
| **Acabado** | Puertas enmarcadas en vidrio templado |
| **Detalles** | Perfil minimalist, sin jaladeras visibles |

---

## 📝 REGLAS DE DISEÑO Y MODULACIÓN

### Puertas y Frentes
- **Puertas MB (Base)**: 75 cm de alto, holgura 0.2 cm perimetral
- **Puertas MA (Aéreos)**: Rasantes arriba, **pestaña de 10 mm abajo** (excepto campana)
- **Puertas dobles**: Divididas por la mitad menos holgura central
- **Puerta única**: Ancho total menos 0.4 cm
- **Campana**: Puerta superior = altura puerta superior del módulo adyacente (continuidad visual)

### Entrepaños y Divisiones Internas
- **Módulos < 45 cm**: Sin entrepaño
- **Módulos 45-75 cm**: 1 entrepaño a 40 cm de altura
- **Módulos > 75 cm**: 2 entrepaños (40 cm y 72 cm de altura)
- **Condimentero**: Sin entrepaño (exception)
- **Platero (MA)**: Sin entrepaño (para escurridor de acero)

### Anclaje y Estructura Aérea
- **Espaldar**: Retranqueado 15 mm, penetra 5 mm en ranura de tapa
- **Amarres (Cuchillas French Cleat)**: 2 listones de 60 mm alto × 15 mm espesor
- **Posición amarres**: Alineados a ras con laterales y techo, en el espacio trasero de 15 mm
- **Desfase Y**: Todos los MA en Y = 24 cm para quedar a plomo contra muro

### Gola (Perfil de Agarre)
- **Gola Superior**: SIEMPRE en todos los MB (horizontal + vertical, puente 6.5 cm)
- **Gola Intermedia**: SOLO en módulo cajonero, a 33 cm de altura
- **Propósito**: Permitir agarre de dedos sin jaladera visible

### Fusión Anti-Ratoneras
- Módulos aéreos < 20 cm NO se fabrican independientes
- Se unifican con módulo contiguo (ej: 20 cm + 60 cm = 80 cm platero único)
- Maximiza almacenamiento y reduce costos de manufactura

### Módulos Estándar
- **Medidas cerradas de 5 en 5 cm**: 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90 cm
- **Módulo comodín**: Para ajustar ancho total exacto de pared
- **Máximo ancho módulo**: 90 cm

### Ajustes por Ubicación en Pared
- **Si toca muro izquierdo**: Restar 2 cm
- **Si toca muro derecho**: Restar 2 cm
- **Entre muros**: Restar 2 cm por cada contacto

---

## 🔄 FLUJO DE TRABAJO

### PASO 1: Recolectar Información del Cliente
```
Ancho total pared: _______ cm
Módulos base (izq a der): _____________
Línea/Gama: □ Básica  □ Media  □ Alta
Color fachada: _____________
Opciones especiales: □ P2O  □ Campana  □ Cajones ocultos
```

### PASO 2: Validar Modulación contra Reglas
- Verificar que cada módulo está en rango válido
- Confirmar que la suma de módulos + holguras = ancho pared
- Sugerir ajustes si es necesario
- Identificar dónde va módulo comodín

### PASO 3: Generar Código Python
- Inyectar parámetros del cliente
- Construir lista de módulos con posiciones X
- Generar funciones de ensamble
- Validar matemática de campana (si aplica)

### PASO 4: Instrucciones de Ejecución
- Copiar código completo
- Pegar en Fusion 360 > Scripts and Add-ons > Create Script
- Ejecutar script
- Modelo 3D se genera automáticamente

### PASO 5: Post-Generación (Fuera del Skill)
- Extraer BOM desde Fusion 360
- Exportar planos 2D
- Generar listado de corte para CNC

---

## ⚠️ Validaciones y Restricciones

### No permitido:
- ❌ Módulos individuales < 15 cm
- ❌ Módulos individuales > 90 cm
- ❌ Cajonero sin Gola intermedia
- ❌ Lavaplatos sin entrepaño
- ❌ Campana sin alineación a muro trasero

### Requerimientos:
- ✅ Todo proyecto necesita al menos 1 módulo base
- ✅ Si hay campana, debe estar centrada con estufa
- ✅ Aéreos siempre en Y = 24 cm
- ✅ Especificar color antes de generar (líneas media/alta)

---

## 📊 Ejemplo de Uso Completo

**INPUT del usuario:**
```
Diseña una cocina integral para pared de 358.5 cm:
- Módulos base: Cajonero 90, Estufa 60, Condimentero 20, Lavaplatos 60, 2 Puertas 60, Cierre 68.5
- Línea: Media
- Color fachada: Ámbar
- Incluir: Campana extractora, P2O en todos
```

**OUTPUT del skill:**
1. Código Python completo y listo para ejecutar
2. Validación: ✅ "Configuración válida. Módulos suman 358.5 cm exactos. Campana alineada con estufa."
3. Estructura generada:
   - MB 1: Cajonero 90 cm (con Gola intermedia)
   - MB 2: Estufa 60 cm (sin Gola intermedia)
   - MB 3: Condimentero 20 cm
   - MB 4: Lavaplatos 60 cm (con entrepaño)
   - MB 5: 2 Puertas 60 cm (con entrepaño)
   - MB 6: Cierre 68.5 cm (con entrepaño)
   - MA 1: 2 Puertas Horiz 90 cm
   - MA 2: Campana 60 cm (altura 99.5 cm, elevada +8.5 cm)
   - MA 3: Platero Fusión 80 cm (sin entrepaños, absorbe espacio de condimentero aéreo)
   - MA 4-5: 2 Puertas Horiz (60 cm cada una)
4. Instrucciones paso a paso para ejecutar en Fusion 360

---

## 🛠️ Herramientas Requeridas

- **Autodesk Fusion 360** (2023 o superior)
- **Python 3.7+** (integrado en Fusion)
- **Acceso a Scripts and Add-ons** en Fusion 360
- **Este Skill + Manual de Reglas** (como referencia)

---

## 📚 Documentación Relacionada

- **Manual de Estructuras y Reglas Paramétricas** (Prompt Maestro)
- **Listado de Reglas Constructivas Completas**
- **Tabla de Líneas/Gamas de Producto**
- **Código Python Base Refactorizado v2.0**

---

## 🎓 Notas de Implementación

Este skill encapsula **11 años de experiencia en carpintería arquitectónica** y **6 meses de iteración técnica en automatización de diseño**. Está optimizado para:
- Velocidad: De especificación a modelo 3D en < 5 minutos
- Precisión: Tolerancias de manufactura CNC respetadas
- Escalabilidad: Válido para proyectos de 2m a 5m de ancho
- Mantenibilidad: Código limpio, parámetros centralizados, sin dependencias externas