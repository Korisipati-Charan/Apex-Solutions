import React from "react";
import { HistoricalReport } from "../types";
import { 
  X, 
  Trash2, 
  History, 
  Calendar, 
  Eye, 
  Activity,
  HardDrive
} from "lucide-react";
import { playBeep } from "../utils/audio";

interface PreviousReportsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reports: HistoricalReport[];
  currentReportId: string | null;
  onSelectReport: (report: HistoricalReport) => void;
  onDeleteReport: (id: string) => void;
}

export default function PreviousReportsPanel({
  isOpen,
  onClose,
  reports,
  currentReportId,
  onSelectReport,
  onDeleteReport
}: PreviousReportsPanelProps) {
  if (!isOpen) return null;

  const handleSelect = (report: HistoricalReport) => {
    playBeep(800, 100, "sine");
    onSelectReport(report);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this historical report scorecard? This action cannot be undone.")) {
      playBeep(300, 150, "sawtooth");
      onDeleteReport(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Sidebar Backdrop Overlay */}
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] cursor-pointer"
        onClick={() => { playBeep(500, 80); onClose(); }}
      />

      {/* Sidebar Container Panel - Slides in cleanly from the Left */}
      <div 
        id="previous-reports-sidebar" 
        className="relative w-full sm:w-[410px] bg-slate-900 text-slate-100 shadow-2xl h-full border-r border-slate-700 flex flex-col animate-slide-in-left font-sans"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="block text-sm font-bold text-slate-200">Assessment History</span>
            </div>
          </div>
          <button 
            onClick={() => { playBeep(500, 80); onClose(); }}
            className="p-1.5 rounded-lg bg-slate-805 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Close Panel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reports Content Area - Always unblinded and direct */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {reports.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3.5 text-slate-500 py-24">
              <Activity className="w-10 h-10 text-slate-700 animate-pulse" />
              <div className="space-y-1.5">
                <p className="font-bold text-slate-300">No scorecards logged yet</p>
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-[280px]">
                  Add a skillset or upload examination guidelines, then request an Evaluation Kernel audit once exam submissions are completed to store historical reports here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="block text-[10px] font-mono font-bold tracking-widest uppercase text-slate-400">
                Cached Assessment Sheets ({reports.length})
              </span>
              
              {reports.map((report) => {
                const isCurrent = currentReportId === report.id;
                
                // Optimized single O(N) traversal for accumulators
                const scoreScores = report.educatorAnalysis?.skillScores || [];
                let scoreTotal = 0;
                let scoreCorrect = 0;
                for (let i = 0; i < scoreScores.length; i++) {
                  const curr = scoreScores[i];
                  scoreTotal += curr.total || 0;
                  scoreCorrect += curr.correct || 0;
                }
                const averagePercent = scoreTotal > 0 ? Math.round((scoreCorrect / scoreTotal) * 100) : 0;
                
                return (
                  <div
                    key={report.id}
                    onClick={() => handleSelect(report)}
                    className={`group p-4 rounded-xl border transition-all duration-200 text-left cursor-pointer relative ${
                      isCurrent
                        ? "bg-indigo-950/40 border-indigo-500/80 text-slate-100 shadow-md shadow-indigo-950/20"
                        : "bg-slate-850 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="text-xs font-bold leading-tight text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-1 pr-6 font-display">
                        {report.title}
                      </h4>
                      
                      {/* Micro-score badge */}
                      <span className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none ${
                        averagePercent >= 75 ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                        averagePercent >= 50 ? "bg-amber-950 text-amber-300 border border-amber-900" :
                        "bg-rose-955 text-rose-400 border border-rose-900"
                      }`}>
                        {averagePercent}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(report.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                      <span>•</span>
                      <span>{report.examSetup?.papers?.length || 0} Papers</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {(report.examSetup?.skills || []).slice(0, 3).map((skill, index) => (
                        <span 
                          key={index} 
                          className="bg-slate-900 border border-slate-800 text-slate-400 text-[8px] px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]"
                          title={skill}
                        >
                          {skill}
                        </span>
                      ))}
                      {report.examSetup?.skills?.length > 3 && (
                        <span className="bg-slate-900 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-mono">
                          +{report.examSetup.skills.length - 3}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-[10px]">
                      <span className="text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 font-bold">
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Performance Report</span>
                      </span>
                      
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, report.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Purge Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isCurrent && (
                      <div className="absolute right-3 top-3 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 text-[10px] text-slate-500 font-mono space-y-1 text-center shrink-0">
          <div className="flex items-center justify-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-slate-600" />
            <span>OFFLINE LOCAL ENVIRONMENT SYSTEM</span>
          </div>
          <p className="text-[9px] text-slate-600 leading-relaxed">
            All reports reside strictly on client partitions. Zero outbound metrics exist. Compatible with compiled Electron/Tauri macOS and Windows execute frames.
          </p>
        </div>
      </div>
    </div>
  );
}
