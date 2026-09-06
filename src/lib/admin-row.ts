import type { Booking, BookingEvent } from "@/lib/kakao";

/**
 * 어드민 목록의 예약 행(A~O 열)을 Booking으로 변환한다.
 * 열: 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *     8체크인 9체크아웃 10할인 11금액 12요청사항 13상태 14알림
 */
export function parseAdminRow(row: string[]): Booking {
  const discountRaw = row[10] || "";
  const discount = discountRaw.includes("곁")
    ? "geot"
    : discountRaw.includes("나그네")
    ? "nagnae"
    : "none";

  return {
    type: row[1] === "살롱" ? "salon" : "stay",
    createdAt: row[0] || "",
    name: row[2] || "",
    phone: row[3] || "",
    program: row[4] || undefined,
    date: row[5] || undefined,
    room: row[6] || undefined,
    checkIn: row[8] || undefined,
    checkOut: row[9] || undefined,
    nights: row[7] ? Number(row[7]) : undefined,
    discount,
    totalAmount: parseInt((row[11] ?? "0").replace(/[^0-9]/g, "")) || 0,
  };
}

/** 시트의 상태 문자열(N열)로 다시 보낼 이벤트를 고른다. */
export function eventForStatus(status: string): BookingEvent {
  const s = (status || "").trim();
  if (s === "취소") return "cancelled";
  if (s === "입금확인" || s === "결제완료" || s === "확정") return "confirmed";
  return "received";
}
