// src/modules/users/customers/admin-customer.service.ts
import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Address, Customer, CustomerDocument } from './schemas/customer.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import {
  AuditLog,
  AuditLogDocument,
} from 'src/modules/system/audit-logs/schemas/audit-log.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { EmailService } from '../../notifications/channels/email.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { Department } from 'src/common/enums/department.enum';
import { AdminCreateCustomerDto } from './dto/admin-create-customer.dto';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { AdminUpdateCustomerDto } from './dto/admin-update-customer.dto';
import { ReviewStatus } from 'src/common/enums/review.enum';
import {
  Review,
  ReviewDocument,
} from 'src/modules/products/reviews/schemas/review.schema';

export interface ILeanAuditLog {
  _id: Types.ObjectId;
  createdAt: Date;
  action: string;
  ip?: string;
  user_agent?: string;
  is_success: boolean;
}

export interface ILeanCustomer {
  _id: Types.ObjectId;
  createdAt: Date;
  first_Name: string;
  last_Name: string;
  email: string;
  phone: string;
  status: string;
  gender?: string;
  loyalty?: {
    tier: string;
    total_spent: number;
    point: number;
  };
  addresses?: {
    street: string;
    ward_code: string;
    district_code: string;
    city_code: string;
    is_default: boolean;
  }[];
}

export interface ICustomerQuery {
  page?: number | string;
  limit?: number | string;
  keyword?: string;
  status?: UserStatus;
  tier?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface MongoError {
  code: number;
  keyPattern?: Record<string, number>;
}

@Injectable()
export class CustomersAdminService {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
  ) {}

