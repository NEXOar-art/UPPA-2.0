import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ArrowRight, Shield, CheckCircle, Globe, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';

export interface SavedGoogleAccount {
  email: string;
  name: string;
  avatarUrl?: string;
  lastUsed?: number;
}

interface GoogleAccountChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

const STORAGE_SAVED_ACCOUNTS_KEY = 'uppa_google_saved_accounts';

export const GoogleAccountChooserModal: React.FC<GoogleAccountChooserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { loginWithGoogle } = useAuth();

  const [savedAccounts, setSavedAccounts] = useState<SavedGoogleAccount[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [popupNotice, setPopupNotice] = useState<string | null>(null);

  // Load saved accounts from localStorage on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setPopupNotice(null);
    setIsLoading(false);

    try {
      const stored = localStorage.getItem(STORAGE_SAVED_ACCOUNTS_KEY);
      if (stored) {
        const parsed: SavedGoogleAccount[] = JSON.parse(stored);
        // Filtrar cualquier cuenta default no deseada
        const filtered = parsed.filter(
          (a) => a.email && a.email !== 'gastonrobertogimenez@gmail.com'
        );
        setSavedAccounts(filtered);
        if (filtered.length === 0) {
          setIsAddingNew(true);
        } else {
          setIsAddingNew(false);
        }
      } else {
        setSavedAccounts([]);
        setIsAddingNew(true);
      }
    } catch {
      setSavedAccounts([]);
      setIsAddingNew(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const saveAccountToHistory = (account: SavedGoogleAccount) => {
    try {
      const existing = savedAccounts.filter(
        (a) => a.email.toLowerCase() !== account.email.toLowerCase()
      );
      const updated = [{ ...account, lastUsed: Date.now() }, ...existing].slice(0, 5);
      setSavedAccounts(updated);
      localStorage.setItem(STORAGE_SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const removeAccountFromHistory = (e: React.MouseEvent, emailToRemove: string) => {
    e.stopPropagation();
    try {
      const updated = savedAccounts.filter(
        (a) => a.email.toLowerCase() !== emailToRemove.toLowerCase()
      );
      setSavedAccounts(updated);
      localStorage.setItem(STORAGE_SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
      if (updated.length === 0) {
        setIsAddingNew(true);
      }
    } catch {}
  };

  // Try official Google Popup with select_account prompt
  const handleOfficialGooglePopup = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setPopupNotice(null);

    try {
      // loginWithGoogle() triggers signInWithPopup(auth, googleProvider)
      const user = await loginWithGoogle();

      if (user && user.email) {
        saveAccountToHistory({
          email: user.email,
          name: user.name || user.nombre || user.email.split('@')[0],
          avatarUrl: user.avatarUrl,
        });
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google popup error:', err);
      const msg = err.message || '';
      if (
        msg.includes('popup-blocked') ||
        msg.includes('blocked') ||
        msg.includes('unauthorized-domain') ||
        msg.includes('cancelled')
      ) {
        setPopupNotice(
          'La ventana emergente no se pudo abrir o fue bloqueada por el navegador. Podés escribir o elegir tu cuenta de Google acá abajo para acceder directamente.'
        );
        setIsAddingNew(true);
      } else {
        setErrorMessage(msg || 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login with a selected account from the saved list
  const handleSelectAccount = async (account: SavedGoogleAccount) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await loginWithGoogle(undefined, account.email, account.name);
      saveAccountToHistory(account);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al autenticar con la cuenta seleccionada.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login with a newly typed Google account
  const handleAddNewAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanName = newName.trim() || cleanEmail.split('@')[0] || 'Usuario Google';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Por favor ingresá una dirección de correo válida de Google.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithGoogle(undefined, cleanEmail, cleanName);
      saveAccountToHistory({
        email: cleanEmail,
        name: cleanName,
      });
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al ingresar con la cuenta de Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f121d] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Google Style Header */}
        <div className="p-6 pb-4 border-b border-slate-800 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Google Icon Logo */}
          <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7" viewBox="0 0 24 24">
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
          </div>

          <h3 className="text-lg font-bold text-white font-display">
            Elegí una cuenta de Google
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Para continuar a <strong className="text-sky-300">UPPA Transporte Comunitario</strong>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Notifications / Errors */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {popupNotice && (
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{popupNotice}</span>
            </div>
          )}

          {/* List of Saved Google Accounts */}
          {savedAccounts.length > 0 && !isAddingNew && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Cuentas utilizadas en este dispositivo
              </span>
              <div className="space-y-1.5">
                {savedAccounts.map((account) => (
                  <div
                    key={account.email}
                    onClick={() => handleSelectAccount(account)}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-sky-500/15 border border-white/5 hover:border-sky-400/50 flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm text-sm uppercase">
                        {account.name ? account.name.charAt(0) : account.email.charAt(0)}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-bold text-white truncate group-hover:text-sky-200">
                          {account.name || 'Usuario Google'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate font-mono">
                          {account.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => removeAccountFromHistory(e, account.email)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Quitar de la lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    setErrorMessage(null);
                  }}
                  className="w-full py-2.5 px-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-sky-400" />
                  <span>Usar otra cuenta de Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleOfficialGooglePopup}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 text-xs font-bold text-sky-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <Globe className="w-4 h-4 text-sky-400" />
                  )}
                  <span>Abrir ventana emergente de Google</span>
                </button>
              </div>
            </div>
          )}

          {/* Form to enter a new / personal Google Account */}
          {(isAddingNew || savedAccounts.length === 0) && (
            <form onSubmit={handleAddNewAccountSubmit} className="space-y-3.5 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Tu correo electrónico de Google (@gmail.com) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#161a29] border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Nombre Completo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Tu nombre y apellido"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#161a29] border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>Ingresar con esta cuenta de Google</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {savedAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-300 font-medium transition-colors cursor-pointer"
                    >
                      ← Volver a mis cuentas
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleOfficialGooglePopup}
                    disabled={isLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/20 text-[11px] text-sky-300 font-medium transition-colors cursor-pointer"
                  >
                    Abrir ventana emergente
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Privacy Note */}
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10.5px] text-slate-400 flex items-center gap-2 leading-relaxed">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              UPPA conecta tu cuenta personal de Google sin compartir contraseñas. Podés cambiar de cuenta cuando lo desees.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
