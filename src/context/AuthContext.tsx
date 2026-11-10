import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, mapRoleToAppRole, mapFirestoreRolToAppRole } from '../types';
import { authService, RegisterPayload } from '../services/authService';
import { getStoredSessionToken } from '../services/api';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { createUserDocument, getUserDocument, updateUserDocument } from '../services/firestoreService';

interface RegisterExtraData {
  phone?: string;
  barrio?: string;
  tipoVehiculo?: 'moto' | 'auto' | 'micro' | null;
  esChofer?: boolean;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: { email?: string; uid?: string; displayName?: string; emailVerified?: boolean } | null;
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
  ) => Promise<User>;
  loginWithEmail: (email: string, pass?: string) => Promise<User>;
  loginWithGoogle: (credential?: string, email?: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<boolean>;
  reloadAuthUser: () => Promise<boolean>;
  updateProfileData: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_SESSION_KEY = 'uppa_session_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) return parsed;
      }
    } catch {}
    return null;
  });

  const [firebaseUser, setFirebaseUser] = useState<{ email?: string; uid?: string; displayName?: string; emailVerified?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isResilientMode, setIsResilientMode] = useState<boolean>(true);
  const [emailVerificationSent, setEmailVerificationSent] = useState<boolean>(false);

  // Sincronización continua de Firebase Auth y sesión local
  useEffect(() => {
    let isMounted = true;

    // Timeout de seguridad de 1200ms para evitar bloqueos por conexión lenta
    const safetyTimer = setTimeout(() => {
      if (isMounted && isLoading) {
        setIsLoading(false);
      }
    }, 1200);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser: FirebaseUser | null) => {
        if (!isMounted) return;

        if (fbUser) {
          setFirebaseUser({
            uid: fbUser.uid,
            email: fbUser.email || undefined,
            displayName: fbUser.displayName || undefined,
            emailVerified: fbUser.emailVerified,
          });

          try {
            // Intentar recuperar el perfil oficial desde Firestore
            const fsDoc = await getUserDocument(fbUser.uid);
            if (fsDoc && isMounted) {
              const computedRole = mapFirestoreRolToAppRole(fsDoc.rol, fsDoc.esChofer);
              const mappedUser: User = {
                id: fbUser.uid,
                uid: fbUser.uid,
                name: fsDoc.nombre || fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                nombre: fsDoc.nombre || fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                email: fbUser.email || fsDoc.email,
                role: computedRole,
                rol: fsDoc.rol,
                esChofer: fsDoc.esChofer,
                tipoVehiculo: fsDoc.tipoVehiculo,
                phone: fsDoc.phone,
                barrio: fsDoc.barrio,
                avatarUrl: fsDoc.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}&backgroundColor=12141c`,
                emailVerificado: fbUser.emailVerified || fsDoc.emailVerificado,
                estado: fsDoc.estado,
                fechaRegistro: fsDoc.fechaRegistro,
              };

              setUser(mappedUser);
              localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mappedUser));
            } else if (isMounted) {
              const isAdmin = Boolean(fbUser.email?.includes('admin'));
              const defaultUser: User = {
                id: fbUser.uid,
                uid: fbUser.uid,
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                nombre: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                email: fbUser.email || '',
                role: isAdmin ? 'admin' : 'passenger',
                rol: isAdmin ? 'administrador' : 'pasajero',
                esChofer: false,
                tipoVehiculo: null,
                barrio: 'Campana Centro',
                avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}&backgroundColor=12141c`,
                emailVerificado: fbUser.emailVerified,
                estado: 'activo',
                fechaRegistro: new Date().toISOString(),
              };

              createUserDocument(fbUser.uid, {
                nombre: defaultUser.name,
                email: defaultUser.email,
                rol: defaultUser.rol || 'pasajero',
                estado: 'activo',
                fechaRegistro: defaultUser.fechaRegistro,
              }).catch(() => {});

              setUser(defaultUser);
              localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(defaultUser));
            }
          } catch (e) {
            console.warn('[UPPA Auth] Firestore sync warning:', e);
          }
        } else {
          // No hay usuario activo en Firebase Auth: verificar si hay sesión local
          setFirebaseUser(null);
          try {
            const stored = localStorage.getItem(LOCAL_SESSION_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed && parsed.email) {
                setUser(parsed);
              }
            }
          } catch {}

          // Conexión anónima en segundo plano para habilitar permisos de Firestore sin credenciales
          try {
            if (!auth.currentUser) {
              signInAnonymously(auth).catch((anonErr) => {
                console.warn('[UPPA Auth] Anonymous connection notice:', anonErr.message);
              });
            }
          } catch {}
        }

        if (isMounted) {
          setIsLoading(false);
          clearTimeout(safetyTimer);
        }
      },
      (err) => {
        console.warn('[UPPA Auth] onAuthStateChanged warning:', err);
        if (isMounted) {
          setIsLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    requestedRole?: string,
    extraData?: RegisterExtraData
  ): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);

    const isChofer =
      extraData?.esChofer ||
      requestedRole === 'chofer_moto' ||
      requestedRole === 'chofer_auto' ||
      requestedRole === 'chofer_micro' ||
      requestedRole === 'driver';

    const tipoVehiculo =
      extraData?.tipoVehiculo ||
      (requestedRole === 'chofer_moto'
        ? 'moto'
        : requestedRole === 'chofer_auto'
        ? 'auto'
        : requestedRole === 'chofer_micro'
        ? 'micro'
        : null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    try {
      // 1. Intentar registrar en Firebase Auth real
      let fbUid = '';
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        fbUid = cred.user.uid;
        setFirebaseUser({
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          displayName: cleanName,
          emailVerified: false,
        });
        // Disparar email de verificación de Firebase Auth
        sendEmailVerification(cred.user).catch(() => {});
        setEmailVerificationSent(true);
      } catch (fbErr: any) {
        console.warn('Firebase Auth createUser notice:', fbErr.code, fbErr.message);
        if (fbErr.code === 'auth/email-already-in-use') {
          // Intentar iniciar sesión automáticamente con esa contraseña
          try {
            const loginCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
            fbUid = loginCred.user.uid;
            setFirebaseUser({
              uid: loginCred.user.uid,
              email: loginCred.user.email || cleanEmail,
              displayName: loginCred.user.displayName || cleanName,
              emailVerified: loginCred.user.emailVerified,
            });
          } catch (loginErr) {
            throw new Error('El correo electrónico ya está registrado en UPPA. Podés iniciar sesión con tu contraseña.');
          }
        } else if (fbErr.code === 'auth/weak-password') {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        } else if (fbErr.code === 'auth/invalid-email') {
          throw new Error('El formato del correo electrónico ingresado no es válido.');
        }
      }

      // 2. Registrar usuario en Firestore / Base de datos centralizada
      const registered = await authService.register({
        email: cleanEmail,
        password: cleanPass,
        nombre: cleanName,
        rol: (requestedRole as any) || 'pasajero',
        phone: extraData?.phone,
        barrio: extraData?.barrio,
        tipoVehiculo,
        esChofer: isChofer,
      });

      const effectiveUid = fbUid || registered.uid || registered.id;
      const finalUser: User = {
        ...registered,
        id: effectiveUid,
        uid: effectiveUid,
        name: cleanName,
        nombre: cleanName,
        role: mapFirestoreRolToAppRole(registered.rol, isChofer),
        esChofer: isChofer,
        tipoVehiculo,
        phone: extraData?.phone || registered.phone,
        barrio: extraData?.barrio || registered.barrio,
      };

      // Guardar también en Firestore collection 'usuarios'
      createUserDocument(effectiveUid, {
        nombre: cleanName,
        email: cleanEmail,
        rol: (requestedRole as any) || 'pasajero',
        estado: 'activo',
        fechaRegistro: new Date().toISOString(),
        phone: extraData?.phone,
        barrio: extraData?.barrio,
        esChofer: isChofer,
        tipoVehiculo: tipoVehiculo,
      }).catch(() => {});

      setUser(finalUser);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(finalUser));
      return finalUser;
    } catch (err: any) {
      const msg = err.message || 'Error al registrar usuario';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass?: string): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass?.trim() || '';

    try {
      // 1. Intentar inicio de sesión con Firebase Auth
      let fbUid = '';
      if (cleanPass) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          fbUid = cred.user.uid;
          setFirebaseUser({
            uid: cred.user.uid,
            email: cred.user.email || cleanEmail,
            displayName: cred.user.displayName || undefined,
            emailVerified: cred.user.emailVerified,
          });
        } catch (fbErr: any) {
          console.warn('Firebase Auth signIn notice:', fbErr.code, fbErr.message);
          // Si es un error explícito de contraseña o credenciales, informar al usuario
          if (
            fbErr.code === 'auth/wrong-password' ||
            fbErr.code === 'auth/invalid-credential' ||
            fbErr.code === 'auth/invalid-login-credentials'
          ) {
            throw new Error('Contraseña o credenciales incorrectas. Verificá los datos ingresados o utilizá ¿Olvidaste tu contraseña?.');
          }
          if (fbErr.code === 'auth/user-not-found') {
            throw new Error('No encontramos una cuenta registrada con este correo electrónico. Por favor registrate en la pestaña de Registro.');
          }
          if (fbErr.code === 'auth/invalid-email') {
            throw new Error('El formato del correo electrónico ingresado no es válido.');
          }
          if (fbErr.code === 'auth/too-many-requests') {
            throw new Error('Demasiados intentos fallidos. Por seguridad, esperá unos minutos antes de volver a intentar.');
          }
          if (fbErr.code === 'auth/user-disabled') {
            throw new Error('Esta cuenta ha sido deshabilitada.');
          }
        }
      }

      // 2. Autenticar con el servicio para asegurar perfil completo
      const logged = await authService.login(cleanEmail, cleanPass);
      const effectiveUid = fbUid || logged.uid || logged.id;

      // 3. Sincronizar / cargar perfil de Firestore si existe
      try {
        const fsDoc = await getUserDocument(effectiveUid);
        if (fsDoc) {
          logged.rol = fsDoc.rol || logged.rol;
          logged.esChofer = fsDoc.esChofer ?? logged.esChofer;
          logged.tipoVehiculo = fsDoc.tipoVehiculo ?? logged.tipoVehiculo;
          logged.phone = fsDoc.phone || logged.phone;
          logged.barrio = fsDoc.barrio || logged.barrio;
        }
      } catch {}

      const finalUser: User = {
        ...logged,
        id: effectiveUid,
        uid: effectiveUid,
        name: logged.name || logged.nombre || cleanEmail.split('@')[0],
        nombre: logged.name || logged.nombre || cleanEmail.split('@')[0],
        email: cleanEmail,
      };

      setUser(finalUser);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(finalUser));
      return finalUser;
    } catch (err: any) {
      const msg = err.message || 'Error al iniciar sesión';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithGoogle = async (credential?: string, email?: string, name?: string): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);

    try {
      let fbUid = '';
      let fbEmail = email?.trim().toLowerCase();
      let fbName = name?.trim();

      // Si no viene email directo, intentar ventana emergente con selector explícito de cuenta
      if (!fbEmail) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
          const cred = await signInWithPopup(auth, provider);
          fbUid = cred.user.uid;
          fbEmail = (cred.user.email || '').trim().toLowerCase();
          fbName = cred.user.displayName || fbEmail.split('@')[0];
          setFirebaseUser({
            uid: cred.user.uid,
            email: cred.user.email || undefined,
            displayName: cred.user.displayName || undefined,
            emailVerified: true,
          });
        } catch (popupErr: any) {
          console.warn('Google Popup result:', popupErr?.code || popupErr?.message);
          if (popupErr?.code === 'auth/popup-closed-by-user' || popupErr?.code === 'auth/cancelled-popup-request') {
            throw new Error('Inicio de sesión cancelado.');
          }
          if (
            popupErr?.code === 'auth/popup-blocked' ||
            popupErr?.code === 'auth/unauthorized-domain' ||
            popupErr?.message?.includes('popup')
          ) {
            throw new Error('popup-blocked: La ventana emergente fue bloqueada por el navegador.');
          }
          if (!fbEmail && !credential) {
            throw new Error(popupErr?.message || 'No se pudo conectar con la cuenta de Google seleccionada.');
          }
        }
      }

      if (!fbEmail && !credential) {
        throw new Error('Por favor seleccioná tu cuenta personal de Google para ingresar.');
      }

      const logged = await authService.googleLogin(credential, fbEmail, fbName);
      const effectiveUid = fbUid || logged.uid || logged.id;

      // Sincronizar o crear documento en Firestore
      try {
        await createUserDocument(effectiveUid, {
          nombre: fbName || logged.name || 'Usuario Google',
          email: fbEmail || logged.email,
          rol: logged.rol || 'pasajero',
          estado: 'activo',
          fechaRegistro: logged.fechaRegistro || new Date().toISOString(),
          esChofer: logged.esChofer || false,
        });
      } catch {}

      const finalUser: User = {
        ...logged,
        id: effectiveUid,
        uid: effectiveUid,
        name: fbName || logged.name || logged.nombre || 'Usuario Google',
        nombre: fbName || logged.name || logged.nombre || 'Usuario Google',
        email: fbEmail || logged.email,
      };

      setUser(finalUser);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(finalUser));
      return finalUser;
    } catch (err: any) {
      const msg = err.message || 'Error al ingresar con Google';
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch {}
    try {
      await authService.logout();
    } catch {}
    setUser(null);
    setFirebaseUser(null);
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem('uppa_session_user');
      localStorage.removeItem('uppa_session_token');
    } catch {}
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {}
    await authService.resetPassword(email);
  };

  const sendVerificationEmail = async (): Promise<boolean> => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch {}
    }
    setEmailVerificationSent(true);
    setAuthNotice('Correo de verificación enviado por Firebase.');
    return true;
  };

  const reloadAuthUser = async (): Promise<boolean> => {
    const updated = await authService.getCurrentUser();
    if (updated) {
      setUser(updated);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const updateProfileData = async (data: Partial<User>): Promise<void> => {
    if (user?.id) {
      await authService.updateProfile(user.id, data);
      await updateUserDocument(user.id, {
        nombre: data.name || data.nombre,
        phone: data.phone || data.telefono,
        barrio: data.barrio,
        rol: data.rol || data.role,
      }).catch(() => {});

      const merged = { ...user, ...data };
      setUser(merged);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(merged));
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.rol === 'administrador';
  const isEmailVerified = firebaseUser?.emailVerified ?? (user?.emailVerificado ?? true);

  const effectiveFirebaseUser = firebaseUser || (user ? {
    uid: user.id || user.uid,
    email: user.email,
    displayName: user.name,
    emailVerified: isEmailVerified,
  } : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: effectiveFirebaseUser,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
