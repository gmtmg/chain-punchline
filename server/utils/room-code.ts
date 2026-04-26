import { ROOM_CODE_LENGTH, ROOM_CODE_CHARS } from "../../shared/constants";

export function generateRoomCode(existing: Set<string>): string {
  let code: string;
  do {
    code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
  } while (existing.has(code));
  return code;
}
