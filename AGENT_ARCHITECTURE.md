# Arquitectura 0.6.1

Mensaje → endpoint /api/gemini → sesión Firebase verificada + perfil activo → cuota transaccional → contexto propio desde Firestore → Gemini → validación estructural y semántica → decisión → comprobación de sesión/recordatorio → escritura bajo reglas Firestore.

Gemini interpreta primero. Agent Core solo actúa si el usuario elige modo local, en demostración o ante indisponibilidad del proveedor. Los errores de permisos, cuota y decisiones inválidas detienen la acción.

Las claves del proveedor y de Firebase Admin permanecen en el servidor. Un rol guardado en el perfil no concede autoridad: la administración exige un custom claim firmado.

La cuota se guarda en geminiUsage/{uid}, inaccesible desde clientes. Los administradores de la aplicación no pueden leer contenidos privados de otras cuentas.

Los detalles, limitaciones y pasos de migración están en RELEASE_0.6.1.md.
