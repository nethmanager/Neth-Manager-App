import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Session } from '@supabase/supabase-js';

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const SESSION_STARTED_KEY = 'neth_manager_session_started_at';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId: any = null;

    const triggerTimeoutLogout = async () => {
      sessionStorage.setItem('neth_session_timeout_notice', 'true');
      localStorage.removeItem(SESSION_STARTED_KEY);
      setUser(null);
      setSession(null);
      await supabase.auth.signOut();
    };

    const checkAndScheduleTimeout = async (currentSession: Session | null) => {
      if (!currentSession) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        localStorage.removeItem(SESSION_STARTED_KEY);
        return;
      }

      let startedAtStr = localStorage.getItem(SESSION_STARTED_KEY);
      
      // If there's an active session but no timestamp exists locally, initialize one
      if (!startedAtStr) {
        startedAtStr = Date.now().toString();
        localStorage.setItem(SESSION_STARTED_KEY, startedAtStr);
      }

      const startedAt = parseInt(startedAtStr, 10);
      if (isNaN(startedAt)) {
        // Fallback
        localStorage.setItem(SESSION_STARTED_KEY, Date.now().toString());
        return;
      }

      const elapsed = Date.now() - startedAt;
      const remaining = SESSION_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        await triggerTimeoutLogout();
      } else {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(async () => {
          await triggerTimeoutLogout();
        }, remaining);
      }
    };

    // Initial fetch of session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      checkAndScheduleTimeout(initialSession);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, activeSession) => {
      if (event === 'SIGNED_IN' && activeSession) {
        // When a real SIGNED_IN event happens, store Date.now() in localStorage
        localStorage.setItem(SESSION_STARTED_KEY, Date.now().toString());
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(SESSION_STARTED_KEY);
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      setLoading(false);
      
      checkAndScheduleTimeout(activeSession);
    });

    // Check timeout when browser tab becomes active again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
          checkAndScheduleTimeout(activeSession);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { user, session, loading };
}
