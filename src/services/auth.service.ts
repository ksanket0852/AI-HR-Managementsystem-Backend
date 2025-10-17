import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { JWT_SECRET } from '../config/env.config';

class AuthService {
  public generateToken(user: User): string {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
  }

  public verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

export const authService = new AuthService(); 