import React, { useEffect, useState } from 'react';
import {
  X,
  Info,
  Bus,
  Car,
  MessageSquare,
  MapPin,
  Navigation,
  Radio,
  Star,
  KeyRound,
  Bell,
  Clock,
  CheckCircle2,
  Ticket,
  Users,
} from 'lucide-react';

export type AppSectionId = 'map' | 'taxi' | 'chat';

interface SectionInfoSheetModalProps {
  isOpen: boolean;
  initialSection: AppSectionId;
  onClose: () => void;
}

interface FeatureItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface SectionConfig {
  id: AppSectionId;
  label: string;
  subtitle: string;
  accentColor: string;
  headerIcon: React.ReactNode;
  features: FeatureItem[];
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'map',
    label: 'Mapa en Vivo',
    subtitle: 'Corredor Zárate ↔ Campana · Tiempo Real',
    accentColor: '#FFF19A',
    headerIcon: <Bus className="w-5 h-5 text-[#FFF19A]" />,
    features: [
      {
        title: 'Recorrido Línea 228 y Colectora',
        description:
          'Visualizá en tiempo real los recorridos completos entre Zárate y Campana / B° Malvinas, con paradas oficiales numeradas y estimación de llegada.',
        icon: <MapPin className="w-4 h-4 text-[#FFF19A]" />,
      },
      {
        title: 'Ubicación de Colectivos y Alertas Waze',
        description:
          'Reportá dónde está el colectivo ahora mismo o alertá sobre demoras, congestión, cortes, accidentes o controles para ayudar a otros vecinos.',
        icon: <Radio className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Botones Rápidos del Corredor',
        description:
          'Mostrá u ocultá paradas de colectivo, estaciones de servicio y escuelas sobre el mapa, o usá tu GPS en vivo para centrar tu ubicación.',
        icon: <Navigation className="w-4 h-4 text-[#FFF19A]" />,
      },
      {
        title: 'Panel Inferior, QR Compartir y Viaje Activo (4s)',
        description:
          'Accedé rápido a Pedir Transporte, Taxis & Motos, Chat, Ticket, compartir la app con el ícono QR (entre Ticket y Admin) o Admin. Al iniciar un pedido, tu tarjeta de progreso aparece 4 segundos para despejar el mapa.',
        icon: <Clock className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Avisos de Vehículos Disponibles',
        description:
          'Cuando un prestador finaliza su viaje y presiona DESOCUPADO, aparece un aviso breve de 5 segundos en el mapa para que los pasajeros puedan solicitarlo.',
        icon: <Bell className="w-4 h-4 text-[#FFF19A]" />,
      },
    ],
  },
  {
    id: 'taxi',
    label: 'Taxis & Motos',
    subtitle: 'Transporte Alternativo Colaborativo',
    accentColor: '#B7F36B',
    headerIcon: <Car className="w-5 h-5 text-[#B7F36B]" />,
    features: [
      {
        title: 'Ficha Completa con Logos Auto Taxi y Moto Taxi',
        description:
          'Cambiá entre Auto Taxi y Moto Taxi desde los botones superiores, tocá el logo del vehículo para recorrer las unidades activas y consultá patente, confort, cercanía GPS y calificación.',
        icon: <Car className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Solicitudes Solo para Choferes Disponibles',
        description:
          'Los prestadores habilitados en estado DESOCUPADO ven en Taxis & Motos las solicitudes de pasajeros con su destino para aceptar el traslado.',
        icon: <CheckCircle2 className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Código de Viaje para el Pasajero',
        description:
          'Emití un pedido con origen y destino (12 min de vigencia). Al ser aceptado, el pasajero recibe su Código de Viaje para verificar que aborda el móvil indicado.',
        icon: <KeyRound className="w-4 h-4 text-[#FFF19A]" />,
      },
      {
        title: 'Ficha con WhatsApp del Pasajero y GPS al Aceptar',
        description:
          'Cuando el prestador acepta la solicitud, aparece automáticamente la ficha del viaje con el WhatsApp del pasajero y el botón de GPS para trazar la ruta directa hasta su ubicación.',
        icon: <Navigation className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Calificación Exclusiva Post-Viaje',
        description:
          'Una vez finalizado el viaje, el pasajero puede calificar de 1 a 5 estrellas al prestador para el ranking de las últimas 3 horas.',
        icon: <Star className="w-4 h-4 text-[#FFF19A]" />,
      },
    ],
  },
  {
    id: 'chat',
    label: 'Chat Comunitario',
    subtitle: 'Comunicación Vecinal en Tiempo Real',
    accentColor: '#FFF19A',
    headerIcon: <MessageSquare className="w-5 h-5 text-[#FFF19A]" />,
    features: [
      {
        title: 'Canales por Sentido y Consultas',
        description:
          'Elegí entre Todos los Mensajes, Campana ➔ Zárate, Zárate ➔ Campana o General & Avisos para consultar frecuencias y novedades.',
        icon: <MessageSquare className="w-4 h-4 text-[#FFF19A]" />,
      },
      {
        title: 'Filtros por Rol y Buscador',
        description:
          'Filtrá mensajes por Pasajeros, Choferes o Colectivos y buscá rápidamente referencias a paradas o barrios.',
        icon: <Users className="w-4 h-4 text-[#B7F36B]" />,
      },
      {
        title: 'Respuestas, Reacciones y Reportes',
        description:
          'Respondé mensajes citando al vecino, reaccioná en vivo o reportá contenido inapropiado para mantener ordenada la comunidad.',
        icon: <Radio className="w-4 h-4 text-[#FFF19A]" />,
      },
      {
        title: 'Tickets de Consulta y Soporte',
        description:
          'Desde la barra inferior podés abrir un Ticket de Consulta categorizado y enviarlo directamente a uppatransportecolaborativo@gmail.com.',
        icon: <Ticket className="w-4 h-4 text-[#B7F36B]" />,
      },
    ],
  },
];

