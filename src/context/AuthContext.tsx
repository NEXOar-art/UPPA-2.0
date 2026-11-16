import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, mapFirestoreRolToAppRole } from '../types';
import { authService } from '../services/authService';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, ensureFirebaseAuthSession } from '../config/firebase';
import {
  createUserDocument,
  getUserDocument,
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFICIAL_ADMIN_EMAIL = 'gastonrobertogimenez@gmail.com';

function isValidStoredSessionUser(parsed: any): parsed is User {
  if (!parsed || typeof parsed !== 'object') return false;
  const email = String(parsed.email || '').trim().toLowerCase();
  const id = String(parsed.id || parsed.uid || '').trim();
  if (!id || id === 'usr-comunidad' || id.startsWith('wa_')) return false;
  if (email.includes('guest') || email.endsWith('@whatsapp.uppa.app')) return false;
  return Boolean(email);
}

function readStoredSessionUser(): User | null {
  try {
    const stored = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isValidStoredSessionUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredSessionUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
  } catch {}
}

function translateFirebaseAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'El formato del correo electrónico ingresado no es válido.';
    case 'auth/user-not-found':
      return 'No encontramos una cuenta registrada con este correo electrónico. Registrate primero en la pestaña Registro.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Correo o contraseña incorrectos. Verificá tus datos o usá "¿Olvidaste tu contraseña?".';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado en UPPA. Podés iniciar sesión con tu contraseña.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por seguridad, esperá unos minutos antes de volver a intentar.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada.';
    case 'auth/network-request-failed':
      return 'Sin conexión con Firebase. Verificá tu acceso a internet e intentá nuevamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta registrada con este correo usando otro método de ingreso.';
    default:
      return fallback || 'No se pudo completar la autenticación.';
  }
}

