import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://app.optways.net'
const FROM_EMAIL = 'no-reply@optways.net'
const LOGO_URL = 'https://app.optways.net/Optways-Logo.svg'
const PRIMARY = '#065f46'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LEAVE_TYPE_LABEL: Record<string, string> = {
  full: 'Nghỉ cả ngày',
  morning: 'Nghỉ nửa buổi sáng',
  afternoon: 'Nghỉ nửa buổi chiều',
}

function typeLabelFromBreakdown(dayBreakdown: any, fallback: string) {
  if (!Array.isArray(dayBreakdown) || dayBreakdown.length === 0) return LEAVE_TYPE_LABEL[fallback] || fallback
  const types = new Set(dayBreakdown.map((d: any) => d.type))
  if (types.size === 1) {
    const t = [...types][0] as string
    return LEAVE_TYPE_LABEL[t] || t
  }
  return 'Nhiều loại ngày'
}

function breakdownLinesHtml(dayBreakdown: any, fromDate: string, toDate: string, fallbackType: string) {
  if (!Array.isArray(dayBreakdown) || dayBreakdown.length === 0) {
    const range = fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} - ${formatDate(toDate)}`
    return `${range}: ${LEAVE_TYPE_LABEL[fallbackType] || fallbackType}`
  }

  const sorted = [...dayBreakdown].sort((a: any, b: any) => a.date.localeCompare(b.date))
  const groups: { start: string; end: string; type: string }[] = []
  let current = { start: sorted[0].date, end: sorted[0].date, type: sorted[0].type }

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(current.end + 'T00:00:00')
    const cur = new Date(sorted[i].date + 'T00:00:00')
    const diffDays = (cur.getTime() - prev.getTime()) / 86400000
    if (sorted[i].type === current.type && diffDays === 1) {
      current.end = sorted[i].date
    } else {
      groups.push(current)
      current = { start: sorted[i].date, end: sorted[i].date, type: sorted[i].type }
    }
  }
  groups.push(current)

  return groups.map(g => {
    const label = LEAVE_TYPE_LABEL[g.type] || g.type
    const range = g.start === g.end ? formatDate(g.start) : `${formatDate(g.start)} - ${formatDate(g.end)}`
    return `${range}: ${label}`
  }).join('<br/>')
}

function leaveSummaryText(leave: any) {
  const dayBreakdown = leave.day_breakdown
  if (!Array.isArray(dayBreakdown) || dayBreakdown.length === 0) {
    const range = leave.from_date === leave.to_date
      ? formatDate(leave.from_date)
      : `${formatDate(leave.from_date)} – ${formatDate(leave.to_date)}`
    const label = LEAVE_TYPE_LABEL[leave.leave_type] || leave.leave_type
    const lower = label.charAt(0).toLowerCase() + label.slice(1)
    return `${range} (${leave.days_count} ngày, ${lower})`
  }

  const sorted = [...dayBreakdown].sort((a: any, b: any) => a.date.localeCompare(b.date))
  const groups: { start: string; end: string; type: string }[] = []
  let current = { start: sorted[0].date, end: sorted[0].date, type: sorted[0].type }
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(current.end + 'T00:00:00')
    const cur = new Date(sorted[i].date + 'T00:00:00')
    const diffDays = (cur.getTime() - prev.getTime()) / 86400000
    if (sorted[i].type === current.type && diffDays === 1) {
      current.end = sorted[i].date
    } else {
      groups.push(current)
      current = { start: sorted[i].date, end: sorted[i].date, type: sorted[i].type }
    }
  }
  groups.push(current)

  if (groups.length === 1) {
    const g = groups[0]
    const range = g.start === g.end ? formatDate(g.start) : `${formatDate(g.start)} – ${formatDate(g.end)}`
    const label = LEAVE_TYPE_LABEL[g.type] || g.type
    const lower = label.charAt(0).toLowerCase() + label.slice(1)
    return `${range} (${leave.days_count} ngày, ${lower})`
  }

  return groups.map(g => {
    const range = g.start === g.end ? formatDate(g.start) : `${formatDate(g.start)} – ${formatDate(g.end)}`
    const label = LEAVE_TYPE_LABEL[g.type] || g.type
    return `${range}: ${label}`
  }).join('<br/>')
}

function calcLeaveEntitlement(joinDateStr?: string) {
  if (!joinDateStr) return 12
  const join = new Date(joinDateStr + 'T00:00:00')
  const now = new Date()
  const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  if (months >= 12) return 12
  return Math.max(0, months)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

function headerBlock() {
  return `
    <div style="background:#fafffa;padding:20px 15px;">
      <img src="${LOGO_URL}" alt="Optways" style="height:26px;display:block;" />
    </div>
  `
}

function footerBlock() {
  return `
    <div style="padding:16px 32px;background:#fafafa;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;">
      Email tự động từ hệ thống Optways · <a href="${APP_URL}" style="color:${PRIMARY};">app.optways.net</a>
    </div>
  `
}

function resultHtml(approved: boolean, userName: string) {
  const color = approved ? '#15803d' : '#b91c1c'
  const text = approved ? 'Đã duyệt thành công!' : 'Đã từ chối đơn.'
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:40px;background:#f3f4f6;font-family:'Segoe UI',sans-serif;text-align:center;">
      <div style="max-width:400px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        ${headerBlock()}
        <div style="padding:32px;">
          <div style="font-size:18px;font-weight:700;color:${color};margin-bottom:8px;">${text}</div>
          <div style="font-size:14px;color:#6b7280;margin-bottom:24px;">Đơn nghỉ phép của <strong>${userName}</strong> đã được xử lý.</div>
          <a href="${APP_URL}/duyet-nghi-phep" style="background:${PRIMARY};color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;display:inline-block;">
            Xem danh sách đơn
          </a>
        </div>
      </div>
    </body></html>
  `
}

