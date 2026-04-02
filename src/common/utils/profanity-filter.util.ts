export const filterProfanity = (
  text: string,
): { isClean: boolean; filteredText: string } => {
  if (!text) return { isClean: true, filteredText: text };

  // Danh sách từ cấm (Blacklist) có thể lấy từ DB hoặc cấu hình tĩnh
  const blacklist = ['từ_cấm_1', 'từ_cấm_2', 'chửi_thề'];

  let isClean = true;
  let filteredText = text;

  blacklist.forEach((badWord) => {
    // Regex tìm từ cấm không phân biệt hoa thường
    const regex = new RegExp(badWord, 'gi');
    if (regex.test(filteredText)) {
      isClean = false;
      // AC7: Thay thế từ cấm bằng ***
      filteredText = filteredText.replace(regex, '***');
    }
  });

  return { isClean, filteredText };
};
