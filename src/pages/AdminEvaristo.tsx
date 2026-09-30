import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FirmaVBHeader } from '@/components/layout/FirmaVBHeader';
import { MessageSquare, Terminal } from 'lucide-react';
import { EvaristoChat } from '@/components/evaristo/EvaristoChat';
import { EvaristoPanel } from '@/components/evaristo/EvaristoPanel';

export default function AdminEvaristo() {
  return (
    <div className="space-y-6 p-6">
      <FirmaVBHeader
        title="Evaristo - Administración"
        subtitle="Control y ejecución remota del programador autónomo"
      />

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversar con Evaristo
          </TabsTrigger>
          <TabsTrigger value="panel" className="gap-2">
            <Terminal className="h-4 w-4" />
            Panel de Control
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <EvaristoChat />
        </TabsContent>

        <TabsContent value="panel" className="mt-4">
          <EvaristoPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
