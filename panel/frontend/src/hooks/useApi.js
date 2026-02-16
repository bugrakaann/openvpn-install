import { useState, useEffect, useCallback, useRef } from "react";

async function api(url, options = {}) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...options.headers },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export function useApi(url, interval = 0) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    const fetchData = useCallback(async () => {
        try {
            const result = await api(url);
            if (mountedRef.current) {
                setData(result);
                setError(null);
            }
        } catch (e) {
            if (mountedRef.current) setError(e.message);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        mountedRef.current = true;
        fetchData();
        let timer;
        if (interval > 0) timer = setInterval(fetchData, interval);
        return () => {
            mountedRef.current = false;
            if (timer) clearInterval(timer);
        };
    }, [fetchData, interval]);

    return { data, loading, error, refetch: fetchData };
}

export { api };
