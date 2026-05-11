# Plan de Ejecución — Sistema de Gestión de Certificados de Calidad

## Resumen del Proyecto

Aplicación web para mapear certificados de calidad (PDF) a productos industriales. Dos roles: **Administrador** (carga y mapeo) y **Consultor** (búsqueda y descarga). ~2500 productos, con relación muchos-a-uno entre productos y certificados.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Backend | Python + FastAPI |
| Base de datos | Supabase (PostgreSQL) |
| Almacenamiento de archivos | Supabase Storage |
| Autenticación | Supabase Auth (tabla de usuarios propia) |
| Deploy sugerido | Vercel (frontend) + Railway o Render (backend) |

---

## Estructura de Carpetas del Proyecto

```
project-root/
├── frontend/                  # React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ConsultorPage.tsx   # Vista pública de búsqueda
│   │   │   └── AdminPage.tsx       # Vista de administración
│   │   ├── services/              # Llamadas a la API
│   │   ├── hooks/
│   │   └── App.tsx
│   ├── .env
│   └── package.json
│
├── backend/                   # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── productos.py
│   │   │   └── certificados.py
│   │   ├── models/
│   │   ├── schemas/
│   │   └── core/
│   │       ├── config.py          # Variables de entorno
│   │       └── supabase_client.py
│   ├── .env
│   └── requirements.txt
│
├── scripts/
│   └── seed/
│       ├── seed.py                # Script de migración inicial
│       ├── productos.csv          # CSV original del cliente
│       └── certificados/          # Carpeta con todos los PDFs
│
└── PLAN_EJECUCION.md
```

---

## Modelo de Datos (Supabase / PostgreSQL)

