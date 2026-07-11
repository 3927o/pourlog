import {
  bloomSeconds,
  clamp,
  flavorAtEY,
  formatTime,
  pourCounts,
  profileShares,
  type SimulatorState,
  type TasteResult,
} from "./engine";

export function PourTimeline({
  state,
  result,
}: {
  state: SimulatorState;
  result: TasteResult;
}) {
  const width = 340;
  const padding = 6;
  const total = result.timeSec;
  const scale = (width - padding * 2) / total;
  const bloom = bloomSeconds[state.bloom];
  const pours = pourCounts[state.pours];
  const shares = profileShares[pours === 1 ? "even" : state.profile][pours];
  const segmentTime = total - bloom - 10;
  let cursor = padding + bloom * scale;
  const blocks = shares.map((share, index) => {
    const slotWidth = segmentTime * share * scale;
    const blockWidth = Math.max(4, slotWidth * 0.82);
    const x = cursor;
    cursor += slotWidth;
    return { index, share, x, width: blockWidth };
  });

  return (
    <svg
      aria-label={`注水时间线，总时长 ${formatTime(total)}`}
      className="sim-timeline"
      role="img"
      viewBox="0 0 340 54"
    >
      <rect
        className="sim-timeline-track"
        height="4"
        width={Math.max(0, (total - bloom) * scale)}
        x={padding + bloom * scale}
        y="19"
      />
      {bloom > 0 && (
        <g>
          <rect
            className="sim-timeline-bloom"
            height="24"
            width={bloom * scale}
            x={padding}
            y="9"
          />
          {bloom * scale >= 26 && (
            <text
              className="sim-timeline-bloom-label"
              textAnchor="middle"
              x={padding + (bloom * scale) / 2}
              y="25"
            >
              闷蒸
            </text>
          )}
        </g>
      )}
      {blocks.map((block) => (
        <g key={block.index}>
          <rect
            className="sim-timeline-pour"
            height="24"
            width={block.width}
            x={block.x}
            y="9"
          />
          {block.width >= 12 && (
            <text
              className="sim-timeline-pour-label"
              textAnchor="middle"
              x={block.x + block.width / 2}
              y="25"
            >
              {block.width >= 34
                ? `${block.index + 1}·${Math.round(block.share * 100)}%`
                : block.index + 1}
            </text>
          )}
        </g>
      ))}
      <line
        className="sim-timeline-axis"
        x1={padding}
        x2={width - padding}
        y1="40"
        y2="40"
      />
      <text className="sim-chart-axis-label" x={padding} y="51">
        0:00
      </text>
      <text
        className="sim-chart-axis-label"
        textAnchor="end"
        x={width - padding}
        y="51"
      >
        {formatTime(total)}
      </text>
    </svg>
  );
}

const plot = { x0: 34, x1: 328, y0: 16, y1: 158, min: 14, max: 26 };
const x = (value: number) =>
  plot.x0 + ((value - plot.min) / (plot.max - plot.min)) * (plot.x1 - plot.x0);
const y = (value: number) =>
  plot.y1 - (clamp(value) / 100) * (plot.y1 - plot.y0);

function curvePath(key: "acid" | "sweet" | "bitter", state: SimulatorState) {
  return Array.from({ length: 61 }, (_, index) => {
    const extraction = plot.min + (index / 60) * (plot.max - plot.min);
    const flavor = flavorAtEY(extraction, state);
    return `${index === 0 ? "M" : "L"}${x(extraction).toFixed(1)} ${y(flavor[key]).toFixed(1)}`;
  }).join(" ");
}

