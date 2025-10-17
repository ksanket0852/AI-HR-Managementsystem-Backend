import express from 'express';
import resumeParserController, {
  uploadResumeValidation,
  getCandidatesValidation,
  updateCandidateStatusValidation,
  matchResumeValidation,
  getResumeMatchesValidation,
} from '../controllers/resumeParser.controller';
import { resumeUpload } from '../utils/fileUpload';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Simple role-based middleware
const requireRoles = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * @route POST /api/resume-parser/upload
 * @desc Upload and parse resume
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.post(
  '/upload',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  (req: any, res: any, next: any) => {
    resumeUpload.single('resume')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      next();
    });
  },
  uploadResumeValidation,
  resumeParserController.uploadResume
);

/**
 * @route GET /api/resume-parser/candidates
 * @desc Get all candidates with pagination and filters
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.get(
  '/candidates',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  getCandidatesValidation,
  resumeParserController.getCandidates
);

/**
 * @route GET /api/resume-parser/candidates/:candidateId
 * @desc Get candidate by ID
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.get(
  '/candidates/:candidateId',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  resumeParserController.getCandidateById
);

/**
 * @route PUT /api/resume-parser/candidates/:candidateId/status
 * @desc Update candidate status
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.put(
  '/candidates/:candidateId/status',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  updateCandidateStatusValidation,
  resumeParserController.updateCandidateStatus
);

/**
 * @route POST /api/resume-parser/match
 * @desc Match resume with job
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.post(
  '/match',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  matchResumeValidation,
  resumeParserController.matchResumeWithJob
);

/**
 * @route GET /api/resume-parser/jobs/:jobId/matches
 * @desc Get resume matches for a job
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.get(
  '/jobs/:jobId/matches',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  getResumeMatchesValidation,
  resumeParserController.getResumeMatchesForJob
);

/**
 * @route GET /api/resume-parser/stats
 * @desc Get resume parsing statistics
 * @access HR_ADMIN, HR_MANAGER
 */
router.get(
  '/stats',
  requireRoles(['HR_ADMIN', 'HR_MANAGER']),
  resumeParserController.getParsingStats
);

export default router; 