import { Fragment, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Plus, ScrollText, Settings as SettingsIcon, ShieldCheck, UserCog, XCircle } from 'lucide-react';
import { DEMO_USERS, useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime, todayISO } from '../../lib/formatters';
import { PERMISSION_GROUPS, ROLE_LABEL } from '../../lib/permissions';
import type { Branch } from '../../types';
import {
  fetchBranchesList, fetchRolesList, fetchStaff, friendly, linkMember,
  updateMember, updateRolePerms, type RoleRow, type StaffRow,
} from '../../store/remote';
import { Button, Card, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Modal, PageHeader, Field, Pager, usePagination, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Meter, Avatar } from '../../components/ui';
import { toast } from 'sonner';
import { ORG_ID, BRANCH_ID } from '../../lib/supabase';

export function ExpensesPage() {
  const { db, user, addExpense } = useStore();
  const [cat, setCat] = useState('Rent');
  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [method, setMethod] = useState('cash');
  const total = db.expenses.reduce((a, e) => a + e.amount, 0);
  const byCat = Object.entries(
    db.expenses.reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: (m[e.category] ?? 0) + e.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const topCat = byCat[0]?.[1] ?? 1;
  return (
    <div>
      <PageHeader title="Expenses" icon={<ClipboardList aria-hidden />} sub={`Total: ${fmtMoney(total)}`} />
      <div className="grid gap-2.5 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit p-4">
          <div className="grid gap-2.5">
            <Field label="Category"><Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Rent', 'Electricity', 'Transport', 'Packaging', 'Staff expense', 'Maintenance', 'Other'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select></Field>
            <Field label="Amount (MMK)"><Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
            <Field label="Payment"><Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['cash', 'mobile_wallet', 'bank_transfer', 'card'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select></Field>
            <Field label="Description"><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
            <Button onClick={() => {
              if (!amt) { toast.error('Enter amount'); return; }
              addExpense({ organization_id: ORG_ID, branch_id: BRANCH_ID, category: cat, amount: Number(amt), payment_method: method as never, description: desc, expense_date: todayISO(), created_by: user?.id ?? '?' });
              toast.success('Expense recorded'); setAmt(''); setDesc('');
            }}>Add expense</Button>
          </div>
        </Card>
        <div className="min-w-0">
          {byCat.length > 0 && (
            <Card className="mb-2.5 p-3.5">
              <p className="mb-2 text-[13px] font-semibold">Spend by category</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {byCat.slice(0, 6).map(([c, v]) => (
                  <div key={c}>
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="font-medium">{c}</span>
                      <span className="tabular-nums text-zinc-500">{fmtMoney(v)}</span>
                    </div>
                    <Meter value={v} max={topCat} tone="solid" />
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card><Table className="w-full min-w-[560px] text-[13px]">
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>{db.expenses.map((e) => (
            <TableRow key={e.id}><TableCell className="text-xs">{fmtDateTime(e.expense_date)}</TableCell><TableCell><Badge>{e.category}</Badge></TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right font-semibold">{fmtMoney(e.amount)}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </Card>
        </div>
      </div>
    </div>
  );
}

export function StaffPage() {
  const { mode } = useStore();
  if (mode === 'remote') return <StaffLive />;
  return (
    <div>
      <PageHeader title="Staff & roles" icon={<UserCog aria-hidden />} sub="Demo accounts with role-based permissions" />
      <div className="grid gap-2.5 md:grid-cols-2">
        {DEMO_USERS.map((u) => (
          <Card key={u.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{u.name}</p><Badge tone="blue">{ROLE_LABEL[u.role]}</Badge></div>
                <p className="font-mono text-xs text-zinc-500">{u.email}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-3 p-4 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-800 dark:text-zinc-200">Granular permissions (enforced in UI, RLS in Supabase)</p>
        <p className="mt-1 font-mono text-xs">products.view · products.create · inventory.adjust · sales.create · sales.refund · sales.discount · sales.price_override · customers.view · reports.view · reports.export · settings.manage · users.manage</p>
      </Card>
    </div>
  );
}

function StaffLive() {
  const { db, user, canDo, audit } = useStore();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const editable = canDo('users.manage');

  const load = useCallback(async () => {
    if (!db.org.id) return;
    const [s, r, b] = await Promise.all([
      fetchStaff(db.org.id), fetchRolesList(db.org.id), fetchBranchesList(db.org.id),
    ]);
    setRows(s); setRoles(r); setBranches(b);
  }, [db.org.id]);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => toast.error(friendly(e))).finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    try { await load(); } catch (e) { toast.error(friendly(e)); }
  };

  const guardSelf = (row: StaffRow): boolean => {
    if (row.user_id === user?.id) {
      toast.error('You cannot change your own membership — ask another owner.');
      return true;
    }
    return false;
  };

  const changeRole = async (row: StaffRow, roleId: string) => {
    if (guardSelf(row) || !editable) return;
    try {
      await updateMember(row.id, { role_id: roleId });
      audit('permission.changed', 'member', row.id, { next: { role_id: roleId } });
      toast.success('Role updated — applies on next sign-in');
      await refresh();
    } catch (e) { toast.error(friendly(e)); }
  };

  const changeBranch = async (row: StaffRow, branchId: string) => {
    if (guardSelf(row) || !editable) return;
    try {
      await updateMember(row.id, { branch_id: branchId });
      toast.success('Branch updated');
      await refresh();
    } catch (e) { toast.error(friendly(e)); }
  };

  const toggleActive = async (row: StaffRow) => {
    if (guardSelf(row) || !editable) return;
    try {
      await updateMember(row.id, { is_active: !row.is_active });
      toast.success(row.is_active ? 'Access revoked' : 'Access restored');
      await refresh();
    } catch (e) { toast.error(friendly(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Staff" icon={<UserCog aria-hidden />}
        sub={`${rows.length} members · roles and access are enforced by RLS`}
        actions={editable ? <Button onClick={() => setLinkOpen(true)}><Plus size={15} /> Link auth user</Button> : undefined}
      />
      <Card>
        <Table className="w-full min-w-[720px] text-[13px]">
          <TableHeader><TableRow>
            <TableHead>Member</TableHead><TableHead>Role</TableHead>
            <TableHead>Branch</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="px-3 py-6 text-center text-zinc-500">Loading team…</TableCell></TableRow>}
            {!loading && rows.map((r) => {
              const self = r.user_id === user?.id;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar name={r.display_name ?? r.email ?? '?'} className="size-7 text-[10px]" />
                      <span className="min-w-0">
                        <p className="truncate font-medium">{r.display_name ?? '—'}{self && <span className="ml-1.5 rounded-full bg-zinc-950 px-1.5 text-[10px] font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">YOU</span>}</p>
                        <p className="truncate font-mono text-xs text-zinc-400">{r.email ?? r.user_id.slice(0, 8)}</p>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {editable && !self ? (
                      <Select value={r.role_id ?? ''} onValueChange={(v) => void changeRole(r, v)}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{roles.map((ro) => <SelectItem key={ro.id} value={ro.id}>{ROLE_LABEL[ro.name as keyof typeof ROLE_LABEL] ?? ro.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Badge tone="blue">{ROLE_LABEL[r.role_name as keyof typeof ROLE_LABEL] ?? r.role_name}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable && !self ? (
                      <Select value={r.branch_id ?? ''} onValueChange={(v) => void changeBranch(r, v)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-zinc-500">{r.branch_name ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>{r.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {editable && !self && (
                      <button onClick={() => void toggleActive(r)} className="text-xs text-zinc-900 hover:underline">
                        {r.is_active ? 'Revoke' : 'Restore'}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {!editable && (
        <p className="mt-2 text-xs text-zinc-500">Read-only — only owners (<span className="font-mono">users.manage</span>) can change team access.</p>
      )}
      <LinkMemberModal
        open={linkOpen} onClose={() => setLinkOpen(false)} orgId={db.org.id}
        roles={roles} branches={branches} onDone={() => { setLinkOpen(false); void refresh(); }}
      />
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LinkMemberModal({ open, onClose, orgId, roles, branches, onDone }: {
  open: boolean; onClose: () => void; orgId: string; roles: RoleRow[]; branches: Branch[]; onDone: () => void;
}) {
  const { audit } = useStore();
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [branchId, setBranchId] = useState('');

  const submit = async () => {
    if (!UUID_RE.test(uid.trim())) { toast.error('Paste the auth user UID (UUID format) from Authentication → Users'); return; }
    if (!email.trim() || !name.trim()) { toast.error('Email and display name are required'); return; }
    if (!roleId || !branchId) { toast.error('Pick a role and branch'); return; }
    try {
      await linkMember({ org: orgId, userId: uid.trim(), email: email.trim(), displayName: name.trim(), roleId, branchId });
      audit('user.created', 'member', uid.trim(), { next: { email, roleId } });
      toast.success('Member linked — they can sign in now');
      setUid(''); setEmail(''); setName(''); setRoleId(''); setBranchId('');
      onDone();
    } catch (e) { toast.error(friendly(e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Link auth user to this store">
      <div className="grid gap-2.5">
        <p className="rounded-lg bg-zinc-50 p-2.5 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-900">
          Auth users are created in the Supabase dashboard (Authentication → Users).
          Paste the UID here to grant store access.
        </p>
        <Field label="Auth user UID *"><Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono" /></Field>
        <Field label="Email *"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cashier2@demo.mm" /></Field>
        <Field label="Display name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma Cashier 2" /></Field>
        <Field label="Role *"><Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
          <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{ROLE_LABEL[r.name as keyof typeof ROLE_LABEL] ?? r.name}</SelectItem>)}</SelectContent>
        </Select></Field>
        <Field label="Branch *"><Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger><SelectValue placeholder="Select branch…" /></SelectTrigger>
          <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}</SelectContent>
        </Select></Field>
        <Button onClick={() => void submit()}>Link member</Button>
      </div>
    </Modal>
  );
}

export function RolesPage() {
  const { mode } = useStore();
  if (mode === 'remote') return <RolesLive />;
  return (
    <div>
      <PageHeader title="Roles" sub="Granular permissions (demo snapshot)" icon={<ShieldCheck aria-hidden />} />
      <Card className="p-4 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-800 dark:text-zinc-200">Sign in to the live store to edit role permissions.</p>
        <p className="mt-1 font-mono text-xs">products.view · products.create · inventory.adjust · sales.create · sales.refund · sales.discount · sales.price_override · customers.view · reports.view · reports.export · settings.manage · users.manage</p>
      </Card>
    </div>
  );
}

function RolesLive() {
  const { db, canDo, audit } = useStore();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const editable = canDo('users.manage');

  const load = useCallback(async () => {
    if (!db.org.id) return;
    setRoles(await fetchRolesList(db.org.id));
  }, [db.org.id]);

  useEffect(() => {
    setLoading(true);
    load().catch((e) => toast.error(friendly(e))).finally(() => setLoading(false));
  }, [load]);

  const toggle = async (role: RoleRow, perm: string) => {
    if (!editable) return;
    const has = role.permissions.includes(perm) || role.permissions.includes('*');
    if (role.name === 'owner' && perm === 'users.manage' && has) {
      toast.error('The owner role must keep users.manage — otherwise nobody can manage access.');
      return;
    }
    const next = has
      ? role.permissions.filter((x) => x !== perm && x !== '*')
      : [...role.permissions.filter((x) => x !== '*'), perm];
    try {
      await updateRolePerms(role.id, next);
      audit('permission.changed', 'role', role.id, { next: { permissions: next } });
      setRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions: next } : r)));
      toast.success('Permission updated — applies on next sign-in');
    } catch (e) { toast.error(friendly(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Roles & permissions" icon={<ShieldCheck aria-hidden />}
        sub="Owner-only editing · changes apply when the member next signs in"
      />
      <Card>
        <Table className="w-full min-w-[640px] text-[13px]">
          <TableHeader><TableRow>
            <TableHead>Permission</TableHead>
            {roles.map((r) => (
              <TableHead key={r.id} className="text-center">
                <span className="flex items-center justify-center gap-1">
                  {r.name === 'owner' && <ShieldCheck size={12} aria-hidden />}
                  {ROLE_LABEL[r.name as keyof typeof ROLE_LABEL] ?? r.name}
                </span>
              </TableHead>
            ))}
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="px-3 py-6 text-center text-zinc-500">Loading roles…</TableCell></TableRow>}
            {!loading && PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.area}>
                <TableRow key={g.area} className="bg-zinc-50/70 dark:bg-zinc-900/50">
                  <TableCell colSpan={roles.length + 1} className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">{g.area}</TableCell>
                </TableRow>
                {g.perms.map((perm) => (
                  <TableRow key={perm}>
                    <TableCell className="font-mono text-xs">{perm}</TableCell>
                    {roles.map((r) => {
                      const on = r.permissions.includes('*') || r.permissions.includes(perm);
                      return (
                        <TableCell key={r.id} className="text-center">
                          <button
                            onClick={() => void toggle(r, perm)}
                            disabled={!editable}
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`${perm} for ${r.name}`}
                            className={'inline-flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed ' + (on ? 'justify-end bg-zinc-950 dark:bg-zinc-50' : 'justify-start bg-zinc-200 dark:bg-zinc-700')}
                          >
                            <span className={'size-4 rounded-full shadow ' + (on ? 'bg-white dark:bg-zinc-950' : 'bg-white dark:bg-zinc-400')} />
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
      {!editable && (
        <p className="mt-2 text-xs text-zinc-500">Read-only — only owners (<span className="font-mono">users.manage</span>) can edit roles.</p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { db, resetDemo, mode, user, refreshRemote, remoteError } = useStore();
  const [ping, setPing] = useState<{ ok: boolean; detail: string } | null>(null);
  const [pinging, setPinging] = useState(false);
  const testConnection = async () => {
    setPinging(true);
    try {
      const { ping: pingFn } = await import('../../store/remote');
      setPing(await pingFn());
    } finally {
      setPinging(false);
    }
  };
  return (
    <div>
      <PageHeader title="Settings" sub="Organization, branch, data mode" icon={<SettingsIcon aria-hidden />} />
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card className="p-5 text-sm">
          <p className="font-semibold">{db.org.name}</p>
          <p className="text-zinc-500">{db.org.address}</p>
          <p className="text-zinc-500">{db.org.phone} · {db.org.email}</p>
          <p className="mt-2">Currency: <b>{db.org.currency}</b> · Timezone: <b>{db.org.timezone}</b></p>
          <p className="mt-2">Branch: <b>{db.branch.name} ({db.branch.code})</b></p>
          <p className="mt-2">Data mode: <Badge tone={mode === 'remote' ? 'green' : 'amber'}>{mode === 'remote' ? 'Supabase live' : 'Local demo'}</Badge></p>
          {mode === 'remote' && (
            <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-[13px] dark:bg-zinc-900">
              <p>Signed in as <b>{user?.email}</b> · role <b>{user?.role}</b></p>
              <p>Project <span className="font-mono text-xs">{new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname}</span></p>
              <p>Loaded: {db.products.length} products · {db.customers.length} customers · {db.sales.length} sales · {db.movements.length} movements</p>
              {remoteError && <p className="font-medium text-zinc-900 dark:text-zinc-100">Sync notice: {remoteError}</p>}
              <div className="flex gap-1.5 pt-1">
                <Button variant="outline" onClick={testConnection} disabled={pinging}>{pinging ? 'Pinging…' : 'Test connection'}</Button>
                <Button variant="outline" onClick={() => { void refreshRemote().then(() => toast.success('Reloaded from Supabase')); }}>Reload data</Button>
              </div>
              {ping && (
                <p className="flex items-center gap-1.5 font-medium">
                  {ping.ok
                    ? <><CheckCircle2 size={14} aria-hidden /> {ping.detail}</>
                    : <><XCircle size={14} aria-hidden /> {ping.detail}</>}
                </p>
              )}
            </div>
          )}
        </Card>
        {mode === 'local' && (
          <Card className="p-5 text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Danger zone</p>
            <p className="text-zinc-500">Reset all demo data (products, sales, customers revert to seed).</p>
            <Button variant="danger" className="mt-2" onClick={() => { resetDemo(); toast.success('Demo data reset'); }}>Reset demo data</Button>
          </Card>
        )}
        {mode === 'remote' && (
          <Card className="p-5 text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Live data</p>
            <p className="text-zinc-500">Records live in Supabase under RLS. Use the SQL Editor for destructive operations — there is no reset button here on purpose.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export function AuditPage() {
  const { db } = useStore();
  const pg = usePagination(db.audit.length, 20);
  return (
    <div>
      <PageHeader title="Audit logs" icon={<ScrollText aria-hidden />} sub="Important actions — hidden from cashiers in production" />
      <Card><Table className="w-full min-w-[680px] text-[13px]">
        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead></TableRow></TableHeader>
        <TableBody>{db.audit.slice(pg.start, pg.start + pg.size).map((a) => (
          <TableRow key={a.id}><TableCell className="text-xs">{fmtDateTime(a.created_at)}</TableCell><TableCell className="font-mono text-xs">{a.user_id}</TableCell><TableCell><Badge>{a.action}</Badge></TableCell><TableCell className="font-mono text-xs">{a.entity_type}:{a.entity_id.slice(-8)}</TableCell></TableRow>
        ))}</TableBody>
      </Table>
        <Pager page={pg.page} pages={pg.pages} total={db.audit.length} size={pg.size} onPage={pg.setPage} onSize={pg.setSize} />
      </Card>
    </div>
  );
}
