import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GenerateImageDto } from './dtos/generate-image.dto';

@Injectable()
export class ImagegenService {
  private readonly workerUrl: string;
  private readonly workerSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.workerUrl = (
      this.configService.get<string>('IMAGEGEN_WORKER_URL') || ''
    ).replace(/\/+$/, '');
    this.workerSecret = this.configService.get<string>('WORKER_SECRET') || '';
  }

  async generate(dto: GenerateImageDto): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    this.assertConfig();
    const model = dto.model === 'sdxl' ? 'sdxl' : 'flux';
    const params: Record<string, string | number> = {
      prompt: dto.prompt.trim(),
      model,
    };
    if (model === 'sdxl') {
      if (dto.width) params.width = dto.width;
      if (dto.height) params.height = dto.height;
      if (dto.seed != null) params.seed = dto.seed;
    }

    try {
      const response = await axios.get(this.workerUrl, {
        params,
        headers: { 'X-Worker-Secret': this.workerSecret },
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      const contentType =
        (response.headers['content-type'] as string) || 'image/jpeg';
      return { buffer: Buffer.from(response.data), contentType };
    } catch (error) {
      throw this.wrapWorkerError(error, 'Bildgenerierung fehlgeschlagen');
    }
  }

  async embed(query: string): Promise<{ vector: number[] }> {
    this.assertConfig();
    try {
      const response = await axios.post(
        `${this.workerUrl}/embed`,
        { q: query },
        {
          headers: {
            'X-Worker-Secret': this.workerSecret,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
      if (!Array.isArray(response.data?.vector)) {
        throw new HttpException(
          { error: 'Ungültige Embedding-Antwort' },
          HttpStatus.BAD_GATEWAY,
        );
      }
      return { vector: response.data.vector };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.wrapWorkerError(error, 'Embedding fehlgeschlagen');
    }
  }

  private assertConfig() {
    if (!this.workerUrl || !this.workerSecret) {
      throw new HttpException(
        { error: 'Imagegen-Worker ist nicht konfiguriert' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private wrapWorkerError(error: any, fallback: string) {
    const status = error.response?.status || HttpStatus.BAD_GATEWAY;
    const data = error.response?.data;
    let body: any = { error: fallback };
    if (Buffer.isBuffer(data)) {
      try {
        body = JSON.parse(data.toString('utf8'));
      } catch {
        body = { error: fallback };
      }
    } else if (data && typeof data === 'object') {
      body = data;
    }
    return new HttpException(body, status);
  }
}
