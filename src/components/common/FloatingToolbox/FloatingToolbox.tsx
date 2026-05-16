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
      {/* drawer & toggle btn */}
      {!activeTool && (
        <div className="ft-drawer-zone">
          <div className={`ft-drawer-panel ${isDrawerOpen ? "open" : ""}`}>
            <ToolDrawer onSelectTool={openTool} />
          </div>

          <button className="ft-toggle-btn" onClick={toggleDrawer}>
            {isDrawerOpen ? <ArrowRightIcon /> : <ArrowLeftIcon />}
          </button>
        </div>
      )}

      {/* active tool view */}
      <div className={`ft-active-view ${activeTool === "CHAT" ? "open" : ""}`}>
        {activeTool === "CHAT" && <ChatWidget onClose={closeTool} />}
      </div>
    </div>
  );
}
