import { UserRole } from '../../users/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-status.enum';


export class AuthUserResponseDto {
    userId!: number;
    role!: UserRole;
    status: UserStatus;
}
