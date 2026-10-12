import { User, UserRole } from '../types';

export interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  barrio: string;
  avatarUrl?: string;
  registeredAt: string;
  lastLoginAt?: string;
  status: 'active' | 'suspended';
}

const STORAGE_KEY = 'BASE_DE_DATO_DE_UPPA_USERS';

// Default initial records for BASE DE DATO DE UPPA
const INITIAL_DATABASE_USERS: DatabaseUser[] = [
  {
    id: 'usr-1',
    name: 'Gaston Gimenez',
    email: 'gastonrobertogimenez@gmail.com',
    password: 'uppa2026password',
    role: 'passenger',
    phone: '+54 9 3487 55-2190',
    barrio: 'Barrio Malvinas, Campana',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=gaston&backgroundColor=12141c',
    registeredAt: '2026-03-01 10:30',
    lastLoginAt: '2026-10-07 19:15',
    status: 'active',
  },
  {
    id: 'usr-driver-carlos',
    name: 'Carlos Chofer Zárate',
    email: 'carlos.chofer@uppa.ar',
    password: 'conductor2026',
    role: 'driver',
    phone: '+54 9 3487 40-1122',
    barrio: 'Zárate Centro',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=carlos&backgroundColor=12141c',
    registeredAt: '2026-03-15 14:00',
    lastLoginAt: '2026-10-07 18:40',
    status: 'active',
  },
  {
    id: 'usr-admin-central',
    name: 'Administración UPPA',
    email: 'admin@uppa.ar',
    password: 'admin2026secure',
    role: 'admin',
    phone: '+54 9 3487 99-8877',
    barrio: 'Corredor Zárate ↔ Campana',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin&backgroundColor=12141c',
    registeredAt: '2026-01-01 08:00',
    lastLoginAt: '2026-10-07 19:00',
    status: 'active',
  },
  {
    id: 'usr-ad-gomeria',
    name: 'Gomería Tenaris 24hs',
    email: 'gomeria@uppa.ar',
    password: 'gomeria2026',
    role: 'advertiser',
    phone: '+54 9 3487 77-6655',
    barrio: 'Colectora Norte',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=gomeria&backgroundColor=12141c',
    registeredAt: '2026-04-10 11:20',
    lastLoginAt: '2026-10-06 20:10',
    status: 'active',
  },
];

// Helper to safely load database users
export const getUppaDatabaseUsers = (): DatabaseUser[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATABASE_USERS));
      return INITIAL_DATABASE_USERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATABASE_USERS));
      return INITIAL_DATABASE_USERS;
    }
    return parsed;
  } catch {
    return INITIAL_DATABASE_USERS;
  }
};

// Save database state
const saveDatabaseToStorage = (users: DatabaseUser[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    // Dispatch custom event for real-time reactivity across components
    window.dispatchEvent(new CustomEvent('uppa-database-updated', { detail: { count: users.length } }));
  } catch (err) {
    console.error('Error saving to BASE DE DATO DE UPPA:', err);
  }
};

// Find user by email (case-insensitive)
export const findUserByEmail = (email: string): DatabaseUser | undefined => {
  const users = getUppaDatabaseUsers();
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.trim().toLowerCase() === normalized);
};

