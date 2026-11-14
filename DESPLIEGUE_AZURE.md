# Despliegue en Azure (gratis)

Smart Pocket Chef se publica en **una sola Web App de Azure** que sirve la API (Express) y el frontend (React ya compilado). No hay segundo dominio ni CORS.

```
Navegador ──► Web App (Node 20, plan Gratis F1) ──► MySQL Flexible Server
                 ├─ /api/*  → Express            └──► TheMealDB · Unsplash · QuickChart · MyMemory
                 └─ /*      → React (client/dist copiado a server/public)
```

El despliegue lo hace GitHub Actions (`.github/workflows/azure-deploy.yml`): compila el frontend, instala las dependencias de la API y publica la carpeta `server`.

## Qué se reutiliza

Si ya hiciste el despliegue de otro proyecto en la misma suscripción de Azure for Students, no hace falta crear nada de esto otra vez:

| Recurso | Cómo se usa aquí |
|---|---|
| Grupo de recursos (`rg-reportaje`) | Se crea la nueva Web App dentro. |
| Servidor MySQL (`ddp-mysql-josuhe`) | Se agrega una base nueva, `smart_pocket_chef`, con su propio usuario. Sin costo extra. |
| Plan de App Service Gratis F1 | La nueva Web App usa el mismo plan. |

Región: una de las permitidas por Azure for Students (West US 2, North Central US, UK West, Canada Central, Chile Central). Usa la misma del servidor MySQL.

## 1. Base de datos y usuario propio

La API crea sola las tablas al arrancar, pero conviene darle un usuario que solo vea su base (no el administrador). Desde el Símbolo del sistema (te pide la contraseña del administrador; la de `spcuser` ponla solo con letras y números):

```
C:\xampp\mysql\bin\mysql.exe -h <servidor>.mysql.database.azure.com -u <admin> -p --ssl -e "CREATE DATABASE IF NOT EXISTS smart_pocket_chef CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'spcuser'@'%' IDENTIFIED BY '<CLAVE_NUEVA>'; GRANT ALL PRIVILEGES ON smart_pocket_chef.* TO 'spcuser'@'%'; FLUSH PRIVILEGES;"
```

Comprobación (debe listar `smart_pocket_chef`):

```
C:\xampp\mysql\bin\mysql.exe -h <servidor>.mysql.database.azure.com -u spcuser -p --ssl -e "SHOW DATABASES;"
```

Tu IP debe estar permitida en el firewall del servidor (Redes → Agregar dirección IP del cliente actual).

## 2. Crear la Web App

Portal → App Services → **Crear → Aplicación web**:

| Campo | Valor |
|---|---|
| Grupo de recursos | el mismo del servidor MySQL |
| Nombre | único, por ejemplo `smart-pocket-chef-josuhe` |
| Publicar | Código |
| Pila del entorno | **Node 20 LTS** |
| Sistema operativo | Linux |
| Región | la misma del servidor MySQL |
| Plan de Linux | el plan Gratis F1 que ya existe (no crear otro) |

En Base de datos no marques nada; en Supervisión deja Application Insights en **No** y Defender sin marcar. Crea la app y anota su URL (`https://<nombre>-<aleatorio>.<region>-01.azurewebsites.net`).

## 3. Configuración general

Web App → Configuración → **Configuración general**: activa **Credenciales de publicación de autenticación básica de SCM** y de **FTP** → Aplicar. Deja el comando de inicio vacío (usa `npm start`).

## 4. Variables de entorno

Web App → Configuración → **Variables de entorno → Edición avanzada**, pega esto y reemplaza los textos en mayúsculas entre comillas. Las claves se escriben solo en el portal, nunca en el chat ni en el repositorio:

