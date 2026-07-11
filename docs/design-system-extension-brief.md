# POUR.LOG 设计系统增补任务书

> 用途：交给设计师或设计师 AI，扩充现有 `设计系统.dc.html` 与 `design-tokens.json`。
>
> 目标：把当前以基础视觉样张为主的设计系统，补全为可以指导产品实现、交互设计、响应式适配和质量验收的完整规范。

## 1. 项目背景

POUR.LOG 是一个本地优先的手冲咖啡陪学 PWA，主要功能包括：

- 豆样本库
- 豆子详情与最佳杯
- 配方库与配方编辑
- 新建冲煮日记
- 六维口感评分
- AI 配方推荐与冲煮复盘
- 冲煮实验室模拟器
- AI 接口设置

当前设计系统已经明确了品牌视觉基础，但产品实现已经出现大量未被设计系统覆盖的界面与交互。因此，本任务不是重新设计品牌，而是补齐规则、组件、状态和页面模板。

## 2. 现有规范来源

设计增补应以以下文件为基准：

1. `/Users/richard/Downloads/design-tokens.json`
2. `/Users/richard/Downloads/设计系统.dc.html`
3. 当前产品实现：`/Users/richard/projects/pourlog/src`

现有设计系统已经覆盖：

- 核心颜色与文字灰阶
- Sans 与 Mono 两套字体职责
- 基础字号层级
- 全局直角视觉原则
- 常用边框、间距和阴影
- Primary、Dark、Ghost、Danger 按钮样张
- Pill、Tag、BEST Badge
- 豆子卡片样张
- 三列规格网格
- 六维数据条
- 移动端深色页头和底部导航样张
- Toast 静态视觉样张

## 3. 不可改变的品牌原则

以下内容是硬约束。除非另行确认，不应在增补过程中改变。

### 3.1 视觉气质

- 实验记录、参数仪器、极客数据化，而不是咖啡馆营销页面。
- 安静、精密、克制、可扫描，避免装饰性卡片堆叠。
- 不使用渐变球、光斑、拟物咖啡插画或大面积装饰性图片。
- 页面首先服务于记录、比较、调参和重复操作。

### 3.2 色彩职责

- 森林绿 `#3f6b45` 是唯一主强调色。
- 墨色 `#1c231d` 用于深色容器、主文字和 Dark Button。
- 红色 `#c15a3c` 只用于危险、错误和异常诊断。
- 不新增竞争性的主品牌色。
- 若需要状态色，必须先评估能否通过现有绿、红和文字灰阶表达。

### 3.3 字体职责

- Noto Sans SC：标题、名称、自然语言正文。
- JetBrains Mono：参数、时间、比例、编号、标签、状态、按钮和英文元信息。
- 不允许把所有正文都改为 Mono。
- 不允许把数据和参数大量改为 Sans。

### 3.4 形状原则

- 卡片、按钮、输入框、面板、网格和弹窗保持直角。
- 默认不使用大圆角和胶囊形容器。
- 圆形仅可作为有功能含义的控制点，例如 range thumb；必须在规范中明确列为例外。

## 4. 本次增补的核心目标

设计师需要使设计系统能够回答以下问题：

1. 同一组件在默认、悬浮、聚焦、按下、禁用、加载、错误时分别是什么样？
2. 页面在手机、平板、普通桌面和宽桌面上如何变化？
3. 表单如何显示必填、帮助、校验、警告和特殊值？
4. 保存、生成、失败、空数据和危险删除如何反馈？
5. 弹窗、底部结果面板、折叠区和 sticky 区域如何工作？
6. 键盘、触屏和屏幕阅读器用户是否能完成同一流程？
7. 模拟器的图表、参数控件和比较结果是否属于同一个系统？

## 5. 必须新增的设计基础

### 5.1 响应式断点

设计系统必须定义并命名断点，而不是只在页面 CSS 中临时使用数值。

至少需要覆盖：

