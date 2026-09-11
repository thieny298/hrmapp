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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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

    if (action === 'bulk-create') {
      const { data: employees, error: fetchErr } = await supabaseAdmin
        .from('employee_profiles')
        .select('id, employee_code, email, full_name')
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
        const authEmail = emp.email && emp.email.trim() !== ''
          ? emp.email.trim()
          : `${emp.employee_code}@internal.optways.net`

        let userId = null
        const existingAuthUser = userList.users.find(u => u.email === authEmail)

        if (existingAuthUser) {
          userId = existingAuthUser.id
          if (userId !== caller.id) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: 'Optways@123',
              email_confirm: true,
            })
          }
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: 'Optways@123',
            email_confirm: true,
            user_metadata: { employee_code: emp.employee_code, role: 'staff' },
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
            id: userId, email: authEmail, full_name: emp.full_name, role: 'staff',
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

        results.push({ employee_code: emp.employee_code, success: true, email: authEmail })
      }

      return new Response(JSON.stringify({ results }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'action không hợp lệ' }), { status: 400, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
