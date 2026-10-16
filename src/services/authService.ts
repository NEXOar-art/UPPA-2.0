import { apiRequest, setStoredSessionToken, getStoredSessionToken } from './api';
import { ApiUserRecord, ApiSessionRecord } from '../types/api';
import { User, UserRole, mapRoleToAppRole } from '../types';

export interface RegisterPayload {
  email: string;
  password?: string;
  nombre: string;
  rol: UserRole;
  phone?: string;
  barrio?: string;
  tipoVehiculo?: 'moto' | 'auto' | 'micro' | null;
  esChofer?: boolean;
}

export function formatUserFromApi(apiUser: ApiUserRecord): User {
  const computedRole = mapRoleToAppRole(apiUser.rol, apiUser.esChofer);
  return {
    id: apiUser.uid,
    uid: apiUser.uid,
    name: apiUser.nombre,
    email: apiUser.email,
    role: computedRole,
    rol: apiUser.rol,
    phone: apiUser.telefono || '',
    barrio: apiUser.barrio || 'Campana Centro',
    avatarUrl: apiUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${apiUser.uid}&backgroundColor=12141c`,
    esChofer: apiUser.esChofer,
    tipoVehiculo: apiUser.tipoVehiculo,
    activo: apiUser.activo,
    estado: apiUser.activo ? 'activo' : 'suspendido',
    fechaRegistro: apiUser.fechaRegistro,
    emailVerificado: apiUser.emailVerificado ?? true,
  };
}

export const authService = {
  async register(data: RegisterPayload): Promise<User> {
    const res = await apiRequest<{ user: ApiUserRecord; token: string }>('register', {
      method: 'POST',
      body: data,
    });

    if (!res.ok || !res.data) {
      throw new Error(res.error?.message || 'Error al registrar usuario en la base de datos');
    }

    setStoredSessionToken(res.data.token);
    return formatUserFromApi(res.data.user);
  },

  async login(email: string, password?: string): Promise<User> {
    const res = await apiRequest<{ user: ApiUserRecord; token: string }>('login', {
      method: 'POST',
      body: { email, password },
    });

    if (!res.ok || !res.data) {
      throw new Error(res.error?.message || 'Error al iniciar sesión');
    }

    setStoredSessionToken(res.data.token);
    return formatUserFromApi(res.data.user);
  },

  async googleLogin(credential?: string, email?: string, name?: string): Promise<User> {
    const res = await apiRequest<{ user: ApiUserRecord; token: string }>('googleLogin', {
      method: 'POST',
      body: { credential, email, name },
    });

    if (!res.ok || !res.data) {
      throw new Error(res.error?.message || 'Error al autenticar con Google');
    }

    setStoredSessionToken(res.data.token);
    return formatUserFromApi(res.data.user);
  },

  async getCurrentUser(): Promise<User | null> {
    const token = getStoredSessionToken();
    if (!token) return null;

    const res = await apiRequest<ApiUserRecord>('me', {
      method: 'GET',
      token,
    });

    if (res.ok && res.data) {
      return formatUserFromApi(res.data);
    }
    return null;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest('logout', { method: 'POST' });
    } catch {}
    setStoredSessionToken(null);
  },

  async resetPassword(email: string): Promise<boolean> {
    const res = await apiRequest('resetPassword', {
      method: 'POST',
      body: { email },
    });
    return res.ok;
  },

  async updateProfile(uid: string, partial: Partial<User>): Promise<void> {
    await apiRequest('updateUser', {
      method: 'POST',
      body: {
        uid,
        partial: {
          nombre: partial.name,
          telefono: partial.phone,
          barrio: partial.barrio,
          rol: partial.rol || partial.role,
          tipoVehiculo: partial.tipoVehiculo,
        },
      },
    });
  },
};
