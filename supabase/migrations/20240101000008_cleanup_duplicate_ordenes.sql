-- =========================================================
-- Migración: Limpiar órdenes duplicadas
-- Ejecutar en Supabase SQL Editor
-- =========================================================

-- 1. Eliminar documentos vinculados a órdenes duplicadas
--    (mantener solo los del primer registro de cada número_orden)
DELETE FROM gestion_documentos
WHERE orden_id IN (
    SELECT id FROM gestion_ordenes go1
    WHERE EXISTS (
        SELECT 1 FROM gestion_ordenes go2
        WHERE go1.numero_orden = go2.numero_orden
        AND go1.id > go2.id
    )
);

-- 2. Eliminar órdenes duplicadas
--    (mantener la más antigua por cada número_orden)
DELETE FROM gestion_ordenes go1
WHERE EXISTS (
    SELECT 1 FROM gestion_ordenes go2
    WHERE go1.numero_orden = go2.numero_orden
    AND go1.id > go2.id
);

-- 3. Verificar resultado: mostrar órdenes únicas
SELECT COUNT(*) as total_ordenes, 
       COUNT(DISTINCT numero_orden) as ordenes_unicas
FROM gestion_ordenes;
