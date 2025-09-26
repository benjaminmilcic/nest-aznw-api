import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Guestbook } from './guestbook.entity';
import { Repository } from 'typeorm';

@Injectable()
export class GuestbookService {
  constructor(
    @InjectRepository(Guestbook) private repo: Repository<Guestbook>,
  ) {}

  getAllPosts() {
    return this.repo.find();
  }

  saveNewPost(name: string, content: string, date: string) {
    const newPost = this.repo.create({ name, content, date: new Date(date) });
    return this.repo.save(newPost);
  }
}
