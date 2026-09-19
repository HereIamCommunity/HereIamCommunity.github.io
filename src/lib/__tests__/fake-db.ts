/**
 * store.ts 테스트용 가짜 Supabase 클라이언트.
 * 실제 API처럼 한 번에 최대 maxRows(기본 1,000)행만 돌려준다 — 페이지 반복이 빠지면 테스트가 잡는다.
 * 지원: from().select().eq().not(is null).order().range().limit().maybeSingle().single(),
 *       insert().select().single(), update().eq().select(), rpc()
 */

type Row = Record<string, unknown> & { id: number };
type Result = { data: unknown; error: unknown };

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export class FakeDb {
  tables: Record<string, Row[]> = {};
  rpcCalls: { fn: string; args: unknown }[] = [];
  rpcResult: Result = { data: 0, error: null };
  /** 설정하면 이후 모든 쿼리가 이 오류로 실패한다 */
  failWith: unknown = null;
  maxRows = 1000;
  private nextId = 1;

  seed(table: string, rows: Record<string, unknown>[]): void {
    const t = (this.tables[table] ??= []);
    for (const r of rows) {
      const id = typeof r.id === "number" ? r.id : this.nextId++;
      this.nextId = Math.max(this.nextId, id + 1);
      t.push({ ...r, id, phone_digits: digits(r.phone) });
    }
  }

  insertRow(table: string, values: Record<string, unknown>): Row {
    const row = { ...values, id: this.nextId++, phone_digits: digits(values.phone) } as Row;
    (this.tables[table] ??= []).push(row);
    return row;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(fn: string, args: unknown): Promise<Result> {
    if (this.failWith) return { data: null, error: this.failWith };
    this.rpcCalls.push({ fn, args });
    return this.rpcResult;
  }
}

class FakeQuery implements PromiseLike<Result> {
  private mode: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private filters: ((r: Row) => boolean)[] = [];
  private asc = true;
  private rangeArgs: [number, number] | null = null;
  private limitN: number | null = null;
  private singleMode: "one" | "maybe" | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(_columns?: string) { return this; }
  insert(values: Record<string, unknown>) { this.mode = "insert"; this.payload = values; return this; }
  update(values: Record<string, unknown>) { this.mode = "update"; this.payload = values; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  order(_col: string, opts?: { ascending?: boolean }) { this.asc = opts?.ascending !== false; return this; }
  range(from: number, to: number) { this.rangeArgs = [from, to]; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleMode = "one"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  then<A = Result, B = never>(
    onFulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }

  private run(): Result {
    if (this.db.failWith) return { data: null, error: this.db.failWith };

    if (this.mode === "insert") {
      const row = this.db.insertRow(this.table, this.payload);
      return { data: this.singleMode ? row : [row], error: null };
    }

    const rows = (this.db.tables[this.table] ??= []);
    let hit = rows.filter((r) => this.filters.every((f) => f(r)));
    hit.sort((a, b) => (this.asc ? a.id - b.id : b.id - a.id));

    if (this.mode === "update") {
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit.map((r) => ({ id: r.id })), error: null };
    }

    if (this.rangeArgs) {
      const [from, to] = this.rangeArgs;
      hit = hit.slice(from, Math.min(to + 1, from + this.db.maxRows));
    } else {
      hit = hit.slice(0, this.db.maxRows);
    }
    if (this.limitN !== null) hit = hit.slice(0, this.limitN);

    if (this.singleMode) return { data: hit[0] ?? null, error: null };
    return { data: hit.map((r) => ({ ...r })), error: null };
  }
}
