import {
  Bell,
  Bot,
  CalendarClock,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X
} from "lucide-react";
import { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut, demoMode } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Chat", icon: Bot },
    { to: "/recordatorios", label: "Recordatorios", icon: CalendarClock },
    { to: "/configuracion", label: "Configuración", icon: Settings }
  ];

  if (profile?.role === "platform_admin") {
    links.push({ to: "/admin", label: "Administración", icon: ShieldCheck });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-avatar"><Bell size={23} /></div>
          <div>
            <strong>Rafiki</strong>
            <span>Recordatorios</span>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <div className="profile-mini">
          <div className="profile-avatar">
            {profile?.displayName?.charAt(0).toUpperCase() || "R"}
          </div>
          <div>
            <strong>{profile?.displayName || "Usuario"}</strong>
            <span>{profile?.email}</span>
          </div>
        </div>

        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {demoMode && <span className="demo-pill">Modo demostración</span>}
          {!demoMode && (
            <button className="sidebar-signout" onClick={() => void signOut()}>
              <LogOut size={18} />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      <main className="main-panel">
        <button
          className="mobile-menu-button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
        {children}
      </main>

      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} />}
    </div>
  );
}
