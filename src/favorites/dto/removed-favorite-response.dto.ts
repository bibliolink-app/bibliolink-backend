// Respuesta al quitar una obra de favoritos: qué obra se quitó y un mensaje
// de confirmación en el idioma de la petición.
export class RemovedFavoriteResponseDto {
    bookId!: number;

    message!: string;
}
