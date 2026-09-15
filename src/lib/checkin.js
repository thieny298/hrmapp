import { supabase } from './supabase'

export function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

export async function performCheckIn() {
  const loc = await getLocation()
  if (!loc) {
    return { success: false, error: 'Không lấy được vị trí (thiết bị từ chối quyền định vị)' }
  }

  const { data, error } = await supabase.functions.invoke('checkin', {
    body: { lat: loc.lat, lng: loc.lng },
  })

  if (error) {
    let message = 'Có lỗi xảy ra, vui lòng thử lại'
    try {
      const body = await error.context.json()
      if (body?.error) message = body.error
    } catch {}
    return { success: false, error: message }
  }

  return { success: true, record: data.data }
}
