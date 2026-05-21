import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathForView } from './routes'

/** Navigate using legacy view ids (overview, admin_users, …). */
export function useAppNavigate() {
  const navigate = useNavigate()
  return useCallback(
    (view) => {
      navigate(pathForView(view))
    },
    [navigate],
  )
}
