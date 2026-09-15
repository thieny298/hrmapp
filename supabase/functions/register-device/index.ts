import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = 'no-reply@optways.net'
const ADMIN_EMAIL = 'thieny298@gmail.com'
const LOGO_URL = 'https://app.optways.net/Optways-Logo.svg'
const PRIMARY = '#065f46'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sendEmail(to: string, subject: string, html: string) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Optways HR <${FROM_EMAIL}>`, to: [to], subject, html }),
  })
}

function deviceRequestHtml(userName: string, deviceLabel: string, approveUrl: string, rejectUrl: string) {
  return `
    <!DOCTYPE html><html><head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        <div style="background:#fafffa;padding:20px 15px;">
          <img src="${LOGO_URL}" alt="Optways" style="height:26px;display:block;" />
        </div>
        <div style="padding:28px 32px;font-size:14px;color:#3c4257;line-height:1.7;">
          <p style="font-size:16px;font-weight:700;color:${PRIMARY};margin:0 0 16px;">Thiết bị mới cần phê duyệt</p>
          <p><strong>${userName}</strong> đang đăng nhập từ một thiết bị thứ 3 (đã đủ 2 máy được duyệt trước đó).</p>
          <div style="background:#f9fafb;padding:10px 12px;border-radius:6px;font-size:13px;margin-bottom:8px;">${deviceLabel}</div>
          <div style="margin-top:24px;text-align:center;">
            <a href="${approveUrl}" style="background:${PRIMARY};color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;display:inline-block;margin-right:10px;">Duyệt thiết bị</a>
            <a href="${rejectUrl}" style="background:#b91c1c;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;display:inline-block;">Từ chối</a>
          </div>
        </div>
      </div>
    </body></html>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Thiếu authorization' }, 401)

    const authed = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await authed.auth.getUser()
    if (userError || !userData?.user) return json({ error: 'Không xác thực được người dùng' }, 401)

    const userId = userData.user.id
    const body = await req.json()
    const deviceId = body?.device_id
    const deviceLabel = body?.device_label || 'Không xác định'

    if (!deviceId) return json({ error: 'Thiếu device_id' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: profile } = await admin
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const userName = profile?.full_name || 'Nhân viên'

    const { data: existing } = await admin
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (existing) {
      await admin.from('user_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', existing.id)
      if (existing.status === 'approved') return json({ status: 'approved' }, 200)
      return json({ status: 'pending', error: 'Thiết bị này đang chờ admin phê duyệt.' }, 200)
    }

    const { count } = await admin
      .from('user_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'approved')

    if ((count || 0) < 2) {
      await admin.from('user_devices').insert({
        user_id: userId,
        device_id: deviceId,
        device_label: deviceLabel,
        status: 'approved',
      })
      return json({ status: 'approved' }, 200)
    }

    const token = crypto.randomUUID()

    const { data: inserted, error: insertError } = await admin
      .from('user_devices')
      .insert({
        user_id: userId,
        device_id: deviceId,
        device_label: deviceLabel,
        status: 'pending',
        approval_token: token,
      })
      .select()
      .single()

    if (insertError) return json({ error: 'Lỗi khi lưu thiết bị' }, 500)

    const approveUrl = `${SUPABASE_URL}/functions/v1/device-decision?id=${inserted.id}&action=approve&token=${token}`
    const rejectUrl = `${SUPABASE_URL}/functions/v1/device-decision?id=${inserted.id}&action=reject&token=${token}`

    await sendEmail(
      ADMIN_EMAIL,
      `[Thiết bị mới] ${userName} cần phê duyệt`,
      deviceRequestHtml(userName, deviceLabel, approveUrl, rejectUrl)
    )

    return json({ status: 'pending', error: 'Bạn đã dùng đủ 2 máy được duyệt. Admin sẽ nhận email để duyệt thiết bị này.' }, 200)
  } catch (e) {
    return json({ error: 'Lỗi hệ thống' }, 500)
  }
})
