import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as fs from 'fs';

async function bootstrap() {
  // .trim() ist noetig: "set NODE_ENV=development &&" haengt unter
  // Windows ein Leerzeichen an den Wert.
  const isDev = process.env.NODE_ENV?.trim() === 'development';

  // TLS haengt an den Zertifikatspfaden, NICHT an NODE_ENV.
  //   benjaminmilcic.site -> Pfade gesetzt -> Node macht HTTPS selbst
  //   benjamin-milcic.dev -> Pfade leer    -> Apache terminiert TLS davor
  //   lokal               -> Pfade leer    -> einfaches HTTP
  const useTls = Boolean(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH);

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    useTls
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {},
  );

  // Nur hinter einem Reverse Proxy: X-Forwarded-For und -Proto auswerten.
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  app.useGlobalPipes(new ValidationPipe());

  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  } else if (isDev) {
    // Bequem beim Entwickeln: spiegelt die anfragende Origin.
    app.enableCors({ origin: true, credentials: true });
  } else {
    // Fail closed: lieber CORS aus als fuer jeden offen.
    console.warn(
      'WARNUNG: CORS_ORIGIN ist nicht gesetzt - CORS bleibt deaktiviert.',
    );
    app.enableCors({ origin: false, credentials: true });
  }

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(
    `API (${isDev ? 'dev' : 'prod'}): ${useTls ? 'https' : 'http'}://${host}:${port}`,
  );
}
bootstrap();
