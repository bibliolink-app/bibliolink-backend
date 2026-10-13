import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';

export class RedeemRewardedAdDto {
    @Transform(trimString)
    @IsString({ message: 'El token de recompensa debe ser un texto.', })
    @IsNotEmpty({ message: 'El token de recompensa es obligatorio.', })
    token!: string;
}