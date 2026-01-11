import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Settings, 
  TrendingUp,
  DollarSign,
  Send,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOdooStatus, useOdooOpportunities } from '@/hooks/useOdooIntegration';
import { OdooConnectionTest } from '@/components/odoo/OdooConnectionTest';
import { OdooOpportunitiesList } from '@/components/odoo/OdooOpportunitiesList';
import { OdooStatistics } from '@/components/odoo/OdooStatistics';
import { OdooConfiguration } from '@/components/odoo/OdooConfiguration';

export default function OdooDashboard() {
  const { data: odooStatus, isLoading: statusLoading, refetch: refetchStatus } = useOdooStatus();
  const { data: opportunities, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useOdooOpportunities();

  const handleRefresh = async () => {
    await Promise.all([refetchStatus(), refetchOpportunities()]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">O</span>
                  </div>
                  Integración Odoo CRM
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gestiona la sincronización de oportunidades con tu CRM
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection Status Badge */}
              {statusLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : odooStatus?.configured ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Conectado
                </Badge>
              ) : (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/20 px-4 py-2">
                  <XCircle className="h-4 w-4 mr-2" />
                  Desconectado
                </Badge>
              )}
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={statusLoading || opportunitiesLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(statusLoading || opportunitiesLoading) ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Statistics and Connection Test */}
          <div className="space-y-6">
            {/* Statistics */}
            <OdooStatistics 
              opportunities={opportunities || []} 
              isLoading={opportunitiesLoading} 
            />

            {/* Connection Test */}
            <OdooConnectionTest 
              status={odooStatus} 
              isLoading={statusLoading}
              onRefresh={refetchStatus}
            />
          </div>

          {/* Center Column - Opportunities List */}
          <div className="lg:col-span-2">
            <OdooOpportunitiesList 
              opportunities={opportunities || []} 
              isLoading={opportunitiesLoading}
            />
          </div>
        </div>

        <Separator className="my-8" />

        {/* Configuration Section */}
        <OdooConfiguration />
      </div>
    </div>
  );
}
