/**
 * 코이노니아 · 매일 아침 리포트 (Google Apps Script 버전)
 * ───────────────────────────────────────────────────────────
 * 예약 시트에 붙어서 매일 아침 8시(한국시간)에 운영자에게
 * "오늘의 코이노니아" 요약 메일을 자동 발송합니다.
 *
 *   • 오늘 체크인 / 체크아웃 (스테이)
 *   • 오늘 살롱 방문자 수
 *   • 어제 신규 신청 — 스테이 / 살롱 / 투어로 분리
 * ─────────────────────────────────────────────────────────── */

// ▼▼▼ 필요하면 여기만 바꾸세요 ▼▼▼
var RECIPIENT = "hereiam.community@gmail.com"; // 리포트 받을 이메일 (쉼표로 여러 명 가능)
var SEND_HOUR = 8;                              // 발송 시각 (한국시간, 0~23)
var ADMIN_URL = "https://koinonia-web.vercel.app/admin";
// ▲▲▲ 여기까지 ▲▲▲

var TZ = "Asia/Seoul";
var BOOKING_TABS = ["신청내역", "살롱", "스테이"]; // 살롱+스테이 예약이 담긴 탭들 (통합해서 읽음)

// 예약 탭 열 위치 (0-index): A신청일시 B구분 C이름 D연락처 E프로그램 F일시 G객실 H박수 I체크인 J체크아웃 K할인 L금액 M메모 N상태
var C = { created:0, type:1, name:2, phone:3, program:4, date:5, room:6, nights:7, checkIn:8, checkOut:9, discount:10, amount:11, memo:12, status:13 };

/* ─────────────────────────────────────────────
   시트 열기 → 상단 커스텀 메뉴 자동 생성
───────────────────────────────────────────── */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📬 코이노니아 알림")
    .addItem("① 지금 테스트 메일 보내기", "sendMorningDigest")
    .addItem("② 매일 아침 8시 자동발송 켜기", "setupDailyTrigger")
    .addItem("자동발송 끄기", "removeTriggers")
    .addToUi();
}

/* ─────────────────────────────────────────────
   메인 — 리포트 생성 & 발송
───────────────────────────────────────────── */
function sendMorningDigest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var now      = new Date();
  var todayYMD = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
  var yestYMD  = Utilities.formatDate(new Date(now.getTime() - 86400000), TZ, "yyyy-MM-dd");
  var dow      = Number(Utilities.formatDate(now, TZ, "u")) % 7; // u:1=월…7=일 → %7: 일=0

  // 살롱+스테이 통합 (여러 탭 합쳐 중복 제거)
  var bookings = [];
  BOOKING_TABS.forEach(function (t) { bookings = bookings.concat(rows_(ss, t)); });
  bookings = dedup_(bookings);

  var live   = function (v) { return String(v || "").indexOf("취소") === -1; };
  var isStay  = function (r) { return String(r[C.type] || "").indexOf("스테이") !== -1; };
  var isSalon = function (r) { return String(r[C.type] || "").indexOf("살롱")  !== -1; };

  // ── 오늘 체크인 / 체크아웃 (스테이)
  var checkIns  = bookings.filter(function (r) { return isStay(r) && ymd_(r[C.checkIn])  === todayYMD && live(r[C.status]); });
  var checkOuts = bookings.filter(function (r) { return isStay(r) && ymd_(r[C.checkOut]) === todayYMD && live(r[C.status]); });

  // ── 오늘 살롱 방문 (살롱 일시 = 오늘)
  var salonToday = bookings.filter(function (r) { return isSalon(r) && ymd_(r[C.date]) === todayYMD && live(r[C.status]); });

  // ── 어제 신규 신청 (신청일시 = 어제) — 스테이 / 살롱 / 투어
  var newStay  = bookings.filter(function (r) { return isStay(r)  && ymd_(r[C.created]) === yestYMD && live(r[C.status]); });
  var newSalon = bookings.filter(function (r) { return isSalon(r) && ymd_(r[C.created]) === yestYMD && live(r[C.status]); });
  // 투어 신규 신청: 별도 데이터 소스 연결 예정 — 현재는 빈 배열("없음"으로 표시됨)
  var newTour  = [];

  var html = buildHtml_({
    todayLabel: todayYMD + " (" + "일월화수목금토".charAt(dow) + ")",
    checkIns:   checkIns,
    checkOuts:  checkOuts,
    salonToday: salonToday,
    newStay:    newStay,
    newSalon:   newSalon,
    newTour:    newTour
  });

  MailApp.sendEmail({
    to: RECIPIENT,
    subject: "[코이노니아] " + todayYMD + " 오늘의 리포트",
    htmlBody: html
  });

  return "발송 완료 → " + RECIPIENT;
}

/* ─────────────────────────────────────────────
   자동발송 트리거 설치 / 제거
───────────────────────────────────────────── */
function setupDailyTrigger() {
  removeTriggers(); // 중복 방지
  ScriptApp.newTrigger("sendMorningDigest")
    .timeBased().atHour(SEND_HOUR).everyDays(1).inTimezone(TZ)
    .create();
  try { SpreadsheetApp.getUi().alert("✅ 매일 아침 " + SEND_HOUR + "시 자동발송이 설정되었습니다."); } catch (e) {}
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendMorningDigest") ScriptApp.deleteTrigger(t);
  });
}

