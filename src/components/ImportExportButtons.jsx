import { useState, useRef } from 'react'
import { readImportFile, exportRowsToExcel } from '../lib/importExport'

export default function ImportExportButtons({ config, existingData, exportData, onImportConfirm }) {
  const fileInputRef = useRef(null)
  const [previewRows, setPreviewRows] = useState(null)
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)

    const { rows, errors: rowErrors } = await readImportFile(file, config)

    if (rowErrors.length > 0) {
      setErrors(rowErrors)
      setPreviewRows(null)
      setLoading(false)
      e.target.value = ''
      return
    }

    const processed = config.postProcessRows ? config.postProcessRows(rows, existingData) : rows
    setPreviewRows(processed)
    setErrors([])
    setLoading(false)
    e.target.value = ''
  }

  function handleConfirm() {
    onImportConfirm(previewRows)
    setPreviewRows(null)
  }

  function handleCancel() {
    setPreviewRows(null)
    setErrors([])
  }

  function handleExport() {
    exportRowsToExcel(exportData, config, `${config.module}-export.xlsx`)
  }

  return (
    <div className="import-export-buttons">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button className="btn btn-outline" onClick={handleImportClick} disabled={loading}>
        {loading ? 'Đang đọc file...' : 'Nhập Excel'}
      </button>

      <button className="btn btn-outline" onClick={handleExport}>
        Xuất Excel
      </button>

      {errors.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>File có lỗi, vui lòng kiểm tra lại</h3>
            <ul className="import-error-list">
              {errors.map((err, i) => (
                <li key={i}>Dòng {err.row}: {err.message}</li>
              ))}
            </ul>
            <button className="btn btn-primary" onClick={() => setErrors([])}>Đóng</button>
          </div>
        </div>
      )}

      {previewRows && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <h3>Xem trước dữ liệu nhập ({previewRows.length} dòng)</h3>
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {config.columns.map(col => (
                      <th key={col.field}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {config.columns.map(col => (
                        <td key={col.field}>{row[col.field] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={handleCancel}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleConfirm}>Xác nhận nhập</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
