const axios = require('axios');

// [LƯU Ý] Nếu chạy từ máy cá nhân lên server thì thay 127.0.0.1 bằng IP Server
// Nếu chạy file này trực tiếp trên terminal của server thì giữ nguyên
const NEST_TRACKING_URL = 'https://hnodyssey.id.vn/api/tracking/event';

const maleProductIds = [
  '6a30fbaa2727c388232cb5d3',
  '6a310c2676195a562637e961',
  '6a33e8aae22e48993fd2905c',
];

const femaleProductIds = [
  '6a31097276195a562637e540',
  '6a33e770e22e48993fd28eb6',
];

// [ĐÃ CẬP NHẬT] Gắn ID của 2 tài khoản mới
const REAL_MALE_USER_ID = '6a54aa7acc86850d85e07c08'; // Acc Nam: tsuhung2004@gmail.com
const REAL_FEMALE_USER_ID = '6a54aab7cc86850d85e07caf'; // Acc Nữ: hungvuphi2004@gmail.com

// Các Acc mồi (Mock Users) để làm dày ma trận, đuôi đã chuẩn 24 ký tự Hex
const mockMaleUsers = [
  '6a3e665baefa3daef78f1111',
  '6a3e665baefa3daef78f2222',
  '6a3e665baefa3daef78f3333',
];
const mockFemaleUsers = [
  '6a3c2990bae4d34414139444',
  '6a3c2990bae4d34414139555',
  '6a3c2990bae4d34414139666',
];

const axiosInstance = axios.create({ timeout: 10000 });

function fireEvent(userId, productId, action) {
  return axiosInstance
    .post(NEST_TRACKING_URL, {
      session_id: `session_${userId}`,
      user_id: userId,
      action: action,
      path: `/product/${productId}`,
      device: 'DESKTOP',
      dwell_time_seconds: Math.floor(Math.random() * 50) + 15,
      metadata: { product_id: productId },
    })
    .then(() => {
      console.log(`[OK] ${action} - User: ${userId} -> Product: ${productId}`);
    })
    .catch((error) => {
      const errorDetail = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      console.error(`[FAIL] Lỗi cho ${userId}:`, errorDetail);
    });
}

async function runSeed() {
  console.log('🚀 BẮT ĐẦU SEED DATA ĐỂ MỞ RỘNG MA TRẬN SVD...');
  const promises = [];

  const allMales = [REAL_MALE_USER_ID, ...mockMaleUsers];
  for (const user of allMales) {
    for (const prod of maleProductIds) {
      // 100% người dùng xem sản phẩm
      promises.push(fireEvent(user, prod, 'VIEW_PRODUCT'));
      // Tỷ lệ khoảng 40% người dùng sẽ thêm vào giỏ hàng
      if (Math.random() > 0.6) {
        promises.push(fireEvent(user, prod, 'ADD_TO_CART'));
      }
    }
  }

  const allFemales = [REAL_FEMALE_USER_ID, ...mockFemaleUsers];
  for (const user of allFemales) {
    for (const prod of femaleProductIds) {
      // 100% người dùng xem sản phẩm
      promises.push(fireEvent(user, prod, 'VIEW_PRODUCT'));
      // Tỷ lệ khoảng 40% người dùng sẽ thêm vào giỏ hàng
      if (Math.random() > 0.6) {
        promises.push(fireEvent(user, prod, 'ADD_TO_CART'));
      }
    }
  }

  await Promise.all(promises);
  console.log(
    '✅ ĐÃ SEED XONG HÀNH VI! Đừng quên dùng lệnh "curl -X POST http://127.0.0.1:8000/train" trên server để AI cập nhật nhé.',
  );
}

runSeed();
