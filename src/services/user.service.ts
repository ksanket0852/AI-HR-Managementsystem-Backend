import { PrismaClient, User, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";

class UserService {
  private prisma = new PrismaClient();

  public async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public async createUser(data: any): Promise<User> {
    const hashedPassword = await this.hashPassword(data.password);
    
    // Only use fields that exist in the User model
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: this.mapRole(data.role), // Map frontend role to Prisma UserRole enum
      },
    });
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Helper method to map frontend role strings to Prisma UserRole enum
  private mapRole(role: string): UserRole {
    switch (role.toLowerCase()) {
      case 'admin':
        return UserRole.SUPER_ADMIN;
      case 'hr_admin':
        return UserRole.HR_ADMIN;
      case 'hr_manager':
        return UserRole.HR_MANAGER;
      case 'manager':
        return UserRole.MANAGER;
      case 'employee':
      default:
        return UserRole.EMPLOYEE;
    }
  }
}

export const userService = new UserService();