import { Controller, Get } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get()
  getAvailability() {
    return this.availabilityService.getAvailability();
  }
}
