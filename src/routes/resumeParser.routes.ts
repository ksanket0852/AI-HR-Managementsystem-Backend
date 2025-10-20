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
      console.warn('[resume-parser] Authentication required - no req.user (headers):', {
        authorization: req.headers.authorization,
      });
      return res.status(401).json({ message: 'Authentication required' });
    }
    // Allow SUPER_ADMIN to access all resume-parser routes regardless of specific role list
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      // Log the user's role for debugging permission issues
      console.warn('[resume-parser] Insufficient permissions', {
        requiredRoles: roles,
        userId: req.user?.id,
        userRole: req.user?.role,
        authorization: req.headers.authorization,
      });
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
    // FIXED: Wrap multer in a function to avoid TypeScript type issues
    const upload = resumeUpload.single('resume');
    upload(req, res, (err: any) => {
      if (err) {
        console.error('[resume-parser] Multer error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      
      // Debug logs
      console.log('[resume-parser] File upload middleware completed');
      console.log('[resume-parser] req.file present?', !!req.file);
      if (req.file) {
        console.log('[resume-parser] req.file details:', {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path
        });
      } else {
        console.warn('[resume-parser] No file received in request');
        return res.status(400).json({
          success: false,
          message: 'No resume file uploaded. Please ensure the file field name is "resume"',
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
 * @route PUT /api/resume-parser/candidates/:candidateId
 * @desc Update candidate general information
 * @access HR_ADMIN, HR_MANAGER, MANAGER
 */
router.put(
  '/candidates/:candidateId',
  requireRoles(['HR_ADMIN', 'HR_MANAGER', 'MANAGER']),
  resumeParserController.updateCandidate
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