#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const SUPPORTED_SEEDREAM_MODELS = [
  "doubao-seedream-5-0-lite-260128",
  "doubao-seedream-5-0-260128",
  "doubao-seedream-4-5-251128",
  "doubao-seedream-4-0-250828"
] as const;
type SeedreamModelId = typeof SUPPORTED_SEEDREAM_MODELS[number];

const DEFAULT_SEEDREAM_MODEL_NAME: SeedreamModelId = "doubao-seedream-5-0-lite-260128";
const SEEDREAM_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const CONTENT_GENERATION_TASKS_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
const ARK_API_KEY = process.env.ARK_API_KEY;

const SUPPORTED_SEEDANCE_VIDEO_MODELS = [
  "doubao-seedance-1-5-pro-251215",
  "doubao-seedance-1-0-pro-250528",
  "doubao-seedance-1-0-pro-fast-251015",
  "doubao-seedance-1-0-lite-t2v-250428",
  "doubao-seedance-1-0-lite-i2v-250428"
] as const;
type SeedanceVideoModelId = typeof SUPPORTED_SEEDANCE_VIDEO_MODELS[number];
const DEFAULT_SEEDANCE_VIDEO_MODEL: SeedanceVideoModelId = "doubao-seedance-1-5-pro-251215";

console.log("🔍 MCP服务器启动 - Ark配置检查:");
console.log("   ARK_API_KEY:", ARK_API_KEY ? "✅ 已设置" : "❌ 未设置");

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function parseImageUrlsInput(input?: string): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    // no-op, fallback to single URL
  }

  return [trimmed];
}

async function readFileAsBase64(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

async function uploadFileToBase64(fileLike: any): Promise<string> {
  if (fileLike?.arrayBuffer && typeof fileLike.arrayBuffer === "function") {
    const ab = await fileLike.arrayBuffer();
    return Buffer.from(ab).toString("base64");
  }

  if (Buffer.isBuffer(fileLike)) {
    return fileLike.toString("base64");
  }

  throw new Error("上传文件对象不支持，需提供可调用 arrayBuffer() 的文件对象");
}

interface SeedreamRequestOptions {
  prompt: string;
  model?: SeedreamModelId;
  size?: string;
  image?: string[];
  watermark?: boolean;
}

interface VideoTaskCreateOptions {
  prompt: string;
  model?: SeedanceVideoModelId;
  imageUrl?: string;
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  callbackUrl?: string;
}

async function callSeedreamAPI(options: SeedreamRequestOptions): Promise<string[] | null> {
  try {
    const reqBody: any = {
      model: options.model || DEFAULT_SEEDREAM_MODEL_NAME,
      prompt: options.prompt,
      size: options.size || "1024x1024",
      response_format: "url",
      watermark: options.watermark ?? false
    };

    if (options.image && options.image.length > 0) {
      reqBody.image = options.image;
      reqBody.sequential_image_generation = "auto";
    }

    const response = await fetch(SEEDREAM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(reqBody)
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error(`Ark API请求失败: ${response.status} ${response.statusText}`);
      console.error(`Ark API错误详情: ${raw}`);
      return null;
    }

    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      console.error("Ark API响应格式异常:", data);
      return null;
    }

    const urls = data.data
      .map((item: any) => item?.url)
      .filter((url: unknown): url is string => typeof url === "string" && url.length > 0);

    return urls.length > 0 ? urls : null;
  } catch (error) {
    console.error("调用Seedream API失败:", error);
    return null;
  }
}

