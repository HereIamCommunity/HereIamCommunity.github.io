import { NextRequest, NextResponse } from "next/server";
import { getBookingsByPhone } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || phone.replace(/[^0-9]/g, "").length < 10) {
      return NextResponse.json({ error: "전화번호를 올바르게 입력해주세요." }, { status: 400 });
    }

    const bookings = await getBookingsByPhone(phone);
    return NextResponse.json({ bookings });
  } catch (e) {
    console.error("[booking-check]", e);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
