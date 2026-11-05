export function accessErrorMessage(error: unknown, stage: "signin" | "profile" = "signin"): string {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  if (stage === "profile") {
    if (code === "permission-denied" || code === "firestore/permission-denied") return "Google inició la sesión, pero Rafiki no pudo acceder a tu perfil. Hay que revisar las reglas de Firestore y el estado de tu cuenta. [perfil/permisos]";
    return `La sesión se inició, pero no fue posible cargar tu cuenta de Rafiki. Intenta de nuevo.${code.startsWith("functions/") ? " [perfil/funciones]" : " [perfil/carga]"}`;
  }
  const messages: Record<string, string> = {
    "auth/invalid-credential": "No se pudo validar el acceso con correo y contraseña. Si usas tu cuenta de Google, pulsa «Continuar con Google»; no necesitas escribir la contraseña de Gmail aquí.",
    "auth/invalid-login-credentials": "El correo o la contraseña no son válidos. Si tu cuenta usa Google, pulsa «Continuar con Google».",
    "auth/popup-closed-by-user": "La ventana de Google se cerró antes de completar el acceso. Intenta de nuevo y mantén abierta la ventana.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página e intenta de nuevo.",
    "auth/cancelled-popup-request": "Ya hay una solicitud de acceso abierta. Termina ese acceso e intenta de nuevo.",
    "auth/unauthorized-domain": "Esta dirección web no está autorizada para iniciar sesión en Firebase. Hay que revisar los dominios autorizados.",
    "auth/operation-not-allowed": "Este método de acceso no está habilitado en Firebase. Hay que habilitar el proveedor correspondiente.",
    "auth/account-exists-with-different-credential": "Este correo ya tiene una cuenta con otro método de acceso. Inicia sesión con ese método para conservar tu cuenta.",
    "auth/network-request-failed": "No se pudo conectar con Google o Firebase. Revisa la conexión e intenta de nuevo.",
    "auth/too-many-requests": "Hubo demasiados intentos. Espera unos minutos antes de volver a entrar.",
    "auth/email-already-in-use": "Este correo ya tiene una cuenta. Elige «Ingresar» o utiliza Google.",
    "auth/weak-password": "Elige una contraseña de al menos seis caracteres para tu cuenta de Rafiki."
  };
  return messages[code] || "No fue posible completar el acceso. Intenta de nuevo.";
}
