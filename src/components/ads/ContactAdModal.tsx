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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#202329] border-2 border-[#FFF19A]/45 rounded-3xl shadow-[6px_6px_0px_rgba(0,0,0,0.65)] p-5 text-white relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/40 text-[#FFF19A] flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">
                Incluir Negocio en el Banner
              </h2>
              <p className="text-[11px] text-[#FFF19A] font-mono">
                Auspicio Local UPPA · Zárate ↔ Campana
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-11 h-11 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar formulario de auspicio"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#B7F36B]/15 border-2 border-[#B7F36B] flex items-center justify-center mx-auto text-[#B7F36B]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">¡Formulario Completado!</h3>
              <p className="text-xs text-[#9299A5] mt-1 max-w-sm mx-auto">
                Tu solicitud para incluir <span className="text-[#FFF19A] font-bold">{businessName || 'tu negocio'}</span> ha sido registrada. Tocá el botón para enviar el mensaje directo por WhatsApp.
              </p>
            </div>

            <div className="pt-2 pb-1 space-y-2.5">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Enviar solicitud de auspicio comercial al WhatsApp 3489686939"
                className="w-full min-h-[48px] rounded-xl uppa-cta-green font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Enviar por WhatsApp al 3489686939</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <p className="text-[11px] font-mono text-[#B7F36B]">
                Línea oficial de auspicios: +54 9 3489 68-6939
              </p>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                title="Cerrar ventana y regresar a la aplicación"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#101114] hover:bg-white/5 border border-white/15 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Volver a la App
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-3.5">
            <div className="bg-[#101114] border border-[#FFF19A]/30 p-3 rounded-xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#FFF19A] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#9299A5] leading-relaxed">
                Mostrá tu comercio en el banner inferior con imagen destacada y botones de enlace directo a tu web y WhatsApp.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Tu Nombre y Apellido <span className="text-[#FFF19A]">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Lucía Gómez"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Nombre del Negocio <span className="text-[#FFF19A]">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Rotisería Malvinas"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  E-mail <span className="text-[#FFF19A]">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contacto@tunegocio.com"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Celular / WhatsApp <span className="text-[#FFF19A]">*</span>
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 3489 15-xxxxxx"
                  className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] font-mono transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Página Web o Enlace <span className="text-[#9299A5] text-[10px]">(opcional)</span>
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://tunegocio.com o perfil de Instagram"
                className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Propuesta o Promoción <span className="text-[#9299A5] text-[10px]">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Descuento 10% en pizzas para usuarios de UPPA"
                className="w-full bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] resize-none transition-colors"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                title="Enviar datos del comercio y abrir WhatsApp 3489686939"
                className="w-full min-h-[46px] uppa-cta-yellow font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Enviar y Abrir WhatsApp (3489686939)</span>
              </button>
              <p className="text-[10px] text-center text-[#9299A5] mt-1.5 font-mono">
                Se enviará notificación directa al WhatsApp 3489686939
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
