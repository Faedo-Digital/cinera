/** Constantes y lógica pura del reproductor HLS de la webcam. */

export const CAMERA_STREAM_URL =
  "https://stream.faedodigital.com/cam/index.m3u8";

export const CAMERA_STREAM_HD_URL =
  "https://stream.faedodigital.com/cam-hd/index.m3u8";

/** Stream estándar H.264 (substream Reolink). */
export const CAMERA_SD_CODECS = "avc1.640033,mp4a.40.2";

/** Stream HD H.265/HEVC (main stream 4K). */
export const CAMERA_HD_CODECS = "hvc1.1.6.L150.0,mp4a.40.2";

/** @deprecated Usar codecsForCalidad() */
export const CAMERA_KNOWN_CODECS = CAMERA_SD_CODECS;

export const CALIDAD_STORAGE_KEY = "camara-calidad";

export type CalidadCamara = "sd" | "hd";

export const HEVC_PROBE_CODEC = "hvc1.1.6.L150.0";

export const MAX_REINTENTOS = 2;
export const DELAY_REINTENTO_MS = 3000;
export const TIMEOUT_CARGA_MS = 12000;
export const TIMEOUT_PRIMER_FRAME_MS = 8000;
export const DEFERRED_IDLE_TIMEOUT_MS = 2500;

export type EstadoUi =
  | "cargando"
  | "error"
  | "video"
  | "no-soportado"
  | "fallback";

export type ErrorCamaraTipo =
  | "timeout"
  | "network"
  | "media"
  | "codec"
  | "unsupported"
  | "play"
  | "unknown";

export type CamaraAnalyticsEvent =
  | "cam_ready"
  | "cam_error"
  | "cam_fallback"
  | "cam_unsupported"
  | "cam_quality_change";

export type CamaraAnalyticsPayload = {
  mode: "hero" | "page";
  route?: string;
  ms?: number;
  type?: ErrorCamaraTipo;
  details?: string;
  reintentos?: number;
  path?: "hlsjs" | "native" | "none";
  calidad?: CalidadCamara;
};

export function parseMasterPlaylistCodecs(manifest: string): string | null {
  const match = manifest.match(/CODECS="([^"]+)"/i);
  return match?.[1] ?? null;
}

