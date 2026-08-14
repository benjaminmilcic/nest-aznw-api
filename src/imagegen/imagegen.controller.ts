import { Body, Controller, Post, Req, StreamableFile } from '@nestjs/common';
import { ImagegenService } from './imagegen.service';
import { GenerateImageDto } from './dtos/generate-image.dto';
import { EmbedDto } from './dtos/embed.dto';
import { MemoryRateLimiter, clientIp } from '../common/memory-rate-limiter';

@Controller('imagegen')
export class ImagegenController {
  private readonly rateLimiter = new MemoryRateLimiter();

  constructor(private readonly imagegenService: ImagegenService) {}

  @Post()
  async generate(@Body() body: GenerateImageDto, @Req() req) {
    this.rateLimiter.consume(`image:${clientIp(req)}`, 5, 10 * 60 * 1000);
    const { buffer, contentType } = await this.imagegenService.generate(body);
    return new StreamableFile(buffer, { type: contentType });
  }

  @Post('embed')
  embed(@Body() body: EmbedDto, @Req() req) {
    this.rateLimiter.consume(`embed:${clientIp(req)}`, 30, 60 * 1000);
    return this.imagegenService.embed(body.q.trim());
  }
}
