import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';

import {
  Conversation,
  ConversationStatus,
} from './schemas/conversation.schema';
import { Message } from './schemas/message.schema';
import { OrdersService } from 'src/modules/sales/orders/orders.service';
import { OrderDocument } from 'src/modules/sales/orders/schemas/order.schema';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { Cron, CronExpression } from '@nestjs/schedule';

// 1. Interfaces rõ ràng để tránh "any"
interface ChatContext {
  user?: {
    fullName?: string;
    email?: string;
  };
  currentPage?: string;
  idleTime?: number;
}

interface ChatResponse {
  _id?: string;
  createdAt?: string;
  conversation_id: string;
  session_id?: string; // Bổ sung để trả về FE
  sender_type: string;
  content: string;
  conversation_status: string;
  message_type?: string;
  metadata?: Record<string, unknown>;
}

interface SendMessageDto {
  conversationId: string;
  content: string;
  sender_type?: 'USER' | 'AGENT';
  message_type?: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'FILE';
  metadata?: Record<string, unknown>;
}

interface AiEngineResponse {
  reply: string;
  action?: string;
  message_type?: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD' | 'FILE';
  metadata?: Record<string, unknown>;
}

// Định nghĩa kiểu dữ liệu con cho kết quả đếm
interface AggregateCount {
  count: number;
}

// Interface cho kết quả Aggregate mới, loại bỏ hoàn toàn "any"
interface AggregateStats {
  Waitlist: AggregateCount[];
  Ongoing: AggregateCount[];
  Complete: AggregateCount[];
  csatData: Array<{ _id: null; avgRating: number }>;
  byStatus: Array<{ _id: string; count: number }>;
}

interface LatestMessageAggregation {
  _id: Types.ObjectId;
  latest_message: Message;
}

@Injectable()
export class ChatService {
  public onlineAgents = new Set<string>();
  private readonly logger = new Logger(ChatService.name);
  private messageTimestamps = new Map<string, number[]>();

  constructor(
    @InjectModel(Conversation.name) private convModel: Model<Conversation>,
    @InjectModel(Message.name) private msgModel: Model<Message>,
    private ordersService: OrdersService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private emailService: EmailService,
  ) {
    // THÊM DÒNG NÀY ĐỂ FAKE CÓ NGƯỜI ONLINE:
    // this.onlineAgents.add('fake-agent-de-test');
  }

  async initOrGetConversation(sessionId: string, customerId?: string) {
    // 1. Tìm xem khách này (Guest hoặc User) đang có hội thoại nào chưa đóng không?
    const query: FilterQuery<Conversation> = customerId
      ? { customer_id: new Types.ObjectId(customerId) }
      : { session_id: sessionId };

    query.status = { $ne: ConversationStatus.CLOSED }; // Bỏ qua các hội thoại đã đóng/đánh giá xong

    let conv = await this.convModel
      .findOne(query)
      .sort({ createdAt: -1 })
      .exec();

    // 2. Nếu đã có hội thoại cũ đang chat dở -> Trả về luôn
    if (conv) {
      return {
        is_new: false,
        conversation_id: conv._id.toString(),
        status: conv.status,
      };
    }

    // 3. Nếu chưa có hoặc cái cũ đã CLOSED -> Tạo mới hoàn toàn
    conv = await this.convModel.create({
      session_id: sessionId,
      customer_id: customerId ? new Types.ObjectId(customerId) : undefined,
      status: ConversationStatus.BOT,
      context: {},
    });

    return {
      is_new: !conv,
      conversation_id: conv._id.toString(),
      session_id: conv.session_id,
      status: conv.status,
    };
  }

  private filterProfanity(text: string): string {
    const badWords = ['đm', 'vcl', 'địt', 'chó', 'ngu', 'fuck', 'shit'];
    let filteredText = text;

    badWords.forEach((word) => {
      // Dùng Regex thay thế không phân biệt hoa thường
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filteredText = filteredText.replace(regex, '***');
    });

    return filteredText;
  }

  private normalizeDepartment(input: string): string {
    const dept = input.toUpperCase().trim();

    // Map các từ khóa gần giống về Enum chuẩn
    if (
      dept.includes('TECH') ||
      dept.includes('KỸ THUẬT') ||
      dept.includes('LỖI')
    )
      return 'TECH';
    if (
      dept.includes('SALE') ||
      dept.includes('BÁN HÀNG') ||
      dept.includes('MUA')
    )
      return 'SALE';

    return 'SUPPORT'; // Default
  }

