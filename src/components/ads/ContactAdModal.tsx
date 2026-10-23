import React, { useState } from 'react';
import { X, Send, Megaphone, CheckCircle2, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';

interface ContactAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitInquiry: (data: {
    nombre: string;
    businessName: string;
    contactEmail: string;
    phone: string;
    linkUrl?: string;
    notes?: string;
  }) => void;
}

export const ContactAdModal: React.FC<ContactAdModalProps> = ({
  isOpen,
  onClose,
  onSubmitInquiry,
}) => {
  const [nombre, setNombre] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');

  if (!isOpen) return null;

  const buildWhatsAppUrl = (data: {
    nombre: string;
    businessName: string;
    contactEmail: string;
    phone: string;
    linkUrl?: string;
    notes?: string;
  }) => {
    const rawNumber = '5493489686939'; // Formato internacional WhatsApp para número celular 3489686939 (Campana/Zárate)
    const textLines = [
      '👋 *Hola! Quiero solicitar incluir mi negocio en el banner publicitario de UPPA.*',
      '',
      `👤 *Nombre:* ${data.nombre}`,
      `🏪 *Negocio / Comercio:* ${data.businessName}`,
      `✉️ *E-mail:* ${data.contactEmail}`,
      `📱 *Celular:* ${data.phone}`,
    ];

    if (data.linkUrl && data.linkUrl.trim()) {
      textLines.push(`🔗 *Enlace / Web:* ${data.linkUrl.trim()}`);
    }

    if (data.notes && data.notes.trim()) {
      textLines.push(`📝 *Propuesta / Detalle:* ${data.notes.trim()}`);
    }

    textLines.push('', '🚀 _Solicitud enviada desde UPPA (Zárate ↔ Campana)_');

    const encodedText = encodeURIComponent(textLines.join('\n'));
    return `https://wa.me/${rawNumber}?text=${encodedText}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { nombre, businessName, contactEmail, phone, linkUrl, notes };
    const url = buildWhatsAppUrl(data);
    setWhatsappLink(url);
    onSubmitInquiry(data);
    setSubmitted(true);

    // Intentar abrir WhatsApp directamente al enviar
    try {
      window.open(url, '_blank');
    } catch {}
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setNombre('');
    setBusinessName('');
    setContactEmail('');
    setPhone('');
    setLinkUrl('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0e111a] border border-amber-500/40 rounded-3xl shadow-2xl p-5 text-slate-100 relative overflow-hidden">
        {/* Glow de acento superior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">
                Incluir Negocio en el Banner
              </h2>
              <p className="text-[11px] text-amber-300 font-mono">
                Auspicio Local UPPA · Zárate ↔ Campana
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar formulario"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">¡Formulario Completado!</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Tu solicitud para incluir <span className="text-amber-300 font-bold">{businessName || 'tu negocio'}</span> ha sido registrada. Tocá el botón de abajo para enviar el mensaje directo por WhatsApp al administrador.
              </p>
            </div>

            {/* BOTÓN PROMINENTE DE WHATSAPP AL 3489686939 */}
            <div className="pt-2 pb-1 space-y-2.5">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-300"
              >
                <MessageCircle className="w-5 h-5 fill-slate-950 text-slate-950" />
                <span>Enviar por WhatsApp al 3489686939</span>
                <ExternalLink className="w-4 h-4 text-slate-950" />
              </a>

              <p className="text-[11px] font-mono text-emerald-300">
                Línea oficial de auspicios: +54 9 3489 68-6939
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Volver a la App
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-3.5">
            <div className="bg-amber-500/10 border border-amber-400/25 p-2.5 rounded-2xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-amber-200/90 leading-relaxed">
                Mostrá tu comercio en el banner inferior con movimiento infinito, imagen destacada y botones de enlace directo a tu web y WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nombre del Solicitante */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Tu Nombre y Apellido <span className="text-amber-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Lucía Gómez"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Nombre del Negocio */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Nombre del Negocio / Comercio <span className="text-amber-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Rotisería Malvinas"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  E-mail <span className="text-amber-400">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contacto@tunegocio.com"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Celular */}
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Celular / WhatsApp <span className="text-amber-400">*</span>
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 3489 15-xxxxxx"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono transition-colors"
                />
              </div>
            </div>

            {/* Enlace Web / URL (Opcional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Página Web o Enlace de tu Negocio <span className="text-slate-500 text-[10px]">(opcional)</span>
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://tunegocio.com o perfil de Instagram"
                className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-mono"
              />
            </div>

            {/* Propuesta o Mensaje */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Propuesta o Promoción a destacar <span className="text-slate-500 text-[10px]">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Descuento 10% en pizzas para usuarios de UPPA"
                className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none transition-colors"
              />
            </div>

            {/* Botón de Enviar */}
            <div className="pt-1">
              <button
                type="submit"
                className="w-full h-11.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer ring-1 ring-amber-300"
              >
                <Send className="w-4 h-4 fill-slate-950" />
                <span>Enviar y Abrir WhatsApp (3489686939)</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-1.5 font-mono">
                Se enviará notificación directa al WhatsApp 3489686939
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
