export const filterProfanity = (
  text: string,
): { isClean: boolean; filteredText: string } => {
  if (!text) return { isClean: true, filteredText: text };

  // Danh sách từ cấm (Blacklist) tiếng Việt
  const blacklist = [
    // Nhóm chửi thề, lăng mạ cơ bản
    'đm',
    'đkm',
    'dkm',
    'địt mẹ',
    'địt cụ',
    'địt má',
    'đụ má',
    'đụ mẹ',
    'đụ',
    'địt',
    'vl',
    'vkl',
    'vcl',
    'vãi lồn',
    'vãi l',
    'vãi cặc',
    'vãi đái',
    'vãi beep',
    'đéo',
    'đếch',
    'đết',
    'éo',
    'đệt',
    'đệt mợ',
    'đệch',

    // Nhóm từ ngữ tình dục, bộ phận sinh dục
    'lồn',
    'cặc',
    'buồi',
    'dái',
    'cu',
    'bướm',
    'chim',
    'vú',
    'chịch',
    'xoạc',
    'phang',
    'đụ nhau',
    'địt nhau',
    'chịch nhau',
    'gạ chịch',
    'nứng',
    'nứng lồn',
    'nứng cặc',
    'nứng sảng',
    'thủ dâm',
    'quay tay',
    'sục cặc',
    'bú cu',
    'bú lồn',
    'lếu lều',
    'liếm lồn',
    'liếm bướm',
    'sờ vú',
    'bóp vú',

    // Nhóm từ lóng, mại dâm
    'đĩ',
    'phò',
    'cave',
    'điếm',
    'đĩ điếm',
    'đĩ thỏa',
    'đĩ ngựa',
    'gái gọi',
    'hàng họ',
    'bán hoa',
    'đĩ mẹ',
    'đĩ chó',
    'bitch',

    // Nhóm miệt thị, xúc phạm nhân phẩm
    'chó đẻ',
    'óc chó',
    'óc lợn',
    'óc cặc',
    'óc bã đậu',
    'đồ con chó',
    'thằng chó',
    'thằng lồn',
    'con lồn',
    'cái lồn',
    'củ cặc',
    'đầu cặc',
    'mặt lồn',
    'xạo lồn',
    'xàm lồn',
    'hãm lồn',
    'như lồn',
    'hãm tài',
    'bố láo',
    'mất dạy',
    'vô học',
    'súc vật',
    'súc sinh',
    'đồ cặn bã',
    'chết tiệt',
  ];

  let isClean = true;
  let filteredText = text;

  blacklist.forEach((badWord) => {
    // Sử dụng Negative Lookbehind và Lookahead để chỉ khớp từ độc lập
    // (?<!\\S) đảm bảo không có ký tự khác khoảng trắng ở trước
    // (?!\\S) đảm bảo không có ký tự khác khoảng trắng ở sau
    // Điều này giúp tránh việc lọc nhầm. VD: cấm "cu" sẽ không lọc nhầm từ "cung", "cuối"
    const regex = new RegExp(`(?<!\\S)${badWord}(?!\\S)`, 'gi');

    if (regex.test(filteredText)) {
      isClean = false;
      // AC7: Thay thế từ cấm bằng ***
      filteredText = filteredText.replace(regex, '***');
    }
  });

  return { isClean, filteredText };
};
