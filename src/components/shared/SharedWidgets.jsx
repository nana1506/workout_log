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

export function VolumeTooltip({ active, payload, label, annotationEvents = [], captions = {} }) {
  if (!active || !payload || !payload.length) return null;
  const totalInPeriod = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] px-3 py-2 text-xs shadow-lg space-y-1.5 min-w-[170px]">
      <div className="flex items-center justify-between border-b border-[#2A2F38] pb-1">
        <span className="text-[#8A919C] font-semibold">{label}</span>
        <span className="text-[#F4B740] font-mono font-semibold">{totalInPeriod.toLocaleString()} kg</span>
      </div>
      {payload.map((p) => {
        const mg = p.dataKey;
        const val = Number(p.value) || 0;
        if (val === 0) return null;
        const neglectedEvent = annotationEvents.find(
          (e) => e.type === "neglected-muscle" && (e.id === `neglected-${mg}` || e.muscle === mg)
        );
        const caption = neglectedEvent
          ? (captions[`neglected-${mg}`] || captions[neglectedEvent.id] || neglectedEvent.label)
          : null;

        return (
          <div key={mg} className="space-y-0.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="text-[#E7E9EC] capitalize font-medium">{p.name || mg}</span>
              </div>
              <span className="font-mono text-[#E7E9EC]">{val.toLocaleString()} kg</span>
            </div>
            {caption && (
              <div className="text-[10px] text-[#EF7B57] pl-3.5 font-medium">
                {caption}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DualAxisTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload || {};

  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] p-3 text-xs shadow-xl space-y-2 min-w-[190px]">
      <div className="flex items-center justify-between border-b border-[#2A2F38] pb-1.5">
        <span className="text-[#E7E9EC] font-semibold font-mono">{label}</span>
        {data.isRpeSpike && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EF7B57]/15 text-[#EF7B57] border border-[#EF7B57]/30 font-bold uppercase">
            RPE Spike
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[#8A919C]">
            <span className="w-2 h-2 rounded-sm bg-[#F4B740]" />
            <span>Volume Load:</span>
          </div>
          <span className="font-mono text-[#F4B740] font-bold">{Number(data.volume || 0).toLocaleString()} kg</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[#8A919C]">
            <span className="w-2 h-2 rounded-full bg-[#7FA6FF]" />
            <span>Avg RPE:</span>
          </div>
          <span className="font-mono text-[#7FA6FF] font-bold">{Number(data.rpe || 0).toFixed(1)} <span className="text-[10px] text-[#8A919C] font-normal">/ 10</span></span>
        </div>

        {data.sets > 0 && (
          <div className="flex items-center justify-between text-[11px] text-[#8A919C] pt-1 border-t border-[#232830]">
            <span>Working Sets:</span>
            <span className="font-mono text-[#E7E9EC]">{data.sets} sets</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RpeDistributionTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload || {};

  return (
    <div className="rounded-lg border border-[#2A2F38] bg-[#1B1F26] p-3 text-xs shadow-xl space-y-2 min-w-[200px]">
      <div className="flex items-center gap-2 border-b border-[#2A2F38] pb-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
        <span className="text-[#E7E9EC] font-semibold">{data.name}</span>
        <span className="text-[10px] text-[#8A919C] font-mono ml-auto">({data.range})</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[#8A919C]">
          <span>Set Count:</span>
          <span className="font-mono text-[#E7E9EC] font-bold">
            {data.count} <span className="text-[10px] text-[#8A919C] font-normal">({data.pct}%)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-[#8A919C]">
          <span>Total Tonnage:</span>
          <span className="font-mono text-[#4FD1C5] font-semibold">{Number(data.volume || 0).toLocaleString()} kg</span>
        </div>

        {data.avgWeight > 0 && (
          <div className="flex items-center justify-between text-[#8A919C]">
            <span>Avg Weight / Set:</span>
            <span className="font-mono text-[#F4B740] font-semibold">{data.avgWeight} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}
