# Corrección de consulta y diagnóstico — 0.6.1

La función publicada arranca y devuelve 405 para GET y 401 para POST anónimo. Los nombres de las tres variables privadas Firebase ya existen en Production; no se imprimieron ni comprobaron sus valores. Las solicitudes autenticadas registradas devolvieron 500 sin detalle porque el manejador ocultaba la causa.

La consulta de índices mediante Firebase CLI confirmó que el proyecto no tiene índices compuestos. La consulta anterior combinaba status con ordenación por nextTriggerAt, lo que requiere un índice compuesto. La nueva consulta obtiene hasta 50 pendientes usando solamente el filtro por status y no necesita ese índice adicional. No se afirma haber confirmado que este sea el único fallo: una petición autenticada real es necesaria para verificar el flujo completo.

Se añadieron mensajes controlados para credenciales mal formadas, permisos de la cuenta de servicio e índices ausentes. Los registros solo incluyen etapa y código de una lista permitida, nunca mensajes originales, tokens, claves ni datos privados.

Verificación: 79 pruebas de aplicación y servidor aprobadas, comprobación TypeScript aprobada, arranque del artefacto compilado aprobado y compilación de la PWA aprobada. Las reglas no cambiaron. No se desplegó ni se modificaron variables o índices de producción.
