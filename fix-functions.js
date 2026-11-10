const fs = require('fs');
let content = fs.readFileSync('artifacts/admin-panel/src/pages/reports.tsx', 'utf8');

const funcs = `
  const fetchTest = async (testId: string) => {
    try {
      const { apiFetch } = await import("@workspace/api-client-react");
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
      const { apiFetch } = await import("@workspace/api-client-react");
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
`;

content = content.replace(
  /const selectedReport = allReports.find\(r => r.id === selectedReportId\);/g,
  `const selectedReport = allReports.find(r => r.id === selectedReportId);\n${funcs}`
);

fs.writeFileSync('artifacts/admin-panel/src/pages/reports.tsx', content);
