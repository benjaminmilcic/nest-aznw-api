import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type JokeLanguage = 'de' | 'en' | 'hr';

interface JokeEntry {
  deutsch: string;
  english: string;
  hrvatski: string;
}

// Field names of a joke in jokes.json per language
const FIELDS: Record<JokeLanguage, keyof JokeEntry> = {
  de: 'deutsch',
  en: 'english',
  hr: 'hrvatski',
};

@Injectable()
export class JokesService {
  // Same file as GET /auth/jokes, outside the repository
  private readonly filePath = path.join(process.cwd() + '/../jokefile/', 'jokes.json');

  getRandomJoke(language: JokeLanguage) {
    if (!fs.existsSync(this.filePath)) {
      throw new NotFoundException('JSON file not found');
    }
    const jokes: JokeEntry[] = JSON.parse(fs.readFileSync(this.filePath, 'utf8')).vicevi;
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return {
      language,
      text: joke[FIELDS[language]].replace(/\r\n/g, '\n'),
      total: jokes.length,
    };
  }
}
