import { Injectable } from '@nestjs/common';

export interface Availability {
  available: boolean;
  year: number;
  quarter: number;
}

@Injectable()
export class AvailabilityService {
  // The only place to change when Benjamin's availability changes – used by the
  // website header and by the AI chat (tool "get_availability")
  getAvailability(): Availability {
    const now = new Date();
    return {
      available: true,
      year: now.getFullYear(),
      quarter: Math.floor(now.getMonth() / 3) + 1,
    };
  }
}
