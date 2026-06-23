import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Policy, PolicyDocument } from './schemas/policy.schema';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    @InjectModel(Policy.name) private policyModel: Model<PolicyDocument>,
  ) {}

  async findPolicyForChatbot(topic?: string) {
    this.logger.log(`\n--- N8N CHATBOT TRA CỨU CHÍNH SÁCH ---`);
    this.logger.log(`Topic gốc n8n gửi sang: ${topic}`);

    if (!topic) {
      return {
        found: false,
        message: 'Vui lòng cung cấp chủ đề chính sách cần hỏi.',
      };
    }

    const cleanTopic = topic.toLowerCase().trim();

    // Tìm kiếm trong DB: Tìm chính sách đang Active và có keyword khớp với topic
    // Dùng $regex để tìm linh hoạt hơn
    const matchedPolicy = await this.policyModel
      .findOne({
        is_active: true,
        keywords: { $regex: new RegExp(cleanTopic, 'i') },
      })
      .lean();

    if (matchedPolicy) {
      this.logger.log(`[Success] Đã tìm thấy chính sách phù hợp.`);
      return { found: true, content: matchedPolicy.content };
    }

    // Fallback: Tìm từng chữ trong topic (Phòng trường hợp AI gửi cụm từ dài)
    const words = cleanTopic.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue; // Bỏ qua các từ nối ngắn
      const fallbackMatch = await this.policyModel
        .findOne({
          is_active: true,
          keywords: { $regex: new RegExp(word, 'i') },
        })
        .lean();

      if (fallbackMatch) {
        this.logger.log(
          `[Success - Fallback] Tìm thấy chính sách qua từ khóa: ${word}`,
        );
        return { found: true, content: fallbackMatch.content };
      }
    }

    this.logger.log(`[Not Found] Không có chính sách khớp.`);
    return {
      found: false,
      content:
        'Hiện tại hệ thống chưa có thông tin chính sách cụ thể cho vấn đề này. Bạn có muốn tôi chuyển máy để gặp nhân viên hỗ trợ trực tiếp không?',
    };
  }
}
