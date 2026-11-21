# Mis cuentas

App sencilla para apuntar ingresos y gastos por secciones y ver cada mes cuánto entra, cuánto se gasta y cuánto queda.

- Funciona en el móvil (se instala como una app) y en el ordenador.
- Cada persona entra con su cuenta de Google y solo ve sus propios datos.
- No necesita compilar nada: es HTML, CSS y JavaScript.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `styles.css` | La página y su aspecto |
| `app.js` | Las pantallas: resumen del mes, secciones, apuntes, opciones |
| `store.js` | Dónde se guardan los datos (modo prueba o Firebase) |
| `firebase-config.js` | Los datos de tu proyecto de Firebase (vacío = modo prueba) |
| `manifest.json`, `sw.js`, `icons/` | Para que se pueda instalar en el móvil y abra sin internet |
| `firestore.rules`, `firebase.json` | Reglas de seguridad y publicación en Firebase |

## Probarla en el ordenador (modo prueba)

Desde esta carpeta:

```powershell
python -m http.server 8080
```

y abre http://localhost:8080. Mientras `firebase-config.js` tenga `null`, los datos se guardan solo en ese navegador.

> No vale abrir `index.html` con doble clic: los módulos de JavaScript necesitan un servidor.

## Pasarla a Firebase (para usarla de verdad)

### 1. Crear el proyecto

1. Entra en https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto** (por ejemplo, `mis-cuentas`). Puedes desactivar Google Analytics.
2. Menú **Compilación → Authentication → Comenzar**, pestaña **Método de inicio de sesión**, activa **Google** y guarda.
3. Menú **Compilación → Firestore Database → Crear base de datos**. Ubicación: `europe-west` (o la que te ofrezca en Europa). Empieza en **modo de producción**.
4. En Firestore, pestaña **Reglas**: borra lo que haya, pega el contenido de `firestore.rules` y pulsa **Publicar**.

### 2. Conectar la app

1. En la ruedecita ⚙️ → **Configuración del proyecto** → apartado **Tus apps**, pulsa el icono **</>** (Web). Ponle un nombre y **no** marques Firebase Hosting todavía.
2. Copia el objeto `firebaseConfig` que aparece y pégalo en `firebase-config.js`, en lugar de `null`.

### Publicar cambios (ya configurado)

La app está publicada en **https://miscuentas-6ba18.web.app** (proyecto `miscuentas-6ba18`).
Para subir una versión nueva:

1. En esta carpeta, ejecuta `& '..\herramientas-firebase\firebase-tools-win.exe'`.
2. Se abre su propia consola (símbolo `>`). Ahí escribe `firebase deploy`.

Ojo: la herramienta ignora las órdenes que se le pasan directamente; hay que escribirlas en su consola `>`.

### 3. Publicarla en internet (primera vez)

Con la herramienta de Firebase (no hace falta instalar Node):

1. Descarga `firebase-tools-win.exe` desde https://firebase.tools/bin/win/instant/latest y ponlo en esta carpeta.
2. En esta carpeta, ejecuta:

```powershell
.\firebase-tools-win.exe login
```

```powershell
.\firebase-tools-win.exe use --add
```

(elige tu proyecto)

```powershell
.\firebase-tools-win.exe deploy
```

3. Te dará una dirección del tipo `https://mis-cuentas-xxxx.web.app`. Esa es la app.

### 4. Instalarla en el móvil de tu madre (Android)

1. Abre la dirección en **Chrome** en su móvil y pulsa **Entrar con mi cuenta de Google**.
2. Menú ⋮ de Chrome → **Añadir a pantalla de inicio** → **Instalar**. También se puede desde **⚙️ Opciones → Poner la app en la pantalla de inicio**.
3. Ya tiene el icono de la moneda en su pantalla.

En el ordenador: abre la misma dirección y entra con la misma cuenta. Verá los mismos datos.

Para otras personas (pareja, tú…): misma dirección, cada uno entra con su Gmail y tiene sus propias cuentas por separado.

## Gratis

El plan gratuito de Firebase (Spark) sobra para este uso: miles de apuntes al día y varias personas sin coste. No hace falta poner tarjeta.
