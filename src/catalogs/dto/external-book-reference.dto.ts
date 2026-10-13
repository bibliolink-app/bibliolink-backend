import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';
import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH } from '../constants/catalogs.constants';

// Identifica una obra dentro de un proveedor externo. La referencia puede
// contener barras (`bram-stoker/dracula`), por eso viaja como parámetro de
// consulta y no como segmento de la ruta.
export class ExternalBookReferenceDto {
    @Transform(trimString)
    @IsString({ message: 'La referencia debe ser un texto.' })
    @IsNotEmpty({ message: 'La referencia es obligatoria.' })
    @MaxLength(BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, {
        message: `La referencia no puede superar los ${BOOK_EXTERNAL_REFERENCE_MAX_LENGTH} caracteres.`,
    })
    reference!: string;
}
