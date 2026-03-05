# 火山方舟 Seedream / Seedance MCP 服务

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)

一个基于火山方舟（Ark）API 的 MCP 服务，提供：
- Seedream 图片生成/编辑
- Seedance 视频生成（异步任务）
- 本地 `stdio` 与远程 `http` 两种接入模式

## 功能概览

| 能力 | 状态 | 说明 |
|---|---|---|
| 图片生成/编辑 | 可用 | 基于 `POST /api/v3/images/generations` |
| 视频生成 | 可用 | 基于 `POST /api/v3/contents/generations/tasks` + 查询任务 |
| 本地接入 | 可用 | `StdioServerTransport` |
| 远程接入 | 可用 | `StreamableHTTPServerTransport` |

## 快速开始

### 环境要求
- Node.js 18+
- pnpm

### 安装依赖
```bash
pnpm install
```

### 构建
```bash
pnpm build
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `ARK_API_KEY` | 是 | - | 火山方舟 API Key |
| `MCP_TRANSPORT` | 否 | `stdio` | 传输模式：`stdio` 或 `http` |
| `MCP_HTTP_HOST` | 否 | `0.0.0.0` | `http` 模式监听地址 |
| `MCP_HTTP_PORT` | 否 | `3000` | `http` 模式监听端口 |
| `MCP_HTTP_PATH` | 否 | `/mcp` | `http` 模式 MCP 路径 |

可在项目根目录创建 `.env`：
```env
ARK_API_KEY=your_ark_api_key
MCP_TRANSPORT=stdio
```

## 启动方式

### 1. 本地模式（默认，stdio）
```bash
pnpm build
node build/index.js
```

### 2. 远程模式（http）
PowerShell 示例：
```powershell
$env:ARK_API_KEY="your_ark_api_key"
$env:MCP_TRANSPORT="http"
$env:MCP_HTTP_HOST="0.0.0.0"
$env:MCP_HTTP_PORT="3000"
$env:MCP_HTTP_PATH="/mcp"
node build/index.js
```

服务启动后地址示例：
```text
http://127.0.0.1:3000/mcp
```

## MCP 客户端接入

### 本地命令方式（stdio）
```json
{
  "mcpServers": {
    "jimenggen": {
      "command": "node",
      "args": [
        "/path/to/jimenggen-mcp/build/index.js"
      ],
      "env": {
        "ARK_API_KEY": "your_ark_api_key",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

### 远程地址方式（http）
不同客户端配置字段可能不同，核心是把 MCP 服务地址指向：
```text
http://your-host:3000/mcp
```

## 工具列表

### 可用工具
| 工具名 | 用途 |
|---|---|
| `text-to-image` | 文生图 |
| `image-to-image` | 图生图 |
| `generate-image` | 通用图片生成/编辑（支持 URL 与上传文件） |
| `generate-img-seedream4` | 直接调用 Seedream API 生成图片 |
| `generate-video` | 视频生成（异步任务，内置轮询） |

### 停用工具
- `generate-digital-human`
- `action-imitation`
- `image-dressing`

## 模型清单

### Seedream（图片）
- `doubao-seedream-5-0-lite-260128`（默认）
- `doubao-seedream-5-0-260128`
- `doubao-seedream-4-5-251128`
- `doubao-seedream-4-0-250828`

### Seedance（视频）
- `doubao-seedance-1-5-pro-251215`（默认）
- `doubao-seedance-1-0-pro-250528`
- `doubao-seedance-1-0-pro-fast-251015`
- `doubao-seedance-1-0-lite-t2v-250428`
- `doubao-seedance-1-0-lite-i2v-250428`

## 视频生成（generate-video）

`generate-video` 使用异步任务流程：
1. 创建任务：`POST /contents/generations/tasks`
2. 查询任务：`GET /contents/generations/tasks/{id}`
3. 成功后读取：`content.video_url`

任务状态：
- `queued`
- `running`
- `succeeded`
- `failed`
- `expired`

主要参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `prompt` | string | 必填，视频提示词 |
| `model` | string | 可选，默认 `doubao-seedance-1-5-pro-251215` |
| `duration` | `5`/`10` | 可选，默认 `5` 秒 |
| `ratio` | enum | 可选：`adaptive`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9` |
| `imageUrl` | string | 可选，首帧图 URL（图生视频） |
| `generate_audio` | boolean | 可选，默认 `true` |
| `watermark` | boolean | 可选，默认 `false` |
| `callback_url` | string | 可选，任务状态回调地址 |
| `poll_interval_ms` | number | 可选，默认 `10000` |
| `max_poll_attempts` | number | 可选，默认 `60` |

兼容参数映射：
- `frames=121` 映射为 `duration=5`
- `frames=241` 映射为 `duration=10`
- `aspect_ratio` 在值合法时映射到 `ratio`

说明：根据官方文档，`Seedance 2.0` 当前仅支持控制台体验，暂不支持 API 调用。

## 常见问题

### 1. 报错：未设置 `ARK_API_KEY`
请确认环境变量已设置，并且启动进程能读取该变量。

### 2. `http` 模式返回 404
请检查客户端访问路径是否与 `MCP_HTTP_PATH` 一致，默认是 `/mcp`。

### 3. 视频任务超时
可适当调大 `max_poll_attempts`，或增大 `poll_interval_ms` 后重试。

## 参考文档

- 视频生成教程：https://www.volcengine.com/docs/82379/1366799?lang=zh
- 视频 API 参考：https://www.volcengine.com/docs/82379/1520758?lang=zh
- 快速入门（API Key）：https://www.volcengine.com/docs/82379/1399008?lang=zh
- Seedream 教程：https://www.volcengine.com/docs/82379/1824121?lang=zh
- 模型列表：https://www.volcengine.com/docs/82379/1330310
