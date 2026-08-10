import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  document_id: string;
  storage_path: string;
  licitacion_id: string;
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: data.user.id, supabase };
}

// Simple PDF text extraction - reads raw bytes and extracts text streams
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const text = new TextDecoder('latin1').decode(bytes);
  const textParts: string[] = [];

  // Extract text between BT (Begin Text) and ET (End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;

  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(tjMatch[1]);
    }

    // TJ arrays: [(text) num (text) ...]
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arr = tjArrMatch[1];
      const innerRegex = /\(([^)]*)\)/g;
      let inner;
      while ((inner = innerRegex.exec(arr)) !== null) {
        textParts.push(inner[1]);
      }
    }
  }

  // Decode common PDF escape sequences
  let extracted = textParts.join(' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');

  // If BT/ET extraction failed, try a simpler approach: extract readable strings
  if (extracted.trim().length < 50) {
    const readable: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sMatch;
    while ((sMatch = streamRegex.exec(text)) !== null) {
      // Extract printable ASCII sequences
      const printable = sMatch[1].replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s{3,}/g, ' ')
        .trim();
      if (printable.length > 20) {
        readable.push(printable);
      }
    }
    if (readable.length > 0) {
      extracted = readable.join('\n\n');
    }
  }

  return extracted.trim();
}

// Count approximate pages in PDF
function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  // Count /Type /Page entries (excluding /Type /Pages which is the parent)
  const pageMatches = text.match(/\/Type\s*\/Page(?!\s*s)/g);
  return pageMatches ? pageMatches.length : 1;
}

// Chunk text into sections by page breaks or logical sections
function chunkText(text: string, totalPages: number): Array<{ page: number; content: string }> {
  const sections: Array<{ page: number; content: string }> = [];

  // Try splitting by common section headers in Chilean tenders
  const sectionHeaders = [
    /(?:^|\n)((?:ARTÍCULO|ART\.?|TÍTULO|CAPITULO|CAPÍTULO|SECCIÓN|SECCION|PUNTO|NUMERAL)\s*[\d.]+[.:]\s*.*)/gi,
    /(?:^|\n)(\d+\.\s+[A-ZÁÉÍÓÚÑ].*)/g,
    /(?:^|\n)((?:I{1,3}V?|VI{0,3}|X{1,3})\.\s+.*)/g,
  ];

  let chunks: string[] = [];
  for (const regex of sectionHeaders) {
    const parts = text.split(regex).filter(p => p.trim().length > 0);
    if (parts.length > 3) {
      chunks = parts;
      break;
    }
  }

  // Fallback: split by approximate page size
  if (chunks.length <= 1) {
    const charsPerPage = Math.ceil(text.length / Math.max(totalPages, 1));
    for (let i = 0; i < text.length; i += charsPerPage) {
      chunks.push(text.substring(i, i + charsPerPage));
    }
  }

  chunks.forEach((chunk, i) => {
    if (chunk.trim().length > 0) {
      sections.push({
        page: Math.min(i + 1, totalPages),
        content: chunk.trim(),
      });
    }
  });

  return sections;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) return authResult;

  const { userId, supabase } = authResult;

  try {
    const { document_id, storage_path, licitacion_id }: ProcessRequest = await req.json();

    if (!document_id || !storage_path) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id or storage_path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} processing PDF: ${storage_path}`);

    // Update status to processing
    await supabase
      .from('documentos_licitacion')
      .update({ status: 'processing' })
      .eq('id', document_id);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bases-licitacion')
      .download(storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message || 'No data'}`);
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const totalPages = countPdfPages(bytes);
    const extractedText = extractTextFromPdfBytes(bytes);

    if (!extractedText || extractedText.length < 20) {
      // PDF might be scanned/image-based - store with note
      await supabase
        .from('documentos_licitacion')
        .update({
          status: 'ready',
          total_pages: totalPages,
          contenido_texto: '[PDF con contenido escaneado - extracción de texto limitada. Las respuestas del chat se basarán en el texto disponible.]',
          secciones: [],
          processed_at: new Date().toISOString(),
        })
        .eq('id', document_id);

      return new Response(
        JSON.stringify({
          success: true,
          pages: totalPages,
          text_length: 0,
          warning: 'PDF appears to be scanned/image-based. Text extraction was limited.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chunk the text
    const secciones = chunkText(extractedText, totalPages);

    // Generate automatic summary using AI
    let resumenAutomatico = null;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    if (GEMINI_API_KEY && extractedText.length > 100) {
      try {
        const textoParaResumen = extractedText.substring(0, 25000);
        const response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GEMINI_MODEL,
            messages: [
              {
                role: "system",
                content: `Eres un experto en licitaciones públicas de Chile. Analiza el documento y extrae información clave.
Responde SOLO con JSON válido (sin markdown):
{
  "objeto": "Propósito de la licitación",
  "plazos": [{"tipo": "nombre", "fecha": "fecha si se menciona"}],
  "requisitos_tecnicos": ["lista de requisitos"],
  "garantias": {"seriedad": "monto/porcentaje", "fiel_cumplimiento": "monto/porcentaje"},
  "criterios_evaluacion": [{"criterio": "nombre", "peso": "porcentaje"}],
  "presupuesto": "monto estimado si se menciona"
}`
              },
              { role: "user", content: `Analiza este documento de bases de licitación:\n\n${textoParaResumen}` }
            ],
            temperature: 0.2,
            max_tokens: 3000,
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            let clean = content.trim();
            if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
            try {
              resumenAutomatico = JSON.parse(clean);
            } catch {
              resumenAutomatico = { objeto: content };
            }
          }
        }
      } catch (e) {
        console.error('AI summary failed (non-blocking):', e);
      }
    }

    // Update document with extracted data
    await supabase
      .from('documentos_licitacion')
      .update({
        status: 'ready',
        total_pages: totalPages,
        contenido_texto: extractedText,
        secciones: secciones,
        resumen_automatico: resumenAutomatico,
        processed_at: new Date().toISOString(),
      })
      .eq('id', document_id);

    console.log(`PDF processed: ${totalPages} pages, ${extractedText.length} chars, ${secciones.length} sections`);

    return new Response(
      JSON.stringify({
        success: true,
        pages: totalPages,
        text_length: extractedText.length,
        sections: secciones.length,
        has_summary: !!resumenAutomatico,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);

    // Try to update document status to error
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.document_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        await adminClient
          .from('documentos_licitacion')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', body.document_id);
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
