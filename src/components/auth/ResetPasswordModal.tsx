import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';
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
      await sendPasswordResetEmail(auth, cleanEmail);
      setIsSent(true);
    } catch (err: any) {
      let msg = 'No se pudo enviar el correo de recuperación.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No existe una cuenta registrada con ese correo electrónico.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'El formato de correo no es válido.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0d14]/95 border border-sky-400/30 rounded-3xl p-6 text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Subtle top pastel ambient line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-400/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">Recuperar Contraseña</h2>
              <p className="text-[11px] text-slate-400 font-mono">Firebase Authentication</p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsSent(false);
              setErrorMessage(null);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {!isSent ? (
          <div className="pt-4 space-y-4">
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
              <span>
                Ingresá tu correo electrónico. Te enviaremos un enlace oficial de{' '}
                <strong className="text-sky-100">Firebase</strong> para restablecer tu contraseña de forma segura y privada.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSendResetEmail} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@gmail.com"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full h-11 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-97 transition-all cursor-pointer disabled:opacity-50"
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
          /* Success Screen */
          <div className="pt-4 space-y-4 animate-in fade-in duration-200">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-400/20 text-emerald-300 mx-auto flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div>
                <div className="text-sm font-bold text-emerald-200">
                  ¡Correo enviado con éxito!
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Enviamos las instrucciones para restablecer tu contraseña a:
                </div>
                <div className="text-xs font-mono font-bold text-white mt-1 bg-black/30 py-1 px-3 rounded-lg inline-block border border-white/10">
                  {email}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
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
              className="w-full h-11 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
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
