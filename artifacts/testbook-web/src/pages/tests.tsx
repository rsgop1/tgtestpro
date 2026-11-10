import { useState } from "react";
import { Layout } from "../components/layout.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PlayCircle, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

export function TestsPage() {
  const [token] = useState(localStorage.getItem("learner_token") || "");
  const [, setLocation] = useLocation();
  
  const { data: tests, isLoading } = useQuery({
    queryKey: ['learner-tests', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json().then(d => d.tests);
    },
    enabled: !!token
  });

  return (
    <Layout>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Mock Tests</h1>
        <p className="text-muted-foreground">Access all premium mock tests available on the platform.</p>
      </div>

      {isLoading ? (
        <div className="py-10 text-center">Loading tests...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests?.map((test: any) => (
            <Card key={test.testId} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                    {test.mainCategory}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {test.type === "live" ? "Live Test" : "Mock Test"}
                  </span>
                </div>
                <CardTitle className="text-lg mt-3 leading-tight">{test.testName}</CardTitle>
                <CardDescription className="line-clamp-1">{test.subCategory}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    <span>{test.questionCount} Qs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{Math.floor(test.timerSeconds / 60)} mins</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => setLocation(`/test?testId=${test.testId}&token=${token}`)}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                </Button>
              </CardContent>
            </Card>
          ))}
          {tests?.length === 0 && (
            <div className="col-span-full py-10 text-center text-muted-foreground">
              No mock tests available right now.
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
