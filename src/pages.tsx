import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  analyzeCup,
  localAnalysis,
  localSuggestion,
  suggestRecipe,
} from "./ai";
import { db, nextBeanNumber, uid } from "./db";
import {
  Back,
  Choice,
  DimensionBars,
  Field,
  Header,
  Loading,
  NotFound,
  Page,
  Specs,
  Steps,
} from "./ui";
import {
  dimensionMeta,
  type AnalysisResult,
  type Bean,
  type BrewDimensions,
  type BrewMethod,
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

export function BeansPage() {
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

export function BeanDetail() {
  const { id } = useParams();
  const bean = useLiveQuery(
    () => (id ? db.beans.get(id) : undefined),
    [id],
    null,
  );
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);
  const journals = useLiveQuery(
    () =>
      id
        ? db.journals.where("beanId").equals(id).reverse().sortBy("createdAt")
        : [],
    [id],
  );
  const settings = useLiveQuery(() => db.settings.get("main"), [], null);
  const [method, setMethod] = useState<BrewMethod>("热冲");
  const [suggestion, setSuggestion] = useState<RecipeSuggestion>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (bean === null || !recipes || !journals || settings === null)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!bean) return <NotFound message="豆子不存在或已被删除" />;
  if (!settings) return <NotFound message="应用设置不存在" />;
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

export function BeanForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(
    () => (id ? db.beans.get(id) : undefined),
    [id],
    null,
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
  if (count === undefined || (id && existing === null))
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (id && !existing) return <NotFound message="豆子不存在或已被删除" />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const beanId = id || uid();
    await db.transaction("rw", db.beans, async () => {
      const no = existing?.no || (await nextBeanNumber());
      await db.beans.put({ ...form, id: beanId, no });
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

export function JournalPage() {
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

export function JournalDetail() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const journal = useLiveQuery(
    () => (id ? db.journals.get(id) : undefined),
    [id],
    null,
  );
  const bean = useLiveQuery(
    () => (journal ? db.beans.get(journal.beanId) : undefined),
    [journal?.beanId],
    null,
  );
  const settings = useLiveQuery(() => db.settings.get("main"), [], null);
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
  if (
    journal === null ||
    settings === null ||
    (journal !== undefined && bean === null)
  )
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!journal) return <NotFound message="日记不存在或已被删除" />;
  if (!bean) return <NotFound message="这篇日记关联的豆子不存在" />;
  if (!settings) return <NotFound message="应用设置不存在" />;
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

export function BrewPage() {
  const { beanId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const bean = useLiveQuery(
    () => (beanId ? db.beans.get(beanId) : undefined),
    [beanId],
    null,
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
  if (bean === null || !recipes)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!bean) return <NotFound message="豆子不存在或已被删除" />;
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

export function RecipesPage() {
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

export function RecipeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useLiveQuery(
    () => (id ? db.recipes.get(id) : undefined),
    [id],
    null,
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
  if (id && existing === null)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (id && !existing) return <NotFound message="配方不存在或已被删除" />;
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