  // AC14: Fix lỗi "Unsafe argument" bằng cách dùng FilterQuery
  async findAllConversations(query: {
    status?: string;
    agent_id?: string;
    unassigned?: string;
    limit?: number;
    page?: number;
    search?: string;
  }) {
    const { status, limit = 20, page = 1, search } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<Conversation> = {};
    if (status) filter.status = status;

    // LOGIC CHUẨN: Lọc theo phân công
    if (query.unassigned === 'true') {
      filter.agent_id = { $exists: false }; // Chưa ai nhận (Waitlist)
    } else if (query.agent_id) {
      filter.agent_id = new Types.ObjectId(query.agent_id); // Của riêng nhân viên này (Ongoing)
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { session_id: searchRegex },
        { department_tag: searchRegex },
        // Lưu ý: Nếu bạn muốn search theo tên user đã Login (customer_id),
        // bạn cần tìm mảng userIds từ UserModel trước rồi nhét vào đây thông qua { customer_id: { $in: userIds } }
      ];
    }

    const conversations = await this.convModel
      .find(filter)
      .populate('customer_id', 'first_Name last_Name username email avatar')
      .populate('agent_id', 'first_Name last_Name employee_code')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const total = await this.convModel.countDocuments(filter).exec();

    // (Giữ nguyên đoạn Bulk API lấy latestMessage của bạn ở đây...)
    const convIds = conversations.map((c) => c._id);
    const latestMessages = await this.msgModel
      .aggregate<LatestMessageAggregation>([
        { $match: { conversation_id: { $in: convIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$conversation_id',
            latest_message: { $first: '$$ROOT' },
          },
        },
      ])
      .exec();

    const data = conversations.map((conv) => {
      const matchMsg = latestMessages.find(
        (m) => m._id.toString() === conv._id.toString(),
      );
      return {
        ...conv,
        latest_message: matchMsg ? matchMsg.latest_message : null,
      };
    });

    return {
      data,
      meta: { total, page, last_page: Math.ceil(total / limit) },
    };
  }

