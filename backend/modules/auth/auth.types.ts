export type UserRole = 'customer' | 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  is_email_verified: boolean;
  verification_token?: string;
  reset_password_token?: string;
  reset_password_expires?: Date;
  created_at: Date;
}

export interface RegisterDTO {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole | 'user';
  /** When admin creates an owner and wants immediate approval */
  auto_approve?: boolean;
}

export interface LoginResponse {
  token?: string;
  pending?: boolean;
  message?: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}