async function createVideoGenerationTask(options: VideoTaskCreateOptions): Promise<string | null> {
  try {
    const content: any[] = [
      {
        type: "text",
        text: options.prompt
      }
    ];

    if (options.imageUrl) {
      content.push({
        type: "image_url",
        image_url: {
          url: options.imageUrl
        }
      });
    }

    const reqBody: any = {
      model: options.model || DEFAULT_SEEDANCE_VIDEO_MODEL,
      content,
      ratio: options.ratio || "adaptive",
      duration: options.duration ?? 5,
      generate_audio: options.generateAudio ?? true,
      watermark: options.watermark ?? false
    };

    if (options.callbackUrl) {
      reqBody.callback_url = options.callbackUrl;
    }

    const response = await fetch(CONTENT_GENERATION_TASKS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify(reqBody)
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error(`创建视频任务失败: ${response.status} ${response.statusText}`);
      console.error(`创建视频任务错误详情: ${raw}`);
      return null;
    }

    const data = JSON.parse(raw);
    const taskId = data?.id || data?.data?.id || data?.task_id || data?.data?.task_id;
    if (!taskId || typeof taskId !== "string") {
      console.error("创建视频任务响应中缺少任务ID:", data);
      return null;
    }

    return taskId;
  } catch (error) {
    console.error("创建视频任务异常:", error);
    return null;
  }
}

interface VideoTaskQueryResult {
  status: string;
  videoUrl?: string;
  errorMessage?: string;
}

async function queryVideoGenerationTask(taskId: string): Promise<VideoTaskQueryResult | null> {
  try {
    const response = await fetch(`${CONTENT_GENERATION_TASKS_ENDPOINT}/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ARK_API_KEY}`
      }
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error(`查询视频任务失败: ${response.status} ${response.statusText}`);
      console.error(`查询视频任务错误详情: ${raw}`);
      return null;
    }

    const data = JSON.parse(raw);
    const status: string | undefined = data?.status || data?.data?.status;
    if (!status) {
      console.error("查询视频任务响应中缺少status:", data);
      return null;
    }

    const videoUrl: string | undefined =
      data?.content?.video_url ||
      data?.data?.content?.video_url ||
      data?.video_url ||
      data?.data?.video_url;

    const errorMessage: string | undefined =
      data?.error?.message ||
      data?.error_message ||
      data?.data?.error?.message ||
      data?.data?.error_message;

    return { status, videoUrl, errorMessage };
  } catch (error) {
    console.error("查询视频任务异常:", error);
    return null;
  }
}

async function pollVideoGenerationTask(
  taskId: string,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<VideoTaskQueryResult | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await queryVideoGenerationTask(taskId);
    if (!result) {
      return null;
    }

    const status = result.status.toLowerCase();
    if (status === "succeeded" && result.videoUrl) {
      return result;
    }
    if (status === "failed" || status === "expired") {
      return result;
    }
    if (status !== "queued" && status !== "running") {
      return result;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    status: "timeout",
    errorMessage: `任务轮询超时（${maxAttempts}次）`
  };
}

function arkOnlyUnsupported(toolName: string) {
  return textResult(`工具 ${toolName} 已停用：当前服务已切换为“火山方舟 Ark-only”模式，仅支持 Seedream 图片与 Seedance 视频能力。`);
}

const server = new McpServer({
  name: "jimenggen",
  version: "1.1.2"
});

server.tool(
  "text-to-image",
  "使用火山方舟 Seedream 模型生成图片（Ark-only）",
  {
    prompt: z.string().describe("图片生成提示词"),
    ratio: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).describe("生成图像宽高"),
    style: z.string().optional().describe("可选风格描述，会自动拼接到提示词中"),
    model: z.enum(SUPPORTED_SEEDREAM_MODELS).optional().describe("模型ID，默认5.0-lite"),
    model_version: z.enum(["v3.1", "v4.0"]).optional().describe("兼容旧参数：v4.0会映射到doubao-seedream-4-0-250828"),
    image_urls: z.array(z.string()).optional().describe("参考图URL数组"),
    add_watermark: z.boolean().optional().describe("是否添加水印")
  },
  async ({ prompt, ratio, style, model, model_version, image_urls, add_watermark }: {
    prompt?: string;
    ratio?: { width: number; height: number };
    style?: string;
    model?: SeedreamModelId;
    model_version?: string;
    image_urls?: string[];
    add_watermark?: boolean;
  }) => {
    if (!prompt || !ratio) {
      return textResult("错误：缺少必需参数。请提供prompt和ratio参数。");
    }
    if (!ARK_API_KEY) {
      return textResult("错误：未设置 ARK_API_KEY，无法调用火山方舟API。");
    }
    if (model_version === "v3.1") {
      return textResult("错误：v3.1 是即梦模型版本，Ark-only 模式不支持。请改用 Seedream 模型ID。");
    }

    const currentModel = model || (model_version === "v4.0" ? "doubao-seedream-4-0-250828" : DEFAULT_SEEDREAM_MODEL_NAME);
    const finalPrompt = style ? `${prompt}，风格：${style}` : prompt;
    const size = `${ratio.width}x${ratio.height}`;

    const urls = await callSeedreamAPI({
      prompt: finalPrompt,
      model: currentModel,
      size,
      image: image_urls,
      watermark: add_watermark ?? false
    });

    if (!urls) {
      return textResult("图片生成失败，请检查网络、模型权限与API密钥配置。");
    }

    return textResult(
      `图片生成成功！\n\n模型ID: ${currentModel}\n提示词: ${finalPrompt}\n图片尺寸: ${size}\n生成图片URL:\n${urls.join("\n")}`
    );
  }
);

