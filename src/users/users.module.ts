import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { FailedLogin } from './failed-login.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, FailedLogin])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
