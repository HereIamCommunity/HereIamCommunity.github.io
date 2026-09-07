"use client";

import { useState } from "react";
import type { Bucket, Comparison, Stats } from "@/lib/stats";
import FilterGroup from "./FilterChips";
import {
  CARD,
  CARD_EMPTY,
  CARD_FLUSH,
  CARD_GRID,
  CARD_STACK,
  SECTION_H,
  STAT_LABEL,
  STAT_VALUE,
  TD_CELL,
  TH_CELL,
} from "./shared";

/* ────────────────────────────────────────────────────────────
   색 (dataviz 스킬 · 카테고리 색은 고정 순서, 순환 금지)
   살롱 = --color-orange · 스테이 = --color-teal (globals.css @theme 토큰).
   scripts/validate_palette.js --mode light 결과:
     PASS 명도 밴드 · PASS CVD 분리(protan ΔE 16.8 / tritan 35.4) · PASS 정상시야 ΔE 33.9
     FAIL 채도 하한(teal 0.066) — 브랜드 토큰이 하드 제약이고 teal 계열 3단계(teal,
       teal-light 0.079, teal-dark 0.054) 중 통과하는 값이 없다.
       완화: 시리즈가 2개뿐이고 분리도가 목표치(8)의 2~4배라 서로 헷갈릴 여지가 없고,
       회색 시리즈가 따로 없어 "회색으로 읽힐" 대상 자체가 없다. 그 위에 범례 +
       세그먼트 2px 간격 + 같은 데이터 표를 2차 인코딩으로 함께 둔다.
     WARN 배경 대비(orange 2.76:1) — 스킬이 지정한 구제책인 "표 뷰"를 갖췄다.
   ──────────────────────────────────────────────────────────── */
const SERIES = [
  { key: "salon", label: "살롱", fill: "bg-orange" },
  { key: "stay", label: "스테이", fill: "bg-teal" },
] as const;

const PERIODS = ["일별", "월별", "연도별"] as const;
const METRICS = ["건수", "금액"] as const;
const SCOPES = ["전체", "살롱", "스테이"] as const;

type Period = (typeof PERIODS)[number];
type Metric = (typeof METRICS)[number];
type Scope = (typeof SCOPES)[number];

const PLOT_H = 160;
/** x축 라벨 줄 높이 — 기준선 위치 계산에도 같이 쓴다 */
const X_LABEL_H = 22;

