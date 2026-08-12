import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword
} from "firebase/auth";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { auth, demoMode, googleProvider } from "../config/firebase";
import { getDemoUser } from "../services/demoStore";
import { getPlatformUser, registerCurrentUser } from "../services/data";
import type { AppUser } from "../types";

interface AuthContextValue {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
  demoMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(
    demoMode ? getDemoUser() : null
  );
  const [loading, setLoading] = useState(!demoMode);

  const refreshProfile = async () => {
    if (demoMode) {
      setProfile(getDemoUser());
      return;
    }
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    const next = await getPlatformUser(firebaseUser.uid);
    setProfile(next);
  };

  useEffect(() => {
    if (demoMode || !auth) return;

    return onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      try {
        if (user) {
          const registered = await registerCurrentUser();
          setProfile(registered);
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      demoMode,
      signInWithGoogle: async () => {
        if (!auth) return;
        await signInWithPopup(auth, googleProvider);
      },
      signInWithEmail: async (email, password) => {
        if (!auth) return;
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUpWithEmail: async (email, password) => {
        if (!auth) return;
        await createUserWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        if (demoMode) return;
        if (auth) await firebaseSignOut(auth);
      },
      refreshProfile
    }),
    [firebaseUser, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
