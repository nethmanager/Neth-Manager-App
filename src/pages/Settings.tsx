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
  Volume2,
  UserCheck,
  Key,
  RefreshCw,
  Server,
  Cpu,
  Cloud,
  DollarSign,
  CreditCard,
  Clock,
  Activity,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldAlert,
  FileText,
  Sliders,
  ChevronRight,
  Info,
  Phone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  const [agentStats, setAgentStats] = useState<Record<string, any>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<any[]>(FALLBACK_VOICES);
  const agentFormRef = useRef<HTMLDivElement | null>(null);

  // Budget state variables
  const [budgetSettings, setBudgetSettings] = useState({
    daily_budget_usd: 10.00,
    monthly_budget_usd: 100.00,
    per_agent_monthly_budget_usd: 10.00,
    stop_on_limit: true,
    warn_threshold_percent: 80.00
  });
  const [saveBudgetLoading, setSaveBudgetLoading] = useState(false);

  // Global blueprints for new agents (localStorage defaults)
  const [defaultNewAgentProvider, setDefaultNewAgentProvider] = useState(() => localStorage.getItem('default_new_agent_provider') || 'gemini');
  // Note: model_name and temperature defaults reside in the existing `aiSettings.model_name` and `aiSettings.temperature` states
  const [defaultNewAgentVoiceProvider, setDefaultNewAgentVoiceProvider] = useState(() => localStorage.getItem('default_new_agent_voice_provider') || 'google');
  const [defaultNewAgentVoiceName, setDefaultNewAgentVoiceName] = useState(() => localStorage.getItem('default_new_agent_voice_name') || 'en-US-Chirp3-HD-Aoede');
  const [defaultNewAgentCallMode, setDefaultNewAgentCallMode] = useState(() => localStorage.getItem('default_new_agent_call_mode') === 'true');

  // Runtime & Fallback states
  const [preferredRuntimeBehavior, setPreferredRuntimeBehavior] = useState(() => localStorage.getItem('ai_preferred_runtime') || 'cloud_first');
  const [cloudFallbackOnMobile, setCloudFallbackOnMobile] = useState(() => localStorage.getItem('ai_fallback_mobile_tablet') !== 'false');
  const [ollamaLocalOnly, setOllamaLocalOnly] = useState(() => localStorage.getItem('ai_use_ollama_local_only') === 'true');

  // Privacy & Safety states
  const [defaultSafetyDbApproval, setDefaultSafetyDbApproval] = useState(() => localStorage.getItem('default_safety_db_approval') !== 'false');
  const [defaultSafetyPublishApproval, setDefaultSafetyPublishApproval] = useState(() => localStorage.getItem('default_safety_publish_approval') !== 'false');
  const [defaultSafetyMessagingApproval, setDefaultSafetyMessagingApproval] = useState(() => localStorage.getItem('default_safety_messaging_approval') !== 'false');
  const [defaultSafetyRememberPrefs, setDefaultSafetyRememberPrefs] = useState(() => localStorage.getItem('default_safety_remember_prefs') !== 'false');
  const [defaultSafetySummarizeConvos, setDefaultSafetySummarizeConvos] = useState(() => localStorage.getItem('default_safety_summarize_convos') !== 'false');

  // Maintenance & Ollama Status
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [recentTransactionLogs, setRecentTransactionLogs] = useState<any[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [recalculatingLogs, setRecalculatingLogs] = useState(false);

  // Global overview stats
  const [globalStats, setGlobalStats] = useState({
    todayCost: 0,
    monthCost: 0,
    lastRunTime: null as string | null,
    lastRunCost: 0,
    activeAgentsCount: 0
  });

  const openNewAgent = () => {
    // Read from state or localStorage
    const defProvider = defaultNewAgentProvider || 'gemini';
    const defModel = aiSettings.model_name || 'gemini-2.5-flash-lite';
    const defTemp = aiSettings.temperature ?? 0.7;
    const defVoiceProv = defaultNewAgentVoiceProvider || 'google';
    const defVoiceName = defaultNewAgentVoiceName || 'en-US-Chirp3-HD-Aoede';
    const defCallMode = defaultNewAgentCallMode;

    setEditingAgent({
      name: '',
      role: '',
      description: '',
      objectives: '',
      system_prompt: '',
      model_provider: defProvider,
      model_name: defModel,
      temperature: defTemp,
      voice_provider: defVoiceProv,
      voice_id: null,
      voice_name: defVoiceName,
      voice_language_code: defVoiceName.startsWith('en-') ? 'en-US' : 'en-US',
      enabled_tools: ['dashboard', 'schedule', 'emails', 'tasks', 'projects'],
      call_mode_default: defCallMode,
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
    showToast.success("New agent blueprint loaded successfully!");
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

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setStatsLoading(true);
      try {
        const todayStr = new Date();
        todayStr.setHours(0, 0, 0, 0);
        const isoToday = todayStr.toISOString();

        const monthStr = new Date();
        monthStr.setDate(1);
        monthStr.setHours(0, 0, 0, 0);
        const isoMonth = monthStr.toISOString();

        const { data: events, error } = await supabase
          .from('ai_usage_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', isoMonth);

        if (!error && events) {
          const stats: Record<string, any> = {};
          
          let todayCost = 0;
          let monthCost = 0;
          let lastRunTime: string | null = null;
          let lastRunCost = 0;

          for (const ag of agents) {
            stats[ag.id] = {
              todayTokens: 0,
              monthTokens: 0,
              todayCost: 0,
              monthCost: 0,
              msgCount: 0,
              totalChatCost: 0,
              lastRunCost: 0,
              lastRunTime: null
            };
          }

          for (const ev of events) {
            const aId = ev.agent_id || 'global';
            if (!stats[aId]) {
              stats[aId] = {
                todayTokens: 0,
                monthTokens: 0,
                todayCost: 0,
                monthCost: 0,
                msgCount: 0,
                totalChatCost: 0,
                lastRunCost: 0,
                lastRunTime: null
              };
            }

            const evDate = new Date(ev.created_at);
            const isToday = evDate >= todayStr;
            const cost = Number(ev.estimated_cost_usd || 0);
            const tokens = Number(ev.total_tokens || 0);

            monthCost += cost;
            if (isToday) {
              todayCost += cost;
            }

            if (!lastRunTime || ev.created_at > lastRunTime) {
              lastRunTime = ev.created_at;
              lastRunCost = cost;
            }

            stats[aId].monthTokens += tokens;
            stats[aId].monthCost += cost;

            if (isToday) {
              stats[aId].todayTokens += tokens;
              stats[aId].todayCost += cost;
            }

            if (ev.operation_type === 'chat') {
              stats[aId].msgCount += 1;
              stats[aId].totalChatCost += cost;
            }

            if (!stats[aId].lastRunTime || ev.created_at > stats[aId].lastRunTime) {
              stats[aId].lastRunTime = ev.created_at;
              stats[aId].lastRunCost = cost;
            }
          }
          setAgentStats(stats);
          setGlobalStats({
            todayCost,
            monthCost,
            lastRunTime,
            lastRunCost,
            activeAgentsCount: agents.filter((a: any) => a.is_active).length
          });
        }
      } catch (err) {
        console.error("Error fetching agent analytical stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user, agents]);

  // Load initial usage limit caps
  useEffect(() => {
    const loadLimits = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('ai_usage_limits')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!error && data) {
          setBudgetSettings({
            daily_budget_usd: Number(data.daily_budget_usd),
            monthly_budget_usd: Number(data.monthly_budget_usd),
            per_agent_monthly_budget_usd: Number(data.per_agent_monthly_budget_usd),
            stop_on_limit: data.stop_on_limit,
            warn_threshold_percent: Number(data.warn_threshold_percent)
          });
        }
      } catch (err) {
        console.error("Error fetching usage limits:", err);
      }
    };
    loadLimits();
  }, [user]);

  // Save budget handler
  const handleSaveBudget = async () => {
    if (!user) return;
    setSaveBudgetLoading(true);
    try {
      const { error } = await supabase
        .from('ai_usage_limits')
        .upsert({
          user_id: user.id,
          daily_budget_usd: budgetSettings.daily_budget_usd,
          monthly_budget_usd: budgetSettings.monthly_budget_usd,
          per_agent_monthly_budget_usd: budgetSettings.per_agent_monthly_budget_usd,
          stop_on_limit: budgetSettings.stop_on_limit,
          warn_threshold_percent: budgetSettings.warn_threshold_percent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
      showToast.success('Global AI budgets and stop policies saved successfully!');
    } catch (err: any) {
      console.error("Error saving limits:", err);
      showToast.error(`Budget error: ${err.message}`);
    } finally {
      setSaveBudgetLoading(false);
    }
  };

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
    model_name: 'gemma4:12b',
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
          model_name: (['llama3:latest', 'llama3.2:3b', 'gemma3:4b', 'qwen2.5:7b', 'mistral:latest'].includes(aiSettingsData.model_name)) ? 'gemma4:12b' : (aiSettingsData.model_name || 'gemma4:12b'),
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
        model_name: aiSettings.model_name?.trim() || 'gemma4:12b',
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

      // Save global defaults to localStorage for newly created agents
      localStorage.setItem('default_new_agent_provider', defaultNewAgentProvider);
      localStorage.setItem('default_new_agent_model', aiSettings.model_name || 'gemini-2.5-flash-lite');
      localStorage.setItem('default_new_agent_temperature', String(aiSettings.temperature ?? 0.7));
      localStorage.setItem('default_new_agent_voice_provider', defaultNewAgentVoiceProvider);
      localStorage.setItem('default_new_agent_voice_name', defaultNewAgentVoiceName);
      localStorage.setItem('default_new_agent_call_mode', String(defaultNewAgentCallMode));

      // Save runtime & fallbacks to localStorage
      localStorage.setItem('ai_preferred_runtime', preferredRuntimeBehavior);
      localStorage.setItem('ai_fallback_mobile_tablet', String(cloudFallbackOnMobile));
      localStorage.setItem('ai_use_ollama_local_only', String(ollamaLocalOnly));

      // Save safety defaults to localStorage
      localStorage.setItem('default_safety_db_approval', String(defaultSafetyDbApproval));
      localStorage.setItem('default_safety_publish_approval', String(defaultSafetyPublishApproval));
      localStorage.setItem('default_safety_messaging_approval', String(defaultSafetyMessagingApproval));
      localStorage.setItem('default_safety_remember_prefs', String(defaultSafetyRememberPrefs));
      localStorage.setItem('default_safety_summarize_convos', String(defaultSafetySummarizeConvos));

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

  const loadRecentTransactions = async () => {
    if (!user) return;
    setLogsLoading(true);
    setShowLogsModal(true);
    try {
      const { data, error } = await supabase
        .from('ai_usage_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(25);
      
      if (!error && data) {
        setRecentTransactionLogs(data);
      } else if (error) {
        showToast.error("Failed to load logs: " + error.message);
      }
    } catch (err: any) {
      showToast.error("Logs error: " + err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('ai_context_cache');
      localStorage.removeItem('ai_synced_data');
      showToast.success("AI cache and local conversation weights cleared successfully!");
    } catch (err: any) {
      showToast.error("Failed to clear cache: " + err.message);
    }
  };

  const handleRecalculateUsage = async () => {
    if (!user) return;
    setRecalculatingLogs(true);
    try {
      const todayStr = new Date();
      todayStr.setHours(0, 0, 0, 0);
      const isoToday = todayStr.toISOString();

      const monthStr = new Date();
      monthStr.setDate(1);
      monthStr.setHours(0, 0, 0, 0);
      const isoMonth = monthStr.toISOString();

      const { data: events, error } = await supabase
        .from('ai_usage_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', isoMonth);

      if (!error && events) {
        let todayCost = 0;
        let monthCost = 0;
        let lastRunTime: string | null = null;
        let lastRunCost = 0;

        for (const ev of events) {
          const evDate = new Date(ev.created_at);
          const isToday = evDate >= todayStr;
          const cost = Number(ev.estimated_cost_usd || 0);

          monthCost += cost;
          if (isToday) {
            todayCost += cost;
          }

          if (!lastRunTime || ev.created_at > lastRunTime) {
            lastRunTime = ev.created_at;
            lastRunCost = cost;
          }
        }

        setGlobalStats({
          todayCost,
          monthCost,
          lastRunTime,
          lastRunCost,
          activeAgentsCount: agents.filter((a: any) => a.is_active).length
        });
        showToast.success(`Quota totals cross-audited. Spent compiled: $${monthCost.toFixed(4)} this month.`);
      }
    } catch (e: any) {
      showToast.error("Recalculation failed: " + e.message);
    } finally {
      setRecalculatingLogs(false);
    }
  };

  const handleInspectFailures = async () => {
    if (!user) return;
    try {
      setLogsLoading(true);
      setShowLogsModal(true);
      const { data, error } = await supabase
        .from('ai_usage_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setRecentTransactionLogs(data);
        showToast.success("Diagnostic tracing logs compiled.");
      } else if (error) {
        showToast.error("Failed to load trace: " + error.message);
      }
    } catch (e: any) {
      showToast.error("Trace failed: " + e.message);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-8 px-0">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Settings</h2>
        <p className="text-white/40 text-sm">Manage your profile, AI preferences, and application settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
        <div className="space-y-2">
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

        <div className="min-w-0 space-y-6">
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
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* SECTION 1: COMPACT AI OVERVIEW BANNER */}
              <div className="p-6 rounded-[2rem] bg-gradient-to-br from-slate-950/90 to-purple-950/40 border border-white/10 shadow-2xl backdrop-blur-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2.5">
                      <Cpu size={24} className="text-purple-400" /> Global AI Control Center
                    </h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">
                      System-wide quotas, fallback behavior, blueprints, and local endpoint routing
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase font-black px-2.5 py-1 rounded-full tracking-wider bg-white/5 border border-white/10 text-white/50">
                      System Status
                    </span>
                    <button 
                      onClick={() => setAiSettings({...aiSettings, enabled: !aiSettings.enabled})}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 shadow-md",
                        aiSettings.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      )}
                    >
                      {aiSettings.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* OVERVIEW COMPACT STATS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                  {/* Active Agents */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all min-w-0 overflow-hidden">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 font-sans truncate" title="Active Agents">
                      <UserCheck size={11} className="text-blue-400 shrink-0" /> <span className="truncate">Active Agents</span>
                    </span>
                    <div className="mt-2.5 min-w-0">
                      <span className="text-xl font-extrabold text-white block truncate" title={String(globalStats.activeAgentsCount)}>{globalStats.activeAgentsCount}</span>
                      <p className="text-[8px] font-semibold text-white/20 uppercase tracking-wide mt-0.5 font-sans truncate">Assigned Profiles</p>
                    </div>
                  </div>

                  {/* Today AI Cost */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all min-w-0 overflow-hidden font-sans">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 font-sans truncate" title="Today Cost">
                      <DollarSign size={11} className="text-emerald-400 shrink-0" /> <span className="truncate">Today Cost</span>
                    </span>
                    <div className="mt-2.5 min-w-0">
                      <span className="text-xl font-extrabold text-white block truncate" title={`$${globalStats.todayCost.toFixed(4)}`}>${globalStats.todayCost.toFixed(4)}</span>
                      <p className="text-[8px] font-semibold text-white/20 uppercase tracking-wide mt-0.5 font-sans truncate">Estimated Spend</p>
                    </div>
                  </div>

                  {/* Month AI Cost */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all min-w-0 overflow-hidden font-sans">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 font-sans truncate" title="Month Cost">
                      <CreditCard size={11} className="text-purple-400 shrink-0" /> <span className="truncate">Month Cost</span>
                    </span>
                    <div className="mt-2.5 min-w-0">
                      <span className="text-xl font-extrabold text-white block truncate" title={`$${globalStats.monthCost.toFixed(3)}`}>${globalStats.monthCost.toFixed(3)}</span>
                      <p className="text-[8px] font-semibold text-white/20 uppercase tracking-wide mt-0.5 font-sans truncate">Accumulated Cost</p>
                    </div>
                  </div>

                  {/* Last Run Cost */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/11 transition-all min-w-0 overflow-hidden font-sans">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 font-sans truncate" title="Last Run">
                      <Clock size={11} className="text-amber-400 shrink-0" /> <span className="truncate">Last Run</span>
                    </span>
                    <div className="mt-2.5 min-w-0">
                      <span className="text-xs font-bold text-white block truncate" title={globalStats.lastRunTime ? new Date(globalStats.lastRunTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}>
                        {globalStats.lastRunTime ? new Date(globalStats.lastRunTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}
                      </span>
                      <span className="text-[8px] font-semibold text-white/35 uppercase tracking-wide font-sans block truncate" title={globalStats.lastRunCost > 0 ? `$${globalStats.lastRunCost.toFixed(5)}` : 'No payload'}>
                        {globalStats.lastRunCost > 0 ? `$${globalStats.lastRunCost.toFixed(5)}` : 'No payload'}
                      </span>
                    </div>
                  </div>

                  {/* Local Ollama Status */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all min-w-0 overflow-hidden font-sans">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 font-sans truncate" title="Local Ollama">
                      <Server size={11} className="text-sky-400 shrink-0" /> <span className="truncate">Local Ollama</span>
                    </span>
                    <div className="mt-2.5 flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        ollamaStatus === 'active' ? "bg-emerald-500 animate-pulse" :
                        ollamaStatus === 'checking' ? "bg-amber-500 animate-spin border border-dashed border-white" : "bg-white/20"
                      )} />
                      <span className="text-xs font-bold uppercase tracking-wider text-white truncate" title={ollamaStatus === 'active' ? 'Active' : ollamaStatus === 'checking' ? 'Testing' : 'Offline'}>
                        {ollamaStatus === 'active' ? 'Active' : ollamaStatus === 'checking' ? 'Testing' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Cloud AI Status */}
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all min-w-0 overflow-hidden font-sans">
                    <span className="text-[9px] font-black uppercase text-white/35 tracking-widest flex items-center gap-1.5 truncate" title="Cloud AI Engine">
                      <Cloud size={11} className="text-rose-400 shrink-0" /> <span className="truncate">Cloud AI Engine</span>
                    </span>
                    <div className="mt-2.5 flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white truncate text-ellipsis">Operational</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TWO COLUMN GRID LAYOUT */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* SECTION 2: GLOBAL DEFAULTS FOR NEW AGENTS */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 flex flex-col justify-between shadow-xl font-sans">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Bot size={18} className="text-blue-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">New Agent Blueprints</h4>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-0.5">Used only for newly created agents.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Cloud Provider Default */}
                      <div className="space-y-1 min-w-0">
                        <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] px-1 truncate" title="Blueprint Provider">Blueprint Provider</label>
                        <select 
                          className="w-full min-w-0 bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-bold truncate"
                          value={defaultNewAgentProvider}
                          onChange={(e) => {
                            const p = e.target.value;
                            setDefaultNewAgentProvider(p);
                            if (p === 'gemini') {
                              setAiSettings(prev => ({...prev, model_name: 'gemini-2.5-flash-lite'}));
                            } else if (p === 'openai') {
                              setAiSettings(prev => ({...prev, model_name: 'gpt-4o-mini'}));
                            } else if (p === 'claude') {
                              setAiSettings(prev => ({...prev, model_name: 'claude-3-5-sonnet'}));
                            } else if (p === 'ollama') {
                              setAiSettings(prev => ({...prev, model_name: 'gemma4:12b'}));
                            }
                          }}
                        >
                          <option value="gemini">Gemini Online</option>
                          <option value="openai">OpenAI Online</option>
                          <option value="claude">Claude Anthropic</option>
                          <option value="ollama">Ollama Local</option>
                        </select>
                      </div>
 
                      {/* Default Model */}
                      <div className="space-y-1 min-w-0">
                        <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] px-1 truncate" title="Blueprint Model">Blueprint Model</label>
                        <select 
                          className="w-full min-w-0 bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-bold text-sans truncate"
                          value={aiSettings.model_name}
                          onChange={(e) => setAiSettings({...aiSettings, model_name: e.target.value})}
                        >
                          {defaultNewAgentProvider === 'gemini' && (
                            <>
                              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            </>
                          )}
                          {defaultNewAgentProvider === 'openai' && (
                            <>
                              <option value="gpt-4o-mini">gpt-4o-mini</option>
                              <option value="gpt-4o">gpt-4o</option>
                            </>
                          )}
                          {defaultNewAgentProvider === 'claude' && (
                            <>
                              <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                              <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                            </>
                          )}
                          {defaultNewAgentProvider === 'ollama' && (
                            <>
                              <option value="gemma4:12b">Gemma 4 12B</option>
                              <option value="qwen3:8b">Qwen 3 8B</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-4">
                      {/* Default Temperature */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-black/25 border border-white/5 font-sans min-w-0 overflow-hidden">
                        <div className="flex justify-between items-center px-1 font-sans gap-2 min-w-0">
                          <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] font-sans truncate" title="Blueprint Temp">Blueprint Temp</label>
                          <span className="text-[10px] font-black text-blue-400 font-sans shrink-0">{aiSettings.temperature}</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.1"
                          className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          value={aiSettings.temperature}
                          onChange={(e) => setAiSettings({...aiSettings, temperature: parseFloat(e.target.value)})}
                        />
                      </div>
 
                      {/* Default Call Mode */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5 min-w-0 gap-2">
                        <div className="min-w-0">
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 font-sans truncate" title="Call Mode">Call Mode</label>
                          <p className="text-[8px] text-white/20 font-bold uppercase font-sans truncate" title="Spoken Call Defaults">Spoken Call Defaults</p>
                        </div>
                        <button 
                          onClick={() => setDefaultNewAgentCallMode(!defaultNewAgentCallMode)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            defaultNewAgentCallMode ? "bg-blue-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultNewAgentCallMode ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-4">
                      {/* Default Voice Provider */}
                      <div className="space-y-1 min-w-0">
                        <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] px-1 truncate" title="Voice Provider Default">Voice Provider Default</label>
                        <select 
                          className="w-full min-w-0 bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-bold truncate"
                          value={defaultNewAgentVoiceProvider}
                          onChange={(e) => {
                            const vp = e.target.value;
                            setDefaultNewAgentVoiceProvider(vp);
                            if (vp === 'google') setDefaultNewAgentVoiceName('en-US-Chirp3-HD-Aoede');
                            if (vp === 'elevenlabs') setDefaultNewAgentVoiceName('21m00Tcm4TlvDq8iKC9e');
                            if (vp === 'browser') setDefaultNewAgentVoiceName('default');
                            if (vp === 'piper') setDefaultNewAgentVoiceName('en_US-amy-medium');
                          }}
                        >
                          <option value="browser">Browser Speech</option>
                          <option value="elevenlabs">ElevenLabs Cloud</option>
                          <option value="google">Google Cloud TTS</option>
                          <option value="piper">Piper Local TTS</option>
                        </select>
                      </div>
 
                      {/* Default Voice Name */}
                      <div className="space-y-1 min-w-0">
                        <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] px-1 truncate" title="Default Profile Voice">Default Profile Voice</label>
                        <select 
                          className="w-full min-w-0 bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-sans truncate"
                          value={defaultNewAgentVoiceName}
                          onChange={(e) => setDefaultNewAgentVoiceName(e.target.value)}
                        >
                          {FALLBACK_VOICES.filter(v => v.voice_provider === defaultNewAgentVoiceProvider).map(v => (
                            <option key={v.id} value={v.voice_name}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between items-center text-[9px] font-bold text-white/20 uppercase tracking-widest font-sans gap-2 min-w-0">
                    <span className="truncate">Template Blueprint Engine</span>
                    <span className="text-white/30 truncate">Auto applied during generation</span>
                  </div>
                </div>

                {/* SECTION 3: RUNTIME & FALLBACK */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 flex flex-col justify-between shadow-xl font-sans">
                  <div className="space-y-4 font-sans">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Zap size={18} className="text-amber-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">Runtime & Fallback Policies</h4>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-0.5">Control execution logic and mobile failovers</p>
                      </div>
                    </div>

                    {/* Preferred Runtime */}
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black text-white/30 uppercase tracking-[0.2em] px-1 font-sans truncate" title="Orchestration Priority">Orchestration Priority</label>
                      <select 
                        className="w-full min-w-0 bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-bold truncate"
                        value={preferredRuntimeBehavior}
                        onChange={(e) => setPreferredRuntimeBehavior(e.target.value)}
                      >
                        <option value="cloud_first font-sans">Prefer Cloud (Highest Intelligence & Availability)</option>
                        <option value="local_only font-sans">Force Local Ollama Run Only (Strict Isolation)</option>
                        <option value="hybrid_routing font-sans">Hybrid Routing (Use Ollama; Fall back to cloud on timeouts)</option>
                      </select>
                    </div>
 
                    <div className="grid grid-cols-2 gap-4 col-span-2">
                      {/* Cloud Fallback on Mobile Switch */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5 min-w-0 gap-2">
                        <div className="min-w-0 pr-1">
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 font-sans truncate" title="Mobile Fallback">Mobile Fallback</label>
                          <p className="text-[8px] text-white/20 font-bold uppercase leading-snug font-sans truncate" title="Redirect to Cloud on Mobile">Redirect to Cloud on Mobile</p>
                        </div>
                        <button 
                          onClick={() => setCloudFallbackOnMobile(!cloudFallbackOnMobile)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            cloudFallbackOnMobile ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            cloudFallbackOnMobile ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
 
                      {/* Ollama Local Only Switch */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5 min-w-0 gap-2">
                        <div className="min-w-0 pr-1">
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 font-sans truncate" title="Check Availability">Check Availability</label>
                          <p className="text-[8px] text-white/20 font-bold uppercase leading-snug font-sans truncate" title="Only run Ollama if locally up">Only run Ollama if locally up</p>
                        </div>
                        <button 
                          onClick={() => setOllamaLocalOnly(!ollamaLocalOnly)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            ollamaLocalOnly ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            ollamaLocalOnly ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
 
                    {/* Advanced Local Runtime subcard */}
                    <div className="p-3 rounded-xl bg-black/35 border border-white/5 space-y-2 font-sans min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center font-sans gap-2 min-w-0">
                        <span className="text-[8px] font-black uppercase text-white/40 tracking-wider truncate">Advanced Local Runtime Config</span>
                        <span className="text-[8px] font-semibold text-amber-500 uppercase tracking-wider shrink-0">Ollama Core</span>
                      </div>
                      <div className="flex gap-2 min-w-0">
                        <input 
                          type="text"
                          className="flex-1 min-w-0 bg-black/45 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                          placeholder="Http API endpoint url"
                          value={aiSettings.ollama_endpoint}
                          onChange={(e) => setAiSettings({...aiSettings, ollama_endpoint: e.target.value})}
                        />
                        <button 
                          onClick={testConnection}
                          className="px-3.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 text-white/50 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans shrink-0 truncate"
                          title="Trigger Health Verification"
                        >
                          <Terminal size={12} className="shrink-0" /> Test
                        </button>
                      </div>
                      {testResult && (
                        <p className={cn(
                          "text-[8px] font-bold uppercase tracking-widest px-1 font-sans truncate",
                          testResult.includes('Connected') ? "text-emerald-400" : "text-amber-400"
                        )} title={testResult}>
                          {testResult}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/5 text-[9px] font-bold text-white/20 uppercase tracking-widest flex justify-between font-sans gap-2 min-w-0">
                    <span className="truncate">Ollama Local Host Integration</span>
                    <span className="text-white/30 truncate">OLLAMA_ORIGINS ALLOWED</span>
                  </div>
                </div>
 
                {/* SECTION 4: COST & BUDGET CONTROL */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 flex flex-col justify-between shadow-xl min-w-0 overflow-hidden">
                  <div className="space-y-4 font-sans min-w-0">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3 min-w-0">
                      <Database size={18} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-white truncate" title="Quota & Budget Limits">Quota & Budget Limits</h4>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-0.5 truncate" title="Deter catastrophic fee spikes using hard restrictions">Deter catastrophic fee spikes using hard restrictions</p>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-3 gap-2 font-sans">
                      {/* Daily budget cap input */}
                      <div className="space-y-1 p-2 rounded-xl bg-black/25 border border-white/5 min-w-0">
                        <label className="block text-[8px] font-black text-white/35 uppercase tracking-wider truncate" title="Daily Cap">Daily Cap</label>
                        <div className="relative font-mono flex items-center min-w-0">
                          <span className="absolute left-1.5 text-[10px] text-white/30">$</span>
                          <input 
                            type="number"
                            step="0.5"
                            className="w-full bg-transparent pl-4 text-xs font-black text-white focus:outline-none font-sans min-w-0"
                            value={budgetSettings.daily_budget_usd}
                            onChange={(e) => setBudgetSettings({...budgetSettings, daily_budget_usd: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      </div>
 
                      {/* Monthly budget cap input */}
                      <div className="space-y-1 p-2 rounded-xl bg-black/25 border border-white/5 font-sans min-w-0">
                        <label className="block text-[8px] font-black text-white/35 uppercase tracking-wider truncate" title="Monthly Cap">Monthly Cap</label>
                        <div className="relative flex items-center min-w-0 font-sans">
                          <span className="absolute left-1.5 text-[10px] text-white/30">$</span>
                          <input 
                            type="number"
                            step="5"
                            className="w-full bg-transparent pl-4 text-xs font-black text-white focus:outline-none min-w-0"
                            value={budgetSettings.monthly_budget_usd}
                            onChange={(e) => setBudgetSettings({...budgetSettings, monthly_budget_usd: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      </div>
 
                      {/* Per-agent monthly budget cap input */}
                      <div className="space-y-1 p-2 rounded-xl bg-black/25 border border-white/5 min-w-0">
                        <label className="block text-[8px] font-black text-white/35 uppercase tracking-wider truncate" title="Per-Agent Cap">Per-Agent Cap</label>
                        <div className="relative flex items-center min-w-0">
                          <span className="absolute left-1.5 text-[10px] text-white/30">$</span>
                          <input 
                            type="number"
                            step="1"
                            className="w-full bg-transparent pl-4 text-xs font-black text-white focus:outline-none min-w-0"
                            value={budgetSettings.per_agent_monthly_budget_usd}
                            onChange={(e) => setBudgetSettings({...budgetSettings, per_agent_monthly_budget_usd: parseFloat(e.target.value) || 0})}
                          />
                        </div>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-4">
                      {/* Stop limits toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5 min-w-0 gap-2">
                        <div className="min-w-0">
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 font-sans truncate" title="Stop on Limit">Stop on Limit</label>
                          <p className="text-[8px] text-red-400 font-bold uppercase leading-snug truncate" title="Hard cut LLM/TTS actions">Hard cut LLM/TTS actions</p>
                        </div>
                        <button 
                          onClick={() => setBudgetSettings({...budgetSettings, stop_on_limit: !budgetSettings.stop_on_limit})}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            budgetSettings.stop_on_limit ? "bg-red-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            budgetSettings.stop_on_limit ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
 
                      {/* Warning percentage slider */}
                      <div className="space-y-1 p-2 rounded-xl bg-black/25 border border-white/5 font-sans min-w-0 overflow-hidden">
                        <div className="flex justify-between items-center font-sans gap-2 min-w-0">
                          <label className="block text-[8px] font-black text-white/45 uppercase tracking-widest font-sans truncate" title="Warning threshold">Warning threshold</label>
                          <span className="text-[10px] font-black text-emerald-400 font-sans shrink-0">{budgetSettings.warn_threshold_percent}%</span>
                        </div>
                        <input 
                          type="range"
                          min="50"
                          max="95"
                          step="5"
                          className="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          value={budgetSettings.warn_threshold_percent}
                          onChange={(e) => setBudgetSettings({...budgetSettings, warn_threshold_percent: parseInt(e.target.value) || 80})}
                        />
                      </div>
                    </div>
 
                    {/* Spend indicator progress bar */}
                    <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-3 font-sans min-w-0 overflow-hidden">
                      <div className="min-w-0">
                        <div className="flex justify-between items-center text-[9px] font-black text-white/45 uppercase mb-1 gap-2 min-w-0">
                          <span className="truncate">Month Spend Progress</span>
                          <span className="shrink-0 font-mono">${globalStats.monthCost.toFixed(2)} / ${budgetSettings.monthly_budget_usd}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              (globalStats.monthCost / (budgetSettings.monthly_budget_usd || 1)) >= (budgetSettings.warn_threshold_percent/100) ? "bg-amber-500" : "bg-emerald-500"
                            )} 
                            style={{width: `${Math.min(100, (globalStats.monthCost / (budgetSettings.monthly_budget_usd || 1)) * 100)}%`}}
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={loadRecentTransactions}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 rounded-lg text-white font-extrabold text-[9px] uppercase tracking-wider transition-all text-center flex items-center justify-center gap-2"
                      >
                        <FileText size={12} /> Audit Direct AI Transaction Logs
                      </button>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex justify-between items-center font-sans">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Pricing Guard Policies</span>
                    <button 
                      onClick={handleSaveBudget} 
                      disabled={saveBudgetLoading} 
                      className="text-[9px] font-black uppercase text-emerald-400 hover:text-emerald-300 tracking-widest pl-2 disabled:opacity-40"
                    >
                      {saveBudgetLoading ? 'Saving...' : 'Apply budget limits'}
                    </button>
                  </div>
                </div>

                {/* SECTION 5: VOICE & CALL DEFAULTS */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 flex flex-col justify-between shadow-xl">
                  <div className="space-y-4 font-sans">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Volume2 size={18} className="text-purple-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white font-sans">Audio & Speech Defaults</h4>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-0.5">Control auditory feedbacks, voices, and synthesized speech options</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 col-span-2">
                      {/* Enable voice by default */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5">
                        <div>
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5 font-sans">Voice Feedback</label>
                          <p className="text-[8px] text-white/20 font-bold uppercase font-sans">Synthesize responses aloud</p>
                        </div>
                        <button 
                          onClick={() => setVoiceEnabled(!voiceEnabled)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300",
                            voiceEnabled ? "bg-purple-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            voiceEnabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>

                      {/* Enable call mode by default */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/5">
                        <div>
                          <label className="block text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Call Mode Default</label>
                          <p className="text-[8px] text-white/20 font-bold uppercase font-sans">Optimized spoken outputs</p>
                        </div>
                        <button 
                          onClick={() => setCallModeEnabled(!callModeEnabled)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300",
                            callModeEnabled ? "bg-purple-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            callModeEnabled ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* Default TTS Voice selection dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-black/25 border border-white/5 text-sans font-sans">
                      <div className="space-y-1">
                        <label className="block text-[8px] font-black text-white/30 uppercase tracking-widest">Global TTS System Option</label>
                        <select 
                          className="w-full bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-all font-bold text-center text-sans font-sans"
                          value={voiceProvider}
                          onChange={(e) => setVoiceProvider(e.target.value as any)}
                        >
                          <option value="browser">Browser Native Synth</option>
                          <option value="elevenlabs">ElevenLabs Cloud</option>
                          <option value="google">Google Cloud TTS</option>
                          <option value="piper">Piper Local TTS</option>
                        </select>
                      </div>
                      <div className="flex items-end font-sans">
                        <button
                          disabled={testingVoice || !voiceEnabled}
                          onClick={handleTestVoice}
                          className="w-full h-8.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                          title={voiceEnabled ? "Test active voice synthesize" : "Activate voice system first"}
                        >
                          <Volume2 size={12} />
                          {testingVoice ? 'Speaking...' : 'Test Speech'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 text-[8px] uppercase tracking-widest font-black leading-snug text-purple-300 flex items-start gap-2">
                      <Info size={14} className="shrink-0 text-purple-400 mt-0.5" />
                      <span>Warning: Voice feedbacks utilize intensive third-party resources. ElevenLabs and Google Cloud TTS charges apply to public endpoints.</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/5 text-[9px] font-bold text-white/20 uppercase tracking-widest flex justify-between">
                    <span>Default TTS Speech parameters</span>
                    <span>No active overriding</span>
                  </div>
                </div>

                {/* SECTION 6: PRIVACY & SAFETY DEFAULTS */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-xl lg:col-span-2">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <ShieldCheck size={20} className="text-amber-500" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">Trust, Safety & Privacy Rules</h4>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mt-0.5">Control context permissions, database alterations confirmation limits, and social posting gateways</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 font-sans">
                    {/* Pass sensitive context switch */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider">Pass Sensitive Context</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold">Transmit calendar details, private annotations, and contact details to prompts</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase">No Secret Keys Redacted</span>
                        <button 
                          onClick={() => setAiSettings({...aiSettings, allow_sensitive_context: !aiSettings.allow_sensitive_context})}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            aiSettings.allow_sensitive_context ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            aiSettings.allow_sensitive_context ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* DB alterations confirmation */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider font-sans">DB Alterations Approval</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold font-sans">Require explicit confirmation before creating, updating or deleting records</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase font-sans">Strict Permissions</span>
                        <button 
                          onClick={() => setDefaultSafetyDbApproval(!defaultSafetyDbApproval)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            defaultSafetyDbApproval ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultSafetyDbApproval ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* Social/Publishing approval */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all text-sans">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider">Communication Gateway</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold">Require human checks before broadcasting social media status updates or posts</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase">Social Posting</span>
                        <button 
                          onClick={() => setDefaultSafetyPublishApproval(!defaultSafetyPublishApproval)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            defaultSafetyPublishApproval ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultSafetyPublishApproval ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* Messaging approval */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all font-sans">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider">SMS & Mail gateway</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold">Require human approval before sending outgoing messages, emails and SMS dispatches</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2 font-sans">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase">Dispatches</span>
                        <button 
                          onClick={() => setDefaultSafetyMessagingApproval(!defaultSafetyMessagingApproval)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            defaultSafetyMessagingApproval ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultSafetyMessagingApproval ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* Allow recollection of preferences */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all text-sans animate-none">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider">Cognitive Preferences Memory</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold">Allow agents to record and retrieve custom likes and persistent user insights</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase">Long-term Memory</span>
                        <button 
                          onClick={() => setDefaultSafetyRememberPrefs(!defaultSafetyRememberPrefs)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0 font-sans",
                            defaultSafetyRememberPrefs ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultSafetyRememberPrefs ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    {/* Allow automatic session compression / summarization */}
                    <div className="p-4 rounded-xl bg-black/25 border border-white/5 flex flex-col justify-between space-y-3 hover:border-white/10 transition-all font-sans">
                      <div className="space-y-1 font-sans">
                        <label className="block text-[9px] font-black text-white uppercase tracking-wider">History Summarization</label>
                        <p className="text-[8px] text-white/30 uppercase leading-normal font-bold font-sans">Permit automatic conversation history compression and token-saving pruning</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] font-bold text-amber-500/80 uppercase">Cognitive Compression</span>
                        <button 
                          onClick={() => setDefaultSafetySummarizeConvos(!defaultSafetySummarizeConvos)}
                          className={cn(
                            "w-10 h-5.5 rounded-full relative transition-all duration-300 shrink-0",
                            defaultSafetySummarizeConvos ? "bg-amber-500" : "bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.75 w-4 h-4 rounded-full bg-white transition-all duration-300",
                            defaultSafetySummarizeConvos ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 7: DIAGNOSTIC MAINTENANCE PANEL */}
                <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 shadow-xl lg:col-span-2">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3 font-sans">
                    <Activity size={20} className="text-purple-400" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-white font-sans">Maintenance & Diagnostics System</h4>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mt-0.5">Diagnose core communication databases, repair caches, and recalculate limits counters</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
                    {/* Refresh health check state */}
                    <button 
                      onClick={async () => {
                        setOllamaStatus('checking');
                        try {
                          const models = await testOllamaConnection(aiSettings.ollama_endpoint || 'http://localhost:11434/api/generate');
                          if (models && models.length > 0) {
                            setOllamaStatus('active');
                            showToast.success(`Local host responsive. Standard models: ${models.join(', ')}`);
                          } else {
                            setOllamaStatus('inactive');
                            showToast.error("Connection failed. Local server has not responded yet.");
                          }
                        } catch (e: any) {
                          setOllamaStatus('inactive');
                          showToast.error("Tested server offline: " + e.message);
                        }
                      }}
                      className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-purple-500/30 text-left transition-all active:scale-95 hover:bg-white/[0.02] flex flex-col justify-between space-y-3 flex-1 font-sans"
                    >
                      <div className="p-2 w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                        <RefreshCw size={14} className={cn(ollamaStatus === 'checking' && "animate-spin")} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-white block">Refresh AI Health</span>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 leading-snug">Poll Ollama models and verify remote keys integrity</p>
                      </div>
                    </button>

                    {/* Clear Temporary Cache button */}
                    <button 
                      onClick={handleClearCache}
                      className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-purple-500/30 text-left transition-all active:scale-95 hover:bg-white/[0.02] flex flex-col justify-between space-y-3 flex-1 font-sans"
                    >
                      <div className="p-2 w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                        <Trash2 size={14} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-white block font-sans">Wipe Local Cache</span>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 leading-snug font-sans">Wipe client context caches and reload pristine models weights</p>
                      </div>
                    </button>

                    {/* Recount event events usage stats */}
                    <button 
                      onClick={handleRecalculateUsage}
                      disabled={recalculatingLogs}
                      className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-purple-500/30 text-left transition-all active:scale-95 hover:bg-white/[0.02] flex flex-col justify-between space-y-3 flex-1 disabled:opacity-40"
                    >
                      <div className="p-2 w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        {recalculatingLogs ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-white block font-sans">Recalculate Usage</span>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 leading-snug">Run absolute recount of monthly estimated ledger events</p>
                      </div>
                    </button>

                    {/* View recent errors and issues inspect failures */}
                    <button 
                      onClick={handleInspectFailures}
                      className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-purple-500/30 text-left transition-all active:scale-95 hover:bg-white/[0.02] flex flex-col justify-between space-y-3 flex-1"
                    >
                      <div className="p-2 w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-sans">
                        <ShieldAlert size={14} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase text-white block font-sans">Trace AI Errors</span>
                        <p className="text-[8px] text-white/30 uppercase mt-0.5 leading-snug">Compile recent tracing reports to address failed LLM connections</p>
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* TRANSACTIONS HISTORICAL LOGS DRAW OVERLAY INLINE MODAL */}
              {showLogsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-md bg-black/60 animate-in fade-in duration-300">
                  <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-3 font-sans">
                      <div>
                        <h4 className="font-extrabold text-sm uppercase text-white tracking-wider flex items-center gap-2">
                          <FileText size={16} className="text-purple-400" /> AI Transaction Ledger Trace
                        </h4>
                        <p className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">Most recent 25 calls logged by agent networks and speakers</p>
                      </div>
                      <button 
                        onClick={() => setShowLogsModal(false)}
                        className="px-3.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/40 border border-white/10 hover:border-white/20 rounded-full hover:text-white transition-all font-sans"
                      >
                        Dismiss
                      </button>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {logsLoading ? (
                        <div className="py-12 text-center text-xs text-white/30 flex items-center justify-center gap-2 font-sans">
                          <Loader2 size={16} className="animate-spin text-purple-400" />
                          <span>Polling ledger data...</span>
                        </div>
                      ) : recentTransactionLogs.length === 0 ? (
                        <div className="py-12 text-center text-xs text-white/30 font-sans">
                          No logged AI transaction records found in the ledger. Check server access.
                        </div>
                      ) : (
                        recentTransactionLogs.map((log) => {
                          const hasError = log.estimated_cost_usd === 0 && log.total_tokens === 0;
                          return (
                            <div key={log.id} className={cn(
                              "p-3 rounded-xl flex items-center justify-between text-xs transition-all border font-mono",
                              hasError ? "bg-red-500/5 hover:bg-red-500/10 border-red-500/10" : "bg-black/30 hover:bg-black/40 border-white/5"
                            )}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[9px] font-bold uppercase px-1.5 py-0.25 rounded-md",
                                    log.operation_type === 'chat' ? "bg-purple-950 text-purple-400 border border-purple-500/10" : "bg-sky-950 text-sky-400 border border-sky-500/10"
                                  )}>
                                    {log.operation_type || 'Unknown'}
                                  </span>
                                  <span className="text-white/40 text-[9px] font-sans">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-[10px] font-sans text-white/70 font-sans">
                                  Agent ID: <span className="font-mono text-purple-300 text-[9px]">{log.agent_id ? String(log.agent_id).slice(0, 8) : 'Global / Direct'}</span> 
                                  {log.model_name && ` • Model: ${log.model_name}`}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={cn("font-bold text-xs font-mono", hasError ? "text-red-400" : "text-emerald-400")}>
                                  {hasError ? "FAILED" : `$${Number(log.estimated_cost_usd || 0).toFixed(4)}`}
                                </p>
                                <p className="text-[8px] text-white/30 uppercase mt-0.5 font-sans">
                                  {log.total_tokens ? `${log.total_tokens} tokens font-sans` : '0 tokens'}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                        placeholder="e.g. gemini-2.5-flash-lite, gpt-4.1-mini, or gemma4:12b"
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
                          "p-5 rounded-2xl border transition-all space-y-3 min-w-0 overflow-hidden",
                          isCurrentlyActive 
                            ? "bg-amber-500/10 border-amber-500/30" 
                            : "bg-black/20 border-white/5 hover:border-white/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-black text-white truncate max-w-[240px]" title={agent.name}>{agent.name}</span>
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase shrink-0">
                                {agent.role.replace('_', ' ')}
                              </span>
                              {agent.is_default && (
                                <span className="text-[8px] font-black text-black bg-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                  Default
                                </span>
                              )}
                              {isCurrentlyActive && (
                                <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                  Active Conversation
                                </span>
                              )}
                            </div>
                            <p className="text-white/60 text-xs mt-1 font-sans break-words">{agent.description || 'No description provided.'}</p>
                          </div>
 
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAgent({ ...agent });
                                setIsCreatingNew(false);
                                setTimeout(() => {
                                  agentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 100);
                              }}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all shrink-0"
                              title="Edit Agent"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all shrink-0"
                              title="Delete Agent"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
 
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/40 border-t border-white/5 pt-3 min-w-0">
                          <span className="font-bold truncate max-w-full" title={`${agent.model_provider} (${agent.model_name})`}>Model: {agent.model_provider} ({agent.model_name})</span>
                          <span className="text-white/10 shrink-0">•</span>
                          <span className="font-bold truncate max-w-full" title={agent.voice_provider || undefined}>Voice: {agent.voice_provider}</span>
                          <span className="text-white/10 shrink-0">•</span>
                          <span className="font-bold truncate max-w-full" title={agent.enabled_tools.join(', ')}>Tools: {agent.enabled_tools.slice(0, 3).join(', ')}{agent.enabled_tools.length > 3 ? '...' : ''}</span>
                        </div>
 
                        {/* Metric Granular Usage Grid */}
                        {(() => {
                          const s = agentStats[agent.id] || {
                            todayTokens: 0,
                            monthTokens: 0,
                            todayCost: 0,
                            monthCost: 0,
                            msgCount: 0,
                            totalChatCost: 0,
                            lastRunCost: 0
                          };
                          const avgMsgCost = s.msgCount > 0 ? (s.totalChatCost / s.msgCount) : 0;
 
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-white/5">
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={s.todayTokens.toLocaleString()}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Today Tokens</span>
                                <span className="text-xs font-black text-white mt-1 truncate">{s.todayTokens.toLocaleString()}</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={s.monthTokens.toLocaleString()}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Month Tokens</span>
                                <span className="text-xs font-black text-white mt-1 truncate">{s.monthTokens.toLocaleString()}</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={`$${s.todayCost.toFixed(5)}`}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Today Cost</span>
                                <span className="text-xs font-black text-amber-400 mt-1 truncate">${s.todayCost.toFixed(5)}</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={`$${s.monthCost.toFixed(4)}`}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Month Cost</span>
                                <span className="text-xs font-black text-amber-400 mt-1 truncate">${s.monthCost.toFixed(4)}</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={`$${avgMsgCost.toFixed(5)}`}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Avg Msg Cost</span>
                                <span className="text-xs font-black text-teal-400 mt-1 truncate">${avgMsgCost.toFixed(5)}</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col min-w-0 overflow-hidden" title={`$${s.lastRunCost.toFixed(5)}`}>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider truncate">Last Run Cost</span>
                                <span className="text-xs font-black text-indigo-400 mt-1 truncate">${s.lastRunCost.toFixed(5)}</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-2 pt-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAgentId(agent.id);
                              setVoiceEnabled(true);
                              setCallModeEnabled(true);
                              navigate(`/assistant?call=1&agent=${agent.id}`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                          >
                            <Phone size={12} />
                            Call
                          </button>
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
