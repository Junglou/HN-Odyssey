// imports
import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "../../../assets/icons/FloatingToolboxIcons";
import ToolDrawer from "./ToolDrawer";
import ChatWidget from "./ChatWidget";
import "./FloatingToolbox.css";

// container
export default function FloatingToolbox() {
  // states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // handlers
  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const openTool = (toolName: string) => {
    setActiveTool(toolName);
    setIsDrawerOpen(false);
  };

  const closeTool = () => setActiveTool(null);

  // render
  return (
    <div className="ft-wrapper">
      {/* unified drawer block */}
      <div
        className={`ft-drawer-container ${isDrawerOpen ? "open" : "closed"} ${activeTool ? "hidden" : ""}`}
      >
        {/* drawer tab (ear) */}
        <button className="ft-drawer-tab" onClick={toggleDrawer}>
          {isDrawerOpen ? <ArrowRightIcon /> : <ArrowLeftIcon />}
        </button>

        {/* drawer content */}
        <div className="ft-drawer-content">
          <ToolDrawer onSelectTool={openTool} />
        </div>
      </div>

      {/* active tool view */}
      <div className={`ft-active-view ${activeTool === "CHAT" ? "open" : ""}`}>
        {activeTool === "CHAT" && <ChatWidget onClose={closeTool} />}
      </div>
    </div>
  );
}
