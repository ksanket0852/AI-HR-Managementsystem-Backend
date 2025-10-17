import { PrismaClient, Prisma } from "@prisma/client";
import {
  AttritionRiskScore,
  AttritionRiskFactor,
  PerformanceInsight,
  TeamPerformanceInsight,
  LeavePatternAnalysis,
  AttendanceAnomalyDetection,
  DashboardAnalytics,
  AnalyticsFilterDto,
  AttritionRiskFilterDto,
  PerformanceInsightFilterDto,
  LeavePatternFilterDto,
  AttendanceAnomalyFilterDto,
  AnalyticsConfigDto,
  SystemAlert,
  TrendData,
  OverviewMetrics,
  AttendanceMetrics,
  LeaveMetrics,
  PerformanceMetrics,
  RecruitmentMetrics,
  AttritionMetrics,
  TrendAnalysis
} from "../types/analytics.dto";

class AnalyticsService {
  private prisma = new PrismaClient();

  // Default configuration for analytics calculations
  private defaultConfig: AnalyticsConfigDto = {
    attritionRiskWeights: {
      performanceRating: 0.25,
      attendanceScore: 0.20,
      leaveFrequency: 0.15,
      tenure: 0.15,
      salaryGrowth: 0.15,
      goalCompletion: 0.10
    },
    attendanceThresholds: {
      lateThreshold: 15, // 15 minutes
      earlyDepartureThreshold: 30, // 30 minutes
      excessiveBreakThreshold: 90, // 90 minutes
      minimumWorkHours: 7.5
    },
    leaveThresholds: {
      excessiveFrequency: 2, // 2 leaves per month
      longDuration: 5, // 5+ days
      burnoutRiskThreshold: 25 // 25+ days per year
    },
    performanceThresholds: {
      lowPerformanceRating: 2.5,
      highPerformanceRating: 4.0,
      goalCompletionThreshold: 80
    }
  };

