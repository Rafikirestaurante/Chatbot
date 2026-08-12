import { Bell, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const {
    profile,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (profile) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible completar el acceso."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><Bell size={32} /></div>
        <h1>Rafiki Recordatorios</h1>
        <p>Tu asistente privado para no olvidar lo importante.</p>

        <button
          className="google-button"
          onClick={() => void signInWithGoogle()}
          disabled={busy}
        >
          <span>G</span>
          Continuar con Google
        </button>

        <div className="auth-divider"><span>o</span></div>

        <form onSubmit={submit}>
          <label>
            Correo electrónico
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </label>
          <label>
            Contraseña
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </label>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-button" disabled={busy}>
            {busy
              ? "Procesando…"
              : mode === "login"
                ? "Ingresar"
                : "Crear cuenta"}
          </button>
        </form>

        <button
          className="text-button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "¿No tienes cuenta? Regístrate"
            : "Ya tengo una cuenta"}
        </button>

        <small>
          Las cuentas nuevas pueden requerir autorización del administrador.
        </small>
      </section>
    </div>
  );
}
