# Módulo de Gestión de No Conformidades

## 1. Objetivo

Incorporar al software existente un módulo que permita a la empresa registrar, dar seguimiento y cerrar No Conformidades (NC), acelerando el proceso actual (hoy manual, tipo planilla). El módulo se apoya en la base de datos ya configurada en Supabase, y requiere la creación de un bucket de Storage para adjuntos.

## 2. Alcance

- Listado general de No Conformidades.
- Ficha de detalle por No Conformidad (creación, seguimiento, cierre).
- Catálogos parametrizables de **Sector/Tipo** y **Cargos** (responsables).
- Sin roles de usuario diferenciados, **excepto** que solo un Administrador puede reabrir un caso cerrado.
- Sin notificaciones/alertas ni estado "Vencida" en esta primera versión.

---

## 3. Páginas

### 3.1 Página 1 — Listado de No Conformidades

Tabla con las siguientes columnas:

| Columna | Descripción |
|---|---|
| Nro | Identificador autoincremental, secuencial, simple (1, 2, 3...) |
| Fecha Apertura | Fecha de creación del registro (automática, no editable) |
| Sector/Tipo | Valor tomado del catálogo de Sector/Tipo |
| Plazo de Cierre | Fecha límite para ejecutar la Acción Correctiva |
| Estado | `Abierta` / `Cerrada` (calculado, ver regla en 5.2) |
| Acciones | Botón para ver/editar el detalle |

- Botón **"+ Agregar"**: crea un nuevo registro y navega a la Página 2 en modo edición, con Fecha Apertura auto-completada (hoy) y Estado = Abierta.

### 3.2 Página 2 — Detalle de No Conformidad

Estructura de secciones (según imagen de referencia):

**Cabecera**
- Sector/Tipo *(un solo campo, seleccionado del catálogo)*
- Estado *(solo lectura, calculado)*
- Fecha Apertura *(automática, no editable)*
- Fecha Cierre *(solo lectura, se completa al presionar "Cerrar Caso")*

**Identificación de la No Conformidad**
- Descripción *(texto)*
- Evidencia Objetiva *(texto)*
- Archivos *(uno o más adjuntos, opcional, + texto descriptivo asociado)*

**Solución**
- Solución Inmediata *(texto)*
- Análisis Causa Raíz *(texto)*

**Acción Correctiva**
- Responsable(s) *(uno o más, seleccionados del catálogo de Cargos)*
- Plazo *(fecha límite — es el mismo dato que "Plazo de Cierre" del listado)*
- Acción Propuesta *(texto)*

**Seguimiento y Control** *(se completa solo al cerrar el caso)*
- Cumplimiento de la acción propuesta: `SI` / `NO`
- Cumplimiento de la acción propuesta en el plazo: `SI` / `NO`

- Botón **"Cerrar Caso"**: solo queda habilitado cuando la totalidad de los campos del detalle están completos (ver regla 5.4). Al confirmar:
  - Setea `fecha_cierre = hoy`
  - Estado pasa a `Cerrada`

### 3.3 Página 3 — Catálogos (Administración)

Dos catálogos independientes (sin relación jerárquica entre ellos):

- **Sector/Tipo**: alta, edición, baja (baja lógica) de valores. Ej: Ventas, Producción, Calidad, etc.
- **Cargos**: alta, edición, baja (baja lógica) de puestos/cargos, usados como "Responsable" en la Acción Correctiva. No están vinculados a personas físicas, solo al nombre del cargo.

---

## 4. Modelo de datos (propuesto)

### `sectores_tipo`
| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| nombre | text | único |
| activo | boolean | default true (baja lógica) |

### `cargos`
| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| nombre | text | único |
| activo | boolean | default true (baja lógica) |

### `no_conformidades`
| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | Nro autoincremental |
| sector_tipo_id | FK → sectores_tipo | |
| fecha_apertura | timestamp | automática, no editable |
| fecha_cierre | timestamp \| null | null = Abierta |
| descripcion | text | |
| evidencia_objetiva | text | |
| archivo_url | text \| null | path en bucket de Supabase Storage |
| solucion_inmediata | text | |
| analisis_causa_raiz | text | |
| accion_propuesta | text | |
| plazo | date | plazo de cierre / plazo de la acción correctiva |
| cumplimiento_accion | boolean \| null | se completa al cerrar |
| cumplimiento_en_plazo | boolean \| null | se completa al cerrar |

