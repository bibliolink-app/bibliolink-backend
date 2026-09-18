import { QueryFailedError } from 'typeorm';

export function isMySqlUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
        return false;
    }

    const driverError: unknown = error.driverError;

    if (
        typeof driverError !== 'object' ||
        driverError === null
    ) {
        return false;
    }

    return (
        'code' in driverError &&
        driverError.code === 'ER_DUP_ENTRY' &&
        'errno' in driverError &&
        driverError.errno === 1062
    );
}