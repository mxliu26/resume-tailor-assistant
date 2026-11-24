# 网页回归 QA

本目录检查浏览器里的真实点击、输入、页面状态和本机保存。与[tests/](../tests/README.md)的程序规则测试互补。这里不评估DeepSeek的改写质量，也不计作真人内测。

## 运行

需要Node.js 20.12以上。首次在项目根目录安装独立测试依赖和浏览器：

```powershell
npm --prefix qa install
npm --prefix qa exec -- playwright install chromium
npm --prefix qa test
```

安装依赖需要网络，但运行不需要API密钥，不发送付费模型请求。不需要先启动产品服务。PDF场景还需要Python和pypdf，见[requirements.txt](../requirements.txt)；无法提取PDF会如实失败，不自动跳过。

已有Chrome或Edge可用时，可替代下载浏览器：

```powershell
$env:QA_BROWSER_CHANNEL = 'chrome' # 也可使用 msedge
npm --prefix qa test
```

单独运行某场景：

```powershell
node qa/run.mjs phase2-flow
```

QA_HEADED=1可显示自动化浏览器；QA_BROWSER_PATH可指定浏览器可执行文件；QA_PLAYWRIGHT可指定已经安装的playwright/index.mjs。这些都是本机可选环境变量，不写入产品配置。

## 检查范围

| 脚本 | 检查内容 | 材料/模型 |
| --- | --- | --- |
| comparison-feedback.mjs | 校对确认、手动关联、补问答案和事实保留、改写采用与状态恢复 | 合成文本；Mock |
| comparison-navigation.mjs | 滚动定位、侧栏高亮、改写清单展开/选择、窄屏布局 | 合成文本；Mock |
| rewrite-feedback.mjs | 编辑高亮、撤销、中文输入、草稿、补问定位、新候选保护 | 在隔离存储中构造中间态；Mock，非完整端到端 |
| review-reference.mjs | 合成PDF上传/预览、JD切换、保存重开、备份与删除 | 本机生成两页虚构PDF；Mock；含旧任务中间态检查 |
| phase2-flow.mjs | 输入→解析→关联→补问→确认→改写→最终保存→刷新重开；失败不覆盖已有稿 | Live接口协议＋本机固定上游响应；非DeepSeek调用 |

## 隔离与证据

- 每个场景使用随机本机端口、新的临时浏览器上下文；不连接已有服务，不读取或清空个人浏览器数据。删除检查仅作用于该场景自己的合成数据。
- 服务的模型地址、模式和假密钥由QA显式固定，不使用产品.env中的真实接口。Live协议场景只允许127.0.0.1固定响应上游；浏览器外网请求被拦截。
- 当前v21 Prompt、事实校验和业务代码原样执行，不改模型输出使断言通过。固定上游仅用于可复现的接口/前端状态检查。
- 每次结果放在qa/output/独立运行编号/，包含summary.json、各场景report.json、请求状态、截图、trace.zip及隔离任务快照。该目录和node_modules已被.gitignore排除，不随仓库上传。
- 失败立即保留截图、错误及运行日志；后续未执行场景单独列出。不能把一次场景通过理解为模型质量或所有功能验收通过。

脚本来源与整理说明见[SOURCES.json](SOURCES.json)，本次实际执行记录见[VERIFICATION.md](VERIFICATION.md)。
