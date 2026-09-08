"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { buildDigest, kstToday } from "@/lib/digest";
import AdminShell from "../_components/AdminShell";
import Banner from "../_components/Banner";
import { useToasts } from "../_components/Toast";
import type { RowRef, SheetTab } from "@/lib/row-ref";
import type { ApiResult } from "../_components/useAdminApi";
import {
  registerRowRefs,
  rowKey,
  type AdminActions,
  type DateRange,
  type Row,
  type SheetKind,
} from "../_components/shared";

/* ── 샘플 데이터 ────────────────────────────────
   시트 자격증명 없이도 "데이터가 있는 화면"을 볼 수 있게 만든 미리보기 전용 페이지.
   실제 API를 호출하지 않고, 상태 변경 버튼은 안내 메시지만 띄운다. */

const BOOKING_HEADER = [
  "신청일시", "구분", "이름", "연락처", "프로그램", "일시", "객실", "박수",
  "체크인", "체크아웃", "할인", "결제금액", "요청사항", "상태", "알림",
];
const RETREAT_HEADER = [
  "신청일시", "이름", "연락처", "학년나이", "거주지역", "회차", "추천인",
  "궁금한점", "요청사항", "알레르기", "케어사항", "부모님메모", "상태",
];
const OPEN_HEADER = [
  "신청일시", "이름", "연락처", "이메일", "체크인", "체크아웃", "방문형태",
  "인원", "방문이유", "기여방법", "응원메시지", "상태",
];

/** offsetDays일 전 날짜의 신청일시 문자열 ("2026. 9. 6. 오후 7:10:32") */
function createdAt(offsetDays: number, hour = 14): string {
  const [y, m, d] = kstToday(-offsetDays).split("-").map(Number);
  const ampm = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${y}. ${m}. ${d}. ${ampm} ${h12}:10:32`;
}

/** 오늘 기준 offset일 뒤 "YYYY-MM-DD" */
const day = (offset: number) => kstToday(offset);

/** 시트 F열(살롱 일시)에 들어가는 라벨 형식 */
function salonLabel(offset: number, time: string): string {
  const [y, m, d] = day(offset).split("-").map(Number);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dow}) ${time}`;
}

function sampleBookings(): Row[] {
  const t = kstToday();
  const nowStamp = `${t.slice(5, 7)}/${t.slice(8, 10)} 14:32`;
  return [
    BOOKING_HEADER,
    // 입금대기 3건
    [createdAt(2, 19), "살롱", "김민지", "010-1234-5678", "프라이데이 나잇 · 와인과 대화", salonLabel(0, "19:00"), "", "", "", "", "없음", "30000", "채식 식사 부탁드려요", "신청", `✅ ${nowStamp} 접수`],
    [createdAt(1, 10), "스테이", "박준호", "010-2345-6789", "", "", "나그네방", "2", day(3), day(5), "나그네방 후원자", "120000", "", "신청", `❌ ${nowStamp} 접수 실패 (수신거부)`],
    [createdAt(0, 9), "스테이", "이서연", "010-3456-7890", "", "", "옥순방", "2", day(0), day(2), "없음", "160000", "늦은 체크인(21시) 가능할까요? 아이 둘과 함께 갑니다.", "", `⏭ ${nowStamp} 접수 건너뜀`],
    // 확정 3건 (결제완료 1건 포함)
    [createdAt(5, 11), "스테이", "정하늘", "010-4567-8901", "", "", "옥순방", "2", day(0), day(2), "멤버십 '곁'", "144000", "", "입금확인", `✅ ${nowStamp} 확정`],
    [createdAt(6, 16), "스테이", "최유진", "010-5678-9012", "", "", "여태방", "2", day(-2), day(0), "없음", "150000", "체크아웃 30분만 늦출 수 있을까요", "입금확인", ""],
    [createdAt(1, 21), "살롱", "한도윤", "010-6789-0123", "토요 브런치 살롱", salonLabel(0, "11:00"), "", "", "", "", "없음", "25000", "", "결제완료", `✅ ${nowStamp} 확정`],
    // 취소 2건
    [createdAt(3, 13), "살롱", "오세라", "010-7890-1234", "목요 북클럽", salonLabel(4, "20:00"), "", "", "", "", "없음", "20000", "[취소사유] 게스트 요청", "취소", `❌ ${nowStamp} 취소 실패 (번호 오류)`],
    [createdAt(4, 8), "스테이", "강태현", "010-8901-2345", "", "", "나그네방", "1", day(7), day(8), "없음", "60000", "", "취소", `✅ ${nowStamp} 취소`],
    // 시트에 손으로 넣은 스테이 — 신청일시·연락처가 비어 있다 (6.1이 고친 그 행들).
    // 신청일 칸은 "—", 목록 정렬은 맨 아래, 알림은 재발송 버튼이 붙는 "미발송"이 된다.
    ["", "스테이", "김성연", "", "", "", "여태방", "2", day(6), day(8), "없음", "150000", "전화로 받은 예약", "", ""],
    ["", "스테이", "장미옥", "", "", "", "나그네방", "1", day(9), day(10), "없음", "60000", "", "", ""],
    // 통계 탭이 월별·연도별 비교를 보여줄 수 있게 지난 달·작년 행도 넣어 둔다
    [createdAt(34, 19), "살롱", "서지호", "010-9012-3456", "프라이데이 나잇 · 와인과 대화", salonLabel(-32, "19:00"), "", "", "", "", "없음", "30000", "", "입금확인", `✅ 접수`],
    [createdAt(38, 15), "살롱", "노유진", "010-0123-4567", "토요 브런치 살롱", salonLabel(-36, "11:00"), "", "", "", "", "멤버십 '곁'", "22500", "", "결제완료", `✅ 확정`],
    [createdAt(41, 10), "스테이", "문하람", "010-1234-0987", "", "", "옥순방", "3", day(-38), day(-35), "없음", "240000", "", "입금확인", `✅ 확정`],
    [createdAt(47, 13), "스테이", "구예린", "010-2345-1098", "", "", "여태방", "1", day(-44), day(-43), "없음", "75000", "", "취소", `✅ 취소`],
    [createdAt(380, 14), "살롱", "심우재", "010-3456-2109", "목요 북클럽", salonLabel(-378, "20:00"), "", "", "", "", "없음", "20000", "", "입금확인", `✅ 확정`],
    [createdAt(395, 11), "스테이", "표선아", "010-4567-3210", "", "", "나그네방", "2", day(-392), day(-390), "나그네방 후원자", "96000", "", "입금확인", `✅ 확정`],
  ];
}

