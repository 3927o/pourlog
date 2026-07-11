export type Roast = "light" | "medium" | "dark";
export type Process = "washed" | "natural";
export type Bloom = "none" | "b30" | "b45";
export type Pours = "p1" | "p3" | "p5";
export type Profile = "front" | "even" | "back";
export type PourStyle = "center" | "spiral" | "edge";
export type Flow = "gentle" | "medium" | "aggr";
export type Stir = "none" | "bloom" | "late";

export interface SimulatorState {
  roast: Roast;
  process: Process;
  grind: number;
  temp: number;
  ratio: number;
  minerals: number;
  bloom: Bloom;
  pours: Pours;
  profile: Profile;
  style: PourStyle;
  flow: Flow;
  stir: Stir;
}

export interface ZoneResult {
  ey: number;
  m: number;
}

export interface SimulationResult {
  timeSec: number;
  uni: number;
  ey: number;
  sigma: number;
  zones: ZoneResult[];
  bypass: number;
  shareF: number;
  Teff: number;
  Mf: number;
  C: number;
  phi: number;
  aAvg: number;
}

export interface FlavorResult {
  acid: number;
  sweet: number;
  bitter: number;
  body: number;
}

export interface TasteResult extends SimulationResult, FlavorResult {
  astr: number;
  clarity: number;
  aftertaste: number;
  tds: number;
}

export type CupClass = "good" | "under" | "over" | "uneven";

export const initialState: SimulatorState = {
  roast: "medium",
  process: "washed",
  grind: 50,
  temp: 92,
  ratio: 160,
  minerals: 45,
  bloom: "b30",
  pours: "p3",
  profile: "even",
  style: "spiral",
  flow: "medium",
  stir: "bloom",
};

export const presets: Array<{
  id: string;
  name: string;
  value: SimulatorState;
}> = [
  { id: "textbook", name: "教科书三段式", value: initialState },
  {
    id: "nobloom",
    name: "忘了闷蒸",
    value: { ...initialState, bloom: "none", stir: "none" },
  },
  {
    id: "dump",
    name: "一把梭",
    value: {
      ...initialState,
      bloom: "none",
      pours: "p1",
      style: "center",
      flow: "aggr",
      stir: "none",
    },
  },
  {
    id: "wall",
    name: "贴边冲",
    value: { ...initialState, style: "edge", stir: "none" },
  },
  {
    id: "fsBright",
    name: "4:6 明亮",
    value: {
      ...initialState,
      grind: 54,
      ratio: 165,
      pours: "p5",
      profile: "front",
      flow: "gentle",
      stir: "none",
    },
  },
  {
    id: "fsSweet",
    name: "4:6 甜感",
    value: {
      ...initialState,
      grind: 54,
      ratio: 165,
      pours: "p5",
      profile: "back",
      flow: "gentle",
      stir: "none",
    },
  },
  {
    id: "light",
    name: "浅烘果酸",
    value: {
      ...initialState,
      roast: "light",
      grind: 52,
      temp: 94,
      ratio: 165,
      minerals: 40,
    },
  },
];

const K = {
  tScale: 13.2,
  tPow: 0.7,
  tail: 18,
  clog: 1.7,
  drift: 2,
  tempSens: 0.042,
  bloomCool: 2.2,
  aF: 0.105,
  aS: 0.095,
  gate: 0.18,
  agF: 0.45,
  agS: 0.1,
  chFast: 0.8,
  chWaste: 0.25,
  ageRef: 110,
  ageMin: 0.15,
  bloomAge: 0.3,
  kGlo: 0.55,
  kGhi: 1.35,
  PF: 11.5,
  PS: 21,
  c0none: 0.4,
  c0b30: 0.15,
  c0b45: 0.13,
  stirFix: 0.42,
  stirDryFix: 0.62,
  warp: 0.55,
  crash: 0.09,
  dig: 0.13,
  relevel: 0.05,
  settle: 0.02,
  sigma0: 0.3,
  uniTau: 3.6,
  shareRef: 0.498,
  acidTilt: 320,
  sweetTilt: 150,
  mfAstr: 24,
  bypMud: 60,
};

