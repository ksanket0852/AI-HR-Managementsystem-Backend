import { PrismaClient, Candidate, Resume, Job } from '@prisma/client';
import { OpenAI } from 'openai';
import { extractTextFromFile, cleanExtractedText, validateExtractedText } from '../utils/textExtractor';
import { deleteFile } from '../utils/fileUpload';
import path from 'path';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParsedResumeData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: any;
    dateOfBirth?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
  };
  professionalSummary?: string;
  skills: Array<{
    name: string;
    category: string;
    proficiency?: string;
  }>;
  experience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    description: string;
    responsibilities: string[];
    achievements?: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    grade?: string;
    achievements?: string[];
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
    startDate?: string;
    endDate?: string;
    url?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
  totalExperience?: number;
}

export interface ResumeMatchResult {
  matchScore: number;
  skillMatches: Array<{
    skill: string;
    matched: boolean;
    weight: number;
  }>;
  experienceMatch: boolean;
  keywordMatches: string[];
  recommendations: string[];
}

class ResumeParserService {
  /**
   * Upload and parse a resume
   */
  async uploadAndParseResume(
    file: Express.Multer.File,
    candidateData?: Partial<Candidate>
  ): Promise<{ candidate: Candidate; resume: Resume }> {
    try {
      // Extract text from the uploaded file
      const textResult = await extractTextFromFile(file.path);
      
      if (textResult.error || !textResult.text) {
        // Clean up uploaded file
        await deleteFile(file.path);
        throw new Error(textResult.error || 'Failed to extract text from resume');
      }

      // Validate extracted text
      const cleanedText = cleanExtractedText(textResult.text);
      if (!validateExtractedText(cleanedText)) {
        await deleteFile(file.path);
        throw new Error('Invalid resume format or insufficient content');
      }

      // Parse resume with OpenAI
      const parsedData = await this.parseResumeWithAI(cleanedText);
      
      // Create or update candidate
      let candidate: Candidate;
      if (candidateData?.email || parsedData.personalInfo.email) {
        const email = candidateData?.email || parsedData.personalInfo.email;
        candidate = await this.createOrUpdateCandidate(parsedData, candidateData, email);
      } else {
        throw new Error('Email is required for candidate creation');
      }

      // Create resume record
      const resume = await prisma.resume.create({
        data: {
          candidateId: candidate.id,
          originalFileName: file.originalname,
          filePath: file.path,
          fileType: path.extname(file.originalname).substring(1).toUpperCase(),
          fileSize: file.size,
          rawText: cleanedText,
          parsedData: parsedData as any,
          skills: parsedData.skills as any,
          experience: parsedData.experience as any,
          education: parsedData.education as any,
          certifications: parsedData.certifications as any,
          languages: parsedData.languages as any,
          projects: parsedData.projects as any,
          parsedAt: new Date(),
        },
      });

      // Set previous resumes as not latest
      await prisma.resume.updateMany({
        where: {
          candidateId: candidate.id,
          id: { not: resume.id },
        },
        data: {
          isLatest: false,
        },
      });

      return { candidate, resume };
    } catch (error) {
      // Clean up uploaded file on error
      await deleteFile(file.path);
      throw error;
    }
  }

