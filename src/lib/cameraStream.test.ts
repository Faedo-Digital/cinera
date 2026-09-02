import { describe, expect, it, vi } from "vitest";
import {
  CAMERA_HD_CODECS,
  CAMERA_SD_CODECS,
  CAMERA_STREAM_HD_URL,
  CAMERA_STREAM_URL,
  CALIDAD_STORAGE_KEY,
  choosePlaybackPath,
  choosePlaybackPathForKnownStream,
  classifyHlsError,
  codecsForCalidad,
  formatDebugInfo,
  isHevcCodec,
  parseMasterPlaylistCodecs,
  readStoredCalidad,
  resolveCalidadInicial,
  shouldRetryError,
  splitCodecs,
  streamUrlForCalidad,
  umamiTrack,
  writeStoredCalidad,
  browserSupportsHevc,
} from "./cameraStream";

describe("parseMasterPlaylistCodecs", () => {
  it("extrae CODECS del manifiesto SD", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=197755,CODECS="avc1.640033,mp4a.40.2",RESOLUTION=640x360
stream.m3u8
`;
    expect(parseMasterPlaylistCodecs(manifest)).toBe(CAMERA_SD_CODECS);
  });

  it("extrae CODECS del manifiesto HD", () => {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=6364333,CODECS="hvc1.1.6.L150.0,mp4a.40.2",RESOLUTION=3840x2160
stream.m3u8
`;
    expect(parseMasterPlaylistCodecs(manifest)).toBe(CAMERA_HD_CODECS);
  });

  it("devuelve null si no hay CODECS", () => {
    expect(parseMasterPlaylistCodecs("#EXTM3U\n")).toBeNull();
  });
});

describe("calidad / URLs", () => {
  it("resuelve URL y códecs por calidad", () => {
    expect(streamUrlForCalidad("sd")).toBe(CAMERA_STREAM_URL);
    expect(streamUrlForCalidad("hd")).toBe(CAMERA_STREAM_HD_URL);
    expect(codecsForCalidad("sd")).toBe(CAMERA_SD_CODECS);
    expect(codecsForCalidad("hd")).toBe(CAMERA_HD_CODECS);
  });

  it("resolveCalidadInicial respeta soporte HD", () => {
    expect(resolveCalidadInicial(true, "hd")).toBe("hd");
    expect(resolveCalidadInicial(false, "hd")).toBe("sd");
    expect(resolveCalidadInicial(true, null)).toBe("sd");
    expect(resolveCalidadInicial(true, "sd")).toBe("sd");
  });

  it("localStorage guarda y lee calidad", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });

    writeStoredCalidad("hd");
    expect(store[CALIDAD_STORAGE_KEY]).toBe("hd");
    expect(readStoredCalidad()).toBe("hd");

    vi.unstubAllGlobals();
  });
});

describe("browserSupportsHevc", () => {
  it("detecta HEVC vía MSE", () => {
    expect(
      browserSupportsHevc({
        isTypeSupported: (t) => t.includes("hvc1.1.6.L150.0"),
      }),
    ).toBe(true);
  });

  it("no detecta HEVC en Firefox típico", () => {
    expect(
      browserSupportsHevc({
        isTypeSupported: () => false,
        canPlayType: () => "",
        userAgent: "Mozilla/5.0 Firefox/133.0",
      }),
    ).toBe(false);
  });

  it("detecta Safari con HLS nativo", () => {
    expect(
      browserSupportsHevc({
        isTypeSupported: () => false,
        canPlayType: (t) =>
          t.includes("mpegurl") ? "maybe" : "",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15",
      }),
    ).toBe(true);
  });
});

describe("splitCodecs / isHevcCodec", () => {
  it("parte y detecta HEVC", () => {
    expect(splitCodecs(CAMERA_HD_CODECS)).toEqual([
      "hvc1.1.6.L150.0",
      "mp4a.40.2",
    ]);
    expect(isHevcCodec("hvc1.1.6.L150.0")).toBe(true);
    expect(isHevcCodec("avc1.640033")).toBe(false);
  });
});

describe("classifyHlsError / shouldRetryError", () => {
  it("clasifica codec y network", () => {
    expect(
      classifyHlsError({
        fatal: true,
        type: "mediaError",
        details: "bufferAddCodecError",
      }),
    ).toBe("codec");
    expect(
      classifyHlsError({
        fatal: true,
        type: "networkError",
        details: "manifestLoadError",
      }),
    ).toBe("network");
  });

  it("no reintenta codec/unsupported/play", () => {
    expect(shouldRetryError("codec", 0)).toBe(false);
    expect(shouldRetryError("unsupported", 0)).toBe(false);
    expect(shouldRetryError("network", 0)).toBe(true);
  });
});

describe("choosePlaybackPath", () => {
  it("prioriza hls.js cuando MSE soporta H.264 (SD)", () => {
    expect(
      choosePlaybackPathForKnownStream({
        hlsJsSupported: true,
        nativeHls: true,
        isTypeSupported: (t) => t.includes("avc1"),
        canPlayType: () => "",
        codecs: CAMERA_SD_CODECS,
      }),
    ).toBe("hlsjs");
  });

  it("Firefox reproduce SD con hls.js", () => {
    expect(
      choosePlaybackPathForKnownStream({
        hlsJsSupported: true,
        nativeHls: false,
        isTypeSupported: (t) => t.includes("avc1"),
        canPlayType: () => "",
        codecs: CAMERA_SD_CODECS,
      }),
    ).toBe("hlsjs");
  });

  it("HD HEVC sin soporte devuelve none", () => {
    expect(
      choosePlaybackPathForKnownStream({
        hlsJsSupported: true,
        nativeHls: false,
        isTypeSupported: () => false,
        canPlayType: () => "",
        codecs: CAMERA_HD_CODECS,
      }),
    ).toBe("none");
  });

  it("usa nativo en Safari sin hls.js para HEVC", () => {
    expect(
      choosePlaybackPath({
        hlsJsSupported: false,
        nativeHls: true,
        mseCodecOk: false,
        nativeCodecOk: false,
        hevcOnly: true,
      }),
    ).toBe("native");
  });
});

describe("formatDebugInfo / umamiTrack", () => {
  it("formatea líneas de debug", () => {
    expect(formatDebugInfo({ a: 1, b: "x" })).toBe("a: 1\nb: x");
  });

  it("envía cam_quality_change sin lanzar", () => {
    const track = vi.fn();
    umamiTrack("cam_quality_change", { mode: "page", calidad: "hd" }, track);
    expect(track).toHaveBeenCalledWith("cam_quality_change", {
      mode: "page",
      calidad: "hd",
    });
  });
});
