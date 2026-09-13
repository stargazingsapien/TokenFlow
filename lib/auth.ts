export const SESSION_COOKIE = "tokenflow_staff_session";

export const STAFF_USERNAME = process.env.TOKENFLOW_STAFF_USERNAME ?? "admin";
export const STAFF_PASSWORD = process.env.TOKENFLOW_STAFF_PASSWORD ?? "tokenflow123";
export const STAFF_SESSION_VALUE = process.env.TOKENFLOW_SESSION_VALUE ?? "tokenflow-local-session";

export function isValidStaffLogin(username: string, password: string) {
  return username === STAFF_USERNAME && password === STAFF_PASSWORD;
}
