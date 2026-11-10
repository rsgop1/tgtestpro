import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { Textarea } from "../components/ui/textarea.tsx";
import { ArrowLeft, LifeBuoy, MessageSquare, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

export function SupportPage() {
  const [token] = useState(localStorage.getItem("learner_token") || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { mutate: submitTicket, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/learner/support-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subject, message })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Support ticket sent successfully! Admin will reply via Telegram.");
      setSubject("");
      setMessage("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.length < 5) {
      toast.error("Message must be at least 5 characters.");
      return;
    }
    submitTicket();
  };

  return (
    <div className="min-h-[100dvh] bg-[#f8f6f0] pb-12">
      <header className="sticky top-0 z-10 border-b border-[#e4e0d5] bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/dashboard" className="rounded-full p-2 hover:bg-[#f1eee7]">
            <ArrowLeft size={20} className="text-[#17333d]" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-[#17333d]">Priority Support</h1>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-3xl px-4 sm:px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#17333d]">How can we help?</h2>
          <p className="mt-2 text-sm text-[#56656a]">
            As a Premium member, your tickets are routed directly to the priority queue.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_300px]">
          <div>
            <Card className="border-[#e4e0d5] shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Create a Ticket</CardTitle>
                <CardDescription>Fill out the details below.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-[#8a9697]">
                      Subject
                    </label>
                    <Input 
                      placeholder="e.g. Payment Issue, Test Error" 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="border-[#d8d4c9] bg-[#faf9f5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-[#8a9697]">
                      Message
                    </label>
                    <Textarea 
                      placeholder="Describe your issue in detail..." 
                      className="min-h-[120px] border-[#d8d4c9] bg-[#faf9f5]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#17333d] text-white hover:bg-[#287e70]"
                    disabled={isPending}
                  >
                    <Send size={16} className="mr-2" />
                    {isPending ? "Sending..." : "Submit Ticket"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#c9e2d9] bg-[#e1f0ea] p-5">
              <div className="flex items-center gap-2 text-[#287e70]">
                <ShieldCheck size={18} />
                <h3 className="font-bold">Priority Status</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#287e70]">
                Your tickets are reviewed by our Admin team within 2 hours. Notifications will be sent via Telegram.
              </p>
            </div>

            <div className="rounded-xl border border-[#ead9bd] bg-[#f5e9d5] p-5">
              <div className="flex items-center gap-2 text-[#98672a]">
                <Sparkles size={18} />
                <h3 className="font-bold">AI Resolution</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#98672a]">
                For doubt solving, use the AI Tutor directly inside Telegram for instant step-by-step solutions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
