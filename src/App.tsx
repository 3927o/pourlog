import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  analyzeCup,
  callAI,
  localAnalysis,
  localSuggestion,
  suggestRecipe,
} from "./ai";
import { db, uid } from "./db";
import {
  dimensionMeta,
  type AnalysisResult,
  type AppSettings,
  type Bean,
  type BrewDimensions,
  type BrewMethod,
  type PourStep,
  type Recipe,
  type RecipeSuggestion,
} from "./models";

const defaultDims: BrewDimensions = {
  acid: 3,
  sweet: 3,
  bitter: 3,
  clean: 3,
  finish: 3,
  body: 3,
};

function dateLabel(value: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })
    .format(value)
    .replace("/", ".");
}

function Loading() {
  return <div className="empty">// LOADING...</div>;
}

function Page({
  children,
  nav = true,
}: {
  children: ReactNode;
  nav?: boolean;
}) {
  return (
    <main className="app-shell">
      <DesktopNav />
      <div className="page-scroll">{children}</div>
      {nav && <BottomNav />}
    </main>
  );
}

function DesktopNav() {
  return (
    <aside className="desktop-nav">
      <Link className="desktop-brand" to="/beans">
        <span>POUR.LOG</span>
        <small>手冲陪学</small>
      </Link>
      <nav>
        <NavLink to="/beans">
          <b>01</b>
          <span>
            豆样本库<small>BEANS</small>
          </span>
        </NavLink>
        <NavLink to="/journal">
          <b>02</b>
          <span>
            冲煮日记<small>JOURNAL</small>
          </span>
        </NavLink>
        <NavLink to="/recipes">
          <b>03</b>
          <span>
            配方库<small>RECIPES</small>
          </span>
        </NavLink>
      </nav>
      <Link className="desktop-settings" to="/settings">
        ⚙
        <span>
          AI 设置<small>SETTINGS</small>
        </span>
      </Link>
      <p>
        LOCAL FIRST
        <br />
        DATA STAYS HERE
      </p>
    </aside>
  );
}

function Header({
  eyebrow,
  title,
  meta,
  settings = true,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  settings?: boolean;
}) {
  return (
    <header className="masthead">
      <div className="header-row">
        <span className="brand">{eyebrow}</span>
        {settings && (
          <Link className="settings-link" to="/settings">
            ⚙ 设置
          </Link>
        )}
      </div>
      <div className="header-row title-row">
        <h1>{title}</h1>
        {meta && <span className="header-meta">{meta}</span>}
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/beans">BEANS</NavLink>
      <NavLink to="/journal">JOURNAL</NavLink>
      <NavLink to="/recipes">RECIPES</NavLink>
    </nav>
  );
}

function Back({ to, label = "‹ 返回" }: { to: string; label?: string }) {
  return (
    <Link className="back" to={to}>
      {label}
    </Link>
  );
}

