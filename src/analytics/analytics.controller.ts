import { Body, Controller, Get, Post, Req, HttpCode, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { VisitorDataDto } from './dtos/visitor-data.dto';
import { PageViewDto } from './dtos/page-view.dto';
import { Request } from 'express';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * POST /analytics/visitor-data
   * Empfängt VisitorData vom Frontend und speichert sie in der Datenbank
   */
  @Post('visitor-data')
  @HttpCode(200)
  async trackVisitor(@Body() visitorData: VisitorDataDto, @Req() req: Request) {
    // Extrahiere IP-Adresse aus Request
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    // Extrahiere Accept-Language Header
    const acceptLanguage = (req.headers['accept-language'] as string) || '';

    await this.analyticsService.saveVisitorData(
      visitorData,
      ipAddress,
      acceptLanguage,
    );

    return {
      success: true,
      message: 'Visitor data tracked successfully',
    };
  }

  /**
   * GET /analytics
   * Gibt alle Analytics-Einträge zurück (für Admin-Zwecke)
   */
  @Get()
  async getAllAnalytics() {
    return this.analyticsService.getAllAnalytics();
  }

  /**
   * GET /analytics/stats
   * Gibt Analytics-Statistiken zurück
   */
  @Get('stats')
  async getStats() {
    return this.analyticsService.getAnalyticsStats();
  }

  /**
   * POST /analytics/page-view
   * Empfängt PageView-Daten vom Frontend und speichert sie in der Datenbank
   */
  @Post('page-view')
  @HttpCode(200)
  async trackPageView(@Body() pageViewData: PageViewDto) {
    await this.analyticsService.savePageView(pageViewData);

    return {
      success: true,
      message: 'Page view tracked successfully',
    };
  }

  /**
   * GET /analytics/top-routes
   * Gibt die meist besuchten Routen zurück
   */
  @Get('top-routes')
  async getTopRoutes(@Query('limit') limit?: number) {
    return this.analyticsService.getTopRoutes(limit || 10);
  }

  /**
   * GET /analytics/visitor/:sessionId
   * Gibt Visitor-Details mit allen PageViews zurück
   */
  @Get('visitor/:sessionId')
  async getVisitorDetails(@Param('sessionId') sessionId: string) {
    return this.analyticsService.getVisitorWithPageViews(sessionId);
  }
}
