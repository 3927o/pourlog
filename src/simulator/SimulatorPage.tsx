import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  character,
  formatTime,
  grindLabel,
  initialState,
  mineralLabel,
  presets,
  ratioLabel,
  taste,
  tastingNote,
  type SimulatorState,
  type TasteResult,
} from "./engine";
import { simulatorInfo, type InfoKey } from "./info";
import {
  RadarChart,
  type RadarMetricKey,
  type RadarValues,
} from "./RadarChart";
import { ExtractionChart, PourTimeline } from "./SimulatorCharts";

type MetricKey =
  "acid" | "sweet" | "bitter" | "clarity" | "body" | "aftertaste";
type PanelKey = "foundation" | "extraction" | "craft";

const metricMeta: Array<{ key: MetricKey; label: string }> = [
  { key: "acid", label: "酸" },
  { key: "sweet", label: "甜" },
  { key: "bitter", label: "苦" },
  { key: "clarity", label: "干净" },
  { key: "body", label: "醇厚" },
  { key: "aftertaste", label: "余韵" },
];

const impacts: Record<keyof SimulatorState, MetricKey[]> = {
  roast: ["acid", "sweet", "bitter", "body"],
  process: ["acid", "sweet", "clarity", "body"],
  grind: ["sweet", "bitter", "clarity", "aftertaste"],
  temp: ["acid", "sweet", "bitter"],
  ratio: ["body"],
  minerals: ["acid", "body"],
  bloom: ["acid", "clarity"],
  pours: ["sweet", "clarity", "aftertaste"],
  profile: ["acid", "sweet"],
  style: ["clarity"],
  flow: ["bitter", "clarity"],
  stir: ["bitter", "clarity", "aftertaste"],
};

function radarValues(result: TasteResult): RadarValues {
  return {
    acid: result.acid,
    sweet: result.sweet,
    bitter: result.bitter,
    clean: result.clarity,
    body: result.body,
    aftertaste: result.aftertaste,
  };
}

