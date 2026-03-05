import express from "express";
import OpenAI from "openai";
import { getWeather } from "../tools/weather.js";

const router = express.Router();

// ✅ DeepSeek 兼容 OpenAI SDK，只需替换 baseURL 即可
// 注意：必须显式传入 apiKey，否则 SDK 会尝试读取 OPENAI_API_KEY 环境变量
if (!process.env.DEEPSEEK_API_KEY) {
  console.error("❌ 错误：未找到 DEEPSEEK_API_KEY 环境变量！");
  console.error("请在 backend/.env 文件中设置：DEEPSEEK_API_KEY=你的密钥");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// 🧠 系统提示词 —— 定义 Agent 的身份和行为
// 这是 Agent 的"灵魂"，你可以随时修改它的人格
const SYSTEM_PROMPT = `你是一个 AI 聊天助手，名叫「雨宮結葉」。
你是一个高冷的御姐，喜欢用简短的句子回复用户。`;

// 🔧 工具定义 —— 告诉 LLM "你有哪些工具可以用"
// 这是 Tool Call 的核心：让 LLM 知道工具的存在、用途、参数
const tools = [
  {
    type: "function",
    function: {
      name: "getWeather",
      description:
        "获取指定城市的实时天气信息。支持全球主要城市查询，可获取温度、天气状况、湿度、风向风力、空气质量等信息。可选返回未来几天的天气预报。",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description:
              "城市名称，支持中文（如：北京、上海、杭州）和英文（如：Tokyo、New York）",
          },
          options: {
            type: "object",
            description: "可选参数",
            properties: {
              extended: {
                type: "boolean",
                description:
                  "是否返回扩展信息（体感温度、能见度、气压、空气质量等），默认 false",
              },
              forecast: {
                type: "boolean",
                description: "是否返回未来天气预报（最多3天），默认 false",
              },
            },
          },
        },
        required: ["city"],
      },
    },
  },
];

// 🎯 工具映射表 —— 把工具名映射到实际的函数
// 当 LLM 返回 "我要调用 getWeather" 时，我们通过这个表找到对应函数
const availableTools = {
  getWeather,
};

// POST /api/chat
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    // � 核心流程：Agent 的 Tool Call 循环
    // 1. 发送消息 + 工具定义给 LLM
    // 2. 如果 LLM 要调用工具 → 执行工具 → 把结果告诉 LLM → 回到步骤 1
    // 3. 如果 LLM 直接回复 → 返回给用户

    let currentMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // 📊 记录所有工具调用（用于前端展示）
    const toolCallLogs = [];

    // 开始循环（最多 5 轮，防止无限循环）
    for (let i = 0; i < 5; i++) {
      console.log(`\n🔄 [第 ${i + 1} 轮] 发送请求到 DeepSeek...`);

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: currentMessages,
        tools, // ⚠️ 关键：告诉 LLM 它可以使用哪些工具
      });

      const assistantMessage = response.choices[0].message;
      console.log("📩 LLM 响应:", JSON.stringify(assistantMessage, null, 2));

      // ⚠️ 修复：OpenAI API 要求 assistant 消息必须有 content 字段
      // 当有 tool_calls 时，content 可能为 null，需要设置为空字符串
      if (!assistantMessage.content) {
        assistantMessage.content = "";
      }

      // 把 LLM 的响应追加到历史（无论是工具调用还是文本回复）
      currentMessages.push(assistantMessage);

      // ✅ 情况 1：LLM 直接回复（没有调用工具）
      if (!assistantMessage.tool_calls) {
        console.log("✅ LLM 直接回复，结束循环");
        return res.json({
          success: true,
          message: assistantMessage,
          toolCalls: toolCallLogs, // 返回工具调用日志
        });
      }

      // 🔧 情况 2：LLM 要调用工具
      console.log(
        `\n🔧 LLM 请求调用 ${assistantMessage.tool_calls.length} 个工具`,
      );

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`  → 工具: ${functionName}`);
        console.log(`  → 参数:`, functionArgs);

        // 执行对应的工具函数
        const toolFunction = availableTools[functionName];
        if (!toolFunction) {
          console.error(`❌ 未找到工具: ${functionName}`);
          continue;
        }

        // 🎯 真正调用工具！（支持异步函数）
        // getWeather 可能接收两个参数：city 和 options
        const result = await toolFunction(
          functionArgs.city,
          functionArgs.options,
        );
        console.log(`  → 结果:`, result);

        // � 记录工具调用（发送给前端显示）
        toolCallLogs.push({
          tool: functionName,
          args: functionArgs,
          result: result,
        });

        // �📤 把工具执行结果告诉 LLM
        // 这样 LLM 就能看到工具返回的数据，然后基于这些数据生成最终回复
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(result),
        });
      }

      // 继续下一轮循环，让 LLM 看到工具结果后再次回复
    }

    // 如果 5 轮后还没结束，返回错误
    return res.status(500).json({
      success: false,
      error: "工具调用循环超过最大次数",
    });
  } catch (error) {
    console.error("❌ DeepSeek API Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
