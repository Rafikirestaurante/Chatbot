import { Database, FileKey, Rocket } from "lucide-react";

export function SetupPage() {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <Rocket size={38} />
        <h1>Configura Firebase para producción</h1>
        <p>
          La aplicación está ejecutándose en modo demostración. Puedes probar el chat
          y los recordatorios sin conexión ni costos.
        </p>
        <div className="setup-steps">
          <div><FileKey size={21} /><span>Copia <code>.env.example</code> como <code>.env.local</code>.</span></div>
          <div><Database size={21} /><span>Agrega las credenciales públicas de tu Web App Firebase.</span></div>
          <div><Rocket size={21} /><span>Cambia <code>VITE_DEMO_MODE=false</code> y despliega.</span></div>
        </div>
      </div>
    </div>
  );
}
