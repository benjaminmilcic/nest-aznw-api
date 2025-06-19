import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GeolocationService } from './geolocation.service';

@Controller('geolocation')
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('lang') lang = 'de',
  ) {
    return this.geolocationService.reverseGeocode(lat, lon, lang);
  }

  @Get('geocode')
  async geocode(@Query('city') city: string) {
    const result = await this.geolocationService.geocode(city);
    if (!result) {
      throw new HttpException(
        { error: 'Keine Ergebnisse gefunden' },
        HttpStatus.NOT_FOUND,
      );
    }
    return result;
  }

  @Get('cities')
  async searchCities(
    @Query('q') query: string,
    @Query('country') country: string,
    @Query('lang') lang: string,
  ) {
    if (!query || query.trim().length < 2) {
      throw new HttpException(
        { error: 'Ungültiger Suchbegriff' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.geolocationService.searchCities(query, country, lang);
  }
}
