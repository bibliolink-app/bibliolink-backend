import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH } from '../../catalogs/constants/catalogs.constants';
import { BookProviderCode } from '../../catalogs/enums/book-provider-code.enum';
import { trimString } from '../../common/transformers/trim-string.transformer';
import { localizedValidation } from '../../i18n/localized-validation';

// Datos necesarios para importar una obra puntual desde un proveedor externo
// y guardarla en `books`.
export class ImportBookDto {
    @Transform(trimString)
    @IsEnum(BookProviderCode, localizedValidation('VALIDATION_PROVIDER_INVALID'))
    providerCode!: BookProviderCode;

    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_REFERENCE_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_REFERENCE_REQUIRED'))
    @MaxLength(
        BOOK_EXTERNAL_REFERENCE_MAX_LENGTH,
        localizedValidation('VALIDATION_REFERENCE_MAX_LENGTH', { max: BOOK_EXTERNAL_REFERENCE_MAX_LENGTH }),
    )
    externalReference!: string;
}
