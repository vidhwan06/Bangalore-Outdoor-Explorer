// Weather abstraction
// Allows switching between OpenWeather, WeatherAPI, etc.

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  temperature: number; // Celsius
  feelsLike: number; // Celsius
  humidity: number; // Percentage
  pressure: number; // hPa
  windSpeed: number; // m/s
  windDirection: number; // Degrees
  windGust?: number; // m/s
  cloudCover: number; // Percentage
  visibility: number; // Meters
  uvIndex: number;
  condition: WeatherCondition;
  description: string;
  icon: string;
  timestamp: Date;
  sunrise: Date;
  sunset: Date;
}

export interface WeatherForecast {
  date: Date;
  temperature: {
    min: number;
    max: number;
    morning: number;
    day: number;
    evening: number;
    night: number;
  };
  feelsLike: {
    morning: number;
    day: number;
    evening: number;
    night: number;
  };
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  cloudCover: number;
  precipitationProbability: number;
  precipitationVolume?: number; // mm
  condition: WeatherCondition;
  description: string;
  icon: string;
  sunrise: Date;
  sunset: Date;
}

export interface HourlyForecast {
  timestamp: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  cloudCover: number;
  precipitationProbability: number;
  precipitationVolume?: number;
  condition: WeatherCondition;
  description: string;
  icon: string;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  urgency: 'immediate' | 'expected' | 'future' | 'past';
  certainty: 'observed' | 'likely' | 'possible' | 'unlikely';
  description: string;
  instruction?: string;
  effective: Date;
  expires: Date;
  areas: string[];
}

export type WeatherCondition =
  | 'clear'
  | 'few_clouds'
  | 'scattered_clouds'
  | 'broken_clouds'
  | 'overcast'
  | 'light_rain'
  | 'moderate_rain'
  | 'heavy_rain'
  | 'light_snow'
  | 'moderate_snow'
  | 'heavy_snow'
  | 'thunderstorm'
  | 'drizzle'
  | 'mist'
  | 'fog'
  | 'haze'
  | 'dust'
  | 'sand'
  | 'smoke'
  | 'tornado';

export interface WeatherSnapshot {
  location: WeatherCoordinates;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: WeatherForecast[];
  alerts: WeatherAlert[];
  fetchedAt: Date;
  source: string;
}

export interface WeatherProvider {
  name: string;

  // Current weather
  getCurrentWeather(coordinates: WeatherCoordinates): Promise<CurrentWeather>;

  // Forecasts
  getHourlyForecast(coordinates: WeatherCoordinates, hours?: number): Promise<HourlyForecast[]>;
  getDailyForecast(coordinates: WeatherCoordinates, days?: number): Promise<WeatherForecast[]>;

  // Full snapshot
  getWeatherSnapshot(coordinates: WeatherCoordinates): Promise<WeatherSnapshot>;

  // Alerts
  getAlerts(coordinates: WeatherCoordinates): Promise<WeatherAlert[]>;

  // Historical (if supported)
  getHistoricalWeather?(coordinates: WeatherCoordinates, date: Date): Promise<CurrentWeather>;

  // Batch requests
  getMultipleCurrentWeather?(coordinates: WeatherCoordinates[]): Promise<CurrentWeather[]>;
}

export interface WeatherProviderConfig {
  apiKey: string;
  baseUrl?: string;
  units?: 'metric' | 'imperial';
  language?: string;
  timeout?: number;
}

export type WeatherProviderType = 'openweather' | 'weatherapi' | 'metno' | 'visual-crossing';

export interface WeatherProviderFactory {
  create(config: WeatherProviderConfig): Promise<WeatherProvider>;
  getName(): WeatherProviderType;
}

// Condition mapping for outdoor activities
export const WEATHER_CONDITION_OUTDOOR_SUITABILITY: Record<
  WeatherCondition,
  {
    suitability: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
    description: string;
    precautions: string[];
  }
