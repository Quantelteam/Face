import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CameraViewHandle {
  capture: () => string | null;
}

interface CameraViewProps {
  isActive: boolean;
  overlayText?: string;
  overlaySubtext?: string;
  showFaceGuide?: boolean;
  mirror?: boolean;
  aspectRatio?: "video" | "square" | "portrait";
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  ({ isActive, overlayText, overlaySubtext, showFaceGuide = true, mirror = true, aspectRatio = "video" }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useImperativeHandle(ref, () => ({
      capture: () => {
        if (!videoRef.current || !canvasRef.current || !stream) return null;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Set canvas to actual video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Return base64 JPEG
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    }));

    useEffect(() => {
      let activeStream: MediaStream | null = null;

      const startCamera = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
          activeStream = mediaStream;
          setStream(mediaStream);
          setHasPermission(true);
          
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (err) {
          console.error("Camera error:", err);
          setHasPermission(false);
        }
      };

      if (isActive) {
        startCamera();
      }

      return () => {
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
      };
    }, [isActive]);

    const aspectClasses = {
      video: "aspect-video",
      square: "aspect-square",
      portrait: "aspect-[3/4]"
    };

    if (hasPermission === false) {
      return (
        <div className={`w-full bg-slate-900 rounded-2xl flex flex-col items-center justify-center p-8 text-center border border-slate-800 ${aspectClasses[aspectRatio]}`}>
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Camera Access Denied</h3>
          <p className="text-slate-400 text-sm max-w-sm">
            Please allow camera permissions in your browser to use FacePay Transit.
          </p>
        </div>
      );
    }

    return (
      <div className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-xl ${aspectClasses[aspectRatio]}`}>
        {/* Hidden canvas for captures */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-700 ${stream ? 'opacity-100' : 'opacity-0'} ${mirror ? '-scale-x-100' : ''}`}
        />

        {/* Loading state */}
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center">
              <Camera className="w-8 h-8 text-teal-500 animate-pulse mb-3" />
              <p className="text-slate-400 text-sm font-medium">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Face Guide Overlay */}
        <AnimatePresence>
          {stream && showFaceGuide && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center"
            >
              <div className="w-56 h-72 border-2 border-dashed border-teal-400/70 rounded-[100px] relative">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-teal-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-teal-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-teal-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-teal-400 rounded-br-xl" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Overlay */}
        <AnimatePresence mode="wait">
          {(overlayText || overlaySubtext) && (
            <motion.div 
              key={overlayText}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-8 left-0 right-0 text-center px-6 pointer-events-none"
            >
              {overlayText && (
                <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-semibold text-lg tracking-wide border border-white/10 shadow-lg">
                  {overlayText}
                </div>
              )}
              {overlaySubtext && (
                <div className="mt-2 text-white/80 font-medium text-sm drop-shadow-md">
                  {overlaySubtext}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

CameraView.displayName = 'CameraView';
