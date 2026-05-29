import React, { useState, useEffect } from "react";
import WelcomeScreen from "./components/WelcomeScreen";
import ActiveExamTerminal from "./components/ActiveExamTerminal";
import BreakActiveScreen from "./components/BreakActiveScreen";
import EducatorAnalysisScreen from "./components/EducatorAnalysisScreen";
import PreviousReportsPanel from "./components/PreviousReportsPanel";
import SystemSettingsModal from "./components/SystemSettingsModal";
import { ExamSetup, CandidateResponse, ExamState, EducatorAnalysis, HistoricalReport, Paper, PaperResponseState } from "./types";
import { ShieldCheck, HardDrive, HelpCircle, ArrowRight, Zap, RefreshCw, Layers, Compass, ExternalLink, History, Settings, Download, Home } from "lucide-react";
import { playBeep } from "./utils/audio";
import { downloadQuestionPaper } from "./utils/downloadPaper";
import { buildInitialPaperResponses, paperAnswersMap } from "./utils/paperResponses";
import { debouncedSetItem, safeRemoveItem, safeSetItem } from "./utils/safeStorage";


export default function App() {
  const [examState, setExamState] = useState<ExamState>({
    examSetup: null,
    paperResponses: {
      1: {
        paperId: 1,
        answers: {},
        timeRemainingSecs: 180 * 60,
        status: "not_started",
        timeSpentSecs: 0
      },
      2: {
        paperId: 2,
        answers: {},
        timeRemainingSecs: 180 * 60,
        status: "not_started",
        timeSpentSecs: 0
      }
    },
    currentPaperId: 1,
    breakState: {
      status: "inactive",
      timeRemainingSecs: 60 * 60
    },
    overallStatus: "setup",
    educatorAnalysis: null,
    educatorLoading: false,
    educatorError: null
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState(false);

  // Advanced settings & reports history states
  const [reports, setReports] = useState<HistoricalReport[]>([]);
  const [activeKernelId, setActiveKernelId] = useState<string>(() => {
    return localStorage.getItem("apex_preferred_logic_kernel") || "";
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Check if current active model is configured (Form Validation must be complete before submitting)
  const getIsActiveKernelConfigured = () => {
    if (!activeKernelId) return false;
    let apiConfig = {
      geminiApiKey: "",
      geminiModel: "",
      openaiApiKey: "",
      openaiModel: "gpt-4o",
      anthropicApiKey: "",
      anthropicModel: "claude-3-5-sonnet-20241022",
      sarvamApiKey: "",
      sarvamModel: "sarvam-2b-instruct",
      localLlmUrl: "http://localhost:11434/v1",
      localLlmModel: "",
      otherLlmUrl: "https://api.openai.com/v1",
      otherLlmModel: "gpt-4o",
      otherLlmApiKey: ""
    };
    
    const stored = localStorage.getItem("apex_api_config");
    if (stored) {
      try {
        apiConfig = { ...apiConfig, ...JSON.parse(stored) };
      } catch (e) {
        console.error("Failed to parse system config", e);
      }
    }

    if (activeKernelId === "gemini-3.5-flash" || activeKernelId === "gemini-3.5-pro") {
      return apiConfig.geminiApiKey.trim() !== "";
    }
    if (activeKernelId === "openai-gpt-4o") {
      return apiConfig.openaiApiKey.trim() !== "";
    }
    if (activeKernelId === "claude-3-5-sonnet") {
      return apiConfig.anthropicApiKey.trim() !== "";
    }
    if (activeKernelId === "local-llm") {
      return apiConfig.localLlmUrl.trim() !== "" && apiConfig.localLlmModel.trim() !== "";
    }
    if (activeKernelId === "other-llm") {
      return apiConfig.otherLlmUrl.trim() !== "" && apiConfig.otherLlmModel.trim() !== "";
    }
    return true;
  };

  // User friendly kernel name mapping
  const getActiveKernelFriendlyName = () => {
    if (!activeKernelId) return "No core kernel selected";
    if (activeKernelId === "gemini-3.5-flash") return "Google Gemini 3.5 Flash";
    if (activeKernelId === "gemini-3.5-pro") return "Google Gemini 3.5 Pro";
    if (activeKernelId === "openai-gpt-4o") return "OpenAI GPT-4o Kernel";
    if (activeKernelId === "claude-3-5-sonnet") return "Anthropic Claude 3.5 Kernel";
    if (activeKernelId === "local-llm") return "Local Sandbox LLM";
    if (activeKernelId === "other-llm") return "Custom Processing Gateway";
    return activeKernelId;
  };


  // Monitor network status dynamically
  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Monitor desktop install prompt and display mode state
  useEffect(() => {
    const checkDisplayMode = () => {
      const modeStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      setIsStandalone(modeStandalone);
    };
    
    checkDisplayMode();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log("[PWA Engine] Apex Terminal successfully installed on desktop");
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === "accepted") {
        console.log("[PWA Engine] User accepted desktop terminal installation");
      }
      setDeferredPrompt(null);
    });
  };

  // 1. Recover Session from localStorage on cold-boot
  useEffect(() => {
    try {
      const cachedSetup = localStorage.getItem("apex_exam_setup");
      const cachedResponses = localStorage.getItem("apex_exam_responses");
      const cachedStatus = localStorage.getItem("apex_exam_overall_status");
      const cachedCurrentPaper = localStorage.getItem("apex_exam_current_paper_id");
      const cachedBreakState = localStorage.getItem("apex_exam_break_state");
      const cachedAnalysis = localStorage.getItem("apex_exam_educator_analysis");

      if (cachedSetup) {
        const parsedSetup = JSON.parse(cachedSetup) as ExamSetup;
        const baseResponses = buildInitialPaperResponses(
          parsedSetup.papers,
          parsedSetup.paperDurationMins
        );
        
        let parsedResponses: Record<number, PaperResponseState> = baseResponses;

        if (cachedResponses) {
          const cached = JSON.parse(cachedResponses) as Record<string, PaperResponseState>;
          parsedResponses = Object.fromEntries(
            parsedSetup.papers.map((paper) => {
              const cachedPaper = cached[String(paper.id)];
              return [
                paper.id,
                {
                  ...baseResponses[paper.id],
                  ...(cachedPaper || {}),
                  paperId: paper.id,
                },
              ];
            })
          ) as Record<number, PaperResponseState>;
        }

        let parsedStatus: ExamState["overallStatus"] = "setup";
        if (cachedStatus) {
          parsedStatus = cachedStatus as any;
        }

        let parsedPaperId = 1;
        if (cachedCurrentPaper) {
          parsedPaperId = parseInt(cachedCurrentPaper, 10);
        }
        if (!parsedSetup.papers.some((paper) => paper.id === parsedPaperId)) {
          parsedPaperId = parsedSetup.papers[0]?.id || 1;
        }

        let parsedBreak: ExamState["breakState"] = { status: "inactive", timeRemainingSecs: parsedSetup.breakDurationMins * 60 };
        if (cachedBreakState) {
          parsedBreak = JSON.parse(cachedBreakState);
        }

        if (parsedSetup.papers.length <= 1 && (parsedStatus === "break" || parsedStatus === "paper_2")) {
          parsedStatus = parsedResponses[1]?.status === "submitted" || parsedResponses[1]?.status === "timed_out"
            ? "completed"
            : "paper_1";
          parsedPaperId = 1;
          parsedBreak = { status: "inactive" as const, timeRemainingSecs: parsedSetup.breakDurationMins * 60 };
        }

        let parsedAnalysisObj: EducatorAnalysis | null = null;
        if (cachedAnalysis) {
          parsedAnalysisObj = JSON.parse(cachedAnalysis);
        }

        setExamState({
          examSetup: parsedSetup,
          paperResponses: parsedResponses,
          currentPaperId: parsedPaperId,
          breakState: parsedBreak,
          overallStatus: parsedStatus,
          educatorAnalysis: parsedAnalysisObj,
          educatorLoading: false,
          educatorError: null
        });
      }
    } catch (err) {
      console.warn("Failed to retrieve cached exam session details from local workspace:", err);
    }
  }, []);

  // Recover advanced settings & reports history from localStorage on cold-boot
  useEffect(() => {
    try {
      const cachedReports = localStorage.getItem("apex_previous_reports");
      if (cachedReports) {
        setReports(JSON.parse(cachedReports));
      }
      const cachedModel = localStorage.getItem("apex_preferred_logic_kernel");
      if (cachedModel) {
        setActiveKernelId(cachedModel);
      } else {
        setActiveKernelId("");
      }
    } catch (e) {
      console.warn("Failed to retrieve cached engine kernel preferences from local workspace:", e);
    }
  }, []);


  // 2. Automated ticking down of seconds for ongoing paper assessments
  useEffect(() => {
    const status = examState.overallStatus;
    if (status !== "paper_1" && status !== "paper_2") return;
    if (isPaused) return;
    
    const paperId = examState.currentPaperId;
    const interval = setInterval(() => {
      setExamState((prev) => {
        const resp = prev.paperResponses[paperId];
        if (!resp) return prev;
        if (resp.timeRemainingSecs <= 1) {
          clearInterval(interval);
          // Auto submit paper on timeout
          const autoSubmittedResponses = {
            ...prev.paperResponses,
            [paperId]: {
              ...resp,
              timeRemainingSecs: 0,
              status: "timed_out" as const,
              timeSpentSecs: resp.timeSpentSecs + 1,
              submittedAt: new Date().toISOString()
            }
          };

          // Cache responses
          safeSetItem("apex_exam_responses", JSON.stringify(autoSubmittedResponses));

          // Compute transitional route
          let nextStatus = prev.overallStatus;
          let nextPaperId = prev.currentPaperId;
          let newBreak = prev.breakState;

          if (paperId === 1 && prev.examSetup && prev.examSetup.papers.length > 1) {
            nextStatus = "break";
            newBreak = {
              status: "ongoing" as const,
              timeRemainingSecs: prev.examSetup.breakDurationMins * 60
            };
          } else {
            nextStatus = "completed";
          }

          safeSetItem("apex_exam_overall_status", nextStatus);
          safeSetItem("apex_exam_break_state", JSON.stringify(newBreak));

          return {
            ...prev,
            paperResponses: autoSubmittedResponses,
            overallStatus: nextStatus,
            breakState: newBreak
          };
        }

        // Standard decrement
        const updatedResponses = {
          ...prev.paperResponses,
          [paperId]: {
            ...resp,
            timeRemainingSecs: resp.timeRemainingSecs - 1,
            timeSpentSecs: resp.timeSpentSecs + 1,
            status: "ongoing" as const
          }
        };

        debouncedSetItem("apex_exam_responses", JSON.stringify(updatedResponses));
        return {
          ...prev,
          paperResponses: updatedResponses
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [examState.overallStatus, examState.currentPaperId, isPaused]);

  useEffect(() => {
    if (examState.overallStatus !== "paper_1" && examState.overallStatus !== "paper_2") {
      setIsPaused(false);
    }
  }, [examState.overallStatus]);

  // 3. Sync Break Countdown Ticking down
  useEffect(() => {
    if (examState.overallStatus !== "break") return;

    const interval = setInterval(() => {
      setExamState((prev) => {
        if (prev.breakState.timeRemainingSecs <= 1) {
          clearInterval(interval);
          
          const nextStatus = "paper_2" as const;
          const updatedBreak = { ...prev.breakState, status: "completed" as const, timeRemainingSecs: 0 };
          
          safeSetItem("apex_exam_overall_status", nextStatus);
          safeSetItem("apex_exam_break_state", JSON.stringify(updatedBreak));
          safeSetItem("apex_exam_current_paper_id", "2");

          return {
            ...prev,
            overallStatus: nextStatus,
            currentPaperId: 2,
            breakState: updatedBreak
          };
        }

        const updatedBreak = {
          ...prev.breakState,
          timeRemainingSecs: prev.breakState.timeRemainingSecs - 1
        };

        debouncedSetItem("apex_exam_break_state", JSON.stringify(updatedBreak));
        return {
          ...prev,
          breakState: updatedBreak
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [examState.overallStatus]);

  // Handle assessment compilation and query the assessment engine
  const handleStartGeneration = async (config: {
    documentText: string;
    numPapers: number;
    numQuestions: number;
    paperDurationMins: number;
    breakDurationMins: number;
    title: string;
  }) => {
    if (!navigator.onLine && activeKernelId !== "local-llm") {
      playBeep(220, 250, "sawtooth");
      alert("No internet connection. Please verify your network settings or switch to a local logic engine in settings.");
      return;
    }

    if (!getIsActiveKernelConfigured()) {
      playBeep(220, 250, "sawtooth");
      alert("System kernel not configured correctly");
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      let apiConfig = null;
      const storedConfig = localStorage.getItem("apex_api_config");
      if (storedConfig) {
        try {
          apiConfig = JSON.parse(storedConfig);
        } catch (e) {
          console.error("Failed to parse logic engine config", e);
        }
      }

      const response = await fetch("/api/generate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: config.documentText,
          numPapers: config.numPapers,
          numQuestions: config.numQuestions,
          paperDurationMins: config.paperDurationMins,
          model: activeKernelId,
          apiConfig
        })
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "The assessment engine failed to outline the examination schedule.");
      }

      const parsedData = await response.json();

      const normalizedPapers = (parsedData.papers || []).map((p: Paper, idx: number) => ({
        id: p.id || idx + 1,
        name: p.name || `Paper ${p.id || idx + 1}: Technical Assessment`,
        questions: (p.questions || []).map((q, qIdx) => {
          const correctAnswer = String(q.correctAnswer || "").trim().charAt(0).toUpperCase();
          if (!["A", "B", "C", "D"].includes(correctAnswer)) {
            throw new Error(`Generated question ${qIdx + 1} in Paper ${p.id || idx + 1} has an invalid answer key.`);
          }
          return {
            ...q,
            id: q.id || `q_${qIdx + 1}`,
            correctAnswer,
          };
        }),
        durationMins: config.paperDurationMins,
      }));

      const newExamSetup: ExamSetup = {
        id: `setup_${Date.now()}`,
        title: config.title,
        skills: parsedData.skills || [],
        papers: normalizedPapers,
        paperDurationMins: config.paperDurationMins,
        breakDurationMins: config.breakDurationMins,
        createdAt: new Date().toISOString(),
        generationWarnings: Array.isArray(parsedData.generationWarnings) ? parsedData.generationWarnings : [],
      };

      const initializedResponses = buildInitialPaperResponses(
        newExamSetup.papers,
        config.paperDurationMins
      );

      // Update state
      const initialStatus = "paper_1";
      setExamState({
        examSetup: newExamSetup,
        paperResponses: initializedResponses,
        currentPaperId: 1,
        breakState: {
          status: "inactive" as const,
          timeRemainingSecs: config.breakDurationMins * 60
        },
        overallStatus: initialStatus,
        educatorAnalysis: null,
        educatorLoading: false,
        educatorError: null
      });

      // Save to cache for offline capabilities
      safeSetItem("apex_exam_setup", JSON.stringify(newExamSetup));
      safeSetItem("apex_exam_responses", JSON.stringify(initializedResponses));
      safeSetItem("apex_exam_overall_status", initialStatus);
      safeSetItem("apex_exam_current_paper_id", "1");
      safeRemoveItem("apex_exam_educator_analysis");

    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "An unexpected error occurred during environment core synthesis.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Answer selection callback
  const handleSelectOption = (questionId: string, option: string) => {
    setExamState((prev) => {
      const pId = prev.currentPaperId;
      const currentPaperResponses = prev.paperResponses[pId];
      
      const updatedAnswers = {
        ...currentPaperResponses.answers,
        [questionId]: {
          ...(currentPaperResponses.answers[questionId] || { questionId, flagged: false, scratchpad: "" }),
          selectedOption: option
        }
      };

      const newState = {
        ...prev,
        paperResponses: {
          ...prev.paperResponses,
          [pId]: {
            ...currentPaperResponses,
            answers: updatedAnswers
          }
        }
      };

      safeSetItem("apex_exam_responses", JSON.stringify(newState.paperResponses));
      return newState;
    });
  };

  // Bookmark / Flag callback
  const handleToggleFlag = (questionId: string) => {
    setExamState((prev) => {
      const pId = prev.currentPaperId;
      const currentPaperResponses = prev.paperResponses[pId];
      const currentAnswer = currentPaperResponses.answers[questionId];

      const updatedAnswers = {
        ...currentPaperResponses.answers,
        [questionId]: {
          ...(currentAnswer || { questionId, selectedOption: null, scratchpad: "" }),
          flagged: !currentAnswer?.flagged
        }
      };

      const newState = {
        ...prev,
        paperResponses: {
          ...prev.paperResponses,
          [pId]: {
            ...currentPaperResponses,
            answers: updatedAnswers
          }
        }
      };

      safeSetItem("apex_exam_responses", JSON.stringify(newState.paperResponses));
      return newState;
    });
  };

  // Scratchpad updates
  const handleUpdateScratchpad = (questionId: string, text: string) => {
    setExamState((prev) => {
      const pId = prev.currentPaperId;
      const currentPaperResponses = prev.paperResponses[pId];
      const currentAnswer = currentPaperResponses.answers[questionId];

      const updatedAnswers = {
        ...currentPaperResponses.answers,
        [questionId]: {
          ...(currentAnswer || { questionId, selectedOption: null, flagged: false }),
          scratchpad: text
        }
      };

      const newState = {
        ...prev,
        paperResponses: {
          ...prev.paperResponses,
          [pId]: {
            ...currentPaperResponses,
            answers: updatedAnswers
          }
        }
      };

      safeSetItem("apex_exam_responses", JSON.stringify(newState.paperResponses));
      return newState;
    });
  };

  // Shift paper completion status
  const handleSubmitPaper = () => {
    const currentPaperId = examState.currentPaperId;
    
    setExamState((prev) => {
      const currentPaper = prev.paperResponses[currentPaperId];
      const updatedPaperResponses = {
        ...prev.paperResponses,
        [currentPaperId]: {
          ...currentPaper,
          status: "submitted" as const,
          submittedAt: new Date().toISOString()
        }
      };

      let nextStatus = prev.overallStatus;
      let nextPaper = prev.currentPaperId;
      let updatedBreak = prev.breakState;

      // Handle transitions
      if (currentPaperId === 1 && prev.examSetup && prev.examSetup.papers.length > 1) {
        nextStatus = "break";
        updatedBreak = {
          status: "ongoing" as const,
          timeRemainingSecs: prev.examSetup.breakDurationMins * 60
        };
      } else {
        // Exam fully completed. Shift directly to analysis page.
        nextStatus = "completed";
      }

      safeSetItem("apex_exam_responses", JSON.stringify(updatedPaperResponses));
      safeSetItem("apex_exam_overall_status", nextStatus);
      safeSetItem("apex_exam_break_state", JSON.stringify(updatedBreak));
      safeSetItem("apex_exam_current_paper_id", currentPaperId === 1 && prev.examSetup && prev.examSetup.papers.length > 1 ? "2" : "1");

      return {
        ...prev,
        paperResponses: updatedPaperResponses,
        overallStatus: nextStatus,
        breakState: updatedBreak
      };
    });
  };

  // Bypassing candidate break recess
  const handleSkipBreak = () => {
    setExamState((prev) => {
      const nextStatus = "paper_2" as const;
      const updatedBreak = {
        ...prev.breakState,
        status: "skipped" as const,
        timeRemainingSecs: 0
      };

      const updatedPaperResponses = {
        ...prev.paperResponses,
        2: {
          ...prev.paperResponses[2],
          status: "ongoing" as const,
          startedAt: new Date().toISOString()
        }
      };

      safeSetItem("apex_exam_overall_status", nextStatus);
      safeSetItem("apex_exam_break_state", JSON.stringify(updatedBreak));
      safeSetItem("apex_exam_current_paper_id", "2");
      safeSetItem("apex_exam_responses", JSON.stringify(updatedPaperResponses));

      return {
        ...prev,
        overallStatus: nextStatus,
        currentPaperId: 2,
        breakState: updatedBreak,
        paperResponses: updatedPaperResponses
      };
    });
  };

  // Query Evaluation Core for visual diagnostics
  const handleRequestAnalysis = async () => {
    if (!examState.examSetup) return;

    if (!navigator.onLine && activeKernelId !== "local-llm") {
      playBeep(220, 250, "sawtooth");
      setExamState(prev => ({ 
        ...prev, 
        educatorError: "No internet connection. Please connect to a network or switch to a local offline logic engine." 
      }));
      alert("No internet connection. Please verify settings.");
      return;
    }

    if (!getIsActiveKernelConfigured()) {
      playBeep(220, 250, "sawtooth");
      setExamState(prev => ({ 
        ...prev, 
        educatorError: "System engine not configured correctly" 
      }));
      alert("System engine not configured correctly");
      setIsSettingsOpen(true);
      return;
    }

    setExamState((prev) => ({ ...prev, educatorLoading: true, educatorError: null }));

    try {
      let apiConfig = null;
      const storedConfig = localStorage.getItem("apex_api_config");
      if (storedConfig) {
        try {
          apiConfig = JSON.parse(storedConfig);
        } catch (e) {
          console.error("Failed to load active engine keys", e);
        }
      }

      const response = await fetch("/api/analyze-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSetup: examState.examSetup,
          paperResponses: examState.paperResponses,
          model: activeKernelId,
          apiConfig
        })
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "The system engine encountered an error while auditing solutions.");
      }

      const analysisPayload = await response.json();
      const parsedAnalysis: EducatorAnalysis = {
        summary: String(analysisPayload.summary || "Assessment analysis completed."),
        strengths: Array.isArray(analysisPayload.strengths) ? analysisPayload.strengths : [],
        weakAreas: Array.isArray(analysisPayload.weakAreas) ? analysisPayload.weakAreas : [],
        skillScores: Array.isArray(analysisPayload.skillScores) ? analysisPayload.skillScores : [],
        ...(analysisPayload.recommendationRoadmap ? { recommendationRoadmap: analysisPayload.recommendationRoadmap } : {}),
      };

      setExamState((prev) => ({
        ...prev,
        educatorAnalysis: parsedAnalysis,
        educatorLoading: false,
        educatorError: null
      }));

      // Cache diagnostics reports locally
      safeSetItem("apex_exam_educator_analysis", JSON.stringify(parsedAnalysis));

      // Append code for previous reports
      if (examState.examSetup) {
        const reportItem: HistoricalReport = {
          id: examState.examSetup.id,
          title: examState.examSetup.title,
          createdAt: examState.examSetup.createdAt || new Date().toISOString(),
          examSetup: examState.examSetup,
          paperResponses: examState.paperResponses,
          educatorAnalysis: parsedAnalysis
        };
        setReports((prev) => {
          const updated = [reportItem, ...prev.filter(r => r.id !== reportItem.id)];
          safeSetItem("apex_previous_reports", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.error(err);
      setExamState((prev) => ({
        ...prev,
        educatorLoading: false,
        educatorError: err.message || "An unexpected error occurred while communicating with the Educator."
      }));
    }
  };

  // Reset examination setup completely
  const handleRestartNewExam = () => {
    // Confirm first to avoid accidental loss
    if (confirm("Reset current assessment schedule? All local scores and cached progress will be permanently erased.")) {
      safeRemoveItem("apex_exam_setup");
      safeRemoveItem("apex_exam_responses");
      safeRemoveItem("apex_exam_overall_status");
      safeRemoveItem("apex_exam_current_paper_id");
      safeRemoveItem("apex_exam_break_state");
      safeRemoveItem("apex_exam_educator_analysis");

      setExamState({
        examSetup: null,
        paperResponses: {
          1: { paperId: 1, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 },
          2: { paperId: 2, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 }
        },
        currentPaperId: 1,
        breakState: { status: "inactive" as const, timeRemainingSecs: 60 * 60 },
        overallStatus: "setup",
        educatorAnalysis: null,
        educatorLoading: false,
        educatorError: null
      });
    }
  };

  const handleGoHomeDirect = () => {
    const isOngoing = examState.overallStatus === "paper_1" || examState.overallStatus === "paper_2" || examState.overallStatus === "break";
    const msg = isOngoing 
      ? "Return to Home/Setup screen? This will reset all current progress on the ongoing assessment."
      : "Return to Home/Setup screen?";
      
    if (confirm(msg)) {
      safeRemoveItem("apex_exam_setup");
      safeRemoveItem("apex_exam_responses");
      safeRemoveItem("apex_exam_overall_status");
      safeRemoveItem("apex_exam_current_paper_id");
      safeRemoveItem("apex_exam_break_state");
      safeRemoveItem("apex_exam_educator_analysis");

      setExamState({
        examSetup: null,
        paperResponses: {
          1: { paperId: 1, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 },
          2: { paperId: 2, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 }
        },
        currentPaperId: 1,
        breakState: { status: "inactive" as const, timeRemainingSecs: 60 * 60 },
        overallStatus: "setup",
        educatorAnalysis: null,
        educatorLoading: false,
        educatorError: null
      });
      playBeep(523.25, 120, "sine");
    }
  };


  const handleSelectReport = (report: HistoricalReport) => {
    setExamState({
      examSetup: report.examSetup,
      paperResponses: report.paperResponses,
      currentPaperId: 1,
      breakState: { status: "completed", timeRemainingSecs: 0 },
      overallStatus: "completed",
      educatorAnalysis: report.educatorAnalysis,
      educatorLoading: false,
      educatorError: null
    });
    safeSetItem("apex_exam_setup", JSON.stringify(report.examSetup));
    safeSetItem("apex_exam_responses", JSON.stringify(report.paperResponses));
    safeSetItem("apex_exam_overall_status", "completed");
    safeSetItem("apex_exam_current_paper_id", "1");
    safeSetItem("apex_exam_break_state", JSON.stringify({ status: "completed", timeRemainingSecs: 0 }));
    safeSetItem("apex_exam_educator_analysis", JSON.stringify(report.educatorAnalysis));
  };

  const handleDeleteReport = (id: string) => {
    setReports((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      safeSetItem("apex_previous_reports", JSON.stringify(updated));
      return updated;
    });

    if (examState.examSetup?.id === id) {
      safeRemoveItem("apex_exam_setup");
      safeRemoveItem("apex_exam_responses");
      safeRemoveItem("apex_exam_overall_status");
      safeRemoveItem("apex_exam_current_paper_id");
      safeRemoveItem("apex_exam_break_state");
      safeRemoveItem("apex_exam_educator_analysis");

      setExamState({
        examSetup: null,
        paperResponses: {
          1: { paperId: 1, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 },
          2: { paperId: 2, answers: {}, timeRemainingSecs: 180 * 60, status: "not_started" as const, timeSpentSecs: 0 }
        },
        currentPaperId: 1,
        breakState: { status: "inactive" as const, timeRemainingSecs: 60 * 60 },
        overallStatus: "setup",
        educatorAnalysis: null,
        educatorLoading: false,
        educatorError: null
      });
    }
  };

  const handleSelectKernel = (modelId: string) => {
    setActiveKernelId(modelId);
    safeSetItem("apex_preferred_logic_kernel", modelId);
  };


  // Render routing navigation helper
  const renderCurrentView = () => {
    switch (examState.overallStatus) {
      case "setup":
        return (
          <WelcomeScreen
            onStartGeneration={handleStartGeneration}
            isLoading={isGenerating}
            isStandalone={isStandalone}
            onInstall={handleInstallClick}
            canInstall={!!deferredPrompt}
            selectedModelName={getActiveKernelFriendlyName()}
            selectedModelId={activeKernelId}
            isKernelConfigured={getIsActiveKernelConfigured()}
            onOpenSettings={() => { playBeep(523.25, 90, "sine"); setIsSettingsOpen(true); }}
          />
        );
      
      case "paper_1": {
        const paper1 = examState.examSetup?.papers.find((p) => p.id === 1);
        if (!paper1) return <div className="text-center py-12 text-slate-400">Loading Paper Core 1...</div>;
        return (
          <ActiveExamTerminal
            paper={paper1}
            answers={examState.paperResponses[1].answers}
            timeRemainingSecs={examState.paperResponses[1].timeRemainingSecs}
            isPaused={isPaused}
            onPauseChange={setIsPaused}
            onSelectOption={handleSelectOption}
            onToggleFlag={handleToggleFlag}
            onUpdateScratchpad={handleUpdateScratchpad}
            onSubmitPaper={handleSubmitPaper}
          />
        );
      }

      case "break":
        if (!examState.examSetup) return <div className="text-center py-12 text-slate-400">Loading break...</div>;
        return (
          <BreakActiveScreen
            durationMins={examState.examSetup.breakDurationMins}
            timeRemainingSecs={examState.breakState.timeRemainingSecs}
            onSkipBreak={handleSkipBreak}
          />
        );

      case "paper_2": {
        const paper2 = examState.examSetup?.papers.find((p) => p.id === 2);
        if (!paper2) return <div className="text-center py-12 text-slate-400">Loading Paper Core 2...</div>;
        return (
          <ActiveExamTerminal
            paper={paper2}
            answers={examState.paperResponses[2].answers}
            timeRemainingSecs={examState.paperResponses[2].timeRemainingSecs}
            isPaused={isPaused}
            onPauseChange={setIsPaused}
            onSelectOption={handleSelectOption}
            onToggleFlag={handleToggleFlag}
            onUpdateScratchpad={handleUpdateScratchpad}
            onSubmitPaper={handleSubmitPaper}
          />
        );
      }

      case "completed":
        if (!examState.examSetup) return <div className="text-center py-12 text-slate-400">Assessment missing.</div>;
        
        // Render completed dashboard, either loading report, or compiled report
        if (examState.educatorAnalysis) {
          return (
            <EducatorAnalysisScreen
              analysis={examState.educatorAnalysis}
              setup={examState.examSetup}
              answers={paperAnswersMap(examState.paperResponses)}
              onRestart={handleRestartNewExam}
            />
          );
        }

        // Complete assessment finish screen prompting Educator analysis
        return (
          <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-slate-200 bg-white text-center space-y-6 shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-display text-slate-800">Assessment Completed</h2>
              <p className="text-slate-500 text-sm">
                All examination papers have been successfully submitted and responses are retained in local offline storage cache.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left font-mono text-xs text-slate-600 space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                <span>Metrics File</span>
                <span>Output Log</span>
              </div>
              {examState.examSetup.papers.map((paper) => (
                <div key={paper.id} className="flex justify-between">
                  <span>{paper.name} Responses:</span>
                  <span className="text-slate-800 font-semibold">
                    {Object.keys(examState.paperResponses[paper.id]?.answers || {}).length} / {paper.questions.length} Saved
                  </span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Targeted Skills Tracked:</span>
                <span className="text-indigo-600 font-semibold">{examState.examSetup.skills.length} extracted</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span>Working Directory:</span>
                <span className="text-slate-400">Offline Cache (Local Storage)</span>
              </div>
            </div>

            {examState.educatorError && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-600 leading-normal text-left animate-fade-in">
                {examState.educatorError}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRestartNewExam}
                className="flex-1 justify-center py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                Reset & Try Again
              </button>
              <button
                onClick={() => { playBeep(600, 100); downloadQuestionPaper(examState.examSetup!); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-xs font-bold text-indigo-700 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Download Paper (MD)</span>
              </button>
              <button
                onClick={handleRequestAnalysis}
                disabled={examState.educatorLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer transition-colors"
              >
                {examState.educatorLoading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Requesting Evaluation Core...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-white" />
                    <span>Generate Performance Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return (
          <WelcomeScreen
            onStartGeneration={handleStartGeneration}
            isLoading={isGenerating}
            isStandalone={isStandalone}
            onInstall={handleInstallClick}
            canInstall={!!deferredPrompt}
            selectedModelName={getActiveKernelFriendlyName()}
            selectedModelId={activeKernelId}
            isKernelConfigured={getIsActiveKernelConfigured()}
            onOpenSettings={() => { playBeep(523.25, 90, "sine"); setIsSettingsOpen(true); }}
          />
        );
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F1F5F9] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col justify-between">
      
      {/* Dynamic Desktop Title Bar - Sleek Native Windows-Style Styling */}
      <div id="desktop-chrome-titlebar" style={{ WebkitAppRegion: "drag" } as any} className="h-8 bg-[#151720] text-[#A5B4FC] flex items-center justify-between select-none border-b border-[#242635] text-[10px] font-medium shadow-md shrink-0 p-0 pl-3">
        {/* Brand Identity & File Menus (Left side) */}
        <div className="flex items-center gap-3.5 h-full" style={{ WebkitAppRegion: "no-drag" } as any}>
          {/* Small Brand Icon */}
          <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center text-slate-100 font-sans font-black text-[9px] shadow-sm select-none">
            A
          </div>
          {/* Native mock menu header columns */}
          <div className="hidden md:flex items-center gap-3.5 text-slate-400 font-sans text-[10px]">
            <span className="hover:text-slate-200 cursor-pointer select-none font-semibold text-indigo-300">File</span>
            <span className="hover:text-slate-200 cursor-pointer select-none">Assessment</span>
            <span className="hover:text-slate-200 cursor-pointer select-none">Environment</span>
            <span className="hover:text-slate-200 cursor-pointer select-none">Diagnostics</span>
            <span className="hover:text-slate-200 cursor-pointer select-none">Help</span>
          </div>
        </div>
        
        {/* Centered App Title Branding */}
        <div className="text-slate-200 font-sans font-bold text-xs tracking-wide select-none flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
          <span>Apex Solutions — v1.3.0 Binary Build</span>
        </div>
        
        {/* Windows-Style Native Window Controls (Right side) */}
        <div className="flex items-stretch h-full" style={{ WebkitAppRegion: "no-drag" } as any}>
          {/* Status badge */}
          <div className="hidden sm:flex items-center px-3 border-r border-[#242635] text-[8px] font-mono font-bold text-indigo-300 tracking-wider">
            SYSTEM CORE ACTIVE
          </div>
          {/* Minimize Button */}
          <button
            type="button"
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#ffffff15] transition-colors cursor-pointer select-none"
            title="Minimize"
            onClick={() => {
              if ((window as any).electronAPI) {
                (window as any).electronAPI.minimize();
              } else {
                alert("Minimize is only available in standalone desktop mode.");
              }
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current fill-none">
              <line x1="1" y1="5" x2="9" y2="5" strokeWidth="1" />
            </svg>
          </button>
          {/* Maximize Button */}
          <button
            type="button"
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#ffffff15] transition-colors cursor-pointer select-none"
            title="Maximize"
            onClick={() => {
              if ((window as any).electronAPI) {
                (window as any).electronAPI.maximize();
              } else {
                alert("Maximize is only available in standalone desktop mode.");
              }
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current fill-none">
              <rect x="1.5" y="1.5" width="7" height="7" strokeWidth="1" />
            </svg>
          </button>
          {/* Close Button (Iconic Windows Red Hover effect) */}
          <button
            type="button"
            className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#E81123] transition-colors cursor-pointer select-none"
            title="Close"
            onClick={() => {
              if ((window as any).electronAPI) {
                (window as any).electronAPI.close();
              } else if (confirm("Close Application?")) {
                window.close();
              }
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="stroke-current fill-none">
              <path d="M1.5,1.5 L8.5,8.5 M8.5,1.5 L1.5,8.5" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Upper Navigation bar with Standard Identity */}
      <header className="border-b border-slate-200 bg-white shadow-sm shrink-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 self-start">
            <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-slate-50 font-display font-extrabold shadow-sm text-sm">
              A
            </div>
            <div>
              <span className="block text-xs font-bold tracking-tight text-slate-800">Apex Solutions</span>
            </div>
          </div>

          {/* Quick Stats Toolbar / Context Actions */}
          <div className="flex items-center gap-2.5 self-end md:self-auto">
            {/* Status of Local Connection */}
            {isOfflineMode ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-[9px] font-mono font-medium">
                <span className="h-1 w-1 rounded-full bg-rose-500 animate-pulse" />
                <span>Offline</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-[9px] font-mono font-medium">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                <span>Online Shell</span>
              </div>
            )}

            {/* Diagnostic previous reports history toggle */}
            <button
              type="button"
              onClick={() => { playBeep(700, 100); setSidebarOpen(prev => !prev); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-tight rounded-lg transition-all cursor-pointer select-none bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-slate-800"
              title="View History of Diagnostic Educator Reports"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                History ({reports.length})
              </span>
            </button>

            {/* Reset & Home Actions visible on any screen other than Welcome/Setup */}
            {examState.overallStatus !== "setup" && (
              <>
                <button
                  type="button"
                  onClick={handleRestartNewExam}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all cursor-pointer select-none"
                  title="Reset and clear current exam"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoHomeDirect}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 shadow-sm transition-all cursor-pointer select-none"
                  title="Return to setup screen"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home</span>
                </button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* Main Container Area - Height bounded for correct app feel */}
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {/* Render error if setup failed on start generation */}
        {generationError && (
          <div className="max-w-xl mx-auto p-5 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-600 space-y-3 shadow-sm m-4 animate-fade-in">
            <h3 className="text-sm font-bold uppercase font-mono text-rose-700">Assessment Planning Failed</h3>
            <p className="text-xs leading-relaxed text-slate-655">{generationError}</p>
            <button
              onClick={() => setGenerationError(null)}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-[10px] font-mono font-bold text-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {renderCurrentView()}
      </main>

      {/* Humble Elegant footer */}
      <footer className="border-t border-slate-700 h-11 bg-slate-800 flex items-center shrink-0">
        <div className="max-w-7xl mx-auto px-4 w-full flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-300 font-mono tracking-wide">
          <span>APEX ASSESSMENT APPS • LOCAL SYSTEM</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { playBeep(523.25, 90, "sine"); setIsSettingsOpen(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 hover:text-white text-indigo-200 border border-slate-600 transition-all cursor-pointer font-bold select-none uppercase tracking-wide"
              title="Open Preferences & Choose AI Model Core"
            >
              <Settings className="w-3 h-3 text-indigo-400 animate-spin-slow" />
              <span>LOGIC ENGINE: {getActiveKernelFriendlyName()}</span>
            </button>
            <span className="text-slate-600">•</span>
            <span>OS STANDALONE ENVIRONMENT</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 flex items-center gap-1 font-semibold uppercase">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              SECURED CLIENT BOX
            </span>
          </div>
        </div>
      </footer>

      {/* Drawer sidebar panel for previous assessment scorecard reports */}
      <PreviousReportsPanel
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        reports={reports}
        currentReportId={examState.examSetup?.id || null}
        onSelectReport={handleSelectReport}
        onDeleteReport={handleDeleteReport}
      />

      {/* Advanced Model preference configuration dialogue sheet */}
      <SystemSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModel={activeKernelId}
        onSelectModel={handleSelectKernel}
      />

    </div>
  );
}
