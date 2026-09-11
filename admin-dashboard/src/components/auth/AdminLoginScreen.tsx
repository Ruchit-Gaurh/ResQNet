import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Loader2, Server, ShieldCheck } from 'lucide-react';

import { apiService } from '../../services/api';

interface AdminLoginScreenProps {
  onAuthenticated: () => void;
  onUseDemo: () => void;
}

export function AdminLoginScreen({ onAuthenticated, onUseDemo }: AdminLoginScreenProps) {
  const [accessKey, setAccessKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkBackend = async () => {
      const health = await apiService.checkBackendHealth();
      if (mounted) setBackendOnline(health.online);
    };
    void checkBackend();
    const timer = window.setInterval(() => void checkBackend(), 5_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await apiService.authenticateAdmin(accessKey);
      onAuthenticated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">ResQNet Command Center</h1>
            <p className="text-sm text-slate-400">Authorized responders only</p>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs">
          <Server size={15} className={backendOnline ? 'text-emerald-400' : 'text-amber-400'} />
          <span className="text-slate-400">Backend</span>
          <span className="ml-auto font-mono text-slate-200">
            {backendOnline === null ? 'Checking…' : backendOnline ? 'Backend connected' : 'Unavailable'}
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Responder access key</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 focus-within:border-blue-500">
              <KeyRound size={17} className="text-slate-500" />
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                autoComplete="current-password"
                className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-600"
                placeholder="Enter the key configured on Render"
                required
                minLength={16}
              />
            </div>
          </label>

          {error && (
            <p role="alert" className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || accessKey.length < 16}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 size={17} className="animate-spin" />}
            Connect to live command data
          </button>
        </form>

        <button
          type="button"
          onClick={onUseDemo}
          className="mt-4 w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
        >
          Use local demonstration data instead
        </button>

        <p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-500">
          The access key is exchanged for an eight-hour responder session. Backend signing secrets are never stored in this dashboard.
        </p>
      </section>
    </main>
  );
}
