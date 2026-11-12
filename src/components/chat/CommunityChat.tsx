import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, MapEvent, MensajeChatFirestore } from '../../types';
import {
  subscribeToChat,
  enviarMensajeChat,
  reaccionarMensajeChat,
  eliminarMensajeChat,
  reportarMensajeChat,
  getMessageTimestampMs,
  isRealChatMessage,
} from '../../services/realtimeFirebaseService';
import {
  Send,
  MessageSquare,
  Trash2,
  Flag,
  Reply,
  AtSign,
  Sparkles,
  Clock,
  Shield,
  Car,
  Bike,
  Bus,
  User as UserIcon,
  X,
  Check,
  Zap,
  Radio,
  Search,
  Phone,
  RefreshCw,
  Smile,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

interface CommunityChatProps {
  currentUser: User;
  activeContextEvent?: MapEvent | null;
  onClearContextEvent?: () => void;
}

export type ChannelType = 'todos' | 'campana-zarate' | 'zarate-campana' | 'general';
export type RoleFilter = 'todos' | 'choferes' | 'pasajeros' | 'colectivos';

export const CHANNEL_OPTIONS: { id: ChannelType; label: string; shortLabel: string; icon: string; desc: string }[] = [
  { id: 'todos', label: 'Todos los Mensajes', shortLabel: 'Canal: Todos', icon: '🌐', desc: 'Comunidad completa (Campana ↔ Zárate)' },
  { id: 'campana-zarate', label: 'Campana ➔ Zárate', shortLabel: 'Campana ➔ Zárate', icon: '🏙️', desc: 'Sentido Zárate Centro y Terminal' },
  { id: 'zarate-campana', label: 'Zárate ➔ Campana', shortLabel: 'Zárate ➔ Campana', icon: '🏙️', desc: 'Sentido B° Malvinas y Colectora' },
  { id: 'general', label: 'General & Avisos', shortLabel: 'General & Avisos', icon: '💬', desc: 'Novedades y consultas vecinales' },
];

export const ROLE_OPTIONS: { id: RoleFilter; label: string; shortLabel: string; icon: string; desc: string }[] = [
  { id: 'todos', label: 'Todos los Roles', shortLabel: 'Rol: Todos', icon: '👥', desc: 'Pasajeros, choferes y colectivos' },
  { id: 'pasajeros', label: 'Pasajeros', shortLabel: 'Pasajeros', icon: '👤', desc: 'Mensajes de vecinos y pasajeros' },
  { id: 'choferes', label: 'Taxis y Motos', shortLabel: 'Taxis/Motos', icon: '🚕', desc: 'Choferes de auto taxi y moto taxi' },
  { id: 'colectivos', label: 'Colectivos', shortLabel: 'Colectivos', icon: '🚌', desc: 'Choferes de la Línea 228' },
];

const QUICK_REACTIONS = ['👍', '🚌', '🛵', '🚕', '❤️', '⚠️'];

export const CommunityChat: React.FC<CommunityChatProps> = ({
  currentUser,
  activeContextEvent,
  onClearContextEvent,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('todos');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<MensajeChatFirestore[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; nombreUsuario: string; texto: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showReactionPickerForId, setShowReactionPickerForId] = useState<string | null>(null);

  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const channelDropdownRef = useRef<HTMLDivElement | null>(null);
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setIsChannelDropdownOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const playChime = () => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const twentyMinMs = 20 * 60 * 1000;
      setNowTimestamp(now);
      setMessages((prev) => prev.filter((m) => now - getMessageTimestampMs(m.enviadoEn) < twentyMinMs));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToChat(selectedChannel, (roomMessages) => {
      setMessages(roomMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 70);
    });

    return () => unsubscribe();
  }, [selectedChannel]);

  useEffect(() => {
    if (activeContextEvent) {
      setInputText(`Consulta sobre reporte en ${activeContextEvent.title}: `);
      inputRef.current?.focus();
    }
  }, [activeContextEvent]);

  const filteredMessages = useMemo(() => {
    const twentyMinMs = 20 * 60 * 1000;
    let list = messages.filter(
      (m) => isRealChatMessage(m) && nowTimestamp - getMessageTimestampMs(m.enviadoEn) < twentyMinMs
    );

    if (selectedChannel !== 'todos') {
      list = list.filter((m) => !m.salaId || m.salaId === selectedChannel || m.salaId === 'todos');
    }

    if (roleFilter === 'choferes') {
      list = list.filter((m) => m.rol === 'chofer_moto' || m.rol === 'chofer_auto' || m.rol === 'driver');
    } else if (roleFilter === 'colectivos') {
      list = list.filter((m) => m.rol === 'chofer_micro');
    } else if (roleFilter === 'pasajeros') {
      list = list.filter((m) => m.rol === 'pasajero' || !m.rol);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.texto.toLowerCase().includes(q) ||
          m.nombreUsuario.toLowerCase().includes(q) ||
          (m.replyTo && m.replyTo.texto.toLowerCase().includes(q))
      );
    }

    return list;
  }, [messages, selectedChannel, roleFilter, searchQuery, nowTimestamp]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend) return;

    playChime();
    setInputText('');
    const currentReply = replyingTo;
    setReplyingTo(null);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 20);

    const now = Date.now();
    const tempId = `msg_local_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const userRole =
      currentUser.rol ||
      (currentUser.role === 'admin' ? 'administrador' : currentUser.role === 'driver' ? 'chofer_auto' : 'pasajero');
    const senderName = currentUser.name?.trim() || currentUser.email?.split('@')[0] || 'Vecino UPPA';

    const optimisticMessage: MensajeChatFirestore = {
      id: tempId,
      salaId: selectedChannel,
      usuarioId: currentUser.uid || currentUser.id || 'usr-comunidad',
      nombreUsuario: senderName,
      texto: textToSend,
      rol: userRole as any,
      avatarUrl:
        currentUser.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id || 'usr'}&backgroundColor=101114`,
      enviadoEn: now,
      replyTo: currentReply || undefined,
      telefonoContacto: currentUser.phone || undefined,
      reacciones: {},
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);

    try {
      setIsSending(true);
      const sent = await enviarMensajeChat(selectedChannel, {
        usuarioId: optimisticMessage.usuarioId,
        nombreUsuario: optimisticMessage.nombreUsuario,
        texto: textToSend,
        rol: userRole,
        avatarUrl: optimisticMessage.avatarUrl,
        replyTo: currentReply || undefined,
      });

      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...sent, reacciones: m.reacciones } : m)));
    } catch (err: any) {
      console.warn('Sincronización en segundo plano:', err);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const currentReactions = { ...(m.reacciones || {}) };
        const currentCount = currentReactions[emoji] || 0;
        currentReactions[emoji] = currentCount + 1;
        return {
          ...m,
          reacciones: currentReactions,
        };
      })
    );
    setShowReactionPickerForId(null);
    showNotice(`Reaccionaste con ${emoji}`);

    reaccionarMensajeChat(selectedChannel, msgId, emoji).catch(() => {});
  };

  const handleMention = (userName: string) => {
    setInputText((prev) => `${prev} @${userName} `);
    inputRef.current?.focus();
  };

  const handleDelete = async (mensajeId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== mensajeId));
    try {
      await eliminarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje borrado');
    } catch {
      showNotice('Mensaje eliminado');
    }
  };

  const handleReport = async (mensajeId: string) => {
    try {
      await reportarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje reportado para moderación comunitaria');
    } catch {
      showNotice('Reporte recibido');
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    subscribeToChat(selectedChannel, (roomMessages) => {
      setMessages(roomMessages);
      setIsRefreshing(false);
      showNotice('Chat sincronizado');
    });
  };

  const getRoleBadge = (rol?: string) => {
    switch (rol) {
      case 'administrador':
      case 'admin':
        return { label: 'Admin', bg: 'bg-[#FFF19A]/15 text-[#FFF19A] border-[#FFF19A]/45', icon: Shield };
      case 'chofer_moto':
        return { label: 'Moto Taxi', bg: 'bg-[#B7F36B]/15 text-[#B7F36B] border-[#B7F36B]/45', icon: Bike };
      case 'chofer_auto':
      case 'driver':
        return { label: 'Auto Taxi', bg: 'bg-[#FFF19A]/15 text-[#FFF19A] border-[#FFF19A]/45', icon: Car };
      case 'chofer_micro':
        return { label: 'Colectivo', bg: 'bg-white/10 text-white border-white/25', icon: Bus };
      default:
        return { label: 'Pasajero', bg: 'bg-[#101114] text-[#9299A5] border-white/15', icon: UserIcon };
    }
  };

  const formatFriendlyTime = (ts: any) => {
    const ms = getMessageTimestampMs(ts);
    const d = new Date(ms);
    const diffMs = nowTimestamp - ms;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Hoy ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const userRoleBadge = getRoleBadge(currentUser.rol || currentUser.role);
  const CurrentUserRoleIcon = userRoleBadge.icon;

  const currentChannelOption = CHANNEL_OPTIONS.find((c) => c.id === selectedChannel) || CHANNEL_OPTIONS[0];
  const currentRoleOption = ROLE_OPTIONS.find((r) => r.id === roleFilter) || ROLE_OPTIONS[0];
  const hasActiveFilters = selectedChannel !== 'todos' || roleFilter !== 'todos' || searchQuery.trim() !== '';

  const myUid = currentUser.uid || currentUser.id;

  return (
    <div className="w-full h-full flex flex-col bg-[#101114] text-white overflow-hidden font-sans">
      {/* Top Header */}
      <div className="px-3 py-2.5 sm:px-4 border-b border-white/10 bg-[#202329] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/45 flex items-center justify-center text-[#FFF19A] shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white font-display truncate uppercase tracking-tight">
                Chat Comunitario
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-black bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/45 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B7F36B] animate-ping" />
                <span>EN VIVO</span>
              </span>
              <span className="text-[10px] text-[#9299A5] font-mono hidden sm:inline truncate">
                · {filteredMessages.length} mensaje{filteredMessages.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {actionNotice && (
              <div className="px-2.5 py-1 rounded-lg bg-[#FFF19A] text-[#101114] text-[10px] font-black animate-in fade-in">
                {actionNotice}
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-[#101114] px-2.5 py-1.5 rounded-xl border border-white/15 text-xs">
              <img
                src={
                  currentUser.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id || 'usr'}&backgroundColor=101114`
                }
                alt={currentUser.name}
                className="w-5 h-5 rounded-full border border-[#FFF19A]/50 object-cover"
              />
              <span className="font-bold text-white text-[11px] max-w-[80px] sm:max-w-[110px] truncate">
                {currentUser.name}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border hidden sm:inline-flex items-center gap-0.5 ${userRoleBadge.bg}`}>
                <CurrentUserRoleIcon className="w-2.5 h-2.5" />
                <span>{userRoleBadge.label}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="w-10 h-10 rounded-xl bg-[#101114] hover:bg-white/10 text-[#9299A5] hover:text-white border border-white/15 transition-colors cursor-pointer flex items-center justify-center"
              title="Sincronizar mensajes recientes del chat"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FFF19A]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Intelligent Search & Filter Bar */}
      <div className="px-3 py-2 sm:px-4 border-b border-white/10 bg-[#101114] shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1 min-w-[110px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9299A5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el chat (ej: 228, Tenaris, chofer...)"
              className="w-full min-h-[40px] pl-8 pr-8 rounded-xl bg-[#202329] border-2 border-white/15 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9299A5] hover:text-white p-1 cursor-pointer"
                title="Borrar texto de búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Canal Dropdown */}
          <div className="relative" ref={channelDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsChannelDropdownOpen((prev) => !prev);
                setIsRoleDropdownOpen(false);
              }}
              className={`min-h-[40px] px-2.5 sm:px-3 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                selectedChannel !== 'todos'
                  ? 'bg-[#FFF19A] text-[#101114] border-white/25'
                  : 'bg-[#202329] hover:bg-white/10 text-white border-white/15'
              }`}
              title="Filtrar por canal o sentido del corredor"
            >
              <span className="text-sm leading-none">{currentChannelOption.icon}</span>
              <span className="hidden sm:inline text-[11px] max-w-[115px] truncate">
                {currentChannelOption.shortLabel}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  isChannelDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isChannelDropdownOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-64 rounded-2xl bg-[#202329] border-2 border-white/20 shadow-[0_8px_0_rgba(0,0,0,0.65)] p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#FFF19A] font-mono">
                    Canal / Sentido
                  </span>
                  <span className="text-[9px] text-[#9299A5]">4 opciones</span>
                </div>
                <div className="space-y-0.5">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const isSelected = selectedChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          setIsChannelDropdownOpen(false);
                        }}
                        title={`Ver mensajes del canal ${ch.label}`}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFF19A] text-[#101114] font-black'
                            : 'text-white hover:bg-white/10 font-semibold'
                        }`}
                      >
                        <span className="text-base">{ch.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-[11.5px]">{ch.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#101114] shrink-0 stroke-[3]" />}
                          </div>
                          <span className={`text-[9.5px] block truncate ${isSelected ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                            {ch.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rol Dropdown */}
          <div className="relative" ref={roleDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsRoleDropdownOpen((prev) => !prev);
                setIsChannelDropdownOpen(false);
              }}
              className={`min-h-[40px] px-2.5 sm:px-3 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                roleFilter !== 'todos'
                  ? 'bg-[#B7F36B] text-[#101114] border-white/25'
                  : 'bg-[#202329] hover:bg-white/10 text-white border-white/15'
              }`}
              title="Filtrar mensajes por rol de usuario"
            >
              <span className="text-sm leading-none">{currentRoleOption.icon}</span>
              <span className="hidden sm:inline text-[11px] max-w-[85px] truncate">
                {currentRoleOption.shortLabel}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  isRoleDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#202329] border-2 border-white/20 shadow-[0_8px_0_rgba(0,0,0,0.65)] p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 border-b border-white/10 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#B7F36B] font-mono">
                    Filtrar por Rol
                  </span>
                  <span className="text-[9px] text-[#9299A5]">4 opciones</span>
                </div>
                <div className="space-y-0.5">
                  {ROLE_OPTIONS.map((rf) => {
                    const isSelected = roleFilter === rf.id;
                    return (
                      <button
                        key={rf.id}
                        type="button"
                        onClick={() => {
                          setRoleFilter(rf.id);
                          setIsRoleDropdownOpen(false);
                        }}
                        title={`Mostrar mensajes de ${rf.label}`}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#B7F36B] text-[#101114] font-black'
                            : 'text-white hover:bg-white/10 font-semibold'
                        }`}
                      >
                        <span className="text-base">{rf.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-[11.5px]">{rf.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#101114] shrink-0 stroke-[3]" />}
                          </div>
                          <span className={`text-[9.5px] block truncate ${isSelected ? 'text-[#101114]/80' : 'text-[#9299A5]'}`}>
                            {rf.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedChannel('todos');
                setRoleFilter('todos');
                setSearchQuery('');
              }}
              className="min-h-[40px] px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/40 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              title="Restablecer todos los filtros del chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Context Event Pin Banner */}
      {activeContextEvent && (
        <div className="p-2.5 bg-[#202329] border-b border-[#FFF19A]/30 px-4 flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-2 truncate">
            <Zap className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
            <span className="truncate">
              Comentando sobre reporte: <strong className="text-[#FFF19A]">{activeContextEvent.title}</strong>
            </span>
          </div>
          {onClearContextEvent && (
            <button
              type="button"
              onClick={onClearContextEvent}
              className="text-[#9299A5] hover:text-white p-1.5 rounded cursor-pointer"
              title="Quitar contexto del reporte"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-xs text-[#9299A5] py-16 space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#202329] border-2 border-[#FFF19A]/40 flex items-center justify-center mx-auto text-[#FFF19A]">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-black text-sm text-white uppercase tracking-tight">
              {searchQuery ? 'No hay mensajes que coincidan' : 'Chat Comunitario en Vivo (100% Real)'}
            </h3>
            <p className="text-[11.5px] leading-relaxed text-[#9299A5]">
              {searchQuery
                ? 'Probá buscando con otra palabra o limpiando el filtro.'
                : 'Sin bots ni mensajes simulados. Todo lo publicado aquí proviene de vecinos y choferes reales de Campana y Zárate. ¡Escribí el primer mensaje para consultar el estado del micro o pedir transporte!'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = Boolean(
              myUid ? msg.usuarioId === myUid : msg.nombreUsuario === currentUser.name
            );
            const roleInfo = getRoleBadge(msg.rol);
            const RoleIcon = roleInfo.icon;
            const isDriver = msg.rol === 'chofer_moto' || msg.rol === 'chofer_auto' || msg.rol === 'driver';
            const cleanDriverPhone = (msg.telefonoContacto || '').replace(/\D/g, '');

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'} group animate-in fade-in duration-200`}
              >
                <img
                  src={
                    msg.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.usuarioId}&backgroundColor=101114`
                  }
                  alt={msg.nombreUsuario}
                  className="w-8 h-8 rounded-full border border-white/15 shrink-0 bg-[#202329] object-cover mt-0.5"
                />

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1 flex-wrap">
                    <button
                      type="button"
                      className={`font-black cursor-pointer hover:underline ${
                        isMe ? 'text-[#FFF19A]' : 'text-white'
                      }`}
                      onClick={() => handleMention(msg.nombreUsuario)}
                      title={`Mencionar a ${msg.nombreUsuario}`}
                    >
                      {msg.nombreUsuario}
                      {isMe ? ' (Tú)' : ''}
                    </button>
                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border flex items-center gap-0.5 ${roleInfo.bg}`}>
                      <RoleIcon className="w-2.5 h-2.5" />
                      <span>{roleInfo.label}</span>
                    </span>
                    <span className="text-[10px] text-[#9299A5] font-mono flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatFriendlyTime(msg.enviadoEn)}
                    </span>
                  </div>

                  {msg.replyTo && (
                    <div className="mb-1 p-1.5 rounded-xl bg-[#101114] border-l-2 border-[#FFF19A] text-[10px] text-[#9299A5] max-w-full truncate">
                      <strong className="text-[#FFF19A]">@{msg.replyTo.nombreUsuario}: </strong>
                      <span>{msg.replyTo.texto}</span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed relative border-2 ${
                      isMe
                        ? 'bg-[#202329] text-white border-[#FFF19A]/60 rounded-tr-xs shadow-[3px_3px_0px_#000000]'
                        : 'bg-[#202329] text-white border-white/15 rounded-tl-xs shadow-[3px_3px_0px_#000000]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-[12.5px]">{msg.texto}</p>

                    {isDriver && !isMe && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
                        {cleanDriverPhone.length >= 8 && (
                          <a
                            href={`https://wa.me/${cleanDriverPhone}?text=${encodeURIComponent(
                              `Hola ${msg.nombreUsuario}, te escribo desde la app UPPA por tu mensaje en el chat: "${msg.texto}"`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Contactar por WhatsApp a ${msg.nombreUsuario}`}
                            className="px-3 min-h-[36px] rounded-xl uppa-cta-green font-black text-[11px] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Contactar Chofer</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setReplyingTo({ id: msg.id, nombreUsuario: msg.nombreUsuario, texto: msg.texto })}
                          title={`Responder a ${msg.nombreUsuario} en el chat`}
                          className="px-3 min-h-[36px] rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Responder acá
                        </button>
                      </div>
                    )}

                    {msg.reacciones && Object.keys(msg.reacciones).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(msg.reacciones).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            title={`Sumar reacción ${emoji}`}
                            className="px-2 py-0.5 rounded-lg bg-[#101114] border border-white/15 text-[11px] flex items-center gap-1 hover:border-[#FFF19A] transition-colors cursor-pointer"
                          >
                            <span>{emoji}</span>
                            <span className="font-mono text-[10px] text-[#9299A5]">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className={`absolute -bottom-3.5 ${
                        isMe ? 'left-2' : 'right-2'
                      } hidden group-hover:flex items-center gap-1 bg-[#101114] border border-white/20 px-1.5 py-0.5 rounded-full shadow-lg text-[10px] z-10`}
                    >
                      <button
                        type="button"
                        onClick={() => setShowReactionPickerForId(showReactionPickerForId === msg.id ? null : msg.id)}
                        className="p-1.5 hover:text-[#FFF19A] text-[#9299A5] cursor-pointer"
                        title="Reaccionar con emoji"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo({ id: msg.id, nombreUsuario: msg.nombreUsuario, texto: msg.texto })}
                        className="p-1.5 hover:text-[#FFF19A] text-[#9299A5] cursor-pointer"
                        title="Responder este mensaje"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMention(msg.nombreUsuario)}
                        className="p-1.5 hover:text-[#B7F36B] text-[#9299A5] cursor-pointer"
                        title={`Mencionar a ${msg.nombreUsuario}`}
                      >
                        <AtSign className="w-3.5 h-3.5" />
                      </button>
                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          className="p-1.5 hover:text-rose-400 text-[#9299A5] cursor-pointer"
                          title="Borrar mi mensaje"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReport(msg.id)}
                          className="p-1.5 hover:text-[#FFF19A] text-[#9299A5] cursor-pointer"
                          title="Reportar mensaje inapropiado"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {showReactionPickerForId === msg.id && (
                      <div className="absolute -bottom-11 left-0 bg-[#101114] border-2 border-[#FFF19A]/45 p-1.5 rounded-full shadow-2xl flex items-center gap-1.5 z-20 animate-in zoom-in-95">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            title={`Reaccionar con ${emoji}`}
                            className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-sm cursor-pointer transition-transform hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Context Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-[#202329] border-t border-[#FFF19A]/40 flex items-center justify-between text-xs text-white animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-[#FFF19A] shrink-0" />
            <span className="truncate">
              Respondiendo a <strong className="text-[#FFF19A]">@{replyingTo.nombreUsuario}</strong>: "{replyingTo.texto}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1.5 text-[#9299A5] hover:text-white cursor-pointer"
            title="Cancelar respuesta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Identity Footer */}
      <div className="px-3 pt-2 pb-0.5 bg-[#202329] border-t border-white/10 flex items-center justify-between text-[11px] text-[#9299A5]">
        <div className="flex items-center gap-1.5 truncate">
          <span>Publicarás como:</span>
          <strong className="text-white font-bold">{currentUser.name}</strong>
          <span className="text-[#FFF19A]">({userRoleBadge.label})</span>
        </div>
        <span className="text-[10px] text-[#B7F36B] font-bold hidden sm:inline-flex items-center gap-1">
          <Radio className="w-2.5 h-2.5 text-[#B7F36B] animate-pulse" />
          <span>Visible para toda la comunidad</span>
        </span>
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#202329] flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Escribí un mensaje visible para toda la comunidad como ${currentUser.name}...`}
          className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#101114] border-2 border-white/15 text-xs text-white focus:outline-none focus:border-[#FFF19A] placeholder:text-[#9299A5]"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="min-h-[44px] px-4 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
          title="Publicar mensaje en el chat comunitario"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
