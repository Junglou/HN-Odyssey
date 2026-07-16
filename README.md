# 🏕️ H&N Odyssey - B2C E-Commerce & Administration Portal
H&N Odyssey là hệ thống thương mại điện tử B2C chuyên cung cấp trang phục và thiết bị dã ngoại. Dự án được chia thành hai luồng chính: trang mua sắm trực tuyến dành cho khách hàng (**Storefront**) và cổng quản trị nội bộ dành cho doanh nghiệp (**H&N-Portal**).

🌐 **Website chính thức:** [https://hnodyssey.id.vn/](https://hnodyssey.id.vn/)

🔑 **Tài khoản trải nghiệm H&N-Portal (Admin):**
* **Email:** `admin@hnodyssey.com`
* **Mật khẩu:** `HnOdyssey@2025`
---

## 🎓 Thông tin Đồ án Tốt nghiệp
**Đồ án tốt nghiệp năm 2026 - Chuyên ngành Công nghệ Phần mềm**
* **Trường:** Đại học Văn Lang - Khoa Công nghệ Thông tin
* **Sinh viên thực hiện:** 
  * Ngô Quốc Nam (MSSV: 2274802010553)
  * Vũ Hoàng Phi Hùng (MSSV: 2274802010296)
* **Giáo viên hướng dẫn:** ThS. Nguyễn Minh Tân

---

## 🌟 Tính năng Cốt lõi

### 1. Storefront (Khách hàng)
* **AI Recommendations:** Tích hợp engine Algolia để tìm kiếm, lọc động và gợi ý sản phẩm theo hành vi người dùng.
* **Hỗ trợ trực tuyến:** Triển khai Live Chat và AI Chatbot 24/7 (kết hợp n8n webhook với các model Gemini, Groq, OpenRouter).
* **Trade-in (Thu cũ đổi mới):** Hỗ trợ quy trình định giá và thu đổi thiết bị cũ trực tiếp trên hệ thống.
* **Thanh toán & Vận chuyển:** Tích hợp thanh toán qua VNPay, MoMo và đồng bộ trạng thái giao hàng realtime qua API của GHN, GHTK.

### 2. H&N-Portal (Vận hành nội bộ)
Hệ thống quản trị áp dụng mô hình phân quyền RBAC, chia thành 6 phân hệ độc lập:
* **Manager:** Xem Dashboard, báo cáo doanh thu, đánh giá ROI chiến dịch Marketing và xuất báo cáo tồn kho (Excel/PDF).
* **Sale & Marketing:** Quản lý sản phẩm, giá bán, biến thể, mã giảm giá, Flash Sales và kiểm duyệt đánh giá.
* **Media:** Quản lý Landing Page, trang tĩnh, Blog và xử lý hình ảnh qua Cloudinary.
* **Warehouse (WMS):** Quản lý xuất/nhập kho, thiết lập cảnh báo Min/Max, tạo phiếu điều chỉnh và in tem mã vạch.
* **CSKH:** Quản lý hồ sơ khách hàng, xử lý yêu cầu Trade-in và hỗ trợ qua Live Chat.
* **Operations:** Giám sát tài nguyên hệ thống (CPU/RAM, Network), quản lý phân quyền và theo dõi hành vi qua bản đồ nhiệt (Heatmap).

---

## 🛠 Kiến trúc Công nghệ

* **Frontend:** React 19, TypeScript, Vite, Ant Design, Tailwind, Algolia InstantSearch, Socket.io-client.
* **Backend:** NestJS 11, Node.js, TypeScript, MongoDB, Redis (Bull Queue), Socket.io, NodeMailer, Cloudinary.
* **Machine Learning Engine:** Chạy độc lập qua môi trường Python/FastAPI (port 8000) để xử lý thuật toán (vd: TruncatedSVD).

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu hệ thống
* **Node.js:** v22.x+
* **Database:** MongoDB
* **Caching:** Redis Server (Port `6379`)

### 1. Thiết lập Backend
cd hn-odyssey-backend
npm install

### 2. Thiết lập Frontend
cd HN-Odyssey-Frontend
npm install

### 3. Khởi chạy ứng dụng
Chạy server backend và frontend ở môi trường development:

# Tại thư mục Backend
npm run start:dev

# Tại thư mục Frontend
npm run dev

Quy trình Phát triển
Dự án được quản lý theo mô hình Agile/Scrum. Lịch sử thay đổi (Commit), tính năng mới và các bản vá lỗi (Bug Tracking) được theo dõi, đánh giá định kỳ qua các buổi Sprint Retrospective và quản lý phiên bản bằng Git.
