export type RadarMetricKey =
  "acid" | "sweet" | "bitter" | "clean" | "body" | "aftertaste";

export type RadarValues = Record<RadarMetricKey, number>;

const axes: Array<{ key: RadarMetricKey; label: string }> = [
  { key: "acid", label: "酸" },
  { key: "sweet", label: "甜" },
  { key: "body", label: "醇厚" },
  { key: "aftertaste", label: "余韵" },
  { key: "clean", label: "干净" },
  { key: "bitter", label: "苦" },
];

const center = { x: 140, y: 130 };
const radius = 88;

function point(index: number, value: number, distance = radius) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
  const scaled = distance * (value / 100);
  return {
    x: center.x + Math.cos(angle) * scaled,
    y: center.y + Math.sin(angle) * scaled,
  };
}

function polygonPoints(values: RadarValues) {
  return axes
    .map(({ key }, index) => {
      const coordinate = point(index, values[key]);
      return `${coordinate.x.toFixed(1)},${coordinate.y.toFixed(1)}`;
    })
    .join(" ");
}

export function RadarChart({
  values,
  baseline,
  highlighted = [],
}: {
  values: RadarValues;
  baseline: RadarValues;
  highlighted?: RadarMetricKey[];
}) {
  const description = axes
    .map(({ key, label }) => `${label} ${Math.round(values[key])}`)
    .join("，");

  return (
    <figure className="sim-radar">
      <svg
        aria-labelledby="sim-radar-title sim-radar-description"
        role="img"
        viewBox="0 0 280 270"
      >
        <title id="sim-radar-title">当前杯六维口感雷达图</title>
        <desc id="sim-radar-description">{description}</desc>

        {[25, 50, 75, 100].map((level) => (
          <polygon
            className="sim-radar-grid"
            key={level}
            points={axes
              .map((_, index) => {
                const coordinate = point(index, level);
                return `${coordinate.x},${coordinate.y}`;
              })
              .join(" ")}
          />
        ))}

        {axes.map(({ key }, index) => {
          const end = point(index, 100);
          return (
            <line
              className={
                highlighted.includes(key)
                  ? "sim-radar-axis highlighted"
                  : "sim-radar-axis"
              }
              key={key}
              x1={center.x}
              x2={end.x}
              y1={center.y}
              y2={end.y}
            />
          );
        })}

        <polygon
          className="sim-radar-baseline"
          points={polygonPoints(baseline)}
        />
        <polygon className="sim-radar-current" points={polygonPoints(values)} />

        {axes.map(({ key, label }, index) => {
          const valuePoint = point(index, values[key]);
          const labelPoint = point(index, 100, 113);
          return (
            <g key={key}>
              <circle
                className={
                  highlighted.includes(key)
                    ? "sim-radar-dot highlighted"
                    : "sim-radar-dot"
                }
                cx={valuePoint.x}
                cy={valuePoint.y}
                r={highlighted.includes(key) ? 4 : 3}
              />
              <text
                className={
                  highlighted.includes(key)
                    ? "sim-radar-label highlighted"
                    : "sim-radar-label"
                }
                textAnchor="middle"
                x={labelPoint.x}
                y={labelPoint.y + 4}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span>
          <i className="current" />
          当前杯
        </span>
        <span>
          <i className="baseline" />
          调整前
        </span>
      </figcaption>
    </figure>
  );
}
