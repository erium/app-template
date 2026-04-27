export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = () =>
  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login`;
