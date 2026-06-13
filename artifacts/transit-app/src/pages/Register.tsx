import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useEnrollFace, useRegisterUser } from "@workspace/api-client-react";
import { PageTransition } from "@/components/PageTransition";
import { CameraView, CameraViewHandle } from "@/components/CameraView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setUserId } from "@/lib/auth";

const STEPS = [
  { title: "Look Straight", subtext: "Position your face in the oval" },
  { title: "Turn Left", subtext: "Slightly turn your head left" },
  { title: "Turn Right", subtext: "Slightly turn your head right" }
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // States
  const [step, setStep] = useState(0); // 0, 1, 2 for camera, 3 for form
  const [countdown, setCountdown] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [embeddingToken, setEmbeddingToken] = useState("");
  
  const cameraRef = useRef<CameraViewHandle>(null);
  const enrollMutation = useEnrollFace();
  const registerMutation = useRegisterUser();

  // Timer logic for auto-capture
  useEffect(() => {
    if (step >= 3) return;

    // Start 3 second countdown when entering a new camera step
    setCountdown(3);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev === 1) {
          // Capture time!
          captureFrame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  const captureFrame = () => {
    if (!cameraRef.current) return;
    
    const image = cameraRef.current.capture();
    if (image) {
      const newImages = [...images, image];
      setImages(newImages);
      
      if (step === 2) {
        // All 3 captured, send to API
        submitEnrollment(newImages);
      } else {
        setStep(s => s + 1);
      }
    }
  };

  const submitEnrollment = async (capturedImages: string[]) => {
    try {
      const result = await enrollMutation.mutateAsync({
        data: { images: capturedImages.map(img => img.split(",")[1] || img) } // Remove data:image/jpeg;base64,
      });
      
      if (result.embedding_token) {
        setEmbeddingToken(result.embedding_token);
        setStep(3);
        toast({
          title: "Face scan complete",
          description: "Your biometric profile has been securely created.",
        });
      } else {
        toast({
          title: "Scan failed",
          description: result.message || "Could not detect a clear face.",
          variant: "destructive"
        });
        resetFlow();
      }
    } catch (err) {
      toast({
        title: "Enrollment Error",
        description: "Failed to process face images. Please try again.",
        variant: "destructive"
      });
      resetFlow();
    }
  };

  const resetFlow = () => {
    setImages([]);
    setStep(0);
    setCountdown(3);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const user = await registerMutation.mutateAsync({
        data: { name, embedding_token: embeddingToken }
      });
      
      setUserId(user.id);
      toast({
        title: "Registration successful!",
        description: "Welcome to FacePay Transit.",
      });
      setLocation(`/dashboard/${user.id}`);
    } catch (err) {
      toast({
        title: "Registration failed",
        description: "Could not create account. Please try again.",
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
          {step < 3 ? (
            // Camera Steps
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Face Enrollment</h2>
                <p className="text-muted-foreground text-sm">
                  Step {step + 1} of 3: {STEPS[step].title}
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i} 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === step ? "w-8 bg-primary" : i < step ? "w-8 bg-primary/40" : "w-4 bg-secondary/10"
                    }`} 
                  />
                ))}
              </div>

              <div className="relative">
                <CameraView
                  ref={cameraRef}
                  isActive={step < 3}
                  aspectRatio="portrait"
                  overlayText={countdown ? countdown.toString() : "Capturing..."}
                  overlaySubtext={STEPS[step].subtext}
                />
                
                {enrollMutation.isPending && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-white font-medium">Processing biometrics...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Form Step
            <form onSubmit={handleRegisterSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Profile Secured</h2>
                <p className="text-muted-foreground text-sm">
                  Your face biometric is registered. Just add your name to complete setup.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Jane Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 text-lg px-4 rounded-xl"
                    autoFocus
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base rounded-xl" 
                  disabled={!name.trim() || registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Account...</>
                  ) : "Complete Registration"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
