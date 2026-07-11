import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  dimensionMeta,
  type BrewDimensions,
  type PourStep,
  type RecipeContent,
  formatDuration,
  formatRatio,
  formatTemperature,
} from "./models";

export function Loading() {
  return <div className="empty">// LOADING...</div>;
}

export function Page({
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
        <NavLink to="/simulator">
          <b>04</b>
          <span>
            冲煮实验室<small>SIMULATOR</small>
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

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/beans">BEANS</NavLink>
      <NavLink to="/journal">JOURNAL</NavLink>
      <NavLink to="/recipes">RECIPES</NavLink>
      <NavLink to="/simulator">LAB</NavLink>
    </nav>
  );
}

export function Header({
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

export function Back({ to, label = "‹ 返回" }: { to: string; label?: string }) {
  return (
    <Link className="back" to={to}>
      {label}
    </Link>
  );
}

export function NotFound({ message }: { message: string }) {
  return (
    <Page nav={false}>
      <section className="content form">
        <Back to="/beans" />
        <div className="empty">// {message}</div>
      </section>
    </Page>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        required={required}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Choice({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice">
        {values.map((option) => (
          <button
            type="button"
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Specs({ recipe }: { recipe: RecipeContent }) {
  const specs = [
    ["粉水比", `1:${formatRatio(recipe)}`],
    ["咖啡粉", `${recipe.coffeeGrams}g`],
    ["冲煮水", `${recipe.brewWaterGrams}g`],
    ...(recipe.method === "冰冲" || recipe.iceGrams
      ? [["冰", `${recipe.iceGrams}g`]]
      : []),
    ["研磨", recipe.grind],
    ["水温", formatTemperature(recipe.temperatureC)],
    ["注水", recipe.pour || "—"],
    ["总时间", formatDuration(recipe.durationSeconds)],
    ["方式", recipe.method],
  ];
  return (
    <div className="spec-grid">
      {specs.map(([key, value]) => (
        <div key={key}>
          <small>{key}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Steps({ steps }: { steps: PourStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="steps">
      {steps.map((step, index) => (
        <div className="step" key={`${index}-${step.atSeconds}`}>
          <b>{index + 1}</b>
          <span>{formatDuration(step.atSeconds)}</span>
          <strong>→ {step.targetWaterGrams}g</strong>
          <em>{step.note}</em>
        </div>
      ))}
    </div>
  );
}

export function DimensionBars({ dims }: { dims: BrewDimensions }) {
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
