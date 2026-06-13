import { useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useBusPayment, BusPayResult } from "@workspace/api-client-react";
import { CameraView, CameraViewHandle } from "@/components/CameraView";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ChevronLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const FARE_AMOUNT = 1.50;

const EXEMPTION_LABELS: Record<string, string> = {
  child: "Child (under 16)",
  elderly: "Elderly Passenger",
  disabled: "Disabled Passenger",
  veteran: "Veteran",
};

export default function BusTerminal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const cameraRef = useRef<CameraViewHandle>(null);
  const payMutation = useBusPayment();
  const [result, setResult] = useState<BusPayResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const handleStreamReady = useCallback(() => setCameraReady(true), []);

  const handlePayFare = async () => {
    if (!cameraRef.current?.isReady()) {
      toast({
        title: "Camera not ready",
        description: "Please wait for the camera to initialize.",
        variant: "destructive",
      });
      return;
    }

    const image = cameraRef.current.capture();
    if (!image) {
      toast({
        title: "Capture failed",
        description: "Could not capture image. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const base64Data = image.split(",")[1] || image;

    try {
      const res = await payMutation.mutateAsync({
        data: { image: base64Data }
      });

      setResult(res);
      setTimeout(() => setResult(null), res.is_unknown ? 6000 : 4000);
    } catch (err) {
      setResult({
        success: false,
        is_unknown: false,
        message: "Network Error: Could not process payment.",
      });
      setTimeout(() => setResult(null), 4000);
    }
  };

  const isUnknown = result?.is_unknown;
  const isFreeRide = result?.is_free_ride;

  return (
    <div className="fixed inset-0 bg-black flex flex-col font-sans">
      {/* Hidden back button */}
      <button
        onClick={() => setLocation("/")}
        className="absolute top-4 left-4 z-50 text-white/30 hover:text-white p-4 transition-colors"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 py-6 px-8 flex justify-between items-center shadow-lg z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center">
            FacePay <span className="text-primary ml-2">Terminal</span>
          </h1>
          <div className="flex items-center gap-3">
            {/* Camera status indicator */}
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border ${
              cameraReady
                ? "bg-green-900/50 border-green-700 text-green-300"
                : "bg-yellow-900/50 border-yellow-700 text-yellow-300"
            }`}>
              <span className={`w-2 h-2 rounded-full ${cameraReady ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`} />
              {cameraReady ? "Camera Ready" : "Initializing..."}
            </div>
            <div className="bg-slate-800 px-6 py-2 rounded-full border border-slate-700">
              <span className="text-slate-300 font-medium uppercase tracking-wider text-sm">Zone A</span>
            </div>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center p-8 overflow-hidden">
          <div className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden ring-4 ring-slate-800 shadow-2xl relative">
            <CameraView
              ref={cameraRef}
              isActive={true}
              aspectRatio="video"
              showFaceGuide={false}
              onStreamReady={handleStreamReady}
            />

            {/* Center Reticle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-[3px] border-white/20 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-white/40" />
              </div>
            </div>
          </div>

          {/* Processing Overlay */}
          <AnimatePresence>
            {payMutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center"
              >
                <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Scanning Face...</h2>
              </motion.div>
            )}

            {/* UNKNOWN PERSON — Alert Driver */}
            {result && !payMutation.isPending && isUnknown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-orange-950/95 backdrop-blur-md"
              >
                {/* Flashing border effect */}
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="absolute inset-0 border-[8px] border-orange-500 rounded-none pointer-events-none"
                />
                <AlertTriangle className="w-28 h-28 text-orange-400 mb-6" />
                <h2 className="text-6xl font-bold text-white mb-4 tracking-tight">UNKNOWN PERSON</h2>
                <p className="text-2xl text-orange-200 font-semibold mb-6 uppercase tracking-widest">Alert the Driver</p>
                <div className="bg-orange-900/60 border border-orange-600 rounded-2xl px-10 py-4 text-center">
                  <p className="text-orange-100 text-lg">This person is not registered in the system.</p>
                  <p className="text-orange-300 text-sm mt-1">Please verify their identity manually.</p>
                </div>
              </motion.div>
            )}

            {/* FREE RIDE — Exempt */}
            {result && !payMutation.isPending && !isUnknown && isFreeRide && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-blue-900/90 backdrop-blur-md"
              >
                <ShieldCheck className="w-32 h-32 text-blue-300 mb-6" />
                <h2 className="text-6xl font-bold text-white mb-3">FREE RIDE</h2>
                {result.user_name && (
                  <p className="text-2xl text-blue-100 font-medium mb-4">
                    Welcome onboard, {result.user_name}
                  </p>
                )}
                {result.exemption_type && (
                  <div className="bg-blue-800/60 border border-blue-500 rounded-2xl px-8 py-3 mb-6">
                    <p className="text-blue-200 text-lg font-semibold text-center">
                      {EXEMPTION_LABELS[result.exemption_type] ?? result.exemption_type}
                    </p>
                  </div>
                )}
                <p className="text-blue-300 text-lg">No fare charged — government exemption</p>
              </motion.div>
            )}

            {/* APPROVED — Paid ride */}
            {result && !payMutation.isPending && !isUnknown && !isFreeRide && result.success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-green-900/90 backdrop-blur-md"
              >
                <CheckCircle2 className="w-32 h-32 text-green-400 mb-6" />
                <h2 className="text-6xl font-bold text-white mb-4">Approved</h2>
                {result.user_name && (
                  <p className="text-2xl text-green-100 font-medium mb-8">
                    Welcome onboard, {result.user_name}
                  </p>
                )}
                <div className="bg-black/40 rounded-3xl p-6 px-10 text-center border border-white/10">
                  <p className="text-green-200/70 text-sm uppercase tracking-widest mb-1">Remaining Balance</p>
                  <p className="text-4xl font-bold text-white font-mono">${result.remaining_balance?.toFixed(2)}</p>
                </div>
              </motion.div>
            )}

            {/* DECLINED — paid ride failure */}
            {result && !payMutation.isPending && !isUnknown && !result.success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-900/90 backdrop-blur-md"
              >
                <XCircle className="w-32 h-32 text-red-400 mb-6" />
                <h2 className="text-6xl font-bold text-white mb-4">Declined</h2>
                <p className="text-2xl text-red-100 font-medium max-w-lg text-center">{result.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-900 p-8 border-t border-slate-800 pb-12">
          <Button
            className={`w-full h-28 text-4xl font-bold rounded-2xl shadow-2xl tracking-wide transition-transform active:scale-[0.98] ${
              !cameraReady ? "opacity-60 cursor-not-allowed" : ""
            }`}
            onClick={handlePayFare}
            disabled={payMutation.isPending || !!result || !cameraReady}
            data-testid="btn-bus-pay"
          >
            {!cameraReady
              ? "Initializing Camera..."
              : payMutation.isPending
              ? <><Loader2 className="w-10 h-10 mr-4 animate-spin" /> Scanning...</>
              : `TAP TO PAY $${FARE_AMOUNT.toFixed(2)}`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
