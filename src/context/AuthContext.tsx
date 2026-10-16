import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, mapRoleToAppRole } from '../types';
import { authService, RegisterPayload } from '../services/authService';
import { getStoredSessionToken } from '../services/api';

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

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isResilientMode, setIsResilientMode] = useState<boolean>(true);
  const [emailVerificationSent, setEmailVerificationSent] = useState<boolean>(false);

  useEffect(() => {
    const initSession = async () => {
      try {
        const token = getStoredSessionToken();
        if (token) {
          const apiUser = await authService.getCurrentUser();
          if (apiUser) {
            setUser(apiUser);
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(apiUser));
          }
        }
      } catch (err) {
        console.warn('[UPPA Auth] Session check notice:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
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
    try {
      const isChofer =
        extraData?.esChofer ||
        requestedRole === 'chofer_moto' ||
        requestedRole === 'chofer_auto' ||
        requestedRole === 'chofer_micro';

      const tipoVehiculo =
        extraData?.tipoVehiculo ||
        (requestedRole === 'chofer_moto'
          ? 'moto'
          : requestedRole === 'chofer_auto'
          ? 'auto'
          : requestedRole === 'chofer_micro'
          ? 'micro'
          : null);

      const registered = await authService.register({
        email,
        password: pass,
        nombre: name,
        rol: (requestedRole as any) || 'pasajero',
        phone: extraData?.phone,
        barrio: extraData?.barrio,
        tipoVehiculo,
        esChofer: isChofer,
      });

      setUser(registered);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(registered));
      setEmailVerificationSent(true);
      return registered;
    } catch (err: any) {
      const msg = err.message || 'Error al registrar usuario';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass?: string): Promise<User> => {
    setAuthError(null);
    setAuthNotice(null);
    try {
      const logged = await authService.login(email, pass);
      setUser(logged);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(logged));
      return logged;
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
      const logged = await authService.googleLogin(credential, email, name);
      setUser(logged);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(logged));
      return logged;
    } catch (err: any) {
      const msg = err.message || 'Error al ingresar con Google';
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
    try {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } catch {}
  };

  const resetPassword = async (email: string): Promise<void> => {
    await authService.resetPassword(email);
  };

  const sendVerificationEmail = async (): Promise<boolean> => {
    setEmailVerificationSent(true);
    setAuthNotice('Correo de verificación enviado a tu casilla.');
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
      const merged = { ...user, ...data };
      setUser(merged);
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(merged));
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.rol === 'administrador';
  const isEmailVerified = user?.emailVerificado ?? true;

  const firebaseUserMock = user
    ? {
        uid: user.id || user.uid,
        email: user.email,
        displayName: user.name,
        emailVerified: isEmailVerified,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: firebaseUserMock,
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