server.tool(
  "image-to-image",
  "使用火山方舟 Seedream 模型进行图生图（Ark-only）",
  {
    prompt: z.string().describe("图片编辑提示词"),
    imageUrl: z.string().optional().describe("参考图URL（与localPath二选一）"),
    ratio: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).describe("生成图像宽高"),
    localPath: z.string().optional().describe("本地图片路径（与imageUrl二选一）"),
    model: z.enum(SUPPORTED_SEEDREAM_MODELS).optional().describe("模型ID，默认5.0-lite")
  },
  async ({ prompt, imageUrl, ratio, localPath, model }: {
    prompt?: string;
    imageUrl?: string;
    ratio?: { width: number; height: number };
    localPath?: string;
    model?: SeedreamModelId;
  }) => {
    if (!prompt || !ratio) {
      return textResult("错误：缺少必需参数。请提供prompt和ratio参数。");
    }
    if (!ARK_API_KEY) {
      return textResult("错误：未设置 ARK_API_KEY，无法调用火山方舟API。");
    }
    if (!imageUrl && !localPath) {
      return textResult("错误：需要提供imageUrl或localPath参数之一。");
    }

    const images: string[] = [];
    if (imageUrl) images.push(imageUrl);
    if (localPath) images.push(await readFileAsBase64(localPath));

    const size = `${ratio.width}x${ratio.height}`;
    const currentModel = model || DEFAULT_SEEDREAM_MODEL_NAME;
    const urls = await callSeedreamAPI({
      prompt,
      model: currentModel,
      size,
      image: images
    });

    if (!urls) {
      return textResult("图生图生成失败，请检查网络、模型权限与API密钥配置。");
    }

    return textResult(
      `图生图生成成功！\n\n模型ID: ${currentModel}\n提示词: ${prompt}\n图片尺寸: ${size}\n生成图片URL:\n${urls.join("\n")}`
    );
  }
);

