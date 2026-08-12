import { CalendarClock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ReminderCard } from "../components/ReminderCard";
import { useAuth } from "../context/AuthContext";
import { useReminders } from "../hooks/useReminders";
import {
  deleteReminder,
  postponeReminder,
  updateReminderDetails,
  updateReminderStatus
} from "../services/data";
import type { Reminder, ReminderStatus } from "../types";

export function RemindersPage() {
  const { profile } = useAuth();
  const reminders = useReminders(profile?.uid);
  const [filter, setFilter] = useState<ReminderStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  const filtered = useMemo(
    () =>
      reminders.filter((item) => {
        const matchesStatus = filter === "all" || item.status === filter;
        const matchesSearch = item.title
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
      }),
    [reminders, filter, search]
  );

  const openEdit = (reminder: Reminder) => {
    const date = new Date(reminder.nextTriggerAt);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    setEditing(reminder);
    setEditTitle(reminder.title);
    setEditDate(local);
  };

  return (
    <div className="content-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Organización personal</span>
          <h1>Mis recordatorios</h1>
          <p>Consulta, completa, pospone o cancela tus actividades.</p>
        </div>
        <div className="heading-icon"><CalendarClock size={26} /></div>
      </header>

      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar recordatorios"
          />
        </div>
        <div className="segmented">
          {(["pending", "completed", "cancelled", "all"] as const).map(
            (value) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "pending"
                  ? "Pendientes"
                  : value === "completed"
                    ? "Completados"
                    : value === "cancelled"
                      ? "Cancelados"
                      : "Todos"}
              </button>
            )
          )}
        </div>
      </div>

      <div className="reminders-list">
        {filtered.length === 0 && (
          <div className="empty-state">
            <CalendarClock size={38} />
            <h2>No hay recordatorios aquí</h2>
            <p>Escribe uno desde el chat de Rafiki.</p>
          </div>
        )}

        {filtered.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            onEdit={() => openEdit(reminder)}
            onComplete={() =>
              void updateReminderStatus(
                profile!.uid,
                reminder.id,
                "completed"
              )
            }
            onPostpone={() =>
              void postponeReminder(profile!.uid, reminder.id, 10)
            }
            onCancel={() =>
              void updateReminderStatus(
                profile!.uid,
                reminder.id,
                "cancelled"
              )
            }
            onDelete={() =>
              void deleteReminder(profile!.uid, reminder.id)
            }
          />
        ))}
      </div>

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
          <form
            className="modal-card"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={async (event) => {
              event.preventDefault();
              if (!profile || !editTitle.trim() || !editDate) return;
              await updateReminderDetails(profile.uid, editing.id, {
                title: editTitle.trim(),
                dueAt: new Date(editDate).toISOString()
              });
              setEditing(null);
            }}
          >
            <h2>Editar recordatorio</h2>
            <label>
              Actividad
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Fecha y hora
              <input
                type="datetime-local"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="primary-button fit">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
