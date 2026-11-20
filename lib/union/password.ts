// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
export const MANAGER_PASSWORD_HINT =
  "كلمة المرور 16 خانة بالضبط، تشمل حرفًا إنجليزيًا كبيرًا وصغيرًا ورقمًا ورمزًا، دون مسافات";
export function validManagerPassword(value: string) {
  return (
    value.length === 16 &&
    /^[\x21-\x7e]+$/.test(value) &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
