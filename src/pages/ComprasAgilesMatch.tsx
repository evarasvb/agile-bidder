import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, RefreshCw, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAutoBidsOpportunities } from '@/hooks/useAutoBidsOpportunities';
import { AutoBidsOpportunitiesList } from '@/components/auto-bids/AutoBidsOpportunitiesList';

export default function ComprasAgilesMatch() {
  const { opportunities, loading, filters, setFilters, stats, refresh } = useAutoBidsOpportunities();
  const [activeTab, setActiveTab] = useState('all');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setFilters({ ...filters, estado: value === 'all' ? 'all' : value });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras Agiles - Match</h1>
          <p className="text-muted-foreground">Oportunidades que coinciden con tus configuraciones</p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ofertados</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.ofertados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adjudicados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.adjudicados}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o codigo..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <Select value={filters.sortBy} onValueChange={(value: any) => setFilters({ ...filters, sortBy: value })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fecha_cierre">Fecha de cierre</SelectItem>
                <SelectItem value="presupuesto">Presupuesto</SelectItem>
                <SelectItem value="match_score">Match score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">Todas <Badge variant="secondary" className="ml-2">{stats.total}</Badge></TabsTrigger>
          <TabsTrigger value="pendiente">Pendientes <Badge variant="secondary" className="ml-2">{stats.pendientes}</Badge></TabsTrigger>
          <TabsTrigger value="ofertado">Ofertados <Badge variant="secondary" className="ml-2">{stats.ofertados}</Badge></TabsTrigger>
          <TabsTrigger value="adjudicado">Adjudicados <Badge variant="secondary" className="ml-2">{stats.adjudicados}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : opportunities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No hay oportunidades</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  No se encontraron compras agiles que coincidan con tus configuraciones.
                </p>
              </CardContent>
            </Card>
          ) : (
            <AutoBidsOpportunitiesList opportunities={opportunities} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
