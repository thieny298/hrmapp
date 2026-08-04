import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Client admin (service role) — được Supabase tự động cấp sẵn 2 biến môi trường này, không cần tự khai báo
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Xác định người gọi function là ai, dựa vào JWT gửi kèm request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Thiếu Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Không xác thực được người gọi' }), { status: 401, headers: corsHeaders })
    }

    // Chỉ admin mới được dùng function này
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

    // ── Mời tài khoản mới ─────────────────────────────────────────────
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
        id: invited.user.id, email, full_name, role: role || 'employee',
      })

      // Tự liên kết vào hồ sơ nhân viên đã có sẵn theo email trùng khớp (nếu có)
      await supabaseAdmin.from('employee_profiles')
        .update({ user_id: invited.user.id })
        .eq('email', email)

      return new Response(JSON.stringify({ user_id: invited.user.id }), { status: 200, headers: corsHeaders })
    }

    // ── Admin đặt mật khẩu tạm (khi nhân viên không truy cập được email) ──
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

    return new Response(JSON.stringify({ error: 'action không hợp lệ' }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})