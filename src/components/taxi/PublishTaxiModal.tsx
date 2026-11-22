import React, { useState, useEffect, useRef } from 'react';
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
import { playMicroSound } from '../../utils/soundEffects';
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
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Send,
  MessageCircle,
  FileCheck2,
  Edit3,
} from 'lucide-react';

interface PublishTaxiModalProps {
  isOpen: boolean;
  initialTab?: 'transfer' | 'enter-code';
  initialVehicleType?: 'auto' | 'moto';
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

const MAX_PROOF_IMAGE_BYTES = 60 * 1024; // 60 KB máximo

async function processReceiptImageUnder60Kb(file: File): Promise<{
  dataUrl: string;
  finalFile: File;
  sizeBytes: number;
  wasOptimized: boolean;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor seleccioná una imagen (JPG, PNG o WebP) que no supere los 60 KB.');
  }

  const readAsDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      reader.readAsDataURL(blob);
    });

  if (file.size <= MAX_PROOF_IMAGE_BYTES) {
    const dataUrl = await readAsDataUrl(file);
    return {
      dataUrl,
      finalFile: file,
      sizeBytes: file.size,
      wasOptimized: false,
    };
  }

  // Optimizar automáticamente imágenes > 60 KB mediante canvas para no superar los 60 KB
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo procesar la imagen del comprobante.'));
      el.src = objectUrl;
    });

    const attempts: Array<{ maxDim: number; quality: number }> = [
      { maxDim: 960, quality: 0.78 },
      { maxDim: 800, quality: 0.65 },
      { maxDim: 640, quality: 0.55 },
      { maxDim: 520, quality: 0.45 },
      { maxDim: 420, quality: 0.36 },
    ];

    for (const { maxDim, quality } of attempts) {
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 1) * scale));
      const h = Math.max(1, Math.round((img.height || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      );

      if (blob && blob.size <= MAX_PROOF_IMAGE_BYTES) {
        const cleanBaseName = file.name.replace(/\.[^.]+$/, '') || 'comprobante';
        const finalFile = new File([blob], `${cleanBaseName}.jpg`, { type: 'image/jpeg' });
        const dataUrl = await readAsDataUrl(blob);
        return {
          dataUrl,
          finalFile,
          sizeBytes: blob.size,
          wasOptimized: true,
        };
      }
    }

    throw new Error(
      'La imagen seleccionada supera los 60 KB permitidos. Probá con una captura o foto más liviana (máx. 60 KB).'
    );
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {}
  }
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
  initialVehicleType = 'auto',
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

  // Generated code & step state
  const [formStep, setFormStep] = useState<'form' | 'review-payment' | 'submitted'>('form');
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofFileObj, setProofFileObj] = useState<File | null>(null);
  const [proofSizeBytes, setProofSizeBytes] = useState<number | null>(null);
  const [proofStatusNote, setProofStatusNote] = useState<string | null>(null);
  const [isProcessingProof, setIsProcessingProof] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCodeResult, setGeneratedCodeResult] = useState<string | null>(null);
  const [createdHabId, setCreatedHabId] = useState<string | null>(null);
  const [codeSuccessMsg, setCodeSuccessMsg] = useState<string | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [formStep]);

  useEffect(() => {
    if (isOpen) {
      setFormStep('form');
      setProofPreviewUrl(null);
      setProofDataUrl(null);
      setProofFileObj(null);
      setProofSizeBytes(null);
      setProofStatusNote(null);
      setIsProcessingProof(false);
      setIsSubmitting(false);
      setGeneratedCodeResult(null);
      setCreatedHabId(null);
      setErrorMsg('');
      setCodeSuccessMsg(null);
      const validDefaultName =
        currentUserName &&
        currentUserName.trim() !== 'Comunidad UPPA' &&
        currentUserName.trim() !== 'Pasajero'
          ? currentUserName.trim()
          : '';
      setDriverName(validDefaultName);
      setWhatsapp(currentUserPhone || '');
      setVehicleType(initialVehicleType || 'auto');
      setVehicleModel('');
      setPatente('');
      setZone('');
      setProofFileName('');
      setAsientos(4);
      setAireAcondicionado(true);
      setBaul(true);
      setAceptaMascotas(false);
      setCascoExtra(true);
    }
  }, [isOpen, initialVehicleType, currentUserName, currentUserPhone]);

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


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg('');
    setProofStatusNote(null);
    setIsProcessingProof(true);
    try {
      const processed = await processReceiptImageUnder60Kb(file);
      setProofFileName(processed.finalFile.name);
      setProofFileObj(processed.finalFile);
      setProofDataUrl(processed.dataUrl);
      setProofPreviewUrl(processed.dataUrl);
      setProofSizeBytes(processed.sizeBytes);
      const kbStr = (processed.sizeBytes / 1024).toFixed(1);
      setProofStatusNote(
        processed.wasOptimized
          ? `Imagen optimizada a ${kbStr} KB (≤ 60 KB) lista para enviar.`
          : `Imagen cargada: ${kbStr} KB (≤ 60 KB) lista para enviar.`
      );
      playMicroSound('ui_tap');
    } catch (err: any) {
      setProofFileName('');
      setProofFileObj(null);
      setProofDataUrl(null);
      setProofPreviewUrl(null);
      setProofSizeBytes(null);
      setErrorMsg(err?.message || 'La imagen del comprobante no debe superar los 60 KB.');
    } finally {
      setIsProcessingProof(false);
    }
  };

  const buildWhatsappSummaryText = () => {
    const comfortText =
      vehicleType === 'auto'
        ? `Asientos: ${asientos}, Aire: ${aireAcondicionado ? 'Sí' : 'No'}, Baúl: ${baul ? 'Sí' : 'No'}, Mascotas: ${aceptaMascotas ? 'Sí' : 'No'}`
        : `Casco extra: ${cascoExtra ? 'Sí' : 'No'}, Baúl/Portaequipaje: ${baul ? 'Sí' : 'No'}`;
    const sizeInfo = proofSizeBytes ? ` (${(proofSizeBytes / 1024).toFixed(1)} KB)` : '';
    return `Hola Lucia Veronica Gimenez! Acabo de transferir $${totalAmount.toLocaleString('es-AR')} ARS a Alias: luciaveronicag (CVU: 0000003100020253501840) para prestar servicio de ${
      vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'
    } por ${selectedHours} horas.\n• Chofer: ${driverName.trim()}\n• WhatsApp: ${whatsapp.trim()}\n• Vehículo: ${vehicleModel.trim()}\n• Patente: ${patente.trim().toUpperCase()}\n• Zona: ${zone.trim() || 'Zárate ↔ Campana'}\n• Confort: ${comfortText}\n• Índice Seguridad: ${currentSafetyIndex}%\n• Comprobante: ${proofFileName ? `${proofFileName}${sizeInfo}` : 'Adjunto a continuación'}`;
  };

  const handleShareImageAndDataToWhatsApp = async () => {
    const text = buildWhatsappSummaryText();
    if (createdHabId) {
      marcarSolicitudWhatsappEnviada(createdHabId);
    }
    if (
      proofFileObj &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [proofFileObj] })
    ) {
      try {
        await navigator.share({
          title: 'Habilitación de Chofer UPPA',
          text,
          files: [proofFileObj],
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    const url = `https://wa.me/5493489690058?text=${encodeURIComponent(text)}`;
    window.location.assign(url);
  };

  // Paso 1 -> Paso 2: Validar datos personales y del vehículo, y habilitar Alias/CVU + Resumen + Adjuntar Comprobante
  const handleProceedToPaymentAndReview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    if (!driverName.trim()) {
      setErrorMsg('Por favor ingresá tu nombre o apodo para el servicio.');
      return;
    }
    if (cleanWhatsapp.length < 8) {
      setErrorMsg('Ingresá un número de WhatsApp válido (mínimo 8 dígitos, ej: 3487 55-2190).');
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

    playMicroSound('ui_tap');
    setFormStep('review-payment');
  };

  // Paso 2 -> Final: Registrar en Firestore & Administración UPPA todos los datos + comprobante
  const handleConfirmFinalSubmission = async () => {
    if (isSubmitting) return;
    setErrorMsg('');

    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    const cleanPatente = patente.trim().toUpperCase();
    const formattedWhatsapp = cleanWhatsapp.startsWith('54') ? cleanWhatsapp : `549${cleanWhatsapp}`;

    setIsSubmitting(true);
    try {
      // 1. Generate unique Activation Code
      const generatedCodeObj = generateActivationCode({
        driverName: driverName.trim(),
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        whatsapp: cleanWhatsapp,
        hours: selectedHours,
      });

      // 2. Register driver request in Firestore and notify Administración UPPA immediately
      const createdHab = await solicitarHabilitacionChofer({
        driverId: currentUserId || `usr-driver-${Date.now()}`,
        driverName: driverName.trim(),
        vehicleType,
        vehicleModel: vehicleModel.trim(),
        patente: cleanPatente,
        whatsapp: formattedWhatsapp,
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

      // 3. Submit payment proof
      onSubmit(
        {
          userId: currentUserId,
          driverName: driverName.trim(),
          vehicleType,
          vehicleModel: vehicleModel.trim(),
          patente: cleanPatente,
          whatsapp: formattedWhatsapp,
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
          proofUrl:
            proofDataUrl ||
            'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
          proofFileName: proofFileName || 'comprobante_luciaveronicag.jpg',
          alias: 'luciaveronicag',
          activationCode: generatedCodeObj.code,
        }
      );

      playMicroSound('payment_done');
      setGeneratedCodeResult(generatedCodeObj.code);
      setFormStep('submitted');
    } catch (err: any) {
      console.error('Error al registrar solicitud de chofer:', err);
      setErrorMsg(err?.message || 'No se pudo registrar la solicitud. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Título dinámico según paso */}
        {formStep === 'form' && (
          <div className="py-2.5 px-3 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/40 text-center my-3 shrink-0 space-y-0.5">
            <h3 className="text-xs sm:text-sm font-black text-[#FFF19A] tracking-wider uppercase font-display flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FFF19A]" />
              <span>PASO 1 · CARGAR DATOS PERSONALES Y VEHÍCULO</span>
            </h3>
            <p className="text-[10.5px] text-[#9299A5]">
              Completá tus datos y luego se habilitarán el Alias, CVU y resumen para adjuntar tu comprobante
            </p>
          </div>
        )}
        {formStep === 'review-payment' && (
          <div className="py-2.5 px-3 rounded-xl bg-[#101114] border-2 border-[#B7F36B]/55 text-center my-3 shrink-0 space-y-0.5">
            <h3 className="text-xs sm:text-sm font-black text-[#B7F36B] tracking-wider uppercase font-display flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B7F36B]" />
              <span>PASO 2 · TRANSFERIR, VERIFICAR DATOS Y ENVIAR</span>
            </h3>
            <p className="text-[10.5px] text-[#9299A5]">
              Revisá todo lo que vas a mandar, realizá la transferencia y adjuntá el comprobante
            </p>
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
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto pr-1">
          {formStep === 'submitted' && generatedCodeResult ? (
            <div className="py-3 space-y-3.5 animate-in fade-in duration-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#B7F36B]/15 border-2 border-[#B7F36B] text-[#B7F36B] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-black text-white">¡Solicitud de Chofer Enviada!</h3>
                <p className="text-xs text-[#9299A5] mt-1 max-w-sm mx-auto leading-relaxed">
                  Tus datos y comprobante se registraron en el sistema. El Administrador verifica tu transferencia y te habilita directamente para comenzar a prestar servicio:
                </p>
              </div>

              {/* Resumen Real del Prestador */}
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
                  <span className="font-mono text-white">+{whatsapp.replace(/\D/g, '')}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#9299A5]">Comprobante:</span>
                  <span className="font-semibold text-[#B7F36B] truncate max-w-[180px]">
                    {proofFileName || 'Vía WhatsApp 3489690058'}
                  </span>
                </div>
                <div className="flex justify-between text-white pt-1.5 border-t border-white/10 gap-2">
                  <span className="text-[#9299A5] shrink-0">Estado en Admin UPPA:</span>
                  <span className="text-[#FFF19A] font-black text-right">
                    Pendiente ({createdHabId || 'Registrada'})
                  </span>
                </div>
              </div>

              {/* Botón de WhatsApp para comunicarse con el Administrador */}
              <div className="max-w-sm mx-auto space-y-2">
                {proofPreviewUrl && (
                  <div className="p-2.5 rounded-xl bg-[#101114] border border-[#B7F36B]/40 flex items-center gap-2.5 text-left">
                    <img
                      src={proofPreviewUrl}
                      alt="Comprobante cargado"
                      className="w-12 h-12 rounded-lg object-cover border border-[#B7F36B] shrink-0"
                    />
                    <div className="min-w-0 flex-1 text-[11px]">
                      <span className="font-bold text-white block truncate">{proofFileName}</span>
                      <span className="text-[#B7F36B] font-mono">
                        {proofSizeBytes ? `${(proofSizeBytes / 1024).toFixed(1)} KB (≤ 60 KB)` : 'Imagen lista'}
                      </span>
                    </div>
                  </div>
                )}

                <a
                  href={`https://wa.me/5493489690058?text=${encodeURIComponent(buildWhatsappSummaryText())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (createdHabId) {
                      marcarSolicitudWhatsappEnviada(createdHabId);
                    }
                  }}
                  title="Enviar todos los datos y comprobante al WhatsApp 3489690058"
                  className="w-full min-h-[46px] py-3 px-3 rounded-xl uppa-cta-green text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Enviar Toda la Info al WhatsApp 3489690058</span>
                </a>

                {proofFileObj && (
                  <button
                    type="button"
                    onClick={handleShareImageAndDataToWhatsApp}
                    className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-[#202329] hover:bg-white/10 border border-[#FFF19A]/45 text-[#FFF19A] text-[11px] font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 shrink-0" />
                    <span>Adjuntar / Compartir Imagen + Datos por WhatsApp</span>
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#101114] border border-white/15 text-[11px] text-[#9299A5] max-w-sm mx-auto text-left space-y-1.5">
                <div className="flex items-center gap-2 font-black text-white">
                  <KeyRound className="w-4 h-4 text-[#FFF19A] shrink-0" />
                  <span>Visible en Administración UPPA · Solicitudes Pendientes</span>
                </div>
                <p className="text-[#9299A5] text-[11px] leading-relaxed">
                  Tu solicitud ya figura como <strong className="text-[#FFF19A]">Pendiente</strong> en <strong className="text-white">Administración UPPA</strong>. El Administrador verifica tu transferencia a <strong className="text-white">luciaveronicag</strong> (WhatsApp <strong className="text-[#B7F36B]">3489690058</strong>) e inicia tu temporizador en vivo.
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
          ) : formStep === 'review-payment' ? (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              {/* 1. Datos Bancarios Habilitados después de apretar "Enviar Solicitud y Adjuntar Comprobante" */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/60 space-y-2.5 shadow-[0_0_20px_rgba(255,241,154,0.12)]">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                  <span className="text-[#FFF19A] font-black uppercase tracking-wide">
                    Datos Habilitados para Transferir
                  </span>
                  <span className="text-sm font-black text-[#B7F36B] font-mono">
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
              </div>

              {/* 2. Vista Previa Completa de Todos los Datos Cargados para que el Prestador Vea lo que Va a Mandar */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-white/15 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                  <span className="text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#FFF19A]" />
                    <span>Resumen de Datos a Enviar</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playMicroSound('ui_tap');
                      setFormStep('form');
                    }}
                    className="text-[11px] font-bold text-[#FFF19A] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar datos</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11.5px]">
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">Nombre / Apodo</span>
                    <strong className="text-white">{driverName.trim()}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">WhatsApp de Contacto</span>
                    <strong className="text-white font-mono">{whatsapp.trim()}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">Servicio y Vehículo</span>
                    <strong className="text-[#B7F36B]">
                      {vehicleType === 'moto' ? 'Moto Taxi' : 'Auto Taxi'} · {vehicleModel.trim()}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">Patente / Matrícula</span>
                    <strong className="font-mono uppercase text-[#FFF19A]">{patente.trim().toUpperCase()}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">Zona Habitual</span>
                    <strong className="text-white">{zone.trim() || 'Zárate ↔ Campana'}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-[#202329] border border-white/5">
                    <span className="text-[#9299A5] block text-[10px]">Turno y Seguridad</span>
                    <strong className="text-white">
                      {selectedHours}h (${totalAmount.toLocaleString('es-AR')}) · Seg. {currentSafetyIndex}%
                    </strong>
                  </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-xl bg-[#202329]/80 border border-white/5 text-[10.5px] text-[#9299A5] flex flex-wrap gap-x-3 gap-y-1">
                  {vehicleType === 'auto' ? (
                    <>
                      <span>Asientos: <strong className="text-white">{asientos}</strong></span>
                      <span>Aire: <strong className="text-white">{aireAcondicionado ? 'Sí' : 'No'}</strong></span>
                      <span>Baúl: <strong className="text-white">{baul ? 'Sí' : 'No'}</strong></span>
                      <span>Mascotas: <strong className="text-white">{aceptaMascotas ? 'Sí' : 'No'}</strong></span>
                    </>
                  ) : (
                    <>
                      <span>Casco extra: <strong className="text-white">{cascoExtra ? 'Sí' : 'No'}</strong></span>
                      <span>Baúl/Portaequipaje: <strong className="text-white">{baul ? 'Sí' : 'No'}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Adjuntar Comprobante (Imagen máx. 60 KB) */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-[#B7F36B]/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-[#B7F36B]" />
                    <span>Adjuntar Imagen del Comprobante</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FFF19A]/15 border border-[#FFF19A]/40 text-[#FFF19A] text-[10px] font-mono font-bold">
                    {proofSizeBytes
                      ? `${(proofSizeBytes / 1024).toFixed(1)} KB / 60 KB ✓`
                      : 'Imagen máx. 60 KB'}
                  </span>
                </div>

                <label
                  title="Seleccionar imagen del comprobante de transferencia (hasta 60 KB)"
                  className="w-full min-h-[56px] px-3 py-2.5 rounded-xl bg-[#202329] hover:bg-white/10 border-2 border-dashed border-[#FFF19A]/50 hover:border-[#FFF19A] text-xs flex items-center justify-between gap-2 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {proofPreviewUrl ? (
                      <img
                        src={proofPreviewUrl}
                        alt="Vista previa comprobante"
                        className="w-11 h-11 rounded-lg object-cover border border-[#B7F36B] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#101114] border border-white/15 flex items-center justify-center text-[#FFF19A] shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="block font-bold text-white truncate">
                        {isProcessingProof
                          ? 'Optimizando imagen a ≤ 60 KB...'
                          : proofFileName || 'Tocar para cargar imagen (hasta 60 KB)'}
                      </span>
                      <span className="block text-[10px] text-[#9299A5]">
                        {proofStatusNote || 'JPG, PNG o WebP hasta 60 KB (optimización automática) para enviar por WhatsApp'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#FFF19A] text-[#101114] font-black text-[10.5px] shrink-0">
                    {proofFileName ? 'Cambiar' : 'Elegir'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>

                <a
                  href={`https://wa.me/5493489690058?text=${encodeURIComponent(buildWhatsappSummaryText())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-[#202329] hover:bg-white/10 border border-[#B7F36B]/45 text-[#B7F36B] text-[11px] font-black flex items-center justify-center gap-2 transition-all"
                  title="Enviar toda la información cargada al WhatsApp 3489690058"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Enviar toda la información al WhatsApp 3489690058</span>
                </a>

                {/* 4. Acciones Finales */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playMicroSound('ui_tap');
                      setFormStep('form');
                    }}
                    className="sm:w-1/3 min-h-[46px] px-3 py-2.5 rounded-xl bg-[#202329] hover:bg-white/10 border border-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmFinalSubmission}
                    title="Confirmar y enviar todos los datos cargados más el comprobante"
                    className="sm:w-2/3 min-h-[46px] px-4 py-2.5 uppa-cta-green font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>
                      {isSubmitting ? 'Enviando Datos y Comprobante...' : 'Enviar Todos los Datos + Comprobante'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProceedToPaymentAndReview} noValidate className="space-y-3.5">
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

              {/* Botón Paso 1: Enviar Solicitud y Adjuntar Comprobante -> habilita Alias/CVU/Titular + Resumen + Comprobante */}
              <div className="p-3.5 rounded-2xl bg-[#101114] border-2 border-[#FFF19A]/35 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9299A5] font-bold">Total del turno seleccionado ({selectedHours}h):</span>
                  <span className="text-sm font-black text-[#FFF19A] font-mono">
                    ${totalAmount.toLocaleString('es-AR')} ARS
                  </span>
                </div>

                <button
                  type="submit"
                  title="Continuar para ver Alias, CVU, resumen de tus datos y adjuntar comprobante"
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 uppa-cta-green font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer text-center leading-snug"
                >
                  <span>Enviar Solicitud y Adjuntar Comprobante</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <p className="text-[10.5px] text-[#9299A5] text-center leading-relaxed">
                  Al presionar este botón se habilitarán el Alias, CVU, titular y la vista previa de tus datos para adjuntar y enviar el comprobante.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
