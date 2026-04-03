import ReactDatePicker, { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale/vi'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('vi', vi)

// value: string 'YYYY-MM-DD' | onChange: (string 'YYYY-MM-DD') => void
export default function DatePicker({ value, onChange, placeholder = 'DD/MM/YYYY', minDate, maxDate }) {
  function toDate(str) {
    if (!str) return null
    const d = new Date(str + 'T00:00:00')
    return isNaN(d) ? null : d
  }

  function fromDate(d) {
    if (!d) return ''
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return (
    <ReactDatePicker
      selected={toDate(value)}
      onChange={d => onChange(fromDate(d))}
      dateFormat="dd/MM/yyyy"
      locale="vi"
      placeholderText={placeholder}
      minDate={minDate ? toDate(minDate) : undefined}
      maxDate={maxDate ? toDate(maxDate) : undefined}
      showYearDropdown
      showMonthDropdown
      dropdownMode="select"
      yearDropdownItemNumber={80}
      scrollableYearDropdown
      className="form-input"
      wrapperClassName="datepicker-wrapper"
      autoComplete="off"
    />
  )
}