### Tabla: `certificados`
```sql
CREATE TABLE certificados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL,           -- Nombre descriptivo del certificado
    colada      TEXT,                    -- Número de colada/lote
    archivo_url TEXT NOT NULL,           -- URL pública del PDF en Supabase Storage
    storage_path TEXT NOT NULL,          -- Path interno en el bucket
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `productos`
```sql
CREATE TABLE productos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    partida_lote    TEXT,
    observaciones   TEXT,
    certificado_id  UUID REFERENCES certificados(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `usuarios`
```sql
-- Usa Supabase Auth internamente. Esta tabla extiende el perfil.
CREATE TABLE perfiles (
    id      UUID PRIMARY KEY REFERENCES auth.users(id),
    rol     TEXT NOT NULL CHECK (rol IN ('admin', 'consultor')),
    nombre  TEXT
);
```

### Relación clave
- Un **certificado** puede estar asociado a **muchos productos**.
- Un **producto** tiene como máximo un **certificado**.
- Relación: `productos.certificado_id → certificados.id`

---

## Supabase Storage

- Crear un bucket llamado `certificados`.
- Política: lectura pública (los usuarios consultores no necesitan login para ver PDFs).
- Subida solo permitida desde el backend autenticado como admin.

---

## Script de Migración Inicial (`scripts/seed/seed.py`)

Este script hace la carga masiva inicial de datos. Ejecutar **una sola vez** antes de lanzar la app.

### Lógica del script:

1. **Leer el CSV** (`productos.csv`) con las columnas: `Producto`, `Descripción`, `Partida/Lote`, `Certificado`, `Observaciones`.
2. **Para cada PDF** en la carpeta `certificados/`:
   - Subir el archivo al bucket de Supabase Storage.
   - Insertar un registro en la tabla `certificados` con el nombre del archivo y la URL generada.
3. **Para cada fila del CSV**:
   - Insertar el producto en la tabla `productos`.
   - La columna `Certificado` del CSV es un nombre/código de referencia — **el admin deberá hacer el mapeo manual desde el frontend** ya que no hay relación directa entre ese valor y el nombre del PDF.
   - El campo `certificado_id` se deja en `NULL` en la carga inicial.
4. Loguear cuántos productos y certificados fueron insertados, y los errores si los hay.

### Variables de entorno necesarias para el script:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # Clave de servicio, NO la anon key
SUPABASE_BUCKET=certificados
CSV_PATH=./productos.csv
PDF_FOLDER=./certificados/
```

### Dependencias del script:
```
supabase-py
python-dotenv
pandas
```

---

## Backend — FastAPI

### Endpoints requeridos

#### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Login con email y password |
| POST | `/auth/logout` | Cerrar sesión |
| GET | `/auth/me` | Devuelve usuario y rol actual |

#### Productos
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/productos` | Público | Lista todos los productos. Soporta `?search=nombre` para filtrar |
| GET | `/productos/{id}` | Público | Detalle de un producto |
| PUT | `/productos/{id}/certificado` | Admin | Asigna o cambia el certificado de un producto |
| POST | `/productos` | Admin | Crea un nuevo producto manualmente |
| DELETE | `/productos/{id}` | Admin | Elimina un producto |

#### Certificados
| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| GET | `/certificados` | Admin | Lista todos los certificados |
| GET | `/certificados/{id}` | Público | Detalle de un certificado (incluye URL del PDF) |
| POST | `/certificados/upload` | Admin | Sube un nuevo PDF y crea el registro |
| DELETE | `/certificados/{id}` | Admin | Elimina certificado y archivo del storage |

### Middleware y seguridad
- Verificar el JWT de Supabase en cada request protegido.
- Leer el rol del usuario desde la tabla `perfiles` para distinguir admin de consultor.
- CORS configurado para el dominio del frontend.

---

## Frontend — React

### Páginas y componentes

#### `LoginPage`
- Formulario simple de email + password.
- Llama al endpoint `/auth/login`.
- Redirige según rol: admin → `/admin`, consultor → `/`.

#### `ConsultorPage` (ruta `/`)
- **Sin login requerido.**
- Tabla de productos con las columnas: Nombre, Descripción, Partida/Lote, Observaciones, Certificado.
- Barra de búsqueda en tiempo real que filtra por nombre de producto (debounce de 300ms).
- Filtros adicionales opcionales: por partida/lote.
- Cada fila tiene un botón/ícono "Ver certificado" que abre el PDF en una nueva pestaña o lo descarga.
- Si el producto no tiene certificado asignado, el botón aparece deshabilitado con tooltip "Sin certificado asignado".

#### `AdminPage` (ruta `/admin`, requiere rol admin)
- **Panel izquierdo — Productos:**
  - Misma tabla que la vista consultor, pero con columna extra de acción.
  - Acción: dropdown para seleccionar/cambiar el certificado asignado al producto.
  - Indicador visual claro de productos sin certificado asignado.
- **Panel derecho — Certificados:**
  - Lista de certificados existentes.
  - Botón "Subir nuevo certificado": abre modal con input de nombre, colada y upload de PDF.
  - Botón para eliminar un certificado (con confirmación).
- **Flujo de mapeo:**
  1. Admin sube un certificado nuevo (PDF + metadata).
  2. En la tabla de productos, selecciona uno o varios productos y les asigna ese certificado.

### Estado global
- Usar **React Context** o **Zustand** para el estado de sesión/usuario.
- Las llamadas a la API se hacen desde un módulo `services/api.ts` centralizado.

---

## Flujo de Autenticación

```
Usuario accede a /admin
    → Frontend verifica si hay sesión activa (token en memoria/cookie)
    → Si no hay sesión → redirige a /login
    → POST /auth/login con credenciales
    → Backend valida con Supabase Auth
    → Consulta tabla perfiles para obtener rol
    → Devuelve token + rol al frontend
    → Frontend guarda token y redirige según rol
```

---

## Variables de Entorno

### Backend (`.env`)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=certificados
SECRET_KEY=                    # Para firmar tokens internos si se necesita
```

### Frontend (`.env`)
```
VITE_API_BASE_URL=http://localhost:8000
```

---

## Orden de Ejecución para la IA

Ejecutar las siguientes fases **en orden**. No pasar a la siguiente hasta completar la anterior.

### FASE 1 — Setup de Supabase
1. Crear proyecto en Supabase.
2. Ejecutar los scripts SQL del modelo de datos (tablas `certificados`, `productos`, `perfiles`).
3. Crear el bucket `certificados` con política de lectura pública.
4. Crear al menos un usuario admin en Supabase Auth y su perfil en `perfiles` con `rol = 'admin'`.

### FASE 2 — Script de migración
1. Configurar el `.env` del script.
2. Instalar dependencias: `pip install supabase pandas python-dotenv`.
3. Ejecutar `seed.py`.
4. Verificar en Supabase Dashboard que los productos y certificados fueron insertados correctamente.

### FASE 3 — Backend
1. Crear el proyecto FastAPI con la estructura de carpetas definida.
2. Implementar la conexión a Supabase.
3. Implementar los routers en orden: `auth` → `certificados` → `productos`.
4. Probar cada endpoint con curl o Postman antes de avanzar.

### FASE 4 — Frontend
1. Crear el proyecto con `npm create vite@latest frontend -- --template react-ts`.
2. Instalar dependencias: `tailwindcss`, `react-router-dom`, `axios` (o `fetch`).
3. Implementar en orden: `LoginPage` → `ConsultorPage` → `AdminPage`.
4. Conectar con el backend local.

### FASE 5 — Integración y pruebas
1. Probar el flujo completo: login admin → subir certificado → asignar a producto.
2. Probar el flujo consultor: buscar producto → ver/descargar PDF.
3. Verificar que usuarios sin rol admin no puedan acceder a `/admin`.

### FASE 6 — Deploy (opcional, al final)
1. Deploy del backend en Railway o Render.
2. Deploy del frontend en Vercel.
3. Actualizar las variables de entorno con las URLs de producción.

---

## Notas y Decisiones de Diseño

- **PDFs en Supabase Storage** con URL pública: el frontend abre el PDF directamente desde la URL de Supabase, sin pasar por el backend. Esto reduce la carga del servidor.
- **Carga inicial con `certificado_id = NULL`**: el mapeo entre productos y certificados se hace manualmente desde el frontend admin, ya que el CSV no tiene una relación directa con los nombres de los archivos PDF.
- **Búsqueda en el frontend**: para ~2500 productos, se puede cargar toda la tabla en memoria y filtrar localmente. Si en el futuro crece mucho, migrar a búsqueda server-side con el parámetro `?search=`.
- **Sin paginación en la primera versión**: dado el volumen (2500 registros), se puede usar una tabla virtualizada (ej: `@tanstack/react-virtual`) para performance.
