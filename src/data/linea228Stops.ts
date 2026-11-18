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
  { id: 'p228-03', sequence: 1, name: 'Justo Vigalondo 1887 (Comercial)', lat: -34.211791, lng: -58.940898, zone: 'Barrio Malvinas', description: 'Parada demarcada en poste oficial.' },
  { id: 'p228-04', sequence: 2, name: 'Vigalondo y Puerto Argentino', lat: -34.211355, lng: -58.941215, zone: 'Barrio Malvinas', description: 'Cruce Justo Vigalondo y Puerto Argentino.' },
  { id: 'p228-05', sequence: 3, name: 'Vigalondo y C. Chapuis', lat: -34.209988, lng: -58.942204, zone: 'Barrio Malvinas', description: 'Cruce Justo Vigalondo y Claudio Chapuis.' },
  { id: 'p228-06', sequence: 4, name: 'Vigalondo y De los Trabajadores', lat: -34.208642, lng: -58.943184, zone: 'Barrio Malvinas', description: 'Cruce Justo Vigalondo y De los Trabajadores.' },
  { id: 'p228-07', sequence: 5, name: 'Vigalondo y Bravo', lat: -34.207533, lng: -58.943970, zone: 'Barrio Malvinas', description: 'Cruce Justo Vigalondo y Sandalía Bravo.' },
  { id: 'p228-08', sequence: 6, name: 'Vigalondo y Puerto San Carlos', lat: -34.204705, lng: -58.946011, zone: 'Barrio Malvinas', description: 'Fin tramo Vigalondo, giro hacia Las Campanas.' },

  // Tramo 2: Barrio Las Campanas
  { id: 'p228-09', sequence: 7, name: 'Vigalondo y Miraca', lat: -34.211031, lng: -58.939337, zone: 'Las Campanas', description: 'Cruce Justo Vigalondo y Miraca.' },
  { id: 'p228-10', sequence: 8, name: 'Shinoni y Casaux', lat: -34.210317, lng: -58.937851, zone: 'Las Campanas', description: 'Cruce Shinoni y Casaux (Las Campanas).' },
  { id: 'p228-11', sequence: 9, name: 'Casaux y Chapuis', lat: -34.208539, lng: -58.939095, zone: 'Las Campanas', description: 'Cruce Casaux y Chapuis.' },
  { id: 'p228-12', sequence: 10, name: 'H. Fremi y Casaux', lat: -34.207693, lng: -58.939446, zone: 'Las Campanas', description: 'Cruce H. Fremi y Casaux.' },

  // Tramo 3: Barrio Ariel del Plata
  { id: 'p228-13', sequence: 11, name: 'Casaux y Goujon', lat: -34.207054, lng: -58.939631, zone: 'Ariel del Plata', description: 'Cruce Casaux y Goujon (Ingreso B° Ariel del Plata).' },
  { id: 'p228-14', sequence: 12, name: 'Sociedad de Fomento Ariel del Plata', lat: -34.205930, lng: -58.939113, zone: 'Ariel del Plata', description: 'Frente a Sociedad de Fomento Ariel del Plata.' },
  { id: 'p228-16', sequence: 13, name: 'Galería Ariel del Plata', lat: -34.204011, lng: -58.935267, zone: 'Ariel del Plata', description: 'Frente a Galería Ariel del Plata.' },
  { id: 'p228-17', sequence: 14, name: 'Escuela Técnica Roberto Rocca', lat: -34.200625, lng: -58.937410, zone: 'Ariel del Plata', description: 'Acceso principal Escuela Técnica Roberto Rocca.' },
  { id: 'p228-15', sequence: 15, name: 'Escuela Ariel del Plata (Calle Aguer)', lat: -34.202119, lng: -58.936479, zone: 'Ariel del Plata', description: 'Parada escolar de alto tránsito.' },

  // Tramo 4: Colectora Sur Panamericana (hasta McDonald's Campana)
  { id: 'p228-18', sequence: 16, name: 'Colectora Sur y Grassi', lat: -34.200217, lng: -58.940283, zone: 'Colectora', description: 'Empalme Colectora Sur Panamericana y calle Grassi.' },
  { id: 'p228-19', sequence: 17, name: 'Colectora Sur y Avenida Bellomo', lat: -34.197811, lng: -58.939523, zone: 'Colectora', description: 'Acceso a B° Ariel del Plata por Av. Bellomo.' },
  { id: 'p228-20', sequence: 18, name: 'Colectora Sur y Avenida Lavezzari', lat: -34.195019, lng: -58.941631, zone: 'Colectora', description: 'Parada frente a concesionarias y talleres.' },
  { id: 'p228-21', sequence: 19, name: 'Escuela Secundaria N° 3 (Colectora Sur)', lat: -34.193448, lng: -58.942756, zone: 'Colectora', description: 'Frente a Escuela Secundaria N° 3.' },
  { id: 'p228-22', sequence: 20, name: 'Colectora Sur y Viale', lat: -34.192982, lng: -58.943026, zone: 'Colectora', description: 'Cruce Colectora Sur Panamericana y calle Viale.' },
  { id: 'p228-mcdonalds', sequence: 21, name: "McDonald's y Colectora Sur", lat: -34.191145, lng: -58.944410, zone: 'Colectora', description: "Parada estratégica 24hs frente a McDonald's y Colectora Sur." },

  // Tramo 5: Av. 6 de Julio / Colectora Norte / Acceso Centro
  { id: 'p228-25', sequence: 22, name: 'Avenida 6 de Julio y Autopista Aramburu', lat: -34.190204, lng: -58.943831, zone: 'Colectora', description: 'Distribuidor Avenida 6 de Julio y Autopista Aramburu.' },
  { id: 'p228-26', sequence: 23, name: 'Gandhi', lat: -34.184870, lng: -58.943724, zone: 'Colectora', description: 'Parada sobre calle Gandhi.' },
  { id: 'p228-27', sequence: 24, name: 'Dr. Salk y Colectora Norte', lat: -34.185935, lng: -58.946814, zone: 'Colectora', description: 'Cruce Dr. Salk y Colectora Norte.' },
  { id: 'p228-28', sequence: 25, name: 'Colectora Norte y Necochea', lat: -34.184349, lng: -58.948380, zone: 'Colectora', description: 'Cruce Colectora Norte y Necochea.' },
  { id: 'p228-29', sequence: 26, name: 'Ricardo Rojas y Viamonte', lat: -34.181757, lng: -58.952661, zone: 'Colectora', description: 'Cruce Ricardo Rojas y Viamonte.' },

  // Tramo 6: Ingreso Centro de Campana (Av. Rivadavia / Belgrano / San Martín / 25 de Mayo / Mitre)
  { id: 'p228-30', sequence: 27, name: 'Av. Rivadavia y Salmini', lat: -34.177763, lng: -58.960429, zone: 'Campana Centro', description: 'Cruce Avenida Rivadavia y Salmini.' },
  { id: 'p228-31', sequence: 28, name: 'Av. Rivadavia y Perón', lat: -34.175748, lng: -58.960225, zone: 'Campana Centro', description: 'Cruce Avenida Rivadavia y Perón.' },
  { id: 'p228-32', sequence: 29, name: 'Av. Rivadavia y Bertolini', lat: -34.173724, lng: -58.959997, zone: 'Campana Centro', description: 'Cruce Avenida Rivadavia y Bertolini.' },
  { id: 'p228-33', sequence: 30, name: 'Escuela 5', lat: -34.171896, lng: -58.959825, zone: 'Campana Centro', description: 'Parada frente a Escuela N° 5.' },
  { id: 'p228-34', sequence: 31, name: 'Parque Urbano', lat: -34.170032, lng: -58.959696, zone: 'Campana Centro', description: 'Parada Parque Urbano Campana.' },
  { id: 'p228-35', sequence: 32, name: 'Belgrano y Alberdi', lat: -34.167200, lng: -58.958291, zone: 'Campana Centro', description: 'Cruce Belgrano y Alberdi.' },
  { id: 'p228-36', sequence: 33, name: 'Belgrano y Jean Jaurés', lat: -34.165309, lng: -58.958098, zone: 'Campana Centro', description: 'Cruce Belgrano y Jean Jaurés.' },
  { id: 'p228-37', sequence: 34, name: 'Belgrano y Mitre', lat: -34.163534, lng: -58.957937, zone: 'Campana Centro', description: 'Cruce Belgrano y Mitre.' },
  { id: 'p228-38', sequence: 35, name: 'Belgrano y Dominicis', lat: -34.161545, lng: -58.957711, zone: 'Campana Centro', description: 'Cruce Belgrano y Dominicis.' },
  { id: 'p228-39', sequence: 36, name: 'Belgrano y Becerra', lat: -34.159814, lng: -58.957572, zone: 'Campana Centro', description: 'Cruce Belgrano y Becerra.' },
  { id: 'p228-40', sequence: 37, name: 'Belgrano y Alem', lat: -34.157097, lng: -58.957325, zone: 'Campana Centro', description: 'Cruce Belgrano y Alem.' },

  // Tramo 7: Estación Campana y Enlace Céntrico hacia RP 6
  { id: 'p228-41', sequence: 38, name: 'Alem y San Martín', lat: -34.156804, lng: -58.959525, zone: 'Campana Centro', description: 'Cruce Alem y San Martín.' },
  { id: 'p228-42', sequence: 39, name: 'San Martín y Luis Costa', lat: -34.158278, lng: -58.959932, zone: 'Campana Centro', description: 'Cruce San Martín y Luis Costa.' },
  { id: 'p228-43', sequence: 40, name: 'San Martín y Güemes', lat: -34.160178, lng: -58.960115, zone: 'Campana Centro', description: 'Cruce San Martín y Güemes.' },
  { id: 'p228-44', sequence: 41, name: '25 de Mayo y Rawson', lat: -34.162069, lng: -58.961448, zone: 'Campana Centro', description: 'Cruce 25 de Mayo y Rawson.' },
  { id: 'p228-45', sequence: 42, name: '25 de Mayo y Chiclana', lat: -34.161705, lng: -58.966670, zone: 'Campana Centro', description: 'Cruce 25 de Mayo y Chiclana.' },
  { id: 'p228-46', sequence: 43, name: 'Pueyrredón y Mitre', lat: -34.162539, lng: -58.968344, zone: 'Campana Centro', description: 'Cruce Pueyrredón y Mitre.' },
  { id: 'p228-47', sequence: 44, name: 'Balcarce y Mitre', lat: -34.162424, lng: -58.970285, zone: 'Campana Centro', description: 'Cruce Balcarce y Mitre.' },
  { id: 'p228-48', sequence: 45, name: 'Club Atlético Villa Dálmine', lat: -34.162375, lng: -58.977013, zone: 'Campana Centro', description: 'Frente al Club Atlético Villa Dálmine.' },

  // Tramo 8: Ruta Provincial 6 (Campana → Zárate)
  { id: 'p228-49', sequence: 46, name: 'Ruta 6 y Bidegain', lat: -34.152605, lng: -58.997094, zone: 'Ruta 6', description: 'Cruce Ruta 6 y Bidegain hacia Zárate.' },
  { id: 'p228-50', sequence: 47, name: 'Ruta 6 y Gobernador Cafiero', lat: -34.147215, lng: -59.002802, zone: 'Ruta 6', description: 'Cruce Ruta 6 y Gobernador Cafiero.' },
  { id: 'p228-51', sequence: 48, name: 'Ruta 6 y Fernando Ochoa', lat: -34.145626, lng: -59.003746, zone: 'Ruta 6', description: 'Cruce Ruta 6 y Fernando Ochoa.' },
  { id: 'p228-52', sequence: 49, name: 'Ruta 6 y Scholnik', lat: -34.136178, lng: -59.009186, zone: 'Ruta 6', description: 'Cruce Ruta 6 y Scholnik.' },
  { id: 'p228-53', sequence: 50, name: 'Ruta 6 y Ruta 12', lat: -34.123396, lng: -59.016664, zone: 'Ruta 6', description: 'Enlace Ruta 6 y Ruta 12.' },

  // Tramo 9: Ingreso a Zárate (Av. Lavalle)
  { id: 'p228-54', sequence: 51, name: 'Av. Lavalle y Perito Moreno', lat: -34.118395, lng: -59.019539, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Perito Moreno.' },
  { id: 'p228-55', sequence: 52, name: 'Av. Lavalle y Pitrau', lat: -34.116255, lng: -59.020140, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Pitrau.' },
  { id: 'p228-56', sequence: 53, name: 'Av. Lavalle y Larrea', lat: -34.110694, lng: -59.020580, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Larrea.' },
  { id: 'p228-57', sequence: 54, name: 'Av. Lavalle y Dorrego', lat: -34.109326, lng: -59.020794, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Dorrego.' },
  { id: 'p228-58', sequence: 55, name: 'Av. Lavalle y Bernardo de Irigoyen', lat: -34.107470, lng: -59.021299, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Bernardo de Irigoyen.' },
  { id: 'p228-59', sequence: 56, name: 'Av. Lavalle y Pellegrini', lat: -34.105613, lng: -59.022490, zone: 'Zárate', description: 'Cruce Avenida Lavalle y Pellegrini.' },

  // Tramo 10: Zárate Centro (Leandro Alem)
  { id: 'p228-60', sequence: 57, name: 'Avenida Mitre y Leandro Alem', lat: -34.105250, lng: -59.027400, zone: 'Zárate', description: 'Avenida Leandro N. Alem.' },
  { id: 'p228-61', sequence: 58, name: 'Leandro Alem y Castelli', lat: -34.104050, lng: -59.029080, zone: 'Zárate', description: 'Centro cívico y comercial de Zárate.' },
  { id: 'p228-62', sequence: 59, name: 'Leandro Alem y Rómulo Noya', lat: -34.102850, lng: -59.030680, zone: 'Zárate', description: 'Cruce con la peatonal Rómulo Noya.' },
  { id: 'p228-63', sequence: 60, name: 'Leandro Alem e Ituzaingó', lat: -34.101650, lng: -59.032180, zone: 'Zárate', description: 'Plaza Mitre y Municipalidad de Zárate.' },
  { id: 'p228-64', sequence: 61, name: 'Leandro Alem y Rivadavia', lat: -34.100450, lng: -59.033680, zone: 'Zárate', description: 'Área comercial y de servicios.' },

  // Tramo 11: Zárate Centro a Terminal de Zárate
  { id: 'p228-65', sequence: 62, name: 'Florestano Andrade Atucha 173', lat: -34.098950, lng: -59.035580, zone: 'Zárate', description: 'Hacia terminal de ómnibus.' },
  { id: 'p228-66', sequence: 63, name: 'Florestano Andrade Atucha 473', lat: -34.098050, lng: -59.036480, zone: 'Zárate', description: 'Zona residencial.' },
  { id: 'p228-67', sequence: 64, name: 'Gregorio Quirno 1507', lat: -34.097250, lng: -59.037280, zone: 'Zárate', description: 'Acceso avenida Anta.' },
  { id: 'p228-68', sequence: 65, name: 'Soler y Avenida Anta', lat: -34.096450, lng: -59.037950, zone: 'Zárate', description: 'Acceso a andenes terminales.' },
  { id: 'p228-69', sequence: 66, name: 'Centro de Transferencia de Zárate (Terminal)', lat: -34.095650, lng: -59.038650, zone: 'Zárate', description: 'Terminal de Ómnibus y Centro de Transferencia Zárate.' },
];

// Corredor específico habilitado: Justo Vigalondo hasta McDonald's Campana (Panamericana Km 72.5)
export const VIGALONDO_MCDONALDS_STOPS: Linea228Stop[] = LINEA_228_STOPS.slice(0, 21);

// Corredor específico: Centro de Campana hasta Zárate Centro y Terminal
export const CAMPANA_CENTRO_ZARATE_STOPS: Linea228Stop[] = LINEA_228_STOPS.filter(
  (stop) => stop.zone === 'Campana Centro' || stop.zone === 'Ruta 6' || stop.zone === 'Zárate'
);

// Polilínea de alta fidelidad que sigue fielmente el trazado de las calles de Campana:
// Justo Vigalondo -> Puerto Argentino -> C. Chapuis -> De los Trabajadores -> Bravo -> Puerto San Carlos -> Las Campanas -> Ariel del Plata -> Colectora Sur -> McDonald's Panamericana Km 72.5
export const VIGALONDO_MCDONALDS_COORDINATES: [number, number][] = [
  [-34.211791, -58.940898], // Vigalondo 1887 (Parada #1)
  [-34.211355, -58.941215], // Vigalondo y Puerto Argentino (Parada #2)
  [-34.210888, -58.941554],
  [-34.210440, -58.941880],
  [-34.209988, -58.942204], // Vigalondo y C. Chapuis (Parada #3)
  [-34.209560, -58.942520],
  [-34.209099, -58.942855],
  [-34.208642, -58.943184], // Vigalondo y De los Trabajadores (Parada #4)
  [-34.207622, -58.943905],
  [-34.207533, -58.943970], // Vigalondo y Bravo (Parada #5)
  [-34.207138, -58.944258],
  [-34.206667, -58.944594],
  [-34.206200, -58.944931],
  [-34.205220, -58.945641],
  [-34.204705, -58.946011], // Vigalondo y Puerto San Carlos (Parada #6)
  [-34.205261, -58.947069],
  [-34.204790, -58.947401],
  [-34.204247, -58.946340],
  [-34.206034, -58.945055],
  [-34.211031, -58.939337], // Vigalondo y Miraca (Parada #7)
  [-34.210317, -58.937851], // Shinoni y Casaux (Parada #8)
  [-34.208539, -58.939095], // Casaux y Chapuis (Parada #9)
  [-34.207693, -58.939446], // H. Fremi y Casaux (Parada #10)
  [-34.207054, -58.939631], // Casaux y Goujon (Parada #11)
  [-34.205930, -58.939113], // Sociedad de Fomento Ariel del Plata (Parada #12)
  [-34.204011, -58.935267], // Galería Ariel del Plata (Parada #13)
  [-34.202119, -58.936479], // Escuela Ariel del Plata
  [-34.200625, -58.937410], // Escuela Técnica Roberto Rocca (Parada #14)
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
  [-34.192982, -58.943026], // Colectora Sur y Viale (Parada #20)
  [-34.191686, -58.944040],
  [-34.191145, -58.944410], // McDonald's y Colectora Sur (Parada #21)
];

// Trazado de alta fidelidad que conecta McDonald's / Colectora Sur -> Colectora Norte -> Casco Céntrico Campana -> RP 6 -> Av. Lavalle -> Zárate Centro -> Terminal
export const CAMPANA_A_ZARATE_SECTOR_COORDINATES: [number, number][] = [
  [-34.190204, -58.943831], // Avenida 6 de Julio y Autopista Aramburu (Parada #22)
  [-34.184870, -58.943724], // Gandhi (Parada #23)
  [-34.185935, -58.946814], // Dr. Salk y Colectora Norte (Parada #24)
  [-34.184349, -58.948380], // Colectora Norte y Necochea (Parada #25)
  [-34.181757, -58.952661], // Ricardo Rojas y Viamonte (Parada #26)
  [-34.177763, -58.960429], // Av. Rivadavia y Salmini (Parada #27)
  [-34.175748, -58.960225], // Av. Rivadavia y Perón (Parada #28)
  [-34.173724, -58.959997], // Av. Rivadavia y Bertolini (Parada #29)
  [-34.171896, -58.959825], // Escuela 5 (Parada #30)
  [-34.170032, -58.959696], // Parque Urbano (Parada #31)
  [-34.167200, -58.958291], // Belgrano y Alberdi (Parada #32)
  [-34.165309, -58.958098], // Belgrano y Jean Jaurés (Parada #33)
  [-34.163534, -58.957937], // Belgrano y Mitre (Parada #34)
  [-34.161545, -58.957711], // Belgrano y Dominicis (Parada #35)
  [-34.159814, -58.957572], // Belgrano y Becerra (Parada #36)
  [-34.157097, -58.957325], // Belgrano y Alem (Parada #37)
  [-34.156804, -58.959525], // Alem y San Martín (Parada #38)
  [-34.158278, -58.959932], // San Martín y Luis Costa (Parada #39)
  [-34.160178, -58.960115], // San Martín y Güemes (Parada #40)
  [-34.162069, -58.961448], // 25 de Mayo y Rawson (Parada #41)
  [-34.161705, -58.966670], // 25 de Mayo y Chiclana (Parada #42)
  [-34.162539, -58.968344], // Pueyrredón y Mitre (Parada #43)
  [-34.162424, -58.970285], // Balcarce y Mitre (Parada #44)
  [-34.162375, -58.977013], // Club Atlético Villa Dálmine (Parada #45)
  // Autovía Ruta Provincial 6 (Campana → Zárate)
  [-34.152605, -58.997094], // Ruta 6 y Bidegain (Parada #46)
  [-34.147215, -59.002802], // Ruta 6 y Gobernador Cafiero (Parada #47)
  [-34.145626, -59.003746], // Ruta 6 y Fernando Ochoa (Parada #48)
  [-34.136178, -59.009186], // Ruta 6 y Scholnik (Parada #49)
  [-34.123396, -59.016664], // Ruta 6 y Ruta 12 (Parada #50)
  // Avenida Lavalle (Zárate)
  [-34.118395, -59.019539], // Av. Lavalle y Perito Moreno (Parada #51)
  [-34.116255, -59.020140], // Av. Lavalle y Pitrau (Parada #52)
  [-34.110694, -59.020580], // Av. Lavalle y Larrea (Parada #53)
  [-34.109326, -59.020794], // Av. Lavalle y Dorrego (Parada #54)
  [-34.107470, -59.021299], // Av. Lavalle y Bernardo de Irigoyen (Parada #55)
  [-34.105613, -59.022490], // Av. Lavalle y Pellegrini (Parada #56)
  // Zárate Centro (Av. Mitre & Leandro Alem)
  [-34.105250, -59.027400], // Av. Mitre y Leandro Alem (Parada #57)
  [-34.104200, -59.028900],
  [-34.104050, -59.029080], // Leandro Alem y Castelli (Parada #58)
  [-34.103000, -59.030500],
  [-34.102850, -59.030680], // Leandro Alem y Rómulo Noya (Parada #59)
  [-34.101800, -59.032000],
  [-34.101650, -59.032180], // Leandro Alem e Ituzaingó (Parada #60)
  [-34.100600, -59.033500],
  [-34.100450, -59.033680], // Leandro Alem y Rivadavia (Parada #61)
  // Acceso a Terminal Zárate
  [-34.099800, -59.034600],
  [-34.099100, -59.035400],
  [-34.098950, -59.035580], // Andrade Atucha 173 (Parada #62)
  [-34.098200, -59.036300],
  [-34.098050, -59.036480], // Andrade Atucha 473 (Parada #63)
  [-34.097400, -59.037100],
  [-34.097250, -59.037280], // Gregorio Quirno 1507 (Parada #64)
  [-34.096600, -59.037800],
  [-34.096450, -59.037950], // Soler y Av. Anta (Parada #65)
  [-34.095900, -59.038400],
  [-34.095650, -59.038650], // Centro de Transferencia de Zárate (Terminal) (Parada #66)
];

// Polilínea Centro de Campana -> RP 6 -> Zárate Centro / Terminal
export const CAMPANA_CENTRO_ZARATE_COORDINATES: [number, number][] = CAMPANA_A_ZARATE_SECTOR_COORDINATES.slice(5);

// Recorrido troncal completo Zárate ↔ Malvinas
export const LINEA_228_COORDINATES: [number, number][] = [
  ...VIGALONDO_MCDONALDS_COORDINATES,
  ...CAMPANA_A_ZARATE_SECTOR_COORDINATES,
];
