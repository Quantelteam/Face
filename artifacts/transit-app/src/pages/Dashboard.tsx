import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetUser,
  getGetUserQueryKey,
  useGetUserStats,
  getGetUserStatsQueryKey,
  useListUserTransactions,
  getListUserTransactionsQueryKey,
  useGetCard,
  getGetCardQueryKey,
  useTopUpCard,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/PageTransition";
import { clearUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, History, Plus, LogOut, ArrowUpRight, ArrowDownRight, RefreshCcw, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const EXEMPTION_LABELS: Record<string, string> = {
  child: "Child (under 16) — Free Rides",
  elderly: "Elderly — Free Rides",
  disabled: "Disabled — Free Rides",
  veteran: "Veteran — Free Rides",
};

export default function Dashboard() {
  const [, params] = useRoute("/dashboard/:id");
  const [, setLocation] = useLocation();
  const userId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("10");

  const topUpMutation = useTopUpCard();

  const { data: user, isLoading: loadingUser } = useGetUser(userId, {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) }
  });

  const { data: stats, isLoading: loadingStats } = useGetUserStats(userId, {
    query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId) }
  });

  const { data: card, isLoading: loadingCard } = useGetCard(userId, {
    query: { enabled: !!userId, queryKey: getGetCardQueryKey(userId) }
  });

  const { data: txs, isLoading: loadingTx } = useListUserTransactions(userId, {
    query: { enabled: !!userId, queryKey: getListUserTransactionsQueryKey(userId) }
  });

  const handleLogout = () => {
    clearUserId();
    setLocation("/");
  };

  const handleTopUp = async () => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    try {
      await topUpMutation.mutateAsync({ userId, data: { amount } });
      toast({ title: "Top-up successful", description: `Added $${amount.toFixed(2)} to your balance.` });
      setTopUpOpen(false);
      queryClient.invalidateQueries({ queryKey: getGetCardQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: getListUserTransactionsQueryKey(userId) });
    } catch {
      toast({ title: "Top-up failed", variant: "destructive" });
    }
  };

  const fmt = (val: number) => `$${val.toFixed(2)}`;

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col max-w-lg mx-auto gap-6">
        <Skeleton className="h-12 w-3/4 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold mb-4">User not found</h2>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-secondary">Hello, {user.name.split(" ")[0]}</h1>
          <p className="text-xs text-muted-foreground flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 inline-block" /> Face Profile Active
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Exemption Badge */}
        {user.exemption_type && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-blue-800 text-sm">Free Ride Exemption Active</p>
              <p className="text-blue-600 text-xs mt-0.5">
                {EXEMPTION_LABELS[user.exemption_type] ?? user.exemption_type}
              </p>
            </div>
          </div>
        )}

        {/* Digital Wallet Card */}
        <section>
          {loadingCard ? (
            <Skeleton className="h-[200px] w-full rounded-3xl" />
          ) : card ? (
            <div className="bg-gradient-to-br from-primary to-teal-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <CreditCard className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <p className="text-white/80 text-sm font-medium tracking-wider uppercase mb-1">Transit Balance</p>
                <h2 className="text-5xl font-bold tracking-tight mb-8">{fmt(card.balance)}</h2>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Linked Card</p>
                    <p className="font-mono text-sm tracking-widest">•••• {card.last_four}</p>
                  </div>
                  {!user.exemption_type && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl shadow-md h-10 px-4 font-semibold text-secondary bg-white hover:bg-white/90"
                      onClick={() => setTopUpOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Top Up
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : user.exemption_type ? (
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-blue-200" />
              <h3 className="text-xl font-bold mb-1">Free Rides Enabled</h3>
              <p className="text-blue-200 text-sm">No payment card required — your exemption covers all fares.</p>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-border rounded-3xl p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Payment Method</h3>
              <p className="text-sm text-muted-foreground mb-6">Link a card to fund your transit balance and start riding.</p>
              <Button onClick={() => setLocation(`/card/${userId}`)} className="w-full rounded-xl">
                Link Payment Card
              </Button>
            </div>
          )}
        </section>

        {/* Stats Grid */}
        <section>
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">This Month</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Total Rides</p>
              <p className="text-2xl font-bold text-secondary">{loadingStats ? "-" : stats?.rides_this_month ?? 0}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Total Spent</p>
              <p className="text-2xl font-bold text-secondary">{loadingStats ? "-" : fmt(stats?.total_spent ?? 0)}</p>
            </div>
          </div>
        </section>

        {/* Transaction History */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">Recent Activity</h3>
            <History className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            {loadingTx ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : txs && txs.length > 0 ? (
              <div className="divide-y divide-border">
                {txs.slice(0, 8).map(tx => (
                  <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'topup' ? 'bg-green-100 text-green-600' :
                        tx.transaction_type === 'refund' ? 'bg-blue-100 text-blue-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {tx.transaction_type === 'topup' ? <ArrowDownRight className="w-5 h-5" /> :
                         tx.transaction_type === 'refund' ? <RefreshCcw className="w-4 h-4" /> :
                         <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-secondary capitalize">{tx.description || tx.transaction_type}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? 'text-green-600' : 'text-secondary'}`}>
                      {tx.transaction_type === 'topup' || tx.transaction_type === 'refund' ? '+' : '-'}{fmt(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No recent transactions
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Top Up Dialog */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Top up your transit balance from your linked card.</DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <div className="flex gap-2 justify-center mb-6">
              {['10', '20', '50'].map(val => (
                <Button
                  key={val}
                  type="button"
                  variant={amountStr === val ? "default" : "outline"}
                  onClick={() => setAmountStr(val)}
                  className="rounded-xl flex-1"
                >
                  ${val}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Custom Amount</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="amount"
                  type="number"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="pl-8 h-12 text-lg rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTopUpOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleTopUp} disabled={topUpMutation.isPending} className="rounded-xl">
              {topUpMutation.isPending ? "Processing..." : `Add $${amountStr}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
