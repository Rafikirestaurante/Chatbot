import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { Functions, getFunctions } from "firebase/functions";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const demoMode =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  !config.apiKey ||
  !config.projectId ||
  !config.appId;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;

if (!demoMode) {
  app = getApps()[0] ?? initializeApp(config);
  auth = getAuth(app);

  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    // HMR puede intentar inicializar Firestore más de una vez.
    db = getFirestore(app);
  }

  functions = getFunctions(
    app,
    import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1"
  );
}

export { app, auth, db, functions, config as firebaseConfig };
export const googleProvider = new GoogleAuthProvider();
