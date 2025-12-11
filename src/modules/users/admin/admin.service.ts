import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateStaffDto } from '../admin/dto/create-staff.dto';
import { User } from '../schemas/user.schema';
import { Staff } from './schemas/staff.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Staff.name) private readonly staffModel: Model<Staff>,
  ) {}
  async createStaff(dto: CreateStaffDto, createdById: string) {
    // 1. Kiểm tra tài khoản đã tồn tại chưa
    const existUser = await this.userModel.findOne({ email: dto.email });
    if (existUser) throw new ConflictException('Email đã tồn tại.');

    // 2. Hash mật khẩu (Giống hệt hàm register)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // 3. Tạo Staff mới
    // LƯU Ý: Phải dùng staffModel để tạo (vì nó là Discriminator)
    const newStaff = new this.staffModel({
      employee_code: dto.employeeCode, // Trường riêng của Staff
      email: dto.email,
      full_name: dto.fullName,
      password: hashedPassword,

      // Vai trò được quyết định bởi Admin
      roles: dto.roles, // Ví dụ: ['STAFF', 'ADMIN']
      type: 'Staff', // Bắt buộc phải có để Mongoose biết đây là loại Staff
      is_active: true,

      // Ghi Audit Log (Ai là người tạo)
      metadata: { createdBy: createdById },
    });
    await newStaff.save();

    return { message: 'Tạo tài khoản Staff thành công.' };
  }
}
