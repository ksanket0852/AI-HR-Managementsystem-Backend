import { PrismaClient, Job, Department, Employee } from '@prisma/client';

const prisma = new PrismaClient();

class JobService {
  /**
   * Create a new job posting
   */
  async createJob(jobData: {
    title: string;
    departmentId: string;
    description: string;
    requirements: any[];
    skills: any[];
    experienceMin: number;
    experienceMax?: number;
    salaryMin?: number;
    salaryMax?: number;
    location: string;
    type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP';
    postedBy: string;
    closingDate?: Date;
  }): Promise<Job> {
    return await prisma.job.create({
      data: {
        ...jobData,
        status: 'OPEN',
      },
    });
  }

  /**
   * Get all jobs with pagination and filters
   */
  async getJobs(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      departmentId?: string;
      type?: string;
      location?: string;
    }
  ) {
    const offset = (page - 1) * limit;
    
    const where: any = {};
    
    if (filters?.status) {
      where.status = filters.status;
    }
    
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    
    if (filters?.type) {
      where.type = filters.type;
    }
    
    if (filters?.location) {
      where.location = { contains: filters.location, mode: 'insensitive' };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          department: true,
          poster: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              applications: true,
              jobMatches: true,
              interviews: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { postedAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string) {
    return await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        department: true,
        poster: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        applications: {
          include: {
            candidate: true,
          },
        },
        jobMatches: {
          include: {
            resume: {
              include: {
                candidate: true,
              },
            },
          },
          orderBy: { matchScore: 'desc' },
        },
        interviews: {
          include: {
            candidate: true,
            interviewer: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, updateData: any) {
    return await prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ON_HOLD') {
    return await prisma.job.update({
      where: { id: jobId },
      data: { status },
    });
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string) {
    return await prisma.job.delete({
      where: { id: jobId },
    });
  }

  /**
   * Get jobs by department
   */
  async getJobsByDepartment(departmentId: string) {
    return await prisma.job.findMany({
      where: { departmentId },
      include: {
        department: true,
        poster: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
            jobMatches: true,
            interviews: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
    });
  }

  /**
   * Get jobs posted by an employee
   */
  async getJobsByPoster(employeeId: string) {
    return await prisma.job.findMany({
      where: { postedBy: employeeId },
      include: {
        department: true,
        _count: {
          select: {
            applications: true,
            jobMatches: true,
            interviews: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
    });
  }

  /**
   * Get job statistics
   */
  async getJobStats() {
    const [
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      totalInterviews,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.job.count({ where: { status: 'CLOSED' } }),
      prisma.jobApplication.count(),
      prisma.interview.count(),
    ]);

    return {
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      totalInterviews,
      applicationRate: totalJobs > 0 ? (totalApplications / totalJobs).toFixed(2) : '0',
      interviewRate: totalApplications > 0 ? (totalInterviews / totalApplications).toFixed(2) : '0',
    };
  }

  /**
   * Search jobs
   */
  async searchJobs(searchTerm: string, filters?: any) {
    const where: any = {
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    return await prisma.job.findMany({
      where,
      include: {
        department: true,
        poster: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
            jobMatches: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
    });
  }
}

export default new JobService(); 