function Segment<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="sim-segment">
      {options.map((option) => (
        <button
          className={value === option.value ? "active" : ""}
          disabled={disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function InfoButton({
  info,
  onOpen,
}: {
  info: InfoKey;
  onOpen: (key: InfoKey) => void;
}) {
  return (
    <button
      aria-label={`${simulatorInfo[info].title}说明`}
      className="sim-info-button"
      onClick={() => onOpen(info)}
      type="button"
    >
      i
    </button>
  );
}

function ParameterPanel({
  number,
  title,
  note,
  open,
  onOpen,
  className = "",
  children,
}: {
  number: string;
  title: string;
  note: string;
  open: boolean;
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  const heading = (
    <>
      <b>{number}</b>
      <span>
        {title}
        <small>{note}</small>
      </span>
    </>
  );
  return (
    <div className={`sim-control-group ${className} ${open ? "open" : ""}`}>
      <button
        aria-expanded={open}
        className="sim-group-toggle"
        onClick={onOpen}
        type="button"
      >
        {heading}
        <i aria-hidden="true">{open ? "−" : "+"}</i>
      </button>
      <div className="sim-group-title sim-group-title-desktop">{heading}</div>
      <div className="sim-group-content">{children}</div>
    </div>
  );
}

function ResultMetrics({
  result,
  baseline,
  activeMetrics,
  compact = false,
}: {
  result: TasteResult;
  baseline: TasteResult;
  activeMetrics: MetricKey[];
  compact?: boolean;
}) {
  const shown = compact ? metricMeta.slice(0, 3) : metricMeta;
  return (
    <div className={`sim-metrics ${compact ? "compact" : ""}`}>
      {shown.map(({ key, label }) => {
        const delta = Math.round(result[key] - baseline[key]);
        return (
          <div
            className={activeMetrics.includes(key) ? "changed" : ""}
            key={key}
          >
            <span>{label}</span>
            <strong>{Math.round(result[key])}</strong>
            <em className={delta === 0 ? "same" : delta > 0 ? "up" : "down"}>
              {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
            </em>
            {!compact && (
              <i>
                <b style={{ width: `${result[key]}%` }} />
              </i>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EngineSummary({ result }: { result: TasteResult }) {
  const extractionZone =
    result.ey < 18 ? "偏低 · 欠萃" : result.ey > 22 ? "偏高 · 过萃" : "理想区";
  const uniformityZone =
    result.uni >= 70
      ? "均匀"
      : result.uni >= 58
        ? "尚可"
        : result.uni >= 45
          ? "偏花"
          : "花掉了";
  const strengthZone =
    result.tds < 1.15 ? "偏淡" : result.tds > 1.5 ? "偏浓" : "适中";
  return (
    <div className="sim-engine-summary three">
      <div>
        <small>萃取率 · EY</small>
        <strong>{result.ey.toFixed(1)}%</strong>
        <em>{extractionZone}</em>
      </div>
      <div>
        <small>均匀度指数</small>
        <strong>{Math.round(result.uni)}</strong>
        <em>{uniformityZone}</em>
      </div>
      <div>
        <small>浓度 · TDS</small>
        <strong>{result.tds.toFixed(2)}%</strong>
        <em>{strengthZone}</em>
      </div>
    </div>
  );
}

function Comparison({
  pinned,
  result,
}: {
  pinned: TasteResult;
  result: TasteResult;
}) {
  const deltaEy = result.ey - pinned.ey;
  const sameExtraction = Math.abs(deltaEy) < 0.8;
  const rows: Array<[string, number]> = [
    ["苦", result.bitter - pinned.bitter],
    ["涩", result.astr - pinned.astr],
    ["甜", result.sweet - pinned.sweet],
    ["酸", result.acid - pinned.acid],
    ["匀", result.uni - pinned.uni],
  ];
  const insight =
    sameExtraction && Math.abs(result.uni - pinned.uni) > 15
      ? "萃取率几乎没动，均匀度换了个世界——这就是手法。"
      : sameExtraction &&
          Math.abs(result.acid - pinned.acid) > 5 &&
          (result.acid - pinned.acid) * (result.sweet - pinned.sweet) < 0
        ? "同一目标萃取率，酸甜互换——这就是配比。"
        : "查看每个口感维度相对基准杯的变化。";
  return (
    <div className="sim-compare">
      <p>
        基准 EY <b>{pinned.ey.toFixed(1)}</b> → 当前{" "}
        <b>{result.ey.toFixed(1)}</b>{" "}
        <strong>
          Δ{deltaEy >= 0 ? "+" : ""}
          {deltaEy.toFixed(1)}
        </strong>
      </p>
      <div>
        {rows.map(([label, delta]) => (
          <span key={label}>
            {label}{" "}
            <b>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(0)}
            </b>
          </span>
        ))}
      </div>
      <small>{insight}</small>
    </div>
  );
}

function InfoDialog({
  infoKey,
  onClose,
}: {
  infoKey: InfoKey | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!infoKey) return;
    const handleKey = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [infoKey, onClose]);
  if (!infoKey) return null;
  const entry = simulatorInfo[infoKey];
  return (
    <div
      className="sim-dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <section
        aria-labelledby="sim-dialog-title"
        aria-modal="true"
        className="sim-dialog"
        role="dialog"
      >
        <header>
          <span>MODEL NOTE · 模型说明</span>
          <h2 id="sim-dialog-title">{entry.title}</h2>
          <div>
            {entry.touches.map((touch) => (
              <b key={touch}>{touch}</b>
            ))}
          </div>
          <button aria-label="关闭说明" onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="sim-dialog-body">
          {entry.sections.map((section) => (
            <section
              className={section.tone === "warn" ? "warn" : ""}
              key={section.title}
            >
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
          <div className="sim-takeaway">
            <b>一句实操 →</b> {entry.takeaway}
          </div>
          {entry.caveat && <p className="sim-caveat">{entry.caveat}</p>}
        </div>
      </section>
    </div>
  );
}

export function SimulatorPage() {
  const [state, setState] = useState(initialState);
  const result = useMemo(() => taste(state), [state]);
  const cup = useMemo(() => character(result, state), [result, state]);
  const [baseline, setBaseline] = useState(() => taste(initialState));
  const [pinned, setPinned] = useState<TasteResult | null>(null);
  const [activeControl, setActiveControl] =
    useState<keyof SimulatorState>("temp");
  const [openGroup, setOpenGroup] = useState<PanelKey | null>(null);
  const [radarCollapsed, setRadarCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [infoKey, setInfoKey] = useState<InfoKey | null>(null);
  const activeMetrics = impacts[activeControl];
  const comparisonBase = pinned ?? baseline;

  function update<K extends keyof SimulatorState>(
    key: K,
    value: SimulatorState[K],
  ) {
    setBaseline(result);
    setActiveControl(key);
    setState((current) => ({ ...current, [key]: value }));
  }

  function beginSlider(
    key: keyof SimulatorState,
    event: PointerEvent<HTMLInputElement>,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setBaseline(result);
    setActiveControl(key);
  }

  function sliderProps(key: "grind" | "temp" | "ratio" | "minerals") {
    return {
      onFocus: () => {
        setBaseline(result);
        setActiveControl(key);
      },
      onPointerDown: (event: PointerEvent<HTMLInputElement>) =>
        beginSlider(key, event),
    };
  }

  function toggleGroup(group: PanelKey) {
    const next = openGroup === group ? null : group;
    setOpenGroup(next);
    setRadarCollapsed(next !== null);
  }

  const radar = radarValues(result);
  const radarBase = radarValues(comparisonBase);
  const highlightedRadar = activeMetrics.map((metric) =>
    metric === "clarity" ? "clean" : metric,
  ) as RadarMetricKey[];

  const resultContents = (
    <>
      <div className="sim-result-eyebrow">LIVE CUP · 实时口感</div>
      <h2>{cup.headline}</h2>
      <p>{tastingNote(result)}</p>
      <div className="sim-uniformity">
        <span>萃取均匀度指数</span>
        <i>
          <b style={{ width: `${result.uni}%` }} />
        </i>
        <strong>{Math.round(result.uni)}</strong>
      </div>
      <div className="sim-taste-overview">
        <RadarChart
          values={radar}
          baseline={radarBase}
          highlighted={highlightedRadar}
        />
        <ResultMetrics
          result={result}
          baseline={comparisonBase}
          activeMetrics={activeMetrics}
        />
      </div>
      <EngineSummary result={result} />
      <button
        className={`sim-pin ${pinned ? "active" : ""}`}
        onClick={() => setPinned(pinned ? null : result)}
        type="button"
      >
        {pinned ? "✕ 清除基准杯" : "▸ 钉住这杯，再调一杯对比"}
      </button>
      {pinned && <Comparison pinned={pinned} result={result} />}
      <div className="sim-under-hood">
        <div className="sim-hood-title">掀开引擎盖 · 为什么会这样</div>
        <div className="sim-chart-legend">
          <span className="acid">酸</span>
          <span className="sweet">甜</span>
          <span className="bitter">苦</span>
        </div>
        <p>彩色曲线是味道随萃取率的变化；灰色鼓包是三区粉床的萃取落点分布。</p>
        <ExtractionChart state={state} result={result} pinned={pinned} />
        <div className="sim-model-readout">
          <span>
            bypass <b>{(result.bypass * 100).toFixed(0)}%</b>
          </span>
          <span>
            有效浆温 <b>{result.Teff.toFixed(1)}°C</b>
          </span>
          <span>
            通道系数 <b>{result.C.toFixed(2)}</b>
          </span>
          <span>
            涩感 <b>{Math.round(result.astr)}</b>
          </span>
        </div>
      </div>
    </>
  );

  return (
    <main className="simulator-page">
      <header className="simulator-header">
        <div>
          <span>POUR.LOG / LAB</span>
          <h1>冲煮实验室</h1>
          <p>参数瞄准，手法命中。每动一个旋钮，立刻看见这杯发生了什么。</p>
        </div>
        <div aria-label="模拟预设" className="sim-presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setBaseline(result);
                setState(preset.value);
              }}
              type="button"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </header>

      <section
        aria-label="实时口感雷达"
        className={`sim-mobile-radar ${radarCollapsed ? "collapsed" : "expanded"}`}
      >
        {radarCollapsed ? (
          <button
            className="sim-mobile-radar-compact"
            onClick={() => setRadarCollapsed(false)}
            type="button"
          >
            <RadarChart
              values={radar}
              baseline={radarBase}
              highlighted={highlightedRadar}
            />
            <span>
              <small>当前杯 · 点击展开</small>
              <b>{cup.headline}</b>
              <ResultMetrics
                result={result}
                baseline={comparisonBase}
                activeMetrics={activeMetrics}
                compact
              />
            </span>
          </button>
        ) : (
          <>
            <div className="sim-mobile-radar-head">
              <span>
                <small>LIVE CUP · 实时口感</small>
                <b>{cup.headline}</b>
              </span>
              <button onClick={() => setRadarCollapsed(true)} type="button">
                收起
              </button>
            </div>
            <RadarChart
              values={radar}
              baseline={radarBase}
              highlighted={highlightedRadar}
            />
            <div className="sim-mobile-radar-foot">
              <span>EY {result.ey.toFixed(1)}%</span>
              <span>均匀 {Math.round(result.uni)}</span>
              <span>{formatTime(result.timeSec)}</span>
              <button onClick={() => setExpanded(true)} type="button">
                查看完整结果
              </button>
            </div>
          </>
        )}
      </section>

      <div className="simulator-workbench">
        <section aria-label="冲煮参数" className="sim-controls">
          <ParameterPanel
            className="foundation"
            number="01"
            title="豆子底子"
            note="买豆时已经决定"
            open={openGroup === "foundation"}
            onOpen={() => toggleGroup("foundation")}
          >
            <label>烘焙度</label>
            <Segment
              value={state.roast}
              options={[
                { label: "浅烘", value: "light" },
                { label: "中烘", value: "medium" },
                { label: "深烘", value: "dark" },
              ]}
              onChange={(value) => update("roast", value)}
            />
            <label>处理法</label>
            <Segment
              value={state.process}
              options={[
                { label: "水洗", value: "washed" },
                { label: "日晒", value: "natural" },
              ]}
              onChange={(value) => update("process", value)}
            />
          </ParameterPanel>

          <ParameterPanel
            number="02"
            title="萃取参数"
            note="决定萃取快慢与浓度"
            open={openGroup === "extraction"}
            onOpen={() => toggleGroup("extraction")}
          >
            <label>
              <span>
                研磨度 <InfoButton info="grind" onOpen={setInfoKey} />
              </span>
              <strong>{grindLabel(state.grind)}</strong>
            </label>
            <input
              aria-label="研磨度"
              max="100"
              min="0"
              type="range"
              value={state.grind}
              {...sliderProps("grind")}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  grind: Number(event.target.value),
                }))
              }
            />
            <div className="sim-range-ends">
              <span>粗</span>
              <span>细</span>
            </div>
            <label>
              <span>
                水温 <InfoButton info="temp" onOpen={setInfoKey} />
              </span>
              <strong>{state.temp}°C</strong>
            </label>
            <input
              aria-label="水温"
              max="96"
              min="85"
              type="range"
              value={state.temp}
              {...sliderProps("temp")}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  temp: Number(event.target.value),
                }))
              }
            />
            <div className="sim-range-ends">
              <span>85°C</span>
              <span>96°C</span>
            </div>
            <label>
              <span>
                粉水比 <InfoButton info="ratio" onOpen={setInfoKey} />
              </span>
              <strong>{ratioLabel(state.ratio)}</strong>
            </label>
            <input
              aria-label="粉水比"
              max="180"
              min="120"
              type="range"
              value={state.ratio}
              {...sliderProps("ratio")}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  ratio: Number(event.target.value),
                }))
              }
            />
            <div className="sim-range-ends">
              <span>1:12 浓</span>
              <span>1:18 淡</span>
            </div>
            <label>
              <span>
                水的矿物质 <InfoButton info="minerals" onOpen={setInfoKey} />
              </span>
              <strong>{mineralLabel(state.minerals)}</strong>
            </label>
            <input
              aria-label="水的矿物质"
              max="100"
              min="0"
              type="range"
              value={state.minerals}
              {...sliderProps("minerals")}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  minerals: Number(event.target.value),
                }))
              }
            />
            <div className="sim-range-ends">
              <span>软水</span>
              <span>硬水</span>
            </div>
          </ParameterPanel>

          <ParameterPanel
            className="craft"
            number="03"
            title="注水手法"
            note="改变水的分配与路径"
            open={openGroup === "craft"}
            onOpen={() => toggleGroup("craft")}
          >
            <label>
              <span>
                闷蒸 <InfoButton info="bloom" onOpen={setInfoKey} />
              </span>
            </label>
            <Segment
              value={state.bloom}
              options={[
                { label: "不闷蒸", value: "none" },
                { label: "30 秒", value: "b30" },
                { label: "45 秒", value: "b45" },
              ]}
              onChange={(value) => update("bloom", value)}
            />
            <label>
              <span>
                注水段数 <InfoButton info="pours" onOpen={setInfoKey} />
              </span>
            </label>
            <Segment
              value={state.pours}
              options={[
                { label: "一刀流", value: "p1" },
                { label: "三段", value: "p3" },
                { label: "五段", value: "p5" },
              ]}
              onChange={(value) => update("pours", value)}
            />
            <label>
              <span>
                前段配比 <InfoButton info="profile" onOpen={setInfoKey} />
              </span>
              <small>
                {state.pours === "p1" ? "一刀流没有配比" : "4:6 核心旋钮"}
              </small>
            </label>
            <Segment
              disabled={state.pours === "p1"}
              value={state.profile}
              options={[
                { label: "前段多", value: "front" },
                { label: "均分", value: "even" },
                { label: "前段少", value: "back" },
              ]}
              onChange={(value) => update("profile", value)}
            />
            <label>
              <span>
                绕圈方式 <InfoButton info="style" onOpen={setInfoKey} />
              </span>
            </label>
            <Segment
              value={state.style}
              options={[
                { label: "中心定点", value: "center" },
                { label: "小圈绕注", value: "spiral" },
                { label: "贴边大圈", value: "edge" },
              ]}
              onChange={(value) => update("style", value)}
            />
            <label>
              <span>
                水流扰动 <InfoButton info="flow" onOpen={setInfoKey} />
              </span>
            </label>
            <Segment
              value={state.flow}
              options={[
                { label: "轻柔", value: "gentle" },
                { label: "中等", value: "medium" },
                { label: "激烈", value: "aggr" },
              ]}
              onChange={(value) => update("flow", value)}
            />
            <label>
              <span>
                搅拌时机 <InfoButton info="stir" onOpen={setInfoKey} />
              </span>
            </label>
            <Segment
              value={state.stir}
              options={[
                { label: "不搅", value: "none" },
                { label: "闷蒸时搅", value: "bloom" },
                { label: "后段搅", value: "late" },
              ]}
              onChange={(value) => update("stir", value)}
            />
            <div className="sim-time-readout">
              <span>
                预计总时长 <InfoButton info="time" onOpen={setInfoKey} />
              </span>
              <b>{formatTime(result.timeSec)}</b>
            </div>
            <PourTimeline state={state} result={result} />
          </ParameterPanel>
        </section>

        <aside
          className={`sim-result ${expanded ? "mobile-expanded" : ""} ${cup.kind}`}
        >
          {resultContents}
          <button
            className="sim-close-result"
            onClick={() => setExpanded(false)}
            type="button"
          >
            收起结果，继续调参
          </button>
        </aside>
      </div>
      <InfoDialog infoKey={infoKey} onClose={() => setInfoKey(null)} />
    </main>
  );
}