  // AC14: Tính toán AHT & CSAT thực tế
  async getChatStatistics() {
    const stats = await this.convModel
      .aggregate<AggregateStats>([
        {
          $facet: {
            Waitlist: [
              { $match: { status: 'OPEN', agent_id: { $exists: false } } },
              { $count: 'count' },
            ],
            Ongoing: [
              { $match: { status: 'OPEN', agent_id: { $exists: true } } },
              { $count: 'count' },
            ],
            Complete: [{ $match: { status: 'CLOSED' } }, { $count: 'count' }],
            // Phục vụ Analytics:
            csatData: [
              { $match: { 'csat.rating': { $exists: true } } },
              { $group: { _id: null, avgRating: { $avg: '$csat.rating' } } },
            ],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }], // Giữ lại để tính handoff_rate
          },
        },
      ])
      .exec();

    // Do stats đã được định dạng kiểu, việc truy xuất sẽ được TypeScript bảo vệ
    const result = stats[0];

    // Sử dụng Optional Chaining an toàn
    const avgCsat = result?.csatData?.[0]?.avgRating ?? 0;
    const statusDistribution = result?.byStatus ?? [];

    return {
      WaitlistCount: result?.Waitlist?.[0]?.count ?? 0,
      OngoingCount: result?.Ongoing?.[0]?.count ?? 0,
      CompleteCount: result?.Complete?.[0]?.count ?? 0,
      average_csat: avgCsat.toFixed(1),
      handoff_rate: this.calculateHandoffRate(statusDistribution),
    };
  }

  // Hàm helper để tính Handoff Rate (AC14)
  private calculateHandoffRate(
    statusDistribution: Array<{ _id: string; count: number }>,
  ): string {
    const total = statusDistribution.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return '0%';

    // Handoff là khi trạng thái chuyển sang OPEN (nhân viên nhận) hoặc CLOSED (đã hỗ trợ xong)
    const handoffs = statusDistribution
      .filter((item) => item._id === 'OPEN' || item._id === 'CLOSED')
      .reduce((sum, item) => sum + item.count, 0);

    return ((handoffs / total) * 100).toFixed(2) + '%';
  }

  // AC9: Fix lỗi "Cannot find name Types"
  async assignToAgent(conversationId: string, agentId: string) {
    return this.convModel
      .findByIdAndUpdate(
        conversationId,
        {
          agent_id: new Types.ObjectId(agentId),
          status: 'OPEN',
        },
        { new: true },
      )
      .populate('agent_id', 'fullName')
      .exec();
  }

  // AC4: Giữ nguyên logic cũ đã sạch
  async handleOrderLookup(orderCode: string, phone: string): Promise<string> {
    const order = (await this.ordersService.findOneByCodeAndPhone(
      orderCode,
      phone,
    )) as OrderDocument;

    if (!order) {
      return 'Dạ, em không tìm thấy đơn hàng này. Anh/chị kiểm tra lại mã giúp em nhé!';
    }

    const status = order.status;
    const date = order.updatedAt
      ? new Date(order.updatedAt).toLocaleDateString('vi-VN')
      : 'N/A';

    return `Đơn hàng ${order.order_code} của bạn đang ở trạng thái: ${status}. Dự kiến giao vào ngày ${date}.`;
  }

  // AC5: Xử lý Ticket
  // API Tool Tạo Ticket
  async createOfflineTicket(sessionId: string, email: string, message: string) {
    // 1. Gộp khai báo và tìm kiếm theo ID thật (Nếu đúng chuẩn 24 ký tự)
    let conv = Types.ObjectId.isValid(sessionId)
      ? await this.convModel.findById(sessionId).exec()
      : null;

    // 2. Nếu không tìm thấy bằng ID thật, tìm bằng session_id của Guest
    if (!conv) {
      conv = await this.convModel.findOne({ session_id: sessionId }).exec();
    }

    // 3. Vẫn không có thì tự động tạo mới
    if (!conv) {
      this.logger.warn(
        `[Ticket] Session ${sessionId} chưa tồn tại. Tự động tạo mới...`,
      );
      conv = await this.convModel.create({
        session_id: sessionId,
        status: ConversationStatus.BOT,
        context: {},
      });
    }

    await this.convModel
      .findByIdAndUpdate(conv._id, {
        status: ConversationStatus.OPEN,
        department_tag: 'OFFLINE_TICKET',
      })
      .exec();

    // AC5: GỬI EMAIL XÁC NHẬN CHO KHÁCH HÀNG
    try {
      await this.emailService.sendTicketConfirmation(email, message);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Lỗi gửi mail Ticket cho ${email}: ${errorMessage}`);
    }

    this.eventEmitter.emit('support.ticket_created', {
      email,
      ticketId: conv._id,
      content: message,
    });

    return {
      success: true,
      message:
        'Yêu cầu của bạn đã được ghi nhận. Chúng tôi sẽ phản hồi qua email trong 24h tới.',
    };
  }

  // AC10: Chống Spam
  checkSpam(userId: string): boolean {
    const now = Date.now();
    const userLogs = this.messageTimestamps.get(userId) || [];
    const recentLogs = userLogs.filter((ts) => now - ts < 10000);

    if (recentLogs.length >= 5) return true;

    recentLogs.push(now);
    this.messageTimestamps.set(userId, recentLogs);
    return false;
  }

  // GỌI SANG N8N
  async callAiEngine(
    sessionId: string,
    text: string,
    context: ChatContext,
  ): Promise<AiEngineResponse> {
    const n8nUrl =
      this.configService.get<string>('N8N_AI_CHAT_URL') ||
      'http://localhost:5678/webhook/ai-chat';

    // Lấy API Key từ biến môi trường (.env)
    const n8nApiKey =
      this.configService.get<string>('N8N_API_KEY') ||
      'HN-Odyssey-Super-Secret-Key-2026';

    try {
      const response = await axios.post(
        n8nUrl,
        {
          sessionId,
          chatInput: text,
          context: {
            user_name: context.user?.fullName || 'Khách',
            current_page: context.currentPage || 'Unknown',
            page_idle_time: context.idleTime || 0,
            is_logged_in: !!context.user,
          },
        },
        {
          // Bổ sung Headers tại đây
          headers: {
            'n8n-api-key': n8nApiKey,
          },
        },
      );

      console.log('n8n Response:', response.data);

      return response.data as AiEngineResponse;
    } catch (error) {
      this.logger.error(
        `AI Engine Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { reply: 'Hệ thống AI đang bảo trì, vui lòng thử lại sau!' };
    }
  }

  async processUserMessage(data: SendMessageDto): Promise<ChatResponse> {
    const conv = await this.convModel.findById(data.conversationId).exec();
    const status = conv?.status || ConversationStatus.BOT;

    const cleanContent = this.filterProfanity(data.content);
    const senderType = data.sender_type || 'USER';

    const savedMsg = await this.msgModel.create({
      conversation_id: new Types.ObjectId(data.conversationId),
      sender_type: senderType,
      content: cleanContent,
      message_type: data.message_type || 'TEXT',
      metadata: data.metadata || {},
    });

    const createdAt = savedMsg.get('createdAt') as Date;

    return {
      _id: savedMsg._id.toString(),
      createdAt: createdAt.toISOString(),
      conversation_id: data.conversationId,
      sender_type: senderType,
      content: cleanContent,
      conversation_status: status as string,
      message_type: savedMsg.message_type,
      metadata: savedMsg.metadata as Record<string, unknown>,
    };
  }

  async getBotResponse(data: SendMessageDto): Promise<ChatResponse> {
    const aiResponse = await this.callAiEngine(
      data.conversationId,
      data.content,
      {},
    );

    this.logger.debug(`AI raw response: ${JSON.stringify(aiResponse)}`);

    const finalReply =
      aiResponse?.reply ||
      'Hệ thống đang quá tải, anh/chị vui lòng thử lại sau vài giây nhé!';
    const msgType = aiResponse?.message_type || 'TEXT';
    const msgMetadata = aiResponse?.metadata || {};

    // Lưu nội dung chat của Bot vào database kèm theo loại tin nhắn
    const savedMsg = await this.msgModel.create({
      conversation_id: new Types.ObjectId(data.conversationId),
      sender_type: 'BOT',
      content: finalReply,
      message_type: msgType,
      metadata: msgMetadata,
    });

    const createdAt = savedMsg.get('createdAt') as Date;

    return {
      _id: savedMsg._id.toString(),
      createdAt: createdAt.toISOString(),
      conversation_id: data.conversationId,
      sender_type: 'BOT',
      content: finalReply,
      conversation_status: 'BOT',
      message_type: msgType,
      metadata: msgMetadata,
    };
  }

  // AC9: Xử lý chuyển đổi từ Bot sang Người thật (Handoff) Được gọi từ n8n Tool: handoff_staff
  async handleHandoffFromBot(
    sessionId: string,
    department: string,
    summary: string,
  ) {
    this.logger.log(`[Handoff] Bắt đầu chuyển giao hội thoại: ${sessionId}`);
    const validDept = this.normalizeDepartment(department);

    // Gộp khai báo và nội suy kiểu dữ liệu tự động
    let conv = Types.ObjectId.isValid(sessionId)
      ? await this.convModel.findById(sessionId).exec()
      : null;

    if (!conv) {
      conv = await this.convModel.findOne({ session_id: sessionId }).exec();
    }

    if (!conv) {
      conv = await this.convModel.create({
        session_id: sessionId,
        status: ConversationStatus.BOT,
        context: {},
      });
    }

    // AC5: KIỂM TRA TRẠNG THÁI ONLINE CỦA AGENT
    if (this.onlineAgents.size === 0) {
      this.logger.warn(
        `[Handoff] Không có nhân viên Online. Chuyển sang Form Offline.`,
      );
      await this.msgModel.create({
        conversation_id: conv._id,
        sender_type: 'SYSTEM',
        content: `Hiện tại các nhân viên bộ phận ${validDept} đều đang bận hoặc ngoài giờ làm việc. Vui lòng cung cấp địa chỉ Email của bạn để chúng tôi tạo Ticket hỗ trợ!`,
      });

      return {
        success: false,
        action: 'REQUEST_EMAIL_FOR_TICKET',
        message: 'Không có nhân viên online. Yêu cầu n8n xin email khách hàng.',
      };
    }

    // Nếu có người Online -> Chuyển OPEN
    conv.status = ConversationStatus.OPEN;
    conv.department_tag = validDept;

    // Khai báo an toàn cho thuộc tính Object lồng nhau
    if (!conv.context) {
      conv.context = {};
    }
    // Sử dụng hàm .set() của Mongoose để update trường lồng (nested field) an toàn, tránh lỗi ESLint
    conv.set('context.handoff_summary', summary);

    await conv.save();

    await this.msgModel.create({
      conversation_id: conv._id,
      sender_type: 'SYSTEM',
      content: `HỆ THỐNG: Yêu cầu hỗ trợ từ bộ phận ${validDept}. \n tóm tắt: ${summary}`,
    });

    return {
      success: true,
      action: 'TRANSFER_TO_AGENT',
      message: `Đã kết nối với bộ phận ${validDept}. Nhân viên sẽ phản hồi bạn trong giây lát.`,
    };
  }

  async markMessagesAsRead(conversationId: string, userType: 'USER' | 'AGENT') {
    // Nếu là USER xem, đánh dấu các tin của BOT/AGENT là đã đọc
    const senderToMatch =
      userType === 'USER' ? { $in: ['BOT', 'AGENT', 'SYSTEM'] } : 'USER';

    await this.msgModel
      .updateMany(
        {
          conversation_id: new Types.ObjectId(conversationId),
          sender_type: senderToMatch,
          is_read: false,
        },
        { $set: { is_read: true } },
      )
      .exec();

    return { success: true };
  }

  // AC8: Implement hàm lấy tin nhắn
  async getMessagesBySession(sessionId: string) {
    const conv = await this.convModel.findOne({ session_id: sessionId }).exec();
    if (!conv) return [];
    return this.msgModel
      .find({ conversation_id: conv._id })
      .sort({ createdAt: 1 })
      .lean();
  }

  // AC13: Cập nhật đánh giá CSAT
  async updateCsat(convId: string, dto: { rating: number; comment?: string }) {
    return this.convModel.findByIdAndUpdate(
      convId,
      {
        csat: {
          rating: dto.rating,
          comment: dto.comment,
          rated_at: new Date(),
        },
        status: ConversationStatus.CLOSED, // Tự động đóng nếu khách đã đánh giá
        closed_at: new Date(),
      },
      { new: true },
    );
  }

  // BỔ SUNG: API Lấy danh sách tin nhắn bằng Conversation ID cho Admin (Portal CRM)
  async getMessagesByConvId(convId: string) {
    return this.msgModel
      .find({ conversation_id: new Types.ObjectId(convId) })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
  }

  // BỔ SUNG: API để Nhân viên tự đóng phiên chat
  async closeConversation(conversationId: string) {
    return this.convModel
      .findByIdAndUpdate(
        conversationId,
        {
          status: ConversationStatus.CLOSED,
          closed_at: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  // TỰ ĐỘNG ĐÓNG HỘI THOẠI QUÁ 24 GIỜ (Phá luồng chết)
  @Cron(CronExpression.EVERY_HOUR) // Chạy quét mỗi giờ 1 lần
  async autoCloseIdleConversations() {
    // Thời điểm 24 giờ trước
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Tìm tất cả hội thoại đang OPEN (kể cả Waitlist hoặc Ongoing) mà updatedAt đã quá 24h
    const idleConversations = await this.convModel.find({
      status: 'OPEN',
      updatedAt: { $lte: twentyFourHoursAgo },
    });

    if (idleConversations.length === 0) return;

    const convIds = idleConversations.map((c) => c._id);

    // 1. Cập nhật đồng loạt trạng thái thành CLOSED
    await this.convModel.updateMany(
      { _id: { $in: convIds } },
      {
        $set: {
          status: ConversationStatus.CLOSED,
          closed_at: new Date(),
        },
      },
    );

    // 2. Gửi một tin nhắn báo cho khách hàng biết phiên chat đã đóng
    const systemMessages = convIds.map((id) => ({
      conversation_id: id,
      sender_type: 'SYSTEM',
      content:
        'Phiên tư vấn đã tự động đóng do quá thời gian. Bạn hãy bắt đầu đoạn chat mới để Bot hoặc nhân viên tiếp tục hỗ trợ nhé.',
      message_type: 'TEXT',
    }));

    await this.msgModel.insertMany(systemMessages);

    this.logger.log(
      `[Auto-Close] Đã đóng ${idleConversations.length} hội thoại treo quá 24h.`,
    );
  }
}
