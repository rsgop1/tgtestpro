import { useState } from "react";
import { Layout } from "../components/layout.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, MinusCircle, Calendar, Trophy, BarChart3, Clock } from "lucide-react";

export function HistoryPage() {
  const [token] = useState(localStorage.getItem("learner_token") || "");
  const [, setLocation] = useLocation();
  
  const { data: history, isLoading } = useQuery({
    queryKey: ['learner-history', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json().then(d => d.history);
    },
    enabled: !!token
  });

  return (
    <Layout>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#17333d]">My History</h1>
        <p className="text-[#687579]">Detailed analysis of your past test submissions.</p>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-[#687579]">Loading history...</div>
      ) : (
        <div className="space-y-4">
          {history?.map((entry: any) => (
            <Card key={entry.id} className="overflow-hidden border-[#d8d4c9] bg-white">
              <div className="md:flex">
                <div className="bg-[#faf9f5] p-6 md:w-64 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#d8d4c9]">
                  <div className="text-sm font-medium text-[#687579] mb-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(entry.completedAt).toLocaleDateString()}
                  </div>
                  <h3 className="font-bold text-[#17333d] text-lg leading-tight mb-4">Attempt #{entry.id}</h3>
                  <div className="mt-auto flex items-end gap-2">
                    <Trophy className="h-5 w-5 text-[#287e70]" />
                    <span className="text-2xl font-black text-[#17333d]">{entry.score}</span>
                    <span className="text-sm text-[#687579] font-medium mb-1">Score</span>
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[#8a9697] mb-4">Performance Metrics</h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#e1f0ea] rounded-lg p-3 border border-[#c9e2d9]">
                      <div className="flex items-center gap-2 text-[#287e70] mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase">Correct</span>
                      </div>
                      <div className="text-xl font-bold text-[#17333d]">{entry.correctCount}</div>
                    </div>
                    
                    <div className="bg-[#f9e8e3] rounded-lg p-3 border border-[#e4ccca]">
                      <div className="flex items-center gap-2 text-[#a14d45] mb-1">
                        <XCircle className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase">Wrong</span>
                      </div>
                      <div className="text-xl font-bold text-[#17333d]">{entry.wrongCount}</div>
                    </div>
                    
                    <div className="bg-[#f1eee7] rounded-lg p-3 border border-[#d8d4c9]">
                      <div className="flex items-center gap-2 text-[#687579] mb-1">
                        <MinusCircle className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase">Skipped</span>
                      </div>
                      <div className="text-xl font-bold text-[#17333d]">{entry.skippedCount}</div>
                    </div>
                    
                    <div className="bg-[#f5e9d5] rounded-lg p-3 border border-[#ead9bd]">
                      <div className="flex items-center gap-2 text-[#98672a] mb-1">
                        <span className="text-[10px] font-bold uppercase">Accuracy</span>
                      </div>
                      <div className="text-xl font-bold text-[#17333d]">
                        {entry.correctCount + entry.wrongCount > 0 
                          ? Math.round((entry.correctCount / (entry.correctCount + entry.wrongCount)) * 100) 
                          : 0}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <Button onClick={() => setLocation(`/result?testId=${entry.testId}&token=${token}`)} className="bg-[#17333d] hover:bg-[#284855] text-white">
                      <BarChart3 className="mr-2 h-4 w-4" /> View Detailed Analysis
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          {history?.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-[#faf9f5] border border-[#d8d4c9] rounded-full flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-[#8a9697]" />
              </div>
              <h3 className="text-lg font-bold text-[#17333d]">No history yet</h3>
              <p className="text-[#687579] mt-1">Submit your first mock test to see analysis here.</p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
