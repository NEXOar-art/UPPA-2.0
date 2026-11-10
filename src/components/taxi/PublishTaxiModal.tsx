import React, { useState, useEffect } from 'react';
import { TaxiListing, PaymentProof } from '../../types';
import {
  generateActivationCode,
  validateAndActivateCode,
  getAllActivationCodes,
  getActiveDriverSession,
  ActiveDriverSession,
} from '../../services/driverActivationService';
import {
  solicitarHabilitacionChofer,
} from '../../services/realtimeFirebaseService';
import {
  X,
  Copy,
  Check,
  Upload,
  Clock,
  Phone,
  Car,
  Bike,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Send,
  MessageCircle,
} from 'lucide-react';

interface PublishTaxiModalProps {
  isOpen: boolean;
  initialTab?: 'transfer' | 'enter-code';
  onClose: () => void;
  onSubmit: (
    listing: Omit<TaxiListing, 'id' | 'startsAt' | 'endsAt' | 'status' | 'rating' | 'completedRides'>,
    payment: Omit<PaymentProof, 'id' | 'createdAt' | 'status'>
  ) => void;
  onActivateDriverSession?: (session: ActiveDriverSession) => void;
  currentUserId: string;
  currentUserName: string;
  currentUserPhone?: string;
}

const PRESET_TIERS = [
  { hours: 2, price: 6000, label: '2 Horas', badge: 'Turno Corto' },
  { hours: 6, price: 16000, label: '6 Horas', badge: 'Medio Turno' },
  { hours: 12, price: 25000, label: '12 Horas', badge: 'Promoción' },
  { hours: 24, price: 45000, label: '24 Horas', badge: 'Día Completo' },
];

