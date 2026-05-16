// imports
import { useState, useRef, useEffect } from "react";
import {
  CloseIcon,
  PaperClipIcon,
  SendIcon,
  FilePdfIcon,
} from "../../../assets/icons/FloatingToolboxIcons";
import { useChatSupport } from "../../../hooks/common/useChatSupport";
import "./ChatWidget.css";

// props
interface ChatWidgetProps {
  onClose: () => void;
}

// component
export default function ChatWidget({ onClose }: ChatWidgetProps) {
  // hooks
  const { messages, sendMessage } = useChatSupport();
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // handlers
  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  // render
  return (
    <div className="cw-container">
      {/* header */}
      <div className="cw-header">
        <div className="cw-header-info">
          <div className="cw-avatar"></div>
          <span className="cw-title">H&N Support</span>
        </div>
        <button className="cw-close-btn" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {/* message list */}
      <div className="cw-body">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`cw-msg-row ${msg.sender_type === "USER" ? "user" : "bot"}`}
          >
            <div className="cw-bubble">
              {/* text type */}
              {msg.message_type === "TEXT" && <p>{msg.content}</p>}

              {/* image type */}
              {msg.message_type === "IMAGE" && (
                <img
                  src={msg.content}
                  alt="attachment"
                  className="cw-img-attach"
                />
              )}

              {/* file type */}
              {msg.message_type === "FILE" && (
                <div className="cw-file-attach">
                  <FilePdfIcon />
                  <div className="cw-file-info">
                    <span className="cw-file-name">
                      {msg.metadata?.fileName || "Attachment"}
                    </span>
                    <span className="cw-file-size">
                      {msg.metadata?.fileSize || "Unknown"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* mỏ neo để scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* input area */}
      <div className="cw-footer">
        <button className="cw-icon-btn">
          <PaperClipIcon />
        </button>
        <input
          type="text"
          className="cw-input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="cw-icon-btn cw-send-btn" onClick={handleSend}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
