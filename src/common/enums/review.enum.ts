export enum ReviewStatus {
  NEW = 'NEW', // Đánh giá mới gửi, chờ duyệt hoặc chưa trả lời
  APPROVED = 'APPROVED', // Đã hiển thị công khai
  REPLIED = 'REPLIED', // Đã có phản hồi từ Admin
  HIDDEN = 'HIDDEN', // Bị ẩn do vi phạm hoặc do yêu cầu của Admin
}

export enum BlockReason {
  SPAM = 'SPAM',
  OFFENSIVE = 'OFFENSIVE',
  INAPPROPRIATE = 'INAPPROPRIATE',
  OTHER = 'OTHER',
}

export enum BulkReviewAction {
  HIDE = 'HIDE',
  UNHIDE = 'UNHIDE',
  DELETE = 'DELETE',
}
