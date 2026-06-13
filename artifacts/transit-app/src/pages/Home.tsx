import { Link, useLocation } from "wouter";
import { Camera, BusFront, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <PageTransition className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-6">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            FacePay <span className="text-primary">Transit</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            The fastest way to pay your fare. Just look and board. Select your mode to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          {/* Passenger Card */}
          <div className="group relative flex flex-col h-full bg-card hover:bg-slate-50 border-2 border-border hover:border-primary/50 transition-all duration-300 rounded-3xl p-8 items-center text-center shadow-sm hover:shadow-md">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Camera className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">I am a Passenger</h2>
            <p className="text-muted-foreground mb-8">
              Log in with your face or register a new account to manage your linked cards and transit balance.
            </p>
            
            <div className="mt-auto w-full space-y-3">
              <Button
                className="w-full text-base h-12 rounded-xl"
                data-testid="btn-passenger-login"
                onClick={() => setLocation("/login")}
              >
                Log In with Face <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-base rounded-xl"
                data-testid="btn-passenger-register"
                onClick={() => setLocation("/register")}
              >
                Register New Account
              </Button>
            </div>
          </div>

          {/* Bus Terminal Card */}
          <div
            className="group relative flex flex-col h-full bg-secondary hover:bg-secondary/90 border-2 border-transparent transition-all duration-300 rounded-3xl p-8 items-center text-center shadow-sm hover:shadow-md cursor-pointer"
            onClick={() => setLocation("/bus")}
          >
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <BusFront className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Bus Terminal</h2>
            <p className="text-white/70 mb-8">
              Launch the point-of-sale terminal for boarding passengers. Camera continuously active.
            </p>
            
            <div className="mt-auto w-full">
              <Button className="w-full text-base h-12 rounded-xl bg-white text-secondary hover:bg-white/90" data-testid="btn-launch-terminal">
                Launch Terminal <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/users" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
            Admin View: Manage Users
          </Link>
        </div>

      </div>
    </PageTransition>
  );
}
