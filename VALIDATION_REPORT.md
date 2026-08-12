# Informe de validación — Rafiki Recordatorios 0.4.0

Fecha: 6 de agosto de 2026

## Resultado general

**Aprobado como versión de trabajo para prueba local, revisión visual y conexión con Firebase.**

## Validaciones realizadas

### Rafiki Agent Core

- Compilación estricta aislada del núcleo del agente con TypeScript.
- 14 escenarios funcionales ejecutados correctamente:
  - creación para mañana con hora;
  - intervalo relativo ubicado antes del comando;
  - recurrencia semanal;
  - creación conversacional en varios mensajes;
  - aclaración de a. m./p. m.;
  - consulta de pendientes;
  - completar;
  - cancelar mediante pronombre;
  - posponer;
  - reprogramar en un mensaje;
  - reprogramar mediante conversación;
  - rechazo de una hora pasada;
  - conservación de hora local durante cambio DST;
  - límites diarios correctos para America/Bogota.
- Conversión validada para `America/Bogota`.
- Personalidad profesional validada sin emojis.

### TypeScript

- 34 archivos `.ts` y `.tsx` transpilados individualmente.
- 0 errores de sintaxis.
- Frontend verificado mediante TypeScript y declaraciones temporales de dependencias externas.
- Functions verificadas mediante TypeScript y declaraciones temporales de Firebase.

### Configuración

- 9 archivos JSON analizados correctamente.
- Scripts de despliegue separados para Hosting, reglas, funciones administrativas y push.
- Versiones actualizadas a `0.4.0` en aplicación y Functions.

### Privacidad

- El bloque `users/{uid}` no contiene excepción para `platform_admin`.
- El UID autenticado debe coincidir con el propietario.
- La memoria `users/{uid}/agent/session` queda dentro del espacio privado.
- El cliente no puede crear ni activar documentos administrativos.
- No existe función backend para consultar conversaciones de otros usuarios.

### Eliminación de IA externa

- Eliminada la función `interpretReminder`.
- Eliminado `functions/src/gemini.ts`.
- Eliminadas las dependencias `@google/genai` y `zod`.
- No se requiere API key de Gemini, OpenAI u otro modelo.

### Secretos

- 0 claves privadas detectadas.
- 0 API keys reales detectadas.
- 0 JWT detectados.
- No se incluyen cuentas de servicio ni archivos `.env` reales.

## Validación pendiente en un equipo con acceso normal a npm

Este entorno usa un registro npm interno que respondió `404` al solicitar `@types/react`; por eso no fue posible ejecutar la instalación real de dependencias ni el build de Vite.

Antes del despliegue se debe ejecutar:

```bash
npm install
npm test
npm run build

cd functions
npm install
npm run build
```

La comprobación con declaraciones temporales confirma la coherencia interna del código, pero no sustituye la compilación final con las dependencias reales.

## Recomendación de liberación

1. Abrir la versión en modo demostración.
2. Probar el diseño en celular y computador.
3. Ejecutar el build real.
4. Conectar Firebase.
5. Publicar reglas antes de habilitar usuarios.
6. Activar push únicamente después de validar FCM.
