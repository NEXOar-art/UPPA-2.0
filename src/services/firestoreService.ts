import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';

// -------------------------------------------------------------
// USER TYPES & FIRESTORE COLLECTION: users/{uid}
// -------------------------------------------------------------
export interface UserProfile {
  uid: string;
  nombre: string;
  email: string;
  rol: 'cliente' | 'administrador' | string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  fechaRegistro: string;
  phone?: string;
  barrio?: string;
  avatarUrl?: string;
  emailVerificado?: boolean;
  esChofer?: boolean;
  tipoVehiculo?: 'moto' | 'auto' | 'micro' | null;
}

export const USERS_COLLECTION = 'users';
export const USUARIOS_COLLECTION = 'usuarios';

export async function getUserDocument(uid: string): Promise<UserProfile | null> {
  const path = `${USUARIOS_COLLECTION}/${uid}`;
  try {
    // Check 'usuarios' collection first (UPPA v2 schema)
    const docRefU = doc(db, USUARIOS_COLLECTION, uid);
    const snapU = await getDoc(docRefU);
    if (snapU.exists()) {
      const data = snapU.data();
      return {
        uid,
        nombre: data.nombre,
        email: data.email,
        rol: data.rol || 'cliente',
        estado: data.activo === false ? 'suspendido' : 'activo',
        fechaRegistro: typeof data.fechaRegistro === 'string' ? data.fechaRegistro : new Date().toISOString(),
        phone: data.telefono || data.phone || '',
        barrio: data.barrio || 'Zárate ↔ Campana',
        avatarUrl: data.fotoPerfil || data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
        emailVerificado: data.emailVerificado ?? false,
        esChofer: data.esChofer ?? false,
        tipoVehiculo: data.tipoVehiculo || null,
      } as UserProfile;
    }

    // Fallback to legacy 'users' collection
    const docRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    console.warn(`getUserDocument Firestore notice on ${path}:`, error);
    return null;
  }
}

