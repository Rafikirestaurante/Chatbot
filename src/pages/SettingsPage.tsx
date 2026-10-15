import {
  Bell,
  BellOff,
  CheckCircle2,
  MessageCircleMore,
  RotateCcw,
  Save,
  Smartphone
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { DEFAULT_AGENT_PREFERENCES } from "../agent/defaults";
import { app, demoMode } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { resetDemoData } from "../services/demoStore";
import { saveDeviceToken, updatePlatformUser } from "../services/data";
import { requestNotifications } from "../services/notifications";
import type { AgentPreferences } from "../types";

const TONE_OPTIONS: Array<{ value: AgentPreferences["tone"]; label: string; example: string }> = [
  { value: "warm", label: "Cercano", example: "Listo 😊 Mañana te aviso." },
  { value: "professional", label: "Profesional", example: "El recordatorio quedó programado." },
  { value: "direct", label: "Directo", example: "Programado: mañana, 8:00 a. m." },
  { value: "motivating", label: "Motivador", example: "¡Hecho! Te ayudo a mantenerlo al día." }
];

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const initialPreferences = useMemo(
    () => ({ ...DEFAULT_AGENT_PREFERENCES, ...(profile?.agentPreferences || {}) }),
    [profile?.agentPreferences]
  );
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [timezone, setTimezone] = useState(profile?.timezone || "America/Bogota");
  const [agentPreferences, setAgentPreferences] = useState<AgentPreferences>(initialPreferences);
  const [notice, setNotice] = useState("");
  const [notificationState, setNotificationState] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "default" : Notification.permission
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    await updatePlatformUser(profile.uid, {
      displayName,
      timezone,
      agentPreferences
    });
    await refreshProfile();
    setNotice("Configuración guardada.");
  };

  const enableNotifications = async () => {
    if (!profile) return;
    const result = await requestNotifications(app);
    setNotificationState(
      typeof Notification === "undefined" ? "default" : Notification.permission
    );
    if (result.enabled && result.token) {
      await saveDeviceToken(
        profile.uid,
        result.token,
        navigator.userAgent.includes("Mobile") ? "Celular" : "Computador"
      );
    }
    setNotice(
      result.enabled
        ? "Notificaciones activadas en este dispositivo."
        : result.reason || "No fue posible activar las notificaciones."
    );
  };

  const setPreference = <K extends keyof AgentPreferences,>(
    key: K,
    value: AgentPreferences[K]
  ) => {
    setAgentPreferences((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="content-page settings-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Preferencias</span>
          <h1>Configuración</h1>
          <p>Personaliza tu cuenta, la personalidad del agente y las notificaciones.</p>
        </div>
      </header>

      {notice && (
        <div className="success-box"><CheckCircle2 size={18} /> {notice}</div>
      )}

      <form onSubmit={save}>
        <section className="settings-card">
          <h2>Perfil</h2>
          <div className="settings-form">
            <label>
              Nombre visible
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label>
              Zona horaria
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                <option value="America/Bogota">Colombia — America/Bogota</option>
                <option value="America/New_York">Nueva York</option>
                <option value="America/Mexico_City">Ciudad de México</option>
                <option value="Europe/Madrid">Madrid</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <h2>Personalidad de Rafiki</h2>
              <p>Elige cómo quieres que el agente te responda.</p>
            </div>
            <MessageCircleMore size={25} />
          </div>

          <div className="tone-grid">
            {TONE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`tone-option ${agentPreferences.tone === option.value ? "selected" : ""}`}
                onClick={() => setPreference("tone", option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.example}</span>
              </button>
            ))}
          </div>

          <div className="settings-form agent-settings-form">
            <label>
              Extensión de las respuestas
              <select
                value={agentPreferences.responseLength}
                onChange={(event) =>
                  setPreference(
                    "responseLength",
                    event.target.value as AgentPreferences["responseLength"]
                  )
                }
              >
                <option value="short">Cortas</option>
                <option value="balanced">Naturales y equilibradas</option>
              </select>
            </label>

            <label className="toggle-row">
              <span>
                <strong>Usar emojis</strong>
                <small>Rafiki podrá incluir emojis discretos en sus respuestas.</small>
              </span>
              <input
                type="checkbox"
                checked={agentPreferences.useEmoji}
                onChange={(event) => setPreference("useEmoji", event.target.checked)}
              />
            </label>

            <label className="toggle-row">
              <span>
                <strong>Respaldo inteligente con Gemini (Modo Híbrido)</strong>
                <small>Usa el motor local sin costo para comandos directos y consulta a Gemini (Free Tier) solo cuando una frase sea compleja o conversacional.</small>
              </span>
              <input
                type="checkbox"
                checked={agentPreferences.useGeminiFallback !== false}
                onChange={(event) => setPreference("useGeminiFallback", event.target.checked)}
              />
            </label>


            <div className="daypart-grid">
              <label>
                “Por la mañana”
                <input
                  type="time"
                  value={`${String(agentPreferences.morningHour).padStart(2, "0")}:00`}
                  onChange={(event) => setPreference("morningHour", Number(event.target.value.slice(0, 2)))}
                />
              </label>
              <label>
                “Después del almuerzo”
                <input
                  type="time"
                  value={`${String(agentPreferences.afternoonHour).padStart(2, "0")}:00`}
                  onChange={(event) => setPreference("afternoonHour", Number(event.target.value.slice(0, 2)))}
                />
              </label>
              <label>
                “Por la noche”
                <input
                  type="time"
                  value={`${String(agentPreferences.eveningHour).padStart(2, "0")}:00`}
                  onChange={(event) => setPreference("eveningHour", Number(event.target.value.slice(0, 2)))}
                />
              </label>
            </div>
          </div>
        </section>

        <button className="primary-button fit settings-save-button">
          <Save size={17} /> Guardar preferencias
        </button>
      </form>

      <section className="settings-card notification-card">
        <div className="settings-card-heading">
          <div>
            <h2>Notificaciones push</h2>
            <p>Recibe avisos aunque la PWA no esté abierta.</p>
          </div>
          <Smartphone size={25} />
        </div>
        <div className="notification-status">
          {notificationState === "granted" ? (
            <><Bell size={19} /> Permitidas en este navegador</>
          ) : (
            <><BellOff size={19} /> Aún no están activadas</>
          )}
        </div>
        <button className="secondary-button" onClick={() => void enableNotifications()}>
          <Bell size={17} /> Activar notificaciones
        </button>
      </section>

      {demoMode && (
        <section className="settings-card danger-zone">
          <h2>Datos de demostración</h2>
          <p>Elimina los mensajes, recordatorios y preferencias guardados en este navegador.</p>
          <button
            className="danger-button"
            onClick={() => {
              resetDemoData();
              void refreshProfile();
              setNotice("Datos de demostración reiniciados.");
            }}
          >
            <RotateCcw size={17} /> Reiniciar demostración
          </button>
        </section>
      )}
    </div>
  );
}
