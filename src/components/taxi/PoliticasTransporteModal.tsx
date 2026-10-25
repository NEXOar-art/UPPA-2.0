import React from 'react';
import { ShieldCheck, X, FileText, AlertTriangle, Check } from 'lucide-react';

interface PoliticasTransporteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PoliticasTransporteModal: React.FC<PoliticasTransporteModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0b0e17] border border-amber-500/40 rounded-3xl text-slate-100 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Glowing Header Stripe */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 w-full shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between gap-3 shrink-0 bg-slate-900/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  POLÍTICAS DE USO Y DESCARGO DE RESPONSABILIDAD
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  UPPA Transporte Colaborativo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Última actualización: <strong className="text-amber-200">25/10/2026</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Cerrar políticas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice badge */}
        <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-500/20 text-amber-200 text-xs flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] leading-snug">
            El uso de UPPA implica la <strong className="text-white">aceptación total</strong> de las siguientes políticas, condiciones y descargos de responsabilidad.
          </p>
        </div>

        {/* Scrollable Content with all 30 points */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal">
          {/* Point 1 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">1.</span> Naturaleza de la Plataforma
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA actúa únicamente como una plataforma de contacto entre usuarios que solicitan transporte y personas que ofrecen servicios de traslado. UPPA no presta servicios de transporte propios ni opera vehículos.
            </p>
          </div>

          {/* Point 2 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">2.</span> Responsabilidad del Prestador
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Cada conductor, motociclista o propietario del vehículo es el único responsable de la prestación del servicio ofrecido, incluyendo horarios, tarifas, recorridos, seguridad y calidad del servicio.
            </p>
          </div>

          {/* Point 3 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">3.</span> Verificación de Identidad
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Se recomienda a los usuarios verificar la identidad del prestador antes de iniciar cualquier viaje. UPPA no garantiza la autenticidad, veracidad o actualización de la información proporcionada por terceros.
            </p>
          </div>

          {/* Point 4 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">4.</span> Estado del Vehículo
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no inspecciona, certifica ni garantiza el estado mecánico, técnico, sanitario o legal de los vehículos ofrecidos en la plataforma.
            </p>
          </div>

          {/* Point 5 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">5.</span> Licencias y Habilitaciones
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Es responsabilidad exclusiva del prestador contar con las licencias, seguros, permisos y habilitaciones exigidas por la legislación vigente.
            </p>
          </div>

          {/* Point 6 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">6.</span> Disponibilidad del Servicio
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              La publicación de un viaje o servicio no garantiza su disponibilidad efectiva ni la aceptación automática por parte de los prestadores.
            </p>
          </div>

          {/* Point 7 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">7.</span> Cancelaciones
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no será responsable por cancelaciones realizadas por conductores, motociclistas o pasajeros antes o durante la prestación del servicio.
            </p>
          </div>

          {/* Point 8 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">8.</span> Retrasos
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no responde por retrasos ocasionados por tránsito, condiciones climáticas, problemas mecánicos, desvíos u otras circunstancias ajenas a la plataforma.
            </p>
          </div>

          {/* Point 9 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">9.</span> Inasistencia del Prestador
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Si el conductor o motociclista no se presenta en el lugar y horario acordados, la responsabilidad será exclusivamente del prestador.
            </p>
          </div>

          {/* Point 10 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">10.</span> Devoluciones y Reembolsos
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Toda devolución, reintegro, compensación económica o reclamo por pagos efectuados deberá resolverse directamente entre el usuario y el prestador del servicio.
            </p>
          </div>

          {/* Point 11 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">11.</span> Pagos entre Usuarios
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Los acuerdos de pago, tarifas, adelantos, transferencias o cualquier operación económica son responsabilidad exclusiva de las partes involucradas.
            </p>
          </div>

          {/* Point 12 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">12.</span> Seguridad Personal
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Cada usuario utiliza los servicios publicados bajo su propia responsabilidad. Se recomienda compartir la ubicación, los datos del vehículo y del conductor con familiares o personas de confianza.
            </p>
          </div>

          {/* Point 13 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">13.</span> Objetos Perdidos
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no se responsabiliza por objetos olvidados, perdidos, robados o dañados durante el viaje.
            </p>
          </div>

          {/* Point 14 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">14.</span> Daños Personales
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no será responsable por lesiones, daños físicos o accidentes ocurridos durante el desarrollo del viaje.
            </p>
          </div>

          {/* Point 15 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">15.</span> Daños Materiales
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Cualquier daño ocasionado a vehículos, equipajes o pertenencias deberá resolverse entre las partes involucradas.
            </p>
          </div>

          {/* Point 16 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">16.</span> Conducta de los Usuarios
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Todos los usuarios deberán mantener un comportamiento respetuoso, responsable y acorde a las normas de convivencia durante las comunicaciones y viajes.
            </p>
          </div>

          {/* Point 17 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">17.</span> Información Publicada
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Cada usuario es responsable de la exactitud, legalidad y actualización de la información que comparte dentro de la plataforma.
            </p>
          </div>

          {/* Point 18 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">18.</span> Uso Indebido de la Plataforma
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Está prohibido utilizar UPPA para actividades ilícitas, fraudulentas, violentas, discriminatorias o contrarias a la legislación vigente.
            </p>
          </div>

          {/* Point 19 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">19.</span> Menores de Edad
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Los menores de edad deberán utilizar los servicios bajo la supervisión y autorización de sus padres, madres o tutores legales.
            </p>
          </div>

          {/* Point 20 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">20.</span> Transporte de Mercancías
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no garantiza ni supervisa el traslado de paquetes, encomiendas, documentos, mercaderías o cualquier otro tipo de carga.
            </p>
          </div>

          {/* Point 21 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">21.</span> Seguro del Viaje
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no proporciona seguros para pasajeros, conductores, vehículos, equipajes ni mercancías transportadas.
            </p>
          </div>

          {/* Point 22 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">22.</span> Conflictos entre Usuarios
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Las controversias, reclamos, denuncias o desacuerdos deberán ser resueltos directamente entre las partes involucradas.
            </p>
          </div>

          {/* Point 23 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">23.</span> Exclusión de Garantías
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA no garantiza puntualidad, disponibilidad, calidad, continuidad, seguridad, estado de los vehículos ni satisfacción respecto de los servicios publicados por terceros.
            </p>
          </div>

          {/* Point 24 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">24.</span> Uso Bajo Riesgo Propio
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Todo usuario acepta que utiliza UPPA bajo su propia responsabilidad y asume los riesgos inherentes a la contratación de servicios ofrecidos por terceros.
            </p>
          </div>

          {/* Point 25 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">25.</span> Derecho de Suspensión
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA podrá suspender, restringir o eliminar cuentas, publicaciones o accesos que incumplan estas políticas o representen un riesgo para la comunidad.
            </p>
          </div>

          {/* Point 26 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">26.</span> Protección de Datos
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Los datos compartidos por los usuarios serán utilizados con la finalidad de facilitar la comunicación y coordinación entre pasajeros y prestadores.
            </p>
          </div>

          {/* Point 27 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">27.</span> Modificaciones de las Políticas
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              UPPA podrá modificar estas políticas en cualquier momento. La continuidad en el uso de la plataforma implicará la aceptación de las nuevas condiciones.
            </p>
          </div>

          {/* Point 28 */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <h4 className="font-bold text-white text-xs sm:text-sm mb-1 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">28.</span> Aceptación de las Condiciones
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              Al registrarse, acceder o utilizar UPPA, el usuario declara haber leído, comprendido y aceptado íntegramente estas políticas y condiciones de uso.
            </p>
          </div>

          {/* Point 29 */}
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30">
            <h4 className="font-bold text-amber-200 text-xs sm:text-sm mb-1.5 flex items-center gap-1.5">
              <span className="text-red-400 font-mono">29.</span> Exención General de Responsabilidad
            </h4>
            <p className="text-slate-300 text-xs mb-2">UPPA no será responsable por:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300 pl-2">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Accidentes de tránsito.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Robos, hurtos o pérdidas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Agresiones físicas, verbales o psicológicas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Incumplimientos de horarios.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Ausencia del conductor o pasajero.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Cobros indebidos o conflictos de pago.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Daños materiales o personales.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Problemas mecánicos de los vehículos.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Infracciones de tránsito cometidas por los conductores.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Pérdidas económicas directas o indirectas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Cancelaciones de viajes.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Errores en la información suministrada por los usuarios.</span>
              </li>
              <li className="flex items-start gap-1.5 sm:col-span-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>Cualquier inconveniente derivado de acuerdos realizados entre usuarios y prestadores.</span>
              </li>
            </ul>
          </div>

          {/* Point 30 */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
            <h4 className="font-bold text-amber-300 text-xs sm:text-sm mb-1.5 flex items-center gap-1.5">
              <span className="text-amber-400 font-mono">30.</span> Descargo Final de Responsabilidad
            </h4>
            <p className="text-slate-300 text-xs leading-relaxed mb-2">
              UPPA es únicamente una plataforma colaborativa de conexión entre personas que buscan transporte y personas que lo ofrecen. La plataforma no presta servicios de transporte, no emplea conductores, no controla los vehículos ni interviene en los acuerdos realizados entre las partes.
            </p>
            <p className="text-slate-300 text-xs leading-relaxed">
              Toda contratación, coordinación, pago, cancelación, recorrido, viaje o prestación efectuada a través de la plataforma será responsabilidad exclusiva del usuario y del prestador. Al utilizar UPPA, el usuario acepta expresamente liberar a la plataforma, sus desarrolladores, administradores y colaboradores de cualquier responsabilidad derivada de incidentes, daños, reclamos, perjuicios o conflictos que pudieran surgir entre las partes. <span className="text-base align-middle">🚗🏍️📍</span>
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Documento de Términos y Descargo oficial UPPA
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-transform active:scale-95 cursor-pointer ml-auto"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Entendido y Acepto las Políticas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
