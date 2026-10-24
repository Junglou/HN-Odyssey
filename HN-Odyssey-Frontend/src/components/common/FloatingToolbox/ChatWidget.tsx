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
import ChatProductCarousel from "./ChatProductCarousel";
import "./ChatWidget.css";
import { toast } from "react-toastify";

// THÊM HÀM NÀY ĐỂ FIX LỖI LINK KÉP TỪ DB CŨ
const getValidMediaUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("https://res.cloudinary.com")) {
    return url.substring(url.indexOf("https://res.cloudinary.com"));
  }
  return url;
};

const MAX_CHAT_IMAGE_MB = 10;

interface PendingImage {
  file: File;
  previewUrl: string;
}

// props
interface ChatWidgetProps {
  onClose: () => void;
}

// component
export default function ChatWidget({ onClose }: ChatWidgetProps) {
  // hooks
  const {
    messages,
    sendMessage,
    typingIndicator,
    notifyTyping,
    getConversationId,
  } = useChatSupport();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  // Ảnh khách đã chọn nhưng chưa gửi (để gõ kèm câu hỏi rồi gửi chung 1 tin)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Giải phóng URL xem trước khi đổi ảnh / bỏ ảnh / đóng khung chat
  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  // auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingIndicator]);

  // handlers
  // Mobile: khung chat chiếm toàn màn hình -> thu lại để khách xem trang sản phẩm
  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 768px)").matches) onClose();
  };

  const uploadToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await axiosClient.post("/upload/single", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Nhận diện link Cloudinary hay link Local
    const rawPath: string = uploadRes.data.path;
    if (rawPath.startsWith("http")) return rawPath;

    const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");
    return `${baseUrl}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;
  };

  const handleSend = async () => {
    if (isSending) return;

    // Có ảnh đang chờ -> gửi 1 tin IMAGE, chữ trong ô nhập thành chú thích
    if (pendingImage) {
      const caption = text.trim();
      setIsSending(true);
      try {
        const imageUrl = await uploadToServer(pendingImage.file);
        sendMessage(imageUrl, "IMAGE", caption ? { caption } : undefined);
        setPendingImage(null);
        setText("");
        setShowEmoji(false);
      } catch (error) {
        console.error(error);
        toast.error("Couldn't send the image. Please try again.");
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!text.trim()) return;
    sendMessage(text, "TEXT");
    setText("");
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleSend();
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng file vừa bỏ
    if (!file) return;

    // Ảnh: chưa gửi ngay, hiện xem trước để khách gõ thêm câu hỏi
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_CHAT_IMAGE_MB * 1024 * 1024) {
        toast.error(
          `Images must be ${MAX_CHAT_IMAGE_MB}MB or smaller. Please choose a smaller image.`,
        );
        return;
      }
      setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
      textInputRef.current?.focus();
      return;
    }

    // Tệp PDF/DOC: gửi ngay như cũ
    try {
      const fileUrl = await uploadToServer(file);
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + "mb";
      sendMessage(fileUrl, "FILE", {
        fileName: file.name,
        fileSize: sizeInMB,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // xử lý markdown in đậm cho text
  const formatText = (text: string) => {
    // Escape HTML trước để chặn XSS, sau đó mới đổi **...** thành <strong>
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const htmlText = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
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
        <button
          className="cw-close-btn"
          onClick={onClose}
          aria-label="Close chat"
        >
          <CloseIcon />
        </button>
      </div>

      {/* body */}
      <div className="cw-body">
        {messages.map((msg) =>
          msg.message_type === "PRODUCT_CARD" &&
          msg.metadata?.products &&
          msg.metadata.products.length > 0 ? (
            // Thẻ sản phẩm kiểu mới: câu tư vấn + carousel tối đa 3 thẻ
            <div key={msg.id} className="cw-msg-row bot">
              <div className="cw-cards-block">
                {msg.content && (
                  <div className="cw-bubble">
                    <p dangerouslySetInnerHTML={formatText(msg.content)}></p>
                  </div>
                )}
                <ChatProductCarousel
                  products={msg.metadata.products}
                  onAfterNavigate={closeOnMobile}
                  conversationId={
                    msg.conversationId || getConversationId() || undefined
                  }
                />
              </div>
            </div>
          ) : (
            <div
              key={msg.id}
              className={`cw-msg-row ${
                msg.sender_type === "USER"
                  ? "user"
                  : msg.sender_type === "SYSTEM"
                    ? "system"
                    : "bot"
              }`}
            >
              <div className="cw-bubble">
                {/* text type */}
                {msg.message_type === "TEXT" && (
                  <p dangerouslySetInnerHTML={formatText(msg.content)}></p>
                )}

                {/* image type */}
                {msg.message_type === "IMAGE" && (
                  <>
                    <img
                      src={getValidMediaUrl(msg.content)}
                      alt="attachment"
                      className="cw-img-attach"
                    />
                    {msg.metadata?.caption && (
                      <p className="cw-img-caption">{msg.metadata.caption}</p>
                    )}
                  </>
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
                        style={{
                          color: "inherit",
                          textDecoration: "underline",
                        }}
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
                          View product details
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {/* hiệu ứng đang gõ */}
        {typingIndicator && (
          <div className="cw-msg-row bot">
            <div className="cw-bubble cw-typing-bubble">
              <span className="cw-typing-label">
                {typingIndicator.senderType === "BOT"
                  ? "Assistant is typing"
                  : `${typingIndicator.userName || "Support agent"} is typing`}
              </span>
              <span className="cw-typing-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}

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

      {/* ảnh chờ gửi */}
      {pendingImage && (
        <div className="cw-pending-image">
          <img src={pendingImage.previewUrl} alt="Image to send" />
          <span className="cw-pending-hint">
            {isSending
              ? "Sending image..."
              : "Add a question about this image (optional), then send"}
          </span>
          <button
            className="cw-pending-remove"
            onClick={() => setPendingImage(null)}
            disabled={isSending}
            aria-label="Remove image"
          >
            <CloseIcon />
          </button>
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

        <button
          className="cw-icon-btn"
          onClick={handleAttachClick}
          disabled={isSending}
          aria-label="Attach file"
        >
          <PaperClipIcon />
        </button>

        <input
          ref={textInputRef}
          type="text"
          className="cw-input"
          placeholder={
            pendingImage ? "Ask about this image..." : "Type a message..."
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping();
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className="cw-icon-btn"
          onClick={() => setShowEmoji((prev) => !prev)}
          aria-label="Emoji"
        >
          <SmileIcon />
        </button>
        <button
          className="cw-icon-btn cw-send-btn"
          onClick={() => void handleSend()}
          disabled={isSending}
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
