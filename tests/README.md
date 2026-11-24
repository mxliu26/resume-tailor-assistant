# 离线自动化测试

本目录检查当前v21展示包的程序规则：材料保真、经历来源、补问状态、事实边界、校对编辑和本机接口。来源提交为`58a25be1097a7902058a3c0a78415a2c90408cc5`。每份测试的来源哈希、整理差异和用途见[SOURCES.json](SOURCES.json)。

## 运行

需要Node.js 20.12及以上。测试使用Node内置测试框架，不需要安装npm依赖，也不需要配置API密钥。

在项目根目录执行：

```powershell
npm test
```

等效命令：

```powershell
node --test
```

单独检查经历边界：

```powershell
node --test tests/experience-boundaries.test.mjs
```

PDF提取测试还需要Python和requirements.txt中的pypdf。普通环境可先执行`python -m pip install -r requirements.txt`；如自动选择的Python不是已安装依赖的解释器，可在当前终端设置`$env:PYTHON`为其路径。缺依赖时PDF测试会失败并给出错误，不会静默跳过。

## 调用与数据范围

- 所有模型行为使用固定响应或测试内构造数据；不向DeepSeek或其他外部模型发送请求，不产生API费用。
- server.test.mjs与ai-pipeline.test.mjs使用127.0.0.1随机空闲端口，测试结束关闭自己的服务；不会占用现有Demo固定端口。名为live的测试分支连接的是本机假上游，用于验证真实接口处理逻辑。
- fixtures/保存虚构材料及必要响应，不包含真实简历、真实密钥、浏览器任务备份或完整运行日志。测试中的示例手机号、邮箱和密钥字符串均是明确构造的占位值。
- 有些测试导入server.mjs，它沿用现有配置加载逻辑；模型调用均显式替换为固定响应，本机接口子进程覆盖模型地址与测试密钥。无需创建或修改.env。
- 不读写浏览器任务；状态变更在测试创建的内存对象中完成。正常运行不修改产品源文件。

## 测试清单

| 文件 | 检查内容 |
| --- | --- |
| [ai-pipeline.test.mjs](ai-pipeline.test.mjs) | 解析原文覆盖、证据与补问校验、过期响应保护及模型客户端错误处理。 |
| [analysis-model.test.js](analysis-model.test.js) | 岗位要求判断、关联证据和改写清单的派生规则。 |
| [comparison-view.test.js](comparison-view.test.js) | 岗位对照、补问表单、用户文本转义与展示。 |
| [domain.test.js](domain.test.js) | 材料拆分、事实冲突、模拟候选、最终稿组合与保存前检查。 |
| [education-condition.test.mjs](education-condition.test.mjs) | 学历分类与优先强度分离，混合要求不被机械重分类。 |
| [evidence-scope-retry.test.mjs](evidence-scope-retry.test.mjs) | 跨经历证据仅纠错一次并完整重校验；JD标题与真实要求的边界。 |
| [experience-boundaries.test.mjs](experience-boundaries.test.mjs) | 独立经历拆分、来源ID与原文完整性，同项目多阶段不机械拆分。 |
| [followup-state.test.js](followup-state.test.js) | 补问编辑、取消、替换、确认状态及事实与来源保留。 |
| [manual-followup-payload.test.mjs](manual-followup-payload.test.mjs) | 手动关联及已回答状态向后端传递，旧响应不覆盖新修改。 |
| [pdf-evidence-quote.test.mjs](pdf-evidence-quote.test.mjs) | 中文PDF换行等价匹配，不放宽数字、否定和来源归属。 |
| [pdf-tool-spacing.test.mjs](pdf-tool-spacing.test.mjs) | MATLAB限定空格匹配，其他无来源工具和跨来源拼接仍拒绝。 |
| [review-presentation.test.js](review-presentation.test.js) | 校对页面分组、要求类别与文本变化显示。 |
| [review-state.test.js](review-state.test.js) | 材料校对草稿、格式变化、事实确认和结果失效处理。 |
| [rewrite-editor.test.js](rewrite-editor.test.js) | 原文、建议与手动编辑差异的呈现与文本保护。 |
| [role-attribution.test.js](role-attribution.test.js) | 区分第三方负责人主导与本人主导，保留其他事实限制。 |
| [server.test.mjs](server.test.mjs) | 本机HTTP接口、授权、隐私、并发、错误响应及PDF提取与静态资源。 |
| [unit-presentation.test.js](unit-presentation.test.js) | 经历显示标题、日期、章节与正文保留。 |
| [condition-contract.test.mjs](condition-contract.test.mjs) | 明确条件与能力证据状态分离，确定判断必须有对应证据。 |
| [none-authorization.test.mjs](none-authorization.test.mjs) | 未提供、未知或跳过不等于未做过；否定授权限制到原配对。 |
| [resolved-questions.test.mjs](resolved-questions.test.mjs) | 已回答、未知、未做过、跳过及归档状态阻止重复补问。 |
| [parse-identity.test.mjs](parse-identity.test.mjs) | 身份占位符与原文偏移保留，关键事实缺失仍拒绝。 |
| [factual-boundary.test.mjs](factual-boundary.test.mjs) | 团队成果、未上线及未访谈事实保护，非事实指令不作证据。 |
| [precise-followup.test.mjs](precise-followup.test.mjs) | v21补问契约、同经历缺口合并、草稿保护及确认范围。 |
| [job-targeting.test.mjs](job-targeting.test.mjs) | 不同JD的来源和重点组装、推荐顺序、保留原文及事实边界。 |

## 结果解释

通过表示这些固定输入下的程序断言成立。期待拒绝无来源事实的测试，会以“成功拦截”为通过条件；不能据此声称模型从不生成错误。

这些测试不替代真实网页操作、AI表达质量评测或人工核查，也不统计用户满意度、人工修正量和真人耗时。保留已有10组开发评测、人工评分和5组合成案例记录，不将离线回放改记为新一轮真实API测试。

整理后的实际运行结果见[VERIFICATION.md](VERIFICATION.md)。
