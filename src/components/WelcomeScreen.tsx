import React, { useState, useRef } from "react";
import { PREDEFINED_SYLLABI, PredefinedSyllabus } from "../data";
import { FileText, Upload, Settings, BookOpen, Layers, Terminal, Cpu, Cloud, CheckCircle, Zap, Copy, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
import { playBeep } from "../utils/audio";

interface WelcomeScreenProps {
  onStartGeneration: (config: {
    documentText: string;
    numPapers: number;
    numQuestions: number;
    paperDurationMins: number;
    breakDurationMins: number;
    title: string;
  }) => void;
  isLoading: boolean;
  isStandalone: boolean;
  onInstall: () => void;
  canInstall: boolean;
  selectedModelName: string;
  selectedModelId: string;
  isKernelConfigured: boolean;
  onOpenSettings: () => void;
}

export interface Source {
  name: string;
  type: "pdf" | "word" | "prompt";
  text: string;
  wordCount: number;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
  }

  return btoa(binary);
}

export default function WelcomeScreen({
  onStartGeneration,
  isLoading,
  isStandalone,
  onInstall,
  canInstall,
  selectedModelName,
  selectedModelId,
  isKernelConfigured,
  onOpenSettings
}: WelcomeScreenProps) {
  // Source State: Keep file content isolated in state (textarea remains clean)
  const [sources, setSources] = useState<Source[]>([]);
  const [inputText, setInputText] = useState("");
  const [numPapers, setNumPapers] = useState(2);
  const [numQuestions, setNumQuestions] = useState(90);
  const [paperDurationMins, setPaperDurationMins] = useState(180); // 3 Hours
  const [breakDurationMins, setBreakDurationMins] = useState(60); // 1 Hour
  const [examTitle, setExamTitle] = useState("Technical Assessment Board");
  const [dragActive, setDragActive] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [extractingCount, setExtractingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draggable Sources Widget states
  const [widgetPos, setWidgetPos] = useState({ x: 30, y: 220 });
  const [isWidgetDragging, setIsWidgetDragging] = useState(false);
  const [isWidgetCollapsed, setIsWidgetCollapsed] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const widgetStartPos = useRef({ x: 0, y: 0 });

  // Preset Selection: Add preset as a custom source in background
  const handleSelectPreset = (syllabus: PredefinedSyllabus) => {
    const existing = sources.find((s) => s.name === syllabus.name);
    if (existing) {
      // Toggle off
      setSources((prev) => prev.filter((s) => s.name !== syllabus.name));
      setSelectedPreset(null);
      playBeep(600, 80, "sine");
    } else {
      // Add as source
      const presetSource: Source = {
        name: syllabus.name,
        type: "prompt",
        text: syllabus.documentText,
        wordCount: syllabus.documentText.split(/\s+/).filter(Boolean).length
      };
      setSources((prev) => [...prev, presetSource]);
      setExamTitle(`${syllabus.name} Final Exam`);
      setSelectedPreset(syllabus.id);
      playBeep(880, 100, "sine");
    }
  };

  const isPresetActive = (presetId: string) => {
    const preset = PREDEFINED_SYLLABI.find((p) => p.id === presetId);
    return preset ? sources.some((s) => s.name === preset.name) : false;
  };

  // Drag and Drop Files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    // Strict Format Validation: Only PDF, Word, and Text prompts allowed (No Google Docs allowed)
    const allowed = [".pdf", ".doc", ".docx", ".txt", ".md", ".prompt"];
    const validFiles = files.filter((file) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      return allowed.includes(ext);
    });

    if (validFiles.length < files.length) {
      alert("Some files were rejected. Only PDF (.pdf), Word (.doc, .docx), and Text Prompts (.txt, .md, .prompt) are allowed!");
    }

    if (validFiles.length === 0) return;
    setExtractingCount((prev) => prev + validFiles.length);

    for (const file of validFiles) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const textExtensions = [".txt", ".md", ".prompt"];

      const getSourceType = (extension: string): Source["type"] => {
        if (extension === ".pdf") return "pdf";
        if (extension === ".docx" || extension === ".doc") return "word";
        return "prompt";
      };

      if (textExtensions.includes(ext)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            addNewSource(file.name, text, getSourceType(ext));
          }
          setExtractingCount((prev) => Math.max(0, prev - 1));
        };
        reader.onerror = () => {
          setExtractingCount((prev) => Math.max(0, prev - 1));
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          const base64 = arrayBufferToBase64(arrayBuffer);

          try {
            const res = await fetch("/api/parse-file", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ base64Data: base64, fileName: file.name })
            });

            const data = await res.json();
            if (data.ok && data.text) {
              if (Array.isArray(data.warnings) && data.warnings.length > 0) {
                console.warn(`[Parser Warning] ${file.name}:`, data.warnings.join(" | "));
              }
              addNewSource(file.name, data.text, getSourceType(ext));
            } else {
              alert(data.error || `Failed to extract text from ${file.name}`);
            }
          } catch (err) {
            alert(`Network error: Could not compile ${file.name}`);
          } finally {
            setExtractingCount((prev) => Math.max(0, prev - 1));
          }
        };
        reader.onerror = () => {
          setExtractingCount((prev) => Math.max(0, prev - 1));
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const addNewSource = (name: string, text: string, type: Source["type"]) => {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const newSource: Source = {
      name,
      type,
      text,
      wordCount
    };
    setSources((prev) => {
      // Avoid duplicate source names
      const filtered = prev.filter((s) => s.name !== name);
      return [...filtered, newSource];
    });
    setExamTitle((prev) => {
      const cleanName = name.replace(/\.[^/.]+$/, "") + " Assessment";
      return prev === "Technical Assessment Board" ? cleanName : prev;
    });
    playBeep(880, 80, "sine");
  };

  const handleRemoveSource = (name: string) => {
    setSources((prev) => prev.filter((s) => s.name !== name));
    playBeep(300, 100, "sawtooth");
  };

  const selectIcon = (iconName: string) => {
    switch (iconName) {
      case "Cloud": return <Cloud className="w-5 h-5 text-sky-400" />;
      case "Layers": return <Layers className="w-5 h-5 text-indigo-400" />;
      case "Cpu": return <Cpu className="w-5 h-5 text-emerald-400" />;
      case "Terminal": return <Terminal className="w-5 h-5 text-amber-400" />;
      default: return <BookOpen className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine manual guidelines and active background sources for compilation
    let combinedText = "";
    if (inputText.trim()) {
      combinedText += `=== USER CUSTOM INSTRUCTIONS ===\n${inputText.trim()}\n=== END OF USER CUSTOM INSTRUCTIONS ===\n\n`;
    }
    
    sources.forEach((s) => {
      combinedText += `=== DOCUMENT: ${s.name} ===\n${s.text}\n=== END OF DOCUMENT ===\n\n`;
    });

    if (!combinedText.trim()) {
      alert("Please provide manual guidelines, choose a preset, or drag/drop suitable documents (PDF, Word, Prompts) into the workspace first.");
      return;
    }
    if (!navigator.onLine && selectedModelId !== "local-llm") {
      playBeep(220, 250, "sawtooth");
      alert("No internet connection. Please verify your network settings or switch to the Local Sandbox LLM in options.");
      return;
    }
    if (!isKernelConfigured) {
      playBeep(220, 250, "sawtooth");
      alert("System kernel not configured correctly");
      onOpenSettings();
      return;
    }
    onStartGeneration({
      documentText: combinedText,
      numPapers,
      numQuestions,
      paperDurationMins,
      breakDurationMins,
      title: examTitle
    });
  };

  // Draggable Sources Widget Drag Listener Hook
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isWidgetDragging) return;
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      
      const targetX = Math.max(10, Math.min(window.innerWidth - 300, widgetStartPos.current.x + dx));
      const targetY = Math.max(10, Math.min(window.innerHeight - 400, widgetStartPos.current.y + dy));
      
      setWidgetPos({ x: targetX, y: targetY });
    };

    const handleMouseUp = () => {
      setIsWidgetDragging(false);
    };

    if (isWidgetDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isWidgetDragging]);

  return (
    <div id="welcome-container" className="max-w-6xl mx-auto px-4 py-8 text-slate-800 relative">
      {/* Upper Logo / Banner */}
      <div className="text-center mb-10 space-y-6">
        <div className="flex justify-center">
          <div className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 p-[1.5px] shadow-xl shadow-indigo-500/10 hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full bg-slate-900 rounded-[15px] flex items-center justify-center p-3 sm:p-4">
              <img src="/icon.svg" alt="Apex Solutions Logo" className="w-full h-full object-contain select-none" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300 -z-10"></div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50/50">
          <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600/10" />
          <span className="text-xs font-mono font-medium tracking-wide text-indigo-700">
            Learning Powered by AI
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-900 bg-clip-text text-transparent mb-4">
          Apex Solutions
        </h1>
        <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          The ultimate double-assessment engine for developers. Set custom parameters, verify alignment, and generate exams that run fully offline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Docs & Preset syllabus */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="text-lg font-semibold font-display mb-4 text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              1. Syllabus Document Input
            </h2>

            {/* Quick Templates */}
            <div className="mb-6">
              <span className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">
                Or instantly load one of our core presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PREDEFINED_SYLLABI.map((preset) => {
                  const isActive = isPresetActive(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-50 border-indigo-500 shadow-sm text-slate-800 font-semibold"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        {selectIcon(preset.icon)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="text-xs font-bold text-slate-800 truncate">{preset.name}</h3>
                          {isActive && <div className="p-0.5 rounded-full bg-indigo-500 text-white flex-shrink-0"><span className="block text-[8px] font-bold px-0.5 leading-none">✔</span></div>}
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text Input area & Drag and drop */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-4 min-h-[220px] transition-all duration-200 flex flex-col justify-between ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/20"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                placeholder="Type or paste custom prompts/guidelines, or drag/drop PDF, Word, or Text Prompt files. Uploaded file contents remain completely clean and isolated from this text box..."
                aria-label="Syllabus guidelines content"
                className="w-full h-40 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none resize-none"
              />

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Upload className={`w-3.5 h-3.5 ${extractingCount > 0 ? "animate-bounce text-indigo-500" : ""}`} />
                  <span className={extractingCount > 0 ? "text-indigo-600 font-semibold animate-pulse" : ""}>
                    {extractingCount > 0
                      ? `Extracting ${extractingCount} files...`
                      : "Drag & drop files (PDF, Word, Prompts) here"}
                  </span>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md,.prompt"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Browse Files
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Exam specifications */}
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5 text-slate-800">
            <h2 className="text-lg font-semibold font-display mb-2 text-slate-800 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              2. Assessment Parameters
            </h2>

            {/* Title */}
            <div>
              <label htmlFor="exam-title-input" className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Assessment Title
              </label>
              <input
                id="exam-title-input"
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g. Docker Certified Associate Assessment"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Papers Selection */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Number of Papers
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumPapers(num)}
                    className={`py-2 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      numPapers === num
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    {num} Paper{num > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions per Paper */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                  Questions per Paper
                </label>
                <span className="text-xs text-indigo-600 font-mono font-bold">{numQuestions} Questions</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 30, 45, 90].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumQuestions(num)}
                    className={`py-2 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                      numQuestions === num
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-500"
                    }`}
                  >
                    {num} Q
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-400 leading-normal">
                ⭐ Developer tip: Select <span className="font-mono text-slate-500 font-semibold">10 Q</span> for an instant exam demo generation (10-15s). <span className="font-mono text-slate-500 font-semibold">90 Q</span> represents the official evaluation specification standard.
              </div>
            </div>

            {/* Duration per Paper */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="duration-range" className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                  Duration (per paper)
                </label>
                <span className="text-xs text-slate-700 font-bold font-mono">
                  {Math.floor(paperDurationMins / 60)}h {paperDurationMins % 60 > 0 ? `${paperDurationMins % 60}m` : ""} ({paperDurationMins}m)
                </span>
              </div>
              <input
                id="duration-range"
                type="range"
                min="5"
                max="300"
                step="5"
                value={paperDurationMins}
                onChange={(e) => setPaperDurationMins(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 bg-slate-100 rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>5m (Quick)</span>
                <span>180m (3 Hrs Default)</span>
                <span>300m</span>
              </div>
            </div>

            {/* Break Duration */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="break-range" className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                  Break Duration
                </label>
                <span className="text-xs text-slate-700 font-bold font-mono">
                  {breakDurationMins} Minutes
                </span>
              </div>
              <input
                id="break-range"
                type="range"
                min="1"
                max="120"
                step="1"
                value={breakDurationMins}
                onChange={(e) => setBreakDurationMins(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 bg-slate-100 rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-450 font-mono mt-1">
                <span>1m</span>
                <span>60m (1 Hr Default)</span>
                <span>120m</span>
              </div>
            </div>

            {/* Submit block with system kernel verification on action */}
            <div className="pt-4 space-y-3.5">
              <button
                type="submit"
                disabled={isLoading || extractingCount > 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold border transition-colors bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 border-transparent shadow-sm cursor-pointer text-white"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-100" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Synthesizing Environment Core...</span>
                  </>
                ) : extractingCount > 0 ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Extracting Source Files...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 text-white" />
                    <span>Compile & Initialize Assessment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 🛡️ HIGH FIDELITY DRAGGABLE ACTIVE SOURCES DECK WIDGET */}
      {sources.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: `${widgetPos.x}px`,
            top: `${widgetPos.y}px`,
            zIndex: 9999,
          }}
          className="w-80 bg-white/90 backdrop-blur-md rounded-2xl border border-indigo-200 shadow-2xl overflow-hidden transition-shadow duration-200 select-none"
        >
          {/* Draggable Header */}
          <div
            onMouseDown={(e) => {
              setIsWidgetDragging(true);
              dragStartPos.current = { x: e.clientX, y: e.clientY };
              widgetStartPos.current = { x: widgetPos.x, y: widgetPos.y };
              e.preventDefault();
            }}
            className={`flex items-center justify-between px-4 py-3 bg-slate-900 text-white cursor-move ${
              isWidgetDragging ? "bg-indigo-950" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-mono font-bold tracking-wide">
                Active Sources Deck
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsWidgetCollapsed(!isWidgetCollapsed);
                  playBeep(600, 50, "sine");
                }}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                title={isWidgetCollapsed ? "Expand window" : "Minimize window"}
              >
                {isWidgetCollapsed ? "＋" : "－"}
              </button>
            </div>
          </div>

          {/* Widget Body */}
          {!isWidgetCollapsed && (
            <div className="p-4 space-y-3">
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Ingested Assessment Scope ({sources.length} Source{sources.length > 1 ? "s" : ""}):
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="p-1 rounded bg-indigo-50 border border-indigo-100 flex-shrink-0">
                        {source.type === "pdf" ? (
                          <FileText className="w-3.5 h-3.5 text-red-500" />
                        ) : source.type === "word" ? (
                          <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                      </div>
                      <span
                        className="text-xs font-bold text-slate-800 truncate"
                        title={source.name}
                      >
                        {source.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {source.wordCount} words
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(source.name)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 transition-colors"
                        title="Remove source"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>Hold header to drag</span>
                <span>AI Core: {selectedModelName.split(" ")[selectedModelName.split(" ").length - 1] || "Default"}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
