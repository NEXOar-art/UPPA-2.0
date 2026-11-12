import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  AlertTriangle,
  Car,
  Bike,
  Clock,
  TrendingUp,
  RefreshCw,
  Zap,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  ReporteFirestore,
  HabilitacionChofer,
  UsuarioFirestore,
  MapEvent,
  TaxiListing,
  SolicitudTransporteFirestore,
} from '../../types';

interface AdminRealtimeChartsProps {
  reportes: ReporteFirestore[];
  habilitaciones: HabilitacionChofer[];
  usuarios: UsuarioFirestore[];
  events: MapEvent[];
  taxis: TaxiListing[];
  solicitudes?: SolicitudTransporteFirestore[];
}

const COLORS = {
  yellow: '#FFF19A',
  green: '#B7F36B',
  white: '#FFFFFF',
  muted: '#9299A5',
  rose: '#F87171',
  blue: '#60A5FA',
};

const PIE_COLORS = ['#FFF19A', '#F87171', '#FFFFFF', '#B7F36B', '#9299A5'];

export const AdminRealtimeCharts: React.FC<AdminRealtimeChartsProps> = ({
  reportes,
  habilitaciones,
  usuarios,
  events,
  taxis,
  solicitudes = [],
}) => {
  const [timeWindow, setTimeWindow] = useState<'24h' | 'pico' | 'ultimas12'>('24h');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const parseTimestamp = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  };

  // 1. Reportes de Tráfico por Hora (100% desde Firestore reportes + eventos del mapa)
  const trafficByHourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hora: `${String(i).padStart(2, '0')}:00`,
      horaNum: i,
      congestion: 0,
      accidentes: 0,
      controles: 0,
      totalReportes: 0,
    }));

    reportes.forEach((rep) => {
      const timeMs = parseTimestamp(rep.creadoEn);
      if (timeMs > 0) {
        const hIndex = new Date(timeMs).getHours();
        if (hIndex >= 0 && hIndex < 24) {
          if (rep.tipo === 'demora' || rep.tipo === 'congestion') {
            hours[hIndex].congestion += 1;
          } else if (rep.tipo === 'accidente' || rep.tipo === 'corte') {
            hours[hIndex].accidentes += 1;
          } else {
            hours[hIndex].controles += 1;
          }
          hours[hIndex].totalReportes += 1;
        }
      }
    });

    events.forEach((ev) => {
      const timeMs = parseTimestamp(ev.reportedAt);
      if (timeMs > 0) {
        const hIndex = new Date(timeMs).getHours();
        if (hIndex >= 0 && hIndex < 24) {
          if (ev.type === 'late' || ev.type === 'traffic' || ev.type === 'breakdown') {
            hours[hIndex].congestion += 1;
          } else if (ev.type === 'accident') {
            hours[hIndex].accidentes += 1;
          } else {
            hours[hIndex].controles += 1;
          }
          hours[hIndex].totalReportes += 1;
        }
      }
    });

    if (timeWindow === 'pico') {
      return hours.filter((h) => (h.horaNum >= 6 && h.horaNum <= 10) || (h.horaNum >= 16 && h.horaNum <= 21));
    }
    if (timeWindow === 'ultimas12') {
      const currentHour = new Date().getHours();
      return hours.filter((h) => (currentHour - h.horaNum + 24) % 24 <= 12);
    }

    return hours;
  }, [reportes, events, timeWindow]);

  // 2. Actividad real de conductores y demanda real de solicitudes por hora
  const driverActivityData = useMemo(() => {
    const now = Date.now();
    const activeHabs = habilitaciones.filter((h) => h.estado === 'activo' && (!h.endsAt || h.endsAt > now));
    const currentAutos = Math.max(
      activeHabs.filter((h) => h.vehicleType === 'auto').length,
      taxis.filter((t) => t.vehicleType === 'auto').length
    );
    const currentMotos = Math.max(
      activeHabs.filter((h) => h.vehicleType === 'moto').length,
      taxis.filter((t) => t.vehicleType === 'moto').length
    );

    const requestsByHour = Array.from({ length: 24 }, () => 0);
    solicitudes.forEach((sol) => {
      const ms = parseTimestamp(sol.fechaSolicitud);
      if (ms > 0) {
        const h = new Date(ms).getHours();
        if (h >= 0 && h < 24) requestsByHour[h] += 1;
      }
    });

    const currentHour = new Date().getHours();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const autos = i === currentHour ? currentAutos : activeHabs.filter((h) => {
        const createdH = parseTimestamp(h.createdAt);
        return h.vehicleType === 'auto' && createdH > 0 && new Date(createdH).getHours() <= i;
      }).length;
      const motos = i === currentHour ? currentMotos : activeHabs.filter((h) => {
        const createdH = parseTimestamp(h.createdAt);
        return h.vehicleType === 'moto' && createdH > 0 && new Date(createdH).getHours() <= i;
      }).length;

      return {
        hora: `${String(i).padStart(2, '0')}:00`,
        horaNum: i,
        autos,
        motos,
        totalConductores: autos + motos,
        demandaViajes: requestsByHour[i],
      };
    });

    if (timeWindow === 'pico') {
      return hours.filter((h) => (h.horaNum >= 6 && h.horaNum <= 10) || (h.horaNum >= 16 && h.horaNum <= 21));
    }
    if (timeWindow === 'ultimas12') {
      return hours.filter((h) => (currentHour - h.horaNum + 24) % 24 <= 12);
    }

    return hours;
  }, [habilitaciones, taxis, solicitudes, timeWindow]);

  // 3. Distribución real de incidentes
  const incidentDistributionData = useMemo(() => {
    let congestiones = 0;
    let accidentes = 0;
    let cortes = 0;
    let controles = 0;
    let clima = 0;

    reportes.forEach((r) => {
      if (r.tipo === 'demora' || r.tipo === 'congestion') congestiones++;
      else if (r.tipo === 'accidente') accidentes++;
      else if (r.tipo === 'corte') cortes++;
      else if (r.tipo === 'control') controles++;
      else clima++;
    });

    events.forEach((e) => {
      if (e.type === 'late' || e.type === 'traffic' || e.type === 'breakdown') congestiones++;
      else if (e.type === 'accident') accidentes++;
      else if (e.type === 'corte' || e.type === 'danger') cortes++;
      else if (e.type === 'control') controles++;
      else clima++;
    });

    return [
      { name: 'Congestión / Demora', value: congestiones },
      { name: 'Accidentes de Tránsito', value: accidentes },
      { name: 'Cortes / Desvíos', value: cortes },
      { name: 'Controles Policiales', value: controles },
      { name: 'Otras Incidencias', value: clima },
    ];
  }, [reportes, events]);

  // 4. Estadísticas Reales de Cabecera
  const stats = useMemo(() => {
    const now = Date.now();
    const totalIncidentes = trafficByHourData.reduce((acc, curr) => acc + curr.totalReportes, 0);
    const maxHour = [...trafficByHourData].sort((a, b) => b.totalReportes - a.totalReportes)[0];

    const activeHabs = habilitaciones.filter((h) => h.estado === 'activo' && (!h.endsAt || h.endsAt > now));
    const activeAutosCount = Math.max(
      activeHabs.filter((h) => h.vehicleType === 'auto').length,
      taxis.filter((t) => t.vehicleType === 'auto').length
    );
    const activeMotosCount = Math.max(
      activeHabs.filter((h) => h.vehicleType === 'moto').length,
      taxis.filter((t) => t.vehicleType === 'moto').length
    );
    const conductoresOnline = activeAutosCount + activeMotosCount;
    const choferesRegistrados = usuarios.filter((u) => u.esChofer || u.rol?.includes('chofer')).length;

    const acceptedOrDone = solicitudes.filter((s) => s.estado === 'aceptado' || s.estado === 'completado').length;
    const tasaCobertura =
      solicitudes.length > 0 ? `${Math.round((acceptedOrDone / solicitudes.length) * 100)}%` : 'Sin solicitudes';

    return {
      totalIncidentes,
      horaPico: maxHour && maxHour.totalReportes > 0 ? `${maxHour.hora} (${maxHour.totalReportes})` : 'Sin pico aún',
      conductoresOnline,
      activeAutosCount,
      activeMotosCount,
      choferesTotales: Math.max(choferesRegistrados, activeHabs.length),
      tasaCobertura,
      solicitudesTotales: solicitudes.length,
    };
  }, [trafficByHourData, habilitaciones, taxis, usuarios, solicitudes]);

  const handleRefresh = () => {
    setLastRefreshed(new Date());
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#101114] p-3.5 rounded-xl border-2 border-white/20 shadow-[4px_4px_0px_#000000] text-xs space-y-1.5 min-w-[170px]">
          <div className="flex items-center gap-1.5 font-black text-white border-b border-white/10 pb-1">
            <Clock className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span>Franja: {label}</span>
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header y Controles */}
      <div className="p-4 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#101114] border border-[#FFF19A]/45 text-[#FFF19A] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                <span>Telemetría y Métricas en Tiempo Real</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/45">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B7F36B] animate-ping" />
                  <span>EN VIVO</span>
                </span>
              </h3>
              <p className="text-xs text-[#9299A5]">
                Monitoreo real del corredor vial Zárate - Campana y flota conectada a Firestore
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <div className="bg-[#101114] p-1 rounded-xl border border-white/15 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTimeWindow('24h')}
              title="Ver métricas completas de 24 horas"
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                timeWindow === '24h' ? 'bg-[#FFF19A] text-[#101114]' : 'text-[#9299A5] hover:text-white'
              }`}
            >
              24 Horas
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('pico')}
              title="Filtrar por franjas horarias pico"
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                timeWindow === 'pico' ? 'bg-[#FFF19A] text-[#101114]' : 'text-[#9299A5] hover:text-white'
              }`}
            >
              Horas Pico
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('ultimas12')}
              title="Ver únicamente las últimas 12 horas"
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                timeWindow === 'ultimas12' ? 'bg-[#FFF19A] text-[#101114]' : 'text-[#9299A5] hover:text-white'
              }`}
            >
              Últimas 12h
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 min-h-[38px] rounded-xl bg-[#101114] hover:bg-white/10 text-white border border-white/15 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Refrescar hora de sincronización de métricas"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#FFF19A]" />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#9299A5] uppercase tracking-wider">Reportes Tráfico</span>
            <AlertTriangle className="w-4 h-4 text-[#FFF19A]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#FFF19A] font-mono">{stats.totalIncidentes}</span>
            <span className="text-[10px] text-[#B7F36B] font-bold">Reales</span>
          </div>
          <span className="text-[10px] text-[#9299A5] block truncate">Demoras, cortes y siniestros</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#9299A5] uppercase tracking-wider">Conductores Online</span>
            <div className="flex items-center gap-1 text-[#B7F36B]">
              <Car className="w-3.5 h-3.5" />
              <Bike className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#B7F36B] font-mono">{stats.conductoresOnline}</span>
            <span className="text-[10px] text-white font-bold">Autos & Motos</span>
          </div>
          <span className="text-[10px] text-[#9299A5] block truncate">{stats.choferesTotales} choferes registrados</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#9299A5] uppercase tracking-wider">Hora Mayor Demanda</span>
            <Clock className="w-4 h-4 text-[#FFF19A]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-white font-mono truncate">{stats.horaPico}</span>
          </div>
          <span className="text-[10px] text-[#9299A5] block truncate">Corredor Panamericana / Colectora</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#202329] border-2 border-white/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#9299A5] uppercase tracking-wider">Tasa de Cobertura</span>
            <CheckCircle2 className="w-4 h-4 text-[#B7F36B]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-[#B7F36B] font-mono truncate">{stats.tasaCobertura}</span>
          </div>
          <span className="text-[10px] text-[#9299A5] block truncate">Sobre {stats.solicitudesTotales} solicitudes</span>
        </div>
      </div>

      {/* GRÁFICO 1 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#000000] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FFF19A]" />
              <span>Cantidad de Reportes de Tráfico por Hora</span>
            </h4>
            <p className="text-xs text-[#9299A5]">
              Evolución horaria real de demoras, accidentes viales y controles en Campana - Zárate
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FFF19A]" />
              <span className="text-white text-[11px]">Congestión</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#F87171]" />
              <span className="text-white text-[11px]">Accidentes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#B7F36B]" />
              <span className="text-white text-[11px]">Controles</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficByHourData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCongestion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.yellow} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={COLORS.yellow} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorAccidentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.rose} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={COLORS.rose} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorControles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="hora" stroke="#9299A5" fontSize={11} tickLine={false} />
              <YAxis stroke="#9299A5" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="congestion"
                name="Congestión"
                stroke={COLORS.yellow}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCongestion)"
              />
              <Area
                type="monotone"
                dataKey="accidentes"
                name="Accidentes"
                stroke={COLORS.rose}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAccidentes)"
              />
              <Area
                type="monotone"
                dataKey="controles"
                name="Controles"
                stroke={COLORS.green}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorControles)"
              />
              <Line
                type="monotone"
                dataKey="totalReportes"
                name="Total Reportes"
                stroke={COLORS.white}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS.white }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO 2 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#000000] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-[#FFF19A]" />
              <span>Actividad de Conductores y Demanda de Viajes</span>
            </h4>
            <p className="text-xs text-[#9299A5]">
              Disponibilidad real de Taxi Auto y Taxi Moto frente a solicitudes de viaje registradas
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FFF19A]" />
              <span className="text-white text-[11px]">Taxi Auto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#B7F36B]" />
              <span className="text-white text-[11px]">Taxi Moto</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-white inline-block" />
              <span className="text-white text-[11px]">Solicitudes</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={driverActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="hora" stroke="#9299A5" fontSize={11} tickLine={false} />
              <YAxis stroke="#9299A5" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="autos" name="Taxi Auto" fill={COLORS.yellow} radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="motos" name="Taxi Moto" fill={COLORS.green} radius={[4, 4, 0, 0]} stackId="a" />
              <Line
                type="monotone"
                dataKey="demandaViajes"
                name="Solicitudes Reales"
                stroke={COLORS.white}
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: COLORS.white }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRÁFICO 3 + Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#000000] space-y-3">
          <div className="border-b border-white/10 pb-2.5">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-[#F87171]" />
              <span>Distribución de Incidentes Viales</span>
            </h4>
            <p className="text-[11px] text-[#9299A5]">Proporción real por tipo de reporte en el mapa</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incidentDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {incidentDistributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} reportes`, name]}
                  contentStyle={{
                    backgroundColor: '#101114',
                    borderRadius: '12px',
                    borderColor: 'rgba(255,255,255,0.2)',
                    fontSize: '11px',
                    color: '#FFFFFF',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-[#9299A5] text-[11px]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#202329] border-2 border-white/15 shadow-[4px_4px_0px_#000000] space-y-3 flex flex-col justify-between">
          <div>
            <div className="border-b border-white/10 pb-2.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#FFF19A]" />
                <span>Estado Operativo de la Flota UPPA</span>
              </h4>
              <p className="text-[11px] text-[#9299A5]">Conteos directos de Firestore en tiempo real</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="p-3 rounded-xl bg-[#101114] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#9299A5] uppercase font-bold">Taxis Auto Habilitados</span>
                <span className="text-lg font-black text-[#FFF19A] block font-mono">
                  {stats.activeAutosCount}
                </span>
                <span className="text-[10px] text-[#9299A5]">Activos ahora</span>
              </div>
              <div className="p-3 rounded-xl bg-[#101114] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#9299A5] uppercase font-bold">Taxis Moto Habilitados</span>
                <span className="text-lg font-black text-[#B7F36B] block font-mono">
                  {stats.activeMotosCount}
                </span>
                <span className="text-[10px] text-[#9299A5]">Activos ahora</span>
              </div>
              <div className="p-3 rounded-xl bg-[#101114] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#9299A5] uppercase font-bold">Viajes Solicitados</span>
                <span className="text-lg font-black text-white block font-mono">{stats.solicitudesTotales}</span>
                <span className="text-[10px] text-[#9299A5]">Total registrados</span>
              </div>
              <div className="p-3 rounded-xl bg-[#101114] border border-white/10 space-y-1">
                <span className="text-[10px] text-[#9299A5] uppercase font-bold">Usuarios Registrados</span>
                <span className="text-lg font-black text-[#FFF19A] block font-mono">{usuarios.length}</span>
                <span className="text-[10px] text-[#9299A5]">En base Firestore</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#101114] border border-[#B7F36B]/35 text-xs text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#B7F36B] animate-ping" />
              <span>Sincronización continua de datos vía Firestore</span>
            </span>
            <span className="font-mono text-[11px] text-[#B7F36B] font-bold">
              {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
