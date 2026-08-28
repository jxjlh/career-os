const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试；如果问题持续，请稍后再试。";

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    if ("code" in error && error.code === "NETWORK_ERROR") return NETWORK_ERROR_MESSAGE;
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "请求失败，请稍后重试。";
}
