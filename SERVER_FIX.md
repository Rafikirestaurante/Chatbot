# Corrección del arranque del servidor — 0.6.1

Se confirmó en los registros de Vercel el error ERR_MODULE_NOT_FOUND: la función compilada intentaba importar /var/task/server/firebase.ts. La petición no alcanzaba la validación ni Gemini.

La fuente del endpoint está ahora en server/gemini.ts. build:api genera api/gemini.js con esbuild, incorporando los módulos locales; las dependencias npm del servidor permanecen externas para que Vercel las empaquete. No quedan importaciones de archivos TypeScript locales en el artefacto de ejecución. Las pruebas se movieron fuera de api para impedir que Vercel publique rutas de pruebas.

La compilación ejecuta también una prueba de arranque con Node normal, sin cargador TypeScript ni mocks: GET devuelve 405 y POST anónimo devuelve 401. Después se comprobó la compilación del frontend, el tipo del servidor y las 76 pruebas de aplicación/servidor: aprobados. Las reglas no se modificaron.

## Configuración de producción pendiente

La inspección de nombres (sin imprimir valores) del proyecto chatbot confirmó GEMINI_API_KEY y configuración pública VITE_FIREBASE_*, pero no las tres variables privadas Firebase necesarias para el backend:

- FIREBASE_PROJECT_ID: campo project_id de una cuenta de servicio del mismo proyecto Firebase.
- FIREBASE_CLIENT_EMAIL: campo client_email de esa cuenta de servicio.
- FIREBASE_PRIVATE_KEY: campo private_key, conservando saltos de línea o secuencias de escape.

Configurar exclusivamente en Vercel, entorno Production. No añadir prefijo VITE_, no subir el JSON de la cuenta de servicio, no guardar valores en Git y no enviarlos por chat. Las instrucciones de permisos IAM están en RELEASE_0.6.1.md. No crear nuevas cuentas de servicio ni ampliar permisos automáticamente.

Después de configurar las variables y actualizar estas fuentes, publicar un nuevo despliegue para que tome la configuración. Comprobar GET /api/gemini = 405 y POST sin sesión = 401; luego probar un mensaje desde una sesión real activa. Esa última prueba no se realizó durante esta corrección.

Esta entrega no cambió la configuración ni publicó en Vercel/GitHub.
