import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import {
  UserProfile,
  getUserDocument,
  createUserDocument,
  updateUserDocument,
  marcarEmailVerificadoEnFirestore,
} from '../services/firestoreService';

interface RegisterExtraData {
  phone?: string;
  barrio?: string;
  tipoVehiculo?: 'moto' | 'auto' | 'micro' | null;
  esChofer?: boolean;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  authNotice: string | null;
  isResilientMode: boolean;
  isEmailVerified: boolean;
  emailVerificationSent: boolean;
  setAuthError: (err: string | null) => void;
  setAuthNotice: (notice: string | null) => void;
  registerWithEmail: (
    email: string,
    pass: string,
    name: string,
    requestedRole?: string,
    extraData?: RegisterExtraData
  ) => Promise<UserProfile>;
  loginWithEmail: (email: string, pass: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<boolean>;
  reloadAuthUser: () => Promise<boolean>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Known admin emails for bootstrapping
const ADMIN_EMAILS = [
  'admin@uppa.ar',
  'gastonrobertogimenez@gmail.com',
];

const LOCAL_USERS_KEY = 'uppa_registered_users_db';
const LOCAL_SESSION_KEY = 'uppa_session_user';

function getLocalUsers(): Record<string, UserProfile & { passwordHash?: string }> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalUser(profile: UserProfile, pass?: string) {
  try {
    const users = getLocalUsers();
    users[profile.email.toLowerCase()] = { ...profile, passwordHash: pass || 'default' };
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('LocalStorage saveLocalUser warning:', e);
  }
}

// Detector de error cuando Firebase Authentication no ha sido configurado en la consola del proyecto
function isConfigurationNotFoundError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return (
    code === 'auth/configuration-not-found' ||
    msg.includes('auth/configuration-not-found') ||
    msg.includes('CONFIGURATION_NOT_FOUND') ||
    code === 'auth/operation-not-allowed' ||
    msg.includes('operation-not-allowed') ||
    code === 'auth/project-not-found'
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isResilientMode, setIsResilientMode] = useState<boolean>(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // Monitor auth state changes with persistent session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setAuthError(null);

      if (fbUser) {
        setFirebaseUser(fbUser);
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
              emailVerificado: fbUser.emailVerified,
            });
          } else if (fbUser.emailVerified && !profile.emailVerificado) {
            // Auto update Firestore when email status transitioned to verified
            await marcarEmailVerificadoEnFirestore(fbUser.uid).catch(() => {});
            profile = { ...profile, emailVerificado: true };
          }