export function splitCodecs(codecs: string): string[] {
  return codecs
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function isHevcCodec(codec: string): boolean {
  const lower = codec.toLowerCase();
  return lower.startsWith("hvc1") || lower.startsWith("hev1");
}

export function classifyHlsError(input: {
  fatal?: boolean;
  type?: string;
  details?: string;
}): ErrorCamaraTipo {
  const type = (input.type ?? "").toLowerCase();
  const details = (input.details ?? "").toLowerCase();

  if (
    details.includes("codec") ||
    details.includes("bufferaddcodecerror") ||
    details.includes("manifestincompatible")
  ) {
    return "codec";
  }

  if (type.includes("network") || details.includes("network")) {
    return "network";
  }

  if (type.includes("media") || details.includes("media")) {
    return "media";
  }

  return "unknown";
}

export function shouldRetryError(
  tipo: ErrorCamaraTipo,
  reintentos: number,
  maxReintentos = MAX_REINTENTOS,
): boolean {
  if (tipo === "codec" || tipo === "unsupported" || tipo === "play") {
    return false;
  }
  return reintentos < maxReintentos;
}

export function nextRetryDelayMs(
  reintentos: number,
  base = DELAY_REINTENTO_MS,
): number {
  return base * Math.max(1, reintentos);
}

export function mseSupportsCodecs(
  codecs: string,
  isTypeSupported: ((type: string) => boolean) | undefined,
): boolean {
  if (!isTypeSupported) return false;
  const list = splitCodecs(codecs);
  if (list.length === 0) return false;

  const full = `video/mp4;codecs="${codecs}"`;
  if (isTypeSupported(full)) return true;

  const video = list.find((c) => c.startsWith("hvc1") || c.startsWith("hev1") || c.startsWith("avc1"));
  const audio = list.find((c) => c.startsWith("mp4a"));
  if (video && audio) {
    return (
      isTypeSupported(`video/mp4;codecs="${video},${audio}"`) ||
      isTypeSupported(`video/mp4;codecs="${video}"`)
    );
  }
  if (video) {
    return isTypeSupported(`video/mp4;codecs="${video}"`);
  }
  return false;
}

export function nativeSupportsCodecs(
  codecs: string,
  canPlayType: ((type: string) => string) | undefined,
): boolean {
  if (!canPlayType) return false;
  const list = splitCodecs(codecs);
  const video = list.find((c) => isHevcCodec(c) || c.startsWith("avc1"));
  if (!video) return false;
  const result = canPlayType(`video/mp4; codecs="${video}"`);
  return result === "probably" || result === "maybe";
}

export type PlaybackPath = "hlsjs" | "native" | "none";

export function choosePlaybackPath(input: {
  hlsJsSupported: boolean;
  nativeHls: boolean;
  mseCodecOk: boolean;
  nativeCodecOk: boolean;
  /** True si el manifiesto solo ofrece HEVC/H.265. */
  hevcOnly?: boolean;
}): PlaybackPath {
  if (input.hlsJsSupported && input.mseCodecOk) {
    return "hlsjs";
  }

  // Safari/iOS: HLS nativo sin MSE (o con MSE sin HEVC) suele reproducir hvc1.
  // Chrome a veces declara `maybe` para HLS nativo sin poder reproducirlo:
  // solo usamos nativo ahí si canPlayType confirma el códec, o si no hay hls.js.
  if (input.nativeHls) {
    if (input.nativeCodecOk) return "native";
    if (!input.hlsJsSupported && input.hevcOnly) return "native";
  }

  return "none";
}

export function streamUrlForCalidad(calidad: CalidadCamara): string {
  return calidad === "hd" ? CAMERA_STREAM_HD_URL : CAMERA_STREAM_URL;
}

export function codecsForCalidad(calidad: CalidadCamara): string {
  return calidad === "hd" ? CAMERA_HD_CODECS : CAMERA_SD_CODECS;
}

export function readStoredCalidad(): CalidadCamara | null {
  try {
    const value = localStorage.getItem(CALIDAD_STORAGE_KEY);
    if (value === "sd" || value === "hd") return value;
  } catch {
    // localStorage puede estar bloqueado
  }
  return null;
}

export function writeStoredCalidad(calidad: CalidadCamara): void {
  try {
    localStorage.setItem(CALIDAD_STORAGE_KEY, calidad);
  } catch {
    // ignore
  }
}

export function browserSupportsHevc(input: {
  isTypeSupported?: (type: string) => boolean;
  canPlayType?: (type: string) => string;
  userAgent?: string;
}): boolean {
  const probe = `video/mp4; codecs="${HEVC_PROBE_CODEC}"`;
  if (input.isTypeSupported?.(probe)) return true;

  if (input.canPlayType) {
    const result = input.canPlayType(probe);
    if (result === "probably" || result === "maybe") return true;

    // Safari/iOS: HLS nativo reproduce HEVC aunque canPlayType de hvc1 sea vacío.
    const nativeHls = input.canPlayType("application/vnd.apple.mpegurl");
    if (nativeHls === "probably" || nativeHls === "maybe") {
      const ua = input.userAgent ?? "";
      const esSafari =
        /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(ua);
      if (esSafari) return true;
    }
  }

  return mseSupportsCodecs(CAMERA_HD_CODECS, input.isTypeSupported);
}

/** HD por defecto cuando el navegador lo soporta; la preferencia guardada manda. */
export function resolveCalidadInicial(
  hdSupported: boolean,
  stored: CalidadCamara | null,
): CalidadCamara {
  if (!hdSupported) return "sd";
  if (stored === "sd") return "sd";
  return "hd";
}

export function choosePlaybackPathForKnownStream(input: {
  hlsJsSupported: boolean;
  nativeHls: boolean;
  isTypeSupported?: (type: string) => boolean;
  canPlayType?: (type: string) => string;
  codecs?: string;
}): PlaybackPath {
  const codecs = input.codecs ?? CAMERA_SD_CODECS;
  const parts = splitCodecs(codecs);
  const mseCodecOk = mseSupportsCodecs(codecs, input.isTypeSupported);
  const nativeCodecOk = nativeSupportsCodecs(codecs, input.canPlayType);
  const hevcOnly = parts.some(isHevcCodec) && !parts.some((c) => c.startsWith("avc1"));

  return choosePlaybackPath({
    hlsJsSupported: input.hlsJsSupported,
    nativeHls: input.nativeHls,
    mseCodecOk,
    nativeCodecOk,
    hevcOnly,
  });
}

export function formatDebugInfo(lines: Record<string, string | number | boolean>): string {
  return Object.entries(lines)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export function umamiTrack(
  event: CamaraAnalyticsEvent,
  payload: CamaraAnalyticsPayload,
  tracker: ((name: string, data?: Record<string, unknown>) => void) | undefined =
    typeof window !== "undefined"
      ? (window as Window & { umami?: { track: (n: string, d?: Record<string, unknown>) => void } }).umami?.track
      : undefined,
): void {
  if (!tracker) return;
  try {
    tracker(event, { ...payload });
  } catch {
    // Analytics nunca debe romper reproducción.
  }
}
