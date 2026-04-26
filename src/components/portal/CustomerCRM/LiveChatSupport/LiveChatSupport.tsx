import { useState, useEffect, useRef } from "react";
import "./LiveChatSupport.css";
import {
  SearchIcon,
  SendIcon,
  AttachmentIcon,
  EmojiIcon,
  AvatarIcon,
} from "../../../../assets/icons/LiveChatSupportIcons";
import type {
  ChatSession,
  ChatStatus,
} from "../../../../hooks/portal/CustomerCRM/LiveChatSupport/useLiveChatSupport";

interface LiveChatSupportProps {
  filteredSessions: ChatSession[];
  activeTab: ChatStatus;
  searchQuery: string;
  activeSessionId: string | null;
  activeSession: ChatSession | null;
  actions: {
    changeTab: (tab: ChatStatus) => void;
    changeSearch: (query: string) => void;
    selectSession: (sessionId: string) => void;
    acceptConsultant: (sessionId: string) => void;
    completeConsultant: (sessionId: string) => void;
    sendMessage: (sessionId: string, text: string) => void;
  };
}

export default function LiveChatSupport({
  filteredSessions,
  activeTab,
  searchQuery,
  activeSessionId,
  activeSession,
  actions,
}: LiveChatSupportProps) {
  const [messageText, setMessageText] = useState("");

  // state quản lý kích thước và trạng thái kéo thả sidebar
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // xử lý sự kiện kéo chuột trên toàn màn hình
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
        {/* cột trái: danh sách các phiên chat */}
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
              Waitlist <span className="lcs-badge">1</span>
            </button>
            <button
              type="button"
              className={`lcs-tab-btn ${activeTab === "Ongoing" ? "active ongoing" : ""}`}
              onClick={() => actions.changeTab("Ongoing")}
            >
              Ongoing <span className="lcs-badge">99</span>
            </button>
            <button
              type="button"
              className={`lcs-tab-btn ${activeTab === "Complete" ? "active complete" : ""}`}
              onClick={() => actions.changeTab("Complete")}
            >
              Complete
            </button>
          </div>

          <div className="lcs-search-wrapper">
            <SearchIcon />
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
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`lcs-session-item ${session.id === activeSessionId ? "selected" : ""}`}
                  onClick={() => actions.selectSession(session.id)}
                >
                  <div className="lcs-avatar-circle">
                    <AvatarIcon />
                  </div>

                  <div className="lcs-session-info">
                    {/* bọc tên và thời gian */}
                    <div className="lcs-session-name-row">
                      <h4 className="lcs-session-name">
                        {session.customerName}
                      </h4>
                      <span className="lcs-session-time">
                        {session.lastMessageTime}
                      </span>
                    </div>
                    <p className="lcs-session-handle">
                      {session.customerHandle}
                    </p>
                    <p className="lcs-session-preview">This is a sample text</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="lcs-empty-list">No conversations found.</div>
            )}
          </div>
        </div>

        {/* thanh kéo thả thay đổi kích thước */}
        <div
          className={`lcs-resizer ${isResizing ? "active" : ""}`}
          onMouseDown={startResizing}
        ></div>

        {/* cột phải: khu vực hiển thị chi tiết tin nhắn */}
        <div className="lcs-chat-area">
          {activeSession ? (
            <>
              <div className="lcs-chat-header">
                <div className="lcs-chat-header-user">
                  <div className="lcs-avatar-circle">
                    <AvatarIcon />
                  </div>
                  <div>
                    <h3 className="lcs-chat-name">
                      {activeSession.customerName}
                    </h3>
                    <p className="lcs-chat-handle">
                      {activeSession.customerHandle}
                    </p>
                  </div>
                </div>

                <div className="lcs-chat-actions">
                  {activeSession.status === "Waitlist" && (
                    <button
                      className="lcs-action-btn dark"
                      onClick={() => actions.acceptConsultant(activeSession.id)}
                    >
                      Accept consultant
                    </button>
                  )}
                  {activeSession.status === "Ongoing" && (
                    <button
                      className="lcs-action-btn dark"
                      onClick={() =>
                        actions.completeConsultant(activeSession.id)
                      }
                    >
                      Complete consultant
                    </button>
                  )}
                </div>
              </div>

              <div className="lcs-chat-messages">
                <div className="lcs-chat-date-divider">Aug 31</div>
                {activeSession.messages.map((msg) => {
                  const isCustomer = msg.senderType === "customer";

                  return (
                    <div
                      key={msg.id}
                      className={`lcs-message-row ${isCustomer ? "customer" : "consultant"}`}
                    >
                      {isCustomer && (
                        <div className="lcs-message-avatar customer-avatar">
                          <AvatarIcon size={16} />
                        </div>
                      )}

                      <div
                        className={`lcs-message-content ${isCustomer ? "customer-bg" : "consultant-bg"}`}
                      >
                        {msg.type === "text" && <p>{msg.content}</p>}

                        {msg.type === "image" && (
                          <div className="lcs-message-image">
                            <img src={msg.content} alt="attachment" />
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
                          <AvatarIcon size={16} />
                        </div>
                      )}

                      <span className="lcs-message-time">{msg.timestamp}</span>
                    </div>
                  );
                })}
              </div>

              <div className="lcs-chat-input-area">
                <input
                  type="text"
                  placeholder="Write a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="lcs-input-actions">
                  <button className="lcs-icon-btn">
                    <AttachmentIcon />
                  </button>
                  <button className="lcs-icon-btn">
                    <EmojiIcon />
                  </button>
                  <button className="lcs-send-btn" onClick={handleSendMessage}>
                    <SendIcon />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="lcs-no-chat-selected">
              <p>Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
