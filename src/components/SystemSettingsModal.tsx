import React, { useState, useEffect } from "react";
import { 
  X, 
  Cpu, 
  Sparkles, 
  Check, 
  Info, 
  Key, 
  Network, 
  Eye, 
  EyeOff, 
  HelpCircle,
  AlertOctagon,
  CheckCircle
} from "lucide-react";
import { playBeep } from "../utils/audio";

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

import type { ApiConfig as SharedApiConfig } from "../../shared/apiContract";

export interface ApiConfig extends Required<SharedApiConfig> {}

export const SUPPORTED_MODELS = [
  {
    id: "gemini-3.5-flash",
    name: "Google Gemini 3.5 Flash",
    provider: "gemini",
    tier: "Balanced & Fast",
    description: "Highly optimized model for fast creation of multi-choice papers and evaluation summaries.",
    badge: "Official Default",
    badgeColor: "bg-indigo-900 text-indigo-300 border-indigo-700"
  },
  {
    id: "gemini-3.5-pro",
    name: "Google Gemini 3.5 Pro",
    provider: "gemini",
    tier: "Maximum Intelligence",
    description: "Highest reasoning capability for complex, deep computer science and full-stack software engineer exams.",
    badge: "Deep Reasoning",
    badgeColor: "bg-purple-900 text-purple-300 border-purple-700"
  },
  {
    id: "openai-gpt-4o",
    name: "OpenAI GPT-4o",
    provider: "openai",
    tier: "Flagship Intelligence",
    description: "Excellent logical analysis, reliable schema outputs, and technical guidance generation.",
    badge: "GPT-4o Flagship",
    badgeColor: "bg-emerald-900 text-emerald-300 border-emerald-700"
  },
  {
    id: "claude-3-5-sonnet",
    name: "Anthropic Claude 3.5 Sonnet",
    provider: "anthropic",
    tier: "SOTA Developer Core",
    description: "Highly descriptive code insights, complex evaluation mechanics, and multi-layered grading feedback.",
    badge: "Claude Sonnet",
    badgeColor: "bg-amber-900/60 text-amber-300 border-amber-700"
  },
  {
    id: "local-llm",
    name: "Local Offline LLM Service",
    provider: "local-llm",
    tier: "Private Local Connection",
    description: "Routes requests to secure local services or custom offline servers running on your workstation.",
    badge: "Local Connection",
    badgeColor: "bg-blue-900 text-blue-300 border-blue-700"
  },
  {
    id: "other-llm",
    name: "Other",
    provider: "other-llm",
    tier: "Custom Endpoint Gateway",
    description: "Connect any other custom API gateway, private corporate endpoint cluster, or proprietary proxy.",
    badge: "Custom Provider",
    badgeColor: "bg-slate-950 text-slate-300 border-slate-800"
  }
];

