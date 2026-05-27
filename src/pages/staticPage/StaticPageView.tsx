// imports
import { useStaticPageView } from "../../hooks/staticPage/useStaticPageView";
import "./StaticPageView.css";

// component
export default function StaticPageView() {
  // hooks/states
  const { data, isLoading, error } = useStaticPageView();

  // render: trạng thái đang tải dữ liệu
  if (isLoading) {
    return (
      <div className="static-page-wrapper static-page-loading">
        <div className="static-spinner"></div>
        <p>Đang tải nội dung...</p>
      </div>
    );
  }

  // render: trạng thái lỗi hoặc không tìm thấy trang (404)
  if (error || !data) {
    return (
      <div className="static-page-wrapper static-page-error">
        <h2>Oops!</h2>
        <p>{error || "Đã xảy ra lỗi không xác định."}</p>
        <button
          onClick={() => window.history.back()}
          className="static-back-btn"
        >
          Quay lại trang trước
        </button>
      </div>
    );
  }

  // render: trạng thái thành công, đổ mã HTML vào giao diện
  return (
    <div className="static-page-wrapper">
      <div className="static-page-container">
        {/* Tiêu đề trang */}
        <h1 className="static-page-title">{data.title}</h1>

        {/* Vùng render HTML nguy hiểm (từ CSDL)
          Cần có CSS bảo vệ ở Bước 3 để ảnh/bảng bên trong không làm vỡ layout 
        */}
        <div
          className="static-page-content"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      </div>
    </div>
  );
}
