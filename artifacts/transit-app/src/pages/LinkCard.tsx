import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useLinkCard } from "@workspace/api-client-react";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, CreditCard, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LinkCard() {
  const [, params] = useRoute("/card/:id");
  const [, setLocation] = useLocation();
  const userId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  
  const linkMutation = useLinkCard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (cleanNumber.length < 16) {
      toast({ title: "Invalid card number", variant: "destructive" });
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      toast({ title: "Expiry must be MM/YY format", variant: "destructive" });
      return;
    }

    try {
      await linkMutation.mutateAsync({
        userId,
        data: {
          card_number: cleanNumber,
          card_holder: cardHolder,
          expiry
        }
      });
      
      toast({ title: "Card linked successfully!" });
      setLocation(`/dashboard/${userId}`);
    } catch (err) {
      toast({ 
        title: "Failed to link card", 
        description: "Please check your details and try again.",
        variant: "destructive" 
      });
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 16);
    // add spaces every 4 digits
    val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(val);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 4);
    if (val.length >= 3) {
      val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
    }
    setExpiry(val);
  };

  if (!userId) return null;

  return (
    <PageTransition className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        <Button 
          variant="ghost" 
          className="mb-8 pl-2" 
          onClick={() => setLocation(`/dashboard/${userId}`)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>

        <div className="bg-card shadow-lg rounded-3xl p-6 sm:p-8 border border-border">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Link Payment Method</h2>
            <p className="text-muted-foreground text-sm flex items-center justify-center">
              <Lock className="w-3 h-3 mr-1" /> Secure 256-bit encryption
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cardHolder">Name on Card</Label>
              <Input 
                id="cardHolder" 
                placeholder="Jane Doe" 
                value={cardHolder}
                onChange={e => setCardHolder(e.target.value)}
                className="h-12 rounded-xl"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input 
                id="cardNumber" 
                placeholder="0000 0000 0000 0000" 
                value={cardNumber}
                onChange={handleCardNumberChange}
                className="h-12 rounded-xl font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry (MM/YY)</Label>
                <Input 
                  id="expiry" 
                  placeholder="12/25" 
                  value={expiry}
                  onChange={handleExpiryChange}
                  className="h-12 rounded-xl font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input 
                  id="cvv" 
                  type="password"
                  placeholder="123" 
                  maxLength={4}
                  className="h-12 rounded-xl font-mono"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg rounded-xl mt-4" 
              disabled={linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying...</>
              ) : "Save Card"}
            </Button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
