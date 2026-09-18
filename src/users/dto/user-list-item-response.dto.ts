import { UserRole } from "../enums/user-role.enum";
import { UserStatus } from "../enums/user-status.enum";

export class UserListItemResponseDto {
    userId!: number;
    username!: string;
    firstName!: string;
    middleName!: string | null;
    firstSurname!: string;
    secondSurname!: string | null;
    birthDate!: string;
    email!: string;
    role!: UserRole;
    status!: UserStatus;
    createdAt!: Date;
}