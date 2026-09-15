import { supabase } from './supabase'

const STORAGE_KEY = 'optways_device_id'

export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

export async function registerDevice(accessToken) {
  const deviceId = getDeviceId()
  const options = {
    body: { device_id: deviceId, device_label: navigator.userAgent },
  }
  if (accessToken) {
    options.headers = { Authorization: `Bearer ${accessToken}` }
  }
  return supabase.functions.invoke('register-device', options)
}
