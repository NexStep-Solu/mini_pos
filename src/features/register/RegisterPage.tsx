import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { fmtMoney, fmtDateTime } from '../../lib/formatters';
import { Button, Card, Input, Badge, PageHeader } from '../../components/ui';
import { toast } from 'sonner';

export function RegisterPage() {
  const { db, openRegister, closeRegister } = useStore();
  const [opening, setOpening] = useState('50000');
  const [closing, setClosing] = useState('');
  const open = db.sessions.find((s) => s.status === 'open');

  const cashSales = open
    ? db.sales.filter((s) => s.sold_at >= open.opened_at && s.payments.some((p) => p.method === 'cash'))
      .reduce((a, s) => a + s.payments.filter((p) => p.method === 'cash').reduce((x, p) => x + p.amount, 0), 0)
    : 0;

  return (
    <div>
      <PageHeader title="Cash register" sub="Open → sell → close → reconcile cash" icon={<Wallet aria-hidden />} />
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card className="p-4">
          {!open ? (
            <div className="grid gap-2.5">
              <p className="font-semibold">Register is closed</p>
              <label className="text-xs text-zinc-600">Opening cash (MMK)<Input value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
              <Button onClick={() => { openRegister(Number(opening) || 0); toast.success('Register opened'); }}>Open register</Button>
            </div>
          ) : (
            <div className="grid gap-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-zinc-50"><span className="inline-block size-2 rounded-full bg-zinc-950 dark:bg-zinc-50" aria-hidden /> Register OPEN since {fmtDateTime(open.opened_at)}</p>
              <div className="flex justify-between"><span>Opening cash</span><b>{fmtMoney(open.opening_cash)}</b></div>
              <div className="flex justify-between"><span>Cash sales this session</span><b>{fmtMoney(cashSales)}</b></div>
              <div className="flex justify-between"><span>Expected cash</span><b>{fmtMoney(open.opening_cash + cashSales)}</b></div>
              <label className="mt-2 text-xs text-zinc-600">Counted closing cash<Input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Count the drawer…" /></label>
              <Button onClick={() => { closeRegister(Number(closing) || 0); toast.success('Register closed'); setClosing(''); }}>Close register</Button>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <p className="mb-2 font-semibold">Session history</p>
          <div className="max-h-80 space-y-1.5 overflow-auto text-sm">
            {db.sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <span className="text-xs text-zinc-500">{fmtDateTime(s.opened_at)} → {s.closed_at ? fmtDateTime(s.closed_at) : '…'}</span>
                <Badge tone={s.status === 'open' ? 'green' : 'slate'}>{s.status}</Badge>
                <span className="ml-auto text-xs tabular-nums">open {fmtMoney(s.opening_cash)}</span>
                {s.closing_cash != null && (
                  <span className="flex items-center gap-1.5 text-xs tabular-nums">
                    close {fmtMoney(s.closing_cash)}
                    <Badge tone={(s.cash_difference ?? 0) === 0 ? 'green' : 'red'}>
                      {(s.cash_difference ?? 0) === 0 ? 'balanced' : `diff ${fmtMoney(s.cash_difference ?? 0)}`}
                    </Badge>
                  </span>
                )}
              </div>
            ))}
            {db.sessions.length === 0 && <p className="text-sm text-zinc-500">No sessions yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