| 模式 | 当前实现参考 | 需要明确的规则 |
| --- | --- | --- |
| Mobile | `< 800px` | 单列、底部导航、固定操作栏、分步表单 |
| Tablet / Compact Desktop | `>= 800px` | 左侧导航、内容扩宽、双列列表 |
| Desktop | `>= 1080px` | 详情双栏、右侧 sticky 面板、双栏表单 |
| Wide Desktop | `>= 1180px` | 更宽侧栏、三列豆子卡片、更大页面边距 |

设计师可以调整具体数值，但必须给出：

- 断点名称和数值
- 每档页面左右边距
- 内容最大宽度
- 侧栏宽度
- 列数与列间距
- 哪些组件隐藏、显示、折叠或改变位置
- fixed 与 sticky 元素的行为
- 横屏手机和窄平板的处理方式

### 5.2 布局 Token

新增以下类型的 token：

- `layout.content-max`
- `layout.form-max`
- `layout.sidebar-width`
- `layout.sidebar-width-wide`
- `layout.bottom-nav-height`
- `layout.sticky-action-height`
- `layout.dialog-max-width`
- `layout.result-panel-max-height`
- `layout.page-header-height`，若采用固定高度
- `breakpoint.*`
- `z-index.nav`
- `z-index.sticky`
- `z-index.overlay`
- `z-index.dialog`
- `safe-area.*` 的使用规则

### 5.3 动效 Token

新增：

- 快速状态过渡时长
- 普通过渡时长
- 面板进入/退出时长
- 标准 easing
- 哪些属性允许动画
- `prefers-reduced-motion` 下的降级规则

当前产品的 `160–180ms` 可以作为参考，但需要设计确认。

### 5.4 交互尺寸

明确：

- 普通按钮高度
- 紧凑按钮高度
- 图标按钮尺寸
- 最小触控区域，建议不小于 `44 × 44px`
- 输入框高度
- 导航项高度
- 滑杆 thumb 的视觉尺寸与实际命中区域

## 6. 组件状态规范

每一个可交互组件必须至少提供以下状态：

- Default
- Hover，仅指针设备
- Focus Visible
- Pressed / Active
- Selected，如适用
- Disabled
- Loading，如适用
- Error，如适用

不能只提供一张静态组件样图。

### 6.1 Button

需要规范以下类型：

- Primary Button
- Dark Button
- Ghost Button
- Dashed Add Button
- Danger Button
- Danger Solid Confirm Button
- Text Button
- Icon Button
- Icon + Text Button
- Full-width Mobile CTA
- Compact Inline Action

每类按钮需要明确：

- 高度和 padding
- 字号、字重、大小写与 tracking
- 是否允许前置/后置图标
- loading 时是否保留原宽度
- loading 文案还是 spinner
- disabled 时 cursor、透明度和文字颜色
- 图标与文字间距
- 一组按钮的主次顺序
- 危险操作是否必须使用红色实心确认按钮

需要解决当前歧义：

- 现有 token 中 `button-ghost` 是虚线边框。
- 当前产品同时存在实线 Ghost 和虚线 Add Button。
- 建议将二者正式拆成 `button-ghost` 与 `button-dashed-add`，不要继续共用名称。

### 6.2 Link 与返回操作

定义：

- 正文链接
- 卡片链接
- 返回链接
- 顶部 Edit 操作
- “查看记录”等次级导航操作
- 外部链接，如未来出现

必须明确 hover、focus、visited 是否变化，以及链接和按钮的使用边界。

### 6.3 Pill、Segment 与 Tag

需要区分：

- 单选 Segment：热冲 / 冰冲 / 冷萃
- 可换行快速填充选项
- 只读 Tag：风味标签
- 状态 Badge：BEST、待确认、已保存
- Filter Pill，如未来使用

为每类定义：

- 单选或多选
- 是否可换行
- 最小宽度
- 长文本截断或换行规则
- 选中、禁用和 focus 状态
- 标签是否允许点击

### 6.4 Card 与 List Row

至少定义：

