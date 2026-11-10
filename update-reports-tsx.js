const fs = require('fs');
let content = fs.readFileSync('orig-reports.tsx', 'utf8');

// Update Report interface
content = content.replace(/status: "open" | "resolved";/, 'status: "open" | "resolved";\n  reason: string | null;');

// Add reason mutate
content = content.replace(/const deleteMut = useMutation\(\{/, `
  const updateReasonMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => 
      apiFetch(\`/reports/\${id}\`, { method: "PATCH", body: JSON.stringify({ reason }) }),
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

// Add 'Edit Question' button and 'Reason' dropdown to SheetContent
const reportContentRegex = /<h3 className="text-sm font-semibold flex items-center gap-2 text-foreground border-b pb-2">\s*<FileText className="h-4 w-4 text-primary" \/> Question Context\s*<\/h3>/;

const newQuestionContext = `<h3 className="text-sm font-semibold flex items-center justify-between text-foreground border-b pb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Question Context
                      </div>
                      {!editingQuestion && (
                        <Button variant="outline" size="sm" onClick={() => fetchTest(selectedReport.testId)}>Edit Question</Button>
                      )}
                    </h3>`;

content = content.replace(reportContentRegex, newQuestionContext);

const editFormUI = `{editingQuestion ? (
  <div className="mt-4 p-4 border rounded-lg bg-card space-y-4">
    <div>
      <Label>Question Text</Label>
      <Textarea value={editingQuestion.question} onChange={e => setEditingQuestion({...editingQuestion, question: e.target.value})} />
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
      <Textarea value={editingQuestion.explanation} onChange={e => setEditingQuestion({...editingQuestion, explanation: e.target.value})} />
    </div>
    <div className="flex gap-2">
      <Button size="sm" onClick={saveEditedQuestion} disabled={savingQuestion}>Save Changes</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(null)}>Cancel</Button>
    </div>
  </div>
) : (`;

content = content.replace(/<div className="bg-muted p-4 rounded-lg">/, `<div className="bg-muted p-4 rounded-lg">\n${editFormUI}`);

content = content.replace(/<\/div>\s*<\/div>\s*\{\/\* Resolution Input \*\/\}/, `</div>\n)}</div>\n</div>\n\n{/* Reason Assignment */}\n<div className="space-y-2">\n  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground border-b pb-2">Category / Reason</h3>\n  <Select value={selectedReport.reason || "none"} onValueChange={(val) => updateReasonMut.mutate({ id: selectedReport.id, reason: val === "none" ? "" : val })}>\n    <SelectTrigger><SelectValue placeholder="Categorize this report..." /></SelectTrigger>\n    <SelectContent>\n      <SelectItem value="none">Uncategorized</SelectItem>\n      <SelectItem value="Typo">Typo / Spelling Mistake</SelectItem>\n      <SelectItem value="Incorrect Answer">Incorrect Answer Key</SelectItem>\n      <SelectItem value="Poor Explanation">Poor / Wrong Explanation</SelectItem>\n      <SelectItem value="Irrelevant Question">Irrelevant Question</SelectItem>\n      <SelectItem value="Other">Other</SelectItem>\n    </SelectContent>\n  </Select>\n</div>\n\n{/* Resolution Input */}`);

fs.writeFileSync('artifacts/admin-panel/src/pages/reports.tsx', content);
