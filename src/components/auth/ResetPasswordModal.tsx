import React, { useState } from 'react';
import { authService } from '../../services/authService';
import {
  X,
  KeyRound,
  Check,
  Mail,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onPasswordGeneratedAndLogin?: (user: any) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsSending(true);
    setErrorMessage(null);

    try {
      await authService.resetPassword(cleanEmail);
      setIsSent(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#202329] border-2 border-white/20 rounded-3xl p-6 text-white shadow-[0_8px_0_rgba(0,0,0,0.65)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFF19A]" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#101114] border border-[#FFF19A]/45 flex items-center justify-center text-[#FFF19A]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-display">Recuperar Contraseña</h2>
              <p className="text-[11px] text-[#9299A5] font-mono">Firebase Authentication</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSent(false);
              setErrorMessage(null);
              onClose();
            }}
            title="Cerrar ventana de recuperación de contraseña"
            className="w-9 h-9 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSent ? (
          <div className="pt-4 space-y-4">
            <div className="p-3 rounded-xl bg-[#101114] border border-[#FFF19A]/35 text-xs text-white/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#FFF19A] shrink-0 mt-0.5" />
              <span>
                Ingresá tu correo electrónico. Te enviaremos un enlace oficial de{' '}
                <strong className="text-[#FFF19A]">Firebase</strong> para restablecer tu contraseña de forma segura y privada.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-400/50 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-white mb-1.5 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9299A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@gmail.com"
                    className="w-full min-h-[44px] bg-[#101114] border-2 border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending}
                title="Enviar enlace de recuperación a tu correo"
                className="w-full min-h-[46px] uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Enviar Correo de Recuperación</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="pt-4 space-y-4 animate-in fade-in duration-200">
            <div className="p-5 rounded-2xl bg-[#101114] border-2 border-[#B7F36B]/45 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#B7F36B]/20 text-[#B7F36B] mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div>
                <div className="text-sm font-black text-[#B7F36B]">¡Correo enviado con éxito!</div>
                <div className="text-xs text-[#9299A5] mt-1">
                  Enviamos las instrucciones para restablecer tu contraseña a:
                </div>
                <div className="text-xs font-mono font-bold text-white mt-1 bg-[#202329] py-1 px-3 rounded-lg inline-block border border-white/15">
                  {email}
                </div>
                <p className="text-[11px] text-[#9299A5] mt-2">
                  Revisá tu bandeja de entrada (y la carpeta de spam si es necesario) para crear tu nueva clave.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSent(false);
                onClose();
              }}
              title="Cerrar y volver al inicio de sesión"
              className="w-full min-h-[46px] uppa-cta-green font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Entendido, volver al inicio</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
