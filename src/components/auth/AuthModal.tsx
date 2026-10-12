import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { updateUserDocument } from '../../services/firestoreService';
import { ResetPasswordModal } from './ResetPasswordModal';
import {
  X,
  Mail,
  User as UserIcon,
  Check,
  Shield,
  KeyRound,
  Database,
  Calendar,
  Sparkles,
  Phone,
  MapPin,
  RefreshCw,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updated: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
}) => {
  const { user: authUser, updateProfileData } = useAuth();

  const [name, setName] = useState(currentUser.name);
  const [barrio, setBarrio] = useState(currentUser.barrio || 'Barrio Malvinas, Campana');
  const [phone, setPhone] = useState(currentUser.phone || '+54 9 3487 55-2190');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentUid = currentUser.uid || authUser?.uid || currentUser.id;
  const currentRol = currentUser.rol || authUser?.rol || (currentUser.role === 'admin' ? 'administrador' : 'cliente');
  const currentEstado = currentUser.estado || authUser?.estado || 'activo';
  const currentFecha = currentUser.fechaRegistro || authUser?.fechaRegistro || 'Reciente';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      if (currentUid) {
        await updateUserDocument(currentUid, {
          nombre: name.trim(),
          barrio: barrio.trim(),
          phone: phone.trim(),
        });
      }
      if (updateProfileData) {
        await updateProfileData({
          nombre: name.trim(),
          barrio: barrio.trim(),
          phone: phone.trim(),
        });
      }

      onUpdateUser({
        ...currentUser,
        name: name.trim(),
        barrio: barrio.trim(),
        phone: phone.trim(),
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving profile:', err);
      setIsSaving(false);
      onUpdateUser({
        ...currentUser,
        name: name.trim(),
        barrio: barrio.trim(),
        phone: phone.trim(),
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0c0f17] border border-slate-700/80 rounded-3xl shadow-2xl p-6 text-slate-100 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="font-display tracking-tight text-lg">UPPA</span> · Perfil de Usuario
            </h2>
            <p className="text-xs text-slate-400 font-mono">Firestore: users/{currentUid.slice(0, 8)}...</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card Info with UID, Rol, Estado */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-mono text-[11px]">UID Firebase:</span>
            <span className="font-mono text-sky-300 font-bold text-[11px] truncate max-w-[200px]">
              {currentUid}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Rol del Usuario:</span>
            <span
              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                currentRol === 'administrador'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : 'bg-sky-950 text-sky-300 border border-sky-700'
              }`}
            >
              {currentRol}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Estado de Cuenta:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px] uppercase">
              {currentEstado}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Fecha de Registro:</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {typeof currentFecha === 'string' && currentFecha.includes('T')
                ? currentFecha.split('T')[0]
                : currentFecha}
            </span>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-medium">
            ¡Perfil actualizado en Cloud Firestore users/{'{uid}'}!
          </div>
        )}

        <form onSubmit={handleSave} className="pt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre completo</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email (Autenticado)</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full bg-[#121520]/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Barrio o localidad</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={barrio}
                  onChange={(e) => setBarrio(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-8 pr-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-8 pr-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Seguridad de contraseña */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <KeyRound className="w-4 h-4 text-sky-400" />
              <span>Contraseña de acceso</span>
            </div>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold cursor-pointer"
            >
              Cambiar / Recuperar
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Guardar Cambios en Firestore</span>
              </>
            )}
          </button>
        </form>

        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          initialEmail={currentUser.email}
        />
      </div>
    </div>
  );
};
