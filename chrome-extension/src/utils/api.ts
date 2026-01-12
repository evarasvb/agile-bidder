// API Client for FirmaVB Extension
import type { 
  ClienteInfo, 
  MatchOportunidad, 
  OfertaData, 
  SubmitResult 
} from './types';

// IMPORTANT: Replace with your actual Supabase project URL
const SUPABASE_URL = 'https://euzqadopjvdszcdjegmo.supabase.co';
const EXTENSION_API_ENDPOINT = `${SUPABASE_URL}/functions/v1/extension-api`;

class FirmaVBApi {
  private apiKey: string | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  private async request<T>(
    action: string,
    body?: Record<string, any>
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API key no configurada');
    }

    const url = `${EXTENSION_API_ENDPOINT}?action=${action}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }

    return data;
  }

  async verifyApiKey(): Promise<ClienteInfo> {
    const response = await this.request<{ success: boolean; cliente: ClienteInfo }>('verify');
    return response.cliente;
  }

  async getMatches(): Promise<MatchOportunidad[]> {
    const response = await this.request<{ success: boolean; matches: MatchOportunidad[] }>('get-matches');
    return response.matches;
  }

  async getOfferData(ofertaId: string): Promise<OfertaData> {
    const response = await this.request<{ success: boolean; oferta: OfertaData }>(
      'get-offer',
      { oferta_id: ofertaId }
    );
    return response.oferta;
  }

  async getOfferByLicitacion(licitacionId: string): Promise<OfertaData> {
    const response = await this.request<{ success: boolean; oferta: OfertaData }>(
      'get-offer',
      { licitacion_id: licitacionId }
    );
    return response.oferta;
  }

  async submitResult(
    ofertaId: string,
    result: SubmitResult
  ): Promise<{ estado: string }> {
    const response = await this.request<{ success: boolean; estado: string }>(
      'submit-result',
      {
        oferta_id: ofertaId,
        ...result
      }
    );
    return { estado: response.estado };
  }
}

export const api = new FirmaVBApi();
export default api;
