import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { User } from './user.entity';
import { FailedLogin } from './failed-login.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(FailedLogin)
    private failedLoginRepository: Repository<FailedLogin>,
  ) {}

  async createUser(email: string, password: string): Promise<User> {
    const newUser = this.usersRepository.create({ email, password });
    return this.usersRepository.save(newUser);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async incrementFailedLogin(ip: string): Promise<void> {
    let failedAttempt = await this.failedLoginRepository.findOne({
      where: { ip },
    });

    if (!failedAttempt) {
      failedAttempt = this.failedLoginRepository.create({
        ip,
        failedAttempts: 1,
      });
    } else {
      failedAttempt.failedAttempts += 1;
    }

    if (failedAttempt.failedAttempts >= 3) {
      failedAttempt.blockedUntil = new Date(Date.now() + 5 * 60 * 1000); // Block for 5 minutes
    }

    await this.failedLoginRepository.save(failedAttempt);
  }

  async resetFailedLogin(ip: string): Promise<void> {
    await this.failedLoginRepository.delete({ ip });
  }

  async isBlocked(ip: string): Promise<boolean> {
    const failedAttempt = await this.failedLoginRepository.findOne({
      where: { ip },
    });

    if (failedAttempt && failedAttempt.blockedUntil) {
      if (new Date() < new Date(failedAttempt.blockedUntil)) {
        return true;
      } else {
        await this.resetFailedLogin(ip); // Reset after block duration
        return false;
      }
    }
    return false;
  }
}
