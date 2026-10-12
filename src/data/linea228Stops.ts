import { BusStop } from '../types';

export interface Linea228Stop extends BusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sequence: number;
  zone: 'Barrio Malvinas' | 'Las Campanas' | 'Ariel del Plata' | 'Colectora' | 'Campana Centro' | 'Ruta 6' | 'Zárate';
}

export const LINEA_228_STOPS: Linea228Stop[] = [
  // Tramo 1: Justo Vigalondo & B° Malvinas (Campana Sur)
  { id: 'p228-01', sequence: 1, name: 'Justo Vigalondo y Colectora (Cabecera B° Malvinas)', lat: -34.214048, lng: -58.939303, zone: 'Barrio Malvinas', description: 'Esquina de Colectora Sur y Vigalondo. Garita techada de espera.' },
  { id: 'p228-02', sequence: 2, name: 'Puerto San Carlos y Justo Vigalondo', lat: -34.212768, lng: -58.940199, zone: 'Barrio Malvinas', description: 'Frente a plaza vecinal y comercio de barrio.' },
  { id: 'p228-03', sequence: 3, name: 'Justo Vigalondo 1887 (Comercial)', lat: -34.211791, lng: -58.940898, zone: 'Barrio Malvinas', description: 'Parada demarcada en poste oficial.' },
  { id: 'p228-04', sequence: 4, name: 'Justo Vigalondo y Sandalía Bravo', lat: -34.211355, lng: -58.941215, zone: 'Barrio Malvinas', description: 'Cruce principal de acceso peatonal.' },
  { id: 'p228-05', sequence: 5, name: 'Justo Vigalondo y Bomberos Voluntarios', lat: -34.209988, lng: -58.942204, zone: 'Barrio Malvinas', description: 'Centro neurálgico B° Malvinas.' },
  { id: 'p228-06', sequence: 6, name: 'Justo Vigalondo 1419', lat: -34.208704, lng: -58.943139, zone: 'Barrio Malvinas', description: 'Frente a Escuela de la zona.' },
  { id: 'p228-07', sequence: 7, name: 'Justo Vigalondo 1219 y Sierra', lat: -34.207533, lng: -58.943970, zone: 'Barrio Malvinas', description: 'Esquina asfaltada con refugio peatonal.' },
  { id: 'p228-08', sequence: 8, name: 'Justo Vigalondo y Puerto Argentino', lat: -34.205220, lng: -58.945641, zone: 'Barrio Malvinas', description: 'Fin tramo Vigalondo, giro hacia Las Campanas.' },

  // Tramo 2: Barrio Las Campanas
  { id: 'p228-09', sequence: 9, name: 'Schinoni y Miracca (Las Campanas)', lat: -34.206483, lng: -58.941843, zone: 'Las Campanas', description: 'Entrada B° Las Campanas.' },
  { id: 'p228-10', sequence: 10, name: 'A. Schinoni y Casaux', lat: -34.205854, lng: -58.940590, zone: 'Las Campanas', description: 'Parada comunitaria con iluminación.' },
  { id: 'p228-11', sequence: 11, name: 'Casaux y Chapuis', lat: -34.205225, lng: -58.939338, zone: 'Las Campanas', description: 'Cruce peatonal Las Campanas.' },
  { id: 'p228-12', sequence: 12, name: 'Fremi y Casaux', lat: -34.204587, lng: -58.938069, zone: 'Las Campanas', description: 'Enlace entre Las Campanas y Ariel del Plata.' },

  // Tramo 3: Barrio Ariel del Plata
  { id: 'p228-13', sequence: 13, name: 'Casaux y Goujon (Ariel del Plata)', lat: -34.203967, lng: -58.936834, zone: 'Ariel del Plata', description: 'Ingreso B° Ariel del Plata.' },
  { id: 'p228-14', sequence: 14, name: 'Sociedad de Fomento Ariel del Plata', lat: -34.203006, lng: -58.935582, zone: 'Ariel del Plata', description: 'Frente al club social y centro comunitario.' },
  { id: 'p228-15', sequence: 15, name: 'Escuela Ariel del Plata (Calle Aguer)', lat: -34.202119, lng: -58.936479, zone: 'Ariel del Plata', description: 'Parada escolar de alto tránsito.' },
  { id: 'p228-16', sequence: 16, name: 'Galería Ariel del Plata', lat: -34.201022, lng: -58.937241, zone: 'Ariel del Plata', description: 'Centro comercial barrial.' },
  { id: 'p228-17', sequence: 17, name: 'Escuela Técnica Roberto Rocca', lat: -34.200810, lng: -58.937393, zone: 'Ariel del Plata', description: 'Acceso principal Escuela Técnica Roberto Rocca.' },

  // Tramo 4: Colectora Sur Panamericana (hasta McDonald's Campana)
  { id: 'p228-18', sequence: 18, name: 'Colectora Sur y Grassi', lat: -34.200217, lng: -58.940283, zone: 'Colectora', description: 'Empalme Colectora Sur Panamericana y calle Grassi.' },
  { id: 'p228-19', sequence: 19, name: 'Colectora Sur y Avenida Bellomo', lat: -34.197811, lng: -58.939523, zone: 'Colectora', description: 'Acceso a B° Ariel del Plata por Av. Bellomo.' },
  { id: 'p228-20', sequence: 20, name: 'Colectora Sur y Avenida Lavezzari', lat: -34.195019, lng: -58.941631, zone: 'Colectora', description: 'Parada frente a concesionarias y talleres.' },
  { id: 'p228-21', sequence: 21, name: 'Escuela Secundaria N° 3 (Colectora Sur)', lat: -34.193448, lng: -58.942756, zone: 'Colectora', description: 'Frente a Escuela Secundaria N° 3.' },
  { id: 'p228-22', sequence: 22, name: 'Colectora Sur y Magaldi', lat: -34.192306, lng: -58.943583, zone: 'Colectora', description: 'Punto de transferencia y parada de micros.' },
  { id: 'p228-mcdonalds', sequence: 23, name: "McDonald's Campana (Panamericana Km 72.5 / Colectora & Axion)", lat: -34.191398, lng: -58.944732, zone: 'Colectora', description: 'Parada estratégica 24hs frente a McDonald\'s y Axion Panamericana Km 72.5.' },

  // Tramo 5: Av. 6 de Julio / Colectora Norte / Acceso Centro
  { id: 'p228-25', sequence: 24, name: 'Av. 6 de Julio y Colectora Panamericana', lat: -34.1880, lng: -58.9455, zone: 'Colectora', description: 'Rotonda Av. 6 de Julio.' },
  { id: 'p228-26', sequence: 25, name: 'Avenida 6 de Julio y Córdoba', lat: -34.1840, lng: -58.9460, zone: 'Colectora', description: 'Zona industrial y comercial.' },
  { id: 'p228-27', sequence: 26, name: 'Avenida 6 de Julio y Namuncurá', lat: -34.1800, lng: -58.9455, zone: 'Colectora', description: 'Parada de media distancia.' },
  { id: 'p228-28', sequence: 27, name: 'Avenida 6 de Julio y Doctor Salk', lat: -34.1755, lng: -58.9442, zone: 'Colectora', description: 'Ingreso Colectora Norte.' },
  { id: 'p228-29', sequence: 28, name: 'Colectora Norte y Necochea', lat: -34.1720, lng: -58.9430, zone: 'Colectora', description: 'Parada barrio Siderca.' },
  { id: 'p228-30', sequence: 29, name: 'Colectora Norte y Ricardo Rojas', lat: -34.1690, lng: -58.9420, zone: 'Colectora', description: 'Acceso a puente Av. Rivadavia.' },

  // Tramo 6: Ingreso Centro de Campana (Av. Rubén Varela / Plaza Eduardo Costa)
  { id: 'p228-31', sequence: 30, name: 'Laprida y General Belgrano', lat: -34.1670, lng: -58.9550, zone: 'Campana Centro', description: 'Ingreso casco urbano de Campana.' },
  { id: 'p228-32', sequence: 31, name: 'Avenida Rubén Varela y Andrés del Pino', lat: -34.1660, lng: -58.9580, zone: 'Campana Centro', description: 'Avenida principal Varela.' },
  { id: 'p228-33', sequence: 32, name: 'Avenida Rubén Varela y Salmini', lat: -34.1652, lng: -58.9592, zone: 'Campana Centro', description: 'Comercios céntricos.' },
  { id: 'p228-34', sequence: 33, name: 'Avenida Rubén Varela y Avenida Teniente Perón', lat: -34.1645, lng: -58.9593, zone: 'Campana Centro', description: 'Paso por bulevar céntrico.' },
  { id: 'p228-35', sequence: 34, name: 'Plaza Eduardo Costa / San Martín', lat: -34.1633, lng: -58.9591, zone: 'Campana Centro', description: 'Plaza principal de Campana / Palacio Municipal.' },
  { id: 'p228-36', sequence: 35, name: 'General Belgrano y Jean Jaurés', lat: -34.1620, lng: -58.9585, zone: 'Campana Centro', description: 'Zona bancaria y comercial.' },
  { id: 'p228-37', sequence: 36, name: 'General Belgrano y Avenida Mitre', lat: -34.1608, lng: -58.9575, zone: 'Campana Centro', description: 'Av. Mitre comercial.' },
  { id: 'p228-38', sequence: 37, name: 'General Belgrano y Alem', lat: -34.1595, lng: -58.9565, zone: 'Campana Centro', description: 'Avenida Alem.' },

  // Tramo 7: Estación Campana y Enlace Céntrico
  { id: 'p228-39', sequence: 38, name: 'Estación de Tren Campana', lat: -34.1569, lng: -58.9585, zone: 'Campana Centro', description: 'Conexión Ferrocarril Mitre.' },
  { id: 'p228-40', sequence: 39, name: 'San Martín y Luis Costa', lat: -34.1555, lng: -58.9600, zone: 'Campana Centro', description: 'Hacia Ruta Provincial 6.' },
  { id: 'p228-41', sequence: 40, name: 'San Martín y Güemes', lat: -34.1540, lng: -58.9615, zone: 'Campana Centro', description: 'Salida de Campana.' },
  { id: 'p228-42', sequence: 41, name: 'San Martín y Av. Mitre', lat: -34.1528, lng: -58.9630, zone: 'Campana Centro', description: 'Enlace vial.' },
  { id: 'p228-43', sequence: 42, name: 'Jean Jaurés y Boulevard General Lavalle', lat: -34.1518, lng: -58.9642, zone: 'Campana Centro', description: 'Bulevar Lavalle.' },
  { id: 'p228-44', sequence: 43, name: 'Avenida Mitre y Balcarce', lat: -34.1500, lng: -58.9655, zone: 'Campana Centro', description: 'Acceso a autovía RP6.' },
  { id: 'p228-45', sequence: 44, name: 'Avenida Mitre y Santiago del Estero', lat: -34.1480, lng: -58.9675, zone: 'Campana Centro', description: 'Tramo final casco urbano.' },

  // Tramo 8: Ruta Provincial 6 (Campana → Zárate)
  { id: 'p228-46', sequence: 45, name: 'RP 6 y Bidegain', lat: -34.1430, lng: -58.9720, zone: 'Ruta 6', description: 'Autovía RP6 hacia Zárate.' },
  { id: 'p228-47', sequence: 46, name: 'RP 6 y Fernando Ochoa', lat: -34.1370, lng: -58.9800, zone: 'Ruta 6', description: 'Parada sobre autovía.' },
  { id: 'p228-48', sequence: 47, name: 'RP 6 y Saavedra', lat: -34.1300, lng: -58.9900, zone: 'Ruta 6', description: 'Zona descampada / fábricas.' },
  { id: 'p228-49', sequence: 48, name: 'RP 6 y Scholnik', lat: -34.1230, lng: -59.0020, zone: 'Ruta 6', description: 'Ingreso al Partido de Zárate.' },

  // Tramo 9: Ingreso a Zárate (Rotonda Zárate y Av. Lavalle)
  { id: 'p228-50', sequence: 49, name: 'Rotonda Zárate (Acceso RN 9 / Lavalle)', lat: -34.1190, lng: -59.0120, zone: 'Zárate', description: 'Rotonda principal de acceso a Zárate.' },
  { id: 'p228-51', sequence: 50, name: 'Avenida Lavalle y Perito Moreno', lat: -34.1175, lng: -59.0150, zone: 'Zárate', description: 'Avenida Lavalle comercial.' },
  { id: 'p228-52', sequence: 51, name: 'Avenida Lavalle y Pitrau', lat: -34.1160, lng: -59.0180, zone: 'Zárate', description: 'Parada barrial.' },
  { id: 'p228-53', sequence: 52, name: 'Plaza Lavalle / Laprida', lat: -34.1145, lng: -59.0210, zone: 'Zárate', description: 'Plaza Lavalle.' },
  { id: 'p228-54', sequence: 53, name: 'Avenida Lavalle y Larrea', lat: -34.1125, lng: -59.0240, zone: 'Zárate', description: 'Corredor comercial Zárate.' },
  { id: 'p228-55', sequence: 54, name: 'Avenida Lavalle y Pellegrini', lat: -34.1105, lng: -59.0270, zone: 'Zárate', description: 'Cruce céntrico.' },

  // Tramo 10: Zárate Centro (Leandro Alem)
  { id: 'p228-56', sequence: 55, name: 'Avenida Mitre y Leandro Alem', lat: -34.1085, lng: -59.0290, zone: 'Zárate', description: 'Avenida Leandro N. Alem.' },
  { id: 'p228-57', sequence: 56, name: 'Leandro Alem y Castelli', lat: -34.1065, lng: -59.0310, zone: 'Zárate', description: 'Centro de Zárate.' },
  { id: 'p228-58', sequence: 57, name: 'Leandro Alem y Rómulo Noya', lat: -34.1045, lng: -59.0325, zone: 'Zárate', description: 'Peatonal Rómulo Noya.' },
  { id: 'p228-59', sequence: 58, name: 'Leandro Alem e Ituzaingó', lat: -34.1035, lng: -59.0332, zone: 'Zárate', description: 'Plaza Mitre Zárate.' },
  { id: 'p228-60', sequence: 59, name: 'Leandro Alem y Rivadavia', lat: -34.1025, lng: -59.0340, zone: 'Zárate', description: 'Comercios céntricos.' },

  // Tramo 11: Zárate Centro a Terminal de Zárate
  { id: 'p228-61', sequence: 60, name: 'Florestano Andrade Atucha 173', lat: -34.1005, lng: -59.0355, zone: 'Zárate', description: 'Hacia terminal de ómnibus.' },
  { id: 'p228-62', sequence: 61, name: 'Florestano Andrade Atucha 473', lat: -34.0995, lng: -59.0360, zone: 'Zárate', description: 'Zona residencial.' },
  { id: 'p228-63', sequence: 62, name: 'Gregorio Quirno 1507', lat: -34.0988, lng: -59.0365, zone: 'Zárate', description: 'Avenida Anta.' },
  { id: 'p228-64', sequence: 63, name: 'Soler y Avenida Anta', lat: -34.0980, lng: -59.0370, zone: 'Zárate', description: 'Acceso andenes.' },
  { id: 'p228-65', sequence: 64, name: 'Centro de Transferencia de Zárate (Terminal)', lat: -34.0975, lng: -59.0373, zone: 'Zárate', description: 'Terminal de Ómnibus y Centro de Transferencia Zárate.' },
];

