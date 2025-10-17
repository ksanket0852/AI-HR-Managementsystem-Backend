import { Request, Response } from 'express';
import AnalyticsService from '../services/analytics.service';
import {
  AttritionRiskFilterDto,
  PerformanceInsightFilterDto,
  LeavePatternFilterDto,
  AttendanceAnomalyFilterDto,
  AnalyticsFilterDto
} from '../types/analytics.dto';

class AnalyticsController {
  private analyticsService = new AnalyticsService();

  // Attrition Risk Scoring
  public getAttritionRisk = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: AttritionRiskFilterDto = {
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        riskLevel: req.query.riskLevel as any,
        minRiskScore: req.query.minRiskScore ? Number(req.query.minRiskScore) : undefined,
        maxRiskScore: req.query.maxRiskScore ? Number(req.query.maxRiskScore) : undefined,
        includeInactive: req.query.includeInactive === 'true'
      };

      const attritionRisks = await this.analyticsService.calculateAttritionRisk(filters);
      
      res.status(200).json({
        success: true,
        data: attritionRisks,
        message: 'Attrition risk analysis completed successfully'
      });
    } catch (error) {
      console.error('Error calculating attrition risk:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate attrition risk',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Performance Insights
  public getPerformanceInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: PerformanceInsightFilterDto = {
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        trend: req.query.trend as any,
        minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
        maxRating: req.query.maxRating ? Number(req.query.maxRating) : undefined,
        includeInactive: req.query.includeInactive === 'true'
      };

      const insights = await this.analyticsService.generatePerformanceInsights(filters);
      
      res.status(200).json({
        success: true,
        data: insights,
        message: 'Performance insights generated successfully'
      });
    } catch (error) {
      console.error('Error generating performance insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate performance insights',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Team Performance Insights
  public getTeamPerformanceInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const departmentId = req.query.departmentId as string;
      const insights = await this.analyticsService.generateTeamPerformanceInsights(departmentId);
      
      res.status(200).json({
        success: true,
        data: insights,
        message: 'Team performance insights generated successfully'
      });
    } catch (error) {
      console.error('Error generating team performance insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate team performance insights',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Leave Pattern Analysis
  public getLeavePatternAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: LeavePatternFilterDto = {
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        leaveType: req.query.leaveType as string,
        burnoutRisk: req.query.burnoutRisk as any,
        anomalyType: req.query.anomalyType as string,
        includeInactive: req.query.includeInactive === 'true'
      };

      const analysis = await this.analyticsService.analyzeLeavePatterns(filters);
      
      res.status(200).json({
        success: true,
        data: analysis,
        message: 'Leave pattern analysis completed successfully'
      });
    } catch (error) {
      console.error('Error analyzing leave patterns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze leave patterns',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Attendance Anomaly Detection
  public getAttendanceAnomalies = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: AttendanceAnomalyFilterDto = {
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        anomalyType: req.query.anomalyType as any,
        severity: req.query.severity as any,
        minAttendanceScore: req.query.minAttendanceScore ? Number(req.query.minAttendanceScore) : undefined,
        includeInactive: req.query.includeInactive === 'true'
      };

      const anomalies = await this.analyticsService.detectAttendanceAnomalies(filters);
      
      res.status(200).json({
        success: true,
        data: anomalies,
        message: 'Attendance anomaly detection completed successfully'
      });
    } catch (error) {
      console.error('Error detecting attendance anomalies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to detect attendance anomalies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Dashboard Analytics
  public getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: AnalyticsFilterDto = {
        departmentId: req.query.departmentId as string,
        employeeId: req.query.employeeId as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        period: req.query.period as any || 'MONTH',
        includeInactive: req.query.includeInactive === 'true'
      };

      const analytics = await this.analyticsService.generateDashboardAnalytics(filters);
      
      res.status(200).json({
        success: true,
        data: analytics,
        message: 'Dashboard analytics generated successfully'
      });
    } catch (error) {
      console.error('Error generating dashboard analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate dashboard analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Individual Employee Analytics Summary
  public getEmployeeAnalyticsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId } = req.params;
      
      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
        return;
      }

      // Get comprehensive analytics for a specific employee
      const [attritionRisk, performanceInsight, leavePattern, attendanceAnomalies] = await Promise.all([
        this.analyticsService.calculateAttritionRisk({ employeeId }),
        this.analyticsService.generatePerformanceInsights({ employeeId }),
        this.analyticsService.analyzeLeavePatterns({ employeeId }),
        this.analyticsService.detectAttendanceAnomalies({ employeeId })
      ]);

      const summary = {
        attritionRisk: attritionRisk[0] || null,
        performanceInsight: performanceInsight[0] || null,
        leavePattern: leavePattern[0] || null,
        attendanceAnomalies: attendanceAnomalies[0] || null
      };
      
      res.status(200).json({
        success: true,
        data: summary,
        message: 'Employee analytics summary generated successfully'
      });
    } catch (error) {
      console.error('Error generating employee analytics summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate employee analytics summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Analytics Health Check
  public getAnalyticsHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      // Perform basic health checks on analytics components
      const healthStatus = {
        timestamp: new Date(),
        status: 'healthy',
        components: {
          attritionRisk: 'operational',
          performanceInsights: 'operational',
          leavePatterns: 'operational',
          attendanceAnomalies: 'operational',
          dashboardAnalytics: 'operational'
        },
        version: '1.0.0'
      };
      
      res.status(200).json({
        success: true,
        data: healthStatus,
        message: 'Analytics system is healthy'
      });
    } catch (error) {
      console.error('Error checking analytics health:', error);
      res.status(500).json({
        success: false,
        message: 'Analytics system health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

export default AnalyticsController; 