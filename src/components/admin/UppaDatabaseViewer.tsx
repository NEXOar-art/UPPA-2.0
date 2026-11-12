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
  Sparkles,
  X,
  AlertTriangle,
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
}) => {
  const [users, setUsers] = useState<DatabaseUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: string; name: string } | null>(null);
  const [confirmResetDb, setConfirmResetDb] = useState(false);

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

  const handleConfirmDelete = () => {
    if (!confirmDeleteUser) return;
    deleteUserFromUppaDatabase(confirmDeleteUser.id);
    setConfirmDeleteUser(null);
    loadData();
    showToast('Usuario eliminado de la base de datos');
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

  const handleConfirmResetDefaults = () => {
    resetUppaDatabase();
    setConfirmResetDb(false);
    loadData();
    showToast('Base de datos restablecida');
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
    <div className="flex flex-col h-full bg-[#101114] text-white">
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#202329] px-4 py-2 rounded-2xl shadow-[4px_4px_0px_#000000] text-xs flex items-center gap-2 border-2 border-[#B7F36B] text-[#B7F36B] font-bold">
          <Sparkles className="w-3.5 h-3.5 text-[#B7F36B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#202329] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/45 flex items-center justify-center text-[#FFF19A]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white font-display tracking-tight uppercase">
                  BASE DE DATO DE UPPA
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black font-mono bg-[#B7F36B]/15 border border-[#B7F36B]/45 text-[#B7F36B]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B7F36B] animate-pulse" />
                  CONECTADA
                </span>
              </div>
              <p className="text-xs text-[#9299A5]">
                Almacén centralizado de usuarios, credenciales y roles
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsAddUserModalOpen(true)}
            title="Agregar nuevo usuario a la base de datos UPPA"
            className="px-3.5 min-h-[40px] rounded-xl uppa-cta-yellow font-black text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Nuevo Usuario</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 min-h-[40px] rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
            title="Descargar copia JSON de la base de datos"
          >
            <Download className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span className="hidden sm:inline">Exportar JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmResetDb((prev) => !prev)}
            className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-xs text-[#9299A5] hover:text-[#FFF19A] flex items-center justify-center cursor-pointer"
            title="Restablecer base de datos inicial"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {!isEmbedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Cerrar visor de base de datos"
              className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Reset Confirmation */}
      {confirmResetDb && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/40 border-2 border-rose-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-rose-200 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>¿Restablecer BASE DE DATO DE UPPA a los registros iniciales?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmResetDb(false)}
              title="Cancelar restablecimiento"
              className="px-3 min-h-[36px] rounded-lg bg-[#202329] border border-white/15 text-white font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmResetDefaults}
              title="Confirmar restablecimiento de base de datos"
              className="px-3 min-h-[36px] rounded-lg bg-rose-500 hover:bg-rose-400 text-[#101114] font-black cursor-pointer"
            >
              Confirmar Restablecer
            </button>
          </div>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#101114] border-b border-white/10">
        <div className="p-3 rounded-2xl bg-[#202329] border border-white/15">
          <div className="text-[10px] text-[#9299A5] uppercase font-mono">Total Registros</div>
          <div className="text-xl font-black text-white font-display mt-0.5">{users.length}</div>
        </div>

        <div className="p-3 rounded-2xl bg-[#202329] border border-white/15">
          <div className="text-[10px] text-[#FFF19A] uppercase font-mono">Pasajeros</div>
          <div className="text-xl font-black text-[#FFF19A] font-display mt-0.5">{passengersCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-[#202329] border border-white/15">
          <div className="text-[10px] text-[#B7F36B] uppercase font-mono">Conductores GPS</div>
          <div className="text-xl font-black text-[#B7F36B] font-display mt-0.5">{driversCount}</div>
        </div>

        <div className="p-3 rounded-2xl bg-[#202329] border border-white/15">
          <div className="text-[10px] text-[#9299A5] uppercase font-mono">Admins & Anunciantes</div>
          <div className="text-xl font-black text-white font-display mt-0.5">{adminsCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o barrio..."
            className="w-full min-h-[40px] bg-[#202329] border-2 border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
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
              type="button"
              onClick={() => setRoleFilter(tab.id as any)}
              title={`Filtrar lista por rol: ${tab.label}`}
              className={`px-3 min-h-[38px] rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                roleFilter === tab.id
                  ? 'bg-[#FFF19A] text-[#101114] border-white/25 font-black'
                  : 'bg-[#202329] text-[#9299A5] hover:text-white border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Delete Confirmation */}
      {confirmDeleteUser && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/40 border-2 border-rose-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-rose-200 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>¿Eliminar a "{confirmDeleteUser.name}" de BASE DE DATO DE UPPA?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteUser(null)}
              title="Cancelar eliminación"
              className="px-3 min-h-[36px] rounded-lg bg-[#202329] border border-white/15 text-white font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              title={`Confirmar eliminación de ${confirmDeleteUser.name}`}
              className="px-3 min-h-[36px] rounded-lg bg-rose-500 hover:bg-rose-400 text-[#101114] font-black cursor-pointer"
            >
              Sí, Eliminar
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-[#9299A5] text-xs font-mono">
            No se encontraron usuarios en BASE DE DATO DE UPPA con este criterio.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isRevealed = revealedPasswords[u.id];
            return (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 hover:border-white/25 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[4px_4px_0px_#000000]"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.name}`}
                    alt={u.name}
                    className="w-10 h-10 rounded-xl bg-[#101114] border border-white/15 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{u.name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-black border ${
                          u.role === 'driver'
                            ? 'bg-[#B7F36B]/15 border-[#B7F36B]/45 text-[#B7F36B]'
                            : u.role === 'admin'
                            ? 'bg-[#FFF19A]/15 border-[#FFF19A]/45 text-[#FFF19A]'
                            : u.role === 'advertiser'
                            ? 'bg-white/10 border-white/25 text-white'
                            : 'bg-[#101114] border-white/15 text-[#9299A5]'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-xs text-white/90 font-mono mt-0.5">{u.email}</div>
                    <div className="text-[11px] text-[#9299A5] mt-1 flex items-center gap-3 flex-wrap">
                      <span>📍 {u.barrio}</span>
                      <span>📞 {u.phone}</span>
                      <span className="font-mono text-[10px]">Reg: {u.registeredAt}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Credentials & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                  <div className="p-2 rounded-xl bg-[#101114] border border-white/15 flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-[#FFF19A]" />
                    <span className="text-xs font-mono font-bold tracking-wider text-white">
                      {isRevealed ? u.password : '••••••••••••'}
                    </span>

                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(u.id)}
                      className="p-1.5 text-[#9299A5] hover:text-white cursor-pointer"
                      title={isRevealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPassword(u.id, u.password)}
                      className="p-1.5 text-[#9299A5] hover:text-[#FFF19A] cursor-pointer"
                      title="Copiar contraseña al portapapeles"
                    >
                      {copiedId === u.id ? (
                        <Check className="w-3.5 h-3.5 text-[#B7F36B]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRegeneratePassword(u.email)}
                    className="px-3 min-h-[38px] rounded-xl bg-[#101114] hover:bg-white/10 text-[#FFF19A] border border-[#FFF19A]/35 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Generar nueva contraseña para este usuario"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generar otra clave</span>
                  </button>

                  {onSelectUserToLogin && (
                    <button
                      type="button"
                      onClick={() => onSelectUserToLogin(u)}
                      title={`Iniciar sesión como ${u.name}`}
                      className="px-3 min-h-[38px] rounded-xl uppa-cta-green text-xs font-black transition-all active:scale-95 cursor-pointer"
                    >
                      Iniciar como este usuario
                    </button>
                  )}

                  {users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteUser({ id: u.id, name: u.name })}
                      className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-rose-500/20 text-[#9299A5] hover:text-rose-400 border border-white/10 transition-colors flex items-center justify-center cursor-pointer"
                      title={`Eliminar registro de ${u.name}`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#202329] border-2 border-white/20 rounded-3xl p-6 shadow-[0_8px_0_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-black text-white font-display uppercase tracking-tight">
                Insertar en BASE DE DATO DE UPPA
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                title="Cerrar formulario de nuevo usuario"
                className="w-9 h-9 rounded-xl bg-[#101114] border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="pt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-white mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Marcelo Pasajero"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FFF19A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="marcelo@uppa.ar"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FFF19A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white mb-1">
                  Contraseña (opcional, si vacía se auto-genera)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para auto-generar"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#FFF19A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white mb-1">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FFF19A] focus:outline-none"
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
                  title="Cancelar creación de usuario"
                  className="flex-1 min-h-[44px] rounded-xl bg-[#101114] border border-white/15 text-xs font-bold text-[#9299A5] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  title="Guardar usuario en la base de datos UPPA"
                  className="flex-2 min-h-[44px] px-4 rounded-xl uppa-cta-yellow font-black text-xs cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[85vh] rounded-3xl border-2 border-white/20 overflow-hidden shadow-[0_8px_0_rgba(0,0,0,0.65)] flex flex-col">
        {content}
      </div>
    </div>
  );
};
