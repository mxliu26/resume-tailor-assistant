# 目录与文件说明

本说明帮助阅读者理解各目录和文件，也便于后续整理仓库首页。完整清单见[FILE_INDEX.json](FILE_INDEX.json)。

## 目录职责

| 目录 | GitHub目录介绍可用文案 |
| --- | --- |
| public/ | 前端界面、任务交互、核对编辑与浏览器本机存储。 |
| public/vendor/pdfjs/ | 随产品提供的PDF预览依赖及原始第三方许可。 |
| lib/ | 模型接口、材料解析、经历来源与事实校验。 |
| prompts/ | 固定的v21解析、关联补问与逐条改写Prompt。 |
| scripts/ | PDF文字提取等本机辅助脚本。 |
| examples/ | 两组通过网页操作验证的合成材料、问答协议、AI初稿与保存版本。 |
| tests/ | 当前v21程序规则的离线自动化测试、合成夹具及验证说明。 |
| qa/ | 隔离浏览器网页回归，检查交互、编辑、PDF与保存恢复，不调用付费模型。 |
| docs/ | 产品设计、流程图、截图、评测摘要和典型修复案例。 |
| docs/figures/ | 用户流程与AI工作流的SVG和Mermaid源文件。 |
| docs/images/ | 合成材料产品截图与流程展示长图。 |
| docs/evidence/ | 评分口径、逐单元结果和典型案例的精简证据。 |
| docs/testing/ | 本机Demo、真实模型联调及AI效果评测的三阶段精简报告与证据导航。 |

## 根目录

| 文件 | 内容与用途 |
| --- | --- |
| [.env.example](../.env.example) | 提供mock/live、端口、模型、超时与PDF提取配置示例；API密钥为空。 |
| [.gitignore](../.gitignore) | 排除密钥、私人材料、用户数据和运行日志；仅放行指定展示截图。 |
| [CHANGELOG.md](../CHANGELOG.md) | 按迭代主题记录主要产品改动、Prompt版本与研发来源SHA。 |
| [README.md](../README.md) | GitHub首页入口：产品介绍、流程、截图、评测摘录、启动方法和文档导航。 |
| [package.json](../package.json) | Node模块类型、运行环境要求及启动命令；保留原工程元数据。 |
| [requirements.txt](../requirements.txt) | PDF文字提取的Python依赖及版本。 |
| [server.mjs](../server.mjs) | 本机HTTP服务、前端静态资源、PDF提取及AI解析/关联/改写接口和输出校验。 |
| [start-demo.cmd](../start-demo.cmd) | Windows双击启动入口，转交PowerShell启动脚本。 |
| [start.ps1](../start.ps1) | 查找并检查Node运行环境，然后启动本机服务。 |

## 后端与Prompt

| 文件 | 内容与用途 |
| --- | --- |
| [lib/evidence-quote.mjs](../lib/evidence-quote.mjs) | 匹配连续证据来源，对限定的PDF中文换行差异作等价处理。 |
| [lib/factual-sources.mjs](../lib/factual-sources.mjs) | 提取可用于改写的事实内容并检查团队数值成果的归属边界。 |
| [lib/material-pipeline.mjs](../lib/material-pipeline.mjs) | 组装解析和关联上下文，处理材料脱敏、经历边界与来源检查。 |
| [lib/model-client.mjs](../lib/model-client.mjs) | 加载v21 Prompt并调用OpenAI兼容API，处理超时、响应与调用错误。 |
| [prompts/precise-followup-v21.json](../prompts/precise-followup-v21.json) | shared、parse、analyze、rewrite四部分提示词；不含API密钥。 |
| [scripts/pdf_extract.py](../scripts/pdf_extract.py) | 使用pypdf从PDF提取文本并以JSON返回结果。 |

## 前端自有文件

