import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const YOUTUBE_API_VERSION = "v3";
const YOUTUBE_API_BASE = `https://www.googleapis.com/youtube/${YOUTUBE_API_VERSION}`;

interface YouTubeSubscriber {
  id: string;
  snippet: {
    publishedAt: string;
    title: string;
    description: string;
    resourceId: {
      kind: string;
      channelId: string;
    };
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
    };
  };
}

interface YouTubeSyncRequest {
  canal_id: string;
  api_key?: string;
  access_token: string;
  force_full_sync?: boolean;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: YouTubeSyncRequest = await req.json();
    const { canal_id, access_token, force_full_sync } = body;

    if (!canal_id || !access_token) {
      return new Response(
        JSON.stringify({ error: "Missing canal_id or access_token" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Obtener info del canal
    const { data: canal, error: canalError } = await supabase
      .from("youtube_channels")
      .select("*")
      .eq("id", canal_id)
      .single();

    if (canalError || !canal) {
      return new Response(
        JSON.stringify({ error: "Canal not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sincronizar suscriptores
    let pageToken = "";
    let totalSincronizados = 0;
    let pageCount = 0;
    const maxPages = force_full_sync ? 50 : 5; // Limitar páginas en sync normal

    while (pageToken !== null && pageCount < maxPages) {
      try {
        const url = new URL(
          `${YOUTUBE_API_BASE}/subscriptions`
        );
        url.searchParams.set("part", "snippet");
        url.searchParams.set("forChannelId", canal.canal_id);
        url.searchParams.set("maxResults", "50");
        url.searchParams.set("order", "alphabetical");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });

        if (!response.ok) {
          console.error("YouTube API error:", response.status, await response.text());
          break;
        }

        const data = await response.json();
        const subscribers: YouTubeSubscriber[] = data.items || [];

        // Insertar/actualizar suscriptores
        for (const sub of subscribers) {
          const channelUserId =
            sub.resourceId?.channelId || sub.id;

          await supabase
            .from("youtube_subscribers")
            .upsert(
              {
                canal_id: canal_id,
                channel_user_id: channelUserId,
                nombre: sub.snippet?.channelTitle,
                foto_perfil: sub.snippet?.thumbnails?.default?.url,
                fecha_suscripcion: sub.snippet?.publishedAt,
                ultima_actividad: new Date().toISOString(),
                estado_suscripcion: "activo",
              },
              { onConflict: "canal_id,channel_user_id" }
            );

          totalSincronizados++;
        }

        pageToken = data.nextPageToken || null;
        pageCount++;
      } catch (error) {
        console.error("Error procesando página:", error);
        break;
      }
    }

    // Actualizar timestamp de sincronización
    await supabase
      .from("youtube_channels")
      .update({ ultima_sincronizacion: new Date().toISOString() })
      .eq("id", canal_id);

    return new Response(
      JSON.stringify({
        success: true,
        sincronizados: totalSincronizados,
        paginas_procesadas: pageCount,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
