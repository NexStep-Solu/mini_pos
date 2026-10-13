import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Package, Users, BarChart3 } from 'lucide-react';
import { DEMO_USERS, useStore } from '../../store/AppStore';
import { ROLE_LABEL } from '../../lib/permissions';
import { isSupabaseConfigured } from '../../lib/supabase';
import { Badge, Button, Input, Field } from '../../components/ui';
import { toast } from 'sonner';

const HIGHLIGHTS = [
  { icon: Zap, text: 'Fast POS with barcode search' },
  { icon: Package, text: 'Inventory with movement history' },
  { icon: Users, text: 'CRM with loyalty & credit' },
  { icon: BarChart3, text: 'Daily / monthly reports' },
];

const DEMO_CREDS: { email: string; role: string }[] = [
  { email: 'owner@demo.mm', role: 'Owner' },
  { email: 'manager@demo.mm', role: 'Manager' },
  { email: 'cashier@demo.mm', role: 'Cashier' },
  { email: 'inventory@demo.mm', role: 'Inventory Staff' },
  { email: 'viewer@demo.mm', role: 'Viewer' },
];

export function LoginPage() {
  const { login, supaLogin, user, authReady, authPending, mode } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState('owner@demo.mm');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const remote = isSupabaseConfigured;

  const go = (role?: string) => nav(role === 'cashier' ? '/pos' : '/dashboard');

  // already signed in (e.g. session restored) → leave login
  useEffect(() => {
    if (user) go(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (mode === 'remote' && (!authReady || authPending)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-50 text-xl font-bold text-zinc-950">S</span>
        <p className="text-[13px] font-medium text-zinc-400">Restoring session…</p>
      </div>
    );
  }

  const submitLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email)) {
      toast.success('Welcome back!');
      go(DEMO_USERS.find((u) => u.email === email.toLowerCase())?.role);
    } else {
      toast.error('Unknown demo email. Pick one below.');
    }
  };

  const submitRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const err = await supaLogin(email, password);
      if (err) {
        toast.error(err, { duration: 6000 });
      } else {
        toast.success('Signed in — loading your store…');
        // role is resolved async via membership; land on dashboard, router guards the rest
        nav('/dashboard');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-zinc-800 bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)] md:grid md:grid-cols-2 dark:bg-zinc-950">
        <div className="border-b border-zinc-800 bg-zinc-950 p-6 text-white md:border-r md:border-b-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-lg font-bold text-zinc-950">S</div>
          <h1 className="mt-3 text-xl font-bold tracking-tight">Shwe Mini Mart</h1>
          <p className="mt-0.5 text-[13px] text-zinc-400">
            POS + Inventory + CRM{remote ? ' · live cloud' : ' demo'}
          </p>
          <ul className="mt-5 space-y-2 text-[13px] text-zinc-200">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-2.5">
                <h.icon size={16} aria-hidden className="shrink-0 text-zinc-400" />
                {h.text}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-400">
            {remote
              ? 'Connected to Supabase. Sign in with a store account created in Authentication → Users and linked via demo-users.sql.'
              : 'Demo password-free login. Pick a role account to explore permissions: cashiers see POS only, inventory staff see stock, viewers see reports.'}
          </p>
        </div>
        <div className="p-6">
          {remote ? (
            <>
              <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50">Store sign in</h2>
              <p className="text-[13px] text-zinc-500">Use your Supabase Auth account.</p>
              <form onSubmit={submitRemote} className="mt-3 space-y-2.5">
                <Field label="Email">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@demo.mm" autoComplete="email" />
                </Field>
                <Field label="Password">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </Field>
                <Button className="w-full" type="submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in →'}
                </Button>
              </form>
              <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">First time setup</p>
                <p>1. Run <span className="font-mono">supabase/seed.sql</span> + <span className="font-mono">migration-002.sql</span></p>
                <p>2. Create users in Authentication → Users</p>
                <p>3. Link them with <span className="font-mono">demo-users.sql</span></p>
                <p className="mt-1">Suggested accounts: {DEMO_CREDS.map((d) => d.email).join(', ')}</p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-50">Demo login</h2>
              <p className="text-[13px] text-zinc-500">No password needed for the demo.</p>
              <form onSubmit={submitLocal} className="mt-3 space-y-2.5">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@demo.mm" />
                <Button className="w-full" type="submit">Sign in →</Button>
              </form>
              <div className="mt-4 space-y-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { if (login(u.email)) go(u.role); }}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-zinc-500 hover:bg-zinc-100"
                  >
                    <span><span className="font-medium">{u.name}</span> <span className="text-zinc-400">· {u.email}</span></span>
                    <Badge tone="slate">{ROLE_LABEL[u.role]}</Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
