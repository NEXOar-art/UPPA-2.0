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
  { id: 'p228-25', sequence: 24, name: 'Av. 6 de Julio y Colectora Panamericana', lat: -34.187650, lng: -58.948400, zone: 'Colectora', description: 'Distribuidor Panamericana y Av. 6 de Julio.' },
  { id: 'p228-26', sequence: 25, name: 'Avenida 6 de Julio y Córdoba', lat: -34.185050, lng: -58.950520, zone: 'Colectora', description: 'Zona comercial y residencial.' },
  { id: 'p228-27', sequence: 26, name: 'Avenida 6 de Julio y Namuncurá', lat: -34.182250, lng: -58.952720, zone: 'Colectora', description: 'Parada con refugio peatonal iluminado.' },
  { id: 'p228-28', sequence: 27, name: 'Avenida 6 de Julio y Doctor Salk', lat: -34.178750, lng: -58.955350, zone: 'Colectora', description: 'Ingreso Colectora Norte y acceso fabril.' },
  { id: 'p228-29', sequence: 28, name: 'Colectora Norte y Necochea', lat: -34.174350, lng: -58.958620, zone: 'Colectora', description: 'Frente a Tenaris Siderca y B° Siderca.' },
  { id: 'p228-30', sequence: 29, name: 'Colectora Norte y Ricardo Rojas', lat: -34.170450, lng: -58.961520, zone: 'Colectora', description: 'Giro hacia puente Av. Rivadavia.' },

  // Tramo 6: Ingreso Centro de Campana (Av. Rubén Varela / Plaza Eduardo Costa)
  { id: 'p228-31', sequence: 30, name: 'Laprida y General Belgrano', lat: -34.167650, lng: -58.959950, zone: 'Campana Centro', description: 'Ingreso casco urbano de Campana.' },
  { id: 'p228-32', sequence: 31, name: 'Avenida Rubén Varela y Andrés del Pino', lat: -34.165950, lng: -58.958580, zone: 'Campana Centro', description: 'Avenida principal Varela y centro comercial.' },
  { id: 'p228-33', sequence: 32, name: 'Avenida Rubén Varela y Salmini', lat: -34.165250, lng: -58.959020, zone: 'Campana Centro', description: 'Comercios y entidades bancarias.' },
  { id: 'p228-34', sequence: 33, name: 'Avenida Rubén Varela y Avenida Teniente Perón', lat: -34.164450, lng: -58.959150, zone: 'Campana Centro', description: 'Bulevar céntrico.' },
  { id: 'p228-35', sequence: 34, name: 'Plaza Eduardo Costa / San Martín', lat: -34.163200, lng: -58.958950, zone: 'Campana Centro', description: 'Plaza principal de Campana / Palacio Municipal.' },
  { id: 'p228-36', sequence: 35, name: 'General Belgrano y Jean Jaurés', lat: -34.162350, lng: -58.958380, zone: 'Campana Centro', description: 'Casco histórico y bancos.' },
  { id: 'p228-37', sequence: 36, name: 'General Belgrano y Avenida Mitre', lat: -34.161250, lng: -58.957480, zone: 'Campana Centro', description: 'Cruce con Avenida Mitre.' },
  { id: 'p228-38', sequence: 37, name: 'General Belgrano y Alem', lat: -34.160050, lng: -58.956480, zone: 'Campana Centro', description: 'Avenida Leandro N. Alem.' },

  // Tramo 7: Estación Campana y Enlace Céntrico
  { id: 'p228-39', sequence: 38, name: 'Estación de Tren Campana', lat: -34.156950, lng: -58.958550, zone: 'Campana Centro', description: 'Conexión Ferrocarril Mitre.' },
  { id: 'p228-40', sequence: 39, name: 'San Martín y Luis Costa', lat: -34.156050, lng: -58.959520, zone: 'Campana Centro', description: 'Hacia Ruta Provincial 6.' },
  { id: 'p228-41', sequence: 40, name: 'San Martín y Güemes', lat: -34.154850, lng: -58.960820, zone: 'Campana Centro', description: 'Zona céntrica norte de Campana.' },
  { id: 'p228-42', sequence: 41, name: 'San Martín y Av. Mitre', lat: -34.153650, lng: -58.962150, zone: 'Campana Centro', description: 'Enlace vial principal.' },
  { id: 'p228-43', sequence: 42, name: 'Jean Jaurés y Boulevard General Lavalle', lat: -34.152250, lng: -58.963650, zone: 'Campana Centro', description: 'Bulevar Lavalle y comercios.' },
  { id: 'p228-44', sequence: 43, name: 'Avenida Mitre y Balcarce', lat: -34.151050, lng: -58.964950, zone: 'Campana Centro', description: 'Acceso a autovía RP6.' },
  { id: 'p228-45', sequence: 44, name: 'Avenida Mitre y Santiago del Estero', lat: -34.149350, lng: -58.966850, zone: 'Campana Centro', description: 'Rotonda norte de enlace a RP6.' },

  // Tramo 8: Ruta Provincial 6 (Campana → Zárate)
  { id: 'p228-46', sequence: 45, name: 'RP 6 y Bidegain', lat: -34.144050, lng: -58.972450, zone: 'Ruta 6', description: 'Autovía RP6 hacia Zárate.' },
  { id: 'p228-47', sequence: 46, name: 'RP 6 y Fernando Ochoa', lat: -34.138650, lng: -58.978250, zone: 'Ruta 6', description: 'Parada sobre autovía RP6.' },
  { id: 'p228-48', sequence: 47, name: 'RP 6 y Saavedra', lat: -34.132350, lng: -58.985350, zone: 'Ruta 6', description: 'Zona industrial y comercial de la autovía.' },
  { id: 'p228-49', sequence: 48, name: 'RP 6 y Scholnik', lat: -34.122650, lng: -58.997350, zone: 'Ruta 6', description: 'Ingreso al Partido de Zárate / Parque Industrial.' },

  // Tramo 9: Ingreso a Zárate (Rotonda Zárate y Av. Lavalle)
  { id: 'p228-50', sequence: 49, name: 'Rotonda Zárate (Acceso RN 9 / Lavalle)', lat: -34.115650, lng: -59.013400, zone: 'Zárate', description: 'Rotonda principal de acceso a Zárate por RN 9 y RP 6.' },
  { id: 'p228-51', sequence: 50, name: 'Avenida Lavalle y Perito Moreno', lat: -34.113650, lng: -59.016180, zone: 'Zárate', description: 'Avenida Lavalle comercial y residencial.' },
  { id: 'p228-52', sequence: 51, name: 'Avenida Lavalle y Pitrau', lat: -34.112250, lng: -59.017980, zone: 'Zárate', description: 'Cruce Av. Lavalle y Pitrau / Teodoro Fels.' },
  { id: 'p228-53', sequence: 52, name: 'Plaza Lavalle / Laprida', lat: -34.110850, lng: -59.019780, zone: 'Zárate', description: 'Plaza Lavalle y escuelas de la zona.' },
  { id: 'p228-54', sequence: 53, name: 'Avenida Lavalle y Larrea', lat: -34.109450, lng: -59.021580, zone: 'Zárate', description: 'Corredor comercial céntrico Zárate.' },
  { id: 'p228-55', sequence: 54, name: 'Avenida Lavalle y Pellegrini', lat: -34.108050, lng: -59.023380, zone: 'Zárate', description: 'Cruce de alto tránsito.' },

  // Tramo 10: Zárate Centro (Leandro Alem)
  { id: 'p228-56', sequence: 55, name: 'Avenida Mitre y Leandro Alem', lat: -34.105250, lng: -59.027400, zone: 'Zárate', description: 'Avenida Leandro N. Alem.' },
  { id: 'p228-57', sequence: 56, name: 'Leandro Alem y Castelli', lat: -34.104050, lng: -59.029080, zone: 'Zárate', description: 'Centro cívico y comercial de Zárate.' },
  { id: 'p228-58', sequence: 57, name: 'Leandro Alem y Rómulo Noya', lat: -34.102850, lng: -59.030680, zone: 'Zárate', description: 'Cruce con la peatonal Rómulo Noya.' },
  { id: 'p228-59', sequence: 58, name: 'Leandro Alem e Ituzaingó', lat: -34.101650, lng: -59.032180, zone: 'Zárate', description: 'Plaza Mitre y Municipalidad de Zárate.' },
  { id: 'p228-60', sequence: 59, name: 'Leandro Alem y Rivadavia', lat: -34.100450, lng: -59.033680, zone: 'Zárate', description: 'Área comercial y de servicios.' },

  // Tramo 11: Zárate Centro a Terminal de Zárate
  { id: 'p228-61', sequence: 60, name: 'Florestano Andrade Atucha 173', lat: -34.098950, lng: -59.035580, zone: 'Zárate', description: 'Hacia terminal de ómnibus.' },
  { id: 'p228-62', sequence: 61, name: 'Florestano Andrade Atucha 473', lat: -34.098050, lng: -59.036480, zone: 'Zárate', description: 'Zona residencial.' },
  { id: 'p228-63', sequence: 62, name: 'Gregorio Quirno 1507', lat: -34.097250, lng: -59.037280, zone: 'Zárate', description: 'Acceso avenida Anta.' },
  { id: 'p228-64', sequence: 63, name: 'Soler y Avenida Anta', lat: -34.096450, lng: -59.037950, zone: 'Zárate', description: 'Acceso a andenes terminales.' },
  { id: 'p228-65', sequence: 64, name: 'Centro de Transferencia de Zárate (Terminal)', lat: -34.095650, lng: -59.038650, zone: 'Zárate', description: 'Terminal de Ómnibus y Centro de Transferencia Zárate.' },
];