- Bean Card
- Journal Card
- Recipe Card / Row
- History Log Row
- Selected Sample Summary
- Static Information Panel
- Warning Panel
- AI Panel
- Best Cup Panel

需要明确：

- 整卡是否可点击
- 卡内是否允许再放主要操作按钮
- hover 时是否允许上移和加阴影
- 移动端触摸时的 active 状态
- 卡片标题、meta、标签、操作区的固定顺序
- 内容过长时换行、截断或扩高方式
- 空值如何表示

## 7. 表单系统

现有规范没有完整表单章节。本次必须新增。

### 7.1 基础字段

覆盖：

- Text Input
- Number Input
- Password Input
- Textarea
- Select，若未来使用
- Range Slider
- Segmented Choice
- Editable Step Row
- Read-only Derived Value，例如粉水比

### 7.2 字段结构

每个字段需要定义：

- Label
- Required / Optional 标识
- Placeholder
- Helper Text
- Unit，例如 `g`、`°C`、秒
- Validation Error
- Warning，但允许保存
- Disabled
- Read-only
- Focus
- Filled

明确错误信息出现位置，并保证错误出现时页面不会产生不必要的横向或大幅纵向跳动。

### 7.3 数值输入

咖啡配方包含大量数字，必须定义：

- 是否使用原生 stepper
- 单位放在输入框内还是 label 中
- 小数允许范围
- 空值和 `0` 的差异
- 冷萃水温的 `null` 如何录入和展示
- 非法字符、负数和超范围值如何反馈
- 移动端应使用何种软键盘类型

### 7.4 配方步骤编辑器

需要设计完整的 Pour Step Row：

- 时间
- 累计注水量
- 说明
- 删除按钮
- 新增步骤
- 行标题或列标题
- 小屏幕换行布局
- 错误行状态
- 排序规则和是否支持拖动

### 7.5 六维评分 Slider

必须明确：

- 1–5 五档视觉结构
- thumb、track、tick 和当前值
- 左右端说明
- 每一档文字说明
- 用户尚未主动评价时的视觉区别
- 异常维度何时转红
- 键盘方向键行为
- 点击说明按钮后的帮助弹窗
- 基础感受和进阶感受的分组方式

## 8. 导航系统

### 8.1 Mobile Bottom Navigation

需要确认当前四项结构：

- BEANS
- JOURNAL
- RECIPES
- LAB

明确：

- 高度
- safe-area
- active 指示
- 是否使用图标
- 文案是否保持全英文
- 点击当前项是否回到列表顶部
- 当页面出现底部固定 CTA 时导航是否隐藏

### 8.2 Desktop Sidebar

设计系统需要新增桌面导航组件，覆盖：

- 品牌区
- 编号导航项
- 中文名和英文副标题
- active 状态
- hover 和 focus 状态
- 设置入口
- 底部 LOCAL FIRST 说明
- 窄桌面与宽桌面宽度
- 侧栏是否固定或 sticky

### 8.3 Page Header 与 Detail Header

区分：

- 列表页 Masthead
- 详情页 Top Actions + Hero
- 表单页 Back + Title
- 模拟器独立 Header

明确标题、eyebrow、meta、设置入口和操作按钮的位置。

## 9. 反馈与系统状态

必须建立统一反馈体系。

### 9.1 Loading

定义：

- 首屏页面 loading
- 区块 loading
- 按钮 loading
- AI 长时间生成状态
- 保存状态
- 是否使用 spinner、进度条或 Mono 文案
- loading 时哪些控件被禁用
- 超时后如何进入错误状态

### 9.2 Empty State

覆盖：

- 豆样本为空
- 日记为空
- 配方库为空
- 历史记录为空
- AI 推荐尚未生成
- 搜索无结果，如未来增加搜索

每种空状态应明确是否包含 CTA、说明文字和插图。建议保持工具型、克制，不使用营销插画。

### 9.3 Error、Warning、Success 与 Info

定义四类语义：

