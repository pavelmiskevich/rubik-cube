"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraProblem, cameraSupport, problemOf } from "./capturePlan";
import { PixelImage, guideSquare } from "./sampling";

export type CameraStatus = "idle" | "starting" | "live" | "problem";

/** Больше этого кадр не нужен: цвет берётся медианой, а не из деталей. */
const MAX_FRAME = 480;

/**
 * Поток с камеры: включить, выключить, взять кадр под сеткой.
 *
 * Камера — чувствительное разрешение, и индикатор на телефоне должен гаснуть,
 * как только она не нужна. Поэтому поток останавливается везде, где экран
 * перестаёт им пользоваться: по кнопке, при уходе со страницы, при скрытии
 * страницы в кеш истории и если разрешение пришло, когда его уже не ждали.
 * Кадры никуда не уходят: `grab` возвращает пиксели вызывающему, и только.
 */
export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /*
    Номер попытки. Пока браузер спрашивает разрешение, человек может уйти со
    страницы или нажать «Отмена»; поток, пришедший к устаревшей попытке,
    сразу останавливается — иначе камера осталась бы включённой без экрана.
  */
  const attemptRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [problem, setProblem] = useState<CameraProblem | null>(null);

  const release = useCallback(() => {
    attemptRef.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const fail = useCallback(
    (reason: CameraProblem) => {
      release();
      setProblem(reason);
      setStatus("problem");
    },
    [release]
  );

  const stop = useCallback(() => {
    release();
    setProblem(null);
    setStatus("idle");
  }, [release]);

  const start = useCallback(async () => {
    const unavailable = cameraSupport({
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    });
    if (unavailable) {
      fail(unavailable);
      return;
    }

    release();
    const attempt = attemptRef.current;
    setProblem(null);
    setStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // Задняя камера телефона; на ноутбуке её нет, и браузер даст какую есть.
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (streamRef.current === stream) fail("ended");
        });
      });
      setStatus("live");
    } catch (error) {
      if (attempt === attemptRef.current) fail(problemOf(error));
    }
  }, [fail, release]);

  // Видео появляется в разметке вместе с состоянием «идёт съёмка».
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (status !== "live" || !video || !stream || video.srcObject === stream) return;

    video.srcObject = stream;
    video.play().catch(() => {
      // Без звука и inline браузеры играют сами; если нет — кадр всё равно придёт.
    });
  }, [status]);

  // Ушли со страницы — камеру выключить.
  useEffect(() => release, [release]);

  // Страницу убрали в кеш истории: камера не должна работать за закрытой вкладкой.
  useEffect(() => {
    const onPageHide = () => {
      if (streamRef.current) fail("ended");
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [fail]);

  /** Пиксели квадрата под сеткой; `null`, если кадра ещё нет. */
  const grab = useCallback((): PixelImage | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const { x, y, size } = guideSquare(video.videoWidth, video.videoHeight);
    const side = Math.min(size, MAX_FRAME);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    context.drawImage(video, x, y, size, size, 0, 0, side, side);
    return context.getImageData(0, 0, side, side);
  }, []);

  return { videoRef, status, problem, start, stop, grab };
}
