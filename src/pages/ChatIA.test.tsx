import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const state=vi.hoisted(()=>({error:new Error('unavailable')}));
vi.mock('react-router-dom',()=>({useParams:()=>({id:'synthetic'}),useNavigate:()=>vi.fn()}));
vi.mock('@/hooks/useChatIA',()=>({useDocumentosLicitacion:()=>({error:state.error,refetch:vi.fn()}),useChatLicitacion:()=>({data:null,refetch:vi.fn()})}));
vi.mock('@/components/chat-ia/PdfUploadArea',()=>({PdfUploadArea:()=> <button>unsafe upload control</button>}));
vi.mock('@/components/chat-ia/ChatInterface',()=>({ChatInterface:()=> <button>unsafe chat control</button>}));
import ChatIA from './ChatIA';
describe('ChatIA query failure',()=>{
 it('shows unavailable and retry instead of empty documents or mutation controls',()=>{
  const html=renderToStaticMarkup(<ChatIA/>);
  expect(html).toContain('role="alert"');expect(html).toContain('Chat IA no está disponible');expect(html).toContain('Reintentar');
  expect(html).not.toContain('unsafe upload control');expect(html).not.toContain('unsafe chat control');
 });
});