- Error：操作失败或无法继续
- Warning：存在风险但允许继续
- Success：操作已成功
- Info：普通状态说明

为每类定义：

- 文字颜色
- 背景
- 边框
- 图标
- 标题和正文结构
- 行内、区块和全局三种尺寸
- 是否自动消失

### 9.4 Toast

现有设计只有静态 Toast 样张，需要补齐行为：

- 手机和桌面位置
- 最大宽度
- 屏幕边距
- 显示时长
- 多条堆叠方式
- 是否有关闭按钮
- 是否允许操作，例如“撤销”
- 页面切换后是否保留
- 屏幕阅读器播报方式

### 9.5 Status Badge

补充：

- 已配置 / 未配置
- AI / 本地规则
- 已保存
- 数据待确认
- 推荐已过期
- BEST

避免所有状态都使用主强调绿，否则无法表达信息层级。

## 10. Overlay、Dialog 与 Bottom Sheet

### 10.1 Confirmation Dialog

覆盖：

- 普通确认
- 危险删除确认
- 覆盖未保存修改
- 数据不一致但允许继续

必须定义：

- 桌面和移动端尺寸
- 遮罩颜色和透明度
- 标题、正文和操作区
- 主次按钮顺序
- Danger Confirm 样式
- 点击遮罩是否关闭
- Escape 是否关闭
- 初始焦点
- Tab 焦点循环
- 关闭后的焦点恢复
- 内容过长时内部滚动

### 10.2 Information Dialog

评分说明等信息型弹窗需要与确认弹窗区分，不应错误使用危险操作布局。

### 10.3 Mobile Result Sheet

模拟器当前使用底部结果面板，需要定义：

- 展开高度
- 顶部边框或 drag handle
- 背景遮罩是否存在
- 内部滚动
- 关闭入口
- 与底部导航的关系
- 横屏处理

## 11. Disclosure、Accordion 与 Sticky

设计以下通用组件：

- Details / Disclosure：展开一段辅助信息
- Accordion Group：一次只展开一个参数组
- Sticky Summary：滚动时保持结果摘要可见
- Sticky Action Bar：保持保存或下一步操作可见

定义：

- 展开/收起图标
- 标题区高度
- 动画
- 键盘操作
- `aria-expanded` 语义
- 展开内容的背景和边框
- 多组同时展开还是单组展开
- sticky 被页头或导航遮挡时的 offset

## 12. 数据展示与可视化

### 12.1 Spec Grid

补充现有三列网格的规则：

- 手机是否永远三列
- 长参数值如何换行
- 奇数项末行如何处理
- 外框使用 strong border，内部使用 hairline border
- 单位与数值的字体层级
- 可点击单元格是否允许存在

### 12.2 Data Bar

补充：

- 正常、异常、禁用、无数据状态
- 动画规则
- 数值是否始终显示
- 标签宽度
- 0、最小值和最大值的表现

### 12.3 Simulator Radar Chart

新增雷达图规范：

- 当前杯、基线杯、变化维度的线与填充
- 标签排布
- 最小尺寸
- 手机紧凑版和展开版
- 颜色对比和非颜色编码
- 数据变化动画
- reduced-motion 降级

### 12.4 Comparison Metrics

定义：

- 上升、下降、不变
- 本次变化高亮
- 基线锁定 / 取消锁定
- 数值、箭头、数据条之间的优先级
- 红色是否一定代表负面，避免把“数值下降”机械地全部标红

### 12.5 Pour Timeline

定义注水时间轴的：

- 时间刻度
- 阶段色块
- 注水节点
- 搅拌等事件标识
- 小屏幕压缩方式
- tooltip 或说明入口

## 13. 模拟器专用组件

模拟器目前不在原设计系统覆盖范围内，但已经是主导航一级功能。本次应正式纳入。

至少需要输出：

- Preset Button Row
- Parameter Group
- Segment Control
- Range Control
- Info Button
- Mobile Live Cup Summary
- Desktop Result Panel
- Pin Baseline Control
- Changed Metric Row
- Result Classification：正常、欠萃、过萃、不均匀
- Info Dialog
- Pour Timeline

