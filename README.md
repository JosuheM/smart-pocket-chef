# Smart Pocket Chef

Buscador de recetas por ingredientes y gestor de compras. Aplicación full-stack:

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Backend (BFF) | Node.js + Express |
| Base de datos | MySQL / MariaDB (XAMPP) |
| APIs externas | TheMealDB, Unsplash, QuickChart (+ MyMemory o DeepL para traducir) |

## Qué hace

- **Busca por ingredientes** (con autocompletado en español) o **por nombre** de platillo, y explora por categoría o con "Sorpréndeme".
- Ordena por cuántos de tus ingredientes usa cada receta; filtra por categoría, "solo con todos mis ingredientes" y "tengo lo básico" (sal, pimienta, agua y aceite no cuentan como faltantes).
- Avisa qué ingredientes no reconoció en vez de devolver una lista vacía.
- Panel de receta: ingredientes separados en "ya los tienes" y "te falta comprar", pasos que se marcan como hechos, video y enlace para compartir.
- **Mi lista de compras:** junta los ingredientes de varias recetas (suma medidas repetidas) y genera un QR con lo pendiente. Compartir por WhatsApp, copiar o descargar el QR.
- Cuentas, favoritas e historial de listas (MySQL).
- Recetas traducidas al español, con la URL compartible (`?i=pollo,ajo`, `?r=52772`).

## Requisitos

- Node.js 18.17 o superior
- MySQL o MariaDB encendido (con XAMPP: iniciar el módulo **MySQL**)
- Access Key de Unsplash (opcional): https://unsplash.com/developers

## Puesta en marcha

```bash
# 1. Backend
cd server
npm install
cp .env.example .env        # en Windows: copy .env.example .env
# edita .env: JWT_SECRET, UNSPLASH_ACCESS_KEY, MYMEMORY_EMAIL y, si hace falta, DB_PASSWORD
npm run dev                 # http://localhost:5000

# 2. Frontend (otra terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

La **primera vez**, el servidor descarga el catálogo de TheMealDB (unas 36 peticiones, 10-20 segundos) y lo guarda en `server/data/catalog.json`; después arranca al instante y lo refresca cada 7 días. Mientras tanto, las búsquedas esperan a que termine.

Al arrancar también crea la base `smart_pocket_chef` y sus tablas. Si prefieres hacerlo a mano, importa `database/schema.sql` desde phpMyAdmin. Si MySQL no está disponible, el buscador sigue funcionando; solo se desactivan cuentas, favoritos e historial.

## Las 3 APIs (y por qué se usan así)

| API | Dónde se llama | Qué hace |
|---|---|---|
| **TheMealDB** | Backend (`services/themealdb.js`, `services/catalog.js`) | `search.php?f=` sincroniza el catálogo; `lookup.php` trae cada receta; `random.php` para "Sorpréndeme". Clave pública `1`. |
| **Unsplash** | Solo backend (`services/unsplash.js`) | Foto de portada del inicio, foto de la receta cuando TheMealDB no trae (o siempre con `PREFER_UNSPLASH=true`). La Access Key vive en `server/.env`. |
| **QuickChart** | URL armada en el backend (`services/quickchart.js`), imagen cargada en el frontend | Limpia la lista, la convierte en texto y construye `https://quickchart.io/qr?text=...`; el navegador solo la pone en un `<img>`. |

Notas importantes:

- **Comida peruana.** TheMealDB no trae ningún plato del Perú (tampoco de Chile, Colombia o Argentina), y no encontramos una API gratuita con recetas peruanas. Por eso el backend incluye 20 recetas propias en `server/src/data/peru.js`: se suman al catálogo, salen en la búsqueda por ingredientes (`ají amarillo`, `rocoto`…) y tienen su acceso "Comida peruana" en el inicio. Cada plato tiene una foto fija de Unsplash elegida a mano en `server/src/data/peru-photos.js`, con crédito al autor; así no se gasta la cuota de la API al mostrarlos. Algunas son aproximadas (picarones, mazamorra morada y sopa criolla no tienen una foto exacta en Unsplash).

- **Búsqueda con varios ingredientes.** La clave gratuita de TheMealDB solo filtra por *un* ingrediente a la vez (el filtro múltiple es de pago). Por eso el backend guarda el catálogo (~790 recetas) en memoria y hace el cruce de ingredientes localmente (`catalog.js`). `utils/text.js` decide si "chicken" coincide con "Chicken Breast" pero no "milk" con "Coconut Milk".
- **Traducción al español.** TheMealDB solo trae recetas en inglés. Los ingredientes comunes salen de un diccionario propio (`utils/ingredients-es.js`, sin gastar cuota); nombres y pasos se traducen con **MyMemory** (gratis; 5,000 caracteres/día, 50,000 con un correo válido en `MYMEMORY_EMAIL`) o **DeepL** si defines `DEEPL_API_KEY` (plan gratuito de unos 500,000 caracteres al mes, cifra a confirmar en su cuenta, y mejor calidad). Cada traducción se guarda en la tabla `translations` de MySQL, así que se traduce una sola vez aunque reinicies. Si el servicio falla se muestra el texto en inglés. `TRANSLATE=false` la desactiva.
- **Unsplash** exige: usar las URLs que devuelve la API, dar crédito al fotógrafo con enlace y UTM, y avisar a `download_location` al usar la foto. Todo eso está implementado. El modo demo permite 50 peticiones por hora; para publicar la app hay que pedir a Unsplash el modo producción, que sube ese límite si aprueban la app.
- **TheMealDB** pide hacerse *supporter* (pago único) para usar la API en una app pública; la clave `1` es para desarrollo y estudio.
- **QuickChart** en el plan gratuito tiene límite de uso no publicado y sin garantía de disponibilidad. Para un uso serio, hay plan de pago o se puede alojar la propia instancia (Docker).

