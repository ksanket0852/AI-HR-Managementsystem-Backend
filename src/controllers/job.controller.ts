import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import jobService from '../services/job.service';

class JobController {
  public async create(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      // Get the employee ID from the authenticated user
      const employeeId = req.user?.employee?.id;
      if (!employeeId) {
        return res.status(400).json({ message: 'Employee profile not found' });
      }

      const jobData = {
        ...req.body,
        postedBy: employeeId
      };

      const job = await jobService.createJob(jobData);
      return res.status(201).json({ job });
    } catch (error) {
      console.error('Error creating job:', error);
      return res.status(500).json({ message: 'Error creating job', error });
    }
  }

  public async getAll(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(String(req.query.page || '1'), 10) || 1;
      const limit = parseInt(String(req.query.limit || '10'), 10) || 10;
      const filters: any = {};
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.departmentId) filters.departmentId = String(req.query.departmentId);
      if (req.query.type) filters.type = String(req.query.type);
      if (req.query.location) filters.location = String(req.query.location);

      const result = await jobService.getJobs(page, limit, filters);
      return res.status(200).json({
        data: result.jobs,
        pagination: result.pagination
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching jobs', error });
    }
  }

  public async getById(req: Request, res: Response): Promise<Response> {
    try {
      const job = await jobService.getJobById(req.params.id);
      if (!job) return res.status(404).json({ message: 'Job not found' });
      return res.status(200).json(job);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching job', error });
    }
  }

  public async update(req: Request, res: Response): Promise<Response> {
    try {
      const updated = await jobService.updateJob(req.params.id, req.body);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Error updating job', error });
    }
  }

  public async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: 'Status is required' });
      const updated = await jobService.updateJobStatus(req.params.id, status);
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(500).json({ message: 'Error updating job status', error });
    }
  }

  public async delete(req: Request, res: Response): Promise<Response> {
    try {
      await jobService.deleteJob(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting job', error });
    }
  }

  public async getByDepartment(req: Request, res: Response): Promise<Response> {
    try {
      const jobs = await jobService.getJobsByDepartment(req.params.departmentId);
      return res.status(200).json(jobs);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching jobs by department', error });
    }
  }

  public async getByPoster(req: Request, res: Response): Promise<Response> {
    try {
      const jobs = await jobService.getJobsByPoster(req.params.posterId);
      return res.status(200).json(jobs);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching jobs by poster', error });
    }
  }

  public async stats(req: Request, res: Response): Promise<Response> {
    try {
      const stats = await jobService.getJobStats();
      return res.status(200).json(stats);
    } catch (error) {
      return res.status(500).json({ message: 'Error fetching job stats', error });
    }
  }

  public async search(req: Request, res: Response): Promise<Response> {
    try {
      const q = String(req.query.q || '');
      const filters: any = {};
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.departmentId) filters.departmentId = String(req.query.departmentId);
      const results = await jobService.searchJobs(q, filters);
      return res.status(200).json(results);
    } catch (error) {
      return res.status(500).json({ message: 'Error searching jobs', error });
    }
  }
}

export const jobController = new JobController();