/** 축·직접 라벨용 짧은 표기. 금액은 만원 단위로 접는다. */
function short(n: number, metric: Metric): string {
  if (metric === "건수") return `${n.toLocaleString()}건`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

function full(n: number, metric: Metric): string {
  return metric === "건수" ? `${n.toLocaleString()}건` : `${n.toLocaleString()}원`;
}

function salonOf(b: Bucket, metric: Metric): number {
  return metric === "건수" ? b.salonCount : b.salonAmount;
}
function stayOf(b: Bucket, metric: Metric): number {
  return metric === "건수" ? b.stayCount : b.stayAmount;
}

/* ── 비교 카드 ───────────────────────────────────────────── */

function CompareCard({ c }: { c: Comparison }) {
  const up = c.diff > 0;
  const flat = c.diff === 0;
  // 색만으로 전달하지 않는다 — 부호·화살표 글리프·스크린리더용 낱말을 함께 쓴다.
  const tone = flat ? "text-gray-700" : up ? "text-teal-dark" : "text-brown";
  const arrow = flat ? "—" : up ? "▲" : "▼";
  const word = flat ? "변동 없음" : up ? "증가" : "감소";
  const sign = up ? "+" : "";
  const unit = c.unit;

  return (
    <div className={`${CARD} ${CARD_STACK} min-w-0`}>
      <p className={`${STAT_LABEL} mb-2`}>{c.label}</p>
      <div className="mt-auto">
        <p className={`${STAT_VALUE} text-brown`}>
          {c.current.toLocaleString()}
          {unit}
        </p>
        <p className={`mt-1 whitespace-nowrap text-xs tabular-nums ${tone}`}>
          <span aria-hidden="true">{arrow} </span>
          {sign}
          {c.diff.toLocaleString()}
          {unit}
          {c.pct !== null && ` (${sign}${c.pct}%)`}
          <span className="sr-only"> {word}</span>
        </p>
        <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-gray-500">
          이전 {c.previous.toLocaleString()}
          {unit}
        </p>
      </div>
    </div>
  );
}

/* ── 쌓은 막대 ───────────────────────────────────────────── */

function BarChart({
  buckets,
  metric,
  scope,
  period,
}: {
  buckets: Bucket[];
  metric: Metric;
  scope: Scope;
  period: Period;
}) {
  const showSalon = scope !== "스테이";
  const showStay = scope !== "살롱";
  const totalOf = (b: Bucket) => (showSalon ? salonOf(b, metric) : 0) + (showStay ? stayOf(b, metric) : 0);
  const max = Math.max(...buckets.map(totalOf), 1);
  const maxIdx = buckets.reduce((best, b, i) => (totalOf(b) > totalOf(buckets[best]) ? i : best), 0);
  // 일별 30개는 라벨이 겹치므로 격일만 남긴다 (막대는 전부 그린다)
  const labelEvery = period === "일별" ? 2 : 1;
  // 라벨이 서로 겹치지 않을 만큼 칸 최소 폭을 잡는다.
  // 일별 "9/7"(약 20px)은 격일이라 16px면 충분하고, 월별 "2025년 10월"·연도별 "2026년"은 64px 필요.
  // 좁은 화면에서는 이 최소 폭 때문에 그래프 컨테이너 안에서만 가로로 밀린다.
  const minCol = period === "일별" ? 16 : 64;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
        {SERIES.filter((s) => (s.key === "salon" ? showSalon : showStay)).map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[2px] ${s.fill}`} />
            {s.label}
          </li>
        ))}
        <li className="whitespace-nowrap text-gray-600">최대 {short(max, metric)}</li>
      </ul>

      {/* pt-10: 툴팁이 스크롤 컨테이너 위쪽에서 잘리지 않게 확보한 여백 */}
      <div className="overflow-x-auto pt-10">
        <div className="relative flex min-w-full items-end gap-1">
          {/* 눈에 띄지 않는 기준선 (0 / 50 / 100%) — 막대 바닥선에 맞춘다 */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ bottom: X_LABEL_H }}>
            <div className="border-t border-gray-200" style={{ marginBottom: PLOT_H / 2 }} />
            <div className="border-t border-gray-100" style={{ marginBottom: PLOT_H / 2 }} />
            <div className="border-t border-gray-300" />
          </div>

          {buckets.map((b, i) => {
            const salon = showSalon ? salonOf(b, metric) : 0;
            const stay = showStay ? stayOf(b, metric) : 0;
            const total = salon + stay;
            const hSalon = total === 0 ? 0 : Math.max(2, Math.round((salon / max) * PLOT_H));
            const hStay = total === 0 ? 0 : Math.max(2, Math.round((stay / max) * PLOT_H));
            const label = [
              b.label,
              showSalon ? `살롱 ${full(salon, metric)}` : "",
              showStay ? `스테이 ${full(stay, metric)}` : "",
              `합계 ${full(total, metric)}`,
            ]
              .filter(Boolean)
              .join(" · ");
            // 직접 라벨은 선택적으로만 — 최대값과 마지막 구간에만 붙인다
            const showValue = i === maxIdx || i === buckets.length - 1;

            return (
              <div
                key={b.key}
                className="group relative flex flex-1 flex-col items-center"
                style={{ minWidth: minCol }}
              >
                <span className="mb-1 h-4 whitespace-nowrap text-[10px] leading-4 text-gray-700 tabular-nums">
                  {showValue && total > 0 ? short(total, metric) : ""}
                </span>

                <div
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  className="flex w-full flex-col justify-end gap-[2px] rounded-[4px]"
                  style={{ height: PLOT_H }}
                >
                  {stay > 0 && (
                    <div
                      className={`w-full rounded-t-[4px] ${SERIES[1].fill}`}
                      style={{ height: hStay }}
                    />
                  )}
                  {salon > 0 && (
                    <div
                      className={`w-full ${SERIES[0].fill} ${stay > 0 ? "" : "rounded-t-[4px]"}`}
                      style={{ height: hSalon }}
                    />
                  )}
                  {total === 0 && <div aria-hidden="true" className="h-[2px] w-full bg-gray-200" />}
                </div>

                <span
                  className="w-full whitespace-nowrap text-center text-[10px] text-gray-600 tabular-nums"
                  style={{ height: X_LABEL_H, lineHeight: `${X_LABEL_H}px` }}
                >
                  {i % labelEvery === 0 ? b.label : ""}
                </span>

                {/* 호버·포커스 툴팁 */}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] leading-4 whitespace-nowrap text-brown shadow-sm group-hover:block group-focus-within:block"
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 같은 데이터 표 (dataviz: 대비 WARN·채도 FAIL의 구제책) ── */

function BucketTable({ buckets, metric, scope }: { buckets: Bucket[]; metric: Metric; scope: Scope }) {
  const showSalon = scope !== "스테이";
  const showStay = scope !== "살롱";
  return (
    <div className={`${CARD_FLUSH} max-h-96 overflow-auto`}>
      <table className="w-full text-sm">
        <caption className="sr-only">그래프와 같은 데이터의 표</caption>
        <thead className="sticky top-0 bg-cream/90">
          <tr className="border-b border-gray-200">
            <th scope="col" className={`${TH_CELL} text-left`}>
              기간
            </th>
            {showSalon && (
              <th scope="col" className={`${TH_CELL} text-right`}>
                살롱
              </th>
            )}
            {showStay && (
              <th scope="col" className={`${TH_CELL} text-right`}>
                스테이
              </th>
            )}
            <th scope="col" className={`${TH_CELL} text-right`}>
              합계
            </th>
            <th scope="col" className={`${TH_CELL} text-right`}>
              신청
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const salon = showSalon ? salonOf(b, metric) : 0;
            const stay = showStay ? stayOf(b, metric) : 0;
            return (
              <tr key={b.key} className="border-b border-gray-100 last:border-0">
                <th scope="row" className={`${TD_CELL} text-left font-normal text-brown`}>
                  {b.label}
                </th>
                {showSalon && (
                  <td className={`${TD_CELL} text-right tabular-nums text-gray-700`}>
                    {salon.toLocaleString()}
                  </td>
                )}
                {showStay && (
                  <td className={`${TD_CELL} text-right tabular-nums text-gray-700`}>
                    {stay.toLocaleString()}
                  </td>
                )}
                <td className={`${TD_CELL} text-right font-medium tabular-nums text-brown`}>
                  {(salon + stay).toLocaleString()}
                </td>
                <td className={`${TD_CELL} text-right tabular-nums text-gray-500`}>
                  {b.requested.toLocaleString()}건
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 하단 분석: 가로 막대 (크기 비교) ───────────────────── */

function RankRow({ name, value, note, max, fill }: { name: string; value: string; note?: string; max: number; fill: string }) {
  const raw = Number(String(value).replace(/[^0-9]/g, "")) || 0;
  return (
    <li className="py-1.5">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 break-keep text-sm text-brown">{name}</span>
        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-brown">{value}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 rounded-[2px] bg-gray-100">
          <div
            className={`h-1.5 rounded-[2px] ${fill}`}
            style={{ width: `${max > 0 ? Math.max(2, (raw / max) * 100) : 0}%` }}
          />
        </div>
        {note && <span className="whitespace-nowrap text-xs text-gray-600 tabular-nums">{note}</span>}
      </div>
    </li>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} ${CARD_STACK}`}>
      <h3 className={`${SECTION_H} mb-2`}>{title}</h3>
      <div className="mt-auto">{children}</div>
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs break-keep text-gray-700">{text}</p>;
}

/* ── 탭 본체 ─────────────────────────────────────────────── */

export default function StatsTab({ stats, loading }: { stats: Stats; loading: boolean }) {
  const [period, setPeriod] = useState<Period>("월별");
  const [metric, setMetric] = useState<Metric>("건수");
  const [scope, setScope] = useState<Scope>("전체");

  const buckets = period === "일별" ? stats.daily : period === "월별" ? stats.monthly : stats.yearly;
  const compare =
    metric === "건수"
      ? [stats.compare.monthCount, stats.compare.yearCount, stats.compare.yoyMonthCount]
      : [stats.compare.monthAmount, stats.compare.yearAmount, stats.compare.yoyMonthAmount];

  const hasData =
    buckets.some((b) => b.salonCount + b.stayCount > 0) ||
    stats.byProgram.length > 0 ||
    stats.byRoom.length > 0;

  const basisText = `확정 = ${stats.basis.confirmedStatuses.join("·")}, ${stats.basis.excludes.join("·")} 제외. 신청 건수는 별도 표기.`;

  const maxProgram = Math.max(...stats.byProgram.map((p) => p.count), 1);
  const maxRoom = Math.max(...stats.byRoom.map((r) => r.nights), 1);
  const discountTotal = stats.discount.none + stats.discount.geot + stats.discount.nagnae;

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className={`${CARD_FLUSH} h-28 animate-pulse`} />
        <div className={`${CARD_FLUSH} h-64 animate-pulse`} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={CARD_EMPTY}>
        <p className="text-sm font-medium text-brown">아직 집계할 데이터가 없어요</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 break-keep text-gray-700">{basisText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <FilterGroup legend="기간" options={PERIODS} value={period} onChange={(v) => setPeriod(v as Period)} />
        <FilterGroup legend="지표" options={METRICS} value={metric} onChange={(v) => setMetric(v as Metric)} />
        <FilterGroup legend="구분" options={SCOPES} value={scope} onChange={(v) => setScope(v as Scope)} />
      </div>

      <section aria-labelledby="stats-compare-h" className="space-y-2">
        <h2 id="stats-compare-h" className={SECTION_H}>
          비교
        </h2>
        <div className={`${CARD_GRID} grid-cols-1 sm:grid-cols-3`}>
          {compare.map((c) => (
            <CompareCard key={c.label} c={c} />
          ))}
        </div>
      </section>

      <section aria-labelledby="stats-chart-h" className="space-y-2">
        <h2 id="stats-chart-h" className={SECTION_H}>
          {period} 추이 · {metric}
        </h2>
        <div className={CARD}>
          <BarChart buckets={buckets} metric={metric} scope={scope} period={period} />
        </div>
        <BucketTable buckets={buckets} metric={metric} scope={scope} />
      </section>

      <div className={`${CARD_GRID} lg:grid-cols-3`}>
        <Panel title="살롱 프로그램별 확정 (상위 10)">
          {stats.byProgram.length === 0 ? (
            <EmptyLine text="확정된 살롱 신청이 아직 없어요." />
          ) : (
            <ul>
              {stats.byProgram.map((p) => (
                <RankRow
                  key={p.name}
                  name={p.name}
                  value={`${p.count}건`}
                  note={`${p.amount.toLocaleString()}원`}
                  max={maxProgram}
                  fill="bg-orange"
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="객실별 확정 박수">
          {stats.byRoom.length === 0 ? (
            <EmptyLine text="확정된 스테이 예약이 아직 없어요." />
          ) : (
            <ul>
              {stats.byRoom.map((r) => (
                <RankRow
                  key={r.room}
                  name={r.room}
                  value={`${r.nights}박`}
                  note={`${r.count}건 · ${r.amount.toLocaleString()}원`}
                  max={maxRoom}
                  fill="bg-teal"
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="할인 적용 비율 (확정)">
          {discountTotal === 0 ? (
            <EmptyLine text="확정된 신청이 아직 없어요." />
          ) : (
            <ul>
              {[
                { name: "없음", n: stats.discount.none },
                { name: "멤버십 곁", n: stats.discount.geot },
                { name: "나그네방 후원자", n: stats.discount.nagnae },
              ].map((d) => (
                <RankRow
                  key={d.name}
                  name={d.name}
                  value={`${d.n}건`}
                  note={`${Math.round((d.n / discountTotal) * 100)}%`}
                  max={discountTotal}
                  fill="bg-brown"
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs leading-5 break-keep text-gray-700">{basisText}</p>
    </div>
  );
}
