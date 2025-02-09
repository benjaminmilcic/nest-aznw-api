import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  let app;

  if (process.env.NODE_ENV && process.env.NODE_ENV.trim() === 'development') {
    console.log('development');
    app = await NestFactory.create(AppModule);
  } else {
    console.log('production');
    const fs = require('fs');
    const httpsOptions = {
      key: fs.readFileSync('./secrets/benjaminmilcic.site.key'),
      cert: fs.readFileSync('./secrets/benjaminmilcic.site.crt'),
    };
    app = await NestFactory.create(AppModule, {
      httpsOptions,
    });
  }
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
