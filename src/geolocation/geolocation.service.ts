import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeolocationService {
  private readonly userAgent = 'MeineGeolocationApp (example@example.com)';
  private readonly geoNamesUser = 'benjamin.milcic';

  async reverseGeocode(lat: string, lon: string) {
    const url = 'https://nominatim.openstreetmap.org/reverse';
    const response = await axios.get(url, {
      params: { format: 'jsonv2', lat, lon },
      headers: { 'User-Agent': this.userAgent },
    });
    return response.data;
  }

  async geocode(city: string) {
    const url = 'https://nominatim.openstreetmap.org/search';
    const response = await axios.get(url, {
      params: {
        q: city,
        format: 'json',
        limit: 1,
      },
      headers: { 'User-Agent': this.userAgent },
    });

    return response.data.length ? response.data[0] : null;
  }

  async searchCities(query: string, country: string) {
    const url = 'http://api.geonames.org/searchJSON';
    const params: any = {
      name_startsWith: query,
      maxRows: 100,
      featureClass: 'P',
      lang: 'de',
      username: this.geoNamesUser,
    };

    if (country && country !== 'any') {
      params.country = country;
    }

    const response = await axios.get(url, { params });

    return response.data.geonames.map((g) => ({
      display_name: `${g.name}, ${g.countryName}`,
      lat: g.lat,
      lon: g.lng,
    }));
  }
}