const MZ = [0.22, 0.56, 0.22];
export const bloomSeconds: Record<Bloom, number> = {
  none: 0,
  b30: 30,
  b45: 45,
};
export const pourCounts: Record<Pours, 1 | 3 | 5> = {
  p1: 1,
  p3: 3,
  p5: 5,
};
export const profileShares: Record<Profile, Record<1 | 3 | 5, number[]>> = {
  front: {
    1: [1],
    3: [0.45, 0.31, 0.24],
    5: [0.28, 0.24, 0.19, 0.16, 0.13],
  },
  even: {
    1: [1],
    3: [1 / 3, 1 / 3, 1 / 3],
    5: [0.2, 0.2, 0.2, 0.2, 0.2],
  },
  back: {
    1: [1],
    3: [0.24, 0.31, 0.45],
    5: [0.13, 0.16, 0.19, 0.24, 0.28],
  },
};

const STYLE: Record<PourStyle, { dist: number[]; bypass: number; dC: number }> =
  {
    center: { dist: [0.5, 0.42, 0.08], bypass: 0.01, dC: 0.05 },
    spiral: { dist: [0.228, 0.555, 0.217], bypass: 0.02, dC: 0 },
    edge: { dist: [0.27, 0.49, 0.24], bypass: 0.13, dC: 0.03 },
  };
const FLOW: Record<Flow, { a: number; byp: number }> = {
  gentle: { a: 0.45, byp: 0 },
  medium: { a: 1, byp: 0 },
  aggr: { a: 1.9, byp: 0.03 },
};
const ROAST: Record<
  Roast,
  {
    rate: number;
    acid: number;
    sweet: number;
    bitBase: number;
    bitThr: number;
    body: number;
  }
> = {
  light: { rate: 0.85, acid: 28, sweet: 0, bitBase: -8, bitThr: 19.2, body: 0 },
  medium: { rate: 1, acid: 0, sweet: 10, bitBase: 3, bitThr: 18.4, body: 12 },
  dark: { rate: 1.18, acid: -22, sweet: 5, bitBase: 20, bitThr: 17, body: 26 },
};
const PROC: Record<Process, { acid: number; sweet: number; body: number }> = {
  washed: { acid: 8, sweet: 0, body: 0 },
  natural: { acid: -4, sweet: 9, body: 16 },
};

export const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

