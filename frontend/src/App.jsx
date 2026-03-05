import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

function App() {
  // 💡 核心概念：
  // - displayMessages: 所有要显示的消息（包括工具调用）
  // - conversationHistory: 只保存 user 和 assistant 消息，用于发送给后端
  const [displayMessages, setDisplayMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (userInput) => {
    if (!userInput.trim() || loading) return;

    // 用户消息
    const userMessage = { role: "user", content: userInput };

    // 更新显示和历史
    setDisplayMessages((prev) => [...prev, userMessage]);
    const newHistory = [...conversationHistory, userMessage];
    setConversationHistory(newHistory);
    setLoading(true);

    try {
      // 发送真实对话历史（不包括工具调用消息）
      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      const data = await res.json();

      if (data.success) {
        // ✅ 先把 AI 回复加入对话历史（确保 content 存在）
        const assistantMessage = {
          role: "assistant",
          content: data.message.content || "", // 确保有 content 字段
        };
        setConversationHistory((prev) => [...prev, assistantMessage]);

        // 如果有工具调用，显示在界面上（但不加入对话历史）
        if (data.toolCalls && data.toolCalls.length > 0) {
          const toolCallMessages = data.toolCalls.map((tc) => ({
            role: "tool",
            toolName: tc.tool,
            args: tc.args,
            result: tc.result,
          }));
          setDisplayMessages((prev) => [...prev, ...toolCallMessages]);
        }

        // AI 回复加入显示
        setDisplayMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.error("API Error:", data.error);
      }
    } catch (err) {
      console.error("Network Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <ChatWindow
        messages={displayMessages}
        onSend={sendMessage}
        loading={loading}
      />
    </div>
  );
}

export default App;
