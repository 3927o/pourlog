import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
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
import {
  db,
  deleteBean,
  deleteJournal,
  deleteRecipe,
  nextBeanNumber,
  saveContentAsRecipe,
  uid,
} from "./db";
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
  beanFingerprint,
  cloneRecipeContent,
  dimensionMeta,
  formatDuration,
  formatRatio,
  formatTemperature,
  recipeSnapshotFrom,
  type AiSuggestion,
  type AnalysisResult,
  type Bean,
  type BrewDimensions,
  type BrewMethod,
  type RecipeContent,
  type RecipeSnapshot,
  type SavedRecipe,
} from "./models";
import {
  buildExperimentPlan,
  experimentImpacts,
  simulatorSupportsRecipe,
  type ExperimentImpact,
} from "./simulator/experiment";

const defaultDims: BrewDimensions = {
  acid: 3,
  sweet: 3,
  bitter: 3,
  clean: 3,
  finish: 3,
  body: 3,
};
const emptyContent: RecipeContent = {
  method: "热冲",
  coffeeGrams: 15,
  brewWaterGrams: 240,
  iceGrams: 0,
  grind: "中细",
  temperatureC: 90,
  durationSeconds: 150,
  pour: "三段注水",
  steps: [],
};

function dateLabel(value: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" })
    .format(value)
    .replace("/", ".");
}

function recipeLine(recipe: RecipeContent) {
  return `1:${formatRatio(recipe)} · ${recipe.coffeeGrams}g 粉 · ${recipe.brewWaterGrams}g 水${recipe.iceGrams ? ` · ${recipe.iceGrams}g 冰` : ""} · ${recipe.grind} · ${formatTemperature(recipe.temperatureC)} · ${formatDuration(recipe.durationSeconds)}`;
}

function validateContent(content: RecipeContent) {
  if (!(content.coffeeGrams > 0)) return "咖啡粉克重必须大于 0";
  if (!(content.brewWaterGrams > 0)) return "冲煮水克重必须大于 0";
  if (!(content.iceGrams >= 0)) return "冰克重不能小于 0";
  if (!(content.durationSeconds > 0)) return "总时间必须大于 0";
  if (content.method !== "冷萃" && content.temperatureC === null)
    return "热冲和冰冲需要填写水温";
  return "";
}

interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  returnFocus?: HTMLElement | null;
  resolve: (confirmed: boolean) => void;
}

function AppDialog({
  title,
  children,
  onClose,
  actions,
  dismissOnBackdrop = true,
  returnFocusTo,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: ReactNode;
  dismissOnBackdrop?: boolean;
  returnFocusTo?: HTMLElement | null;
}) {
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    restoreFocusRef.current =
      returnFocusTo ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      restoreFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget)
          onClose();
      }}
    >
      <section
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <p>// POUR.LOG NOTICE</p>
          <h2 id="app-dialog-title">{title}</h2>
          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        <footer>{actions}</footer>
      </section>
    </div>
  );
}

