import { Body, Controller, Get, Post } from '@nestjs/common';
import { GuestbookService } from './guestbook.service';
import { PostDto } from './dtos/post.dto';

@Controller('guestbook')
export class GuestbookController {
  constructor(private guestbookService: GuestbookService) {}

  @Get()
  getAllPosts() {
    return this.guestbookService.getAllPosts();
  }

  @Post()
  saveNewPost(@Body() body: PostDto) {
      return this.guestbookService.saveNewPost(body.name,body.content,body.date.slice(0,10));
  }
}