  /**
   * Parse resume text using OpenAI
   */
  private async parseResumeWithAI(resumeText: string): Promise<ParsedResumeData> {
    const prompt = `
    You are an expert resume parser. Extract structured information from the following resume text and return it as a JSON object.

    Resume Text:
    ${resumeText}

    Please extract and return the following information in JSON format:
    {
      "personalInfo": {
        "firstName": "string",
        "lastName": "string", 
        "email": "string",
        "phone": "string (optional)",
        "address": {"city": "string", "state": "string", "country": "string"} (optional),
        "dateOfBirth": "YYYY-MM-DD format (optional)",
        "linkedinUrl": "string (optional)",
        "portfolioUrl": "string (optional)",
        "githubUrl": "string (optional)"
      },
      "professionalSummary": "string (optional)",
      "skills": [
        {
          "name": "skill name",
          "category": "technical/soft/language/other",
          "proficiency": "beginner/intermediate/advanced/expert (optional)"
        }
      ],
      "experience": [
        {
          "company": "company name",
          "position": "job title",
          "startDate": "YYYY-MM format",
          "endDate": "YYYY-MM format or null if current",
          "description": "brief description",
          "responsibilities": ["responsibility 1", "responsibility 2"],
          "achievements": ["achievement 1", "achievement 2"] (optional)
        }
      ],
      "education": [
        {
          "institution": "school/university name",
          "degree": "degree type",
          "field": "field of study",
          "startDate": "YYYY-MM format",
          "endDate": "YYYY-MM format",
          "grade": "GPA/grade (optional)",
          "achievements": ["achievement 1"] (optional)
        }
      ],
      "certifications": [
        {
          "name": "certification name",
          "issuer": "issuing organization",
          "issueDate": "YYYY-MM format (optional)",
          "expiryDate": "YYYY-MM format (optional)",
          "credentialId": "string (optional)"
        }
      ] (optional),
      "projects": [
        {
          "name": "project name",
          "description": "project description",
          "technologies": ["tech1", "tech2"],
          "startDate": "YYYY-MM format (optional)",
          "endDate": "YYYY-MM format (optional)",
          "url": "project url (optional)"
        }
      ] (optional),
      "languages": [
        {
          "name": "language name",
          "proficiency": "native/fluent/conversational/basic"
        }
      ] (optional),
      "totalExperience": "number of years (calculate from experience)"
    }

    Important:
    - Extract only information that is clearly present in the resume
    - Use null for missing optional fields
    - Calculate total experience from work history
    - Categorize skills appropriately
    - Format dates consistently
    - Return only valid JSON
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const parsedData = JSON.parse(content);
      return parsedData as ParsedResumeData;
    } catch (error) {
      console.error('OpenAI parsing error:', error);
      throw new Error(`Failed to parse resume with AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update candidate
   */
  private async createOrUpdateCandidate(
    parsedData: ParsedResumeData,
    candidateData?: Partial<Candidate>,
    email?: string
  ): Promise<Candidate> {
    const personalInfo = parsedData.personalInfo;
    
    const candidateInput: any = {
      firstName: candidateData?.firstName || personalInfo.firstName,
      lastName: candidateData?.lastName || personalInfo.lastName,
      email: email || personalInfo.email,
      phone: candidateData?.phone || personalInfo.phone,
      dateOfBirth: personalInfo.dateOfBirth ? new Date(personalInfo.dateOfBirth) : null,
      address: personalInfo.address || candidateData?.address,
      profileSummary: parsedData.professionalSummary,
      totalExperience: parsedData.totalExperience,
      linkedinUrl: personalInfo.linkedinUrl,
      portfolioUrl: personalInfo.portfolioUrl,
      githubUrl: personalInfo.githubUrl,
      skills: parsedData.skills,
    };

    // Add additional candidate data if provided
    if (candidateData) {
      Object.keys(candidateData).forEach(key => {
        if (candidateData[key as keyof Candidate] !== undefined) {
          candidateInput[key] = candidateData[key as keyof Candidate];
        }
      });
    }

    // Try to find existing candidate by email
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: candidateInput.email },
    });

    if (existingCandidate) {
      // Update existing candidate
      return await prisma.candidate.update({
        where: { id: existingCandidate.id },
        data: candidateInput,
      });
    } else {
      // Create new candidate
      return await prisma.candidate.create({
        data: candidateInput,
      });
    }
  }

  /**
   * Match resume with job
   */
  async matchResumeWithJob(resumeId: string, jobId: string): Promise<ResumeMatchResult> {
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { candidate: true },
    });

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!resume || !job) {
      throw new Error('Resume or job not found');
    }

    // Use OpenAI to analyze match
    const matchResult = await this.analyzeJobMatchWithAI(resume, job);

    // Store match result
    await prisma.jobMatch.upsert({
      where: {
        resumeId_jobId: {
          resumeId: resumeId,
          jobId: jobId,
        },
      },
      update: {
        matchScore: matchResult.matchScore,
        skillMatches: matchResult.skillMatches as any,
        keywordMatches: matchResult.keywordMatches as any,
        experienceMatch: matchResult.experienceMatch,
      },
      create: {
        resumeId: resumeId,
        jobId: jobId,
        matchScore: matchResult.matchScore,
        skillMatches: matchResult.skillMatches as any,
        keywordMatches: matchResult.keywordMatches as any,
        experienceMatch: matchResult.experienceMatch,
      },
    });

    return matchResult;
  }

  /**
   * Analyze job match using AI
   */
  private async analyzeJobMatchWithAI(
    resume: Resume & { candidate: Candidate },
    job: Job
  ): Promise<ResumeMatchResult> {
    const prompt = `
    You are an expert recruitment AI. Analyze how well this candidate matches the job requirements.

    CANDIDATE PROFILE:
    Name: ${resume.candidate.firstName} ${resume.candidate.lastName}
    Experience: ${resume.candidate.totalExperience} years
    Skills: ${JSON.stringify(resume.skills)}
    Experience: ${JSON.stringify(resume.experience)}
    Education: ${JSON.stringify(resume.education)}

    JOB REQUIREMENTS:
    Title: ${job.title}
    Description: ${job.description}
    Required Skills: ${JSON.stringify(job.skills)}
    Experience Required: ${job.experienceMin}-${job.experienceMax || '+'} years
    Requirements: ${JSON.stringify(job.requirements)}

    Please analyze and return a JSON object with:
    {
      "matchScore": "number from 0-100",
      "skillMatches": [
        {
          "skill": "skill name",
          "matched": true/false,
          "weight": "importance weight 1-10"
        }
      ],
      "experienceMatch": true/false,
      "keywordMatches": ["matched keyword 1", "matched keyword 2"],
      "recommendations": ["recommendation 1", "recommendation 2"]
    }

    Consider:
    - Technical skill alignment
    - Experience level match
    - Industry/domain fit
    - Education relevance
    - Career progression
    - Cultural fit indicators
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content) as ResumeMatchResult;
    } catch (error) {
      console.error('Job match analysis error:', error);
      throw new Error(`Failed to analyze job match: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all candidates with pagination
   */
  async getCandidates(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      skills?: string[];
      experienceMin?: number;
      experienceMax?: number;
    }
  ) {
    const offset = (page - 1) * limit;
    
    const where: any = {};
    
    if (filters?.status) {
      where.status = filters.status;
    }
    
    if (filters?.skills && filters.skills.length > 0) {
      where.skills = {
        path: '$[*].name',
        array_contains: filters.skills,
      };
    }
    
    if (filters?.experienceMin !== undefined) {
      where.totalExperience = {
        gte: filters.experienceMin,
      };
    }
    
    if (filters?.experienceMax !== undefined) {
      where.totalExperience = {
        ...where.totalExperience,
        lte: filters.experienceMax,
      };
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: {
          resumes: {
            where: { isLatest: true },
            take: 1,
          },
          _count: {
            select: {
              applications: true,
              interviews: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.candidate.count({ where }),
    ]);

    return {
      candidates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get candidate by ID with full details
   */
  async getCandidateById(candidateId: string) {
    return await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resumes: {
          orderBy: { uploadedAt: 'desc' },
        },
        applications: {
          include: {
            job: {
              include: {
                department: true,
              },
            },
          },
        },
        interviews: {
          include: {
            job: true,
            interviewer: true,
          },
        },
      },
    });
  }

  /**
   * Update candidate status
   */
  async updateCandidateStatus(candidateId: string, status: string) {
    return await prisma.candidate.update({
      where: { id: candidateId },
      data: { status: status as any },
    });
  }

  /**
   * Get resume matches for a job
   */
  async getResumeMatchesForJob(jobId: string, minScore: number = 50) {
    return await prisma.jobMatch.findMany({
      where: {
        jobId,
        matchScore: { gte: minScore },
      },
      include: {
        resume: {
          include: {
            candidate: true,
          },
        },
        job: true,
      },
      orderBy: { matchScore: 'desc' },
    });
  }
}

export default new ResumeParserService(); 