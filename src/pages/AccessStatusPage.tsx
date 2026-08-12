import { Clock3, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function AccessStatusPage() {
  const { profile, signOut } = useAuth();
  const suspended = profile?.status === "suspended";

  return (
    <div className="center-screen status-screen">
      <div className={`status-icon ${suspended ? "danger" : ""}`}>
        {suspended ? <ShieldAlert size={38} /> : <Clock3 size={38} />}
      </div>
      <h1>{suspended ? "Acceso suspendido" : "Cuenta pendiente de aprobación"}</h1>
      <p>
        {suspended
          ? "El administrador suspendió temporalmente el acceso a esta cuenta."
          : "Tu cuenta fue creada correctamente. Un administrador debe activarla antes de que puedas usar Rafiki."}
      </p>
      <strong>{profile?.email}</strong>
      <button className="secondary-button" onClick={() => void signOut()}>
        <LogOut size={17} /> Cerrar sesión
      </button>
    </div>
  );
}
