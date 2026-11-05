import { TransitRoute, MapEvent, TaxiListing, PaymentProof, ChatMessage, AdListing, LiveBus, User } from '../types';
import {
  LINEA_228_STOPS,
  LINEA_228_COORDINATES,
  VIGALONDO_MCDONALDS_STOPS,
  VIGALONDO_MCDONALDS_COORDINATES,
  CAMPANA_CENTRO_ZARATE_STOPS,
  CAMPANA_CENTRO_ZARATE_COORDINATES,
} from './linea228Stops';

export const INITIAL_USER: User = {
  id: 'usr-comunidad',
  name: '',
  email: '',
  role: 'passenger',
  barrio: '',
  phone: '',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=vecino&backgroundColor=12141c',
};

export const MOCK_ROUTES: TransitRoute[] = [
  {
    id: 'route-campana-centro-zarate',
    name: 'Campana Centro ↔ Zárate Centro',
    shortName: 'Centro Campana ↔ Zárate',
    code: 'CC-ZAR',
    description: 'Recorrido troncal directo que une el Centro de Campana (Plaza Eduardo Costa / Estación) con Zárate Centro y Terminal por Autovía RP 6.',
    color: '#06b6d4', // Cyan electric
    status: 'normal',
    frequencyMinutes: 10,
    currentDelayMinutes: 0,
    lastUpdated: 'En vivo',
    coordinates: CAMPANA_CENTRO_ZARATE_COORDINATES,
    stops: CAMPANA_CENTRO_ZARATE_STOPS,
  },
  {
    id: 'route-vigalondo-mcdonalds',
    name: 'Linea 228 (Justo Vigalondo ↔ McDonald\'s)',
    shortName: 'Vigalondo ↔ McDonald\'s',
    code: '228-MCD',
    description: 'Corredor habilitado directo: Justo Vigalondo (B° Malvinas) pasando por Las Campanas, Ariel del Plata hasta McDonald\'s Panamericana (Colectora Sur / Av. 6 de Julio).',
    color: '#f59e0b', // Amber electric
    status: 'normal',
    frequencyMinutes: 12,
    currentDelayMinutes: 0,
    lastUpdated: 'En vivo',
    coordinates: VIGALONDO_MCDONALDS_COORDINATES,
    stops: VIGALONDO_MCDONALDS_STOPS,
  },
  {
    id: 'route-zarate-malvinas',
    name: 'Linea 228(Malvinas-Zarate)',
    shortName: 'Linea 228(Malvinas-Zarate)',
    code: '228',
    description: 'Recorrido oficial completo desde Barrio Malvinas pasando por Las Campanas, Ariel del Plata, Colectora Panamericana, Casco Céntrico y RP 6 hasta Zárate Centro.',
    color: '#06b6d4', // Cyan electric
    status: 'delayed',
    frequencyMinutes: 15,
    currentDelayMinutes: 8,
    lastUpdated: 'En vivo',
    coordinates: LINEA_228_COORDINATES,
    stops: LINEA_228_STOPS,
  },
  {
    id: 'route-colectora-interurbano',
    name: 'Zarate-Campana Colectora',
    shortName: 'Zarate-Campana Colectora',
    code: 'L-228C',
    description: 'Servicio directo por Colectora Sur y Norte con paradas estratégicas en fábricas, parques industriales y accesos rápidos.',
    color: '#3b82f6', // Tesla Electric Blue
    status: 'normal',
    frequencyMinutes: 20,
    currentDelayMinutes: 4,
    lastUpdated: 'Hace 4 min',
    coordinates: [
      [-34.095650, -59.038650], // Terminal Zárate (Centro de Transferencia)
      [-34.113650, -59.016180], // Av. Lavalle y Perito Moreno (FONAVI)
      [-34.115650, -59.013400], // Rotonda Acceso RN 9 / Colectora
      [-34.138650, -58.978250], // Paraje El Tatú / Colectora
      [-34.144050, -58.972450], // Parque Industrial Campana / RP 6
      [-34.174350, -58.958620], // Tenaris Siderca (Colectora Norte & Necochea)
      [-34.163200, -58.958950], // Plaza Eduardo Costa (Palacio Municipal Campana)
      [-34.178750, -58.955350], // Colectora Norte y Dr. Salk
      [-34.191398, -58.944732], // McDonald's Campana (Panamericana Km 72.5)
      [-34.192306, -58.943583], // Colectora Sur y Magaldi
      [-34.193448, -58.942756], // Colectora Sur y Secundaria 3
      [-34.200217, -58.940283], // Colectora Sur y Grassi
    ],
    stops: [
      { id: 'st-col-1', name: 'Terminal Zárate (Andén Colectora)', lat: -34.095650, lng: -59.038650, sequence: 1 },
      { id: 'st-col-2', name: 'Barrio FONAVI / Av. Lavalle', lat: -34.113650, lng: -59.016180, sequence: 2 },
      { id: 'st-col-3', name: 'Rotonda Acceso RN 9 / Colectora', lat: -34.115650, lng: -59.013400, sequence: 3 },
      { id: 'st-col-4', name: 'Paraje El Tatú / Colectora', lat: -34.138650, lng: -58.978250, sequence: 4 },
      { id: 'st-col-5', name: 'Parque Industrial Campana', lat: -34.144050, lng: -58.972450, sequence: 5 },
      { id: 'st-col-6', name: 'Tenaris Siderca (Portería 1 / Necochea)', lat: -34.174350, lng: -58.958620, sequence: 6 },
      { id: 'st-col-7', name: 'Plaza Eduardo Costa (Campana)', lat: -34.163200, lng: -58.958950, sequence: 7 },
      { id: 'st-col-8', name: "McDonald's Campana / Colectora Sur", lat: -34.191398, lng: -58.944732, sequence: 8 },
      { id: 'st-col-9', name: 'Colectora Sur y Magaldi', lat: -34.192306, lng: -58.943583, sequence: 9 },
      { id: 'st-col-10', name: 'Escuela Secundaria N° 3 (Colectora)', lat: -34.193448, lng: -58.942756, sequence: 10 },
      { id: 'st-col-11', name: 'Colectora Sur y Grassi', lat: -34.200217, lng: -58.940283, sequence: 11 },
    ],
  },
  {
    id: 'route-ariel-plata',
    name: 'Bº Ariel del Plata-Zarate',
    shortName: 'Bº Ariel del Plata-Zarate',
    code: 'L-204A',
    description: 'Conexión integral para vecinos de Barrio Ariel del Plata y Las Campanas con el centro de Campana y Zárate.',
    color: '#10b981', // Emerald Electric
    status: 'normal',
    frequencyMinutes: 25,
    currentDelayMinutes: 3,
    lastUpdated: 'Hace 2 min',
    coordinates: [
      [-34.095650, -59.038650], // Terminal Zárate
      [-34.115650, -59.013400], // Rotonda Zárate
      [-34.163200, -58.958950], // Plaza Costa
      [-34.191398, -58.944732], // McDonald's
      [-34.200810, -58.937393], // Escuela Técnica Roberto Rocca
      [-34.201022, -58.937241], // Galería Ariel del Plata
      [-34.202119, -58.936479], // Escuela Ariel del Plata
      [-34.203006, -58.935582], // Sociedad de Fomento Ariel del Plata
      [-34.203967, -58.936834], // Casaux y Goujon
      [-34.205225, -58.939338], // Casaux y Chapuis (Las Campanas)
    ],
    stops: [
      { id: 'st-ap-1', name: 'Terminal Zárate (Andén Principal)', lat: -34.095650, lng: -59.038650, sequence: 1 },
      { id: 'st-ap-2', name: 'Rotonda Zárate / RN 9', lat: -34.115650, lng: -59.013400, sequence: 2 },
      { id: 'st-ap-3', name: 'Plaza Eduardo Costa (Campana)', lat: -34.163200, lng: -58.958950, sequence: 3 },
      { id: 'st-ap-4', name: "McDonald's Campana (Colectora Sur)", lat: -34.191398, lng: -58.944732, sequence: 4 },
      { id: 'st-ap-5', name: 'Escuela Técnica Roberto Rocca', lat: -34.200810, lng: -58.937393, sequence: 5 },
      { id: 'st-ap-6', name: 'Galería Ariel del Plata', lat: -34.201022, lng: -58.937241, sequence: 6 },
      { id: 'st-ap-7', name: 'Escuela Ariel del Plata (Calle Aguer)', lat: -34.202119, lng: -58.936479, sequence: 7 },
      { id: 'st-ap-8', name: 'Sociedad de Fomento Ariel del Plata', lat: -34.203006, lng: -58.935582, sequence: 8 },
      { id: 'st-ap-9', name: 'Casaux y Goujon (Ariel del Plata)', lat: -34.203967, lng: -58.936834, sequence: 9 },
      { id: 'st-ap-10', name: 'Casaux y Chapuis (Las Campanas / B° Malvinas)', lat: -34.205225, lng: -58.939338, sequence: 10 },
    ],
  },
  {
    id: 'route-local-zarate',
    name: 'Zarate-Local',
    shortName: 'Zarate-Local',
    code: 'L-LOC',
    description: 'Circuito urbano dentro de Zárate pasando por Costanera, Centro Comercial, Hospital y Villa Angus.',
    color: '#f59e0b', // Amber Neon
    status: 'normal',
    frequencyMinutes: 15,
    currentDelayMinutes: 2,
    lastUpdated: 'Hace 1 min',
    coordinates: [
      [-34.0920, -59.0190], // Costanera Zárate
      [-34.101650, -59.032180], // Plaza Mitre
      [-34.095650, -59.038650], // Terminal Zárate
      [-34.108050, -59.023380], // Hospital Virgen del Carmen (Pellegrini & Lavalle)
      [-34.1160, -59.0290], // Villa Fox
    ],
    stops: [
      { id: 'st-40', name: 'Costanera Eduardo Buscaglia', lat: -34.0920, lng: -59.0190, sequence: 1 },
      { id: 'st-41', name: 'Plaza Mitre (Zárate)', lat: -34.101650, lng: -59.032180, sequence: 2 },
      { id: 'st-42', name: 'Terminal de Zárate (Centro Transferencia)', lat: -34.095650, lng: -59.038650, sequence: 3 },
      { id: 'st-43', name: 'Hospital Virgen del Carmen (Lavalle & Pellegrini)', lat: -34.108050, lng: -59.023380, sequence: 4 },
      { id: 'st-44', name: 'Villa Fox (Plaza)', lat: -34.1160, lng: -59.0290, sequence: 5 },
    ],
  },
];

