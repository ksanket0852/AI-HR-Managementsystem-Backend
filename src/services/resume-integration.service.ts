import { PrismaClient } from "@prisma/client";
import { ResumeAnalysisDto, WorkExperienceDto, EducationDto, ProjectDto, CertificationDto, LanguageDto } from "../types/chat.dto";

class ResumeIntegrationService {
  private prisma = new PrismaClient();

  /**
   * Get comprehensive resume analysis for a candidate
   */
  async getResumeAnalysis(candidateId: string): Promise<ResumeAnalysisDto | null> {
    try {
      const resume = await this.prisma.resume.findFirst({
        where: { 
          candidateId,
          isLatest: true 
        },
        include: {
          candidate: true
        }
      });

      if (!resume) return null;

      return {
        candidateId: resume.candidateId,
        resumeId: resume.id,
        extractedSkills: resume.skills as string[] || [],
        experience: this.parseWorkExperience(resume.experience),
        education: this.parseEducation(resume.education),
        projects: this.parseProjects(resume.projects),
        certifications: this.parseCertifications(resume.certifications),
        languages: this.parseLanguages(resume.languages),
        aiScore: resume.aiScore ? Number(resume.aiScore) : 0,
        keywordMatches: resume.keywordMatches as string[] || []
      };
    } catch (error) {
      console.error('Error getting resume analysis:', error);
      return null;
    }
  }

  /**
   * Get job-specific resume analysis
   */
  async getJobSpecificResumeAnalysis(candidateId: string, jobId: string): Promise<ResumeAnalysisDto | null> {
    try {
      const resumeAnalysis = await this.getResumeAnalysis(candidateId);
      if (!resumeAnalysis) return null;

      // Get job requirements
      const job = await this.prisma.job.findUnique({
        where: { id: jobId }
      });

      if (!job) return resumeAnalysis;

      // Calculate job-specific matching
      const jobSkills = job.skills as string[] || [];
      const jobRequirements = job.requirements as string[] || [];

      // Find matching skills
      const matchingSkills = resumeAnalysis.extractedSkills.filter(skill =>
        jobSkills.some(jobSkill => 
          skill.toLowerCase().includes(jobSkill.toLowerCase()) ||
          jobSkill.toLowerCase().includes(skill.toLowerCase())
        )
      );

      // Calculate experience match
      const requiredExperience = job.experienceMin || 0;
      const candidateExperience = resumeAnalysis.experience.reduce((total, exp) => {
        const startYear = new Date(exp.startDate).getFullYear();
        const endYear = exp.endDate ? new Date(exp.endDate).getFullYear() : new Date().getFullYear();
        return total + (endYear - startYear);
      }, 0);

      const experienceMatch = Math.min(100, (candidateExperience / requiredExperience) * 100);

      return {
        ...resumeAnalysis,
        extractedSkills: matchingSkills,
        keywordMatches: [
          ...matchingSkills,
          ...resumeAnalysis.keywordMatches.filter(keyword =>
            jobRequirements.some(req => 
              keyword.toLowerCase().includes(req.toLowerCase()) ||
              req.toLowerCase().includes(keyword.toLowerCase())
            )
          )
        ],
        aiScore: this.calculateJobSpecificScore(resumeAnalysis, job, experienceMatch)
      };
    } catch (error) {
      console.error('Error getting job-specific resume analysis:', error);
      return null;
    }
  }

  /**
   * Generate context-aware questions based on resume and job requirements
   */
  async generateContextAwareQuestions(
    candidateId: string,
    jobId: string,
    conversationPhase: string,
    previousQuestions: string[] = []
  ): Promise<string[]> {
    try {
      const resumeAnalysis = await this.getJobSpecificResumeAnalysis(candidateId, jobId);
      if (!resumeAnalysis) return [];

      const questions: string[] = [];

      switch (conversationPhase) {
        case 'greeting':
          questions.push(`Hello! I see you've applied for the ${jobId} position. Can you tell me a bit about yourself and what interests you about this role?`);
          break;

        case 'experience':
          if (resumeAnalysis.experience.length > 0) {
            const latestExperience = resumeAnalysis.experience[0];
            questions.push(`I see you worked as a ${latestExperience.position} at ${latestExperience.company}. Can you walk me through your key responsibilities and achievements in that role?`);
            
            if (latestExperience.achievements.length > 0) {
              questions.push(`You mentioned achieving ${latestExperience.achievements[0]}. Can you tell me more about how you accomplished that?`);
            }
          }
          break;

        case 'skills':
          const topSkills = resumeAnalysis.extractedSkills.slice(0, 3);
          if (topSkills.length > 0) {
            questions.push(`I notice you have experience with ${topSkills.join(', ')}. Can you give me a specific example of how you've used these skills in a recent project?`);
          }
          
          if (resumeAnalysis.projects.length > 0) {
            const recentProject = resumeAnalysis.projects[0];
            questions.push(`Tell me about your project "${recentProject.name}". What technologies did you use and what challenges did you face?`);
          }
          break;

        case 'behavioral':
          questions.push(`Can you describe a time when you had to work with a difficult team member or stakeholder? How did you handle the situation?`);
          questions.push(`Tell me about a project where you had to learn a new technology quickly. How did you approach the learning process?`);
          break;

        case 'closing':
          questions.push(`Do you have any questions about the role or our company culture?`);
          questions.push(`What are your career goals for the next 2-3 years?`);
          break;
      }

      // Filter out previously asked questions
      return questions.filter(q => !previousQuestions.some(pq => pq.toLowerCase().includes(q.toLowerCase().substring(0, 20))));
    } catch (error) {
      console.error('Error generating context-aware questions:', error);
      return ['Can you tell me more about your experience?'];
    }
  }

