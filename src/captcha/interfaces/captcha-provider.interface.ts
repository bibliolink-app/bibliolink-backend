export interface CaptchaProvider {
    verify(token: string): Promise<boolean>;
}
