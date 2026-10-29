import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';
import { localizedValidation } from '../../i18n/localized-validation';
import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH } from '../constants/catalogs.constants';

// Identifica una obra dentro de un proveedor externo. La referencia puede
// contener barras (`bram-stoker/dracula`), por eso viaja como parámetro de
// consulta y no como segmento de la ruta.
export class ExternalBookReferenceDto {
    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_REFERENCE_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_REFERENCE_REQUIRED'))
    @MaxLength(
        BOOK_EXTERNAL_REFERENCE_MAX_LENGTH,
        localizedValidation('VALIDATION_REFERENCE_MAX_LENGTH', { max: BOOK_EXTERNAL_REFERENCE_MAX_LENGTH }),
    )
    reference!: string;
}
