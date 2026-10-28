// Local development of the AI chat without a database: starts only the modules the chat needs
// (chat, availability, jokes) on port 3000. Run with `npm run start:chat-dev`.
// The full API (npm run start:dev) needs the MySQL database from .env.
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AvailabilityModule } from './availability/availability.module';
import { ChatModule } from './chat/chat.module';
import { JokesModule } from './jokes/jokes.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ChatModule, AvailabilityModule, JokesModule],
})
class ChatDevModule {}

async function bootstrap() {
  const app = await NestFactory.create(ChatDevModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({ origin: true, credentials: true });
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  console.log('Chat dev API: http://localhost:3000');
}
bootstrap();
