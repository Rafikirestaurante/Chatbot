# Corrección de acceso para 0.6.1

Se comprobó en modo de solo lectura la página https://chatbot-mauve-eta-47.vercel.app/login y la configuración pública de Firebase: el dominio publicado figura como autorizado. No se inició sesión con cuentas reales ni se modificó Firebase o Vercel.

Se corrigieron estos fallos locales:

- El botón de Google captura y muestra errores; bloquea intentos simultáneos y borra el aviso del intento anterior.
- Los fallos al cargar el perfil después de autenticar ya no se silencian: se muestra un mensaje que distingue permisos de Firestore y errores de las funciones.
- Un perfil existente se carga antes de intentar Cloud Functions. Un fallo interno/de disponibilidad de Functions permite crear solamente un perfil normal pendiente mediante las reglas de Firestore; un rechazo explícito de permisos no usa esa alternativa.
- Los errores de correo/contraseña se explican por separado; no se pide la contraseña de Gmail para entrar con Google. No se devuelven mensajes privados del proveedor.

Verificación: compilación frontend aprobada y 76 pruebas de aplicación/servidor aprobadas, incluidas 6 pruebas nuevas de mensajes y registro. Las reglas no cambiaron; sus 8 pruebas en emulador habían pasado en esta misma entrega.

La causa exacta del intento del usuario no se confirmó, porque no se accedió a su sesión. La captura muestra auth/invalid-credential, pero el código anterior no mostraba los errores del botón de Google; por tanto, ese aviso puede corresponder a correo y contraseña.

El sitio publicado sigue sin cambios. Para usar la corrección hace falta actualizar el despliegue con estas fuentes; después, cualquier fallo restante se podrá distinguir por el mensaje de pantalla.
