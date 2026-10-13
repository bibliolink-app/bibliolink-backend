export class UserProfileResponseDto {
    username!: string;
    firstName!: string;
    middleName!: string | null;
    firstSurname!: string;
    secondSurname!: string | null;
    birthDate!: string;
    email!: string;
}