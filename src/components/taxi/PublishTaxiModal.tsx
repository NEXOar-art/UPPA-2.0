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
  marcarSolicitudWhatsappEnviada,
} from '../../services/realtimeFirebaseService';
import { calculateDriverSafetyIndex } from '../../utils/driverSafety';
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
  const [patente, setPatente] = useState('');
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
  const [createdHabId, setCreatedHabId] = useState<string | null>(null);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGeneratedCodeResult(null);
      setCreatedHabId(null);
      setErrorMsg('');
      setCodeSuccessMsg(null);
      setDriverName('');
      setWhatsapp('');
      setVehicleModel('');
      setPatente('');
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

  // Cálculo real del índice de seguridad del vehículo según ítems completados
  const currentSafetyIndex = calculateDriverSafetyIndex({
    vehicleType,
    patente,
    asientos,
    aireAcondicionado,
    baul,
    aceptaMascotas,
    cascoExtra,
    whatsapp,
  }).percentage;

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
      setErrorMsg('Detallá tu vehículo (ej: Chevrolet Corsa Gris o Moto Honda Titan).');
      return;
    }
    if (!patente.trim()) {
      setErrorMsg('Por favor ingresá la Patente / Matrícula de tu vehículo.');
      return;
    }

    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    const cleanPatente = patente.trim().toUpperCase();

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
      const createdHab = await solicitarHabilitacionChofer({
        driverId: currentUserId || `usr-driver-${Date.now()}`,
        driverName: driverName.trim(),
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        patente: cleanPatente,
        whatsapp: cleanWhatsapp.startsWith('54') ? cleanWhatsapp : `549${cleanWhatsapp}`,
        zone: zone.trim() || 'Zárate ↔ Campana',
        horas: selectedHours,
        comprobanteFileName: proofFileName || 'Comprobante WhatsApp 3489690058',
        asientos: vehicleType === 'auto' ? asientos : 1,
        aireAcondicionado: vehicleType === 'auto' ? aireAcondicionado : false,
        baul,
        aceptaMascotas: vehicleType === 'auto' ? aceptaMascotas : false,
        cascoExtra: vehicleType === 'moto' ? cascoExtra : false,
        indiceSeguridad: currentSafetyIndex,
      });
      if (createdHab?.id) setCreatedHabId(createdHab.id);
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
        patente: cleanPatente,
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
        indiceSeguridad: currentSafetyIndex,
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

    // Show generated code and direct WhatsApp anchor to user
    setGeneratedCodeResult(generatedCodeObj.code);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#101114]/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#202329] border-2 border-[#FFF19A]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 text-white shadow-[6px_6px_0px_rgba(0,0,0,0.65)] relative overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Minimalist Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#B7F36B]/50 flex items-center justify-center text-[#B7F36B] shrink-0">
              {vehicleType === 'moto' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white font-display leading-tight truncate tracking-tight">
                Habilitación de Chofer
              </h2>
              <p className="text-[11px] text-[#9299A5]">
                Registro verificado de prestador UPPA
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Cerrar ventana de habilitación de chofer"
            aria-label="Cerrar"
            className="w-11 h-11 rounded-xl bg-[#101114] hover:bg-[#101114]/80 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Título: Transferir para prestar servicio */}
        {!generatedCodeResult && (
          <div className="py-2.5 px-3 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/40 text-center my-3 shrink-0">
            <h3 className="text-xs sm:text-sm font-black text-[#FFF19A] tracking-wider uppercase font-display flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFF19A]" />
              <span>TRANSFERIR PARA PRESTAR SERVICIO</span>
            </h3>
          </div>
        )}

        {/* Error / Success message */}
        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border-2 border-rose-400/50 text-rose-200 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {codeSuccessMsg && (
          <div className="mb-3 p-3 rounded-xl bg-[#B7F36B]/15 border-2 border-[#B7F36B]/50 text-[#B7F36B] text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{codeSuccessMsg}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {generatedCodeResult ? (
            <div className="py-3 space-y-3.5 animate-in fade-in duration-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#B7F36B]/15 border-2 border-[#B7F36B] text-[#B7F36B] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-black text-white">¡Solicitud de Chofer Enviada!</h3>
                <p className="text-xs text-[#9299A5] mt-1 max-w-sm mx-auto leading-relaxed">
                  Tus datos se registraron en el sistema. El Administrador verifica tu comprobante de transferencia y te habilita directamente para comenzar a prestar servicio:
                </p>
              </div>

              {/* Resumen Real del Prestador (Sin input de clave administrativa) */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-white/15 max-w-sm mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">Prestador:</span>
                  <span className="font-bold text-white">{driverName}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">Vehículo:</span>
                  <span className="font-bold text-[#B7F36B]">
                    {vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} ({vehicleModel})
                  </span>
                </div>
                <div className="flex justify-between text-white items-center">
                  <span className="text-[#9299A5]">Patente / Matrícula:</span>
                  <span className="font-mono font-black text-[#101114] uppercase bg-white px-2 py-0.5 rounded border border-[#9299A5]">
                    {patente.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">Índice de Seguridad:</span>
                  <span className="font-black text-[#B7F36B] font-mono">{currentSafetyIndex}%</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">Tiempo Solicitado:</span>
                  <span className="font-black text-[#FFF19A]">{selectedHours} Horas (${totalAmount.toLocaleString('es-AR')} ARS)</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">WhatsApp de contacto:</span>
                  <span className="font-mono text-white">+{whatsapp}</span>
                </div>
                <div className="flex justify-between text-white pt-1.5 border-t border-white/10 gap-2">
                  <span className="text-[#9299A5] shrink-0">Confort / Capacidad:</span>
                  <span className="text-[#B7F36B] font-semibold text-right">
                    {vehicleType === 'moto'
                      ? `${cascoExtra ? 'Casco extra' : 'Sin casco'}${baul ? ' · Baúl' : ''}`
                      : `${asientos} asientos${aireAcondicionado ? ' · Aire' : ''}${baul ? ' · Baúl' : ''}${aceptaMascotas ? ' · Mascotas' : ''}`}
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
                  onClick={() => {
                    if (createdHabId) {
                      marcarSolicitudWhatsappEnviada(createdHabId);
                    }
                  }}
                  title="Enviar comprobante de transferencia al WhatsApp del Administrador"
                  className="w-full min-h-[46px] py-3 px-3 rounded-xl uppa-cta-green text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Enviar Comprobante al WhatsApp 3489690058</span>
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#101114] border border-white/15 text-[11px] text-[#9299A5] max-w-sm mx-auto text-left space-y-1.5">
                <div className="flex items-center gap-2 font-black text-white">
                  <KeyRound className="w-4 h-4 text-[#FFF19A] shrink-0" />
                  <span>Habilitación por Administrador</span>
                </div>
                <p className="text-[#9299A5] text-[11px] leading-relaxed">
                  El servicio y temporizador en vivo lo activa exclusivamente el Administrador tras corroborar la transferencia a <strong className="text-white">luciaveronicag</strong> enviada al WhatsApp <strong className="text-[#B7F36B]">3489690058</strong>.
                </p>
              </div>

              <div className="pt-2 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={onClose}
                  title="Cerrar confirmación y volver a la aplicación"
                  className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-[#101114] hover:bg-white/5 text-white border-2 border-white/20 text-xs font-black transition-all cursor-pointer active:scale-95"
                >
                  Entendido / Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTransferSubmit} className="space-y-3.5">
              {/* Vehicle Type Choice */}
              <div>
                <label className="block text-[11px] font-bold text-[#9299A5] mb-1.5 uppercase tracking-wider">
                  Tipo de Servicio a Prestar
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setVehicleType('auto')}
                    title="Seleccionar servicio Auto Taxi"
                    className={`min-h-[44px] p-2.5 rounded-xl border-2 text-center font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      vehicleType === 'auto'
                        ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[3px_3px_0px_rgba(0,0,0,0.5)]'
                        : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white hover:border-white/25'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                    <span>Auto Taxi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVehicleType('moto')}
                    title="Seleccionar servicio Moto Taxi"
                    className={`min-h-[44px] p-2.5 rounded-xl border-2 text-center font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      vehicleType === 'moto'
                        ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114] shadow-[3px_3px_0px_rgba(0,0,0,0.5)]'
                        : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white hover:border-white/25'
                    }`}
                  >
                    <Bike className="w-4 h-4" />
                    <span>Moto Taxi</span>
                  </button>
                </div>
              </div>

              {/* Hours Duration and Price */}
              <div>
                <label className="block text-[11px] font-bold text-[#9299A5] mb-1.5 uppercase tracking-wider">
                  Tiempo a Abonar (Duración del Temporizador)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_TIERS.map((tier) => (
                    <button
                      key={tier.hours}
                      type="button"
                      onClick={() => setSelectedHours(tier.hours)}
                      title={`Seleccionar plan ${tier.label} ($${tier.price.toLocaleString('es-AR')} ARS)`}
                      className={`min-h-[60px] p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        selectedHours === tier.hours
                          ? 'bg-[#101114] border-[#B7F36B] text-white shadow-[3px_3px_0px_rgba(183,243,107,0.3)]'
                          : 'bg-[#101114] border-white/10 text-[#9299A5] hover:text-white hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-black">{tier.label}</div>
                      <div className={`text-xs font-mono font-black mt-0.5 ${selectedHours === tier.hours ? 'text-[#B7F36B]' : 'text-white'}`}>
                        ${tier.price.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[9.5px] text-[#9299A5] mt-0.5">{tier.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Driver & Vehicle Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">Nombre / Apodo *</label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Ej: Marcelo Conductor"
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">WhatsApp de Contacto *</label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ej: 3487 55-2190"
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">Modelo de Vehículo *</label>
                  <input
                    type="text"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder={vehicleType === 'moto' ? 'Ej: Honda Titan 150 Roja' : 'Ej: Chevrolet Corsa Gris 2012'}
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">
                    Patente / Matrícula * <span className="text-[#B7F36B]">(Índice seguridad)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={patente}
                    onChange={(e) => setPatente(e.target.value.toUpperCase())}
                    placeholder="Ej: AB 123 CD o 123 ABC"
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-[#B7F36B]/40 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] uppercase font-mono font-black tracking-wider focus:outline-none focus:border-[#B7F36B]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-white mb-1">Zona Habitual</label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Ej: B° Malvinas ↔ Zárate"
                    className="w-full min-h-[42px] bg-[#101114] border-2 border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#9299A5] focus:outline-none focus:border-[#FFF19A]"
                  />
                </div>
              </div>

              {/* Confort y Capacidad del Servicio */}
              <div className="p-3 rounded-2xl bg-[#101114] border-2 border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#FFF19A]" />
                    <span>Confort y Capacidad del Servicio</span>
                  </label>
                  <span className="text-[10px] text-[#B7F36B] font-bold">Visible para pasajeros</span>
                </div>

                {/* Banner de Índice de Seguridad del Vehículo calculado en vivo */}
                <div className="p-2.5 rounded-xl bg-[#202329] border border-[#B7F36B]/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-[#B7F36B] shrink-0" />
                    <span>
                      Índice de Seguridad:{' '}
                      <span className="font-mono text-[#B7F36B] text-sm font-black">{currentSafetyIndex}%</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9299A5] font-medium">
                    (Según ítems completados)
                  </span>
                </div>

                {vehicleType === 'auto' ? (
                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[10px] text-[#9299A5] block mb-1.5 font-bold uppercase">Cantidad de Asientos para Pasajeros:</span>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setAsientos(num)}
                            title={`Indicar ${num} ${num === 1 ? 'asiento' : 'asientos'} disponibles`}
                            className={`min-h-[38px] py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer ${
                              asientos === num
                                ? 'bg-[#FFF19A] border-[#FFF19A] text-[#101114]'
                                : 'bg-[#202329] border-white/10 text-[#9299A5] hover:text-white'
                            }`}
                          >
                            {num} {num === 1 ? 'lugar' : 'lug.'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAireAcondicionado(!aireAcondicionado)}
                        title="Indicar si el vehículo cuenta con Aire Acondicionado"
                        className={`min-h-[42px] p-2 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          aireAcondicionado
                            ? 'bg-[#B7F36B]/15 border-[#B7F36B] text-white'
                            : 'bg-[#202329] border-white/10 text-[#9299A5]'
                        }`}
                      >
                        <span className="truncate">❄️ Aire Acond.</span>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          aireAcondicionado ? 'bg-[#B7F36B] text-[#101114]' : 'bg-[#101114] text-[#9299A5]'
                        }`}>
                          {aireAcondicionado ? '✓' : '×'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBaul(!baul)}
                        title="Indicar si cuenta con Baúl disponible"
                        className={`min-h-[42px] p-2 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          baul
                            ? 'bg-[#B7F36B]/15 border-[#B7F36B] text-white'
                            : 'bg-[#202329] border-white/10 text-[#9299A5]'
                        }`}
                      >
                        <span className="truncate">🧳 Baúl OK</span>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          baul ? 'bg-[#B7F36B] text-[#101114]' : 'bg-[#101114] text-[#9299A5]'
                        }`}>
                          {baul ? '✓' : '×'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAceptaMascotas(!aceptaMascotas)}
                        title="Indicar si permite llevar mascotas"
                        className={`min-h-[42px] p-2 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                          aceptaMascotas
                            ? 'bg-[#B7F36B]/15 border-[#B7F36B] text-white'
                            : 'bg-[#202329] border-white/10 text-[#9299A5]'
                        }`}
                      >
                        <span className="truncate">🐾 Mascotas</span>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          aceptaMascotas ? 'bg-[#B7F36B] text-[#101114]' : 'bg-[#101114] text-[#9299A5]'
                        }`}>
                          {aceptaMascotas ? '✓' : '×'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCascoExtra(!cascoExtra)}
                      title="Indicar si cuenta con casco extra obligatorio para el pasajero"
                      className={`min-h-[48px] p-2.5 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        cascoExtra
                          ? 'bg-[#B7F36B]/15 border-[#B7F36B] text-white'
                          : 'bg-[#202329] border-white/10 text-[#9299A5]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">🪖</span>
                        <div>
                          <span className="block font-black">Casco extra para pasajero</span>
                          <span className="text-[10px] text-[#9299A5] block font-normal">Cuenta con casco extra para el pasajero</span>
                        </div>
                      </span>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        cascoExtra ? 'bg-[#B7F36B] text-[#101114]' : 'bg-[#101114] text-[#9299A5]'
                      }`}>
                        {cascoExtra ? '✓' : '×'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBaul(!baul)}
                      title="Indicar si cuenta con baúl o portaequipaje en la moto"
                      className={`min-h-[48px] p-2.5 rounded-xl border-2 text-left text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        baul
                          ? 'bg-[#B7F36B]/15 border-[#B7F36B] text-white'
                          : 'bg-[#202329] border-white/10 text-[#9299A5]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">📦</span>
                        <div>
                          <span className="block font-black">Baúl / Portaequipaje</span>
                          <span className="text-[10px] text-[#9299A5] block font-normal">Espacio para bolso o mochila</span>
                        </div>
                      </span>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        baul ? 'bg-[#B7F36B] text-[#101114]' : 'bg-[#101114] text-[#9299A5]'
                      }`}>
                        {baul ? '✓' : '×'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bank Transfer Box */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/35 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9299A5] font-bold">Total a transferir:</span>
                  <span className="text-sm font-black text-[#FFF19A] font-mono">
                    ${totalAmount.toLocaleString('es-AR')} ARS
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#202329] border border-white/10 gap-2">
                  <div className="text-xs truncate">
                    <span className="text-[#9299A5] font-mono text-[11px]">Alias:</span>{' '}
                    <strong className="text-[#B7F36B] font-mono font-black tracking-wider">luciaveronicag</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAlias}
                    title="Copiar Alias bancario luciaveronicag"
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#FFF19A] hover:bg-[#fff5b8] text-[#101114] text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedAlias ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAlias ? 'Copiado' : 'Copiar Alias'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#202329] border border-white/10 gap-2">
                  <div className="text-xs truncate max-w-[240px]">
                    <span className="text-[#9299A5] font-mono text-[11px]">CVU:</span>{' '}
                    <span className="text-white font-mono text-[11px] font-bold">0000003100020253501840</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCbu}
                    title="Copiar CVU 0000003100020253501840"
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#101114] hover:bg-white/10 border border-white/15 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    {copiedCbu ? <Check className="w-3 h-3 text-[#B7F36B]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCbu ? 'Copiado' : 'Copiar CVU'}</span>
                  </button>
                </div>

                <div className="text-xs text-[#9299A5] font-medium px-1">
                  Titular: <strong className="text-white">Lucia Veronica Gimenez</strong>
                </div>

                {/* Envío de solicitud y comprobante */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    title="Registrar solicitud de chofer y abrir WhatsApp 3489690058 para adjuntar comprobante"
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 uppa-cta-green font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer text-center leading-snug"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Enviar Solicitud y Adjuntar Comprobante (WhatsApp 3489690058)</span>
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-[#9299A5] px-1 pt-0.5">
                    <span className="truncate max-w-[210px]">
                      {proofFileName || 'Adjuntar archivo opcional en la app'}
                    </span>
                    <label
                      title="Seleccionar archivo de comprobante de transferencia"
                      className="text-[#FFF19A] hover:underline cursor-pointer flex items-center gap-1 font-bold shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{proofFileName ? 'Cambiar archivo' : 'Subir archivo'}</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>

                  <p className="text-[10.5px] text-[#9299A5] text-center leading-relaxed pt-1">
                    Al presionar el botón se registran tus datos en el sistema y se abre WhatsApp para adjuntar el comprobante al <strong className="text-[#B7F36B] font-mono">3489690058</strong>.
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
