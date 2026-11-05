# Validación de Rafiki Chatbot 0.6.1

Fecha: 5 de noviembre de 2026. Entorno de pruebas: Windows, Node 24.18.0, Java 25 (solo emulador).

## Resultado

- Compilación frontend/PWA: aprobada. Vite informa un aviso de tamaño de paquete; no impide compilar.
- Comprobación TypeScript del backend: aprobada.
- Compilación de Firebase Functions: aprobada. El despliegue de Functions sigue configurado para Node 22; no se desplegó.
- Pruebas de aplicación, datos, endpoint, autorización, cuota y validación: 70 aprobadas en 7 archivos con Vitest 5.1.
- Pruebas reales de reglas en el emulador de Firestore: 8 aprobadas. Se usó exclusivamente el proyecto demo-rafiki-061. El emulador se apagó al terminar.
- Total: 78 pruebas aprobadas.

## Casos cubiertos

Gemini antes de Core, exclusión voluntaria actual y heredada, respaldo ante error del proveedor, bloqueo ante errores 401/403/429/422, aclaraciones, cancelación del diálogo, fechas pasadas/imposibles/sin zona, tipos incorrectos, títulos vacíos, posposiciones inválidas, referencias ajenas, sesiones revocadas, cuentas pendientes/suspendidas, credenciales de servidor ausentes, cuotas por minuto/día y reinicio de día UTC.

Las pruebas de reglas comprueban registro pendiente, bloqueo de autoactivación y autoasignación de administrador, rechazo de perfiles administrativos falsificados, administración mediante custom claim, privacidad incluso frente al administrador, escrituras ajenas, datos inválidos, manipulación de cuotas y transiciones sobre recordatorios ya cerrados.

## Credenciales y dependencias

La búsqueda por patrones en fuentes no identificó credenciales reales. La inspección del paquete JavaScript generado no encontró identificadores de credenciales privadas del servidor ni firebase-admin. Es una comprobación por patrones, no una garantía universal.

La instalación final informó 26 avisos de dependencias (3 bajos, 23 moderados, ninguno alto ni crítico). Functions informó 8 moderados en su árbol separado. Se corrigieron los avisos altos/críticos de Vitest/Tinypool, gRPC y RE2JS; las actualizaciones se comprobaron de nuevo con compilación y pruebas. Los detalles y límites se documentan en RELEASE_0.6.1.md.

## Límites

No se utilizaron claves reales ni llamadas de generación a Gemini. No se conectó a Firestore/Auth de producción, no se modificaron usuarios existentes y no se probó un despliegue real. La sesión real de un usuario y la disponibilidad del modelo se deben comprobar después de configurar los secretos del servidor y antes de publicar. No se probaron nuevas garantías de notificaciones con la aplicación cerrada; ese flujo no fue objeto de esta versión.

El ZIP final excluye node_modules, archivos compilados, logs, configuración privada y directorios internos. Incluye las fuentes, reglas, índices, pruebas, ejemplos de entorno vacíos y los dos archivos de bloqueo de dependencias.
