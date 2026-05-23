// imports
import { useState, useRef, useEffect } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import {
  CloseIcon,
  PaperClipIcon,
  SendIcon,
  FilePdfIcon,
  SmileIcon,
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
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // handlers
  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text, "TEXT");
    setText("");
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (file.type.startsWith("image/")) {
        // gửi ảnh
        sendMessage(result, "IMAGE");
      } else {
        // gửi file
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + "mb";
        sendMessage("File đính kèm", "FILE", {
          fileName: file.name,
          fileSize: sizeInMB,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // render
  return (
    <div className="cw-container">
      {/* header */}
      <div className="cw-header">
        <div className="cw-header-info">
          <div className="cw-avatar"></div>
          <span className="cw-title">Support</span>
        </div>
        <button className="cw-close-btn" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {/* body */}
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
        {/* scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* bảng emoji */}
      {showEmoji && (
        <div className="cw-emoji-picker-container">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            width="100%"
            height="300px"
          />
        </div>
      )}

      {/* footer */}
      <div className="cw-footer">
        {/* input ẩn */}
        <input
          type="file"
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx"
        />

        <button className="cw-icon-btn" onClick={handleAttachClick}>
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
        <button
          className="cw-icon-btn"
          onClick={() => setShowEmoji((prev) => !prev)}
        >
          <SmileIcon />
        </button>
        <button className="cw-icon-btn cw-send-btn" onClick={handleSend}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
