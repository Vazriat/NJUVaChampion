"use client";

export interface HexagonDimension {
  key: string;
  label: string;
  value: number;
  average: number;
  topRank?: number | null;
  botRank?: number | null;
}

interface HexagonChartProps {
  dimensions: HexagonDimension[];
  size?: number;
}

export default function HexagonChart({ dimensions, size = 340 }: HexagonChartProps) {
  const center = size / 2;
  const radius = size * 0.3;
  const labelRadius = radius + 34;
  const angleOffset = -Math.PI / 2;
  const count = dimensions.length;

  const pointAt = (index: number, r: number) => {
    const angle = angleOffset + (index * 2 * Math.PI) / count;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const scaleValue = (value: number, dim: HexagonDimension) => {
    const max = Math.max(dim.value, dim.average, 0.0001) * 1.15;
    return Math.max(0, Math.min(1, value / max));
  };

  const polygonPoints = (getValue: (dim: HexagonDimension) => number) =>
    dimensions
      .map((dim, i) => {
        const p = pointAt(i, scaleValue(getValue(dim), dim) * radius);
        return `${p.x},${p.y}`;
      })
      .join(" ");

  const gridPoints = (frac: number) =>
    dimensions
      .map((_, i) => {
        const p = pointAt(i, radius * frac);
        return `${p.x},${p.y}`;
      })
      .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <polygon
          key={frac}
          points={gridPoints(frac)}
          fill="none"
          stroke="#3f3f46"
          strokeWidth="1"
        />
      ))}

      {dimensions.map((_, i) => {
        const p = pointAt(i, radius);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="#3f3f46"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={polygonPoints((d) => d.average)}
        fill="rgba(148,163,184,0.12)"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      <polygon
        points={polygonPoints((d) => d.value)}
        fill="rgba(239,68,68,0.18)"
        stroke="#ef4444"
        strokeWidth="2"
      />

      {dimensions.map((dim, i) => {
        const p = pointAt(i, radius);
        const lp = pointAt(i, labelRadius);
        return (
          <g key={dim.key}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fca5a5"
              fontSize="11"
              fontWeight="700"
            >
              {Number(dim.value ?? 0).toFixed(2)}
            </text>
            <text
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#d4d4d8"
              fontSize="12"
              fontWeight="600"
            >
              {dim.label}
            </text>
            {dim.topRank || (dim.botRank && !dim.topRank) ? (
              <text
                x={lp.x}
                y={lp.y + 16}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={dim.topRank ? "#4ade80" : "#f87171"}
              >
                {dim.topRank ? `TOP${dim.topRank}` : `BOT${dim.botRank}`}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
