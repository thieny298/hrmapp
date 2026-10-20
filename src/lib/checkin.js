import { supabase } from './supabase'

export const STANDARD_CHECK_OUT_HOUR = 17

const GEO_ERRORS = {
  1: 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền định vị cho trình duyệt rồi thử lại',
  2: 'Không xác định được vị trí. Hãy bật GPS/định vị trên điện thoại rồi thử lại',
  3: 'Lấy vị trí quá lâu. Hãy đứng gần cửa sổ hoặc thử lại sau vài giây',
}

function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: 'Thiết bị không hỗ trợ định vị' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => resolve({ error: GEO_ERRORS[err?.code] || 'Không lấy được vị trí, vui lòng thử lại' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

export async function getLocation() {
  const loc = await locate()
  return loc.error ? null : loc
}

async function readError(error) {
  const status = error?.context?.status

  if (status === 401) {
    try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
    return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
  }

  if (status === 404) return 'Chức năng này chưa sẵn sàng, vui lòng báo admin'

  if (!status) return 'Không kết nối được máy chủ, hãy kiểm tra mạng rồi thử lại'

  try {
    const body = await error.context.json()
    if (body?.error) return body.error
  } catch {}

  return 'Có lỗi xảy ra, vui lòng thử lại'
}

async function invokeAttendance(fn) {
  const loc = await locate()
  if (loc.error) return { success: false, error: loc.error }

  const { data, error } = await supabase.functions.invoke(fn, {
    body: { lat: loc.lat, lng: loc.lng },
  })

  if (error) return { success: false, error: await readError(error) }

  return { success: true, record: data.data }
}

export function performCheckIn() {
  return invokeAttendance('checkin')
}

export function performCheckOut() {
  return invokeAttendance('checkout')
}

export function canCheckOut(record) {
  return !!record && !!record.check_in && record.type !== 'remote' && !record.check_out
}
