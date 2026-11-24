# 网页回归验证

产品代码来源：58a25be1097a7902058a3c0a78415a2c90408cc5；Prompt：precise-followup-v21。五项场景使用同一份运行代码，运行前后代码与Prompt哈希一致。

| 场景 | 结果 | 场景耗时 |
| --- | --- | --- |
| comparison-feedback | 通过 | 9128 ms |
| comparison-navigation | 通过 | 7197 ms |
| rewrite-feedback | 通过 | 5720 ms |
| review-reference | 通过 | 8882 ms |
| phase2-flow | 通过 | 4747 ms |

环境：Windows、Node.js v24.22.3、Playwright 1.62.1、Chrome 157.0.8103.79；PDF使用Python 3.12.14和pypdf 6.21.4，真实提取及预览通过。以上为自动化耗时，不是人工操作耗时。

四项场景使用Mock；phase2-flow使用Live协议连接本机固定响应服务，共6次本机上游请求，包含刻意返回无效JSON的解析/重生成失败检查。网页已完成补问回答、事实确认、接受建议、最终保存、刷新重开与已保存文本查看。固定响应中的usage是测试值，不是DeepSeek Token用量，不进入API费用账本。外部模型调用0次，API费用0元。

首次运行comparison-feedback通过，comparison-navigation因历史脚本硬编码600字重失败。现版ui-polish.css:485已使用500字重、普通项为400；脚本改为验证相对字重、不同文字颜色和is-current高亮，保留全部导航行为断言。随后只复测该场景并执行尚未运行的3项，4项通过。未通过项没有被删除，第一次失败的轨迹及报告保留。

这5项结果来自以下两次运行，未重复已有效通过的场景：

- 2026-11-24T07-04-39-721Z-267efcf9：1项通过、1项视觉断言不适配、3项未执行。
- 2026-11-24T07-06-29-834Z-478849d4：适配后的导航与剩余3项全部通过。

运行器默认将完整记录写入qa/output/；本次记录已另存本机整理档案，截图、任务快照与trace.zip不随公开目录打包。报告文件哈希可用于对应本次证据：

| 场景 | report.json SHA-256 |
| --- | --- |
| comparison-feedback | `cf5a79334e1a5148439e5e1f1bb1567d9bd3e90806884aecffc4cfc9fa4a5a3b` |
| comparison-navigation | `3acf964b30fea545dada2c7daf9c8237c28fda655152b872bc01d0a5304d0558` |
| rewrite-feedback | `b99536f53f7e08c5813ec8c0745d7f4029112213c91dae632b4ab7ed5dac3086` |
| review-reference | `369b726de4e94b4fb7086315b3533f7f123ea0561d4cb469541405d2cd681e92` |
| phase2-flow | `49428eb23e76fcc70a52098bb68975499645cf3aa7e7cabc39462a6af86b2a78` |

这些结果覆盖指定的浏览器交互及协议状态，不是新增真实模型效果评测，也不证明未覆盖的场景或真人使用指标。