> = {
  clear: {
    suitability: 'excellent',
    description: 'Perfect conditions for outdoor activities',
    precautions: ['UV protection', 'Stay hydrated'],
  },
  few_clouds: {
    suitability: 'excellent',
    description: 'Excellent conditions with some cloud cover',
    precautions: ['UV protection'],
  },
  scattered_clouds: {
    suitability: 'good',
    description: 'Good conditions, partly cloudy',
    precautions: [],
  },
  broken_clouds: {
    suitability: 'good',
    description: 'Mostly cloudy but dry',
    precautions: ['Carry light rain jacket'],
  },
  overcast: {
    suitability: 'fair',
    description: 'Overcast, possible light precipitation',
    precautions: ['Carry rain gear', 'Check trail conditions'],
  },
  light_rain: {
    suitability: 'fair',
    description: 'Light rain, trails may be slippery',
    precautions: ['Waterproof gear', 'Non-slip footwear', 'Check for flash floods'],
  },
  moderate_rain: {
    suitability: 'poor',
    description: 'Moderate rain, trails likely slippery/muddy',
    precautions: ['Waterproof gear', 'Avoid exposed ridges', 'Check river crossings'],
  },
  heavy_rain: {
    suitability: 'dangerous',
    description: 'Heavy rain, high risk of flash floods and landslides',
    precautions: ['AVOID outdoor activities', 'Seek shelter', 'Monitor alerts'],
  },
  light_snow: {
    suitability: 'fair',
    description: 'Light snow, cold conditions',
    precautions: ['Warm layers', 'Traction devices', 'Navigation skills'],
  },
  moderate_snow: {
    suitability: 'poor',
    description: 'Moderate snow, reduced visibility',
    precautions: ['Winter gear', 'Avalanche awareness', 'Navigation skills'],
  },
  heavy_snow: {
    suitability: 'dangerous',
    description: 'Heavy snow, dangerous conditions',
    precautions: ['AVOID outdoor activities', 'Avalanche risk', 'Whiteout conditions'],
  },
  thunderstorm: {
    suitability: 'dangerous',
    description: 'Thunderstorms, lightning risk',
    precautions: ['AVOID outdoor activities', 'Seek substantial shelter', 'Avoid high ground'],
  },
  drizzle: {
    suitability: 'good',
    description: 'Light drizzle, generally manageable',
    precautions: ['Light rain jacket'],
  },
  mist: {
    suitability: 'fair',
    description: 'Misty conditions, reduced visibility',
    precautions: ['Navigation aids', 'High-visibility clothing'],
  },
  fog: {
    suitability: 'poor',
    description: 'Dense fog, very low visibility',
    precautions: ['AVOID navigation-dependent activities', 'GPS/compass required'],
  },
  haze: {
    suitability: 'fair',
    description: 'Hazy conditions, reduced air quality',
    precautions: ['Mask if sensitive', 'Limit exertion'],
  },
  dust: {
    suitability: 'poor',
    description: 'Dusty conditions, poor air quality',
    precautions: ['Mask recommended', 'Eye protection', 'Limit exertion'],
  },
  sand: {
    suitability: 'poor',
    description: 'Sandstorm conditions',
    precautions: ['AVOID outdoor activities', 'Eye and respiratory protection'],
  },
  smoke: {
    suitability: 'poor',
    description: 'Smoke conditions, poor air quality',
    precautions: ['N95 mask', 'Limit exertion', 'Monitor air quality'],
  },
  tornado: {
    suitability: 'dangerous',
    description: 'Tornado warning - EXTREME DANGER',
    precautions: ['SEEK SHELTER IMMEDIATELY', 'AVOID all outdoor activities'],
  },
};

export function getOutdoorSuitability(condition: WeatherCondition): {
  suitability: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
  description: string;
  precautions: string[];
} {
  return (
    WEATHER_CONDITION_OUTDOOR_SUITABILITY[condition] || {
      suitability: 'fair',
      description: 'Unknown condition, exercise caution',
      precautions: ['Check local conditions'],
    }
  );
}