export function simulate(state: SimulatorState): SimulationResult {
  const g = state.grind / 100;
  const phi = Math.pow(g, 1.8);
  const n = pourCounts[state.pours];
  const profile = profileShares[n === 1 ? "even" : state.profile][n];
  const bloomSec = bloomSeconds[state.bloom];
  const waterRatio = Math.max(6, state.ratio / 10 - (bloomSec > 0 ? 3 : 0));
  let channeling =
    state.bloom === "none"
      ? K.c0none
      : state.bloom === "b30"
        ? K.c0b30
        : K.c0b45;
  if (state.stir === "bloom") {
    channeling *= state.bloom === "none" ? K.stirDryFix : K.stirFix;
  }
  channeling = clamp(channeling + STYLE[state.style].dC, 0.02, 0.95);
  let fines = 0;
  const permeability = 1.65 - 1.15 * g;
  const fast = [0, 0, 0];
  const slow = [0, 0, 0];
  const rate = ROAST[state.roast].rate * (0.88 + 0.3 * (state.minerals / 100));
  const grindRate = K.kGlo + K.kGhi * g;
  const slurryTemp = (time: number) =>
    Math.max(
      state.temp - 9,
      state.temp - 1.2 - K.drift * (time / 60) - (bloomSec / 45) * K.bloomCool,
    );
  let time = 0;
  let bypass = 0;
  let gain = 0;
  let gainTemp = 0;
  let agitationSum = 0;

  if (bloomSec > 0) {
    const temperature = slurryTemp(bloomSec * 0.5);
    const bloomRate =
      rate * grindRate * (1 + K.tempSens * (temperature - 92)) * 0.8;
    const contact = Math.sqrt(bloomSec / 28);
    const age = clamp((bloomSec * K.bloomAge * 0.5) / K.ageRef, K.ageMin, 1);
    for (let index = 0; index < 3; index += 1) {
      const initialFast = fast[index]!;
      const fastGain =
        (1 - initialFast) * (1 - Math.exp(-K.aF * bloomRate * 3 * contact));
      fast[index] = initialFast + fastGain;
      const gate = K.gate + ((1 - K.gate) * (initialFast + fast[index]!)) / 2;
      const slowGain =
        (1 - slow[index]!) *
        gate *
        (1 - Math.exp(-K.aS * bloomRate * 3 * contact * age));
      slow[index] = slow[index]! + slowGain;
      const gained = (fastGain * K.PF + slowGain * K.PS) * MZ[index]!;
      gain += gained;
      gainTemp += gained * temperature;
    }
    time = bloomSec;
  }

  for (let pour = 0; pour < n; pour += 1) {
    const currentPermeability = permeability / (1 + K.clog * fines);
    const currentBypass = clamp(
      STYLE[state.style].bypass + FLOW[state.flow].byp,
      0,
      0.3,
    );
    const usable =
      profile[pour]! *
      waterRatio *
      (1 - currentBypass) *
      (1 - K.chWaste * channeling);
    bypass += profile[pour]! * currentBypass;
    const drawdown = clamp(
      (Math.pow(usable, K.tPow) / currentPermeability) * K.tScale,
      6,
      150,
    );
    const temperature = slurryTemp(time + drawdown * 0.5);
    let agitation =
      FLOW[state.flow].a *
      (n === 1 ? 1.3 : 1) *
      (0.8 + 0.4 * profile[pour]! * n);
    let distribution: number[];
    if (state.stir === "late" && pour === n - 1) {
      distribution = [...MZ];
      agitation += 1.1;
      fines += 0.22;
    } else {
      const base = STYLE[state.style].dist;
      const warp = K.warp * channeling;
      const fastShare = base[0]! + (1 - base[0]!) * warp;
      const scale = (1 - fastShare) / (base[1]! + base[2]!);
      distribution = [fastShare, base[1]! * scale, base[2]! * scale];
    }
    agitationSum += agitation;
    const baseRate = rate * grindRate * (1 + K.tempSens * (temperature - 92));
    const fastAgitation = 0.75 + K.agF * Math.min(agitation, 2.2);
    const slowAgitation = 0.95 + K.agS * Math.min(agitation, 2.2);
    const contact = clamp(Math.sqrt(drawdown / 28), 0.6, 1.6);
    const wetTime = time - bloomSec * (1 - K.bloomAge);
    const age = clamp((wetTime + drawdown * 0.5) / K.ageRef, K.ageMin, 1);
    const dryFactor = state.bloom === "none" && pour === 0 ? 0.7 : 1;

    for (let index = 0; index < 3; index += 1) {
      const dose = (usable * distribution[index]!) / MZ[index]!;
      const zoneContact =
        contact * dryFactor * (index === 0 ? 1 - K.chFast * channeling : 1);
      const initialFast = fast[index]!;
      const fastGain =
        (1 - initialFast) *
        (1 - Math.exp(-K.aF * baseRate * fastAgitation * dose * zoneContact));
      fast[index] = initialFast + fastGain;
      const gate = K.gate + ((1 - K.gate) * (initialFast + fast[index]!)) / 2;
      const slowGain =
        (1 - slow[index]!) *
        gate *
        (1 -
          Math.exp(
            -K.aS * baseRate * slowAgitation * dose * zoneContact * age,
          ));
      slow[index] = slow[index]! + slowGain;
      const gained = (fastGain * K.PF + slowGain * K.PS) * MZ[index]!;
      gain += gained;
      gainTemp += gained * temperature;
    }

    if (state.bloom === "none" && pour === 0) {
      channeling += K.crash * Math.min(agitation, 2);
    }
    channeling += K.dig * Math.max(0, agitation - 1) * (0.4 + phi);
    channeling -= (state.style === "spiral" ? K.relevel : 0) + K.settle;
    channeling = clamp(channeling, 0.02, 0.95);
    fines +=
      phi *
      (0.3 + 0.45 * agitation) *
      (1 + 0.5 * channeling) *
      profile[pour]! *
      1.6;
    time += drawdown;
  }

  time += K.tail / (permeability / (1 + K.clog * fines));
  const zoneExtraction = fast.map(
    (value, index) => value * K.PF + slow[index]! * K.PS,
  );
  const mean = zoneExtraction.reduce(
    (sum, value, index) => sum + value * MZ[index]!,
    0,
  );
  const variance = zoneExtraction.reduce(
    (sum, value, index) => sum + MZ[index]! * Math.pow(value - mean, 2),
    0,
  );
  const sigma = Math.sqrt(variance) + K.sigma0;
  const uniformity = clamp(100 * Math.exp(-sigma / K.uniTau), 2, 98);
  const fastQuantity =
    fast.reduce((sum, value, index) => sum + value * MZ[index]!, 0) * K.PF;
  const slowQuantity =
    slow.reduce((sum, value, index) => sum + value * MZ[index]!, 0) * K.PS;

  return {
    timeSec: clamp(time, 45, 420),
    uni: uniformity,
    ey: clamp(mean, 12, 29),
    sigma,
    zones: zoneExtraction.map((ey, index) => ({ ey, m: MZ[index]! })),
    bypass,
    shareF: fastQuantity / (fastQuantity + slowQuantity || 1),
    Teff: gain > 0 ? gainTemp / gain : state.temp,
    Mf: fines,
    C: channeling,
    phi,
    aAvg: agitationSum / n,
  };
}

