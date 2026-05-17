import { RobotIcon } from "../../../assets/icons/FloatingToolboxIcons";
import "./ToolDrawer.css";

// props
interface ToolDrawerProps {
  onSelectTool: (toolName: string) => void;
}

// component
export default function ToolDrawer({ onSelectTool }: ToolDrawerProps) {
  return (
    <div className="ft-drawer-menu">
      <button className="ft-tool-btn" onClick={() => onSelectTool("CHAT")}>
        <RobotIcon />
      </button>
    </div>
  );
}
