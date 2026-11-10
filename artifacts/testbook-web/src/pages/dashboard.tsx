import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Button } from "../components/ui/button.tsx";
import { BookOpen, Trophy, Target, Activity, Clock, PlayCircle, FileText, ChevronRight } from "lucide-react";
import { Layout } from "../components/layout.tsx";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export function DashboardPage() {
  const [token] = useState(localStorage.getItem("learner_token") || "");
  const [profile, setProfile] = useState<any>(null);
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!token) {
      setLocation("/login");
      return;
    }
    fetch(`/api/learner/profile?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) setLocation("/login");
        else setProfile(data);
      })
      .catch(() => setLocation("/login"));
  }, [token, setLocation]);

  const { data: recentTests } = useQuery({
    queryKey: ['learner-tests-recent', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/tests`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.tests?.slice(0, 3) || [];
    },
    enabled: !!token
  });

  const { data: recentHistory } = useQuery({
    queryKey: ['learner-history-recent', token],
    queryFn: async () => {
      const res = await fetch(`/api/learner/history`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.history?.slice(0, 3) || [];
    },
    enabled: !!token
  });

  if (!profile) return <Layout><div className="flex justify-center items-center h-[50vh]">Loading dashboard...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#17333d]">Welcome back, {profile?.fullName?.split(" ")[0] || "Learner"}!</h1>
        <p className="text-[#687579]">Here is an overview of your mock test progress.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-[#d8d4c9] bg-[#faf9f5]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#56656a]">Tests Attempted</CardTitle>
            <BookOpen className="h-4 w-4 text-[#287e70]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#17333d]">{profile?.testsTaken ?? 0}</div>
            <p className="text-xs text-[#8a9697] mt-1">Total mock tests submitted</p>
          </CardContent>
        </Card>

        <Card className="border-[#d8d4c9] bg-[#faf9f5]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#56656a]">Avg Accuracy</CardTitle>
            <Target className="h-4 w-4 text-[#287e70]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#17333d]">{profile?.accuracyRate ? profile.accuracyRate.toFixed(1) : "0"}%</div>
            <p className="text-xs text-[#8a9697] mt-1">Across all sections</p>
          </CardContent>
        </Card>

        <Card className="border-[#d8d4c9] bg-[#faf9f5]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#56656a]">Target Exam</CardTitle>
            <Activity className="h-4 w-4 text-[#287e70]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-[#17333d] mt-1 truncate">{profile?.examTarget ?? "Not Set"}</div>
            <p className="text-xs text-[#8a9697] mt-1">Current preparation goal</p>
          </CardContent>
        </Card>

        <Card className="border-transparent bg-[#17333d] text-[#f4f0e6]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#afc1c3]">Referral Coins</CardTitle>
            <Trophy className="h-4 w-4 text-[#70c3ae]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{profile?.coins ?? 0}</div>
            <p className="text-xs text-[#afc1c3] mt-1">Earn more by inviting friends</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recommended Tests Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#17333d]">Available Mock Tests</h2>
            <Link href="/tests" className="text-sm font-semibold text-[#287e70] hover:underline flex items-center">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentTests?.length ? recentTests.map((test: any) => (
              <Card key={test.testId} className="border-[#d8d4c9] bg-white transition-colors hover:border-[#287e70]">
                <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#287e70] bg-[#e1f0ea] px-2 py-1 rounded">
                      {test.mainCategory}
                    </span>
                    <h3 className="font-bold text-[#17333d] mt-2">{test.testName}</h3>
                    <div className="flex items-center gap-3 text-xs text-[#687579] mt-2">
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3"/> {test.questionCount} Qs</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {Math.floor(test.timerSeconds / 60)} mins</span>
                    </div>
                  </div>
                  <Button onClick={() => setLocation(`/test?testId=${test.testId}&token=${token}`)} className="w-full sm:w-auto bg-[#287e70] hover:bg-[#1f6358] text-white">
                    <PlayCircle className="h-4 w-4 mr-2"/> Start
                  </Button>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-dashed border-[#d8d4c9] bg-transparent">
                <CardContent className="p-8 text-center text-[#687579] text-sm">
                  No mock tests available right now.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent History Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#17333d]">Recent Attempts</h2>
            <Link href="/history" className="text-sm font-semibold text-[#287e70] hover:underline flex items-center">
              View History <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentHistory?.length ? recentHistory.map((attempt: any) => (
              <Card key={attempt.id} className="border-[#d8d4c9] bg-[#faf9f5]">
                <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h3 className="font-bold text-[#17333d]">Attempt #{attempt.id}</h3>
                    <div className="text-xs text-[#8a9697] mt-1">{new Date(attempt.completedAt).toLocaleDateString()}</div>
                    <div className="flex items-center gap-3 text-sm font-medium mt-3">
                      <span className="text-[#287e70]">{attempt.score}/{attempt.maxScore} Score</span>
                      <span className="text-[#56656a]">·</span>
                      <span className="text-[#17333d]">{attempt.accuracy}% Accuracy</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto border-[#d8d4c9] text-[#56656a] hover:bg-[#f1eee7]" onClick={() => setLocation(`/result?testId=${attempt.testId}&token=${token}`)}>
                    Analysis
                  </Button>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-dashed border-[#d8d4c9] bg-transparent">
                <CardContent className="p-8 text-center text-[#687579] text-sm">
                  You haven't attempted any tests yet.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
