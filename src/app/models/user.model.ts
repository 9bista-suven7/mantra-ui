export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  phone?: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  displayName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
}
