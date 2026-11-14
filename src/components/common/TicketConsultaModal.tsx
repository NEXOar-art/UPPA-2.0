import React, { useEffect, useState } from 'react';
import {
  X,
  Ticket,
  Send,
  Mail,
  CheckCircle2,
  Copy,
  Check,
  User,
  MessageSquareText,
} from 'lucide-react';

export const CAUSAS_CONSULTA = [
  '❓ Información General',
  '📞 Contacto Comercial',
  '💻 Problemas con la Plataforma',
  '📱 Error en Aplicación Móvil',
  '😕 Reclamo',
  '💡 Sugerencia de Mejora',
] as const;

const SUPPORT_EMAIL = 'uppatransportecolaborativo@gmail.com';

interface TicketConsultaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserRole?: string;
  onSubmitted?: () => void;
}

export const TicketConsultaModal: React.FC<TicketConsultaModalProps> = ({
  isOpen,
  onClose,
  currentUserName = '',
  currentUserEmail = '',
  currentUserRole = 'passenger',
  onSubmitted,
}) => {
  const resolveDefaultPerfil = (role: string): 'Pasajero' | 'Prestador de Servicio' | 'Auspiciante' => {
    const r = (role || '').toLowerCase();
    if (r.includes('driver') || r.includes('chofer')) return 'Prestador de Servicio';
    return 'Pasajero';
  };

  const resolveDefaultName = (name: string): string => {
    const cleaned = (name || '').trim();
    if (!cleaned || cleaned === 'Pasajero' || cleaned === 'Invitado' || cleaned === 'Usuario') {
      return '';
    }
    return cleaned;
  };

  const [nombreApellido, setNombreApellido] = useState<string>(() => resolveDefaultName(currentUserName));
  const [perfilUsuario, setPerfilUsuario] = useState<'Pasajero' | 'Prestador de Servicio' | 'Auspiciante'>(() =>
    resolveDefaultPerfil(currentUserRole)
  );
  const [causaConsulta, setCausaConsulta] = useState<string>('');
  const [contacto, setContacto] = useState<string>(currentUserEmail || '');
  const [detalle, setDetalle] = useState<string>('');
  const [submittedMailto, setSubmittedMailto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNombreApellido((prev) => prev || resolveDefaultName(currentUserName));
      setContacto((prev) => prev || currentUserEmail || '');
      setPerfilUsuario(resolveDefaultPerfil(currentUserRole));
    }
  }, [isOpen, currentUserName, currentUserEmail, currentUserRole]);

  if (!isOpen) return null;

  const buildMailtoUrl = () => {
    const subject = `[UPPA Ticket] ${causaConsulta} - ${nombreApellido.trim()}`;
    const bodyLines = [
      'Ticket de Consulta · UPPA Transporte Colaborativo',
      '--------------------------------------------------',
      `Nombre y Apellido: ${nombreApellido.trim()}`,
      `Perfil: ${perfilUsuario}`,
      `Causa de Consulta: ${causaConsulta}`,
      contacto.trim() ? `E-mail / Teléfono de contacto: ${contacto.trim()}` : null,
      '',
      'Detalle de la consulta:',
      detalle.trim() || '(Sin detalle adicional)',
    ].filter((line): line is string => line !== null);

    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join('\n')
    )}`;
  };

  const triggerMailClient = (href: string) => {
    try {
      const link = document.createElement('a');
      link.href = href;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Fallback disponible en pantalla de confirmación
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreApellido.trim() || !causaConsulta) return;

    const mailtoHref = buildMailtoUrl();
    triggerMailClient(mailtoHref);
    setSubmittedMailto(mailtoHref);
    onSubmitted?.();
  };

  const handleCopyTicket = async () => {
    const textToCopy = [
      `Para: ${SUPPORT_EMAIL}`,
      `Asunto: [UPPA Ticket] ${causaConsulta} - ${nombreApellido.trim()}`,
      `Nombre y Apellido: ${nombreApellido.trim()}`,
      `Perfil: ${perfilUsuario}`,
      `Causa de Consulta: ${causaConsulta}`,
      contacto.trim() ? `Contacto: ${contacto.trim()}` : null,
      detalle.trim() ? `Detalle: ${detalle.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmittedMailto(null);
    setCausaConsulta('');
    setDetalle('');
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#202329] border-2 border-[#FFF19A]/45 rounded-3xl shadow-[6px_6px_0px_rgba(0,0,0,0.65)] p-5 text-white relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/50 text-[#FFF19A] flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white leading-tight truncate">
                Ticket de Consulta
              </h2>
              <p className="text-[11px] text-[#9299A5] truncate">
                Pasajeros, Prestadores de Servicio y Auspiciantes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            title="Cerrar Ticket de Consulta"
            aria-label="Cerrar"
            className="w-11 h-11 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedMailto ? (
          <div className="py-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-[#B7F36B]/15 border-2 border-[#B7F36B] flex items-center justify-center mx-auto text-[#B7F36B]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-white">Ticket Generado</h3>
              <p className="text-xs text-[#9299A5] max-w-sm mx-auto leading-relaxed">
                Tu consulta de <strong className="text-[#FFF19A]">{causaConsulta}</strong> está lista para enviarse por correo a:
              </p>
              <p className="text-xs font-mono font-black text-[#B7F36B] break-all">
                {SUPPORT_EMAIL}
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <a
                href={submittedMailto}
                title={`Abrir cliente de correo para enviar a ${SUPPORT_EMAIL}`}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>Enviar ahora a {SUPPORT_EMAIL}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyTicket}
                title="Copiar dirección de e-mail y datos del ticket"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#101114] hover:border-[#B7F36B] border-2 border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-[#B7F36B]" /> : <Copy className="w-4 h-4 text-[#FFF19A]" />}
                <span>{copied ? 'Datos y e-mail copiados al portapapeles' : 'Copiar datos y e-mail'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                title="Cerrar ventana y volver a UPPA"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#101114] hover:bg-white/5 border border-white/15 text-[#9299A5] hover:text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Volver a la App
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-3.5">
            {/* Tipo de Usuario */}
            <div>
              <label className="block text-xs font-bold text-white mb-1.5">
                ¿Quién realiza la consulta?
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-[#101114] p-1 rounded-xl border border-white/15">
                {(['Pasajero', 'Prestador de Servicio', 'Auspiciante'] as const).map((rol) => {
                  const isActive = perfilUsuario === rol;
                  return (
                    <button
                      key={rol}
                      type="button"
                      onClick={() => setPerfilUsuario(rol)}
                      title={`Seleccionar perfil: ${rol}`}
                      className={`min-h-[40px] px-2 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer truncate ${
                        isActive
                          ? 'bg-[#FFF19A] text-[#101114]'
                          : 'text-[#9299A5] hover:text-white'
                      }`}
                    >
                      {rol === 'Prestador de Servicio' ? 'Prestador' : rol}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nombre y Apellido */}
            <div>
              <label htmlFor="ticket-nombre" className="block text-xs font-bold text-white mb-1">
                Nombre y Apellido <span className="text-[#FFF19A]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#9299A5] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="ticket-nombre"
                  type="text"
                  required
                  value={nombreApellido}
                  onChange={(e) => setNombreApellido(e.target.value)}
                  placeholder="Ej: María Laura Fernández"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#101114] border-2 border-white/15 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
                />
              </div>
            </div>

            {/* Causa de Consulta */}
            <div>
              <label htmlFor="ticket-causa" className="block text-xs font-bold text-white mb-1">
                Causa de Consulta <span className="text-[#FFF19A]">*</span>
              </label>
              <select
                id="ticket-causa"
                required
                value={causaConsulta}
                onChange={(e) => setCausaConsulta(e.target.value)}
                title="Seleccioná la causa de tu consulta"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#101114] border-2 border-white/15 text-xs font-bold text-white focus:outline-none focus:border-[#FFF19A] transition-colors cursor-pointer"
              >
                <option value="" disabled>
                  Seleccioná una causa de consulta...
                </option>
                {CAUSAS_CONSULTA.map((causa) => (
                  <option key={causa} value={causa}>
                    {causa}
                  </option>
                ))}
              </select>
            </div>

            {/* Contacto opcional */}
            <div>
              <label htmlFor="ticket-contacto" className="block text-xs font-semibold text-white mb-1">
                Tu E-mail o WhatsApp <span className="text-[#9299A5] text-[10px]">(opcional para responderte)</span>
              </label>
              <input
                id="ticket-contacto"
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="tu@correo.com o número de celular"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#101114] border-2 border-white/15 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] transition-colors"
              />
            </div>

            {/* Detalle */}
            <div>
              <label htmlFor="ticket-detalle" className="block text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-[#B7F36B]" />
                <span>Detalle de la consulta <span className="text-[#9299A5] text-[10px]">(opcional)</span></span>
              </label>
              <textarea
                id="ticket-detalle"
                rows={3}
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Contanos brevemente tu consulta, reclamo o sugerencia..."
                className="w-full px-3 py-2 rounded-xl bg-[#101114] border-2 border-white/15 text-xs text-white placeholder:text-[#9299A5] focus:outline-none focus:border-[#FFF19A] resize-none transition-colors"
              />
            </div>

            {/* Submit Button to uppatransportecolaborativo@gmail.com */}
            <div className="pt-1 space-y-1.5">
              <button
                type="submit"
                title={`Enviar ticket de consulta a ${SUPPORT_EMAIL}`}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl uppa-cta-yellow font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Enviar a {SUPPORT_EMAIL}</span>
              </button>
              <p className="text-[10.5px] text-center text-[#9299A5] font-mono">
                Destinatario oficial: {SUPPORT_EMAIL}
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