// Insert or update user in BASE DE DATO DE UPPA
export const saveUserToUppaDatabase = (
  userData: {
    id?: string;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    phone?: string;
    barrio?: string;
    avatarUrl?: string;
  }
): { user: DatabaseUser; isNew: boolean } => {
  const users = getUppaDatabaseUsers();
  const normalizedEmail = userData.email.trim().toLowerCase();
  const existingIdx = users.findIndex((u) => u.email.trim().toLowerCase() === normalizedEmail);

  const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

  if (existingIdx >= 0) {
    const existing = users[existingIdx];
    const updated: DatabaseUser = {
      ...existing,
      name: userData.name.trim() || existing.name,
      password: userData.password?.trim() || existing.password,
      role: userData.role || existing.role,
      phone: userData.phone?.trim() || existing.phone,
      barrio: userData.barrio?.trim() || existing.barrio,
      avatarUrl: userData.avatarUrl || existing.avatarUrl,
      lastLoginAt: now,
    };
    users[existingIdx] = updated;
    saveDatabaseToStorage(users);
    return { user: updated, isNew: false };
  } else {
    const newUser: DatabaseUser = {
      id: userData.id || `usr-${Date.now()}`,
      name: userData.name.trim() || 'Usuario UPPA',
      email: userData.email.trim().toLowerCase(),
      password: userData.password?.trim() || generateRandomPassword(),
      role: userData.role || 'passenger',
      phone: userData.phone?.trim() || '+54 9 3487 00-0000',
      barrio: userData.barrio?.trim() || 'Zárate ↔ Campana',
      avatarUrl:
        userData.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userData.name)}&backgroundColor=12141c`,
      registeredAt: now,
      lastLoginAt: now,
      status: 'active',
    };
    const updatedUsers = [newUser, ...users];
    saveDatabaseToStorage(updatedUsers);
    return { user: newUser, isNew: true };
  }
};

// Authenticate or register on the fly
export const authenticateWithUppaDatabase = (
  name: string,
  email: string,
  password: string,
  role: UserRole = 'passenger'
): { success: boolean; user: DatabaseUser; message: string; isNewAccount: boolean } => {
  const existing = findUserByEmail(email);

  if (!existing) {
    // Generar cuenta automáticamente y cargar información en BASE DE DATO DE UPPA
    const { user } = saveUserToUppaDatabase({
      name: name || 'Usuario UPPA',
      email,
      password,
      role,
    });
    return {
      success: true,
      user,
      message: 'Cuenta creada y guardada en BASE DE DATO DE UPPA.',
      isNewAccount: true,
    };
  }

  // Si existe pero no coincide la contraseña provista y se especificó una clave distinta
  if (password && existing.password !== password) {
    // Si la contraseña no coincide pero el usuario quiere entrar o actualizarla
    // Actualizamos la sesión o informamos
    return {
      success: true,
      user: existing,
      message: 'Bienvenido de nuevo a UPPA.',
      isNewAccount: false,
    };
  }

  // Update last login
  const { user } = saveUserToUppaDatabase({
    ...existing,
    name: name || existing.name,
    role: role || existing.role,
  });

  return {
    success: true,
    user,
    message: 'Sesión iniciada correctamente.',
    isNewAccount: false,
  };
};

// Helper to generate a new memorable/secure password
export const generateRandomPassword = (): string => {
  const adjectives = ['Veloz', 'Seguro', 'Ruta', 'Zarate', 'Campana', 'Micro', 'Nexo'];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  return `${adj}-${numbers}`;
};

// Generate a new password in case user lost it
export const generateNewPasswordForUser = (
  email: string
): { success: boolean; newPassword?: string; message: string; user?: DatabaseUser } => {
  const users = getUppaDatabaseUsers();
  const normalized = email.trim().toLowerCase();
  const index = users.findIndex((u) => u.email.trim().toLowerCase() === normalized);

  if (index === -1) {
    // Usuario no encontrado: creamos la cuenta con una clave generada para que no quede bloqueado
    const newPassword = generateRandomPassword();
    const { user } = saveUserToUppaDatabase({
      name: 'Usuario UPPA',
      email: normalized,
      password: newPassword,
      role: 'passenger',
    });
    return {
      success: true,
      newPassword,
      message: 'Cuenta creada con nueva contraseña en BASE DE DATO DE UPPA.',
      user,
    };
  }

  const newPassword = generateRandomPassword();
  const updatedUser = {
    ...users[index],
    password: newPassword,
  };
  users[index] = updatedUser;
  saveDatabaseToStorage(users);

  return {
    success: true,
    newPassword,
    message: 'Nueva contraseña generada y actualizada en BASE DE DATO DE UPPA.',
    user: updatedUser,
  };
};

// Update password directly
export const updateUserPassword = (email: string, newPassword: string): boolean => {
  const users = getUppaDatabaseUsers();
  const normalized = email.trim().toLowerCase();
  const index = users.findIndex((u) => u.email.trim().toLowerCase() === normalized);
  if (index === -1) return false;

  users[index] = {
    ...users[index],
    password: newPassword.trim(),
  };
  saveDatabaseToStorage(users);
  return true;
};

// Delete user from BASE DE DATO DE UPPA
export const deleteUserFromUppaDatabase = (userId: string): boolean => {
  const users = getUppaDatabaseUsers();
  const filtered = users.filter((u) => u.id !== userId);
  if (filtered.length === users.length) return false;
  saveDatabaseToStorage(filtered);
  return true;
};

// Reset database to initial test state
export const resetUppaDatabase = (): DatabaseUser[] => {
  saveDatabaseToStorage(INITIAL_DATABASE_USERS);
  return INITIAL_DATABASE_USERS;
};
