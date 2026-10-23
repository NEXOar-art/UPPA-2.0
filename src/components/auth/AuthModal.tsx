import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
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
  Sparkles,
  Phone,
  MapPin,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Send,
  Bike,
  Car,
  LogOut,
  ArrowRight,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updated: User) => void;
  defaultMode?: 'register' | 'login' | 'profile';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  defaultMode,
}) => {
  const {
    user: authUser,
    firebaseUser,
    isAuthenticated,
    isEmailVerified,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    logout,
    sendVerificationEmail,
    reloadAuthUser,
    updateProfileData,
    authError,
    setAuthError,
    authNotice,
    isResilientMode,
  } = useAuth();

  // Mode: 'register' (hacerse perfil) | 'login' | 'profile' (ver/editar)
  const [mode, setMode] = useState<'register' | 'login' | 'profile'>('register');

  // Form states for Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarrio, setRegBarrio] = useState('');
  const [regRole, setRegRole] = useState<'pasajero' | 'chofer_moto' | 'chofer_auto'>('pasajero');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Form states for Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states for Editing Profile
  const [editName, setEditName] = useState('');
  const [editBarrio, setEditBarrio] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSentNotice, setVerificationSentNotice] = useState<string | null>(null);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Synchronize state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setAuthError(null);
    setSuccessMessage(null);
    setVerificationSentNotice(null);
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegPhone('');
    setRegBarrio('');
    setLoginEmail('');
    setLoginPassword('');

    if (defaultMode) {
      setMode(defaultMode);
    } else if (isAuthenticated && authUser) {
      setMode('profile');
    } else {
      setMode('register');
    }

    if (authUser) {
      setEditName(authUser.nombre || currentUser.name || '');
      setEditBarrio(authUser.barrio || currentUser.barrio || '');
      setEditPhone(authUser.phone || currentUser.phone || '');
    } else {
      setEditName('');
      setEditBarrio('');
      setEditPhone('');
    }
  }, [isOpen, isAuthenticated, authUser, defaultMode]);

  if (!isOpen) return null;

  const currentUid = authUser?.uid || currentUser?.uid || currentUser?.id || '';
  const currentRol = authUser?.rol || currentUser?.rol || (currentUser?.role === 'admin' ? 'administrador' : 'pasajero');
  const currentEstado = authUser?.estado || currentUser?.estado || 'activo';
  const currentFecha = authUser?.fechaRegistro || currentUser?.fechaRegistro || 'Reciente';

  // Handler: Crear nuevo perfil en Firebase y disparar email de verificación
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);
    setVerificationSentNotice(null);

    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPassword = regPassword.trim();
    const cleanName = regName.trim();

    if (!cleanName) {
      setAuthError('Por favor ingresá tu nombre completo.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('Por favor ingresá un correo electrónico válido.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isChofer = regRole === 'chofer_moto' || regRole === 'chofer_auto';
      const tipoVehiculo = regRole === 'chofer_moto' ? 'moto' : regRole === 'chofer_auto' ? 'auto' : null;

      const profile = await registerWithEmail(
        cleanEmail,
        cleanPassword,
        cleanName,
        regRole,
        {
          phone: regPhone.trim(),
          barrio: regBarrio.trim(),
          esChofer: isChofer,
          tipoVehiculo: tipoVehiculo,
        }
      );

      // Actualizar el estado del usuario en la app
      onUpdateUser({
        ...currentUser,
        id: profile.uid || profile.id || currentUser.id,
        uid: profile.uid || profile.id || currentUser.uid,
        name: profile.nombre || profile.name || currentUser.name,
        nombre: profile.nombre || profile.name || currentUser.nombre,
        email: profile.email,
        role: isChofer ? 'driver' : 'passenger',
        rol: profile.rol as any,
        esChofer: isChofer,
        tipoVehiculo: tipoVehiculo,
        phone: profile.phone,
        barrio: profile.barrio,
        emailVerificado: false,
        estado: profile.estado,
        fechaRegistro: profile.fechaRegistro,
        avatarUrl: profile.avatarUrl,
      });

      setSuccessMessage('¡Perfil guardado en Firebase con éxito!');
      setVerificationSentNotice(
        `Te enviamos un correo electrónico a ${cleanEmail} para autenticar tu cuenta oficial de UPPA.`
      );
      setMode('profile');
    } catch (err: any) {
      console.error('Error al registrar perfil:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Iniciar sesión existente
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    if (!cleanEmail || !cleanPassword) {
      setAuthError('Completá email y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      const profile = await loginWithEmail(cleanEmail, cleanPassword);

      onUpdateUser({
        ...currentUser,
        id: profile.uid || profile.id || currentUser.id,
        uid: profile.uid || profile.id || currentUser.uid,
        name: profile.nombre || profile.name || currentUser.name,
        nombre: profile.nombre || profile.name || currentUser.nombre,
        email: profile.email,
        role: profile.rol === 'administrador' ? 'admin' : (profile.esChofer ? 'driver' : 'passenger'),
        rol: profile.rol as any,
        phone: profile.phone,
        barrio: profile.barrio,
        estado: profile.estado,
        fechaRegistro: profile.fechaRegistro,
        avatarUrl: profile.avatarUrl,
        emailVerificado: firebaseUser?.emailVerified,
      });

      setSuccessMessage('¡Sesión iniciada con éxito!');
      setMode('profile');
    } catch (err: any) {
      console.error('Error al iniciar sesión:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Iniciar sesión con Google
  const handleGoogleAuth = async () => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const profile = await loginWithGoogle();
      onUpdateUser({
        ...currentUser,
        id: profile.uid || profile.id || currentUser.id,
        uid: profile.uid || profile.id || currentUser.uid,
        name: profile.nombre || profile.name || currentUser.name,
        nombre: profile.nombre || profile.name || currentUser.nombre,
        email: profile.email,
        role: profile.rol === 'administrador' ? 'admin' : 'passenger',
        rol: profile.rol as any,
        phone: profile.phone,
        barrio: profile.barrio,
        estado: profile.estado,
        fechaRegistro: profile.fechaRegistro,
        avatarUrl: profile.avatarUrl,
      });
      setSuccessMessage('¡Conectado con cuenta de Google!');
      setMode('profile');
    } catch (err: any) {
      console.error('Error Google:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Guardar cambios del perfil en Firestore
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      if (currentUid) {
        await updateUserDocument(currentUid, {
          nombre: editName.trim(),
          barrio: editBarrio.trim(),
          phone: editPhone.trim(),
        });
      }
      if (updateProfileData) {
        await updateProfileData({
          name: editName.trim(),
          nombre: editName.trim(),
          barrio: editBarrio.trim(),
          phone: editPhone.trim(),
        });
      }

      onUpdateUser({
        ...currentUser,
        name: editName.trim(),
        nombre: editName.trim(),
        barrio: editBarrio.trim(),
        phone: editPhone.trim(),
      });

      setSuccessMessage('¡Datos actualizados en Firestore!');
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    } catch (err) {
      console.error('Error guardando perfil:', err);
      setIsSubmitting(false);
    }
  };

  // Handler: Reenviar mail de autenticación
  const handleResendVerification = async () => {
    setIsResendingEmail(true);
    setAuthError(null);
    try {
      await sendVerificationEmail();
      setVerificationSentNotice(
        `Hemos reenviado el correo de autenticación a ${firebaseUser?.email || currentUser.email}. Revisá tu casilla y la carpeta de spam.`
      );
    } catch (err: any) {
      console.error('Error al reenviar:', err);
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Handler: Comprobar si el usuario ya verificó el correo
  const handleCheckVerification = async () => {
    setIsCheckingVerification(true);
    try {
      const verified = await reloadAuthUser();
      if (verified) {
        setVerificationSentNotice(null);
        setSuccessMessage('¡Excelente! Tu correo electrónico ha sido autenticado en Firebase.');
        onUpdateUser({
          ...currentUser,
          emailVerificado: true,
        });
      } else {
        setAuthError(
          'El correo aún figura como no verificado. Hacé clic en el enlace que enviamos a tu email o solicitá un nuevo correo.'
        );
      }
    } catch (err) {
      console.error('Error comprobando verificación:', err);
    } finally {
      setIsCheckingVerification(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0c0f17] border border-slate-700/80 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-sky-500/20">
              U
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-1.5 font-display tracking-tight">
                UPPA · {mode === 'register' ? 'Crear Perfil en Firebase' : mode === 'login' ? 'Iniciar Sesión' : 'Mi Perfil'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {mode === 'profile'
                  ? `Firestore: usuarios/${(currentUid || 'usr').slice(0, 8)}...`
                  : 'Autenticación Oficial & Cloud Firestore'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 mt-4 p-1 rounded-2xl bg-white/[0.04] border border-white/5">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hacerse un Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setAuthError(null);
            }}
            className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                setMode('profile');
                setAuthError(null);
              }}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mode === 'profile'
                  ? 'bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Mi Perfil</span>
            </button>
          )}
        </div>

        {/* Global Errors or Success notices */}
        {authError && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {authError.includes('configuration-not-found') || authError.includes('CONFIGURATION_NOT_FOUND')
                ? 'El proyecto de Firebase aún no tiene habilitado el proveedor de correo en la Consola. Hemos habilitado el Modo Resiliente para que puedas guardar tu perfil y usar todas las funciones de UPPA.'
                : authError}
            </div>
          </div>
        )}

        {(successMessage || authNotice) && (
          <div className="mt-3.5 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-semibold">{authNotice || successMessage}</div>
          </div>
        )}

        {/* Verification Sent Alert Box */}
        {verificationSentNotice && (
          <div className="mt-3.5 p-4 rounded-2xl bg-gradient-to-br from-sky-950/80 to-cyan-950/80 border border-sky-400/40 text-slate-200 text-xs space-y-2.5 shadow-lg shadow-sky-500/10 animate-in fade-in">
            <div className="flex items-center gap-2 text-sky-300 font-bold text-sm">
              <Mail className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>¡Mail de Autenticación Enviado!</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              {verificationSentNotice}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-sky-500/20">
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={isCheckingVerification}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
              >
                {isCheckingVerification ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Comprobar si ya verifiqué</span>
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResendingEmail}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all border border-slate-700"
              >
                {isResendingEmail ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Reenviar correo</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: HACERSE UN PERFIL (REGISTRO EN FIREBASE + ENVÍO DE MAIL) */}
        {/* ------------------------------------------------------------------- */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterProfile} className="mt-4 space-y-3.5 animate-in fade-in">
            <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-500/20 text-xs text-sky-200 leading-snug">
              ✨ <strong>Creación de perfil oficial:</strong> Tus datos se cargarán en <strong>Firebase Firestore</strong> y te enviaremos de inmediato el correo de autenticación para validar tu cuenta en el corredor Campana ↔ Zárate.
            </div>

            {/* Nombre Completo */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre y Apellido *
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Ej: Gastón Giménez"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Correo Electrónico */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Correo Electrónico (Para recibir el mail de autenticación) *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="tu.email@ejemplo.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Contraseña segura (mínimo 6 caracteres) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Teléfono & Barrio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="+54 9 3487 55-2190"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-8 pr-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Barrio o Localidad
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Campana Centro / Zárate"
                    value={regBarrio}
                    onChange={(e) => setRegBarrio(e.target.value)}
                    className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-8 pr-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Tipo de Perfil / Rol */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ¿Qué tipo de perfil deseas crear?
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('pasajero')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    regRole === 'pasajero'
                      ? 'bg-sky-500/20 border-cyan-400 text-white shadow-sm'
                      : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserIcon className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="text-[11px] font-extrabold text-white">Pasajero</div>
                  <div className="text-[9.5px] text-slate-400">Vecino / Usuario</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole('chofer_moto')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    regRole === 'chofer_moto'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm'
                      : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bike className="w-4 h-4 text-emerald-400 mb-1" />
                  <div className="text-[11px] font-extrabold text-white">Moto Taxi</div>
                  <div className="text-[9.5px] text-slate-400">Chofer de Moto</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole('chofer_auto')}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    regRole === 'chofer_auto'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                      : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Car className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="text-[11px] font-extrabold text-white">Auto Taxi</div>
                  <div className="text-[9.5px] text-slate-400">Chofer de Auto</div>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 mt-2 bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400 hover:from-sky-300 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Guardando en Firebase y enviando mail...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-slate-950" />
                  <span>Crear Perfil y Enviar Mail de Autenticación</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: INICIAR SESIÓN CON FIREBASE */}
        {/* ------------------------------------------------------------------- */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="mt-4 space-y-3.5 animate-in fade-in">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-[11px] text-cyan-400 hover:underline font-semibold"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showLoginPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Iniciar Sesión en Firebase</span>
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center py-2">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-[#0c0f17] px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">o</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </form>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: MI PERFIL (VISUALIZACIÓN Y EDICIÓN EN FIRESTORE) */}
        {/* ------------------------------------------------------------------- */}
        {mode === 'profile' && (
          <div className="mt-4 space-y-3.5 animate-in fade-in">
            {/* Status Card */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
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
                      : currentRol?.includes('chofer')
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
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

            {/* Email Verification Status Card */}
            <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
              isEmailVerified
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold">
                  {isEmailVerified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">Email Autenticado Oficial</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300">Email Pendiente de Autenticación</span>
                    </>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  isEmailVerified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {isEmailVerified ? 'Verificado' : 'No verificado'}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                {isEmailVerified
                  ? `Tu correo (${firebaseUser?.email || currentUser.email}) está autenticado correctamente en Firebase Authentication.`
                  : `Hemos enviado el correo para autenticar tu dirección (${firebaseUser?.email || currentUser.email}). Hacé clic en el enlace para habilitar todas las funciones.`}
              </p>

              {!isEmailVerified && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isResendingEmail}
                    className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                  >
                    {isResendingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    <span>Reenviar mail de autenticación</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckVerification}
                    disabled={isCheckingVerification}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
                  >
                    {isCheckingVerification ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-cyan-400" />}
                    <span>Comprobar estado</span>
                  </button>
                </div>
              )}
            </div>

            {/* Editable Profile Form */}
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre completo</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Registrado</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={firebaseUser?.email || currentUser.email}
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
                      value={editBarrio}
                      onChange={(e) => setEditBarrio(e.target.value)}
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
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-[#121520] border border-slate-700/80 rounded-xl pl-8 pr-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Password change trigger */}
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

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar en Firestore</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    onClose();
                  }}
                  className="h-11 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            </form>
          </div>
        )}

        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          initialEmail={firebaseUser?.email || currentUser.email}
        />
      </div>
    </div>
  );
};