function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest>();

  function ask(options: Omit<ConfirmRequest, "resolve">) {
    return new Promise<boolean>((resolve) =>
      setRequest({
        ...options,
        returnFocus:
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
        resolve,
      }),
    );
  }

  function finish(confirmed: boolean) {
    request?.resolve(confirmed);
    setRequest(undefined);
  }

  return {
    ask,
    element: request ? (
      <AppDialog
        title={request.title}
        onClose={() => finish(false)}
        dismissOnBackdrop={!request.danger}
        returnFocusTo={request.returnFocus}
        actions={
          <>
            <button
              type="button"
              className="ghost"
              autoFocus
              onClick={() => finish(false)}
            >
              取消
            </button>
            <button
              type="button"
              className={request.danger ? "danger solid" : "primary"}
              onClick={() => finish(true)}
            >
              {request.confirmLabel || "确认"}
            </button>
          </>
        }
      >
        <p>{request.message}</p>
      </AppDialog>
    ) : null,
  };
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
  const journalIds = new Set(journals.map((journal) => journal.id));
  return (
    <Page>
      <Header
        eyebrow="POUR.LOG / 手冲陪学"
        title="豆样本库"
        meta={`n = ${beans.length}`}
      />
      <section className="content cards bean-grid">
        {beans.map((bean) => (
          <article className="bean-card" key={bean.id}>
            <Link className="card-link" to={`/beans/${bean.id}`}>
              <div className="card-meta">
                <span>
                  [{bean.no}] {bean.process} · {bean.roast} · {bean.roastDate}
                </span>
                <span>
                  n=
                  {
                    journals.filter((journal) => journal.beanId === bean.id)
                      .length
                  }
                </span>
              </div>
              <h2>
                {bean.name}
                {bean.bestJournalId && journalIds.has(bean.bestJournalId) && (
                  <b className="best">★BEST</b>
                )}
              </h2>
              <p className="origin">{bean.origin}</p>
              <div className="tags">
                {bean.flavors.map((flavor) => (
                  <span key={flavor}>{flavor}</span>
                ))}
              </div>
            </Link>
            <Link className="primary small" to={`/brew/${bean.id}`}>
              ▸ RUN BREW
            </Link>
          </article>
        ))}
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
  const journals = useLiveQuery(
    () =>
      id
        ? db.journals.where("beanId").equals(id).reverse().sortBy("createdAt")
        : [],
    [id],
  );
  const suggestions = useLiveQuery(
    () => (id ? db.aiSuggestions.where("beanId").equals(id).toArray() : []),
    [id],
  );
  const settings = useLiveQuery(() => db.settings.get("main"), [], null);
  const [method, setMethod] = useState<BrewMethod>("热冲");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      bean?.bestJournalId &&
      journals &&
      !journals.some((journal) => journal.id === bean.bestJournalId)
    ) {
      void db.beans.update(bean.id, { bestJournalId: undefined });
    }
  }, [bean, journals]);
  if (bean === null || !journals || !suggestions || settings === null)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!bean) return <NotFound message="豆子不存在或已被删除" />;
  if (!settings) return <NotFound message="应用设置不存在" />;
  const currentBean = bean;
  const currentSettings = settings;
  const currentSuggestion = suggestions.find((item) => item.method === method);
  const best = journals.find(
    (journal) => journal.id === currentBean.bestJournalId,
  );

  async function generate(local = false) {
    setLoading(true);
    setError("");
    try {
      const result =
        local || !currentSettings.apiBase || !currentSettings.apiKey
          ? localSuggestion(currentBean, method)
          : await suggestRecipe(currentSettings, currentBean, method);
      const record: AiSuggestion = {
        id: `${currentBean.id}:${method}`,
        beanId: currentBean.id,
        method,
        content: cloneRecipeContent(result.content),
        why: result.why,
        source: result.source,
        generatedAt: Date.now(),
        beanFingerprint: beanFingerprint(currentBean),
      };
      await db.aiSuggestions.put(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveSuggestion() {
    if (!currentSuggestion || currentSuggestion.savedRecipeId) return;
    setLoading(true);
    try {
      const recipe = await saveContentAsRecipe(
        `${currentBean.name} · AI ${method}`,
        currentSuggestion.content,
        { type: "ai", sourceId: currentSuggestion.id },
      );
      await db.aiSuggestions.update(currentSuggestion.id, {
        savedRecipeId: recipe.id,
      });
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
              {bean.flavors.map((flavor) => (
                <span key={flavor}>{flavor}</span>
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
            <section className="optimal best-cup">
              <small>★ BEST CUP · {dateLabel(best.createdAt)}</small>
              <strong>{best.recipeSnapshot.name}</strong>
              <span>{recipeLine(best.recipeSnapshot)}</span>
              <DimensionBars dims={best.dims} />
              {best.notes && <p>{best.notes}</p>}
              <div className="inline-actions">
                <Link className="ghost" to={`/journal/${best.id}`}>
                  查看最佳杯记录
                </Link>
                <Link
                  className="primary"
                  to={`/brew/${bean.id}?sourceJournal=${best.id}&best=1`}
                >
                  用最佳配方再冲一杯
                </Link>
              </div>
            </section>
          )}
          <section className="ai-panel">
            <h3>◇ AI SUGGEST RECIPE</h3>
            <div className="pills">
              {(["热冲", "冰冲", "冷萃"] as BrewMethod[]).map((value) => (
                <button
                  type="button"
                  className={method === value ? "selected" : ""}
                  onClick={() => {
                    setMethod(value);
                    setError("");
                  }}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              className="dark full"
              disabled={loading}
              onClick={() => generate()}
            >
              {loading
                ? "▮▮▮ 生成中..."
                : currentSuggestion
                  ? "↻ 重新生成"
                  : "生成推荐配方"}
            </button>
            {error && (
              <>
                <p className="error">⚠ {error}</p>
                <button className="ghost full" onClick={() => generate(true)}>
                  使用本地规则
                </button>
              </>
            )}
            {currentSuggestion && (
              <div className="suggestion">
                {currentSuggestion.beanFingerprint !==
                  beanFingerprint(bean) && (
                  <p className="warning">豆子资料在本推荐生成后发生过变化。</p>
                )}
                <strong>{recipeLine(currentSuggestion.content)}</strong>
                <Steps steps={currentSuggestion.content.steps} />
                <p>{currentSuggestion.why}</p>
                <small>
                  //{" "}
                  {currentSuggestion.source === "ai" ? "AI 生成" : "本地规则"} ·{" "}
                  {new Date(currentSuggestion.generatedAt).toLocaleString(
                    "zh-CN",
                  )}
                </small>
                {currentSuggestion.savedRecipeId ? (
                  <Link
                    className="ghost full"
                    to={`/recipes/${currentSuggestion.savedRecipeId}/edit`}
                  >
                    已保存到配方库 · 查看
                  </Link>
                ) : (
                  <button
                    className="primary full"
                    disabled={loading}
                    onClick={saveSuggestion}
                  >
                    一键保存到配方库
                  </button>
                )}
              </div>
            )}
          </section>
          <section className="history-panel">
            <h3 className="section-label">LOG HISTORY · {journals.length}</h3>
            {journals.map((journal) => (
              <Link
                className="log-row"
                to={`/journal/${journal.id}`}
                key={journal.id}
              >
                <span>
                  <strong>{journal.recipeSnapshot.name}</strong>
                  <small>{dateLabel(journal.createdAt)}</small>
                </span>
                <DimensionBars dims={journal.dims} />
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
  const confirmDialog = useConfirmDialog();
  const existing = useLiveQuery(
    () => (id ? db.beans.get(id) : undefined),
    [id],
    null,
  );
  const impact = useLiveQuery(
    async () =>
      id
        ? {
            journals: await db.journals.where("beanId").equals(id).count(),
            suggestions: await db.aiSuggestions
              .where("beanId")
              .equals(id)
              .count(),
          }
        : { journals: 0, suggestions: 0 },
    [id],
  );
  const [form, setForm] = useState({
    name: "",
    origin: "",
    process: "水洗",
    roast: "浅烘",
    roastDate: "",
    flavors: [] as string[],
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
      });
  }, [existing]);
  if ((id && existing === null) || !impact)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (id && !existing) return <NotFound message="豆子不存在或已被删除" />;
  const currentImpact = impact;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const beanId = id || uid();
    await db.beans.put({
      ...form,
      id: beanId,
      no: existing?.no || (await nextBeanNumber()),
      bestJournalId: existing?.bestJournalId,
    });
    navigate(`/beans/${beanId}`);
  }
  async function remove() {
    if (!id || !existing) return;
    const confirmed = await confirmDialog.ask({
      title: `删除“${existing.name}”？`,
      message: `这会同时永久删除 ${currentImpact.journals} 篇冲煮日记和 ${currentImpact.suggestions} 条 AI 推荐，且无法撤销。`,
      confirmLabel: "永久删除",
      danger: true,
    });
    if (!confirmed) return;
    await deleteBean(id);
    navigate("/beans");
  }
  return (
    <>
      <Page nav={false}>
        <form className="content form" onSubmit={submit}>
          <Back to={id ? `/beans/${id}` : "/beans"} />
          <h1>{id ? "编辑豆子" : "录入豆子"}</h1>
          <Field
            label="名称 NAME"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
          />
          <Field
            label="产区 ORIGIN"
            value={form.origin}
            onChange={(origin) => setForm({ ...form, origin })}
          />
          <Choice
            label="处理法 PROCESS"
            values={["水洗", "日晒", "蜜处理"]}
            value={form.process}
            onChange={(process) => setForm({ ...form, process })}
          />
          <Choice
            label="烘焙度 ROAST"
            values={["浅烘", "中烘", "深烘"]}
            value={form.roast}
            onChange={(roast) => setForm({ ...form, roast })}
          />
          <Field
            label="烘焙日 ROAST DATE"
            value={form.roastDate}
            placeholder="06.28"
            onChange={(roastDate) => setForm({ ...form, roastDate })}
          />
          <Field
            label="风味 FLAVORS · 逗号分隔"
            value={form.flavors.join(",")}
            onChange={(value) =>
              setForm({
                ...form,
                flavors: value
                  .split(/[,，]/)
                  .map((item) => item.trim())
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
      {confirmDialog.element}
    </>
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
        {journals.map((journal) => {
          const bean = beans.find((item) => item.id === journal.beanId);
          return (
            <Link
              className="journal-card"
              to={`/journal/${journal.id}`}
              key={journal.id}
            >
              <div>
                <h2>{bean?.name || "已删除豆子"}</h2>
                <span>{dateLabel(journal.createdAt)} ›</span>
              </div>
              <p>
                <b>{journal.recipeSnapshot.method}</b>
                {journal.recipeSnapshot.name}
              </p>
              <DimensionBars dims={journal.dims} />
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
  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
  const currentJournal = journal;
  const currentBean = bean;
  async function remove() {
    const extra =
      currentBean.bestJournalId === currentJournal.id
        ? "删除后将同时清除这支豆的最佳杯标记。"
        : "";
    const confirmed = await confirmDialog.ask({
      title: "删除这篇日记？",
      message: `此操作无法撤销。${extra}`,
      confirmLabel: "删除日记",
      danger: true,
    });
    if (!confirmed) return;
    await deleteJournal(currentJournal);
    navigate("/journal");
  }
  async function toggleBest() {
    await db.beans.update(currentBean.id, {
      bestJournalId:
        currentBean.bestJournalId === currentJournal.id
          ? undefined
          : currentJournal.id,
    });
  }
  async function saveAsRecipe() {
    if (currentJournal.savedAsRecipeId) return;
    setLoading(true);
    try {
      const saved = await saveContentAsRecipe(
        currentJournal.recipeSnapshot.name ||
          `${currentBean.name} · ${dateLabel(currentJournal.createdAt)}`,
        currentJournal.recipeSnapshot,
        { type: "journal", sourceId: currentJournal.id },
      );
      await db.journals.update(currentJournal.id, {
        savedAsRecipeId: saved.id,
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
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
                {bean.bestJournalId === journal.id
                  ? "★ 已是最佳杯 · 点击取消"
                  : "☆ 标为这支豆的最佳杯"}
              </button>
              {journal.savedAsRecipeId ? (
                <Link
                  className="ghost full"
                  to={`/recipes/${journal.savedAsRecipeId}/edit`}
                >
                  已保存到配方库 · 查看
                </Link>
              ) : (
                <button
                  className="ghost full"
                  disabled={loading}
                  onClick={saveAsRecipe}
                >
                  另存到配方库
                </button>
              )}
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
              {loading && <div className="loading-box">▮▮▮ 处理中...</div>}
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
              {!journal.aiReview && !loading && !error && (
                <button className="dark full" onClick={() => generate()}>
                  {settings.apiBase && settings.apiKey
                    ? "◇ 生成复盘建议"
                    : "◇ 使用本地规则生成建议"}
                </button>
              )}
              {journal.aiReview && (
                <Analysis
                  result={journal.aiReview}
                  bean={bean}
                  recipe={journal.recipeSnapshot}
                />
              )}
              {journal.aiReview &&
                simulatorSupportsRecipe(journal.recipeSnapshot) && (
                  <Link
                    className="primary full"
                    to={`/simulator?journal=${journal.id}`}
                  >
                    ▸ 去实验室验证这条建议
                  </Link>
                )}
              {journal.aiReview && (
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
            to={`/brew/${bean.id}?sourceJournal=${journal.id}`}
          >
            ▸ 用此配方再冲一杯
          </Link>
        </div>
      </Page>
      {confirmDialog.element}
    </>
  );
}

function ImpactPreview({ impacts }: { impacts: ExperimentImpact[] }) {
  return (
    <div className="experiment-impact-preview">
      {impacts.map((impact) => (
        <div
          className={
            impact.delta === 0 ? "same" : impact.delta > 0 ? "up" : "down"
          }
          key={impact.key}
        >
          <span>{impact.label}</span>
          <b>
            {impact.delta === 0
              ? "—"
              : `${impact.delta > 0 ? "↑" : "↓"}${Math.abs(impact.delta)}`}
          </b>
          <small>
            {impact.before} → {impact.after}
          </small>
        </div>
      ))}
    </div>
  );
}

function Analysis({
  result,
  bean,
  recipe,
}: {
  result: AnalysisResult;
  bean: Bean;
  recipe: RecipeContent;
}) {
  const simulatorSupported = simulatorSupportsRecipe(recipe);
  const plan = simulatorSupported
    ? buildExperimentPlan(bean, recipe, result)
    : null;
  const impacts = plan?.supported ? experimentImpacts(plan) : [];
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
      {impacts.length > 0 && (
        <section className="analysis-impact">
          <small>实验室模型预演 · 进入后保持一致</small>
          <ImpactPreview impacts={impacts} />
        </section>
      )}
      {!simulatorSupported && (
        <p className="analysis-model-limit">
          实验室模型当前只支持热冲，暂不模拟{recipe.method}的影响。
        </p>
      )}
      <em>// {result.principle}</em>
      {result.advanced.length > 0 && (
        <details>
          <summary>进阶微调</summary>
          {result.advanced.map((item) => (
            <div key={item}>· {item}</div>
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
  const confirmDialog = useConfirmDialog();
  const bean = useLiveQuery(
    () => (beanId ? db.beans.get(beanId) : undefined),
    [beanId],
    null,
  );
  const recipes = useLiveQuery(
    () => db.recipes.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  const sourceJournalId = search.get("sourceJournal");
  const sourceJournal = useLiveQuery(
    () => (sourceJournalId ? db.journals.get(sourceJournalId) : undefined),
    [sourceJournalId],
    null,
  );
  const [draft, setDraft] = useState<RecipeSnapshot>({
    name: "本次手冲",
    ...cloneRecipeContent(emptyContent),
    source: { type: "manual" },
  });
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(1);
  const [dims, setDims] = useState(defaultDims);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dimensionInfo, setDimensionInfo] =
    useState<(typeof dimensionMeta)[number]>();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialized || !recipes || (sourceJournalId && !sourceJournal)) return;
    if (sourceJournal)
      setDraft({
        ...sourceJournal.recipeSnapshot,
        steps: sourceJournal.recipeSnapshot.steps.map((item) => ({ ...item })),
        source: {
          type: search.get("best") === "1" ? "best-journal" : "manual",
          sourceId: sourceJournal.id,
        },
      });
    setInitialized(true);
  }, [initialized, recipes, sourceJournalId, sourceJournal, search]);
  if (bean === null || !recipes || (sourceJournalId && sourceJournal === null))
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (!bean) return <NotFound message="豆子不存在或已被删除" />;
  if (sourceJournalId && !sourceJournal)
    return <NotFound message="来源日记不存在或已被删除" />;
  const currentBean = bean;
  async function chooseRecipe(recipe: SavedRecipe) {
    if (dirty) {
      const confirmed = await confirmDialog.ask({
        title: "切换快速填充配方？",
        message: "当前修改尚未保存，切换后将覆盖这些参数。",
        confirmLabel: "覆盖并切换",
      });
      if (!confirmed) return;
    }
    setDraft(recipeSnapshotFrom(recipe));
    setDirty(false);
    setError("");
  }
  function updateDraft(next: RecipeSnapshot) {
    setDraft(next);
    setDirty(true);
  }
  async function save() {
    const validation = validateContent(draft);
    if (validation) {
      setError(validation);
      setStep(1);
      return;
    }
    const lastWater = draft.steps.at(-1)?.targetWaterGrams ?? 0;
    if (lastWater > draft.brewWaterGrams) {
      const confirmed = await confirmDialog.ask({
        title: "注水量与配方不一致",
        message: `最后一步累计注水 ${lastWater}g，超过冲煮水 ${draft.brewWaterGrams}g。浸泡、旁路水等特殊配方可以继续保存。`,
        confirmLabel: "仍然保存",
      });
      if (!confirmed) {
        setStep(1);
        return;
      }
    }
    setSaving(true);
    const id = uid();
    try {
      await db.journals.add({
        id,
        beanId: currentBean.id,
        recipeSnapshot: {
          ...draft,
          steps: draft.steps.map((item) => ({ ...item })),
        },
        createdAt: Date.now(),
        dims,
        notes,
      });
      navigate(`/journal/${id}?generate=1`);
    } finally {
      setSaving(false);
    }
  }
  const basic = dimensionMeta.slice(0, 3);
  const advanced = dimensionMeta.slice(3);
  return (
    <>
      <Page nav={false}>
        <section className="content detail brew-page">
          <Back to={`/beans/${bean.id}`} />
          <h1>新建日记</h1>
          {sourceJournal && (
            <p className="status ready">
              参数来自 {dateLabel(sourceJournal.createdAt)} 的
              {search.get("best") === "1" ? "最佳杯" : "历史冲煮"}
            </p>
          )}
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
              <h3 className="section-label">配方库 · 快速填充</h3>
              {recipes.length ? (
                <div className="pills wrap">
                  {recipes.map((recipe) => (
                    <button
                      type="button"
                      className={
                        draft.source.sourceId === recipe.id ? "selected" : ""
                      }
                      onClick={() => void chooseRecipe(recipe)}
                      key={recipe.id}
                    >
                      {recipe.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">配方库为空，可直接填写本次参数。</p>
              )}
              <RecipeEditor value={draft} onChange={updateDraft} />
              {error && <p className="error">⚠ {error}</p>}
            </section>
            <section
              className={`brew-stage score-stage ${step === 2 ? "mobile-active" : ""}`}
            >
              <div className="selected-sample desktop-summary">
                {bean.name}
                <small>{draft.name}</small>
              </div>
              <h3 className="section-label">// RECORD CUP · 基础感受</h3>
              {basic.map((item) => (
                <DimensionSlider
                  key={item.key}
                  item={item}
                  dims={dims}
                  onChange={(value) => setDims({ ...dims, [item.key]: value })}
                  onExplain={() => setDimensionInfo(item)}
                />
              ))}
              <details
                className="advanced-dims"
                open={advancedOpen}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary>
                  进阶感受 ·{" "}
                  {advanced
                    .map((item) => `${item.name} ${dims[item.key]}`)
                    .join(" / ")}
                </summary>
                {advanced.map((item) => (
                  <DimensionSlider
                    key={item.key}
                    item={item}
                    dims={dims}
                    onChange={(value) =>
                      setDims({ ...dims, [item.key]: value })
                    }
                    onExplain={() => setDimensionInfo(item)}
                  />
                ))}
              </details>
              <label className="field">
                <span>NOTES</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
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
              <button className="primary full" disabled={saving} onClick={save}>
                ▸ SAVE + ANALYZE
              </button>
            )}
          </div>
          <button
            className="primary full desktop-save"
            disabled={saving}
            onClick={save}
          >
            ▸ SAVE + ANALYZE
          </button>
        </div>
      </Page>
      {confirmDialog.element}
      {dimensionInfo && (
        <AppDialog
          title={`${dimensionInfo.name}怎么评？`}
          onClose={() => setDimensionInfo(undefined)}
          actions={
            <button
              type="button"
              className="primary"
              onClick={() => setDimensionInfo(undefined)}
            >
              知道了
            </button>
          }
        >
          <p>{dimensionInfo.detail}</p>
          <ol className="dimension-levels">
            {dimensionInfo.levels.map((level, index) => (
              <li key={level}>
                <b>{index + 1}</b>
                <span>
                  <strong>{level}</strong>
                  {dimensionInfo.levelDescriptions[index]}
                </span>
              </li>
            ))}
          </ol>
        </AppDialog>
      )}
    </>
  );
}

function DimensionSlider({
  item,
  dims,
  onChange,
  onExplain,
}: {
  item: (typeof dimensionMeta)[number];
  dims: BrewDimensions;
  onChange: (value: number) => void;
  onExplain: () => void;
}) {
  const value = dims[item.key];
  const progress = `${((value - 1) / 4) * 100}%`;
  return (
    <div className="slider">
      <div className="slider-head">
        <b>[{item.name}]</b>
        <strong>
          {value}/5 · {item.levels[value - 1]}
        </strong>
      </div>
      <div className="slider-description">
        <p>{item.description}</p>
        <button
          type="button"
          onClick={onExplain}
          aria-label={`查看${item.name}说明`}
        >
          i
        </button>
      </div>
      <div
        className="slider-control"
        style={{ "--slider-progress": progress } as CSSProperties}
      >
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={value}
          aria-label={item.name}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="slider-ticks" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((tick) => (
            <i key={tick} />
          ))}
        </div>
      </div>
      <div className="slider-scale">
        <span className="scale-min">1 · {item.levels[0]}</span>
        {value > 1 && value < 5 && (
          <strong style={{ left: progress }}>
            {value} · {item.levels[value - 1]}
          </strong>
        )}
        <span className="scale-max">5 · {item.levels[4]}</span>
      </div>
    </div>
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
      <Header
        eyebrow="POUR.LOG / 配方"
        title="配方库"
        meta={`n = ${recipes.length}`}
      />
      <section className="content recipe-library">
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <Link
              className="recipe-row"
              to={`/recipes/${recipe.id}/edit`}
              key={recipe.id}
            >
              <span>
                <strong>{recipe.name}</strong>
                <b>{recipe.method}</b>
                {recipe.needsReview && <em>待确认</em>}
              </span>
              <p>{recipeLine(recipe)}</p>
              <Steps steps={recipe.steps} />
            </Link>
          ))}
        </div>
        <Link className="dashed" to="/recipes/new">
          + NEW RECIPE
        </Link>
      </section>
    </Page>
  );
}

export function RecipeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();
  const existing = useLiveQuery(
    () => (id ? db.recipes.get(id) : undefined),
    [id],
    null,
  );
  const [form, setForm] = useState({
    name: "",
    ...cloneRecipeContent(emptyContent),
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (existing)
      setForm({ name: existing.name, ...cloneRecipeContent(existing) });
  }, [existing]);
  if (id && existing === null)
    return (
      <Page nav={false}>
        <Loading />
      </Page>
    );
  if (id && !existing) return <NotFound message="配方不存在或已被删除" />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateContent(form);
    if (validation) {
      setError(validation);
      return;
    }
    const timestamp = Date.now();
    await db.recipes.put({
      ...form,
      id: id || uid(),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      source: existing?.source,
    });
    navigate("/recipes");
  }
  async function remove() {
    if (!id || !existing) return;
    const confirmed = await confirmDialog.ask({
      title: "删除这个配方？",
      message: "历史日记会保留独立快照，但这个配方将永久删除。",
      confirmLabel: "删除配方",
      danger: true,
    });
    if (!confirmed) return;
    await deleteRecipe(id);
    navigate("/recipes");
  }
  return (
    <>
      <Page nav={false}>
        <form className="content form" onSubmit={submit}>
          <Back to="/recipes" />
          <h1>{id ? "编辑配方" : "新建配方"}</h1>
          {existing?.needsReview && (
            <p className="warning">
              此配方由旧数据迁移而来，请确认克重和时间后保存。
            </p>
          )}
          <Field
            label="名称 NAME"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
          />
          <RecipeEditor value={form} onChange={setForm} />
          {error && <p className="error">⚠ {error}</p>}
          {id && (
            <button type="button" className="danger full" onClick={remove}>
              ✕ 删除这个配方
            </button>
          )}
          <button className="primary full">▸ 保存配方</button>
        </form>
      </Page>
      {confirmDialog.element}
    </>
  );
}

function RecipeEditor<T extends RecipeContent>({
  value,
  onChange,
}: {
  value: T;
  onChange: (value: T) => void;
}) {
  const setNumber = (
    key: "coffeeGrams" | "brewWaterGrams" | "iceGrams" | "durationSeconds",
    input: string,
  ) => onChange({ ...value, [key]: Number(input) } as T);
  return (
    <div className="recipe-editor">
      <Choice
        label="方式 METHOD"
        values={["热冲", "冰冲", "冷萃"]}
        value={value.method}
        onChange={(method) =>
          onChange({
            ...value,
            method: method as BrewMethod,
            temperatureC: method === "冷萃" ? null : (value.temperatureC ?? 90),
            iceGrams: method === "冰冲" ? value.iceGrams : 0,
          } as T)
        }
      />
      <p className="ratio-readout">
        粉水比 1:{formatRatio(value)} · 总用水{" "}
        {value.brewWaterGrams + value.iceGrams}g
      </p>
      <div className="form-grid">
        <Field
          label="咖啡粉 g"
          type="number"
          value={String(value.coffeeGrams)}
          onChange={(input) => setNumber("coffeeGrams", input)}
        />
        <Field
          label="冲煮水 g"
          type="number"
          value={String(value.brewWaterGrams)}
          onChange={(input) => setNumber("brewWaterGrams", input)}
        />
        {(value.method === "冰冲" || value.iceGrams > 0) && (
          <Field
            label="冰 g"
            type="number"
            value={String(value.iceGrams)}
            onChange={(input) => setNumber("iceGrams", input)}
          />
        )}
        <Field
          label="水温 °C"
          type="number"
          value={value.temperatureC === null ? "" : String(value.temperatureC)}
          placeholder="冷萃可留空"
          required={value.method !== "冷萃"}
          onChange={(input) =>
            onChange({
              ...value,
              temperatureC: input === "" ? null : Number(input),
            } as T)
          }
        />
        <Field
          label="总时间 秒"
          type="number"
          value={String(value.durationSeconds)}
          onChange={(input) => setNumber("durationSeconds", input)}
        />
        <Field
          label="研磨"
          value={value.grind}
          onChange={(grind) => onChange({ ...value, grind } as T)}
        />
      </div>
      <Field
        label="注水方式"
        value={value.pour}
        onChange={(pour) => onChange({ ...value, pour } as T)}
      />
      <div className="field">
        <span>// 注水步骤 · 时间秒 / 累计水量 g / 说明</span>
        {value.steps.map((item, index) => (
          <div className="step-input" key={index}>
            <input
              type="number"
              min="0"
              value={item.atSeconds}
              onChange={(event) =>
                onChange({
                  ...value,
                  steps: value.steps
                    .map((step, current) =>
                      current === index
                        ? { ...step, atSeconds: Number(event.target.value) }
                        : step,
                    )
                    .sort((a, b) => a.atSeconds - b.atSeconds),
                } as T)
              }
            />
            <input
              type="number"
              min="0"
              value={item.targetWaterGrams}
              onChange={(event) =>
                onChange({
                  ...value,
                  steps: value.steps.map((step, current) =>
                    current === index
                      ? {
                          ...step,
                          targetWaterGrams: Number(event.target.value),
                        }
                      : step,
                  ),
                } as T)
              }
            />
            <input
              value={item.note}
              placeholder="闷蒸"
              onChange={(event) =>
                onChange({
                  ...value,
                  steps: value.steps.map((step, current) =>
                    current === index
                      ? { ...step, note: event.target.value }
                      : step,
                  ),
                } as T)
              }
            />
            <button
              type="button"
              aria-label="删除步骤"
              onClick={() =>
                onChange({
                  ...value,
                  steps: value.steps.filter((_, current) => current !== index),
                } as T)
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ghost full"
          onClick={() =>
            onChange({
              ...value,
              steps: [
                ...value.steps,
                { atSeconds: 0, targetWaterGrams: 0, note: "" },
              ],
            } as T)
          }
        >
          + 添加步骤
        </button>
      </div>
    </div>
  );
}
