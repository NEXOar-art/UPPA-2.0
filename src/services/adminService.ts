import { apiRequest } from './api';
import { ApiUserRecord, ApiAuditoriaRecord, ApiAdminAlertaRecord } from '../types/api';
import { UsuarioFirestore } from '../types';

export const adminService = {
  async verifyAdminPin(pin: string): Promise<boolean> {
    const res = await apiRequest<{ verified: boolean }>('verifyAdminPin', {
      method: 'POST',
      body: { pin },
    });
    return !!res.ok && !!res.data?.verified;
  },

  async getUsers(): Promise<UsuarioFirestore[]> {
    const res = await apiRequest<ApiUserRecord[]>('getUsers', { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map((u) => ({
        uid: u.uid,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol as any,
        esChofer: u.esChofer,
        tipoVehiculo: u.tipoVehiculo,
        activo: u.activo,
        telefono: u.telefono,
        barrio: u.barrio,
        avatarUrl: u.avatarUrl,
        fechaRegistro: u.fechaRegistro,
      }));
    }
    return [];
  },

  async updateUserRole(uid: string, rol: string): Promise<void> {
    await apiRequest('updateUser', {
      method: 'POST',
      body: { uid, partial: { rol } },
    });
  },

  async updateUserStatus(uid: string, activo: boolean): Promise<void> {
    await apiRequest('updateUser', {
      method: 'POST',
      body: { uid, partial: { activo } },
    });
  },

  async deleteUser(uid: string): Promise<void> {
    await apiRequest('deleteUser', {
      method: 'POST',
      body: { uid },
    });
  },

  async generateCode(tipo: 'moto' | 'auto', horas = 12): Promise<string> {
    const res = await apiRequest<{ codigo: string }>('createActivationCode', {
      method: 'POST',
      body: { tipo, horas },
    });
    if (res.ok && res.data?.codigo) {
      return res.data.codigo;
    }
    return `UPPA-${tipo === 'moto' ? 'MOTO' : 'TX'}-${Math.floor(1000 + Math.random() * 9000)}`;
  },

  async broadcastAlert(titulo: string, descripcion: string, nivel: 'informativa' | 'urgente' | 'critica' = 'urgente'): Promise<void> {
    await apiRequest('broadcastAdminAlert', {
      method: 'POST',
      body: { titulo, descripcion, nivel },
    });
  },

  async getAuditLogs(): Promise<ApiAuditoriaRecord[]> {
    const res = await apiRequest<ApiAuditoriaRecord[]>('getAuditLogs', { method: 'GET' });
    if (res.ok && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },
};
