import { Request, Response } from 'express';
import { departmentService } from '../services/department.service';

class DepartmentController {
  public async create(req: Request, res: Response): Promise<Response> {
    try {
      const department = await departmentService.createDepartment(req.body);
      return res.status(201).json(department);
    } catch (error) {
      return res.status(500).json({ message: 'Error creating department', error });
    }
  }

  public async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const departments = await departmentService.getAllDepartments();
      return res.status(200).json(departments);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching departments', error });
    }
  }

  public async getById(req: Request, res: Response): Promise<Response> {
    try {
      const department = await departmentService.getDepartmentById(req.params.id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      return res.status(200).json(department);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching department', error });
    }
  }

  public async update(req: Request, res: Response): Promise<Response> {
    try {
      const department = await departmentService.updateDepartment(req.params.id, req.body);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      return res.status(200).json(department);
    } catch (error) {
      return res.status(500).json({ message: 'Error updating department', error });
    }
  }

  public async delete(req: Request, res: Response): Promise<Response> {
    try {
      await departmentService.deleteDepartment(req.params.id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Error deleting department', error });
    }
  }
}

export const departmentController = new DepartmentController(); 