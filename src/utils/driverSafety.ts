/**
 * Cálculo del Índice de Seguridad del Vehículo
 * Se determina a partir del cumplimiento de los ítems de confort, matriculación y seguridad
 * cargados por el prestador en el formulario de Habilitación de Chofer.
 */

export interface DriverSafetyInput {
  vehicleType: 'auto' | 'moto';
  patente?: string;
  plate?: string;
  asientos?: number;
  aireAcondicionado?: boolean;
  baul?: boolean;
  aceptaMascotas?: boolean;
  cascoExtra?: boolean;
  whatsapp?: string;
  comprobanteFileName?: string;
}

export function calculateDriverSafetyIndex(data: DriverSafetyInput): {
  percentage: number;
  dots: number;
  completedItems: string[];
  totalItemsCount: number;
} {
  const isAuto = data.vehicleType === 'auto';
  const hasPatente = Boolean((data.patente || data.plate || '').trim());
  const hasWhatsapp = Boolean((data.whatsapp || '').trim());
  const completedItems: string[] = [];

  if (isAuto) {
    const totalItems = 6;
    if (hasPatente) completedItems.push('Patente registrada');
    if ((data.asientos || 0) >= 1) completedItems.push(`${data.asientos || 4} asientos`);
    if (data.aireAcondicionado !== false) completedItems.push('Aire acondicionado');
    if (data.baul !== false) completedItems.push('Baúl disponible');
    if (data.aceptaMascotas) completedItems.push('Acepta mascotas');
    if (hasWhatsapp) completedItems.push('Contacto verificado');

    const percentage = Math.round((completedItems.length / totalItems) * 100);
    const dots = Math.max(1, Math.min(4, Math.round((percentage / 100) * 4)));

    return {
      percentage,
      dots,
      completedItems,
      totalItemsCount: totalItems,
    };
  } else {
    // Moto Taxi
    const totalItems = 4;
    if (hasPatente) completedItems.push('Patente registrada');
    if (data.cascoExtra !== false) completedItems.push('Casco extra para pasajero');
    if (data.baul !== false) completedItems.push('Baúl / portaequipaje');
    if (hasWhatsapp) completedItems.push('Contacto verificado');

    const percentage = Math.round((completedItems.length / totalItems) * 100);
    const dots = Math.max(1, Math.min(4, Math.round((percentage / 100) * 4)));

    return {
      percentage,
      dots,
      completedItems,
      totalItemsCount: totalItems,
    };
  }
}
