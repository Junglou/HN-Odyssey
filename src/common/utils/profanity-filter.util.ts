// Danh sách từ cấm mẫu (Admin có thể cấu hình chuyển vào DB sau)
const BLACKLIST_KEYWORDS = ['tục tĩu', 'lừa đảo', 'quảng cáo'];

export interface ProfanityFilterResult {
  isClean: boolean;
  cleanText: string;
}

export const filterProfanity = (text: string): ProfanityFilterResult => {
  if (!text) return { isClean: true, cleanText: text };

  let cleanText = text;
  let isClean = true;

  BLACKLIST_KEYWORDS.forEach((word) => {
    // Tìm kiếm không phân biệt hoa thường
    const regex = new RegExp(word, 'gi');
    if (regex.test(cleanText)) {
      isClean = false;
      // Tự động thay thế từ cấm bằng ***
      cleanText = cleanText.replace(regex, '***');
    }
  });

  return { isClean, cleanText };
};