设计时应保持与主产品一致的字体、颜色、直角和数据密度，不能变成另一套独立视觉语言。

## 14. 图标与符号规范

当前产品混用 `⚙`、`×`、`▸`、`↻`、`⚠`、`★`、`+`、`−` 等 Unicode 字符。设计系统需要决定：

- 是否继续使用字符图标
- 是否切换到统一图标库
- 图标尺寸和 stroke
- 图标按钮的可访问名称
- 哪些图标必须配文字
- 哪些陌生图标必须提供 tooltip
- loading、success、warning、error 的标准图标

无论采用哪种方式，都必须避免同一操作在不同页面使用不同符号。

## 15. 文案与命名规则

定义产品语言规则：

- 中文为主要操作语言。
- 英文用于品牌、实验记录感和短 meta，不应影响理解。
- 按钮是否使用全大写英文需要统一。
- `RUN BREW`、`SAVE + ANALYZE` 等是否保留，应由设计与产品共同确认。
- `//` 前缀的使用范围。
- 省略号统一使用 `…` 还是 `...`。
- 删除、覆盖、重新生成等不可逆操作的标准句式。
- 成功、失败和警告文案是否包含符号。
- 时间、日期、克重、温度和比例的格式规则。

建议输出一份常用动作词表，例如：

- 新建 / 保存 / 另存
- 编辑 / 删除 / 取消
- 生成 / 重新生成
- 展开 / 收起
- 查看 / 返回
- 再冲一杯

## 16. 无障碍规范

设计系统必须写明：

- 所有可交互元素的 Focus Visible 样式
- 最小文字和背景对比度目标
- 最小触控尺寸
- 不仅依靠颜色表达状态
- Dialog 的焦点锁定与恢复
- Disclosure 和 Accordion 的键盘行为
- Slider 的键盘行为和可读值
- Toast、错误和保存成功的播报策略
- 图表的文本替代方案
- `prefers-reduced-motion` 处理
- 200% 字体缩放时的布局要求
- 长中文、长英文和超长豆名的溢出处理

## 17. 页面模板

除组件外，请提供以下页面级模板，至少包含 Mobile 与 Desktop 两档。

### 17.1 列表页模板

适用于豆子、日记和配方：

- Masthead
- 数量 meta
- 卡片网格
- 新建入口
- Empty State
- Bottom Navigation / Desktop Sidebar

### 17.2 详情页模板

- Back 与 Edit
- Detail Hero
- 参数网格
- 主内容区
- 次级或 AI 面板
- 历史记录
- Sticky 侧栏
- 危险操作区

### 17.3 表单页模板

- Back
- 标题
- 表单分组
- 校验反馈
- 固定保存操作
- 未保存修改处理

### 17.4 分步冲煮页模板

- Progress
- 配方阶段
- 口感阶段
- Mobile 下一步 / 保存
- Desktop 双栏同时编辑
- 保存和分析状态

### 17.5 模拟器工作台模板

- Mobile：实时结果摘要 + Accordion 参数组 + Bottom Sheet
- Desktop：左侧参数工作台 + 右侧 Sticky Result
- Wide Desktop：合理的内容最大宽度与图表尺寸

## 18. 需要设计师明确决策的开放项

以下问题当前实现已有答案，但设计系统没有正式确认。请逐项作出决定，不要保持模糊。

1. 桌面端是否正式采用常驻左侧导航？
2. 断点是否保留 `800 / 1080 / 1180px`？
3. 卡片 hover 是否允许上移 `2px` 和出现阴影？
4. Ghost Button 应为实线还是虚线？
5. 虚线是否仅用于“新增/录入”操作？
6. range thumb 和评分说明按钮是否作为圆形例外？
7. 手机端底部导航是否保留四项且不使用图标？
8. 详情页和 AI 面板在桌面是否使用 sticky？
9. 手机冲煮表单是否保持两步流程，桌面是否同时展示？
10. Dialog 点击遮罩是否关闭？危险确认是否允许这样关闭？
11. Toast 是否真正加入产品，还是继续使用页面内反馈？
12. 操作文案是否继续中英文混排？
13. 图标是否改用统一图标库？
14. 桌面标题是否允许扩大到 `34–38px`？
15. 模拟器中的数值下降是否可以使用红色，还是红色只表示负面诊断？

