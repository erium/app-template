import { BASE_PATH } from "./lib/basePath";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Local auth - no OAuth needed
export const getLoginUrl = () => `${BASE_PATH}/login`;