```json
[
  {"name": "NODE_ENV", "value": "production", "slotSetting": false},
  {"name": "TRUST_PROXY", "value": "true", "slotSetting": false},
  {"name": "SCM_DO_BUILD_DURING_DEPLOYMENT", "value": "false", "slotSetting": false},
  {"name": "JWT_SECRET", "value": "CADENA_LARGA_ALEATORIA", "slotSetting": false},
  {"name": "CLIENT_ORIGIN", "value": "URL_DE_LA_WEB_APP_SIN_BARRA_FINAL", "slotSetting": false},
  {"name": "APP_URL", "value": "URL_DE_LA_WEB_APP_SIN_BARRA_FINAL", "slotSetting": false},
  {"name": "DB_HOST", "value": "SERVIDOR.mysql.database.azure.com", "slotSetting": false},
  {"name": "DB_PORT", "value": "3306", "slotSetting": false},
  {"name": "DB_NAME", "value": "smart_pocket_chef", "slotSetting": false},
  {"name": "DB_USER", "value": "spcuser", "slotSetting": false},
  {"name": "DB_PASSWORD", "value": "CLAVE_DE_SPCUSER", "slotSetting": false},
  {"name": "DB_SSL", "value": "true", "slotSetting": false},
  {"name": "UNSPLASH_ACCESS_KEY", "value": "TU_ACCESS_KEY", "slotSetting": false},
  {"name": "MYMEMORY_EMAIL", "value": "TU_CORREO", "slotSetting": false},
  {"name": "TRANSLATE", "value": "true", "slotSetting": false},
  {"name": "PREFER_UNSPLASH", "value": "false", "slotSetting": false}
]
```

`JWT_SECRET` se genera con (copia el resultado):

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Pulsa **Aceptar → Aplicar**. **Después de tocar cualquier otra pantalla del portal, vuelve aquí y comprueba que las variables sigan en la lista** (una vez se borraron al guardar "Registros de App Service").

## 5. GitHub

1. Web App → Introducción → **Obtener perfil de publicación** (se descarga un `.PublishSettings`).
2. En el repositorio, Settings → Secrets and variables → Actions:
   - Secret `AZURE_WEBAPP_PUBLISH_PROFILE`: el contenido completo del archivo (ábrelo con el Bloc de notas).
   - Variable `AZURE_WEBAPP_NAME`: el nombre de la Web App.
3. Borra el `.PublishSettings` de Descargas.
4. `git push origin main`. En la pestaña Actions aparece "Desplegar Smart Pocket Chef en Azure App Service" (3 a 5 minutos).

## 6. Comprobar

- `https://<url>/api/health` debe mostrar `{"ok":true,"db":true,"unsplash":true,...,"recipes":813}` (la primera vez tras un rato de inactividad tarda uno o dos minutos).
- La portada abre con la foto y la búsqueda `pollo, ajo` devuelve recetas.
- **Comida peruana** muestra los platos.
- Crear una cuenta, guardar una favorita y generar el QR funcionan (prueba la base).
- La ruta `https://<url>/admin` abre (React la resuelve) y pide ingresar.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `db:false` en `/api/health` | `DB_*` mal escritos, `DB_SSL` no es `true`, o la IP/servicios de Azure no están permitidos en el firewall. Mira Supervisión → Secuencia de registro. |
| 503 / "Application Error" al abrir | Falta `JWT_SECRET` (con `NODE_ENV=production` es obligatorio) o las variables desaparecieron. |
| Página en blanco o sin recetas | El flujo no copió el frontend (mira que Actions terminó en verde). |
| Falla el flujo en "Deploy" | El secret o la variable de GitHub no existen o están mal escritos. |
| Cuentas responden 503 | La API no alcanzó la base: revisa `DB_*`. |
| Muchas búsquedas fallan con 429 | Límite de peticiones por IP; espera un minuto. |

## Limitaciones del plan gratuito

- Gratis F1: 60 minutos de CPU al día. La app se duerme tras unos 20 minutos sin visitas; la primera visita después tarda.
- Si se agota la cuota del día, la web queda detenida hasta el día siguiente.
- La base de MySQL sí consume crédito (unos 15 a 19 USD al mes). Al terminar el curso, borra el grupo de recursos.