| 文件 | 内容与用途 |
| --- | --- |
| [public/ai-state.js](../public/ai-state.js) | 标识当前任务和关联快照，避免过期AI结果覆盖新的编辑。 |
| [public/analysis-model.js](../public/analysis-model.js) | 派生岗位要求判断、下一步建议和改写清单。 |
| [public/app.js](../public/app.js) | 页面路由、操作事件、任务与版本存储以及后端请求编排。 |
| [public/comparison-navigation.js](../public/comparison-navigation.js) | 对照页面的要求导航与滚动定位。 |
| [public/comparison-view.js](../public/comparison-view.js) | 渲染岗位匹配、经历依据、判断建议、补问和修改清单。 |
| [public/domain.js](../public/domain.js) | 任务领域规则、材料与事实处理、最终稿组合，以及模拟模式的规则引擎。 |
| [public/followup-state.js](../public/followup-state.js) | 处理补问答案的开始编辑、取消和提交，保留相关确认状态。 |
| [public/index.html](../public/index.html) | 网页入口、应用挂载节点、样式与脚本加载。 |
| [public/job-focus.js](../public/job-focus.js) | 根据已核对关联形成岗位重点与经历推荐顺序，不创造新事实。 |
| [public/material-units.js](../public/material-units.js) | 判断可处理的材料单元并保留原始章节标题。 |
| [public/pdf-source.js](../public/pdf-source.js) | 加载PDF.js、渲染PDF预览并在浏览器存储原件。 |
| [public/question-scope.js](../public/question-scope.js) | 管理补问覆盖的岗位要求和回答状态，限制覆盖范围与事实归属。 |
| [public/review-presentation.js](../public/review-presentation.js) | 解析校对的显示分组、要求类别样式和文本差异呈现。 |
| [public/review-reference.js](../public/review-reference.js) | 解析校对时展示简历PDF或JD参考内容并保持定位。 |
| [public/review-state.js](../public/review-state.js) | 处理校对草稿、变更检测、统一应用及重新确认规则。 |
| [public/review-view.js](../public/review-view.js) | 渲染材料校对页面与变更提示。 |
| [public/rewrite-editor.js](../public/rewrite-editor.js) | 显示原文、AI建议与用户编辑差异，维护编辑器交互。 |
| [public/style.css](../public/style.css) | 全站基础布局、组件、排版和响应式样式。 |
| [public/ui-polish.css](../public/ui-polish.css) | 奶油色视觉、字体层级、导航和核心页面的细节样式。 |
| [public/unit-presentation.js](../public/unit-presentation.js) | 为材料单元生成显示标题和辅助信息，不改写原始内容。 |
| [public/visual-assets.js](../public/visual-assets.js) | 统一线性图标及顶部、侧栏的小插画。 |

## 展示材料与依据

| 文件 | 内容与用途 |
| --- | --- |
| [docs/BAD_CASES.md](BAD_CASES.md) | 到岗来源遗漏、无效补问、PDF工具名误判及Prompt修复跨经历引用。 |
| [docs/EVALUATION_SUMMARY.md](EVALUATION_SUMMARY.md) | 历史流程、质量、事实口径及人工修正量的手工记录与计数规则。 |
| [docs/FILE_INDEX.json](FILE_INDEX.json) | 完整文件路径与用途索引，供后续维护和上传核对。 |
| [docs/PRD.md](PRD.md) | 产品需求摘要：用户、问题、范围、五步流程和事实约束。 |
| [docs/README.md](README.md) | 文档目录入口，说明每份展示材料的用途。 |
| [docs/REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md) | 人可阅读的目录说明和逐个自有文件用途。 |
| [docs/SCREENSHOTS.md](SCREENSHOTS.md) | 介绍GitHub首页长图、三张核心截图及合成材料、模拟模式来源。 |
| [docs/WORKFLOW.md](WORKFLOW.md) | 用户流程与AI工作流图，以及模型、程序和用户的责任分工。 |
| [docs/evidence/bad-case-records.json](evidence/bad-case-records.json) | 四个典型问题的结构化根因、修复、验证范围与版本标识。 |
| [docs/evidence/product-overview.json](evidence/product-overview.json) | 首页展示长图的图片哈希、运行代码、截图来源及模拟操作检查。 |
| [docs/evidence/manual-corrections.json](evidence/manual-corrections.json) | 负责人提供的两版各10组人工修正次数、计数范围、计算及记录边界。 |
| [docs/evidence/metrics.json](evidence/metrics.json) | 指标数值、分母、评分性质、版本及人工修正量手工统计。 |
| [docs/evidence/prompt-fix-example.json](evidence/prompt-fix-example.json) | v7→v8 Prompt增量及同一合成案例的实际引用前后片段。 |
| [docs/evidence/review-confirmation.json](evidence/review-confirmation.json) | 负责人确认的v6/v21汇总与相对变化计算口径，无私人对话全文。 |
| [docs/evidence/source-index.json](evidence/source-index.json) | 来源名称、SHA-256与已公开节选的对应索引，不含本机绝对路径。 |
| [docs/evidence/unit-scores.json](evidence/unit-scores.json) | v21的13个经历单元四维正式评分、正文事实结论和Run ID。 |
| [docs/figures/ai-workflow.mmd](figures/ai-workflow.mmd) | AI工作流的可编辑Mermaid源文件。 |
| [docs/figures/ai-workflow.svg](figures/ai-workflow.svg) | 可直接展示的AI任务、校验与事实确认工作流。 |
| [docs/figures/user-flow.mmd](figures/user-flow.mmd) | 五步用户流程图的可编辑Mermaid源文件。 |
| [docs/figures/user-flow.svg](figures/user-flow.svg) | 可直接展示的五步用户流程图。 |
| [docs/images/product-overview.png](images/product-overview.png) | GitHub首页使用的四环节产品流程长图，合成材料、模拟模式界面实拍。 |
| [docs/images/01-matching.jpg](images/01-matching.jpg) | 虚构材料的桌面对照与补问页面截图。 |
| [docs/images/02-rewrite.jpg](images/02-rewrite.jpg) | 虚构材料的原文、改写建议与差异核对截图。 |
| [docs/images/03-mobile.jpg](images/03-mobile.jpg) | 虚构材料的移动端页面截图。 |

