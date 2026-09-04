import { supabase } from './supabase'

export const EMPLOYEE_CODE_PREFIX = 'OWS-'

export async function nextEmployeeCodes(count = 1) {
  const { data } = await supabase
    .from('employee_profiles')
    .select('employee_code')
    .like('employee_code', `${EMPLOYEE_CODE_PREFIX}%`)

  const maxSeq = (data || []).reduce((max, row) => {
    const match = new RegExp(`^${EMPLOYEE_CODE_PREFIX}(\\d+)$`).exec(row.employee_code || '')
    const seq = match ? parseInt(match[1], 10) : 0
    return seq > max ? seq : max
  }, 0)

  return Array.from({ length: count }, (_, i) => `${EMPLOYEE_CODE_PREFIX}${String(maxSeq + i + 1).padStart(3, '0')}`)
}
