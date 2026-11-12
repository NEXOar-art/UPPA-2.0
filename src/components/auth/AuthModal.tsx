import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { updateUserDocument } from '../../services/firestoreService';
import { ResetPasswordModal } from './ResetPasswordModal';
import { GoogleAccountChooserModal } from './GoogleAccountChooserModal';
import {
  X,
  Mail,
  User as UserIcon,
  Check,
  KeyRound,
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
  Zap,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  setDriverDisponibilidad,
  subscribeToDriversDisponibilidad,
} from '../../services/realtimeFirebaseService';
import { getActiveDriverSession } from '../../services/driverActivationService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updated: User) => void;
  defaultMode?: 'register' | 'login' | 'profile';
  isHabilitado?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  defaultMode,
  isHabilitado,
}) => {
  const {
    user: authUser,
    firebaseUser,
    isAuthenticated,
    isEmailVerified,
    registerWithEmail,
    loginWithEmail,
    logout,
    sendVerificationEmail,
    reloadAuthUser,
    updateProfileData,
    authError,
    setAuthError,
    authNotice,
  } = useAuth();

  const [mode, setMode] = useState<'register' | 'login' | 'profile'>('register');

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBarrio, setRegBarrio] = useState('');
  const [regRole, setRegRole] = useState<'pasajero' | 'chofer_moto' | 'chofer_auto'>('pasajero');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState('');
  const [editBarrio, setEditBarrio] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSentNotice, setVerificationSentNotice] = useState<string | null>(null);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isHabilitacionCardExpanded, setIsHabilitacionCardExpanded] = useState(false);

  const [driverDisponibilidad, setDriverDisponibilidadState] = useState<'desocupado' | 'ocupado'>('desocupado');

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
      setEditName(currentUser.name || '');
      setEditBarrio(currentUser.barrio || '');
      setEditPhone(currentUser.phone || '');
    }
  }, [isOpen, isAuthenticated, authUser, defaultMode]);

  const currentUid = authUser?.uid || currentUser?.uid || currentUser?.id || '';

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToDriversDisponibilidad((map) => {
      const keys = [
        currentUid,
        authUser?.uid,
        currentUser?.uid,
        currentUser?.id,
        authUser?.nombre,
        currentUser?.name,
        currentUser?.nombre,
        authUser?.phone,
        currentUser?.phone,
      ].filter(Boolean) as string[];

      for (const k of keys) {
        const val = map[k] || map[k.toLowerCase()];
        if (val) {
          setDriverDisponibilidadState(val);
          return;
        }
      }
      setDriverDisponibilidadState('desocupado');
    });
    return () => unsub();
  }, [isOpen, currentUid, authUser, currentUser]);

  if (!isOpen) return null;

  const currentRol =
    authUser?.rol || currentUser?.rol || (currentUser?.role === 'admin' ? 'administrador' : 'pasajero');
  const currentEstado = authUser?.estado || currentUser?.estado || 'activo';
  const currentFecha = authUser?.fechaRegistro || currentUser?.fechaRegistro || 'Reciente';

  // Verificación estricta de rol: pasajeros y administradores nunca ven paneles exclusivos de chofer
  const activeDriverSession = getActiveDriverSession();
  const isNonDriverRole =
    currentUser.role === 'admin' ||
    currentUser.rol === 'administrador' ||
    (currentUser.role === 'passenger' && !currentUser.esChofer && !currentUser.rol?.includes('chofer'));

  const isDriverUser = Boolean(
    !isNonDriverRole &&
      (currentUser.esChofer ||
        currentUser.rol === 'chofer_moto' ||
        currentUser.rol === 'chofer_auto' ||
        currentUser.role === 'driver' ||
        Boolean(activeDriverSession) ||
        isHabilitado)
  );

  const handleToggleDriverDisponibilidad = () => {
    const nextState = driverDisponibilidad === 'ocupado' ? 'desocupado' : 'ocupado';
    const keys = [
      currentUid,
      authUser?.uid,
      currentUser?.uid,
      currentUser?.id,
      authUser?.nombre,
      currentUser?.name,
      currentUser?.nombre,
      authUser?.phone,
      currentUser?.phone,
    ].filter(Boolean) as string[];

    keys.forEach((k) => {
      setDriverDisponibilidad(k, nextState);
    });
    setDriverDisponibilidadState(nextState);
  };

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

      const profile = await registerWithEmail(cleanEmail, cleanPassword, cleanName, regRole, {
        phone: regPhone.trim(),
        barrio: regBarrio.trim(),
        esChofer: isChofer,
        tipoVehiculo: tipoVehiculo,
      });

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
        role: profile.rol === 'administrador' ? 'admin' : profile.esChofer ? 'driver' : 'passenger',
        rol: profile.rol as any,
        esChofer: profile.esChofer,
        tipoVehiculo: profile.tipoVehiculo,
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

  const handleGoogleSuccess = (profile: User) => {
    onUpdateUser({
      ...currentUser,
      id: profile.uid || profile.id || currentUser.id,
      uid: profile.uid || profile.id || currentUser.uid,
      name: profile.nombre || profile.name || currentUser.name,
      nombre: profile.nombre || profile.name || currentUser.nombre,
      email: profile.email,
      role: profile.rol === 'administrador' ? 'admin' : profile.esChofer ? 'driver' : 'passenger',
      rol: profile.rol as any,
      esChofer: profile.esChofer,
      tipoVehiculo: profile.tipoVehiculo,
      phone: profile.phone,
      barrio: profile.barrio,
      estado: profile.estado,
      fechaRegistro: profile.fechaRegistro,
      avatarUrl: profile.avatarUrl,
    });
    setSuccessMessage('¡Conectado con tu cuenta de Google!');
    setMode('profile');
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#202329] border-2 border-white/20 rounded-3xl shadow-[0_8px_0_rgba(0,0,0,0.65)] text-white relative max-h-[92vh] overflow-hidden flex flex-col">
        <div className="h-1.5 bg-[#FFF19A] w-full shrink-0" />

        <div className="p-5 sm:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFF19A] flex items-center justify-center text-[#101114] font-black text-sm">
                U
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-1.5 font-display tracking-tight">
                  UPPA · {mode === 'register' ? 'Crear Perfil' : mode === 'login' ? 'Iniciar Sesión' : 'Mi Perfil'}
                </h2>
                <p className="text-[11px] text-[#9299A5] font-mono">
                  {mode === 'profile'
                    ? `Firestore: usuarios/${(currentUid || 'usr').slice(0, 8)}...`
                    : 'Autenticación Oficial & Cloud Firestore'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar ventana de perfil y cuenta"
              className="w-9 h-9 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 mt-4 p-1 rounded-2xl bg-[#101114] border border-white/15">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setAuthError(null);
              }}
              title="Crear una nueva cuenta de pasajero o chofer"
              className={`flex-1 min-h-[38px] px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#FFF19A] text-[#101114]'
                  : 'text-[#9299A5] hover:text-white'
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
              title="Iniciar sesión con tu cuenta registrada"
              className={`flex-1 min-h-[38px] px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#FFF19A] text-[#101114]'
                  : 'text-[#9299A5] hover:text-white'
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
                title="Ver y editar los datos de tu perfil actual"
                className={`flex-1 min-h-[38px] px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'profile'
                    ? 'bg-[#FFF19A] text-[#101114]'
                    : 'text-[#9299A5] hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Mi Perfil</span>
              </button>
            )}
          </div>

          {authError && (
            <div className="mt-3.5 p-3 rounded-xl bg-rose-950/50 border border-rose-400/50 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {authError.includes('configuration-not-found') || authError.includes('CONFIGURATION_NOT_FOUND')
                  ? 'El proyecto de Firebase aún no tiene habilitado el proveedor de correo en la Consola. Hemos habilitado el Modo Resiliente para que puedas guardar tu perfil y usar todas las funciones de UPPA.'
                  : authError}
              </div>
            </div>
          )}

          {(successMessage || authNotice) && (
            <div className="mt-3.5 p-3 rounded-xl bg-[#101114] border border-[#B7F36B]/50 text-[#B7F36B] text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
              <div className="leading-relaxed font-bold">{authNotice || successMessage}</div>
            </div>
          )}

          {verificationSentNotice && (
            <div className="mt-3.5 p-4 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/45 text-white text-xs space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-[#FFF19A] font-black text-sm">
                <Mail className="w-4 h-4 animate-pulse" />
                <span>¡Mail de Autenticación Enviado!</span>
              </div>
              <p className="text-[#9299A5] leading-relaxed text-[11.5px]">{verificationSentNotice}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={isCheckingVerification}
                  title="Verificar si ya confirmaste tu correo electrónico"
                  className="px-3 min-h-[38px] rounded-xl uppa-cta-green font-black text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                  title="Volver a enviar el correo de confirmación"
                  className="px-3 min-h-[38px] rounded-xl bg-[#202329] hover:bg-white/10 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-white/15"
                >
                  {isResendingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#FFF19A]" />
                  )}
                  <span>Reenviar correo</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterProfile} className="mt-4 space-y-3.5 animate-in fade-in">
              <div className="p-3 rounded-xl bg-[#101114] border border-white/15 text-xs text-[#9299A5] leading-snug">
                ✨ <strong className="text-white">Creación de perfil oficial:</strong> Tus datos se cargarán en <strong className="text-[#FFF19A]">Firebase Firestore</strong> y te enviaremos el correo de autenticación para validar tu cuenta en Campana ↔ Zárate.
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">Nombre y Apellido *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Gastón Giménez"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="tu.email@ejemplo.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Contraseña segura (mínimo 6 caracteres) *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    title={showRegPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-white mb-1">Teléfono / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="+54 9 3487 55-2190"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white mb-1">Barrio o Localidad</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Campana Centro / Zárate"
                      value={regBarrio}
                      onChange={(e) => setRegBarrio(e.target.value)}
                      className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  ¿Qué tipo de perfil deseas crear?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegRole('pasajero')}
                    title="Crear perfil como Pasajero / Vecino"
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      regRole === 'pasajero'
                        ? 'bg-[#FFF19A] border-white/25 text-[#101114]'
                        : 'bg-[#101114] border-white/15 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    <UserIcon className={`w-4 h-4 mb-1 ${regRole === 'pasajero' ? 'text-[#101114]' : 'text-[#FFF19A]'}`} />
                    <div className="text-[11px] font-black">Pasajero</div>
                    <div className={`text-[9.5px] ${regRole === 'pasajero' ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                      Vecino / Usuario
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole('chofer_moto')}
                    title="Crear perfil como Chofer de Moto Taxi"
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      regRole === 'chofer_moto'
                        ? 'bg-[#B7F36B] border-white/25 text-[#101114]'
                        : 'bg-[#101114] border-white/15 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    <Bike className={`w-4 h-4 mb-1 ${regRole === 'chofer_moto' ? 'text-[#101114]' : 'text-[#B7F36B]'}`} />
                    <div className="text-[11px] font-black">Moto Taxi</div>
                    <div className={`text-[9.5px] ${regRole === 'chofer_moto' ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                      Chofer de Moto
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegRole('chofer_auto')}
                    title="Crear perfil como Chofer de Auto Taxi"
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      regRole === 'chofer_auto'
                        ? 'bg-[#FFF19A] border-white/25 text-[#101114]'
                        : 'bg-[#101114] border-white/15 text-[#9299A5] hover:text-white'
                    }`}
                  >
                    <Car className={`w-4 h-4 mb-1 ${regRole === 'chofer_auto' ? 'text-[#101114]' : 'text-[#FFF19A]'}`} />
                    <div className="text-[11px] font-black">Auto Taxi</div>
                    <div className={`text-[9.5px] ${regRole === 'chofer_auto' ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                      Chofer de Auto
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                title="Registrar cuenta en Firebase y enviar correo de verificación"
                className="w-full min-h-[46px] mt-2 uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando en Firebase y enviando mail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Crear Perfil y Enviar Mail de Autenticación</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="mt-4 space-y-3.5 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-white mb-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-white">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    title="Recuperar contraseña por email"
                    className="text-[11px] text-[#FFF19A] hover:underline font-bold cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-10 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    title={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                title="Iniciar sesión con correo y contraseña"
                className="w-full min-h-[46px] uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
                <div className="border-t border-white/10 w-full"></div>
                <span className="bg-[#202329] px-3 text-[11px] text-[#9299A5] uppercase tracking-wider font-bold">
                  o
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsGoogleChooserOpen(true)}
                disabled={isSubmitting}
                title="Seleccionar una cuenta de Google para ingresar"
                className="w-full min-h-[44px] rounded-xl bg-[#101114] hover:bg-white/10 border-2 border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continuar con Google</span>
              </button>
            </form>
          )}

          {/* TAB 3: MI PERFIL */}
          {mode === 'profile' && (
            <div className="mt-4 space-y-3.5 animate-in fade-in">
              {isDriverUser &&
                (isHabilitado ? (
                  <div className="p-4 rounded-2xl border-2 bg-[#101114] border-[#B7F36B] text-white shadow-[4px_4px_0px_#000000]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-white">Disponibilidad de Servicio</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/50">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B7F36B] opacity-80" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B7F36B]" />
                            </span>
                            <span>PRESTADOR HABILITADO</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          {driverDisponibilidad === 'ocupado' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black tracking-wider uppercase bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/50">
                              <span className="w-2 h-2 rounded-full bg-[#FFF19A]" />
                              <span>OCUPADO (EN VIAJE)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black tracking-wider uppercase bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/50">
                              <span className="w-2 h-2 rounded-full bg-[#B7F36B]" />
                              <span>DESOCUPADO (DISPONIBLE)</span>
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#9299A5] leading-snug">
                          Al aceptar un viaje pasás automáticamente a <em className="text-white">Ocupado</em>. Cuando finalices tu viaje, usá este botón para volver a <em className="text-white">Desocupado</em>.
                        </p>

                        <div className="pt-1">
                          <label className="text-[10.5px] text-[#9299A5] font-bold block mb-1">
                            Estado para la comunidad:
                          </label>
                          <select
                            value={driverDisponibilidad}
                            onChange={(e) => {
                              const next = e.target.value as 'desocupado' | 'ocupado';
                              const keys = [
                                currentUid,
                                authUser?.uid,
                                currentUser?.uid,
                                currentUser?.id,
                                authUser?.nombre,
                                currentUser?.name,
                                currentUser?.nombre,
                                authUser?.phone,
                                currentUser?.phone,
                              ].filter(Boolean) as string[];
                              keys.forEach((k) => setDriverDisponibilidad(k, next));
                              setDriverDisponibilidadState(next);
                            }}
                            aria-label="Cambiar disponibilidad de conductor"
                            className="bg-[#202329] border border-white/20 rounded-xl px-2.5 min-h-[38px] text-xs text-white font-bold cursor-pointer"
                          >
                            <option value="desocupado">🟢 DESOCUPADO (Disponible)</option>
                            <option value="ocupado">🟡 OCUPADO (En viaje activo)</option>
                          </select>
                        </div>
                      </div>

                      <div className="shrink-0 pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={handleToggleDriverDisponibilidad}
                          className={`w-full sm:w-auto px-4 min-h-[44px] rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            driverDisponibilidad === 'ocupado' ? 'uppa-cta-green' : 'uppa-cta-yellow'
                          }`}
                          title={
                            driverDisponibilidad === 'ocupado'
                              ? 'Pasar a estado Desocupado al terminar el viaje'
                              : 'Marcar estado como Ocupado'
                          }
                        >
                          {driverDisponibilidad === 'ocupado' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                              <span>Colocar DESOCUPADO</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              <span>Colocar OCUPADO</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border-2 bg-[#101114] border-[#FFF19A]/45 text-white space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                        <KeyRound className="w-4 h-4 text-[#FFF19A]" />
                        <span>Habilitación de Chofer</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#FFF19A]/15 text-[#FFF19A] border border-[#FFF19A]/45">
                        <span className="w-2 h-2 rounded-full bg-[#FFF19A] animate-pulse" />
                        <span>PENDIENTE DE HABILITACIÓN</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsHabilitacionCardExpanded((prev) => !prev)}
                      title="Mostrar u ocultar instrucciones de habilitación"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#202329] hover:bg-white/10 border border-[#FFF19A]/35 text-[#FFF19A] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>{isHabilitacionCardExpanded ? 'Ocultar información' : 'Ver información de habilitación'}</span>
                      {isHabilitacionCardExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isHabilitacionCardExpanded && (
                      <div className="space-y-3 pt-2 border-t border-white/10 animate-in fade-in duration-200">
                        <div className="text-xs font-black text-[#FFF19A]">Habilitación por Administrador</div>
                        <p className="text-[11px] text-[#9299A5] leading-relaxed">
                          Para figurar como <strong className="text-white">Habilitado</strong> en Taxis & Motos, el Administrador debe validar tu comprobante y activar tu unidad. En ese momento comenzará tu temporizador en vivo.
                        </p>

                        <a
                          href={`https://wa.me/5493489690058?text=${encodeURIComponent(
                            `Hola Lucia Veronica Gimenez! Te contacto por la habilitación de mi servicio de chofer (${authUser?.nombre || currentUser?.name || currentUser?.nombre || 'Prestador UPPA'}). Ya envié mis datos.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar mensaje de WhatsApp al Administrador UPPA (3489690058)"
                          className="w-full min-h-[44px] px-3 rounded-xl uppa-cta-green font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 shrink-0" />
                          <span>Contactar al Administrador (3489690058)</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}

              {/* Status Card */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#9299A5] font-mono text-[11px]">UID Firebase:</span>
                  <span className="font-mono text-[#FFF19A] font-bold text-[11px] truncate max-w-[200px]">
                    {currentUid}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#9299A5]">Rol del Usuario:</span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] border ${
                      currentRol === 'administrador'
                        ? 'bg-[#FFF19A]/15 text-[#FFF19A] border-[#FFF19A]/45'
                        : currentRol?.includes('chofer')
                        ? 'bg-[#B7F36B]/15 text-[#B7F36B] border-[#B7F36B]/45'
                        : 'bg-[#202329] text-white border-white/20'
                    }`}
                  >
                    {currentRol}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#9299A5]">Estado de Cuenta:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/45 font-black text-[10px] uppercase">
                    {currentEstado}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#9299A5]">Fecha de Registro:</span>
                  <span className="text-white/90 font-mono text-[11px]">
                    {typeof currentFecha === 'string' && currentFecha.includes('T')
                      ? currentFecha.split('T')[0]
                      : currentFecha}
                  </span>
                </div>
              </div>

              {/* Email Verification Status */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                  isEmailVerified
                    ? 'bg-[#101114] border-[#B7F36B]/45 text-white'
                    : 'bg-[#101114] border-[#FFF19A]/45 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black">
                    {isEmailVerified ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#B7F36B]" />
                        <span className="text-[#B7F36B]">Email Autenticado Oficial</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-[#FFF19A]" />
                        <span className="text-[#FFF19A]">Email Pendiente de Autenticación</span>
                      </>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      isEmailVerified
                        ? 'bg-[#B7F36B]/15 text-[#B7F36B]'
                        : 'bg-[#FFF19A]/15 text-[#FFF19A]'
                    }`}
                  >
                    {isEmailVerified ? 'Verificado' : 'No verificado'}
                  </span>
                </div>

                <p className="text-[11px] text-[#9299A5] leading-snug">
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
                      title="Reenviar email de verificación"
                      className="px-3 min-h-[38px] rounded-xl uppa-cta-yellow font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {isResendingEmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>Reenviar mail</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCheckVerification}
                      disabled={isCheckingVerification}
                      title="Verificar ahora si tu correo fue validado"
                      className="px-3 min-h-[38px] rounded-xl bg-[#202329] hover:bg-white/10 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer border border-white/15"
                    >
                      {isCheckingVerification ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 text-[#B7F36B]" />
                      )}
                      <span>Comprobar estado</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Editable Profile Form */}
              <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-white mb-1">Nombre completo</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white mb-1">Email Registrado</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      disabled
                      value={firebaseUser?.email || currentUser.email}
                      className="w-full min-h-[42px] bg-[#101114]/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-[#9299A5] font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-white mb-1">Barrio o localidad</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={editBarrio}
                        onChange={(e) => setEditBarrio(e.target.value)}
                        className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white mb-1">Teléfono</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFF19A] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#101114] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#9299A5]">
                    <KeyRound className="w-4 h-4 text-[#FFF19A]" />
                    <span>Contraseña de acceso</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(true)}
                    title="Abrir recuperación o cambio de contraseña"
                    className="text-xs text-[#FFF19A] hover:underline font-bold cursor-pointer"
                  >
                    Cambiar / Recuperar
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    title="Guardar cambios de tu perfil en Firestore"
                    className="flex-1 min-h-[46px] uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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
                    className="min-h-[46px] px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Cerrar sesión en este dispositivo"
                  >
                    <LogOut className="w-4 h-4" />
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

          <GoogleAccountChooserModal
            isOpen={isGoogleChooserOpen}
            onClose={() => setIsGoogleChooserOpen(false)}
            onSuccess={handleGoogleSuccess}
          />
        </div>
      </div>
    </div>
  );
};