export const MOCK_EVENTS: MapEvent[] = [];

export const MOCK_LIVE_BUSES: LiveBus[] = [
  {
    id: 'bus-38',
    routeId: 'route-zarate-malvinas',
    internalNumber: 'Int. 38',
    lat: -34.1350,
    lng: -58.9890,
    heading: 135,
    nextStopName: 'Tenaris / Límite Zárate',
    etaMinutes: 6,
    occupancy: 'media',
    speedKmH: 42,
  },
  {
    id: 'bus-mcd-01',
    routeId: 'route-vigalondo-mcdonalds',
    internalNumber: 'Int. 22',
    lat: -34.1974,
    lng: -58.9424,
    heading: 45,
    nextStopName: "McDonald's Campana / Colectora",
    etaMinutes: 3,
    occupancy: 'media',
    speedKmH: 38,
  },
  {
    id: 'bus-15',
    routeId: 'route-zarate-malvinas',
    internalNumber: 'Int. 15',
    lat: -34.2040,
    lng: -58.9385,
    heading: 195,
    nextStopName: 'Barrio Malvinas (Justo Vigalondo)',
    etaMinutes: 4,
    occupancy: 'alta',
    speedKmH: 34,
  },
  {
    id: 'bus-09',
    routeId: 'route-colectora-interurbano',
    internalNumber: 'Int. 09',
    lat: -34.1290,
    lng: -58.9980,
    heading: 315,
    nextStopName: 'Terminal Zárate',
    etaMinutes: 9,
    occupancy: 'baja',
    speedKmH: 48,
  },
];

