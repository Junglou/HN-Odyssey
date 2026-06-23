import sanitizeHtml from 'sanitize-html';

export const sanitizeReviewContent = (text: string): string => {
  if (!text) return text;
  // Bỏ toàn bộ thẻ HTML và Script để chống XSS
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
};