function sampleRetreats(): Row[] {
  return [
    RETREAT_HEADER,
    [createdAt(9, 20), "윤서아", "010-1111-2222", "중2", "서울 마포", "1회차 7/3-5", "지인 소개", "친구랑 같이 방 쓸 수 있나요?", "매운 음식 못 먹어요", "견과류", "밤에 무서움을 많이 타요", "첫 캠프라 걱정이 많습니다. 잘 부탁드려요.", "입금확인"],
    [createdAt(7, 15), "장민서", "010-2222-3333", "초6", "경기 성남", "1회차 7/3-5", "인스타그램", "", "", "없음", "", "", "신청"],
    [createdAt(6, 12), "임재훈", "010-3333-4444", "고1", "대구 수성", "2회차 7/24-26", "", "축구 할 수 있나요", "", "없음", "", "", "신청"],
    [createdAt(5, 18), "백서연", "010-4444-5555", "중1", "부산 해운대", "4회차 8/15-17", "학교 친구", "", "", "우유", "", "", "취소"],
  ];
}

function sampleOpenStays(): Row[] {
  return [
    OPEN_HEADER,
    [createdAt(4, 14), "공동체 나눔팀", "010-5555-6666", "share@example.com", day(10), day(12), "단체", "6", "지역 청년 모임 워크숍을 열고 싶어요.", "정원 정리와 청소를 돕겠습니다.", "이런 공간이 있어서 정말 반가워요!", "확정"],
    [createdAt(2, 9), "홍지우", "010-6666-7777", "jiwoo@example.com", day(14), day(15), "개인", "1", "번아웃이 와서 조용히 쉬고 싶습니다.", "글쓰기 워크숍 진행이 가능해요.", "", "신청"],
    [createdAt(8, 17), "이든 가족", "010-7777-8888", "eden@example.com", day(-3), day(-1), "가족", "4", "아이들과 시골 경험을 하고 싶었어요.", "", "따뜻한 공간 감사합니다.", "취소"],
  ];
}

/** 옥순방은 오늘~모레 웹사이트 예약과 겹치게 둬서 이중예약 배너를 볼 수 있게 한다 */
function sampleAirbnb(): Record<string, DateRange[]> {
  return {
    nagnae: [{ start: day(12), end: day(14) }],
    oksun: [{ start: day(1), end: day(3) }],
    yeutae: [],
  };
}

