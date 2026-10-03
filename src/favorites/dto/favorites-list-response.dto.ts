import { UserPlan } from '../enums/user-plan.enum';
import { FavoriteResponseDto } from './favorite-response.dto';

// Favoritos del usuario junto con el estado de su límite, para que el
// frontend pueda mostrar, por ejemplo, "2 de 3 favoritos".
export class FavoritesListResponseDto {
    plan!: UserPlan;

    limit!: number;

    count!: number;

    // Espacios libres. Nunca es negativo: si el usuario dejó de ser
    // Premium con más favoritos que el límite gratuito, queda en 0.
    remaining!: number;

    items!: FavoriteResponseDto[];
}