## 合成求职示例

仅包含本轮已完成保存、刷新和重开的case-02与case-03；原始失败日志和浏览器资料保留在内部测试目录，不加入公开示例。

| 文件 | 内容与用途 |
| --- | --- |
| [examples/README.md](../examples/README.md) | 两组已完成网页端到端操作的合成案例入口、使用协议和文件说明。 |
| [examples/case-02-data-analyst/resume.txt](../examples/case-02-data-analyst/resume.txt) | 该组合成简历原始文本；作为初始输入。 |
| [examples/case-02-data-analyst/job_description.txt](../examples/case-02-data-analyst/job_description.txt) | 该组目标岗位JD原始文本；作为初始输入。 |
| [examples/case-02-data-analyst/tester_notes.json](../examples/case-02-data-analyst/tester_notes.json) | 测试者专用合成事实、预设回答和本次实际问答；不得预先输入模型。 |
| [examples/case-02-data-analyst/outputs.json](../examples/case-02-data-analyst/outputs.json) | 本次真实网页测试的解析、关联、T0/T1/T2、来源、确认状态、运行版本与用量。 |
| [examples/case-02-data-analyst/final_resume.txt](../examples/case-02-data-analyst/final_resume.txt) | 直接取自网页保存版本的完整合成简历终稿。 |
| [examples/case-02-data-analyst/README.md](../examples/case-02-data-analyst/README.md) | 本组合成示例的实际网页步骤、问答处理、保存验证及事实核查重点。 |
| [examples/case-03-algorithm-engineer/resume.txt](../examples/case-03-algorithm-engineer/resume.txt) | 该组合成简历原始文本；作为初始输入。 |
| [examples/case-03-algorithm-engineer/job_description.txt](../examples/case-03-algorithm-engineer/job_description.txt) | 该组目标岗位JD原始文本；作为初始输入。 |
| [examples/case-03-algorithm-engineer/tester_notes.json](../examples/case-03-algorithm-engineer/tester_notes.json) | 测试者专用合成事实、预设回答和本次实际问答；不得预先输入模型。 |
| [examples/case-03-algorithm-engineer/outputs.json](../examples/case-03-algorithm-engineer/outputs.json) | 本次真实网页测试的解析、关联、T0/T1/T2、来源、确认状态、运行版本与用量。 |
| [examples/case-03-algorithm-engineer/final_resume.txt](../examples/case-03-algorithm-engineer/final_resume.txt) | 直接取自网页保存版本的完整合成简历终稿。 |
| [examples/case-03-algorithm-engineer/README.md](../examples/case-03-algorithm-engineer/README.md) | 本组合成示例的实际网页步骤、问答处理、保存验证及事实核查重点。 |

## 离线自动化测试

使用Node内置测试框架，运行入口为npm test。模型响应固定或由测试构造；接口测试仅使用本机临时服务。全部测试来自当前代码对应的研发提交，历史快照差异检查与内部批次工具按范围单独保留在原研发仓库。

