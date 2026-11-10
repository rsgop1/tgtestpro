const fs = require('fs');
let content = fs.readFileSync('orig-reports.tsx', 'utf8');

// Update Report interface safely
content = content.replace(/status: "open" \| "resolved";/, 'status: "open" | "resolved";\n  reason: string | null;');

// Add reason mutate safely
content = content.replace(/const deleteMut = useMutation\(\{/, `
  const updateReasonMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => 
      apiFetch(\`/reports/\${id}\`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ title: "Reason updated" });
    }
  });
  const deleteMut = useMutation({`);

// Add Edit Question state & fetch
content = content.replace(/const \[adminNote, setAdminNote\] = useState\(""\);/, `const [adminNote, setAdminNote] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [testData, setTestData] = useState<any | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);`);

content = content.replace(/const selectedReport = allReports\.find\(\(r\) => r\.id === selectedReportId\);/, `const selectedReport = allReports.find((r) => r.id === selectedReportId);
  const fetchTest = async (testId: string) => {
    try {
      const res = await apiFetch(\`/tests/\${testId}\`);
      setTestData(res);
      if (selectedReport && res.questionsData && res.questionsData[selectedReport.questionIndex]) {
        setEditingQuestion(res.questionsData[selectedReport.questionIndex]);
      }
    } catch(e) { console.error(e); }
  };
  
  const saveEditedQuestion = async () => {
    if (!testData || !selectedReport || !editingQuestion) return;
    setSavingQuestion(true);
    try {
      const updatedQuestions = [...testData.questionsData];
      updatedQuestions[selectedReport.questionIndex] = editingQuestion;
      await apiFetch(\`/tests/\${testData.testId}\`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionsJson: JSON.stringify(updatedQuestions) })
      });
      toast({ title: "Question updated successfully" });
      setEditingQuestion(null);
    } catch(e) {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSavingQuestion(false);
    }
  };
`);

// Add 'Edit Question' button
content = content.replace(/<FileText className="h-4 w-4 text-primary" \/> Question Context\s*<\/h3>/, `<FileText className="h-4 w-4 text-primary" /> Question Context
                    </h3>
                    <div className="absolute right-6 mt-[-36px]">
                      {!editingQuestion && (
                        <Button variant="outline" size="sm" onClick={() => fetchTest(selectedReport.testId)}>Edit Question</Button>
                      )}
                    </div>`);

// Add Edit Form UI safely
const editFormUI = `{editingQuestion ? (
  <div className="p-4 rounded-lg border bg-card space-y-4 mb-4">
    <div>
      <Label>Question Text</Label>
      <Textarea className="mt-1" value={editingQuestion.question} onChange={e => setEditingQuestion({...editingQuestion, question: e.target.value})} />
    </div>
    {editingQuestion.options.map((opt: string, idx: number) => (
      <div key={idx} className="flex gap-2 items-center">
        <input type="radio" checked={editingQuestion.correctOptionIndex === idx} onChange={() => setEditingQuestion({...editingQuestion, correctOptionIndex: idx})} />
        <Input value={opt} onChange={e => {
          const newOpts = [...editingQuestion.options];
          newOpts[idx] = e.target.value;
          setEditingQuestion({...editingQuestion, options: newOpts});
        }} />
      </div>
    ))}
    <div>
      <Label>Explanation</Label>
      <Textarea className="mt-1" value={editingQuestion.explanation} onChange={e => setEditingQuestion({...editingQuestion, explanation: e.target.value})} />
    </div>
    <div className="flex gap-2">
      <Button size="sm" onClick={saveEditedQuestion} disabled={savingQuestion}>Save Changes</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(null)}>Cancel</Button>
    </div>
  </div>
) : null}`;

content = content.replace(/<div className="bg-muted p-4 rounded-lg">/, `${editFormUI}\n<div className="bg-muted p-4 rounded-lg className={\`\${editingQuestion ? 'hidden' : ''}\`}">`);

// Add Reason Assign
const reasonHTML = `{/* Reason Assignment */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground border-b pb-2">Category / Reason</h3>
                    <Select value={selectedReport.reason || "none"} onValueChange={(val) => updateReasonMut.mutate({ id: selectedReport.id, reason: val === "none" ? "" : val })}>
                      <SelectTrigger><SelectValue placeholder="Categorize this report..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        <SelectItem value="Typo">Typo / Spelling Mistake</SelectItem>
                        <SelectItem value="Incorrect Answer">Incorrect Answer Key</SelectItem>
                        <SelectItem value="Poor Explanation">Poor / Wrong Explanation</SelectItem>
                        <SelectItem value="Irrelevant Question">Irrelevant Question</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>`;
content = content.replace(/\{\/\* Resolution Input \*\/\}/, `${reasonHTML}\n                  {/* Resolution Input */}`);

fs.writeFileSync('artifacts/admin-panel/src/pages/reports.tsx', content);