const now = Date.now();
const hour = 3600 * 1000;

export const MOCK_TAXI_LISTINGS: TaxiListing[] = [
  {
    id: 'tx-1',
    userId: 'usr-d1',
    driverName: 'Juan Manuel Pérez',
    vehicleType: 'auto',
    vehicleModel: 'Chevrolet Classic Blanco',
    plate: 'AA 482 QZ',
    whatsapp: '5493487612233',
    zone: 'B° Malvinas ↔ Zárate Centro',
    lat: -34.2080,
    lng: -58.9430,
    hoursPaid: 12,
    startsAt: now - 3 * hour,
    endsAt: now + 9 * hour,
    status: 'active',
    rating: 4.9,
    completedRides: 142,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'tx-2',
    userId: 'usr-d2',
    driverName: 'Lucas "Rayo" Benítez',
    vehicleType: 'moto',
    vehicleModel: 'Honda CG 150 Titan (Con casco p/ pasajero)',
    plate: 'A 194 KLC',
    whatsapp: '5493487541188',
    zone: 'Campana Centro ↔ Colectora / Malvinas',
    lat: -34.1914,
    lng: -58.9447,
    hoursPaid: 5,
    startsAt: now - 1 * hour,
    endsAt: now + 4 * hour,
    status: 'active',
    rating: 5.0,
    completedRides: 89,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'tx-3',
    userId: 'usr-d3',
    driverName: 'Romina Galeano',
    vehicleType: 'auto',
    vehicleModel: 'Peugeot 208 Aire/Calefacción',
    plate: 'AD 932 PL',
    whatsapp: '5493487630012',
    zone: 'Todo Zárate y corredor Ruta 6',
    lat: -34.1035,
    lng: -59.0310,
    hoursPaid: 12,
    startsAt: now - 5 * hour,
    endsAt: now + 7 * hour,
    status: 'active',
    rating: 4.8,
    completedRides: 210,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'tx-4',
    userId: 'usr-d4',
    driverName: 'Matías Godoy',
    vehicleType: 'moto',
    vehicleModel: 'Yamaha YBR 125 Edición Especial',
    whatsapp: '5493487498765',
    zone: 'Barrio Malvinas, Campana',
    lat: -34.2110,
    lng: -58.9410,
    hoursPaid: 2,
    startsAt: now - 0.5 * hour,
    endsAt: now + 1.5 * hour,
    status: 'active',
    rating: 4.9,
    completedRides: 47,
  },
];

