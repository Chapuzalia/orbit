export function requireWorkspace(user, organizations) {
  const id = user?.organization_id
  if (!id) {
    const error = new Error('Tu cuenta no tiene una organizacion asignada. En PocketBase, abre tu registro en users y asigna organization_id al mismo workspace que las credenciales. Despues pulsa Reintentar.')
    error.code = 'ORBIT_WORKSPACE'
    throw error
  }
  if (organizations && !organizations.some((organization) => organization.id === id)) {
    const error = new Error('No se puede acceder al workspace de tu cuenta. Comprueba en PocketBase que users.organization_id apunta a una organizacion existente y que su regla de lectura permite acceder a tu cuenta. Despues pulsa Reintentar.')
    error.code = 'ORBIT_WORKSPACE'
    throw error
  }
  return id
}
