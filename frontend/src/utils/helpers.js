export const formatDate = (value) => {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export const formatCurrency = (value) => {
  if (value == null) return '—'
  return `₹${Number(value).toLocaleString()}`
}

export const getRoleLabel = (role) => {
  return role?.toLowerCase()?.replace(/^./, (char) => char.toUpperCase()) || 'User'
}
