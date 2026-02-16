import React, { use, useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";


export default function App() {

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const prevPoint = useRef({ x: null, y: null });
  const ctxRef = useRef(null);


  const [text, setText] = useState("");
  const [color, setColor] = useState("#ff007f");
  const [colorIndex, setColorIndex] = useState(0);
  const colorRef = useRef(color);
  const lastGestureTime = useRef(0);
  const [currentGesture, setCurrentGesture] = useState("Stop Drawing ✊");


  const colors = ["#ff007f", "#ff7f00", "#7fff00", "#00ff7f", "#007fff", "#7f00ff"];

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const ctx = canvasElement.getContext("2d");
    ctxRef.current = ctx;

    // initialize MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    // helpers for gesture detection
    const isPalmOpen = (lm) => {
      // check if all fingers are extended or not
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
      if (lm[4].x < lm[3].x) extended++;  //thumb check
      return extended >= 4;
    };


    const isWritingPose = (lm) =>
      lm[8].y < lm[6].y &&  //index finger
      lm[12].y > lm[10].y &&  //middle finger
      lm[16].y > lm[14].y &&  //ring finger
      lm[20].y > lm[18].y;

    const isTwoFingersUp = (lm) =>
      lm[8].y < lm[6].y &&  //index finger
      lm[12].y < lm[10].y &&  //middle finger
      lm[16].y > lm[14].y &&  //ring finger
      lm[20].y > lm[18].y;

    hands.onResults((results) => {
      let gesture = "Stop Drawing ✊"; // default gesture

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        if (isTwoFingersUp(hand)) gesture = "Change Color ✌️";
        else if (isWritingPose(hand)) gesture = "Drawing ✍️";
        else if (isPalmOpen(hand)) gesture = "Space 🖐️";
      }
      setCurrentGesture(gesture);

      const width = canvasElement.width;
      const height = canvasElement.height;

      // drawing logic
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        const indexTip = hand[8];

        const x = (1 - indexTip.x) * width; // flip. horizontally
        const y = indexTip.y * height;

        const smoothFactor = 0.25;
        const prev = prevPoint.current;
        const smoothX = prev.x === null ? x : prev.x + (x - prev.x) * smoothFactor;
        const smoothY = prev.y === null ? y : prev.y + (y - prev.y) * smoothFactor;

        ctx.strokeStyle = colorRef.current;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        const now = Date.now();

        // change color gesture - two fingers up
        if (isTwoFingersUp(hand) && now - lastGestureTime.current > 1200) {
          const newIndex = (colorIndex + 1) % colors.length;
          setColorIndex(newIndex);
          setColor(colors[newIndex]);
          lastGestureTime.current = now;
        }

        // draw gesture - writing pose
        if (isWritingPose(hand)) {
          if (prev.x !== null && prev.y !== null) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.quadraticCurveTo(prev.x, prev.y, smoothX, smoothY);
            ctx.stroke();
          }
          prevPoint.current = { x: smoothX, y: smoothY };
        } else {
          prevPoint.current = { x: null, y: null };
        }


        // space gesture - palm open
        if (isPalmOpen(hand) && now - lastGestureTime.current > 1200) {
          setText((t) => t + " ");
          lastGestureTime.current = now;
          prevPoint.current = { x: null, y: null };
        }

      } else {
        prevPoint.current = { x: null, y: null };
      }

    });


    if (videoElement) {
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }


  }, [colorIndex, color]);

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };


  // UI
  return (
    <div className="flex w-screen h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white">
      {/* Video feed */}
      <div className="absolute top-6 left-6 z-20">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-xl shadow-lg w-64 transform -scale-x-100 border border-white/30"
        />
        <div className="text-xs text-gray-300 mt-2 text-center tracking-wide">
          Live Camera Feed
        </div>
      </div>

      {/* Canvas */}
      <div className="flex justify-end items-center w-full pr-6">
        <div className="relative w-[700] h-[100vh] bg-white rounded=3xl shadow-2xl flex justify-center items-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={900}
            height={480}
            className="rounded-xl border-2 border-gray-200 bg-white shadow-lg"
          />


          {/* Gesture Info */}
          <div className="absolute bottom-6 left-6 bg-indigo-600 backdrop-blur-md px-6 py-3 rounded-xl text-lg text-white 
          font-semibold shadow-lg">
            {currentGesture} <br />
            <span className="text-sm text-white/80">
              ✊ Stop drawing | 👆 Drawing | ✌️ Change color | 🖐️ Space
            </span>
          </div>


          {/* Clear & Color Info */}
          <div className="absolute top-6 left-6 w-20 h-8 rounded-xl border-2 border-gray-700 shadow-xl transition-all"
            style={{ backgroundColor: color }}
            title={`Current Color: ${color}`}
          />

          <button onClick={clearCanvas}
            className="absolute bottom-6 right-6 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl text-lg text-white 
          font-semibold shadow-lg transition-all"
          >
            Clear Canvas
          </button>


        </div>

      </div>


    </div>
  );

}