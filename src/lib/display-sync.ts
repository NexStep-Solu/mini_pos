import { supabase, isSupabaseConfigured } from './supabase';

// ─── Customer display sync ──────────────────────────────────────────────
// Two transports, same payload:
//   1. BroadcastChannel  — instant, same-browser (cashier tab → display
//      window on a second monitor). Always available, no backend needed.
//   2. Supabase Realtime broadcast — true multi-device sync when the project
//      is configured (phone/tablet/TV as the customer screen).
// Messages carry a monotonic seq; receivers keep the highest seq only,
// so dual-transport duplicates are harmless.

export type DisplayStatus = 'idle' | 'cart' | 'paying' | 'complete';

export interface DisplayLine {
  name: string;
  qty: number;
  total: number;
}

export interface DisplayState {
  seq: number;
  sentAt: number;
  status: DisplayStatus;
  lines: DisplayLine[];
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  customerName?: string | null;
  invoice?: string;
  change?: number;
  methods?: string[];
}

const CHANNEL = 'mm-pos-display';
const RT_CHANNEL = 'pos-display';
const RT_EVENT = 'cart-state';

let seq = 0;
let bc: BroadcastChannel | null = null;
let rtChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let rtReady = false;

function getBC(): BroadcastChannel | null {
  try {
    if (!bc && typeof BroadcastChannel !== 'undefined') bc = new BroadcastChannel(CHANNEL);
    return bc;
  } catch {
    return null;
  }
}

function getRT() {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!rtChannel) rtChannel = supabase.channel(RT_CHANNEL);
  return rtChannel;
}

// Subscribe exactly once; fan out to all live subscribers. Bindings must be
// attached BEFORE subscribe() is called, otherwise broadcasts are missed.
const rtHandlers = new Set<(m: DisplayState) => void>();
let rtSubscribed = false;

function ensureRT() {
  const ch = getRT();
  if (!ch || rtSubscribed) return;
  rtSubscribed = true;
  ch.on('broadcast', { event: RT_EVENT }, ({ payload }) => {
    for (const h of rtHandlers) {
      try { h(payload as DisplayState); } catch { /* ignore */ }
    }
  });
  ch.subscribe((status) => {
    rtReady = status === 'SUBSCRIBED';
  });
}

export function publishDisplay(patch: Omit<DisplayState, 'seq' | 'sentAt'>): void {
  const msg: DisplayState = { ...patch, seq: ++seq, sentAt: Date.now() };
  getBC()?.postMessage(msg);
  ensureRT();
  const rt = getRT();
  if (rt && rtReady) {
    void rt.send({ type: 'broadcast', event: RT_EVENT, payload: msg });
  }
}

export function subscribeDisplay(onMsg: (msg: DisplayState) => void): () => void {
  let lastSeq = 0;
  const accept = (msg: DisplayState) => {
    if (!msg || typeof msg.seq !== 'number' || msg.seq <= lastSeq) return;
    lastSeq = msg.seq;
    onMsg(msg);
  };

  const channel = getBC();
  const bcHandler = (e: MessageEvent) => accept(e.data as DisplayState);
  channel?.addEventListener('message', bcHandler);

  rtHandlers.add(accept);
  ensureRT();

  return () => {
    channel?.removeEventListener('message', bcHandler);
    rtHandlers.delete(accept);
  };
}

export function openDisplayWindow(): void {
  window.open('/display', '_blank', 'noopener,width=1024,height=768');
}
