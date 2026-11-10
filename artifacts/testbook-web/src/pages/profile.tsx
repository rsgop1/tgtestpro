import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/layout.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Check, Copy, Gift, ShieldCheck, Trophy, Sparkles, Crown } from "lucide-react";
import { toast } from "sonner";

export function ProfilePage() {
  const [token] = useState(localStorage.getItem("learner_token") || "");
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['learner-profile', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/profile?token=${token}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!token
  });

  const { mutate: generatePromo, isPending: generating } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/learner/generate-promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: () => {
      toast.success("VIP Code generated successfully!");
      queryClient.invalidateQueries({ queryKey: ['learner-profile', token] });
    }
  });

  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!profile?.promoCode) return;
    navigator.clipboard.writeText(profile.promoCode);
    setCopied(true);
    toast.success("Promo code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <Layout><div className="p-8 text-center">Loading...</div></Layout>;
  if (!profile) return <Layout><div className="p-8 text-center text-destructive">Error loading profile.</div></Layout>;

  return (
    <Layout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your subscription and referral code.</p>
      </div>

      <div className="flex flex-col items-center gap-4 text-center mt-6">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ${profile.tier === 'Premium' ? 'bg-gradient-to-tr from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20' : 'bg-primary text-primary-foreground'}`}>
          {profile.fullName?.charAt(0) || "U"}
        </div>
        <div>
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            {profile.fullName}
            {profile.tier === "Premium" && <Crown className="h-5 w-5 text-amber-500" fill="currentColor" />}
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            {profile.tier === "Premium" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200 shadow-sm flex items-center gap-1">
                <Crown size={12} /> VIP Active
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                Free Plan
              </span>
            )}
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Target: {profile.examTarget}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card className={profile.tier === "Premium" ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${profile.tier === "Premium" ? "text-amber-700" : ""}`}>
              <ShieldCheck size={14} /> Subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{profile.tier === "Premium" ? "Testbook+ VIP" : "Basic Free Plan"}</p>
            {profile.tier === "Premium" ? (
              <p className="mt-1 text-sm text-amber-700/80 font-medium">
                Valid till: {profile.premiumExpiry ? new Date(profile.premiumExpiry).toLocaleDateString() : "Lifetime"}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Upgrade to unlock all mock tests.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <Trophy size={14} /> Referral Coins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{profile.coins} Coins</p>
            <p className="mt-1 text-sm text-muted-foreground">Redeemable for extensions</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 rounded-2xl border bg-card text-card-foreground p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">VIP Referral Economy</h3>
            <p className="text-sm text-muted-foreground">Invite friends and earn premium rewards.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-muted/50 p-5">
          {profile.promoCode ? (
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Your Unique Promo Code</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <div className="rounded-lg border-2 border-dashed border-primary bg-background px-6 py-3 text-2xl font-black tracking-widest text-primary">
                  {profile.promoCode}
                </div>
                <Button variant="outline" size="icon" onClick={copyToClipboard} className="h-14 w-14 shrink-0 rounded-lg">
                  {copied ? <Check size={20} className="text-primary" /> : <Copy size={20} />}
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground max-w-sm mx-auto">
                Share this code! Your friends get <span className="font-bold">20% OFF</span>, and you earn <span className="font-bold">50 Test Coins</span> for each successful referral.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Generate your custom VIP promo code to start earning referral coins!
              </p>
              <Button 
                onClick={() => generatePromo()} 
                disabled={generating}
              >
                <Sparkles size={16} className="mr-2" />
                {generating ? "Generating..." : "Generate VIP Code"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
