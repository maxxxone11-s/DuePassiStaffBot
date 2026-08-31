declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN?: string;
    EMPLOYEE_ACCESS_CODE?: string;
    ADMIN_ACCESS_CODE?: string;
  }
}