export function flavorAtEY(
  extraction: number,
  state: SimulatorState,
  effectiveTemperature = state.temp,
): FlavorResult {
  const roast = ROAST[state.roast];
  const process = PROC[state.process];
  const minerals = state.minerals / 100;
  const temperatureShift = (effectiveTemperature - 90) / 6;
  return {
    acid: clamp(
      72 -
        (extraction - 15) * 7 +
        Math.max(0, 17.2 - extraction) * 5 +
        roast.acid +
        process.acid -
        minerals * 14 -
        temperatureShift * 5,
    ),
    sweet: clamp(
      80 * Math.exp(-Math.pow(extraction - 20, 2) / (2 * 3.1 * 3.1)) +
        roast.sweet +
        process.sweet,
    ),
    bitter: clamp(
      Math.max(0, (extraction - roast.bitThr) * 8.5) +
        roast.bitBase +
        temperatureShift * 9,
    ),
    body: clamp(
      34 + (extraction - 16) * 2.2 + roast.body + process.body + minerals * 22,
    ),
  };
}

export function taste(state: SimulatorState): TasteResult {
  const simulation = simulate(state);
  let acid = 0;
  let sweet = 0;
  let bitter = 0;
  let body = 0;
  simulation.zones.forEach((zone) => {
    const flavor = flavorAtEY(clamp(zone.ey, 12, 29), state, simulation.Teff);
    acid += zone.m * flavor.acid;
    sweet += zone.m * flavor.sweet;
    bitter += zone.m * flavor.bitter;
    body += zone.m * flavor.body;
  });
  acid = clamp(acid + (simulation.shareF - K.shareRef) * K.acidTilt);
  sweet = clamp(sweet - (simulation.shareF - K.shareRef) * K.sweetTilt);
  const astr = clamp(
    34 * simulation.phi * (0.6 + 0.4 * Math.min(simulation.aAvg, 2)) +
      K.mfAstr * Math.min(1, simulation.Mf) +
      6 * Math.max(0, simulation.zones[0]!.ey - 22.5) +
      (state.stir === "late" ? 8 : 0) -
      6,
  );
  const clarity = clamp(
    96 -
      0.55 * astr -
      7 * (simulation.sigma - K.sigma0) -
      K.bypMud * simulation.bypass -
      10 * simulation.C,
  );
  const aftertaste = clamp(0.5 * sweet + 0.2 * body + 0.3 * clarity - 10);
  return {
    ...simulation,
    acid,
    sweet,
    bitter,
    body,
    astr,
    clarity,
    aftertaste,
    tds: simulation.ey / (state.ratio / 10),
  };
}

function acidWord(acid: number, extraction: number) {
  if (extraction < 17.6) return acid > 50 ? "发尖的死酸" : "酸得发涩";
  if (acid > 70) return "强烈扑鼻的酸";
  if (acid > 50) return "明亮多汁的果酸";
  if (acid > 30) return "柔和的酸";
  if (acid > 15) return "酸感很淡";
  return "几乎没有酸";
}

