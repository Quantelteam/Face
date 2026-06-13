import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useBusPayment, BusPayResult } from "@workspace/api-client-react";
import { CameraView, CameraViewHandle } from "@/components/CameraView";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const FARE_AMOUNT = 1.50;

export default function BusTerminal() {
  const [, setLocation] = useLocation();
  const cameraRef = useRef<CameraViewHandle>(null);
  const payMutation = useBusPayment();

  const [result, setResult] = useState<BusPayResult | null>(null);

  const handlePayFare = async () => {
    if (!cameraRef.current) return;
    
    const image = cameraRef.current.capture();
    if (!image) return;

    // Remove data uri prefix
    const base64Data = image.split(",")[1] || image;

    try {
      const res = await payMutation.mutateAsync({
        data: { image: base64Data }
      });
      
      setResult(res);
      
      // Auto dismiss after 3s
      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      setResult({
        success: false,
        message: "Network Error: Could not process payment.",
      });
      setTimeout(() => setResult(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col font-sans">
      {/* Hidden admin back button, top left corner */}
      <button 
        onClick={() => setLocation("/")}
        className="absolute top-4 left-4 z-50 text-white/30 hover:text-white p-4"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      {/* Main Kiosk Layout */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 py-6 px-8 flex justify-between items-center shadow-lg z-10">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center">
            FacePay <span className="text-primary ml-2">Terminal</span>
          </h1>
          <div className="bg-slate-800 px-6 py-2 rounded-full border border-slate-700">
            <span className="text-slate-300 font-medium uppercase tracking-wider text-sm">Zone A</span>
          </div>
        </div>

        {/* Camera Feed Area */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center p-8 overflow-hidden">
          
          <div className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden ring-4 ring-slate-800 shadow-2xl relative">
             <CameraView
                ref={cameraRef}
                isActive={true}
                aspectRatio="video"
                showFaceGuide={false}
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
                <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Processing Fare</h2>
              </motion.div>
            )}

            {/* Result Overlay */}
            {result && !payMutation.isPending && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 1.05 }}
                className={`absolute inset-0 z-30 flex flex-col items-center justify-center ${result.success ? 'bg-green-900/90' : 'bg-red-900/90'} backdrop-blur-md`}
              >
                {result.success ? (
                  <>
                    <CheckCircle2 className="w-32 h-32 text-green-400 mb-6" />
                    <h2 className="text-6xl font-bold text-white mb-4">Approved</h2>
                    {result.user_name && <p className="text-2xl text-green-100 font-medium mb-8">Welcome onboard, {result.user_name}</p>}
                    
                    <div className="bg-black/40 rounded-3xl p-6 px-10 text-center border border-white/10">
                      <p className="text-green-200/70 text-sm uppercase tracking-widest mb-1">Remaining Balance</p>
                      <p className="text-4xl font-bold text-white font-mono">${result.remaining_balance?.toFixed(2)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-32 h-32 text-red-400 mb-6" />
                    <h2 className="text-6xl font-bold text-white mb-4">Declined</h2>
                    <p className="text-2xl text-red-100 font-medium max-w-lg text-center">{result.message}</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Action Bar */}
        <div className="bg-slate-900 p-8 border-t border-slate-800 pb-12">
          <Button 
            className="w-full h-28 text-4xl font-bold rounded-2xl shadow-2xl tracking-wide disabled:opacity-50 transition-transform active:scale-[0.98]" 
            onClick={handlePayFare}
            disabled={payMutation.isPending || !!result}
            data-testid="btn-bus-pay"
          >
            TAP TO PAY ${FARE_AMOUNT.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}
