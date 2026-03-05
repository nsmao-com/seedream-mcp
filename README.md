# 火山方舟 Seedream MCP 服务（Ark-only）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.4.0-green.svg)](https://modelcontextprotocol.io/)

本项目已切换为 **Ark-only** 模式：仅使用火山方舟图片生成接口，不再走即梦 `visual.volcengineapi.com` 的 AK/SK 调用链路。

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

- `doubao-seedream-5-0-lite-260128`（默认）
- `doubao-seedream-5-0-260128`
- `doubao-seedream-4-5-251128`
- `doubao-seedream-4-0-250828`

## 工具说明

### 可用（Ark Seedream）
- `text-to-image`
- `image-to-image`
- `generate-image`
- `generate-img-seedream4`

### 已停用（Ark-only 下不支持）
- `generate-video`
- `generate-digital-human`
- `action-imitation`
- `image-dressing`

## 文档参考

- Seedream 4.0-5.0 教程：https://www.volcengine.com/docs/82379/1824121?lang=zh
- 模型列表：https://www.volcengine.com/docs/82379/1330310
# seedream-mcp
