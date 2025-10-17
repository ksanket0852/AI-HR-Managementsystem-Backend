import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authService } from '../services/auth.service';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

class AuthController {
  private prisma = new PrismaClient();

  public async register(req: Request, res: Response): Promise<Response> {
    try {
      console.log('Register endpoint hit with body:', req.body);
      const { email, password, name, department, role } = req.body;
      
      if (!email || !password) {
        console.error('Missing required fields:', { email: !!email, password: !!password });
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const existingUser = await userService.findUserByEmail(email);
      if (existingUser) {
        console.log('User already exists:', email);
        return res.status(400).json({ message: 'User already exists' });
      }
      
      console.log('Creating new user with data:', { ...req.body, password: '[REDACTED]' });
      
      // Create user first
      const user = await userService.createUser(req.body);
      console.log('User created successfully:', user.id);
      
      // Generate a unique employee ID
      const employeeId = `EMP${Date.now().toString().slice(-6)}`;
      
      // Create employee record with user ID
      if (name) {
        try {
          // Split name into firstName and lastName
          const nameParts = name.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
          
          // Create employee record
          const employee = await this.prisma.employee.create({
            data: {
              employeeId,
              userId: user.id,
              firstName,
              lastName,
              email: user.email,
              departmentId: await this.getOrCreateDepartment(department || 'General'),
              designation: role === 'manager' ? 'Manager' : 'Employee',
              dateOfJoining: new Date(),
            },
          });
          
          console.log('Employee record created:', employee.id);
        } catch (empError: any) {
          console.error('Error creating employee record:', empError);
          // Continue with user creation even if employee record fails
        }
      }
      
      const token = authService.generateToken(user);
      return res.status(201).json({ user, token });
    } catch (error: any) {
      console.error('Error in register controller:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }

  public async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const user = await userService.findUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      const token = authService.generateToken(user);
      return res.status(200).json({ user, token });
    } catch (error: any) {
      console.error('Error in login controller:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }

  // Helper method to get or create a department
  private async getOrCreateDepartment(departmentName: string): Promise<string> {
    try {
      // Try to find department first
      const existingDept = await this.prisma.department.findFirst({
        where: { name: departmentName }
      });
      
      if (existingDept) {
        return existingDept.id;
      }
      
      // Create department if it doesn't exist
      const newDept = await this.prisma.department.create({
        data: {
          name: departmentName,
          description: `${departmentName} Department`
        }
      });
      
      return newDept.id;
    } catch (error: any) {
      console.error('Error getting/creating department:', error);
      throw new Error('Failed to process department');
    }
  }
}

export const authController = new AuthController(); 