// Corredor específico habilitado: Justo Vigalondo hasta McDonald's Campana (Panamericana Km 72.5)
export const VIGALONDO_MCDONALDS_STOPS: Linea228Stop[] = LINEA_228_STOPS.slice(0, 23);

// Corredor específico: Centro de Campana hasta Zárate Centro y Terminal
export const CAMPANA_CENTRO_ZARATE_STOPS: Linea228Stop[] = LINEA_228_STOPS.slice(29);

// Polilínea Centro de Campana -> RP 6 -> Zárate Centro / Terminal
export const CAMPANA_CENTRO_ZARATE_COORDINATES: [number, number][] = [
  [-34.1670, -58.9550], // Laprida y General Belgrano (Centro Campana)
  [-34.1660, -58.9580], // Av. Rubén Varela y Del Pino
  [-34.1652, -58.9592], // Av. Varela y Salmini
  [-34.1645, -58.9593], // Av. Varela y Av. Tte. Perón
  [-34.1633, -58.9591], // Plaza Eduardo Costa / San Martín (Palacio Municipal)
  [-34.1620, -58.9585], // General Belgrano y Jean Jaurés
  [-34.1608, -58.9575], // Belgrano y Av. Mitre
  [-34.1595, -58.9565], // Belgrano y Alem
  [-34.1569, -58.9585], // Estación Ferrocarril Campana
  [-34.1555, -58.9600], // San Martín y Luis Costa
  [-34.1540, -58.9615], // San Martín y Güemes
  [-34.1528, -58.9630], // San Martín y Av. Mitre
  [-34.1518, -58.9642], // Jean Jaurés y Blvd. Lavalle
  [-34.1500, -58.9655], // Av. Mitre y Balcarce
  [-34.1480, -58.9675], // Av. Mitre y Santiago del Estero
  [-34.1430, -58.9720], // RP 6 y Bidegain
  [-34.1370, -58.9800], // RP 6 y Fernando Ochoa
  [-34.1300, -58.9900], // RP 6 y Saavedra
  [-34.1230, -59.0020], // RP 6 y Scholnik (Ingreso a Zárate)
  [-34.1190, -59.0120], // Rotonda Zárate (Acceso RN 9 / Av. Lavalle)
  [-34.1175, -59.0150], // Av. Lavalle y Perito Moreno
  [-34.1160, -59.0180], // Av. Lavalle y Pitrau
  [-34.1145, -59.0210], // Plaza Lavalle / Laprida
  [-34.1125, -59.0240], // Av. Lavalle y Larrea
  [-34.1105, -59.0270], // Av. Lavalle y Pellegrini
  [-34.1085, -59.0290], // Av. Mitre y Leandro Alem
  [-34.1065, -59.0310], // Leandro Alem y Castelli
  [-34.1045, -59.0325], // Leandro Alem y Rómulo Noya (Peatonal)
  [-34.1035, -59.0332], // Leandro Alem e Ituzaingó (Plaza Mitre)
  [-34.1025, -59.0340], // Leandro Alem y Rivadavia
  [-34.0995, -59.0360], // Andrade Atucha 473
  [-34.0988, -59.0365], // Gregorio Quirno 1507
  [-34.0980, -59.0370], // Soler y Av. Anta
  [-34.0975, -59.0373], // Centro de Transferencia de Zárate (Terminal)
];