function Specs({ recipe }: { recipe: Recipe }) {
  const specs = [
    ["粉水比", recipe.ratio],
    ["研磨", recipe.grind],
    ["水温", recipe.temp],
    ["注水", recipe.pour || "—"],
    ["总时间", recipe.time],
    ["方式", recipe.method],
  ];
  return (
    <div className="spec-grid">
      {specs.map(([k, v]) => (
        <div key={k}>
          <small>{k}</small>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

function Steps({ steps }: { steps: PourStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="steps">
      {steps.map((step, index) => (
        <div className="step" key={`${index}-${step.t}`}>
          <b>{index + 1}</b>
          <span>{step.t}</span>
          <strong>{step.water}</strong>
          <em>{step.note}</em>
        </div>
      ))}
    </div>
  );
}

function DimensionBars({ dims }: { dims: BrewDimensions }) {
  return (
    <div className="dim-bars">
      {dimensionMeta.map((item) => {
        const value = dims[item.key];
        const hot =
          (item.key === "bitter" && value >= 4) ||
          (item.key === "clean" && value <= 2);
        return (
          <div className="dim-bar" key={item.key}>
            <span>{item.name}</span>
            <i>
              <b
                className={hot ? "hot" : ""}
                style={{ width: `${value * 20}%` }}
              />
            </i>
            <strong className={hot ? "hot-text" : ""}>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function BeansPage() {
  const beans = useLiveQuery(() => db.beans.orderBy("no").toArray(), []);
  const journals = useLiveQuery(() => db.journals.toArray(), []);
  if (!beans || !journals)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return (
    <Page>
      <Header
        eyebrow="POUR.LOG / 手冲陪学"
        title="豆样本库"
        meta={`n = ${beans.length}`}
      />
      <section className="content cards bean-grid">
        {beans.map((bean) => {
          const count = journals.filter((j) => j.beanId === bean.id).length;
          return (
            <article className="bean-card" key={bean.id}>
              <Link className="card-link" to={`/beans/${bean.id}`}>
                <div className="card-meta">
                  <span>
                    [{bean.no}] {bean.process} · {bean.roast} · {bean.roastDate}
                  </span>
                  <span>n={count}</span>
                </div>
                <h2>
                  {bean.name}
                  {bean.bestRecipeId && <b className="best">★BEST</b>}
                </h2>
                <p className="origin">{bean.origin}</p>
                <div className="tags">
                  {bean.flavors.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
              </Link>
              <Link className="primary small" to={`/brew/${bean.id}`}>
                ▸ RUN BREW
              </Link>
            </article>
          );
        })}
        <Link className="dashed" to="/beans/new">
          + REGISTER SAMPLE
        </Link>
      </section>
    </Page>
  );
}

function BeanDetail() {
  const { id } = useParams();
  const bean = useLiveQuery(() => (id ? db.beans.get(id) : undefined), [id]);
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const journals = useLiveQuery(
    () =>
      id
        ? db.journals.where("beanId").equals(id).reverse().sortBy("createdAt")
        : [],
    [id],
  );
  const settings = useLiveQuery(() => db.settings.get("main"), []);
  const [method, setMethod] = useState<BrewMethod>("热冲");
  const [suggestion, setSuggestion] = useState<RecipeSuggestion>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!bean || !recipes || !journals || !settings)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  const currentBean = bean,
    currentSettings = settings;
  const best = recipes.find((r) => r.id === bean.bestRecipeId);
  async function generate() {
    setLoading(true);
    setError("");
    try {
      setSuggestion(
        currentSettings.apiBase && currentSettings.apiKey
          ? await suggestRecipe(currentSettings, currentBean, method)
          : localSuggestion(currentBean, method),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Page nav={false}>
      <section className="content detail">
        <div className="top-actions">
          <Back to="/beans" label="‹ RACK" />
          <Link className="edit" to={`/beans/${bean.id}/edit`}>
            EDIT
          </Link>
        </div>
        <div className="detail-hero">
          <div>
            <p className="overline">
              SAMPLE [{bean.no}] · {bean.origin}
            </p>
            <h1>{bean.name}</h1>
            <div className="tags">
              {bean.flavors.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          </div>
          <div className="mini-specs">
            <span>
              <small>处理法</small>
              {bean.process}
            </span>
            <span>
              <small>烘焙度</small>
              {bean.roast}
            </span>
            <span>
              <small>烘焙日</small>
              {bean.roastDate}
            </span>
          </div>
        </div>
        <div className="bean-detail-grid">
          {best && (
            <div className="optimal">
              <small>★ OPTIMAL RECIPE</small>
              <strong>{best.name}</strong>
              <span>
                {best.ratio} · {best.grind} · {best.temp} · {best.time}
              </span>
            </div>
          )}
          <section className="ai-panel">
            <h3>◇ AI SUGGEST RECIPE</h3>
            <div className="pills">
              {(["热冲", "冰冲", "冷萃"] as BrewMethod[]).map((m) => (
                <button
                  className={method === m ? "selected" : ""}
                  onClick={() => {
                    setMethod(m);
                    setSuggestion(undefined);
                  }}
                  key={m}
                >
                  {m}
                </button>
              ))}
            </div>
            <button className="dark full" disabled={loading} onClick={generate}>
              {loading ? "▮▮▮ 生成中..." : "生成推荐配方"}
            </button>
            {error && <p className="error">⚠ {error}</p>}
            {suggestion && (
              <div className="suggestion">
                <strong>
                  {suggestion.ratio} · {suggestion.grind} · {suggestion.temp} ·{" "}
                  {suggestion.time}
                </strong>
                <Steps steps={suggestion.steps} />
                <p>{suggestion.why}</p>
                <small>
                  //{" "}
                  {suggestion.source === "ai"
                    ? "AI 生成 · 仅供参考"
                    : "本地规则 · AI 未配置"}
                </small>
              </div>
            )}
          </section>
          <section className="history-panel">
            <h3 className="section-label">LOG HISTORY · {journals.length}</h3>
            {journals.map((j) => (
              <Link className="log-row" to={`/journal/${j.id}`} key={j.id}>
                <span>
                  <strong>{j.recipeSnapshot.name}</strong>
                  <small>{dateLabel(j.createdAt)}</small>
                </span>
                <DimensionBars dims={j.dims} />
              </Link>
            ))}
          </section>
        </div>
      </section>
      <div className="sticky-actions">
        <Link className="primary" to={`/brew/${bean.id}`}>
          ▸ NEW BREW · THIS SAMPLE
        </Link>
      </div>
    </Page>
  );
}

function BeanForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(
    () => (id ? db.beans.get(id) : undefined),
    [id],
  );
  const count = useLiveQuery(() => db.beans.count(), []);
  const [form, setForm] = useState<Omit<Bean, "id" | "no">>({
    name: "",
    origin: "",
    process: "水洗",
    roast: "浅烘",
    roastDate: "",
    flavors: [],
  });
  useEffect(() => {
    if (existing)
      setForm({
        name: existing.name,
        origin: existing.origin,
        process: existing.process,
        roast: existing.roast,
        roastDate: existing.roastDate,
        flavors: existing.flavors,
        bestRecipeId: existing.bestRecipeId,
      });
  }, [existing]);
  if (count === undefined)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  async function submit(e: FormEvent) {
    e.preventDefault();
    const beanId = id || uid();
    await db.beans.put({
      ...form,
      id: beanId,
      no: existing?.no || String(count! + 1).padStart(2, "0"),
    });
    navigate(`/beans/${beanId}`);
  }
  async function remove() {
    if (id) {
      await db.transaction("rw", db.beans, db.journals, async () => {
        await db.beans.delete(id);
        await db.journals.where("beanId").equals(id).delete();
      });
      navigate("/beans");
    }
  }
  return (
    <Page nav={false}>
      <form className="content form" onSubmit={submit}>
        <Back to={id ? `/beans/${id}` : "/beans"} />
        <h1>{id ? "编辑豆子" : "录入豆子"}</h1>
        <Field
          label="名称 NAME"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />
        <Field
          label="产区 ORIGIN"
          value={form.origin}
          onChange={(v) => setForm({ ...form, origin: v })}
        />
        <Choice
          label="处理法 PROCESS"
          values={["水洗", "日晒", "蜜处理"]}
          value={form.process}
          onChange={(v) => setForm({ ...form, process: v })}
        />
        <Choice
          label="烘焙度 ROAST"
          values={["浅烘", "中烘", "深烘"]}
          value={form.roast}
          onChange={(v) => setForm({ ...form, roast: v })}
        />
        <Field
          label="烘焙日 ROAST DATE"
          value={form.roastDate}
          placeholder="06.28"
          onChange={(v) => setForm({ ...form, roastDate: v })}
        />
        <Field
          label="风味 FLAVORS · 逗号分隔"
          value={form.flavors.join(",")}
          onChange={(v) =>
            setForm({
              ...form,
              flavors: v
                .split(/[,，]/)
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
        {id && (
          <button type="button" className="danger full" onClick={remove}>
            ✕ 删除这支豆
          </button>
        )}
        <button className="primary full">▸ 保存</button>
      </form>
    </Page>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        required
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Choice({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice">
        {values.map((v) => (
          <button
            type="button"
            className={value === v ? "selected" : ""}
            onClick={() => onChange(v)}
            key={v}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalPage() {
  const journals = useLiveQuery(
    () => db.journals.reverse().sortBy("createdAt"),
    [],
  );
  const beans = useLiveQuery(() => db.beans.toArray(), []);
  if (!journals || !beans)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return (
    <Page>
      <Header
        eyebrow="POUR.LOG / 日记"
        title="冲煮日记"
        meta={`n = ${journals.length}`}
      />
      <section className="content cards journal-grid">
        {!journals.length && <div className="empty">// 还没有任何记录</div>}
        {journals.map((j) => {
          const bean = beans.find((b) => b.id === j.beanId);
          return (
            <Link className="journal-card" to={`/journal/${j.id}`} key={j.id}>
              <div>
                <h2>{bean?.name || "已删除豆子"}</h2>
                <span>{dateLabel(j.createdAt)} ›</span>
              </div>
              <p>
                <b>{j.recipeSnapshot.method}</b>
                {j.recipeSnapshot.name}
              </p>
              <DimensionBars dims={j.dims} />
            </Link>
          );
        })}
      </section>
    </Page>
  );
}

function JournalDetail() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const journal = useLiveQuery(
    () => (id ? db.journals.get(id) : undefined),
    [id],
  );
  const bean = useLiveQuery(
    () => (journal ? db.beans.get(journal.beanId) : undefined),
    [journal?.beanId],
  );
  const settings = useLiveQuery(() => db.settings.get("main"), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const autoRan = useRef(false);
  async function generate(local = false) {
    if (!journal || !bean || !settings) return;
    setLoading(true);
    setError("");
    try {
      const result =
        local || !settings.apiBase || !settings.apiKey
          ? localAnalysis(journal.recipeSnapshot, journal.dims)
          : await analyzeCup(
              settings,
              bean,
              journal.recipeSnapshot,
              journal.dims,
              journal.notes,
            );
      await db.journals.update(journal.id, { aiReview: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (
      search.get("generate") === "1" &&
      journal &&
      bean &&
      settings &&
      !journal.aiReview &&
      !autoRan.current
    ) {
      autoRan.current = true;
      void generate();
    }
  }, [journal, bean, settings]);
  if (!journal || !bean || !settings)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  const currentJournal = journal,
    currentBean = bean;
  const review = journal.aiReview;
  async function remove() {
    await db.journals.delete(currentJournal.id);
    navigate("/journal");
  }
  async function toggleBest() {
    await db.beans.update(currentBean.id, {
      bestRecipeId:
        currentBean.bestRecipeId === currentJournal.recipeId
          ? undefined
          : currentJournal.recipeId,
    });
  }
  return (
    <Page nav={false}>
      <section className="content detail">
        <Back to="/journal" label="‹ LOG" />
        <div className="detail-hero">
          <div>
            <p className="overline">
              {bean.name} · {dateLabel(journal.createdAt)}
            </p>
            <h1>冲煮日记</h1>
          </div>
        </div>
        <div className="journal-detail-grid">
          <section className="journal-core">
            <h3 className="section-label">这杯的口感 · 六维评分 1–5</h3>
            <DimensionBars dims={journal.dims} />
            <h3 className="section-label">用到的配方</h3>
            <h2>{journal.recipeSnapshot.name}</h2>
            <Specs recipe={journal.recipeSnapshot} />
            <Steps steps={journal.recipeSnapshot.steps} />
            <button className="ghost full" onClick={toggleBest}>
              {bean.bestRecipeId === journal.recipeId
                ? "★ 已是最佳配方"
                : "☆ 标为这支豆的最佳配方"}
            </button>
            {journal.notes && (
              <>
                <h3 className="section-label">笔记</h3>
                <p className="note">{journal.notes}</p>
              </>
            )}
            <button className="danger full" onClick={remove}>
              ✕ 删除这篇日记
            </button>
          </section>
          <aside className="journal-ai">
            <h3 className="section-label">AI 复盘建议 · 单变量原则</h3>
            {loading && <div className="loading-box">▮▮▮ 分析中...</div>}
            {error && (
              <>
                <p className="error">⚠ {error}</p>
                <button className="ghost full" onClick={() => generate()}>
                  ↻ 重试
                </button>
                <button className="ghost full" onClick={() => generate(true)}>
                  使用本地规则
                </button>
              </>
            )}
            {!review && !loading && !error && (
              <button className="dark full" onClick={() => generate()}>
                {settings.apiBase && settings.apiKey
                  ? "◇ 生成复盘建议"
                  : "◇ 使用本地规则生成建议"}
              </button>
            )}
            {review && <Analysis result={review} />}{" "}
            {review && (
              <button className="ghost full" onClick={() => generate()}>
                ↻ 重新生成
              </button>
            )}
          </aside>
        </div>
      </section>
      <div className="sticky-actions">
        <Link
          className="primary"
          to={`/brew/${bean.id}?recipe=${journal.recipeId}`}
        >
          ▸ 用此配方再冲一杯
        </Link>
      </div>
    </Page>
  );
}

function Analysis({ result }: { result: AnalysisResult }) {
  return (
    <div className="analysis">
      <h4>只调一个变量</h4>
      <div className="change">
        <span>{result.variable}</span>
        <del>{result.from}</del>
        <b>→</b>
        <strong>{result.to}</strong>
      </div>
      <small>为什么这么改</small>
      <p>{result.reason}</p>
      <em>// {result.principle}</em>
      {result.advanced.length > 0 && (
        <details>
          <summary>进阶微调</summary>
          {result.advanced.map((x) => (
            <div key={x}>· {x}</div>
          ))}
        </details>
      )}
      <footer>// {result.source === "ai" ? "AI 生成" : "本地规则推算"}</footer>
    </div>
  );
}

function BrewPage() {
  const { beanId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const bean = useLiveQuery(
    () => (beanId ? db.beans.get(beanId) : undefined),
    [beanId],
  );
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const [recipeId, setRecipeId] = useState(search.get("recipe") || "");
  const [step, setStep] = useState(1);
  const [dims, setDims] = useState(defaultDims);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (bean && recipes && !recipeId)
      setRecipeId(bean.bestRecipeId || recipes[0]?.id || "");
  }, [bean, recipes, recipeId]);
  if (!bean || !recipes)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  const recipe = recipes.find((r) => r.id === recipeId) || recipes[0];
  if (!recipe)
    return (
      <Page nav={false}>
        <div className="empty">请先创建配方</div>
      </Page>
    );
  async function save() {
    const id = uid();
    await db.journals.add({
      id,
      beanId: bean!.id,
      recipeId: recipe!.id,
      recipeSnapshot: recipe!,
      createdAt: Date.now(),
      dims,
      notes,
    });
    navigate(`/journal/${id}?generate=1`);
  }
  return (
    <Page nav={false}>
      <section className="content detail brew-page">
        <Back to={`/beans/${bean.id}`} />
        <h1>新建日记</h1>
        <div className="progress">
          <span className="active">01 配方</span>
          <span className={step === 2 ? "active" : ""}>02 口感</span>
          <span>03 建议</span>
        </div>
        <div className="brew-grid">
          <section
            className={`brew-stage recipe-stage ${step === 1 ? "mobile-active" : ""}`}
          >
            <h3 className="section-label">选择豆子 SAMPLE</h3>
            <div className="selected-sample">
              {bean.name}
              <small>{bean.origin}</small>
            </div>
            <h3 className="section-label">选择配方 RECIPE</h3>
            <div className="pills wrap">
              {recipes.map((r) => (
                <button
                  className={recipe.id === r.id ? "selected" : ""}
                  onClick={() => setRecipeId(r.id)}
                  key={r.id}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <Specs recipe={recipe} />
            <Steps steps={recipe.steps} />
          </section>
          <section
            className={`brew-stage score-stage ${step === 2 ? "mobile-active" : ""}`}
          >
            <div className="selected-sample desktop-summary">
              {bean.name}
              <small>{recipe.name}</small>
            </div>
            <h3 className="section-label">// RECORD CUP · 六维口感</h3>
            {dimensionMeta.map((d) => (
              <label className="slider" key={d.key}>
                <span>
                  <b>[{d.name}]</b>
                  <strong>
                    {dims[d.key]}
                    <small>/5</small>
                  </strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={dims[d.key]}
                  onChange={(e) =>
                    setDims({ ...dims, [d.key]: Number(e.target.value) })
                  }
                />
                <em>
                  <i>{d.lo}</i>
                  <i>{d.hi}</i>
                </em>
              </label>
            ))}
            <label className="field">
              <span>NOTES</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="> 自由记录这一杯……"
              />
            </label>
          </section>
        </div>
      </section>
      <div className="sticky-actions">
        <div className="mobile-brew-action">
          {step === 1 ? (
            <button className="dark full" onClick={() => setStep(2)}>
              下一步 · 记录口感 →
            </button>
          ) : (
            <button className="primary full" onClick={save}>
              ▸ SAVE + ANALYZE
            </button>
          )}
        </div>
        <button className="primary full desktop-save" onClick={save}>
          ▸ SAVE + ANALYZE
        </button>
      </div>
    </Page>
  );
}

function RecipesPage() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  if (!recipes)
    return (
      <Page>
        <Loading />
      </Page>
    );
  return (
    <Page>
      <Header eyebrow="POUR.LOG / 配方" title="配方库" meta="// generic" />
      <section className="content recipe-groups">
        <RecipeGroup title="PRESET" recipes={recipes.filter((r) => r.preset)} />
        <RecipeGroup title="MINE" recipes={recipes.filter((r) => !r.preset)} />
        <Link className="dashed" to="/recipes/new">
          + NEW RECIPE
        </Link>
      </section>
    </Page>
  );
}
function RecipeGroup({ title, recipes }: { title: string; recipes: Recipe[] }) {
  return (
    <section className="recipe-group">
      <h3 className="section-label">{title}</h3>
      <div className="recipe-grid">
        {recipes.map((r) => (
          <Link className="recipe-row" to={`/recipes/${r.id}/edit`} key={r.id}>
            <span>
              <strong>{r.name}</strong>
              <b>{r.method}</b>
            </span>
            <p>
              {r.ratio} · {r.grind} · {r.temp} · {r.time}
            </p>
            <Steps steps={r.steps} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecipeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(
    () => (id ? db.recipes.get(id) : undefined),
    [id],
  );
  const [form, setForm] = useState<Omit<Recipe, "id" | "preset">>({
    name: "",
    method: "热冲",
    ratio: "1:16",
    grind: "中细",
    temp: "90°C",
    pour: "分段注水",
    time: "2:30",
    steps: [],
  });
  useEffect(() => {
    if (existing)
      setForm({
        name: existing.name,
        method: existing.method,
        ratio: existing.ratio,
        grind: existing.grind,
        temp: existing.temp,
        pour: existing.pour,
        time: existing.time,
        steps: existing.steps,
      });
  }, [existing]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await db.recipes.put({
      ...form,
      id: id || uid(),
      preset: existing?.preset || false,
    });
    navigate("/recipes");
  }
  async function remove() {
    if (id) {
      await db.recipes.delete(id);
      navigate("/recipes");
    }
  }
  function addStep() {
    setForm({
      ...form,
      steps: [...form.steps, { t: "0:00", water: "", note: "" }],
    });
  }
  return (
    <Page nav={false}>
      <form className="content form" onSubmit={submit}>
        <Back to="/recipes" />
        <h1>{id ? "编辑配方" : "新建配方"}</h1>
        <Field
          label="名称 NAME"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />
        <Choice
          label="方式 METHOD"
          values={["热冲", "冰冲", "冷萃"]}
          value={form.method}
          onChange={(v) => setForm({ ...form, method: v as BrewMethod })}
        />
        <div className="form-grid">
          <Field
            label="粉水比"
            value={form.ratio}
            onChange={(v) => setForm({ ...form, ratio: v })}
          />
          <Field
            label="研磨"
            value={form.grind}
            onChange={(v) => setForm({ ...form, grind: v })}
          />
          <Field
            label="水温"
            value={form.temp}
            onChange={(v) => setForm({ ...form, temp: v })}
          />
          <Field
            label="总时间"
            value={form.time}
            onChange={(v) => setForm({ ...form, time: v })}
          />
        </div>
        <Field
          label="注水方式"
          value={form.pour}
          onChange={(v) => setForm({ ...form, pour: v })}
        />
        <div className="field">
          <span>// 注水步骤 POUR STEPS</span>
          {form.steps.map((s, i) => (
            <div className="step-input" key={i}>
              <input
                value={s.t}
                onChange={(e) =>
                  setForm({
                    ...form,
                    steps: form.steps.map((x, n) =>
                      n === i ? { ...x, t: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                value={s.water}
                placeholder="0→40g"
                onChange={(e) =>
                  setForm({
                    ...form,
                    steps: form.steps.map((x, n) =>
                      n === i ? { ...x, water: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                value={s.note}
                placeholder="闷蒸"
                onChange={(e) =>
                  setForm({
                    ...form,
                    steps: form.steps.map((x, n) =>
                      n === i ? { ...x, note: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    steps: form.steps.filter((_, n) => n !== i),
                  })
                }
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="ghost full" onClick={addStep}>
            + 添加步骤
          </button>
        </div>
        {id && !existing?.preset && (
          <button type="button" className="danger full" onClick={remove}>
            ✕ 删除这个配方
          </button>
        )}
        <button className="primary full">▸ 保存配方</button>
      </form>
    </Page>
  );
}

function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get("main"), []);
  const navigate = useNavigate();
  const [form, setForm] = useState<AppSettings>({
    id: "main",
    apiBase: "",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);
  if (!settings)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  async function save(e: FormEvent) {
    e.preventDefault();
    await db.settings.put({
      ...form,
      apiBase: form.apiBase.trim().replace(/\/+$/, ""),
      apiKey: form.apiKey.trim(),
      model: form.model.trim() || "gpt-4o-mini",
    });
    navigate("/beans");
  }
  async function test() {
    if (!form.apiBase || !form.apiKey) {
      setMessage("⚠ 请先填写 Base URL 和 API Key");
      return;
    }
    setTesting(true);
    setMessage("");
    try {
      await callAI(form, [
        { role: "user", content: '严格只回复 JSON：{"ok":true}' },
      ]);
      await db.settings.put(form);
      setMessage("✓ 连接成功，已保存");
    } catch (e) {
      setMessage(`✕ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  }
  return (
    <Page nav={false}>
      <form className="content form" onSubmit={save}>
        <Back to="/beans" />
        <h1>AI 设置</h1>
        <p className="muted">// OpenAI 兼容接口 · 数据仅存本地浏览器</p>
        <div className={`status ${form.apiBase && form.apiKey ? "ready" : ""}`}>
          {form.apiBase && form.apiKey
            ? `● 已配置 · ${form.model}`
            : "○ 未配置 · AI 使用本地规则"}
        </div>
        <Field
          label="BASE URL"
          value={form.apiBase}
          placeholder="https://api.openai.com/v1"
          onChange={(v) => setForm({ ...form, apiBase: v })}
        />
        <small className="hint">末尾含 /v1，自动补 /chat/completions</small>
        <Field
          label="API KEY"
          type="password"
          value={form.apiKey}
          placeholder="sk-..."
          onChange={(v) => setForm({ ...form, apiKey: v })}
        />
        <Field
          label="MODEL"
          value={form.model}
          placeholder="gpt-4o-mini"
          onChange={(v) => setForm({ ...form, model: v })}
        />
        <button
          type="button"
          className="dark full"
          disabled={testing}
          onClick={test}
        >
          {testing ? "↻ 连接中…" : "↻ 测试连接"}
        </button>
        {message && (
          <p className={message.startsWith("✓") ? "success" : "error"}>
            {message}
          </p>
        )}
        <p className="security-note">
          API Key 会保存在当前浏览器的 IndexedDB
          中。请只在私人设备上使用，不要配置来源不可信的接口地址。
        </p>
        <button className="primary full">▸ 保存设置</button>
      </form>
    </Page>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/beans" replace />} />
      <Route path="/beans" element={<BeansPage />} />
      <Route path="/beans/new" element={<BeanForm />} />
      <Route path="/beans/:id" element={<BeanDetail />} />
      <Route path="/beans/:id/edit" element={<BeanForm />} />
      <Route path="/brew/:beanId" element={<BrewPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/journal/:id" element={<JournalDetail />} />
      <Route path="/recipes" element={<RecipesPage />} />
      <Route path="/recipes/new" element={<RecipeForm />} />
      <Route path="/recipes/:id/edit" element={<RecipeForm />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/beans" replace />} />
    </Routes>
  );
}