function notifyHtml(approved: boolean, approverName: string, leave: any, remainLeave: number | null) {
  const color = approved ? '#15803d' : '#b91c1c'
  const statusText = approved ? 'Đã được duyệt' : 'Đã bị từ chối'
  const typeLabel = typeLabelFromBreakdown(leave.day_breakdown, leave.leave_type)

  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        ${headerBlock()}
        <div style="padding:28px 32px;font-size:14px;color:#3c4257;line-height:1.7;">
          <p style="font-size:16px;font-weight:700;color:${color};margin:0 0 16px;">${statusText}</p>
          <p>Đơn nghỉ phép của bạn đã được ${approverName} ${approved ? 'phê duyệt' : 'từ chối'}.</p>
          <p>Thời gian nghỉ: <strong>${leaveSummaryText(leave)}</strong>.</p>
          ${approved && remainLeave !== null ? `<p>Bạn còn ${remainLeave} ngày phép trong năm.</p>` : ''}
          ${approved && leave.handover_to ? `<p>Đừng quên bàn giao công việc cho ${leave.handover_to} (${leave.handover_email}) trước khi nghỉ nhé!</p>` : ''}
        </div>
        ${footerBlock()}
      </div>
    </body></html>
  `
}

function handoverHtml(leave: any, userName: string) {
  const typeLabel = typeLabelFromBreakdown(leave.day_breakdown, leave.leave_type)
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        ${headerBlock()}
        <div style="padding:28px 32px;font-size:14px;color:#3c4257;line-height:1.7;">
          <p>Xin chào <strong>${leave.handover_to}</strong>,</p>
          <p><strong>${userName}</strong> sẽ nghỉ phép (<strong>${leave.days_count} ngày</strong>):</p>
          <div style="background:#f9fafb;padding:10px 12px;border-radius:6px;margin:0 0 16px;font-size:13px;">
            ${breakdownLinesHtml(leave.day_breakdown, leave.from_date, leave.to_date, leave.leave_type)}
          </div>
          <p style="background:#fffbeb;padding:12px;border-radius:6px;border-left:3px solid #f59e0b;">
            Công việc sẽ được bàn giao cho bạn trong thời gian này. Vui lòng phối hợp với <strong>${userName}</strong> để bàn giao.
          </p>
        </div>
        ${footerBlock()}
      </div>
    </body></html>
  `
}

async function sendEmail(to: string, subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Optways HR <${FROM_EMAIL}>`, to: [to], subject, html }),
  })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const leaveId = url.searchParams.get('id')
  const action = url.searchParams.get('action')
  const token = url.searchParams.get('token')

  if (!leaveId || !action || !token) {
    return new Response('Invalid request', { status: 400 })
  }

  const { data: leave } = await supabase
    .from('leave_requests')
    .select('*, user_profiles!leave_requests_user_id_fkey(full_name, email)')
    .eq('id', leaveId)
    .single()

  if (!leave) return new Response('Not found', { status: 404 })

  if (leave.status !== 'pending') {
    return new Response(`<html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2>⚠️ Đơn này đã được xử lý rồi.</h2>
      <p>Trạng thái hiện tại: <strong>${leave.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</strong></p>
      <a href="${APP_URL}/duyet-nghi-phep">Xem danh sách đơn</a>
    </body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  }

  if (leave.approval_token !== token) return new Response('Invalid token', { status: 403 })

  const approved = action === 'approve'
  const newStatus = approved ? 'approved' : 'rejected'
  const userName = leave.user_profiles?.full_name || 'Nhân viên'
  const userEmail = leave.user_profiles?.email

  await supabase.from('leave_requests').update({
    status: newStatus,
    approved_at: new Date().toISOString(),
    approval_token: null,
  }).eq('id', leaveId)

  let remainLeave: number | null = null
  if (approved) {
    const { data: empProfile } = await supabase
      .from('employee_profiles')
      .select('join_date')
      .eq('user_id', leave.user_id)
      .maybeSingle()

    const { data: approvedLeaves } = await supabase
      .from('leave_requests')
      .select('days_count')
      .eq('user_id', leave.user_id)
      .eq('status', 'approved')

    const totalLeave = calcLeaveEntitlement(empProfile?.join_date)
    const usedLeave = (approvedLeaves || []).reduce((sum, l) => sum + (Number(l.days_count) || 0), 0)
    remainLeave = totalLeave - usedLeave
  }

  if (userEmail) {
    await sendEmail(
      userEmail,
      `[${approved ? 'Đã duyệt' : 'Từ chối'}] Đơn nghỉ phép của bạn`,
      notifyHtml(approved, 'quản lý', leave, remainLeave)
    )
  }

  if (approved && leave.handover_email) {
    await sendEmail(
      leave.handover_email,
      `[Thông báo] Bàn giao công việc từ ${userName}`,
      handoverHtml(leave, userName)
    )
  }

  return new Response(resultHtml(approved, userName), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
})