// Polilínea de alta fidelidad que sigue fielmente el trazado de las calles de Campana:
// Justo Vigalondo -> Sandalía Bravo -> Las Campanas -> Ariel del Plata -> Colectora Sur -> McDonald's Panamericana Km 72.5
export const VIGALONDO_MCDONALDS_COORDINATES: [number, number][] = [
  [-34.214048, -58.939303], // Inicio Colectora / Vigalondo
  [-34.213685, -58.939551],
  [-34.212768, -58.940199], // Puerto San Carlos
  [-34.212532, -58.940368],
  [-34.211791, -58.940898], // Vigalondo 1887
  [-34.211355, -58.941215], // Sandalía Bravo
  [-34.210888, -58.941554],
  [-34.210440, -58.941880],
  [-34.209988, -58.942204], // Bomberos Voluntarios
  [-34.209560, -58.942520],
  [-34.209099, -58.942855],
  [-34.208704, -58.943139], // Vigalondo 1419
  [-34.207622, -58.943905],
  [-34.207533, -58.943970], // Sierra
  [-34.207138, -58.944258],
  [-34.206667, -58.944594],
  [-34.206200, -58.944931],
  [-34.205220, -58.945641], // Puerto Argentino
  [-34.204705, -58.946011],
  [-34.205261, -58.947069],
  [-34.204790, -58.947401],
  [-34.204247, -58.946340],
  [-34.206034, -58.945055],
  [-34.206483, -58.941843], // Schinoni y Miracca
  [-34.205854, -58.940590], // Las Campanas
  [-34.205225, -58.939338], // Chapuis
  [-34.204587, -58.938069], // Fremi / Casaux
  [-34.203967, -58.936834], // Ariel del Plata
  [-34.203337, -58.935581],
  [-34.203006, -58.935582], // Fomento Ariel del Plata
  [-34.202341, -58.936283],
  [-34.202119, -58.936479], // Escuela Ariel del Plata
  [-34.201022, -58.937241], // Galería
  [-34.200810, -58.937393], // Roberto Rocca
  [-34.200196, -58.937838],
  [-34.199553, -58.938301],
  [-34.199813, -58.939686],
  [-34.200217, -58.940283], // Colectora Sur y Grassi
  [-34.200045, -58.940906],
  [-34.199385, -58.941668],
  [-34.198125, -58.940021],
  [-34.197811, -58.939523], // Colectora Sur y Bellomo
  [-34.196627, -58.940373],
  [-34.195019, -58.941631], // Colectora Sur y Lavezzari
  [-34.194482, -58.942004],
  [-34.193448, -58.942756], // Secundaria 3
  [-34.192885, -58.943165],
  [-34.192306, -58.943583], // Magaldi
  [-34.191686, -58.944040],
  [-34.191398, -58.944732], // McDonald's Campana (Km 72.5)
];

