/** WhatsApp-style group typing / recording subtitle helpers */

export function formatGroupTypingLabel(typingUsers = []) {
  const names = (typingUsers || [])
    .map((u) => (u.userName || "Someone").split(" ")[0])
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
  }
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} others are typing…`;
}

export function formatGroupRecordingLabel(recordingUsers = []) {
  const names = (recordingUsers || [])
    .map((u) => (u.userName || "Someone").split(" ")[0])
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is recording a voice message…`;
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are recording…`;
  }
  return `${names.length} people are recording…`;
}