> `estado` **no** se guarda como columna: se calcula siempre como `Abierta` si `fecha_cierre IS NULL`, `Cerrada` en caso contrario.

### `nc_responsables` (relación N a N)
| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| no_conformidad_id | FK → no_conformidades | |
| cargo_id | FK → cargos | |

### `nc_archivos` (relación 1 a N)
| Campo | Tipo | Notas |
|---|---|---|
| id | serial PK | |
| no_conformidad_id | FK → no_conformidades | |
| archivo_url | text | path en bucket de Supabase Storage |
| descripcion | text \| null | texto opcional asociado al archivo |
| fecha_subida | timestamp | automática |

---

## 5. Reglas de negocio

### 5.1 Numeración
El campo Nro es autoincremental y secuencial (sin reinicio anual, sin prefijos).

### 5.2 Estado
- `Estado = Abierta` mientras `fecha_cierre` sea `null`.
- `Estado = Cerrada` cuando `fecha_cierre` tiene valor.
- El único modo de setear `fecha_cierre` es a través del botón "Cerrar Caso".
- No existe estado "Vencida" ni intermedio en esta versión.

### 5.3 Responsables
- Una No Conformidad puede tener **uno o más** responsables (cargos).
- El campo Responsable no referencia personas, solo cargos del catálogo.

### 5.4 Cierre de caso
El botón "Cerrar Caso" solo se habilita cuando **todos** los campos del detalle están completos:
- Sector/Tipo
- Descripción
- Evidencia Objetiva
- Solución Inmediata
- Análisis Causa Raíz
- Responsable(s) (al menos uno)
- Plazo
- Acción Propuesta

Al presionar "Cerrar Caso":
1. Se solicitan obligatoriamente los dos campos de Seguimiento y Control:
   - Cumplimiento de la acción propuesta (SI/NO)
   - Cumplimiento de la acción propuesta en el plazo (SI/NO)
2. Se setea `fecha_cierre = fecha actual`.
3. El Estado cambia automáticamente a `Cerrada`.
4. **Reapertura**: solo un usuario con rol Administrador puede reabrir un caso cerrado (limpiar `fecha_cierre` y los dos campos de cumplimiento). Esto implica que, aunque el módulo no tiene roles diferenciados en general, se necesita como mínimo un flag/rol de Administrador para esta acción puntual.

> Los archivos adjuntos (sección 5.5) son **opcionales** y no bloquean el cierre del caso.

### 5.5 Archivos
- Se permiten adjuntar **uno o más archivos** por No Conformidad, en la sección "Evidencia Objetiva".
- El campo Evidencia Objetiva admite texto libre además de los archivos (no son excluyentes).
- Cada archivo puede llevar una breve descripción propia (ver tabla `nc_archivos`).
- Los archivos se almacenan en un bucket de Supabase Storage (a crear).

---

## 6. Infraestructura / Supabase

- Base de datos: ya configurada. Se deben crear las tablas descritas en la sección 4.
- **Storage**: falta crear el **bucket** para adjuntos de Evidencia Objetiva.
  - Definir política de acceso (público vs. firmado/privado).
  - Definir tipos de archivo permitidos y tamaño máximo (a confirmar).

---

## 7. Fuera de alcance (por ahora)

- Estado "Vencida" o cálculo automático de vencimiento.
- Notificaciones/alertas de plazos próximos a vencer.
- Roles de usuario diferenciados (más allá del permiso de reapertura por Administrador).
- Relación jerárquica entre Sector/Tipo y Cargos.

---

## 8. Pendientes a definir

- Tipos/tamaño máximo permitido para el archivo adjunto.
- Cómo se determina/gestiona el rol "Administrador" (¿tabla de usuarios existente, flag simple, etc.?).
- Valores iniciales a cargar en los catálogos de Sector/Tipo y Cargos.
