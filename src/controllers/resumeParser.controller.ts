import { Request, Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import resumeParserService from '../services/resumeParser.service';
import { getFileType } from '../utils/fileUpload';

class ResumeParserController {
  /**
   * Upload and parse resume
   */
  async uploadResume(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Resume file is required',
        });
        return;
      }

      // Parse additional candidate data from request body
      const candidateData = req.body.candidateData ? JSON.parse(req.body.candidateData) : {};

      // Upload and parse resume
      const result = await resumeParserService.uploadAndParseResume(req.file, candidateData);

      res.status(201).json({
        success: true,
        message: 'Resume uploaded and parsed successfully',
        data: {
          candidate: result.candidate,
          resume: {
            id: result.resume.id,
            originalFileName: result.resume.originalFileName,
            fileType: result.resume.fileType,
            fileSize: result.resume.fileSize,
            parsedData: result.resume.parsedData,
            skills: result.resume.skills,
            experience: result.resume.experience,
            education: result.resume.education,
            certifications: result.resume.certifications,
            languages: result.resume.languages,
            projects: result.resume.projects,
            uploadedAt: result.resume.uploadedAt,
            parsedAt: result.resume.parsedAt,
          },
        },
      });
    } catch (error) {
      console.error('Resume upload error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload and parse resume',
      });
    }
  }

  /**
   * Get all candidates with pagination and filters
   */
  async getCandidates(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = req.query.status;
      }
      
      if (req.query.skills) {
        filters.skills = (req.query.skills as string).split(',');
      }
      
      if (req.query.experienceMin) {
        filters.experienceMin = parseInt(req.query.experienceMin as string);
      }
      
      if (req.query.experienceMax) {
        filters.experienceMax = parseInt(req.query.experienceMax as string);
      }

      const result = await resumeParserService.getCandidates(page, limit, filters);

      res.status(200).json({
        success: true,
        message: 'Candidates retrieved successfully',
        data: result.candidates,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('Get candidates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve candidates',
      });
    }
  }

  /**
   * Get candidate by ID
   */
  async getCandidateById(req: Request, res: Response): Promise<void> {
    try {
      const { candidateId } = req.params;

      const candidate = await resumeParserService.getCandidateById(candidateId);

      if (!candidate) {
        res.status(404).json({
          success: false,
          message: 'Candidate not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Candidate retrieved successfully',
        data: candidate,
      });
    } catch (error) {
      console.error('Get candidate error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve candidate',
      });
    }
  }

  /**
   * Update candidate status
   */
  async updateCandidateStatus(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
        return;
      }

      const { candidateId } = req.params;
      const { status } = req.body;

      const candidate = await resumeParserService.updateCandidateStatus(candidateId, status);

      res.status(200).json({
        success: true,
        message: 'Candidate status updated successfully',
        data: candidate,
      });
    } catch (error) {
      console.error('Update candidate status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update candidate status',
      });
    }
  }

  /**
   * Match resume with job
   */
  async matchResumeWithJob(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
        return;
      }

      const { resumeId, jobId } = req.body;

      const matchResult = await resumeParserService.matchResumeWithJob(resumeId, jobId);

      res.status(200).json({
        success: true,
        message: 'Resume matched with job successfully',
        data: matchResult,
      });
    } catch (error) {
      console.error('Resume job match error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to match resume with job',
      });
    }
  }

  /**
   * Get resume matches for a job
   */
  async getResumeMatchesForJob(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
        return;
      }

      const { jobId } = req.params;
      const minScore = parseInt(req.query.minScore as string) || 50;

      const matches = await resumeParserService.getResumeMatchesForJob(jobId, minScore);

      res.status(200).json({
        success: true,
        message: 'Resume matches retrieved successfully',
        data: matches,
      });
    } catch (error) {
      console.error('Get resume matches error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve resume matches',
      });
    }
  }

  /**
   * Get resume parsing statistics
   */
  async getParsingStats(req: Request, res: Response): Promise<void> {
    try {
      // This could be extended to provide analytics about resume parsing
      const stats = {
        totalCandidates: await resumeParserService.getCandidates(1, 1).then(r => r.pagination.total),
        candidatesByStatus: {
          new: 0,
          reviewed: 0,
          shortlisted: 0,
          interviewed: 0,
          selected: 0,
          rejected: 0,
          hired: 0,
        },
        topSkills: [],
        averageExperience: 0,
      };

      res.status(200).json({
        success: true,
        message: 'Parsing statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      console.error('Get parsing stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve parsing statistics',
      });
    }
  }
}

// Validation middleware
export const uploadResumeValidation = [
  body('candidateData')
    .optional()
    .isString()
    .withMessage('Candidate data must be a valid JSON string'),
];

export const getCandidatesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['NEW', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SELECTED', 'REJECTED', 'HIRED', 'WITHDRAWN'])
    .withMessage('Invalid status value'),
  query('experienceMin')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience minimum must be a non-negative integer'),
  query('experienceMax')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience maximum must be a non-negative integer'),
];

export const updateCandidateStatusValidation = [
  body('status')
    .notEmpty()
    .isIn(['NEW', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SELECTED', 'REJECTED', 'HIRED', 'WITHDRAWN'])
    .withMessage('Valid status is required'),
];

export const matchResumeValidation = [
  body('resumeId')
    .notEmpty()
    .isString()
    .withMessage('Resume ID is required'),
  body('jobId')
    .notEmpty()
    .isString()
    .withMessage('Job ID is required'),
];

export const getResumeMatchesValidation = [
  query('minScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Minimum score must be between 0 and 100'),
];

export default new ResumeParserController(); 