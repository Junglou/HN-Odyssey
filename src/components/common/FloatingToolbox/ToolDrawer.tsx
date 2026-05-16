// imports
import { ChatBubbleIcon } from "../../../assets/icons/FloatingToolboxIcons";

// props
interface ToolDrawerProps {
  onSelectTool: (toolName: string) => void;
}

// component
export default function ToolDrawer({ onSelectTool }: ToolDrawerProps) {
  // render
  return (
    <div className="ft-drawer-menu" style={{ display: "flex", gap: "10px" }}>
      {/* Nút bật Chatbox */}
      <button
        className="ft-tool-btn"
        onClick={() => onSelectTool("CHAT")}
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "none",
          backgroundColor: "#EFDCC8",
          color: "#000",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ChatBubbleIcon />
      </button>

      {/* Chừa chỗ sau này cho các chức năng khác */}
    </div>
  );
}
