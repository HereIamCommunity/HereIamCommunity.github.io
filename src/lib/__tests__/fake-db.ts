/**
 * store.ts / bulk-log.ts 테스트용 가짜 Supabase 클라이언트.
 * 실제 API처럼 한 번에 최대 maxRows(기본 1,000)행만 돌려준다 — 페이지 반복이 빠지면 테스트가 잡는다.
 * 컬럼 스키마를 `0001_init.sql`과 똑같이 두고, select/insert/update가 스키마에 없는 컬럼을
 * 쓰면 PostgREST(오류 코드 42703)처럼 오류를 던진다 — 없는 컬럼을 select/insert하는 버그가
 * (예: retreats/open_stays에 없는 "kind"를 select) 실제 DB 없이도 테스트에서 잡힌다.
 * 지원: from().select().eq().not(is null).order().range().limit().maybeSingle().single(),
 *       insert().select().single(), update().eq().select(), rpc()
 */

type Row = Record<string, unknown> & { id: number };
type Result = { data: unknown; error: unknown };
type SchemaError = { code: string; message: string };

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** `0001_init.sql`과 같은 컬럼 목록(생성 컬럼 phone_digits 포함). */
const SCHEMAS: Record<string, string[]> = {
  bookings: [
    "id", "sheet_row", "kind", "created_at", "name", "phone", "phone_digits", "program",
    "date_text", "room", "nights", "check_in", "check_out", "discount", "total_amount",
    "memo", "status", "notify_status",
  ],
  retreats: [
    "id", "sheet_row", "created_at", "name", "phone", "phone_digits", "grade", "region",
    "session", "referral", "question", "memo", "allergy", "care", "parent_note", "status",
  ],
  open_stays: [
    "id", "sheet_row", "created_at", "name", "phone", "phone_digits", "email", "check_in",
    "check_out", "group_type", "group_size", "reason", "contribution", "message", "status",
  ],
  bulk_logs: [
    "id", "sheet_row", "job_id", "at", "filter", "action", "notify", "count", "snapshot",
    "reverted_at",
  ],
};

function unknownColumnError(table: string, col: string): SchemaError {
  return { code: "42703", message: `column ${table}.${col} does not exist` };
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  rpcCalls: { fn: string; args: unknown }[] = [];
  rpcResult: Result = { data: 0, error: null };
  /** 설정하면 이후 모든 쿼리가 이 오류로 실패한다 */
  failWith: unknown = null;
  maxRows = 1000;
  private nextId = 1;

  private hasPhoneDigits(table: string): boolean {
    return SCHEMAS[table]?.includes("phone_digits") ?? false;
  }

  seed(table: string, rows: Record<string, unknown>[]): void {
    const t = (this.tables[table] ??= []);
    for (const r of rows) {
      const id = typeof r.id === "number" ? r.id : this.nextId++;
      this.nextId = Math.max(this.nextId, id + 1);
      const generated = this.hasPhoneDigits(table) ? { phone_digits: digits(r.phone) } : {};
      t.push({ ...r, id, ...generated });
    }
  }

  insertRow(table: string, values: Record<string, unknown>): Row {
    const generated = this.hasPhoneDigits(table) ? { phone_digits: digits(values.phone) } : {};
    const row = { ...values, id: this.nextId++, ...generated } as Row;
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
  private selectColumns: string[] | "*" = "*";
  private schemaError: SchemaError | null = null;

  constructor(private db: FakeDb, private table: string) {}

  private schema(): string[] {
    return SCHEMAS[this.table] ?? [];
  }

  private validateColumns(cols: string[]): void {
    if (this.schemaError) return;
    const known = this.schema();
    for (const c of cols) {
      if (!known.includes(c)) {
        this.schemaError = unknownColumnError(this.table, c);
        return;
      }
    }
  }

  select(columns?: string) {
    this.selectColumns = !columns || columns === "*" ? "*" : columns.split(",").map((c) => c.trim());
    if (this.selectColumns !== "*") this.validateColumns(this.selectColumns);
    return this;
  }
  insert(values: Record<string, unknown>) {
    this.mode = "insert";
    this.payload = values;
    this.validateColumns(Object.keys(values));
    return this;
  }
  update(values: Record<string, unknown>) {
    this.mode = "update";
    this.payload = values;
    this.validateColumns(Object.keys(values));
    return this;
  }
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

  /** select된 컬럼만 남긴다("*"면 그대로). 실제 컬럼이 없으면(스키마 오류는 이미 걸러짐) undefined. */
  private project(row: Row): Row {
    if (this.selectColumns === "*") return { ...row };
    const out: Record<string, unknown> = {};
    for (const c of this.selectColumns) out[c] = row[c];
    return out as Row;
  }

  private run(): Result {
    if (this.db.failWith) return { data: null, error: this.db.failWith };
    if (this.schemaError) return { data: null, error: this.schemaError };

    if (this.mode === "insert") {
      const row = this.db.insertRow(this.table, this.payload);
      const projected = this.project(row);
      return { data: this.singleMode ? projected : [projected], error: null };
    }

    const rows = (this.db.tables[this.table] ??= []);
    let hit = rows.filter((r) => this.filters.every((f) => f(r)));
    hit.sort((a, b) => (this.asc ? a.id - b.id : b.id - a.id));

    if (this.mode === "update") {
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit.map((r) => this.project(r)), error: null };
    }

    if (this.rangeArgs) {
      const [from, to] = this.rangeArgs;
      hit = hit.slice(from, Math.min(to + 1, from + this.db.maxRows));
    } else {
      hit = hit.slice(0, this.db.maxRows);
    }
    if (this.limitN !== null) hit = hit.slice(0, this.limitN);

    if (this.singleMode) {
      const one = hit[0];
      return { data: one ? this.project(one) : null, error: null };
    }
    return { data: hit.map((r) => this.project(r)), error: null };
  }
}
