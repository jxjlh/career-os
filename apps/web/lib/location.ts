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

export type LocationStatus =
  | "locating"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

export interface LocationState {
  status: LocationStatus;
  location: GeoLocation | null;
  error: string | null;
}

function requestPosition(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function toGeoLocation(position: GeolocationPosition): GeoLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude ?? null,
    accuracy: position.coords.accuracy ?? null,
  };
}

function describeLocationError(error: GeolocationPositionError | null): string {
  if (!error) return "未能获取定位，请稍后重试";
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "定位权限被拒绝，请在浏览器设置中允许位置权限后重试";
    case error.POSITION_UNAVAILABLE:
      return "暂时无法获取位置信号，请到开阔地带后重试";
    case error.TIMEOUT:
      return "定位超时，请检查 GPS/网络信号后重试";
    default:
      return error.message || "定位失败，请稍后重试";
  }
}

/**
 * 获取当前 GPS 定位 (含海拔)，带状态与错误原因。
 * 先尝试高精度定位；失败或超时自动降级为标准精度，权限被拒则不重试。
 */
export async function getLocationState(): Promise<LocationState> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return {
      status: "unavailable",
      location: null,
      error: "当前环境不支持定位（需要 HTTPS 或 localhost 访问）",
    };
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
  ];
  let lastError: GeolocationPositionError | null = null;

  for (const options of attempts) {
    try {
      const position = await requestPosition(options);
      return { status: "ready", location: toGeoLocation(position), error: null };
    } catch (e) {
      lastError = e as GeolocationPositionError;
      if (lastError?.code === lastError?.PERMISSION_DENIED) break;
    }
  }

  return {
    status: lastError?.code === lastError?.PERMISSION_DENIED ? "denied" : "error",
    location: null,
    error: describeLocationError(lastError),
  };
}

/** 获取当前 GPS 定位 (含海拔). 失败或不可用返回 null. */
export async function getCurrentLocation(): Promise<GeoLocation | null> {
  const state = await getLocationState();
  return state.location;
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
    const data: { address?: Record<string, string> } = await res.json();
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
    const data: { current?: { temperature_2m: number; weather_code: number } } = await res.json();
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