// Recorrido troncal completo Zárate ↔ Malvinas
export const LINEA_228_COORDINATES: [number, number][] = [
  ...VIGALONDO_MCDONALDS_COORDINATES,
  [-34.1880, -58.9455], // Av. 6 de Julio y Panamericana
  [-34.1840, -58.9460], // Av. 6 de Julio y Córdoba
  [-34.1800, -58.9455], // Namuncurá
  [-34.1755, -58.9442], // Salk
  [-34.1720, -58.9430], // Necochea
  [-34.1690, -58.9420], // Rojas
  [-34.1670, -58.9550], // Laprida y Belgrano
  [-34.1660, -58.9580], // Varela y Del Pino
  [-34.1652, -58.9592], // Varela y Salmini
  [-34.1645, -58.9593], // Varela y Perón
  [-34.1633, -58.9591], // Plaza Costa
  [-34.1620, -58.9585], // Belgrano y Jean Jaurés
  [-34.1608, -58.9575], // Belgrano y Mitre
  [-34.1595, -58.9565], // Belgrano y Alem
  [-34.1569, -58.9585], // Estación Campana
  [-34.1555, -58.9600], // San Martín y Costa
  [-34.1540, -58.9615], // San Martín y Güemes
  [-34.1528, -58.9630], // San Martín y Mitre
  [-34.1518, -58.9642], // Lavalle
  [-34.1500, -58.9655], // Balcarce
  [-34.1480, -58.9675], // Santiago del Estero
  [-34.1430, -58.9720], // RP6 y Bidegain
  [-34.1370, -58.9800], // RP6 y Ochoa
  [-34.1300, -58.9900], // RP6 y Saavedra
  [-34.1230, -59.0020], // RP6 y Scholnik
  [-34.1190, -59.0120], // Rotonda Zárate
  [-34.1175, -59.0150], // Lavalle y Perito Moreno
  [-34.1160, -59.0180], // Lavalle y Pitrau
  [-34.1145, -59.0210], // Plaza Lavalle
  [-34.1125, -59.0240], // Lavalle y Larrea
  [-34.1105, -59.0270], // Lavalle y Pellegrini
  [-34.1085, -59.0290], // Alem y Mitre
  [-34.1065, -59.0310], // Alem y Castelli
  [-34.1045, -59.0325], // Alem y Noya
  [-34.1035, -59.0332], // Alem e Ituzaingó
  [-34.1025, -59.0340], // Alem y Rivadavia
  [-34.1005, -59.0355], // Atucha 173
  [-34.0995, -59.0360], // Atucha 473
  [-34.0988, -59.0365], // Quirno 1507
  [-34.0980, -59.0370], // Soler y Anta
  [-34.0975, -59.0373], // Terminal Zárate
];
