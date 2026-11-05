# Preparación de publicación 0.6.1

No se ha desplegado esta versión. Sigue la sección «Configuración pendiente para publicar» de RELEASE_0.6.1.md.

No publicar solo el frontend: las reglas, el índice de recordatorios, los permisos administrativos y el endpoint deben actualizarse de forma coordinada. Mantener el acceso restringido durante esa actualización.

El ZIP no contiene secretos ni dependencias instaladas. Copia .env.example a un archivo privado únicamente si necesitas configuración local. Las variables de Firebase Admin y Gemini nunca llevan prefijo VITE_.

Auditar cuentas previamente activadas y roles antes de habilitar el acceso. Una regla corregida no revoca los accesos concedidos anteriormente.
