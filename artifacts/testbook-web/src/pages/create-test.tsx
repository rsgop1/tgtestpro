import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { useMutation } from "@tanstack/react-query";
import { FilePlus, Loader2, Play } from "lucide-react";
import { db, auth } from "../lib/firebase.ts";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Layout } from "../components/layout.tsx";
import { useAuthState } from "react-firebase-hooks/auth";

export function CreateTestPage() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [generatedTest, setGeneratedTest] = useState<any | null>(null);
  const [, setLocation] = useLocation();

  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please login with Google first to create custom tests");
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  const { mutate: createTest, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learner/create-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("learner_token")}`
        },
        body: JSON.stringify({ topic, numQuestions })
      });
      if (!res.ok) throw new Error("Failed to generate test");
      return res.json();
    },
    onSuccess: async (data) => {
      setGeneratedTest(data.test);
      toast.success("Test generated successfully!");
      
      // Save test generation history to Firestore
      if (user && data.test) {
        await addDoc(collection(db, "users", user.uid, "customTests"), {
          topic,
          testId: data.test.id,
          shareToken: data.test.shareToken,
          createdAt: serverTimestamp()
        });
      }
    },
    onError: () => {
      toast.error("Failed to generate test. Make sure you are logged in with Telegram Key.");
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    createTest();
  };

  if (loading || !user) return null;

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center gap-2">
          <FilePlus className="h-6 w-6 text-[#287e70]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#17333d]">Create Custom Test</h1>
        </div>

        <Card className="max-w-2xl border-[#d8d4c9] shadow-sm bg-white">
          <CardHeader className="bg-[#faf9f5] border-b border-[#d8d4c9]">
            <CardTitle>AI Test Generator</CardTitle>
            <CardDescription>
              Generate a personalized multiple choice test on any topic using Gemini.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Topic or Text</label>
                <Input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. World War 2, Quantum Physics, specific notes..."
                  className="w-full bg-white border-[#d8d4c9]"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Number of Questions</label>
                <select
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                  className="w-full p-2 border border-[#d8d4c9] rounded-md bg-white text-sm"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                </select>
              </div>

              <Button type="submit" disabled={isPending || !topic.trim()} className="w-full bg-[#17333d] hover:bg-[#284855] text-white">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
                Generate Test
              </Button>
            </form>
          </CardContent>
        </Card>

        {generatedTest && (
          <Card className="max-w-3xl border-[#d8d4c9] shadow-sm bg-white mt-8">
            <CardHeader className="bg-[#e1f0ea] border-b border-[#d8d4c9]">
              <CardTitle className="text-[#287e70] flex justify-between items-center">
                Test Ready: {generatedTest.title}
                <Button size="sm" onClick={() => setLocation("/tests")} className="bg-[#17333d] hover:bg-[#284855] text-white">
                  <Play className="h-4 w-4 mr-2" />
                  Play Now
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="text-sm text-[#687579]">
                Your test has been successfully created and saved to your account.
                Go to the Mock Tests page to play it!
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
