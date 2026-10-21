import { supabase } from './supabase'

export const STANDARD_CHECK_OUT_HOUR = 17

const GEO_ERRORS = {
  1: 'Bạn chưa cho phép truy cập vị trí. Hãy bật quyền định vị cho trình duyệt rồi thử lại',
  2: 'Không xác định được vị trí. Hãy bật GPS/định vị trên điện thoại rồi thử lại',
  3: 'Lấy vị trí quá lâu. Hãy đứng gần cửa sổ hoặc thử lại sau vài giây',
}

const GOOD_ACCURACY_METERS = 20
const LOCATE_WINDOW_MS = 10000

function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ error: 'Thiết bị không hỗ trợ định vị' })
      return
    }

    let best = null
    let done = false
    let watchId = null

    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish(best || { error: GEO_ERRORS[3] })
    }, LOCATE_WINDOW_MS)

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const c = pos.coords
        if (!best || c.accuracy < best.accuracy) {
          best = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy }
        }
        if (c.accuracy <= GOOD_ACCURACY_METERS) finish(best)
      },
      err => {
        if (err?.code === 1 || !best) {
          finish({ error: GEO_ERRORS[err?.code] || 'Không lấy được vị trí, vui lòng thử lại' })
          return
        }
        finish(best)
      },
      { enableHighAccuracy: true, timeout: LOCATE_WINDOW_MS, maximumAge: 0 }
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
    body: { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy },
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
