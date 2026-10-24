import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, MapEvent, MensajeChatFirestore } from '../../types';
import {
  subscribeToChat,
  enviarMensajeChat,
  reaccionarMensajeChat,
  eliminarMensajeChat,
  reportarMensajeChat,
  getMessageTimestampMs,
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
  Volume2,
  ChevronDown,
  RotateCcw,
  Filter,
  SlidersHorizontal,
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
  // Por defecto, 'todos' para ver la totalidad de mensajes de la comunidad sin restricciones
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

  // Estados y referencias para los menús desplegables del filtro inteligente
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

  // Sonido suave al enviar mensaje
  const playChime = () => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.12); // C6
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  };

  // Actualiza la hora de referencia y purga automáticamente mensajes que superen los 20 minutos de exposición
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const twentyMinMs = 20 * 60 * 1000;
      setNowTimestamp(now);
      setMessages((prev) => prev.filter((m) => (now - getMessageTimestampMs(m.enviadoEn)) < twentyMinMs));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a Firebase Firestore y BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToChat(selectedChannel, (roomMessages) => {
      setMessages(roomMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 70);
    });

    return () => unsubscribe();
  }, [selectedChannel]);

  // Si hay un evento del mapa seleccionado para contexto
  useEffect(() => {
    if (activeContextEvent) {
      setInputText(`Consulta sobre reporte en ${activeContextEvent.title}: `);
      inputRef.current?.focus();
    }
  }, [activeContextEvent]);

  // Filtrado de mensajes por canal, rol, búsqueda y límite estricto de 20 minutos de exposición
  const filteredMessages = useMemo(() => {
    const twentyMinMs = 20 * 60 * 1000;
    let list = messages.filter((m) => (nowTimestamp - getMessageTimestampMs(m.enviadoEn)) < twentyMinMs);

    // Si hay un canal específico seleccionado, mostrar mensajes de ese canal y también los avisos comunitarios de 'todos'
    if (selectedChannel !== 'todos') {
      list = list.filter((m) => !m.salaId || m.salaId === selectedChannel || m.salaId === 'todos');
    }

    // Filtro por rol
    if (roleFilter === 'choferes') {
      list = list.filter((m) => m.rol === 'chofer_moto' || m.rol === 'chofer_auto' || m.rol === 'driver');
    } else if (roleFilter === 'colectivos') {
      list = list.filter((m) => m.rol === 'chofer_micro');
    } else if (roleFilter === 'pasajeros') {
      list = list.filter((m) => m.rol === 'pasajero' || !m.rol);
    }

    // Filtro por texto de búsqueda
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
  }, [messages, selectedChannel, roleFilter, searchQuery]);

  // Envío sin límites: el usuario puede enviar la cantidad de mensajes que quiera
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
    const userRole = currentUser.rol || (currentUser.role === 'admin' ? 'administrador' : currentUser.role === 'driver' ? 'chofer_auto' : 'pasajero');
    const senderName = currentUser.name?.trim() || currentUser.email?.split('@')[0] || 'Vecino UPPA';

    const optimisticMessage: MensajeChatFirestore = {
      id: tempId,
      salaId: selectedChannel,
      usuarioId: currentUser.id || currentUser.uid || 'usr-comunidad',
      nombreUsuario: senderName,
      texto: textToSend,
      rol: userRole as any,
      avatarUrl: currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id || 'usr'}&backgroundColor=12141c`,
      enviadoEn: now,
      replyTo: currentReply || undefined,
      telefonoContacto: currentUser.phone || undefined,
      reacciones: {},
    };

    // Agregar de inmediato en la memoria local (optimistic update en 0ms)
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

  // Reacción con emojis para interacción instantánea compartida con toda la comunidad
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

    // Persistir y propagar reacción a toda la comunidad en Firestore y Broadcast
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
    } catch (e) {
      showNotice('Mensaje eliminado');
    }
  };

  const handleReport = async (mensajeId: string) => {
    try {
      await reportarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje reportado para moderación comunitaria');
    } catch (e) {
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
        return { label: 'Admin', bg: 'bg-purple-500/20 text-purple-300 border-purple-400/40', icon: Shield };
      case 'chofer_moto':
        return { label: 'Moto Taxi', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: Bike };
      case 'chofer_auto':
      case 'driver':
        return { label: 'Auto Taxi', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40', icon: Car };
      case 'chofer_micro':
        return { label: 'Colectivo', bg: 'bg-blue-500/20 text-blue-300 border-blue-400/40', icon: Bus };
      default:
        return { label: 'Pasajero', bg: 'bg-slate-800 text-slate-300 border-white/10', icon: UserIcon };
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

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Header: Barra ultra compacta para maximizar espacio del chat */}
      <div className="px-3 py-2 sm:px-4 sm:py-2 border-b border-white/5 bg-[#0b0e17]/95 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Título y estado en vivo */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-sm shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold text-white font-display truncate">
                Chat Comunitario
              </h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>EN VIVO</span>
              </span>
              <span className="text-[10px] text-cyan-300 font-mono hidden sm:inline truncate">
                · {filteredMessages.length} mensaje{filteredMessages.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Right: Identificación de usuario y sincronización */}
          <div className="flex items-center gap-1.5 shrink-0">
            {actionNotice && (
              <div className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-[10px] font-bold text-purple-200 animate-in fade-in">
                {actionNotice}
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-xl border border-white/5 text-xs">
              <img
                src={
                  currentUser.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id || 'usr'}&backgroundColor=12141c`
                }
                alt={currentUser.name}
                className="w-4.5 h-4.5 rounded-full border border-purple-400/40 object-cover"
              />
              <span className="font-bold text-white text-[11px] max-w-[80px] sm:max-w-[110px] truncate">
                {currentUser.name}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border hidden sm:inline-flex items-center gap-0.5 ${userRoleBadge.bg}`}>
                <CurrentUserRoleIcon className="w-2.5 h-2.5" />
                <span>{userRoleBadge.label}</span>
              </span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Refrescar mensajes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Intelligent Search & Filter Bar: Una sola fila compacta con buscador y filtros inteligentes */}
      <div className="px-3 py-1.5 sm:px-4 sm:py-2 border-b border-white/5 bg-[#080b12]/90 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Campo de búsqueda */}
          <div className="relative flex-1 min-w-[110px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el chat (ej: 228, Tenaris, chofer...)"
              className="w-full h-8 pl-8 pr-7 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                title="Borrar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtro Inteligente: Canal / Sentido */}
          <div className="relative" ref={channelDropdownRef}>
            <button
              onClick={() => {
                setIsChannelDropdownOpen((prev) => !prev);
                setIsRoleDropdownOpen(false);
              }}
              className={`h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                selectedChannel !== 'todos'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400/50 shadow-sm shadow-purple-600/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Filtrar por canal o sentido: Todos, Campana-Zárate, Zárate-Campana, General"
            >
              <span className="text-sm leading-none">{currentChannelOption.icon}</span>
              <span className="hidden sm:inline text-[11px] max-w-[115px] truncate">
                {currentChannelOption.shortLabel}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isChannelDropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Menú desplegable de canales */}
            {isChannelDropdownOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-64 rounded-2xl bg-[#0a0e19]/98 border border-purple-500/30 shadow-2xl p-1.5 z-50 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 border-b border-white/5 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 font-mono">
                    Canal / Sentido
                  </span>
                  <span className="text-[9px] text-slate-400">4 opciones</span>
                </div>
                <div className="space-y-0.5">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const isSelected = selectedChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          setIsChannelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/30 text-purple-200 border border-purple-400/40 font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 font-medium'
                        }`}
                      >
                        <span className="text-base">{ch.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-[11.5px]">{ch.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          </div>
                          <span className="text-[9.5px] text-slate-400 block truncate">{ch.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Filtro Inteligente: Rol / Tipo de Usuario */}
          <div className="relative" ref={roleDropdownRef}>
            <button
              onClick={() => {
                setIsRoleDropdownOpen((prev) => !prev);
                setIsChannelDropdownOpen(false);
              }}
              className={`h-8 px-2 sm:px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                roleFilter !== 'todos'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400/50 shadow-sm shadow-cyan-600/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Filtrar por rol: Todos, Pasajeros, Taxis/Motos, Colectivos"
            >
              <span className="text-sm leading-none">{currentRoleOption.icon}</span>
              <span className="hidden sm:inline text-[11px] max-w-[85px] truncate">
                {currentRoleOption.shortLabel}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isRoleDropdownOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Menú desplegable de roles */}
            {isRoleDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#0a0e19]/98 border border-cyan-500/30 shadow-2xl p-1.5 z-50 backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 border-b border-white/5 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    Filtrar por Rol
                  </span>
                  <span className="text-[9px] text-slate-400">4 opciones</span>
                </div>
                <div className="space-y-0.5">
                  {ROLE_OPTIONS.map((rf) => {
                    const isSelected = roleFilter === rf.id;
                    return (
                      <button
                        key={rf.id}
                        onClick={() => {
                          setRoleFilter(rf.id);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-400/40 font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-white/5 font-medium'
                        }`}
                      >
                        <span className="text-base">{rf.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-[11.5px]">{rf.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          </div>
                          <span className="text-[9.5px] text-slate-400 block truncate">{rf.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botón rápido de reset cuando hay filtros activos */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSelectedChannel('todos');
                setRoleFilter('todos');
                setSearchQuery('');
              }}
              className="h-8 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Context Event Pin Banner if active */}
      {activeContextEvent && (
        <div className="p-2.5 bg-sky-950/40 border-b border-sky-500/20 px-4 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2 truncate">
            <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">
              Comentando sobre reporte: <strong>{activeContextEvent.title}</strong>
            </span>
          </div>
          {onClearContextEvent && (
            <button
              onClick={onClearContextEvent}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
              title="Quitar contexto"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-16 space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center mx-auto text-purple-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-200">
              {searchQuery ? 'No hay mensajes que coincidan' : 'Comunidad de Campana & Zárate Conectada'}
            </h3>
            <p className="text-[11.5px] leading-relaxed text-slate-400">
              {searchQuery
                ? 'Probá buscando con otra palabra o limpiando el filtro.'
                : 'Sé el primero en consultar el estado de tu colectivo o coordinar un viaje con los choferes de Moto y Auto Taxi.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.usuarioId === (currentUser.id || currentUser.uid) || msg.nombreUsuario === currentUser.name;
            const roleInfo = getRoleBadge(msg.rol);
            const RoleIcon = roleInfo.icon;
            const isDriver = msg.rol === 'chofer_moto' || msg.rol === 'chofer_auto' || msg.rol === 'driver';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'} group animate-in fade-in duration-200`}
              >
                {/* User Avatar */}
                <img
                  src={
                    msg.avatarUrl ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.usuarioId}&backgroundColor=12141c`
                  }
                  alt={msg.nombreUsuario}
                  className="w-8 h-8 rounded-full border border-white/10 shrink-0 bg-slate-900 object-cover mt-0.5"
                />

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                  {/* Name, Role & Relative Time */}
                  <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1 flex-wrap">
                    <span
                      className={`font-extrabold cursor-pointer hover:underline ${
                        isMe ? 'text-cyan-300' : 'text-white'
                      }`}
                      onClick={() => handleMention(msg.nombreUsuario)}
                    >
                      {msg.nombreUsuario}
                      {isMe ? ' (Tú)' : ''}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border flex items-center gap-0.5 ${roleInfo.bg}`}>
                      <RoleIcon className="w-2.5 h-2.5" />
                      <span>{roleInfo.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatFriendlyTime(msg.enviadoEn)}
                    </span>
                  </div>

                  {/* Replied Message Context Box */}
                  {msg.replyTo && (
                    <div className="mb-1 p-1.5 rounded-xl bg-black/50 border-l-2 border-purple-400 text-[10px] text-slate-300 max-w-full truncate">
                      <strong className="text-purple-300">@{msg.replyTo.nombreUsuario}: </strong>
                      <span>{msg.replyTo.texto}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed relative ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-tr-xs shadow-md shadow-purple-600/15'
                        : 'bg-[#121624] text-slate-200 rounded-tl-xs border border-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-[12.5px]">{msg.texto}</p>

                    {/* Acciones directas si es conductor y ofrece viaje */}
                    {isDriver && !isMe && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                        <button
                          onClick={() => {
                            const cleanPhone = (msg.telefonoContacto || '5493489123456').replace(/\D/g, '');
                            const text = encodeURIComponent(`Hola ${msg.nombreUsuario}, te escribo desde la app UPPA por tu mensaje en el chat: "${msg.texto}"`);
                            window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[10.5px] flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Contactar Chofer</span>
                        </button>
                        <button
                          onClick={() => setReplyingTo({ id: msg.id, nombreUsuario: msg.nombreUsuario, texto: msg.texto })}
                          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10.5px] font-semibold"
                        >
                          Responder acá
                        </button>
                      </div>
                    )}

                    {/* Reacciones visuales activas */}
                    {msg.reacciones && Object.keys(msg.reacciones).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(msg.reacciones).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10 text-[11px] flex items-center gap-1 hover:border-purple-400 transition-colors"
                          >
                            <span>{emoji}</span>
                            <span className="font-mono text-[10px] text-slate-300">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Barra de Acciones rápidas al pasar el cursor */}
                    <div
                      className={`absolute -bottom-3 ${
                        isMe ? 'left-2' : 'right-2'
                      } hidden group-hover:flex items-center gap-1 bg-slate-900/95 border border-white/10 px-1.5 py-0.5 rounded-full shadow-lg text-[10px] z-10`}
                    >
                      <button
                        onClick={() => setShowReactionPickerForId(showReactionPickerForId === msg.id ? null : msg.id)}
                        className="p-1 hover:text-amber-300 text-slate-400 cursor-pointer"
                        title="Reaccionar"
                      >
                        <Smile className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setReplyingTo({ id: msg.id, nombreUsuario: msg.nombreUsuario, texto: msg.texto })}
                        className="p-1 hover:text-purple-300 text-slate-400 cursor-pointer"
                        title="Responder"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMention(msg.nombreUsuario)}
                        className="p-1 hover:text-cyan-300 text-slate-400 cursor-pointer"
                        title="Mencionar"
                      >
                        <AtSign className="w-3 h-3" />
                      </button>
                      {isMe ? (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="p-1 hover:text-rose-400 text-slate-400 cursor-pointer"
                          title="Borrar mi mensaje"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReport(msg.id)}
                          className="p-1 hover:text-amber-400 text-slate-400 cursor-pointer"
                          title="Reportar mensaje"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Picker de Reacciones flotante */}
                    {showReactionPickerForId === msg.id && (
                      <div className="absolute -bottom-10 left-0 bg-slate-900 border border-purple-500/30 p-1.5 rounded-full shadow-2xl flex items-center gap-1.5 z-20 animate-in zoom-in-95">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-sm cursor-pointer transition-transform hover:scale-125"
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
        <div className="px-4 py-2 bg-purple-950/70 border-t border-purple-500/30 flex items-center justify-between text-xs text-purple-200 animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">
              Respondiendo a <strong className="text-white">@{replyingTo.nombreUsuario}</strong>: "{replyingTo.texto}"
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Indicador de Identidad y Envío Libre */}
      <div className="px-3 pt-1.5 pb-0.5 bg-[#0b0e17] flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <span>Publicarás como:</span>
          <strong className="text-white font-bold">{currentUser.name}</strong>
          <span className="text-purple-300">({userRoleBadge.label})</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline flex items-center gap-1">
          <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
          <span>Visible para toda la comunidad</span>
        </span>
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#0b0e17] flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Escribí un mensaje visible para toda la comunidad como ${currentUser.name}...`}
          className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="h-11 px-4.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
          title="Publicar en el chat comunitario"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
