import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const fs = require('fs');
  const httpsOptions = {
    key: fs.readFileSync('./secrets/benjaminmilcic.site.key'),
    cert: fs.readFileSync('./secrets/benjaminmilcic.site.crt'),
  };
  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
