import * as XLSX from 'xlsx'

function normalizeLabel(value) {
  return String(value ?? '').trim().toLowerCase()
}

function sheetToRows(workbook, sheetName) {
  const name = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0]
  const sheet = workbook.Sheets[name]
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
}

function findHeaderRowIndex(rows, firstColumnLabel) {
  const target = normalizeLabel(firstColumnLabel)
  return rows.findIndex(row => normalizeLabel(row[0]) === target)
}

function buildColumnIndexMap(headerRow, columns) {
  const map = {}
  columns.forEach(col => {
    const target = normalizeLabel(col.label)
    const index = headerRow.findIndex(cell => normalizeLabel(cell) === target)
    map[col.field] = index
  })
  return map
}

function isRowEmpty(row) {
  return row.every(cell => normalizeLabel(cell) === '')
}

export async function readImportFile(file, config) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const rows = sheetToRows(workbook, config.sheetName)

  const headerRowIndex = findHeaderRowIndex(rows, config.columns[0].label)
  if (headerRowIndex === -1) {
    return { rows: [], errors: [{ row: 0, message: 'Không tìm thấy dòng tiêu đề, kiểm tra lại file mẫu' }] }
  }

  const columnIndexMap = buildColumnIndexMap(rows[headerRowIndex], config.columns)
  const skip = config.skipRowsAfterHeader || 0
  const dataRows = rows.slice(headerRowIndex + 1 + skip)

  const result = []
  const errors = []

  dataRows.forEach((row, i) => {
    if (isRowEmpty(row)) return

    const rowNumber = headerRowIndex + 1 + skip + i + 1
    const obj = {}
    const rowErrors = []

    config.columns.forEach(col => {
      const index = columnIndexMap[col.field]
      const rawValue = index === -1 ? '' : row[index]
      const value = String(rawValue ?? '').trim()

      if (col.required && value === '') {
        rowErrors.push(`Thiếu "${col.label}"`)
      }

      if (col.type === 'number' && value !== '') {
        const num = Number(value.replace(/[.,\s]/g, ''))
        obj[col.field] = Number.isNaN(num) ? null : num
        if (Number.isNaN(num)) rowErrors.push(`"${col.label}" không phải số hợp lệ`)
      } else {
        obj[col.field] = value
      }
    })

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join(', '), data: obj })
    } else {
      result.push({ __row: rowNumber, ...obj })
    }
  })

  return { rows: result, errors }
}

export function exportRowsToExcel(data, config, filename) {
  const header = config.columns.map(col => col.label)
  const body = data.map(item => config.columns.map(col => item[col.field] ?? ''))
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, config.sheetName || 'Sheet1')
  XLSX.writeFile(workbook, filename || `${config.module}-export.xlsx`)
}

export function parseDMY(value) {
  const parts = String(value ?? '').trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}
