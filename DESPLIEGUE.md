# Despliegue en Hostinger (dominio temporal)

Son **tres piezas**, igual que en el Planificador de recetas: una base de datos MySQL, la **API** (carpeta `server`) y el **frontend** (carpeta `client`). Cada app tiene su propio dominio temporal de Hostinger (`algo.hostingersite.com`).

```
Navegador ──► Frontend (client)  ──► API (server) ──► MySQL de Hostinger
                                         └──► TheMealDB · Unsplash · QuickChart · MyMemory
```

> Los nombres exactos de los botones de hPanel cambian de vez en cuando. Si algo no se llama igual, busca el equivalente: lo importante son los valores de cada paso.

## 0. Antes de empezar

- El código va a un repositorio de GitHub (los `.env` **no** se suben: están en `.gitignore`).
- Ten a mano la clave de Unsplash y tu correo de MyMemory (están en tu `server/.env`; no los pegues en el chat).
- Genera una firma para las sesiones (copia el resultado, es tu `JWT_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 1. Base de datos

1. hPanel → **Bases de datos → Bases de datos MySQL** → crea una base, un usuario y una contraseña.
2. Anota los tres **con el prefijo completo** que pone Hostinger (por ejemplo `u123456789_chef`). Se usan en el paso 2.
3. No hace falta importar nada: la API crea las tablas sola al arrancar. Si prefieres hacerlo a mano, en **phpMyAdmin** importa `database/schema_hostinger.sql` dentro de esa base (no tiene `CREATE DATABASE`, a propósito).

## 2. La API (carpeta `server`)

1. hPanel → **Sitios web → Agregar sitio → Aplicación Node.js** → conecta tu repositorio de GitHub.
2. Configuración:

| Campo | Valor |
|---|---|
| Directorio raíz | `server` |
| Versión de Node.js | 20 (mínimo 18.17) |
| Comando de compilación | *(déjalo vacío, o `npm install`)* |
| Comando de inicio | `npm start` |
| Archivo de entrada | `src/index.js` |

3. **Variables de entorno** (sin comillas ni espacios; `PORT` lo pone Hostinger):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `true` |
| `JWT_SECRET` | la cadena que generaste arriba |
| `CLIENT_ORIGIN` | la URL del frontend, sin `/` final (la sabrás en el paso 3; por ahora pon una provisional) |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_NAME` | la base, con prefijo |
| `DB_USER` | el usuario, con prefijo |
| `DB_PASSWORD` | la contraseña de ese usuario |
| `UNSPLASH_ACCESS_KEY` | tu Access Key (nunca el Secret Key) |
| `MYMEMORY_EMAIL` | tu correo (sube el límite de traducción de 5,000 a 50,000 caracteres al día) |
| `TRANSLATE` | `true` |
| `PREFER_UNSPLASH` | `false` |

4. Despliega y abre el dominio temporal de la API con `/api/health`, por ejemplo `https://tu-api.hostingersite.com/api/health`. Debe mostrar:

```json
{"ok":true,"db":true,"unsplash":true,"translation":"mymemory","recipes":813}
```

- `db:false` → revisa `DB_*` (el mensaje exacto sale en los **logs** de la app).
- `recipes` debe ser 813 de inmediato: el catálogo viaja dentro del repositorio.

## 3. El frontend (carpeta `client`)

1. **Agregar sitio → Aplicación Node.js (Vite / frontend)** con el mismo repositorio.
2. Configuración:

| Campo | Valor |
|---|---|
| Directorio raíz | `client` |
| Comando de compilación | `npm run build` |
| Directorio de salida | `dist` |

3. Variable de entorno, **antes de compilar** (Vite la incluye en el código al compilar):

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://tu-api.hostingersite.com/api` (la URL de la API **terminada en `/api`**) |

4. Despliega y anota la URL del frontend.

## 4. Conectar los dos (CORS)

Vuelve a la API, cambia `CLIENT_ORIGIN` por la URL **exacta** del frontend (`https://tu-front.hostingersite.com`, sin `/` al final) y **vuelve a desplegar**. Sin esto el navegador bloquea las peticiones y la página se queda sin recetas.

## 5. Comprobaciones

- [ ] El frontend abre y la portada muestra la foto de Unsplash.
- [ ] Buscar `pollo, ajo` devuelve recetas en español.
- [ ] **Comida peruana** muestra los 20 platos con foto.
- [ ] Abrir una receta y **Generar QR** muestra el código.
- [ ] Crear una cuenta y guardar una favorita funciona (así se prueba la base).
- [ ] Al final de la página, **Estado de los servicios** muestra todo en verde.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La página carga pero sin recetas, y en la consola dice CORS | `CLIENT_ORIGIN` no coincide exactamente con la URL del frontend (revisa `https`, el dominio y que no haya `/` final). |
| El frontend llama a `localhost` | Se compiló sin `VITE_API_URL`. Defínela y vuelve a compilar. |
| `db:false` | Datos `DB_*` mal escritos (con prefijo), o la base no existe. Los logs dicen el error. |
| 503 al abrir la API | La app no arrancó: mira los logs. Casi siempre falta `JWT_SECRET` (en producción es obligatorio). |
| Muchas búsquedas fallan con "429" | Es el límite de peticiones por IP; espera un minuto. |
| La portada no tiene foto | Falta `UNSPLASH_ACCESS_KEY`, o se agotó la cuota de 50 por hora (se renueva sola). |
| Nombres de recetas en inglés | La traducción se agotó o no hay `MYMEMORY_EMAIL`. Los nombres ya traducidos quedan guardados en MySQL. |

## Buenas prácticas

- Nunca subas `.env` ni pegues claves en el chat o en capturas. Si una clave se filtra, regenérala (Unsplash) y actualiza la variable en Hostinger.
- Cada cambio que subas a GitHub se vuelve a desplegar; si cambias variables de entorno, vuelve a desplegar.
- Con un dominio propio más adelante, solo cambian `CLIENT_ORIGIN` (en la API) y `VITE_API_URL` (en el frontend).
