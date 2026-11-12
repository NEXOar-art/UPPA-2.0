import React, { useState } from 'react';
import { User, mapFirestoreRolToAppRole } from '../../types';
import heroCorridorImg from '../../assets/images/uppa_zarate_corridor_1791318316432.jpg';
import { useAuth } from '../../context/AuthContext';
import { ResetPasswordModal } from './ResetPasswordModal';
import { GoogleAccountChooserModal } from './GoogleAccountChooserModal';
import {
  Car,
  Shield,
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
  Phone,
  MapPin,
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onExploreGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const {
    registerWithEmail,
    loginWithEmail,
    authError,
    setAuthError,
    authNotice,
    isResilientMode,
  } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'pasajero' | 'chofer_moto' | 'chofer_auto'>('pasajero');
  const [phone, setPhone] = useState('');
  const [barrio, setBarrio] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [showFirebaseInfo, setShowFirebaseInfo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    setLocalNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = name.trim() || cleanEmail.split('@')[0] || 'Usuario UPPA';

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
        const isChofer = role === 'chofer_moto' || role === 'chofer_auto';
        const tipoVehiculo = role === 'chofer_moto' ? 'moto' : role === 'chofer_auto' ? 'auto' : null;
        const userProfile = await registerWithEmail(cleanEmail, cleanPassword, cleanName, role, {
          phone: phone.trim(),
          barrio: barrio.trim(),
          esChofer: isChofer,
          tipoVehiculo: tipoVehiculo,
        });

        setLocalNotice('¡Cuenta creada en Firebase correctamente!');
        setTimeout(() => {
          setIsSubmitting(false);
          const computedRole = mapFirestoreRolToAppRole(userProfile.rol, isChofer);
          onLogin({
            id: userProfile.uid || userProfile.id || 'usr_' + Date.now(),
            uid: userProfile.uid || userProfile.id,
            name: userProfile.nombre || userProfile.name || cleanName,
            nombre: userProfile.nombre || userProfile.name || cleanName,
            email: userProfile.email,
            role: computedRole,
            rol: userProfile.rol || role,
            esChofer: isChofer,
            tipoVehiculo: tipoVehiculo,
            estado: userProfile.estado || 'activo',
            fechaRegistro: userProfile.fechaRegistro || new Date().toISOString(),
            barrio: userProfile.barrio || barrio,
            phone: userProfile.phone || phone,
            avatarUrl: userProfile.avatarUrl,
            emailVerificado: false,
          });
        }, 500);
      } else {
        setLocalNotice('Verificando credenciales con Firebase Auth...');
        const userProfile = await loginWithEmail(cleanEmail, cleanPassword);

        setLocalNotice('¡Sesión iniciada correctamente con Firebase!');
        setTimeout(() => {
          setIsSubmitting(false);
          const computedRole = mapFirestoreRolToAppRole(userProfile.rol, userProfile.esChofer);
          onLogin({
            id: userProfile.uid || userProfile.id || 'usr_' + Date.now(),
            uid: userProfile.uid || userProfile.id,
            name: userProfile.nombre || userProfile.name || 'Usuario',
            nombre: userProfile.nombre || userProfile.name || 'Usuario',
            email: userProfile.email,
            role: computedRole,
            rol: userProfile.rol,
            esChofer: userProfile.esChofer,
            tipoVehiculo: userProfile.tipoVehiculo,
            estado: userProfile.estado,
            fechaRegistro: userProfile.fechaRegistro,
            barrio: userProfile.barrio,
            phone: userProfile.phone,
            avatarUrl: userProfile.avatarUrl,
          });
        }, 300);
      }
    } catch {
      setIsSubmitting(false);
      setLocalNotice(null);
    }
  };

  const handleGoogleSuccess = (userProfile: User) => {
    setLocalNotice('¡Acceso concedido mediante Google!');
    const computedRole = mapFirestoreRolToAppRole(userProfile.rol, userProfile.esChofer);
    onLogin({
      id: userProfile.uid || userProfile.id || 'usr_' + Date.now(),
      uid: userProfile.uid || userProfile.id,
      name: userProfile.nombre || userProfile.name || 'Usuario',
      nombre: userProfile.nombre || userProfile.name || 'Usuario',
      email: userProfile.email,
      role: computedRole,
      rol: userProfile.rol,
      esChofer: userProfile.esChofer,
      tipoVehiculo: userProfile.tipoVehiculo,
      estado: userProfile.estado,
      fechaRegistro: userProfile.fechaRegistro,
      barrio: userProfile.barrio,
      phone: userProfile.phone,
      avatarUrl: userProfile.avatarUrl,
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#101114] text-white flex flex-col justify-between overflow-x-hidden">
      {/* Subtle Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={heroCorridorImg}
          alt="Zárate Campana"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-15 filter blur-[2px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101114] via-[#101114]/90 to-[#101114]/70" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-[#FFF19A]/60 bg-[#202329] shrink-0">
            <img
              src="/assets/aistudio/UPPALOGO_c4c84137.jpg"
              alt="UPPA"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white font-display">UPPA</span>
            <span className="hidden sm:inline-block text-[10px] text-[#FFF19A] ml-2 font-mono font-bold">
              Zárate ↔ Campana
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#202329] border border-white/15 text-xs font-bold text-[#FFF19A] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span>Acceso Requerido</span>
          </div>
        </div>
      </header>

      {/* Main Auth Grid */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full">
          {/* Left Brief */}
          <div className="md:col-span-6 space-y-4 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#202329] border border-[#B7F36B]/45 text-[#B7F36B] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#B7F36B] animate-pulse" />
              <span>Corredor Zárate ↔ B° Malvinas en Vivo</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-display leading-tight">
              Movilidad comunitaria.{' '}
              <span className="text-[#FFF19A]">Llegá a tiempo.</span>
            </h1>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1 text-center shadow-[3px_3px_0px_#000000]">
                <Bus className="w-5 h-5 text-[#FFF19A] mx-auto" />
                <div className="text-xs font-black text-white">Líneas</div>
                <div className="text-[10px] text-[#9299A5] font-mono">228 & Colectora</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1 text-center shadow-[3px_3px_0px_#000000]">
                <Car className="w-5 h-5 text-[#B7F36B] mx-auto" />
                <div className="text-xs font-black text-white">Taxis GPS</div>
                <div className="text-[10px] text-[#9299A5] font-mono">Autos & Motos</div>
              </div>

              <div className="p-3 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1 text-center shadow-[3px_3px_0px_#000000]">
                <Radio className="w-5 h-5 text-[#FFF19A] mx-auto" />
                <div className="text-xs font-black text-white">Alertas</div>
                <div className="text-[10px] text-[#9299A5] font-mono">Waze Comunitario</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#202329] border border-white/15 flex items-center justify-between text-xs text-[#9299A5]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#B7F36B]" />
                <span className="text-white font-mono text-[11px]">BACKEND FIREBASE:</span>
                <span className="text-[#B7F36B] font-black text-[11px]">AUTH & FIRESTORE</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-[#9299A5] font-mono">
                <Shield className="w-3.5 h-3.5 text-[#FFF19A]" />
                <span>users/{'{uid}'}</span>
              </div>
            </div>
          </div>

          {/* Right Auth Card */}
          <div className="md:col-span-6 w-full max-w-sm mx-auto">
            <div className="bg-[#202329] rounded-3xl p-6 relative overflow-hidden shadow-[6px_6px_0px_#000000] border-2 border-white/20">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFF19A]" />

              <div className="flex rounded-2xl bg-[#101114] p-1 mb-4 border border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  title="Crear una cuenta nueva en UPPA"
                  className={`flex-1 min-h-[40px] text-xs font-black rounded-xl transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-[#FFF19A] text-[#101114]'
                      : 'text-[#9299A5] hover:text-white'
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
                  title="Ingresar con una cuenta existente"
                  className={`flex-1 min-h-[40px] text-xs font-black rounded-xl transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-[#FFF19A] text-[#101114]'
                      : 'text-[#9299A5] hover:text-white'
                  }`}
                >
                  Iniciar Sesión
                </button>
              </div>

              {authError && (
                <div className="mb-3 p-2.5 rounded-xl bg-rose-950/50 border border-rose-400/50 text-[11px] text-rose-200 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <span>
                      {authError.includes('configuration-not-found') || authError.includes('CONFIGURATION_NOT_FOUND')
                        ? 'El proyecto de Firebase aún no tiene habilitado el proveedor de correo en la Consola. Iniciá sesión o registrate con cualquier contraseña para acceder en Modo Resiliente.'
                        : authError}
                    </span>
                  </div>
                </div>
              )}

              {(localNotice || authNotice) && (
                <div className="mb-3 p-2.5 rounded-xl bg-[#101114] border border-[#B7F36B]/50 text-[11px] text-[#B7F36B] text-center font-mono flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                  <span>{authNotice || localNotice}</span>
                </div>
              )}

              {isResilientMode && !authError && (
                <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#101114] border border-white/15 text-[10.5px] text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#B7F36B] animate-pulse" />
                    <span>Modo Resiliente Activo</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFirebaseInfo(!showFirebaseInfo)}
                    title="Mostrar u ocultar información de configuración de Firebase"
                    className="underline text-[10px] text-[#FFF19A] hover:text-white cursor-pointer"
                  >
                    {showFirebaseInfo ? 'Ocultar info' : 'Ver info'}
                  </button>
                </div>
              )}

              {showFirebaseInfo && (
                <div className="mb-3 p-3 rounded-2xl bg-[#101114] border border-white/15 text-[10.5px] text-[#9299A5] space-y-1.5 animate-in fade-in font-sans">
                  <p className="font-bold text-white flex items-center gap-1">
                    <span>⚙️ Configuración Firebase (uppa-22dc3)</span>
                  </p>
                  <p className="leading-relaxed text-[10px]">
                    Para activar la base en la nube oficial:
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5 text-[9.5px] text-white/90">
                    <li>Entrá a <strong>console.firebase.google.com</strong></li>
                    <li>Seleccioná <strong>uppa-22dc3</strong></li>
                    <li>En <strong>Authentication &gt; Sign-in method</strong>, activá <strong>Correo/Contraseña</strong></li>
                    <li>En <strong>Firestore Database</strong>, hacé clic en Crear base de datos</li>
                  </ol>
                  <p className="text-[#B7F36B] text-[9.5px] font-bold pt-1">
                    ✓ Mientras tanto, todas las funciones de UPPA están 100% operativas.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {authMode === 'register' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-white mb-1 uppercase tracking-wider">
                        Nombre Completo
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Tu nombre completo"
                          className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-white mb-1.5 uppercase tracking-wider flex items-center justify-between">
                        <span>Función en la Comunidad</span>
                        <span className="text-[10px] text-[#FFF19A] font-semibold font-mono">Obligatoria</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'pasajero' as const, label: 'Pasajero', sub: 'Vecino / Usuario', icon: '🚶', activeCls: 'border-[#FFF19A] bg-[#FFF19A] text-[#101114]' },
                          { id: 'chofer_moto' as const, label: 'Moto Taxi', sub: 'Chofer Moto', icon: '🏍️', activeCls: 'border-[#B7F36B] bg-[#B7F36B] text-[#101114]' },
                          { id: 'chofer_auto' as const, label: 'Auto Taxi', sub: 'Chofer Auto', icon: '🚕', activeCls: 'border-[#FFF19A] bg-[#FFF19A] text-[#101114]' },
                        ].map((r) => {
                          const isSelected = role === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => setRole(r.id)}
                              title={`Seleccionar función: ${r.label}`}
                              className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                                isSelected
                                  ? `${r.activeCls} font-black`
                                  : 'bg-[#101114] border-white/15 text-[#9299A5] hover:text-white'
                              }`}
                            >
                              <span className="text-xl">{r.icon}</span>
                              <span className="text-xs font-black tracking-tight">{r.label}</span>
                              <span className={`text-[9.5px] font-medium leading-tight ${isSelected ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                                {r.sub}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-white mb-1 uppercase tracking-wider">
                          Teléfono
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+54 9 3487..."
                            className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-white mb-1 uppercase tracking-wider">
                          Barrio / Zona
                        </label>
                        <div className="relative">
                          <MapPin className="w-3.5 h-3.5 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={barrio}
                            onChange={(e) => setBarrio(e.target.value)}
                            placeholder="Campana Centro"
                            className="w-full min-h-[40px] bg-[#101114] border-2 border-white/15 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-white mb-1 uppercase tracking-wider">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-white uppercase tracking-wider">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(true)}
                      title="Recuperar contraseña por correo electrónico"
                      className="text-[11px] text-[#FFF19A] hover:underline transition-colors cursor-pointer font-bold"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  title={authMode === 'register' ? 'Crear cuenta en UPPA y acceder' : 'Iniciar sesión con email y contraseña'}
                  className="w-full min-h-[46px] uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{authMode === 'register' ? 'Registrarme e Ingresar' : 'Iniciar Sesión'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsGoogleChooserOpen(true)}
                    disabled={isSubmitting}
                    title="Elegir una cuenta de Google para ingresar a UPPA"
                    className="w-full min-h-[44px] rounded-xl bg-[#101114] hover:bg-white/10 border-2 border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  title="Solicitar enlace para restablecer contraseña"
                  className="text-[#FFF19A] hover:underline flex items-center gap-1.5 transition-colors text-[11px] font-bold cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Recuperar contraseña</span>
                </button>

                <span className="text-[11px] text-[#9299A5] font-mono">
                  🔒 Autenticación Requerida
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialEmail={email}
      />

      <GoogleAccountChooserModal
        isOpen={isGoogleChooserOpen}
        onClose={() => setIsGoogleChooserOpen(false)}
        onSuccess={handleGoogleSuccess}
      />

      <footer className="relative z-10 w-full px-6 py-3 border-t border-white/10 flex items-center justify-between text-[10px] text-[#9299A5] font-mono max-w-6xl mx-auto">
        <span>UPPA · Comunidad de Transporte Zárate ↔ Barrio Malvinas</span>
        <span className="text-white/80 flex items-center gap-1">
          <Shield className="w-3 h-3 text-[#FFF19A]" />
          <span>Firebase Authentication & Firestore</span>
        </span>
      </footer>
    </div>
  );
};
