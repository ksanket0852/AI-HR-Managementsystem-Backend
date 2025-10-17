// Smart Analytics DTOs and Types

export interface AttritionRiskScore {
  employeeId: string;
  employeeName: string;
  department: string;
  riskScore: number; // 0-100 (100 = highest risk)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: AttritionRiskFactor[];
  recommendations: string[];
  lastUpdated: Date;
}

export interface AttritionRiskFactor {
  factor: string;
  weight: number;
  value: number;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  description: string;
}

export interface PerformanceInsight {
  employeeId: string;
  employeeName: string;
  department: string;
  overallTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  currentRating: number;
  previousRating: number;
  ratingChange: number;
  goalCompletionRate: number;
  strengths: string[];
  improvementAreas: string[];
  recommendations: string[];
  lastReviewDate: Date;
}

export interface TeamPerformanceInsight {
  departmentId: string;
  departmentName: string;
  averageRating: number;
  ratingTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  topPerformers: EmployeePerformanceSummary[];
  underPerformers: EmployeePerformanceSummary[];
  goalCompletionRate: number;
  totalEmployees: number;
  reviewsCompleted: number;
  pendingReviews: number;
}

export interface EmployeePerformanceSummary {
  employeeId: string;
  employeeName: string;
  currentRating: number;
  goalCompletionRate: number;
  lastReviewDate: Date;
}

export interface LeavePatternAnalysis {
  employeeId: string;
  employeeName: string;
  department: string;
  totalLeaveDays: number;
  leaveFrequency: number; // leaves per month
  averageLeaveDuration: number;
  leaveTypes: LeaveTypeUsage[];
  seasonalPatterns: SeasonalLeavePattern[];
  anomalies: LeaveAnomaly[];
  burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: string[];
}

export interface LeaveTypeUsage {
  leaveType: string;
  daysUsed: number;
  frequency: number;
  percentage: number;
}

export interface SeasonalLeavePattern {
  month: number;
  monthName: string;
  averageDays: number;
  frequency: number;
}

