import React, { useState, useEffect, useRef } from 'react';
import { User, MapEvent, MensajeChatFirestore } from '../../types';
import {
  subscribeToChat,
  enviarMensajeChat,
  eliminarMensajeChat,
  reportarMensajeChat,
  getMessageTimestampMs,
  isChatMessageValid,
  CHAT_MESSAGE_TTL_MS,
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
  Timer,
  Zap,
  Radio,
} from 'lucide-react';

interface CommunityChatProps {
  currentUser: User;
  activeContextEvent?: MapEvent | null;
  onClearContextEvent?: () => void;
}

type ChannelType = 'todos' | 'campana-zarate' | 'zarate-campana' | 'general';

export const CommunityChat: React.FC<CommunityChatProps> = ({
  currentUser,
  activeContextEvent,
  onClearContextEvent,
}) => {
  // Por defecto, mostrar 'todos' para contener todos los mensajes de todos los usuarios
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('todos');
  const [messages, setMessages] = useState<MensajeChatFirestore[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; nombreUsuario: string; texto: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [isSending, setIsSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Timer activo que actualiza la hora cada 2 segundos y elimina automáticamente
  // de la memoria los mensajes que superaron los 15 minutos exactos de permanencia
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowTimestamp(now);
      setMessages((prev) => {
        const filtered = prev.filter((m) => isChatMessageValid(m.enviadoEn));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a Firebase Firestore y BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToChat(selectedChannel, (roomMessages) => {
      setMessages(roomMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
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

  // Envío sin límites: el usuario puede enviar la cantidad de mensajes que quiera
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend) return;

    // Limpiar input inmediatamente y enfocar de nuevo para permitir envíos consecutivos ilimitados
    setInputText('');
    const currentReply = replyingTo;
    setReplyingTo(null);

    // Reenfocar inmediatamente el campo de texto
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
    };

    // Agregar de inmediato en la memoria local (optimistic update sin bloqueo)
    setMessages((prev) => [...prev.filter((m) => isChatMessageValid(m.enviadoEn)), optimisticMessage]);

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // Enviar a Firebase Firestore y sincronizar
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

      // Reemplazar tempId por sent.id en el estado local
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
    } catch (err: any) {
      console.warn('Sincronización en segundo plano:', err);
    } finally {
      setIsSending(false);
      // Garantizar que el input permanezca enfocado para el siguiente mensaje
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  const handleMention = (userName: string) => {
    setInputText((prev) => `${prev} @${userName} `);
    inputRef.current?.focus();
  };

  const handleQuickChip = (text: string) => {
    setInputText(text);
    inputRef.current?.focus();
  };

  const handleDelete = async (mensajeId: string) => {
    // Eliminar inmediatamente de la memoria local
    setMessages((prev) => prev.filter((m) => m.id !== mensajeId));
    try {
      await eliminarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje borrado');
    } catch (e) {
      showNotice('Mensaje eliminado de la memoria');
    }
  };

  const handleReport = async (mensajeId: string) => {
    try {
      await reportarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje reportado para moderación');
    } catch (e) {
      showNotice('Reporte recibido');
    }
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

  const formatTime = (ts: any) => {
    const ms = getMessageTimestampMs(ts);
    const d = new Date(ms);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Cálculo del tiempo restante de los 15 minutos exactos de permanencia en memoria
  const getRemainingTimeBadge = (ts: any) => {
    const ms = getMessageTimestampMs(ts);
    const elapsed = nowTimestamp - ms;
    const remainingMs = Math.max(0, CHAT_MESSAGE_TTL_MS - elapsed);
    const remainingMins = Math.ceil(remainingMs / (60 * 1000));

    if (remainingMins <= 1) {
      return { text: '< 1 min', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 font-bold' };
    }
    if (remainingMins <= 5) {
      return { text: `${remainingMins} min`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    return { text: `${remainingMins} min`, color: 'text-slate-400 bg-white/[0.03] border-white/5' };
  };

  const userRoleBadge = getRoleBadge(currentUser.rol || currentUser.role);
  const CurrentUserRoleIcon = userRoleBadge.icon;

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Header / Channel Tabs */}
      <div className="p-3 sm:p-4 border-b border-white/5 bg-[#0b0e17]/95 backdrop-blur-xl shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-md shadow-purple-500/15">
              <MessageSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5 font-display">
                  Chat Comunitario en Tiempo Real
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="En vivo" />
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="text-purple-300 font-semibold">
                  {selectedChannel === 'todos' ? 'Todos los Usuarios (Campana ↔ Zárate)' : selectedChannel}
                </span>
                <span>•</span>
                <span className="text-cyan-300 font-mono text-[10.5px]">
                  {messages.length} mensajes en vivo
                </span>
              </p>
            </div>
          </div>

          {/* Banner de permanencia de 15 minutos en memoria */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-400/25 text-[11px] text-purple-200 font-mono shadow-sm">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Memoria: <strong>15 min</strong> (autoborrado)</span>
            </div>

            {actionNotice && (
              <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-200 animate-in fade-in">
                {actionNotice}
              </div>
            )}
          </div>
        </div>

        {/* Channel Selector Pills */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'todos' as const, label: '🌐 Todos los Mensajes' },
            { id: 'campana-zarate' as const, label: '🏙️ Campana ↔ Zárate' },
            { id: 'zarate-campana' as const, label: '🏙️ Zárate ↔ Campana' },
            { id: 'general' as const, label: '💬 General' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                setSelectedChannel(ch.id);
                setReplyingTo(null);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                selectedChannel === ch.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 border border-purple-400/40'
                  : 'text-slate-400 hover:text-white bg-slate-900/70 border border-white/5'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Identificación Visible del Usuario Activo en el Chat */}
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={
                  currentUser.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id || 'usr'}&backgroundColor=12141c`
                }
                alt={currentUser.name}
                className="w-6 h-6 rounded-full border border-purple-400/40 object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#0b0e17]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-slate-300">
                Tu Usuario:
              </span>
              <strong className="text-white font-extrabold text-xs">
                {currentUser.name}
              </strong>
              <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold border flex items-center gap-1 ${userRoleBadge.bg}`}>
                <CurrentUserRoleIcon className="w-2.5 h-2.5" />
                <span>{userRoleBadge.label}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Conectado a la comunidad</span>
            </span>
          </div>
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
        {messages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-16 space-y-2 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center mx-auto text-purple-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-200">Chat Comunitario en Vivo</h3>
            <p className="text-[11.5px] leading-relaxed text-slate-400">
              Escribí tu mensaje. Todos los pasajeros y choferes de Moto y Auto Taxi de Campana y Zárate lo verán al instante. Permanecerá 15 minutos en memoria y luego se borrará automáticamente.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.usuarioId === (currentUser.id || currentUser.uid) || msg.nombreUsuario === currentUser.name;
            const roleInfo = getRoleBadge(msg.rol);
            const RoleIcon = roleInfo.icon;
            const remaining = getRemainingTimeBadge(msg.enviadoEn);

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
                  {/* Name, Role & 15m Expiration Badge */}
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
                      {formatTime(msg.enviadoEn)}
                    </span>
                    {/* Badge de permanencia en memoria (15 min) */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono border flex items-center gap-0.5 ${remaining.color}`}
                      title="Permanencia de 15 minutos en la memoria comunitaria"
                    >
                      <Timer className="w-2.5 h-2.5" />
                      <span>{remaining.text}</span>
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

                    {/* Actions on hover (Reply, Mention, Delete, Report) */}
                    <div
                      className={`absolute -bottom-3 ${
                        isMe ? 'left-2' : 'right-2'
                      } hidden group-hover:flex items-center gap-1 bg-slate-900/95 border border-white/10 px-1.5 py-0.5 rounded-full shadow-lg text-[10px] z-10`}
                    >
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

      {/* Quick Suggestion Chips para envíos rápidos continuos */}
      <div className="px-3 py-1.5 bg-[#080b12] border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Atajos:</span>
        {[
          '¿Cómo viene el 228?',
          '🏍️ Moto Taxi disponible',
          '🚕 Auto Taxi disponible',
          'Tránsito normal en Colectora',
          'Pasando por Plaza Eduardo Costa',
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleQuickChip(chip)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-purple-950/60 text-slate-300 hover:text-white text-[10.5px] border border-white/10 shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Indicador de Usuario y Envío Ilimitado */}
      <div className="px-3 pt-1.5 pb-0.5 bg-[#0b0e17] flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <span>Publicarás como:</span>
          <strong className="text-white font-bold">{currentUser.name}</strong>
          <span className="text-purple-300">({userRoleBadge.label})</span>
        </div>
        <span className="text-[10px] text-slate-400 hidden sm:inline">
          Envíos ilimitados • 15 min en memoria
        </span>
      </div>

      {/* Input Bar (Permite envíos continuos e ilimitados de mensajes sin bloqueo) */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#0b0e17] flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Escribí un mensaje como ${currentUser.name}... (Presioná Enter)`}
          className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="h-11 px-4.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
          title="Enviar mensaje a todos los usuarios de la comunidad"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
