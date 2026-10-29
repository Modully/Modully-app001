# 🚀 GUÍA COMPLETA: Sistema Parametrizado de Cocinas en Fusion 360

## 📋 DOCUMENTO MAESTRO - REGLAS APROBADAS

**Última actualización:** 2026-08-09  
**Línea actual:** Media  
**Color actual:** Ámbar  
**Estado:** ✅ Validado y en producción

---

## 🎯 FLUJO COMPLETO DEL SISTEMA

```
1️⃣ ENTRADA
   Plano/Boceto del cliente → Especificaciones (ancho, módulos, línea)

2️⃣ GENERACIÓN 3D
   Script Python → Fusion 360 → Modelo 3D parametrizado

3️⃣ EXTRACCIÓN DE DATOS
   Script BOM → Lee geometría → Agrupa piezas → Calcula propiedades

4️⃣ SALIDA
   Excel formato CNC → Listo para proveedor de corte
```

---

## 📐 PARÁMETROS GLOBALES (Inamovibles)

| Parámetro | Valor | Descripción |
|---|---|---|
| Espesor Estructura | 1.5 cm | Laterales, bases, techos, amarres |
| Espesor Frentes | 1.8 cm | Puertas batientes, basculantes |
| Espesor Fondo | 0.6 cm | Panel trasero (espaldar) ranurado |
| Holgura Frentes | 0.2 cm | Dilatación perimetral entre puertas |
| **Alto MB** | **80.0 cm** | Altura módulos base (fija) |
| **Fondo MB** | **57.0 cm** | Profundidad módulos base (fija) |
| **Alto MA** | **108.0 cm** | Altura módulos aéreos (fija) |
| **Fondo MA** | **33.0 cm** | Profundidad módulos aéreos (fija) |
| **Desfase Y (MA)** | **24.0 cm** | Alineación a muro trasero |
| Puente Gola | 6.5 cm | Ancho perfil superior |

---

## 🎨 LÍNEAS/GAMAS DE PRODUCTO

### LÍNEA BAJA (Básica)
```
✓ Estructura: Blanco RH
✓ Frentes: 15mm, Color variable, Cantos flexible/rígido
✓ Fondos: 3mm, Blanco
✓ Herrajes: Sin cierre suave
```

### LÍNEA MEDIA (Estándar)
```
✓ Estructura: RH + Color variable
✓ Frentes: 15mm o 18mm, Color variable, CANTOS SIEMPRE RÍGIDO
✓ Fondos: 6mm, Color variable
✓ Herrajes: Cierre suave + corredera oculta (cajones)
✓ ESTA ES LA LÍNEA ACTUAL (Cocina 358.5 cm = Ámbar)
```

### LÍNEA ALTA (Premium)
```
✓ Estructura: 15-18mm RH + Color
✓ Frentes: 18mm SIEMPRE, RH SIEMPRE, CANTOS RÍGIDO
✓ Fondos: 6mm, Color variable
✓ Puertas: Enmarcadas en vidrio templado
✓ Herrajes: Cierre suave + soft-close
```

---

## 🏗️ REGLAS CONSTRUCTIVAS APROBADAS

### Módulos Base (MB)
- ✅ Altura fija: 80 cm
- ✅ Profundidad fija: 57 cm
- ✅ **Gola Superior:** SIEMPRE (horizontal + vertical)
- ✅ **Gola Intermedia:** SOLO en cajoneros, a 33 cm altura
- ✅ Puertas base: 75 cm alto (deja 5 cm de luz arriba)
- ✅ Entrepaño: 40 cm altura (en módulos > 45 cm, excepto cajoneros)
- ✅ Cajonero: 3 cajones + frente cubiertero (accesorio plástico)
- ✅ Condimentero: 18-20 cm mínimo, sin entrepaño

### Módulos Aéreos (MA)
- ✅ Altura fija: 108 cm
- ✅ Profundidad fija: 33 cm
- ✅ **Desfase Y:** 24 cm (alineación a pared trasera)
- ✅ **Espaldar:** Retranqueado 15mm, inserción 5mm en ranura tapa
- ✅ **Amarres (Cuchillas French Cleat):** 2 listones 60mm alto × 15mm espesor
- ✅ **Pestaña Inferior:** 10mm (cuelgan 1cm abajo para agarre)
- ✅ Puertas: Rasantes arriba, pestaña 10mm abajo (EXCEPTO campana)

### Módulo Campana (Excepción)
- ✅ Altura: 108 - 8.5 = **99.5 cm**
- ✅ Se eleva 8.5 cm en Z para alinear techos
- ✅ Puerta Superior: Copia altura exacta de mueble adyacente
- ✅ Puerta Inferior: Absorbe descuento, sin pestaña
- ✅ Luz inferior: 4mm de seguridad (no raspe con electrodoméstico)
- ✅ Abertura: **P2O (Push-to-Open)** obligatorio

### Puertas y Frentes
- ✅ Puertas van **+10mm** respecto a altura módulo (estilo gola)
- ✅ Si lleva manija → puerta al mismo alto que módulo
- ✅ Dobles: Se dividen por la mitad menos holgura central
- ✅ Únicas: Ancho módulo - 0.4 cm

---

