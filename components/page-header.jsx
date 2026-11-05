// A string title is split into letters for the entrance (docs/DASHBOARD_LAYOUT.md §5); the h1 keeps the real name.
function Letters({ title }) {
  let index = 0
  return title.split(/(\s+)/).map((word, wi) => {
    if (/^\s*$/.test(word)) {
      index += word.length
      return word
    }
    return (
      <span className="dashboard-title-word" aria-hidden="true" key={wi}>
        {Array.from(word).map((letter, i) => (
          <span className="dashboard-title-letter" key={i} style={{ animationDelay: `${index++ * 22}ms` }}>
            {letter}
          </span>
        ))}
      </span>
    )
  })
}

export function PageHeader({ title, description, actions }) {
  const text = typeof title === 'string'
  return (
    <div className="page-heading">
      <div className="min-w-0">
        <h1 aria-label={text ? title : undefined} className="text-balance">
          {text ? <Letters title={title} /> : title}
        </h1>
        {description && <p className="muted text-pretty">{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  )
}
