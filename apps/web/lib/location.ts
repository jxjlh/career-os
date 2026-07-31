export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
}

export interface GeoPlace {
  city?: string;
  country?: string;
}

export interface WeatherInfo {
  weather: string;
  temperature: number;
}

/** 获取当前 GPS 定位 (含海拔). 失败或不可用返回 null. */
export async function getCurrentLocation(): Promise<GeoLocation | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return null;
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      });
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude ?? null,
      accuracy: position.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * 通过 OpenStreetMap Nominatim 反向地理编码, 将 GPS 转为 城市/国家.
 * 失败返回 null; 该接口公开免费但有限流, 失败时不应阻塞拍照流程.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    return {
      city: addr.city || addr.town || addr.village || addr.county || addr.state || undefined,
      country: addr.country || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 通过 Open-Meteo 获取当前天气 (免 API Key). 失败返回 null.
 * 不应阻塞拍照流程; 失败时水印与记录留空即可.
 */
export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherInfo | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;
    return {
      temperature: Math.round(current.temperature_2m),
      weather: weatherCodeToText(current.weather_code),
    };
  } catch {
    return null;
  }
}

/** WMO weather code → 中文描述 (Open-Meteo 使用 WMO 标准). */
function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: "晴",
    1: "晴间多云",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    56: "冻雨",
    57: "冻雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "阵雨",
    82: "暴雨",
    85: "阵雪",
    86: "阵雪",
    95: "雷阵雨",
    96: "雷阵雨伴冰雹",
    99: "雷阵雨伴冰雹",
  };
  return map[code] ?? "未知";
}

export function formatGps(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
