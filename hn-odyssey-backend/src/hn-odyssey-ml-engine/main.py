from fastapi import FastAPI, HTTPException, BackgroundTasks
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.decomposition import TruncatedSVD
import uvicorn
import logging
from dotenv import load_dotenv
import os
from datetime import datetime, timezone, timedelta
import math

# Setup logging cơ bản để dễ debug, format có đủ timestamp và level
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Load biến môi trường từ file .env
load_dotenv()

# Lấy config DB từ env, fallback về localhost nếu chưa set
MONGO_URI = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "hn-odyssey")
# Port cho server, mặc định 8000
PORT = int(os.getenv("ML_PORT", 8000))

# Khởi tạo FastAPI app
app = FastAPI(title="H&N Odyssey ML Engine", version="1.0")
# Cắm riêng một con logger cho ML Engine để dễ track
logger = logging.getLogger("ml_engine")

# GLOBAL VARIABLES
# Cache model và data thẳng trên RAM.
# Mục đích là để API respond cực nhanh (< 100ms) thay vì phải query DB hay tính toán lại mỗi lần gọi.
RECOMMENDATION_MATRIX = None
USER_INDEX_MAP = {}          
PRODUCT_IDS = []             
IS_TRAINING = False          

def train_model():
    """
    Background task chạy mỗi khi có request từ NestJS (/train).
    Flow: Kéo data từ Mongo -> Tính điểm -> Dựng ma trận -> Train SVD.
    """
    # Lấy các biến global để ghi đè kết quả sau khi train xong
    global RECOMMENDATION_MATRIX, USER_INDEX_MAP, PRODUCT_IDS, IS_TRAINING
    
    # Khóa trạng thái để chặn các request train spam vào cùng lúc
    IS_TRAINING = True
    
    try:
        logger.info("Bắt đầu lấy dữ liệu từ MongoDB để Train Model...")
        # Mở connection Mongo
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        
        now = datetime.now(timezone.utc)
        # [FIX RAM]: Chỉ lấy data 90 ngày đổ lại. Lấy nhiều quá dễ tèo RAM.
        ninety_days_ago = now - timedelta(days=90) 
        
        # 1. Kéo lịch sử hành vi của user. 
        # Chỉ query các field thực sự cần thiết để tiết kiệm memory & băng thông.
        behaviors = list(db.user_behaviors.find(
            {
                "user_id": {"$exists": True},
                "metadata.product_id": {"$exists": True},
                "createdAt": {"$gte": ninety_days_ago} 
            },
            {"user_id": 1, "metadata": 1, "action": 1, "createdAt": 1}
        ))
        
        # Xong việc thì đóng connection DB luôn cho nhẹ máy
        client.close()
        
        if not behaviors:
            logger.warning("Không có dữ liệu behavior để train model.")
            return

        # 2. Xử lý Data và tính điểm (Scoring)
        data = []
        for b in behaviors:
            action = b.get("action")
            base_score = 0
            metadata = b.get("metadata", {})
            
            # [FIX AC2]: Scoring Matrix - Chấm điểm dựa trên action của user
            if action == "VIEW_PRODUCT": 
                base_score = 1 # Xem thì cho 1 điểm
            elif action == "ADD_TO_CART": 
                base_score = 3 # Thêm giỏ hàng cho 3 điểm
            elif action == "PURCHASE": 
                base_score = 5 # Chốt đơn cho 5 điểm
            elif action == "REVIEW_PRODUCT":
                rating = metadata.get("rating", 5) 
                if rating >= 4:
                    base_score = 5 # Đánh giá cao: tính như mua hàng
                elif rating <= 2:
                    base_score = -5 # Đánh giá tệ: Phạt điểm nặng để cấm gợi ý
                else:
                    base_score = 1 # 3 sao bình thường: tính như view
            
            # Nếu có phát sinh điểm
            if base_score != 0:
                # RECENCY WEIGHTING: Time Decay. Data càng cũ thì ảnh hưởng càng giảm.
                created_at = b.get("createdAt")
                weight = 1.0 
                
                # Đồng bộ UTC để tránh bug lệch múi giờ
                if isinstance(created_at, datetime):
                    if created_at.tzinfo is None:
                        created_at = created_at.replace(tzinfo=timezone.utc)
                    
                    days_diff = (now - created_at).days
                    if days_diff > 0:
                        # Giảm dần trọng số, cứ trôi qua 1 ngày là rớt tầm 2% giá trị
                        weight = math.exp(-0.02 * days_diff)
                
                final_score = base_score * weight

                data.append({
                    "user_id": str(b["user_id"]),
                    "product_id": str(b["metadata"]["product_id"]),
                    "score": final_score
                })
                
        # Bơm vào Pandas DataFrame xử lý cho lẹ
        df = pd.DataFrame(data)
        if df.empty:
            return
            
        # Group by để cộng dồn điểm nếu 1 user tương tác 1 sản phẩm nhiều lần
        df = df.groupby(['user_id', 'product_id'])['score'].sum().reset_index()
        
        # Dựng Pivot Table (User - Product). Chỗ nào chưa tương tác thì fill 0.
        pivot_table = df.pivot(index='user_id', columns='product_id', values='score').fillna(0)
        
        # Map User ID ra index để sau này chọc vào mảng 2 chiều cho nhanh
        USER_INDEX_MAP = {user_id: idx for idx, user_id in enumerate(pivot_table.index)}
        # Lưu lại list Product ID đúng thứ tự
        PRODUCT_IDS = list(pivot_table.columns)
        # Rút raw data ra chuẩn bị đẩy vào SVD
        matrix = pivot_table.values
        
        # Xử lý Cold Start: Dữ liệu quá mỏng (dưới 2 user hoặc 2 product) thì khỏi chạy SVD, xài tạm ma trận thô.
        if matrix.shape[0] < 2 or matrix.shape[1] < 2:
            RECOMMENDATION_MATRIX = matrix 
            logger.info("Dữ liệu quá mỏng (Cold Start), tạm thời dùng ma trận thô.")
            return

        # Setup SVD. Lấy tối đa 20 latent features.
        n_components = min(20, matrix.shape[0] - 1, matrix.shape[1] - 1)
        if n_components < 1: n_components = 1
            
        svd = TruncatedSVD(n_components=n_components, random_state=42)
        matrix_svd = svd.fit_transform(matrix)
        
        # Khôi phục ma trận: Nhân ngược lại để ra ma trận gợi ý hoàn chỉnh (nó sẽ điền điểm vào các ô 0 lúc nãy)
        RECOMMENDATION_MATRIX = np.dot(matrix_svd, svd.components_)
        
        logger.info("Hoàn tất Train ML Model thành công!")
        
    except Exception as e:
        logger.error(f"Tiến trình Train Model gặp lỗi: {str(e)}")
    finally:
        # Nhớ xả cờ trạng thái ra để lần sau còn train tiếp
        IS_TRAINING = False


