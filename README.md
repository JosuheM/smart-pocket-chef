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
- Cuentas (correo o **Google**), favoritas e historial de listas (MySQL).
- Recetas traducidas al español, con la URL compartible (`?i=pollo,ajo`, `?r=52772`).

**Funciones de la segunda versión**

- **Mi despensa** (cuenta): guarda lo que tienes en casa en MySQL (`user_pantry`) y muestra "Hoy puedes cocinar X recetas con lo que tienes" (recetas sin ningún ingrediente faltante; sal, pimienta, agua y aceite no cuentan), más cuántas te faltan por 1 o 2 ingredientes.
- **Calificación y "ya la cociné"** en cada receta (`recipe_notes`): de 1 a 5 estrellas y la marca de cocinada. (La tabla y la API conservan el campo `note` por compatibilidad, pero la pantalla ya no ofrece escribir notas.)
- **Plan semanal:** de 3 a 7 recetas, cada una para 2, 4 o 6 personas. Se junta todo en una sola lista (las medidas iguales se suman: `200 g + 300 g = 500 g`) y se pide **un solo QR** a QuickChart.
- **Porciones:** selector de 2, 4 o 6 personas en la receta; las cantidades se multiplican al instante en el navegador (`client/src/utils/measures.js`). Las recetas base son para 2 personas.
- **Unidades métricas:** las libras y onzas pasan a gramos/kilos/mililitros y los °F a °C, tanto en los ingredientes como en los pasos (`server/src/utils/units.js`). Si el valor métrico ya viene al lado (`175g/6oz`, `200°C (400°F)`), solo se quita la parte inglesa.
- **Filtro por país** (cocina de origen) y **filtros de dieta y alergias** (sin gluten, sin lácteos, sin frutos secos). La dieta revisa los ingredientes de cada receta con listas de palabras (`server/src/utils/diet.js`: harina, pan, leche, queso, maní…) y no depende de las categorías de TheMealDB. Es una ayuda orientativa; cada receta muestra "Contiene: …".
- **Modo cocina:** pantalla completa (Fullscreen API) y pantalla siempre encendida (Wake Lock API), un paso a la vez con letra grande, temporizadores detectados en el texto ("20 minutos", "1 a 2 horas", "media hora") y lectura en voz alta con `speechSynthesis`, sin servicios de pago.
- **Compartir receta:** enlace exacto de la app, QR de QuickChart (con respaldo local), WhatsApp, Telegram, Facebook, correo y el menú del celular.
- **App instalable (PWA):** `client/public/manifest.json`, iconos y service worker; funciona sin internet con lo que ya viste.
- **25 platos peruanos en MySQL** (`custom_recipes`), mezclados con TheMealDB sin que la pantalla note la diferencia.
- **Mis recetas:** cada persona crea sus propios platos (hasta 50), que **solo ella ve**. Salen en sus búsquedas (por ingredientes y por nombre), en su despensa y en su plan semanal, y se pueden marcar como favoritas, calificar y cocinar con el modo cocina. No llevan foto.
- **Recuperar cuenta:** "¿Olvidaste tu contraseña?" manda por correo un enlace de un solo uso que vence en 1 hora. Ver [Recuperar contraseña](#recuperar-contraseña-por-correo).
- **Panel de administración** (`/admin`, solo administradores): estadísticas, lista de usuarios con búsqueda, cambio de rol y eliminación de cuentas con confirmación, y **gestión de las recetas peruanas** (agregar, corregir y borrar platos). Ver [Panel de administración](#panel-de-administración).

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

- **Comida peruana.** TheMealDB no trae ningún plato del Perú (tampoco de Chile, Colombia o Argentina), y no encontramos una API gratuita con recetas peruanas. Por eso hay 25 recetas propias. La fuente es `server/src/data/peru.js`; al arrancar con MySQL, si la tabla `custom_recipes` está vacía el servidor las **siembra** ahí (con la tabla llena no vuelve a sembrar: lo que el administrador agregue, corrija o borre desde el panel se queda así; `npm run seed` agrega las que falten del archivo y `npm run seed -- --force` las actualiza desde él) y el catálogo las lee de ahí. Se suman a las de TheMealDB, salen en la búsqueda por ingredientes (`ají amarillo`, `rocoto`…) y tienen su acceso "Comida peruana" en el inicio. Si MySQL no responde, el catálogo usa el mismo archivo como copia de seguridad. Los 20 primeros platos tienen una foto fija de Unsplash elegida a mano en `server/src/data/peru-photos.js`, con crédito al autor; los 5 nuevos buscan su foto en Unsplash por nombre (y muestran un degradado si no hay cuota). Algunas fotos son aproximadas (picarones, mazamorra morada y sopa criolla no tienen una foto exacta).
- **País y TheMealDB.** El catálogo local ya guarda el país de cada receta (`strArea`), por eso el selector de país filtra al instante y también sin internet. Si el catálogo completo aún no se descargó, el país se consulta directo a TheMealDB con `filter.php?a={país}` (`services/themealdb.js`, `filterByArea`).

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
| **Internet y no hay copia del catálogo** | La app arranca con las 25 recetas peruanas, avisa que el catálogo está incompleto y reintenta cada minuto. |
| **Fotos y QR ya vistos** | Un service worker (`client/public/sw.js`) los guarda en el navegador y los muestra sin conexión. |
| **Google (acceso)** | Si el servidor no tiene `GOOGLE_CLIENT_ID` o el script de Google no carga, el botón no aparece y se puede ingresar con correo. |
| **Voz, pantalla encendida o pantalla completa** | Si el navegador no las trae (por ejemplo, la voz en algunos Firefox), el modo cocina funciona igual y lo avisa. |

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
| GET | `/api/recipes/search?ingredients=pollo,ajo&mode=all&sort=missing&category=Chicken&area=Italian&diet=gluten,dairy&pantry=1&limit=12&offset=0` | público | Recetas que coinciden, con paginación, categorías, país y dieta (`diet` = recetas SIN `gluten`, `dairy`, `nuts`) |
| GET | `/api/recipes/explore?q=lasaña&category=Pasta&area=Italian&diet=nuts` | público | Por nombre, categoría, país y/o dieta |
| GET | `/api/recipes/peru` · `/explore?area=Peruvian` | público | Platos de la cocina peruana (25 recetas propias, tabla `custom_recipes`) |
| GET | `/api/recipes/ingredients?q=tom` | público | Autocompletado de ingredientes |
| GET | `/api/recipes/meta` · `/random` · `/hero` | público | Categorías, países, receta al azar, foto de portada |
| GET | `/api/recipes/:id?have=pollo,ajo&pantry=1` | público | Receta completa con cada ingrediente marcado como `have` y la lista `allergens` |
| POST | `/api/shopping/qr` | público (guarda historial si hay sesión) | Limpia la lista y devuelve `{ text, qrUrl, omitted }` |
| POST | `/api/plan/shopping` `{ meals: [{ id, servings }] }` | público (guarda historial si hay sesión) | Plan semanal (3 a 7 recetas): una sola lista con medidas sumadas y un solo QR |
| GET | `/api/share/qr?url=` | público | QR de QuickChart para un enlace de la propia app (otros sitios se rechazan) |
| POST | `/api/auth/register` · `/api/auth/login` | público | Cuenta y sesión (JWT, 7 días) |
| POST | `/api/auth/google` `{ credential }` | público | Valida el token de Google (`aud` = `GOOGLE_CLIENT_ID`), crea o enlaza la cuenta y devuelve el JWT |
| GET | `/api/auth/config` | público | `{ googleClientId }` para que el frontend dibuje el botón de Google |
| POST | `/api/auth/forgot` `{ email }` | público | Manda el enlace de recuperación (siempre responde igual, exista o no la cuenta; máx. 6 por hora y por IP) |
| POST | `/api/auth/reset` `{ token, password }` | público | Con el enlace del correo pone la contraseña nueva y abre la sesión |
| GET · POST | `/api/my/recipes` | sesión | Mis recetas (lista, hasta 50) / crear una |
| GET · PUT · DELETE | `/api/my/recipes/:id` · GET `/:id/edit` | sesión | Detalle, edición y borrado de una receta mía; las ajenas responden 404 |
| GET | `/api/auth/me` | sesión | Usuario actual |
| GET · PUT | `/api/pantry` | sesión | Despensa (PUT reemplaza la lista completa) |
| GET | `/api/pantry/summary?diet=gluten` | sesión | "Hoy puedes cocinar X recetas": `{ items, total, almost, results }` |
| GET · PUT | `/api/notes/:mealId` · GET `/api/notes` | sesión | Nota, calificación (1-5) y `cooked` de una receta; lista de todas |
| GET | `/api/admin/users?search=&limit=25&offset=0` | **admin** | Usuarios: id, nombre, correo, rol, fecha de registro, si usa Google, despensa y favoritas |
| PUT | `/api/admin/users/:id/role` `{ role: 'admin' \| 'user' }` | **admin** | Cambia el rol (no el propio; siempre debe quedar un administrador) |
| DELETE | `/api/admin/users/:id` | **admin** | Elimina la cuenta y, en cascada, su despensa, notas, favoritas e historial |
| GET | `/api/admin/stats` | **admin** | Totales: usuarios, administradores, despensas, favoritas, notas, listas, recetas propias |
| GET · POST | `/api/admin/recipes` | **admin** | Lista las recetas peruanas / agrega un plato (`name`, `category`, `ingredients: [{ es, measure, name }]`, `steps`) |
| GET · PUT · DELETE | `/api/admin/recipes/:id` | **admin** | Detalle, corrección y borrado de un plato (el borrado también limpia sus favoritas y notas) |
| GET · POST · DELETE | `/api/favorites` | sesión | Recetas favoritas |
| GET · DELETE | `/api/shopping/history` | sesión | Historial de listas de compras |
| GET | `/api/health` | público | Estado del servidor, la base, la traducción y el catálogo |
| GET | `/api/status` | público | Comprueba cada servicio externo y qué respaldo se usa (se guarda 60 s) |

## Estructura

```
smart-pocket-chef/
├── database/               schema.sql (XAMPP) y schema_hostinger.sql
├── server/
│   ├── .env.example
│   ├── data/               catálogo local de TheMealDB (se crea solo)
│   ├── scripts/            warmup.js, seed-peru.js (npm run seed)
│   ├── test/               pruebas con node:test (npm test)
│   └── src/
│       ├── index.js        servidor Express
│       ├── config.js, db.js
│       ├── middleware/     auth, rateLimit
│       ├── routes/         auth, recipes, favorites, shopping, pantry, notes, plan, share, myRecipes, adminRoutes
│       ├── controllers/    adminController, adminRecipesController, myRecipesController
│       ├── services/       themealdb, catalog, mealdb, customRecipes, userRecipes, mailer, unsplash, quickchart, translate
│       ├── data/           peru.js (25 recetas), peru-photos.js
│       └── utils/          text, ingredients-es, spanish, units, measures, diet, http
└── client/
    ├── index.html, vite.config.js
    ├── public/             sw.js, manifest.json, icons/
    └── src/
        ├── App.jsx, api.js, hooks.js, styles.css, utils/measures.js
        └── components/     SearchBar, FiltersBar, ResultsToolbar, RecipeGrid, RecipeDrawer, RecipeNotes,
                            KitchenMode, ShareDialog, PantryView, PlanView, AdminRoute, AdminDashboard, AdminRecipes, RecipeForm, MyRecipes, ResetPassword, ConfirmDialog, QRModule, ShoppingList, History,
                            AuthDialog, GoogleButton, Stars, Header, Toasts, Footer, EmptyState
```

## Panel de administración

**Primer administrador.** Nadie es administrador al inicio (la columna `users.role` se crea sola, con `'user'` para todos). La persona debe registrarse primero; después, una de dos:

```sql
-- phpMyAdmin (en Hostinger: hPanel > Bases de datos > phpMyAdmin > pestaña SQL)
UPDATE users SET role = 'admin' WHERE email = 'correo@ejemplo.com';
```

```bash
# o con el servidor, en tu computadora: cd server
npm run make-admin -- correo@ejemplo.com            # volver a usuario normal: agrega --remove
```

Al volver a ingresar, aparece la pestaña **Admin** y se puede abrir `/admin`.

**Cómo está protegido**

- `verifyAdmin` (`server/src/middleware/auth.js`) va después de `requireAuth` y consulta el rol **en MySQL en cada petición**, no en el token: si alguien deja de ser administrador o se borra su cuenta, pierde el acceso al instante. Sin sesión responde 401; con sesión de usuario normal, 403.
- Las rutas están en `routes/adminRoutes.js` y la lógica en `controllers/adminController.js`. Los accesos se registran en la consola del servidor (`[admin] usuario 3: cambió el rol de …`).
- Un administrador no puede cambiar su propio rol ni eliminar su propia cuenta, y nunca puede quedar el sistema sin administradores. La lista nunca devuelve contraseñas.
- La ruta `/admin` del frontend (`react-router-dom`, `AdminRoute.jsx`) redirige al inicio a quien no sea administrador. Eso solo oculta la pantalla: la seguridad real es la del servidor.
- `client/public/.htaccess` hace que Hostinger abra la aplicación al entrar directo a `/admin` o recargar esa página.
- Eliminar una cuenta es definitivo (no hay suspensión): se borran en cascada su despensa, notas, favoritas e historial.

**Recetas peruanas desde el panel.** La pestaña "Recetas peruanas" lista los platos de la tabla `custom_recipes` y permite agregar, corregir (nombre, categoría, ingredientes con su medida, pasos en el orden que quieras) y borrar. Cada cambio se refleja al instante en el buscador, en "Comida peruana" y en las estadísticas, sin reiniciar nada. Cada ingrediente lleva una **clave en inglés** (`chicken` para pollo): es la palabra con la que el buscador lo cruza con lo que escribe la gente; si la dejas vacía se completa sola con el diccionario. La foto de un plato nuevo se busca en Unsplash por su nombre (o por el texto que escribas); las de los 20 primeros son fijas y no se tocan. Las recetas de TheMealDB no se pueden editar.

## Recuperar contraseña por correo

**Cómo funciona.** `POST /api/auth/forgot` genera un token aleatorio de 32 bytes, guarda solo su hash SHA-256 en `password_resets` (con vencimiento de 1 hora) y envía por correo el enlace `…/restablecer?token=…`. `POST /api/auth/reset` valida el token, cambia la contraseña y lo gasta (un enlace nuevo anula los anteriores; dos usos a la vez no pasan). La respuesta de "olvidé mi contraseña" es siempre la misma, exista o no el correo, para que nadie pueda averiguar quién tiene cuenta. Quien entra con Google también puede usarlo para ponerse una contraseña.

**Activarlo.** Hace falta una cuenta de correo que envíe los mensajes (los dominios temporales de Hostinger no tienen buzón). Lo más simple es **Gmail**:

1. En tu cuenta de Google activa la **verificación en dos pasos** y crea una **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones). Es una clave de 16 letras, distinta de la de tu cuenta.
2. En el backend define estas variables (en Hostinger: la app de la API → variables de entorno), y reinicia o redespliega:

   | Variable | Valor |
   |---|---|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | tu correo de Gmail |
   | `SMTP_PASS` | la contraseña de aplicación (nunca la de tu cuenta ni la pegues en un chat) |
   | `MAIL_FROM` | opcional: la dirección que aparece como remitente (por defecto, `SMTP_USER`) |
   | `APP_URL` | opcional: URL del frontend para el enlace (por defecto, `CLIENT_ORIGIN`) |

Sin `SMTP_HOST`: **en desarrollo** el correo se imprime en la consola del servidor (así se prueba sin configurar nada) y **en producción** "¿Olvidaste tu contraseña?" responde que la función todavía no está activa. Otros proveedores SMTP (Brevo, Outlook…) sirven igual con sus datos.

## Mis recetas (privadas)

Cada receta propia se guarda en `user_recipes` ligada a la cuenta. Todas las consultas filtran por el usuario de la sesión, así que pedir, editar o borrar la receta de otra persona responde 404, y la ruta pública `/api/recipes/:id` nunca las sirve. Su id público es `10.000.000 + id de la fila` (los de TheMealDB llegan a ~53.000 y los peruanos empiezan en 900.001), para que favoritas, notas, plan y `?r=` sigan funcionando con ids numéricos. Se suman a las búsquedas, la despensa y el plan **solo de su dueña o dueño** (el catálogo compartido no las incluye), no se comparten por enlace ni QR, y se borran con la cuenta. Al cerrar sesión se vacía la copia de búsquedas guardada para uso sin internet.

## Acceso con Google (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto, configura la pantalla de consentimiento (tipo Externo) y ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
2. En **Orígenes de JavaScript autorizados** agrega la URL del frontend (`http://localhost:5173` y la de producción). No hace falta URI de redirección.
3. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`; no es secreto) y ponlo en `GOOGLE_CLIENT_ID` del backend. No uses el "secreto de cliente": esta app no lo necesita.
4. Reinicia el backend. El botón "Continuar con Google" aparece solo; el frontend lee el ID desde `/api/auth/config`, así que no hay que recompilarlo.

El servidor valida el token con Google (`oauth2.googleapis.com/tokeninfo`), exige que `aud` sea su propio ID de cliente, que el correo esté verificado y que no haya vencido; luego crea o enlaza la cuenta en `users` y entrega su propio JWT.

## Seguridad

- `.env` está en `.gitignore`: las claves nunca se suben a GitHub ni llegan al navegador.
- Las contraseñas se guardan con bcrypt; las consultas SQL son parametrizadas.
- `helmet`, CORS limitado a `CLIENT_ORIGIN` y límite de peticiones por IP (más estricto en `/api/auth`).
- En producción (`NODE_ENV=production`) el servidor no arranca sin `JWT_SECRET`.

## Despliegue (resumen)

Guía completa para Hostinger con dominio temporal: [DESPLIEGUE.md](DESPLIEGUE.md). Resumen:

- Backend (`server`): `npm start`, con `NODE_ENV=production`, `TRUST_PROXY=true`, `JWT_SECRET`, `CLIENT_ORIGIN` (URL del frontend) y los datos `DB_*` de la base MySQL del hosting. Las tablas se crean solas; `database/schema_hostinger.sql` es el respaldo para phpMyAdmin.
- Frontend (`client`): define `VITE_API_URL` con la URL pública del backend terminada en `/api` y ejecuta `npm run build`.