## ⚠️ REGLAS CRÍTICAS DE MODULACIÓN

### Restricción 1: Espacio de Trabajo
- ✅ **Mínimo 40 cm** entre estufa y lavaplatos
- ✅ Se valida automáticamente al calcular módulos

### Restricción 2: Módulos Aéreos Funcionales
- ✅ **Aéreos < 40 cm NO se fabrican solos**
- ✅ Deben fusionarse con módulo adyacente
- ✅ Resultado fusionado máximo 90 cm
- ✅ **Excepción:** Si cliente lo pide explícitamente

### Restricción 3: Condimenteros
- ✅ **NO hacer dos condimenteros** por defecto
- ✅ Siempre al lado de estufa
- ✅ Salida de gas en la **MITAD del Condimentero**
- ✅ Mínimo 18 cm, máximo 30 cm
- ✅ **Excepción:** Si cliente lo pide explícitamente

### Restricción 4: Módulos Estándar
- ✅ Medidas cerradas de **5 en 5 cm:** 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90
- ✅ Máximo ancho módulo: **90 cm**
- ✅ Módulo comodín para ajustar ancho total exacto

### Restricción 5: Posicionamiento de Servicios
- ✅ **Salida de gas:** En MITAD del módulo Condimentero
- ✅ **Desagüe:** En MITAD del módulo Lavaplatos
- ✅ Ambos para instalación de válvulas/conexiones

---

## 📊 ESPECIFICACIONES DE COLOR Y CANTO (LÍNEA MEDIA)

### Colores
- ✅ Estructura: RH + Color (Ámbar en cocina actual)
- ✅ Frentes: Color variable (Ámbar en cocina actual)
- ✅ Espaldares: Variable según línea
- ✅ Entrepaños: Color estructura

### Cantos (Tapabordos)
| Componente | Canto |
|---|---|
| Puertas/Frentes | 4LR (4 lados rígido) |
| Entrepaños | 1L (1 lado) |
| Laterales | 1L (1 lado) |
| Espaldares | Vacío (sin canto) |
| Base/Techo | Vacío (sin canto) |
| Amarres | Vacío (sin canto) |

---

## 🚀 SCRIPTS DISPONIBLES

### 1. **Generador 3D** (`cocina_cliente_real_358_5cm_v2_optimizada.py`)
- Genera modelo 3D completo en Fusion 360
- Entrada: Ancho pared, configuración módulos
- Salida: Ensamble jerárquico parametrizado

### 2. **Generador BOM** (`generador_bom_excel.py`)
- Lee modelo 3D
- Extrae todas las piezas con dimensiones
- Agrupa piezas idénticas
- Asigna automáticamente color y canto (reglas Línea Media)
- Salida: Excel formato CNC

---

## 📋 FLUJO DE EJECUCIÓN PASO A PASO

### PASO 1: Crear script en Fusion 360
```
Utilities → Scripts and Add-ons → Create Script
Nombre: cocina_cliente_real_358_5cm_v2_optimizada
Lenguaje: Python
```

### PASO 2: Copiar código generador 3D
- Pega el contenido del script Python
- Click Play ▶

### PASO 3: Verificar modelo 3D
- Ves los 6 módulos base + 5 módulos aéreos
- Estructura jerárquica correcta
- Posiciones alineadas

### PASO 4: Generar BOM
```
Utilities → Scripts and Add-ons → Create Script
Nombre: generador_bom_excel
Lenguaje: Python
```
- Pega el contenido del script BOM
- Click Play ▶

### PASO 5: Obtener Excel
- Se genera automáticamente en Escritorio
- Formato: `Listado_Partes_Cocina_YYYYMMDD_HHMMSS.xlsx`
- Listo para enviar a proveedor CNC

---

## ✅ VALIDACIÓN DE COCINA ACTUAL (358.5 cm, Línea Media, Ámbar)

**Configuración Final Aprobada:**
```
MB 1: Cajonero 65 cm ✅
MB 2: Condimentero 20 cm ✅ (salida gas en mitad: 75 cm)
MB 3: Estufa 85 cm ✅
MB 4: Espacio Trabajo + Lavaplatos = 84.5 cm ✅ (desagüe en mitad: 214.5 cm)
MB 5: 2 Puertas 60 cm ✅
MB 6: Cierre Pared 44 cm ✅
TOTAL: 358.5 cm ✅ EXACTO

MA 1: 2 Puertas Horiz 65 cm ✅
MA 2: Campana 60 cm ✅ (elevada +8.5 cm)
MA 3: Platero 84.5 cm ✅
MA 4: 2 Puertas 60 cm ✅
MA 5: Cierre 44 cm ✅
```

**Sin módulos aéreos pequeños:** ✅  
**Salida gas en mitad Condimentero:** ✅  
**Desagüe en mitad Lavaplatos:** ✅  
**40+ cm espacio trabajo:** ✅ (75 cm entre estufa y lavaplatos)

---

## 📞 PRÓXIMOS PASOS

1. ✅ Ejecutar script generador 3D
2. ✅ Ejecutar script generador BOM
3. ✅ Descargar Excel desde Escritorio
4. ✅ Enviar Excel a proveedor CNC con orden de corte

---

**Sistema validado y en producción 🚀**
