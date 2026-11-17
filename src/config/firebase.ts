import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7Pm40w6DdzNwp5BicJ1l0dMQI4QzPdTw",
  authDomain: "uppa-22dc3.firebaseapp.com",
  projectId: "uppa-22dc3",
  storageBucket: "uppa-22dc3.firebasestorage.app",
  messagingSenderId: "1013842136255",
  appId: "1:1013842136255:web:a26b0f21fd1fa2f7c10a0a",
  measurementId: "G-PMYDXTSZL3"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'es';
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Analytics conditionally to avoid SSR or non-browser issues
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Connection validation
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline:', error.message);
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

let pendingAuthReadyPromise: Promise<string | null> | null = null;
let lastAnonymousAuthErrorCode: string | null = null;

export function getLastAnonymousAuthErrorCode(): string | null {
  return lastAnonymousAuthErrorCode;
}

/**
 * Espera a que Firebase Auth termine de restaurar la sesión y, si no existe un usuario
 * autenticado, intenta obtener una sesión anónima para que las reglas con `request.auth != null`
 * permitan leer y escribir en Firestore sin bloquear a usuarios de WhatsApp o acceso rápido.
 */
export async function ensureFirebaseAuthSession(): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  if (pendingAuthReadyPromise) {
    return pendingAuthReadyPromise;
  }

  pendingAuthReadyPromise = (async () => {
    try {
      // Esperar a que Firebase Auth termine de restaurar la sesión persistida (Google/Email/Anónima)
      if (typeof auth.authStateReady === 'function') {
        await Promise.race([
          auth.authStateReady(),
          new Promise<void>((resolve) => setTimeout(resolve, 2500)),
        ]);
      } else {
        await new Promise<void>((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              unsub();
              resolve();
            }
          }, 2500);

          const unsub = onAuthStateChanged(auth, () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              unsub();
              resolve();
            }
          });
        });
      }

      if (auth.currentUser) {
        return auth.currentUser.uid;
      }

      if (
        lastAnonymousAuthErrorCode === 'auth/operation-not-allowed' ||
        lastAnonymousAuthErrorCode === 'auth/admin-restricted-operation'
      ) {
        return null;
      }

      const cred = await signInAnonymously(auth);
      lastAnonymousAuthErrorCode = null;
      return cred.user?.uid || null;
    } catch (err: any) {
      const code = err?.code || err?.message || 'unknown';
      lastAnonymousAuthErrorCode = String(code);
      console.warn('[UPPA Auth] No se pudo iniciar sesión anónima en Firebase:', code);
      return auth.currentUser?.uid || null;
    } finally {
      pendingAuthReadyPromise = null;
    }
  })();

  return pendingAuthReadyPromise;
}

export function reportFirestorePermissionIssue(error: unknown, operationType: OperationType, path: string | null): void {
  const rawMsg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  const isPerm =
    code === 'permission-denied' ||
    rawMsg.toLowerCase().includes('permission-denied') ||
    rawMsg.toLowerCase().includes('missing or insufficient permissions');

  if (!isPerm) return;

  const detail = {
    error: rawMsg,
    code: code || 'permission-denied',
    operationType,
    path,
    hasAuthUser: Boolean(auth.currentUser),
    isAnonymous: Boolean(auth.currentUser?.isAnonymous),
    anonymousAuthBlocked:
      lastAnonymousAuthErrorCode === 'auth/operation-not-allowed' ||
      lastAnonymousAuthErrorCode === 'auth/admin-restricted-operation',
    timestamp: Date.now(),
  };

  console.warn('[UPPA Firestore Permission Denied]', JSON.stringify(detail));
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('uppa-firestore-permission-error', { detail }));
    } catch {}
  }
}

export function notifyFirestoreSyncHealthy(path: string): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('uppa-firestore-sync-ok', { detail: { path, timestamp: Date.now() } }));
    } catch {}
  }
}

// Standardized error handler according to security standards
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  reportFirestorePermissionIssue(error, operationType, path);
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
