# Story Me

面向图像/视频创作的本地优先资产与剧本工作流内核。  
以文件系统 + Markdown 作为真实数据源，支持后续桌面应用和 Web 适配。

## 当前状态

- 已完成 OpenSpec 变更：`video-creation-asset-manager`
- 已完成 OpenSpec 变更：`add-cli-workflow`
- 已实现核心服务层与测试集
- 已提供 CLI 命令层：`init`、`add-episode`、`new-asset`、`ingest`、`search`
- 暂未提供完整 GUI（当前是可复用业务内核）
- 渲染引擎接入不在 v1 范围内，仅保留插件扩展契约

## 已实现能力

- 项目脚手架：
  - `script-single`
  - `script-series`
- 资产模型：
  - 默认字段：`名称`、`描述`、`图像`
  - 支持自定义字段
  - 受管元数据：`schema_version`、`asset_id`、`type`、`updated_at`、`updated_by`、`rev`
- 导入流程：
  - 拖拽目标路由（资产/EP/场次）
  - `copy` 默认、`move` 可选
  - 冲突重命名
  - 批量进度与失败汇总
  - 最近一次导入可撤销
- 剧本流程：
  - EP 绑定
  - 资产引用 `[[asset_id]]`
  - 反向链接扫描
  - 文件级乐观锁与冲突落盘
- 预览流程：
  - Markdown + 媒体统一预览数据结构
  - 图片/视频/音频格式识别
  - 分镜分组
  - 懒加载分页
  - 不支持格式兜底
- 平台边界：
  - 平台适配器接口
  - 桌面适配器实现
  - 增量索引器
  - 渲染插件契约占位

## 快速开始

要求：

- Node.js `>=22`
- npm `>=10`

安装与测试：

```bash
npm test
```

CLI 示例：

```bash
# 初始化项目（默认 script-single）
npm run cli -- init --path /tmp/story-demo

# 初始化剧集型项目
npm run cli -- init --path /tmp/story-series --type script-series

# 新建 EP
npm run cli -- add-episode --path /tmp/story-series --episode 1

# 新建资产
npm run cli -- new-asset --path /tmp/story-series --type 角色 --name 林月 --description 主角 --image linyue.png

# 导入媒体（copy 默认）
npm run cli -- ingest --path /tmp/story-series --target 角色 --input /tmp/ref-a.png --input /tmp/ref-b.png

# 搜索（JSON 输出）
npm run cli -- search --path /tmp/story-series --query 林月 --type asset --json
```

本地 UI 启动：

```bash
# 启动本地工作台（默认 http://127.0.0.1:4173）
npm run ui
```

可选环境变量：

```bash
STORYME_UI_HOST=127.0.0.1 STORYME_UI_PORT=4173 npm run ui
```

当前测试覆盖：

- `test/project-scaffold.test.js`
- `test/asset-document.test.js`
- `test/ingest-service.test.js`
- `test/workspace-explorer.test.js`
- `test/preview-service.test.js`
- `test/script-workflow.test.js`
- `test/platform.test.js`
- `test/acceptance.test.js`
- `test/cli.test.js`
- `test/local-ui-api.test.js`
- `test/local-ui-smoke.test.js`

## 代码结构

```text
src/
  cli/                      # CLI 参数解析、命令分发、输出与错误处理
  ui-server/                # 本地 HTTP API 与静态资源服务
  ui/                       # 本地工作台前端（Tree + Editor + Preview）
  core/                     # 路径、文档、路由、链接等基础能力
  services/                 # 项目/导入/工作区/预览/剧本流程服务
  platform/                 # 平台适配、增量索引、渲染插件契约
test/                       # 单元与验收测试
docs/                       # 结构与能力矩阵文档
samples/                    # 示例项目
openspec/                   # 规格与变更记录（已归档）
```

## 最小使用示例

```js
import { createProjectScaffold, createEpisode } from "./src/services/project-service.js";
import { IngestService } from "./src/services/ingest-service.js";

await createProjectScaffold("/tmp/demo-story", "script-series");
await createEpisode("/tmp/demo-story", "EP01");

const ingest = new IngestService();
await ingest.ingestBatch({
  projectRoot: "/tmp/demo-story",
  target: { nodeType: "角色" },
  inputs: ["/tmp/source/hero.png"],
  mode: "copy",
});
```

## 相关文档

- CLI 使用说明：`docs/cli-usage.md`
- 本地 UI 使用说明：`docs/local-ui-usage.md`
- 项目结构与链接规范：`docs/project-schema-and-linking.md`
- 桌面/Web 能力矩阵：`docs/desktop-web-capability-matrix.md`
- 示例项目说明：`samples/README.md`

## OpenSpec 记录

- 归档变更：`openspec/changes/archive/2026-02-22-video-creation-asset-manager/`
- 主规格：
  - `openspec/specs/filesystem-project-structure/spec.md`
  - `openspec/specs/asset-ingest-and-linking/spec.md`
  - `openspec/specs/visual-workspace-explorer/spec.md`
  - `openspec/specs/multimedia-preview-panel/spec.md`
  - `openspec/specs/script-creation-workflow/spec.md`

## 下一步建议

- 接入桌面 UI（Tauri + 前端）
- 在 v2 引入云端协作层（保持现有文件模型兼容）
