interface LinkedRequestActions {
  registeredId?: string;
  create: () => Promise<string | null>;
  link: (requestId: string) => Promise<unknown>;
  onRegistered: (requestId: string) => void;
}
type LinkedRequestResult =
  | { status: 'failed'; created: false }
  | { status: 'linked' | 'registered'; created: boolean; requestId: string };

/** Un fallo de vínculo conserva la solicitud; el reintento no la vuelve a enviar. */
export async function registerLinkedMarketRequest(actions: LinkedRequestActions): Promise<LinkedRequestResult> {
  let requestId = actions.registeredId;
  let created = false;
  if (!requestId) {
    try {
      const result = await actions.create();
      if (!result) return { status: 'failed', created: false };
      requestId = result;
      created = true;
      actions.onRegistered(requestId);
    } catch { return { status: 'failed', created: false }; }
  }
  try {
    await actions.link(requestId);
    return { status: 'linked', created, requestId };
  } catch { return { status: 'registered', created, requestId }; }
}