server.tool(
  "generate-image",
  "使用火山方舟 Seedream 模型生成/编辑图片（Ark-only）",
  {
    prompt: z.string().describe("图片生成提示词"),
    ratio: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).describe("生成图像宽高"),
    imgUrls: z.string().optional().describe("参考图URLs，支持JSON数组字符串或单个URL"),
    uploadFiles: z.array(
      z.object({
        file: z.any().describe("文件对象"),
        filename: z.string().describe("文件名"),
        mimeType: z.string().describe("文件MIME类型")
      })
    ).max(14).optional().describe("本地上传参考图，最多14张"),
    scale: z.number().optional().describe("兼容旧参数：Ark Seedream接口不使用该参数"),
    model: z.enum(SUPPORTED_SEEDREAM_MODELS).optional().describe("模型ID，默认5.0-lite"),
    add_watermark: z.boolean().optional().describe("是否添加水印")
  },
  async ({ prompt, ratio, imgUrls, uploadFiles, scale, model, add_watermark }) => {
    if (!prompt || !ratio) {
      return textResult("错误：缺少必需参数。请提供prompt和ratio参数。");
    }
    if (!ARK_API_KEY) {
      return textResult("错误：未设置 ARK_API_KEY，无法调用火山方舟API。");
    }

    const images = parseImageUrlsInput(imgUrls);
    if (uploadFiles && uploadFiles.length > 0) {
      for (const f of uploadFiles) {
        images.push(await uploadFileToBase64(f.file));
      }
    }

    const size = `${ratio.width}x${ratio.height}`;
    const currentModel = model || DEFAULT_SEEDREAM_MODEL_NAME;
    const urls = await callSeedreamAPI({
      prompt,
      model: currentModel,
      size,
      image: images,
      watermark: add_watermark ?? false
    });

    if (!urls) {
      return textResult("图片生成失败，请检查网络、模型权限与API密钥配置。");
    }

    const scaleNote = scale !== undefined ? `\n说明：scale=${scale} 为旧版即梦参数，Ark接口已忽略。` : "";
    return textResult(
      `图片生成成功！\n\n模型ID: ${currentModel}\n提示词: ${prompt}\n图片尺寸: ${size}${scaleNote}\n生成图片URL:\n${urls.join("\n")}`
    );
  }
);

