import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'employees', label: 'Nhân viên' },
  { key: 'customers', label: 'Khách hàng', hasScope: true },
  { key: 'tasks', label: 'Công việc', hasScope: true },
  { key: 'attendance', label: 'Chấm công' },
  { key: 'leave', label: 'Nghỉ phép' },
  { key: 'salary', label: 'Lương' },
  { key: 'reports', label: 'Báo cáo' },
  { key: 'users', label: 'Người dùng' },
]

const ROLES = [
  { key: 'manager', label: 'Manager' },
  { key: 'staff', label: 'Nhân viên' },
]

export default function PermissionsPage() {
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('role_permissions').select('*')
    const map = {}
    for (const row of data || []) {
      map[`${row.role}:${row.module}`] = row
    }
    setRows(map)
    setLoading(false)
  }

  function getRow(role, moduleKey) {
    return rows[`${role}:${moduleKey}`] || { role, module: moduleKey, can_view: false, can_edit: false, scope: 'all' }
  }

  async function save(role, moduleKey, updated) {
    const k = `${role}:${moduleKey}`
    setSavingKey(k)
    setRows(prev => ({ ...prev, [k]: updated }))
    await supabase.from('role_permissions').upsert({
      role,
      module: moduleKey,
      can_view: updated.can_view,
      can_edit: updated.can_edit,
      scope: updated.scope,
    }, { onConflict: 'role,module' })
    setSavingKey(null)
  }

  function toggle(role, moduleKey, field) {
    const current = getRow(role, moduleKey)
    const updated = { ...current, [field]: !current[field] }
    if (field === 'can_edit' && updated.can_edit) updated.can_view = true
    if (field === 'can_view' && !updated.can_view) updated.can_edit = false
    save(role, moduleKey, updated)
  }

  function setScope(role, moduleKey, scope) {
    const current = getRow(role, moduleKey)
    save(role, moduleKey, { ...current, scope })
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="permissions-page">
      {ROLES.map(role => (
        <div key={role.key} className="permissions-role-block">
          <h3>{role.label}</h3>
          <table className="permissions-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Xem</th>
                <th>Sửa</th>
                <th>Phạm vi</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map(mod => {
                const row = getRow(role.key, mod.key)
                const k = `${role.key}:${mod.key}`
                return (
                  <tr key={mod.key} className={savingKey === k ? 'saving' : ''}>
                    <td>{mod.label}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.can_view}
                        onChange={() => toggle(role.key, mod.key, 'can_view')}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.can_edit}
                        onChange={() => toggle(role.key, mod.key, 'can_edit')}
                      />
                    </td>
                    <td>
                      {mod.hasScope ? (
                        <select value={row.scope} onChange={e => setScope(role.key, mod.key, e.target.value)}>
                          <option value="own">Của mình</option>
                          <option value="all">Tất cả</option>
                        </select>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
