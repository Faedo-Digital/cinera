# Webcam en directo — auditoría y operación

## Qué es

La “webcam” de Cinera **no** usa la cámara del visitante (`getUserMedia`).
Es un reproductor HLS del stream remoto:

`https://stream.faedodigital.com/cam/index.m3u8`

Componentes:

| Pieza | Rol |
|-------|-----|
| [`src/components/Camera.astro`](../src/components/Camera.astro) | UI + ciclo de vida + hls.js / HLS nativo |
| [`src/lib/cameraStream.ts`](../src/lib/cameraStream.ts) | Constantes, detección de códec, reintentos, analytics |
| [`src/pages/directo.astro`](../src/pages/directo.astro) | Página `/directo` + badge sincronizado |
| [`src/components/Hero.astro`](../src/components/Hero.astro) | Home con `mode="hero"` diferido |

## Hallazgos del origen (2026-08-07)

Medición del manifiesto en vivo:

- Variante **única**: `3840×2160` @ 25 fps
- Códecs: `hvc1.1.6.L150.0,mp4a.40.2` (**HEVC/H.265 + AAC**)
- Anuncio de bitrate ~**6,3 Mbps**
- Segmentos ~2 s (~1,5 MB/seg observados)
- LL-HLS (`#EXT-X-PART`, `CAN-BLOCK-RELOAD`)
- CORS: `access-control-allow-origin: *`
- TTFB del manifiesto: ~100–200 ms (Madrid)

Implicaciones:

1. **Compatibilidad desigual**: Firefox/Edge/muchos Windows sin HEVC fallan.
2. **Ancho de banda**: conexiones móviles o ADSL lentas tardan o se quedan en buffering.
3. **Sin ABR**: no hay ladder H.264 720p/1080p; el cliente no puede “bajar calidad”.
4. El origen a veces publica `#EXT-X-GAP` al reiniciar el encoder (arranque en frío).

## Causas de “se queda cargando” (antes de estabilizar)

1. Cadena de hasta ~4×15 s + pausas de reintento (~minuto de spinner).
2. Éxito declarado en `MANIFEST_PARSED` sin confirmar primer frame / `play()`.
3. Códec incompatible: hls.js entraba igual y esperaba timeouts.
4. View Transitions (`ClientRouter`): timers/HLS sin cleanup al navegar; script sin remount fiable.
5. Badge “En directo” siempre visible aunque el stream estuviera en error.
6. Hero diferido con `opacity: 0` (hasta 2,5 s sin feedback visual del stream).

## Correcciones aplicadas en el cliente

- Ciclo de vida con `astro:page-load` / `astro:before-swap`.
- Token de sesión + abort de listeners para evitar carreras.
- Listo solo tras evidencia de reproducción (`playing` / datos + `play()`).
- Detección previa de soporte HEVC → fallo rápido “no compatible”.
- Menos reintentos (2), timeouts más cortos, sin reintentar codec/unsupported.
- Progreso de carga visible; mensajes de error distintos.
- Badge de `/directo` sincronizado con `camara:estado`.
- Telemetría Umami: `cam_ready`, `cam_error`, `cam_fallback`, `cam_unsupported`.
- Debug: `/directo?debugCam=1` (códec MSE/nativo, path, tiempos, log).

## Limitación que el frontend no puede resolver

Hace falta una **salida HLS adaptativa** en el servidor de vídeo, por ejemplo:

| Variante | Códec | Resolución | Bitrate orientativo |
|----------|-------|------------|---------------------|
| high | HEVC o H.264 | 1080p–4K | 4–8 Mbps |
| mid | **H.264 / avc1** | 720p–1080p | 1,5–3 Mbps |
| low | **H.264 / avc1** | 360p–480p | 0,5–1 Mbps |

Sin al menos una variante **H.264 + AAC**, una parte relevante de navegadores seguirá sin poder ver el directo, aunque el reproductor falle rápido y con un mensaje claro.

## Operación recomendada

1. Healthcheck periódico del `.m3u8` (HTTP 200 + presencia de segmentos no-GAP).
2. Alerta si solo hay gaps o si el bitrate/resolución cambia a un códec no anunciado.
3. Revisar en Umami la ratio `cam_unsupported` / `cam_error` vs `cam_ready` por navegador.
4. Probar manualmente: Safari iOS, Chrome macOS/Windows, Firefox, Android Chrome.

## Cómo depurar

```text
https://cinera.es/directo?debugCam=1
```

En DevTools → Network: filtrar `m3u8` y `mp4`.
Bloquear `stream.faedodigital.com` para forzar el flujo de error/reintento.
