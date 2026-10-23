import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const MAX_ACCURACY_TOLERANCE = 30

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function accuracyTolerance() {
  return MAX_ACCURACY_TOLERANCE
}

async function verifyDevice(admin, userId, deviceId) {
  const { data: rows } = await admin
    .from("user_devices")
    .select("id, user_id, status")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: true })

  if (!rows || rows.length === 0) return false
  if (rows[0].user_id !== userId) return false

  const mine = rows.find((r) => r.user_id === userId)
  if (!mine || mine.status !== "approved") return false

  await admin.from("user_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", mine.id)
  return true
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return json({ error: "Thiếu authorization" }, 401)
    }

    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await authed.auth.getUser()
    if (userError || !userData?.user) {
      return json({ error: "Không xác thực được người dùng" }, 401)
    }

    const userId = userData.user.id
    const body = await req.json()
    const lat = body?.lat
    const lng = body?.lng

    if (typeof lat !== "number" || typeof lng !== "number") {
      return json({ error: "Thiếu vị trí" }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const deviceId = body?.device_id
    if (typeof deviceId !== "string" || !deviceId) {
      return json({ error: "Thiếu thông tin thiết bị, vui lòng tải lại trang" }, 400)
    }

    const deviceOk = await verifyDevice(admin, userId, deviceId)
    if (!deviceOk) {
      return json({ error: "Thiết bị này chưa được duyệt để chấm công" }, 403)
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (profile?.role === "ceo") {
      return json({ error: "Tài khoản này không dùng chấm công" }, 403)
    }

    const nowVn = new Date(Date.now() + VN_OFFSET_MS)
    const today = nowVn.toISOString().slice(0, 10)
    const hours = nowVn.getUTCHours()
    const minutes = nowVn.getUTCMinutes()
    const seconds = nowVn.getUTCSeconds()

    const { data: existing } = await admin
      .from("attendance_logs")
      .select("id, check_in, check_out, type")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle()

    if (!existing || !existing.check_in) {
      return json({ error: "Bạn chưa chấm công vào hôm nay" }, 409)
    }

    if (existing.type === "remote") {
      return json({ error: "Hôm nay bạn làm việc tại nhà, không cần chấm công về" }, 409)
    }

    if (existing.check_out) {
      return json({ error: "Bạn đã chấm công về hôm nay rồi" }, 409)
    }

    const { data: office } = await admin
      .from("office_settings")
      .select("*")
      .eq("name", "main")
      .single()

    if (!office) {
      return json({ error: "Chưa cấu hình vị trí văn phòng" }, 500)
    }

    const dist = distanceMeters(lat, lng, office.latitude, office.longitude)
    const tolerance = accuracyTolerance()

    console.log(JSON.stringify({ fn: "checkout", userId, lat, lng, accuracy: body?.accuracy ?? null, dist: Math.round(dist) }))

    if (dist - tolerance > office.radius_meters) {
      return json(
        {
          error: `Bạn đang ở ngoài phạm vi văn phòng (cách ${Math.round(dist)}m, cho phép ${office.radius_meters}m)`,
        },
        403
      )
    }

    const checkOutTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

    const { data: updated, error: updateError } = await admin
      .from("attendance_logs")
      .update({ check_out: checkOutTime })
      .eq("id", existing.id)
      .is("check_out", null)
      .select()
      .maybeSingle()

    if (updateError) {
      return json({ error: "Lỗi khi lưu chấm công về" }, 500)
    }

    if (!updated) {
      return json({ error: "Bạn đã chấm công về hôm nay rồi" }, 409)
    }

    return json({ data: updated }, 200)
  } catch (e) {
    return json({ error: "Lỗi hệ thống" }, 500)
  }
})