/** Stable in-page target shared by rough status cards and the actual message. */
export function consultationMessageAnchor(messageId: string): string {
  return `consultation-message-${messageId}`;
}