export const PublishTaxiModal: React.FC<PublishTaxiModalProps> = ({
  isOpen,
  initialTab = 'transfer',
  onClose,
  onSubmit,
  onActivateDriverSession,
  currentUserId,
  currentUserName,
  currentUserPhone = '',
}) => {
  // Transfer Step Form
  const [selectedHours, setSelectedHours] = useState<number>(12);
  const [driverName, setDriverName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [vehicleType, setVehicleType] = useState<'auto' | 'moto'>('auto');
  const [vehicleModel, setVehicleModel] = useState('');
  const [zone, setZone] = useState('');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [copiedCbu, setCopiedCbu] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Confort y Capacidad del Servicio
  const [asientos, setAsientos] = useState<number>(4);
  const [aireAcondicionado, setAireAcondicionado] = useState<boolean>(true);
  const [baul, setBaul] = useState<boolean>(true);
  const [aceptaMascotas, setAceptaMascotas] = useState<boolean>(false);
  const [cascoExtra, setCascoExtra] = useState<boolean>(true);

  // Generated code presentation state
  const [generatedCodeResult, setGeneratedCodeResult] = useState<string | null>(null);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGeneratedCodeResult(null);
      setErrorMsg('');
      setCodeSuccessMsg(null);
      setDriverName('');
      setWhatsapp('');
      setVehicleModel('');
      setZone('');
      setAsientos(4);
      setAireAcondicionado(true);
      setBaul(true);
      setAceptaMascotas(false);
      setCascoExtra(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTier = PRESET_TIERS.find((t) => t.hours === selectedHours) || PRESET_TIERS[2];
  const totalAmount = currentTier.price;

  const handleCopyAlias = () => {
    navigator.clipboard.writeText('luciaveronicag');
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const handleCopyCbu = () => {
    navigator.clipboard.writeText('0000003100020253501840');
    setCopiedCbu(true);
    setTimeout(() => setCopiedCbu(false), 2000);
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFileName(e.target.files[0].name);
    }
  };

  // Step 1: Submit Transfer and automatically record in Firestore & Administración UPPA
  const handleTransferSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!driverName.trim()) {
      setErrorMsg('Por favor ingresá tu nombre o apodo para el servicio.');
      return;
    }
    if (!whatsapp.trim()) {
      setErrorMsg('Ingresá el número de WhatsApp donde te contactarán los pasajeros.');
      return;
    }
    if (!vehicleModel.trim()) {
      setErrorMsg('Detallá tu vehículo (ej: Chevrolet Corsa Blanco o Moto Honda Titan).');
      return;
    }

    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    // 1. Generate unique Activation Code
    const generatedCodeObj = generateActivationCode({
      driverName: driverName.trim(),
      vehicleType,
      vehicleModel: vehicleModel.trim(),
      whatsapp: cleanWhatsapp,
      hours: selectedHours,
    });

    // 2. Register driver request in Firestore and notify Administración UPPA immediately
    try {
      await solicitarHabilitacionChofer({
        driverId: currentUserId || `usr-driver-${Date.now()}`,
        driverName: driverName.trim(),
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        whatsapp: cleanWhatsapp.startsWith('54') ? cleanWhatsapp : `549${cleanWhatsapp}`,
        zone: zone.trim() || 'Zárate ↔ Campana',
        horas: selectedHours,
        comprobanteFileName: proofFileName || 'Comprobante WhatsApp 3489690058',
        asientos: vehicleType === 'auto' ? asientos : 1,
        aireAcondicionado: vehicleType === 'auto' ? aireAcondicionado : false,
        baul,
        aceptaMascotas: vehicleType === 'auto' ? aceptaMascotas : false,
        cascoExtra: vehicleType === 'moto' ? cascoExtra : false,
      });
    } catch (err) {
      console.warn('Sync driver request warning:', err);
    }

    // 3. Submit payment proof
    onSubmit(
      {
        userId: currentUserId,
        driverName: driverName.trim(),
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        whatsapp: cleanWhatsapp.startsWith('54') ? cleanWhatsapp : `549${cleanWhatsapp}`,
        zone: zone.trim() || 'Zárate ↔ Campana',
        lat: -34.175 + (Math.random() - 0.5) * 0.03,
        lng: -58.965 + (Math.random() - 0.5) * 0.03,
        hoursPaid: selectedHours,
        activationCode: generatedCodeObj.code,
        asientos: vehicleType === 'auto' ? asientos : 1,
        aireAcondicionado: vehicleType === 'auto' ? aireAcondicionado : false,
        baul,
        aceptaMascotas: vehicleType === 'auto' ? aceptaMascotas : false,
        cascoExtra: vehicleType === 'moto' ? cascoExtra : false,
      },
      {
        userId: currentUserId,
        userName: driverName.trim(),
        whatsapp: cleanWhatsapp,
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        zone: zone.trim() || 'Zárate ↔ Campana',
        amount: totalAmount,
        hours: selectedHours,
        proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        proofFileName: proofFileName || 'comprobante_luciaveronicag.pdf',
        alias: 'luciaveronicag',
        activationCode: generatedCodeObj.code,
      }
    );

    // 4. Open WhatsApp to send proof
    const waText = encodeURIComponent(
      `Hola Lucia Veronica Gimenez! Te envío los datos y el comprobante de transferencia para la Habilitación de Chofer en UPPA.\n\n` +
      `• Chofer: ${driverName.trim()}\n` +
      `• Vehículo: ${vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} (${vehicleModel.trim()})\n` +
      `• Confort/Capacidad: ${
        vehicleType === 'moto'
          ? `${cascoExtra ? 'Cuenta con casco extra para el pasajero' : 'Sin casco extra'}${baul ? ' · Con baúl' : ''}`
          : `${asientos} asientos${aireAcondicionado ? ' · Aire Acondicionado' : ''}${baul ? ' · Baúl' : ''}${aceptaMascotas ? ' · Mascotas OK' : ''}`
      }\n` +
      `• WhatsApp de contacto: ${whatsapp.trim()}\n` +
      `• Plan: ${selectedHours} horas ($${totalAmount.toLocaleString('es-AR')} ARS)\n` +
      `• Código generado: ${generatedCodeObj.code}\n` +
      `• Transferencia enviada a: Alias: luciaveronicag | CVU: 0000003100020253501840 | Titular: Lucia Veronica Gimenez`
    );
    try {
      window.open(`https://wa.me/5493489690058?text=${waText}`, '_blank');
    } catch {}

    // Show generated code to user
    setGeneratedCodeResult(generatedCodeObj.code);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0b0e17] border border-emerald-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 text-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Ambient Top Pastel Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400" />

        {/* Modal Header (Sin el subtítulo de transferencia para una visual más limpia) */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-white/5 shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              {vehicleType === 'moto' ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white font-display leading-tight truncate">
                Habilitación de Chofer
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título: Transferir para prestar servicio */}
        {!generatedCodeResult && (
          <div className="py-2.5 px-3 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-center my-2.5 sm:my-3 shrink-0 shadow-sm">
            <h3 className="text-xs sm:text-sm font-black text-emerald-300 tracking-wider uppercase font-display flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>TRANSFERIR PARA PRESTAR SERVICIO</span>
            </h3>
          </div>
        )}

        {/* Error / Success message */}
        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {codeSuccessMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{codeSuccessMsg}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* ========================================================
              CONFIRMATION SCREEN (SIN CÓDIGO SIMULADO - HABILITACIÓN POR ADMINISTRADOR)
              ======================================================== */}
          {generatedCodeResult ? (
            <div className="py-3 space-y-3.5 animate-in fade-in duration-200 text-center">
              <div className="w-14 h-14 rounded-3xl bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">¡Solicitud de Chofer Enviada!</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                  Tus datos se registraron en el sistema. El Administrador verifica tu comprobante de transferencia y te habilita directamente para comenzar a prestar servicio:
                </p>
              </div>

              {/* Resumen Real del Prestador (Sin códigos simulados) */}
              <div className="p-3.5 rounded-2xl bg-black/60 border border-emerald-500/30 max-w-sm mx-auto text-left space-y-1.5 text-xs shadow-inner">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Prestador:</span>
                  <span className="font-bold text-white">{driverName}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Vehículo:</span>
                  <span className="font-semibold text-emerald-300">
                    {vehicleType === 'moto' ? '🏍️ Moto Taxi' : '🚕 Auto Taxi'} ({vehicleModel})
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Tiempo Solicitado:</span>
                  <span className="font-bold text-amber-300">{selectedHours} Horas (${totalAmount.toLocaleString('es-AR')} ARS)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">WhatsApp de contacto:</span>
                  <span className="font-mono text-slate-200">+{whatsapp}</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-white/5">
                  <span className="text-slate-400">Confort / Capacidad:</span>
                  <span className="text-emerald-300 font-medium">
                    {vehicleType === 'moto'
                      ? `${cascoExtra ? '🪖 Casco extra' : 'Sin casco'}${baul ? ' · 📦 Baúl' : ''}`
                      : `${asientos} asientos${aireAcondicionado ? ' · ❄️ Aire' : ''}${baul ? ' · 🧳 Baúl' : ''}${aceptaMascotas ? ' · 🐾 Mascotas' : ''}`}
                  </span>
                </div>
              </div>

              {/* Botón de WhatsApp para comunicarse con el Administrador */}
              <div className="max-w-sm mx-auto space-y-2">
                <a
                  href={`https://wa.me/5493489690058?text=${encodeURIComponent(
                    `Hola Lucia Veronica Gimenez! Acabo de transferir $${totalAmount.toLocaleString('es-AR')} ARS a luciaveronicag para prestar servicio de ${
                      vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'
                    } por ${selectedHours} horas.\nChofer: ${driverName.trim()}\nVehículo: ${vehicleModel.trim()}\nWhatsApp chofer: ${whatsapp.trim()}\nZona: ${zone.trim() || 'Zárate ↔ Campana'}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white border border-emerald-400/40 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-white shrink-0" />
                  <span>Enviar Comprobante al WhatsApp 3489690058</span>
                </a>
              </div>

              {/* Todo el texto de Habilitación por Administrador */}
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-[11px] text-purple-200 max-w-sm mx-auto text-left space-y-2 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-white">
                  <KeyRound className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Habilitación por Administrador</span>
                </div>
                <p className="text-slate-300 text-[10.5px] leading-relaxed">
                  El servicio y temporizador en vivo lo activa exclusivamente el Administrador tras corroborar la transferencia a <strong className="text-white">luciaveronicag</strong> enviada al WhatsApp <strong>3489690058</strong>. No tenés que ingresar ningún código: el Administrador es quien valida y te habilita directamente en el sistema para que comiences a tomar viajes.
                </p>
              </div>

              <div className="pt-2 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Entendido / Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================
               FORMULARIO INTACTO: TRANSFERIR PARA PRESTAR SERVICIO
               ======================================================== */
            <form onSubmit={handleTransferSubmit} className="space-y-3 sm:space-y-3.5">

              {/* Vehicle Type Choice */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Tipo de Servicio a Prestar
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVehicleType('auto')}
                    className={`p-2.5 rounded-2xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      vehicleType === 'auto'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                        : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Auto Taxi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVehicleType('moto')}
                    className={`p-2.5 rounded-2xl border text-center font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      vehicleType === 'moto'
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                        : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto Taxi</span>
                  </button>
                </div>
              </div>

              {/* Hours Duration and Price */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Tiempo a Abonar (Duración del Temporizador)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_TIERS.map((tier) => (
                    <button
                      key={tier.hours}
                      type="button"
                      onClick={() => setSelectedHours(tier.hours)}
                      className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        selectedHours === tier.hours
                          ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400 shadow-sm'
                          : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{tier.label}</div>
                      <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
                        ${tier.price.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{tier.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver & Vehicle Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre / Apodo</label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Ej: Marcelo Conductor"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">WhatsApp de Contacto</label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ej: 3487 55-2190"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Modelo de Vehículo</label>
                  <input
                    type="text"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ej: Chevrolet Corsa Gris o Honda 150"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Zona Habitual</label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Ej: B° Malvinas ↔ Zárate"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Confort y Capacidad del Servicio */}
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Confort y Capacidad del Servicio</span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">Visible para pasajeros</span>
                </div>

                {vehicleType === 'auto' ? (
                  <div className="space-y-2">
                    {/* Selector de Asientos */}
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1 font-medium">Cantidad de Asientos para Pasajeros:</span>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setAsientos(num)}
                            className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              asientos === num
                                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400 shadow-sm'
                                : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            {num} {num === 1 ? 'lugar' : 'lugares'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Toggles de Confort: Aire, Baúl, Mascotas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setAireAcondicionado(!aireAcondicionado)}
                        className={`p-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          aireAcondicionado
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>❄️</span>
                          <span>Aire Acondicionado</span>
                        </span>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          aireAcondicionado ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {aireAcondicionado ? '✓' : '×'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBaul(!baul)}
                        className={`p-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          baul
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>🧳</span>
                          <span>Baúl Disponible</span>
                        </span>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          baul ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {baul ? '✓' : '×'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAceptaMascotas(!aceptaMascotas)}
                        className={`p-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          aceptaMascotas
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>🐾</span>
                          <span>Lleva Mascotas</span>
                        </span>
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          aceptaMascotas ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {aceptaMascotas ? '✓' : '×'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCascoExtra(!cascoExtra)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          cascoExtra
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-base">🪖</span>
                          <div>
                            <span className="block font-bold">Casco extra para pasajero</span>
                            <span className="text-[10px] text-slate-400 block">Cuenta con casco extra para el pasajero</span>
                          </div>
                        </span>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          cascoExtra ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {cascoExtra ? '✓' : '×'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBaul(!baul)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          baul
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-white'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-base">📦</span>
                          <div>
                            <span className="block font-bold">Baúl / Portaequipaje</span>
                            <span className="text-[10px] text-slate-400 block">Espacio para bolso o mochila</span>
                          </div>
                        </span>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          baul ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {baul ? '✓' : '×'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Transfer Box (Alias: luciaveronicag, CVU: 0000003100020253501840, Nombre: Lucia Veronica Gimenez) */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Total a transferir:</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    ${totalAmount.toLocaleString('es-AR')} ARS
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">Alias:</span>{' '}
                    <strong className="text-emerald-300 font-mono font-bold tracking-wider">luciaveronicag</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAlias}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedAlias ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAlias ? 'Copiado' : 'Copiar Alias'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5">
                  <div className="text-xs truncate max-w-[240px]">
                    <span className="text-slate-400 font-mono text-[11px]">CVU:</span>{' '}
                    <span className="text-slate-200 font-mono text-[11px] font-semibold">0000003100020253501840</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCbu}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedCbu ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCbu ? 'Copiado' : 'Copiar CVU'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-300 font-medium px-1">
                  Nombre: <strong className="text-white">Lucia Veronica Gimenez</strong>
                </div>

                {/* Envío de solicitud y comprobante al sistema y a WhatsApp 3489690058 */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-97 text-center leading-snug"
                  >
                    <MessageCircle className="w-4 h-4 fill-slate-950 shrink-0" />
                    <span>Enviar Solicitud y Adjuntar Comprobante (WhatsApp 3489690058)</span>
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-0.5">
                    <span className="truncate max-w-[210px]">
                      {proofFileName || 'Adjuntar archivo opcional en la app'}
                    </span>
                    <label className="text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 font-semibold underline shrink-0">
                      <Upload className="w-3 h-3" />
                      <span>{proofFileName ? 'Cambiar archivo' : 'Subir archivo'}</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center leading-relaxed pt-1">
                    Al presionar el botón se registran tus datos en el sistema y se abre WhatsApp para adjuntar el comprobante directamente al <strong className="text-emerald-300 font-mono">3489690058</strong>.
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
