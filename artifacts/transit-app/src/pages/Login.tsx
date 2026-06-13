import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useIdentifyFace } from "@workspace/api-client-react";
import { PageTransition } from "@/components/PageTransition";
import { CameraView, CameraViewHandle } from "@/components/CameraView";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ScanFace } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setUserId } from "@/lib/auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const cameraRef = useRef<CameraViewHandle>(null);
  const identifyMutation = useIdentifyFace();

  const handleLogin = async () => {
    if (!cameraRef.current) return;
    
    const image = cameraRef.current.capture();
    if (!image) return;

    // strip base64 prefix
    const base64Data = image.split(",")[1] || image;

    try {
      const result = await identifyMutation.mutateAsync({
        data: { image: base64Data }
      });
      
      if (result.identified && result.user_id) {
        setUserId(result.user_id);
        toast({
          title: `Welcome back, ${result.name || 'Passenger'}!`,
        });
        setLocation(`/dashboard/${result.user_id}`);
      } else {
        toast({
          title: "Face not recognized",
          description: "We couldn't find a matching account. Please try again or register.",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Login Error",
        description: "Failed to connect to authentication server.",
        variant: "destructive"
      });
    }
  };

  return (
    <PageTransition className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        <Button 
          variant="ghost" 
          className="mb-8 pl-2" 
          onClick={() => setLocation("/")}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="bg-card shadow-lg rounded-3xl p-6 sm:p-8 border border-border">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Face Login</h2>
            <p className="text-muted-foreground text-sm">
              Look straight at the camera to access your account.
            </p>
          </div>

          <div className="relative mb-8">
            <CameraView
              ref={cameraRef}
              isActive={true}
              aspectRatio="square"
              overlayText="Position Face in Oval"
            />
            
            {identifyMutation.isPending && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <p className="text-white font-medium">Identifying...</p>
              </div>
            )}
          </div>

          <Button 
            className="w-full h-14 text-lg rounded-xl shadow-sm" 
            onClick={handleLogin}
            disabled={identifyMutation.isPending}
            data-testid="btn-execute-login"
          >
            {identifyMutation.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
            ) : (
              <><ScanFace className="w-5 h-5 mr-2" /> Log In with Face</>
            )}
          </Button>

        </div>
      </div>
    </PageTransition>
  );
}