## Plan B: si no hay internet

Cada servicio externo tiene un respaldo, y el panel **Estado de los servicios y modo sin internet** (al final de la página, o `GET /api/status`) muestra cuál está caído y qué se usa en su lugar.

| Si falla… | Qué pasa |
|---|---|
| **TheMealDB** | La búsqueda, la exploración y el detalle usan la copia local del catálogo (`server/data/catalog.json`, ~800 recetas). Un cortacircuitos evita esperar: responde en milisegundos. |
| **Unsplash** | Las recetas peruanas usan sus fotos fijas; el resto, la foto de TheMealDB o un degradado verde. |
| **QuickChart** | El navegador genera el QR por su cuenta (paquete `qrcode`) y avisa que es local. |
| **Traducción (MyMemory/DeepL)** | Se muestran las traducciones ya guardadas en MySQL; lo demás, en inglés. |
| **MySQL** | Todo funciona menos cuentas, favoritas e historial. La lista de compras vive en el navegador. |
| **Internet y no hay copia del catálogo** | La app arranca con las 20 recetas peruanas, avisa que el catálogo está incompleto y reintenta cada minuto. |
| **Fotos y QR ya vistos** | Un service worker (`client/public/sw.js`) los guarda en el navegador y los muestra sin conexión. |

**Antes de exponer** (con internet, una sola vez):

1. Enciende MySQL, el backend y el frontend, y abre siempre la misma dirección (por ejemplo `http://localhost:5173`; `127.0.0.1` es otro origen y guarda su propia copia).
2. Al final de la página abre **Estado de los servicios** y pulsa **Guardar recetas para usar sin internet**: guarda las recetas peruanas, sus fotos y las de la búsqueda que tengas en pantalla.
3. En `server/`, ejecuta `npm run warmup`: traduce los nombres de las ~790 recetas y los guarda en MySQL.
4. Haz las búsquedas que vas a mostrar y abre esas recetas una vez, para que queden guardadas.
5. Prueba apagando el wifi y recargando la página.

Para llevar el proyecto a otra computadora sin internet, copia también la carpeta `server/data/` (no se sube a GitHub).

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/recipes/search?ingredients=pollo,ajo&mode=all&sort=missing&category=Chicken&pantry=1&limit=12&offset=0` | público | Recetas que coinciden, con paginación y categorías |
| GET | `/api/recipes/explore?q=lasaña&category=Pasta` | público | Por nombre y/o categoría |
| GET | `/api/recipes/peru` · `/explore?area=Peruvian` | público | Platos de la cocina peruana (20 recetas propias, `server/src/data/peru.js`) |
| GET | `/api/recipes/ingredients?q=tom` | público | Autocompletado de ingredientes |
| GET | `/api/recipes/meta` · `/random` · `/hero` | público | Categorías, receta al azar, foto de portada |
| GET | `/api/recipes/:id?have=pollo,ajo&pantry=1` | público | Receta completa con cada ingrediente marcado como `have` |
| POST | `/api/shopping/qr` | público (guarda historial si hay sesión) | Limpia la lista y devuelve `{ text, qrUrl, omitted }` |
| POST | `/api/auth/register` · `/api/auth/login` | público | Cuenta y sesión (JWT, 7 días) |
| GET | `/api/auth/me` | sesión | Usuario actual |
| GET · POST · DELETE | `/api/favorites` | sesión | Recetas favoritas |
| GET · DELETE | `/api/shopping/history` | sesión | Historial de listas de compras |
| GET | `/api/health` | público | Estado del servidor, la base, la traducción y el catálogo |
| GET | `/api/status` | público | Comprueba cada servicio externo y qué respaldo se usa (se guarda 60 s) |

## Estructura

```
smart-pocket-chef/
├── database/schema.sql
├── server/
│   ├── .env.example
│   ├── data/               catálogo local de TheMealDB (se crea solo, fuera de git)
│   └── src/
│       ├── index.js        servidor Express
│       ├── config.js, db.js
│       ├── middleware/     auth, rateLimit
│       ├── routes/         auth, recipes, favorites, shopping
│       ├── services/       themealdb, catalog, mealdb, unsplash, quickchart, translate
│       └── utils/          text, ingredients-es, spanish, http
└── client/
    ├── index.html, vite.config.js
    └── src/
        ├── App.jsx, api.js, hooks.js, styles.css
        └── components/     SearchBar, ResultsToolbar, RecipeGrid, RecipeDrawer, QRModule,
                            ShoppingList, History, AuthDialog, Header, Toasts, Footer, EmptyState
```

## Seguridad

- `.env` está en `.gitignore`: las claves nunca se suben a GitHub ni llegan al navegador.
- Las contraseñas se guardan con bcrypt; las consultas SQL son parametrizadas.
- `helmet`, CORS limitado a `CLIENT_ORIGIN` y límite de peticiones por IP (más estricto en `/api/auth`).
- En producción (`NODE_ENV=production`) el servidor no arranca sin `JWT_SECRET`.

## Despliegue (resumen)

Guía completa para Hostinger con dominio temporal: [DESPLIEGUE.md](DESPLIEGUE.md). Resumen:

- Backend (`server`): `npm start`, con `NODE_ENV=production`, `TRUST_PROXY=true`, `JWT_SECRET`, `CLIENT_ORIGIN` (URL del frontend) y los datos `DB_*` de la base MySQL del hosting. Las tablas se crean solas; `database/schema_hostinger.sql` es el respaldo para phpMyAdmin.
- Frontend (`client`): define `VITE_API_URL` con la URL pública del backend terminada en `/api` y ejecuta `npm run build`.
