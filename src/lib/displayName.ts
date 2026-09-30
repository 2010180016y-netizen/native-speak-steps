export const DISPLAY_NAME_MAX_LENGTH = 30;

/**
 * Mirrors the profiles_display_name_safe DB constraint.
 * Returns a user-facing error message, or null when the (trimmed) name is valid.
 */
export function getDisplayNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "닉네임을 입력해주세요";
  if (Array.from(trimmed).length > DISPLAY_NAME_MAX_LENGTH) {
    return `닉네임은 ${DISPLAY_NAME_MAX_LENGTH}자 이하로 입력해주세요`;
  }
  if (trimmed.includes("@")) return "닉네임에는 이메일 주소나 '@'를 사용할 수 없어요";
  return null;
}
