// @ts-nocheck
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Search, MapPin, Phone, Mail, TrendingUp } from 'lucide-react';

const REGIONES = [
  'Metropolitana', 'Valparaíso', 'Biobío', 'Maule', 'Araucanía',
  "O'Higgins", 'Los Lagos', 'Coquimbo', 'Antofagasta', 'Tarapacá',
  'Atacama', 'Los Ríos', 'Aysén', 'Magallanes', 'Arica y Parinacota', 'Ñuble'
];

const mockInstituciones = [
  {
    id: 1,
    nombre: 'Hospital Regional de Talca',
    rut: '61.602.000-0',
    region: 'Maule',
    comuna: 'Talca',
    telefono: '+56 71 2412000',
    email: 'contacto@hospitaltalca.cl',
    comprasAnuales: '$2.5B',
    licitacionesActivas: 12
  },
  {
    id: 2,
    nombre: 'Municipalidad de Santiago',
    rut: '69.070.100-5',
    region: 'Metropolitana',
    comuna: 'Santiago',
    telefono: '+56 2 27136000',
    email: 'info@munistgo.cl',
    comprasAnuales: '$8.2B',
    licitacionesActivas: 34
  },
  {
    id: 3,
    nombre: 'Universidad de Chile',
    rut: '60.910.000-1',
    region: 'Metropolitana',
    comuna: 'Santiago',
    telefono: '+56 2 29782000',
    email: 'contacto@uchile.cl',
    comprasAnuales: '$4.1B',
    licitacionesActivas: 18
  },
  {
    id: 4,
    nombre: 'Servicio de Salud Valparaíso',
    rut: '61.606.100-K',
    region: 'Valparaíso',
    comuna: 'Valparaíso',
    telefono: '+56 32 2576000',
    email: 'contacto@ssvalpo.cl',
    comprasAnuales: '$1.8B',
    licitacionesActivas: 8
  },
  {
    id: 5,
    nombre: 'MOP Dirección de Vialidad',
    rut: '61.202.000-0',
    region: 'Metropolitana',
    comuna: 'Santiago',
    telefono: '+56 2 24496000',
    email: 'vialidad@mop.gov.cl',
    comprasAnuales: '$12.5B',
    licitacionesActivas: 45
  },
  {
    id: 6,
    nombre: 'Carabineros de Chile',
    rut: '60.903.000-0',
    region: 'Metropolitana',
    comuna: 'Santiago',
    telefono: '+56 2 29221000',
    email: 'contacto@carabineros.cl',
    comprasAnuales: '$6.3B',
    licitacionesActivas: 22
  }
];

export default function Instituciones() {
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  const filteredInstituciones = mockInstituciones.filter(inst => {
    const matchesSearch = inst.nombre.toLowerCase().includes(search.toLowerCase()) ||
                          inst.rut.includes(search);
    const matchesRegion = !selectedRegion || inst.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Instituciones</h1>
          <p className="text-muted-foreground">
            Explora instituciones públicas y sus patrones de compra
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RUT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">Todas las regiones</option>
          {REGIONES.map((region) => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
        <Button variant="outline">Filtros avanzados</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInstituciones.map((inst) => (
          <Card key={inst.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{inst.nombre}</CardTitle>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">RUT: {inst.rut}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{inst.comuna}, {inst.region}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{inst.telefono}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{inst.email}</span>
              </div>
              <div className="pt-2 border-t flex justify-between items-center">
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="font-medium">{inst.comprasAnuales}</span>
                  <span className="text-muted-foreground">anuales</span>
                </div>
                <span className="text-sm text-primary font-medium">
                  {inst.licitacionesActivas} activas
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredInstituciones.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No se encontraron instituciones</h3>
          <p className="text-muted-foreground">
            Intenta con otros criterios de búsqueda
          </p>
        </div>
      )}
    </div>
  );
}
