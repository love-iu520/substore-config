# 项目协作规则

## 1. 项目定位

- **项目名称**：`SubstoreConfig`
- **用途**：维护供 Sub-Store 组合订阅使用的 Mihomo / Clash Party 后处理脚本及其内嵌策略组图标。
- **主要技术栈**：Sub-Store JavaScript 脚本、Python 3、Node.js、Windows Batch。
- **包管理 / 构建系统**：无；项目不依赖第三方包，也没有构建产物目录。
- **主要运行环境**：主脚本由 Sub-Store 调用；图标同步脚本在本地 Python 3 或 Node.js 环境运行。

当前实现事实以代码、配置、脚本和有效运行结果为准。本文件只记录项目特有执行规则，不保存详细实现说明或任务历史。

## 2. 项目入口与目录

| 入口 | 路径 | 用途 |
|---|---|---|
| 主脚本 | `scripts/mihomo-clash-party.js` | 接收 `config`、整理节点并重建 Mihomo 配置 |
| 图标源 | `icons/` | 保存策略组 PNG 图标 |
| Python 同步入口 | `sync-icons.py` | 将图标转换为 Base64 并写入主脚本 |
| Node 同步入口 | `sync-icons.js` | Python 不可用时的等价同步入口 |
| Windows 同步入口 | `一键同步图标.bat` | 优先调用 Python，失败时回退到 Node.js |

### 常见任务入口

| 任务类型 | 优先入口 |
|---|---|
| 修改节点整理、DNS、TUN 或分流 | `scripts/mihomo-clash-party.js` |
| 新增或调整策略组 | 主脚本的 `reservedProxyNames`、`proxyGroups`、`config.rules` 和必要的 `rule-providers` |
| 新增或更换图标 | `icons/`、两个同步脚本的 `ICON_MAPPING`，随后运行同步入口 |
| 修改使用或维护说明 | `README.md` |

## 3. 标准命令

命令均从项目根目录执行。

| 目的 | 命令 | 说明 |
|---|---|---|
| Windows 一键同步图标 | `一键同步图标.bat` | 优先使用可用的 Python，再回退到 Node.js |
| Python 同步图标 | `py sync-icons.py` | 读取 `icons/` 并更新主脚本中的生成区域 |
| Node.js 同步图标 | `node sync-icons.js` | 与 Python 入口用途相同，只需选择一个执行 |

项目目前没有自动化测试、Lint、类型检查或构建命令。

## 4. 项目特有修改边界

- `scripts/mihomo-clash-party.js` 中“策略组图标”开始和结束标记之间是生成区域。不要手动修改 Base64 内容；应修改 `icons/` 和映射后重新运行同步脚本。
- `sync-icons.py` 与 `sync-icons.js` 的 `ICON_MAPPING` 是两个运行入口的等价配置。增删或重命名映射时必须保持两处一致。
- 新增策略组时同步检查 `reservedProxyNames`、`proxyGroups`、引用该组的 `config.rules`、必要的 `rule-providers`、图标文件和两处 `ICON_MAPPING`；不能只修改生成后的 `groupIcons`。
- 规则顺序属于行为的一部分。具体服务规则应位于会覆盖它的 Google、Microsoft、AI 总规则、`geolocation-!cn` 等通用规则之前。
- 主脚本依赖 Sub-Store 通过 `config.proxies` 注入组合订阅节点，并主动删除 `proxy-providers`。没有当前明确要求时保持该输入模型不变。
- 主脚本运行在 Sub-Store 脚本环境中。沿用现有 `function`/`var` 风格，不在主脚本中引入 Node.js 专有模块或文件系统 API。
- 节点原始顺序、精确去重、同名异配置重命名、空策略组使用 `REJECT`、住宅 SOCKS 链式代理均为当前稳定行为；没有当前明确要求时保持不变。

## 5. 项目验证入口

| 修改类型 | 优先验证入口 | 备注 |
|---|---|---|
| 纯文档 | 静态核对路径、命令和远程脚本地址 | 项目没有文档检查器 |
| 图标或映射 | 运行一个图标同步入口 | 确认所有目标映射显示 `[OK]`，且没有缺失图标警告 |
| 分组或分流逻辑 | 使用 Sub-Store 重新生成组合订阅并在 Mihomo / Clash Party 中加载 | 项目目前没有本地自动化测试入口 |

验证范围仍按全局规则决定；本节只提供项目已有的真实入口。

## 6. 治理维护

- 项目当前采用 L1 治理，仅使用根目录 `AGENTS.md`；尚未启用 `docs/CONTEXT.md` 或 `docs/PROJECT_MEMORY.md`。
- 只有命中 `PROJECT_AGENTS_WORKFLOW V2` 的升级或写入门禁时，才创建对应治理层，不创建空文件占位。
- 本文件只在项目特有入口、标准命令、修改边界或验证方式发生稳定变化时更新。
