# Corrección de seguridad — 2026-10-15

## Resultado

Se corrigió una copia del ZIP original; no se modificaron los archivos de referencia. Había credenciales en `.env`, `api/gemini.ts`, `src/agent/geminiFallback.ts` y `src/pages/SettingsPage.tsx`. No se incluyen valores ni fragmentos en este informe.

- Eliminados todos los valores embebidos encontrados y el archivo `.env`.
- Eliminados el acceso directo a Gemini desde el navegador, sus variables VITE y el campo de clave de Configuración.
- El arranque borra la antigua entrada de clave de localStorage sin leerla.
- Gemini se consulta exclusivamente desde `/api/gemini` con `process.env.GEMINI_API_KEY`. La clave viaja en un encabezado del servidor, fuera de la URL. Los errores externos y las excepciones no se devuelven literalmente al cliente.
- `.gitignore` excluye `.env`, `.env.local`, `.env.production`, `.env.*.local` y otros entornos privados, conservando `.env.example` sin secretos.
- El CHANGELOG original de este ZIP no contenía claves; se añadió una nota de corrección sin valores.
- Búsqueda global: sin coincidencias restantes para claves Google, claves privadas, tokens GitHub/Slack/Stripe/AWS y asignaciones comunes de credenciales. También se verificó la ausencia de acceso Gemini desde el frontend. Esto es una revisión por patrones, no una garantía sobre cualquier formato de credencial posible.
- Pruebas del endpoint con respuestas simuladas: aprobadas (variable ausente, método incorrecto, encabezado privado, respuesta correcta y errores sin filtraciones). Ejecutar con Node 24: `node security-regression.test.mjs`. No se usó una clave real ni se hicieron llamadas a Google.
- No hay `.git` en el proyecto ni en el workspace. No es posible determinar qué commits remotos contienen el secreto. No se reescribió historial ni se hizo push, publicación o despliegue.

## Pendientes obligatorios

1. Revocar la clave expuesta en Google Cloud/AI Studio y crear una nueva. No usar excepciones de GitHub para permitir la clave.
2. Configurar la nueva clave exclusivamente en Vercel > Settings > Environment Variables como `GEMINI_API_KEY`. Eliminar antiguas variables Gemini con prefijo VITE. No enviar la clave por chat.
3. Las copias descargadas, el ZIP original y versiones desplegadas anteriormente aún pueden contener la clave anterior. Revocarla es imprescindible. La limpieza del navegador ocurre cuando se ejecute la versión corregida.
4. Revisar y limpiar el historial real antes de volver a subir. Un commit nuevo que borra una clave no la elimina de commits anteriores.
5. La aplicación conserva la autenticación y límites existentes; esta corrección no añade controles de acceso ni límites de consumo al endpoint. Revisarlos antes de una publicación pública.

## Historial Git: instrucciones locales, sin push automático

Trabajar sobre una copia local privada del repositorio real y conservar el original restringido como respaldo. No subir ese respaldo.

Si se comprobó que el secreto aparece únicamente en el último commit: copiar los archivos corregidos a ese checkout, revisar `git status --short` y ejecutar:

```powershell
git rm --cached --ignore-unmatch -- .env .env.local .env.production
git add -- .gitignore .env.example api/gemini.ts src/agent/geminiFallback.ts src/pages/SettingsPage.tsx src/main.tsx CHANGELOG.md SECURITY_FIX_REPORT.md security-regression.test.mjs
git commit --amend --no-edit
```

Si hay varios commits afectados, instalar una versión reciente de git-filter-repo y ejecutar sobre una copia limpia dedicada del repositorio real. Este ejemplo sustituye ambos formatos Google por patrones, sin escribir la clave:

```powershell
@'
regex:AQ\.[A-Za-z0-9_.-]{15,}==>REMOVED_CREDENTIAL
regex:AIza[A-Za-z0-9_-]{15,}==>REMOVED_CREDENTIAL
'@ | Set-Content -Encoding ascii ..\rafiki-secret-patterns.txt
git filter-repo --sensitive-data-removal --replace-text ..\rafiki-secret-patterns.txt --replace-message ..\rafiki-secret-patterns.txt --invert-paths --path .env --path .env.local --path .env.production --path-glob '*.env.*.local' --path-glob '.env.*.local'
```

Si filter-repo rechaza el checkout por no ser una copia reciente, crear una copia limpia dedicada; no añadir `--force` sin evaluar el respaldo. Añadir rutas históricas adicionales si hubo archivos renombrados. Después, aplicar los archivos de esta versión corregida y crear un commit.

Para comprobar los commits sin imprimir valores, usar PowerShell:

```powershell
$pattern = 'AQ\.[A-Za-z0-9_.-]{15,}|AIza[A-Za-z0-9_-]{15,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
git rev-list --all | ForEach-Object { git grep -I -l -E $pattern $_ -- }
```

Solo se imprimen identificadores y rutas. Revisar todas las ramas/tags que se pretendan publicar y cualquier otro formato encontrado por GitHub. No ejecutar force-push sin aprobación explícita. Coordinar con colaboradores y, si ya estuvo publicado, revisar forks, referencias de pull requests y cachés con GitHub.

Referencias: [GitHub: eliminar datos sensibles](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository), [Google: claves Gemini](https://ai.google.dev/gemini-api/docs/api-key).

## Límite de validación
La instalación de dependencias no terminó y se interrumpió. Build y suite original no se pudieron ejecutar: faltan tsc y vitest. Antes de publicar, ejecutar npm install, npm run build y npm test en un entorno con acceso al registro npm. El ZIP excluye node_modules y archivos compilados; no se afirma que la compilación completa haya pasado.
