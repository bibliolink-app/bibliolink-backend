import { ReadingStateResponseDto } from '../../favorites/dto/reading-state-response.dto';
import { Membership } from '../../subscriptions/enums/membership.enum';

export class ReadingAccessResponseDto {
    membership!: Membership;
    canRead!: boolean;
    requiresReward!: boolean;
    expiresAt!: Date | null;
    serverTime!: Date;
    readingState!: ReadingStateResponseDto | null;
}