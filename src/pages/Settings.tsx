import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Bot, 
  Terminal, 
  Save, 
  ShieldCheck, 
  Database,
  Zap,
  Plus,
  Trash2,
  Edit3,
  Volume2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../hooks/useUser';
import { useAI } from '../contexts/AIContext';
import CreateModal from '../components/CreateModal';

import { testOllamaConnection } from '../lib/localAIService';
import { useUI } from '../contexts/UIContext';

const FALLBACK_VOICES = [
  // Google TTS
  { id: '1', voice_provider: 'google', voice_name: 'en-US-Chirp3-HD-Aoede', voice_language_code: 'en-US', label: 'Aoede (HD-English)' },
  { id: '2', voice_provider: 'google', voice_name: 'en-US-Chirp3-HD-Charon', voice_language_code: 'en-US', label: 'Charon (HD-English)' },
  { id: '3', voice_provider: 'google', voice_name: 'en-US-Journey-F', voice_language_code: 'en-US', label: 'Journey Female (English)' },
  { id: '4', voice_provider: 'google', voice_name: 'en-US-Neural2-F', voice_language_code: 'en-US', label: 'Neural2 Female (English)' },
  { id: '5', voice_provider: 'google', voice_name: 'en-US-Wavenet-D', voice_language_code: 'en-US', label: 'Wavenet Male (English)' },
  // ElevenLabs
  { id: '10', voice_provider: 'elevenlabs', voice_name: '21m00Tcm4TlvDq8iKC9e', voice_language_code: 'en-US', label: 'Rachel (Female)' },
  { id: '11', voice_provider: 'elevenlabs', voice_name: 'AZnzlk1XvdvUeBnXmlld', voice_language_code: 'en-US', label: 'Domi (Female)' },
  { id: '12', voice_provider: 'elevenlabs', voice_name: 'EXAVITQu4vr4xnSDxMaL', voice_language_code: 'en-US', label: 'Bella (Female)' },
  { id: '13', voice_provider: 'elevenlabs', voice_name: 'ErXwobaYiN019PkySvjV', voice_language_code: 'en-US', label: 'Antoni (Male)' },
  // Browser Synth
  { id: '20', voice_provider: 'browser', voice_name: 'default', voice_language_code: 'en-US', label: 'System Default' },
  // Piper Local
  { id: '30', voice_provider: 'piper', voice_name: 'en_US-amy-medium', voice_language_code: 'en-US', label: 'Amy (Medium)' },
  { id: '31', voice_provider: 'piper', voice_name: 'en_US-lessac-high', voice_language_code: 'en-US', label: 'Lessac (High)' }
];