| 文件 | 内容与用途 |
| --- | --- |
| [tests/README.md](../tests/README.md) | 离线测试运行方式、依赖、覆盖范围及结果解释。 |
| [tests/SOURCES.json](../tests/SOURCES.json) | 每份测试与合成夹具的来源提交、源文件哈希、打包哈希及整理差异。 |
| [tests/VERIFICATION.md](../tests/VERIFICATION.md) | 当前整理包336项离线检查的实际结果、环境与TAP日志哈希。 |
| [tests/ai-pipeline.test.mjs](../tests/ai-pipeline.test.mjs) | 解析原文覆盖、证据与补问校验、过期响应保护及模型客户端错误处理。 |
| [tests/analysis-model.test.js](../tests/analysis-model.test.js) | 岗位要求判断、关联证据和改写清单的派生规则。 |
| [tests/comparison-view.test.js](../tests/comparison-view.test.js) | 岗位对照、补问表单、用户文本转义与展示。 |
| [tests/domain.test.js](../tests/domain.test.js) | 材料拆分、事实冲突、模拟候选、最终稿组合与保存前检查。 |
| [tests/education-condition.test.mjs](../tests/education-condition.test.mjs) | 学历分类与优先强度分离，混合要求不被机械重分类。 |
| [tests/evidence-scope-retry.test.mjs](../tests/evidence-scope-retry.test.mjs) | 跨经历证据仅纠错一次并完整重校验；JD标题与真实要求的边界。 |
| [tests/experience-boundaries.test.mjs](../tests/experience-boundaries.test.mjs) | 独立经历拆分、来源ID与原文完整性，同项目多阶段不机械拆分。 |
| [tests/followup-state.test.js](../tests/followup-state.test.js) | 补问编辑、取消、替换、确认状态及事实与来源保留。 |
| [tests/manual-followup-payload.test.mjs](../tests/manual-followup-payload.test.mjs) | 手动关联及已回答状态向后端传递，旧响应不覆盖新修改。 |
| [tests/pdf-evidence-quote.test.mjs](../tests/pdf-evidence-quote.test.mjs) | 中文PDF换行等价匹配，不放宽数字、否定和来源归属。 |
| [tests/pdf-tool-spacing.test.mjs](../tests/pdf-tool-spacing.test.mjs) | MATLAB限定空格匹配，其他无来源工具和跨来源拼接仍拒绝。 |
| [tests/review-presentation.test.js](../tests/review-presentation.test.js) | 校对页面分组、要求类别与文本变化显示。 |
| [tests/review-state.test.js](../tests/review-state.test.js) | 材料校对草稿、格式变化、事实确认和结果失效处理。 |
| [tests/rewrite-editor.test.js](../tests/rewrite-editor.test.js) | 原文、建议与手动编辑差异的呈现与文本保护。 |
| [tests/role-attribution.test.js](../tests/role-attribution.test.js) | 区分第三方负责人主导与本人主导，保留其他事实限制。 |
| [tests/server.test.mjs](../tests/server.test.mjs) | 本机HTTP接口、授权、隐私、并发、错误响应及PDF提取与静态资源。 |
| [tests/unit-presentation.test.js](../tests/unit-presentation.test.js) | 经历显示标题、日期、章节与正文保留。 |
| [tests/condition-contract.test.mjs](../tests/condition-contract.test.mjs) | 明确条件与能力证据状态分离，确定判断必须有对应证据。 |
| [tests/none-authorization.test.mjs](../tests/none-authorization.test.mjs) | 未提供、未知或跳过不等于未做过；否定授权限制到原配对。 |
| [tests/resolved-questions.test.mjs](../tests/resolved-questions.test.mjs) | 已回答、未知、未做过、跳过及归档状态阻止重复补问。 |
| [tests/parse-identity.test.mjs](../tests/parse-identity.test.mjs) | 身份占位符与原文偏移保留，关键事实缺失仍拒绝。 |
| [tests/factual-boundary.test.mjs](../tests/factual-boundary.test.mjs) | 团队成果、未上线及未访谈事实保护，非事实指令不作证据。 |
| [tests/precise-followup.test.mjs](../tests/precise-followup.test.mjs) | v21补问契约、同经历缺口合并、草稿保护及确认范围。 |
| [tests/job-targeting.test.mjs](../tests/job-targeting.test.mjs) | 不同JD的来源和重点组装、推荐顺序、保留原文及事实边界。 |
| [tests/fixtures/ai-bc-0006.json](../tests/fixtures/ai-bc-0006.json) | 条件状态误用的合成请求与历史响应。 |
| [tests/fixtures/ai-bc-0007-0008.json](../tests/fixtures/ai-bc-0007-0008.json) | 学历误分类、确认后重复补问的合成输入与状态。 |
| [tests/fixtures/ai-bc-0011.json](../tests/fixtures/ai-bc-0011.json) | 把未提供误判为没有经历的合成任务与响应。 |
| [tests/fixtures/precise-followup-v18-duplicate.json](../tests/fixtures/precise-followup-v18-duplicate.json) | 补问覆盖重复的合成任务与历史响应。 |
| [tests/fixtures/precise-followup-v18.json](../tests/fixtures/precise-followup-v18.json) | 相近与不同补问缺口的合成任务和固定响应。 |
| [tests/fixtures/precise-followup-v20-rejections.json](../tests/fixtures/precise-followup-v20-rejections.json) | 明确条件错误绑定与冲突经历补问的拒绝样本。 |
| [tests/fixtures/job-targeting-v9.json](../tests/fixtures/job-targeting-v9.json) | 同份合成简历匹配两个JD的历史固定响应与来源哈希；用于当前规则回放。 |
| [tests/fixtures/parse-identity.json](../tests/fixtures/parse-identity.json) | 身份占位符与原文保真检查的虚构简历和JD。 |
| [tests/fixtures/factual-boundary.json](../tests/fixtures/factual-boundary.json) | 团队成果、否定事实及非事实指令边界的虚构材料。 |