export const MOCK_PAYMENTS: PaymentProof[] = [
  {
    id: 'pay-1',
    userId: 'usr-d5',
    userName: 'Carlos Tevez (Remís)',
    whatsapp: '5493487590011',
    vehicleType: 'auto',
    vehicleModel: 'Renault Logan 2021',
    zone: 'Malvinas ↔ Campana',
    amount: 36000,
    hours: 12,
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    proofFileName: 'comprobante_transferencia_luciaveronicag.pdf',
    status: 'pending',
    createdAt: 'Hace 14 min',
    alias: 'luciaveronicag',
    adminNotes: 'Verificar acreditación en cuenta bancaria de Lucia Veronica Gimenez',
  },
  {
    id: 'pay-2',
    userId: 'usr-d1',
    userName: 'Juan Manuel Pérez',
    whatsapp: '5493487612233',
    vehicleType: 'auto',
    vehicleModel: 'Chevrolet Classic Blanco',
    zone: 'B° Malvinas ↔ Zárate Centro',
    amount: 36000,
    hours: 12,
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    proofFileName: 'recibo_banco_luciaveronicag.jpg',
    status: 'approved',
    createdAt: 'Hace 3 horas',
    approvedAt: 'Hace 2 horas y 55 min',
    alias: 'luciaveronicag',
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [];


export const MOCK_ADS: AdListing[] = [
  {
    id: 'ad-rotiseria-malvinas',
    businessName: 'Rotisería Malvinas',
    category: 'Gastronomía & Viandas',
    title: 'Empanadas, pizzas caseras, minutas y viandas calientes',
    description: 'Comidas caseras al paso y viandas familiares en Barrio Malvinas, Campana. Menú del día con entrega inmediata.',
    phone: '+54 9 3489 69-0058',
    linkUrl: 'https://rotiseria-malvinas.vercel.app',
    whatsappUrl: 'https://wa.me/5493489690058?text=Hola%20Rotiseria%20Malvinas,%20vengo%20desde%20la%20app%20UPPA',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
    zone: 'Barrio Malvinas, Campana',
    discountBadge: '🍕 Promo Viandas',
    isActive: true,
  },
  {
    id: 'ad-nexo-art',
    businessName: 'Nexo Art',
    category: 'Diseño & Gráfica Digital',
    title: 'Diseño publicitario, cartelería, gráfica comercial y web',
    description: 'Imprenta rápida, cartelería para comercios, branding e identidad visual integral en Zárate y Campana.',
    phone: '+54 9 3487 55-2190',
    linkUrl: 'https://nexo-art.vercel.app',
    whatsappUrl: 'https://wa.me/5493487552190?text=Hola%20Nexo%20Art,%20vengo%20desde%20la%20app%20UPPA',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=400&q=80',
    zone: 'Zárate ↔ Campana',
    discountBadge: '🎨 15% OFF Vecinos',
    isActive: true,
  },
];
