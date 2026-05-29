import React, { useEffect } from "react";
import { playBeep } from "../utils/audio";
import { Coffee, ChevronRight, Volume2, ShieldAlert } from "lucide-react";

interface BreakActiveScreenProps {
  durationMins: number;
  timeRemainingSecs: number;
  onSkipBreak: () => void;
}

export default function BreakActiveScreen({ durationMins, timeRemainingSecs, onSkipBreak }: BreakActiveScreenProps) {
  useEffect(() => {
    if (timeRemainingSecs <= 15 && timeRemainingSecs > 0) {
      playBeep(1000, 100, "sine");
    } else if (timeRemainingSecs === 0) {
      playBeep(500, 400, "triangle");
    }
  }, [timeRemainingSecs]);

  const formatCountdown = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalSecsCombined = durationMins * 60;
  const progressRatio = totalSecsCombined > 0 ? timeRemainingSecs / totalSecsCombined : 0;
  
  // Highlight last 15 warning pulse
  const isFinalWarning = timeRemainingSecs <= 15 && timeRemainingSecs > 0;

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center text-slate-800 space-y-8">
      
      {/* Visual Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">
          <Coffee className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold font-display tracking-tight text-slate-800">
          Paper Assessment Break
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
          Take a moment to rest. Paper 2 will commence automatically when the countdown completes.
        </p>
      </div>

      {/* Progress Circle Visual */}
      <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
        {/* SVG Tracker Ring */}
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="84"
            className="stroke-slate-100 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="96"
            cy="96"
            r="84"
            className={`fill-none transition-all duration-1000 ${
              isFinalWarning ? "stroke-rose-500" : "stroke-indigo-600"
            }`}
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 84}
            strokeDashoffset={2 * Math.PI * 84 * (1 - progressRatio)}
          />
        </svg>

        {/* Text countdown inside progress circle */}
        <div className="text-center z-10 space-y-1">
          <span className="block text-3xl font-mono font-bold tracking-tight text-slate-800">
            {formatCountdown(timeRemainingSecs)}
          </span>
          <span className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
            Remaining Time
          </span>
        </div>
      </div>

      {/* Beeping Audio Warn Disclaimer */}
      {isFinalWarning ? (
        <div className="py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs font-mono font-bold flex items-center justify-center gap-2 animate-pulse">
          <Volume2 className="w-4 h-4 text-rose-600" />
          <span>Active Warning Wave Beeping (Offline Warning)</span>
        </div>
      ) : (
        <div className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs font-mono font-bold flex items-center justify-center gap-2">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <span>Automatic Warning Alert at final 15s</span>
        </div>
      )}

      {/* Break Skipping Controller */}
      <div className="pt-2 text-center">
        <button
          onClick={onSkipBreak}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          <span>Skip Recess & Begin Paper 2</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
