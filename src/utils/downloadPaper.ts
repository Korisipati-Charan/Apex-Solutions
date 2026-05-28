import { ExamSetup } from "../types";

/**
 * Generates an elegant, beautifully structured Markdown document of the custom-generated
 * exam setup, containing the structured papers, question sheets, and a dedicated solutions
 * answer-key appendix at the bottom. Triggered directly via standard browser download.
 */
export function downloadQuestionPaper(setup: ExamSetup) {
  if (!setup || !setup.papers) return;

  const sanitizeFileName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/(^_+|_+$)/g, "");
  };

  const fileSlug = sanitizeFileName(setup.title || "apex_assessment");
  const fileName = `${fileSlug}_question_paper.md`;

  let md = "";

  // Title Banner Card
  md += `# APEX DIAMOND DIAGNOSTIC EXAM SHEET\n\n`;
  md += `## General Assessment Details\n`;
  md += `- **Assessment Title:** ${setup.title}\n`;
  md += `- **Focus Syllabus Modules:** ${setup.skills.join(", ") || "General Developer Alignment"}\n`;
  md += `- **Total Papers Compiled:** ${setup.papers.length}\n`;
  md += `- **Single-Paper Duration:** ${setup.paperDurationMins} minutes\n`;
  md += `- **Intermission Break:** ${setup.breakDurationMins} minutes\n`;
  md += `- **System Compilation Timestamp:** ${new Date(setup.createdAt).toLocaleString()}\n\n`;
  md += `> **Pedagogic Notice:** This paper has been synthesized using professional evaluation paradigms. Attempt each section independently under the specified diagnostic constraints.\n\n`;
  md += `* * *\n\n`;

  // Papers and Questions
  setup.papers.forEach((paper, pIdx) => {
    md += `# SECTION ${pIdx + 1}: ${paper.name.toUpperCase()}\n`;
    md += `*Target Duration: ${paper.durationMins} Minutes | Total Section Questions: ${paper.questions.length}*\n\n`;
    md += `* * *\n\n`;

    paper.questions.forEach((q, qIdx) => {
      md += `### Question ${qIdx + 1} (Module Focus: ${q.skill})\n\n`;
      md += `${q.text.trim()}\n\n`;

      if (q.codeSnippet && q.codeSnippet.trim()) {
        md += `\`\`\`typescript\n`;
        md += `${q.codeSnippet.trim()}\n`;
        md += `\`\`\`\n\n`;
      }

      md += `**Available Options:**\n`;
      const optionLabels = ["A", "B", "C", "D"];
      q.options.forEach((opt, oIdx) => {
        const letter = optionLabels[oIdx] || String.fromCharCode(65 + oIdx);
        // Clean prefix if already exists, else add letter
        const cleanedOpt = opt.replace(/^[A-DA-D]\.\s*/i, "");
        md += `- [ ] **${letter})** ${cleanedOpt}\n`;
      });

      md += `\n* * *\n\n`;
    });
  });

  // Appendix: Answer Key and Explanations
  md += `# APPENDIX: MASTER SOLUTIONS KEY & EXPLANATORY REPORT\n`;
  md += `Use this catalog to evaluate response alignments, understand edge-case pitfalls, and master targeted technical concepts.\n\n`;
  md += `* * *\n\n`;

  setup.papers.forEach((paper, pIdx) => {
    md += `## Section Solutions: ${paper.name}\n\n`;

    paper.questions.forEach((q, qIdx) => {
      md += `#### Q${qIdx + 1} Alignment Solution: **Option ${q.correctAnswer}**\n`;
      md += `**Tested Concept:** \`${q.skill}\`\n\n`;
      md += `**Pedagogical Evaluation Explanatory Log:**\n`;
      md += `${q.explanation}\n\n`;
      md += `* - -\n\n`;
    });
  });

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
