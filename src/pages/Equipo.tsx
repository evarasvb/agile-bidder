import { EquipoTabs } from "@/components/equipo/EquipoTabs";
import { useState } from 'react';
import { Users, Trophy, UserPlus, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EquipoMemberList } from '@/components/equipo/EquipoMemberList';
import { EquipoLeaderboard } from '@/components/equipo/EquipoLeaderboard';
import { InvitarMiembroDialog } from '@/components/equipo/InvitarMiembroDialog';
import { Button } from '@/components/ui/button';

export default function Equipo() {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <EquipoTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipo Comercial
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu equipo de vendedores, asignaciones y rendimiento
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Miembro
        </Button>
      </div>

      <Tabs defaultValue="miembros" className="w-full">
        <TabsList>
          <TabsTrigger value="miembros" className="gap-2">
            <Users className="h-4 w-4" />
            Miembros
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="miembros" className="mt-6">
          <EquipoMemberList />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <EquipoLeaderboard />
        </TabsContent>
      </Tabs>

      <InvitarMiembroDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
