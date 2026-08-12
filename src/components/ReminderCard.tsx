import { Check, Clock3, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import type { Reminder } from "../types";

interface Props {
  reminder: Reminder;
  compact?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
  onPostpone?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReminderCard({
  reminder,
  compact,
  onComplete,
  onCancel,
  onPostpone,
  onEdit,
  onDelete
}: Props) {
  const date = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: reminder.timezone
  }).format(new Date(reminder.nextTriggerAt));

  const recurrenceLabel: Record<string, string> = {
    none: "Una vez",
    daily: "Todos los días",
    weekdays: "Lunes a viernes",
    weekly: "Semanal"
  };

  return (
    <article className={`reminder-card ${compact ? "compact" : ""}`}>
      <div className="reminder-card-icon"><Clock3 size={20} /></div>
      <div className="reminder-card-content">
        <div className="reminder-card-heading">
          <div>
            <h3>{reminder.title}</h3>
            <p>{date}</p>
          </div>
          <span className={`status-badge ${reminder.status}`}>
            {reminder.status === "pending"
              ? "Pendiente"
              : reminder.status === "completed"
                ? "Completado"
                : "Cancelado"}
          </span>
        </div>
        <span className="recurrence-label">
          {recurrenceLabel[reminder.recurrence.type]}
        </span>

        {reminder.status === "pending" && (
          <div className="reminder-actions">
            {onEdit && (
              <button onClick={onEdit}><Pencil size={16} /> Editar</button>
            )}
            {onComplete && (
              <button onClick={onComplete}><Check size={16} /> Completar</button>
            )}
            {onPostpone && (
              <button onClick={onPostpone}><RotateCcw size={16} /> +10 min</button>
            )}
            {onCancel && (
              <button onClick={onCancel}><X size={16} /> Cancelar</button>
            )}
          </div>
        )}
        {onDelete && (
          <button className="delete-link" onClick={onDelete}>
            <Trash2 size={15} /> Eliminar
          </button>
        )}
      </div>
    </article>
  );
}
