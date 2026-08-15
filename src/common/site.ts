/**
 * Domain des Frontends, für Mail-Betreffzeilen und Ähnliches.
 * Ohne gesetzte FRONTEND_URL bleibt es beim bisherigen Wert —
 * der alte Server verhält sich also unverändert.
 */
export function siteName(): string {
  return (process.env.FRONTEND_URL ?? 'https://auf-zu-neuen-welten.de')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}
