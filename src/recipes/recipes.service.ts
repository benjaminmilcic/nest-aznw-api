import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipes } from './recipes.entity';
import { CreateRecipeDto } from './dtos/create-recipe.dto';
import { UpdateRecipeDto } from './dtos/update-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipes)
    private readonly repo: Repository<Recipes>,
  ) {}

  async findAll(): Promise<Recipes[]> {
    try {
      return await this.repo.find();
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException({
        message: {
          de: 'Fehler beim Laden der Rezepte.',
          en: 'Error loading recipes.',
          hr: 'Greška pri učitavanju recepata.',
        },
      });
    }
  }

  async create(createDto: CreateRecipeDto): Promise<Recipes> {
    try {
      const entity = this.repo.create(createDto);
      return await this.repo.save(entity);
    } catch (err) {
      console.log(err);

      throw new InternalServerErrorException({
        message: {
          de: 'Fehler beim Anlegen des Rezepts.',
          en: 'Error creating the recipe.',
          hr: 'Greška prilikom kreiranja recepta.',
        },
      });
    }
  }

  async update(id: number, updateDto: UpdateRecipeDto): Promise<Recipes> {
    const recipe = await this.repo.findOne({ where: { id } });
    if (!recipe) {
      throw new NotFoundException({
        message: {
          de: `Rezept mit id ${id} nicht gefunden.`,
          en: `Recipe with id ${id} not found.`,
          hr: `Recept s ID-om ${id} nije pronađen.`,
        },
      });
    }

    try {
      const merged = this.repo.merge(recipe, updateDto);
      return await this.repo.save(merged);
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException({
        message: {
          de: 'Fehler beim Aktualisieren des Rezepts.',
          en: 'Error updating recipe.',
          hr: 'Greška pri ažuriranju recepta.',
        },
      });
    }
  }

  async remove(id: number): Promise<void> {
    const recipe = await this.repo.findOne({ where: { id } });
    if (!recipe) {
      throw new NotFoundException({
        message: {
          de: `Rezept mit id ${id} nicht gefunden.`,
          en: `Recipe with id ${id} not found.`,
          hr: `Recept s ID-om ${id} nije pronađen.`,
        },
      });
    }

    try {
      await this.repo.delete(id);
    } catch (err) {
      console.log(err);

      throw new InternalServerErrorException({
        message: {
          de: 'Fehler beim Löschen des Rezepts.',
          en: 'Error deleting recipe.',
          hr: 'Greška pri brisanju recepta.',
        },
      });
    }
  }
}