export const SectionInfoSheetModal: React.FC<SectionInfoSheetModalProps> = ({
  isOpen,
  initialSection,
  onClose,
}) => {
  const [selectedSection, setSelectedSection] = useState<AppSectionId>(initialSection);

  useEffect(() => {
    if (isOpen) {
      setSelectedSection(initialSection);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const activeConfig = SECTIONS.find((s) => s.id === selectedSection) || SECTIONS[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col bg-[#202329] border-2 border-white/20 rounded-3xl shadow-[0_14px_38px_rgba(0,0,0,0.75)] overflow-hidden text-white">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FFF19A] via-[#B7F36B] to-[#FFF19A] shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#181B20]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#101114] border-2 border-[#FFF19A]/50 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-[#FFF19A]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white font-display tracking-tight truncate">
                Guía de Funcionalidades · UPPA
              </h2>
              <p className="text-[11px] text-[#9299A5] truncate">
                Detalle completo de herramientas según cada sección
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Cerrar hoja informativa"
            aria-label="Cerrar hoja informativa"
            className="w-9 h-9 rounded-xl bg-[#101114] hover:bg-white/10 border border-white/15 text-[#9299A5] hover:text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs Selector */}
        <div className="px-4 py-2.5 bg-[#101114]/70 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {SECTIONS.map((sec) => {
            const isSelected = sec.id === selectedSection;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSection(sec.id)}
                title={`Ver funcionalidades de ${sec.label}`}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap border transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#FFF19A] text-[#101114] border-[#FFF19A]'
                    : 'bg-[#202329] text-[#9299A5] hover:text-white border-white/10 hover:border-white/30'
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* Sheet Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#101114] border border-white/15 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#202329] border border-white/15 flex items-center justify-center shrink-0">
              {activeConfig.headerIcon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">{activeConfig.label}</h3>
              <p className="text-[11px] text-[#9299A5]">{activeConfig.subtitle}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {activeConfig.features.map((feat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-[#101114]/90 border border-white/10 hover:border-white/25 transition-colors flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-[#202329] border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  {feat.icon}
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-xs font-black text-white leading-snug">{feat.title}</h4>
                  <p className="text-[11.5px] text-[#9299A5] leading-relaxed">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:px-5 border-t border-white/10 bg-[#181B20] flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10.5px] text-[#9299A5] font-mono">
            UPPA Transporte Colaborativo · Zárate &amp; Campana
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#FFF19A] text-[#101114] font-black text-xs cursor-pointer active:scale-95 transition-all"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