export function tastingNote(result: TasteResult) {
  const sweet =
    result.sweet > 75
      ? "饱满的焦糖甜"
      : result.sweet > 55
        ? "清晰的甜感"
        : result.sweet > 35
          ? "一点回甜"
          : "甜感薄弱、发空";
  const bitter =
    result.bitter > 65
      ? "厚重的焦苦"
      : result.bitter > 45
        ? "明显的苦味"
        : result.bitter > 25
          ? "背景里一丝苦"
          : "几乎不苦";
  const body =
    result.body > 70
      ? "厚实圆润"
      : result.body > 45
        ? "醇厚度中等"
        : "口感轻薄";
  const finish =
    result.astr > 52
      ? "收尾发干、挂舌的涩"
      : result.aftertaste > 65
        ? "干净、持久的甜收尾"
        : result.aftertaste > 45
          ? "还算干净的收尾"
          : result.aftertaste > 28
            ? "收尾偏短、有点空"
            : "收尾干瘪";
  let text = `${acidWord(result.acid, result.ey)}，${sweet}，${bitter}。${body}，${finish}。`;
  if (result.uni < 38) {
    text = `${result.zones[0]!.ey > 22 ? "快路径的粉端出苦涩，慢角落的粉端出尖酸" : "水从快路径夺路而逃，大半粉床只被扫了一下"}——${text}`;
  } else if (result.uni < 58) {
    text += " 层次有点糊，三个区落点散开，甜被离散稀释了。";
  }
  if (result.bypass > 0.08) {
    text += ` 约 ${Math.round(result.bypass * 100)}% 的水沿滤纸壁溜走了（bypass），整杯被稀释。`;
  }
  if (result.astr > 52) {
    text += " 细粉和手法带来的涩很明显。";
  } else if (result.tds < 1.15 && result.bypass <= 0.08) {
    text += " 整杯偏淡、寡薄，应该收紧粉水比。";
  } else if (result.tds > 1.5) {
    text += " 浓度偏高，风味被压得有点闷。";
  }
  return text;
}

export function character(
  result: TasteResult,
  state: SimulatorState,
): { kind: CupClass; headline: string } {
  const inBand = result.ey >= 18 && result.ey <= 22;
  if (result.uni < 38)
    return {
      kind: "uneven",
      headline:
        result.zones[0]!.ey > 22
          ? "又酸又苦还发涩 —— 冲得不匀"
          : "尖酸、浑浊、发空 —— 冲得不匀",
    };
  if (result.ey < 17.6)
    return { kind: "under", headline: "偏酸、单薄 · 像没睡醒" };
  if (result.ey > 23) return { kind: "over", headline: "苦涩失衡 · 发干" };
  if (result.uni < 58 && inBand)
    return { kind: "uneven", headline: "参数没瞄错，但冲散了 · 有点浑" };
  if (result.astr > 55 && inBand)
    return { kind: "over", headline: "萃取够了，但发涩发糙" };
  if (result.ey < 18) return { kind: "under", headline: "酸主导 · 甜还没打开" };
  if (result.ey > 22) return { kind: "over", headline: "偏苦 · 甜被盖住了" };
  if (state.roast === "light" || state.process === "natural")
    return { kind: "good", headline: "明亮 · 果汁感 · 清晰" };
  if (result.astr < 26 && result.uni >= 72)
    return { kind: "good", headline: "平衡 · 甜感清晰 · 干净" };
  if (result.uni < 72)
    return { kind: "good", headline: "平衡，均匀度还有一点余量" };
  return { kind: "good", headline: "平衡，但略带一点糙感" };
}

export function grindLabel(value: number) {
  return ["极粗", "粗", "中粗", "中细", "细", "极细"][
    Math.min(5, Math.floor(value / 17))
  ]!;
}

export function mineralLabel(value: number) {
  return value < 25 ? "软水" : value < 55 ? "中" : value < 80 ? "偏硬" : "硬水";
}

export function ratioLabel(value: number) {
  return `1:${(value / 10).toFixed(value % 10 ? 1 : 0)}`;
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}
