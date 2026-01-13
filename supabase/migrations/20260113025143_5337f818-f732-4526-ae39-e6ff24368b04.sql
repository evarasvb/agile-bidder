-- Agregar constraint único para adjudicaciones (licitacion + proveedor)
ALTER TABLE public.licitaciones_adjudicaciones 
ADD CONSTRAINT licitaciones_adjudicaciones_licitacion_proveedor_unique 
UNIQUE (licitacion_id, proveedor_rut);