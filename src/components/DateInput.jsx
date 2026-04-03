// DateInput — gõ số tự thêm dấu /
// value: 'YYYY-MM-DD' | onChange: (string 'YYYY-MM-DD') => void

export default function DateInput({ value, onChange, placeholder = 'DD/MM/YYYY' }) {
  // Convert YYYY-MM-DD → DD/MM/YYYY để hiển thị
  function toDisplay(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${d}/${m}/${y}`
  }

  // Convert DD/MM/YYYY → YYYY-MM-DD để lưu
  function toISO(display) {
    const clean = display.replace(/\D/g, '')
    if (clean.length === 8) {
      const d = clean.slice(0, 2)
      const m = clean.slice(2, 4)
      const y = clean.slice(4, 8)
      return `${y}-${m}-${d}`
    }
    return ''
  }

  function handleChange(e) {
    const raw = e.target.value
    // Chỉ lấy số
    const digits = raw.replace(/\D/g, '').slice(0, 8)

    // Tự thêm dấu /
    let formatted = digits
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2)
    if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)

    // Khi đủ 8 số → convert sang ISO rồi gọi onChange
    if (digits.length === 8) {
      const iso = toISO(formatted)
      onChange(iso)
    } else {
      onChange('')
    }

    // Update input hiển thị
    e.target.value = formatted
  }

  function handleKeyDown(e) {
    // Cho phép: số, backspace, delete, tab, arrow
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <input
      className="form-input"
      defaultValue={toDisplay(value)}
      key={value} // re-render khi value thay đổi từ bên ngoài
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={10}
      autoComplete="off"
    />
  )
}
