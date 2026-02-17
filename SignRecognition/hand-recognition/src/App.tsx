import { useEffect, useRef, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import "./App.css";
import "./css/Fancy.css";

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [currentGesture, setCurrentGesture] = useState("Fist");
  const [currentHand, setCurrentHand] = useState("No Hand");
  const [isFacing, setIsFacing] = useState("No Hand");
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

  const isPointing = (lm: NormalizedLandmark[]): boolean =>
    lm[8].y < lm[6].y &&
    lm[12].y > lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y;

  const isTwoFingersUp = (lm: NormalizedLandmark[]): boolean => {
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
    
    return extended == 2; };

  const getPalmOrientation = (lm: NormalizedLandmark[], handedness: string) => {
    const thumbX = lm[4].x;
    const pinkyX = lm[20].x;

    if (handedness === "Right") {
      return thumbX < pinkyX ? true : false;
    } else if (handedness === "Left") {
      return thumbX > pinkyX ? true : false;
    }
    
    setIsFacing("Unknown")
    return;
  };

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
          "/hand_landmarker.task",
      },
      numHands: 1,
      runningMode: "VIDEO",
    });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.play();

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
      let handedness = "Unknown";

      if (results.landmarks && results.landmarks.length > 0) {
        const hand = results.landmarks[0];

        if (isTwoFingersUp(hand)) gesture = "Two Fingers Up";
        else if (isPointing(hand)) gesture = "Point";
        else if (isPalmOpen(hand)) gesture = "Palm";

        setCurrentGesture(gesture);

        //draw landmarks
        drawLandmarks(ctx, hand, canvas.width, canvas.height);

      } else {
        // Clear canvas when no hand detected
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setCurrentGesture("No hand detected");
      }

      if (results.handedness && results.handedness.length > 0) {
        handedness = results.handedness[0][0].categoryName; 
        setCurrentHand(handedness)

        if (results.landmarks && results.landmarks.length > 0) {
          const hand = results.landmarks[0]; 
          setIsFacing(getPalmOrientation(hand, handedness) ? "Back" : "Front");
        }
      }


      animationFrame = requestAnimationFrame(loop);

    };

    setTimeout(() => init(), 0);

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div>
      <nav className="navbar">
        Gesture:
        <div>{currentGesture}</div>
        Hand:
        <div>{currentHand}</div>
        Rotation:
        <div>{isFacing}</div>
      </nav>
      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline width={1280} height={720} />
        <canvas ref={canvasRef} width={1280} height={720} />
      </div>

      {loading && <div>Loading hand tracker…</div>}
      <div className="output-text">{currentGesture}</div>
    </div>
  );
}