  // Attrition Risk Scoring
  async calculateAttritionRisk(filters: AttritionRiskFilterDto = {}): Promise<AttritionRiskScore[]> {
    const { departmentId, employeeId, includeInactive = false } = filters;

    // Build where clause for employees
    const whereClause: Prisma.EmployeeWhereInput = {
      isActive: includeInactive ? undefined : true
    };

    if (departmentId) whereClause.departmentId = departmentId;
    if (employeeId) whereClause.id = employeeId;

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        department: true,
        attendances: {
          where: {
            date: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          }
        },
        leaves: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          }
        },
        performanceReviews: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        goals: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          }
        },
        payrolls: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const attritionRisks: AttritionRiskScore[] = [];

    for (const employee of employees) {
      const riskScore = await this.calculateEmployeeAttritionRisk(employee);
      attritionRisks.push(riskScore);
    }

    // Filter by risk level if specified
    if (filters.riskLevel) {
      return attritionRisks.filter(risk => risk.riskLevel === filters.riskLevel);
    }

    // Filter by risk score range if specified
    if (filters.minRiskScore !== undefined || filters.maxRiskScore !== undefined) {
      return attritionRisks.filter(risk => {
        if (filters.minRiskScore !== undefined && risk.riskScore < filters.minRiskScore) return false;
        if (filters.maxRiskScore !== undefined && risk.riskScore > filters.maxRiskScore) return false;
        return true;
      });
    }

    return attritionRisks.sort((a, b) => b.riskScore - a.riskScore);
  }

  private async calculateEmployeeAttritionRisk(employee: any): Promise<AttritionRiskScore> {
    const factors: AttritionRiskFactor[] = [];
    let totalScore = 0;

    // 1. Performance Rating Factor
    const performanceFactor = this.calculatePerformanceFactor(employee.performanceReviews);
    factors.push(performanceFactor);
    totalScore += performanceFactor.value * this.defaultConfig.attritionRiskWeights.performanceRating;

    // 2. Attendance Score Factor
    const attendanceFactor = this.calculateAttendanceFactor(employee.attendances);
    factors.push(attendanceFactor);
    totalScore += attendanceFactor.value * this.defaultConfig.attritionRiskWeights.attendanceScore;

    // 3. Leave Frequency Factor
    const leaveFactor = this.calculateLeaveFactor(employee.leaves);
    factors.push(leaveFactor);
    totalScore += leaveFactor.value * this.defaultConfig.attritionRiskWeights.leaveFrequency;

    // 4. Tenure Factor
    const tenureFactor = this.calculateTenureFactor(employee.dateOfJoining);
    factors.push(tenureFactor);
    totalScore += tenureFactor.value * this.defaultConfig.attritionRiskWeights.tenure;

    // 5. Salary Growth Factor
    const salaryFactor = this.calculateSalaryGrowthFactor(employee.payrolls);
    factors.push(salaryFactor);
    totalScore += salaryFactor.value * this.defaultConfig.attritionRiskWeights.salaryGrowth;

    // 6. Goal Completion Factor
    const goalFactor = this.calculateGoalCompletionFactor(employee.goals);
    factors.push(goalFactor);
    totalScore += goalFactor.value * this.defaultConfig.attritionRiskWeights.goalCompletion;

    // Normalize score to 0-100
    const riskScore = Math.min(100, Math.max(0, totalScore));

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (riskScore >= 80) riskLevel = 'CRITICAL';
    else if (riskScore >= 60) riskLevel = 'HIGH';
    else if (riskScore >= 40) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    // Generate recommendations
    const recommendations = this.generateAttritionRecommendations(factors, riskLevel);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department.name,
      riskScore,
      riskLevel,
      factors,
      recommendations,
      lastUpdated: new Date()
    };
  }

  private calculatePerformanceFactor(reviews: any[]): AttritionRiskFactor {
    if (reviews.length === 0) {
      return {
        factor: 'Performance Rating',
        weight: this.defaultConfig.attritionRiskWeights.performanceRating,
        value: 50, // Neutral score for no data
        impact: 'NEUTRAL',
        description: 'No performance reviews available'
      };
    }

    const latestReview = reviews[0];
    const rating = Number(latestReview.overallRating);
    
    // Convert rating (1-5) to risk score (higher rating = lower risk)
    const riskValue = Math.max(0, (5 - rating) * 25); // 5=0 risk, 1=100 risk

    return {
      factor: 'Performance Rating',
      weight: this.defaultConfig.attritionRiskWeights.performanceRating,
      value: riskValue,
      impact: rating >= 4 ? 'POSITIVE' : rating <= 2 ? 'NEGATIVE' : 'NEUTRAL',
      description: `Latest performance rating: ${rating}/5`
    };
  }

  private calculateAttendanceFactor(attendances: any[]): AttritionRiskFactor {
    if (attendances.length === 0) {
      return {
        factor: 'Attendance Score',
        weight: this.defaultConfig.attritionRiskWeights.attendanceScore,
        value: 50,
        impact: 'NEUTRAL',
        description: 'No attendance data available'
      };
    }

    const totalDays = attendances.length;
    const presentDays = attendances.filter(a => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME').length;
    const lateDays = attendances.filter(a => a.status === 'LATE').length;
    
    const attendanceRate = (presentDays / totalDays) * 100;
    const lateRate = (lateDays / totalDays) * 100;
    
    // Calculate risk based on attendance and punctuality
    const riskValue = Math.max(0, 100 - attendanceRate + (lateRate * 0.5));

    return {
      factor: 'Attendance Score',
      weight: this.defaultConfig.attritionRiskWeights.attendanceScore,
      value: Math.min(100, riskValue),
      impact: attendanceRate >= 95 && lateRate <= 5 ? 'POSITIVE' : attendanceRate <= 80 ? 'NEGATIVE' : 'NEUTRAL',
      description: `Attendance: ${attendanceRate.toFixed(1)}%, Late: ${lateRate.toFixed(1)}%`
    };
  }

  private calculateLeaveFactor(leaves: any[]): AttritionRiskFactor {
    const totalLeaves = leaves.length;
    const monthsInYear = 12;
    const leavesPerMonth = totalLeaves / monthsInYear;
    
    // Calculate risk based on leave frequency
    const riskValue = Math.min(100, (leavesPerMonth / this.defaultConfig.leaveThresholds.excessiveFrequency) * 50);

    return {
      factor: 'Leave Frequency',
      weight: this.defaultConfig.attritionRiskWeights.leaveFrequency,
      value: riskValue,
      impact: leavesPerMonth <= 1 ? 'POSITIVE' : leavesPerMonth >= 2 ? 'NEGATIVE' : 'NEUTRAL',
      description: `${totalLeaves} leaves in last year (${leavesPerMonth.toFixed(1)}/month)`
    };
  }

  private calculateTenureFactor(dateOfJoining: Date): AttritionRiskFactor {
    const tenureMonths = (Date.now() - dateOfJoining.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    // Higher risk for very new employees (< 6 months) and long-tenure employees (> 5 years)
    let riskValue = 0;
    if (tenureMonths < 6) {
      riskValue = 70; // High risk for new employees
    } else if (tenureMonths > 60) {
      riskValue = 40; // Moderate risk for long-tenure employees
    } else {
      riskValue = 20; // Low risk for stable tenure
    }

    return {
      factor: 'Tenure',
      weight: this.defaultConfig.attritionRiskWeights.tenure,
      value: riskValue,
      impact: tenureMonths >= 12 && tenureMonths <= 60 ? 'POSITIVE' : 'NEGATIVE',
      description: `${(tenureMonths / 12).toFixed(1)} years with company`
    };
  }

  private calculateSalaryGrowthFactor(payrolls: any[]): AttritionRiskFactor {
    if (payrolls.length < 2) {
      return {
        factor: 'Salary Growth',
        weight: this.defaultConfig.attritionRiskWeights.salaryGrowth,
        value: 60, // Moderate risk for insufficient data
        impact: 'NEUTRAL',
        description: 'Insufficient salary history for analysis'
      };
    }

    const latestSalary = Number(payrolls[0].netSalary);
    const oldestSalary = Number(payrolls[payrolls.length - 1].netSalary);
    const growthRate = ((latestSalary - oldestSalary) / oldestSalary) * 100;

    // Calculate risk based on salary growth (lack of growth = higher risk)
    const riskValue = Math.max(0, 50 - (growthRate * 2)); // 25% growth = 0 risk

    return {
      factor: 'Salary Growth',
      weight: this.defaultConfig.attritionRiskWeights.salaryGrowth,
      value: Math.min(100, riskValue),
      impact: growthRate >= 10 ? 'POSITIVE' : growthRate <= 0 ? 'NEGATIVE' : 'NEUTRAL',
      description: `${growthRate.toFixed(1)}% salary growth over period`
    };
  }

  private calculateGoalCompletionFactor(goals: any[]): AttritionRiskFactor {
    if (goals.length === 0) {
      return {
        factor: 'Goal Completion',
        weight: this.defaultConfig.attritionRiskWeights.goalCompletion,
        value: 50,
        impact: 'NEUTRAL',
        description: 'No goals set'
      };
    }

    const completedGoals = goals.filter(g => g.status === 'COMPLETED').length;
    const completionRate = (completedGoals / goals.length) * 100;
    
    // Calculate risk based on goal completion (low completion = higher risk)
    const riskValue = Math.max(0, 100 - completionRate);

    return {
      factor: 'Goal Completion',
      weight: this.defaultConfig.attritionRiskWeights.goalCompletion,
      value: riskValue,
      impact: completionRate >= 80 ? 'POSITIVE' : completionRate <= 40 ? 'NEGATIVE' : 'NEUTRAL',
      description: `${completionRate.toFixed(1)}% goal completion rate`
    };
  }

  private generateAttritionRecommendations(factors: AttritionRiskFactor[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    const performanceFactor = factors.find(f => f.factor === 'Performance Rating');
    if (performanceFactor && performanceFactor.impact === 'NEGATIVE') {
      recommendations.push('Schedule performance improvement plan and regular check-ins');
      recommendations.push('Provide additional training and development opportunities');
    }

    // Attendance-based recommendations
    const attendanceFactor = factors.find(f => f.factor === 'Attendance Score');
    if (attendanceFactor && attendanceFactor.impact === 'NEGATIVE') {
      recommendations.push('Discuss attendance concerns and potential underlying issues');
      recommendations.push('Consider flexible work arrangements if appropriate');
    }

    // Leave-based recommendations
    const leaveFactor = factors.find(f => f.factor === 'Leave Frequency');
    if (leaveFactor && leaveFactor.impact === 'NEGATIVE') {
      recommendations.push('Investigate potential burnout or work-life balance issues');
      recommendations.push('Review workload and consider redistribution');
    }

    // Tenure-based recommendations
    const tenureFactor = factors.find(f => f.factor === 'Tenure');
    if (tenureFactor && tenureFactor.value > 50) {
      if (tenureFactor.description.includes('years with company') && parseFloat(tenureFactor.description) < 1) {
        recommendations.push('Implement comprehensive onboarding and mentorship program');
        recommendations.push('Schedule regular check-ins during probation period');
      } else {
        recommendations.push('Discuss career advancement opportunities');
        recommendations.push('Consider role rotation or new challenges');
      }
    }

    // Salary-based recommendations
    const salaryFactor = factors.find(f => f.factor === 'Salary Growth');
    if (salaryFactor && salaryFactor.impact === 'NEGATIVE') {
      recommendations.push('Review compensation package and market benchmarking');
      recommendations.push('Discuss promotion opportunities and career path');
    }

    // Goal-based recommendations
    const goalFactor = factors.find(f => f.factor === 'Goal Completion');
    if (goalFactor && goalFactor.impact === 'NEGATIVE') {
      recommendations.push('Review goal setting process and ensure realistic targets');
      recommendations.push('Provide additional support and resources for goal achievement');
    }

    // Risk level specific recommendations
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push('Schedule immediate one-on-one meeting with manager');
      recommendations.push('Consider retention bonus or special recognition');
      recommendations.push('Conduct stay interview to understand concerns');
    }

    return recommendations;
  }

  // Performance Insights
  async generatePerformanceInsights(filters: PerformanceInsightFilterDto = {}): Promise<PerformanceInsight[]> {
    const { departmentId, employeeId, trend, minRating, maxRating, includeInactive = false } = filters;

    const whereClause: Prisma.EmployeeWhereInput = {
      isActive: includeInactive ? undefined : true
    };

    if (departmentId) whereClause.departmentId = departmentId;
    if (employeeId) whereClause.id = employeeId;

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        department: true,
        performanceReviews: {
          orderBy: { createdAt: 'desc' },
          take: 5 // Last 5 reviews for trend analysis
        },
        goals: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          }
        }
      }
    });

    const insights: PerformanceInsight[] = [];

    for (const employee of employees) {
      const insight = await this.generateEmployeePerformanceInsight(employee);
      
      // Apply filters
      if (trend && insight.overallTrend !== trend) continue;
      if (minRating !== undefined && insight.currentRating < minRating) continue;
      if (maxRating !== undefined && insight.currentRating > maxRating) continue;
      
      insights.push(insight);
    }

    return insights;
  }

  private async generateEmployeePerformanceInsight(employee: any): Promise<PerformanceInsight> {
    const reviews = employee.performanceReviews;
    const goals = employee.goals;

    // Calculate current and previous ratings
    const currentRating = reviews.length > 0 ? Number(reviews[0].overallRating) : 0;
    const previousRating = reviews.length > 1 ? Number(reviews[1].overallRating) : currentRating;
    const ratingChange = currentRating - previousRating;

    // Determine trend
    let overallTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    if (ratingChange > 0.2) overallTrend = 'IMPROVING';
    else if (ratingChange < -0.2) overallTrend = 'DECLINING';
    else overallTrend = 'STABLE';

    // Calculate goal completion rate
    const completedGoals = goals.filter((g: any) => g.status === 'COMPLETED').length;
    const goalCompletionRate = goals.length > 0 ? (completedGoals / goals.length) * 100 : 0;

    // Analyze strengths and improvement areas
    const { strengths, improvementAreas } = this.analyzePerformanceAreas(reviews, goals);

    // Generate recommendations
    const recommendations = this.generatePerformanceRecommendations(
      overallTrend, 
      currentRating, 
      goalCompletionRate, 
      improvementAreas
    );

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department.name,
      overallTrend,
      currentRating,
      previousRating,
      ratingChange,
      goalCompletionRate,
      strengths,
      improvementAreas,
      recommendations,
      lastReviewDate: reviews.length > 0 ? reviews[0].createdAt : new Date()
    };
  }

  private analyzePerformanceAreas(reviews: any[], goals: any[]): { strengths: string[], improvementAreas: string[] } {
    const strengths: string[] = [];
    const improvementAreas: string[] = [];

    // Analyze latest review feedback
    if (reviews.length > 0) {
      const latestReview = reviews[0];
      const rating = Number(latestReview.overallRating);

      if (rating >= 4.0) {
        strengths.push('Consistently high performance ratings');
      }
      if (rating < 3.0) {
        improvementAreas.push('Performance rating below expectations');
      }

      // Analyze achievements and goals from review
      if (latestReview.achievements) {
        const achievements = Array.isArray(latestReview.achievements) ? latestReview.achievements : [];
        if (achievements.length > 0) {
          strengths.push('Strong track record of achievements');
        }
      }
    }

    // Analyze goal completion patterns
    const completedGoals = goals.filter((g: any) => g.status === 'COMPLETED').length;
    const inProgressGoals = goals.filter((g: any) => g.status === 'IN_PROGRESS').length;
    const notStartedGoals = goals.filter((g: any) => g.status === 'NOT_STARTED').length;

    if (goals.length > 0) {
      if (completedGoals / goals.length >= 0.8) {
        strengths.push('Excellent goal completion rate');
      } else if (completedGoals / goals.length < 0.5) {
        improvementAreas.push('Low goal completion rate');
      }
    }

    if (notStartedGoals > inProgressGoals + completedGoals) {
      improvementAreas.push('Many goals remain unstarted');
    }

    // Default insights if no specific data
    if (strengths.length === 0 && reviews.length === 0) {
      improvementAreas.push('No recent performance reviews available');
    }

    return { strengths, improvementAreas };
  }

  private generatePerformanceRecommendations(
    trend: string, 
    currentRating: number, 
    goalCompletionRate: number, 
    improvementAreas: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Trend-based recommendations
    if (trend === 'DECLINING') {
      recommendations.push('Schedule immediate performance discussion');
      recommendations.push('Identify root causes of performance decline');
      recommendations.push('Develop performance improvement plan');
    } else if (trend === 'IMPROVING') {
      recommendations.push('Recognize and celebrate performance improvements');
      recommendations.push('Consider for stretch assignments or promotions');
    }

    // Rating-based recommendations
    if (currentRating < 3.0) {
      recommendations.push('Implement intensive coaching and support');
      recommendations.push('Set clear, achievable short-term goals');
    } else if (currentRating >= 4.0) {
      recommendations.push('Consider for leadership development programs');
      recommendations.push('Explore mentoring opportunities for others');
    }

    // Goal completion recommendations
    if (goalCompletionRate < 50) {
      recommendations.push('Review goal setting process and realistic targets');
      recommendations.push('Provide additional resources and support');
    } else if (goalCompletionRate >= 80) {
      recommendations.push('Set more challenging goals to drive growth');
    }

    // Improvement area specific recommendations
    if (improvementAreas.includes('No recent performance reviews available')) {
      recommendations.push('Schedule overdue performance review');
    }

    return recommendations;
  }

  async generateTeamPerformanceInsights(departmentId?: string): Promise<TeamPerformanceInsight[]> {
    const whereClause: Prisma.DepartmentWhereInput = {};
    if (departmentId) whereClause.id = departmentId;

    const departments = await this.prisma.department.findMany({
      where: whereClause,
      include: {
        employees: {
          where: { isActive: true },
          include: {
            performanceReviews: {
              orderBy: { createdAt: 'desc' },
              take: 2
            },
            goals: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                }
              }
            }
          }
        }
      }
    });

    const teamInsights: TeamPerformanceInsight[] = [];

    for (const department of departments) {
      const employees = department.employees;
      if (employees.length === 0) continue;

      // Calculate team metrics
      const employeesWithReviews = employees.filter(e => e.performanceReviews.length > 0);
      const totalRating = employeesWithReviews.reduce((sum, emp) => 
        sum + Number(emp.performanceReviews[0].overallRating), 0);
      const averageRating = employeesWithReviews.length > 0 ? totalRating / employeesWithReviews.length : 0;

      // Calculate rating trend
      let ratingTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
      const employeesWithTrendData = employees.filter(e => e.performanceReviews.length >= 2);
      if (employeesWithTrendData.length > 0) {
        const trendSum = employeesWithTrendData.reduce((sum, emp) => {
          const current = Number(emp.performanceReviews[0].overallRating);
          const previous = Number(emp.performanceReviews[1].overallRating);
          return sum + (current - previous);
        }, 0);
        const avgTrend = trendSum / employeesWithTrendData.length;
        
        if (avgTrend > 0.1) ratingTrend = 'IMPROVING';
        else if (avgTrend < -0.1) ratingTrend = 'DECLINING';
      }

      // Calculate goal completion rate
      const allGoals = employees.flatMap(e => e.goals);
      const completedGoals = allGoals.filter(g => g.status === 'COMPLETED').length;
      const goalCompletionRate = allGoals.length > 0 ? (completedGoals / allGoals.length) * 100 : 0;

      // Identify top and under performers
      const performanceSummaries = employees
        .filter(e => e.performanceReviews.length > 0)
        .map(e => ({
          employeeId: e.id,
          employeeName: `${e.firstName} ${e.lastName}`,
          currentRating: Number(e.performanceReviews[0].overallRating),
          goalCompletionRate: e.goals.length > 0 ? 
            (e.goals.filter(g => g.status === 'COMPLETED').length / e.goals.length) * 100 : 0,
          lastReviewDate: e.performanceReviews[0].createdAt
        }))
        .sort((a, b) => b.currentRating - a.currentRating);

      const topPerformers = performanceSummaries.slice(0, 3);
      const underPerformers = performanceSummaries
        .filter(p => p.currentRating < this.defaultConfig.performanceThresholds.lowPerformanceRating)
        .slice(0, 3);

      // Count reviews
      const reviewsCompleted = employeesWithReviews.length;
      const pendingReviews = employees.length - reviewsCompleted;

      teamInsights.push({
        departmentId: department.id,
        departmentName: department.name,
        averageRating,
        ratingTrend,
        topPerformers,
        underPerformers,
        goalCompletionRate,
        totalEmployees: employees.length,
        reviewsCompleted,
        pendingReviews
      });
    }

    return teamInsights;
  }

  // Leave Pattern Analysis
  async analyzeLeavePatterns(filters: LeavePatternFilterDto = {}): Promise<LeavePatternAnalysis[]> {
    const { departmentId, employeeId, leaveType, burnoutRisk, includeInactive = false } = filters;

    const whereClause: Prisma.EmployeeWhereInput = {
      isActive: includeInactive ? undefined : true
    };

    if (departmentId) whereClause.departmentId = departmentId;
    if (employeeId) whereClause.id = employeeId;

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        department: true,
        leaves: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
            }
          },
          include: {
            leaveType: true
          }
        }
      }
    });

    const analyses: LeavePatternAnalysis[] = [];

    for (const employee of employees) {
      const analysis = this.generateLeavePatternAnalysis(employee);
      
      // Apply filters
      if (burnoutRisk && analysis.burnoutRisk !== burnoutRisk) continue;
      
      analyses.push(analysis);
    }

    return analyses;
  }

  private generateLeavePatternAnalysis(employee: any): LeavePatternAnalysis {
    const leaves = employee.leaves;
    const totalLeaveDays = leaves.reduce((sum: number, leave: any) => sum + Number(leave.days), 0);
    const leaveFrequency = leaves.length / 12; // per month

    // Calculate average leave duration
    const averageLeaveDuration = leaves.length > 0 ? totalLeaveDays / leaves.length : 0;

    // Analyze leave types
    const leaveTypeMap = new Map<string, { days: number, frequency: number }>();
    leaves.forEach((leave: any) => {
      const typeName = leave.leaveType.name;
      const existing = leaveTypeMap.get(typeName) || { days: 0, frequency: 0 };
      leaveTypeMap.set(typeName, {
        days: existing.days + Number(leave.days),
        frequency: existing.frequency + 1
      });
    });

    const leaveTypes = Array.from(leaveTypeMap.entries()).map(([type, data]) => ({
      leaveType: type,
      daysUsed: data.days,
      frequency: data.frequency,
      percentage: totalLeaveDays > 0 ? (data.days / totalLeaveDays) * 100 : 0
    }));

    // Analyze seasonal patterns
    const monthlyLeaves = new Array(12).fill(0).map((_, index) => ({
      month: index + 1,
      monthName: new Date(2024, index, 1).toLocaleString('default', { month: 'long' }),
      days: 0,
      frequency: 0
    }));

    leaves.forEach((leave: any) => {
      const month = new Date(leave.startDate).getMonth();
      monthlyLeaves[month].days += Number(leave.days);
      monthlyLeaves[month].frequency += 1;
    });

    const seasonalPatterns = monthlyLeaves.map(month => ({
      ...month,
      averageDays: month.frequency > 0 ? month.days / month.frequency : 0
    }));

    // Detect anomalies
    const anomalies = this.detectLeaveAnomalies(leaves, leaveFrequency, averageLeaveDuration);

    // Assess burnout risk
    let burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    if (totalLeaveDays >= this.defaultConfig.leaveThresholds.burnoutRiskThreshold) {
      burnoutRisk = 'HIGH';
    } else if (totalLeaveDays >= this.defaultConfig.leaveThresholds.burnoutRiskThreshold * 0.7) {
      burnoutRisk = 'MEDIUM';
    } else {
      burnoutRisk = 'LOW';
    }

    // Generate recommendations
    const recommendations = this.generateLeaveRecommendations(
      totalLeaveDays, 
      leaveFrequency, 
      anomalies, 
      burnoutRisk
    );

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department.name,
      totalLeaveDays,
      leaveFrequency,
      averageLeaveDuration,
      leaveTypes,
      seasonalPatterns,
      anomalies,
      burnoutRisk,
      recommendations
    };
  }

  private detectLeaveAnomalies(leaves: any[], frequency: number, avgDuration: number): any[] {
    const anomalies: any[] = [];

    // Excessive frequency anomaly
    if (frequency > this.defaultConfig.leaveThresholds.excessiveFrequency) {
      anomalies.push({
        type: 'EXCESSIVE_FREQUENCY',
        description: `Taking leaves too frequently (${frequency.toFixed(1)} per month)`,
        severity: frequency > this.defaultConfig.leaveThresholds.excessiveFrequency * 1.5 ? 'HIGH' : 'MEDIUM',
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      });
    }

    // Long duration anomaly
    const longLeaves = leaves.filter((leave: any) => Number(leave.days) > this.defaultConfig.leaveThresholds.longDuration);
    if (longLeaves.length > 0) {
      anomalies.push({
        type: 'LONG_DURATION',
        description: `${longLeaves.length} leaves longer than ${this.defaultConfig.leaveThresholds.longDuration} days`,
        severity: longLeaves.length > 2 ? 'HIGH' : 'MEDIUM',
        dateRange: {
          start: new Date(Math.min(...longLeaves.map((l: any) => new Date(l.startDate).getTime()))),
          end: new Date(Math.max(...longLeaves.map((l: any) => new Date(l.endDate).getTime())))
        }
      });
    }

    // Monday/Friday pattern detection
    const mondayFridayLeaves = leaves.filter((leave: any) => {
      const startDay = new Date(leave.startDate).getDay();
      const endDay = new Date(leave.endDate).getDay();
      return startDay === 1 || endDay === 5; // Monday = 1, Friday = 5
    });

    if (mondayFridayLeaves.length > leaves.length * 0.6) {
      anomalies.push({
        type: 'MONDAY_FRIDAY_PATTERN',
        description: 'Frequent Monday/Friday leaves suggesting weekend extension pattern',
        severity: 'MEDIUM',
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      });
    }

    return anomalies;
  }

  private generateLeaveRecommendations(
    totalDays: number, 
    frequency: number, 
    anomalies: any[], 
    burnoutRisk: string
  ): string[] {
    const recommendations: string[] = [];

    if (burnoutRisk === 'HIGH') {
      recommendations.push('Immediate wellness check and workload review required');
      recommendations.push('Consider temporary workload reduction');
    } else if (burnoutRisk === 'MEDIUM') {
      recommendations.push('Monitor workload and stress levels closely');
    }

    if (frequency > this.defaultConfig.leaveThresholds.excessiveFrequency) {
      recommendations.push('Investigate underlying causes of frequent leave requests');
      recommendations.push('Consider flexible work arrangements');
    }

    anomalies.forEach((anomaly: any) => {
      switch (anomaly.type) {
        case 'MONDAY_FRIDAY_PATTERN':
          recommendations.push('Discuss work-life balance and weekend extension patterns');
          break;
        case 'LONG_DURATION':
          recommendations.push('Review reasons for extended leave periods');
          break;
        case 'EXCESSIVE_FREQUENCY':
          recommendations.push('Implement leave counseling and support');
          break;
      }
    });

    return recommendations;
  }

  // Attendance Anomaly Detection
  async detectAttendanceAnomalies(filters: AttendanceAnomalyFilterDto = {}): Promise<AttendanceAnomalyDetection[]> {
    const { departmentId, employeeId, anomalyType, severity, includeInactive = false } = filters;

    const whereClause: Prisma.EmployeeWhereInput = {
      isActive: includeInactive ? undefined : true
    };

    if (departmentId) whereClause.departmentId = departmentId;
    if (employeeId) whereClause.id = employeeId;

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        department: true,
        attendances: {
          where: {
            date: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
          }
        }
      }
    });

    const detections: AttendanceAnomalyDetection[] = [];

    for (const employee of employees) {
      const detection = this.generateAttendanceAnomalyDetection(employee);
      
      // Apply filters
      if (anomalyType && !detection.anomalies.some(a => a.type === anomalyType)) continue;
      if (severity && !detection.anomalies.some(a => a.severity === severity)) continue;
      
      detections.push(detection);
    }

    return detections;
  }

  private generateAttendanceAnomalyDetection(employee: any): AttendanceAnomalyDetection {
    const attendances = employee.attendances;
    const anomalies: any[] = [];
    const patterns: any[] = [];

    // Calculate attendance score
    const totalDays = attendances.length;
    const presentDays = attendances.filter((a: any) => 
      a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME'
    ).length;
    const lateDays = attendances.filter((a: any) => a.status === 'LATE').length;
    const absentDays = attendances.filter((a: any) => a.status === 'ABSENT').length;

    const attendanceScore = totalDays > 0 ? 
      ((presentDays + (lateDays * 0.7)) / totalDays) * 100 : 100;

    // Detect frequent late arrivals
    const lateRate = totalDays > 0 ? (lateDays / totalDays) * 100 : 0;
    if (lateRate > 20) {
      anomalies.push({
        type: 'FREQUENT_LATE',
        description: `Late arrival rate: ${lateRate.toFixed(1)}%`,
        frequency: lateDays,
        severity: lateRate > 40 ? 'HIGH' : lateRate > 30 ? 'MEDIUM' : 'LOW',
        dateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        impact: 'Affects team productivity and meeting schedules'
      });
    }

    // Detect absenteeism patterns
    const absenteeismRate = totalDays > 0 ? (absentDays / totalDays) * 100 : 0;
    if (absenteeismRate > 10) {
      anomalies.push({
        type: 'ABSENTEEISM',
        description: `High absenteeism rate: ${absenteeismRate.toFixed(1)}%`,
        frequency: absentDays,
        severity: absenteeismRate > 25 ? 'HIGH' : absenteeismRate > 15 ? 'MEDIUM' : 'LOW',
        dateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        impact: 'Disrupts workflow and increases workload on team members'
      });
    }

    // Detect irregular hours
    const attendancesWithHours = attendances.filter((a: any) => a.totalHours);
    if (attendancesWithHours.length > 0) {
      const avgHours = attendancesWithHours.reduce((sum: number, a: any) => 
        sum + Number(a.totalHours), 0) / attendancesWithHours.length;
      
      const irregularDays = attendancesWithHours.filter((a: any) => {
        const hours = Number(a.totalHours);
        return Math.abs(hours - avgHours) > 2; // More than 2 hours deviation
      }).length;

      if (irregularDays > attendancesWithHours.length * 0.3) {
        anomalies.push({
          type: 'IRREGULAR_HOURS',
          description: `Irregular working hours in ${irregularDays} days`,
          frequency: irregularDays,
          severity: irregularDays > attendancesWithHours.length * 0.5 ? 'HIGH' : 'MEDIUM',
          dateRange: {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            end: new Date()
          },
          impact: 'May indicate work-life balance issues or workload problems'
        });
      }
    }

    // Identify positive patterns
    if (lateRate < 5 && absenteeismRate < 5) {
      patterns.push({
        pattern: 'Excellent Punctuality',
        frequency: presentDays,
        description: 'Consistently on time with minimal absences',
        isPositive: true
      });
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    const highSeverityAnomalies = anomalies.filter(a => a.severity === 'HIGH').length;
    if (highSeverityAnomalies > 0 || attendanceScore < 70) {
      riskLevel = 'HIGH';
    } else if (anomalies.length > 1 || attendanceScore < 85) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // Generate recommendations
    const recommendations = this.generateAttendanceRecommendations(anomalies, attendanceScore);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department.name,
      anomalies,
      attendanceScore,
      patterns,
      recommendations,
      riskLevel
    };
  }

  private generateAttendanceRecommendations(anomalies: any[], score: number): string[] {
    const recommendations: string[] = [];

    if (score < 70) {
      recommendations.push('Immediate intervention required - schedule urgent meeting');
      recommendations.push('Develop attendance improvement plan with clear expectations');
    } else if (score < 85) {
      recommendations.push('Monitor attendance closely and provide support');
    }

    anomalies.forEach((anomaly: any) => {
      switch (anomaly.type) {
        case 'FREQUENT_LATE':
          recommendations.push('Discuss commute challenges and flexible start times');
          recommendations.push('Review morning routine and potential barriers');
          break;
        case 'ABSENTEEISM':
          recommendations.push('Investigate health or personal issues affecting attendance');
          recommendations.push('Consider employee assistance programs');
          break;
        case 'IRREGULAR_HOURS':
          recommendations.push('Review workload distribution and time management');
          recommendations.push('Discuss work-life balance and stress management');
          break;
      }
    });

    return recommendations;
  }

  // Dashboard Data Aggregation
  async generateDashboardAnalytics(filters: AnalyticsFilterDto = {}): Promise<DashboardAnalytics> {
    const { departmentId, dateFrom, dateTo, period = 'MONTH' } = filters;

    // Calculate date range based on period
    const endDate = dateTo || new Date();
    let startDate = dateFrom;
    if (!startDate) {
      switch (period) {
        case 'WEEK':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'QUARTER':
          startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'YEAR':
          startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default: // MONTH
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    // Generate all analytics components in parallel
    const [
      overview,
      attendance,
      leave,
      performance,
      recruitment,
      attrition,
      trends,
      alerts
    ] = await Promise.all([
      this.generateOverviewMetrics(departmentId, startDate, endDate),
      this.generateAttendanceMetrics(departmentId, startDate, endDate),
      this.generateLeaveMetrics(departmentId, startDate, endDate),
      this.generatePerformanceMetrics(departmentId, startDate, endDate),
      this.generateRecruitmentMetrics(departmentId, startDate, endDate),
      this.generateAttritionMetrics(departmentId, startDate, endDate),
      this.generateTrendAnalysis(departmentId, period),
      this.generateSystemAlerts(departmentId)
    ]);

    return {
      overview,
      attendance,
      leave,
      performance,
      recruitment,
      attrition,
      trends,
      alerts
    };
  }

  private async generateOverviewMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<OverviewMetrics> {
    const whereClause: Prisma.EmployeeWhereInput = {};
    if (departmentId) whereClause.departmentId = departmentId;

    const [totalEmployees, activeEmployees, departments] = await Promise.all([
      this.prisma.employee.count({ where: whereClause }),
      this.prisma.employee.count({ where: { ...whereClause, isActive: true } }),
      this.prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true }
          }
        }
      })
    ]);

    // Calculate new hires and departures in the period
    const newHires = await this.prisma.employee.count({
      where: {
        ...whereClause,
        dateOfJoining: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate departures (employees who became inactive in the period)
    const departures = await this.prisma.employee.count({
      where: {
        ...whereClause,
        isActive: false,
        updatedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Calculate employee growth rate
    const employeeGrowthRate = totalEmployees > 0 ? ((newHires - departures) / totalEmployees) * 100 : 0;

    // Calculate average tenure
    const employees = await this.prisma.employee.findMany({
      where: { ...whereClause, isActive: true },
      select: { dateOfJoining: true }
    });

    const averageTenure = employees.length > 0 ? 
      employees.reduce((sum, emp) => {
        const tenure = (Date.now() - emp.dateOfJoining.getTime()) / (1000 * 60 * 60 * 24 * 365);
        return sum + tenure;
      }, 0) / employees.length : 0;

    // Department distribution
    const departmentDistribution = departments.map(dept => ({
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount: dept.employees.length,
      percentage: activeEmployees > 0 ? (dept.employees.length / activeEmployees) * 100 : 0
    }));

    return {
      totalEmployees,
      activeEmployees,
      newHires,
      departures,
      employeeGrowthRate,
      averageTenure,
      departmentDistribution
    };
  }

  private async generateAttendanceMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<AttendanceMetrics> {
    const employeeWhere: Prisma.EmployeeWhereInput = { isActive: true };
    if (departmentId) employeeWhere.departmentId = departmentId;

    const attendanceWhere: Prisma.AttendanceWhereInput = {
      date: { gte: startDate, lte: endDate }
    };

    const [attendances, departments] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          ...attendanceWhere,
          employee: employeeWhere
        },
        include: {
          employee: {
            include: { department: true }
          }
        }
      }),
      this.prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true },
            include: {
              attendances: {
                where: attendanceWhere
              }
            }
          }
        }
      })
    ]);

    const totalRecords = attendances.length;
    const presentRecords = attendances.filter(a => 
      a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME'
    ).length;
    const onTimeRecords = attendances.filter(a => a.status === 'PRESENT').length;
    const absentRecords = attendances.filter(a => a.status === 'ABSENT').length;

    const overallAttendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 100;
    const onTimeRate = totalRecords > 0 ? (onTimeRecords / totalRecords) * 100 : 100;
    const absenteeismRate = totalRecords > 0 ? (absentRecords / totalRecords) * 100 : 0;

    // Calculate average working hours and overtime
    const recordsWithHours = attendances.filter(a => a.totalHours);
    const averageWorkingHours = recordsWithHours.length > 0 ?
      recordsWithHours.reduce((sum, a) => sum + Number(a.totalHours), 0) / recordsWithHours.length : 0;

    const overtimeHours = recordsWithHours.reduce((sum, a) => sum + Number(a.overtime || 0), 0);

    // Generate trend data (simplified - would need more complex logic for real trends)
    const attendanceTrend: TrendData[] = [];

    // Department attendance metrics
    const departmentAttendance = departments.map(dept => {
      const deptAttendances = dept.employees.flatMap(emp => emp.attendances);
      const deptTotal = deptAttendances.length;
      const deptPresent = deptAttendances.filter(a => 
        a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME'
      ).length;
      const deptOnTime = deptAttendances.filter(a => a.status === 'PRESENT').length;
      const deptHours = deptAttendances.filter(a => a.totalHours);
      const deptAvgHours = deptHours.length > 0 ?
        deptHours.reduce((sum, a) => sum + Number(a.totalHours), 0) / deptHours.length : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        attendanceRate: deptTotal > 0 ? (deptPresent / deptTotal) * 100 : 100,
        onTimeRate: deptTotal > 0 ? (deptOnTime / deptTotal) * 100 : 100,
        averageHours: deptAvgHours
      };
    });

    return {
      overallAttendanceRate,
      onTimeRate,
      absenteeismRate,
      averageWorkingHours,
      overtimeHours,
      attendanceTrend,
      departmentAttendance
    };
  }

  private async generateLeaveMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<LeaveMetrics> {
    const employeeWhere: Prisma.EmployeeWhereInput = { isActive: true };
    if (departmentId) employeeWhere.departmentId = departmentId;

    const leaveWhere: Prisma.LeaveWhereInput = {
      startDate: { gte: startDate, lte: endDate }
    };

    const [leaves, leaveTypes, departments] = await Promise.all([
      this.prisma.leave.findMany({
        where: {
          ...leaveWhere,
          employee: employeeWhere
        },
        include: {
          leaveType: true,
          employee: { include: { department: true } }
        }
      }),
      this.prisma.leaveType.findMany(),
      this.prisma.department.findMany({
        include: {
          employees: {
            where: { isActive: true },
            include: {
              leaves: {
                where: leaveWhere,
                include: { leaveType: true }
              }
            }
          }
        }
      })
    ]);

    const totalLeavesTaken = leaves.length;
    const totalLeaveDays = leaves.reduce((sum, leave) => sum + Number(leave.days), 0);
    const averageLeaveDays = totalLeavesTaken > 0 ? totalLeaveDays / totalLeavesTaken : 0;
    const pendingLeaves = leaves.filter(l => l.status === 'PENDING').length;

    // Calculate leave utilization rate (assuming 25 days annual leave per employee)
    const activeEmployees = await this.prisma.employee.count({ where: employeeWhere });
    const totalAvailableLeaves = activeEmployees * 25;
    const leaveUtilizationRate = totalAvailableLeaves > 0 ? (totalLeaveDays / totalAvailableLeaves) * 100 : 0;

    // Leave type distribution
    const leaveTypeMap = new Map<string, { totalDays: number, frequency: number }>();
    leaves.forEach(leave => {
      const typeName = leave.leaveType.name;
      const existing = leaveTypeMap.get(typeName) || { totalDays: 0, frequency: 0 };
      leaveTypeMap.set(typeName, {
        totalDays: existing.totalDays + Number(leave.days),
        frequency: existing.frequency + 1
      });
    });

    const leaveTypeDistribution = Array.from(leaveTypeMap.entries()).map(([type, data]) => ({
      leaveType: type,
      totalDays: data.totalDays,
      frequency: data.frequency,
      percentage: totalLeaveDays > 0 ? (data.totalDays / totalLeaveDays) * 100 : 0
    }));

    // Department leave usage
    const departmentLeaveUsage = departments.map(dept => {
      const deptLeaves = dept.employees.flatMap(emp => emp.leaves);
      const deptTotalDays = deptLeaves.reduce((sum, leave) => sum + Number(leave.days), 0);
      const deptEmployeeCount = dept.employees.length;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalLeaveDays: deptTotalDays,
        averageDaysPerEmployee: deptEmployeeCount > 0 ? deptTotalDays / deptEmployeeCount : 0,
        utilizationRate: deptEmployeeCount > 0 ? (deptTotalDays / (deptEmployeeCount * 25)) * 100 : 0
      };
    });

    return {
      totalLeavesTaken,
      averageLeaveDays,
      leaveUtilizationRate,
      pendingLeaves,
      leaveTypeDistribution,
      leaveTrend: [], // Simplified
      departmentLeaveUsage
    };
  }

  private async generatePerformanceMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<PerformanceMetrics> {
    const employeeWhere: Prisma.EmployeeWhereInput = { isActive: true };
    if (departmentId) employeeWhere.departmentId = departmentId;

    const [reviews, goals] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          reviewee: employeeWhere
        },
        include: {
          reviewee: true
        }
      }),
      this.prisma.goal.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          employee: employeeWhere
        },
        include: {
          employee: true
        }
      })
    ]);

    const reviewsCompleted = reviews.filter(r => r.status === 'APPROVED').length;
    const pendingReviews = reviews.filter(r => r.status === 'DRAFT' || r.status === 'SUBMITTED').length;

    // Calculate average rating
    const completedReviews = reviews.filter(r => r.status === 'APPROVED');
    const averageRating = completedReviews.length > 0 ?
      completedReviews.reduce((sum, r) => sum + Number(r.overallRating), 0) / completedReviews.length : 0;

    // Rating distribution
    const ratingCounts = new Map<number, number>();
    completedReviews.forEach(review => {
      const rating = Math.floor(Number(review.overallRating));
      ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1);
    });

    const ratingDistribution = Array.from(ratingCounts.entries()).map(([rating, count]) => ({
      rating,
      count,
      percentage: completedReviews.length > 0 ? (count / completedReviews.length) * 100 : 0
    }));

    // Goal completion rate
    const completedGoals = goals.filter((g: any) => g.status === 'COMPLETED').length;
    const goalCompletionRate = goals.length > 0 ? (completedGoals / goals.length) * 100 : 0;

    // Top performers and improvement needed
    const employeePerformance = completedReviews.map(review => ({
      employeeId: review.reviewee.id,
      employeeName: `${review.reviewee.firstName} ${review.reviewee.lastName}`,
      currentRating: Number(review.overallRating),
      goalCompletionRate: 0, // Would need to calculate per employee
      lastReviewDate: review.createdAt
    }));

    const topPerformers = employeePerformance
      .filter(p => p.currentRating >= 4.0)
      .sort((a, b) => b.currentRating - a.currentRating)
      .slice(0, 5);

    const improvementNeeded = employeePerformance
      .filter(p => p.currentRating < 3.0)
      .sort((a, b) => a.currentRating - b.currentRating)
      .slice(0, 5);

    return {
      averageRating,
      ratingDistribution,
      goalCompletionRate,
      reviewsCompleted,
      pendingReviews,
      performanceTrend: [], // Simplified
      topPerformers,
      improvementNeeded
    };
  }

  private async generateRecruitmentMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<RecruitmentMetrics> {
    const [candidates, interviews, applications] = await Promise.all([
      this.prisma.candidate.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      this.prisma.interview.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      this.prisma.jobApplication.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ]);

    const totalCandidates = candidates.length;
    const newCandidates = candidates.filter(c => c.status === 'NEW').length;
    const interviewsScheduled = interviews.filter(i => i.status === 'SCHEDULED').length;
    const interviewsCompleted = interviews.filter(i => i.status === 'COMPLETED').length;
    const hires = candidates.filter(c => c.status === 'HIRED').length;
    const offersExtended = candidates.filter(c => c.status === 'SELECTED').length;

    const conversionRate = totalCandidates > 0 ? (hires / totalCandidates) * 100 : 0;

    // Calculate average time to hire (simplified)
    const hiredCandidates = candidates.filter(c => c.status === 'HIRED');
    const timeToHire = hiredCandidates.length > 0 ?
      hiredCandidates.reduce((sum, c) => {
        const days = (Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0) / hiredCandidates.length : 0;

    // Source effectiveness
    const sourceMap = new Map<string, { candidates: number, hires: number }>();
    candidates.forEach(candidate => {
      const source = candidate.source || 'Unknown';
      const existing = sourceMap.get(source) || { candidates: 0, hires: 0 };
      sourceMap.set(source, {
        candidates: existing.candidates + 1,
        hires: existing.hires + (candidate.status === 'HIRED' ? 1 : 0)
      });
    });

    const sourceEffectiveness = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      candidates: data.candidates,
      hires: data.hires,
      conversionRate: data.candidates > 0 ? (data.hires / data.candidates) * 100 : 0
    }));

    return {
      totalCandidates,
      newCandidates,
      interviewsScheduled,
      interviewsCompleted,
      offersExtended,
      hires,
      conversionRate,
      timeToHire,
      sourceEffectiveness
    };
  }

  private async generateAttritionMetrics(departmentId?: string, startDate?: Date, endDate?: Date): Promise<AttritionMetrics> {
    // This would integrate with the attrition risk scoring
    const attritionRisks = await this.calculateAttritionRisk({ departmentId });
    
    const totalEmployees = attritionRisks.length;
    const highRiskEmployees = attritionRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
    const averageAttritionRisk = totalEmployees > 0 ?
      attritionRisks.reduce((sum, r) => sum + r.riskScore, 0) / totalEmployees : 0;

    // Calculate actual attrition (employees who left)
    const departures = await this.prisma.employee.count({
      where: {
        departmentId,
        isActive: false,
        updatedAt: { gte: startDate, lte: endDate }
      }
    });

    const attritionRate = totalEmployees > 0 ? (departures / totalEmployees) * 100 : 0;

    return {
      attritionRate,
      voluntaryAttrition: attritionRate * 0.8, // Simplified assumption
      involuntaryAttrition: attritionRate * 0.2, // Simplified assumption
      averageAttritionRisk,
      highRiskEmployees,
      departmentAttrition: [], // Would need department-specific calculation
      attritionTrend: [] // Simplified
    };
  }

  private async generateTrendAnalysis(departmentId: string | undefined, period: string): Promise<TrendAnalysis> {
    // Simplified trend analysis - would need more complex time-series data
    return {
      employeeGrowth: [],
      attendanceTrend: [],
      leaveTrend: [],
      performanceTrend: [],
      attritionTrend: []
    };
  }

  private async generateSystemAlerts(departmentId?: string): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // Generate alerts based on analytics
    const attritionRisks = await this.calculateAttritionRisk({ departmentId, riskLevel: 'HIGH' });
    if (attritionRisks.length > 0) {
      alerts.push({
        id: `attrition-${Date.now()}`,
        type: 'ATTRITION_RISK',
        severity: 'HIGH',
        title: 'High Attrition Risk Detected',
        description: `${attritionRisks.length} employees identified with high attrition risk`,
        affectedEmployees: attritionRisks.map(r => r.employeeId),
        recommendations: ['Schedule retention meetings', 'Review compensation packages'],
        createdAt: new Date(),
        isRead: false
      });
    }

    return alerts;
  }
}

export default AnalyticsService; 