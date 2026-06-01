import { useState, useEffect, useCallback } from 'react';

export function useSupabaseQuery<T>(
  queryFn: () => any,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await queryFn();
      
      if (response.error) {
        throw response.error;
      }

      // If it's a count/head query, response.count might be what we want
      if (response.count !== undefined && response.data === null) {
        setData(response.count as unknown as T);
      } else {
        setData(response.data as T);
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
      console.error('Supabase Query Error:', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
