import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GeolocationService {
  private readonly userAgent: string;
  private readonly geoNamesUser: string;

  constructor(private readonly configService: ConfigService) {
    this.userAgent = this.configService.get<string>('USER_AGENT');
    this.geoNamesUser = this.configService.get<string>('GEONAMES_USERNAME');
  }

  async reverseGeocode(lat: string, lon: string, language: string = 'de') {
    const url = 'https://nominatim.openstreetmap.org/reverse';
    try {
      const response = await axios.get(url, {
        params: { format: 'jsonv2', lat, lon },
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': language,
        },
      });
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || { error: 'Fehler von Nominatim' },
        error.response?.status || 500,
      );
    }
  }

  async geocode(city: string) {
    const url = 'https://nominatim.openstreetmap.org/search';
    try {
      const response = await axios.get(url, {
        params: {
          q: city,
          format: 'json',
          limit: 1,
        },
        headers: { 'User-Agent': this.userAgent },
      });

      return response.data.length ? response.data[0] : null;
    } catch (error) {
      throw new HttpException(
        error.response?.data || { error: 'Fehler von Nominatim' },
        error.response?.status || 500,
      );
    }
  }

  async searchCities(query: string, country: string, lang: string) {
    const url = 'http://api.geonames.org/searchJSON';
    const params: any = {
      name_startsWith: query,
      maxRows: 100,
      featureClass: 'P',
      username: this.geoNamesUser,
      lang: lang,
    };

    if (country && country !== 'any') {
      params.country = country;
    }

    try {
      const response = await axios.get(url, { params });
      return response.data.geonames.map((g) => ({
        display_name: `${g.name}, ${g.countryName}`,
        lat: g.lat,
        lon: g.lng,
      }));
    } catch (error) {
      throw new HttpException(
        error.response?.data || { error: 'Fehler von GeoNames' },
        error.response?.status || 500,
      );
    }
  }
}
