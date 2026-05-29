import React, { useState, useEffect, useCallback } from "react";
import { Question, Paper, CandidateResponse } from "../types";
import { Clock, HelpCircle, Save, BookOpen, AlertTriangle, Play, Pause, ChevronLeft, ChevronRight, Bookmark, ArrowRight, ShieldCheck } from "lucide-react";

interface ActiveExamTerminalProps {
  paper: Paper;
  answers: Record<string, CandidateResponse>;
  timeRemainingSecs: number;
  isPaused: boolean;
  onPauseChange: (isPaused: boolean) => void;
  onSelectOption: (questionId: string, option: string) => void;
  onToggleFlag: (questionId: string) => void;
  onUpdateScratchpad: (questionId: string, text: string) => void;
  onSubmitPaper: () => void;
}

export default function ActiveExamTerminal({
  paper,
  answers,
  timeRemainingSecs,
  isPaused,
  onPauseChange,
  onSelectOption,
  onToggleFlag,
  onUpdateScratchpad,
  onSubmitPaper
}: ActiveExamTerminalProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const activeQuestion: Question | undefined = paper.questions[activeIdx];

  // Check if current question is flagged or answered
  const isQuestionAnswered = (qId: string) => answers[qId]?.selectedOption !== null && answers[qId]?.selectedOption !== undefined;
  const isQuestionFlagged = (qId: string) => !!answers[qId]?.flagged;

  // Format seconds to Hh Mm Ss
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Keyboard Navigation & Interaction Shortcuts Helpers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isPaused) return;
    // Check if the user is typing in the scratchpad to avoid triggering shortcuts
    if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") {
      return;
    }

    const key = e.key.toLowerCase();
    
    // Navigation keys
    if (key === "n" || e.key === "ArrowRight") {
      if (activeIdx < paper.questions.length - 1) {
        setActiveIdx((prev) => prev + 1);
      }
    }
    else if (key === "p" || e.key === "ArrowLeft") {
      if (activeIdx > 0) {
        setActiveIdx((prev) => prev - 1);
      }
    }
    // Toggle Bookmark / Flag key: F
    else if (key === "f") {
      if (activeQuestion) {
        onToggleFlag(activeQuestion.id);
      }
    }
    // Option Selection keys: A, B, C, D (or 1, 2, 3, 4)
    else if (activeQuestion && (key === "a" || key === "1")) {
      onSelectOption(activeQuestion.id, "A");
    }
    else if (activeQuestion && (key === "b" || key === "2")) {
      onSelectOption(activeQuestion.id, "B");
    }
    else if (activeQuestion && (key === "c" || key === "3")) {
      onSelectOption(activeQuestion.id, "C");
    }
    else if (activeQuestion && (key === "d" || key === "4")) {
      onSelectOption(activeQuestion.id, "D");
    }
    // Confirm Selection & Next key: Enter
    else if (e.key === "Enter") {
      if (activeIdx < paper.questions.length - 1) {
        setActiveIdx((prev) => prev + 1);
      } else {
        setShowSubmitConfirm(true);
      }
    }
  }, [activeQuestion, activeIdx, paper.questions.length, onSelectOption, onToggleFlag, isPaused]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const activeScratchpad = activeQuestion ? answers[activeQuestion.id]?.scratchpad || "" : "";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 text-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Main Question Arena & Scratchpad (lg:col-span-8) */}
      <div className="lg:col-span-8 space-y-5">
        
        {/* Header: Title, Pause & Status */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                {paper.name}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Offline Mode Cached
              </span>
            </div>
            <h2 className="text-lg font-bold font-display text-slate-800">
              Exam Terminal Arena
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown timer */}
            <div id="countdown-clock" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-bold tracking-wide border ${
              timeRemainingSecs < 300 
                ? "bg-rose-50 border-rose-300 text-rose-600 animate-pulse" 
                : "bg-slate-50 border-slate-200 text-slate-800"
            }`}>
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{formatTime(timeRemainingSecs)}</span>
            </div>

            {/* Pause Control */}
            <button
              onClick={() => onPauseChange(!isPaused)}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/10" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-500 fill-amber-500/10" />
                  <span>Pause</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Locked View if Paused */}
        {isPaused ? (
          <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white/95 shadow-md flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200 text-amber-600 animate-pulse">
              <Pause className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-display text-slate-800">Exam Is Paused</h2>
            <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto">
              Your timer is held. All current answers are securely cached. Press Resume to restore developer questions.
            </p>
            <button
              onClick={() => onPauseChange(false)}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold uppercase tracking-wider text-slate-50 transition-all shadow-sm cursor-pointer"
            >
              Resume Examination
            </button>
          </div>
        ) : (
          <>
            {/* The Question Card */}
            {activeQuestion ? (
              <div id="active-question-card" className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5 text-slate-800">
                {/* Header Metadata */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                      Evaluated Syllabus Module
                    </span>
                    <h3 className="text-xs font-bold text-indigo-600 font-mono">
                      {activeQuestion.skill}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Question {activeIdx + 1} of {paper.questions.length}
                  </span>
                </div>

                {/* Question core text */}
                <div className="text-slate-800 text-sm sm:text-base leading-relaxed font-sans font-semibold whitespace-pre-line">
                  {activeQuestion.text}
                </div>

                {/* Optional Syntax Highlighting Code Snippet */}
                {activeQuestion.codeSnippet && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-indigo-900 leading-relaxed overflow-x-auto relative shadow-inner">
                    <div className="absolute right-3 top-2 text-[8px] uppercase tracking-widest font-mono text-slate-400 font-bold">
                      Code Snippet
                    </div>
                    <pre className="whitespace-pre">{activeQuestion.codeSnippet}</pre>
                  </div>
                )}

                {/* Selection Options Radio Pack */}
                <div className="space-y-3 pt-2">
                  {activeQuestion.options.map((opt, i) => {
                    const optionLetter = ["A", "B", "C", "D"][i];
                    // Clean options label prefix if any
                    const optionClean = opt.replace(/^[A-D]\.\s*/, "");
                    const isSelected = answers[activeQuestion.id]?.selectedOption === optionLetter;

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSelectOption(activeQuestion.id, optionLetter)}
                        className={`w-full flex items-center text-left gap-3.5 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 text-indigo-950 shadow-sm font-bold"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50 text-slate-700"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg text-xs font-display font-bold flex items-center justify-center border shrink-0 transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-slate-50"
                            : "bg-white border-slate-200 text-slate-500"
                        }`}>
                          {optionLetter}
                        </div>
                        <span className="text-xs sm:text-sm leading-snug">{optionClean}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Navigation Buttons inside Card */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={activeIdx === 0}
                      onClick={() => setActiveIdx((prev) => prev - 1)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                    >
                      Previous (P)
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFlag(activeQuestion.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                        isQuestionFlagged(activeQuestion.id)
                          ? "bg-amber-50 border border-amber-300 text-amber-700 font-bold"
                          : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isQuestionFlagged(activeQuestion.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                      <span>{isQuestionFlagged(activeQuestion.id) ? "Flagged (F)" : "Flag Question (F)"}</span>
                    </button>
                  </div>

                  {activeIdx === paper.questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setShowSubmitConfirm(true)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-slate-50 shadow-sm cursor-pointer"
                    >
                      Submit Paper
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveIdx((prev) => prev + 1)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-slate-50 flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      <span>Next (N)</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">Loading exam question Arena...</div>
            )}

            {/* Developer Scratchpad Card */}
            {activeQuestion && (
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3.5 text-slate-800">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Save className="w-4 h-4 text-emerald-600" />
                    Interactive Scratchpad & Canvas
                  </span>
                  <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    Saves to browser localStorage (Question Specific)
                  </span>
                </div>
                <textarea
                  value={activeScratchpad}
                  onChange={(e) => onUpdateScratchpad(activeQuestion.id, e.target.value)}
                  placeholder="Develop calculations, jot logic pseudocodes, or structure thoughts. This workspace auto-saves for this specific question is retained completely offline."
                  className="w-full h-28 bg-[#F8FAFC] text-slate-700 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Question Board Navigator (lg:col-span-4) */}
      <div className="lg:col-span-4 space-y-5 text-slate-800">
        
        {/* Submit Block */}
        {!isPaused && (
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-405 uppercase tracking-widest">
              Submission Dashboard
            </h3>

            {showSubmitConfirm ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                <p className="text-xs text-rose-750 leading-normal font-medium">
                  <AlertTriangle className="w-4 h-4 inline mr-1.5 align-text-bottom text-rose-600 font-bold" />
                  Are you absolutely sure? You cannot modify your answers or return to {paper.name} once submitted.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-[10px] font-mono rounded cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowSubmitConfirm(false);
                      onSubmitPaper();
                    }}
                    className="py-1.5 bg-rose-605 hover:bg-rose-700 text-slate-50 text-[10px] font-mono rounded font-bold cursor-pointer transition-colors"
                  >
                    Confirm Submit
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-xs font-bold text-slate-50 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <span>Final Submit Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-mono font-bold">
              <span>Progress: {Object.values(answers).filter(a => a.selectedOption !== null).length} / {paper.questions.length} Answered</span>
              <span>Flagged: {Object.values(answers).filter(a => a.flagged).length} Starred</span>
            </div>
          </div>
        )}

        {/* Matrix Card */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-mono font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Question Matrix
            </h3>
            <span className="text-[10px] text-slate-400 font-mono font-semibold">Paper Roadmap</span>
          </div>

          {/* Quick Stats colors config */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-mono font-bold">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-300" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-300" />
              <span>Flagged</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-slate-50 border border-slate-200" />
              <span>Unvisited</span>
            </div>
          </div>

          {/* Matrix Grid of Numbers */}
          <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-5 gap-2 max-h-[260px] overflow-y-auto pr-1">
            {paper.questions.map((q, i) => {
              const isCurrent = activeIdx === i;
              const isAnswered = isQuestionAnswered(q.id);
              const isFlagged = isQuestionFlagged(q.id);
              
              let styleClasses = "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300";
              if (isCurrent) {
                styleClasses = "bg-indigo-600 text-white font-bold ring-1 ring-indigo-300";
              } else if (isFlagged) {
                styleClasses = "bg-amber-50 border border-amber-300 text-amber-700 font-bold";
              } else if (isAnswered) {
                styleClasses = "bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold";
              }

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    if (isPaused) return;
                    setActiveIdx(i);
                  }}
                  disabled={isPaused}
                  className={`aspect-square rounded-xl text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${styleClasses}`}
                >
                  {(i + 1).toString().padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Keyboard Shortcuts Card */}
        <div id="shortcuts-legend" className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
            Keyboard Terminal Shortcuts
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 text-left">
            <div className="flex justify-between p-1.5 rounded bg-white border border-slate-200">
              <span className="text-slate-500 font-bold">Prev Card:</span>
              <kbd className="text-indigo-600 font-semibold uppercase">P / ←</kbd>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-white border border-slate-200">
              <span className="text-slate-500 font-bold">Next Card:</span>
              <kbd className="text-indigo-600 font-semibold uppercase">N / →</kbd>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-white border border-slate-200">
              <span className="text-slate-500 font-bold">Choose Opt:</span>
              <kbd className="text-indigo-600 font-semibold uppercase">A-D / 1-4</kbd>
            </div>
            <div className="flex justify-between p-1.5 rounded bg-white border border-slate-200">
              <span className="text-slate-500 font-bold">Toggle Flag:</span>
              <kbd className="text-indigo-600 font-semibold uppercase">F</kbd>
            </div>
            <div className="col-span-1 sm:col-span-2 flex justify-between p-1.5 rounded bg-white border border-slate-200">
              <span className="text-slate-500 font-bold">Confirm & Next:</span>
              <kbd className="text-indigo-600 font-semibold uppercase">Enter</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