const SAMPLE_ENV = {
  ok: true,
  missingRequired: [] as string[],
  missingKakao: ["KAKAO_TEMPLATE_STAY_CHECKOUT"],
  kakaoMode: "게스트 알림톡 발송 안 함 (템플릿 env 미설정) · 호스트에는 문자 발송",
  operatorPhoneMasked: "010-****-1234",
};

/** 실제 API의 meta(6.1)를 흉내 낸다 — rows와 길이·순서가 같고 meta[0]은 헤더 행 */
function sampleMeta(rawRows: Row[], tabOf: (row: Row) => SheetTab): RowRef[] {
  return rawRows.map((row, i) => ({ tab: tabOf(row), rowNum: i + 1 }));
}

export default function AdminPreviewPage() {
  const toasts = useToasts();
  const { push } = toasts;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const turn = useRef(0);

  const rawRows = useMemo(() => sampleBookings(), []);
  const rawRetreats = useMemo(() => sampleRetreats(), []);
  const rawOpenStays = useMemo(() => sampleOpenStays(), []);
  const airbnbRanges = useMemo(() => sampleAirbnb(), []);
  const digest = useMemo(() => buildDigest(rawRows, rawRetreats), [rawRows, rawRetreats]);

  // 화면 전체가 시트 행 번호로 행을 찍는지(6.1) 미리보기에서도 그대로 확인할 수 있게 등록해 둔다
  useMemo(() => {
    registerRowRefs(rawRows, sampleMeta(rawRows, (r) => (r[1] === "스테이" ? "스테이" : "살롱")));
    registerRowRefs(rawRetreats, sampleMeta(rawRetreats, () => "리트릿"));
    registerRowRefs(rawOpenStays, sampleMeta(rawOpenStays, () => "무료개방"));
  }, [rawRows, rawRetreats, rawOpenStays]);

  /** 미리보기 처리 — 스피너를 잠깐 보여주고 성공·실패 토스트를 번갈아 띄운다 */
  const pretend = useCallback(
    (key: string, name: string, label: string, retry: () => void) => {
      setBusyKey(key);
      setTimeout(() => {
        setBusyKey(null);
        const ok = turn.current++ % 2 === 0;
        if (ok) {
          push({ kind: "ok", text: `${name} · ${label} 완료 · 게스트 알림톡 발송됨 (미리보기)` });
          return;
        }
        push({ kind: "error", text: `${label} 실패 — 예약 정보가 없습니다 (미리보기)`, onRetry: retry });
        setErrorKey(key);
        setTimeout(() => setErrorKey(null), 2000);
      }, 500);
    },
    [push]
  );

  const actions: AdminActions = {
    busyKey,
    errorKey,
    changeStatus: (sheet: SheetKind, row: Row, action) => {
      const key = rowKey(sheet, row);
      const label = action === "confirm" ? "입금확인" : action === "cancel" ? "취소" : "되돌리기";
      pretend(key, (sheet === "booking" ? row[2] : row[1]) || "이름 없음", label, () =>
        actions.changeStatus(sheet, row, action)
      );
    },
    resend: (row: Row) => {
      const key = rowKey("booking", row);
      pretend(key, row[2] || "이름 없음", "재발송", () => actions.resend(row));
    },
  };

  // SettingsTab이 이 함수를 useEffect 의존성으로 쓴다 — 매 렌더 새로 만들면 무한 루프
  const apiFetch = useCallback(async (path: string, init?: RequestInit): Promise<ApiResult> => {
    if (path.startsWith("/api/admin/notify-test") && (!init || init.method !== "POST")) {
      return { ok: true, status: 200, data: SAMPLE_ENV };
    }
    return { ok: false, status: 200, data: { error: "미리보기 화면이라 실제로 발송하지 않아요." } };
  }, []);

  return (
    <AdminShell
      digest={digest}
      rawRows={rawRows}
      rows={rawRows.slice(1)}
      retreats={rawRetreats.slice(1)}
      openStays={rawOpenStays.slice(1)}
      airbnbRanges={airbnbRanges}
      actions={actions}
      apiFetch={apiFetch}
      loading={false}
      error=""
      onRefresh={() => {}}
      onLogout={() => {}}
      toasts={toasts}
      topSlot={
        <div className="mb-4">
          <Banner
            tone="info"
            title="샘플 데이터 미리보기"
            detail="실제 예약이 아니라 화면 확인용 가짜 데이터예요. 버튼을 눌러도 시트에 저장되지 않습니다. 실제 어드민은 /admin 입니다."
          />
        </div>
      }
    />
  );
}