## 19. Token 文件增补要求

更新 `design-tokens.json` 时应：

- 保留现有 token 名称，避免无必要破坏实现。
- 为新增 token 提供 `value` 和 `desc`。
- 避免在组件中直接出现未命名的颜色。
- 为交互状态提供 token 或明确的派生规则。
- 对圆形例外、透明背景和 overlay 色提供正式 token。
- 将 breakpoint、layout、motion、z-index、control size 纳入结构。
- 修正 Ghost / Dashed Add 的命名冲突。

建议新增顶层分类：

```json
{
  "breakpoint": {},
  "layout": {},
  "size": {},
  "motion": {},
  "z-index": {},
  "overlay": {},
  "state": {},
  "component": {}
}
```

具体值由设计师确认，不应直接把当前 CSS 中所有数字无判断地复制为 token。

## 20. 设计文档交付要求

更新后的 `设计系统.dc.html` 至少应包含以下章节：

1. Foundations
2. Responsive Layout
3. Typography
4. Navigation
5. Buttons and Actions
6. Form Controls
7. Selection Controls
8. Cards and Data Display
9. Feedback and Status
10. Dialogs and Overlays
11. Disclosure and Sticky Regions
12. Charts and Simulator Controls
13. Accessibility
14. Content and Icon Rules
15. Page Templates

每个组件章节必须展示：

- Anatomy
- Variants
- Sizes
- States
- Responsive Behavior
- Usage Rules
- Do / Don't
- Accessibility Notes

## 21. 验收标准

设计系统增补完成后，应满足：

- 开发者不查看现有 CSS，也能知道组件在各状态下如何表现。
- 开发者能根据规范实现手机和桌面布局，而不需要自行发明断点。
- 所有表单控件都有错误、禁用、聚焦和帮助状态。
- 所有异步操作都有 loading、success 和 error 反馈模式。
- 删除、覆盖和特殊保存都有明确的 Dialog 规则。
- Toast 不再只是静态样张，而有完整行为定义。
- 模拟器被纳入同一设计语言。
- 所有一级页面都有 Mobile 与 Desktop 模板。
- 颜色和图标不再是表达状态的唯一手段。
- 设计 token 与视觉文档命名一致。
- 已明确解决 Ghost 边框、Spec Grid 外框、圆形例外和响应式字号等现有冲突。

## 22. 可直接交给设计师 AI 的指令

```text
请基于现有 POUR.LOG 设计系统做“增补”，不要重做品牌视觉。

输入文件：
1. design-tokens.json
2. 设计系统.dc.html
3. 本文档《POUR.LOG 设计系统增补任务书》

保留以下硬约束：森林绿主强调色、墨色深底、克制警示红、Noto Sans SC + JetBrains Mono 的字体职责、实验记录/参数仪器气质、卡片和主要组件全局直角。

请补齐响应式布局、桌面侧栏、交互状态矩阵、完整表单系统、导航、异步反馈、Toast、Dialog、Bottom Sheet、Accordion、Sticky、无障碍、图标与文案规则，以及冲煮模拟器组件。

每个组件必须包含 Anatomy、Variants、Sizes、Default/Hover/Focus/Pressed/Selected/Disabled/Loading/Error 状态、Responsive Behavior、Usage Rules、Do/Don't 和 Accessibility Notes。

请同时更新可视化设计文档和机器可读 token。不要把当前实现中的所有数值机械复制为 token；对本文列出的开放项逐项作出明确设计决定，并列出变更记录。
```
