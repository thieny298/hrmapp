import { supabase } from './supabase'

const AUTH_DOMAIN = 'optways.internal'
const DEFAULT_PASSWORD = 'Optways@123'

export function employeeCodeToAuthEmail(employeeCode) {
  return `${employeeCode.toLowerCase()}@${AUTH_DOMAIN}`
}

export async function createEmployeeAccount(employeeCode) {
  const authEmail = employeeCodeToAuthEmail(employeeCode)

  const { data, error } = await supabase.auth.admin.createUser({
    email: authEmail,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { employee_code: employeeCode, must_change_password: true },
  })

  if (error) return { error }

  return { userId: data.user.id }
}

export async function loginWithEmployeeCode(employeeCode, password) {
  const authEmail = employeeCodeToAuthEmail(employeeCode)
  return supabase.auth.signInWithPassword({ email: authEmail, password })
}
