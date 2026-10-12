/**
 * UPPA Comunidad de Transporte - Permisos de Base de Datos
 * Reglas de seguridad para lectura pública, edición y eliminación de datos.
 * Sin secretos ni llaves de administración expuestas en el frontend.
 */

export const INSTANT_PERMISSIONS = {
  // Lectura pública de rutas, reportes, mensajes y choferes activos para todos los usuarios
  allowPublicRead: {
    reportes: true,
    mensajes_chat: true,
    choferes_activos: true,
  },

  // Creación y edición autenticada
  allowAuthenticatedWrite: {
    reportes: true,
    mensajes_chat: true,
    choferes_activos: true,
  },

  // Solo chofer habilitado con código puede actualizar su estado de servicio
  allowDriverUpdate: {
    choferes_activos: 'auth.id == data.usuarioId',
  },

  // Códigos de habilitación: lectura por ID único para verificación
  codigos_habilitacion: {
    allowReadById: true,
    allowRedeem: true,
  },
};
