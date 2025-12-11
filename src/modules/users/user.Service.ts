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

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      refreshToken,
    });
  }

  async clearRefreshToken(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      refreshToken: null,
    });
  }

  async increaseFailedAttempt(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      $inc: { failedAttempts: 1 },
    });
  }

  async resetFailedAttempt(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, {
      failedAttempts: 0,
    });
  }
}
