import {
  IsString,
  IsArray,
} from 'class-validator';

export class CreateRecipeDto {
  @IsString()
  title: string;

  @IsArray()
  @IsString({ each: true })
  ingredients: string[];

  @IsString()
  imagePath: string;

  @IsString()
  preparation: string;
}