export default function Settings() {
  const { user } = useUser();
  const { showToast, confirm } = useUI();
  const { 
    reloadAISettings,
    isFastMode,
    setIsFastMode,
    voiceEnabled,
    setVoiceEnabled,
    voiceProvider,
    setVoiceProvider,
    callModeEnabled,
    setCallModeEnabled,
    speakText,
    lastSynced,
    blockedCount,
    isDetailedMode,
    provider,
    setProvider,
    agents,
    activeAgentId,
    setActiveAgentId,
    refetchAgents
  } = useAI();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'agents' | 'prompts' | 'security'>('profile');
  const [testingVoice, setTestingVoice] = useState(false);

  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<any[]>(FALLBACK_VOICES);
  const agentFormRef = useRef<HTMLDivElement | null>(null);

  const openNewAgent = () => {
    setEditingAgent({
      name: '',
      role: '',
      description: '',
      objectives: '',
      system_prompt: '',
      model_provider: 'gemini',
      model_name: 'gemini-2.5-flash-lite',
      voice_provider: 'google',
      voice_id: null,
      voice_name: 'en-US-Chirp3-HD-Aoede',
      voice_language_code: 'en-US',
      enabled_tools: ['dashboard', 'schedule', 'emails', 'tasks', 'projects'],
      call_mode_default: false,
      is_default: false,
      is_active: true,
      permissions: ['*'],
      confirmation_policy: {
        create_project: true,
        create_task: true,
        create_expense: true,
        create_contact: true,
        link_email_to_project: true,
        create_calendar_event: true,
        move_email_to_folder: false,
        update_project_status: false,
        add_project_note: false
      }
    });
    setIsCreatingNew(true);
    showToast.success("New agent form opened");
    setTimeout(() => {
      agentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  useEffect(() => {
    const fetchVoiceOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_voice_options')
          .select('*');
        
        let normalizedFromDb: any[] = [];
        if (!error && data) {
          normalizedFromDb = data.map((row: any) => ({
            id: row.id,
            voice_provider: row.provider,
            voice_name: row.voice_name,
            voice_language_code: row.language_code,
            label: row.display_name,
            gender: row.gender,
            description: row.description,
            sort_order: row.sort_order
          }));
        }

        // Merge database voices with FALLBACK_VOICES
        // Deduplicate by provider + voice_name
        const seen = new Set<string>();
        const merged: any[] = [];
        
        // First add database voices
        for (const item of normalizedFromDb) {
          const key = `${item.voice_provider}:${item.voice_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }

        // Then add fallback voices if not already seen
        for (const item of FALLBACK_VOICES) {
          const key = `${item.voice_provider}:${item.voice_name}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }

        merged.sort((a: any, b: any) => {
          const orderA = a.sort_order !== null && a.sort_order !== undefined ? a.sort_order : 9999;
          const orderB = b.sort_order !== null && b.sort_order !== undefined ? b.sort_order : 9999;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          const labelA = String(a.label || "").toLowerCase();
          const labelB = String(b.label || "").toLowerCase();
          return labelA.localeCompare(labelB);
        });

        setVoiceOptions(merged);
      } catch (err) {
        console.error("Failed to fetch dynamic voice options:", err);
      }
    };
    fetchVoiceOptions();
  }, []);

  const handleSetActiveAgent = (id: string) => {
    setActiveAgentId(id);
    showToast.success('Agent activated successfully.');
  };

  const handleSetDefaultAgent = async (id: string) => {
    if (!user) return;
    try {
      const { error: resetError } = await supabase
        .from('ai_agents')
        .update({ is_default: false })
        .eq('user_id', user.id);

      if (resetError) throw resetError;

      const { error: updateError } = await supabase
        .from('ai_agents')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      showToast.success('Default agent updated successfully.');
      await refetchAgents();
    } catch (err: any) {
      showToast.error('Failed to set default agent: ' + err.message);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!user) return;
    
    if (agents.length <= 1) {
      showToast.error('You cannot delete the last active agent.');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Delete Agent',
      message: 'Are you sure you want to permanently delete this agent?',
      confirmLabel: 'Delete',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      showToast.success('Agent deleted successfully.');
      await refetchAgents();
      if (activeAgentId === id) {
        const fallback = agents.find(a => a.id !== id);
        if (fallback) {
          setActiveAgentId(fallback.id);
        }
      }
    } catch (err: any) {
      showToast.error('Failed to delete agent: ' + err.message);
    }
  };

  const handleSaveAgent = async () => {
    if (!user || !editingAgent) return;
    if (!editingAgent.name?.trim() || !editingAgent.role?.trim() || !editingAgent.system_prompt?.trim()) {
      showToast.error('Please fill in Name, Role, and System Instructions.');
      return;
    }

    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const payload = {
        ...editingAgent,
        user_id: user.id,
        is_active: true,
        updated_at: timestamp
      };

      if (payload.is_default) {
        await supabase
          .from('ai_agents')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      if (isCreatingNew) {
        delete payload.id;
        const { error } = await supabase
          .from('ai_agents')
          .insert(payload);
        if (error) throw error;
        showToast.success('Agent created successfully.');
      } else {
        const { error } = await supabase
          .from('ai_agents')
          .update(payload)
          .eq('id', editingAgent.id)
          .eq('user_id', user.id);
        if (error) throw error;
        showToast.success('Agent details updated.');
      }

      setEditingAgent(null);
      await refetchAgents();
    } catch (err: any) {
      showToast.error('Failed to save agent: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    try {
      const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0];
      const assistantName = activeAgent?.name || 'Emily';
      await speakText(`Hey Boss, I am ${assistantName}. Voice mode is ready.`);
    } catch (err: any) {
      showToast.error("Test voice failed: " + err.message);
    } finally {
      setTestingVoice(false);
    }
  };
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: ''
  });
  const [aiPrompts, setAiPrompts] = useState<any[]>([]);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    ollama_endpoint: 'http://localhost:11434/api/generate',
    model_name: 'llama3:latest',
    temperature: 0.7,
    max_tokens: 2048,
    allow_sensitive_context: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          avatar_url: profileData.avatar_url || ''
        });
      }

      // Fetch AI Settings
      const { data: aiSettingsData } = await supabase.from('ai_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (aiSettingsData) {
        setAiSettings({
          enabled: aiSettingsData.enabled,
          ollama_endpoint: aiSettingsData.ollama_endpoint || 'http://localhost:11434/api/generate',
          model_name: aiSettingsData.model_name || 'llama3:latest',
          temperature: aiSettingsData.temperature ?? 0.7,
          max_tokens: aiSettingsData.max_tokens ?? 2048,
          allow_sensitive_context: aiSettingsData.allow_sensitive_context ?? false
        });
      }

      // Fetch AI Prompts
      const { data: promptData } = await supabase.from('ai_prompts').select('*').eq('user_id', user.id).order('prompt_key');
      if (promptData) {
        setAiPrompts(promptData);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const cleanProfile = {
        full_name: profile.full_name?.trim() || null,
        avatar_url: profile.avatar_url?.trim() || null
      };
      const cleanAiSettings = {
        enabled: !!aiSettings.enabled,
        ollama_endpoint: aiSettings.ollama_endpoint?.trim() || 'http://localhost:11434/api/generate',
        model_name: aiSettings.model_name?.trim() || 'llama3:latest',
        temperature: aiSettings.temperature ?? 0.7,
        max_tokens: aiSettings.max_tokens ?? 2048,
        allow_sensitive_context: !!aiSettings.allow_sensitive_context
      };

      // Save Profile
      await supabase.from('profiles').upsert({ 
        id: user.id, 
        ...cleanProfile,
        email: user.email,
        updated_at: timestamp
      });
      // Save AI Settings
      await supabase.from('ai_settings').upsert({ 
        user_id: user.id, 
        ...cleanAiSettings,
        updated_at: timestamp
      });

      // Log activity (do not block)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'update_settings',
        entity_type: 'settings',
        details: { profile_updated: true, ai_updated: true }
      }).then(({ error: logError }) => {
        if (logError) console.warn('Activity log failed:', logError);
      });

      await reloadAISettings();
      showToast.success('Settings saved successfully.');
    } catch (err: any) {
      showToast.error('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestResult('Connecting...');
    try {
      const models = await testOllamaConnection(aiSettings.ollama_endpoint);
      if (models) {
        const isModelInstalled = models.some(m => m === aiSettings.model_name || m.startsWith(`${aiSettings.model_name}:`));
        
        if (isModelInstalled) {
          setTestResult(`Connected to Ollama. Available models: ${models.join(', ')}`);
        } else {
          setTestResult(`Connected to Ollama, but ${aiSettings.model_name} is not installed. Run: ollama pull ${aiSettings.model_name.split(':')[0]}`);
        }
      } else {
        setTestResult('Could not reach Ollama. Make sure Ollama is running and was started with this site allowed in OLLAMA_ORIGINS.');
      }
    } catch (err) {
      setTestResult('Could not reach Ollama. Make sure Ollama is running and was started with this site allowed in OLLAMA_ORIGINS.');
    }
  };

  const handleSavePrompt = async (data: any) => {
    if (!user) return;
    try {
      const promptData = {
        ...data,
        user_id: user.id,
        is_active: data.is_active === 'true' || data.is_active === true,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('ai_prompts').upsert(promptData, { onConflict: 'user_id,prompt_key' });
      if (error) throw error;
      
      showToast.success('AI Prompt saved');
      loadSettings();
      setIsPromptModalOpen(false);
      setEditingPrompt(null);
    } catch (err: any) {
      showToast.error('Failed to save prompt: ' + err.message);
    }
  };

  const deletePrompt = async (id: string) => {
  const isConfirmed = await confirm({
    title: 'Delete AI Prompt',
    message: 'Delete this custom AI prompt? The default app prompt will be used instead.',
    confirmLabel: 'Delete Prompt',
    isDestructive: true
  });

  if (!isConfirmed) return;

  try {
    const { error } = await supabase.from('ai_prompts').delete().eq('id', id);
    if (error) throw error;
    showToast.success('Prompt deleted');
    loadSettings();
  } catch (err: any) {
    showToast.error('Failed to delete prompt');
  }
};

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h2>
        <p className="text-white/40 text-sm">Manage your profile, AI preferences, and application settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          {[
            { id: 'profile', label: 'User Profile', icon: User },
            { id: 'ai', label: 'AI Settings', icon: Bot },
            { id: 'agents', label: 'AI Agents', icon: Bot },
            { id: 'prompts', label: 'AI Prompts', icon: Zap },
            { id: 'security', label: 'Security', icon: ShieldCheck },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all",
                activeTab === item.id ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Profile Section */}
          {activeTab === 'profile' && (
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                <User size={20} className="text-blue-400" /> My Profile
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Full Name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Avatar URL</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="https://..."
                    value={profile.avatar_url}
                    onChange={(e) => setProfile({...profile, avatar_url: e.target.value})}
                  />
                </div>
                <div className="opacity-50">
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Email Address</label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full bg-black/20 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white/40 cursor-not-allowed"
                    value={user?.email || ''}
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI Intelligence Section */}
          {activeTab === 'ai' && (
            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                  <Bot size={20} className="text-purple-400" /> Intelligence Engine
                </h3>
                <button 
                  onClick={() => setAiSettings({...aiSettings, enabled: !aiSettings.enabled})}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                    aiSettings.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  )}
                >
                  {aiSettings.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="space-y-4">
                <div className={cn("transition-all duration-300", provider !== 'ollama' && "opacity-30 pointer-events-none")}>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Ollama API URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      disabled={provider !== 'ollama'}
                      className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                      value={aiSettings.ollama_endpoint}
                      onChange={(e) => setAiSettings({...aiSettings, ollama_endpoint: e.target.value})}
                    />
                    <button 
                      disabled={provider !== 'ollama'}
                      onClick={testConnection}
                      className="px-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all flex items-center justify-center"
                      title="Test Connection"
                    >
                      <Terminal size={18} />
                    </button>
                  </div>
                  <div className="mt-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                      To use Ollama from this hosted dev app, start Ollama with:
                    </p>
                    <code className="block p-3 rounded-lg bg-black/40 text-blue-400 text-[10px] font-mono break-all leading-loose">
                      $env:OLLAMA_ORIGINS="https://ais-dev-dkobt4keatbfrwa5de7sxh-22129348999.us-central1.run.app,http://localhost:3000"<br />
                      ollama serve
                    </code>
                  </div>
                  {testResult && (
                    <p className={cn(
                      "text-[10px] mt-4 font-bold uppercase tracking-widest px-1",
                      testResult.includes('Connected') ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {testResult}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">AI Engine Provider</label>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-bold text-blue-400"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                    >
                      <option value="gemini" className="text-white">Gemini Online</option>
                      <option value="openai" className="text-white">OpenAI Online</option>
                      <option value="ollama" className="text-white">Ollama Local</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Local Model</label>
                    <select 
                      disabled={provider !== 'ollama'}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      value={aiSettings.model_name}
                      onChange={(e) => setAiSettings({...aiSettings, model_name: e.target.value})}
                    >
                      <option value="gemma3:4b">Gemma 3 4B</option>
                      <option value="qwen3:8b">Qwen 3 8B</option>
                      <option value="llama3.2:3b">Llama 3.2 3B</option>
                      <option value="llama3:latest">Llama 3</option>
                      <option value="mistral:latest">Mistral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Temperature</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="1"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all"
                      value={aiSettings.temperature}
                      onChange={(e) => setAiSettings({...aiSettings, temperature: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Fast Mode</h4>
                      <p className="text-[9px] text-white/30 uppercase leading-relaxed font-bold">Favor speed over depth.</p>
                    </div>
                    <button 
                      onClick={() => setIsFastMode(!isFastMode)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        isFastMode ? "bg-amber-500" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        isFastMode ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-4 p-4 rounded-2xl bg-black/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Pass sensitive context</h4>
                        <p className="text-[9px] text-white/30 uppercase leading-relaxed font-bold">Include contact details and sensitive notes in AI prompts.</p>
                      </div>
                      <button 
                        onClick={() => setAiSettings({...aiSettings, allow_sensitive_context: !aiSettings.allow_sensitive_context})}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          aiSettings.allow_sensitive_context ? "bg-amber-500" : "bg-white/10"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          aiSettings.allow_sensitive_context ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                    {!aiSettings.allow_sensitive_context && (
                      <p className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-wider border-t border-white/5 pt-2">
                        Recommendation: Keep this OFF. Ollama will not see private notes or contact details.
                      </p>
                    )}
                    {aiSettings.allow_sensitive_context && (
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider border-t border-white/5 pt-2">
                        Warning: AI will see unredacted phone numbers, addresses, and business notes. Absolute secrets (tokens/passwords) are always redacted.
                      </p>
                    )}
                  </div>

                  {/* Premium Cloud Voice Settings */}
                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">Assistant Voice & Call Intelligence</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Voice Enabled Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Voice Feedback</h4>
                          <p className="text-[9px] text-white/30 uppercase leading-relaxed font-bold">Have the assistant speak replies aloud.</p>
                        </div>
                        <button 
                          onClick={() => setVoiceEnabled(!voiceEnabled)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            voiceEnabled ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            voiceEnabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>

                      {/* Call Mode Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Call Mode</h4>
                          <p className="text-[9px] text-white/30 uppercase leading-relaxed font-bold font-sans">Short, direct replies optimized for spoken live calls.</p>
                        </div>
                        <button 
                          onClick={() => setCallModeEnabled(!callModeEnabled)}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            callModeEnabled ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            callModeEnabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Voice Provider Dropdown */}
                      <div className="p-4 rounded-2xl bg-black/20">
                        <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Voice Provider</label>
                        <select 
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                          value={voiceProvider}
                          onChange={(e) => setVoiceProvider(e.target.value as 'browser' | 'elevenlabs' | 'piper' | 'google')}
                        >
                          <option value="browser" className="text-black">Browser Synth (Local Fallback)</option>
                          <option value="elevenlabs" className="text-black">ElevenLabs Cloud Voice (Premium Option)</option>
                          <option value="google" className="text-black">Google Cloud TTS (Premium Option)</option>
                          <option value="piper" className="text-black">Piper Local TTS</option>
                        </select>
                      </div>

                      {/* Test premium voice button */}
                      <div className="flex items-end">
                        <button
                          disabled={testingVoice || !voiceEnabled}
                          onClick={handleTestVoice}
                          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                          title={voiceEnabled ? "Synthesizes a test phrase" : "Enable voice feedback first to test"}
                        >
                          <Volume2 size={16} />
                          {testingVoice ? 'Synthesizing...' : voiceProvider === 'elevenlabs' ? 'Test ElevenLabs Voice' : voiceProvider === 'google' ? 'Test Google Cloud voice' : 'Test Local voice'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Header block */}
              <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                      <Bot size={20} className="text-amber-400" /> AI Agents
                    </h3>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Configure user-owned agents. Switch active agents in the assistant dropdown.</p>
                  </div>
                  <button
                    type="button"
                    onClick={openNewAgent}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md hover:shadow-amber-500/20"
                  >
                    <Plus size={14} /> New Agent
                  </button>
                </div>
              </div>

              {/* Edit/Create Form Panel */}
              {editingAgent && (
                <div ref={agentFormRef} className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-3 duration-300">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3 border-b border-white/10 pb-4">
                    {isCreatingNew ? 'Create New AI Agent' : `Edit Agent - ${editingAgent.name}`}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Agent Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-bold"
                        placeholder="e.g. Marcus"
                        value={editingAgent.name}
                        onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Role / Job Title</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                        placeholder="e.g. Financial Analyst"
                        value={editingAgent.role}
                        onChange={(e) => setEditingAgent({ ...editingAgent, role: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Short Description</label>
                      <input 
                        type="text" 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                        placeholder="Brief summary of what this agent does"
                        value={editingAgent.description || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Objectives</label>
                      <textarea 
                        rows={2}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-sans text-xs"
                        placeholder="Define core strategic objectives of this agent..."
                        value={editingAgent.objectives || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, objectives: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">System Instructions / Prompt</label>
                      <textarea 
                        rows={6}
                        required
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-mono text-xs"
                        placeholder="Define exactly how this agent behaves, speaks, and analyzes data..."
                        value={editingAgent.system_prompt || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Model Provider</label>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-bold"
                        value={editingAgent.model_provider}
                        onChange={(e) => setEditingAgent({ ...editingAgent, model_provider: e.target.value as any })}
                      >
                        <option value="gemini" className="text-black">Gemini (Cloud Platform)</option>
                        <option value="openai" className="text-black">OpenAI (Cloud Platform)</option>
                        <option value="claude" className="text-black">Claude (Optional / Not Configured)</option>
                        <option value="ollama" className="text-black">Ollama (Local Run)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Model Name</label>
                      <input 
                        type="text" 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-bold"
                        placeholder="e.g. gemini-2.5-flash-lite, gpt-4.1-mini, or llama3:latest"
                        value={editingAgent.model_name || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, model_name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Voice Provider</label>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-bold"
                        value={editingAgent.voice_provider || 'browser'}
                        onChange={(e) => setEditingAgent({ ...editingAgent, voice_provider: e.target.value as any })}
                      >
                        <option value="browser" className="text-black">Browser Synth</option>
                        <option value="elevenlabs" className="text-black">ElevenLabs Cloud</option>
                        <option value="google" className="text-black">Google Cloud TTS</option>
                        <option value="piper" className="text-black">Piper Local</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Voice Selection</label>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all text-xs font-semibold"
                        value={editingAgent.voice_name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const currentOptions = (voiceOptions.length > 0 ? voiceOptions : FALLBACK_VOICES)
                            .filter(v => v.voice_provider === editingAgent.voice_provider);
                          const selected = currentOptions.find(opt => opt.voice_name === val);
                          if (selected) {
                            setEditingAgent({
                              ...editingAgent,
                              voice_name: selected.voice_name,
                              voice_language_code: selected.voice_language_code
                            });
                          } else {
                            setEditingAgent({
                              ...editingAgent,
                              voice_name: val
                            });
                          }
                        }}
                      >
                        <option value="" className="text-black">-- Select a Voice --</option>
                        {(voiceOptions.length > 0 ? voiceOptions : FALLBACK_VOICES)
                          .filter(v => v.voice_provider === editingAgent.voice_provider)
                          .map(opt => (
                            <option key={opt.id || opt.voice_name} value={opt.voice_name} className="text-black font-semibold">
                              {opt.label || opt.voice_name} ({opt.voice_language_code})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Voice Language Code</label>
                      <input 
                        type="text" 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-bold"
                        placeholder="e.g. en-US"
                        value={editingAgent.voice_language_code || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, voice_language_code: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2 px-1">Override Voice ID (Cloud Provider)</label>
                      <input 
                        type="text" 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-mono"
                        placeholder="e.g. ElevenLabs Voice ID"
                        value={editingAgent.voice_id || ''}
                        onChange={(e) => setEditingAgent({ ...editingAgent, voice_id: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center gap-4 py-4 px-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingAgent({ ...editingAgent, call_mode_default: !editingAgent.call_mode_default })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            editingAgent.call_mode_default ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            editingAgent.call_mode_default ? "right-1" : "left-1"
                          )} />
                        </button>
                        <div>
                          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Call Mode Default</p>
                          <p className="text-[8px] text-white/40 uppercase">Optimized speech templates</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-4 px-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingAgent({ ...editingAgent, is_default: !editingAgent.is_default })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            editingAgent.is_default ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            editingAgent.is_default ? "right-1" : "left-1"
                          )} />
                        </button>
                        <div>
                          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Default Agent</p>
                          <p className="text-[8px] text-white/40 uppercase">Is pre-selected at startup</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-4 px-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingAgent({ ...editingAgent, is_active: !editingAgent.is_active })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            editingAgent.is_active !== false ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            editingAgent.is_active !== false ? "right-1" : "left-1"
                          )} />
                        </button>
                        <div>
                          <p className="text-[10px] font-bold text-white uppercase tracking-wider">Active Agent</p>
                          <p className="text-[8px] text-white/40 uppercase">Is available for selection</p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 px-1">Enabled Capabilities / Tools</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                        {[
                          'dashboard', 'schedule', 'emails', 'tasks', 'projects',
                          'finance', 'expenses', 'banks', 'accounts', 'receipts',
                          'playbooks', 'followups', 'phonebook', 'clients', 'files'
                        ].map((tool) => {
                          const hasTool = editingAgent.enabled_tools?.includes(tool);
                          return (
                            <label key={tool} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={hasTool}
                                onChange={() => {
                                  let updatedTools = [...(editingAgent.enabled_tools || [])];
                                  if (hasTool) {
                                    updatedTools = updatedTools.filter(t => t !== tool);
                                  } else {
                                    updatedTools.push(tool);
                                  }
                                  setEditingAgent({ ...editingAgent, enabled_tools: updatedTools });
                                }}
                                className="rounded border-white/10 bg-black/40 text-amber-500 focus:ring-0 focus:ring-offset-0"
                              />
                              <span className="text-xs text-white/60 group-hover:text-white transition-colors capitalize">{tool}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Backend Core Permissions</label>
                      <p className="text-[10px] text-white/40 uppercase -mt-2 px-1">Check actions this agent has permission to execute on the backend</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                        {[
                          { id: '*', label: 'Admin Access (* - All Tools)' },
                          { id: 'create_project', label: 'Create Projects' },
                          { id: 'create_task', label: 'Create Tasks' },
                          { id: 'create_expense', label: 'Create Expenses' },
                          { id: 'create_contact', label: 'Create Contacts' },
                          { id: 'link_email_to_project', label: 'Link Emails to Projects' },
                          { id: 'create_calendar_event', label: 'Create Calendar Events' },
                          { id: 'move_email_to_folder', label: 'Move Emails to Folders' },
                          { id: 'update_project_status', label: 'Update Project Statuses' },
                          { id: 'add_project_note', label: 'Add Project Notes' }
                        ].map((perm) => {
                          const permissions = editingAgent.permissions || [];
                          const hasPerm = permissions.includes(perm.id);
                          return (
                            <label key={perm.id} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={hasPerm}
                                onChange={() => {
                                  let updated = [...permissions];
                                  if (hasPerm) {
                                    updated = updated.filter(p => p !== perm.id);
                                  } else {
                                    updated.push(perm.id);
                                  }
                                  setEditingAgent({ ...editingAgent, permissions: updated });
                                }}
                                className="rounded border-white/10 bg-black/40 text-amber-500 focus:ring-0 focus:ring-offset-0"
                              />
                              <span className="text-xs text-white/60 group-hover:text-white transition-colors capitalize">{perm.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Confirmation Policy</label>
                      <p className="text-[10px] text-white/40 uppercase -mt-2 px-1">Check actions that require user approval before execution (unchecked runs autonomously)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                        {[
                          { id: 'create_project', label: 'Require Approval to Create Projects' },
                          { id: 'create_task', label: 'Require Approval to Create Tasks' },
                          { id: 'create_expense', label: 'Require Approval to Create Expenses' },
                          { id: 'create_contact', label: 'Require Approval to Create Contacts' },
                          { id: 'link_email_to_project', label: 'Require Approval to Link Emails' },
                          { id: 'create_calendar_event', label: 'Require Approval to Create Calendar Events' },
                          { id: 'move_email_to_folder', label: 'Require Approval to Move Emails' },
                          { id: 'update_project_status', label: 'Require Approval to Update Project' },
                          { id: 'add_project_note', label: 'Require Approval to Add Project Notes' }
                        ].map((policy) => {
                          const config = editingAgent.confirmation_policy || {};
                          const requiresApproval = config[policy.id] !== false; // DEFAULT is true/requires approval
                          return (
                            <label key={policy.id} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={requiresApproval}
                                onChange={(e) => {
                                  const updatedConfig = {
                                    ...(editingAgent.confirmation_policy || {}),
                                    [policy.id]: e.target.checked
                                  };
                                  setEditingAgent({ ...editingAgent, confirmation_policy: updatedConfig });
                                }}
                                className="rounded border-white/10 bg-black/40 text-rose-500 focus:ring-0 focus:ring-offset-0"
                              />
                              <span className="text-xs text-white/60 group-hover:text-white transition-colors">{policy.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgent(null);
                        setIsCreatingNew(false);
                      }}
                      className="px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveAgent}
                      className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <Save size={14} /> {saving ? 'Saving...' : 'Save Agent'}
                    </button>
                  </div>
                </div>
              )}

              {/* Agents List Block */}
              <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-4">Registered Agents Directory</h4>
                <div className="grid grid-cols-1 gap-4">
                  {agents.map((agent) => {
                    const isCurrentlyActive = activeAgentId === agent.id;
                    return (
                      <div 
                        key={agent.id}
                        className={cn(
                          "p-5 rounded-2xl border transition-all space-y-3",
                          isCurrentlyActive 
                            ? "bg-amber-500/10 border-amber-500/30" 
                            : "bg-black/20 border-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-white">{agent.name}</span>
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase">
                                {agent.role.replace('_', ' ')}
                              </span>
                              {agent.is_default && (
                                <span className="text-[8px] font-black text-black bg-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Default
                                </span>
                              )}
                              {isCurrentlyActive && (
                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Active Conversation
                                </span>
                              )}
                            </div>
                            <p className="text-white/60 text-xs mt-1 font-sans">{agent.description || 'No description provided.'}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAgent({ ...agent });
                                setIsCreatingNew(false);
                                setTimeout(() => {
                                  agentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 100);
                              }}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                              title="Edit Agent"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                              title="Delete Agent"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/40 border-t border-white/5 pt-3">
                          <span className="font-bold">Model: {agent.model_provider} ({agent.model_name})</span>
                          <span className="text-white/10">•</span>
                          <span className="font-bold">Voice: {agent.voice_provider}</span>
                          <span className="text-white/10">•</span>
                          <span className="font-bold">Tools: {agent.enabled_tools.slice(0, 3).join(', ')}{agent.enabled_tools.length > 3 ? '...' : ''}</span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 justify-end">
                          {!isCurrentlyActive && (
                            <button
                              type="button"
                              onClick={() => handleSetActiveAgent(agent.id)}
                              className="px-3 py-1.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-wider transition-all"
                            >
                              Activate
                            </button>
                          )}
                          {!agent.is_default && (
                            <button
                              type="button"
                              onClick={() => handleSetDefaultAgent(agent.id)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-400 text-[10px] font-bold uppercase tracking-wider transition-all"
                            >
                              Make Default
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Security Section */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-8 rounded-3xl bg-white/5 border border-white/10 space-y-6 shadow-xl backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                  <ShieldCheck size={20} className="text-emerald-400" /> AI Privacy & Safety
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">AI Context Mode</p>
                    <p className="text-xs font-bold text-emerald-400 uppercase">{isDetailedMode ? 'Detailed' : 'Safe'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Last Context Sync</p>
                    <p className="text-xs font-bold text-white uppercase">{lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Blocked Responses</p>
                    <p className="text-lg font-black text-red-500">{blockedCount}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Always Excluded Data</h4>
                  <ul className="space-y-2">
                    {[
                      "OAuth Refresh & Access Tokens",
                      "Raw Email Decoded Payloads",
                      "Platform Passwords",
                      aiSettings.allow_sensitive_context ? null : "Login Notes & Private Credentials",
                    ].filter(Boolean).map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-[10px] text-white/60 font-bold uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* AI Prompts Section */}
          {activeTab === 'prompts' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                    <Zap size={20} className="text-amber-400" /> Custom AI Prompts
                  </h3>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Override default AI behavior for specific tasks.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingPrompt(null);
                    setIsPromptModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 rounded-xl text-[10px] font-black text-white uppercase transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <Plus size={14} /> New Prompt
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {aiPrompts.length === 0 ? (
                  <div className="p-12 rounded-3xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                    <Bot size={32} className="text-white/10 mb-4" />
                    <p className="text-sm text-white/40 font-medium">No custom prompts yet.</p>
                    <p className="text-[10px] text-white/20 mt-1 uppercase font-bold tracking-widest">Custom behavior will use smart defaults.</p>
                  </div>
                ) : (
                  aiPrompts.map(prompt => (
                    <div key={prompt.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em]",
                            prompt.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/20"
                          )}>
                            {prompt.prompt_key}
                          </div>
                          <h4 className="text-sm font-bold text-white">{prompt.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingPrompt(prompt);
                              setIsPromptModalOpen(true);
                            }}
                            className="p-2 text-white/40 hover:text-white transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => deletePrompt(prompt.id)}
                            className="p-2 text-white/40 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-1">System Prompt Snippet</p>
                        <div className="p-4 rounded-2xl bg-black/40 text-[10px] font-mono text-white/40 line-clamp-3 leading-loose whitespace-pre-wrap">
                          {prompt.system_prompt}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <CreateModal
  isOpen={isPromptModalOpen}
  onClose={() => {
    setIsPromptModalOpen(false);
    setEditingPrompt(null);
  }}
  title={editingPrompt ? 'Edit Custom Prompt' : 'New Custom Prompt'}
  onSubmit={handleSavePrompt}
  mode={editingPrompt ? 'edit' : 'create'}
  initialValues={editingPrompt ? {
    ...editingPrompt,
    is_active: String(editingPrompt.is_active)
  } : { is_active: 'true' }}
                fields={[
                  { 
                    name: 'prompt_key', 
                    label: 'Prompt Key', 
                    type: 'select',
                    options: [
                      { label: 'Email Triage', value: 'email_triage' },
                      { label: 'Assistant Chat', value: 'assistant_chat' },
                      { label: 'Daily Plan', value: 'daily_plan' },
                      { label: 'Task Planning', value: 'task_planning' },
                      { label: 'Business Summary', value: 'business_summary' },
                      { label: 'Project Summary', value: 'project_summary' }
                    ]
                  },
                  { name: 'title', label: 'Reference Title', type: 'text', placeholder: 'e.g. My Custom Triage' },
                  { name: 'system_prompt', label: 'System Prompt (Role/Rules)', type: 'textarea', placeholder: 'You are an expert... You must...' },
                  { name: 'user_prompt_template', label: 'User Template (Optional)', type: 'textarea', placeholder: 'Context: {{context}}' },
                  { 
                    name: 'is_active', 
                    label: 'Status', 
                    type: 'select',
                    options: [
                      { label: 'Active', value: 'true' },
                      { label: 'Inactive', value: 'false' }
                    ]
                  }
                ]}
              />
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3 rounded-[2rem] border border-white/10 bg-slate-950/60 p-4 shadow-2xl transition-all duration-300">
            <button 
              onClick={loadSettings}
              disabled={saving || loading}
              className="px-8 py-3 rounded-2xl border border-white/10 text-white/40 font-bold text-sm tracking-widest uppercase hover:bg-white/5 transition-all disabled:opacity-20"
            >
              Discard
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center justify-center gap-2 px-10 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm tracking-widest uppercase transition-all active:scale-95 shadow-xl shadow-blue-500/20 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
