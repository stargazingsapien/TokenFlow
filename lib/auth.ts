export const SESSION_COOKIE = "tokenflow_staff_session";

export const STAFF_USERNAME = normalizeCredential(process.env.TOKENFLOW_STAFF_USERNAME ?? "admin");
export const STAFF_PASSWORD = normalizeCredential(process.env.TOKENFLOW_STAFF_PASSWORD ?? "tokenflow123");
export const STAFF_SESSION_VALUE = normalizeCredential(
  process.env.TOKENFLOW_SESSION_VALUE ?? "tokenflow-local-session"
);

export function isValidStaffLogin(username: string, password: string) {
  return normalizeCredential(username) === STAFF_USERNAME && normalizeCredential(password) === STAFF_PASSWORD;
}

function normalizeCredential(value: string) {
  return value.trim();
}