function isProviderUnavailableCode(code?: string): boolean {
  return (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found' ||
    code === 'auth/admin-restricted-operation'
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStoredSessionUser());
  const [firebaseUser, setFirebaseUser] = useState<{
    email?: string;
    uid?: string;
    displayName?: string;
    emailVerified?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isResilientMode] = useState<boolean>(true);
  const [emailVerificationSent, setEmailVerificationSent] = useState<boolean>(false);

  // Evita que un signOut o cambio de sesión anónimo dispare restauraciones accidentales
  const isLoggingOutRef = useRef(false);
  // Evita carrera entre onAuthStateChanged y creación explícita de perfil (rol chofer/pasajero)
  const isManualAuthFlowRef = useRef(false);

  // Sincronización continua de Firebase Auth y sesión local
  useEffect(() => {
    let isMounted = true;

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 1400);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser: FirebaseUser | null) => {
        if (!isMounted) return;
        if (isManualAuthFlowRef.current) {
          setIsLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        // 1. Usuario real autenticado (Google o Email/Password, NO anónimo)
        if (fbUser && !fbUser.isAnonymous) {
          isLoggingOutRef.current = false;
          setFirebaseUser({
            uid: fbUser.uid,
            email: fbUser.email || undefined,
            displayName: fbUser.displayName || undefined,
            emailVerified: fbUser.emailVerified,
          });

          try {
            const fsDoc = await getUserDocument(fbUser.uid);
            if (fsDoc && isMounted) {
              const isOfficialAdmin =
                fbUser.email?.toLowerCase() === OFFICIAL_ADMIN_EMAIL && fbUser.emailVerified;
              const effectiveRol = isOfficialAdmin ? 'administrador' : fsDoc.rol || 'pasajero';
              const computedRole = mapFirestoreRolToAppRole(effectiveRol, fsDoc.esChofer);
              const mappedUser: User = {
                id: fbUser.uid,
                uid: fbUser.uid,
                name: fsDoc.nombre || fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                nombre: fsDoc.nombre || fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuario UPPA',
                email: fbUser.email || fsDoc.email || '',
                role: computedRole,
                rol: effectiveRol,
                esChofer: Boolean(fsDoc.esChofer),
                tipoVehiculo: fsDoc.tipoVehiculo ?? null,
                phone: fsDoc.phone || '',
                barrio: fsDoc.barrio || 'Campana Centro',
                avatarUrl:
                  fsDoc.avatarUrl ||
                  fbUser.photoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}&backgroundColor=12141c`,
                emailVerificado: Boolean(fbUser.emailVerified || fsDoc.emailVerificado),
                estado: fsDoc.estado || 'activo',
                fechaRegistro: fsDoc.fechaRegistro || new Date().toISOString(),
              };

              setUser(mappedUser);
              saveStoredSessionUser(mappedUser);
            } else if (isMounted) {
              const stored = readStoredSessionUser();
              const isMatchingStored =
                stored &&
                stored.email &&
                fbUser.email &&
                stored.email.toLowerCase() === fbUser.email.toLowerCase();
              const isOfficialAdmin =
                fbUser.email?.toLowerCase() === OFFICIAL_ADMIN_EMAIL && fbUser.emailVerified;
              const defaultRol = isOfficialAdmin
                ? 'administrador'
                : (isMatchingStored ? stored.rol : undefined) || 'pasajero';
              const isChofer = Boolean(
                isMatchingStored &&
                  (stored.esChofer ||
                    defaultRol === 'chofer_moto' ||
                    defaultRol === 'chofer_auto' ||
                    defaultRol === 'chofer_micro')
              );

              const defaultUser: User = {
                id: fbUser.uid,
                uid: fbUser.uid,
                name:
                  fbUser.displayName ||
                  (isMatchingStored ? stored.nombre || stored.name : '') ||
                  fbUser.email?.split('@')[0] ||
                  'Usuario UPPA',
                nombre:
                  fbUser.displayName ||
                  (isMatchingStored ? stored.nombre || stored.name : '') ||
                  fbUser.email?.split('@')[0] ||
                  'Usuario UPPA',
                email: fbUser.email || '',
                role: mapFirestoreRolToAppRole(defaultRol, isChofer),
                rol: defaultRol,
                esChofer: isChofer,
                tipoVehiculo: isMatchingStored ? stored.tipoVehiculo ?? null : null,
                phone: isMatchingStored ? stored.phone || '' : '',
                barrio: (isMatchingStored ? stored.barrio : '') || 'Campana Centro',
                avatarUrl:
                  fbUser.photoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUser.uid}&backgroundColor=12141c`,
                emailVerificado: fbUser.emailVerified,
                estado: 'activo',
                fechaRegistro: new Date().toISOString(),
              };

              createUserDocument(fbUser.uid, {
                nombre: defaultUser.name,
                email: defaultUser.email,
                rol: defaultUser.rol || 'pasajero',
                esChofer: defaultUser.esChofer,
                tipoVehiculo: defaultUser.tipoVehiculo ?? null,
                phone: defaultUser.phone,
                barrio: defaultUser.barrio,
                emailVerificado: fbUser.emailVerified,
                estado: 'activo',
                fechaRegistro: defaultUser.fechaRegistro,
              }).catch(() => {});

              setUser(defaultUser);
              saveStoredSessionUser(defaultUser);
            }
          } catch (e) {
            console.warn('[UPPA Auth] Firestore sync warning:', e);
          }
        } else {
          // 2. Sesión anónima (para reglas Firestore) o sin sesión Firebase:
          // NUNCA auto-crear un perfil "Usuario UPPA" ni omitir el LoginPage.
          // Solo conservamos la sesión explícita si el usuario ingresó en modo resiliente.
          if (fbUser?.isAnonymous) {
            setFirebaseUser({
              uid: fbUser.uid,
              emailVerified: false,
            });
          } else {
            setFirebaseUser(null);
          }

          if (!isLoggingOutRef.current) {
            const stored = readStoredSessionUser();
            if (stored) {
              setUser(stored);
              // Si hay sesión explícita y aún no hay auth en Firebase, conectar anónimamente en background para Firestore
              if (!fbUser) {
                ensureFirebaseAuthSession().catch(() => {});
              }
            } else {
              setUser(null);
            }
          }
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

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();
    const cleanName = name.trim() || cleanEmail.split('@')[0];

    if (!EMAIL_REGEX.test(cleanEmail)) {
      const msg = 'Por favor ingresá un correo electrónico válido.';
      setAuthError(msg);
      throw new Error(msg);
    }
    if (cleanPass.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres.';
      setAuthError(msg);
      throw new Error(msg);
    }

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

    try {
      isLoggingOutRef.current = false;
      isManualAuthFlowRef.current = true;
      let fbUid = '';
      let fbVerified = false;
      let usedResilientFallback = false;

      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        fbUid = cred.user.uid;
        fbVerified = cred.user.emailVerified;
        updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
        setFirebaseUser({
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          displayName: cleanName,
          emailVerified: cred.user.emailVerified,
        });
        sendEmailVerification(cred.user).catch(() => {});
        setEmailVerificationSent(true);
      } catch (fbErr: any) {
        console.warn('Firebase Auth createUser notice:', fbErr?.code, fbErr?.message);
        if (fbErr?.code === 'auth/email-already-in-use') {
          try {
            const loginCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
            fbUid = loginCred.user.uid;
            fbVerified = loginCred.user.emailVerified;
            setFirebaseUser({
              uid: loginCred.user.uid,
              email: loginCred.user.email || cleanEmail,
              displayName: loginCred.user.displayName || cleanName,
              emailVerified: loginCred.user.emailVerified,
            });
          } catch {
            throw new Error(translateFirebaseAuthError('auth/email-already-in-use'));
          }
        } else if (isProviderUnavailableCode(fbErr?.code)) {
          usedResilientFallback = true;
        } else {
          throw new Error(translateFirebaseAuthError(fbErr?.code, fbErr?.message));
        }
      }

      const selectedRol = (requestedRole as any) || 'pasajero';

      if (usedResilientFallback) {
        // Fallback local cuando Email/Password no está habilitado en consola Firebase
        const registered = await authService.register({
          email: cleanEmail,
          password: cleanPass,
          nombre: cleanName,
          rol: selectedRol,
          phone: extraData?.phone,
          barrio: extraData?.barrio,
          tipoVehiculo,
          esChofer: isChofer,
        });
        const anonUid = (await ensureFirebaseAuthSession()) || '';
        const effectiveUid = anonUid || registered.uid || registered.id;
        const finalUser: User = {
          ...registered,
          id: effectiveUid,
          uid: effectiveUid,
          name: cleanName,
          nombre: cleanName,
          email: cleanEmail,
          role: mapFirestoreRolToAppRole(selectedRol, isChofer),
          rol: selectedRol,
          esChofer: isChofer,
          tipoVehiculo,
          phone: extraData?.phone || registered.phone || '',
          barrio: extraData?.barrio || registered.barrio || 'Campana Centro',
          emailVerificado: true,
        };

        await createUserDocument(effectiveUid, {
          nombre: cleanName,
          email: cleanEmail,
          rol: selectedRol,
          estado: 'activo',
          fechaRegistro: new Date().toISOString(),
          phone: finalUser.phone,
          barrio: finalUser.barrio,
          esChofer: isChofer,
          tipoVehiculo,
          emailVerificado: true,
        }).catch(() => {});

        setUser(finalUser);
        saveStoredSessionUser(finalUser);
        return finalUser;
      }

      // Flujo Firebase Auth real: sincronizamos en cache local sin fallar si ya existía
      await authService.syncUser({
        uid: fbUid,
        email: cleanEmail,
        nombre: cleanName,
        rol: selectedRol,
        phone: extraData?.phone,
        barrio: extraData?.barrio,
        tipoVehiculo,
        esChofer: isChofer,
        emailVerificado: fbVerified,
      });

      const finalUser: User = {
        id: fbUid,
        uid: fbUid,
        name: cleanName,
        nombre: cleanName,
        email: cleanEmail,
        role: mapFirestoreRolToAppRole(selectedRol, isChofer),
        rol: selectedRol,
        esChofer: isChofer,
        tipoVehiculo,
        phone: extraData?.phone || '',
        barrio: extraData?.barrio || 'Campana Centro',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUid}&backgroundColor=12141c`,
        estado: 'activo',
        activo: true,
        fechaRegistro: new Date().toISOString(),
        emailVerificado: fbVerified,
      };

      await createUserDocument(fbUid, {
        nombre: cleanName,
        email: cleanEmail,
        rol: selectedRol,
        estado: 'activo',
        fechaRegistro: finalUser.fechaRegistro,
        phone: finalUser.phone,
        barrio: finalUser.barrio,
        esChofer: isChofer,
        tipoVehiculo,
        emailVerificado: fbVerified,
      }).catch(() => {});

      setUser(finalUser);
      saveStoredSessionUser(finalUser);
      return finalUser;
    } catch (err: any) {
      const msg = err?.message || 'Error al registrar usuario';
      setAuthError(msg);
      throw err;
    } finally {
      isManualAuthFlowRef.current = false;
    }
  };

  const loginWithEmail = async (email: string, pass?: string): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass?.trim() || '';

    if (!EMAIL_REGEX.test(cleanEmail)) {
      const msg = 'Por favor ingresá un correo electrónico válido.';
      setAuthError(msg);
      throw new Error(msg);
    }
    if (!cleanPass) {
      const msg = 'Por favor ingresá tu contraseña.';
      setAuthError(msg);
      throw new Error(msg);
    }

    try {
      isLoggingOutRef.current = false;
      isManualAuthFlowRef.current = true;
      let fbUid = '';
      let fbDisplayName = '';
      let fbVerified = false;
      let usedResilientFallback = false;

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        fbUid = cred.user.uid;
        fbDisplayName = cred.user.displayName || '';
        fbVerified = cred.user.emailVerified;
        setFirebaseUser({
          uid: cred.user.uid,
          email: cred.user.email || cleanEmail,
          displayName: cred.user.displayName || undefined,
          emailVerified: cred.user.emailVerified,
        });
      } catch (fbErr: any) {
        console.warn('Firebase Auth signIn notice:', fbErr?.code, fbErr?.message);
        if (isProviderUnavailableCode(fbErr?.code)) {
          usedResilientFallback = true;
        } else {
          throw new Error(translateFirebaseAuthError(fbErr?.code, fbErr?.message));
        }
      }

      if (usedResilientFallback) {
        const anonUid = (await ensureFirebaseAuthSession()) || '';
        const logged = await authService.login(cleanEmail, cleanPass);
        const effectiveUid = anonUid || logged.uid || logged.id;

        try {
          const fsDoc = await getUserDocument(effectiveUid);
          if (fsDoc) {
            logged.rol = fsDoc.rol || logged.rol;
            logged.esChofer = fsDoc.esChofer ?? logged.esChofer;
            logged.tipoVehiculo = fsDoc.tipoVehiculo ?? logged.tipoVehiculo;
            logged.phone = fsDoc.phone || logged.phone;
            logged.barrio = fsDoc.barrio || logged.barrio;
            logged.name = fsDoc.nombre || logged.name;
            logged.nombre = fsDoc.nombre || logged.nombre;
          }
        } catch {}

        const finalUser: User = {
          ...logged,
          id: effectiveUid,
          uid: effectiveUid,
          name: logged.name || logged.nombre || cleanEmail.split('@')[0],
          nombre: logged.nombre || logged.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          role: mapFirestoreRolToAppRole(logged.rol, logged.esChofer),
        };
        setUser(finalUser);
        saveStoredSessionUser(finalUser);
        return finalUser;
      }

      // Firebase Auth tuvo éxito: cargamos perfil real de Firestore sin bloquear por cache local vacía en otro dispositivo
      const fsDoc = await getUserDocument(fbUid);
      const syncedLocal = await authService.syncUser({
        uid: fbUid,
        email: cleanEmail,
        nombre: fsDoc?.nombre || fbDisplayName || cleanEmail.split('@')[0],
        rol: (fsDoc?.rol as any) || undefined,
        tipoVehiculo: fsDoc?.tipoVehiculo ?? undefined,
        esChofer: fsDoc?.esChofer,
        phone: fsDoc?.phone,
        barrio: fsDoc?.barrio,
        emailVerificado: fbVerified,
      });

      const isOfficialAdmin = cleanEmail === OFFICIAL_ADMIN_EMAIL && fbVerified;
      const effectiveRol = isOfficialAdmin ? 'administrador' : fsDoc?.rol || syncedLocal?.rol || 'pasajero';
      const isChofer = Boolean(
        fsDoc?.esChofer ??
          syncedLocal?.esChofer ??
          (effectiveRol === 'chofer_moto' || effectiveRol === 'chofer_auto' || effectiveRol === 'chofer_micro')
      );
      const resolvedName =
        fsDoc?.nombre || fbDisplayName || syncedLocal?.name || cleanEmail.split('@')[0] || 'Usuario UPPA';

      if (!fsDoc) {
        createUserDocument(fbUid, {
          nombre: resolvedName,
          email: cleanEmail,
          rol: effectiveRol,
          esChofer: isChofer,
          tipoVehiculo: syncedLocal?.tipoVehiculo ?? null,
          phone: syncedLocal?.phone || '',
          barrio: syncedLocal?.barrio || 'Campana Centro',
          emailVerificado: fbVerified,
          estado: 'activo',
          fechaRegistro: new Date().toISOString(),
        }).catch(() => {});
      } else if (fbVerified && !fsDoc.emailVerificado) {
        marcarEmailVerificadoEnFirestore(fbUid).catch(() => {});
      }

      const finalUser: User = {
        id: fbUid,
        uid: fbUid,
        name: resolvedName,
        nombre: resolvedName,
        email: cleanEmail,
        role: mapFirestoreRolToAppRole(effectiveRol, isChofer),
        rol: effectiveRol,
        esChofer: isChofer,
        tipoVehiculo: fsDoc?.tipoVehiculo ?? syncedLocal?.tipoVehiculo ?? null,
        phone: fsDoc?.phone || syncedLocal?.phone || '',
        barrio: fsDoc?.barrio || syncedLocal?.barrio || 'Campana Centro',
        avatarUrl:
          fsDoc?.avatarUrl ||
          syncedLocal?.avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${fbUid}&backgroundColor=12141c`,
        estado: fsDoc?.estado || 'activo',
        activo: true,
        fechaRegistro: fsDoc?.fechaRegistro || syncedLocal?.fechaRegistro || new Date().toISOString(),
        emailVerificado: Boolean(fbVerified || fsDoc?.emailVerificado),
      };

      setUser(finalUser);
      saveStoredSessionUser(finalUser);
      return finalUser;
    } catch (err: any) {
      const msg = err?.message || 'Error al iniciar sesión';
      setAuthError(msg);
      throw err;
    } finally {
      isManualAuthFlowRef.current = false;
    }
  };

  const loginWithGoogle = async (credential?: string, email?: string, name?: string): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);

    try {
      isLoggingOutRef.current = false;
      isManualAuthFlowRef.current = true;
      let fbUid = '';
      let fbEmail = email?.trim().toLowerCase();
      let fbName = name?.trim();
      let fbPhoto = '';
      let isRealGooglePopup = false;

      if (!fbEmail) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
          const cred = await signInWithPopup(auth, provider);
          isRealGooglePopup = true;
          fbUid = cred.user.uid;
          fbEmail = (cred.user.email || '').trim().toLowerCase();
          fbName = cred.user.displayName || fbEmail.split('@')[0];
          fbPhoto = cred.user.photoURL || '';
          setFirebaseUser({
            uid: cred.user.uid,
            email: cred.user.email || undefined,
            displayName: cred.user.displayName || undefined,
            emailVerified: cred.user.emailVerified,
          });
        } catch (popupErr: any) {
          console.warn('Google Popup result:', popupErr?.code || popupErr?.message);
          if (
            popupErr?.code === 'auth/popup-closed-by-user' ||
            popupErr?.code === 'auth/cancelled-popup-request'
          ) {
            throw new Error('Inicio de sesión cancelado.');
          }
          if (
            popupErr?.code === 'auth/popup-blocked' ||
            popupErr?.code === 'auth/unauthorized-domain' ||
            popupErr?.code === 'auth/operation-not-allowed' ||
            popupErr?.code === 'auth/web-storage-unsupported' ||
            popupErr?.code === 'auth/internal-error' ||
            popupErr?.message?.toLowerCase().includes('popup') ||
            popupErr?.message?.toLowerCase().includes('blocked')
          ) {
            throw new Error(`popup-blocked (${popupErr?.code || 'iframe'}): La ventana emergente fue bloqueada por el navegador.`);
          }
          if (popupErr?.code) {
            throw new Error(translateFirebaseAuthError(popupErr.code, popupErr.message));
          }
          throw new Error(popupErr?.message || 'No se pudo conectar con la cuenta de Google seleccionada.');
        }
      }

      if (!fbEmail || !EMAIL_REGEX.test(fbEmail)) {
        throw new Error('Por favor ingresá o seleccioná una cuenta de Google válida.');
      }

      // Si vino del modo fallback manual/guardado, asegurar sesión Firebase anónima para habilitar Firestore
      if (!fbUid) {
        fbUid = (await ensureFirebaseAuthSession()) || '';
      }

      const logged = await authService.googleLogin(credential, fbEmail, fbName);
      const effectiveUid = fbUid || logged.uid || logged.id;

      // Leer primero Firestore para NO sobrescribir rol/vehículo/barrio de un usuario ya registrado
      const existingFsDoc = effectiveUid ? await getUserDocument(effectiveUid) : null;

      const isOfficialAdmin = fbEmail === OFFICIAL_ADMIN_EMAIL && isRealGooglePopup;
      const effectiveRol = isOfficialAdmin
        ? 'administrador'
        : existingFsDoc?.rol || logged.rol || 'pasajero';
      const isChofer = Boolean(
        existingFsDoc?.esChofer ??
          logged.esChofer ??
          (effectiveRol === 'chofer_moto' || effectiveRol === 'chofer_auto' || effectiveRol === 'chofer_micro')
      );
      const resolvedName = existingFsDoc?.nombre || fbName || logged.name || fbEmail.split('@')[0] || 'Usuario Google';

      try {
        if (!existingFsDoc) {
          await createUserDocument(effectiveUid, {
            nombre: resolvedName,
            email: fbEmail,
            rol: effectiveRol,
            estado: 'activo',
            fechaRegistro: logged.fechaRegistro || new Date().toISOString(),
            esChofer: isChofer,
            tipoVehiculo: logged.tipoVehiculo ?? null,
            avatarUrl: fbPhoto || logged.avatarUrl,
            emailVerificado: true,
          });
        } else {
          await updateUserDocument(effectiveUid, {
            emailVerificado: true,
            ...(fbPhoto && !existingFsDoc.avatarUrl ? { avatarUrl: fbPhoto } : {}),
          });
        }
      } catch {}

      await authService.syncUser({
        uid: effectiveUid,
        email: fbEmail,
        nombre: resolvedName,
        rol: effectiveRol as any,
        esChofer: isChofer,
        tipoVehiculo: existingFsDoc?.tipoVehiculo ?? logged.tipoVehiculo ?? null,
        phone: existingFsDoc?.phone || logged.phone,
        barrio: existingFsDoc?.barrio || logged.barrio,
        emailVerificado: true,
      });

      const finalUser: User = {
        ...logged,
        id: effectiveUid,
        uid: effectiveUid,
        name: resolvedName,
        nombre: resolvedName,
        email: fbEmail,
        role: mapFirestoreRolToAppRole(effectiveRol, isChofer),
        rol: effectiveRol,
        esChofer: isChofer,
        tipoVehiculo: existingFsDoc?.tipoVehiculo ?? logged.tipoVehiculo ?? null,
        phone: existingFsDoc?.phone || logged.phone || '',
        barrio: existingFsDoc?.barrio || logged.barrio || 'Campana Centro',
        avatarUrl: fbPhoto || existingFsDoc?.avatarUrl || logged.avatarUrl,
        emailVerificado: true,
        estado: existingFsDoc?.estado || 'activo',
        fechaRegistro: existingFsDoc?.fechaRegistro || logged.fechaRegistro || new Date().toISOString(),
      };

      setUser(finalUser);
      saveStoredSessionUser(finalUser);
      return finalUser;
    } catch (err: any) {
      const msg = err?.message || 'Error al ingresar con Google';
      setAuthError(msg);
      throw err;
    } finally {
      isManualAuthFlowRef.current = false;
    }
  };

  const logout = async (): Promise<void> => {
    isLoggingOutRef.current = true;
    try {
      await signOut(auth);
    } catch {}
    try {
      await authService.logout();
    } catch {}
    setUser(null);
    setFirebaseUser(null);
    setAuthError(null);
    setAuthNotice(null);
    setEmailVerificationSent(false);
    saveStoredSessionUser(null);
    try {
      localStorage.removeItem('uppa_session_token');
    } catch {}
  };

  const resetPassword = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      throw new Error('Por favor ingresá un correo electrónico válido.');
    }

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      await authService.resetPassword(cleanEmail).catch(() => {});
    } catch (err: any) {
      if (isProviderUnavailableCode(err?.code)) {
        await authService.resetPassword(cleanEmail);
        return;
      }
      throw new Error(translateFirebaseAuthError(err?.code, 'No se pudo enviar el correo de recuperación.'));
    }
  };

  const sendVerificationEmail = async (): Promise<boolean> => {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      try {
        await sendEmailVerification(auth.currentUser);
      } catch (err: any) {
        if (err?.code === 'auth/too-many-requests') {
          throw new Error('Ya enviamos un correo recientemente. Esperá un momento antes de reenviar.');
        }
        throw new Error(translateFirebaseAuthError(err?.code, 'No se pudo enviar el correo de verificación.'));
      }
    }
    setEmailVerificationSent(true);
    setAuthNotice('Correo de verificación enviado por Firebase.');
    return true;
  };

  const reloadAuthUser = async (): Promise<boolean> => {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      await auth.currentUser.reload();
      const verified = Boolean(auth.currentUser.emailVerified);
      setFirebaseUser({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || undefined,
        displayName: auth.currentUser.displayName || undefined,
        emailVerified: verified,
      });

      if (verified) {
        await marcarEmailVerificadoEnFirestore(auth.currentUser.uid).catch(() => {});
        if (user) {
          const updatedUser = { ...user, emailVerificado: true };
          setUser(updatedUser);
          saveStoredSessionUser(updatedUser);
        }
      }
      return verified;
    }

    const updated = await authService.getCurrentUser();
    if (updated) {
      setUser(updated);
      saveStoredSessionUser(updated);
      return Boolean(updated.emailVerificado);
    }
    return Boolean(user?.emailVerificado);
  };

  const updateProfileData = async (data: Partial<User>): Promise<void> => {
    if (!user?.id && !user?.uid) return;
    const targetFirestoreUid =
      (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null) ||
      auth.currentUser?.uid ||
      user.uid ||
      user.id;

    await authService.updateProfile(user.id || targetFirestoreUid, data).catch(() => {});
    if (targetFirestoreUid) {
      await updateUserDocument(targetFirestoreUid, {
        nombre: data.name || data.nombre,
        phone: data.phone || data.telefono,
        barrio: data.barrio,
        rol: data.rol || data.role,
      }).catch(() => {});
    }

    const merged: User = { ...user, ...data };
    setUser(merged);
    saveStoredSessionUser(merged);
  };

  const isAuthenticated = Boolean(user);
  const isAdmin = user?.role === 'admin' || user?.rol === 'administrador';
  const isEmailVerified =
    (firebaseUser && firebaseUser.email
      ? Boolean(firebaseUser.emailVerified)
      : undefined) ?? (user?.emailVerificado ?? true);

  const effectiveFirebaseUser =
    firebaseUser?.email
      ? firebaseUser
      : user
      ? {
          uid: user.uid || user.id,
          email: user.email,
          displayName: user.name,
          emailVerified: isEmailVerified,
        }
      : null;

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
