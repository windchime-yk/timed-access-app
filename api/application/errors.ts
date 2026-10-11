// presentation層がdomainに直接依存しないよう、アプリケーションサービスが
// 投げるエラーをapplication層から公開する
export { ValidationError } from "../domain/shared/validation.error.ts";
