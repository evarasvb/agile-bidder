export async function deliverGroups<T extends { id: string; destino_email: string | null }>(
  pending: T[],
  send: (email: string, messages: T[]) => Promise<boolean>,
  acknowledge: (ids: string[]) => Promise<void>,
) {
  const groups = new Map<string, T[]>();
  for (const message of pending) {
    if (!message.destino_email) continue;
    const group = groups.get(message.destino_email) ?? [];
    group.push(message);
    groups.set(message.destino_email, group);
  }
  const accepted: string[] = [];
  let sent = 0;
  let failures = 0;
  for (const [email, messages] of groups) {
    try {
      if (await send(email, messages)) {
        accepted.push(...messages.map(message => message.id));
        sent++;
      } else failures++;
    } catch { failures++; }
  }
  if (accepted.length) await acknowledge(accepted);
  return { avisos: sent, marcados: accepted.length, pendientes: pending.length - accepted.length, fallos: failures };
}
