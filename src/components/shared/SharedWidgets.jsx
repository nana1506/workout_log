import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, unit, delta, accent }) {
  const up = delta >= 0;
  return (
    <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">{label}</span>
        <Icon size={16} color={accent} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] leading-none font-semibold tabular-nums" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {value}
        </span>
        {unit && <span className="text-xs text-[#8A919C]">{unit}</span>}
      </div>
      {delta !== null && delta !== undefined && !isNaN(delta) && (
        <div className={`flex items-center gap-1 text-xs ${up ? "text-[#4FD1C5]" : "text-[#EF7B57]"}`}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{Math.abs(delta).toFixed(1)}% vs prior period</span>
        </div>
      )}
    </div>
  );
}

export function MetricCard({ icon: Icon, label, value, unit, accent, subtitle, subtitleColor }) {
  return (
    <div className="rounded-xl border border-[#232830] bg-[#15181D] p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#8A919C]">{label}</span>
        <Icon size={16} color={accent} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] leading-none font-semibold tabular-nums" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {value}
        </span>
        {unit && <span className="text-xs text-[#8A919C]">{unit}</span>}
      </div>
      {subtitle && <div className="text-xs" style={{ color: subtitleColor || "#8A919C" }}>{subtitle}</div>}
    </div>
  );
}

export function CustomTooltip({ active, payload, label, suffix }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] px-3 py-2 text-xs shadow-lg">
      <div className="text-[#8A919C] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#E7E9EC]">
            {p.name}: {p.value}
            {suffix || ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RadarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] px-3 py-2 text-xs shadow-lg space-y-1">
      <div className="font-semibold text-[#E7E9EC]">{data.subject}</div>
      <div className="text-[#8A919C] flex justify-between gap-4">
        <span>Sets:</span>
        <span className="text-[#F4B740] font-semibold">{data.sets}</span>
      </div>
      <div className="text-[#8A919C] flex justify-between gap-4">
        <span>Volume:</span>
        <span className="text-[#4FD1C5] font-semibold">{data.volume.toLocaleString()} kg</span>
      </div>
    </div>
  );
}
