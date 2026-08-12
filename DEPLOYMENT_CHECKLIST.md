# Lista de despliegue — Rafiki Recordatorios 0.4.0

## Prueba local

- [ ] Copiar `.env.example` como `.env.local`.
- [ ] Mantener `VITE_DEMO_MODE=true`.
- [ ] Ejecutar `npm install`, `npm test` y `npm run build`.
- [ ] Probar creación con hoy, mañana y fechas explícitas.
- [ ] Probar “en 20 minutos” y “en media hora”.
- [ ] Probar recurrencias diarias, semanales y días hábiles.
- [ ] Probar conversaciones con fecha u hora faltante.
- [ ] Probar ambigüedad a. m./p. m.
- [ ] Probar listar, completar, cancelar, posponer y reprogramar.
- [ ] Probar las cuatro personalidades.

## Firebase

- [ ] Seleccionar el proyecto correcto.
- [ ] Habilitar Google Auth y Email/Password.
- [ ] Crear Firestore en producción.
- [ ] Completar `.env.local`.
- [ ] Publicar reglas e índices.
- [ ] Compilar Functions.
- [ ] Crear la primera cuenta.
- [ ] Asignar `platform_admin`.
- [ ] Probar usuario pendiente, activo y suspendido.

## Privacidad

- [ ] Confirmar que `/admin` no incluye enlaces a mensajes.
- [ ] Confirmar que un administrador no puede leer `users/{otroUid}` desde el cliente.
- [ ] Verificar que `users/{uid}/agent/session` solo sea visible para su propietario.
- [ ] Confirmar ausencia de Gemini, OpenAI y otras APIs de IA.
- [ ] Confirmar que logs no contienen mensajes.
- [ ] No subir cuentas de servicio ni archivos `.env`.

## Push

- [ ] Crear clave VAPID.
- [ ] Probar token en Chrome o Edge.
- [ ] Probar PWA instalada en Android.
- [ ] Activar `ENABLE_SCHEDULED_PUSH=true` solo al final.
- [ ] Desplegar `dispatchDueReminders`.
- [ ] Configurar alertas de presupuesto.
