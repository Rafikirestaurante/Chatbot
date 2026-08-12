import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import { AccessStatusPage } from "./pages/AccessStatusPage";
import { AdminPage } from "./pages/AdminPage";
import { ChatPage } from "./pages/ChatPage";
import { LoginPage } from "./pages/LoginPage";
import { RemindersPage } from "./pages/RemindersPage";
import { SettingsPage } from "./pages/SettingsPage";

function ProtectedApp() {
  const { profile, loading, demoMode } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile && !demoMode) return <Navigate to="/login" replace />;

  if (profile?.status !== "active") {
    return <AccessStatusPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/recordatorios" element={<RemindersPage />} />
        <Route path="/configuracion" element={<SettingsPage />} />
        <Route
          path="/admin"
          element={
            profile.role === "platform_admin"
              ? <AdminPage />
              : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const { demoMode } = useAuth();

  return (
    <Routes>
      {!demoMode && <Route path="/login" element={<LoginPage />} />}
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
