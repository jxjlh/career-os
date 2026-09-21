export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
}

export interface GeoPlace {
  city?: string;
  country?: string;
  /** 具体位置（省+市+区/街道 组合后的可读地名，如「北京市朝阳区」） */
  place?: string;
  province?: string;
  district?: string;
  road?: string;
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

/** Nominatim 有速率限制（1 req/s），同一位置短时间内重复反查直接走缓存。 */
const geocodeCache = new Map<string, GeoPlace | null>();

/** 依粒度从细到粗拼接地名，去掉重复层级（如 北京市/北京市/朝阳区 → 北京市朝阳区）。 */
function buildPlaceText(parts: (string | undefined)[], maxParts = 3): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of parts) {
    const part = (raw || "").trim();
    if (!part || seen.has(part)) continue;
    // 上级名已被更细层级覆盖时跳过（如 province=北京市, city=北京市）
    if (kept.some((k) => k.includes(part))) continue;
    seen.add(part);
    kept.push(part);
    if (kept.length >= maxParts) break; // 最多保留 3 级，避免水印/卡片上过长
  }
  return kept.join("");
}

/** 带超时的 JSON 拉取：反查接口不稳定/被限流时不能把界面挂住。 */
async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 主源：OpenStreetMap Nominatim（结构化地址最细，但免费接口有限流，偶发 502） */
async function nominatimLookup(lat: number, lng: number): Promise<GeoPlace | null> {
  const data = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN`,
  );
  if (!data) return null;
  const addr: Record<string, string> = data.address || {};
  const country = addr.country || undefined;
  const province = addr.province || addr.state || addr.region || undefined;
  const city =
    addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || undefined;
  const district =
    addr.city_district || addr.district || addr.borough || addr.county || addr.suburb || undefined;
  const road = addr.road || addr.neighbourhood || addr.suburb || addr.hamlet || undefined;
  const place =
    buildPlaceText([province, city, district, road]) ||
    buildPlaceText([city, addr.suburb, country]) ||
    undefined;
  if (!place && !city && !country) return null;
  return { country, city, province, district, road, place };
}

/**
 * 备用源：BigDataCloud reverse-geocode-client（免费、无需 Key，国内可达性通常更好）。
 * 只在主源拿不到地名时启用，字段较少，够用即可。
 */
async function bigDataCloudLookup(lat: number, lng: number): Promise<GeoPlace | null> {
  const data = await fetchJsonWithTimeout(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`,
  );
  if (!data) return null;
  const admin: Array<{ name?: string; adminLevel?: number; order?: number }> =
    data.localityInfo?.administrative ?? [];
  const country = data.countryName || undefined;
  const province = data.principalSubdivision || undefined;
  const city = data.city || data.locality || undefined;
  const district =
    [...admin]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((a) => a.name)
      .filter((name): name is string => Boolean(name) && name !== city && name !== province)
      .pop() || undefined;
  const place = buildPlaceText([province, city, district]) || undefined;
  if (!place && !city && !country) return null;
  return { country, city, province, district, place };
}

/**
 * 反向地理编码: GPS → 可读地名（具体位置 / 市 / 国家）。
 * 先试 Nominatim，失败再试 BigDataCloud；两个都失败返回 null（调用方兜底，不要阻塞拍照流程）。
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace | null> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  let result = await nominatimLookup(lat, lng);
  if (!result?.place) {
    const backup = await bigDataCloudLookup(lat, lng);
    // 主源有部分字段就合并，没有就用备用源
    result = result ? { ...backup, ...result, place: result.place || backup?.place } : backup;
  }

  geocodeCache.set(cacheKey, result);
  return result;
}

/**
 * 取用于展示/记录的地名：优先具体位置，退化到 市 + 国家。
 * 都没有时返回空串（调用方自己决定兜底文案，不要硬塞经纬度）。
 */
export function formatPlace(place?: GeoPlace | null): string {
  if (!place) return "";
  if (place.place) return place.place;
  return [place.city, place.country].filter(Boolean).join(" ").trim();
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
