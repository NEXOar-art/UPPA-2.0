import React, { useState } from 'react';
import { X, Send, Megaphone, CheckCircle2 } from 'lucide-react';

interface ContactAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitInquiry: (data: { businessName: string; contactEmail: string; phone: string; zone: string; notes: string }) => void;
}

export const ContactAdModal: React.FC<ContactAdModalProps> = ({
  isOpen,
  onClose,
  onSubmitInquiry,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('Corredor Zárate - Campana');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitInquiry({ businessName, contactEmail, phone, zone, notes });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0e111a] border border-slate-700/80 rounded-3xl shadow-2xl p-5 text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Publicidad en UPPA</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-white">¡Solicitud recibida!</h3>
            <p className="text-xs text-slate-400">
              El equipo de administración de UPPA se pondrá en contacto para activar tu anuncio local.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-3">
            <p className="text-xs text-slate-400">
              Llegá a más de 5.000 trabajadores y estudiantes que consultan diariamente la línea Zárate ↔ Malvinas.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del negocio / Comercio</label>
              <input
                required
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: Gomería y Repuestos Zárate"
                className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contacto@negocio.com"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp / Teléfono</label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="3487 40-xxxx"
                  className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Zona o radio preferido</label>
              <input
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ej: Zárate Centro, Ruta 6 o B° Malvinas"
                className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Propuesta o mensaje</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Qué servicio o descuento te gustaría promocionar?"
                className="w-full bg-[#131622] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-2 transition-all shadow-md active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar consulta comercial</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
