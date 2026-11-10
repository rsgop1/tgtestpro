import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ScrollArea } from "../components/ui/scroll-area.tsx";
import { Send, Loader2 } from "lucide-react";
import { db, auth } from "../lib/firebase.ts";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Layout } from "../components/layout.tsx";
import { useAuthState } from "react-firebase-hooks/auth";

export function AiSpacePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please login with Google first to use AI Space");
      setLocation("/login");
      return;
    }
    
    if (user) {
      const q = query(
        collection(db, "users", user.uid, "chats"),
        orderBy("createdAt", "asc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(msgs);
      });
  
      return () => unsubscribe();
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Not authenticated");
      
      await addDoc(collection(db, "users", user.uid, "chats"), {
        text,
        role: "user",
        createdAt: serverTimestamp()
      });

      const res = await fetch("/api/learner/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("learner_token")}`
        },
        body: JSON.stringify({ message: text })
      });
      
      if (!res.ok) {
        throw new Error("Failed to get response");
      }
      const data = await res.json();
      
      await addDoc(collection(db, "users", user.uid, "chats"), {
        text: data.reply,
        role: "model",
        createdAt: serverTimestamp()
      });
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;
    sendMessage(input);
    setInput("");
  };

  if (loading || !user) return null;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
        <Card className="flex-1 flex flex-col mx-auto w-full max-w-4xl shadow-md border-[#d8d4c9] bg-white overflow-hidden">
          <CardHeader className="border-b border-[#d8d4c9] bg-[#faf9f5]">
            <CardTitle className="flex items-center text-[#17333d]">
              <span className="text-2xl mr-2">🤖</span> AI Space
            </CardTitle>
            <p className="text-sm text-[#687579]">Your personal AI tutor powered by Gemini</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden relative">
            <ScrollArea className="flex-1 p-4 absolute inset-0 bottom-[73px]" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.length === 0 && (
                  <div className="text-center text-[#687579] my-10">
                    <p>Send a message to start analyzing your tests or asking doubts!</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === "user" ? "bg-[#17333d] text-white" : "bg-[#f1eee7] text-[#17333d]"}`}>
                      <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isPending && (
                  <div className="flex justify-start">
                    <div className="bg-[#f1eee7] rounded-2xl px-4 py-2 text-[#17333d]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 bg-[#faf9f5] border-t border-[#d8d4c9] absolute bottom-0 left-0 right-0">
              <form onSubmit={onSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask your AI tutor anything..."
                  className="flex-1 bg-white border-[#d8d4c9] focus-visible:ring-[#287e70]"
                />
                <Button type="submit" disabled={isPending || !input.trim()} className="bg-[#17333d] hover:bg-[#284855] text-white">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