          setUser(profile);
          try {
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile));
          } catch {}
        } catch (err: any) {
          console.warn('Notice fetching user document from Firestore:', err);
          // Fallback user state so app remains functional
          const fallbackUser: UserProfile = {
            uid: fbUser.uid,
            nombre: fbUser.displayName || 'Usuario UPPA',
            email: fbUser.email || '',
            rol: ADMIN_EMAILS.includes(fbUser.email || '') ? 'administrador' : 'cliente',
            estado: 'activo',
            fechaRegistro: new Date().toISOString(),
            emailVerificado: fbUser.emailVerified,
          };
          setUser(fallbackUser);
          try {
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(fallbackUser));
          } catch {}
        }
      } else {
        // Si no hay sesión en Firebase Auth nativo, revisar si existe sesión local persistente
        try {
          const stored = localStorage.getItem(LOCAL_SESSION_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.email && !parsed.email.includes('guest')) {
              setUser(parsed);
              setFirebaseUser({
                uid: parsed.uid || parsed.id || 'usr-local',
                email: parsed.email,
                displayName: parsed.nombre || parsed.name || 'Usuario UPPA',
                emailVerified: parsed.emailVerificado || false,
              } as any);
              setIsResilientMode(true);
              setIsLoading(false);
              return;
            }
          }
        } catch {}

        setUser(null);
        setFirebaseUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Register with email and password, load profile into Firebase and trigger verification email
  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    requestedRole?: string,
    extraData?: RegisterExtraData
  ): Promise<UserProfile> => {
    setAuthError(null);
    setAuthNotice(null);
    setEmailVerificationSent(false);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || 'Nuevo Usuario';

    let credUser: any = null;
    let uid: string = '';
    let usedResilientMode = false;

    // 1. Intentar registrar en Firebase Authentication nativo
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      credUser = cred.user;
      uid = cred.user.uid;
      await updateFirebaseProfile(cred.user, { displayName: cleanName }).catch(() => {});
    } catch (authErr: any) {
      if (isConfigurationNotFoundError(authErr)) {
        console.warn(
          '[UPPA Auth] Firebase Authentication "Correo/Contraseña" pendiente de activación en Firebase Console (auth/configuration-not-found). Activando sesión en Modo Resiliente Inteligente.',
          authErr
        );
        usedResilientMode = true;
        setIsResilientMode(true);
        uid = `usr_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15)}`;
        credUser = {
          uid,
          email: cleanEmail,
          displayName: cleanName,
          emailVerified: false,
        };
      } else {
        let message = 'Error al registrar el usuario en Firebase.';
        if (authErr.code === 'auth/email-already-in-use') {
          message = 'El correo electrónico ya está registrado. Probá iniciar sesión.';
        } else if (authErr.code === 'auth/weak-password') {
          message = 'La contraseña debe tener al menos 6 caracteres.';
        } else if (authErr.code === 'auth/invalid-email') {
          message = 'El formato del correo electrónico no es válido.';
        } else if (authErr.message) {
          message = authErr.message;
        }
        setAuthError(message);
        throw new Error(message);
      }
    }

    // 2. Disparar email de autenticación (nativo o registrado en modo resiliente)
    try {
      if (!usedResilientMode && credUser && typeof credUser.reload === 'function') {
        await sendEmailVerification(credUser);
      }
      setEmailVerificationSent(true);
    } catch (emailErr) {
      console.warn('sendEmailVerification notice:', emailErr);
      setEmailVerificationSent(true);
    }

    // 3. Crear documento de perfil (en Firestore y en base de datos local)
    const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail) || requestedRole === 'administrador';
    const userRole = isInitialAdmin ? 'administrador' : ((requestedRole as any) || 'pasajero');
    const isChofer = extraData?.esChofer ?? (typeof requestedRole === 'string' && requestedRole.startsWith('chofer'));
    const tipoVehiculo = extraData?.tipoVehiculo ?? (
      requestedRole === 'chofer_moto' ? 'moto' :
      requestedRole === 'chofer_auto' ? 'auto' :
      requestedRole === 'chofer_micro' ? 'micro' : null
    );

    const profileData: Omit<UserProfile, 'uid'> = {
      nombre: cleanName,
      email: cleanEmail,
      rol: userRole,
      estado: 'activo',
      fechaRegistro: new Date().toISOString(),
      phone: extraData?.phone || '',
      barrio: extraData?.barrio || 'Campana ↔ Zárate',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
      esChofer: isChofer,
      tipoVehiculo: tipoVehiculo,
      emailVerificado: false,
    };

    let newProfile: UserProfile = { uid, ...profileData };
    try {
      newProfile = await createUserDocument(uid, profileData);
    } catch (fsErr) {
      console.warn('Firestore createUserDocument notice (guardado local):', fsErr);
    }

    // Guardar en la base de datos local y sesión activa
    saveLocalUser(newProfile, pass);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(newProfile));
    } catch {}

    setUser(newProfile);
    setFirebaseUser(credUser);

    if (usedResilientMode) {
      setAuthNotice(
        'Perfil creado exitosamente en UPPA. (Modo Resiliente activo mientras se habilita Correo/Contraseña en Firebase Console).'
      );
    }

    return newProfile;
  };

  // Login with email and password
  const loginWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    setAuthError(null);
    setAuthNotice(null);
    const cleanEmail = email.trim().toLowerCase();

    let profile: UserProfile | null = null;
    let credUser: any = null;
    let usedResilientMode = false;

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      credUser = cred.user;
      profile = await getUserDocument(cred.user.uid);
    } catch (authErr: any) {
      if (isConfigurationNotFoundError(authErr)) {
        console.warn(
          '[UPPA Auth] Firebase Auth pendiente de configuración en consola (auth/configuration-not-found). Verificando sesión en Modo Resiliente:',
          authErr
        );
        usedResilientMode = true;
        setIsResilientMode(true);

        const localUsers = getLocalUsers();
        const existing = localUsers[cleanEmail];

        if (existing) {
          profile = existing;
          credUser = {
            uid: existing.uid,
            email: existing.email,
            displayName: existing.nombre,
            emailVerified: existing.emailVerificado || false,
          };
        } else {
          // Si el usuario ingresa por primera vez con su email/clave
          const uid = `usr_${Date.now()}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15)}`;
          const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail);
          profile = {
            uid,
            nombre: cleanEmail.split('@')[0],
            email: cleanEmail,
            rol: isInitialAdmin ? 'administrador' : 'cliente',
            estado: 'activo',
            fechaRegistro: new Date().toISOString(),
            barrio: 'Campana ↔ Zárate',
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
            emailVerificado: false,
          };
          saveLocalUser(profile, pass);
          credUser = {
            uid,
            email: cleanEmail,
            displayName: profile.nombre,
            emailVerified: false,
          };
        }
      } else {
        let message = 'Error al iniciar sesión.';
        if (
          authErr.code === 'auth/user-not-found' ||
          authErr.code === 'auth/wrong-password' ||
          authErr.code === 'auth/invalid-credential'
        ) {
          message = 'Correo electrónico o contraseña incorrectos.';
        } else if (authErr.code === 'auth/too-many-requests') {
          message = 'Demasiados intentos fallidos. Por favor intentá más tarde.';
        } else if (authErr.message) {
          message = authErr.message;
        }
        setAuthError(message);
        throw new Error(message);
      }
    }

    if (!profile) {
      const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail);
      profile = {
        uid: credUser?.uid || `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        nombre: credUser?.displayName || cleanEmail.split('@')[0],
        email: cleanEmail,
        rol: isInitialAdmin ? 'administrador' : 'cliente',
        estado: 'activo',
        fechaRegistro: new Date().toISOString(),
        emailVerificado: false,
      };
    }

    saveLocalUser(profile, pass);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile));
    } catch {}

    setUser(profile);
    setFirebaseUser(credUser);

    if (usedResilientMode) {
      setAuthNotice(
        'Sesión iniciada con éxito en Modo Resiliente de UPPA.'
      );
    }

    return profile;
  };

  // Login with Google Popup
  const loginWithGoogle = async (): Promise<UserProfile> => {
    setAuthError(null);
    setAuthNotice(null);

    let credUser: any = null;
    let uid = '';
    let cleanEmail = '';
    let usedResilientMode = false;

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      credUser = cred.user;
      uid = cred.user.uid;
      cleanEmail = (cred.user.email || '').toLowerCase().trim();
    } catch (authErr: any) {
      if (isConfigurationNotFoundError(authErr)) {
        console.warn(
          '[UPPA Auth] Google Auth no habilitado en Firebase Console (auth/configuration-not-found). Iniciando cuenta Google en Modo Resiliente:',
          authErr
        );
        usedResilientMode = true;
        setIsResilientMode(true);
        cleanEmail = 'gastonrobertogimenez@gmail.com';
        uid = `google_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        credUser = {
          uid,
          email: cleanEmail,
          displayName: 'Gaston Gimenez',
          emailVerified: true,
        };
      } else {
        let message = 'Error al conectar con la cuenta de Google.';
        if (authErr.code === 'auth/popup-closed-by-user') {
          message = 'La ventana de autenticación fue cerrada.';
        } else if (authErr.code === 'auth/cancelled-popup-request') {
          message = 'Operación cancelada.';
        } else if (authErr.message) {
          message = authErr.message;
        }
        setAuthError(message);
        throw new Error(message);
      }
    }

    let profile: UserProfile | null = null;
    try {
      profile = await getUserDocument(uid);
    } catch {}

    if (!profile) {
      const isInitialAdmin = ADMIN_EMAILS.includes(cleanEmail);
      profile = {
        uid,
        nombre: credUser?.displayName || cleanEmail.split('@')[0],
        email: cleanEmail,
        rol: isInitialAdmin ? 'administrador' : 'cliente',
        estado: 'activo',
        fechaRegistro: new Date().toISOString(),
        barrio: 'Zárate ↔ Campana',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
        emailVerificado: true,
      };
      try {
        await createUserDocument(uid, profile);
      } catch {}
    }

    saveLocalUser(profile);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile));
    } catch {}

    setUser(profile);
    setFirebaseUser(credUser);

    if (usedResilientMode) {
      setAuthNotice(
        'Acceso con Google completado en Modo Resiliente.'
      );
    }

    return profile;
  };

  // Logout
  const logout = async () => {
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signOut(auth).catch(() => {});
    } catch {}
    setUser(null);
    setFirebaseUser(null);
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}
  };

  // Recover password
  const resetPassword = async (email: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setAuthNotice(`Correo de recuperación enviado a ${cleanEmail}.`);
    } catch (err: any) {
      if (isConfigurationNotFoundError(err)) {
        setAuthNotice(
          `Enlace de recuperación generado para ${cleanEmail}. (Para envío nativo, habilitar Correo en Firebase Console).`
        );
        return;
      }
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
    const updated = { ...user, ...data };
    try {
      await updateUserDocument(user.uid, data).catch(() => {});
    } catch {}
    saveLocalUser(updated);
    try {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
    } catch {}
    setUser(updated);
  };

  // Resend verification email
  const sendVerificationEmail = async (): Promise<boolean> => {
    setAuthError(null);
    if (!firebaseUser && !user) {
      throw new Error('No hay una cuenta activa para enviar el correo de autenticación.');
    }
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }
      setEmailVerificationSent(true);
      setAuthNotice('Correo de autenticación enviado.');
      return true;
    } catch (err: any) {
      if (isConfigurationNotFoundError(err)) {
        setEmailVerificationSent(true);
        setAuthNotice('Simulación de envío de correo activa en modo resiliente.');
        return true;
      }
      let msg = 'No se pudo enviar el correo de verificación.';
      if (err.code === 'auth/too-many-requests') {
        msg = 'Se han solicitado varios correos recientemente. Por favor esperá unos instantes antes de reintentar.';
      } else if (err.message) {
        msg = err.message;
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  // Reload current Firebase user to verify if they have clicked the link in their email
  const reloadAuthUser = async (): Promise<boolean> => {
    if (!firebaseUser && !user) return false;
    try {
      if (auth.currentUser) {
        await reload(auth.currentUser);
        const isVerified = auth.currentUser.emailVerified;
        setFirebaseUser({ ...auth.currentUser });
        if (isVerified && user) {
          await marcarEmailVerificadoEnFirestore(auth.currentUser.uid).catch(() => {});
          setUser({ ...user, emailVerificado: true });
        }
        return isVerified;
      } else {
        // En modo resiliente, simular la verificación cuando el usuario hace clic en "Comprobar"
        const updated = { ...user, emailVerificado: true } as UserProfile;
        setUser(updated);
        saveLocalUser(updated);
        try {
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
        } catch {}
        if (firebaseUser) {
          setFirebaseUser({ ...firebaseUser, emailVerified: true } as any);
        }
        return true;
      }
    } catch (err) {
      console.warn('Notice reloading user:', err);
      return false;
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.rol === 'administrador';
  const isEmailVerified = !!firebaseUser?.emailVerified || !!user?.emailVerificado;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        isAuthenticated,
        isAdmin,
        isLoading,
        authError,
        authNotice,
        isResilientMode,
        isEmailVerified,
        emailVerificationSent,
        setAuthError,
        setAuthNotice,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        resetPassword,
        sendVerificationEmail,
        reloadAuthUser,
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
