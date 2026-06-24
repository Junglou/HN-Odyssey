// imports
import { useState, useRef, useEffect } from "react";
import EmojiPicker, {
  EmojiStyle,
  type EmojiClickData,
} from "emoji-picker-react";
import {
  CloseIcon,
  PaperClipIcon,
  SendIcon,
  FilePdfIcon,
  SmileIcon,
} from "../../../assets/icons/FloatingToolboxIcons";
import { useChatSupport } from "../../../hooks/common/useChatSupport";
import axiosClient from "../../../api/axiosClient";
import "./ChatWidget.css";

// THÊM HÀM NÀY ĐỂ FIX LỖI LINK KÉP TỪ DB CŨ
const getValidMediaUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("https://res.cloudinary.com")) {
    return url.substring(url.indexOf("https://res.cloudinary.com"));
  }
  return url;
};

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axiosClient.post("/upload/single", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // FIX: Thông minh nhận diện link Cloudinary hay link Local
      const rawPath = uploadRes.data.path;
      let fileUrl = rawPath;

      if (!rawPath.startsWith("http")) {
        const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");
        fileUrl = `${baseUrl}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;
      }

      if (file.type.startsWith("image/")) {
        sendMessage(fileUrl, "IMAGE");
      } else {
        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + "mb";
        sendMessage(fileUrl, "FILE", {
          fileName: file.name,
          fileSize: sizeInMB,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // xử lý markdown in đậm cho text
  const formatText = (text: string) => {
    // tìm các chuỗi nằm trong 2 dấu sao và chuyển thành thẻ strong
    const htmlText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return { __html: htmlText };
  };

  // render
  return (
    <div className="cw-container">
      {/* header */}
      <div className="cw-header">
        <div className="cw-header-info">
          <div className="cw-avatar">
            {/* Thay thế div trống bằng ảnh logo để tránh ô trắng */}
            <img
              src="/Logo.png"
              alt="H&N Odyssey"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
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
              {msg.message_type === "TEXT" && (
                <p dangerouslySetInnerHTML={formatText(msg.content)}></p>
              )}

              {/* image type */}
              {msg.message_type === "IMAGE" && (
                <img
                  src={getValidMediaUrl(msg.content)}
                  alt="attachment"
                  className="cw-img-attach"
                />
              )}

              {/* file type - Đã thêm thẻ <a> để click vào tải file */}
              {msg.message_type === "FILE" && (
                <div className="cw-file-attach">
                  <FilePdfIcon />
                  <div className="cw-file-info">
                    <a
                      href={getValidMediaUrl(msg.content)}
                      target="_blank"
                      rel="noreferrer"
                      className="cw-file-name"
                      style={{ color: "inherit", textDecoration: "underline" }}
                    >
                      {msg.metadata?.fileName || "Attachment"}
                    </a>
                    <span className="cw-file-size">
                      {msg.metadata?.fileSize || "Unknown"}
                    </span>
                  </div>
                </div>
              )}

              {/* hiển thị thẻ thông tin sản phẩm có kèm hình ảnh và liên kết chi tiết */}
              {msg.message_type === "PRODUCT_CARD" && msg.metadata && (
                <div className="cw-product-card">
                  {msg.metadata.imageUrl && (
                    <img
                      src={msg.metadata.imageUrl}
                      alt={msg.metadata.name || "Product"}
                      className="cw-product-img"
                    />
                  )}
                  <div className="cw-product-info">
                    <h4 className="cw-product-name">{msg.metadata.name}</h4>
                    <p className="cw-product-desc">
                      {msg.metadata.description}
                    </p>
                    {msg.metadata.link && (
                      <a
                        href={msg.metadata.link}
                        target="_blank"
                        rel="noreferrer"
                        className="cw-product-link"
                      >
                        Xem chi tiết sản phẩm
                      </a>
                    )}
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
            searchDisabled={false}
            emojiStyle={EmojiStyle.NATIVE}
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
