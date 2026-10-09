import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal.jsx'
import PageHeader from '../components/PageHeader.jsx'
import DatePicker from '../components/DatePicker.jsx'

const CATEGORIES = {
  repair: 'Sửa chữa',
  utilities: 'Điện nước',
  furniture: 'Nội thất',
  equipment: 'Thiết bị',
  moving: 'Vận chuyển',
  deposit: 'Đặt cọc/Thuê',
  other: 'Khác',
}

const GROUP_STATUS = { open: 'Đang chi', closed: 'Đã chốt' }
const GROUP_STATUS_BADGE = { open: 'badge-blue', closed: 'badge-gray' }

const INVOICE_FILTER = { '': 'Tất cả hóa đơn', yes: 'Có hóa đơn', no: 'Không hóa đơn' }
const PAY_STATUS = { unpaid: 'Chưa trả', deposit: 'Đã cọc', done: 'Hoàn thành' }
const PAY_STATUS_BADGE = { unpaid: 'badge-gray', deposit: 'badge-amber', done: 'badge-green' }
const STATUS_FILTER = { '': 'Tất cả trạng thái', deposit: 'Đã cọc', done: 'Hoàn thành', unpaid: 'Chưa trả' }
const EXPORT_HEADERS = ['Ngày chi', 'Nhóm chi phí', 'Nội dung', 'Tổng giá trị', 'Dự toán', 'Chênh lệch', 'Đã trả', 'Còn lại', 'Trạng thái', 'Nơi mua/Nơi nhận', 'Có hóa đơn', 'Ghi chú']
function pad(n) { return String(n).padStart(2, '0') }
function localDate(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function formatDate(d) { if (!d) return ''; const [y, m, day] = d.split('-'); return y && m && day ? `${day}/${m}/${y}` : d }
function formatMoney(v) { return `${Number(v || 0).toLocaleString('vi-VN')} đ` }
function digitsOnly(v) { return String(v ?? '').replace(/\D/g, '') }
function normalize(s) { return String(s ?? '').normalize('NFC').trim().toLowerCase() }

function parseQty(v) {
  const s = String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')
  const n = Number(s)
  return s && Number.isFinite(n) ? n : 0
}

function cleanQty(v) {
  const s = String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')
  const [a, ...rest] = s.split('.')
  return rest.length ? `${a}.${rest.join('').slice(0, 2)}` : a
}

function itemTotal(it) { return Math.round(parseQty(it.quantity) * Number(digitsOnly(it.unit_price) || 0)) }
function formatQty(v) { return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }
function sortedItems(e) { return [...(e.expense_items || [])].sort((a, b) => a.sort_order - b.sort_order) }
function sortedPayments(e) { return [...(e.expense_payments || [])].sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || '') || a.sort_order - b.sort_order) }
function paidOf(e) { return e.payment_type === 'installment' ? (e.expense_payments || []).reduce((s, x) => s + Number(x.amount || 0), 0) : Number(e.amount || 0) }
function remainOf(e) { return Math.max(0, Number(e.amount || 0) - paidOf(e)) }
function statusOf(e) { const paid = paidOf(e); if (paid >= Number(e.amount || 0)) return 'done'; return paid > 0 ? 'deposit' : 'unpaid' }
function sumBy(list, fn) { return list.reduce((s, x) => s + fn(x), 0) }

const EVEN_THRESHOLD = 5

function compareEstimate(actual, estimate) {
  const est = Number(estimate || 0)
  if (!est) return null
  const diff = Number(actual || 0) - est
  const pct = (diff / est) * 100
  const kind = Math.abs(pct) <= EVEN_THRESHOLD ? 'even' : diff > 0 ? 'up' : 'down'
  return { diff, pct, kind, estimate: est }
}

function formatSigned(v) { return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v)).toLocaleString('vi-VN')}` }
function formatPct(v) { return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` }

const TREND = {
  up: { icon: 'fa-arrow-trend-up', color: 'var(--red)' },
  down: { icon: 'fa-arrow-trend-down', color: 'var(--green)' },
  even: { icon: 'fa-equals', color: 'var(--text-2)' },
}

