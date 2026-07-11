export type InfoKey =
  | "grind"
  | "temp"
  | "ratio"
  | "minerals"
  | "bloom"
  | "pours"
  | "profile"
  | "style"
  | "flow"
  | "stir"
  | "time";

export interface InfoEntry {
  title: string;
  touches: string[];
  sections: Array<{ title: string; body: string; tone?: "good" | "warn" }>;
  takeaway: string;
  caveat?: string;
}

export const simulatorInfo: Record<InfoKey, InfoEntry> = {
  grind: {
    title: "研磨度",
    touches: ["萃取速率", "细粉与涩", "渗透率与时间"],
    sections: [
      {
        title: "为什么是最大杠杆",
        body: "磨细会增加总表面积、缩短颗粒内部扩散路径，因此同时加快快池和慢池的萃取。",
      },
      {
        title: "细粉的双重代价",
        body: "细粉会迁移并堵塞滤层，拖长排水；它本身也很快萃干，直接增加涩感。",
        tone: "warn",
      },
    ],
    takeaway: "想补萃取时，先考虑增加段数或升温，最后才是继续磨细。",
  },
  temp: {
    title: "水温",
    touches: ["萃取速率", "苦味选择性", "浆温下滑"],
    sections: [
      {
        title: "速度与温度",
        body: "温度越高，扩散和溶解越快。模型使用随时间下滑的浆温，而不只看壶温。",
      },
      {
        title: "萃出什么",
        body: "同一萃取率下，更高的有效温度也会提高苦味物质的选择性。",
        tone: "warn",
      },
    ],
    takeaway: "怕苦又想提高萃取，可以先改善手法，把温度留在较低位置。",
  },
  ratio: {
    title: "粉水比",
    touches: ["浓度 TDS", "总水量", "排水时间"],
    sections: [
      {
        title: "浓度与萃取率是两条轴",
        body: "粉水比主要决定最终浓度；两杯可以有相同萃取率，但一杯浓、一杯淡。",
      },
      {
        title: "别用磨细解决太淡",
        body: "喝起来太淡应优先收紧粉水比，盲目磨细可能把咖啡推向过萃。",
        tone: "warn",
      },
    ],
    takeaway: "太淡或太浓先动粉水比，不要先动研磨。",
  },
  minerals: {
    title: "水的矿物质",
    touches: ["萃取力", "醇厚度", "酸的缓冲"],
    sections: [
      {
        title: "水不是惰性溶剂",
        body: "镁和钙会结合并抓取风味物质；矿物质过低的水容易冲出空洞感。",
      },
      {
        title: "为什么会压平酸",
        body: "更高的缓冲能力会中和咖啡里的酸，同时增加口腔重量感。",
      },
    ],
    takeaway: "想让酸更亮可降低缓冲；觉得寡淡可适度提高矿物质。",
    caveat: "真实水质中的硬度和碱度是两件事；本模型将它们合并为一个教学滑块。",
  },
  bloom: {
    title: "闷蒸",
    touches: ["排气", "通道系数", "粉床起点"],
    sections: [
      {
        title: "为什么决定水路起点",
        body: "不闷蒸会留下干块和气袋，第一注水更容易形成快速通道，之后的水持续偏心分配。",
        tone: "warn",
      },
      {
        title: "闷蒸买来了什么",
        body: "均匀预湿会降低通道系数，但更长闷蒸也会付出浆温下降的代价。",
      },
    ],
    takeaway: "闷蒸是均匀度最大的单一杠杆，但不是越长越好。",
  },
  pours: {
    title: "注水段数",
    touches: ["扰动分布", "萃取率", "总时间"],
    sections: [
      {
        title: "一刀流与分段",
        body: "分段把扰动和新鲜热水铺到整条时间线，通常能提高萃取完整度和控制粒度。",
      },
      {
        title: "段数的代价",
        body: "更多段数会拉长时间，后段浆温更低，并不等于无条件更好。",
        tone: "warn",
      },
    ],
    takeaway: "想提高萃取，加一段通常比盲目磨细安全。",
  },
  profile: {
    title: "前段配比",
    touches: ["酸甜平衡", "快慢两池", "4:6 冲法"],
    sections: [
      {
        title: "前段多为什么更明亮",
        body: "前段大水优先带走快池中的酸和轻香气，成品的快池占比更高。",
      },
      {
        title: "前段少为什么更圆甜",
        body: "后段大水持续推进慢池中的糖和醇厚物质，让酸被甜感垫圆。",
      },
    ],
    takeaway: "只改变前后配比，就能在明亮和圆甜之间移动。",
    caveat: "一刀流只有一段，因此前段配比不会产生作用。",
  },
  style: {
    title: "绕圈方式",
    touches: ["空间分配", "bypass", "快慢区域"],
    sections: [
      {
        title: "中心定点",
        body: "水集中穿过中间，慢角落分不到足够水，整杯容易欠萃且不均。",
        tone: "warn",
      },
      {
        title: "贴边大圈",
        body: "一部分水沿滤纸壁绕过粉层，既不参与萃取，又会稀释成品。",
        tone: "warn",
      },
    ],
    takeaway: "小圈覆盖到粉面边缘但不要碰滤纸，是更稳定的空间分配。",
  },
  flow: {
    title: "水流强度",
    touches: ["扰动", "挖深通道", "细粉迁移"],
    sections: [
      {
        title: "适度动能",
        body: "适度扰动会打破颗粒表面的饱和边界层，让新鲜水继续推动扩散。",
      },
      {
        title: "过猛的乘法代价",
        body: "粉床越脆弱、细粉越多，激烈水流越容易挖深通道并堵塞滤层。",
        tone: "warn",
      },
    ],
    takeaway: "中等通常是甜点位；没有闷蒸或磨得很细时更要收着冲。",
  },
  stir: {
    title: "搅拌时机",
    touches: ["均匀度", "涩感", "堵床"],
    sections: [
      {
        title: "闷蒸时搅",
        body: "粉还没过萃时搅拌可以迅速降低通道系数，均匀度收益大、风险低。",
      },
      {
        title: "后段搅",
        body: "后段搅会再次冲刷已高萃取的快路径，并把细粉搅进滤层，苦涩和堵床一起增加。",
        tone: "warn",
      },
    ],
    takeaway: "要搅就搅闷蒸；收尾更适合轻轻旋壶把粉床摇平。",
  },
  time: {
    title: "为什么时间是读数",
    touches: ["渗透率", "堵床", "水量分段"],
    sections: [
      {
        title: "时间不是输入",
        body: "每段排水时间由水量和粉床渗透率共同决定，研磨、细粉迁移、段数和水流都会改变它。",
      },
      {
        title: "想改时间就动上游",
        body: "流得太快可磨细或加段；太慢可磨粗、减段，并避免后段搅拌。",
      },
    ],
    takeaway: "动作才是输入，计时器只是回执。",
  },
};
