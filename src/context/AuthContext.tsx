import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import {
  UserProfile,
  getUserDocument,
  createUserDocument,
  updateUserDocument,
} from '../services/firestoreService';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  registerWithEmail: (email: string, pass: string, name: string, requestedRole?: string) => Promise<UserProfile>;
  loginWithEmail: (email: string, pass: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Known admin emails for bootstrapping
const ADMIN_EMAILS = [
  'admin@uppa.ar',
  'gastonrobertogimenez@gmail.com',
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Monitor auth state changes with persistent session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthError(null);

      if (fbUser) {
        try {
          let profile = await getUserDocument(fbUser.uid);

          if (!profile) {
            // First time or document missing: automatically initialize profile document in users/{uid}
            const normalizedEmail = (fbUser.email || '').toLowerCase().trim();
            const isInitialAdmin = ADMIN_EMAILS.includes(normalizedEmail);

            profile = await createUserDocument(fbUser.uid, {
              nombre: fbUser.displayName || 'Usuario UPPA',
              email: normalizedEmail,
              rol: isInitialAdmin ? 'administrador' : 'cliente',
              estado: 'activo',
              fechaRegistro: new Date().toISOString(),
              phone: fbUser.phoneNumber || '',
              barrio: 'Zárate ↔ Campana',
              avatarUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}&backgroundColor=12141c`,
            });
          }

          setUser(profile);
        } catch (err: any) {
          console.error('Error fetching/creating user document in Firestore:', err);
          // Fallback user state so app remains functional
          const fallbackUser: UserProfile = {
            uid: fbUser.uid,
            nombre: fbUser.displayName || 'Usuario UPPA',
            email: fbUser.email || '',
            rol: ADMIN_EMAILS.includes(fbUser.email || '') ? 'administrador' : 'cliente',
            estado: 'activo',
            fechaRegistro: new Date().toISOString(),
          };
          setUser(fallbackUser);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Register with email and password
  const registerWithEmail = async (email: string, pass: string, name: string, requestedRole?: string): Promise<UserProfile> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || 'Nuevo Usuario';

    try {
      // 1. Create user in Firebase Authentication
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const uid = cred.user.uid;

      // Update auth profile display name
      await updateFirebaseProfile(cred.user, { displayName: cleanName });

      // 2. Automatically create document in Firestore: users/{uid} & usuarios/{uid}
      // rol = requestedRole || "pasajero", estado = "activo", fechaRegistro = now (NEVER store password!)
      const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail) || requestedRole === 'administrador';
      const userRole = isInitialAdmin ? 'administrador' : ((requestedRole as any) || 'pasajero');
      const newProfile = await createUserDocument(uid, {
        nombre: cleanName,
        email: cleanEmail,
        rol: userRole,
        estado: 'activo',
        fechaRegistro: new Date().toISOString(),
        phone: '',
        barrio: 'Barrio Malvinas, Campana',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
        esChofer: typeof requestedRole === 'string' && requestedRole.startsWith('chofer'),
        tipoVehiculo: requestedRole === 'chofer_moto' ? 'moto' : requestedRole === 'chofer_auto' ? 'auto' : requestedRole === 'chofer_micro' ? 'micro' : null,
      });

      setUser(newProfile);
      return newProfile;
    } catch (err: any) {
      let message = 'Error al registrar el usuario en Firebase.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'El correo electrónico ya está registrado. Probá iniciar sesión.';
      } else if (err.code === 'auth/weak-password') {
        message = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'El formato del correo electrónico no es válido.';
      } else if (err.message) {
        message = err.message;
      }
      setAuthError(message);
      throw new Error(message);
    }
  };

  // Login with email and password
  const loginWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      let profile = await getUserDocument(cred.user.uid);

      if (!profile) {
        // Automatically create in users/{uid} if missing
        const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail);
        profile = await createUserDocument(cred.user.uid, {
          nombre: cred.user.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          rol: isInitialAdmin ? 'administrador' : 'cliente',
          estado: 'activo',
          fechaRegistro: new Date().toISOString(),
        });
      }

      setUser(profile);
      return profile;
    } catch (err: any) {
      let message = 'Error al iniciar sesión.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        message = 'Correo electrónico o contraseña incorrectos.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Demasiados intentos fallidos. Por favor intentá más tarde.';
      } else if (err.message) {
        message = err.message;
      }
      setAuthError(message);
      throw new Error(message);
    }
  };

  // Login with Google Popup
  const loginWithGoogle = async (): Promise<UserProfile> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const uid = cred.user.uid;
      const cleanEmail = (cred.user.email || '').toLowerCase().trim();

      let profile = await getUserDocument(uid);
      if (!profile) {
        const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail);
        profile = await createUserDocument(uid, {
          nombre: cred.user.displayName || cleanEmail.split('@')[0],
          email: cleanEmail,
          rol: isInitialAdmin ? 'administrador' : 'cliente',
          estado: 'activo',
          fechaRegistro: new Date().toISOString(),
          phone: cred.user.phoneNumber || '',
          barrio: 'Zárate ↔ Campana',
          avatarUrl: cred.user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
        });
      }

      setUser(profile);
      return profile;
    } catch (err: any) {
      let message = 'Error al conectar con la cuenta de Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        message = 'La ventana de autenticación fue cerrada.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        message = 'Operación cancelada.';
      } else if (err.message) {
        message = err.message;
      }
      setAuthError(message);
      throw new Error(message);
    }
  };

  // Logout
  const logout = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (err: any) {
      console.error('Error closing session:', err);
    }
  };

  // Recover password via Firebase Auth
  const resetPassword = async (email: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      let message = 'Error al enviar el correo de recuperación.';
      if (err.code === 'auth/user-not-found') {
        message = 'No se encontró ninguna cuenta asociada a este correo.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'El formato del correo es inválido.';
      }
      setAuthError(message);
      throw new Error(message);
    }
  };

  // Update profile
  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateUserDocument(user.uid, data);
      setUser({ ...user, ...data });
    } catch (err: any) {
      console.error('Error updating profile in Firestore:', err);
      throw err;
    }
  };

  const isAuthenticated = !!firebaseUser && !!user;
  const isAdmin = user?.rol === 'administrador';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        isAuthenticated,
        isAdmin,
        isLoading,
        authError,
        setAuthError,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        resetPassword,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
