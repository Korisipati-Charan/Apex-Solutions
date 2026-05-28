import { ExamSetup, EducatorAnalysis, CandidateResponse } from "../types";

/**
 * Generates an elegant, detailed Markdown performance report card for the candidate.
 * Includes scores, percentages, grades, strengths, weaknesses, recommendation roadmaps,
 * and a response log of standard solutions.
 */
export function downloadAssessmentReportCard(
  setup: ExamSetup,
  answers: Record<number, Record<string, CandidateResponse>>,
  analysis: EducatorAnalysis
) {
  if (!setup || !analysis) return;

  const sanitizeFileName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");
  };

  const fileSlug = sanitizeFileName(setup.title || "apex_solutions_assessment");
  const fileName = `${fileSlug}_performance_report_card.md`;

  // Calculate high-fidelity metrics
  const totalQuestionsSumOnPapers = setup.papers.reduce((sum, p) => sum + p.questions.length, 0);
  
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalUnanswered = 0;

  setup.papers.forEach((p) => {
    p.questions.forEach((q) => {
      const resp = answers[p.id]?.[q.id];
      if (!resp || resp.selectedOption === null || resp.selectedOption === undefined) {
        totalUnanswered++;
      } else if (resp.selectedOption === q.correctAnswer) {
        totalCorrect++;
      } else {
        totalIncorrect++;
      }
    });
  });

  const percentage = totalQuestionsSumOnPapers > 0 
    ? Math.round((totalCorrect / totalQuestionsSumOnPapers) * 100) 
    : 0;

  let grade = "Needs Improvement";
  let gradeLetter = "F";
  if (percentage >= 90) {
    grade = "Distinguished Expertise";
    gradeLetter = "A+";
  } else if (percentage >= 80) {
    grade = "Superior Alignment";
    gradeLetter = "A";
  } else if (percentage >= 70) {
    grade = "Competent/Aligned";
    gradeLetter = "B";
  } else if (percentage >= 60) {
    grade = "Basic Compliance";
    gradeLetter = "C";
  }

  let md = "";

  md += `# 🏆 APEX SOLUTIONS ASSESSMENT ALIGNMENT REPORT CARD\n\n`;
  md += `## 📊 SECTION 1: MASTER DIAGNOSTIC SCORECARD SUMMARY\n\n`;
  md += `| Evaluation Parameter | Value | Alignment Indicator |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Assessment Title** | ${setup.title} | Technical Profile |\n`;
  md += `| **Evaluation Grade** | **${gradeLetter}** (${grade}) | Score-Based Band |\n`;
  md += `| **Aggregate Accuracy** | **${percentage}%** | Precision Index |\n`;
  md += `| **Total Correct Items** | **${totalCorrect}** / ${totalQuestionsSumOnPapers} | Validation Ratio |\n`;
  md += `| **Incorrect Items** | **${totalIncorrect}** | Divergence Count |\n`;
  md += `| **Skipped Items** | **${totalUnanswered}** | Omission Count |\n`;
  md += `| **Compilation Time** | ${new Date().toLocaleString()} | Diagnostics Log |\n\n`;

  md += `* * *\n\n`;

  // Section 2: Skill-by-Skill Analytics
  md += `## 🎯 SECTION 2: DETAILED SKILL COMPETENCY BOARD\n\n`;
  md += `Below is your targeted performance across individual technical concepts specified in the examiner syllabus:\n\n`;
  md += `| Skill Concept Profile | Correct Answers | Accuracy Rate | Recommended Mastery Status |\n`;
  md += `| :--- | :---: | :---: | :--- |\n`;

  if (analysis.skillScores && analysis.skillScores.length > 0) {
    analysis.skillScores.forEach((score) => {
      let status = "⚠️ Deficit / Review Immediately";
      if (score.percentage >= 85) status = "⭐️ High Proficiency / Aligned";
      else if (score.percentage >= 65) status = "✅ Adequate Proficiency / Stable";

      md += `| \`${score.skill}\` | ${score.correct} / ${score.total} | **${score.percentage}%** | ${status} |\n`;
    });
  } else {
    // Dynamic recalculation of skill scores as fallback
    const skillMap: Record<string, { correct: number; total: number }> = {};
    setup.papers.forEach((p) => {
      p.questions.forEach((q) => {
        if (!skillMap[q.skill]) skillMap[q.skill] = { correct: 0, total: 0 };
        skillMap[q.skill].total++;
        const resp = answers[p.id]?.[q.id];
        if (resp && resp.selectedOption === q.correctAnswer) {
          skillMap[q.skill].correct++;
        }
      });
    });

    Object.entries(skillMap).forEach(([skill, data]) => {
      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      let status = "⚠️ Deficit / Review Immediately";
      if (pct >= 85) status = "⭐️ High Proficiency / Aligned";
      else if (pct >= 65) status = "✅ Adequate Proficiency / Stable";

      md += `| \`${skill}\` | ${data.correct} / ${data.total} | **${pct}%** | ${status} |\n`;
    });
  }
  md += `\n* * *\n\n`;

  // Section 3: System Evaluation Synthesis
  md += `## 📝 SECTION 3: SYSTEM EVALUATION SYNTHESIS\n\n`;
  md += `> **Direct Feedback Summary:**\n`;
  md += `> ${analysis.summary.trim()}\n\n`;

  md += `### 💡 Identified Performance Strengths\n`;
  analysis.strengths.forEach((str) => {
    md += `- **[STRENGTH]** ${str}\n`;
  });
  md += `\n`;

  md += `### 🔬 Identified Skill Gaps & Review Suggestions\n`;
  analysis.weakAreas.forEach((wa) => {
    md += `#### 🔴 Concept: \`${wa.skillName}\`\n`;
    md += `- **Discrepancy:** ${wa.gapDescription}\n`;
    md += `- **Action Item to Master:** Study and review \`${wa.keyConceptToMaster}\` immediately.\n\n`;
  });

  md += `* * *\n\n`;

  // Section 4: Recommendation Roadmap Sprints
  if (analysis.recommendationRoadmap) {
    md += `## 📅 SECTION 4: PROFESSIONAL 4-WEEK MASTERY ROADMAP\n\n`;
    md += `### **Roadmap Title:** ${analysis.recommendationRoadmap.title || "Custom Study Roadmap"}\n`;
    if (analysis.recommendationRoadmap.description) {
      md += `*${analysis.recommendationRoadmap.description}*\n\n`;
    }

    if (Array.isArray(analysis.recommendationRoadmap.weeks)) {
      analysis.recommendationRoadmap.weeks.forEach((wk) => {
        md += `### 🗓️ **${wk.week || "Review Phase"}: ${wk.topic || "Core Review"}**\n`;
        if (Array.isArray(wk.actions)) {
          wk.actions.forEach((act) => {
            md += `- [ ] ${act}\n`;
          });
        }
        md += `\n`;
      });
    }

    md += `* * *\n\n`;
  }

  // Section 5: Response Logs & Complete Solutions Appendix
  md += `## 🔍 SECTION 5: CANDIDATE RESPONSE HISTORY & VERIFICATION UTILITIES\n\n`;
  md += `Review your chosen response options alongside formal correct answers and standard educational logs.\n\n`;

  setup.papers.forEach((paper, pIdx) => {
    md += `### 📋 Section: ${paper.name}\n\n`;

    paper.questions.forEach((q, qIdx) => {
      const resp = answers[paper.id]?.[q.id];
      const selected = resp?.selectedOption || "*Unanswered*";
      const isCorrect = resp && resp.selectedOption === q.correctAnswer;
      const statusIcon = isCorrect ? "✅ [CORRECT]" : "❌ [INCORRECT]";

      md += `#### **Q${qIdx + 1}: ${q.text.trim()}**\n\n`;

      if (q.codeSnippet && q.codeSnippet.trim()) {
        md += `\`\`\`typescript\n`;
        md += `${q.codeSnippet.trim()}\n`;
        md += `\`\`\`\n\n`;
      }

      md += `- **Selected Answer:** Option \`${selected}\`\n`;
      md += `- **Correct Answer:** Option \`${q.correctAnswer}\`\n`;
      md += `- **Result Status:** ${statusIcon}\n`;
      if (resp?.scratchpad && resp.scratchpad.trim()) {
        md += `- **Candidate Scratchpad Draft:** \`_${resp.scratchpad.trim()}_\`\n`;
      }
      md += `- **Logic Core Solution Log:** ${q.explanation}\n\n`;
      md += `* - -\n\n`;
    });
  });

  md += `\n* * * \n`;
  md += `*Report processed and compiled by the **Apex Solutions Diagnostic Evaluation Kernel**.*`;

  // Write file to standard client-side download buffer
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
