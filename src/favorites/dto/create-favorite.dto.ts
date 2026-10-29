import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

// Agrega a favoritos una obra que ya está guardada en `books`.
export class CreateFavoriteDto {
    @Type(() => Number)
    @IsInt({ message: 'El identificador del libro debe ser un número entero.' })
    @Min(1, { message: 'El identificador del libro debe ser mayor o igual a 1.' })
    bookId!: number;
}