export async function createUserDocument(
  uid: string,
  data: Omit<UserProfile, 'uid'> & {
    esChofer?: boolean;
    tipoVehiculo?: string | null;
    emailVerificado?: boolean;
    telefono?: string;
  }
): Promise<UserProfile> {
  const path = `${USUARIOS_COLLECTION}/${uid}`;
  try {
    const fullProfile: UserProfile = {
      uid,
      nombre: data.nombre,
      email: data.email,
      rol: data.rol || 'cliente',
      estado: data.estado || 'activo',
      fechaRegistro: data.fechaRegistro || new Date().toISOString(),
      phone: data.phone || data.telefono || '',
      barrio: data.barrio || 'Zárate ↔ Campana',
      avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
      emailVerificado: data.emailVerificado ?? false,
      esChofer: data.esChofer ?? false,
      tipoVehiculo: (data.tipoVehiculo as any) || null,
    };

    // Save in 'usuarios' (spec schema)
    const usuarioPayload = {
      uid,
      nombre: data.nombre,
      email: data.email,
      rol: (data.rol as any) || 'pasajero',
      esChofer: data.esChofer ?? ((data.rol as any)?.startsWith?.('chofer') || false),
      tipoVehiculo: data.tipoVehiculo ?? ((data.rol as any) === 'chofer_moto' ? 'moto' : (data.rol as any) === 'chofer_auto' ? 'auto' : (data.rol as any) === 'chofer_micro' ? 'micro' : null),
      activo: data.estado !== 'suspendido',
      emailVerificado: data.emailVerificado ?? false,
      fotoPerfil: fullProfile.avatarUrl,
      telefono: data.phone || data.telefono || '',
      barrio: data.barrio || 'Zárate ↔ Campana',
      ultimaConexion: serverTimestamp(),
      fechaRegistro: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, USUARIOS_COLLECTION, uid), usuarioPayload, { merge: true });
    } catch (e) {
      console.warn('usuarios write warning:', e);
    }

    // Also write to users for compatibility
    try {
      await setDoc(doc(db, USERS_COLLECTION, uid), fullProfile, { merge: true });
    } catch (e) {
      console.warn('users write warning:', e);
    }

    return fullProfile;
  } catch (error) {
    console.warn(`createUserDocument Firestore notice on ${path}:`, error);
    return {
      uid,
      nombre: data.nombre,
      email: data.email,
      rol: data.rol || 'pasajero',
      estado: data.estado || 'activo',
      fechaRegistro: data.fechaRegistro || new Date().toISOString(),
      phone: data.phone || data.telefono || '',
      barrio: data.barrio || 'Zárate ↔ Campana',
      avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}&backgroundColor=12141c`,
      emailVerificado: data.emailVerificado ?? false,
      esChofer: data.esChofer ?? false,
      tipoVehiculo: (data.tipoVehiculo as any) || null,
    };
  }
}

export async function updateUserDocument(
  uid: string,
  partial: Partial<Omit<UserProfile, 'uid' | 'email' | 'fechaRegistro'>>
): Promise<void> {
  const path = `${USERS_COLLECTION}/${uid}`;
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRef, { ...partial });

    // Also sync usuarios collection
    try {
      const docRefU = doc(db, USUARIOS_COLLECTION, uid);
      const uPatch: any = {};
      if (partial.nombre !== undefined) uPatch.nombre = partial.nombre;
      if (partial.phone !== undefined) uPatch.telefono = partial.phone;
      if (partial.barrio !== undefined) uPatch.barrio = partial.barrio;
      if (partial.avatarUrl !== undefined) uPatch.fotoPerfil = partial.avatarUrl;
      if (partial.emailVerificado !== undefined) uPatch.emailVerificado = partial.emailVerificado;
      if (partial.rol !== undefined) uPatch.rol = partial.rol;
      if (Object.keys(uPatch).length > 0) {
        await updateDoc(docRefU, uPatch);
      }
    } catch (errSync) {
      console.warn('Sync to usuarios collection warning:', errSync);
    }
  } catch (error) {
    console.warn(`updateUserDocument Firestore notice on ${path}:`, error);
  }
}

export async function marcarEmailVerificadoEnFirestore(uid: string): Promise<void> {
  try {
    const docRefU = doc(db, USUARIOS_COLLECTION, uid);
    await updateDoc(docRefU, { emailVerificado: true, ultimaConexion: serverTimestamp() });
    const docRefLegacy = doc(db, USERS_COLLECTION, uid);
    await updateDoc(docRefLegacy, { emailVerificado: true });
  } catch (err) {
    console.warn('Could not mark emailVerificado in Firestore:', err);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const colRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    console.warn('getAllUsers Firestore notice:', error);
    return [];
  }
}

// -------------------------------------------------------------
// PRODUCTS TYPES & FIRESTORE COLLECTION: products/{productId}
// -------------------------------------------------------------
export interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Boletos' | 'Pases' | 'Taxis' | 'Publicidad';
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export const PRODUCTS_COLLECTION = 'products';

const INITIAL_DEFAULT_PRODUCTS: Omit<ProductItem, 'id'>[] = [
  {
    name: 'Abono Mensual Corredor Línea 228 (Malvinas ↔ Zárate)',
    description: 'Pase ilimitado de 30 días para todos los ramales urbanos e interurbanos de Línea 228.',
    price: 18500,
    category: 'Pases',
    stock: 250,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: 'Pack 10 Boletos Zárate ↔ Campana Colectora',
    description: 'Tarifario promocional digital transferible para viajar por Colectora Norte y Sur.',
    price: 6500,
    category: 'Boletos',
    stock: 500,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: 'Pase Prioritario Taxi Nocturno (Seguro de viaje)',
    description: 'Cobertura de prioridad y asignación inmediata con choferes verificados UPPA de 22:00 a 06:00.',
    price: 3200,
    category: 'Taxis',
    stock: 100,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    name: 'Espacio Publicitario Destacado UPPA (Semanal)',
    description: 'Anuncio en el mapa interactivo y listados de comercios para talleres, gomerías y comercios.',
    price: 12000,
    category: 'Publicidad',
    stock: 20,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export async function getProducts(): Promise<ProductItem[]> {
  try {
    const colRef = collection(db, PRODUCTS_COLLECTION);
    const snap = await getDocs(colRef);

    if (snap.empty) {
      // Seed default products if empty so the catalog is ready to use
      const seeded: ProductItem[] = [];
      for (let i = 0; i < INITIAL_DEFAULT_PRODUCTS.length; i++) {
        const prod = INITIAL_DEFAULT_PRODUCTS[i];
        const newDocRef = doc(colRef);
        const item: ProductItem = { ...prod, id: newDocRef.id };
        try {
          await setDoc(newDocRef, item);
          seeded.push(item);
        } catch {
          // If security rules or network prevents write, keep local item
          seeded.push(item);
        }
      }
      return seeded;
    }

    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductItem, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
  }
}

export async function createProduct(product: Omit<ProductItem, 'id'>): Promise<ProductItem> {
  try {
    const colRef = collection(db, PRODUCTS_COLLECTION);
    const newDocRef = doc(colRef);
    const newProduct: ProductItem = {
      ...product,
      id: newDocRef.id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newDocRef, newProduct);
    return newProduct;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
}

export async function updateProduct(id: string, partial: Partial<Omit<ProductItem, 'id'>>): Promise<void> {
  const path = `${PRODUCTS_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, { ...partial });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const path = `${PRODUCTS_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// ORDERS TYPES & FIRESTORE COLLECTION: orders/{orderId}
// -------------------------------------------------------------
export interface OrderItemDetail {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  items: OrderItemDetail[];
  total: number;
  status: 'pendiente' | 'completado' | 'cancelado';
  createdAt: string;
  notes?: string;
}

export const ORDERS_COLLECTION = 'orders';

export async function createOrder(
  data: Omit<OrderRecord, 'id' | 'createdAt'>
): Promise<OrderRecord> {
  try {
    const colRef = collection(db, ORDERS_COLLECTION);
    const newDocRef = doc(colRef);
    const newOrder: OrderRecord = {
      ...data,
      id: newDocRef.id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newDocRef, newOrder);
    return newOrder;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ORDERS_COLLECTION);
  }
}

export async function getUserOrders(userId: string): Promise<OrderRecord[]> {
  try {
    const colRef = collection(db, ORDERS_COLLECTION);
    const q = query(colRef, where('userId', '==', userId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${ORDERS_COLLECTION}?userId=${userId}`);
  }
}

export async function getAllOrders(): Promise<OrderRecord[]> {
  try {
    const colRef = collection(db, ORDERS_COLLECTION);
    const snap = await getDocs(colRef);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRecord, 'id'>) }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ORDERS_COLLECTION);
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: 'pendiente' | 'completado' | 'cancelado'
): Promise<void> {
  const path = `${ORDERS_COLLECTION}/${orderId}`;
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