# API Endpoint nhận request train
@app.post("/train")
async def trigger_train(background_tasks: BackgroundTasks):
    global IS_TRAINING
    
    # Đang train dở thì chặn luôn, tránh dội request
    if IS_TRAINING:
        return {"message": "Hệ thống đang tiến hành re-train rồi, request bị bỏ qua để tránh quá tải."}
        
    # Đẩy vào Background Tasks để API trả response liền cho NestJS mà không bị block.
    background_tasks.add_task(train_model)
    return {"message": "Lệnh Train Model đang được xử lý chạy ngầm..."}


# API Endpoint nhả đồ gợi ý cho user
@app.get("/recommend/{user_id}")
async def get_recommendation(user_id: str):
    global RECOMMENDATION_MATRIX, USER_INDEX_MAP, PRODUCT_IDS
    
    # Chưa có model (chắc vừa sập/restart) thì quăng 503
    if RECOMMENDATION_MATRIX is None:
        raise HTTPException(status_code=503, detail="Model chưa sẵn sàng. Đang chờ Data.")
        
    # Khách mới tinh (Cold Start). Trả mảng rỗng để bên NestJS tự xử lý (gợi ý đồ hot trend, best seller...).
    if user_id not in USER_INDEX_MAP:
        return {"user_id": user_id, "recommended_product_ids": []}
        
    # Xác định vị trí của user trong ma trận dự đoán
    user_idx = USER_INDEX_MAP[user_id]
    user_predictions = RECOMMENDATION_MATRIX[user_idx]
    
    # Lấy index các sản phẩm có điểm cao nhất (argsort xong flip ngược lại mảng)
    top_indices = user_predictions.argsort()[::-1]
    
    recommended_ids = []

    # [FIX AC17]: SIMILARITY THRESHOLD (Ngưỡng tối thiểu)
    for i in top_indices:
        # Lọc bớt đồ rác. Chỉ recommend mấy món có điểm >= 0.3
        if user_predictions[i] >= 0.5:
            recommended_ids.append(PRODUCT_IDS[i])
            
        # Cắt lấy top 20 món thôi cho nhẹ payload
        if len(recommended_ids) >= 20:
            break
    
    return {
        "user_id": user_id,
        "recommended_product_ids": recommended_ids
    }

if __name__ == "__main__":
    # Vừa boot server lên thì đá một nhát train liền để nhồi data vào RAM
    train_model()
    # Chạy uvicorn server
    uvicorn.run(app, host="0.0.0.0", port=PORT)