import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import sharp from 'sharp';

dotenv.config();

// 1. Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MONGO_URI = process.env.MONGO_URL as string;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Hàm đệ quy lấy toàn bộ file
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

async function migrateGlobal(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Đã kết nối MongoDB Atlas');

    // Fix TS18048: Kiểm tra null cho mongoose.connection.db
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Không thể kết nối đến Database instance.');
    }

    const allFiles = getAllFiles(UPLOADS_DIR);
    console.log(`📂 Tìm thấy ${allFiles.length} files trong hệ thống cục bộ.`);

    const urlMap = new Map<string, string>();

    // 2. Tải toàn bộ file lên Cloudinary
    for (const filePath of allFiles) {
      const relativePath = path
        .relative(__dirname, filePath)
        .replace(/\\/g, '/');

      if (relativePath.includes('.DS_Store')) continue;

      console.log(`☁️ Đang xử lý: ${relativePath}`);
      const cloudinaryUrl = await uploadAndCompressFile(filePath, relativePath);

      if (cloudinaryUrl) {
        urlMap.set(`/${relativePath}`, cloudinaryUrl);
        urlMap.set(relativePath, cloudinaryUrl);
      }
    }

    console.log(
      `🔄 Đã đẩy xong file lên Cloud. Bắt đầu quét và thay thế link...`,
    );

    // 3. Quét TẤT CẢ collections
    const collections = await db.listCollections().toArray();

    for (const coll of collections) {
      const collectionName = coll.name;
      const collection = db.collection(collectionName);
      const docs = await collection.find({}).toArray();

      let updatedDocsCount = 0;

      for (const doc of docs) {
        const isModified = replaceUrlsInDoc(doc, urlMap);

        if (isModified) {
          // Fix TS2790: Dùng destructuring để tách _id ra thay vì dùng 'delete'
          const { _id, ...updateData } = doc as {
            _id: mongoose.Types.ObjectId;
            [key: string]: unknown;
          };

          await collection.updateOne({ _id }, { $set: updateData });
          updatedDocsCount++;
        }
      }

      if (updatedDocsCount > 0) {
        console.log(
          `📝 Đã cập nhật ${updatedDocsCount} records trong bảng [${collectionName}]`,
        );
      }
    }

    console.log('🎉 QUÁ TRÌNH MIGRATION TOÀN DIỆN HOÀN TẤT!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

// Hàm đệ quy thay thế URL an toàn với TypeScript
function replaceUrlsInDoc(doc: unknown, urlMap: Map<string, string>): boolean {
  let isModified = false;
  const docString = JSON.stringify(doc);

  if (!docString || !docString.includes('upload')) return false;

  function traverse(obj: unknown) {
    // Chỉ xử lý nếu obj là object và không null
    if (typeof obj !== 'object' || obj === null) return;

    // Fix lỗi unsafe-assignment và unsafe-member-access bằng cách ép kiểu Record an toàn
    const record = obj as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      const val = record[key];

      if (typeof val === 'string') {
        let newVal = val;

        if (urlMap.has(val)) {
          newVal = urlMap.get(val) as string;
        } else if (val.includes('/uploads/') || val.includes('uploads/')) {
          for (const [oldUrl, newUrl] of urlMap.entries()) {
            if (newVal.includes(oldUrl)) {
              newVal = newVal.split(oldUrl).join(newUrl);
            }
          }
        }

        if (newVal !== val) {
          record[key] = newVal;
          isModified = true;
        }
      } else if (typeof val === 'object') {
        traverse(val);
      }
    }
  }

  traverse(doc);
  return isModified;
}

// Hàm đẩy lên Cloudinary + Nén ảnh
async function uploadAndCompressFile(
  physicalPath: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const stats = fs.statSync(physicalPath);
    const maxSize = 10485760;
    let targetPath = physicalPath;
    let isTemp = false;

    if (stats.size > maxSize && physicalPath.match(/\.(jpg|jpeg|png|webp)$/i)) {
      targetPath = physicalPath + '.temp.jpg';
      isTemp = true;
      await sharp(physicalPath).jpeg({ quality: 75 }).toFile(targetPath);
    }

    const folderPath = path.dirname(relativePath).replace(/\\/g, '/');
    const cloudFolder = `hn-odyssey/${folderPath.replace(/^uploads\/?/, '')}`;

    const result = await cloudinary.uploader.upload(targetPath, {
      folder: cloudFolder,
      resource_type: 'auto',
    });

    if (isTemp && fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    return result.secure_url;

    // Fix lỗi unsafe-member-access err.message
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌ Lỗi upload file (${relativePath}):`, errorMessage);
    return null;
  }
}

migrateGlobal().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error('Lỗi thực thi script:', errorMessage);
  process.exit(1);
});
