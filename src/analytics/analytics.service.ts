import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Analytics } from './analytics.entity';
import { PageView } from './page-view.entity';
import { Repository } from 'typeorm';
import { VisitorDataDto } from './dtos/visitor-data.dto';
import { PageViewDto } from './dtos/page-view.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Analytics) private repo: Repository<Analytics>,
    @InjectRepository(PageView) private pageViewRepo: Repository<PageView>,
  ) {}

  /**
   * Anonymisiert eine IP-Adresse gemäß DSGVO-Anforderungen
   * IPv4: Entfernt das letzte Oktett (z.B. 192.168.1.100 -> 192.168.1.0)
   * IPv6: Entfernt die letzten 80 Bits
   */
  private anonymizeIp(ip: string): string {
    if (!ip) return null;

    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        return parts.join('.');
      }
    }

    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      // Behalte nur die ersten 3 Segmente (48 Bits)
      return parts.slice(0, 3).join(':') + '::';
    }

    return null;
  }

  /**
   * Speichert VisitorData in der Datenbank
   * @param visitorData - Daten vom Frontend
   * @param ipAddress - IP-Adresse des Clients (wird anonymisiert)
   * @param acceptLanguage - Accept-Language Header
   */
  async saveVisitorData(
    visitorData: VisitorDataDto,
    ipAddress: string,
    acceptLanguage: string,
  ): Promise<Analytics> {
    const analyticsEntry = this.repo.create({
      sessionId: visitorData.sessionId,
      timestamp: new Date(visitorData.timestamp),
      userAgent: visitorData.userAgent,
      language: visitorData.language,
      languages: visitorData.languages,
      platform: visitorData.platform,
      screenResolution: visitorData.screenResolution,
      viewportSize: visitorData.viewportSize,
      timezone: visitorData.timezone,
      timezoneOffset: visitorData.timezoneOffset,
      cookiesEnabled: visitorData.cookiesEnabled,
      referrer: visitorData.referrer || '',
      deviceMemory: visitorData.deviceMemory,
      hardwareConcurrency: visitorData.hardwareConcurrency,
      connectionType: visitorData.connectionType,
      online: visitorData.online,
      // Backend-spezifische Daten
      ipAddressAnonymized: this.anonymizeIp(ipAddress),
      acceptLanguage: acceptLanguage,
    });

    return this.repo.save(analyticsEntry);
  }

  /**
   * Ruft alle Analytics-Einträge ab (für Admin-Zwecke)
   */
  async getAllAnalytics(): Promise<Analytics[]> {
    return this.repo.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Ruft Analytics-Statistiken ab
   */
  async getAnalyticsStats(): Promise<{
    totalVisits: number;
    uniqueTimezones: number;
    topPlatforms: { platform: string; count: number }[];
    topBrowsers: { browser: string; count: number }[];
  }> {
    const totalVisits = await this.repo.count();

    const timezones = await this.repo
      .createQueryBuilder('analytics')
      .select('DISTINCT timezone')
      .getRawMany();

    const platforms = await this.repo
      .createQueryBuilder('analytics')
      .select('platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('platform')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Extrahiere Browser aus User-Agent (vereinfacht)
    const allEntries = await this.repo.find({
      select: ['userAgent'],
    });

    const browserCounts = allEntries.reduce((acc, entry) => {
      let browser = 'Unknown';
      const ua = entry.userAgent.toLowerCase();

      if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
      else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
      else if (ua.includes('firefox')) browser = 'Firefox';
      else if (ua.includes('edg')) browser = 'Edge';
      else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

      acc[browser] = (acc[browser] || 0) + 1;
      return acc;
    }, {});

    const topBrowsers = Object.entries(browserCounts)
      .map(([browser, count]) => ({ browser, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalVisits,
      uniqueTimezones: timezones.length,
      topPlatforms: platforms.map((p) => ({
        platform: p.platform,
        count: parseInt(p.count),
      })),
      topBrowsers,
    };
  }

  /**
   * Speichert einen PageView in der Datenbank
   * @param pageViewData - Daten vom Frontend
   */
  async savePageView(pageViewData: PageViewDto): Promise<PageView> {
    const pageView = this.pageViewRepo.create({
      sessionId: pageViewData.sessionId,
      route: pageViewData.route,
      timestamp: new Date(pageViewData.timestamp),
      referrer: pageViewData.referrer || null,
    });

    return this.pageViewRepo.save(pageView);
  }

  /**
   * Ruft alle PageViews für eine bestimmte Session ab
   * @param sessionId - Die Session-ID
   */
  async getPageViewsBySession(sessionId: string): Promise<PageView[]> {
    return this.pageViewRepo.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * Ruft Top-Routes-Statistiken ab
   */
  async getTopRoutes(limit: number = 10): Promise<{ route: string; count: number }[]> {
    const routes = await this.pageViewRepo
      .createQueryBuilder('pageView')
      .select('pageView.route', 'route')
      .addSelect('COUNT(*)', 'count')
      .groupBy('pageView.route')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return routes.map((r) => ({
      route: r.route,
      count: parseInt(r.count),
    }));
  }

  /**
   * Ruft Visitor-Details mit PageViews ab
   * @param sessionId - Die Session-ID
   */
  async getVisitorWithPageViews(sessionId: string): Promise<{
    visitor: Analytics;
    pageViews: PageView[];
  }> {
    const visitor = await this.repo.findOne({
      where: { sessionId },
    });

    const pageViews = await this.getPageViewsBySession(sessionId);

    return { visitor, pageViews };
  }
}