export default function SystemSettingsModal({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel
}: SystemSettingsModalProps) {
  const [config, setConfig] = useState<ApiConfig>({
    geminiApiKey: "",
    openaiApiKey: "",
    anthropicApiKey: "",
    sarvamApiKey: "",
    localLlmUrl: "http://localhost:11434/v1",
    localLlmModel: "llama3",
    otherLlmUrl: "https://api.openai.com/v1",
    otherLlmModel: "gpt-4o",
    otherLlmApiKey: ""
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
    sarvam: false,
    other: false
  });

  const [testStatus, setTestStatus] = useState<{ type: "idle" | "testing" | "success" | "error"; text: string } | null>(null);

  // Load configuration on mount or open
  useEffect(() => {
    if (isOpen) {
      setTestStatus(null);
      const stored = localStorage.getItem("apex_api_config");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setConfig(prev => ({
            ...prev,
            ...parsed
          }));
        } catch (e) {
          console.error("Failed to parse API config", e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectModel = (modelId: string) => {
    playBeep(440, 100, "sine");
    onSelectModel(modelId);
    setTestStatus(null);
  };

  const handleInputChange = (field: keyof ApiConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setTestStatus(null);
  };

  const toggleShowKey = (provider: string) => {
    playBeep(600, 50, "sine");
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const getIsFormValid = () => {
    if (!selectedModel) return false;
    const activeModel = SUPPORTED_MODELS.find(m => m.id === selectedModel);
    if (!activeModel) return false;
    switch (activeModel.provider) {
      case "gemini":
        return config.geminiApiKey.trim() !== "";
      case "openai":
        return config.openaiApiKey.trim() !== "";
      case "anthropic":
        return config.anthropicApiKey.trim() !== "";
      case "sarvam":
        return config.sarvamApiKey.trim() !== "";
      case "local-llm":
        return config.localLlmUrl.trim() !== "" && config.localLlmModel.trim() !== "";
      case "other-llm":
        return config.otherLlmUrl.trim() !== "" && config.otherLlmModel.trim() !== "";
      default:
        return true;
    }
  };

  const testConnection = async () => {
    if (!getIsFormValid()) return;
    playBeep(440, 80, "sine");
    setTestStatus({ type: "testing", text: "Dispatching verification ping to System Core gateway..." });
    
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          apiConfig: config
        })
      });
      
      const data = await response.json();
      if (response.ok && data.ok) {
        playBeep(880, 150, "sine");
        const mObj = SUPPORTED_MODELS.find(m => m.id === selectedModel);
        const modelLabel = mObj ? mObj.name : selectedModel;
        setTestStatus({
          type: "success",
          text: `successfully connected with ${modelLabel}`
        });
      } else {
        playBeep(180, 250, "sawtooth");
        setTestStatus({
          type: "error",
          text: `Verification failed: ${data.error || "Establishment handshake failed."}`
        });
      }
    } catch (e: any) {
      playBeep(180, 250, "sawtooth");
      setTestStatus({
        type: "error",
        text: `Network Error: Unable to contact testing route. ${e.message}`
      });
    }
  };

  const handleApply = () => {
    if (!getIsFormValid()) {
      playBeep(200, 200, "sawtooth");
      return;
    }
    playBeep(523.25, 120, "sine");
    setTimeout(() => {
      playBeep(659.25, 150, "sine");
    }, 80);

    localStorage.setItem("apex_api_config", JSON.stringify(config));
    onClose();
  };

  // Find info about currently selected model
  const activeModelInfo = SUPPORTED_MODELS.find(m => m.id === selectedModel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        onClick={() => { playBeep(300, 80); onClose(); }}
      />
      
      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up font-sans text-slate-100">
        
        {/* Header bar */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-display">System Configuration</h3>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Logic Engine Kernels &amp; Authentication</p>
            </div>
          </div>
          <button
            onClick={() => { playBeep(300, 80); onClose(); }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss preferences"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-6 flex-grow">
          {/* Informational Header */}
          <div className="p-3.5 bg-indigo-950/30 border border-indigo-900/40 rounded-xl flex items-start gap-3 text-xs text-indigo-300">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Execution Environment Settings</p>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                Configure complete model selection and custom connection parameters. Zero default fallbacks are used. 
                If a key is missing or incorrect, operations will raise transparent validation reports instantly.
              </p>
            </div>
          </div>

          {/* Model selection lists */}
          <div className="space-y-3">
            <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">
              1. Select Processing Kernel
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORTED_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                
                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model.id)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 text-left cursor-pointer group flex items-start gap-3 relative ${
                      isSelected
                        ? "bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/20"
                        : "bg-slate-850 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-slate-600 group-hover:border-slate-400"
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>

                    <div className="space-y-1 flex-grow">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-100 font-display leading-tight pr-6">
                          {model.name}
                        </span>
                        <span className={`self-start text-[8px] px-1.5 py-0.5 mt-1 rounded border font-mono font-bold leading-none ${model.badgeColor}`}>
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal font-semibold">
                        {model.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Corresponding API configuration parameters */}
          <div className="space-y-4 pt-4 border-t border-slate-800/60">
            <div>
              <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">
                2. API Configuration Settings
              </span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Provide the credentials, endpoints, or custom identifiers required to run your selected model. Keys are stored locally inside your browser cache.
              </p>
            </div>

            <div className="space-y-3.5 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              
              {!activeModelInfo ? (
                <div className="p-3.5 bg-amber-950/20 border border-amber-900/30 rounded-xl text-amber-300 flex items-start gap-2.5 animate-fade-in text-xs font-sans">
                  <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-left">
                    <p className="font-bold">No Logic Kernel Selected</p>
                    <p className="text-slate-400 font-semibold leading-relaxed">
                      Please choose one of the Top 4 processing kernels or custom gateways above to proceed. Once selected, its configuration input form will be activated here.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Gemini Provider Input Block */}
                  {activeModelInfo.provider === "gemini" && (
                <div className="space-y-1.5 animate-scale-up">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>Google Gemini API Key</span>
                    </label>
                    <span className="text-[9px] font-mono text-slate-500">Google Gemini Provider API</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.gemini ? "text" : "password"}
                      value={config.geminiApiKey}
                      onChange={(e) => handleInputChange("geminiApiKey", e.target.value)}
                      placeholder="Leave empty to use pre-configured GEMINI_API_KEY if available"
                      className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 pl-3 pr-9 text-xs font-mono placeholder-slate-550 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("gemini")}
                      className="absolute right-2.5 top-2 hover:text-slate-200 text-slate-500"
                    >
                      {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* OpenAI Provider Input Block */}
              {activeModelInfo.provider === "openai" && (
                <div className="space-y-1.5 animate-scale-up">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>OpenAI API Key</span>
                    </label>
                    <span className="text-[9px] font-mono text-slate-500">OpenAI Platform API</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.openai ? "text" : "password"}
                      value={config.openaiApiKey}
                      onChange={(e) => handleInputChange("openaiApiKey", e.target.value)}
                      placeholder="sk-..."
                      required
                      className="w-full bg-slate-900 border border-slate-750 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg py-1.5 pl-3 pr-9 text-xs font-mono placeholder-slate-550 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openai")}
                      className="absolute right-2.5 top-2 hover:text-slate-200 text-slate-500"
                    >
                      {showKeys.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Anthropic Provider Input Block */}
              {activeModelInfo.provider === "anthropic" && (
                <div className="space-y-1.5 animate-scale-up">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold font-mono text-amber-450 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>Anthropic Claude API Key</span>
                    </label>
                    <span className="text-[9px] font-mono text-slate-500">Anthropic Console API</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.anthropic ? "text" : "password"}
                      value={config.anthropicApiKey}
                      onChange={(e) => handleInputChange("anthropicApiKey", e.target.value)}
                      placeholder="sk-ant-..."
                      required
                      className="w-full bg-slate-900 border border-slate-750 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-1.5 pl-3 pr-9 text-xs font-mono placeholder-slate-550 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("anthropic")}
                      className="absolute right-2.5 top-2 hover:text-slate-200 text-slate-500"
                    >
                      {showKeys.anthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Sarvam Provider Input Block */}
              {activeModelInfo.provider === "sarvam" && (
                <div className="space-y-1.5 animate-scale-up">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold font-mono text-orange-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>Sarvam AI Subscription Key</span>
                    </label>
                    <span className="text-[9px] font-mono text-slate-500">Sarvam Platform API</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys.sarvam ? "text" : "password"}
                      value={config.sarvamApiKey}
                      onChange={(e) => handleInputChange("sarvamApiKey", e.target.value)}
                      placeholder="Enter subscription key"
                      required
                      className="w-full bg-slate-900 border border-slate-750 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-lg py-1.5 pl-3 pr-9 text-xs font-mono placeholder-slate-550 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("sarvam")}
                      className="absolute right-2.5 top-2 hover:text-slate-200 text-slate-500"
                    >
                      {showKeys.sarvam ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Local LLM Provider Input Block */}
              {activeModelInfo.provider === "local-llm" && (
                <div className="space-y-4 animate-scale-up">
                  <div className="p-2.5 bg-blue-950/20 border border-blue-900/40 rounded-lg text-[10px] text-blue-300 leading-normal flex items-start gap-2 font-mono">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <p>
                      Provide the connection URL and model identifier for your offline model deployment. Ensure that external network calls are allowed if connecting to a network resource.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold font-mono text-blue-300 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5" />
                        <span>Local Endpoint URL</span>
                      </label>
                      <input
                        type="text"
                        value={config.localLlmUrl}
                        onChange={(e) => handleInputChange("localLlmUrl", e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        required
                        className="w-full bg-slate-900 border border-slate-750 focus:border-blue-550 focus:ring-1 focus:ring-blue-550 rounded-lg py-1.5 px-3 text-xs font-mono placeholder-slate-550 focus:outline-none text-slate-100"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold font-mono text-blue-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Model Identifier</span>
                      </label>
                      <input
                        type="text"
                        value={config.localLlmModel}
                        onChange={(e) => handleInputChange("localLlmModel", e.target.value)}
                        placeholder="llama3"
                        required
                        className="w-full bg-slate-900 border border-slate-750 focus:border-blue-550 focus:ring-1 focus:ring-blue-550 rounded-lg py-1.5 px-3 text-xs font-mono placeholder-slate-550 focus:outline-none text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Other Custom LLM Input Block */}
              {activeModelInfo.provider === "other-llm" && (
                <div className="space-y-4 animate-scale-up">
                  <div className="p-2.5 bg-slate-800/40 border border-slate-700/60 rounded-lg text-[10px] text-slate-350 leading-normal flex items-start gap-2 font-mono">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                    <p>
                      Provide custom parameters for any external OpenAI-compatible service provider.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold font-mono text-indigo-300 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5" />
                        <span>Custom Endpoint URL</span>
                      </label>
                      <input
                        type="text"
                        value={config.otherLlmUrl}
                        onChange={(e) => handleInputChange("otherLlmUrl", e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        required
                        className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs font-mono placeholder-slate-550 focus:outline-none text-slate-100"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold font-mono text-indigo-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>Model Name / ID</span>
                      </label>
                      <input
                        type="text"
                        value={config.otherLlmModel}
                        onChange={(e) => handleInputChange("otherLlmModel", e.target.value)}
                        placeholder="gpt-4o"
                        required
                        className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs font-mono placeholder-slate-550 focus:outline-none text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-semibold font-mono text-indigo-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" />
                        <span>API Access Token / Key (Optional)</span>
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeys.other ? "text" : "password"}
                        value={config.otherLlmApiKey}
                        onChange={(e) => handleInputChange("otherLlmApiKey", e.target.value)}
                        placeholder="Leave blank if custom endpoint requires no Bearer authentication"
                        className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 pl-3 pr-9 text-xs font-mono placeholder-slate-550 focus:outline-none text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey("other")}
                        className="absolute right-2.5 top-2 hover:text-slate-200 text-slate-500"
                      >
                        {showKeys.other ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

              {/* Universal Help Text */}
              <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                <HelpCircle className="w-3 h-3 text-slate-550" />
                <span>No API keys or system details are shared outside your own container environment.</span>
              </div>

              {/* Verified status flash bar near bottom */}
              {testStatus && testStatus.type !== "testing" && (
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs animate-fade-in ${
                  testStatus.type === "success"
                    ? "bg-emerald-950/40 border-emerald-900 text-emerald-300"
                    : "bg-rose-955/20 border-rose-905 text-rose-300"
                }`}>
                  {testStatus.type === "success" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div className="flex-1 font-mono text-[11px] leading-snug">
                    {testStatus.text}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center gap-4 shrink-0">
          <div className="text-[10px] text-amber-500 font-medium font-mono">
            {!getIsFormValid() && (
              <span>⚠️ Configure active kernel parameters above to activate Apply.</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { playBeep(250, 80); onClose(); }}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
            
            {selectedModel && getIsFormValid() && (
              <button
                type="button"
                disabled={testStatus?.type === "testing"}
                onClick={testConnection}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                  testStatus?.type === "success"
                    ? "bg-emerald-900/30 border-emerald-800 text-emerald-300"
                    : testStatus?.type === "error"
                      ? "bg-rose-900/20 border-rose-800 text-rose-300"
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-indigo-400 hover:text-indigo-300"
                }`}
              >
                {testStatus?.type === "testing" ? "Verifying..." : "Verify Connection"}
              </button>
            )}

            <button
              type="button"
              disabled={!getIsFormValid()}
              onClick={handleApply}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-slate-50 shadow-md cursor-pointer transition-all"
            >
              Apply Preferences
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
