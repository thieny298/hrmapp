import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LOGO_URL = 'https://app.optways.net/Optways-Logo.svg'
const PRIMARY = '#065f46'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function resultHtml(approved: boolean, userName: string) {
  const color = approved ? '#15803d' : '#b91c1c'
  const text = approved ? 'Đã duyệt thiết bị thành công!' : 'Đã từ chối thiết bị.'
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:40px;background:#f3f4f6;font-family:'Segoe UI',sans-serif;text-align:center;">
      <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        <div style="background:#fafffa;padding:20px 15px;">
          <img src="${LOGO_URL}" alt="Optways" style="height:26px;display:block;" />
        </div>
        <div style="padding:32px;">
          <div style="font-size:18px;font-weight:700;color:${color};margin-bottom:8px;">${text}</div>
          <div style="font-size:14px;color:#6b7280;">Thiết bị của <strong>${userName}</strong> đã được xử lý.</div>
        </div>
      </div>
    </body></html>
  `
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const deviceRowId = url.searchParams.get('id')
  const action = url.searchParams.get('action')
  const token = url.searchParams.get('token')

  if (!deviceRowId || !action || !token) {
    return new Response('Invalid request', { status: 400 })
  }

  const { data: device } = await supabase
    .from('user_devices')
    .select('*')
    .eq('id', deviceRowId)
    .single()

  if (!device) return new Response('Not found', { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', device.user_id)
    .single()

  const userName = profile?.full_name || 'Nhân viên'

  if (device.status !== 'pending') {
    return new Response(`<html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2>⚠️ Thiết bị này đã được xử lý rồi.</h2>
      <p>Trạng thái hiện tại: <strong>${device.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</strong></p>
    </body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  }

  if (device.approval_token !== token) return new Response('Invalid token', { status: 403 })

  const approved = action === 'approve'
  const newStatus = approved ? 'approved' : 'rejected'

  await supabase.from('user_devices').update({
    status: newStatus,
    approval_token: null,
  }).eq('id', deviceRowId)

  return new Response(resultHtml(approved, userName), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
})
