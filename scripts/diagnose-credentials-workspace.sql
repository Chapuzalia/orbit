-- Diagnostico de solo lectura. No muestra passwords ni notas de las credenciales.
-- Ejecuta la consulta completa en la base principal de PocketBase.
-- Reemplaza TU_EMAIL_ORBIT por el email de tu cuenta de acceso.
SELECT
    u.id AS user_id,
    u.email,
    u.organization_id AS user_organization_id,
    o.id AS organization_id,
    o.name AS organization_name,
    (SELECT COUNT(*) FROM credentials c WHERE c.organization_id = o.id) AS credentials_in_workspace,
    (SELECT COUNT(*) FROM credentials c WHERE c.organization_id = u.organization_id AND u.organization_id <> '') AS credentials_visible_to_user,
    (SELECT COUNT(*) FROM credentials c WHERE c.organization_id IS NULL OR c.organization_id = '') AS credentials_without_workspace
FROM users u
LEFT JOIN organizations o ON 1 = 1
WHERE lower(u.email) = lower('TU_EMAIL_ORBIT')
ORDER BY o.name;
