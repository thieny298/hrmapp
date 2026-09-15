import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://app.optways.net'
const FROM_EMAIL = 'no-reply@optways.net'
const LOGO_URL = 'https://app.optways.net/Optways-Logo.svg'
const PRIMARY = '#065f46'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  full: 'Nghỉ cả ngày',
  morning: 'Nghỉ nửa buổi sáng',
  afternoon: 'Nghỉ nửa buổi chiều',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN')
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

function emailHtml({
  body,
  approveUrl,
  rejectUrl,
}: {
  body: string
  approveUrl?: string
  rejectUrl?: string
}) {
  const buttons = approveUrl && rejectUrl ? `
    <table role="presentation" align="center" style="margin:24px auto 0;border-collapse:collapse;">
      <tr>
        <td style="padding:0 15px;">
          <a href="${approveUrl}" title="Đồng ý duyệt đơn" style="
            background:${PRIMARY};color:#fff;padding:10px 22px;
            border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;
            display:inline-block;min-width:150px;text-align:center;
          ">Đồng ý</a>
        </td>
        <td style="padding:0 15px;">
          <a href="${rejectUrl}" title="Từ chối đơn" style="
            background:#fff;color:#b91c1c;padding:9px 22px;
            border:1px solid #b91c1c;border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;
            display:inline-block;min-width:150px;text-align:center;
          ">Từ chối</a>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#9ca3af;margin-top:12px;text-align:center;">
      Hoặc vào <a href="${APP_URL}/duyet-nghi-phep" title="Trang duyệt đơn nghỉ phép" style="color:${PRIMARY};">trang duyệt đơn</a> để xử lý.
    </p>
  ` : ''

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        <div style="background:#fafffa;padding:20px 15px;">
          <img src="${LOGO_URL}" alt="Optways" style="height:26px;display:block;" />
        </div>
        <div style="padding:28px 32px;font-size:14px;color:#3c4257;line-height:1.7;">
          ${body}
          ${buttons}
        </div>
        <div style="padding:16px 32px;background:#fafafa;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;text-align:center;">
          Email tự động từ hệ thống Optways · <a href="${APP_URL}" title="Optways HR" style="color:${PRIMARY};">app.optways.net</a>
        </div>
      </div>
    </body>
    </html>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Thiếu Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Không xác thực được người gọi' }), { status: 401, headers: corsHeaders })
    }

    const { leave_id } = await req.json()

    const { data: leave, error: leaveErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', leave_id)
      .single()

    if (leaveErr || !leave) throw new Error('Leave not found: ' + leaveErr?.message)

    if (leave.user_id !== caller.id) {
      return new Response(JSON.stringify({ error: 'Không có quyền gửi thông báo cho đơn này' }), { status: 403, headers: corsHeaders })
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', leave.user_id)
      .single()

    const userName = userProfile?.full_name || 'Nhân viên'

    const token = leave.approval_token
    if (!token) throw new Error('Leave request has no approval_token')

    const approveUrl = `${SUPABASE_URL}/functions/v1/approve-leave?id=${leave_id}&action=approve&token=${token}`
    const rejectUrl = `${SUPABASE_URL}/functions/v1/approve-leave?id=${leave_id}&action=reject&token=${token}`

    const { data: allRecipients } = await supabase
      .from('user_profiles')
      .select('email, full_name, role')
      .in('role', ['admin', 'ceo', 'manager'])

    const approvers = (allRecipients || []).filter(a => ['admin', 'ceo'].includes(a.role))
    const fyiRecipients = (allRecipients || []).filter(a => a.role === 'manager')

    const breakdownHtml = breakdownLinesHtml(leave.day_breakdown, leave.from_date, leave.to_date, leave.leave_type)

    const infoRows = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <tr><td style="padding:8px 6px;color:#6b7280;width:140px;">Nhân viên</td><td style="padding:8px 6px;font-weight:600;">${userName}</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 6px;color:#6b7280;vertical-align:top;">Chi tiết ngày nghỉ</td><td style="padding:8px 6px;font-weight:600;">${breakdownHtml}</td></tr>
        <tr><td style="padding:8px 6px;color:#6b7280;">Số ngày</td><td style="padding:8px 6px;font-weight:600;">${leave.days_count} ngày</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 6px;color:#6b7280;">Lý do</td><td style="padding:8px 6px;">${leave.reason}</td></tr>
        <tr><td style="padding:8px 6px;color:#6b7280;">Bàn giao cho</td><td style="padding:8px 6px;">${leave.handover_to || '—'}</td></tr>
      </table>
    `

    const approverSends = approvers.map(approver =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Optways HR <${FROM_EMAIL}>`,
          to: [approver.email],
          subject: `[Chờ duyệt] Đơn nghỉ phép - ${userName}`,
          html: emailHtml({
            body: `<p>Xin chào <strong>${approver.full_name || 'bạn'}</strong>,</p>
                   <p><strong>${userName}</strong> vừa gửi đơn xin nghỉ phép. Vui lòng xem xét và phê duyệt.</p>
                   ${infoRows}`,
            approveUrl,
            rejectUrl,
          }),
        }),
      })
    )

    const fyiSends = fyiRecipients.map(mgr =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Optways HR <${FROM_EMAIL}>`,
          to: [mgr.email],
          subject: `[Thông báo] Đơn nghỉ phép - ${userName}`,
          html: emailHtml({
            body: `<p>Xin chào <strong>${mgr.full_name || 'bạn'}</strong>,</p>
                   <p><strong>${userName}</strong> vừa gửi đơn xin nghỉ phép. Đơn đang được gửi tới admin để phê duyệt, đây là email thông báo để bạn biết trước, không cần xử lý.</p>
                   ${infoRows}`,
          }),
        }),
      })
    )

    await Promise.all([...approverSends, ...fyiSends])

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