function EstimateTrend({ cmp, size = 12 }) {
  if (!cmp) return null
  const t = TREND[cmp.kind]
  return (
    <span title={`Dự toán: ${formatMoney(cmp.estimate)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: `${size}px`, color: t.color, whiteSpace: 'nowrap' }}>
      <i className={`fa-light ${t.icon}`} />
      {cmp.kind === 'even' ? 'Sát dự toán' : `${formatSigned(cmp.diff)} (${formatPct(cmp.pct)})`}
    </span>
  )
}

function estimateStats(rows) {
  const withEst = rows.filter(r => Number(r.estimate || 0) > 0)
  const estTotal = sumBy(withEst, r => Number(r.estimate))
  const actTotal = sumBy(withEst, r => Number(r.amount || 0))
  const cmps = withEst.map(r => compareEstimate(r.amount, r.estimate))
  return {
    count: withEst.length,
    estTotal,
    actTotal,
    total: compareEstimate(actTotal, estTotal),
    avgDeviation: cmps.length ? sumBy(cmps, c => Math.abs(c.pct)) / cmps.length : 0,
    up: cmps.filter(c => c.kind === 'up').length,
    down: cmps.filter(c => c.kind === 'down').length,
    even: cmps.filter(c => c.kind === 'even').length,
  }
}

let payKey = 0
function newPayment(data = {}) { payKey += 1; return { key: `p${payKey}`, paid_on: localDate(), amount: '', note: '', ...data } }

function findItemColumns(row) {
  const cells = row.map(c => normalize(c))
  const name = cells.findIndex(c => c.startsWith('tên') || c === 'chi tiết' || c === 'sản phẩm' || c === 'hàng hóa' || c === 'hàng hoá')
  const qty = cells.findIndex(c => c === 'sl' || c.startsWith('số lượng') || c === 'sl.')
  const price = cells.findIndex(c => c.startsWith('đơn giá'))
  return name >= 0 && qty >= 0 && price >= 0 ? { name, qty, price } : null
}

function parseItemsSheet(rows) {
  let cols = null
  let start = 0
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    cols = findItemColumns(rows[i] || [])
    if (cols) { start = i + 1; break }
  }
  if (!cols) return null
  const items = []
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] || []
    const name = String(r[cols.name] ?? '').replace(/\s+/g, ' ').trim()
    const qty = parseQty(r[cols.qty])
    const price = typeof r[cols.price] === 'number' ? Math.round(r[cols.price]) : Number(digitsOnly(r[cols.price]) || 0)
    if (!name || qty <= 0) continue
    items.push({ name, quantity: String(qty), unit_price: String(price) })
  }
  return items
}

let itemKey = 0
function newItem(data = {}) { itemKey += 1; return { key: `i${itemKey}`, name: '', quantity: '1', unit_price: '', ...data } }

const EMPTY_GROUP = { name: '', start_date: '', end_date: '', status: 'open', note: '' }
const EMPTY_EXPENSE = { spent_on: localDate(), category: 'repair', description: '', amount: '', vendor: '', has_invoice: false, note: '', items: [], payment_type: 'full', payments: [], estimate: '' }

export default function ExpensesPage() {
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [modal, setModal] = useState(null)
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP)
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterInvoice, setFilterInvoice] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [toast, setToast] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const itemFileRef = useRef(null)
  const [estimateDraft, setEstimateDraft] = useState({})

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => { if (groupId) fetchExpenses(groupId); else setExpenses([]) }, [groupId])

  async function fetchGroups(selectId) {
    const { data } = await supabase.from('expense_groups').select('*').order('created_at', { ascending: false })
    const list = data || []
    setGroups(list)
    setGroupId(prev => {
      if (selectId) return selectId
      if (prev && list.some(g => g.id === prev)) return prev
      return list[0]?.id || ''
    })
    setLoading(false)
  }

  async function fetchExpenses(id) {
    setListLoading(true)
    const { data } = await supabase.from('expenses').select('*, expense_items(*), expense_payments(*)').eq('group_id', id).order('spent_on', { ascending: false }).order('created_at', { ascending: false })
    setExpenses(data || [])
    setListLoading(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const currentGroup = groups.find(g => g.id === groupId) || null

  const filtered = useMemo(() => expenses.filter(e => {
    if (filterCat && e.category !== filterCat) return false
    if (filterInvoice === 'yes' && !e.has_invoice) return false
    if (filterInvoice === 'no' && e.has_invoice) return false
    if (filterStatus && statusOf(e) !== filterStatus) return false
    const q = normalize(search)
    if (!q) return true
    return normalize(e.description).includes(q) || normalize(e.vendor).includes(q) || normalize(e.note).includes(q) || (e.expense_items || []).some(it => normalize(it.name).includes(q))
  }), [expenses, search, filterCat, filterInvoice, filterStatus])

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses])
  const invoiceTotal = useMemo(() => expenses.filter(e => e.has_invoice).reduce((s, e) => s + Number(e.amount || 0), 0), [expenses])
  const filteredTotal = useMemo(() => filtered.reduce((s, e) => s + Number(e.amount || 0), 0), [filtered])
  const paidTotal = useMemo(() => sumBy(expenses, paidOf), [expenses])
  const remainTotal = useMemo(() => sumBy(expenses, remainOf), [expenses])
  const pendingCount = useMemo(() => expenses.filter(e => statusOf(e) !== 'done').length, [expenses])
  const filteredPaid = useMemo(() => sumBy(filtered, paidOf), [filtered])
  const filteredRemain = useMemo(() => sumBy(filtered, remainOf), [filtered])
  const estStats = useMemo(() => estimateStats(expenses), [expenses])
  const draftRows = useMemo(() => expenses.map(e => ({ ...e, estimate: digitsOnly(estimateDraft[e.id]) ? Number(digitsOnly(estimateDraft[e.id])) : null })), [expenses, estimateDraft])
  const draftStats = useMemo(() => estimateStats(draftRows), [draftRows])

  function openEstimate() {
    const draft = {}
    expenses.forEach(e => { draft[e.id] = e.estimate != null ? String(Number(e.estimate)) : '' })
    setEstimateDraft(draft)
    setError('')
    setModal('estimate')
  }

  async function saveEstimates() {
    const changed = expenses.filter(e => {
      const next = digitsOnly(estimateDraft[e.id]) ? Number(digitsOnly(estimateDraft[e.id])) : null
      const prev = e.estimate != null ? Number(e.estimate) : null
      return next !== prev
    })
    if (!changed.length) { setModal(null); return }
    setSaving(true); setError('')
    const results = await Promise.all(changed.map(e => supabase.from('expenses').update({ estimate: digitsOnly(estimateDraft[e.id]) ? Number(digitsOnly(estimateDraft[e.id])) : null }).eq('id', e.id)))
    setSaving(false)
    const failed = results.find(r => r.error)
    if (failed) { setError(failed.error.message); return }
    setModal(null)
    fetchExpenses(groupId)
    showToast(`Đã cập nhật dự toán ${changed.length} khoản`)
  }

  const formItemsTotal = expenseForm.items.reduce((s, it) => s + itemTotal(it), 0)
  const hasFormItems = expenseForm.items.length > 0
  const formTotal = hasFormItems ? formItemsTotal : Number(digitsOnly(expenseForm.amount) || 0)
  const isInstallment = expenseForm.payment_type === 'installment'
  const formPaid = expenseForm.payments.reduce((s, x) => s + Number(digitsOnly(x.amount) || 0), 0)

  function setInstallment(on) {
    setExpenseForm(p => ({
      ...p,
      payment_type: on ? 'installment' : 'full',
      payments: on && !p.payments.length ? [newPayment({ paid_on: p.spent_on || localDate(), note: 'Cọc' })] : p.payments,
    }))
  }

  function updatePayment(key, field, value) {
    setExpenseForm(p => ({ ...p, payments: p.payments.map(x => (x.key === key ? { ...x, [field]: value } : x)) }))
  }

  function addPayment() { setExpenseForm(p => ({ ...p, payments: [...p.payments, newPayment({ note: 'Thanh toán đợt ' + (p.payments.length + 1) })] })) }
  function removePayment(key) { setExpenseForm(p => ({ ...p, payments: p.payments.filter(x => x.key !== key) })) }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function updateItem(key, field, value) {
    setExpenseForm(p => ({ ...p, items: p.items.map(it => (it.key === key ? { ...it, [field]: value } : it)) }))
  }

  async function handleItemFile(ev) {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setError('')
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true })
      const parsed = parseItemsSheet(rows)
      if (!parsed) { setError('Không tìm thấy cột Tên, Số lượng, Đơn giá trong file. Tải file mẫu để xem cách đặt cột.'); return }
      if (!parsed.length) { setError('File không có dòng chi tiết nào hợp lệ'); return }
      setExpenseForm(p => ({ ...p, items: [...p.items.filter(it => it.name.trim()), ...parsed.map(x => newItem(x))] }))
      showToast(`Đã thêm ${parsed.length} chi tiết từ file`)
    } catch {
      setError('Không đọc được file. Kiểm tra lại định dạng.')
    }
  }

  function downloadItemTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tên', 'Số lượng', 'Đơn giá'],
      ['Bàn làm việc', 4, 2000000],
      ['Ghế xoay', 4, 1000000],
    ])
    ws['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Chi tiết')
    XLSX.writeFile(wb, 'mau-chi-tiet.xlsx')
  }

  function addItem() { setExpenseForm(p => ({ ...p, items: [...p.items, newItem()] })) }
  function removeItem(key) { setExpenseForm(p => ({ ...p, items: p.items.filter(it => it.key !== key) })) }

  function openNewGroup() { setGroupForm(EMPTY_GROUP); setError(''); setModal('group') }
  function openEditGroup() { if (!currentGroup) return; setGroupForm({ ...EMPTY_GROUP, ...currentGroup, start_date: currentGroup.start_date || '', end_date: currentGroup.end_date || '', note: currentGroup.note || '' }); setError(''); setModal('group') }

  async function saveGroup() {
    if (!groupForm.name.trim()) { setError('Vui lòng nhập tên đợt chi'); return }
    if (groupForm.start_date && groupForm.end_date && groupForm.start_date > groupForm.end_date) { setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'); return }
    setSaving(true); setError('')
    const payload = {
      name: groupForm.name.trim(),
      start_date: groupForm.start_date || null,
      end_date: groupForm.end_date || null,
      status: groupForm.status,
      note: groupForm.note.trim() || null,
    }
    const res = groupForm.id
      ? await supabase.from('expense_groups').update(payload).eq('id', groupForm.id).select().single()
      : await supabase.from('expense_groups').insert(payload).select().single()
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    setModal(null)
    await fetchGroups(res.data.id)
    showToast(groupForm.id ? 'Đã cập nhật đợt chi' : 'Đã tạo đợt chi mới')
  }

  async function deleteGroup() {
    if (!currentGroup) return
    if (!confirm(`Xoá đợt "${currentGroup.name}" và toàn bộ ${expenses.length} khoản chi bên trong?`)) return
    const { error: delErr } = await supabase.from('expense_groups').delete().eq('id', currentGroup.id)
    if (delErr) { alert(delErr.message); return }
    setModal(null)
    setGroupId('')
    await fetchGroups()
    showToast('Đã xoá đợt chi')
  }

  function openNewExpense() { setExpenseForm(EMPTY_EXPENSE); setError(''); setModal('expense') }
  function openEditExpense(e) {
    const items = sortedItems(e).map(it => newItem({ name: it.name, quantity: String(Number(it.quantity)), unit_price: String(Number(it.unit_price)) }))
    const payments = sortedPayments(e).map(x => newPayment({ paid_on: x.paid_on, amount: String(Number(x.amount)), note: x.note || '' }))
    const { expense_items, expense_payments, ...rest } = e
    setExpenseForm({ ...EMPTY_EXPENSE, ...rest, estimate: e.estimate != null ? String(Number(e.estimate)) : '', amount: String(e.amount ?? ''), vendor: e.vendor || '', has_invoice: !!e.has_invoice, note: e.note || '', items, payment_type: e.payment_type || 'full', payments })
    setError('')
    setModal('expense')
  }

  async function saveExpense() {
    if (!expenseForm.spent_on) { setError('Vui lòng chọn ngày chi'); return }
    if (!expenseForm.description.trim()) { setError('Vui lòng nhập nội dung'); return }
    if (hasFormItems) {
      if (expenseForm.items.some(it => !it.name.trim())) { setError('Vui lòng nhập tên cho tất cả chi tiết'); return }
      if (expenseForm.items.some(it => parseQty(it.quantity) <= 0)) { setError('Số lượng phải lớn hơn 0'); return }
    } else if (!digitsOnly(expenseForm.amount)) { setError('Vui lòng nhập số tiền'); return }
    if (isInstallment) {
      if (!expenseForm.payments.length) { setError('Vui lòng thêm ít nhất 1 đợt thanh toán'); return }
      if (expenseForm.payments.some(x => !x.paid_on)) { setError('Vui lòng chọn ngày cho tất cả đợt thanh toán'); return }
      if (expenseForm.payments.some(x => !Number(digitsOnly(x.amount)))) { setError('Số tiền mỗi đợt thanh toán phải lớn hơn 0'); return }
      if (formPaid > formTotal) { setError(`Tổng đã trả (${formatMoney(formPaid)}) đang lớn hơn tổng giá trị (${formatMoney(formTotal)})`); return }
    }
    setSaving(true); setError('')
    const payload = {
      group_id: groupId,
      spent_on: expenseForm.spent_on,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount: hasFormItems ? formItemsTotal : Number(digitsOnly(expenseForm.amount)),
      vendor: expenseForm.vendor.trim() || null,
      has_invoice: !!expenseForm.has_invoice,
      payment_type: expenseForm.payment_type,
      estimate: digitsOnly(expenseForm.estimate) ? Number(digitsOnly(expenseForm.estimate)) : null,
      note: expenseForm.note.trim() || null,
    }
    const res = expenseForm.id
      ? await supabase.from('expenses').update(payload).eq('id', expenseForm.id).select('id').single()
      : await supabase.from('expenses').insert(payload).select('id').single()
    if (res.error) { setSaving(false); setError(res.error.message); return }
    const expenseId = res.data.id
    const { error: delErr } = await supabase.from('expense_items').delete().eq('expense_id', expenseId)
    if (delErr) { setSaving(false); setError(delErr.message); return }
    if (hasFormItems) {
      const { error: itemErr } = await supabase.from('expense_items').insert(expenseForm.items.map((it, i) => ({
        expense_id: expenseId,
        name: it.name.trim(),
        quantity: parseQty(it.quantity),
        unit_price: Number(digitsOnly(it.unit_price) || 0),
        sort_order: i,
      })))
      if (itemErr) { setSaving(false); setError(itemErr.message); return }
    }
    const { error: payDelErr } = await supabase.from('expense_payments').delete().eq('expense_id', expenseId)
    if (payDelErr) { setSaving(false); setError(payDelErr.message); return }
    if (isInstallment) {
      const { error: payErr } = await supabase.from('expense_payments').insert(expenseForm.payments.map((x, i) => ({
        expense_id: expenseId,
        paid_on: x.paid_on,
        amount: Number(digitsOnly(x.amount)),
        note: x.note.trim() || null,
        sort_order: i,
      })))
      if (payErr) { setSaving(false); setError(payErr.message); return }
    }
    setSaving(false)
    setModal(null)
    fetchExpenses(groupId)
    showToast(expenseForm.id ? 'Đã cập nhật khoản chi' : 'Đã thêm khoản chi')
  }

  async function deleteExpense(e) {
    if (!confirm(`Xoá khoản chi "${e.description}"?`)) return
    const { error: delErr } = await supabase.from('expenses').delete().eq('id', e.id)
    if (delErr) { alert(delErr.message); return }
    fetchExpenses(groupId)
  }

  function exportExcel() {
    if (!currentGroup) return
    const rows = filtered.map(e => [formatDate(e.spent_on), CATEGORIES[e.category] || e.category, e.description, Number(e.amount || 0), e.estimate != null ? Number(e.estimate) : '', e.estimate ? Number(e.amount || 0) - Number(e.estimate) : '', paidOf(e), remainOf(e), PAY_STATUS[statusOf(e)], e.vendor || '', e.has_invoice ? 'Có' : 'Không', e.note || ''])
    const ws = XLSX.utils.aoa_to_sheet([
      [currentGroup.name],
      [],
      EXPORT_HEADERS,
      ...rows,
      [],
      ['', '', 'Tổng cộng', filteredTotal, sumBy(filtered, e => Number(e.estimate || 0)), '', filteredPaid, filteredRemain],
      ['', '', 'Có hóa đơn', sumBy(filtered.filter(e => e.has_invoice), e => Number(e.amount || 0))],
      ['', '', 'Không hóa đơn', sumBy(filtered.filter(e => !e.has_invoice), e => Number(e.amount || 0))],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Chi phí')
    const detailRows = filtered.flatMap(e => sortedItems(e).map(it => [formatDate(e.spent_on), e.description, it.name, Number(it.quantity), Number(it.unit_price), itemTotal(it)]))
    if (detailRows.length) {
      const ws2 = XLSX.utils.aoa_to_sheet([['Ngày chi', 'Khoản chi', 'Chi tiết', 'Số lượng', 'Đơn giá', 'Thành tiền'], ...detailRows])
      ws2['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết')
    }
    const payRows = filtered.filter(e => e.payment_type === 'installment').flatMap(e => sortedPayments(e).map(x => [e.description, formatDate(x.paid_on), Number(x.amount), x.note || '']))
    if (payRows.length) {
      const ws3 = XLSX.utils.aoa_to_sheet([['Khoản chi', 'Ngày trả', 'Số tiền', 'Ghi chú'], ...payRows])
      ws3['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Thanh toán')
    }
    const safeName = normalize(currentGroup.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    XLSX.writeFile(wb, `chi-phi-${safeName || 'export'}.xlsx`)
  }

  if (loading) return <div className="loading-screen" style={{ minHeight: '60vh' }}><div className="spinner" /></div>

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
          padding: '12px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
          background: '#dcfce7', color: '#16a34a', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <i className="fa-solid fa-check-circle" style={{ marginRight: '8px' }} />
          {toast}
        </div>
      )}

      <PageHeader
        title="Chi phí"
        subtitle="Tổng hợp các khoản chi theo từng đợt"
        action={
          <button className="btn btn-primary" onClick={openNewGroup}>
            <i className="fa-light fa-folder-plus" />Đợt chi mới
          </button>
        }
      />

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><i className="fa-light fa-receipt" /></div>
            <div className="empty-text">Chưa có đợt chi nào</div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={openNewGroup}>Tạo đợt chi đầu tiên</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
                <select className="form-select" style={{ width: 'auto', minWidth: '220px', maxWidth: '100%' }} value={groupId} onChange={e => setGroupId(e.target.value)}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {currentGroup && <span className={`badge ${GROUP_STATUS_BADGE[currentGroup.status]}`}>{GROUP_STATUS[currentGroup.status]}</span>}
                {currentGroup && (currentGroup.start_date || currentGroup.end_date) && (
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    <i className="fa-light fa-calendar" style={{ marginRight: '4px' }} />
                    {formatDate(currentGroup.start_date) || '…'} → {formatDate(currentGroup.end_date) || '…'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn" onClick={openEstimate} disabled={!expenses.length}><i className="fa-light fa-scale-balanced" />Dự toán</button>
                <button className="btn" onClick={openEditGroup}><i className="fa-light fa-pen" />Sửa đợt chi</button>
              </div>
            </div>
            {currentGroup?.note && <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '10px' }}>{currentGroup.note}</div>}
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="stat-label">Tổng dự toán</div>
              <div className="stat-value">{estStats.count ? formatMoney(estStats.estTotal) : '—'}</div>
              <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {estStats.count ? <><EstimateTrend cmp={estStats.total} /><span>· {estStats.count}/{expenses.length} khoản</span></> : 'Chưa nhập dự toán'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tổng giá trị</div>
              <div className="stat-value">{formatMoney(total)}</div>
              <div className="stat-sub">{expenses.length} khoản · Có hóa đơn {formatMoney(invoiceTotal)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Đã thanh toán</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatMoney(paidTotal)}</div>
              <div className="stat-sub">{total ? Math.round((paidTotal / total) * 100) : 0}% tổng giá trị</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Còn phải trả</div>
              <div className="stat-value" style={{ color: remainTotal > 0 ? 'var(--red)' : 'inherit' }}>{formatMoney(remainTotal)}</div>
              <div className="stat-sub">{pendingCount ? `${pendingCount} khoản chưa trả đủ` : 'Đã trả đủ tất cả'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div className="search-wrap">
                <input className="search-input" placeholder="Tìm nội dung, nơi mua/nhận..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="">Tất cả nhóm</option>
                {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="form-select" style={{ width: 'auto' }} value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)}>
                {Object.entries(INVOICE_FILTER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                {Object.entries(STATUS_FILTER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <button className="btn" onClick={exportExcel} disabled={!filtered.length}><i className="fa-light fa-file-arrow-down" />Xuất Excel</button>
              <button className="btn btn-primary" onClick={openNewExpense}>+ Thêm khoản chi</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{['Ngày chi', 'Nhóm', 'Nội dung', 'Nơi mua/Nơi nhận', 'Hóa đơn', 'Trạng thái', 'Số tiền', 'Thao tác'].map(c => <th key={c} style={c === 'Số tiền' ? { textAlign: 'right' } : undefined}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {listLoading
                    ? <tr><td colSpan="8"><div className="empty"><div className="spinner" /></div></td></tr>
                    : filtered.length === 0
                      ? <tr><td colSpan="8"><div className="empty"><div className="empty-icon"><i className="fa-light fa-receipt" /></div><div className="empty-text">{expenses.length ? 'Không có khoản chi phù hợp' : 'Chưa có khoản chi nào trong đợt này'}</div></div></td></tr>
                      : filtered.map(e => {
                        const items = sortedItems(e)
                        const payments = e.payment_type === 'installment' ? sortedPayments(e) : []
                        const canExpand = items.length > 0 || payments.length > 0
                        const isOpen = expanded.has(e.id)
                        const st = statusOf(e)
                        return (
                        <Fragment key={e.id}>
                        <tr onClick={canExpand ? () => toggleExpand(e.id) : undefined} style={canExpand ? { cursor: 'pointer' } : undefined}>
                          <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{formatDate(e.spent_on)}</td>
                          <td><span className="badge badge-gray">{CATEGORIES[e.category] || e.category}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                              {canExpand && <i className={`fa-light fa-chevron-${isOpen ? 'down' : 'right'}`} style={{ fontSize: '11px', color: 'var(--text-2)', width: '12px' }} />}
                              <span>{e.description}</span>
                              {items.length > 0 && <span className="badge badge-blue" style={{ fontWeight: 500 }}>{items.length} chi tiết</span>}
                            </div>
                            {e.note && <div style={{ fontSize: '12px', color: 'var(--text-2)', paddingLeft: canExpand ? '18px' : 0 }}>{e.note}</div>}
                          </td>
                          <td style={{ color: 'var(--text-2)' }}>{e.vendor || '—'}</td>
                          <td>{e.has_invoice ? <span className="badge badge-green">Có</span> : <span className="badge badge-gray">Không</span>}</td>
                          <td><span className={`badge ${PAY_STATUS_BADGE[st]}`}>{PAY_STATUS[st]}</span></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600 }}>{formatMoney(e.amount)}</div>
                            <EstimateTrend cmp={compareEstimate(e.amount, e.estimate)} />
                            {st !== 'done' && <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Đã trả {formatMoney(paidOf(e))}</div>}
                            {st !== 'done' && <div style={{ fontSize: '12px', color: 'var(--red)' }}>Còn {formatMoney(remainOf(e))}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '2px' }} onClick={ev => ev.stopPropagation()}>
                              <button className="icon-btn" onClick={() => openEditExpense(e)} title="Sửa"><i className="fa-light fa-pen" /></button>
                              <button className="icon-btn" onClick={() => deleteExpense(e)} title="Xoá"><i className="fa-light fa-trash" /></button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && canExpand && (
                          <tr>
                            <td colSpan="8" style={{ background: 'var(--bg)', padding: '8px 16px 12px 40px' }}>
                              {items.length > 0 && (
                              <table style={{ width: '100%', marginBottom: payments.length ? '12px' : 0 }}>
                                <thead>
                                  <tr>
                                    <th style={{ background: 'transparent' }}>Chi tiết</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}>Số lượng</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}>Đơn giá</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}>Thành tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map(it => (
                                    <tr key={it.id}>
                                      <td>{it.name}</td>
                                      <td style={{ textAlign: 'right' }}>{formatQty(it.quantity)}</td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(it.unit_price)}</td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>{formatMoney(itemTotal(it))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              )}
                              {payments.length > 0 && (
                              <table style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th style={{ background: 'transparent' }}>Ngày trả</th>
                                    <th style={{ background: 'transparent' }}>Ghi chú</th>
                                    <th style={{ background: 'transparent', textAlign: 'right' }}>Số tiền</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payments.map(x => (
                                    <tr key={x.id}>
                                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(x.paid_on)}</td>
                                      <td>{x.note || '—'}</td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>{formatMoney(x.amount)}</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td colSpan="2" style={{ fontWeight: 600 }}>Đã trả {formatMoney(paidOf(e))}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: remainOf(e) > 0 ? 'var(--red)' : 'var(--green)' }}>{remainOf(e) > 0 ? `Còn ${formatMoney(remainOf(e))}` : 'Đã trả đủ'}</td>
                                  </tr>
                                </tbody>
                              </table>
                              )}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        )
                      })
                  }
                </tbody>
                {filtered.length > 0 && !listLoading && (
                  <tfoot>
                    <tr>
                      <td colSpan="6" style={{ fontWeight: 600 }}>{filterCat || filterInvoice || filterStatus || search ? `Tổng (${filtered.length} khoản đang lọc)` : `Tổng (${filtered.length} khoản)`}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatMoney(filteredTotal)}</div>
                        {filteredRemain > 0 && <div style={{ fontSize: '12px', color: 'var(--red)' }}>Còn {formatMoney(filteredRemain)}</div>}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {modal === 'group' && (
        <Modal
          title={groupForm.id ? 'Sửa đợt chi' : 'Tạo đợt chi mới'}
          onClose={() => setModal(null)}
          footer={[
            groupForm.id && <button key="d" className="btn" style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={deleteGroup}>Xoá đợt</button>,
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={saveGroup} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ].filter(Boolean)}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Tên đợt chi<span className="req">*</span></label>
            <input className="form-input" value={groupForm.name} placeholder="Ví dụ: Dời văn phòng 10/2026" onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Từ ngày</label>
              <DatePicker value={groupForm.start_date} onChange={v => setGroupForm(p => ({ ...p, start_date: v }))} placeholder="DD/MM/YYYY" />
            </div>
            <div className="form-group">
              <label className="form-label">Đến ngày</label>
              <DatePicker value={groupForm.end_date} onChange={v => setGroupForm(p => ({ ...p, end_date: v }))} placeholder="DD/MM/YYYY" minDate={groupForm.start_date || undefined} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Trạng thái</label>
            <select className="form-select" value={groupForm.status} onChange={e => setGroupForm(p => ({ ...p, status: e.target.value }))}>
              {Object.entries(GROUP_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ghi chú</label>
            <textarea className="form-textarea" value={groupForm.note} onChange={e => setGroupForm(p => ({ ...p, note: e.target.value }))} />
          </div>
        </Modal>
      )}

      {modal === 'estimate' && (
        <Modal
          title={`Dự toán · ${currentGroup?.name || ''}`}
          size="xl"
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={saveEstimates} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu dự toán'}</button>
          ]}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginBottom: '14px' }}>
            {[
              ['Tổng dự toán', draftStats.count ? formatMoney(draftStats.estTotal) : '—', `${draftStats.count}/${expenses.length} khoản có dự toán`],
              ['Thực tế (cùng các khoản)', draftStats.count ? formatMoney(draftStats.actTotal) : '—', draftStats.total ? <EstimateTrend cmp={draftStats.total} /> : '—'],
              ['Lệch trung bình mỗi khoản', draftStats.count ? `${draftStats.avgDeviation.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : '—', `Sát dự toán khi lệch trong ±${EVEN_THRESHOLD}%`],
              ['Phân loại', draftStats.count ? `${draftStats.up} vượt · ${draftStats.down} thấp hơn` : '—', `${draftStats.even} khoản sát dự toán`],
            ].map(([k, v, sub]) => (
              <div key={k} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '3px' }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{v}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>{sub}</div>
              </div>
            ))}
          </div>
          <div className="table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table>
              <thead>
                <tr>
                  <th>Khoản chi</th>
                  <th style={{ textAlign: 'right' }}>Thực tế</th>
                  <th style={{ width: '170px' }}>Dự toán</th>
                  <th>Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.description}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{CATEGORIES[r.category] || r.category} · {formatDate(r.spent_on)}</div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMoney(r.amount)}</td>
                    <td>
                      <input
                        className="form-input"
                        inputMode="numeric"
                        value={digitsOnly(estimateDraft[r.id]) ? Number(digitsOnly(estimateDraft[r.id])).toLocaleString('vi-VN') : ''}
                        placeholder="Chưa có"
                        onChange={ev => setEstimateDraft(p => ({ ...p, [r.id]: digitsOnly(ev.target.value) }))}
                      />
                    </td>
                    <td>{r.estimate ? <EstimateTrend cmp={compareEstimate(r.amount, r.estimate)} size={13} /> : <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal
          title={expenseForm.id ? 'Sửa khoản chi' : 'Thêm khoản chi'}
          size="xl"
          onClose={() => setModal(null)}
          footer={[
            <button key="c" className="btn" onClick={() => setModal(null)}>Huỷ</button>,
            <button key="s" className="btn btn-primary" onClick={saveExpense} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          ]}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ngày chi<span className="req">*</span></label>
              <DatePicker value={expenseForm.spent_on} onChange={v => setExpenseForm(p => ({ ...p, spent_on: v }))} placeholder="DD/MM/YYYY" />
            </div>
            <div className="form-group">
              <label className="form-label">Nhóm chi phí</label>
              <select className="form-select" value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nội dung<span className="req">*</span></label>
            <input className="form-input" value={expenseForm.description} placeholder="Ví dụ: Sơn lại tường phòng họp" onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Chi tiết</label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={downloadItemTemplate} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}><i className="fa-light fa-download" style={{ marginRight: '4px' }} />File mẫu</button>
                <button type="button" onClick={() => itemFileRef.current?.click()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '13px' }}><i className="fa-light fa-file-arrow-up" style={{ marginRight: '4px' }} />Nhập từ Excel</button>
                <button type="button" onClick={addItem} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '13px' }}>+ Thêm chi tiết</button>
              </div>
              <input ref={itemFileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleItemFile} />
            </div>
            {hasFormItems ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '460px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 120px 110px 28px', gap: '6px', fontSize: '11px', color: 'var(--text-2)' }}>
                    <span>Tên</span><span>SL</span><span>Đơn giá</span><span style={{ textAlign: 'right' }}>Thành tiền</span><span />
                  </div>
                  {expenseForm.items.map(it => (
                    <div key={it.key} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 120px 110px 28px', gap: '6px', alignItems: 'center' }}>
                      <input className="form-input" value={it.name} placeholder="Ví dụ: Bàn làm việc" onChange={e => updateItem(it.key, 'name', e.target.value)} />
                      <input className="form-input" inputMode="decimal" value={it.quantity} onChange={e => updateItem(it.key, 'quantity', cleanQty(e.target.value))} />
                      <input
                        className="form-input"
                        inputMode="numeric"
                        value={digitsOnly(it.unit_price) ? Number(digitsOnly(it.unit_price)).toLocaleString('vi-VN') : ''}
                        placeholder="0"
                        onChange={e => updateItem(it.key, 'unit_price', digitsOnly(e.target.value))}
                      />
                      <span style={{ textAlign: 'right', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>{formatMoney(itemTotal(it))}</span>
                      <button type="button" className="icon-btn" onClick={() => removeItem(it.key)} title="Xoá dòng"><i className="fa-light fa-xmark" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>Khoản chi có nhiều món (ví dụ bàn 4 cái, ghế 4 cái) thì thêm chi tiết, số tiền sẽ tự cộng.</div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tổng giá trị (đ)<span className="req">*</span></label>
              {hasFormItems ? (
                <div className="field-display" style={{ fontWeight: 600 }}>{formatMoney(formItemsTotal)}</div>
              ) : (
                <input
                  className="form-input"
                  inputMode="numeric"
                  value={digitsOnly(expenseForm.amount) ? Number(digitsOnly(expenseForm.amount)).toLocaleString('vi-VN') : ''}
                  placeholder="0"
                  onChange={e => setExpenseForm(p => ({ ...p, amount: digitsOnly(e.target.value) }))}
                />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Dự toán (đ)</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={digitsOnly(expenseForm.estimate) ? Number(digitsOnly(expenseForm.estimate)).toLocaleString('vi-VN') : ''}
                placeholder="Không bắt buộc"
                onChange={e => setExpenseForm(p => ({ ...p, estimate: digitsOnly(e.target.value) }))}
              />
              <div style={{ marginTop: '4px' }}><EstimateTrend cmp={compareEstimate(formTotal, expenseForm.estimate)} /></div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nơi mua/Nơi nhận</label>
            <input className="form-input" value={expenseForm.vendor} onChange={e => setExpenseForm(p => ({ ...p, vendor: e.target.value }))} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: isInstallment ? '8px' : 0 }}>
              <input type="checkbox" checked={isInstallment} onChange={e => setInstallment(e.target.checked)} />
              Trả cọc / nhiều đợt
            </label>
            {isInstallment && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: '460px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 130px 1fr 28px', gap: '6px', fontSize: '11px', color: 'var(--text-2)' }}>
                      <span>Ngày trả</span><span>Số tiền</span><span>Ghi chú</span><span />
                    </div>
                    {expenseForm.payments.map(x => (
                      <div key={x.key} style={{ display: 'grid', gridTemplateColumns: '140px 130px 1fr 28px', gap: '6px', alignItems: 'center' }}>
                        <DatePicker value={x.paid_on} onChange={v => updatePayment(x.key, 'paid_on', v)} placeholder="DD/MM/YYYY" />
                        <input
                          className="form-input"
                          inputMode="numeric"
                          value={digitsOnly(x.amount) ? Number(digitsOnly(x.amount)).toLocaleString('vi-VN') : ''}
                          placeholder="0"
                          onChange={e => updatePayment(x.key, 'amount', digitsOnly(e.target.value))}
                        />
                        <input className="form-input" value={x.note} placeholder="Cọc, đợt 2, tất toán..." onChange={e => updatePayment(x.key, 'note', e.target.value)} />
                        <button type="button" className="icon-btn" onClick={() => removePayment(x.key)} title="Xoá đợt"><i className="fa-light fa-xmark" /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginTop: '10px', fontSize: '13px' }}>
                  <button type="button" onClick={addPayment} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '13px' }}>+ Thêm đợt thanh toán</button>
                  <span>
                    Đã trả <strong>{formatMoney(formPaid)}</strong>
                    {' · '}
                    <span style={{ color: formTotal - formPaid > 0 ? 'var(--red)' : formTotal - formPaid < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {formTotal - formPaid > 0 ? `Còn ${formatMoney(formTotal - formPaid)}` : formTotal - formPaid < 0 ? `Vượt ${formatMoney(formPaid - formTotal)}` : 'Đã trả đủ'}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!expenseForm.has_invoice} onChange={e => setExpenseForm(p => ({ ...p, has_invoice: e.target.checked }))} />
              Có hóa đơn (nơi mua/nơi nhận tiền có xuất hóa đơn)
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Ghi chú</label>
            <textarea className="form-textarea" value={expenseForm.note} onChange={e => setExpenseForm(p => ({ ...p, note: e.target.value }))} />
          </div>
        </Modal>
      )}

    </div>
  )
}