/* ─────────────────────────────────────────────
   헬퍼
───────────────────────────────────────────── */

// 시트 → 헤더 제외한 데이터 행 배열
function rows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

// 여러 탭에서 온 예약행 중복 제거 (구분+이름+전화+일시+체크인 기준)
function dedup_(rows) {
  var seen = {}, out = [];
  rows.forEach(function (r) {
    var key = [
      String(r[C.type] || ""),
      String(r[C.name] || ""),
      String(r[C.phone] || "").replace(/\D/g, ""),
      ymd_(r[C.date]),
      ymd_(r[C.checkIn])
    ].join("|");
    if (seen[key]) return;
    seen[key] = true;
    out.push(r);
  });
  return out;
}

function p2_(n) { return ("0" + n).slice(-2); }

// 셀 값(Date 객체 / ISO / 한국식 / "M월 D일") → "YYYY-MM-DD"
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  if (v === null || v === undefined) return "";
  var s = String(v).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);            // 2026-07-09
  var m = s.match(/(\d{4})[.\/\s]+(\d{1,2})[.\/\s]+(\d{1,2})/);       // 2026. 7. 9 · 2026/7/9
  if (m) return m[1] + "-" + p2_(m[2]) + "-" + p2_(m[3]);
  var k = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);                 // 7월 24일 (연도 없음 → 올해)
  if (k) return Utilities.formatDate(new Date(), TZ, "yyyy") + "-" + p2_(k[1]) + "-" + p2_(k[2]);
  return "";
}

function esc_(v) {
  return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ─────────────────────────────────────────────
   HTML 이메일 빌더
───────────────────────────────────────────── */
function buildHtml_(d) {
  var noItem = '<p style="font-size:13px;color:#9ca3af;margin:0;padding:8px 0">없음</p>';

  function badge(status) {
    var ok = String(status || "").indexOf("입금확인") !== -1;
    var bg = ok ? "#dcfce7" : "#fef9c3", fg = ok ? "#166534" : "#854d0e";
    return '<span style="background:' + bg + ';color:' + fg +
           ';padding:2px 8px;border-radius:99px;font-size:12px">' + esc_(status || "신청") + '</span>';
  }
  function stayRow(r) {
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#372a14">' + esc_(r[C.name]) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280">' + esc_(r[C.room]) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280">' + ymd_(r[C.checkIn]) + ' → ' + ymd_(r[C.checkOut]) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">' + badge(r[C.status]) + '</td></tr>';
  }
  function salonRow(r) {
    return '<tr>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#372a14">' + esc_(r[C.name]) + '</td>' +
      '<td colspan="2" style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280">' + esc_(r[C.program]) + '</td>' +
      '<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">' + badge(r[C.status]) + '</td></tr>';
  }
  function table(rowsHtml) {
    if (!rowsHtml.length) return noItem;
    return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + rowsHtml.join("") + '</table>';
  }
  function section(title, color, content) {
    return '<div style="margin-bottom:24px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
      '<div style="width:10px;height:10px;border-radius:50%;background:' + color + '"></div>' +
      '<p style="margin:0;font-size:13px;font-weight:600;color:#372a14">' + title + '</p></div>' +
      content + '</div>';
  }
  function subGroup(label, inner) {
    return '<p style="margin:12px 0 4px;font-size:12px;font-weight:600;color:#372a14">' + label + '</p>' + inner;
  }

  // ── 어제 신규 신청: 스테이 / 살롱 / 투어 분리 ──
  var newCount = d.newStay.length + d.newSalon.length + d.newTour.length;
  var newContent =
    subGroup("🏠 스테이 (" + d.newStay.length + ")", table(d.newStay.map(stayRow))) +
    subGroup("🎨 살롱 ("  + d.newSalon.length + ")", table(d.newSalon.map(salonRow))) +
    subGroup("🚌 투어 ("  + d.newTour.length  + ")", d.newTour.length ? table(d.newTour.map(salonRow)) : noItem);

  return '' +
    '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
      '<div style="background:#372a14;color:white;padding:20px 24px;border-radius:12px 12px 0 0">' +
        '<p style="margin:0;font-size:11px;opacity:.5;letter-spacing:.15em">KOINONIA · 일일 리포트</p>' +
        '<h2 style="margin:8px 0 0;font-weight:300;font-size:20px">오늘의 코이노니아</h2>' +
        '<p style="margin:4px 0 0;opacity:.6;font-size:13px">' + d.todayLabel + '</p>' +
      '</div>' +
      '<div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">' +
        section("오늘 체크인 (" + d.checkIns.length + "명)",   "#296973", table(d.checkIns.map(stayRow))) +
        section("오늘 체크아웃 (" + d.checkOuts.length + "명)", "#6b7280", table(d.checkOuts.map(stayRow))) +
        section("오늘 살롱 방문 (" + d.salonToday.length + "명)", "#ff6b35", table(d.salonToday.map(salonRow))) +
        section("어제 신규 신청 (" + newCount + "건)", "#f59e0b", newContent) +
        '<p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;margin:0">' +
          '코이노니아 어드민에서 자세한 내용을 확인하세요 → ' +
          '<a href="' + ADMIN_URL + '" style="color:#ff6b35">어드민 바로가기</a></p>' +
      '</div>' +
    '</div>';
}
