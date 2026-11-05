# Rafiki Chatbot 0.6.1

Fecha: 5 de noviembre de 2026. Base: ZIP «0.6.0 Chatbot-main».

## Comportamiento

Gemini interpreta primero todos los mensajes de cuentas activas que lo tengan habilitado. Rafiki valida su respuesta antes de convertirla en una acción. Agent Core se conserva para el modo local, la demostración y fallos temporales del proveedor. La aplicación informa cuando utiliza el respaldo local. Los errores de autenticación, permisos, cuota o respuesta inválida no ejecutan automáticamente una interpretación local.

Las preferencias antiguas `useGeminiFallback: false` conservan la exclusión de Gemini; el interruptor actualizado guarda `useGemini`. No hay claves de IA en el navegador.

## Acceso y privacidad

- El endpoint exige un Firebase ID token y comprueba firma, proyecto, caducidad y revocación mediante Firebase Admin; también exige perfil activo.
- La identidad, zona horaria, preferencias, estado y hasta 50 recordatorios pendientes se obtienen desde documentos del usuario autenticado, nunca de una identidad enviada en el cuerpo.
- Se envían a Google el mensaje, nombre, zona horaria, preferencias, estado pendiente, última referencia y los recordatorios seleccionados. La interfaz informa de este procesamiento.
- Cuota persistente en transacciones Firestore: 10 solicitudes por minuto y 200 por día UTC por usuario, compartida entre instancias. Las solicitudes que llegan a consultar al proveedor consumen cuota aunque el proveedor falle. No constituye un presupuesto monetario global.
- El rol administrativo requiere el custom claim firmado `platform_admin`, además de perfil activo. Un campo `role` en Firestore no concede privilegios.
- El registro directo solo crea usuarios normales pendientes. Las invitaciones mediante Functions requieren correo verificado. No se infiere autoridad de un correo público del frontend.
- Las reglas mantienen chats y recordatorios privados incluso frente a administradores de la aplicación. El SDK Admin del servidor es una credencial privilegiada: sus permisos de infraestructura deben restringirse y no se comparte con clientes.

## Validación antes de acciones

La respuesta de Gemini se trata como datos no confiables: intenciones y valores enumerados, tipos, confianza, longitud de títulos y respuestas, fechas ISO con zona horaria, calendario válido y fechas futuras. Las posposiciones aceptan enteros de 1 a 525600 minutos. La confianza inferior a 0,78 pide aclaración y no ejecuta acciones.

Los identificadores deben pertenecer a recordatorios pendientes del usuario. La capa de datos vuelve a comprobar la sesión, cuenta activa y existencia/estado del recordatorio; Firestore hace cumplir el aislamiento y las transiciones incluso si el cliente se manipula. Las reglas impiden actualizar una tarea ya completada o cancelada y crear/reprogramar recordatorios en el pasado.

Gemini propone acciones; no tiene acceso directo a las credenciales de Firebase ni escribe en la base de datos. El cliente ejecuta acciones bajo las reglas de seguridad, no bajo los privilegios del SDK Admin. Las respuestas de confirmación de cambios se componen localmente y se guardan después de una escritura exitosa.

## Configuración pendiente para publicar

Esta entrega no despliega servicios ni modifica cuentas existentes.

1. Revisar perfiles existentes: las reglas nuevas no deshacen activaciones indebidas anteriores. Auditar especialmente perfiles administrativos y accesos activos creados antes de 0.6.1.
2. Configurar un administrador legítimo con el script `functions/src/setAdmin.ts` y credenciales privadas en un entorno confiable. El usuario debe iniciar sesión de nuevo para renovar su token. Nunca subir la cuenta de servicio ni usar el antiguo `VITE_ADMIN_EMAIL` como autorización.
3. Configurar solo en el servidor de Vercel `GEMINI_API_KEY`, `GEMINI_MODEL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`, todos del proyecto Firebase correcto. El cliente usa exclusivamente las variables públicas `VITE_FIREBASE_*`. El SDK Admin necesita permisos para verificar sesiones, leer perfiles/contexto y actualizar cuotas; revisar IAM.
4. Publicar las nuevas reglas e índices de Firestore junto con el backend y frontend. Hay un índice de colección nuevo para `status + nextTriggerAt`. Esperar a que el índice esté listo.
5. Si se usa Cloud Functions, publicar también las funciones administrativas actualizadas. No se activó el envío push programado.
6. Usar Vercel para servir `/api/gemini`; `vite dev`, `vite preview` y Firebase Hosting estático por sí solos no ejecutan ese endpoint. `vercel dev` requiere configurar las variables privadas localmente, fuera del control de versiones.
7. Comprobar el modelo configurado, la cuota y la facturación en el proveedor. No se garantiza coste cero. Revocar cualquier clave que se haya expuesto antes.

## Verificación reproducible

Requisitos: Node 22 o 24; Java 21 o superior para el emulador de Firestore.

```text
npm ci
npm run build
npm run typecheck:server
npm test
npm run test:rules
npm --prefix functions ci
npm --prefix functions run build
```

Las pruebas del proveedor usan respuestas simuladas y credenciales ficticias. Las pruebas de reglas usan un proyecto demo y el emulador; no deben conectarse a datos reales. La comprobación de configuración real y notificaciones en un despliegue corresponde al paso previo a publicación.

Referencias: [verificación de sesiones Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions), [pruebas de reglas con emulador](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [salidas estructuradas Gemini](https://ai.google.dev/gemini-api/docs/structured-output).

## Dependencias

Se actualizó Vitest a 5.1 y se fijaron versiones corregidas de gRPC y RE2JS mediante overrides compatibles con Firebase 12. Los cambios requieren Node 22.12 o superior (rama 22) o Node 24. El entorno de Cloud Functions permanece en Node 22. La instalación auditada dejó 26 avisos: 3 bajos y 23 moderados; ninguno alto ni crítico. Persisten avisos de dependencias transitivas y de versiones mayores de Firebase Admin/React Router; no se aplicaron migraciones mayores automáticas. Estos avisos deben revisarse antes de producción y no se afirma que el árbol completo esté libre de vulnerabilidades.
