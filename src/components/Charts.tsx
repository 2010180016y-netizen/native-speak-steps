import { useId, useState } from "react";
import { areaPaths, donutArcs, niceMax } from "@/lib/chartMath";

// Small charts drawn with HTML and SVG. They replace a charting library whose chunk was larger
// than the rest of the app. Colors are CSS colors, e.g. "hsl(var(--primary))".

const AXIS_TEXT = "text-[10px] font-bold text-muted-foreground";

/** One horizontal bar per item: label, a bar scaled to the largest value, and the value. */
export const BarList = ({ items }: { items: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-right text-xs font-bold text-foreground" title={item.label}>
            {item.label}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-xs font-bold text-primary">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

/** Vertical bars with the value above each bar and the label below. */
export const Columns = ({
  data,
  height = 130,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col">
          <div className="flex flex-1 items-end pt-4">
            <div
              className="relative w-full rounded-t-md"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: 2, background: d.color }}
            >
              <span className="absolute inset-x-0 -top-4 text-center text-[10px] font-bold text-foreground">{d.value}</span>
            </div>
          </div>
          <span className={`mt-1 text-center ${AXIS_TEXT}`}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const RADIUS = 40;
const RING_WIDTH = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring split into slices; hovering a slice shows its share. Put the legend next to it. */
export const DonutChart = ({
  slices,
  size = 140,
  label,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  label?: string;
}) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const arcs = donutArcs(slices.map((slice) => slice.value), CIRCUMFERENCE);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className="shrink-0">
      <circle cx={50} cy={50} r={RADIUS} fill="none" strokeWidth={RING_WIDTH} style={{ stroke: "hsl(var(--muted))" }} />
      <g transform="rotate(-90 50 50)">
        {slices.map((slice, i) =>
          arcs[i].length > 0 ? (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={RADIUS}
              fill="none"
              strokeWidth={RING_WIDTH}
              strokeDasharray={`${arcs[i].length} ${CIRCUMFERENCE - arcs[i].length}`}
              strokeDashoffset={-arcs[i].offset}
              style={{ stroke: slice.color }}
            >
              <title>{`${slice.label}: ${slice.value} (${Math.round((slice.value / total) * 100)}%)`}</title>
            </circle>
          ) : null,
        )}
      </g>
    </svg>
  );
};

/** A filled line over slots labelled along the bottom; hover or tap a slot to read its value. */
export const AreaChart = ({
  data,
  color,
  name,
  unit = "",
  height = 160,
}: {
  data: { label: string; value: number }[];
  color: string;
  name: string;
  unit?: string;
  height?: number;
}) => {
  const gradientId = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const { xs, ys, line, area } = areaPaths(data.map((d) => d.value), top);

  return (
    <div className="flex">
      <div className={`flex w-8 shrink-0 flex-col justify-between pr-1.5 text-right ${AXIS_TEXT}`} style={{ height }}>
        <span>{top}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }} onPointerLeave={() => setActive(null)}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" style={{ stopColor: color, stopOpacity: 0.3 }} />
                <stop offset="95%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {[0, 50, 100].map((y) => (
              <line
                key={y}
                x1={0}
                x2={100}
                y1={y}
                y2={y}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                style={{ stroke: "hsl(var(--border))" }}
              />
            ))}
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: color }}
            />
          </svg>
          <div className="absolute inset-0 flex">
            {data.map((_, i) => (
              <div key={i} className="flex-1" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
            ))}
          </div>
          {active !== null && (
            <>
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: `${xs[active]}%`, top: `${ys[active]}%`, background: color }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] whitespace-nowrap rounded-xl border-2 border-border bg-card px-3 py-2 text-xs font-semibold shadow-lg"
                style={{ left: `${xs[active]}%`, top: `${ys[active]}%` }}
              >
                <p className="mb-0.5 font-bold text-foreground">{data[active].label}</p>
                <p style={{ color }}>
                  {name}: {data[active].value}
                  {unit}
                </p>
              </div>
            </>
          )}
        </div>
        <div className={`mt-1 flex ${AXIS_TEXT}`}>
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
