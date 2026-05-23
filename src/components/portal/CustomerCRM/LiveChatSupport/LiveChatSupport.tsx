import { useState, useEffect, useRef } from "react";
import "./LiveChatSupport.css";
import type {
  ChatSession,
  ChatStatus,
} from "../../../../hooks/portal/CustomerCRM/LiveChatSupport/useLiveChatSupport";
import axiosClient from "../../../../api/axiosClient";
import EmojiPicker, {
  type EmojiClickData,
  EmojiStyle,
} from "emoji-picker-react";

// --- INLINE ICONS ĐỂ ĐẢM BẢO 100% HIỂN THỊ ---
const InlineAttachmentIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

const InlineEmojiIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
    <line x1="9" y1="9" x2="9.01" y2="9"></line>
    <line x1="15" y1="9" x2="15.01" y2="9"></line>
  </svg>
);

const InlineSendIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const InlineAvatarIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const InlineSearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const DoubleCheckIcon = ({ isRead }: { isRead: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={isRead ? "#0084ff" : "#9ca3af"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lcs-double-check"
  >
    <polyline points="7 12 12 17 22 7"></polyline>
    <polyline points="2 12 7 17 12 12"></polyline>
  </svg>
);

const InlineWaitlistIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const InlineOngoingIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const InlineCompleteIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const InlineAcceptIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"></path>
  </svg>
);

const InlineCompleteSessionIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const InlineEmptyChatIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const isImageUrl = (url: string) => /\.(jpeg|jpg|gif|png|webp)$/i.test(url);

interface LiveChatSupportProps {
  filteredSessions: ChatSession[];
  hasMore: boolean;
  activeTab: ChatStatus;
  searchQuery: string;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  tabCounts: { Waitlist: number; Ongoing: number; Complete: number };
  typingUsers: Record<string, boolean>;
  actions: {
    changeTab: (tab: ChatStatus) => void;
    changeSearch: (query: string) => void;
    selectSession: (sessionId: string) => void;
    acceptConsultant: (sessionId: string) => void;
    completeConsultant: (sessionId: string) => void;
    loadMore: () => void;
    sendMessage: (
      sessionId: string,
      text: string,
      type?: "TEXT" | "IMAGE" | "FILE",
      metadata?: Record<string, unknown>,
    ) => void;
    sendTyping: (sessionId: string, isTyping: boolean) => void;
  };
}

export default function LiveChatSupport({
  filteredSessions,
  hasMore,
  activeTab,
  searchQuery,
  activeSessionId,
  typingUsers,
  activeSession,
  tabCounts,
  actions,
}: LiveChatSupportProps) {
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessageText((prevInput) => prevInput + emojiData.emoji);
  };

  // LOGIC UPLOAD ẢNH/FILE GỌI API THỰC TẾ
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSessionId) return;

    const isImage = file.type.startsWith("image/");
    const messageType = isImage ? "IMAGE" : "FILE";

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axiosClient.post("/upload/single", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const baseUrl = import.meta.env.VITE_API_URL.replace("/api", "");
      const fileUrl = `${baseUrl}${uploadRes.data.path}`;

      const metadata = isImage
        ? {}
        : {
            fileName: file.name,
            fileSize: `${(file.size / 1024).toFixed(2)} KB`,
          };

      actions.sendMessage(activeSessionId, fileUrl, messageType, metadata);
    } catch (error) {
      console.error("Lỗi upload file:", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // LOGIC BÁO ĐANG GÕ PHÍM (ĐÃ TỐI ƯU CHỐNG SPAM)
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (activeSessionId) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        actions.sendTyping(activeSessionId, true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        actions.sendTyping(activeSessionId, false);
      }, 2000);
    }
  };

  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const sidebarLeft = sidebarRef.current.getBoundingClientRect().left;
        const newWidth = Math.max(250, Math.min(e.clientX - sidebarLeft, 600));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleSendMessage = () => {
    if (activeSessionId && messageText.trim()) {
      actions.sendMessage(activeSessionId, messageText);
      setMessageText("");

      isTypingRef.current = false;
      actions.sendTyping(activeSessionId, false);
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="lcs-page-wrapper">
      <div className="lcs-page-header">
        <h1 className="lcs-page-title">Live Chat Support</h1>
        <p className="lcs-page-breadcrumb">Customer CRM / Live Chat Support</p>
      </div>
      <div
        className={`lcs-container ${isResizing ? "is-resizing-container" : ""}`}
      >
        <div
          className="lcs-sidebar"
          ref={sidebarRef}
          style={
            { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
          }
        >
          <div className="lcs-tabs">
            <button
              type="button"
              className={`lcs-tab-btn ${activeTab === "Waitlist" ? "active waitlist" : ""}`}
              onClick={() => actions.changeTab("Waitlist")}
            >
              <InlineWaitlistIcon />
              Waitlist
              {tabCounts.Waitlist > 0 && (
                <span className="lcs-badge">{tabCounts.Waitlist}</span>
              )}
            </button>
            <button
              type="button"
              className={`lcs-tab-btn ${activeTab === "Ongoing" ? "active ongoing" : ""}`}
              onClick={() => actions.changeTab("Ongoing")}
            >
              <InlineOngoingIcon />
              Ongoing
              {tabCounts.Ongoing > 0 && (
                <span className="lcs-badge">{tabCounts.Ongoing}</span>
              )}
            </button>
            <button
              type="button"
              className={`lcs-tab-btn ${activeTab === "Complete" ? "active complete" : ""}`}
              onClick={() => actions.changeTab("Complete")}
            >
              <InlineCompleteIcon />
              Complete
              {tabCounts.Complete > 0 && (
                <span className="lcs-badge">{tabCounts.Complete}</span>
              )}
            </button>
          </div>

          <div className="lcs-search-wrapper">
            <InlineSearchIcon />
            <input
              type="text"
              className="lcs-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => actions.changeSearch(e.target.value)}
            />
          </div>

          <div className="lcs-session-list">
            {filteredSessions.length > 0 ? (
              <>
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`lcs-session-item ${session.id === activeSessionId ? "selected" : ""}`}
                    onClick={() => actions.selectSession(session.id)}
                  >
                    <div className="lcs-avatar-circle">
                      {session.customerAvatar ? (
                        <img
                          src={session.customerAvatar}
                          alt="avatar"
                          className="lcs-avatar-img"
                        />
                      ) : (
                        <InlineAvatarIcon />
                      )}
                    </div>

                    <div className="lcs-session-info">
                      <div className="lcs-session-name-row">
                        <h4 className="lcs-session-name">
                          {session.customerName}
                        </h4>
                        <span className="lcs-session-time">
                          {session.lastMessageTime}
                        </span>
                      </div>
                      {session.departmentTag && (
                        <span className="lcs-department-tag">
                          Bộ phận: {session.departmentTag}
                        </span>
                      )}
                      <p className="lcs-session-handle">
                        {session.customerHandle}
                      </p>
                      <p className="lcs-session-preview">
                        {session.previewText}
                      </p>
                    </div>
                  </div>
                ))}

                {/* NÚT TẢI THÊM ĐỂ LOAD PAGE TIẾP THEO */}
                {hasMore && (
                  <button
                    type="button"
                    className="lcs-action-btn dark"
                    onClick={actions.loadMore}
                    style={{
                      width: "90%",
                      margin: "10px auto",
                      display: "block",
                    }}
                  >
                    Tải thêm hội thoại...
                  </button>
                )}
              </>
            ) : (
              <div className="lcs-empty-list">No conversations found.</div>
            )}
          </div>
        </div>

        <div
          className={`lcs-resizer ${isResizing ? "active" : ""}`}
          onMouseDown={startResizing}
        ></div>

        <div className="lcs-chat-area">
          {activeSession ? (
            <>
              <div className="lcs-chat-header">
                <div className="lcs-chat-header-user">
                  <div className="lcs-avatar-circle">
                    {activeSession.customerAvatar ? (
                      <img
                        src={activeSession.customerAvatar}
                        alt="avatar"
                        className="lcs-avatar-img"
                      />
                    ) : (
                      <InlineAvatarIcon />
                    )}
                  </div>
                  <div>
                    <h3 className="lcs-chat-name">
                      {activeSession.customerName}
                    </h3>
                    <p className="lcs-chat-handle">
                      {activeSession.customerHandle}
                    </p>
                    <div className="lcs-chat-opened-at">
                      {activeSession.openedAt && (
                        <span>Bắt đầu: {activeSession.openedAt}</span>
                      )}
                      {activeSession.closedAt && (
                        <span> - Kết thúc: {activeSession.closedAt}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lcs-chat-actions">
                  {activeSession.status === "Waitlist" && (
                    <button
                      type="button"
                      className="lcs-action-btn dark"
                      onClick={() => actions.acceptConsultant(activeSession.id)}
                    >
                      <InlineAcceptIcon />
                      Accept consultant
                    </button>
                  )}
                  {activeSession.status === "Ongoing" && (
                    <button
                      type="button"
                      className="lcs-action-btn dark"
                      onClick={() =>
                        actions.completeConsultant(activeSession.id)
                      }
                    >
                      <InlineCompleteSessionIcon />
                      Complete consultant
                    </button>
                  )}
                </div>
              </div>

              <div className="lcs-chat-messages">
                {activeSession.messages.length > 0 && (
                  <div className="lcs-chat-date-divider">
                    {activeSession.messages[0].date}
                  </div>
                )}
                {activeSession.messages.map((msg) => {
                  if (msg.senderType === "system") {
                    return (
                      <div key={msg.id} className="lcs-message-system">
                        {msg.content}
                      </div>
                    );
                  }
                  const isCustomer = msg.senderType === "customer";

                  return (
                    <div
                      key={msg.id}
                      className={`lcs-message-row ${isCustomer ? "customer" : "consultant"}`}
                    >
                      {isCustomer && (
                        <div className="lcs-message-avatar customer-avatar">
                          {activeSession.customerAvatar ? (
                            <img
                              src={activeSession.customerAvatar}
                              alt="avatar"
                              className="lcs-avatar-img"
                            />
                          ) : (
                            <InlineAvatarIcon size={16} />
                          )}
                        </div>
                      )}

                      <div
                        className={`lcs-message-content ${isCustomer ? "customer-bg" : "consultant-bg"}`}
                      >
                        {msg.type === "text" && !isImageUrl(msg.content) && (
                          <p>{msg.content}</p>
                        )}

                        {(msg.type === "image" ||
                          (msg.type === "text" && isImageUrl(msg.content))) && (
                          <div className="lcs-message-image">
                            <img src={msg.content} alt="attachment" />
                          </div>
                        )}

                        {msg.type === "file" && msg.fileData && (
                          <div className="lcs-message-file">
                            <InlineAttachmentIcon />
                            <div>
                              <a
                                href={msg.fileData.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {msg.fileData.fileName}
                              </a>
                              <p>{msg.fileData.fileSize}</p>
                            </div>
                          </div>
                        )}

                        {msg.type === "product" && msg.productData && (
                          <div className="lcs-product-card">
                            <img
                              src={msg.productData.imageUrl}
                              alt={msg.productData.name}
                            />
                            <div className="lcs-product-info">
                              <h4>{msg.productData.name}</h4>
                              <p>{msg.productData.description}</p>
                              <a
                                href={`http://${msg.productData.link}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {msg.productData.link}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isCustomer && (
                        <div className="lcs-message-avatar consultant-avatar">
                          <InlineAvatarIcon size={16} />
                        </div>
                      )}

                      <span
                        className={`lcs-message-time ${isCustomer ? "lcs-message-time-customer" : "lcs-message-time-consultant"}`}
                      >
                        {msg.timestamp}
                        {!isCustomer && msg.senderType === "consultant" && (
                          <DoubleCheckIcon isRead={!!msg.isRead} />
                        )}
                      </span>
                    </div>
                  );
                })}
                {activeSession && typingUsers[activeSession.customerName] && (
                  <div className="lcs-message-row customer">
                    <div className="lcs-message-content customer-bg lcs-typing">
                      Đang gõ...
                    </div>
                  </div>
                )}
              </div>

              <div className="lcs-chat-input-area">
                {showEmojiPicker && (
                  <div className="lcs-emoji-picker-wrapper">
                    <EmojiPicker
                      onEmojiClick={onEmojiClick}
                      width={320} // Ép chiều rộng cố định để không bị vỡ khi responsive
                      height={400}
                      searchDisabled={false} // Có thể tắt search nếu không cần thiết
                      emojiStyle={EmojiStyle.NATIVE}
                    />
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Write a message..."
                  value={messageText}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                />
                <div className="lcs-input-actions">
                  <label className="lcs-icon-btn">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <InlineAttachmentIcon />
                  </label>
                  <button
                    type="button"
                    className="lcs-icon-btn"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                  >
                    <InlineEmojiIcon />
                  </button>
                  <button
                    type="button"
                    className="lcs-send-btn"
                    onClick={handleSendMessage}
                  >
                    <InlineSendIcon />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="lcs-no-chat-selected">
              <InlineEmptyChatIcon />
              <p>Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
