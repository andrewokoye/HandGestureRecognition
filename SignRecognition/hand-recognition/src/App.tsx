import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [currentGesture, setCurrentGesture] = useState("Fist");
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // Gesture helpers (fully typed)
  // -----------------------------
  const isPalmOpen = (lm: NormalizedLandmark[]): boolean => {
    const fingers = [
      { tip: 8, pip: 6 },
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 },
    ];

    let extended = 0;

    fingers.forEach(({ tip, pip }) => {
      if (lm[tip].y < lm[pip].y) extended++;
    });

    if (lm[4].x < lm[3].x) extended++; // thumb

    return extended >= 4;
  };

  const isWritingPose = (lm: NormalizedLandmark[]): boolean =>
    lm[8].y < lm[6].y &&
    lm[12].y > lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y;

  const isTwoFingersUp = (lm: NormalizedLandmark[]): boolean =>
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y;

  // -----------------------------
  // Main effect
  // -----------------------------
  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrame: number;

    const init = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      console.log("videoRef:", video);
      console.log("canvasRef:", canvas);

      if (!video || !canvas) {
        console.warn("Refs not ready yet");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctxRef.current = ctx;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "hand_landmarker.task",
      },
      numHands: 1,
      runningMode: "VIDEO",
    });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.play();

      animationFrame = requestAnimationFrame(loop);

    // Delay init so refs exist
    setTimeout(() => init(), 0);

      setLoading(false);
      animationFrame = requestAnimationFrame(loop);
    };

    const drawLandmarks = (
      ctx: CanvasRenderingContext2D,
      landmarks: NormalizedLandmark[],
      width: number,
      height: number
    ) => {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "red";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;

      // Draw points
      for (const lm of landmarks) {
        const x = (1 - lm.x) * width;
        const y = lm.y * height;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      if (!video || !canvas || !ctx || !handLandmarker) {
        animationFrame = requestAnimationFrame(loop);
        return;
      }

      if (video.readyState < 2) {
        animationFrame = requestAnimationFrame(loop);
        return;
      }

      const results = handLandmarker.detectForVideo(video, performance.now());

      let gesture = "Fist";

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0];

        if (isTwoFingersUp(hand)) gesture = "Two Fingers Up";
        else if (isWritingPose(hand)) gesture = "Point";
        else if (isPalmOpen(hand)) gesture = "Palm";

        setCurrentGesture(gesture);

        //draw landmarks
        drawLandmarks(ctx, hand, canvas.width, canvas.height);
      }

      animationFrame = requestAnimationFrame(loop);
    };

    init();

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline width={900} height={480} />
      <canvas ref={canvasRef} width={900} height={480} />
      {loading && <div>Loading hand tracker…</div>}

      <div>{currentGesture}</div>
    </div>
  );
}