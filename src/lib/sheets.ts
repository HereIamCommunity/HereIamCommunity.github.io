import { google } from "googleapis";
import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

export type BookingRow = {
  type: string;         // salon | stay
  createdAt: string;    // ISO timestamp
  name: string;
  phone: string;
  program?: string;     // 살롱 프로그램명
  date?: string;        // 날짜/일시
  room?: string;        // 스테이 객실명
  nights?: string;      // 박수
  checkIn?: string;
  checkOut?: string;
  discount: string;
  totalAmount: number;
  memo?: string;
  status: string;       // 신청 | 입금확인 | 취소
  notifyStatus?: string; // 게스트 SMS 발송 결과 (✅ HH:MM / ❌ 실패)
};

const BOOKING_HEADERS = [
  ["신청일시","구분","이름","연락처","프로그램","일시","객실","박수","체크인","체크아웃","할인","결제금액","요청사항","상태","알림"],
];

async function ensureBookingSheet(
  sheets: ReturnType<typeof google.sheets>,
  tabName: "살롱" | "스테이"
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:O1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: BOOKING_HEADERS },
    });
  }
}

export async function appendBooking(row: BookingRow) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn("[Sheets] 환경변수 미설정 — 구글 시트 저장 건너뜀");
    return;
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const tabName = row.type === "salon" ? "살롱" : "스테이";

  await ensureBookingSheet(sheets, tabName);

  const values = [
    [
      row.createdAt,
      tabName,
      row.name,
      row.phone,
      row.program ?? "",
      row.date ?? "",
      row.room ?? "",
      row.nights ?? "",
      row.checkIn ?? "",
      row.checkOut ?? "",
      row.discount === "geot" ? "멤버십 곁 (-20%)" : row.discount === "nagnae" ? "나그네방 후원자 (-30%)" : "없음",
      row.totalAmount,
      row.memo ?? "",
      row.status,
      row.notifyStatus ?? "",
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:O`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

type FoundBookingRow = {
  sheets: ReturnType<typeof google.sheets>;
  tabName: string;
  rowNum: number;      // 1-based 시트 행 번호
  values: string[];    // A~O 열
};

/**
 * 예약 행 탐색 공통 로직.
 * 1순위 신청일시(A) + 연락처(D) 정확 매칭, 2순위 연락처만으로 최신 행.
 */
async function findBookingRow(
  type: string,
  createdAt: string,
  phone: string
): Promise<FoundBookingRow | null> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const tabName = type === "salon" || type === "살롱" ? "살롱" : "스테이";

  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: SPREADSHEET_ID, range: `${tabName}!A:O` })
    .catch(() => ({ data: { values: [] as string[][] } }));
  const rows = (res.data.values as string[][] | null) ?? [];
  const strip = (p: string) => (p || "").replace(/\D/g, "");
  const target = strip(phone);

  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === createdAt && strip(rows[i][3]) === target) {
      return { sheets, tabName, rowNum: i + 1, values: rows[i] };
    }
  }
  for (let i = rows.length - 1; i >= 1; i--) {
    if (strip(rows[i][3]) === target) {
      return { sheets, tabName, rowNum: i + 1, values: rows[i] };
    }
  }
  return null;
}

/** 예약 행(A~O)을 그대로 반환. 현재 상태 확인용. */
export async function getBookingRow(
  type: string,
  createdAt: string,
  phone: string
): Promise<string[] | null> {
  const found = await findBookingRow(type, createdAt, phone);
  return found ? found.values : null;
}

/**
 * 알림 발송 결과를 예약 행의 '알림' 열(O)에 기록.
 */
export async function updateNotifyStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string
): Promise<boolean> {
  const found = await findBookingRow(type, createdAt, phone);
  if (!found) return false;

  await found.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${found.tabName}!O${found.rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
  return true;
}

/** 예약 행의 '상태' 열(N)을 갱신. */
export async function updateBookingStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string
): Promise<boolean> {
  const found = await findBookingRow(type, createdAt, phone);
  if (!found) return false;

  await found.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${found.tabName}!N${found.rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
  return true;
}

/**
 * 예약 행의 '요청사항' 열(M)에 한 줄 덧붙인다 (취소 사유 기록 등).
 * 기존 내용은 지우지 않고 줄바꿈으로 이어 쓴다.
 */
export async function appendBookingMemo(
  type: string,
  createdAt: string,
  phone: string,
  text: string
): Promise<boolean> {
  if (!text) return false;
  const found = await findBookingRow(type, createdAt, phone);
  if (!found) return false;

  const prev = (found.values[12] ?? "").trim();
  const next = prev ? `${prev}\n${text}` : text;

  await found.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${found.tabName}!M${found.rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[next]] },
  });
  return true;
}

/**
 * 리트릿·무료개방처럼 "신청일시 + 연락처"로 행을 찾는 탭의 공통 탐색.
 * 1순위 신청일시(A) + 연락처 정확 매칭, 2순위 연락처만으로 최신 행.
 */
async function findSimpleRow(
  range: string,
  phoneCol: number,
  createdAt: string,
  phone: string
): Promise<{ sheets: ReturnType<typeof google.sheets>; rowNum: number; values: string[] } | null> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: SPREADSHEET_ID, range })
    .catch(() => ({ data: { values: [] as string[][] } }));
  const rows = (res.data.values as string[][] | null) ?? [];
  const strip = (p: string) => (p || "").replace(/\D/g, "");
  const target = strip(phone);
  if (!target) return null;

  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === createdAt && strip(rows[i][phoneCol]) === target) {
      return { sheets, rowNum: i + 1, values: rows[i] };
    }
  }
  for (let i = rows.length - 1; i >= 1; i--) {
    if (strip(rows[i][phoneCol]) === target) {
      return { sheets, rowNum: i + 1, values: rows[i] };
    }
  }
  return null;
}

/** 리트릿 행의 '상태' 열(M)을 갱신. */
export async function updateRetreatStatus(
  createdAt: string,
  phone: string,
  status: string
): Promise<boolean> {
  const found = await findSimpleRow("리트릿!A:M", 2, createdAt, phone);
  if (!found) return false;

  await found.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `리트릿!M${found.rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
  return true;
}

/** 무료개방 행의 '상태' 열(L)을 갱신. */
export async function updateOpenStayStatus(
  createdAt: string,
  phone: string,
  status: string
): Promise<boolean> {
  const found = await findSimpleRow("무료개방!A:L", 2, createdAt, phone);
  if (!found) return false;

  await found.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `무료개방!L${found.rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
  return true;
}

/**
 * 살롱 + 스테이 탭을 합쳐서 반환 (어드민/cron용)
 * 헤더는 첫 행 한 번만 포함
 */
export async function getAllBookings(): Promise<string[][]> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return [];

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const [salonRes, stayRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "살롱!A:O" }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "스테이!A:O" }).catch(() => ({ data: { values: [] } })),
  ]);

  const salonRows = (salonRes.data.values as string[][] | null) ?? [];
  const stayRows = (stayRes.data.values as string[][] | null) ?? [];

  // 헤더는 한 번만, 각 탭의 데이터 행만 합치기
  const header = salonRows[0] ?? stayRows[0] ?? BOOKING_HEADERS[0];
  const data = [...salonRows.slice(1), ...stayRows.slice(1)];

  return data.length > 0 ? [header, ...data] : [header];
}

/* ─────────────────────────────────────────────
   리트릿 (72시간 썸머캠프)
───────────────────────────────────────────── */

export type RetreatRow = {
  createdAt: string;
  name: string;
  phone: string;
  grade: string;      // 학년/나이
  region: string;     // 거주 지역
  session: string;    // s1~s5
  referral: string;   // 추천인
  question: string;   // 궁금한 점
  memo: string;       // 요청사항
  allergy: string;    // 음식 알레르기
  care: string;       // 특별 케어 사항
  parentNote: string; // 부모님 고민·기대감
  status: string;     // 신청
};

/** "리트릿" 시트 탭이 없으면 생성하고 헤더를 추가 */
async function ensureRetreatSheet(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === "리트릿"
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "리트릿" } } }],
      },
    });
    // 헤더 추가
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "리트릿!A1:M1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["신청일시","이름","연락처","학년나이","거주지역","회차","추천인","궁금한점","요청사항","알레르기","케어사항","부모님메모","상태"]],
      },
    });
  }
}

export async function appendRetreat(row: RetreatRow) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn("[Sheets] 환경변수 미설정 — 리트릿 저장 건너뜀");
    return;
  }

  const label =
    RETREAT_SESSIONS.find((s) => s.key === row.session)?.label ?? row.session;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await ensureRetreatSheet(sheets);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "리트릿!A:M",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        row.createdAt,
        row.name,
        row.phone,
        row.grade,
        row.region,
        label,
        row.referral,
        row.question,
        row.memo,
        row.allergy,
        row.care,
        row.parentNote,
        row.status,
      ]],
    },
  });
}

/** 리트릿 전체 신청 내역 (어드민용) */
export async function getAllRetreats(): Promise<string[][]> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return [];
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "리트릿!A:M",
    });
    return (res.data.values as string[][] | null) ?? [];
  } catch {
    return [];
  }
}

/** 회차별 신청 인원 수 반환 { s1: 3, s2: 0, ... } */
export async function getRetreatCounts(): Promise<Record<string, number>> {
  const empty = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return empty;

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "리트릿!A:J",
    });

    const rows = (res.data.values as string[][] | null) ?? [];
    const SESSION_COL = 5; // F열 (0-indexed)

    const counts: Record<string, number> = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
    const LABEL_TO_ID: Record<string, string> = Object.fromEntries(
      RETREAT_SESSIONS.map((s) => [s.label, s.key])
    );

    for (const row of rows) {
      if (row[0] === "신청일시") continue; // 헤더 스킵
      const label = row[SESSION_COL];
      const id = LABEL_TO_ID[label];
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return empty;
  }
}

/* ─────────────────────────────────────────────
   무료 개방 스테이
───────────────────────────────────────────── */

export type OpenStayRow = {
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  groupType: string;  // solo | duo | family | team
  groupSize: string;
  reason: string;
  contribution: string; // 쉼표 구분 복수 선택
  message: string;
  status: string; // 신청 | 확정 | 취소
};

async function ensureOpenStaySheet(sheets: ReturnType<typeof google.sheets>) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === "무료개방");
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: "무료개방" } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "무료개방!A1:L1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["신청일시","이름","연락처","이메일","체크인","체크아웃","방문형태","인원","방문이유","기여방법","응원메시지","상태"]],
      },
    });
  }
}

export async function appendOpenStay(row: OpenStayRow) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await ensureOpenStaySheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "무료개방!A:L",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        row.createdAt, row.name, row.phone, row.email,
        row.checkIn, row.checkOut, row.groupType, row.groupSize,
        row.reason, row.contribution, row.message, row.status,
      ]],
    },
  });
}

export async function getAllOpenStays(): Promise<string[][]> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return [];
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "무료개방!A:L",
    });
    return (res.data.values as string[][] | null) ?? [];
  } catch { return []; }
}

export type BookingCheckResult = {
  type: "살롱" | "스테이";
  createdAt: string;
  name: string;
  program: string;    // 살롱: 프로그램명, 스테이: 객실명
  date: string;       // 살롱: 일시, 스테이: 체크인~체크아웃
  amount: string;
  status: string;
};

export async function getBookingsByPhone(phone: string): Promise<BookingCheckResult[]> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return [];

  const normalize = (p: string) => p.replace(/[^0-9]/g, "");
  const target = normalize(phone);

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const [salonRes, stayRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "살롱!A:O" }).catch(() => ({ data: { values: [] } })),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "스테이!A:O" }).catch(() => ({ data: { values: [] } })),
  ]);

  const results: BookingCheckResult[] = [];

  const parseRows = (rows: string[][], type: "살롱" | "스테이") => {
    for (const row of rows) {
      if (!row[0] || row[0] === "신청일시") continue;
      const rowPhone = normalize(row[3] ?? "");
      if (rowPhone !== target) continue;
      results.push({
        type,
        createdAt: row[0] ?? "",
        name: row[2] ?? "",
        program: type === "살롱" ? (row[4] ?? "") : (row[6] ?? ""),
        date: type === "살롱" ? (row[5] ?? "") : `${row[8] ?? ""} ~ ${row[9] ?? ""} (${row[7] ?? ""}박)`,
        amount: row[11] ?? "",
        status: row[13] ?? "신청",
      });
    }
  };

  parseRows((salonRes.data.values as string[][] | null) ?? [], "살롱");
  parseRows((stayRes.data.values as string[][] | null) ?? [], "스테이");

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 시트 초기 헤더 설정 (최초 1회만 실행)
 */
export async function initSheetHeaders() {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return;

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const headers = [
    ["신청일시", "구분", "이름", "연락처", "프로그램", "일시",
     "객실", "박수", "체크인", "체크아웃", "할인", "결제금액", "요청사항", "상태"],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "신청내역!A1:N1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: headers },
  });
}
