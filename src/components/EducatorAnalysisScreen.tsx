import React, { useState } from "react";
import { EducatorAnalysis, ExamSetup, CandidateResponse, Question } from "../types";
import { Award, Target, Flame, ChevronRight, CheckCircle2, XCircle, ChevronDown, ChevronUp, BookOpen, RefreshCw, Download } from "lucide-react";
import { downloadQuestionPaper } from "../utils/downloadPaper";
import { downloadAssessmentReportCard } from "../utils/downloadReportCard";

interface EducatorAnalysisScreenProps {
  analysis: EducatorAnalysis;
  setup: ExamSetup;
  answers: Record<number, Record<string, CandidateResponse>>;
  onRestart: () => void;
}

export default function EducatorAnalysisScreen({
  analysis,
  setup,
  answers,
  onRestart
}: EducatorAnalysisScreenProps) {
  const [expandedPaperId, setExpandedPaperId] = useState<number | null>(1);
  const [showFullReview, setShowFullReview] = useState(false);

  // Math helper
  const totalQuestionsSumOnPapers = setup.papers.reduce((sum, p) => sum + p.questions.length, 0);
  
  // Calculate correct answers
  let totalCorrect = 0;
  setup.papers.forEach((p) => {
    p.questions.forEach((q) => {
      const resp = answers[p.id]?.[q.id];
      if (resp && resp.selectedOption === q.correctAnswer) {
        totalCorrect++;
      }
    });
  });

  const aggregatePercentage = totalQuestionsSumOnPapers > 0 
    ? Math.round((totalCorrect / totalQuestionsSumOnPapers) * 100) 
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-slate-800 space-y-8 animate-fade-in">
      
      {/* Visual Report Logo Header */}
      <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50/50">
            <Award className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-mono font-bold text-indigo-700">Evaluation Kernel Active</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-800">
            Candidate Performance Diagnostic
          </h1>
          <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
            Logic-gate analysis compiled by our Industry-Standard Evaluation Kernel. Review metrics, targeted study concepts, and your personalized week-by-week study sprints.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => { downloadAssessmentReportCard(setup, answers, analysis); }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 border-none transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-xs font-bold text-white"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download Report Card (MD)</span>
            </button>
            <button
              type="button"
              onClick={() => { downloadQuestionPaper(setup); }}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-xs font-bold text-slate-600"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Download Raw Paper (MD)</span>
            </button>
          </div>
        </div>

        {/* Score Ring / Badge */}
        <div className="flex items-center gap-4 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="40" cy="40" r="34" className="stroke-slate-100 fill-none" strokeWidth="5" />
              <circle
                cx="40"
                cy="40"
                 r="34"
                className="stroke-indigo-600 fill-none transition-all duration-1000"
                strokeWidth="5"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - aggregatePercentage / 100)}
              />
            </svg>
            <span className="text-xl font-mono font-bold text-slate-800">{aggregatePercentage}%</span>
          </div>
          <div className="space-y-0.5">
            <span className="block text-slate-400 text-[9px] font-mono font-bold uppercase tracking-widest leading-none mb-1">Aggregate Grade</span>
            <span className="block text-sm font-bold text-slate-700">{totalCorrect} / {totalQuestionsSumOnPapers} Correct</span>
            <span className="block text-xs text-slate-500">across {setup.papers.length} Papers</span>
          </div>
        </div>
      </div>

      {/* Main Analysis Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Overview feedback, Strengths, Weak spots (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Summary Feedback Board */}
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <h2 className="text-sm font-bold font-display uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              System Evaluation Synthesis
            </h2>
            <div className="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200">
              {analysis.summary}
            </div>
          </div>

          {/* Strengths & Weak Areas Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Strengths Board */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-550 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Target Strengths
              </h2>
              <ul className="space-y-3">
                {analysis.strengths.map((str, idx) => (
                  <li key={idx} className="text-xs text-slate-600 flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Weak Spots Board */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
              <h2 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-550 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                Weak Areas & Gaps
              </h2>
              <div className="space-y-4">
                {analysis.weakAreas.map((wa, idx) => (
                  <div key={idx} className="space-y-1 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="block text-xs font-bold text-rose-600 font-mono">{wa.skillName}</span>
                    <p className="text-[11px] text-slate-500 leading-normal">{wa.gapDescription}</p>
                    <span className="block text-[10px] text-indigo-700 font-bold mt-1">To Study: {wa.keyConceptToMaster}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Week-by-Week Developer Project Sprints */}
          {analysis.recommendationRoadmap && (
            <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">Mastery Roadmap</span>
                <h2 className="text-base font-bold font-display text-slate-805">
                  {analysis.recommendationRoadmap.title}
                </h2>
                <p className="text-xs text-slate-500 leading-normal">
                  {analysis.recommendationRoadmap.description}
                </p>
              </div>

              {/* Sprints checklist items */}
              <div className="space-y-4 pt-2">
                {Array.isArray(analysis.recommendationRoadmap.weeks) && analysis.recommendationRoadmap.weeks.map((weekObj, wIdx) => (
                  <div key={wIdx} className="flex gap-4 items-start relative pb-4 last:pb-0">
                    {/* Vertical Line Anchor for Timeline */}
                    {wIdx < (analysis.recommendationRoadmap?.weeks?.length ?? 0) - 1 && (
                      <div className="absolute top-5 left-3 select-none w-0.5 h-[calc(100%-8px)] bg-slate-100" />
                    )}
                    {/* Icon step */}
                    <div className="z-10 w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-[10px] font-mono font-bold text-indigo-600">
                      {wIdx + 1}
                    </div>
                    
                    {/* Step details inside box */}
                    <div className="space-y-2 p-4 rounded-xl border border-slate-200 bg-slate-50 w-full">
                      <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5 mb-1.5">
                        <span className="text-xs font-mono font-bold text-slate-700">{weekObj.week}</span>
                        <span className="text-[11px] text-indigo-600 font-bold">{weekObj.topic}</span>
                      </div>
                      {/* Actions list */}
                      <ul className="space-y-1.5 pl-1">
                        {Array.isArray(weekObj.actions) && weekObj.actions.map((act, aIdx) => (
                          <li key={aIdx} className="text-xs text-slate-600 flex items-start gap-1.5 leading-normal">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Skill Scores Visual Report & Actions (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Scores breakdown card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-600" />
              Syllabus Module Scores
            </h2>

            {/* Custom SVG/Relative Interactive bars mapped purely with code style */}
            <div className="space-y-4">
              {analysis.skillScores.map((score, sIdx) => (
                <div key={sIdx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-semibold truncate max-w-[140px]">{score.skill}</span>
                    <span className="text-slate-500 font-mono font-bold">{score.correct}/{score.total} Correct ({Math.round(score.percentage)}%)</span>
                  </div>
                  
                  {/* Progress Line */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        score.percentage >= 70
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : score.percentage >= 40
                          ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-rose-500 to-red-500"
                      }`}
                      style={{ width: `${score.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action button: Try again */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
              Review Term Actions
            </h3>
            <p className="text-xs text-slate-400 leading-normal">
              Save a high-fidelity offline copy of your evaluation scorecard & syllabus parameters, or reboot to configure a new assessment.
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => { downloadAssessmentReportCard(setup, answers, analysis); }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border-none text-xs font-bold text-white"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Download Report Card (MD)</span>
              </button>

              <button
                type="button"
                onClick={() => { downloadQuestionPaper(setup); }}
                className="w-full py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-xs font-bold text-indigo-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Download Raw Paper (MD)</span>
              </button>

              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Configure New Assessment</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* FOOTER AREA PANEL: Reviews detailed Question-by-Question breakdown */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-md font-bold font-display text-slate-800">
              Exam Submission Log File
            </h3>
            <p className="text-slate-500 text-xs">
              Scroll through correct solutions, detailed option breakdowns, and explanations.
            </p>
          </div>
          <button
            onClick={() => setShowFullReview(!showFullReview)}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-slate-600 transition-colors cursor-pointer shadow-sm"
          >
            <span>{showFullReview ? "Collapse Solutions" : "Review All Answers"}</span>
            {showFullReview ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {showFullReview && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {setup.papers.map((p) => (
              <div key={p.id} className="space-y-4">
                <button
                  onClick={() => setExpandedPaperId(expandedPaperId === p.id ? null : p.id)}
                  className="w-full flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-sm font-bold text-indigo-700 transition-colors cursor-pointer"
                >
                  <span>{p.name} Breakdown Log</span>
                  {expandedPaperId === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandedPaperId === p.id && (
                  <div className="pl-2 space-y-5">
                    {p.questions.map((q, qIdx) => {
                      const ans = answers[p.id]?.[q.id];
                      const chosenLetter = ans ? ans.selectedOption : "No Answer";
                      const isCorrect = chosenLetter === q.correctAnswer;

                      return (
                        <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">QA Log {qIdx + 1}</span>
                            <span className="text-xs font-mono font-bold text-indigo-600">{q.skill}</span>
                          </div>

                          <span className="block text-sm font-semibold text-slate-800 leading-normal">{q.text}</span>

                          {q.codeSnippet && (
                            <pre className="p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono text-sky-850 whitespace-pre overflow-x-auto">
                              {q.codeSnippet}
                            </pre>
                          )}

                          {/* Options grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                            {q.options.map((opt, oIdx) => {
                              const letter = ["A", "B", "C", "D"][oIdx];
                              const isThisCorrect = letter === q.correctAnswer;
                              const isThisChosen = letter === chosenLetter;

                              let bgClass = "bg-white border-slate-200 text-slate-600";
                              if (isThisCorrect) {
                                bgClass = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-sm";
                              } else if (isThisChosen) {
                                bgClass = "bg-rose-50 border-rose-300 text-rose-800 font-bold";
                              }

                              return (
                                <div key={oIdx} className={`p-2.5 rounded-lg border flex items-center gap-2 ${bgClass}`}>
                                  <span className="font-mono font-bold w-4 text-[13px]">{letter}.</span>
                                  <span className="text-[11.5px]">{opt.replace(/^[A-D]\.\s*/, "")}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation text */}
                          <div className="p-4 bg-white rounded-xl text-xs border border-slate-200 leading-relaxed text-slate-600 space-y-1">
                            <span className="block text-[9px] font-mono uppercase font-bold text-slate-400">Explanation File</span>
                            <p>{q.explanation}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
