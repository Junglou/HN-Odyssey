import { Role } from '../enums/role.enum';

export interface IUser {
  _id: string;
  email: string;
  roles: Role[];
  fullName?: string;
  status?: string;
}

// Interface mở rộng cho Request Express
import { Request } from 'express';
export interface RequestWithUser extends Request {
  user: IUser;
}
