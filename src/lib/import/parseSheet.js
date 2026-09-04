import * as XLSX from 'xlsx'

export function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        resolve(wb)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsArrayBuffer(file)
  })
}

export function sheetToRows(workbook, config) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const headerRow = raw[config.headerRowIndex] || []
  const dataRows = raw.slice(config.dataStartRowIndex)

  const colIndexByField = {}
  config.columns.forEach(col => {
    const idx = headerRow.findIndex(h => String(h).trim() === col.label)
    colIndexByField[col.field] = idx
  })

  return dataRows
    .map((row, i) => {
      const isEmpty = row.every(c => String(c ?? '').trim() === '')
      if (isEmpty) return null
      const obj = { _rowNumber: config.dataStartRowIndex + i + 1 }
      config.columns.forEach(col => {
        const idx = colIndexByField[col.field]
        obj[col.field] = idx >= 0 ? row[idx] : ''
      })
      return obj
    })
    .filter(Boolean)
}

export function validateRows(rows, config) {
  const errors = []
  const validRows = []

  rows.forEach(row => {
    const rowErrors = []
    const parsed = {}

    config.columns.forEach(col => {
      let value = row[col.field]
      value = typeof value === 'string' ? value.trim() : value

      if (col.required && (value === '' || value === undefined || value === null)) {
        rowErrors.push(`Thiếu "${col.label}"`)
        return
      }
      if (value === '' || value === undefined || value === null) {
        parsed[col.field] = null
        return
      }

      if (col.type === 'date') {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value).trim())
        if (!m) { rowErrors.push(`"${col.label}" sai định dạng ngày (DD/MM/YYYY)`); return }
        parsed[col.field] = `${m[3]}-${m[2]}-${m[1]}`
        return
      }

      if (col.type === 'number') {
        const num = Number(String(value).replace(/[^\d.-]/g, ''))
        if (isNaN(num)) { rowErrors.push(`"${col.label}" phải là số`); return }
        parsed[col.field] = num
        return
      }

      if (col.options) {
        const found = col.options.find(([, label]) => label === String(value).trim())
        if (!found) { rowErrors.push(`"${col.label}" giá trị không hợp lệ: ${value}`); return }
        parsed[col.field] = found[0]
        return
      }

      parsed[col.field] = String(value).trim()
    })

    if (rowErrors.length > 0) errors.push({ row: row._rowNumber, messages: rowErrors })
    else validRows.push(parsed)
  })

  return { validRows, errors }
}
