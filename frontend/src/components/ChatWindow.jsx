import { useState, useRef, useEffect } from "react";
import "./ChatWindow.css";

function ChatWindow({ messages, onSend, loading }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  // 每次消息列表更新后，自动滚动到最底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input);
    setInput("");
  };

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      {/* 顶部标题栏 */}
      <div className="chat-header">
        <span className="status-dot" />
        <h2>雨宮結葉</h2>
      </div>

      {/* 消息列表区域 */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-hint">你好！有什么我可以帮你的？</div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.role === "tool" ? (
              // 🔧 工具调用显示（简化版）
              <div className="bubble tool-call">
                🔧 调用工具: <strong>{msg.toolName}</strong>
              </div>
            ) : (
              // 普通消息显示
              <div className="bubble">{msg.content}</div>
            )}
          </div>
        ))}

        {/* AI 正在思考中的打字动画 */}
        {loading && (
          <div className="message assistant">
            <div className="bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {/* 用于自动滚动到底部的锚点 */}
        <div ref={bottomRef} />
      </div>

      {/* 底部输入框 */}
      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... "
          rows={1}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
