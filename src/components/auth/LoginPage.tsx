import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import heroCorridorImg from '../../assets/images/uppa_zarate_corridor_1791318316432.jpg';
import { useAuth } from '../../context/AuthContext';
import { ResetPasswordModal } from './ResetPasswordModal';
import {
  Car,
  Shield,
  ArrowRight,
  Radio,
  Lock,
  Mail,
  User as UserIcon,
  ChevronRight,
  Bus,
  Eye,
  EyeOff,
  KeyRound,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onExploreGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onExploreGuest }) => {
  const { registerWithEmail, loginWithEmail, loginWithGoogle, authError, setAuthError } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('gastonrobertogimenez@gmail.com');
  const [password, setPassword] = useState('uppa2026password');
  const [name, setName] = useState('Gaston Gimenez');
  const [role, setRole] = useState<UserRole>('passenger');

  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    setLocalNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = name.trim() || 'Usuario UPPA';

    if (!cleanEmail) {
      setAuthError('Por favor ingresá un e-mail válido.');
      setIsSubmitting(false);
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (authMode === 'register') {
        // 1. Firebase Authentication createUserWithEmailAndPassword
        // 2. Automáticamente crea el documento en users/{uid} con rol="cliente", estado="activo"
        setLocalNotice('Creando usuario en Firebase Auth & Firestore...');
        const userProfile = await registerWithEmail(cleanEmail, cleanPassword, cleanName, role);

        setLocalNotice('¡Cuenta creada y sincronizada en Firestore!');
        setTimeout(() => {
          setIsSubmitting(false);
          onLogin({
            id: userProfile.uid,
            uid: userProfile.uid,
            name: userProfile.nombre,
            email: userProfile.email,
            role: userProfile.rol === 'administrador' ? 'admin' : role,
            rol: userProfile.rol,
            estado: userProfile.estado,
            fechaRegistro: userProfile.fechaRegistro,
            barrio: userProfile.barrio,
            phone: userProfile.phone,
            avatarUrl: userProfile.avatarUrl,
          });
        }, 300);
      } else {
        // Inicio de sesión con email y contraseña mediante Firebase Auth
        setLocalNotice('Verificando credenciales con Firebase Auth...');
        const userProfile = await loginWithEmail(cleanEmail, cleanPassword);

        setLocalNotice('¡Sesión iniciada correctamente con Firebase!');
        setTimeout(() => {
          setIsSubmitting(false);
          onLogin({
            id: userProfile.uid,
            uid: userProfile.uid,
            name: userProfile.nombre,
            email: userProfile.email,
            role: userProfile.rol === 'administrador' ? 'admin' : role,
            rol: userProfile.rol,
            estado: userProfile.estado,
            fechaRegistro: userProfile.fechaRegistro,
            barrio: userProfile.barrio,
            phone: userProfile.phone,
            avatarUrl: userProfile.avatarUrl,
          });
        }, 300);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setLocalNotice(null);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    setLocalNotice('Conectando con Google Authentication...');

    try {
      const userProfile = await loginWithGoogle();
      setLocalNotice('¡Acceso concedido mediante Google!');

      setTimeout(() => {
        setIsSubmitting(false);
        onLogin({
          id: userProfile.uid,
          uid: userProfile.uid,
          name: userProfile.nombre,
          email: userProfile.email,
          role: userProfile.rol === 'administrador' ? 'admin' : role,
          rol: userProfile.rol,
          estado: userProfile.estado,
          fechaRegistro: userProfile.fechaRegistro,
          barrio: userProfile.barrio,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatarUrl,
        });
      }, 300);
    } catch (err: any) {
      setIsSubmitting(false);
      setLocalNotice(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={heroCorridorImg}
          alt="Zárate Campana"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-15 filter blur-[2px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/85 to-[#07090e]/60" />
      </div>

      {/* Top Floating Glass Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-bold text-slate-950 font-display text-lg shadow-lg shadow-sky-500/20">
            U
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-white font-display">
              UPPA
            </span>
            <span className="hidden sm:inline-block text-[10px] text-sky-300/80 ml-2 font-mono">
              Zárate ↔ Campana
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExploreGuest}
            className="px-3.5 py-1.5 rounded-2xl glass-pill hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
          >
            <span>Explorar Mapa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero & Glassmorphic Login Console */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full">
          {/* Left Hero Brief */}
          <div className="md:col-span-6 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-400/10 border border-sky-400/25 text-sky-300 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>Corredor Zárate ↔ B° Malvinas en Vivo</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display leading-tight">
              Movilidad comunitaria.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-teal-300 to-emerald-300">
                Llegá a tiempo.
              </span>
            </h1>

            {/* 3 Pastel Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl glass-card border-white/5 space-y-1 text-center">
                <Bus className="w-5 h-5 text-sky-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">Líneas</div>
                <div className="text-[10px] text-slate-400 font-mono">228 & Colectora</div>
              </div>

              <div className="p-3 rounded-2xl glass-card border-white/5 space-y-1 text-center">
                <Car className="w-5 h-5 text-emerald-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">Taxis GPS</div>
                <div className="text-[10px] text-slate-400 font-mono">Autos & Motos</div>
              </div>

              <div className="p-3 rounded-2xl glass-card border-white/5 space-y-1 text-center">
                <Radio className="w-5 h-5 text-amber-300 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">Alertas</div>
                <div className="text-[10px] text-slate-400 font-mono">Waze Comunitario</div>
              </div>
            </div>

            {/* Firebase Live Backend Status */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 font-mono text-[11px]">
                  BACKEND FIREBASE:
                </span>
                <span className="text-emerald-400 font-bold text-[11px]">AUTH & FIRESTORE</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>users/{'{uid}'}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Glassmorphic Form (NOMBRE, E-MAIL, CONTRASEÑA) */}
          <div className="md:col-span-6 w-full max-w-sm mx-auto">
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden shadow-2xl border border-white/10">
              {/* Top ambient glow bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400" />

              {/* Mode Selector Pill: Crear Cuenta vs Iniciar Sesión */}
              <div className="flex rounded-2xl bg-white/[0.04] p-1 mb-4 border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'register'
                      ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Registro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    authMode === 'login'
                      ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Iniciar Sesión
                </button>
              </div>

              {/* Error feedback */}
              {authError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Status Notice */}
              {localNotice && (
                <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-[11px] text-emerald-300 text-center font-mono flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{localNotice}</span>
                </div>
              )}

              {/* Form: NOMBRE, E-MAIL, CONTRASEÑA */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* 1. NOMBRE (en Registro) */}
                {authMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                        Nombre Completo
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Tu nombre completo"
                          className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/70"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                        Rol en la Comunidad
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'pasajero', label: '🚶 Pasajero' },
                          { id: 'chofer_moto', label: '🏍️ Chofer Moto' },
                          { id: 'chofer_auto', label: '🚕 Chofer Auto' },
                          { id: 'chofer_micro', label: '🚌 Chofer Micro' },
                        ].map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRole(r.id as UserRole)}
                            className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-left flex items-center justify-between ${
                              role === r.id || (role === 'passenger' && r.id === 'pasajero')
                                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                                : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>{r.label}</span>
                            {(role === r.id || (role === 'passenger' && r.id === 'pasajero')) && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 2. E-MAIL */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/70"
                    />
                  </div>
                </div>

                {/* 3. CONTRASEÑA */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Contraseña
                    </label>

                    {/* Recuperar Contraseña */}
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(true)}
                      className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-9 pr-9 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400/70 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      title={showPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botón Primario: Firebase Email/Password Auth */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-97 transition-all mt-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {authMode === 'register'
                          ? 'Registrarme e Ingresar'
                          : 'Iniciar Sesión'}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Google Sign-in */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-2xl glass-button text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Continuar con Cuenta de Google</span>
                  </button>
                </div>
              </form>

              {/* Botón de Recuperar Contraseña / Modo invitado */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-sky-300 hover:text-sky-200 flex items-center gap-1.5 transition-colors text-[11px]"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Recuperar contraseña</span>
                </button>

                <button
                  type="button"
                  onClick={onExploreGuest}
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Modo invitado →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Password Reset Modal via Firebase Auth */}
      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialEmail={email}
      />

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full px-6 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono max-w-6xl mx-auto">
        <span>UPPA · Comunidad de Transporte Zárate ↔ Barrio Malvinas</span>
        <span className="text-slate-400 flex items-center gap-1">
          <Shield className="w-3 h-3 text-sky-400" />
          <span>Firebase Authentication & Firestore</span>
        </span>
      </footer>
    </div>
  );
};
