export const MAP_CONFIG = {
  API_KEY: '0a49b2d34b5b7e8b65a6bd7da25e4bd8',
  PROVIDERS: {
    // OpenWeatherMap precipitation & weather radar layers using the 32-char hex API key
    WEATHER_RAIN: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=0a49b2d34b5b7e8b65a6bd7da25e4bd8',
    WEATHER_CLOUDS: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=0a49b2d34b5b7e8b65a6bd7da25e4bd8',
    
    // LocationIQ tile endpoint with the API key
    LOCATIONIQ_DARK: 'https://tiles.locationiq.com/v3/dark/r/{z}/{x}/{y}.png?key=0a49b2d34b5b7e8b65a6bd7da25e4bd8',
    LOCATIONIQ_STREETS: 'https://tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=0a49b2d34b5b7e8b65a6bd7da25e4bd8',
    
    // Primary ultra-reliable high-contrast dark cartography
    CARTO_DARK: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    OPENSTREETMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  DEFAULT_CENTER: [-34.152, -58.985] as [number, number],
  CORRIDOR_BOUNDS: {
    ZARATE: { lat: -34.1023, lng: -59.0354, name: 'Zárate Centro / Terminal' },
    CAMPANA: { lat: -34.1683, lng: -58.9592, name: 'Campana Centro (Plaza Eduardo Costa)' },
    MALVINAS: { lat: -34.1950, lng: -58.9720, name: 'Barrio Malvinas (Cabecera)' },
  }
};
