-- Correccion dirigida solo a la cuenta de acceso de Orbit indicada abajo.
-- Ejecuta este bloque completo en la consola SQL de la base principal de PocketBase.
-- Primer valor: reemplaza TU_EMAIL_ORBIT por el email de la cuenta que quieres corregir.
-- Segundo valor: '' selecciona la UNICA organizacion existente.
-- Si hay varias organizaciones, indica el ID de la que contiene tus credenciales.
-- No cambia roles, contrasenas, otras cuentas ni registros de credenciales.
-- Si no existe la organizacion o hay varias sin elegir, falla por NOT NULL.
-- Devuelve solo el usuario corregido y su workspace.

WITH configuracion (email, organization_id) AS (
    VALUES ('TU_EMAIL_ORBIT', '')
),
destino AS (
    SELECT CASE
        WHEN configuracion.organization_id <> '' THEN (
            SELECT id FROM organizations WHERE id = configuracion.organization_id
        )
        WHEN (SELECT COUNT(*) FROM organizations) = 1 THEN (
            SELECT id FROM organizations LIMIT 1
        )
        ELSE NULL
    END AS organization_id
    FROM configuracion
)
UPDATE users
SET organization_id = (SELECT organization_id FROM destino),
    updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now')
WHERE lower(email) = lower((SELECT email FROM configuracion))
RETURNING id, email, organization_id;
