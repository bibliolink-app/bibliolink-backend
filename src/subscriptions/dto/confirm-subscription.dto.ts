import { IsInt, IsNotEmpty, IsString, MaxLength, Min, } from 'class-validator';

export class ConfirmSubscriptionDto {
    @IsInt()
    @Min(1)
    subscriptionId!: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    externalSubscriptionReference!: string;
}