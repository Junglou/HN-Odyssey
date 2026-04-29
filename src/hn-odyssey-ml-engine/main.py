# Import các thành phần cần thiết từ FastAPI để tạo API, xử lý lỗi và chạy tác vụ ngầm
from fastapi import FastAPI, HTTPException, BackgroundTasks
# Thư viện xử lý dữ liệu dạng bảng (DataFrame)
import pandas as pd
# Thư viện xử lý toán học và ma trận tốc độ cao
import numpy as np
# Trình điều khiển (driver) để kết nối và tương tác với cơ sở dữ liệu MongoDB
from pymongo import MongoClient
# Thuật toán Truncated Singular Value Decomposition dùng để giảm chiều dữ liệu và lọc cộng tác (Collaborative Filtering)
from sklearn.decomposition import TruncatedSVD
# Server ASGI để chạy ứng dụng FastAPI
import uvicorn
# Thư viện ghi log hệ thống
import logging
# Thư viện dùng để đọc các biến môi trường từ file .env
from dotenv import load_dotenv
import os
# Các thư viện xử lý thời gian và toán học cơ bản
from datetime import datetime, timezone, timedelta
import math

# Cấu hình hệ thống ghi log: Hiển thị thời gian, mức độ cảnh báo (INFO, ERROR...) và nội dung tin nhắn
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Load các biến môi trường từ file .env bảo mật vào hệ thống của Python
load_dotenv()

# Cấu hình MongoDB: Lấy URI và Tên Database từ biến môi trường, nếu không có sẽ dùng giá trị mặc định
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "hn-odyssey")
# Lấy cổng (port) chạy server từ biến môi trường, mặc định là 8000
PORT = int(os.getenv("PORT", 8000))

# Khởi tạo ứng dụng FastAPI với tên và phiên bản
app = FastAPI(title="H&N Odyssey ML Engine", version="1.0")
# Tạo đối tượng logger riêng cho ML Engine để theo dõi các hoạt động
logger = logging.getLogger("ml_engine")

# === KHAI BÁO BIẾN TOÀN CỤC (GLOBAL VARIABLES) ===
# Global variables để lưu trữ Model và cấu trúc dữ liệu ngay trên RAM.
# Việc này giúp API khi được gọi sẽ tra cứu trực tiếp trên RAM, cho thời gian phản hồi siêu tốc (< 100ms) 
# thay vì phải tính toán lại từ đầu hoặc truy vấn DB liên tục.
RECOMMENDATION_MATRIX = None # Ma trận kết quả sau khi đã train qua SVD chứa điểm dự đoán
USER_INDEX_MAP = {}          # Dictionary ánh xạ từ user_id sang chỉ số dòng (row index) trong ma trận
PRODUCT_IDS = []             # Danh sách ID sản phẩm tương ứng với các cột (column index) trong ma trận

