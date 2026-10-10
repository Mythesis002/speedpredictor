import type { Session, User } from "@supabase/supabase-js";

export interface MockProfileRow {
  id: string;
  phone: string;
  display_name: string | null;
  balance_paise: number;
  created_at: string;
  updated_at: string;
  self_excluded_until: string | null;
  daily_loss_limit_paise: number | null;
  age_confirmed_at: string | null;
  is_banned: boolean;
  banned_reason: string | null;
}

export interface MockBetRow {
  id: string;
  user_id: string;
  round_id: number;
  lane: number;
  amount_paise: number;
  multiplier: number;
  status: "pending" | "won" | "lost";
  payout_paise: number;
  winner_lane: number | null;
  created_at: string;
  settled_at: string | null;
}

export interface MockDepositRow {
  id: string;
  user_id: string;
  amount_paise: number;
  provider: string;
  qr_id: string | null;
  qr_image_url: string | null;
  payment_id: string | null;
  status: "pending" | "paid" | "expired";
  created_at: string;
  paid_at: string | null;
}

export interface MockWithdrawalRow {
  id: string;
  user_id: string;
  amount_paise: number;
  upi_id: string;
  status: "pending" | "paid" | "rejected";
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface MockTransactionRow {
  id: string;
  user_id: string;
  kind: string;
  amount_paise: number;
  balance_after_paise: number;
  reference: string | null;
  created_at: string;
}

export interface MockRoundRow {
  round_id: number;
  winner_lane: number;
  finish_order: number[];
  commit_hash: string;
  reveal: string;
  created_at: string;
}

export interface MockAuditRow {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface GlobalStore {
  usersByEmail: Map<string, { user: User; password: string }>;
  profiles: Map<string, MockProfileRow>;
  bets: MockBetRow[];
  deposits: MockDepositRow[];
  withdrawals: MockWithdrawalRow[];
  transactions: MockTransactionRow[];
  rounds: Map<number, MockRoundRow>;
  auditLog: MockAuditRow[];
  admins: Set<string>;
}

const g = globalThis as unknown as { __apexMockStore?: GlobalStore };

function createInitialStore(): GlobalStore {
  const demoUserId = "11111111-1111-4111-8111-111111111111";
  const demoPhone = "9876543210";
  const demoEmail = `${demoPhone}@speedpredict.app`;
  const now = new Date().toISOString();

  const demoUser: User = {
    id: demoUserId,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { phone: demoPhone, age_confirmed: true },
    aud: "authenticated",
    created_at: now,
    email: demoEmail,
    role: "authenticated",
  };

  const profiles = new Map<string, MockProfileRow>();
  profiles.set(demoUserId, {
    id: demoUserId,
    phone: demoPhone,
    display_name: "Apex Racer",
    balance_paise: 50000, // ₹500 demo balance
    created_at: now,
    updated_at: now,
    self_excluded_until: null,
    daily_loss_limit_paise: null,
    age_confirmed_at: now,
    is_banned: false,
    banned_reason: null,
  });

  const usersByEmail = new Map<string, { user: User; password: string }>();
  usersByEmail.set(demoEmail, { user: demoUser, password: "password123" });

  const transactions: MockTransactionRow[] = [
    {
      id: "tx-welcome-1",
      user_id: demoUserId,
      kind: "signup_bonus",
      amount_paise: 2800,
      balance_after_paise: 2800,
      reference: "welcome",
      created_at: now,
    },
    {
      id: "tx-deposit-1",
      user_id: demoUserId,
      kind: "deposit",
      amount_paise: 47200,
      balance_after_paise: 50000,
      reference: "pay_demo_initial",
      created_at: now,
    },
  ];

  const deposits: MockDepositRow[] = [
    {
      id: "dep-demo-1",
      user_id: demoUserId,
      amount_paise: 47200,
      provider: "razorpay",
      qr_id: "qr_demo_1",
      qr_image_url: null,
      payment_id: "pay_demo_initial",
      status: "paid",
      created_at: now,
      paid_at: now,
    },
  ];

  return {
    usersByEmail,
    profiles,
    bets: [],
    deposits,
    withdrawals: [],
    transactions,
    rounds: new Map<number, MockRoundRow>(),
    auditLog: [],
    admins: new Set([demoUserId]),
  };
}

export function getStore(): GlobalStore {
  if (!g.__apexMockStore) {
    g.__apexMockStore = createInitialStore();
  }
  return g.__apexMockStore;
}

function encodeBase64Url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64url");
  }
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("utf-8")
        : atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createMockSession(user: User): Session {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
  const header = encodeBase64Url({ alg: "HS256", typ: "JWT" });
  const payload = encodeBase64Url({
    sub: user.id,
    email: user.email,
    phone: user.user_metadata?.phone ?? "9876543210",
    role: "authenticated",
    aud: "authenticated",
    exp,
  });
  const token = `${header}.${payload}.mocksignature`;
  return {
    access_token: token,
    refresh_token: "mock-refresh-token",
    expires_in: 86400 * 7,
    expires_at: exp,
    token_type: "bearer",
    user,
  };
}

export function ensureProfileForUser(userId: string, phoneInput?: string): MockProfileRow {
  const store = getStore();
  let profile = store.profiles.get(userId);
  if (!profile) {
    const now = new Date().toISOString();
    const phone = (phoneInput ?? "9876543210").replace(/\D/g, "").slice(-10) || "9876543210";
    profile = {
      id: userId,
      phone,
      display_name: null,
      balance_paise: 2800,
      created_at: now,
      updated_at: now,
      self_excluded_until: null,
      daily_loss_limit_paise: null,
      age_confirmed_at: now,
      is_banned: false,
      banned_reason: null,
    };
    store.profiles.set(userId, profile);
    store.admins.add(userId);
    store.transactions.push({
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      kind: "signup_bonus",
      amount_paise: 2800,
      balance_after_paise: 2800,
      reference: "welcome",
      created_at: now,
    });
  }
  return profile;
}

class MockQueryBuilder {
  private table: string;
  private filters: Array<(row: any) => boolean> = [];
  private orderField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: any = null;
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(table: string) {
    this.table = table;
  }

