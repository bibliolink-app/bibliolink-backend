import { FavoriteResponseDto } from './favorite-response.dto';

// Respuesta al agregar una obra a favoritos: el favorito creado y un mensaje
// de confirmación en el idioma de la petición.
export class AddedFavoriteResponseDto extends FavoriteResponseDto {
    message!: string;
}