def train_model():
    """
    Hàm chạy ngầm (Background Task) mỗi khi NestJS gọi API POST /train.
    Nhiệm vụ: Truy xuất dữ liệu từ DB, tính toán điểm số, tạo ma trận tương tác và huấn luyện model SVD.
    """
    # Khai báo sử dụng các biến toàn cục để có thể cập nhật kết quả sau khi train xong
    global RECOMMENDATION_MATRIX, USER_INDEX_MAP, PRODUCT_IDS
    
    logger.info("Bắt đầu lấy dữ liệu từ MongoDB để Train Model...")
    # Mở kết nối đến MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Lấy thời gian hiện tại theo chuẩn UTC
    now = datetime.now(timezone.utc)
    # Tính mốc thời gian cách đây 90 ngày
    ninety_days_ago = now - timedelta(days=90) # [FIX RAM]: Giới hạn 90 ngày để tránh tải lượng dữ liệu quá lớn gây tràn RAM
    
    # 1. Truy vấn lịch sử hành vi có giới hạn thời gian từ collection 'user_behaviors'
    # Chỉ lấy các bản ghi có user_id, có product_id và được tạo trong vòng 90 ngày trở lại đây
    behaviors = list(db.user_behaviors.find(
        {
            "user_id": {"$exists": True},
            "metadata.product_id": {"$exists": True},
            "createdAt": {"$gte": ninety_days_ago} 
        },
        # Projection: Chỉ lấy những trường cần thiết để tối ưu bộ nhớ và băng thông
        {"user_id": 1, "metadata": 1, "action": 1, "createdAt": 1}
    ))
    
    # Đóng kết nối Database ngay sau khi lấy xong dữ liệu để giải phóng tài nguyên
    client.close()
    
    # Kiểm tra nếu không có dữ liệu thì dừng quá trình train
    if not behaviors:
        logger.warning("Không có dữ liệu behavior để train model.")
        return

    # 2. Xây dựng Dataframe và gán trọng số điểm cho từng hành vi
    data = []
    for b in behaviors:
        action = b.get("action")
        base_score = 0
        metadata = b.get("metadata", {})
        
        # [FIX AC2]: Scoring Matrix Chuẩn Xác - Chấm điểm hệ thống dựa trên mức độ quan trọng của hành vi
        if action == "VIEW_PRODUCT": 
            base_score = 1 # Xem sản phẩm: Mức độ quan tâm thấp nhất
        elif action == "ADD_TO_CART": 
            base_score = 3 # Thêm vào giỏ: Quan tâm nhiều
        elif action == "PURCHASE": 
            base_score = 5 # Đã mua: Quan tâm cao nhất
        elif action == "REVIEW_PRODUCT":
            # Đánh giá sản phẩm: Lấy số sao, nếu không có thì mặc định là 5
            rating = metadata.get("rating", 5) 
            if rating >= 4:
                base_score = 5 # Đánh giá tốt (4-5 sao): Tính bằng điểm mua hàng
            elif rating <= 2:
                base_score = -5 # Phạt điểm cực mạnh nếu khách ghét (1-2 sao) để hệ thống ngừng gợi ý
            else:
                base_score = 1 # 3 sao (Trung lập): Tính như điểm xem sản phẩm
        
        # Nếu hành vi này có tạo ra điểm số (khác 0)
        if base_score != 0:
            # RECENCY WEIGHTING (Thời gian hiệu lực) - Hàm suy giảm thời gian (Time Decay)
            # Dữ liệu càng cũ thì giá trị ảnh hưởng đến gợi ý càng thấp
            created_at = b.get("createdAt")
            weight = 1.0 
            
            # Xử lý đồng bộ múi giờ về chuẩn UTC để tính toán chính xác
            if isinstance(created_at, datetime):
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                # Tính số ngày chênh lệch từ lúc diễn ra hành vi đến hiện tại
                days_diff = (now - created_at).days
                if days_diff > 0:
                    # Sử dụng hàm mũ (exponential decay) để giảm dần trọng số (giảm khoảng 2% mỗi ngày)
                    weight = math.exp(-0.02 * days_diff)
            
            # Điểm cuối cùng = Điểm hành vi * Trọng số thời gian
            final_score = base_score * weight

            # Đưa dữ liệu đã xử lý vào mảng lưu trữ
            data.append({
                "user_id": str(b["user_id"]),
                "product_id": str(b["metadata"]["product_id"]),
                "score": final_score
            })
            
    # Chuyển mảng dữ liệu thành Pandas DataFrame để dễ dàng xử lý tính toán
    df = pd.DataFrame(data)
    if df.empty:
        return
        
    # Gộp (Group by) các bản ghi bị trùng lặp của cùng 1 user trên cùng 1 sản phẩm và cộng dồn điểm số lại
    df = df.groupby(['user_id', 'product_id'])['score'].sum().reset_index()
    
    # Tạo Pivot Table (Ma trận người dùng - sản phẩm)
    # Hàng (Index) là User, Cột (Columns) là Product, Giá trị (Values) là điểm số.
    # .fillna(0) để điền số 0 vào những ô trống (user chưa từng tương tác với sản phẩm đó)
    pivot_table = df.pivot(index='user_id', columns='product_id', values='score').fillna(0)
    
    # Ánh xạ từ User ID sang chỉ số hàng (0, 1, 2...) để tiện tra cứu mảng 2 chiều
    USER_INDEX_MAP = {user_id: idx for idx, user_id in enumerate(pivot_table.index)}
    # Lưu lại danh sách Product ID theo đúng thứ tự cột
    PRODUCT_IDS = list(pivot_table.columns)
    # Lấy dữ liệu thuần (chỉ chứa các con số) để đưa vào thuật toán SVD
    matrix = pivot_table.values
    
    # Kiểm tra vấn đề "Cold Start" (Khởi động lạnh): 
    # Nếu hệ thống có ít hơn 2 người dùng hoặc ít hơn 2 sản phẩm, không đủ dữ liệu chạy SVD.
    if matrix.shape[0] < 2 or matrix.shape[1] < 2:
        RECOMMENDATION_MATRIX = matrix # Dùng thẳng ma trận gốc chưa qua SVD
        logger.info("Dữ liệu quá mỏng (Cold Start), tạm thời dùng ma trận thô.")
        return

    # Thuật toán SVD yêu cầu số chiều (n_components) phải nhỏ hơn số dòng/số cột trừ 1
    # Ở đây chọn tối đa 20 đặc trưng ẩn (latent features)
    n_components = min(20, matrix.shape[0] - 1, matrix.shape[1] - 1)
    if n_components < 1: n_components = 1
        
    # Khởi tạo mô hình SVD với n_components đã tính toán. random_state để kết quả train luôn đồng nhất nếu cùng data.
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    # Huấn luyện mô hình và giảm chiều ma trận người dùng - tính năng
    matrix_svd = svd.fit_transform(matrix)
    # Khôi phục lại ma trận (Nhân ma trận người dùng-tính năng với tính năng-sản phẩm)
    # Ma trận kết quả RECOMMENDATION_MATRIX lúc này đã được làm đầy các ô có số 0 ban đầu bằng điểm số dự đoán.
    RECOMMENDATION_MATRIX = np.dot(matrix_svd, svd.components_)
    
    logger.info("Hoàn tất Train ML Model thành công!")


