export interface OAuthProfile {
  email: string;
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
}

export interface IVerificationRecord {
  account: string;
  code: string;
  expired_at: Date;
  linked_user_id?: {
    userId: string;
  };
  deleteOne: () => Promise<any>;
}
