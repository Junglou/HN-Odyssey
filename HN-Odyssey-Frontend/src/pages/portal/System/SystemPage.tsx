import System from "../../../components/portal/System/System";
import { useSystem } from "../../../hooks/portal/System/useSystem";
import "./SystemPage.css";

export default function SystemPage() {
  // Page đóng vai trò Controller gọi logic
  const { state, data, actions } = useSystem();

  return (
    <div className="sys-page-container">
      {/* Component chính: Quản lý giao diện và nhận dữ liệu qua props */}
      <System state={state} data={data} actions={actions} />
    </div>
  );
}