export interface LeaveAnomaly {
  type: 'EXCESSIVE_FREQUENCY' | 'LONG_DURATION' | 'PATTERN_BREAK' | 'MONDAY_FRIDAY_PATTERN';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface AttendanceAnomalyDetection {
  employeeId: string;
  employeeName: string;
  department: string;
  anomalies: AttendanceAnomaly[];
  attendanceScore: number; // 0-100 (100 = perfect attendance)
  patterns: AttendancePattern[];
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AttendanceAnomaly {
  type: 'FREQUENT_LATE' | 'EARLY_DEPARTURE' | 'EXCESSIVE_BREAKS' | 'IRREGULAR_HOURS' | 'ABSENTEEISM';
  description: string;
  frequency: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  dateRange: {
    start: Date;
    end: Date;
  };
  impact: string;
}

export interface AttendancePattern {
  pattern: string;
  frequency: number;
  description: string;
  isPositive: boolean;
}

export interface DashboardAnalytics {
  overview: OverviewMetrics;
  attendance: AttendanceMetrics;
  leave: LeaveMetrics;
  performance: PerformanceMetrics;
  recruitment: RecruitmentMetrics;
  attrition: AttritionMetrics;
  trends: TrendAnalysis;
  alerts: SystemAlert[];
}

export interface OverviewMetrics {
  totalEmployees: number;
  activeEmployees: number;
  newHires: number;
  departures: number;
  employeeGrowthRate: number;
  averageTenure: number;
  departmentDistribution: DepartmentMetric[];
}

export interface DepartmentMetric {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  percentage: number;
}

export interface AttendanceMetrics {
  overallAttendanceRate: number;
  onTimeRate: number;
  absenteeismRate: number;
  averageWorkingHours: number;
  overtimeHours: number;
  attendanceTrend: TrendData[];
  departmentAttendance: DepartmentAttendanceMetric[];
}

export interface DepartmentAttendanceMetric {
  departmentId: string;
  departmentName: string;
  attendanceRate: number;
  onTimeRate: number;
  averageHours: number;
}

export interface LeaveMetrics {
  totalLeavesTaken: number;
  averageLeaveDays: number;
  leaveUtilizationRate: number;
  pendingLeaves: number;
  leaveTypeDistribution: LeaveTypeMetric[];
  leaveTrend: TrendData[];
  departmentLeaveUsage: DepartmentLeaveMetric[];
}

export interface LeaveTypeMetric {
  leaveType: string;
  totalDays: number;
  frequency: number;
  percentage: number;
}

export interface DepartmentLeaveMetric {
  departmentId: string;
  departmentName: string;
  totalLeaveDays: number;
  averageDaysPerEmployee: number;
  utilizationRate: number;
}

export interface PerformanceMetrics {
  averageRating: number;
  ratingDistribution: RatingDistribution[];
  goalCompletionRate: number;
  reviewsCompleted: number;
  pendingReviews: number;
  performanceTrend: TrendData[];
  topPerformers: EmployeePerformanceSummary[];
  improvementNeeded: EmployeePerformanceSummary[];
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface RecruitmentMetrics {
  totalCandidates: number;
  newCandidates: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  offersExtended: number;
  hires: number;
  conversionRate: number;
  timeToHire: number;
  sourceEffectiveness: SourceMetric[];
}

export interface SourceMetric {
  source: string;
  candidates: number;
  hires: number;
  conversionRate: number;
}

export interface AttritionMetrics {
  attritionRate: number;
  voluntaryAttrition: number;
  involuntaryAttrition: number;
  averageAttritionRisk: number;
  highRiskEmployees: number;
  departmentAttrition: DepartmentAttritionMetric[];
  attritionTrend: TrendData[];
}

export interface DepartmentAttritionMetric {
  departmentId: string;
  departmentName: string;
  attritionRate: number;
  averageRiskScore: number;
  highRiskCount: number;
}

export interface TrendAnalysis {
  employeeGrowth: TrendData[];
  attendanceTrend: TrendData[];
  leaveTrend: TrendData[];
  performanceTrend: TrendData[];
  attritionTrend: TrendData[];
}

export interface TrendData {
  period: string;
  value: number;
  change: number;
  changePercentage: number;
}

export interface SystemAlert {
  id: string;
  type: 'ATTRITION_RISK' | 'ATTENDANCE_ANOMALY' | 'LEAVE_PATTERN' | 'PERFORMANCE_DECLINE' | 'RECRUITMENT_DELAY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  affectedEmployees: string[];
  recommendations: string[];
  createdAt: Date;
  isRead: boolean;
}

export interface AnalyticsFilterDto {
  departmentId?: string;
  employeeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  period?: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  includeInactive?: boolean;
}

export interface AttritionRiskFilterDto extends AnalyticsFilterDto {
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  minRiskScore?: number;
  maxRiskScore?: number;
}

export interface PerformanceInsightFilterDto extends AnalyticsFilterDto {
  trend?: 'IMPROVING' | 'DECLINING' | 'STABLE';
  minRating?: number;
  maxRating?: number;
}

export interface LeavePatternFilterDto extends AnalyticsFilterDto {
  leaveType?: string;
  burnoutRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  anomalyType?: string;
}

export interface AttendanceAnomalyFilterDto extends AnalyticsFilterDto {
  anomalyType?: 'FREQUENT_LATE' | 'EARLY_DEPARTURE' | 'EXCESSIVE_BREAKS' | 'IRREGULAR_HOURS' | 'ABSENTEEISM';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  minAttendanceScore?: number;
}

export interface AnalyticsConfigDto {
  attritionRiskWeights: {
    performanceRating: number;
    attendanceScore: number;
    leaveFrequency: number;
    tenure: number;
    salaryGrowth: number;
    goalCompletion: number;
  };
  attendanceThresholds: {
    lateThreshold: number; // minutes
    earlyDepartureThreshold: number; // minutes
    excessiveBreakThreshold: number; // minutes
    minimumWorkHours: number;
  };
  leaveThresholds: {
    excessiveFrequency: number; // leaves per month
    longDuration: number; // days
    burnoutRiskThreshold: number; // total days per year
  };
  performanceThresholds: {
    lowPerformanceRating: number;
    highPerformanceRating: number;
    goalCompletionThreshold: number;
  };
} 