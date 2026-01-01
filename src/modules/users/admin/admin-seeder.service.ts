import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User } from '../schemas/user.schema';
import { Staff } from './schemas/staff.schema';
import { Role as RoleEnum } from 'src/common/enums/role.enum'; // Import Role Enum
import { UserStatus } from 'src/common/enums/user-status.enum'; // Import Status Enum

@Injectable()
export class AdminSeederService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Staff.name) private readonly staffModel: Model<Staff>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Kiểm tra xem đã có Admin nào tồn tại chưa (dựa trên Role Enum)
    const adminCount = await this.userModel
      .countDocuments({
        roles: RoleEnum.SUPER_ADMIN,
      })
      .exec();

    if (adminCount === 0) {
      console.warn(
        '[SEEDER] Không tìm thấy Admin. Đang tạo Super Admin mặc định...',
      );

      // 1. Hash mật khẩu mặc định an toàn
      const hashedPassword = await this.hashPassword('SuperPassword@123');

      // 2. Tạo tài khoản Admin chuẩn format mới

      const superAdmin = new this.staffModel({
        email: 'super.admin@hnodyssey.com',
        password: hashedPassword,
        first_Name: 'Super Admin',
        last_Name: 'HN Odyssey',
        employee_code: 'EMP000000',
        department: 'vận hành',
        roles: [RoleEnum.SUPER_ADMIN],
        type: 'Staff',
        status: UserStatus.ACTIVE,
        token_version: 0,
        metadata: { createdBy: 'SYSTEM_SEEDER' },
      });

      await superAdmin.save();

      console.log(
        '=> [SEEDER] Tạo Admin gốc thành công: super.admin@hnodyssey.com | Pass: SuperPassword@123',
      );
    }
  }

  private async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
