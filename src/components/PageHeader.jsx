export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-heading-row">
      <div className="page-heading">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
