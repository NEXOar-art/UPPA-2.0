import React, { useState, useEffect } from 'react';
import {
  getUppaDatabaseUsers,
  saveUserToUppaDatabase,
  deleteUserFromUppaDatabase,
  generateNewPasswordForUser,
  resetUppaDatabase,
  DatabaseUser,
} from '../../data/database';
import { UserRole } from '../../types';
import {
  Database,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  UserPlus,
  RefreshCw,
  Download,
  Shield,
  Car,
  User as UserIcon,
  Sparkles,
  X,
} from 'lucide-react';

interface UppaDatabaseViewerProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
  onSelectUserToLogin?: (user: DatabaseUser) => void;
  currentUserRole?: UserRole;
}

export const UppaDatabaseViewer: React.FC<UppaDatabaseViewerProps> = ({
  isOpen = true,
  onClose,
  isEmbedded = false,
  onSelectUserToLogin,
  currentUserRole = 'admin',
}) => {
  const [users, setUsers] = useState<DatabaseUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('passenger');
  const [newPhone, setNewPhone] = useState('+54 9 3487 00-0000');
  const [newBarrio, setNewBarrio] = useState('Barrio Malvinas, Campana');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = () => {
    setUsers(getUppaDatabaseUsers());
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('uppa-database-updated', handleUpdate);
    return () => window.removeEventListener('uppa-database-updated', handleUpdate);
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCopyPassword = (userId: string, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Contraseña copiada al portapapeles');
  };

  const handleRegeneratePassword = (userEmail: string) => {
    const res = generateNewPasswordForUser(userEmail);
    if (res.success && res.newPassword) {
      loadData();
      showToast(`Nueva contraseña generada: ${res.newPassword}`);
    }
  };

  const handleDelete = (userId: string, userName: string) => {
    if (confirm(`¿Eliminar al usuario "${userName}" de la BASE DE DATO DE UPPA?`)) {
      deleteUserFromUppaDatabase(userId);
      loadData();
      showToast('Usuario eliminado de la base de datos');
    }
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    saveUserToUppaDatabase({
      name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword.trim() || undefined,
      role: newRole,
      phone: newPhone.trim(),
      barrio: newBarrio.trim(),
    });

    loadData();
    setIsAddUserModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    showToast('Usuario guardado en BASE DE DATO DE UPPA');
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(users, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `base_de_datos_uppa_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Copia de BASE DE DATO DE UPPA descargada');
  };

  const handleResetDefaults = () => {
    if (confirm('¿Restablecer BASE DE DATO DE UPPA a los registros iniciales?')) {
      resetUppaDatabase();
      loadData();
      showToast('Base de datos restablecida');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.barrio.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const passengersCount = users.filter((u) => u.role === 'passenger').length;
  const driversCount = users.filter((u) => u.role === 'driver').length;
  const adminsCount = users.filter((u) => u.role === 'admin').length;

  const content = (
    <div className="flex flex-col h-full bg-[#080b12] text-slate-100">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2 rounded-2xl shadow-2xl text-xs flex items-center gap-2 border-emerald-400/40 text-emerald-200">
          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-white/5 bg-[#0b0f19] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-md">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white font-display tracking-tight">
                  BASE DE DATO DE UPPA
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CONECTADA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Almacén centralizado de usuarios, credenciales, roles y contraseñas seguras
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Nuevo Usuario</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-xl glass-button text-xs text-slate-300 hover:text-white flex items-center gap-1.5"
            title="Descargar copia de la base de datos"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar JSON</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="p-1.5 rounded-xl glass-button text-xs text-slate-400 hover:text-amber-300"
            title="Restablecer base de datos inicial"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {!isEmbedded && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0a0d16]/70 border-b border-white/5">
        <div className="p-3 rounded-2xl glass-card border-white/5">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Total Registros</div>
          <div className="text-xl font-extrabold text-white font-display mt-0.5">{users.length}</div>
        </div>

        <div className="p-3 rounded-2xl glass-card border-white/5">
          <div className="text-[10px] text-sky-400 uppercase font-mono">Pasajeros</div>
          <div className="text-xl font-extrabold text-sky-300 font-display mt-0.5">{passengersCount}</div>
        </div>

        <div className="p-3 rounded-2xl glass-card border-white/5">
          <div className="text-[10px] text-emerald-400 uppercase font-mono">Conductores GPS</div>
          <div className="text-xl font-extrabold text-emerald-300 font-display mt-0.5">{driversCount}</div>
        </div>

        <div className="p-3 rounded-2xl glass-card border-white/5">
          <div className="text-[10px] text-purple-400 uppercase font-mono">Admins & Anunciantes</div>
          <div className="text-xl font-extrabold text-purple-300 font-display mt-0.5">{adminsCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o barrio..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'passenger', label: '👤 Pasajeros' },
            { id: 'driver', label: '🚕 Conductores' },
            { id: 'admin', label: '🛡️ Admins' },
            { id: 'advertiser', label: '📢 Anunciantes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                roleFilter === tab.id
                  ? 'bg-sky-400/20 text-sky-200 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white glass-pill'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No se encontraron usuarios en BASE DE DATO DE UPPA con este criterio.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isRevealed = revealedPasswords[u.id];
            return (
              <div
                key={u.id}
                className="p-4 rounded-2xl glass-card border-white/5 hover:border-white/15 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: User info */}
                <div className="flex items-start gap-3">
                  <img
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.name}`}
                    alt={u.name}
                    className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{u.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          u.role === 'driver'
                            ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                            : u.role === 'admin'
                            ? 'bg-purple-500/15 border-purple-400/30 text-purple-300'
                            : u.role === 'advertiser'
                            ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                            : 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-mono mt-0.5">{u.email}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                      <span>📍 {u.barrio}</span>
                      <span>📞 {u.phone}</span>
                      <span className="font-mono text-[10px] text-slate-500">Reg: {u.registeredAt}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Credentials & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                  {/* Password viewer & generator */}
                  <div className="p-2 rounded-xl bg-[#06080e] border border-white/10 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
                      {isRevealed ? u.password : '••••••••••••'}
                    </span>

                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(u.id)}
                      className="p-1 text-slate-400 hover:text-white"
                      title={isRevealed ? 'Ocultar' : 'Mostrar contraseña'}
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPassword(u.id, u.password)}
                      className="p-1 text-slate-400 hover:text-sky-300"
                      title="Copiar contraseña"
                    >
                      {copiedId === u.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Regenerate Password Button */}
                  <button
                    type="button"
                    onClick={() => handleRegeneratePassword(u.email)}
                    className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-400/20 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                    title="Generar nueva contraseña para este usuario en la base de datos"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generar otra clave</span>
                  </button>

                  {/* Switch to this user */}
                  {onSelectUserToLogin && (
                    <button
                      type="button"
                      onClick={() => onSelectUserToLogin(u)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 text-xs font-semibold transition-all active:scale-95"
                    >
                      Iniciar como este usuario
                    </button>
                  )}

                  {/* Delete button */}
                  {users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(u.id, u.name)}
                      className="p-1.5 rounded-xl hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a0d14] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white font-display">
                Insertar en BASE DE DATO DE UPPA
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="pt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Marcelo Pasajero"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="marcelo@uppa.ar"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Contraseña (opcional, si vacía se auto-genera)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para auto-generar"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-[#121520] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="passenger">👤 Pasajero</option>
                  <option value="driver">🚕 Conductor</option>
                  <option value="admin">🛡️ Admin</option>
                  <option value="advertiser">📢 Anunciante</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="flex-1 py-2 rounded-xl glass-button text-xs text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Guardar en Base de Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[85vh] rounded-3xl border border-sky-400/30 overflow-hidden shadow-2xl flex flex-col">
        {content}
      </div>
    </div>
  );
};
