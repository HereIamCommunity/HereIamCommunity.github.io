import { NextRequest, NextResponse } from "next/server";
import { getAllBookings, getAllRetreats, getAllOpenStays } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows, retreats, openStays] = await Promise.all([
    getAllBookings(), getAllRetreats(), getAllOpenStays(),
  ]);
  return NextResponse.json({ rows, retreats, openStays });
}
