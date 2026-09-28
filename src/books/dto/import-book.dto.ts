import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH } from '../../catalogs/constants/catalogs.constants';
import { BookProviderCode } from '../../catalogs/enums/book-provider-code.enum';
import { trimString } from '../../common/transformers/trim-string.transformer';

// Datos necesarios para importar una obra puntual desde un proveedor externo
// y guardarla en `books`.
export class ImportBookDto {
    @Transform(trimString)
    @IsEnum(BookProviderCode, {
        message: 'El proveedor indicado no está soportado.',
    })
    providerCode!: BookProviderCode;

    @Transform(trimString)
    @IsString({ message: 'La referencia debe ser un texto.' })
    @IsNotEmpty({ message: 'La referencia es obligatoria.' })
    @MaxLength(BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, {
        message: `La referencia no puede superar los ${BOOK_EXTERNAL_REFERENCE_MAX_LENGTH} caracteres.`,
    })
    externalReference!: string;
}
