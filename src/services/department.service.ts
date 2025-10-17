import { PrismaClient, Department } from '@prisma/client';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../types/department.dto';

class DepartmentService {
  private prisma = new PrismaClient();

  public async createDepartment(departmentData: CreateDepartmentDto): Promise<Department> {
    return this.prisma.department.create({
      data: departmentData,
    });
  }

  public async getAllDepartments() {
    return this.prisma.department.findMany({
      include: {
        head: true,
        employees: true,
      }
    });
  }

  public async getDepartmentById(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      include: {
        head: true,
        employees: true,
      }
    });
  }
 

  public async updateDepartment(id: string, departmentData: UpdateDepartmentDto): Promise<Department | null> {
    return this.prisma.department.update({
      where: { id },
      data: departmentData,
    });
  }

  public async deleteDepartment(id: string): Promise<Department | null> {
    // Before deleting, ensure no employees are assigned to this department.
    // This logic can be enhanced based on business rules.
    const department = await this.getDepartmentById(id);
    if (department && department.employees.length > 0) {
      throw new Error('Cannot delete department with assigned employees.');
    }
    
    return this.prisma.department.delete({
      where: { id },
    });
  }
}

export const departmentService = new DepartmentService(); 