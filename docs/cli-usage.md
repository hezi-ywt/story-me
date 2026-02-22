# Story Me CLI 使用说明

## 运行方式

项目内推荐使用：

```bash
npm run cli -- <command> [options]
```

如果作为 npm 包安装，可使用：

```bash
storyme <command> [options]
```

## 全局选项

- `--json`: 输出机器可读 JSON
- `--help` / `-h`: 显示帮助

## 命令

### `init`

初始化项目结构。

```bash
storyme init --path <project-root> [--type script-single|script-series]
```

示例：

```bash
storyme init --path /tmp/story-series --type script-series
```

### `add-episode`

新增剧集目录（`EPxx` + 大纲/剧本/场次）。

```bash
storyme add-episode --path <project-root> --episode <EP|number>
```

示例：

```bash
storyme add-episode --path /tmp/story-series --episode 1
```

### `new-asset`

新增基础资产文档。

```bash
storyme new-asset --path <project-root> --type <角色|场景|道具> --name <asset-name> [--description <text>] [--image <file>]
```

示例：

```bash
storyme new-asset --path /tmp/story-series --type 角色 --name 林月 --description 主角 --image linyue.png
```

### `ingest`

导入媒体资源到目标节点。

```bash
storyme ingest --path <project-root> --target <角色|场景|道具|资产|EP|场次> --input <file> [--input <file>] [--mode copy|move] [--episode <EP>] [--scene <scene-name>]
```

说明：

- `--mode` 默认 `copy`
- `--target EP` 需要同时传 `--episode`
- `--target 场次` 需要同时传 `--episode` 与 `--scene`

示例：

```bash
storyme ingest --path /tmp/story-series --target 角色 --input /tmp/a.png --input /tmp/b.png
storyme ingest --path /tmp/story-series --target 场次 --episode EP01 --scene 01-开场 --input /tmp/shot-001.png
```

### `search`

搜索工作区 Markdown 内容。

```bash
storyme search --path <project-root> [--query <text>] [--type <asset|script|doc>] [--tag <text>] [--json]
```

示例：

```bash
storyme search --path /tmp/story-series --query 茶馆 --type script --json
```

## 输出与错误码

- 成功退出码：`0`
- 参数/校验错误退出码：`2`
- 运行时错误退出码：`1`

默认输出为人类可读文本；使用 `--json` 时输出固定结构：

成功：

```json
{
  "ok": true,
  "command": "init",
  "result": {}
}
```

失败：

```json
{
  "ok": false,
  "command": "init",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required argument: --path",
    "details": {}
  }
}
```
