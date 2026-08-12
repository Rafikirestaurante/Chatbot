import { Search, ShieldCheck, UserCheck, UserPlus, UserX } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  adminInviteEmail,
  adminSetUserStatus,
  listAdminUsers
} from "../services/data";
import type { AdminUserRow } from "../types";

export function AdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => setUsers(await listAdminUsers());

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((item) =>
        `${item.displayName} ${item.email}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [users, search]
  );

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    await adminInviteEmail(inviteEmail);
    setNotice(`Invitación habilitada para ${inviteEmail}.`);
    setInviteEmail("");
  };

  return (
    <div className="content-page admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Administración de plataforma</span>
          <h1>Usuarios y accesos</h1>
          <p>
            Administra cuentas sin acceso a conversaciones ni al contenido de los recordatorios.
          </p>
        </div>
        <div className="heading-icon"><ShieldCheck size={26} /></div>
      </header>

      <div className="privacy-admin-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Privacidad por diseño</strong>
          <p>
            Este panel solo consulta metadatos de cuenta. No existe una función para abrir chats.
          </p>
        </div>
      </div>

      {notice && <div className="success-box">{notice}</div>}

      <form className="invite-form" onSubmit={invite}>
        <div>
          <UserPlus size={20} />
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
          />
        </div>
        <button className="primary-button fit">Autorizar correo</button>
      </form>

      <div className="search-field admin-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o correo"
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Recordatorios</th>
              <th>Dispositivos</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.uid}>
                <td>
                  <strong>{user.displayName}</strong>
                  <span>{user.email}</span>
                </td>
                <td><span className={`status-badge ${user.status}`}>{user.status}</span></td>
                <td>{user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString("es-CO") : "—"}</td>
                <td>{user.reminderCount ?? 0}</td>
                <td>{user.deviceCount ?? 0}</td>
                <td>
                  {user.role === "platform_admin" ? (
                    <span className="admin-label">Administrador</span>
                  ) : user.status === "active" ? (
                    <button
                      className="table-action danger"
                      onClick={async () => {
                        await adminSetUserStatus(user.uid, "suspended");
                        await load();
                      }}
                    >
                      <UserX size={16} /> Suspender
                    </button>
                  ) : (
                    <button
                      className="table-action"
                      onClick={async () => {
                        await adminSetUserStatus(user.uid, "active");
                        await load();
                      }}
                    >
                      <UserCheck size={16} /> Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
