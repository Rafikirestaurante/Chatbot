# Seguridad y privacidad 0.6.1

La identidad se verifica en Firebase y se exige cuenta activa. Los permisos administrativos dependen de custom claims firmados. Las reglas aíslan los datos privados de cada usuario.

Cuando se habilita Gemini, el mensaje, nombre, preferencias, zona horaria, estado conversacional y hasta 50 recordatorios pendientes se procesan en Google. Puede desactivarse en Configuración para utilizar el motor local.

Las variables GEMINI_API_KEY y las credenciales Firebase Admin solo existen en el servidor. No se almacenan en el navegador. Los errores del proveedor y de verificación de sesión no se devuelven literalmente.

Consultar RELEASE_0.6.1.md para cuotas, validaciones, límites y migración. SECURITY_FIX_REPORT.md conserva el informe histórico de la corrección anterior; no sustituye la validación de 0.6.1.
