import { Controller, Get, Query, Res } from '@nestjs/common';
import { GeolocationService } from './geolocation.service';
import { Response } from 'express';

@Controller('geolocation')
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.geolocationService.reverseGeocode(lat, lon);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Fehler beim Geocoding' });
    }
  }

  @Get('geocode')
  async geocode(@Query('city') city: string, @Res() res: Response) {
    try {
      const result = await this.geolocationService.geocode(city);
      if (!result) {
        return res.status(404).json({ error: 'Keine Ergebnisse gefunden' });
      }
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Fehler beim Geocoding' });
    }
  }

  @Get('cities')
  async searchCities(
    @Query('q') query: string,
    @Query('country') country: string,
    @Res() res: Response,
  ) {
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Ungültiger Suchbegriff' });
    }

    try {
      const cities = await this.geolocationService.searchCities(query, country);
      res.json(cities);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Städte' });
    }
  }
}

// test
