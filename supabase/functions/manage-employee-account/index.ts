import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'https://app.optways.net'
const FROM_EMAIL = 'no-reply@optways.net'
const LOGO_URL = 'https://app.optways.net/Optways-Logo.svg'
const PRIMARY = '#065f46'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function accountEmailHtml(fullName, loginEmail, password) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);border:1px solid #e5e7eb;">
        <div style="background:#fafffa;padding:20px 32px;">
          <img src="${LOGO_URL}" alt="Optways" style="height:26px;display:block;" />
        </div>
        <div style="padding:28px 32px;font-size:14px;color:#3c4257;line-height:1.7;">
          <p>Chào mừng <strong>${fullName}</strong> đến với Optways HR,</p>
          <p>Optways HR là hệ thống quản lý nhân sự nội bộ của Optways, nơi bạn có thể chủ động theo dõi và quản lý những thông tin liên quan đến quá trình làm việc của mình như hồ sơ cá nhân, chấm công, nghỉ phép và thông tin lương.</p>
          <p>Việc đưa Optways HR vào sử dụng là một trong những bước đầu tiên trong hành trình chuyển đổi số tại Optways. Các công việc liên quan đến nhân sự sẽ được thực hiện đơn giản, rõ ràng và thuận tiện hơn; giảm bớt các thao tác thủ công, hạn chế giấy tờ và giúp mỗi thành viên dễ dàng chủ động với thông tin của mình.</p>
          <p>Quan trọng hơn, việc sử dụng Optways HR không chỉ mang lại một cách làm việc thuận tiện hơn mà còn là một trong những bước đầu tiên để cùng nhau xây dựng một văn hoá làm việc hiện đại, minh bạch và chủ động tại Optways. Từ những việc nhỏ như chấm công đúng giờ, cập nhật thông tin cá nhân hay gửi đơn nghỉ phép đúng quy trình, chúng ta đang từng bước hình thành cách làm việc nhất quán và chuyên nghiệp hơn mỗi ngày.</p>

          <p style="margin-bottom:6px;">Để bắt đầu sử dụng, <strong>${fullName}</strong> làm theo các bước sau:</p>
          <ol style="padding-left:18px;margin-top:0;">
            <li>Đăng nhập bằng email và mật khẩu tạm thời bên dưới.</li>
            <li>Vào mục <strong>Đổi mật khẩu</strong> ở góc dưới sidebar để đặt lại mật khẩu riêng của bạn.</li>
            <li>Kiểm tra và cập nhật hồ sơ cá nhân nếu có thông tin cần chỉnh sửa.</li>
          </ol>

          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
            <tr><td style="padding:8px 6px;color:#6b7280;width:140px;">Email đăng nhập</td><td style="padding:8px 6px;font-weight:600;">${loginEmail}</td></tr>
            <tr style="background:#fafafa;"><td style="padding:8px 6px;color:#6b7280;">Mật khẩu tạm thời</td><td style="padding:8px 6px;font-weight:600;">${password}</td></tr>
          </table>

          <table role="presentation" align="center" style="margin:24px auto 0;border-collapse:collapse;">
            <tr>
              <td style="padding:0 15px;">
                <a href="${APP_URL}" style="
                  background:${PRIMARY};color:#fff;padding:10px 22px;
                  border-radius:6px;text-decoration:none;font-weight:500;font-size:14px;
                  display:inline-block;min-width:150px;text-align:center;
                ">Đăng nhập ngay</a>
              </td>
            </tr>
          </table>

          <p style="margin-top:20px;">Trong thời gian đầu sử dụng, nếu có điều gì chưa rõ hoặc gặp khó khăn khi thao tác, bạn đừng ngại liên hệ với <a href="https://zalo.me/2612094772931178703" title="Liên hệ bộ phận Nhân sự qua Zalo" style="color:${PRIMARY};">bộ phận Nhân sự</a> để được hỗ trợ.</p>
          <p>Hy vọng Optways HR sẽ giúp mọi người có một trải nghiệm làm việc thuận tiện hơn, đồng thời cùng Công ty xây dựng một môi trường chủ động – minh bạch – hiện đại từ những điều nhỏ nhất.</p>
          <p>Chào mừng bạn đến với hành trình này! 🌱</p>

          <p style="margin-top:20px;">Trân trọng,<br/>Optways HR</p>
        </div>
        <div style="padding:16px 32px;background:#fafafa;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;text-align:center;">
          Email tự động từ hệ thống Optways · <a href="${APP_URL}" style="color:${PRIMARY};">app.optways.net</a>
        </div>
      </div>
    </body>
    </html>
  `
}

async function sendAccountEmail(toEmail, fullName, password) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'Thiếu RESEND_API_KEY' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Optways HR <${FROM_EMAIL}>`,
        to: [toEmail],
        subject: 'Tài khoản Optways HR của bạn đã được tạo',
        html: accountEmailHtml(fullName, toEmail, password),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { sent: false, reason: text }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e.message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Thiếu Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Không xác thực được người gọi' }), { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Chỉ admin mới có quyền thực hiện' }), { status: 403, headers: corsHeaders })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'invite') {
      const { email, full_name, role } = body
      if (!email || !full_name) {
        return new Response(JSON.stringify({ error: 'Thiếu email hoặc họ tên' }), { status: 400, headers: corsHeaders })
      }

      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
      })
      if (inviteErr) {
        return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: corsHeaders })
      }

      await supabaseAdmin.from('user_profiles').upsert({
        id: invited.user.id, email, full_name, role: role || 'staff',
      })

      await supabaseAdmin.from('employee_profiles')
        .update({ user_id: invited.user.id })
        .eq('email', email)

      return new Response(JSON.stringify({ user_id: invited.user.id }), { status: 200, headers: corsHeaders })
    }

    if (action === 'set-temp-password') {
      const { user_id, password } = body
      if (!user_id || !password || password.length < 6) {
        return new Response(JSON.stringify({ error: 'Thiếu user_id hoặc mật khẩu quá ngắn (tối thiểu 6 ký tự)' }), { status: 400, headers: corsHeaders })
      }
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
    }

    if (action === 'test-email') {
      const { email, full_name } = body
      if (!email) {
        return new Response(JSON.stringify({ error: 'Thiếu email' }), { status: 400, headers: corsHeaders })
      }
      const result = await sendAccountEmail(email, full_name || 'bạn', 'Optways@123')
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    if (action === 'bulk-create') {
      const DEFAULT_PASSWORD = 'Optways@123'

      const { data: employees, error: fetchErr } = await supabaseAdmin
        .from('employee_profiles')
        .select('id, employee_code, email, full_name, desired_role')
        .is('user_id', null)

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders })
      }

      const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: corsHeaders })
      }

      const results = []

      for (const emp of employees) {
        const isFakeEmail = !emp.email || emp.email.trim() === ''
        const authEmail = isFakeEmail
          ? `${emp.employee_code}@internal.optways.net`
          : emp.email.trim()

        let userId = null
        const existingAuthUser = userList.users.find(u => u.email === authEmail)

        if (existingAuthUser) {
          userId = existingAuthUser.id
          if (userId !== caller.id) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: DEFAULT_PASSWORD,
              email_confirm: true,
            })
          }
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { employee_code: emp.employee_code, role: emp.desired_role || 'staff' },
          })
          if (createErr) {
            results.push({ employee_code: emp.employee_code, success: false, error: createErr.message })
            continue
          }
          userId = created.user.id
        }

        const { data: existingProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()

        if (!existingProfile) {
          const { error: insertErr } = await supabaseAdmin.from('user_profiles').insert({
            id: userId, email: authEmail, full_name: emp.full_name, role: emp.desired_role || 'staff',
          })
          if (insertErr) {
            results.push({ employee_code: emp.employee_code, success: false, error: insertErr.message })
            continue
          }
        }

        const { error: linkErr } = await supabaseAdmin
          .from('employee_profiles')
          .update({ user_id: userId })
          .eq('id', emp.id)

        if (linkErr) {
          results.push({ employee_code: emp.employee_code, success: false, error: linkErr.message })
          continue
        }

        let emailResult = { sent: false, reason: 'Email nội bộ giả, không gửi' }
        if (!isFakeEmail && userId !== caller.id) {
          emailResult = await sendAccountEmail(authEmail, emp.full_name, DEFAULT_PASSWORD)
        }

        results.push({
          employee_code: emp.employee_code,
          success: true,
          email: authEmail,
          email_sent: emailResult.sent,
          email_error: emailResult.sent ? undefined : emailResult.reason,
        })
      }

      return new Response(JSON.stringify({ results }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'action không hợp lệ' }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