## 网页回归工具

与tests/互补，在真实浏览器中检查页面操作。4项使用Mock，1项以Live协议连接本机固定响应；均不使用真实模型。qa/output/及依赖目录由.gitignore排除，不属于公开文件清单。

| 文件 | 内容与用途 |
| --- | --- |
| [qa/package.json](../qa/package.json) | 网页回归的独立依赖与运行入口；不增加产品运行依赖。 |
| [qa/runtime.mjs](../qa/runtime.mjs) | 启动随机端口的隔离服务与浏览器，阻断外网页面请求，记录请求、截图轨迹和代码哈希。 |
| [qa/comparison-feedback.mjs](../qa/comparison-feedback.mjs) | 校对确认门槛；关联调整与答案/事实保留；长文编辑对齐；采用/编辑/拒绝/保留状态；移动端布局。 |
| [qa/comparison-navigation.mjs](../qa/comparison-navigation.mjs) | 主栏滚动与侧栏定位；反向导航与保存重绘；改写清单选择与展开；移动端横向导航。 |
| [qa/rewrite-feedback.mjs](../qa/rewrite-feedback.mjs) | 差异高亮与文本编辑；撤销与中文组合输入；编辑稿持久化；补问/事实定位与分经历草稿；新候选不覆盖当前稿。 |
| [qa/review-reference.mjs](../qa/review-reference.mjs) | 两页合成PDF上传与渲染；翻页/缩放及JD参照；校对内容与PDF保存重开；无效文件保护；备份与隔离数据删除。 |
| [qa/fixtures/materials.json](../qa/fixtures/materials.json) | 本机协议流程的虚构简历、JD与触发后使用的回答。 |
| [qa/phase2-flow.mjs](../qa/phase2-flow.mjs) | 真实网页操作贯穿解析、补问、确认、改写与保存；AI上游为本机固定响应，非真实模型。 |
| [qa/run.mjs](../qa/run.mjs) | 顺序执行5项网页场景；失败即停止，保留日志并明确未执行数量。 |
| [qa/README.md](../qa/README.md) | 网页测试运行方法、5种场景、隔离方式与结果边界。 |
| [qa/SOURCES.json](../qa/SOURCES.json) | 现有网页测试的来源提交、原始和整理后的哈希以及适配说明。 |
| [qa/VERIFICATION.md](../qa/VERIFICATION.md) | 5项网页回归的实际结果、环境、证据哈希及测试范围说明。 |

## 阶段测试文档

归档历史结果，分别标注测试范围、代码与评分性质。完整历史原件保留在研发档案中；此处提供面向仓库读者的精简摘要。

| 文件 | 内容与用途 |
| --- | --- |
| [docs/testing/phase1/TEST_REPORT.md](testing/phase1/TEST_REPORT.md) | 本机Demo的四类功能验收、历史测试批次及精简证据说明。 |
| [docs/testing/phase2/TEST_REPORT.md](testing/phase2/TEST_REPORT.md) | 三组合成案例的真实模型基础联调、版本、调用用量与验收依据。 |
| [docs/testing/phase3/TEST_REPORT.md](testing/phase3/TEST_REPORT.md) | 固定开发集的v6/v21比较、正式人工评分、事实核查分母及回归调用记录。 |
| [docs/testing/README.md](testing/README.md) | 三个阶段测试摘要的总入口，并区分历史评测、当前离线测试与网页回归。 |

## PDF.js第三方文件

public/vendor/pdfjs/共199个原始资源文件，按用途分为核心解析库与Worker、字符映射、标准字体、WebAssembly解码资源及许可证。每个具体文件均列在FILE_INDEX.json；此处按功能归类，避免逐页重复列出字体和字符映射名称。

## 更新约定

增删文件时同步更新本说明与FILE_INDEX.json；代码或Prompt改动通过Git提交和CHANGELOG记录。原始材料、用户任务、密钥、完整运行日志及内部审核页面不属于本目录的公开内容。
