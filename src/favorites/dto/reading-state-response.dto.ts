// Progreso de lectura de un usuario sobre uno de sus favoritos.
export class ReadingStateResponseDto {
    // Porcentaje leído, de 0 a 100, con hasta dos decimales.
    progressPercent!: number;

    // Posición donde quedó la lectura (por ejemplo, un capítulo o un CFI de
    // epub). Su formato lo decide el lector del frontend.
    readingLocation!: string | null;

    // Última vez que se guardó progreso; `null` si nunca se leyó.
    lastReadAt!: Date | null;
}
