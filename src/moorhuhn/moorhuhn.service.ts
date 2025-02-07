import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Moorhuhn } from './moorhuhn.entity';

interface HighScore {
  rank: number;
  name: string;
  score: number;
  date: Date;
}

@Injectable()
export class MoorhuhnService {
  highscore: HighScore[] = [];

  constructor(@InjectRepository(Moorhuhn) private repo: Repository<Moorhuhn>) {}

  async getAllHighscore() {
    await this.repo.find().then((result) => {
      this.highscore = [];
      let fromApi = JSON.parse(JSON.stringify(result));
      fromApi.forEach((element) => {
        this.highscore.push({
          name: element.name,
          score: element.score,
          date: new Date(element.date),
          rank: null,
        });
      });
      this.sortHighScore();
    });
    return JSON.stringify(this.highscore);
  }

  async saveNewHighscore(name: string, score: number, date: string) {
    let userFound = await this.repo.findOne({ where: { name } });
    if (userFound) {
      if (score > userFound.score) {
        await this.repo.update(userFound.id, { score, date });
      }
    } else {
      const newPost = this.repo.create({ name, score, date });
      await this.repo.save(newPost);
    }
    return await this.getAllHighscore();
  }

  sortHighScore() {
    if (this.highscore.length > 0) {
      this.highscore.sort((a, b) => b.score - a.score);
      this.highscore[0].rank = 1;
      let rank = 1;
      for (let index = 1; index < this.highscore.length; index++) {
        const element = this.highscore[index];
        rank++;
        if (this.highscore[index - 1].score === element.score) {
          element.rank = this.highscore[index - 1].rank;
        } else {
          element.rank = rank;
        }
      }
    }
  }
}
