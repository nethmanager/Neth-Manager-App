import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Zap, AlertCircle, RefreshCw, Terminal, ArrowLeft, Mic, MicOff, Volume2, VolumeX, Phone, Hand, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useOllamaAssistant } from '../hooks/useOllamaAssistant';
import { useUI } from '../contexts/UIContext';

function CallWaveform({ active, thinking }: { active: boolean; thinking: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5 h-12 w-48">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-full transition-all duration-300 bg-blue-500",
            thinking ? "bg-amber-500 animate-pulse h-6" : active ? "animate-bounce h-8" : "h-2 bg-white/10"
          )}
          style={{
            animationDelay: `${bar * 0.08}s`,
            animationDuration: '0.5s'
          }}
        />
      ))}
    </div>
  );
}

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastVoiceSendRef = useRef<string>('');
  const latestHandleSendRef = useRef<(text: string) => void | Promise<void>>();

  const {
    messages,
    loading,
    aiSettings,
    dbContext,
    contextErrors,
    isCtxLoading,
    lastSynced,
    refreshContext,
    sendMessage,
    provider,
    setProvider,
    voiceEnabled,
    setVoiceEnabled,
    stopSpeaking,
    isSpeaking,
    callModeEnabled,
    setCallModeEnabled,
    agents,
    activeAgentId,
    activeAgent,
    setActiveAgentId,
    pendingActions,
    resolvePendingAction
  } = useOllamaAssistant();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const [mutedMic, setMutedMic] = useState(false);
  const mutedMicStateRef = useRef(false);

  useEffect(() => {
    mutedMicStateRef.current = mutedMic;
  }, [mutedMic]);

  // Keep refs of speaking, loading and call modes to avoid closure stale state
  const isSpeakingRef = useRef(false);
  const loadingRef = useRef(false);
  const callModeEnabledRef = useRef(false);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    callModeEnabledRef.current = callModeEnabled;
  }, [callModeEnabled]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const latestResult = event.results[event.results.length - 1];
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      
      setInput(transcript);

      if (latestResult.isFinal) {
        setIsListening(false);
        if (transcript.trim() && transcript !== lastVoiceSendRef.current) {
          lastVoiceSendRef.current = transcript;
          setTimeout(() => {
            latestHandleSendRef.current?.(transcript);
            setInput('');
          }, 500);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // Continuous Call Mode listening restoration
      if (callModeEnabledRef.current && !isSpeakingRef.current && !loadingRef.current && !mutedMicStateRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch (e) {
          // Ignore if already active
        }
      }
    };

    recognitionRef.current = recognition;
  }, []);

  // Sync mic trigger when status variables transition
  useEffect(() => {
    if (!speechSupported || !recognitionRef.current) return;

    const shouldListen = callModeEnabled && !isSpeaking && !loading && !mutedMic;
    
    if (shouldListen) {
      if (!isListening) {
        try {
          lastVoiceSendRef.current = '';
          recognitionRef.current.start();
          setIsListening(true);
          console.log("Call Mode: Mic activated, listening for Boss...");
        } catch (err) {
          // Already running
        }
      }
    } else {
      if (isListening) {
        try {
          recognitionRef.current.stop();
          setIsListening(false);
          console.log("Call Mode: Mic paused.");
        } catch (err) {
          // Already stopped
        }
      }
    }
  }, [callModeEnabled, isSpeaking, loading, mutedMic, speechSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const toggleListening = () => {
    if (!speechSupported) {
      showToast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        lastVoiceSendRef.current = '';
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start recognition:", err);
      }
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || input;
    if (!text.trim()) return;
    if (!customPrompt) setInput('');
    await sendMessage(text);
  };

  useEffect(() => {
    latestHandleSendRef.current = handleSend;
  }, [handleSend]);

  const getSyncStatus = () => {
    if (isCtxLoading) return "Syncing data...";
    if (!lastSynced) return "Waiting to sync";
    const mins = Math.floor((Date.now() - lastSynced) / 60000);
    return mins === 0 ? "Synced just now" : `Synced ${mins}m ago`;
  };

  const QuickPrompt = ({ label, prompt }: { label: string, prompt: string }) => (
    <button 
      onClick={() => handleSend(prompt)}
      className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest whitespace-nowrap"
    >
      {label}
    </button>
  );

  const effectiveProvider = activeAgent?.model_provider || provider || 'ollama';
  const isCloud = ['gemini', 'openai', 'claude'].includes(effectiveProvider);

  const handleEndCall = () => {
    setCallModeEnabled(false);
    stopSpeaking();
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    setIsListening(false);
  };

  const handleToggleSpeaker = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    if (!nextVal) {
      stopSpeaking();
    }
  };

  const handleInterrupt = () => {
    stopSpeaking();
    if (!isListening && !mutedMic) {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {}
    }
  };

  if (callModeEnabled) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || "No request registered yet";
    const lastAIMessage = [...messages].reverse().find(m => m.role === 'assistant')?.content || "Standing by...";

    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col justify-between p-6 overflow-hidden md:p-12 animate-in fade-in duration-300">
        {/* Call Top Header */}
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em]">SECURE COMMS ONLINE</h2>
              <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">{effectiveProvider} / {activeAgent?.model_name || 'default'}</span>
            </div>
          </div>

          <button 
            onClick={() => {
              setCallModeEnabled(false);
              stopSpeaking();
              try { recognitionRef.current?.stop(); } catch(e) {}
              setIsListening(false);
            }}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-white/50 hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            Switch to Text
          </button>
        </div>

        {/* Center Orbital SONAR Dashboard */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 my-6">
          <div className="relative flex items-center justify-center h-64 w-64 md:h-80 md:w-80">
            {/* Pulsating circles */}
            <div className={cn(
              "absolute inset-0 rounded-full border border-white/5 transition-all duration-1000",
              isListening && "border-blue-500/10 animate-ping",
              isSpeaking && "border-amber-500/10 animate-pulse"
            )} />
            <div className={cn(
              "absolute inset-8 rounded-full border border-white/5 transition-all duration-1000",
              isListening && "border-blue-500/20 scale-105 duration-500",
              isSpeaking && "border-amber-500/20 scale-102"
            )} />
            <div className="absolute inset-16 rounded-full border border-white/[0.02]" />

            {/* Glowing Center Core */}
            <div className={cn(
              "absolute inset-24 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl",
              isListening && "bg-blue-500/5 shadow-blue-500/10 border border-blue-500/20",
              isSpeaking && "bg-amber-500/5 shadow-amber-500/10 border border-amber-500/20",
              loading && "bg-neutral-900 shadow-neutral-900 border border-white/5"
            )}>
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 relative">
                {loading ? (
                  <Loader2 className="text-amber-500 animate-spin" size={32} />
                ) : isSpeaking ? (
                  <Volume2 className="text-amber-400 animate-pulse" size={32} />
                ) : isListening ? (
                  <Mic className="text-blue-400 animate-bounce" size={32} />
                ) : (
                  <Bot className="text-white/40" size={32} />
                )}
              </div>
            </div>
          </div>

          {/* Info Details below SONAR */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-white uppercase tracking-[0.25em]">{activeAgent?.name || 'Emily'}</h1>
            <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">{activeAgent?.role || 'Executive Assistant'}</p>
            
            <div className="pt-4 flex justify-center">
              <CallWaveform active={isSpeaking || isListening} thinking={loading} />
            </div>

            {/* Micro Badge Status */}
            <div className="pt-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                loading && "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse",
                isSpeaking && "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
                isListening && "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse",
                mutedMic && "bg-red-500/10 border-red-500/20 text-red-500",
                !isSpeaking && !isListening && !loading && !mutedMic && "bg-white/5 border-white/10 text-white/30"
              )}>
                {loading ? "System is thinking..." : isSpeaking ? "Speaking..." : isListening ? "Listening continuously..." : mutedMic ? "Mic is muted" : "Standing by"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Transcript / Subtitle Overlay */}
        <div className="w-full max-w-xl mx-auto bg-white/[0.02] border border-white/5 rounded-3xl p-6 mb-6 space-y-4 max-h-40 overflow-y-auto no-scrollbar shadow-inner">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">You said:</p>
            <p className="text-xs text-white/70 italic font-bold">"{lastUserMessage}"</p>
          </div>
          <div className="space-y-1 border-t border-white/5 pt-3">
            <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">{activeAgent?.name || 'Emily'} responded:</p>
            <p className="text-xs text-white font-medium leading-relaxed">
              {isSpeaking ? (
                <span>{lastAIMessage.length > 200 ? `${lastAIMessage.substring(0, 200)}...` : lastAIMessage}</span>
              ) : (
                <span className="opacity-40">{lastAIMessage}</span>
              )}
            </p>
          </div>
        </div>

        {/* Bottom Control buttons */}
        <div className="flex items-center justify-center gap-6 pb-6">
          {/* Mute Mic toggle */}
          <button 
            onClick={() => setMutedMic(!mutedMic)}
            className={cn(
              "p-4 rounded-full border transition-all shadow-lg shrink-0",
              mutedMic ? "bg-red-500 border-red-500 text-white" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
            title="Mute microphone"
          >
            <MicOff size={22} />
          </button>

          {/* Large Red End Call Button */}
          <button 
            onClick={handleEndCall}
            className="p-5 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-xl shadow-red-500/20 border border-red-500 shrink-0 transform hover:scale-105"
            title="End voice session"
          >
            <Phone size={28} className="rotate-[135deg]" />
          </button>

          {/* Mute Speaker toggle */}
          <button 
            onClick={handleToggleSpeaker}
            className={cn(
              "p-4 rounded-full border transition-all shadow-lg shrink-0",
              !voiceEnabled ? "bg-red-500 border-red-500 text-white" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
            title="Mute synthetic voice responses"
          >
            {!voiceEnabled ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>

          {/* Interrupt Assistant button */}
          <button 
            onClick={handleInterrupt}
            className={cn(
              "p-4 rounded-full border bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all shadow-lg shrink-0",
              !isSpeaking && "opacity-20 cursor-not-allowed pointer-events-none"
            )}
            title="Interrupt assistant speaking"
          >
            <Hand size={22} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex-1 flex flex-col min-h-[600px] bg-slate-950/50 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={activeAgentId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setActiveAgentId(id);
                    const selected = agents.find(a => a.id === id);
                    if (selected) {
                      showToast.success(`Switched active agent to ${selected.name}`);
                    }
                  }}
                  className="bg-transparent border-none text-xl font-black uppercase tracking-[0.2em] text-white focus:outline-none focus:ring-0 p-0 pr-8 cursor-pointer hover:text-blue-400 transition-colors"
                  title="Switch AI Agent Persona"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id} className="text-black capitalize font-bold">
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn("text-[10px] font-black uppercase tracking-widest leading-none", isCtxLoading ? "text-blue-400 animate-pulse" : "text-emerald-400")}>
                  {getSyncStatus()}
                </span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest leading-none">
                  {activeAgent 
                    ? `${effectiveProvider} / ${activeAgent.model_name || 'default'}`
                    : (aiSettings?.model_name || 'ollama')}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeAgent ? (
            <div className="text-[10px] font-black uppercase tracking-[0.15em] bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-white/50 max-w-xs truncate">
              Engine: <span className="text-amber-400 capitalize">{effectiveProvider}</span> / <span className="text-white">{activeAgent.model_name || 'default'}</span>
            </div>
          ) : (
            <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => setProvider('gemini')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  effectiveProvider === 'gemini' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                Gemini
              </button>
              <button
                onClick={() => setProvider('openai')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  effectiveProvider === 'openai' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                OpenAI
              </button>
              <button
                onClick={() => setProvider('claude')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  effectiveProvider === 'claude' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                Claude (Opt)
              </button>
              <button
                onClick={() => setProvider('ollama')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  effectiveProvider === 'ollama' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                Ollama
              </button>
            </div>
          )}
          <button 
            onClick={() => refreshContext()} 
            disabled={isCtxLoading}
            className={cn("p-4 rounded-2xl bg-white/5 border border-white/5 text-white/20 hover:text-white transition-all", isCtxLoading && "animate-spin")}
            title="Sync business context"
          >
            <RefreshCw size={20} />
          </button>
          
          <button 
            onClick={() => {
              setCallModeEnabled(true);
              setVoiceEnabled(true);
            }}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-md shrink-0 transform active:scale-95"
            title="Start hands-free Voice Call"
          >
            <Mic size={14} className="animate-pulse" />
            <span>Start Call</span>
          </button>
        </div>
      </div>

      {/* Context Alert if errored */}
      {contextErrors.length > 0 && !isCtxLoading && (
        <div className="mx-8 mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-500">
            <AlertCircle size={18} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest">Partial Sync Failure</p>
              <p className="text-[8px] font-bold uppercase tracking-tighter opacity-50">{contextErrors.length} sync errors detected</p>
            </div>
          </div>
          <button onClick={() => refreshContext()} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all">
            Retry Sync
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto opacity-40 py-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/5 flex items-center justify-center mb-6 border border-blue-500/10">
              <Terminal size={32} className="text-blue-500" />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-[0.4em] mb-3">Neth Assistant</h3>
            <p className="text-xs text-white/60 leading-relaxed uppercase tracking-widest font-bold px-4">
              Ask questions about your businesses, projects, tasks, platforms, emails, and plans.
            </p>
            
            <div className="grid grid-cols-1 w-full gap-3 mt-8">
              <QuickPrompt label="Daily Summary" prompt="Provide a high-level summary of my current daily plan and objectives." />
              <QuickPrompt label="What Should I Do Next?" prompt="Based on my current tasks and priorities, what is the next thing I should work on?" />
              <QuickPrompt label="Urgent Items" prompt="List all tasks or emails that require immediate attention (urgent priority or overdue)." />
              <QuickPrompt label="Business Overview" prompt="Analyze my active businesses and platforms. Which one needs attention?" />
              <QuickPrompt label="Email Summary" prompt="Summarize my unread emails and highlight anything important." />
            </div>
          </div>
        )}

        {messages.map((msg: any, i: number) => (
          <div key={i} className={cn(
            "flex flex-col max-w-[90%] md:max-w-[70%] animate-in fade-in slide-in-from-bottom-1 duration-200",
            msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
          )}>
            <div className={cn(
              "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-md",
              msg.role === 'user' 
                ? "bg-blue-600 text-white rounded-br-none" 
                : "bg-white/5 border border-white/10 text-white/90 rounded-bl-none"
            )}>
              {msg.content}
            </div>
            <div className="flex items-center gap-2 mt-1 px-1">
              <span className="text-[8px] font-black uppercase text-white/20 tracking-[0.2em]">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
            </div>
          </div>
        ))}
        
        <div className="flex items-center gap-2 text-white/30 text-[8px] font-black uppercase tracking-[0.25em] justify-center border-t border-white/5 pt-4">
          <Terminal size={10} className="text-amber-500 shrink-0" />
          <span>Future messages processed by: {activeAgent?.name || 'Emily'} ({activeAgent?.role || 'Executive Assistant'})</span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-blue-400 p-2 pl-4">
            <Zap size={16} className="animate-pulse fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      {pendingActions.filter(a => a.status === 'pending' || !a.status).length > 0 && (
        <div className="mx-4 md:mx-6 mb-2 p-4 rounded-3xl bg-amber-500/5 border border-amber-500/20 space-y-3 shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-[0.2em]">Pending Action Approval Needed</h4>
            </div>
            <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider">
              {pendingActions.filter(a => a.status === 'pending' || !a.status).length} Pending
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {pendingActions.filter(a => a.status === 'pending' || !a.status).map((action) => (
              <div key={action.id} className="p-3 rounded-2xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-[9px] font-black tracking-widest text-white/40 uppercase">
                    <span className="text-amber-500">{action.action_type?.replace(/_/g, ' ') || 'Action'}</span>
                    <span>•</span>
                    <span className="text-white/60">{action.entity_type || 'unspecified'}</span>
                  </div>
                  <p className="text-xs text-white/90 font-medium">{action.summary || action.description || 'Approve backend creation'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => {
                      resolvePendingAction(action.id, false);
                      showToast.success("Action skipped.");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        await resolvePendingAction(action.id, true);
                        showToast.success('Action executed successfully.');
                      } catch (err: any) {
                        showToast.error('Failed to execute: ' + err.message);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-black/40 border-t border-white/5">
        {!aiSettings?.enabled && (
          <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-4 text-red-500">
            <AlertCircle size={20} />
            <span className="text-xs font-black uppercase tracking-widest">AI is disabled. Enable it in Settings.</span>
          </div>
        )}
        <div className="relative flex items-center gap-3">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder={isListening ? "Listening..." : "Ask anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className={cn(
                "w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-24 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/10 shadow-inner",
                isListening && "border-blue-500 bg-blue-500/5"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {isListening && (
                <span className="text-[8px] font-black uppercase text-blue-500 animate-pulse tracking-widest mr-1">Listening</span>
              )}
              <button 
                onClick={toggleListening}
                disabled={!speechSupported}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-white/20 hover:text-white",
                  !speechSupported && "opacity-20 cursor-not-allowed"
                )}
                title={!speechSupported ? "Voice input is not supported in this browser. Try Chrome or Edge." : (isListening ? "Stop listening" : "Start voice input")}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || !aiSettings?.enabled}
                className="p-2 text-blue-500 hover:text-blue-400 disabled:opacity-10 transition-all"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <button 
            onClick={() => {
              if (voiceEnabled) stopSpeaking();
              setVoiceEnabled(!voiceEnabled);
            }}
            className={cn(
              "p-3 rounded-2xl border transition-all shadow-md shrink-0",
              voiceEnabled ? "bg-blue-600 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
            )}
            title={voiceEnabled ? "Mute responses" : "Read responses aloud"}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
        <p className="mt-3 text-[9px] text-white/30 text-center uppercase font-black tracking-widest leading-relaxed">
          Voice input uses browser speech recognition. {isCloud ? "Responses use secure backend." : "Ollama responses stay local."}
        </p>
      </div>
    </div>
  );
}
