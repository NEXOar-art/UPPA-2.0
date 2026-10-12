import React, { useState, useEffect, useRef } from 'react';
import { User, MapEvent } from '../../types';
import {
  subscribeToChat,
  enviarMensajeChat,
  eliminarMensajeChat,
  reportarMensajeChat,
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
} from 'lucide-react';

interface CommunityChatProps {
  currentUser: User;
  activeContextEvent?: MapEvent | null;
  onClearContextEvent?: () => void;
}

export const CommunityChat: React.FC<CommunityChatProps> = ({
  currentUser,
  activeContextEvent,
  onClearContextEvent,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'campana-zarate' | 'zarate-campana' | 'general'>('campana-zarate');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; nombreUsuario: string; texto: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Real-time listener for current chat room
  useEffect(() => {
    const unsubscribe = subscribeToChat(selectedChannel, (roomMessages) => {
      setMessages(roomMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedChannel]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      await enviarMensajeChat(selectedChannel, {
        usuarioId: currentUser.id || currentUser.uid || 'usr-anon',
        nombreUsuario: currentUser.name || 'Vecino UPPA',
        texto: textToSend,
        rol: currentUser.rol || (currentUser.role === 'admin' ? 'administrador' : currentUser.role === 'driver' ? 'chofer_auto' : 'pasajero'),
        avatarUrl: currentUser.avatarUrl,
        replyTo: replyingTo || undefined,
      });
      setReplyingTo(null);
    } catch (err: any) {
      showNotice('Error al enviar el mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleMention = (userName: string) => {
    setInputText((prev) => `${prev} @${userName} `);
  };

  const handleDelete = async (mensajeId: string) => {
    if (confirm('¿Eliminar tu mensaje?')) {
      try {
        await eliminarMensajeChat(selectedChannel, mensajeId);
        showNotice('Mensaje eliminado');
      } catch (e) {
        showNotice('No se pudo eliminar el mensaje');
      }
    }
  };

  const handleReport = async (mensajeId: string) => {
    try {
      await reportarMensajeChat(selectedChannel, mensajeId);
      showNotice('Mensaje reportado para moderación');
    } catch (e) {
      showNotice('Error al reportar');
    }
  };

  const getRoleBadge = (rol?: string) => {
    switch (rol) {
      case 'administrador':
      case 'admin':
        return { label: 'Admin', bg: 'bg-purple-500/20 text-purple-300 border-purple-400/40', icon: Shield };
      case 'chofer_moto':
        return { label: 'Moto', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40', icon: Bike };
      case 'chofer_auto':
      case 'driver':
        return { label: 'Taxi', bg: 'bg-blue-500/20 text-blue-300 border-blue-400/40', icon: Car };
      case 'chofer_micro':
        return { label: 'Micro', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40', icon: Bus };
      default:
        return { label: 'Pasajero', bg: 'bg-slate-800 text-slate-300 border-white/10', icon: UserIcon };
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return 'Ahora';
    if (typeof ts === 'number') {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (ts.toDate) {
      const d = ts.toDate();
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (ts.seconds) {
      const d = new Date(ts.seconds * 1000);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return 'Ahora';
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Header / Channel Tabs */}
      <div className="p-3 sm:p-4 border-b border-white/5 bg-[#0b0e17]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                Chat Comunitario en Tiempo Real
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-[11px] text-slate-400">
                Canal: <strong className="text-purple-300">{selectedChannel}</strong> • onSnapshot() activo
              </p>
            </div>
          </div>

          {actionNotice && (
            <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-200 animate-in fade-in">
              {actionNotice}
            </div>
          )}
        </div>

        {/* Channel Switcher */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'campana-zarate' as const, label: 'Campana ↔ Zárate' },
            { id: 'zarate-campana' as const, label: 'Zárate ↔ Campana' },
            { id: 'general' as const, label: 'Comunidad General' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                setSelectedChannel(ch.id);
                setReplyingTo(null);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedChannel === ch.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-12 space-y-1">
            <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">Iniciá la conversación en este canal</p>
            <p className="text-[11px]">Compartí el estado del colectivo, demoras o pedí un taxi alternativo.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.usuarioId === (currentUser.id || currentUser.uid);
            const roleInfo = getRoleBadge(msg.rol);
            const RoleIcon = roleInfo.icon;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}
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

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[82%] sm:max-w-[70%]`}>
                  {/* Name, Role & Time */}
                  <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1">
                    <span className="font-bold text-white cursor-pointer hover:underline" onClick={() => handleMention(msg.nombreUsuario)}>
                      {msg.nombreUsuario}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border flex items-center gap-0.5 ${roleInfo.bg}`}>
                      <RoleIcon className="w-2.5 h-2.5" />
                      <span>{roleInfo.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(msg.enviadoEn)}
                    </span>
                  </div>

                  {/* Replied Message Context Box */}
                  {msg.replyTo && (
                    <div className="mb-1 p-1.5 rounded-lg bg-black/40 border-l-2 border-purple-400 text-[10px] text-slate-300 max-w-full truncate">
                      <strong className="text-purple-300">@{msg.replyTo.nombreUsuario}: </strong>
                      <span>{msg.replyTo.texto}</span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed relative ${
                      isMe
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-tr-xs shadow-md'
                        : 'bg-[#121624] text-slate-200 rounded-tl-xs border border-white/5'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.texto}</p>

                    {/* Actions on hover (Reply, Delete, Report) */}
                    <div
                      className={`absolute -bottom-3 ${
                        isMe ? 'left-2' : 'right-2'
                      } hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-white/10 px-1.5 py-0.5 rounded-full shadow-lg text-[10px] z-10`}
                    >
                      <button
                        onClick={() => setReplyingTo({ id: msg.id, nombreUsuario: msg.nombreUsuario, texto: msg.texto })}
                        className="p-1 hover:text-purple-300 text-slate-400"
                        title="Responder"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMention(msg.nombreUsuario)}
                        className="p-1 hover:text-cyan-300 text-slate-400"
                        title="Mencionar"
                      >
                        <AtSign className="w-3 h-3" />
                      </button>
                      {isMe ? (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="p-1 hover:text-rose-400 text-slate-400"
                          title="Borrar mi mensaje"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReport(msg.id)}
                          className="p-1 hover:text-amber-400 text-slate-400"
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
        <div className="px-4 py-2 bg-purple-950/60 border-t border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">
              Respondiendo a <strong className="text-white">@{replyingTo.nombreUsuario}</strong>: "{replyingTo.texto}"
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#0b0e17] border-t border-white/5 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Escribir en ${selectedChannel}... (usá @ para mencionar)`}
          className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-400 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="h-11 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-40 cursor-pointer active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Enviar</span>
        </button>
      </form>
    </div>
  );
};
