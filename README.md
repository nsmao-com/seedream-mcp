# 火山方舟 Seedream/Seedance MCP 服务（Ark-only）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)

本项目已切换为 **Ark-only** 模式：仅使用火山方舟（Ark）API，当前支持：
- Seedream 图片生成/编辑
- Seedance 视频生成（异步任务）

不再使用即梦 `visual.volcengineapi.com` 的 AK/SK 调用链路，仅需 `ARK_API_KEY`。

## 快速开始

### 环境要求
- Node.js 18+
- pnpm

### 安装依赖
```bash
pnpm install
```

### 配置环境变量
创建 `.env` 文件：
```env
ARK_API_KEY=your_ark_api_key
```

### 构建
```bash
pnpm build
```

## MCP 配置示例

```json
{
  "mcpServers": {
    "jimenggen": {
      "command": "node",
      "args": [
        "/path/to/jimenggen-mcp/build/index.js"
      ],
      "env": {
        "ARK_API_KEY": "your_ark_api_key"
      }
    }
  }
}
```

## 支持模型

### 图片（Seedream）
- `doubao-seedream-5-0-lite-260128`（默认）
- `doubao-seedream-5-0-260128`
- `doubao-seedream-4-5-251128`
- `doubao-seedream-4-0-250828`

### 视频（Seedance）
- `doubao-seedance-1-5-pro-251215`（默认）
- `doubao-seedance-1-0-pro-250528`
- `doubao-seedance-1-0-pro-fast-251015`
- `doubao-seedance-1-0-lite-t2v-250428`
- `doubao-seedance-1-0-lite-i2v-250428`

## 工具说明

### 可用（Ark）
- `text-to-image`
- `image-to-image`
- `generate-image`
- `generate-img-seedream4`
- `generate-video`

### 已停用（Ark-only 下不支持）
- `generate-digital-human`
- `action-imitation`
- `image-dressing`

## 视频生成说明（generate-video）

`generate-video` 走火山方舟异步任务接口：
1. 创建任务：`POST /contents/generations/tasks`
2. 轮询任务：`GET /contents/generations/tasks/{id}`
3. 成功后从响应中的 `content.video_url` 获取 MP4 地址

任务状态支持：`queued`、`running`、`succeeded`、`failed`、`expired`。  
工具内部已封装轮询，可通过 `poll_interval_ms` 与 `max_poll_attempts` 调整等待策略。

兼容参数说明：
- `frames=121/241` 会自动映射为 `duration=5/10`
- `aspect_ratio` 会映射为 `ratio`（当值合法时）

注意：根据官方文档说明，`Seedance 2.0` 当前仅支持控制台体验，暂不支持 API 调用。

## 文档参考

- 视频生成教程：https://www.volcengine.com/docs/82379/1366799?lang=zh
- 视频 API 参考：https://www.volcengine.com/docs/82379/1520758?lang=zh
- 快速入门（API Key）：https://www.volcengine.com/docs/82379/1399008?lang=zh
- Seedream 教程：https://www.volcengine.com/docs/82379/1824121?lang=zh
- 模型列表：https://www.volcengine.com/docs/82379/1330310
