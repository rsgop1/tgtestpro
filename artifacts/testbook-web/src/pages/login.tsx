import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase.ts";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const [key, setKey] = useState("");
  
  const { mutate: login, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/learner/login-with-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to login");
      }
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("learner_token", data.token);
      toast.success("Login successful!");
      setLocation("/dashboard");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    login();
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Google Login successful!");
      setLocation("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
    }
  };

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#f1eee7] p-4">
      <Card className="w-full max-w-md border border-[#d8d4c9] shadow-xl shadow-[#17333d]/5 bg-[#faf9f5]">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#e1f0ea] text-[#287e70]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-[#17333d]">Web Portal Login</CardTitle>
          <CardDescription className="text-[#687579]">
            Sign in to access your mock tests and AI Space.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Input 
                placeholder="Telegram Web Key (VIP-1234)" 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="h-14 text-center text-lg font-bold tracking-widest uppercase border-[#d8d4c9] bg-white text-[#17333d] placeholder:text-[#afc1c3] focus-visible:ring-[#287e70]"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-base font-semibold shadow-sm bg-[#17333d] hover:bg-[#284855] text-white"
              disabled={isPending || !key.trim()}
            >
              {isPending ? "Syncing Data..." : "Sign in with Telegram Key"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#d8d4c9]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-[#faf9f5] px-2 text-[#687579]">Or continue with</span>
            </div>
          </div>

          <Button 
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full h-14 text-base font-semibold border-[#d8d4c9] bg-white text-[#17333d] hover:bg-[#f1eee7]"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