# API endpoint: Nhận yêu cầu train model (phương thức POST)
@app.post("/train")
async def trigger_train(background_tasks: BackgroundTasks):
    # Đẩy tác vụ train_model vào Background Tasks của FastAPI để chạy nền
    # Giúp API phản hồi ngay lập tức cho client (NestJS) mà không cần bắt client chờ vài phút/vài giây cho đến khi train xong.
    background_tasks.add_task(train_model)
    return {"message": "Lệnh Train Model đang được xử lý chạy ngầm..."}


# API endpoint: Trả về danh sách sản phẩm gợi ý cho một user_id cụ thể (phương thức GET)
@app.get("/recommend/{user_id}")
async def get_recommendation(user_id: str):
    # Truy cập các biến chứa Model đã được load trên RAM
    global RECOMMENDATION_MATRIX, USER_INDEX_MAP, PRODUCT_IDS
    
    # Nếu hệ thống vừa khởi động và chưa chạy hàm train_model lần nào, báo lỗi 503
    if RECOMMENDATION_MATRIX is None:
        raise HTTPException(status_code=503, detail="Model chưa sẵn sàng. Đang chờ Data.")
        
    # Nếu user_id này chưa từng tồn tại trong quá khứ lúc train model (Khách mới / Cold Start)
    if user_id not in USER_INDEX_MAP:
        # Fallback Cold Start: Trả về mảng rỗng. 
        # Thực tế ở NestJS có thể bắt mảng rỗng này và trả về "Sản phẩm phổ biến/Bán chạy nhất"
        return {"user_id": user_id, "recommended_product_ids": []}
        
    # Lấy ra vị trí dòng của user này trong ma trận dự đoán
    user_idx = USER_INDEX_MAP[user_id]
    # Trích xuất toàn bộ hàng điểm số dự đoán của user này đối với tất cả sản phẩm
    user_predictions = RECOMMENDATION_MATRIX[user_idx]
    
    # argsort() trả về chỉ số của mảng xếp hạng từ bé đến lớn.
    # [::-1] là thủ thuật Python để lật ngược mảng lại thành từ Lớn Xuống Bé (Cao nhất xếp đầu).
    top_indices = user_predictions.argsort()[::-1]
    
    recommended_ids = []

    # [FIX AC17]: SIMILARITY THRESHOLD (Ngưỡng tối thiểu)
    # Duyệt qua các vị trí sản phẩm đã được xếp hạng từ điểm cao xuống điểm thấp
    for i in top_indices:
        # Chỉ lấy những sản phẩm có điểm dự đoán (độ tương đồng / độ quan tâm) lớn hơn hoặc bằng 0.3
        # Tránh việc gợi ý cả những sản phẩm rác/điểm quá thấp
        if user_predictions[i] >= 0.3:
            recommended_ids.append(PRODUCT_IDS[i])
            
        # Tối ưu payload: Giới hạn chỉ trả về top 20 sản phẩm đạt chuẩn cao nhất
        # Khi đủ 20 sản phẩm thì thoát vòng lặp ngay lập tức
        if len(recommended_ids) >= 20:
            break
    
    # Trả về kết quả dạng JSON cho hệ thống backend gọi nó
    return {
        "user_id": user_id,
        "recommended_product_ids": recommended_ids
    }

# Khối điều kiện để đảm bảo code bên trong chỉ chạy khi file này được thực thi trực tiếp 
# (không chạy nếu file này bị import từ một file python khác)
if __name__ == "__main__":
    # Khi vừa khởi động Server, kích hoạt train_model 1 lần ngay lập tức để nạp dữ liệu ban đầu vào RAM
    train_model()
    # Chạy Web Server ASGI Uvicorn, lắng nghe trên tất cả các IP (0.0.0.0) và port đã cấu hình
    uvicorn.run(app, host="0.0.0.0", port=PORT)