  /**
   * Analyze resume gaps for interview questions
   */
  async analyzeResumeGaps(candidateId: string, jobId: string): Promise<string[]> {
    try {
      const resumeAnalysis = await this.getJobSpecificResumeAnalysis(candidateId, jobId);
      const job = await this.prisma.job.findUnique({
        where: { id: jobId }
      });

      if (!resumeAnalysis || !job) return [];

      const gaps: string[] = [];
      const jobSkills = job.skills as string[] || [];
      const jobRequirements = job.requirements as string[] || [];

      // Check for missing skills
      const missingSkills = jobSkills.filter(skill =>
        !resumeAnalysis.extractedSkills.some(resumeSkill =>
          resumeSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(resumeSkill.toLowerCase())
        )
      );

      if (missingSkills.length > 0) {
        gaps.push(`I notice the job requires ${missingSkills.join(', ')}. Can you tell me about any experience you have with these technologies, even if it's not listed on your resume?`);
      }

      // Check experience level
      const requiredExperience = job.experienceMin || 0;
      const candidateExperience = resumeAnalysis.experience.reduce((total, exp) => {
        const startYear = new Date(exp.startDate).getFullYear();
        const endYear = exp.endDate ? new Date(exp.endDate).getFullYear() : new Date().getFullYear();
        return total + (endYear - startYear);
      }, 0);

      if (candidateExperience < requiredExperience) {
        gaps.push(`The role requires ${requiredExperience} years of experience, and I see you have ${candidateExperience} years. Can you tell me about any relevant projects or learning experiences that might compensate for this?`);
      }

      return gaps;
    } catch (error) {
      console.error('Error analyzing resume gaps:', error);
      return [];
    }
  }

  /**
   * Parse work experience from JSON
   */
  private parseWorkExperience(experience: any): WorkExperienceDto[] {
    if (!experience || !Array.isArray(experience)) return [];
    
    return experience.map((exp: any) => ({
      company: exp.company || '',
      position: exp.position || '',
      startDate: new Date(exp.startDate || Date.now()),
      endDate: exp.endDate ? new Date(exp.endDate) : undefined,
      description: exp.description || '',
      skills: exp.skills || [],
      achievements: exp.achievements || []
    }));
  }

  /**
   * Parse education from JSON
   */
  private parseEducation(education: any): EducationDto[] {
    if (!education || !Array.isArray(education)) return [];
    
    return education.map((edu: any) => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      field: edu.field || '',
      startDate: new Date(edu.startDate || Date.now()),
      endDate: edu.endDate ? new Date(edu.endDate) : undefined,
      gpa: edu.gpa || undefined
    }));
  }

  /**
   * Parse projects from JSON
   */
  private parseProjects(projects: any): ProjectDto[] {
    if (!projects || !Array.isArray(projects)) return [];
    
    return projects.map((proj: any) => ({
      name: proj.name || '',
      description: proj.description || '',
      technologies: proj.technologies || [],
      startDate: new Date(proj.startDate || Date.now()),
      endDate: proj.endDate ? new Date(proj.endDate) : undefined,
      url: proj.url || undefined
    }));
  }

  /**
   * Parse certifications from JSON
   */
  private parseCertifications(certifications: any): CertificationDto[] {
    if (!certifications || !Array.isArray(certifications)) return [];
    
    return certifications.map((cert: any) => ({
      name: cert.name || '',
      issuer: cert.issuer || '',
      issueDate: new Date(cert.issueDate || Date.now()),
      expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : undefined,
      credentialId: cert.credentialId || undefined
    }));
  }

  /**
   * Parse languages from JSON
   */
  private parseLanguages(languages: any): LanguageDto[] {
    if (!languages || !Array.isArray(languages)) return [];
    
    return languages.map((lang: any) => ({
      language: lang.language || '',
      proficiency: lang.proficiency || 'intermediate'
    }));
  }

  /**
   * Calculate job-specific matching score
   */
  private calculateJobSpecificScore(
    resumeAnalysis: ResumeAnalysisDto,
    job: any,
    experienceMatch: number
  ): number {
    const jobSkills = job.skills as string[] || [];
    const jobRequirements = job.requirements as string[] || [];
    
    // Calculate skill match percentage
    const skillMatches = resumeAnalysis.extractedSkills.filter(skill =>
      jobSkills.some(jobSkill => 
        skill.toLowerCase().includes(jobSkill.toLowerCase()) ||
        jobSkill.toLowerCase().includes(skill.toLowerCase())
      )
    ).length;
    
    const skillMatchPercentage = jobSkills.length > 0 ? (skillMatches / jobSkills.length) * 100 : 0;
    
    // Calculate requirement match percentage
    const requirementMatches = resumeAnalysis.keywordMatches.filter(keyword =>
      jobRequirements.some(req => 
        keyword.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(keyword.toLowerCase())
      )
    ).length;
    
    const requirementMatchPercentage = jobRequirements.length > 0 ? (requirementMatches / jobRequirements.length) * 100 : 0;
    
    // Weighted average: 40% skills, 30% requirements, 30% experience
    const finalScore = (
      skillMatchPercentage * 0.4 +
      requirementMatchPercentage * 0.3 +
      Math.min(experienceMatch, 100) * 0.3
    );
    
    return Math.round(finalScore);
  }
}

export const resumeIntegrationService = new ResumeIntegrationService();