  select(_columns?: string) {
    return this;
  }

  insert(values: any) {
    this.op = "insert";
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.op = "update";
    this.payload = values;
    return this;
  }

  upsert(values: any, _opts?: any) {
    this.op = "upsert";
    this.payload = values;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => String(r[col]) === String(val));
    return this;
  }

  in(col: string, vals: any[]) {
    const set = new Set(vals.map(String));
    this.filters.push((r) => set.has(String(r[col])));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderField = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  private getRows(): any[] {
    const store = getStore();
    switch (this.table) {
      case "profiles":
        return Array.from(store.profiles.values());
      case "bets":
        return [...store.bets];
      case "deposits":
        return [...store.deposits];
      case "withdrawals":
        return [...store.withdrawals];
      case "transactions":
        return [...store.transactions];
      case "rounds":
        return Array.from(store.rounds.values());
      case "audit_log":
        return [...store.auditLog];
      default:
        return [];
    }
  }

  private execute(): { data: any; error: null | { message: string } } {
    const store = getStore();
    const now = new Date().toISOString();

    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const created: any[] = [];
      for (const item of items) {
        const id = item.id ?? `${this.table.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const row = { ...item, id, created_at: item.created_at ?? now };
        if (this.table === "deposits") {
          row.provider = row.provider ?? "razorpay";
          row.status = row.status ?? "pending";
          row.qr_id = row.qr_id ?? null;
          row.qr_image_url = row.qr_image_url ?? null;
          row.payment_id = row.payment_id ?? null;
          row.paid_at = row.paid_at ?? null;
          store.deposits.push(row);
        } else if (this.table === "audit_log") {
          store.auditLog.push(row);
        } else if (this.table === "bets") {
          store.bets.push(row);
        } else if (this.table === "withdrawals") {
          store.withdrawals.push(row);
        } else if (this.table === "transactions") {
          store.transactions.push(row);
        }
        created.push(row);
      }
      const data =
        this.singleMode !== "none" ? (created[0] ?? null) : created;
      return { data, error: null };
    }

    if (this.op === "upsert" && this.table === "rounds") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const upserted: any[] = [];
      for (const item of items) {
        const r: MockRoundRow = {
          round_id: Number(item.round_id),
          winner_lane: Number(item.winner_lane),
          finish_order: item.finish_order ?? [item.winner_lane, 0, 1],
          commit_hash: item.commit_hash ?? "",
          reveal: item.reveal ?? "",
          created_at: item.created_at ?? now,
        };
        store.rounds.set(r.round_id, r);
        upserted.push(r);
      }
      return {
        data: this.singleMode !== "none" ? (upserted[0] ?? null) : upserted,
        error: null,
      };
    }

    if (this.op === "update") {
      const rows = this.getRows().filter((r) => this.filters.every((f) => f(r)));
      for (const r of rows) {
        Object.assign(r, this.payload);
        if (this.table === "profiles") {
          store.profiles.set(r.id, r);
        }
      }
      return {
        data: this.singleMode !== "none" ? (rows[0] ?? null) : rows,
        error: null,
      };
    }

    // SELECT
    let rows = this.getRows().filter((r) => this.filters.every((f) => f(r)));

    // If querying profiles by id and none found, auto-provision so authenticated user never hits "Profile not found"
    if (this.table === "profiles" && rows.length === 0 && this.singleMode !== "none") {
      // Check if there's an eq("id", ...) filter
      const demoCheck = Array.from(store.profiles.values());
      if (demoCheck.length > 0) {
        // Try matching with a freshly ensured profile if possible
      }
    }

    if (this.orderField) {
      const f = this.orderField;
      const dir = this.orderAsc ? 1 : -1;
      rows.sort((a, b) => (a[f] > b[f] ? dir : a[f] < b[f] ? -dir : 0));
    }
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.singleMode === "single" || this.singleMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function createMockSupabaseClient(defaultUserId?: string) {
  const listeners = new Set<(event: string, session: Session | null) => void>();
  const STORAGE_KEY = "apex_mock_auth_session";

  function loadStoredSession(): Session | null {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Session;
          if (parsed?.user?.id) {
            ensureProfileForUser(parsed.user.id, parsed.user.user_metadata?.phone);
            return parsed;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    return null;
  }

  function saveStoredSession(sess: Session | null) {
    if (typeof window !== "undefined") {
      try {
        if (sess) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
    for (const cb of listeners) {
      try {
        cb(sess ? "SIGNED_IN" : "SIGNED_OUT", sess);
      } catch {
        // ignore
      }
    }
  }

  async function handleRpc(fnName: string, args: Record<string, any> = {}): Promise<{ data: any; error: any }> {
    const store = getStore();
    const now = new Date().toISOString();

    switch (fnName) {
      case "place_bet": {
        const userId = String(args.p_user_id);
        const roundId = Number(args.p_round_id);
        const lane = Number(args.p_lane);
        const amountPaise = Number(args.p_amount_paise);
        const multiplier = Number(args.p_multiplier);

        const profile = ensureProfileForUser(userId);
        if (profile.is_banned) {
          return { data: null, error: { message: "Account is suspended" } };
        }
        if (profile.self_excluded_until && new Date(profile.self_excluded_until) > new Date()) {
          return { data: null, error: { message: "Self-exclusion is active" } };
        }
        if (profile.balance_paise < amountPaise) {
          return { data: null, error: { message: "Insufficient balance" } };
        }
        const existing = store.bets.find((b) => b.user_id === userId && b.round_id === roundId);
        if (existing) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }

        const betId = `bet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        profile.balance_paise -= amountPaise;
        profile.updated_at = now;

        store.bets.push({
          id: betId,
          user_id: userId,
          round_id: roundId,
          lane,
          amount_paise: amountPaise,
          multiplier,
          status: "pending",
          payout_paise: 0,
          winner_lane: null,
          created_at: now,
          settled_at: null,
        });

        store.transactions.push({
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: userId,
          kind: "bet",
          amount_paise: -amountPaise,
          balance_after_paise: profile.balance_paise,
          reference: String(roundId),
          created_at: now,
        });

        return {
          data: [{ out_bet_id: betId, out_balance_paise: profile.balance_paise }],
          error: null,
        };
      }

      case "settle_bet": {
        const userId = String(args.p_user_id);
        const roundId = Number(args.p_round_id);
        const winnerLane = Number(args.p_winner_lane);
        const profile = ensureProfileForUser(userId);

        const bet = store.bets.find((b) => b.user_id === userId && b.round_id === roundId);
        if (!bet) {
          return {
            data: [{ out_status: "none", out_payout_paise: 0, out_balance_paise: profile.balance_paise }],
            error: null,
          };
        }
        if (bet.status !== "pending") {
          return {
            data: [{ out_status: bet.status, out_payout_paise: bet.payout_paise, out_balance_paise: profile.balance_paise }],
            error: null,
          };
        }

        if (bet.lane === winnerLane) {
          bet.status = "won";
          bet.payout_paise = Math.round(bet.amount_paise * bet.multiplier);
          profile.balance_paise += bet.payout_paise;
          profile.updated_at = now;
          store.transactions.push({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            user_id: userId,
            kind: "win",
            amount_paise: bet.payout_paise,
            balance_after_paise: profile.balance_paise,
            reference: String(roundId),
            created_at: now,
          });
        } else {
          bet.status = "lost";
          bet.payout_paise = 0;
        }
        bet.winner_lane = winnerLane;
        bet.settled_at = now;

        return {
          data: [{ out_status: bet.status, out_payout_paise: bet.payout_paise, out_balance_paise: profile.balance_paise }],
          error: null,
        };
      }

      case "credit_deposit": {
        const depId = String(args.p_deposit_id);
        const paymentId = String(args.p_payment_id);
        const amountPaise = Number(args.p_amount_paise);
        const dep = store.deposits.find((d) => d.id === depId);
        if (!dep) {
          return { data: null, error: { message: "Deposit not found" } };
        }
        const profile = ensureProfileForUser(dep.user_id);
        if (dep.status === "paid") {
          return { data: [{ credited: false, balance_paise: profile.balance_paise }], error: null };
        }
        dep.status = "paid";
        dep.payment_id = paymentId;
        dep.paid_at = now;
        profile.balance_paise += amountPaise;
        profile.updated_at = now;
        store.transactions.push({
          id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: dep.user_id,
          kind: "deposit",
          amount_paise: amountPaise,
          balance_after_paise: profile.balance_paise,
          reference: paymentId,
          created_at: now,
        });
        return { data: [{ credited: true, balance_paise: profile.balance_paise }], error: null };
      }

      case "request_withdrawal": {
        const userId = String(args.p_user_id);
        const amountPaise = Number(args.p_amount_paise);
        const upiId = String(args.p_upi_id);
        const profile = ensureProfileForUser(userId);
        if (profile.balance_paise < amountPaise) {
          return { data: null, error: { message: "Insufficient balance" } };
        }
        store.withdrawals.push({
          id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: userId,
          amount_paise: amountPaise,
          upi_id: upiId,
          status: "pending",
          admin_note: null,
          created_at: now,
          processed_at: null,
        });
        return { data: [{ ok: true }], error: null };
      }

      case "process_withdrawal": {
        const wdId = String(args.p_withdrawal_id);
        const action = String(args.p_action);
        const note = args.p_note ? String(args.p_note) : null;
        const wd = store.withdrawals.find((w) => w.id === wdId);
        if (!wd) return { data: null, error: { message: "Withdrawal not found" } };
        const profile = ensureProfileForUser(wd.user_id);
        if (wd.status === "pending") {
          if (action === "approve") {
            if (profile.balance_paise < wd.amount_paise) {
              return { data: null, error: { message: "Insufficient player balance" } };
            }
            profile.balance_paise -= wd.amount_paise;
            wd.status = "paid";
          } else {
            wd.status = "rejected";
          }
          wd.admin_note = note;
          wd.processed_at = now;
        }
        return {
          data: [{ out_status: wd.status, out_balance_paise: profile.balance_paise }],
          error: null,
        };
      }

      case "public_stats": {
        const startOfToday = new Date(new Date().toISOString().slice(0, 10)).getTime();
        const stakedPaise = store.bets.reduce((sum, b) => sum + b.amount_paise, 0) + 1485000;
        const betsToday = store.bets.filter((b) => new Date(b.created_at).getTime() >= startOfToday).length + 42;
        return {
          data: [
            {
              players: Math.max(12, store.profiles.size + 11),
              staked_paise: stakedPaise,
              bets_today: betsToday,
            },
          ],
          error: null,
        };
      }

      case "has_role": {
        return { data: true, error: null };
      }

      case "admin_set_ban": {
        const targetId = String(args.p_user);
        const banned = Boolean(args.p_banned);
        const reason = String(args.p_reason ?? "");
        const profile = ensureProfileForUser(targetId);
        profile.is_banned = banned;
        profile.banned_reason = banned ? reason : null;
        return { data: true, error: null };
      }

      case "admin_adjust_balance": {
        const targetId = String(args.p_user);
        const delta = Number(args.p_amount_paise);
        const profile = ensureProfileForUser(targetId);
        profile.balance_paise = Math.max(0, profile.balance_paise + delta);
        return { data: profile.balance_paise, error: null };
      }

      default:
        return { data: null, error: null };
    }
  }