// Corredor específico habilitado: Justo Vigalondo hasta McDonald's Campana (Panamericana Km 72.5)
export const VIGALONDO_MCDONALDS_STOPS: Linea228Stop[] = LINEA_228_STOPS.slice(0, 23);

// Corredor específico: Centro de Campana hasta Zárate Centro y Terminal
export const CAMPANA_CENTRO_ZARATE_STOPS: Linea228Stop[] = LINEA_228_STOPS.slice(29);

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

// Trazado de alta fidelidad que conecta Panamericana Km 72.5 -> Colectora Norte -> Casco Céntrico Campana -> RP 6 -> Zárate Centro -> Terminal
export const CAMPANA_A_ZARATE_SECTOR_COORDINATES: [number, number][] = [
  [-34.190820, -58.945310],
  [-34.189950, -58.946150],
  [-34.189100, -58.947050], // Distribuidor Panamericana / Av. 6 de Julio
  [-34.188450, -58.947800],
  [-34.187650, -58.948400], // Av. 6 de Julio y Colectora Panamericana
  [-34.186500, -58.949350],
  [-34.185050, -58.950520], // Av. 6 de Julio y Córdoba
  [-34.183800, -58.951500],
  [-34.182250, -58.952720], // Av. 6 de Julio y Namuncurá
  [-34.180800, -58.953800],
  [-34.178750, -58.955350], // Av. 6 de Julio y Dr. Salk
  [-34.176800, -58.956800],
  [-34.174350, -58.958620], // Colectora Norte y Necochea (Tenaris)
  [-34.172500, -58.960000],
  [-34.170450, -58.961520], // Colectora Norte y Ricardo Rojas
  [-34.169500, -58.962200], // Giro hacia Av. Rivadavia
  [-34.168600, -58.961200],
  [-34.167650, -58.959950], // Laprida y Belgrano
  [-34.166800, -58.959300],
  [-34.165950, -58.958580], // Av. Rubén Varela y Del Pino
  [-34.165400, -58.958900],
  [-34.165250, -58.959020], // Av. Varela y Salmini
  [-34.164600, -58.959100],
  [-34.164450, -58.959150], // Av. Varela y Av. Tte. Perón
  [-34.163800, -58.959200], // Acceso Plaza Eduardo Costa
  [-34.163200, -58.958950], // Plaza Eduardo Costa / San Martín (Palacio Municipal)
  [-34.162500, -58.958500],
  [-34.162350, -58.958380], // General Belgrano y Jean Jaurés
  [-34.161400, -58.957600],
  [-34.161250, -58.957480], // Belgrano y Av. Mitre
  [-34.160200, -58.956600],
  [-34.160050, -58.956480], // Belgrano y Alem
  [-34.158500, -58.957400],
  [-34.157200, -58.958300],
  [-34.156950, -58.958550], // Estación Ferrocarril Campana
  [-34.156200, -58.959400],
  [-34.156050, -58.959520], // San Martín y Luis Costa
  [-34.155000, -58.960700],
  [-34.154850, -58.960820], // San Martín y Güemes
  [-34.153800, -58.962000],
  [-34.153650, -58.962150], // San Martín y Av. Mitre
  [-34.152400, -58.963500],
  [-34.152250, -58.963650], // Jean Jaurés y Blvd. Lavalle
  [-34.151200, -58.964800],
  [-34.151050, -58.964950], // Av. Mitre y Balcarce
  [-34.149500, -58.966700],
  [-34.149350, -58.966850], // Av. Mitre y Santiago del Estero
  // Autovía Ruta Provincial 6 (Campana → Zárate)
  [-34.147800, -58.968600],
  [-34.146000, -58.970500],
  [-34.144200, -58.972300],
  [-34.144050, -58.972450], // RP 6 y Bidegain
  [-34.141500, -58.975200],
  [-34.138800, -58.978100],
  [-34.138650, -58.978250], // RP 6 y Fernando Ochoa
  [-34.135500, -58.981800],
  [-34.132500, -58.985200],
  [-34.132350, -58.985350], // RP 6 y Saavedra
  [-34.129000, -58.989200],
  [-34.125500, -58.993500],
  [-34.122800, -58.997200],
  [-34.122650, -58.997350], // RP 6 y Scholnik (Ingreso a Zárate / Parque Industrial)
  [-34.120500, -59.001500],
  [-34.118800, -59.005500],
  [-34.117200, -59.009800],
  // Rotonda Zárate (Acceso RN 9 / Av. Lavalle)
  [-34.116500, -59.012200],
  [-34.115800, -59.013200],
  [-34.115650, -59.013400], // Rotonda Zárate
  // Avenida Lavalle comercial
  [-34.114800, -59.014600],
  [-34.113800, -59.016000],
  [-34.113650, -59.016180], // Av. Lavalle y Perito Moreno
  [-34.112400, -59.017800],
  [-34.112250, -59.017980], // Av. Lavalle y Pitrau
  [-34.111000, -59.019600],
  [-34.110850, -59.019780], // Plaza Lavalle / Laprida
  [-34.109600, -59.021400],
  [-34.109450, -59.021580], // Av. Lavalle y Larrea
  [-34.108200, -59.023200],
  [-34.108050, -59.023380], // Av. Lavalle y Pellegrini
  [-34.107000, -59.024800],
  // Zárate Centro (Av. Mitre & Leandro Alem)
  [-34.106200, -59.026000],
  [-34.105400, -59.027200],
  [-34.105250, -59.027400], // Av. Mitre y Leandro Alem
  [-34.104200, -59.028900],
  [-34.104050, -59.029080], // Leandro Alem y Castelli
  [-34.103000, -59.030500],
  [-34.102850, -59.030680], // Leandro Alem y Rómulo Noya (Peatonal)
  [-34.101800, -59.032000],
  [-34.101650, -59.032180], // Leandro Alem e Ituzaingó (Plaza Mitre)
  [-34.100600, -59.033500],
  [-34.100450, -59.033680], // Leandro Alem y Rivadavia
  // Acceso a Terminal Zárate
  [-34.099800, -59.034600],
  [-34.099100, -59.035400],
  [-34.098950, -59.035580], // Andrade Atucha 173
  [-34.098200, -59.036300],
  [-34.098050, -59.036480], // Andrade Atucha 473
  [-34.097400, -59.037100],
  [-34.097250, -59.037280], // Gregorio Quirno 1507
  [-34.096600, -59.037800],
  [-34.096450, -59.037950], // Soler y Av. Anta
  [-34.095900, -59.038400],
  [-34.095650, -59.038650], // Centro de Transferencia de Zárate (Terminal)
];

// Polilínea Centro de Campana -> RP 6 -> Zárate Centro / Terminal
export const CAMPANA_CENTRO_ZARATE_COORDINATES: [number, number][] = CAMPANA_A_ZARATE_SECTOR_COORDINATES.slice(17);

// Recorrido troncal completo Zárate ↔ Malvinas
export const LINEA_228_COORDINATES: [number, number][] = [
  ...VIGALONDO_MCDONALDS_COORDINATES,
  ...CAMPANA_A_ZARATE_SECTOR_COORDINATES,
];