  // US.113 - AC1 -> AC6: Tìm kiếm, Lọc, Phân trang danh sách khách hàng
  async findAll(query: ICustomerQuery) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;
    const {
      keyword,
      status,
      tier,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: FilterQuery<CustomerDocument> = { type: 'Customer' };
    if (status === UserStatus.DELETED) {
      // Nếu bộ lọc trên UI chọn là "Deleted" -> Chỉ lấy những người đã xóa
      filter.is_deleted = true;
      filter.status = status;
    } else {
      // Mặc định: Luôn ẩn những người đã xóa mềm
      filter.is_deleted = { $ne: true };

      // Nếu có filter status khác (ACTIVE, INACTIVE...) thì thêm vào
      if (status) filter.status = status;
    }
    if (tier) filter['loyalty.tier'] = tier;
    if (keyword) {
      const searchRegex = { $regex: keyword, $options: 'i' };
      filter.$or = [
        { first_Name: searchRegex },
        { last_Name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const direction = sortOrder === 'desc' ? -1 : 1;
    const [data, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .sort({ [sortBy]: direction })
        .skip(skip)
        .limit(limit)
        .lean<ILeanCustomer[]>()
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // US.117 - AC1, AC3: Thêm mới thủ công hồ sơ khách hàng
  async createCustomer(dto: AdminCreateCustomerDto, actorId: string) {
    const generatedUsername =
      dto.username ||
      `${dto.email.split('@')[0]}_${Date.now().toString().slice(-4)}`;
    // Kiểm tra duy nhất chủ động
    const exist = await this.customerModel.findOne({
      $or: [
        { email: dto.email },
        { phone: dto.phone },
        { username: generatedUsername },
      ],
    });

    if (exist) {
      throw new ConflictException(
        'Email, Số điện thoại hoặc Tên đăng nhập đã tồn tại',
      );
    }

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(dto.tempPassword, salt);

      const newCustomer = await this.customerModel.create({
        username: generatedUsername,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        first_Name: dto.firstName,
        last_Name: dto.lastName,
        type: 'Customer',
        status: UserStatus.ACTIVE,
        roles: ['CUSTOMER'],
      });

      // Sử dụng actorId trong hàm ghi log để thỏa mãn AC8 (Audit Log)
      await this.auditLogsService.log({
        action: 'ADMIN_CREATE_CUSTOMER',
        collection_name: 'customers',
        actor_id: actorId,
        target_id: newCustomer._id.toString(),
        department: Department.SUPPORT,
        detail: { email: dto.email, phone: dto.phone, username: dto.username },
      });

      return newCustomer;
    } catch (error: unknown) {
      const mongoError = error as MongoError;

      if (mongoError && mongoError.code === 11000) {
        // Phân tích xem trùng trường nào
        const keyPattern = mongoError.keyPattern || {};
        const field = Object.keys(keyPattern)[0]; // Trình biên dịch giờ đã biết keyPattern là object

        const message =
          field === 'phone'
            ? 'Số điện thoại này đã tồn tại trên hệ thống.'
            : field === 'email'
              ? 'Email này đã được sử dụng.'
              : 'Tên đăng nhập đã tồn tại.';

        throw new ConflictException(message);
      }

      throw error;
    }
  }

  // US.120 - AC1 -> AC4: Cập nhật trạng thái & Force Logout
  async updateStatus(
    customerId: string,
    targetStatus: UserStatus,
    reason: string,
    actor: { id: string; email: string; roles: string[] }, // Thêm roles vào actor
  ) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    if (
      customer.roles.includes('ADMIN') ||
      customer.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Không thể thao tác trên tài khoản quản trị',
      );
    }

    // Bổ sung: Phân quyền - Chỉ Admin mới được SUSPENDED
    if (targetStatus.toString() === 'SUSPENDED') {
      if (
        !actor.roles.includes('SUPER_ADMIN') &&
        !actor.roles.includes('ADMIN')
      ) {
        throw new ForbiddenException(
          'Chỉ Quản trị viên (Admin) mới có quyền Đình chỉ vĩnh viễn tài khoản.',
        );
      }
    }

    // Bổ sung: Chặn Khóa/Đình chỉ nếu có đơn hàng đang hoạt động
    if (
      targetStatus === UserStatus.INACTIVE ||
      targetStatus.toString() === 'SUSPENDED'
    ) {
      const hasActiveOrders = await this.orderModel.findOne({
        user_id: new Types.ObjectId(customerId),
        status: { $in: ['PENDING', 'PROCESSING', 'DELIVERING'] },
      });
      if (hasActiveOrders) {
        throw new BadRequestException(
          'Không thể khóa tài khoản đang có đơn hàng chờ xử lý hoặc vận chuyển.',
        );
      }
    }

    const oldStatus = customer.status;
    customer.status = targetStatus;
    customer.status_reason = reason;

    if (
      targetStatus === UserStatus.INACTIVE ||
      targetStatus.toString() === 'SUSPENDED'
    ) {
      customer.token_version += 1;
    }

    await customer.save();

    await this.emailService.sendRaw(
      customer.email,
      '[H&N Odyssey] Thông báo thay đổi trạng thái tài khoản',
      `<p>Trạng thái mới: <b>${targetStatus}</b>. Lý do: ${reason}</p>`,
    );

    await this.auditLogsService.log({
      action: `CHANGE_STATUS_${targetStatus}`,
      collection_name: 'customers',
      actor_id: actor.id,
      target_id: customerId,
      department: Department.SUPPORT,
      detail: { oldStatus, newStatus: targetStatus, reason },
    });

    return { message: 'Cập nhật trạng thái thành công' };
  }

  // US.120 - AC5, AC8, AC9: Quản lý quyền đánh giá
  async toggleReviewAccess(
    customerId: string,
    access: 'ALLOWED' | 'RESTRICTED',
    reason: string,
    actor: { id: string; email: string },
  ) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    const oldAccess = customer.review_access;
    customer.review_access = access;
    customer.status_reason = reason;
    await customer.save();

    // AC8: Gửi thông báo tự động cho khách hàng
    await this.emailService.sendRaw(
      customer.email,
      '[H&N Odyssey] Thông báo thay đổi quyền hạn tài khoản',
      `<p>Quyền đánh giá sản phẩm của tài khoản này đã được thay đổi thành: <b>${access === 'ALLOWED' ? 'Cho phép (Allowed)' : 'Hạn chế (Restricted)'}</b>.</p>
       <p>Lý do: ${reason}</p>
       <p>Vui lòng liên hệ bộ phận hỗ trợ nếu bạn có thắc mắc.</p>`,
    );

    // AC9: Ghi nhật ký hệ thống (Audit Log)
    await this.auditLogsService.log({
      action: `CHANGE_REVIEW_ACCESS_${access}`,
      collection_name: 'customers',
      actor_id: actor.id,
      target_id: customerId,
      department: Department.SUPPORT,
      detail: { from: oldAccess, to: access, reason },
    });

    return { message: `Đã cập nhật quyền đánh giá thành: ${access}` };
  }

  // US.117 - AC6: Xóa vĩnh viễn (Hard delete)
  async hardDelete(customerId: string, actorId: string) {
    const hasActiveOrders = await this.orderModel.findOne({
      user_id: new Types.ObjectId(customerId),
      status: { $nin: ['COMPLETED', 'CANCELED'] },
    });

    if (hasActiveOrders) {
      throw new BadRequestException(
        'Không thể xóa khách hàng đang có đơn hàng chưa hoàn tất',
      );
    }

    await this.customerModel.deleteOne({ _id: customerId });

    await this.auditLogsService.log({
      action: 'ADMIN_HARD_DELETE_CUSTOMER',
      collection_name: 'customers',
      actor_id: actorId,
      target_id: customerId,
      department: Department.MANAGEMENT,
      detail: { message: 'Xóa vĩnh viễn hồ sơ pháp lý' },
    });

    return { message: 'Đã xóa hoàn toàn dữ liệu khách hàng' };
  }

  async softDelete(customerId: string, reason: string, actorId: string) {
    const hasActiveOrders = await this.orderModel.findOne({
      user_id: new Types.ObjectId(customerId),
      status: { $in: ['PENDING', 'PROCESSING', 'DELIVERING'] }, // Chặn thao tác nếu đơn đang chạy
    });

    if (hasActiveOrders) {
      throw new BadRequestException(
        'Không thể xóa khách hàng đang có đơn hàng Đang hoạt động',
      );
    }

    // CHỈ đổi trạng thái thành INACTIVE và ép đăng xuất, TUYỆT ĐỐI KHÔNG xóa Tên/Email/SĐT
    const updatedCustomer = await this.customerModel.findByIdAndUpdate(
      customerId,
      {
        $set: {
          status: UserStatus.DELETED, // Đổi từ INACTIVE -> DELETED
          is_active: false,
          is_deleted: true, // Bật cờ xóa mềm
        },
        $inc: {
          token_version: 1,
        },
      },
      { new: true },
    );

    if (!updatedCustomer)
      throw new NotFoundException('Khách hàng không tồn tại');

    // Ghi log hệ thống
    await this.auditLogsService.log({
      action: Action.DELETE,
      collection_name: 'customers',
      actor_id: actorId,
      target_id: customerId,
      department: Department.MANAGEMENT,
      detail: {
        message: 'Đã vô hiệu hóa tài khoản (Khóa mềm)',
        reason: reason || 'Không có lý do', // <-- Thêm lý do vào log
      },
    });

    return { message: 'Đã vô hiệu hóa tài khoản khách hàng thành công' };
  }

  // US.117 - AC2: Chỉnh sửa thông tin liên hệ/hồ sơ khách hàng
  async updateCustomer(
    customerId: string,
    dto: AdminUpdateCustomerDto,
    actorId: string,
  ) {
    const hasActiveOrders = await this.orderModel.findOne({
      user_id: new Types.ObjectId(customerId),
      status: { $in: ['PENDING', 'PROCESSING', 'DELIVERING'] },
    });
    if (hasActiveOrders) {
      throw new BadRequestException(
        'Không thể sửa hồ sơ khi khách hàng đang có đơn hàng chờ xử lý.',
      );
    }

    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    // Kiểm tra trùng SĐT nếu có thay đổi
    if (dto.phone && dto.phone !== customer.phone) {
      const exist = await this.customerModel.findOne({ phone: dto.phone });
      if (exist) throw new ConflictException('Số điện thoại đã được sử dụng');
    }

    const oldData = { ...customer.toObject() };

    if (dto.first_Name) customer.first_Name = dto.first_Name;
    if (dto.last_Name) customer.last_Name = dto.last_Name;
    if (dto.email) customer.email = dto.email;
    if (dto.username) customer.username = dto.username;
    if (dto.phone) customer.phone = dto.phone;
    if (dto.gender) customer.gender = dto.gender;
    if (dto.internal_note !== undefined)
      customer.internal_note = dto.internal_note;
    if (dto.addresses) {
      customer.addresses = dto.addresses.map((addr) => ({
        name: addr.name,
        phone: addr.phone,
        street: addr.street,
        city_code: addr.city_code,
        district_code: addr.district_code,
        ward_code: addr.ward_code,
        is_default: addr.is_default ?? false,
      })) as unknown as Address[];
    }
    if (dto.loyaltyTier) {
      customer.loyalty = {
        ...customer.loyalty,
        tier: dto.loyaltyTier,
      };
    }

    await customer.save();

    await this.auditLogsService.log({
      action: Action.UPDATE,
      collection_name: Resource.CUSTOMERS,
      actor_id: actorId,
      target_id: customerId,
      department: Department.SUPPORT,
      detail: { old: oldData, new: dto },
    });

    return { success: true, data: customer };
  }

  // US.118 - AC6: Cập nhật trạng thái xử lý (Mới -> Đang xử lý -> Đã giải quyết)
  async updateProcessingStatus(
    reviewId: string,
    status: ReviewStatus,
    adminId: string,
  ) {
    const review = await this.reviewModel.findById(reviewId);
    if (!review) throw new NotFoundException('Đánh giá không tồn tại');

    const oldStatus = review.status;
    review.status = status;
    await review.save();

    await this.auditLogsService.log({
      action: 'UPDATE_REVIEW_STATUS',
      collection_name: Resource.REVIEWS,
      actor_id: adminId,
      target_id: reviewId,
      department: Department.SUPPORT,
      detail: { from: oldStatus, to: status },
    });

    return { success: true, current_status: status };
  }

  // US.119 - AC1, AC2, AC7: Theo dõi lịch sử hoạt động
  async getCustomerActivities(
    customerId: string,
    query: {
      page?: number;
      limit?: number;
      from_date?: string;
      to_date?: string;
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<AuditLogDocument> = {
      actor_id: new Types.ObjectId(customerId),
    };

    if (query.from_date || query.to_date) {
      const dateFilter: Record<string, Date> = {};
      if (query.from_date) dateFilter['$gte'] = new Date(query.from_date);
      if (query.to_date) dateFilter['$lte'] = new Date(query.to_date);
      filter.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ILeanAuditLog[]>()
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    const data = logs.map((log) => ({
      time: log.createdAt,
      action: log.action,
      ip: log.ip,
      device: this.parseUserAgent(log.user_agent || ''),
      status: log.is_success ? 'Thành công' : 'Thất bại',
    }));

    return { data, meta: { total, page, limit } };
  }

  private parseUserAgent(ua: string): string {
    if (!ua || ua.trim() === '') return 'Không xác định';

    // Máy tính (Desktop/Laptop)
    if (ua.includes('Windows')) return 'Máy tính (Windows)';
    if (ua.includes('Macintosh') || ua.includes('Mac OS'))
      return 'Máy tính (macOS)';
    if (ua.includes('Linux') && !ua.includes('Android'))
      return 'Máy tính (Linux)';

    // Thiết bị di động (Mobile/Tablet)
    if (ua.includes('iPhone')) return 'Điện thoại (iOS)';
    if (ua.includes('iPad')) return 'Máy tính bảng (iPad)';
    if (ua.includes('Android')) return 'Điện thoại/Tablet (Android)';
    if (ua.includes('Postman')) return 'Postman Client';
    if (ua.includes('axios')) return 'Hệ thống gọi ngầm (Axios)';
    if (ua.includes('insomnia')) return 'Insomnia Client';

    if (ua.length > 30) {
      return ua.substring(0, 30) + '...';
    }

    return ua || 'Thiết bị khác';
  }

  // US.119 - AC6: Xuất báo cáo lịch sử hoạt động (Bản nâng cấp Tuyệt đối)
  async exportActivitiesToExcel(
    customerId: string,
    res: Response,
  ): Promise<void> {
    // 1. Tối ưu: Lấy cả thông tin Khách hàng và Lịch sử hoạt động chạy song song
    const [customer, logs] = await Promise.all([
      this.customerModel
        .findById(customerId)
        .select('first_Name last_Name phone email')
        .lean()
        .exec(),
      this.auditLogModel
        .find({ actor_id: new Types.ObjectId(customerId) })
        .sort({ createdAt: -1 })
        .lean<ILeanAuditLog[]>()
        .exec(),
    ]);

    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng để xuất báo cáo');
    }

    // Xử lý chuỗi thông tin khách hàng cho đẹp
    const customerName =
      `${customer.last_Name || ''} ${customer.first_Name || ''}`.trim() ||
      'Chưa cập nhật';
    const customerInfo = `${customerName} - SĐT: ${customer.phone || 'Chưa có'}`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lịch sử hoạt động', {
      views: [{ state: 'frozen', ySplit: 5 }], // Đóng băng 5 dòng đầu khi cuộn
    });

    // 2. TẠO TIÊU ĐỀ LỚN (Dòng 1, 2, 3)
    worksheet.mergeCells('A1:E1');
    worksheet.mergeCells('A2:E2');
    worksheet.mergeCells('A3:E3');

    // Dòng 1: Tiêu đề chính
    const titleRow = worksheet.getRow(1);
    titleRow.height = 35;
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BÁO CÁO LỊCH SỬ HOẠT ĐỘNG KHÁCH HÀNG';
    titleCell.font = {
      name: 'Arial',
      size: 15,
      bold: true,
      color: { argb: 'FF004E82' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Dòng 2: Hiển thị ĐỊNH DANH Khách hàng rõ ràng
    const infoRow = worksheet.getRow(2);
    infoRow.height = 25;
    const infoCell = worksheet.getCell('A2');
    infoCell.value = `Khách hàng: ${customerInfo} | Email: ${customer.email || 'Chưa có'}`;
    infoCell.font = { size: 12, bold: true, color: { argb: 'FF333333' } }; // Chữ đậm, màu xám đen
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Dòng 3: Thông tin xuất file
    const subTitleRow = worksheet.getRow(3);
    subTitleRow.height = 25;
    const subTitleCell = worksheet.getCell('A3');
    subTitleCell.value = `Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Tổng số: ${logs.length} thao tác được ghi nhận`;
    subTitleCell.font = { italic: true, color: { argb: 'FF666666' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Dòng 4: Khoảng trắng tạo độ thoáng trước khi vào bảng
    worksheet.getRow(4).height = 10;

    // 3. ĐỊNH NGHĨA CỘT VÀ HEADER (Dòng 5)
    worksheet.columns = [
      { key: 'time', width: 22 },
      { key: 'action', width: 35 },
      { key: 'ip', width: 20 },
      { key: 'device', width: 40 },
      { key: 'status', width: 18 },
    ];

    worksheet.getRow(5).values = [
      'Thời gian',
      'Hành động',
      'Địa chỉ IP',
      'Thiết bị / Trình duyệt',
      'Kết quả',
    ];

    // 4. TRANG TRÍ HEADER BẢNG
    const headerRow = worksheet.getRow(5);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' },
      }; // Nền xanh dương đậm
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Chữ trắng
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 5. ĐỔ DỮ LIỆU & FORMAT TỪNG DÒNG
    logs.forEach((log) => {
      const row = worksheet.addRow({
        time: new Date(log.createdAt).toLocaleString('vi-VN'),
        action: log.action.replace(/_/g, ' '), // Chuyển LOGIN_SUCCESS thành LOGIN SUCCESS
        ip: log.ip || 'N/A',
        device: this.parseUserAgent(log.user_agent || ''),
        status: log.is_success ? 'Thành công' : 'Thất bại',
      });

      // Kẻ khung và căn lề cho từng ô dữ liệu
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };

        // Căn giữa cho cột Thời gian(1), IP(3), Kết quả(5)
        if ([1, 3, 5].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          // Hành động(2) và Thiết bị(4) căn trái cho dễ đọc
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Tô màu nhấn mạnh cho cột Trạng thái
      const statusCell = row.getCell('status');
      if (log.is_success) {
        statusCell.font = { color: { argb: 'FF00B050' }, bold: true }; // Màu xanh lá cây
      } else {
        statusCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Màu đỏ
      }
    });

    // 6. TRẢ FILE VỀ CHO CLIENT
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=activities_${customerId}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  // US.113 - AC9: Xuất Excel danh sách khách hàng (Bản nâng cấp Pro - Áp dụng bộ lọc)
  async exportToExcel(query: ICustomerQuery, res: Response): Promise<void> {
    // 1. Xử lý bộ lọc và phân trang từ Query (Giống hàm findAll)
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const {
      keyword,
      status,
      tier,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: FilterQuery<CustomerDocument> = { type: 'Customer' };

    if (status === UserStatus.DELETED) {
      filter.is_deleted = true;
      filter.status = status;
    } else {
      filter.is_deleted = { $ne: true };
      if (status) filter.status = status;
    }

    if (tier) filter['loyalty.tier'] = tier;

    if (keyword) {
      const searchRegex = { $regex: keyword, $options: 'i' };
      filter.$or = [
        { first_Name: searchRegex },
        { last_Name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const direction = sortOrder === 'desc' ? -1 : 1;

    // 2. Query Data theo đúng những gì đang hiển thị trên FE
    const customers = (await this.customerModel
      .find(filter)
      .sort({ [sortBy]: direction })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec()) as unknown as ILeanCustomer[];

    // Chặn xuất file nếu màn hình không có dữ liệu
    if (customers.length === 0) {
      throw new BadRequestException(
        'Không có dữ liệu khách hàng nào khớp với bộ lọc hiện tại để xuất.',
      );
    }

    // 3. Khởi tạo Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh Sách Khách Hàng', {
      views: [{ state: 'frozen', ySplit: 3 }], // Đóng băng 3 dòng đầu (Header) khi cuộn
    });

    // 4. TẠO TIÊU ĐỀ LỚN (Dòng 1 & Dòng 2)
    worksheet.mergeCells('A1:K1');
    worksheet.mergeCells('A2:K2');

    // Set giá trị và chiều cao cho dòng 1
    const titleRow = worksheet.getRow(1);
    titleRow.height = 40;
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP DANH SÁCH KHÁCH HÀNG';
    titleCell.font = {
      name: 'Arial',
      size: 16,
      bold: true,
      color: { argb: 'FF004E82' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Set giá trị và chiều cao cho dòng 2 (Sub-title hiển thị thêm Page hiện tại)
    const subTitleRow = worksheet.getRow(2);
    subTitleRow.height = 25;
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = `Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')} | Trang: ${page} | Số lượng xuất: ${customers.length} khách hàng`;
    subTitleCell.font = { italic: true, color: { argb: 'FF666666' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Thêm một dòng trống ở dòng 3 để tạo khoảng cách giữa Tiêu đề và Bảng data cho đẹp
    worksheet.getRow(3).height = 10;

    // 5. ĐỊNH NGHĨA CỘT VÀ HEADER (Dòng 4)
    worksheet.columns = [
      { key: 'stt', width: 6 },
      { key: 'name', width: 25 },
      { key: 'phone', width: 15 },
      { key: 'email', width: 30 },
      { key: 'gender', width: 12 },
      { key: 'loyalty_tier', width: 15 },
      { key: 'total_spent', width: 20 },
      { key: 'point', width: 12 },
      { key: 'address', width: 45 },
      { key: 'createdAt', width: 15 },
      { key: 'status', width: 15 },
    ];

    worksheet.getRow(4).values = [
      'STT',
      'Họ và tên',
      'Số điện thoại',
      'Email',
      'Giới tính',
      'Hạng TV',
      'Tổng chi tiêu',
      'Điểm TL',
      'Địa chỉ mặc định',
      'Ngày đăng ký',
      'Trạng thái',
    ];

    // 6. TRANG TRÍ HEADER
    const headerRow = worksheet.getRow(4);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 7. ĐỔ DỮ LIỆU & FORMAT TỪNG DÒNG
    customers.forEach((c: ILeanCustomer, index: number) => {
      const defaultAddr =
        c.addresses?.find((a) => a.is_default) || c.addresses?.[0];
      const addrStr = defaultAddr
        ? `${defaultAddr.street}, ${defaultAddr.ward_code}, ${defaultAddr.district_code}, ${defaultAddr.city_code}`
        : 'Chưa cập nhật';

      // Việt hóa dữ liệu ENUM
      const statusStr =
        c.status === 'ACTIVE'
          ? 'Hoạt động'
          : c.status === 'INACTIVE'
            ? 'Đã khóa'
            : c.status === 'DELETED'
              ? 'Đã xóa'
              : 'Cấm';

      const genderStr =
        c.gender === 'MALE' ? 'Nam' : c.gender === 'FEMALE' ? 'Nữ' : 'Khác';

      const row = worksheet.addRow({
        stt: index + 1, // STT bắt đầu lại từ 1 cho trang xuất ra
        name: `${c.last_Name || ''} ${c.first_Name || ''}`.trim(),
        phone: c.phone || 'Chưa có',
        email: c.email || 'Chưa có',
        gender: genderStr,
        loyalty_tier: c.loyalty?.tier || 'SILVER',
        total_spent: c.loyalty?.total_spent || 0,
        point: c.loyalty?.point || 0,
        address: addrStr,
        createdAt: c.createdAt
          ? new Date(c.createdAt).toLocaleDateString('vi-VN')
          : '',
        status: statusStr,
      });

      // Kẻ khung cho toàn bộ cell trong dòng
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if ([1, 3, 5, 6, 8, 10, 11].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Format Tiền tệ (Tổng chi tiêu)
      row.getCell('total_spent').numFmt = '#,##0" ₫"';
      row.getCell('total_spent').alignment = {
        vertical: 'middle',
        horizontal: 'right',
      };

      // Bôi đỏ trạng thái bất thường
      if (
        c.status === 'INACTIVE' ||
        c.status === 'SUSPENDED' ||
        c.status === 'DELETED'
      ) {
        row.getCell('status').font = {
          color: { argb: 'FFFF0000' },
          bold: true,
        };
      }
    });

    // 8. TRẢ FILE VỀ CHO CLIENT
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bao_cao_khach_hang.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  async getCustomerDetail(customerId: string) {
    const customer = await this.customerModel
      .findById(customerId)
      .select('-password') // Loại bỏ trường password ngay từ lúc query DB
      .lean()
      .exec();

    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    return customer;
  }

  // Cập nhật trạng thái hàng loạt (Bulk Status)
  async bulkUpdateStatus(
    customerIds: string[],
    targetStatus: UserStatus,
    reason: string,
    actor: { id: string; email: string; roles: string[] },
  ) {
    if (
      targetStatus.toString() === 'SUSPENDED' &&
      !actor.roles.includes('SUPER_ADMIN') &&
      !actor.roles.includes('ADMIN')
    ) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên mới có quyền Đình chỉ tài khoản hàng loạt.',
      );
    }

    const objectIds = customerIds.map((id) => new Types.ObjectId(id));

    // Lọc ra những khách hàng đang có đơn hàng để KHÔNG khóa
    let unprocessableIds: Types.ObjectId[] = [];
    if (
      targetStatus === UserStatus.INACTIVE ||
      targetStatus.toString() === 'SUSPENDED'
    ) {
      const activeOrders = await this.orderModel
        .find({
          user_id: { $in: objectIds },
          status: { $in: ['PENDING', 'PROCESSING', 'DELIVERING'] },
        })
        .select('user_id')
        .lean()
        .exec();

      unprocessableIds = activeOrders.map(
        (order) => order.user_id as unknown as Types.ObjectId,
      );
    }

    // Danh sách ID an toàn có thể cập nhật
    const safeIds = objectIds.filter(
      (id) => !unprocessableIds.some((unprocId) => unprocId.equals(id)),
    );

    if (safeIds.length === 0) {
      throw new BadRequestException(
        'Không thể thực hiện. Tất cả tài khoản chọn đều đang có đơn hàng hoạt động.',
      );
    }

    const updatePayload: Record<string, unknown> = {
      $set: { status: targetStatus, status_reason: reason },
    };

    if (
      targetStatus === UserStatus.INACTIVE ||
      targetStatus.toString() === 'SUSPENDED'
    ) {
      updatePayload.$inc = { token_version: 1 }; // Force logout
    }

    await this.customerModel.updateMany(
      { _id: { $in: safeIds } },
      updatePayload,
    );

    // Ghi log Bulk
    await this.auditLogsService.log({
      action: `BULK_CHANGE_STATUS_${targetStatus}`,
      collection_name: 'customers',
      actor_id: actor.id,
      target_id: 'BULK_ACTION',
      department: Department.SUPPORT,
      detail: { count: safeIds.length, targetStatus, reason },
    });

    return {
      message: `Đã cập nhật trạng thái cho ${safeIds.length} tài khoản thành công.`,
      skipped: unprocessableIds.length,
    };
  }

  // Xóa mềm hàng loạt (Bulk Soft Delete)
  async bulkSoftDelete(customerIds: string[], actorId: string, reason: string) {
    const objectIds = customerIds.map((id) => new Types.ObjectId(id));

    const activeOrders = await this.orderModel
      .find({
        user_id: { $in: objectIds },
        status: { $in: ['PENDING', 'PROCESSING', 'DELIVERING'] },
      })
      .select('user_id')
      .lean()
      .exec();

    const unprocessableIds = activeOrders.map(
      (order) => order.user_id as unknown as Types.ObjectId,
    );
    const safeIds = objectIds.filter(
      (id) => !unprocessableIds.some((unprocId) => unprocId.equals(id)),
    );

    if (safeIds.length === 0) {
      throw new BadRequestException(
        'Không thể xóa. Tất cả tài khoản chọn đều đang có đơn hàng hoạt động.',
      );
    }

    await this.customerModel.updateMany(
      { _id: { $in: safeIds } },
      {
        $set: {
          status: UserStatus.DELETED, // Đổi từ INACTIVE -> DELETED
          is_active: false,
          is_deleted: true, // Bật cờ xóa mềm
        },
        $inc: { token_version: 1 },
      },
    );

    await this.auditLogsService.log({
      action: 'BULK_SOFT_DELETE',
      collection_name: 'customers',
      actor_id: actorId,
      target_id: 'BULK_ACTION',
      department: Department.MANAGEMENT,
      detail: {
        count: safeIds.length,
        message: 'Đã vô hiệu hóa tài khoản hàng loạt',
        reason: reason || 'Không có lý do',
      },
    });

    return {
      message: `Đã vô hiệu hóa ${safeIds.length} tài khoản thành công.`,
      skipped: unprocessableIds.length,
    };
  }

  // US.117: Staff chủ động đặt password mới và gửi qua email khách
  async updatePasswordByAdmin(
    customerId: string,
    newPassword: string,
    actor: { id: string; email: string },
  ) {
    const customer = await this.customerModel.findById(customerId);
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

    const salt = await bcrypt.genSalt(10);
    customer.password = await bcrypt.hash(newPassword, salt);
    // Invalidate tất cả session cũ (bảo mật)
    customer.token_version += 1;
    await customer.save();

    // Gửi email đến địa chỉ email MỚI NHẤT của khách (đã được cập nhật trước đó trong cùng request)
    await this.emailService.sendRaw(
      customer.email,
      '[H&N Odyssey] Mật khẩu tài khoản đã được cập nhật',
      `<p>Xin chào <b>${customer.first_Name} ${customer.last_Name}</b>,</p>
     <p>Mật khẩu tài khoản của bạn vừa được cập nhật bởi bộ phận hỗ trợ.</p>
     <p>Mật khẩu mới: <b>${newPassword}</b></p>
     <p>Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.</p>
     <p>Nếu bạn không yêu cầu thao tác này, hãy liên hệ ngay với chúng tôi.</p>`,
    );

    await this.auditLogsService.log({
      action: 'ADMIN_SET_PASSWORD',
      collection_name: 'customers',
      actor_id: actor.id,
      target_id: customerId,
      department: Department.SUPPORT,
      detail: {
        message: 'Admin đặt mật khẩu mới cho khách, đã gửi email thông báo',
      },
    });

    return {
      message: 'Đã cập nhật mật khẩu và gửi email thông báo cho khách.',
    };
  }
}