server.tool(
  "generate-video",
  "使用火山方舟 Seedance 模型生成视频（异步任务）",
  {
    prompt: z.string().describe("视频生成提示词"),
    model: z.enum(SUPPORTED_SEEDANCE_VIDEO_MODELS).optional().describe("视频模型ID，默认doubao-seedance-1-5-pro-251215"),
    duration: z.union([z.literal(5), z.literal(10)]).optional().describe("视频时长（秒），常用5或10"),
    ratio: z.enum(["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]).optional().describe("视频宽高比"),
    imageUrl: z.string().optional().describe("首帧图URL（可选，图生视频）"),
    generate_audio: z.boolean().optional().describe("是否生成音频"),
    watermark: z.boolean().optional().describe("是否添加水印"),
    callback_url: z.string().optional().describe("Webhook回调地址（可选）"),
    poll_interval_ms: z.number().int().positive().optional().describe("轮询间隔（毫秒），默认10000"),
    max_poll_attempts: z.number().int().positive().optional().describe("最大轮询次数，默认60"),
    frames: z.number().optional().describe("兼容旧参数：121映射为5秒，241映射为10秒"),
    aspect_ratio: z.string().optional().describe("兼容旧参数：映射到ratio")
  },
  async ({
    prompt,
    model,
    duration,
    ratio,
    imageUrl,
    generate_audio,
    watermark,
    callback_url,
    poll_interval_ms,
    max_poll_attempts,
    frames,
    aspect_ratio
  }: {
    prompt?: string;
    model?: SeedanceVideoModelId;
    duration?: 5 | 10;
    ratio?: "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
    imageUrl?: string;
    generate_audio?: boolean;
    watermark?: boolean;
    callback_url?: string;
    poll_interval_ms?: number;
    max_poll_attempts?: number;
    frames?: number;
    aspect_ratio?: string;
  }) => {
    if (!prompt) {
      return textResult("错误：缺少必需参数。请提供prompt参数。");
    }
    if (!ARK_API_KEY) {
      return textResult("错误：未设置 ARK_API_KEY，无法调用火山方舟API。");
    }

    // 兼容旧参数：frames=121/241 映射到 duration=5/10
    let finalDuration = duration;
    if (!finalDuration && frames !== undefined) {
      if (frames === 121) finalDuration = 5;
      if (frames === 241) finalDuration = 10;
    }
    if (!finalDuration) finalDuration = 5;

    // 兼容旧参数：aspect_ratio 映射到 ratio
    let finalRatio = ratio || "adaptive";
    if (!ratio && aspect_ratio) {
      const allowedRatios = ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];
      if (allowedRatios.includes(aspect_ratio)) {
        finalRatio = aspect_ratio as typeof finalRatio;
      }
    }

    const currentModel = model || DEFAULT_SEEDANCE_VIDEO_MODEL;
    const taskId = await createVideoGenerationTask({
      prompt,
      model: currentModel,
      imageUrl,
      ratio: finalRatio,
      duration: finalDuration,
      generateAudio: generate_audio ?? true,
      watermark: watermark ?? false,
      callbackUrl: callback_url
    });

    if (!taskId) {
      return textResult("创建视频任务失败，请检查网络、模型权限与API密钥配置。");
    }

    const pollResult = await pollVideoGenerationTask(
      taskId,
      max_poll_attempts ?? 60,
      poll_interval_ms ?? 10000
    );

    if (!pollResult) {
      return textResult(`视频任务创建成功，但查询失败。\n\n任务ID: ${taskId}`);
    }

    if (pollResult.status.toLowerCase() === "succeeded" && pollResult.videoUrl) {
      return textResult(
        `视频生成成功！\n\n任务ID: ${taskId}\n模型ID: ${currentModel}\n状态: ${pollResult.status}\n视频URL: ${pollResult.videoUrl}`
      );
    }

    return textResult(
      `视频任务未成功完成。\n\n任务ID: ${taskId}\n状态: ${pollResult.status}\n错误信息: ${pollResult.errorMessage || "无"}`
    );
  }
);

server.tool(
  "generate-digital-human",
  "Ark-only 模式下不支持该工具",
  {
    prompt: z.string().describe("数字人行为描述"),
    avatarStyle: z.string().describe("数字人形象风格"),
    emotion: z.string().describe("数字人情感状态"),
    action: z.string().describe("数字人动作类型")
  },
  async () => arkOnlyUnsupported("generate-digital-human")
);

server.tool(
  "action-imitation",
  "Ark-only 模式下不支持该工具",
  {
    referenceAction: z.string().describe("参考动作描述"),
    targetCharacter: z.string().describe("目标角色描述"),
    style: z.string().describe("动作风格")
  },
  async () => arkOnlyUnsupported("action-imitation")
);

server.tool(
  "image-dressing",
  "Ark-only 模式下不支持该工具",
  {
    modelImageUrl: z.string().optional().describe("模特图片URL"),
    garmentImageUrl: z.string().optional().describe("服装图片URL")
  },
  async () => arkOnlyUnsupported("image-dressing")
);

server.tool(
  "generate-img-seedream4",
  "直接调用火山方舟 Seedream API 生成图片（Ark-only）",
  {
    prompt: z.string().describe("图片生成提示词"),
    model: z.enum(SUPPORTED_SEEDREAM_MODELS).optional().describe("模型ID，默认5.0-lite"),
    imgUrls: z.string().optional().describe("参考图URLs，支持JSON数组字符串或单个URL"),
    size: z.string().optional().describe("图片尺寸，如1024x1024")
  },
  async ({ prompt, model, imgUrls, size }: { prompt?: string; model?: SeedreamModelId; imgUrls?: string; size?: string }) => {
    if (!prompt) {
      return textResult("错误：缺少必需参数。请提供prompt参数。");
    }
    if (!ARK_API_KEY) {
      return textResult("错误：未设置 ARK_API_KEY，无法调用火山方舟API。");
    }

    const urls = await callSeedreamAPI({
      prompt,
      model: model || DEFAULT_SEEDREAM_MODEL_NAME,
      size: size || "1024x1024",
      image: parseImageUrlsInput(imgUrls)
    });

    if (!urls) {
      return textResult("图片生成失败，请检查网络、模型权限与API密钥配置。");
    }

    return textResult(
      `Seedream图片生成成功！\n\n模型ID: ${model || DEFAULT_SEEDREAM_MODEL_NAME}\n提示词: ${prompt}\n图片尺寸: ${size || "1024x1024"}\n生成图片URL:\n${urls.join("\n")}`
    );
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("火山方舟 Seedream MCP服务已启动（Ark-only）");
}

main().catch((error) => {
  console.error("启动服务时发生错误:", error);
  process.exit(1);
});