export function ExtractionChart({
  state,
  result,
  pinned,
}: {
  state: SimulatorState;
  result: TasteResult;
  pinned: TasteResult | null;
}) {
  const samples = Array.from({ length: 49 }, (_, index) => {
    const extraction = plot.min + (index / 48) * (plot.max - plot.min);
    const density = result.zones.reduce(
      (sum, zone) =>
        sum +
        zone.m *
          Math.exp(-Math.pow(extraction - zone.ey, 2) / (2 * 0.55 * 0.55)),
      0,
    );
    return { extraction, density };
  });
  const maxDensity = Math.max(...samples.map((sample) => sample.density));
  const densityPath = [
    `M ${x(plot.min)} ${plot.y1}`,
    ...samples.map(
      (sample) =>
        `L ${x(sample.extraction).toFixed(1)} ${(plot.y1 - (sample.density / maxDensity) * 34).toFixed(1)}`,
    ),
    `L ${x(plot.max)} ${plot.y1} Z`,
  ].join(" ");
  const currentFlavor = flavorAtEY(result.ey, state);

  return (
    <svg
      aria-label={`萃取风味曲线，当前萃取率 ${result.ey.toFixed(1)}%`}
      className="sim-extraction-chart"
      role="img"
      viewBox="0 0 340 200"
    >
      <rect
        className="sim-chart-ideal"
        height={plot.y1 - plot.y0}
        width={x(22) - x(18)}
        x={x(18)}
        y={plot.y0}
      />
      <line
        className="sim-chart-axis"
        x1={plot.x0}
        x2={plot.x1}
        y1={plot.y1}
        y2={plot.y1}
      />
      {[14, 16, 18, 20, 22, 24, 26].map((tick) => (
        <text
          className="sim-chart-axis-label"
          key={tick}
          textAnchor="middle"
          x={x(tick)}
          y={plot.y1 + 13}
        >
          {tick}
        </text>
      ))}
      <text
        className="sim-chart-axis-title"
        textAnchor="middle"
        x={(plot.x0 + plot.x1) / 2}
        y={plot.y1 + 28}
      >
        萃取率 %
      </text>
      <path className="sim-chart-density" d={densityPath} />
      {result.zones.map((zone, index) => (
        <line
          className="sim-chart-zone"
          key={index}
          x1={x(clamp(zone.ey, plot.min, plot.max))}
          x2={x(clamp(zone.ey, plot.min, plot.max))}
          y1={plot.y1 - 5}
          y2={plot.y1}
        />
      ))}
      <path className="sim-chart-curve acid" d={curvePath("acid", state)} />
      <path className="sim-chart-curve sweet" d={curvePath("sweet", state)} />
      <path className="sim-chart-curve bitter" d={curvePath("bitter", state)} />
      <text
        className="sim-chart-curve-label acid"
        x={x(14.6)}
        y={y(flavorAtEY(14.6, state).acid) - 7}
      >
        酸
      </text>
      <text
        className="sim-chart-curve-label sweet"
        textAnchor="middle"
        x={x(20)}
        y={y(flavorAtEY(20, state).sweet) - 7}
      >
        甜
      </text>
      <text
        className="sim-chart-curve-label bitter"
        textAnchor="end"
        x={x(25.6)}
        y={y(flavorAtEY(25.6, state).bitter) - 7}
      >
        苦
      </text>
      {pinned && (
        <line
          className="sim-chart-pinned"
          x1={x(clamp(pinned.ey, plot.min, plot.max))}
          x2={x(clamp(pinned.ey, plot.min, plot.max))}
          y1={plot.y0}
          y2={plot.y1}
        />
      )}
      <line
        className="sim-chart-current"
        x1={x(clamp(result.ey, plot.min, plot.max))}
        x2={x(clamp(result.ey, plot.min, plot.max))}
        y1={plot.y0}
        y2={plot.y1}
      />
      {(["acid", "sweet", "bitter"] as const).map((key) => (
        <circle
          className={`sim-chart-point ${key}`}
          cx={x(clamp(result.ey, plot.min, plot.max))}
          cy={y(currentFlavor[key])}
          key={key}
          r="4"
        />
      ))}
    </svg>
  );
}
