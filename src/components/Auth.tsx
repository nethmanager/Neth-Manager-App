import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Zap, Mail, Lock, AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('neth_session_timeout_notice') === 'true') {
      setShowTimeoutNotice(true);
      sessionStorage.removeItem('neth_session_timeout_notice');
    }
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 bg-red-500/5 border border-red-500/10 p-10 rounded-[3rem] backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-3xl bg-red-600 flex items-center justify-center mb-6 shadow-xl shadow-red-500/20">
              <ShieldAlert className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase mb-2">Configuration Required</h1>
            <p className="text-white/60 text-sm leading-relaxed mb-8">
              Supabase environment variables are missing or invalid. Please configure 
              <code className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded mx-1">VITE_SUPABASE_URL</code> 
              and 
              <code className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded mx-1">VITE_SUPABASE_ANON_KEY</code> 
              in your environment settings.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // Manual profile creation if signup was successful
        if (data?.user) {
          await supabase.from('profiles').upsert({
             id: data.user.id,
             email: data.user.email,
             updated_at: new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-8 bg-white/5 border border-white/10 p-10 rounded-[3rem] backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
            <Zap className="text-white fill-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight uppercase mb-2">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-white/40 text-sm leading-relaxed mb-8 px-4">
            {mode === 'login' 
              ? 'Sign in to manage your businesses, projects, tasks, and platforms.' 
              : 'Create your account to start managing your work.'}
          </p>
        </div>

        {showTimeoutNotice && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase flex items-center gap-3">
            <AlertCircle size={16} />
            Session expired. Please sign in again.
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase flex items-center gap-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1 text-white/20 group-focus-within:text-blue-400 transition-colors">
              <Mail size={18} />
            </div>
            <input 
              type="email" 
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/20"
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1 text-white/20 group-focus-within:text-blue-400 transition-colors">
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-white/20"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-white/5 flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <Zap size={14} className="fill-current opacity-0 group-hover:opacity-100 transition-all" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4">
          <button 
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-[10px] font-bold text-white/30 hover:text-white transition-colors uppercase tracking-[0.2em]"
          >
            {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
          </button>
        </div>
      </div>
      <p className="mt-8 text-[9px] font-bold text-white/10 uppercase tracking-[0.4em]">Neth Manager v1.0.4</p>
    </div>
  );
}
