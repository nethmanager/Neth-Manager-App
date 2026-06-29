import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Zap, AlertCircle, RefreshCw, Terminal, Mic, MicOff, Volume2, VolumeX, ChevronUp, ChevronDown, History, Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAI } from '../contexts/AIContext';
import { useUI } from '../contexts/UIContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AIAssistantFooter() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAssistantRoute = location.pathname === '/assistant';
  const { showToast } = useUI();
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastVoiceSendRef = useRef<string>('');
  const latestHandleSendRef = useRef<(text: string) => void | Promise<void>>();

  const {
    messages,
    setMessages,
    loading,
    aiSettings,
    dbContext,
    contextErrors,
    isCtxLoading,
    lastSynced,
    isFastMode,
    setIsFastMode,
    isDetailedMode,
    setIsDetailedMode,
    voiceEnabled,
    setVoiceEnabled,
    refreshContext,
    sendMessage,
    stopSpeaking,
    agents,
    activeAgentId,
    activeAgent,
    setActiveAgentId,
    provider,
    pendingActions,
    resolvingActionIds,
    resolvePendingAction,
    refreshPendingActions
  } = useAI();

  const [pendingAgentTasks, setPendingAgentTasks] = useState<any[]>([]);
  const [runningTaskIds, setRunningTaskIds] = useState<string[]>([]);

  const fetchPendingTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: tasks, error } = await supabase
        .from('agent_tasks')
        .select(`
          *,
          assigned_agent:ai_agents!assigned_agent_id(name, role)
        `)
        .in('status', ['pending', 'queued'])
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (!error && tasks) {
        setPendingAgentTasks(tasks);
      }
    } catch (e) {
      console.warn("Error fetching pending agent tasks in footer:", e);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchPendingTasks();
      const interval = setInterval(fetchPendingTasks, 5000);
      return () => clearInterval(interval);
    } else {
      setPendingAgentTasks([]);
    }
  }, [isExpanded]);

  const handleRunSpecialist = async (task: any) => {
    if (runningTaskIds.includes(task.id)) return;
    setRunningTaskIds(prev => [...prev, task.id]);
    
    const specialistName = task.assigned_agent?.name || "Specialist";
    showToast.success(`Starting ${specialistName} background run...`);

    // Immediately append a chat message like "{specialistName} is working on it..."
    setMessages?.(prev => [
      ...prev,
      { role: 'assistant' as const, content: `${specialistName} is working on it...` }
    ]);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const activeId = activeAgent?.id || 'default_conversation';
      const currentConvId = localStorage.getItem(`ai_conversation_id_${activeId}`);

      const res = await fetch("/api/assistant/agent-task/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          agent_task_id: task.id,
          conversation_id: currentConvId || undefined
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to process specialist agent task.");
      }
      
      // Append returned timeline_messages
      if (data.timeline_messages && Array.isArray(data.timeline_messages)) {
        setMessages?.(prev => [
          ...prev,
          ...data.timeline_messages.map((m: string) => ({ role: 'assistant' as const, content: m }))
        ]);
      }
      
      // If action is created, immediately refresh pending actions list
      if (data.action_created) {
        await refreshPendingActions();
      }

      // If pending action exists, show a confirmation message
      if (data.pending_action) {
        setMessages?.(prev => [
          ...prev,
          { role: 'assistant' as const, content: `${specialistName} prepared an action. Confirm it below.` }
        ]);
        showToast.success(`${specialistName} prepared an action!`);
      } else {
        showToast.success(`Specialist task processed successfully!`);
      }
      
      // Immediately refresh tasks list
      fetchPendingTasks();
    } catch (err: any) {
      console.error("Run Specialist error:", err);
      showToast.error(err.message || "Failed running specialist task.");
      fetchPendingTasks();
    } finally {
      setRunningTaskIds(prev => prev.filter(id => id !== task.id));
    }
  };

  // Handle mobile & desktop dynamic heights for scroll padding offsets
  useEffect(() => {
    const handleResize = () => {
      if (isAssistantRoute) {
        document.documentElement.style.setProperty('--ai-footer-height', '0px');
        document.documentElement.style.setProperty('--ai-footer-expanded-height', '0px');
        return;
      }
      const height = window.innerWidth >= 768 ? '88px' : '64px';
      document.documentElement.style.setProperty('--ai-footer-height', height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAssistantRoute]);

  // Scroll to bottom when expanded
  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Update CSS variable for layout adjustments
    if (isAssistantRoute) {
      document.documentElement.style.setProperty('--ai-footer-expanded-height', '0px');
      return;
    }
    const expandedHeight = isExpanded ? 'min(400px, 35vh)' : '0px';
    document.documentElement.style.setProperty('--ai-footer-expanded-height', expandedHeight);
  }, [messages, isExpanded, loading, isAssistantRoute]);

  // Initial Context Refresh logic
  useEffect(() => {
    if (isExpanded) {
      refreshContext();
    }
  }, [isExpanded]);

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
    };

    recognitionRef.current = recognition;
  }, []);

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
    
    // Automatically expand when sending a message so the user can see the reply
    if (!isExpanded) setIsExpanded(true);
    
    await sendMessage(text);
  };

  useEffect(() => {
    latestHandleSendRef.current = handleSend;
  }, [handleSend]);

  const getSyncStatus = () => {
    if (isCtxLoading) return "Syncing...";
    if (!lastSynced) return "Waiting to sync";
    const mins = Math.floor((Date.now() - lastSynced) / 60000);
    return mins === 0 ? "Synced just now" : `Synced ${mins}m ago`;
  };

    const effectiveProvider = activeAgent?.model_provider || provider || 'ollama';
  const isCloud = ['gemini', 'openai', 'claude'].includes(effectiveProvider);
  const visiblePendingActions = pendingActions.filter(a => a.status === 'pending' || !a.status);

  if (isAssistantRoute) return null;

  return (
    <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-[50] bg-slate-950/90 backdrop-blur-2xl border-t border-white/5 shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 ease-in-out font-sans pb-[env(safe-area-inset-bottom,0px)]">
      {/* Expandable History Panel */}
      <div className={cn(
        "overflow-hidden transition-all duration-500 ease-in-out bg-black/40",
        isExpanded ? "h-[min(400px,35vh)]" : "h-0"
      )}>
        <div ref={scrollRef} className="h-full overflow-y-auto p-4 md:p-5 space-y-3 no-scrollbar">
          {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-center py-6 opacity-40">
                <div className="w-12 h-12 rounded-[1.5rem] bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                  <Terminal size={24} className="text-white" />
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-1.5">No Messages Yet</h4>
                <p className="text-[10px] text-white/50 max-w-xs mx-auto leading-relaxed">Your recent conversation with Neth AI will appear here. Ask about your businesses, projects, or tasks.</p>
             </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any, i: number) => (
                <div key={i} className={cn(
                  "flex flex-col max-w-[90%] md:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-200",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                  <div className={cn(
                    "px-4 py-2 rounded-xl text-xs leading-relaxed shadow-sm relative group",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none shadow-md"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 text-white/30 text-[8px] font-black uppercase tracking-[0.25em] justify-center border-t border-white/5 pt-3">
                <Terminal size={10} className="text-amber-500 shrink-0" />
                <span>Future messages processed by: {activeAgent?.name || 'Emily'} ({activeAgent?.role || 'Executive Assistant'})</span>
              </div>
                            {pendingAgentTasks.length > 0 && (
                <div className="space-y-2 border-t border-blue-500/20 pt-3">
                  <div className="flex items-center gap-1.5 px-1 py-0.5">
                    <Bot size={12} className="text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Delegated Specialist Tasks ({pendingAgentTasks.length})</span>
                  </div>
                  {pendingAgentTasks.map(task => {
                    const isRunning = runningTaskIds.includes(task.id);
                    return (
                      <div key={task.id} className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-white/95 font-bold mb-0.5">
                            {task.assigned_agent?.name || "Specialist"}: {task.title}
                          </p>
                          <p className="text-[9px] text-white/40 truncate">
                            Type: {task.task_type || 'General'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRunSpecialist(task)}
                          disabled={isRunning}
                          className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0", 
                            isRunning 
                              ? "bg-blue-600 border border-blue-500 text-white animate-pulse" 
                              : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:text-white hover:bg-blue-600"
                          )}
                        >
                          {isRunning ? "Working..." : "Run"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {visiblePendingActions.length > 0 && (
                <div className="space-y-2 border-t border-amber-500/20 pt-3">
                  {visiblePendingActions.map(action => (
                    <div key={action.id} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
                      <p className="text-[10px] text-white/80 font-bold">
                        {action.summary || action.description || 'Pending action needs approval'}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => resolvePendingAction(action.id, false)}
                        disabled={resolvingActionIds.includes(action.id)}
                        className="px-3 py-1 rounded-lg bg-white/5 text-white/50 text-[9px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => resolvePendingAction(action.id, true)}
                        disabled={resolvingActionIds.includes(action.id)}
                        className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", 
                          resolvingActionIds.includes(action.id) 
                            ? "bg-amber-600 text-white animate-pulse" 
                            : "bg-emerald-500 text-black hover:bg-emerald-400"
                        )}
                      >
                        {resolvingActionIds.includes(action.id) ? "Working..." : "Confirm"}
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 text-blue-500 animate-pulse pl-2">
                  <Zap size={14} className="fill-current" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Thinking...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Footer Bar */}
      <div className="h-16 md:h-[88px] flex items-center px-4 md:px-6 gap-3 md:gap-6 relative w-full max-w-[1536px] mx-auto">
        {/* Toggle History Button */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "px-4 md:px-5 py-2 rounded-tl-2xl bg-slate-900 border-l border-t border-white/5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
              isExpanded ? "text-blue-400 bg-slate-800" : "text-white/40 hover:text-white"
            )}
          >
            <History size={12} />
            <span className="hidden sm:inline">{isExpanded ? "Close" : "Conversation"}</span>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button 
            onClick={() => navigate('/assistant')}
            className="px-4 md:px-5 py-2 rounded-tr-2xl bg-slate-900 border-x border-t border-white/5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-slate-800 transition-all border-l-0"
            title="View full chat"
          >
            <Maximize2 size={12} />
            <span className="hidden sm:inline">Full Chat</span>
          </button>
        </div>

        {/* Brand & Status / Agent Selector */}
        <div className="hidden md:flex items-center gap-4 min-w-[240px] max-w-[320px]">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative group/select">
              <select
                value={activeAgentId || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setActiveAgentId(id);
                  const selected = agents.find(a => a.id === id);
                  if (selected) {
                    showToast.success(`Persona set to ${selected.name}`);
                  }
                }}
                className="w-full bg-slate-900 border border-white/5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white py-1 pl-2 pr-6 cursor-pointer focus:outline-none focus:border-amber-500 transition-all truncate"
                title="Active AI Agent Persona"
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id} className="text-black capitalize font-bold">
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={cn("text-[8.5px] font-black uppercase tracking-tighter leading-none shrink-0", isCtxLoading ? "text-blue-400 animate-pulse" : "text-emerald-400")}>
                  {getSyncStatus()}
                </p>
                <div className="w-0.5 h-0.5 rounded-full bg-white/20" />
                <p className="text-[8px] font-bold text-white/30 uppercase truncate leading-none">
                  {activeAgent 
                    ? `${effectiveProvider} / ${activeAgent.model_name || 'default'}`
                    : (aiSettings?.model_name || 'ollama')}
                </p>
              </div>
              {contextErrors.length > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase tracking-tighter leading-none mt-0.5">
                  <AlertCircle size={8} />
                  <span>Some data sync failed</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Input Area */}
        <div className="flex-1 flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 rounded-[1.25rem] px-3 md:px-5 py-1 md:py-2 relative group focus-within:border-blue-500/50 transition-all">
          <input 
            type="text" 
            placeholder={isListening ? "Listening..." : "Ask anything..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className={cn(
              "flex-1 bg-transparent border-none text-xs md:text-sm text-white focus:outline-none placeholder:text-white/20 h-8 md:h-10 w-full",
              isListening && "text-blue-400"
            )}
          />
          <div className="flex items-center gap-1 border-l border-white/5 pl-2 md:pl-3">
            {isListening && (
              <span className="text-[8px] font-black uppercase text-blue-500 animate-pulse tracking-tighter mr-2 hidden sm:block">Listening</span>
            )}
            <button 
              onClick={toggleListening}
              disabled={!speechSupported}
              className={cn(
                "p-1.5 md:p-2 rounded-lg transition-all",
                isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-white/20 hover:text-white",
                !speechSupported && "opacity-20 cursor-not-allowed"
              )}
              title={!speechSupported ? "Voice input is not supported" : (isListening ? "Stop listening" : "Start voice input")}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button 
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || !aiSettings?.enabled}
              className="p-1.5 md:p-2 text-blue-500 hover:text-blue-400 disabled:opacity-20 transition-all"
              title="Send Message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Global Controls */}
        <div className="hidden md:flex items-center gap-2">
          <button 
            onClick={() => setIsFastMode(!isFastMode)}
            className={cn(
              "px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              isFastMode ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
            )}
            title="Fast Mode: Concise responses and half context"
          >
            {isFastMode ? "Fast" : "Balanced"}
          </button>
          <button 
            onClick={() => setIsDetailedMode(!isDetailedMode)}
            className={cn(
              "px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              isDetailedMode ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
            )}
            title="Detailed Mode: Full context and deep answers"
          >
            {isDetailedMode ? "Detailed" : "Standard"}
          </button>
          <button 
            onClick={() => refreshContext()} 
            disabled={isCtxLoading}
            className={cn(
              "p-3 rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-white transition-all",
              isCtxLoading && "animate-spin text-blue-500",
              contextErrors.length > 0 && "border-amber-500/50 text-amber-500/50 hover:text-amber-500"
            )}
            title="Refresh database context"
          >
            <RefreshCw size={18} />
          </button>
          <div className="flex flex-col items-center gap-1">
            <button 
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
              }}
              className={cn(
                "p-3 rounded-xl border transition-all",
                voiceEnabled ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 border-white/10 text-white/20 hover:text-white"
              )}
              title={voiceEnabled ? "Mute responses" : "Read responses aloud"}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <span className={cn("text-[6px] font-black uppercase tracking-widest", voiceEnabled ? "text-emerald-500" : "text-white/20")}>
              {voiceEnabled ? "Replies On" : "Replies Off"}
            </span>
          </div>
        </div>
      </div>
      
      {/* Privacy Note */}
      <div className="pb-1.5 text-center hidden md:block">
        <p className="text-[7px] text-white/20 font-black uppercase tracking-[0.3em]">
          Voice uses browser speech recognition. {isCloud ? "Responses use secure backend." : "Ollama responses stay local."}
        </p>
      </div>
    </div>
  );
}