  return {
    from(table: string) {
      const builder = new MockQueryBuilder(table);
      const origEq = builder.eq.bind(builder);
      builder.eq = (col: string, val: any) => {
        if (table === "profiles" && col === "id" && typeof val === "string") {
          ensureProfileForUser(val);
        }
        return origEq(col, val);
      };
      return builder;
    },
    rpc: handleRpc,
    auth: {
      async getSession() {
        const session = loadStoredSession();
        return { data: { session }, error: null };
      },
      async getUser(jwt?: string) {
        if (jwt) {
          const claims = decodeJwtPayload(jwt);
          if (claims?.sub) {
            const uid = String(claims.sub);
            const prof = ensureProfileForUser(uid, claims.phone as string | undefined);
            return {
              data: {
                user: {
                  id: uid,
                  email: (claims.email as string) ?? `${prof.phone}@speedpredict.app`,
                  user_metadata: { phone: prof.phone },
                  app_metadata: {},
                  aud: "authenticated",
                  created_at: prof.created_at,
                } as User,
              },
              error: null,
            };
          }
        }
        const session = loadStoredSession();
        if (session?.user) {
          return { data: { user: session.user }, error: null };
        }
        if (defaultUserId) {
          const prof = ensureProfileForUser(defaultUserId);
          return {
            data: {
              user: {
                id: defaultUserId,
                email: `${prof.phone}@speedpredict.app`,
                user_metadata: { phone: prof.phone },
                app_metadata: {},
                aud: "authenticated",
                created_at: prof.created_at,
              } as User,
            },
            error: null,
          };
        }
        return { data: { user: null }, error: null };
      },
      async getClaims(token: string) {
        const claims = decodeJwtPayload(token);
        if (!claims || !claims.sub) {
          return { data: null, error: { message: "Invalid token" } };
        }
        ensureProfileForUser(String(claims.sub), claims.phone as string | undefined);
        return { data: { claims }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        listeners.add(callback);
        const current = loadStoredSession();
        setTimeout(() => callback(current ? "INITIAL_SESSION" : "SIGNED_OUT", current), 0);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              },
            },
          },
        };
      },
      async signUp({
        email,
        password,
        options,
      }: {
        email: string;
        password: string;
        options?: { data?: { phone?: string; age_confirmed?: boolean } };
      }) {
        const store = getStore();
        const normalizedEmail = email.toLowerCase();
        const phone =
          options?.data?.phone ?? normalizedEmail.split("@")[0].replace(/\D/g, "").slice(-10);

        let entry = store.usersByEmail.get(normalizedEmail);
        if (!entry) {
          const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const now = new Date().toISOString();
          const user: User = {
            id: userId,
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: { phone, age_confirmed: true },
            aud: "authenticated",
            created_at: now,
            email: normalizedEmail,
            role: "authenticated",
          };
          entry = { user, password };
          store.usersByEmail.set(normalizedEmail, entry);
          ensureProfileForUser(userId, phone);
        }
        const session = createMockSession(entry.user);
        saveStoredSession(session);
        return { data: { user: entry.user, session }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const store = getStore();
        const normalizedEmail = email.toLowerCase();
        const phone = normalizedEmail.split("@")[0].replace(/\D/g, "").slice(-10) || "9876543210";
        let entry = store.usersByEmail.get(normalizedEmail);
        if (!entry) {
          // Auto-provision account in preview mode if signing in with any valid phone/password
          const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const now = new Date().toISOString();
          const user: User = {
            id: userId,
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: { phone, age_confirmed: true },
            aud: "authenticated",
            created_at: now,
            email: normalizedEmail,
            role: "authenticated",
          };
          entry = { user, password };
          store.usersByEmail.set(normalizedEmail, entry);
          ensureProfileForUser(userId, phone);
        }
        const session = createMockSession(entry.user);
        saveStoredSession(session);
        return { data: { user: entry.user, session }, error: null };
      },
      async signOut(_opts?: { scope?: string }) {
        saveStoredSession(null);
        return { error: null };
      },
    },
  };
}
