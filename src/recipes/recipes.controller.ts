import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dtos/create-recipe.dto';
import { UpdateRecipeDto } from './dtos/update-recipe.dto';
import { Recipes } from './recipes.entity';
import { RateLimitGuard } from '../common/rate-limit.guard';

/**
 * The Recipes gimmick lets every visitor add, change and delete recipes – one shared budget per visitor for these
 * writes. It stops automated bulk writes and floods per address, but does not protect the content: a few recipes
 * are still deleted within the budget. Lost recipes come back from the daily database backup.
 */
const RecipeWriteLimit = RateLimitGuard('recipe-write', 20, 60 * 60 * 1000);

@Controller('recipes')
export class RecipesController {
  constructor(private readonly service: RecipesService) {}

  @Get()
  async getAll(): Promise<Recipes[]> {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(RecipeWriteLimit)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() createDto: CreateRecipeDto): Promise<Recipes> {
    return this.service.create(createDto);
  }

  @Put(':id')
  @UseGuards(RecipeWriteLimit)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateRecipeDto,
  ): Promise<Recipes> {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RecipeWriteLimit)
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
