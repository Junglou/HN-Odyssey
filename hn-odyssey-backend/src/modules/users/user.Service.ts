import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmailOrPhone(account: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      $or: [{ email: account }, { phone: account }],
    });
  }

  // CHỈ dùng cho luồng đăng nhập: lấy kèm hash password để so sánh
  async findByEmailOrPhoneWithPassword(
    account: string,
  ): Promise<UserDocument | null> {
    // Truyền '+password' qua tham số projection để giữ đúng kiểu trả về
    return this.userModel
      .findOne(
        {
          $or: [{ email: account }, { phone: account }],
        },
        '+password',
      )
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async increaseFailedAttempt(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      $inc: { login_attempts: 1 },
    });
  }

  async resetFailedAttempt(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      login_attempts: 0,
    });
  }

  async updateStatus(
    userId: string,
    updateData: { is_active: boolean; lock_reason?: string },
  ) {
    // Nếu dùng Mongoose
    return this.userModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true })
      .exec();
  }
}
